'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import { useBillDraft } from '@/lib/bill-draft-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, Check, FileText as FileIcon } from 'lucide-react';
import { formatINR, formatDateDMY } from '@/lib/format';

export function BillReviewView() {
  const go = useNav((s) => s.go);
  const startReceiptFor = useNav((s) => s.startReceiptFor);
  const draft = useBillDraft((s) => s.draft);
  const clearDraft = useBillDraft((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  if (!draft) {
    // No draft yet — bounce back to form.
    return (
      <div className="max-w-3xl w-full mx-auto space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bill data to review. Please fill the form first.</p>
            <Button onClick={() => go('new-bill')}>Go to New Bill</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function submitBill() {
    if (!draft) return;
    setSubmitting(true);
    setDuplicateWarning(null);
    try {
      const result = await api.createBill({
        payload: {
          submissionDate: draft.payload.submissionDate,
          companyName: draft.payload.companyName,
          billNumber: draft.payload.billNumber,
          billDate: draft.payload.billDate,
          basicAmount: draft.payload.basicAmount ?? 0,
          submittedBy: draft.payload.submittedBy,
          department: draft.payload.department,
          description: draft.payload.description || undefined,
        },
        documentDataUrl: draft.documentDataUrl ?? undefined,
        documentMime: draft.documentMime ?? undefined,
        documentName: draft.documentName ?? undefined,
      });
      if (result.possibleDuplicate) {
        setDuplicateWarning(
          `Possible duplicate: ${result.possibleDuplicate.billId} — same company / bill no. / date / amount. The new bill was still submitted.`
        );
      }
      clearDraft();
      toast.success('Bill submitted successfully.');
      startReceiptFor(result.bill.id);
    } catch (e) {
      toast.error('Unable to submit bill.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('new-bill')} aria-label="Back to bill form">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Confirm Bill Details</h1>
          <p className="text-sm text-muted-foreground">Please review before submitting.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bill Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Submission Date" value={formatDateDMY(draft.payload.submissionDate)} />
          <Row label="Company" value={draft.payload.companyName} />
          <Row label="Bill Number" value={draft.payload.billNumber} />
          <Row label="Bill Date" value={formatDateDMY(draft.payload.billDate)} />
          <Row label="Amount" value={formatINR(draft.payload.basicAmount ?? 0)} highlight />
          <Row label="Submitted By" value={draft.payload.submittedBy} />
          <Row label="Department" value={draft.payload.department} />
          {draft.payload.description && <Row label="Remarks" value={draft.payload.description} />}
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Document</p>
            <div className="flex items-center gap-2">
              {draft.documentName ? (
                <>
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{draft.documentName}</span>
                </>
              ) : (
                <span className="text-muted-foreground italic">No document attached</span>
              )}
            </div>
            {draft.documentDataUrl && draft.documentMime?.startsWith('image/') && (
              <div className="mt-2 rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img src={draft.documentDataUrl} alt="Bill document preview" className="max-h-64 mx-auto object-contain" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {duplicateWarning && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <span>{duplicateWarning}</span>
        </div>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => go('new-bill')}
          className="flex-1 h-12"
          disabled={submitting}
        >
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
        <Button
          type="button"
          onClick={() => void submitBill()}
          className="flex-1 h-12 gap-2"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" /> Submit Bill
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
