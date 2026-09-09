// Shared application types for the Digital Bill Management Portal.

export type BillStatus = 'DRAFT' | 'SUBMITTED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';

export type SignatureType = 'DIGITAL' | 'IMAGE';

export type BillHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DOCUMENT_UPLOADED'
  | 'SIGNATURE_CAPTURED'
  | 'RECEIPT_CONFIRMED'
  | 'STATUS_CHANGED'
  | 'EXPORTED'
  | 'DELETED';

export type Department =
  | 'IT'
  | 'Purchase'
  | 'Finance'
  | 'HR'
  | 'Production'
  | 'Quality'
  | 'Maintenance'
  | 'Stores'
  | 'Engineering'
  | 'Other';

export const DEPARTMENTS: Department[] = [
  'IT',
  'Purchase',
  'Finance',
  'HR',
  'Production',
  'Quality',
  'Maintenance',
  'Stores',
  'Engineering',
  'Other',
];

export const BILL_STATUSES: BillStatus[] = ['DRAFT', 'SUBMITTED', 'RECEIVED', 'COMPLETED', 'CANCELLED'];

/// Bill as returned from the API. Amount is in rupees (float) for display.
export interface Bill {
  id: string;
  billId: string;
  submissionDate: string; // YYYY-MM-DD
  companyName: string;
  billNumber: string;
  billDate: string; // YYYY-MM-DD
  basicAmount: number; // rupees
  submittedBy: string;
  department: string | null;
  description: string | null;
  billDocumentPath: string | null;
  billDocumentName: string | null;
  billDocumentMime: string | null;
  receiverName: string | null;
  signaturePath: string | null;
  signatureType: SignatureType | null;
  receivedAt: string | null; // ISO timestamp
  status: BillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BillHistoryEntry {
  id: string;
  action: BillHistoryAction;
  oldStatus: string | null;
  newStatus: string | null;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface BillWithHistory extends Bill {
  history: BillHistoryEntry[];
}

export interface DashboardStats {
  totalBills: number;
  thisWeek: number;
  thisMonth: number;
  totalAmount: number; // rupees
  weeklyAmount: number;
  monthlyAmount: number;
  recentBills: Bill[];
}

export interface ReportSummary {
  periodStart: string;
  periodEnd: string;
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
}

export interface CompanyReportRow {
  companyName: string;
  billCount: number;
  totalAmount: number;
}

export interface DepartmentReportRow {
  department: string;
  billCount: number;
  totalAmount: number;
}

export interface ReportsData {
  weekly: ReportSummary;
  monthly: ReportSummary;
  yearly: ReportSummary;
  companyWise: CompanyReportRow[];
  departmentWise: DepartmentReportRow[];
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  currency: string;
  reportEmailTo: string;
  reportEmailCc: string;
  weeklyReportDay: string;
  weeklyReportTime: string;
}

export interface BillsListResponse {
  bills: Bill[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BillsListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BillStatus | 'ALL';
  department?: string | 'ALL';
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
}

/// Payload for creating a bill (form submission).
export interface NewBillPayload {
  submissionDate: string;
  companyName: string;
  billNumber: string;
  billDate: string;
  basicAmount: number;
  submittedBy: string;
  department: string;
  description?: string;
}

/// Payload for confirming receipt.
export interface ConfirmReceiptPayload {
  receiverName: string;
  signatureType: SignatureType;
  /// Base64 data URL of the signature image (PNG).
  signatureData: string;
}

/// One row in a bulk bill submission (bill number + amount only; other fields are shared).
export interface BulkBillEntryPayload {
  billNumber: string;
  basicAmount: number;
}

/// Payload for the bulk-create endpoint.
export interface BulkCreateBillPayload {
  submissionDate: string;
  companyName: string;
  billDate: string;
  submittedBy: string;
  department: string;
  description?: string;
  entries: BulkBillEntryPayload[];
}

/// Result of a bulk-create operation: the list of created bills.
export interface BulkCreateResult {
  bills: Bill[];
  /// Soft duplicate warnings (per-entry) — bill was still created.
  duplicates: { billId: string; duplicateBillId: string }[];
}

/// Payload for the bulk receipt confirmation (one signature for the whole batch).
export interface BulkReceiptPayload {
  billIds: string[];
  receiverName: string;
  signatureType: SignatureType;
  /// Base64 data URL of the shared signature image (PNG).
  signatureData: string;
}
