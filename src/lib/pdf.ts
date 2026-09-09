// PDF generation helpers using jsPDF.
// Builds a clean, professional "Digital Bill Submission Record" PDF for a single bill.

import { jsPDF } from 'jspdf';
import type { Bill } from '@/lib/types';
import { formatINR, formatDateDMYFromISO, formatDateTime } from '@/lib/format';

/** Fetch a remote (Supabase Storage) URL and return it as a base64 data URL. */
async function fetchAsDataUrl(url: string, fallbackMime: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || fallbackMime;
  const base64 = Buffer.from(arrayBuf).toString('base64');
  return `data:${mime};base64,${base64}`;
}

export interface BillPdfContext {
  companyName: string;
}

/// Build a PDF Buffer for a single bill, embedding the signature image and the bill document (if image).
export async function buildBillPdfBuffer(bill: Bill, ctx: BillPdfContext): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header: company name + title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(ctx.companyName || 'Digital Bill Management', margin, y + 6);
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Digital Bill Submission Record', margin, y + 2);
  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Bill Information section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BILL INFORMATION', margin, y + 2);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const info: [string, string][] = [
    ['Bill ID', bill.billId],
    ['Submission Date', formatDateDMYFromISO(bill.submissionDate)],
    ['Company Name', bill.companyName],
    ['Bill Number', bill.billNumber],
    ['Bill Date', formatDateDMYFromISO(bill.billDate)],
    ['Basic / Claim Amount', formatINR(bill.basicAmount)],
    ['Submitted By', bill.submittedBy],
    ['Department', bill.department ?? '—'],
    ['Description', bill.description ?? '—'],
    ['Status', bill.status],
  ];
  for (const [k, v] of info) {
    doc.setFont('helvetica', 'bold');
    doc.text(k, margin, y + 2);
    doc.setFont('helvetica', 'normal');
    // Wrap value text
    const wrapped = doc.splitTextToSize(String(v), contentW - 50);
    doc.text(wrapped, margin + 50, y + 2);
    y += Math.max(5, 5 * wrapped.length);
  }
  y += 4;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Receiving Acknowledgment section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RECEIVING ACKNOWLEDGMENT', margin, y + 2);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const recvInfo: [string, string][] = [
    ['Received By', bill.receiverName ?? '—'],
    ['Received At', bill.receivedAt ? formatDateTime(bill.receivedAt) : '—'],
    ['Signature Type', bill.signatureType ?? '—'],
  ];
  for (const [k, v] of recvInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(k, margin, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v), margin + 50, y + 2);
    y += 5;
  }

  // Embed signature image (if available and reachable on disk)
  if (bill.signaturePath) {
    try {
      const dataUrl = await fetchAsDataUrl(bill.signaturePath, 'image/png');
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('Signature:', margin, y + 2);
      y += 4;
      doc.setFont('helvetica', 'normal');
      // Embed signature image scaled to ~60mm wide
      const imgW = 60;
      const imgH = 30;
      doc.addImage(dataUrl, 'PNG', margin, y, imgW, imgH);
      y += imgH + 4;
    } catch (e) {
      doc.text('Signature: (image unavailable)', margin, y + 2);
      y += 5;
    }
  }

  // Bill Document section
  y += 2;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BILL DOCUMENT', margin, y + 2);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (bill.billDocumentPath && bill.billDocumentName) {
    doc.text(`Document: ${bill.billDocumentName}`, margin, y + 2);
    y += 5;
    // If image, embed it
    if (bill.billDocumentMime && bill.billDocumentMime.startsWith('image/')) {
      try {
        const ext = bill.billDocumentMime === 'image/png' ? 'PNG' : 'JPEG';
        const dataUrl = await fetchAsDataUrl(bill.billDocumentPath, bill.billDocumentMime);
        const imgW = contentW;
        const imgH = Math.min(120, imgW * 0.7);
        doc.addImage(dataUrl, ext, margin, y, imgW, imgH);
        y += imgH + 4;
      } catch {
        doc.text('(image preview unavailable)', margin, y + 2);
        y += 5;
      }
    } else if (bill.billDocumentMime === 'application/pdf') {
      doc.text('A PDF document is attached to the bill record (refer to the digital file).', margin, y + 2);
      y += 5;
    }
  } else {
    doc.text('No document attached.', margin, y + 2);
    y += 5;
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180);
  doc.line(margin, pageH - 18, pageW - margin, pageH - 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Digitally generated Bill Submission Record', margin, pageH - 13);
  doc.text(`Generated At: ${formatDateTime(new Date().toISOString())}`, margin, pageH - 9);

  return Buffer.from(doc.output('arraybuffer'));
}
