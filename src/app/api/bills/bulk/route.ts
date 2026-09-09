// POST /api/bills/bulk - create multiple bills in a single transaction.
//
// Used for the "Bulk Bill Submission" feature: the user submits multiple bills for the SAME
// company (and shared bill date / submitted by / department / description / document) at once,
// with different bill numbers and amounts per row.
//
// All bills are created atomically: if any row fails, the entire batch is rolled back.
// Each created bill is in SUBMITTED status and can be acknowledged individually afterwards.
//
// IMPORTANT: bill IDs are reserved and the shared document is uploaded to Supabase Storage
// BEFORE the database transaction opens. Storage uploads are network calls — doing them inside
// an interactive Prisma transaction risks the transaction timing out and closing while we're
// still using it (see the single-bill route for the same fix, with more detail).

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

    // Reserve one bill id per entry up front (sequential), outside any transaction.
    // generateBillId() looks at what's already committed in the DB — since none of this
    // batch's bills are committed yet, we ask it once for the next number and then increment
    // locally in memory for the rest of the batch (mirrors the single-bill route's guarantees).
    const year = yearOf(payload.submissionDate);
    const firstBillId = await generateBillId(year);
    const prefix = `BILL-${year}-`;
    const firstSeq = parseInt(firstBillId.slice(prefix.length), 10);
    const billIds: string[] = payload.entries.map((_, i) =>
      `${prefix}${String(firstSeq + i).padStart(5, '0')}`
    );

    // Pre-compute and upload the shared document ONCE per bill (each bill gets its own copy
    // in storage, all with identical content) — entirely before the transaction starts.
    let documentMime: string | null = null;
    let documentName: string | null = null;
    const documentPaths: (string | null)[] = new Array(payload.entries.length).fill(null);
    if (document?.dataUrl) {
      documentMime = document.mime || 'application/octet-stream';
      let documentExt = 'bin';
      if (documentMime === 'application/pdf') documentExt = 'pdf';
      else if (documentMime === 'image/png') documentExt = 'png';
      else if (documentMime === 'image/jpeg' || documentMime === 'image/jpg') documentExt = 'jpg';
      documentName = document.name || `bill-document.${documentExt}`;
      const safeName = `document.${documentExt}`;

      for (let i = 0; i < payload.entries.length; i++) {
        try {
          const nested = billDocumentNestedPath(billIds[i], payload.submissionDate);
          const saved = await saveDataUrl('bill-documents', nested, safeName, document.dataUrl);
          documentPaths[i] = saved.publicUrl;
        } catch (e) {
          console.error('[POST /api/bills/bulk] document upload failed for', billIds[i], e);
          // Continue without a document for this bill — it will still be created.
        }
      }
    }

    const created: CreatedBill[] = [];

    // Run all DB writes inside a single transaction so the batch is atomic. No network calls
    // (storage uploads) happen in here anymore — only fast, local Postgres queries.
    await db.$transaction(async (tx) => {
      for (let i = 0; i < payload.entries.length; i++) {
        const entry = payload.entries[i];
        const billId = billIds[i];
        const documentPath = documentPaths[i];

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
            billDocumentPath: documentPath,
            billDocumentName: documentPath ? documentName : null,
            billDocumentMime: documentPath ? documentMime : null,
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

        if (documentPath) {
          await recordHistory(tx, bill.id, billId, 'DOCUMENT_UPLOADED', {
            newStatus: 'SUBMITTED',
            metadata: { documentName, documentMime, documentPath },
          });
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
    }, { timeout: 20000, maxWait: 10000 });

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
