// Server-side helper: generate the next human-readable bill id like BILL-2026-00001.
// Concurrency-safe by using a transaction + row-level locking semantics via a single-writer SQLite.

import { db } from '@/lib/db';

/**
 * Generates the next bill id for a given submission year.
 * Uses the current max sequence for that year stored implicitly in the bills table.
 * Designed to be called inside a Prisma transaction.
 *
 * Format: BILL-YYYY-NNNNN (5-digit zero-padded sequence, resets per year).
 */
export async function generateBillId(year: number, tx = db): Promise<string> {
  // Find the highest existing sequence for this year.
  const prefix = `BILL-${year}-`;
  const existing = await tx.bill.findMany({
    where: { billId: { startsWith: prefix } },
    select: { billId: true },
  });
  let maxSeq = 0;
  for (const b of existing) {
    const seqStr = b.billId.slice(prefix.length);
    const n = parseInt(seqStr, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

/** Returns the year (Gregorian, local tz of the server) for a YYYY-MM-DD string. */
export function yearOf(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return new Date().getFullYear();
  return d.getFullYear();
}
