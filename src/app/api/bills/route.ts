// POST /api/bills - create a new bill (with optional document upload).
// GET  /api/bills - list bills with pagination, search, filter, sort.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createBillSchema } from '@/lib/validation';
import { generateBillId, yearOf } from '@/lib/bill-id';
import { saveDataUrl, billDocumentNestedPath } from '@/lib/storage';
import { mapBill, recordHistory } from '@/lib/bill-mappers';
import { rupeesToPaise } from '@/lib/format';
import type { BillStatus } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { payload, document } = parsed.data;
    const dept = payload.department?.trim() || null;
    const desc = payload.description?.trim() || null;

    // Duplicate detection: same company + bill number + bill date + amount
    const possibleDuplicates = await db.bill.findMany({
      where: {
        companyName: payload.companyName,
        billNumber: payload.billNumber,
        billDate: payload.billDate,
        basicAmount: rupeesToPaise(payload.basicAmount),
        deletedAt: null,
      },
      take: 1,
    });

    const result = await db.$transaction(async (tx) => {
      const year = yearOf(payload.submissionDate);
      const billId = await generateBillId(year, tx);

      const bill = await tx.bill.create({
        data: {
          billId,
          submissionDate: payload.submissionDate,
          companyName: payload.companyName.trim(),
          billNumber: payload.billNumber.trim(),
          billDate: payload.billDate,
          basicAmount: rupeesToPaise(payload.basicAmount),
          submittedBy: payload.submittedBy.trim(),
          department: dept,
          description: desc,
          status: 'SUBMITTED' as BillStatus,
        },
      });

      let documentPath: string | null = null;
      let documentName: string | null = null;
      let documentMime: string | null = null;
      if (document?.dataUrl) {
        const mime = document.mime || 'application/octet-stream';
        let ext = 'bin';
        if (mime === 'application/pdf') ext = 'pdf';
        else if (mime === 'image/png') ext = 'png';
        else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
        const originalName = document.name || `bill-document.${ext}`;
        const safeName = `document.${ext}`;
        const nested = billDocumentNestedPath(billId, payload.submissionDate);
        const saved = await saveDataUrl('bill-documents', nested, safeName, document.dataUrl);
        documentPath = saved.publicUrl;
        documentName = originalName;
        documentMime = mime;
        await tx.bill.update({
          where: { id: bill.id },
          data: { billDocumentPath: documentPath, billDocumentName: documentName, billDocumentMime: documentMime },
        });
        await recordHistory(tx, bill.id, billId, 'DOCUMENT_UPLOADED', {
          newStatus: 'SUBMITTED',
          metadata: { documentName, documentMime, documentPath },
        });
      }

      await recordHistory(tx, bill.id, billId, 'CREATED', {
        newStatus: 'SUBMITTED',
        metadata: { companyName: payload.companyName, billNumber: payload.billNumber, basicAmount: payload.basicAmount },
      });

      const updated = await tx.bill.findUnique({ where: { id: bill.id } });
      return updated;
    });

    if (!result) {
      return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
    }

    const bill = mapBill(result);
    return NextResponse.json(
      { bill, possibleDuplicate: possibleDuplicates[0] ? mapBill(possibleDuplicates[0]) : undefined },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/bills]', err);
    return NextResponse.json({ error: 'Unable to save bill. Please try again.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(5, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status') || 'ALL';
    const department = url.searchParams.get('department') || 'ALL';
    const company = url.searchParams.get('company')?.trim() || '';
    const dateFrom = url.searchParams.get('dateFrom')?.trim() || '';
    const dateTo = url.searchParams.get('dateTo')?.trim() || '';
    const amountMin = url.searchParams.get('amountMin');
    const amountMax = url.searchParams.get('amountMax');
    const sort = (url.searchParams.get('sort') as 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | null) || 'newest';

     
    const where: any = { deletedAt: null };
    if (status !== 'ALL') where.status = status;
    if (department !== 'ALL') where.department = department;
    if (company) where.companyName = { contains: company };
    if (dateFrom || dateTo) {
       
      const cond: any = {};
      if (dateFrom) cond.gte = dateFrom;
      if (dateTo) cond.lte = dateTo;
      where.submissionDate = cond;
    }
    if (amountMin != null || amountMax != null) {
       
      const cond: any = {};
      if (amountMin != null) cond.gte = rupeesToPaise(parseFloat(amountMin));
      if (amountMax != null) cond.lte = rupeesToPaise(parseFloat(amountMax));
      where.basicAmount = cond;
    }
    if (search) {
      where.OR = [
        { billId: { contains: search } },
        { companyName: { contains: search } },
        { billNumber: { contains: search } },
        { submittedBy: { contains: search } },
        { receiverName: { contains: search } },
      ];
    }

    const orderBy =
      sort === 'oldest'
        ? [{ submissionDate: 'asc' as const }]
        : sort === 'amount_desc'
        ? [{ basicAmount: 'desc' as const }]
        : sort === 'amount_asc'
        ? [{ basicAmount: 'asc' as const }]
        : [{ submissionDate: 'desc' as const }, { createdAt: 'desc' as const }];

    const [total, rows] = await Promise.all([
      db.bill.count({ where }),
      db.bill.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      bills: rows.map(mapBill),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('[GET /api/bills]', err);
    return NextResponse.json({ error: 'Unable to fetch bills.' }, { status: 500 });
  }
}
