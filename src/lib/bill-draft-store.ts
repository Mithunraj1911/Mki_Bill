'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BillDraftPayload {
  submissionDate: string;
  companyName: string;
  billNumber: string;
  billDate: string;
  basicAmount: number | null;
  submittedBy: string;
  department: string;
  description: string;
}

export interface BillDraft {
  payload: BillDraftPayload;
  /// base64 data URL of the (compressed) document, if any
  documentDataUrl: string | null;
  documentMime: string | null;
  documentName: string | null;
}

interface BillDraftState {
  draft: BillDraft | null;
  setDraft: (draft: BillDraft | null) => void;
  clear: () => void;
}

export const useBillDraft = create<BillDraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      clear: () => set({ draft: null }),
    }),
    {
      name: 'bill-draft',
      // Only persist plain serializable fields (no File objects; we already store data URLs)
      partialize: (s) => ({ draft: s.draft }),
    }
  )
);
