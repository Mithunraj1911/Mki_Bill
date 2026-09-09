// Helpers shared by API routes: prisma-to-API mapping and audit history creation.

import { db } from '@/lib/db';
import type { Bill, BillHistoryEntry, BillHistoryAction } from '@/lib/types';
import { paiseToRupees } from '@/lib/format';
import type { Prisma } from '@prisma/client';

type BillRow = Prisma.BillGetPayload<object>;

/** Map a Prisma Bill row to the API Bill shape (amount in rupees, ISO timestamps). */
export function mapBill(b: BillRow): Bill {
  return {
    id: b.id,
    billId: b.billId,
    submissionDate: b.submissionDate,
    companyName: b.companyName,
    billNumber: b.billNumber,
    billDate: b.billDate,
    basicAmount: paiseToRupees(b.basicAmount),
    submittedBy: b.submittedBy,
    department: b.department,
    description: b.description,
    billDocumentPath: b.billDocumentPath,
    billDocumentName: b.billDocumentName,
    billDocumentMime: b.billDocumentMime,
    receiverName: b.receiverName,
    signaturePath: b.signaturePath,
    signatureType: b.signatureType as Bill['signatureType'],
    receivedAt: b.receivedAt ? b.receivedAt.toISOString() : null,
    status: b.status as Bill['status'],
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Append a bill_history row. */
export async function recordHistory(
  tx: typeof db | Parameters<Parameters<typeof db['$transaction']>[0]>[0],
  billId: string,
  billRefId: string,
  action: BillHistoryAction,
  options: {
    oldStatus?: string | null;
    newStatus?: string | null;
    performedBy?: string | null;
    metadata?: Record<string, unknown> | null;
  } = {}
): Promise<void> {
  await tx.billHistory.create({
    data: {
      billId,
      billRefId,
      action,
      oldStatus: options.oldStatus ?? null,
      newStatus: options.newStatus ?? null,
      performedBy: options.performedBy ?? null,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    },
  });
}

/** Map a Prisma BillHistory row to the API shape. */
export function mapHistory(h: Prisma.BillHistoryGetPayload<object>): BillHistoryEntry {
  let metadata: Record<string, unknown> | null = null;
  if (h.metadata) {
    try {
      metadata = JSON.parse(h.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: h.id,
    action: h.action as BillHistoryEntry['action'],
    oldStatus: h.oldStatus,
    newStatus: h.newStatus,
    performedBy: h.performedBy,
    metadata,
    createdAt: h.createdAt.toISOString(),
  };
}
