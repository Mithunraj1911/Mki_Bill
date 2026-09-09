'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import { useBulkBillDraft } from '@/lib/bulk-bill-draft-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, AlertTriangle, Layers, FileText as FileIcon, FileText } from 'lucide-react';
import { formatINR, formatDateDMY } from '@/lib/format';
import type { CreatedBillSummary } from '@/lib/nav-store';

export function BulkBillReviewView() {
  const go = useNav((s) => s.go);
  const startBulkReceiptFor = useNav((s) => s.startBulkReceiptFor);
  const draft = useBulkBillDraft((s) => s.draft);
  const clearDraft = useBulkBillDraft((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<{ billId: string; duplicateBillId: string }[]>([]);

  if (!draft) {
    return (
      <div className="max-w-3xl w-full mx-auto space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bulk bill data to review. Please fill the form first.</p>
            <Button onClick={() => go('bulk-bill')}>Go to Bulk Bill Entry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAmount = draft.entries.reduce((s, e) => s + (e.basicAmount ?? 0), 0);

  async function submitBulk() {
    if (!draft) return;
    setSubmitting(true);
    setDuplicateWarnings([]);
    try {
      const result = await api.bulkCreateBills({
        payload: {
          submissionDate: draft.shared.submissionDate,
          companyName: draft.shared.companyName,
          billDate: draft.shared.billDate,
          submittedBy: draft.shared.submittedBy,
          department: draft.shared.department,
          description: draft.shared.description || undefined,
          entries: draft.entries.map((e) => ({
            billNumber: e.billNumber,
            basicAmount: e.basicAmount ?? 0,
          })),
        },
        documentDataUrl: draft.documentDataUrl ?? undefined,
        documentMime: draft.documentMime ?? undefined,
        documentName: draft.documentName ?? undefined,
      });
      if (result.duplicates.length > 0) {
        setDuplicateWarnings(result.duplicates);
      }
      const summaries: CreatedBillSummary[] = result.bills.map((b) => ({
        dbId: b.id,
        billId: b.billId,
        billNumber: b.billNumber,
        basicAmount: b.basicAmount,
        companyName: b.companyName,
      }));
      clearDraft();
      toast.success(`${summaries.length} bill${summaries.length === 1 ? '' : 's'} submitted successfully.`);
      // Go to the bulk acknowledgment screen so the receiver checks & approves the whole batch at once.
      startBulkReceiptFor(summaries);
    } catch (e) {
      toast.error('Unable to submit bulk bills.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('bulk-bill')} aria-label="Back to bulk form">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Confirm Bulk Bills
          </h1>
          <p className="text-sm text-muted-foreground">Review all {draft.entries.length} bills before submitting.</p>
        </div>
      </div>

      {/* Shared summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Shared Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Submission Date" value={formatDateDMY(draft.shared.submissionDate)} />
          <Row label="Company" value={draft.shared.companyName} />
          <Row label="Bill Date" value={formatDateDMY(draft.shared.billDate)} />
          <Row label="Submitted By" value={draft.shared.submittedBy} />
          <Row label="Department" value={draft.shared.department} />
          {draft.shared.description && <Row label="Remarks" value={draft.shared.description} />}
          <div className="space-y-1 pt-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Document</p>
            <div className="flex items-center gap-2">
              {draft.documentName ? (
                <>
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{draft.documentName}</span>
                  <span className="text-xs text-muted-foreground">(shared across all bills)</span>
                </>
              ) : (
                <span className="text-muted-foreground italic">No document attached</span>
              )}
            </div>
            {draft.documentDataUrl && draft.documentMime?.startsWith('image/') && (
              <div className="mt-2 rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img src={draft.documentDataUrl} alt="Shared bill document preview" className="max-h-48 mx-auto object-contain" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-bill entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Bills ({draft.entries.length})
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatINR(totalAmount)}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="p-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">#</th>
                  <th className="p-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Bill Number</th>
                  <th className="p-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {draft.entries.map((e, idx) => (
                  <tr key={e.rowId} className="border-b last:border-b-0">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 font-medium">{e.billNumber}</td>
                    <td className="p-2 text-right font-semibold">{formatINR(e.basicAmount ?? 0)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-muted/30">
                  <td className="p-2" colSpan={2}>TOTAL ({draft.entries.length} bills)</td>
                  <td className="p-2 text-right">{formatINR(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {duplicateWarnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-3 text-sm space-y-1">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">Possible duplicate bills detected</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {duplicateWarnings.map((d, i) => (
                  <li key={i}>
                    New bill <span className="font-mono">{d.billId}</span> matches existing{' '}
                    <span className="font-mono">{d.duplicateBillId}</span> (same company / bill number / date / amount).
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                The new bills were still submitted. Review them on the Existing Bills page.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => go('bulk-bill')}
          className="flex-1 h-12"
          disabled={submitting}
        >
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
        <Button
          type="button"
          onClick={() => void submitBulk()}
          className="flex-1 h-12 gap-2"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Submitting {draft.entries.length} bills...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" /> Submit {draft.entries.length} Bills
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b last:border-b-0 pb-2 last:pb-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wide mt-0.5">{label}</span>
      <span className={`text-right ${highlight ? 'text-base font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
