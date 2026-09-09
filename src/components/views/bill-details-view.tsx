'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import type { BillWithHistory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Download, Eye, History, Trash2, AlertCircle, Pencil } from 'lucide-react';
import { formatINR, formatDateDMY, formatDateTime, statusBadgeClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function BillDetailsView() {
  const go = useNav((s) => s.go);
  const billId = useNav((s) => s.activeBillId);
  const startEditBill = useNav((s) => s.startEditBill);
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading, error } = useQuery<BillWithHistory>({
    queryKey: ['bill', billId],
    queryFn: () => api.getBill(billId!),
    enabled: !!billId,
  });

  if (!billId) {
    return (
      <div className="max-w-3xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bill selected.</p>
            <Button onClick={() => go('existing-bills')}>Back to Bills</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading bill...</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-destructive">Unable to load bill.</p>
            <Button onClick={() => go('existing-bills')}>Back to Bills</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bill = data.bill;
  const history = data.history;

  function downloadPdf() {
    if (!billId) return;
    setPdfLoading(true);
    try {
      window.location.href = api.pdfExportUrl(billId);
      toast.success('Generating PDF...');
    } catch (e) {
      toast.error('PDF generation failed.');
    } finally {
      setTimeout(() => setPdfLoading(false), 1500);
    }
  }

  async function deleteBill() {
    if (!billId) return;
    setDeleting(true);
    try {
      await api.deleteBill(billId);
      toast.success('Bill deleted.');
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      go('existing-bills');
    } catch (e) {
      toast.error('Unable to delete bill.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('existing-bills')} aria-label="Back to bills">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{bill.billId}</h1>
          <p className="text-sm text-muted-foreground truncate">{bill.companyName}</p>
        </div>
        <Badge variant="outline" className={cn('text-xs font-semibold uppercase tracking-wide', statusBadgeClass(bill.status))}>
          {bill.status}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Bill Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Bill ID" value={bill.billId} mono />
          <Row label="Submission Date" value={formatDateDMY(bill.submissionDate)} />
          <Row label="Company" value={bill.companyName} />
          <Row label="Bill Number" value={bill.billNumber} />
          <Row label="Bill Date" value={formatDateDMY(bill.billDate)} />
          <Row label="Basic / Claim Amount" value={formatINR(bill.basicAmount)} highlight />
          <Row label="Submitted By" value={bill.submittedBy} />
          <Row label="Department" value={bill.department ?? '—'} />
          <Row label="Remarks" value={bill.description ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Receiving Acknowledgment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Received By" value={bill.receiverName ?? '—'} />
          <Row label="Received At" value={bill.receivedAt ? formatDateTime(bill.receivedAt) : '—'} />
          <Row label="Signature Type" value={bill.signatureType ?? '—'} />
          {bill.signaturePath ? (
            <div className="space-y-1 pt-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Signature</p>
              <div className="rounded-md border bg-white p-2 inline-block">
                { }
                <img src={bill.signaturePath} alt="Receiving signature" className="max-h-32 object-contain" />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No signature captured yet. Use the "Acknowledge Receipt" action to capture one.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bill Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bill.billDocumentPath ? (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">Document: </span>
                <span className="font-medium">{bill.billDocumentName}</span>
              </p>
              {bill.billDocumentMime?.startsWith('image/') && (
                <div className="rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                  { }
                  <img src={bill.billDocumentPath} alt="Bill document" className="max-h-96 mx-auto object-contain" />
                </div>
              )}
              {bill.billDocumentMime === 'application/pdf' && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={bill.billDocumentPath} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4" /> View PDF
                  </a>
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No document attached.</p>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{h.action.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                    </div>
                    {h.oldStatus && h.newStatus && (
                      <span className="text-xs text-muted-foreground">
                        Status: {h.oldStatus} → {h.newStatus}
                      </span>
                    )}
                    {h.performedBy && (
                      <span className="text-xs text-muted-foreground block">By: {h.performedBy}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 sticky bottom-20 md:bottom-4 bg-background pt-2">
        <Button variant="outline" onClick={() => go('existing-bills')} className="flex-1 min-w-[100px] h-12 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          variant="secondary"
          onClick={() => startEditBill(bill.id)}
          className="flex-1 min-w-[100px] h-12 gap-2"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        <Button onClick={downloadPdf} disabled={pdfLoading} className="flex-1 min-w-[100px] h-12 gap-2">
          {pdfLoading ? (
            <>
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download PDF
            </>
          )}
        </Button>
        {bill.status !== 'RECEIVED' && bill.status !== 'COMPLETED' && bill.status !== 'CANCELLED' && (
          <Button
            variant="secondary"
            onClick={() => {
              useNav.getState().startReceiptFor(bill.id);
            }}
            className="flex-1 min-w-[100px] h-12 gap-2"
          >
            Acknowledge Receipt
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-12 w-12 border-destructive/30 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Delete bill?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-mono font-semibold">{bill.billId}</span>? This action will mark the bill as cancelled. The record is preserved for audit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void deleteBill();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b last:border-b-0 pb-2 last:pb-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wide mt-0.5">{label}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${highlight ? 'text-base font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
