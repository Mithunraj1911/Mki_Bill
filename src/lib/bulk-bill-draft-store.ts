'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/// Shared fields for bulk bill submission (same for all bills in the batch).
export interface BulkBillShared {
  submissionDate: string;
  companyName: string;
  billDate: string;
  submittedBy: string;
  department: string;
  description: string;
}

/// Per-row fields (different for each bill in the batch).
export interface BulkBillEntry {
  /// Client-generated stable id (used as React key + for dedup).
  rowId: string;
  billNumber: string;
  basicAmount: number | null;
}

export interface BulkBillDraft {
  shared: BulkBillShared;
  entries: BulkBillEntry[];
  /// Shared bill document (same for all entries).
  documentDataUrl: string | null;
  documentMime: string | null;
  documentName: string | null;
}

interface BulkBillDraftState {
  draft: BulkBillDraft | null;
  setDraft: (draft: BulkBillDraft | null) => void;
  clear: () => void;
}

export const useBulkBillDraft = create<BulkBillDraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      clear: () => set({ draft: null }),
    }),
    {
      name: 'bulk-bill-draft',
      partialize: (s) => ({ draft: s.draft }),
    }
  )
);

/// Generate a stable unique id for a bulk entry row.
export function newBulkRowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
