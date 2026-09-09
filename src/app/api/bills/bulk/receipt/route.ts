// POST /api/bills/bulk/receipt - confirm receipt for a whole batch of bills with ONE signature.
//
// The receiver checks all the bills in the batch and approves them in a single action.
// All bills are updated to RECEIVED status in a single transaction with:
//   - the same receiverName
//   - the same signaturePath (one shared signature PNG file)
//   - the same receivedAt (server timestamp)
//   - the same signatureType
//
// History is recorded per bill (SIGNATURE_CAPTURED + RECEIPT_CONFIRMED + STATUS_CHANGED).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bulkReceiptSchema } from '@/lib/validation';
import { saveDataUrl, bulkSignatureNestedPath } from '@/lib/storage';
import { mapBill, recordHistory } from '@/lib/bill-mappers';
import type { BillStatus } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bulkReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }
    const { billIds, receiverName, signatureType, signatureData } = parsed.data;

    // Deduplicate bill IDs (in case the client sends the same id twice)
    const uniqueBillIds = Array.from(new Set(billIds));

    // Fetch all bills in the batch
    const bills = await db.bill.findMany({
      where: { id: { in: uniqueBillIds }, deletedAt: null },
    });

    if (bills.length === 0) {
      return NextResponse.json({ error: 'No valid bills found for the batch.' }, { status: 404 });
    }

    // Prevent re-receipt of already RECEIVED bills (return which ones are already received)
    const alreadyReceived = bills.filter(
      (b) => b.status === 'RECEIVED' || b.status === 'COMPLETED'
    );
    if (alreadyReceived.length > 0) {
      return NextResponse.json(
        {
          error: `Some bills have already been received: ${alreadyReceived.map((b) => b.billId).join(', ')}`,
        },
        { status: 409 }
      );
    }

    // Save the shared signature once
    const receivedAt = new Date();
    const nested = bulkSignatureNestedPath(receivedAt);
    const signatureFilename = 'bulk-receiving-signature.png';
    const saved = await saveDataUrl('signatures', nested, signatureFilename, signatureData);

    const receiver = receiverName.trim();

    // Update all bills to RECEIVED in a single transaction
    const updatedBills = await db.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof tx.bill.update>>[] = [];
      for (const bill of bills) {
        const oldStatus = bill.status;
        const updated = await tx.bill.update({
          where: { id: bill.id },
          data: {
            receiverName: receiver,
            signaturePath: saved.publicUrl,
            signatureType,
            receivedAt,
            status: 'RECEIVED' as BillStatus,
          },
        });
        await recordHistory(tx, bill.id, bill.billId, 'SIGNATURE_CAPTURED', {
          oldStatus,
          newStatus: 'RECEIVED',
          performedBy: receiver,
          metadata: {
            signatureType,
            signaturePath: saved.publicUrl,
            bulk: true,
            batchBillIds: bills.map((b) => b.billId),
          },
        });
        await recordHistory(tx, bill.id, bill.billId, 'RECEIPT_CONFIRMED', {
          oldStatus,
          newStatus: 'RECEIVED',
          performedBy: receiver,
          metadata: {
            receivedAt: receivedAt.toISOString(),
            bulk: true,
            batchBillIds: bills.map((b) => b.billId),
          },
        });
        await recordHistory(tx, bill.id, bill.billId, 'STATUS_CHANGED', {
          oldStatus,
          newStatus: 'RECEIVED',
          metadata: { from: oldStatus, to: 'RECEIVED', bulk: true },
        });
        results.push(updated);
      }
      return results;
    });

    return NextResponse.json({
      bills: updatedBills.map(mapBill),
      receiverName: receiver,
      receivedAt: receivedAt.toISOString(),
      signaturePath: saved.publicUrl,
    });
  } catch (err) {
    console.error('[POST /api/bills/bulk/receipt]', err);
    return NextResponse.json(
      { error: 'Unable to confirm bulk receipt. Please try again.' },
      { status: 500 }
    );
  }
}
