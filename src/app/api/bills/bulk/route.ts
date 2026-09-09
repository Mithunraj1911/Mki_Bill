// POST /api/bills/bulk - create multiple bills in a single transaction.
//
// Used for the "Bulk Bill Submission" feature: the user submits multiple bills for the SAME
// company (and shared bill date / submitted by / department / description / document) at once,
// with different bill numbers and amounts per row.
//
// All bills are created atomically: if any row fails, the entire batch is rolled back.
// Each created bill is in SUBMITTED status and can be acknowledged individually afterwards.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bulkCreateSchema } from '@/lib/validation';
import { generateBillId, yearOf } from '@/lib/bill-id';
import { saveDataUrl, billDocumentNestedPath } from '@/lib/storage';
import { mapBill, recordHistory } from '@/lib/bill-mappers';
import { rupeesToPaise } from '@/lib/format';
import type { BillStatus } from '@/lib/types';

export const runtime = 'nodejs';

interface CreatedBill {
   
  row: any;
  billId: string;
  duplicateBillId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { payload, document } = parsed.data;
    const dept = payload.department?.trim() || null;
    const desc = payload.description?.trim() || null;

    // Pre-compute document storage (shared across all bills in the batch — we write the file
    // once per bill so each bill has its own folder, but with the same content).
    let documentMime: string | null = null;
    let documentName: string | null = null;
    let documentDataUrl: string | null = null;
    let documentExt = 'bin';
    if (document?.dataUrl) {
      documentMime = document.mime || 'application/octet-stream';
      if (documentMime === 'application/pdf') documentExt = 'pdf';
      else if (documentMime === 'image/png') documentExt = 'png';
      else if (documentMime === 'image/jpeg' || documentMime === 'image/jpg') documentExt = 'jpg';
      documentName = document.name || `bill-document.${documentExt}`;
      documentDataUrl = document.dataUrl;
    }

    const created: CreatedBill[] = [];

    // Run everything inside a single transaction so the batch is atomic.
    await db.$transaction(async (tx) => {
      const year = yearOf(payload.submissionDate);

      for (const entry of payload.entries) {
        const billId = await generateBillId(year, tx);

        const bill = await tx.bill.create({
          data: {
            billId,
            submissionDate: payload.submissionDate,
            companyName: payload.companyName.trim(),
            billNumber: entry.billNumber.trim(),
            billDate: payload.billDate,
            basicAmount: rupeesToPaise(entry.basicAmount),
            submittedBy: payload.submittedBy.trim(),
            department: dept,
            description: desc,
            status: 'SUBMITTED' as BillStatus,
          },
        });

        // Duplicate detection (soft): same company + bill number + bill date + amount
        let duplicateBillId: string | undefined;
        const dup = await tx.bill.findFirst({
          where: {
            id: { not: bill.id },
            companyName: payload.companyName,
            billNumber: entry.billNumber,
            billDate: payload.billDate,
            basicAmount: rupeesToPaise(entry.basicAmount),
            deletedAt: null,
          },
          select: { billId: true },
        });
        if (dup) duplicateBillId = dup.billId;

        // Save the shared document for this bill (each bill gets its own copy)
        let documentPath: string | null = null;
        if (documentDataUrl) {
          const safeName = `document.${documentExt}`;
          const nested = billDocumentNestedPath(billId, payload.submissionDate);
          try {
            const saved = await saveDataUrl('bill-documents', nested, safeName, documentDataUrl);
            documentPath = saved.publicUrl;
            await tx.bill.update({
              where: { id: bill.id },
              data: {
                billDocumentPath: documentPath,
                billDocumentName: documentName,
                billDocumentMime: documentMime,
              },
            });
            await recordHistory(tx, bill.id, billId, 'DOCUMENT_UPLOADED', {
              newStatus: 'SUBMITTED',
              metadata: { documentName, documentMime, documentPath },
            });
          } catch (e) {
            console.error('[POST /api/bills/bulk] document save failed', e);
            // Continue without document — the bill is still created
          }
        }

        await recordHistory(tx, bill.id, billId, 'CREATED', {
          newStatus: 'SUBMITTED',
          metadata: {
            companyName: payload.companyName,
            billNumber: entry.billNumber,
            basicAmount: entry.basicAmount,
            bulk: true,
            duplicateBillId,
          },
        });

        const fullRow = await tx.bill.findUnique({ where: { id: bill.id } });
        if (!fullRow) throw new Error('Failed to read back created bill');
        created.push({ row: fullRow, billId, duplicateBillId });
      }
    });

    return NextResponse.json(
      {
        bills: created.map((c) => mapBill(c.row)),
        duplicates: created
          .filter((c) => c.duplicateBillId)
          .map((c) => ({ billId: c.billId, duplicateBillId: c.duplicateBillId! })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/bills/bulk]', err);
    return NextResponse.json(
      { error: 'Unable to save bulk bills. Please try again.' },
      { status: 500 }
    );
  }
}
