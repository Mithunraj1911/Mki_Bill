'use client';

import type {
  Bill,
  BillWithHistory,
  BillsListParams,
  BillsListResponse,
  ConfirmReceiptPayload,
  DashboardStats,
  NewBillPayload,
  ReportsData,
  AppSettings,
  BulkCreateBillPayload,
  BulkCreateResult,
  BulkReceiptPayload,
} from './types';

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      else if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface CreateBillInput {
  payload: NewBillPayload;
  /// Bill document file (optional). Compressed/sent as base64.
  documentFile?: File | null;
  /// Compressed base64 data URL of the document (used when compression already happened on client).
  documentDataUrl?: string | null;
  documentMime?: string | null;
  documentName?: string | null;
}

export const api = {
  async getDashboardStats(): Promise<DashboardStats> {
    return parseJson<DashboardStats>(await fetch('/api/dashboard/stats'));
  },

  async listBills(params: BillsListParams = {}): Promise<BillsListResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.search) qs.set('search', params.search);
    if (params.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params.department && params.department !== 'ALL') qs.set('department', params.department);
    if (params.company) qs.set('company', params.company);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    if (params.amountMin != null) qs.set('amountMin', String(params.amountMin));
    if (params.amountMax != null) qs.set('amountMax', String(params.amountMax));
    if (params.sort) qs.set('sort', params.sort);
    return parseJson<BillsListResponse>(await fetch(`/api/bills?${qs.toString()}`));
  },

  async getBill(id: string): Promise<BillWithHistory> {
    return parseJson<BillWithHistory>(await fetch(`/api/bills/${id}`));
  },

  async createBill(input: CreateBillInput): Promise<{ bill: Bill; possibleDuplicate?: Bill }> {
    const body: Record<string, unknown> = { payload: input.payload };
    if (input.documentDataUrl) {
      body.document = {
        dataUrl: input.documentDataUrl,
        mime: input.documentMime,
        name: input.documentName,
      };
    }
    return parseJson(await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  },

  async bulkCreateBills(input: {
    payload: BulkCreateBillPayload;
    documentDataUrl?: string | null;
    documentMime?: string | null;
    documentName?: string | null;
  }): Promise<BulkCreateResult> {
    const body: Record<string, unknown> = { payload: input.payload };
    if (input.documentDataUrl) {
      body.document = {
        dataUrl: input.documentDataUrl,
        mime: input.documentMime,
        name: input.documentName,
      };
    }
    return parseJson(await fetch('/api/bills/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  },

  async bulkConfirmReceipt(payload: BulkReceiptPayload): Promise<{
    bills: Bill[];
    receiverName: string;
    receivedAt: string;
    signaturePath: string;
  }> {
    return parseJson(await fetch('/api/bills/bulk/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async confirmReceipt(billId: string, payload: ConfirmReceiptPayload): Promise<{ bill: Bill }> {
    return parseJson(await fetch(`/api/bills/${billId}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async deleteBill(billId: string): Promise<{ success: boolean }> {
    return parseJson(await fetch(`/api/bills/${billId}`, { method: 'DELETE' }));
  },

  async updateBill(
    billId: string,
    input: {
      payload: NewBillPayload;
      documentDataUrl?: string | null;
      documentMime?: string | null;
      documentName?: string | null;
      removeDocument?: boolean;
    }
  ): Promise<{ bill: Bill }> {
    const body: Record<string, unknown> = { payload: input.payload };
    if (input.removeDocument) body.removeDocument = true;
    if (input.documentDataUrl) {
      body.document = {
        dataUrl: input.documentDataUrl,
        mime: input.documentMime,
        name: input.documentName,
      };
    }
    return parseJson(await fetch(`/api/bills/${billId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  },

  async getReports(): Promise<ReportsData> {
    return parseJson<ReportsData>(await fetch('/api/reports'));
  },

  async getSettings(): Promise<AppSettings> {
    return parseJson<AppSettings>(await fetch('/api/settings'));
  },

  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    return parseJson<AppSettings>(await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }));
  },

  /// Send a one-off test email using the SMTP config currently in the form (unsaved is fine).
  async sendTestEmail(payload: {
    to: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
  }): Promise<{ success: boolean }> {
    return parseJson(await fetch('/api/settings/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  /// Trigger weekly report manually (for testing).
  async triggerWeeklyReport(): Promise<{ success: boolean; message: string; alreadySent?: boolean }> {
    return parseJson(await fetch('/api/reports/weekly?test=true', { method: 'POST' }));
  },

  /// Build the URL for downloading/exporting Excel. Returns a URL the browser can fetch.
  excelExportUrl(options: {
    scope: 'all' | 'week' | 'month' | 'year' | 'filtered' | 'custom';
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    status?: string;
    department?: string;
    company?: string;
    amountMin?: number;
    amountMax?: number;
  }): string {
    const qs = new URLSearchParams();
    qs.set('scope', options.scope);
    if (options.dateFrom) qs.set('dateFrom', options.dateFrom);
    if (options.dateTo) qs.set('dateTo', options.dateTo);
    if (options.search) qs.set('search', options.search);
    if (options.status) qs.set('status', options.status);
    if (options.department) qs.set('department', options.department);
    if (options.company) qs.set('company', options.company);
    if (options.amountMin != null) qs.set('amountMin', String(options.amountMin));
    if (options.amountMax != null) qs.set('amountMax', String(options.amountMax));
    return `/api/export/excel?${qs.toString()}`;
  },

  /// Build the URL for downloading a single-bill PDF.
  pdfExportUrl(billId: string): string {
    return `/api/export/pdf?billId=${encodeURIComponent(billId)}`;
  },

  /// Build the URL for downloading a weekly/period Excel report.
  reportExcelUrl(scope: 'week' | 'month' | 'year' | 'company' | 'department', dateFrom?: string, dateTo?: string): string {
    const qs = new URLSearchParams();
    qs.set('scope', scope);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    return `/api/export/excel?${qs.toString()}`;
  },
};
