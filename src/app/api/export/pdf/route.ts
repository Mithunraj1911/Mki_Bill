// GET /api/export/pdf - generate and stream a PDF for a single bill.
// Query param: billId (the database row id, not the human-readable BILL-YYYY-NNNNN)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildBillPdfBuffer } from '@/lib/pdf';
import { paiseToRupees } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('billId');
    if (!id) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill || bill.deletedAt) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get company name from settings (or env)
    const settings = await db.appSetting.findUnique({ where: { id: 'default' } });
    const companyName = settings?.companyName || process.env.COMPANY_NAME || 'Munjal Kiriu Industries';

     
    const billApi: any = {
      ...bill,
      basicAmount: paiseToRupees(bill.basicAmount),
      receivedAt: bill.receivedAt ? bill.receivedAt.toISOString() : null,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
    };

    const buf = await buildBillPdfBuffer(billApi, { companyName });
    const filename = `${bill.billId}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/export/pdf]', err);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
