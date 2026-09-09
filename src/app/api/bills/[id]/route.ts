// GET    /api/bills/[id]    - get a single bill with its history.
// PATCH  /api/bills/[id]    - update editable bill fields (does NOT touch receipt fields or status).
// DELETE /api/bills/[id]    - soft-delete a bill (status -> CANCELLED, deletedAt set).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mapBill, mapHistory, recordHistory } from '@/lib/bill-mappers';
import { updateBillSchema } from '@/lib/validation';
import { saveDataUrl, billDocumentNestedPath, deleteByPublicUrl } from '@/lib/storage';
import { rupeesToPaise } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const bill = await db.bill.findUnique({ where: { id }, include: { history: { orderBy: { createdAt: 'desc' } } } });
    if (!bill || bill.deletedAt) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    const { history, ...billRow } = bill;
    return NextResponse.json({
      bill: mapBill(billRow),
      history: (history ?? []).map(mapHistory),
    });
  } catch (err) {
    console.error('[GET /api/bills/[id]]', err);
    return NextResponse.json({ error: 'Unable to fetch bill.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = updateBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { payload, document, removeDocument } = parsed.data;
    const dept = payload.department?.trim() || null;
    const desc = payload.description?.trim() || null;

    const existing = await db.bill.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Determine document change:
    // - document present with dataUrl -> replace existing document (delete old file, save new)
    // - removeDocument === true && document absent -> remove existing document
    // - document absent && !removeDocument -> keep existing document
    let newDocumentPath = existing.billDocumentPath;
    let newDocumentName = existing.billDocumentName;
    let newDocumentMime = existing.billDocumentMime;
    let documentChanged = false;

    if (document?.dataUrl) {
      // Replace: delete old file (if any) then save new
      if (existing.billDocumentPath) {
        await deleteByPublicUrl(existing.billDocumentPath).catch(() => {});
      }
      const mime = document.mime || 'application/octet-stream';
      let ext = 'bin';
      if (mime === 'application/pdf') ext = 'pdf';
      else if (mime === 'image/png') ext = 'png';
      else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
      const originalName = document.name || `document.${ext}`;
      const safeName = `document.${ext}`;
      // Reuse the existing bill's nested path (year/month/billId)
      const nested = billDocumentNestedPath(existing.billId, payload.submissionDate);
      const saved = await saveDataUrl('bill-documents', nested, safeName, document.dataUrl);
      newDocumentPath = saved.publicUrl;
      newDocumentName = originalName;
      newDocumentMime = mime;
      documentChanged = true;
    } else if (removeDocument && existing.billDocumentPath) {
      // Remove existing document
      await deleteByPublicUrl(existing.billDocumentPath).catch(() => {});
      newDocumentPath = null;
      newDocumentName = null;
      newDocumentMime = null;
      documentChanged = true;
    }

    // Snapshot the before state for the audit diff
    const beforeValues = {
      submissionDate: existing.submissionDate,
      companyName: existing.companyName,
      billNumber: existing.billNumber,
      billDate: existing.billDate,
      basicAmount: existing.basicAmount,
      submittedBy: existing.submittedBy,
      department: existing.department,
      description: existing.description,
    };

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.bill.update({
        where: { id },
        data: {
          submissionDate: payload.submissionDate,
          companyName: payload.companyName.trim(),
          billNumber: payload.billNumber.trim(),
          billDate: payload.billDate,
          basicAmount: rupeesToPaise(payload.basicAmount),
          submittedBy: payload.submittedBy.trim(),
          department: dept,
          description: desc,
          billDocumentPath: newDocumentPath,
          billDocumentName: newDocumentName,
          billDocumentMime: newDocumentMime,
          // Note: receipt fields (receiverName, signaturePath, signatureType, receivedAt) and status
          // are intentionally NOT touched by this endpoint.
        },
      });

      // Compute a small diff for the audit trail
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (beforeValues.submissionDate !== row.submissionDate) changes.submissionDate = { from: beforeValues.submissionDate, to: row.submissionDate };
      if (beforeValues.companyName !== row.companyName) changes.companyName = { from: beforeValues.companyName, to: row.companyName };
      if (beforeValues.billNumber !== row.billNumber) changes.billNumber = { from: beforeValues.billNumber, to: row.billNumber };
      if (beforeValues.billDate !== row.billDate) changes.billDate = { from: beforeValues.billDate, to: row.billDate };
      if (beforeValues.basicAmount !== row.basicAmount) changes.basicAmount = { from: beforeValues.basicAmount, to: row.basicAmount };
      if (beforeValues.submittedBy !== row.submittedBy) changes.submittedBy = { from: beforeValues.submittedBy, to: row.submittedBy };
      if (beforeValues.department !== row.department) changes.department = { from: beforeValues.department, to: row.department };
      if (beforeValues.description !== row.description) changes.description = { from: beforeValues.description, to: row.description };

      await recordHistory(tx, id, existing.billId, 'UPDATED', {
        oldStatus: existing.status,
        newStatus: existing.status,
        metadata: { changes, documentChanged, documentName: newDocumentName },
      });
      if (documentChanged && document?.dataUrl) {
        await recordHistory(tx, id, existing.billId, 'DOCUMENT_UPLOADED', {
          oldStatus: existing.status,
          newStatus: existing.status,
          metadata: { replaced: !!existing.billDocumentPath, documentName: newDocumentName, documentMime: newDocumentMime },
        });
      }

      return row;
    });

    return NextResponse.json({ bill: mapBill(updated) });
  } catch (err) {
    console.error('[PATCH /api/bills/[id]]', err);
    return NextResponse.json({ error: 'Unable to update bill.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill || bill.deletedAt) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    await db.$transaction(async (tx) => {
      await tx.bill.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } });
      await recordHistory(tx, id, bill.billId, 'DELETED', {
        oldStatus: bill.status,
        newStatus: 'CANCELLED',
      });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/bills/[id]]', err);
    return NextResponse.json({ error: 'Unable to delete bill.' }, { status: 500 });
  }
}
