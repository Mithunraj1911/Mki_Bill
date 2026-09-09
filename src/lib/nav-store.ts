'use client';

import { create } from 'zustand';

/// All navigable views in the single-page app.
export type ViewKey =
  | 'dashboard'
  | 'new-bill'
  | 'bill-review'
  | 'acknowledgment'
  | 'success'
  | 'bulk-bill'
  | 'bulk-bill-review'
  | 'bulk-acknowledgment'
  | 'bulk-success'
  | 'existing-bills'
  | 'bill-details'
  | 'bill-edit'
  | 'reports'
  | 'settings';

/// A created bill (id + human-readable billId) returned from the bulk-create API.
export interface CreatedBillSummary {
  dbId: string;
  billId: string;
  billNumber: string;
  basicAmount: number;
  /// Shared across the batch (same for all bills in a bulk submission).
  companyName: string;
}

interface NavState {
  view: ViewKey;
  /// For bill-details: the bill id to show.
  activeBillId: string | null;
  /// For bill-edit: the bill id being edited.
  editBillId: string | null;
  /// For acknowledgment: the just-created bill id (for receipt confirmation flow).
  pendingReceiptBillId: string | null;
  /// For single-bill success screen: the last confirmed bill + receiver info.
  lastConfirmedBillId: string | null;
  lastConfirmedBillDbId: string | null;
  lastConfirmedReceiverName: string | null;
  lastConfirmedReceivedAt: string | null;
  /// For bulk-acknowledgment + bulk-success screens: the list of bills in the batch.
  bulkCreatedBills: CreatedBillSummary[];
  /// Set after the bulk receipt is confirmed (for the success screen).
  bulkReceiverName: string | null;
  bulkReceivedAt: string | null;

  /// Navigation helpers
  go: (view: ViewKey) => void;
  openBill: (billId: string) => void;
  startEditBill: (billId: string) => void;
  startReceiptFor: (billId: string) => void;
  showSuccess: (billId: string, billDbId: string, receiverName: string, receivedAt: string) => void;
  /// Navigate to the bulk acknowledgment screen (receiver signs once for all bills).
  startBulkReceiptFor: (bills: CreatedBillSummary[]) => void;
  /// Navigate to the bulk success screen after the batch receipt is confirmed.
  showBulkSuccess: (bills: CreatedBillSummary[], receiverName: string, receivedAt: string) => void;
  resetFlow: () => void;
}

export const useNav = create<NavState>((set) => ({
  view: 'dashboard',
  activeBillId: null,
  editBillId: null,
  pendingReceiptBillId: null,
  lastConfirmedBillId: null,
  lastConfirmedBillDbId: null,
  lastConfirmedReceiverName: null,
  lastConfirmedReceivedAt: null,
  bulkCreatedBills: [],
  bulkReceiverName: null,
  bulkReceivedAt: null,

  go: (view) => set({ view }),
  openBill: (billId) => set({ view: 'bill-details', activeBillId: billId }),
  startEditBill: (billId) => set({ view: 'bill-edit', editBillId: billId }),
  startReceiptFor: (billId) => set({ view: 'acknowledgment', pendingReceiptBillId: billId }),
  showSuccess: (billId, billDbId, receiverName, receivedAt) =>
    set({
      view: 'success',
      lastConfirmedBillId: billId,
      lastConfirmedBillDbId: billDbId,
      lastConfirmedReceiverName: receiverName,
      lastConfirmedReceivedAt: receivedAt,
    }),
  startBulkReceiptFor: (bills) =>
    set({
      view: 'bulk-acknowledgment',
      bulkCreatedBills: bills,
      bulkReceiverName: null,
      bulkReceivedAt: null,
    }),
  showBulkSuccess: (bills, receiverName, receivedAt) =>
    set({
      view: 'bulk-success',
      bulkCreatedBills: bills,
      bulkReceiverName: receiverName,
      bulkReceivedAt: receivedAt,
    }),
  resetFlow: () =>
    set({
      view: 'dashboard',
      pendingReceiptBillId: null,
    }),
}));
