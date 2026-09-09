// POST /api/bills/[id]/receipt - confirm receipt with digital signature.
// Validates receiver name + signature, saves the signature PNG to local storage,
// updates the bill to RECEIVED status, sets received_at (server timestamp), and records history.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { confirmReceiptSchema } from '@/lib/validation';
import { saveDataUrl, signatureNestedPath } from '@/lib/storage';
import { mapBill, recordHistory } from '@/lib/bill-mappers';
import type { BillStatus } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = confirmReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }
    const { receiverName, signatureType, signatureData } = parsed.data;

    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill || bill.deletedAt) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    if (bill.status === 'RECEIVED' || bill.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'This bill has already been received.' },
        { status: 409 }
      );
    }

    const receivedAt = new Date();
    const nested = signatureNestedPath(bill.billId, receivedAt);
    const signatureFilename = `${bill.billId}-receiving-signature.png`;
    const saved = await saveDataUrl('signatures', nested, signatureFilename, signatureData);

    const updated = await db.$transaction(async (tx) => {
      const oldStatus = bill.status;
      const updatedRow = await tx.bill.update({
        where: { id },
        data: {
          receiverName: receiverName.trim(),
          signaturePath: saved.publicUrl,
          signatureType,
          receivedAt,
          status: 'RECEIVED' as BillStatus,
        },
      });
      await recordHistory(tx, id, bill.billId, 'SIGNATURE_CAPTURED', {
        oldStatus,
        newStatus: 'RECEIVED',
        performedBy: receiverName.trim(),
        metadata: { signatureType, signaturePath: saved.publicUrl },
      });
      await recordHistory(tx, id, bill.billId, 'RECEIPT_CONFIRMED', {
        oldStatus,
        newStatus: 'RECEIVED',
        performedBy: receiverName.trim(),
        metadata: { receivedAt: receivedAt.toISOString() },
      });
      await recordHistory(tx, id, bill.billId, 'STATUS_CHANGED', {
        oldStatus,
        newStatus: 'RECEIVED',
        metadata: { from: oldStatus, to: 'RECEIVED' },
      });
      return updatedRow;
    });

    return NextResponse.json({ bill: mapBill(updated) });
  } catch (err) {
    console.error('[POST /api/bills/[id]/receipt]', err);
    return NextResponse.json({ error: 'Unable to confirm receipt. Please try again.' }, { status: 500 });
  }
}
