// Excel generation helpers using SheetJS (xlsx).
// All money is in rupees (float). We format currency/date for display inside cells.

import * as XLSX from 'xlsx';
import type { Bill } from '@/lib/types';
import { formatDateDMY, formatDateTime } from '@/lib/format';

export interface BillsExcelOptions {
  sheetName?: string;
  includeTotals?: boolean;
}

/// Generate an Excel workbook containing the given bills, with optional totals row at the bottom.
export function buildBillsWorkbook(bills: Bill[], options: BillsExcelOptions = {}): XLSX.WorkBook {
  const { sheetName = 'Bills', includeTotals = true } = options;

  // Header rows
  const header = [
    'Bill ID',
    'Submission Date',
    'Company Name',
    'Bill Number',
    'Bill Date',
    'Basic/Claim Amount',
    'Submitted By',
    'Department',
    'Description',
    'Receiver Name',
    'Received At',
    'Signature Type',
    'Status',
    'Created At',
  ];

  const rows: (string | number)[][] = bills.map((b) => [
    b.billId,
    formatDateDMY(b.submissionDate),
    b.companyName,
    b.billNumber,
    formatDateDMY(b.billDate),
    b.basicAmount,
    b.submittedBy,
    b.department ?? '',
    b.description ?? '',
    b.receiverName ?? '',
    b.receivedAt ? formatDateTime(b.receivedAt) : '',
    b.signatureType ?? '',
    b.status,
    formatDateTime(b.createdAt),
  ]);

  const totalAmount = bills.reduce((s, b) => s + b.basicAmount, 0);

  const wsData = [header, ...rows];
  if (includeTotals) {
    wsData.push(['', '', '', '', '', 'TOTAL BILLS:', bills.length, '', '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', 'TOTAL AMOUNT:', totalAmount, '', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Set column widths roughly
  ws['!cols'] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/// Add a summary sheet to an existing workbook.
export function addSummarySheet(
  wb: XLSX.WorkBook,
  data: {
    reportPeriod: string;
    totalBills: number;
    totalAmount: number;
    averageBillAmount: number;
  },
  sheetName = 'Summary'
): XLSX.WorkBook {
  const wsData = [
    ['Report Period', data.reportPeriod],
    ['Total Bills', data.totalBills],
    ['Total Amount', data.totalAmount],
    ['Average Bill Amount', data.averageBillAmount],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/// Add a company-wise summary sheet.
export function addCompanySummarySheet(
  wb: XLSX.WorkBook,
  rows: { companyName: string; billCount: number; totalAmount: number }[],
  sheetName = 'Company Summary'
): XLSX.WorkBook {
  const wsData = [['Company', 'Bill Count', 'Total Amount']];
  let totalBills = 0;
  let totalAmount = 0;
  for (const r of rows) {
    wsData.push([r.companyName, r.billCount, r.totalAmount]);
    totalBills += r.billCount;
    totalAmount += r.totalAmount;
  }
  wsData.push(['TOTAL', totalBills, totalAmount]);
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/// Add a department-wise summary sheet.
export function addDepartmentSummarySheet(
  wb: XLSX.WorkBook,
  rows: { department: string; billCount: number; totalAmount: number }[],
  sheetName = 'Department Summary'
): XLSX.WorkBook {
  const wsData = [['Department', 'Bill Count', 'Total Amount']];
  let totalBills = 0;
  let totalAmount = 0;
  for (const r of rows) {
    wsData.push([r.department, r.billCount, r.totalAmount]);
    totalBills += r.billCount;
    totalAmount += r.totalAmount;
  }
  wsData.push(['TOTAL', totalBills, totalAmount]);
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/// Serialize workbook to a Node Buffer (xlsx format).
export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  // SheetJS write returns ArrayBuffer when type='array'
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return Buffer.from(arr as ArrayBuffer);
}
