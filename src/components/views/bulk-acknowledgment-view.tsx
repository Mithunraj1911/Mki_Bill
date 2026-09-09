'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import type { SignatureType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Layers, FileText, Camera, X, Check, PenLine } from 'lucide-react';
import { SignaturePad, SignaturePadHandle } from '@/components/signature/signature-pad';
import { formatINR, compressImage } from '@/lib/format';

export function BulkAcknowledgmentView() {
  const go = useNav((s) => s.go);
  const bills = useNav((s) => s.bulkCreatedBills);
  const showBulkSuccess = useNav((s) => s.showBulkSuccess);

  const sigPadRef = useRef<SignaturePadHandle>(null);
  const [sigMethod, setSigMethod] = useState<SignatureType>('DIGITAL');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [uploadedSig, setUploadedSig] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (bills.length === 0) {
    return (
      <div className="max-w-3xl w-full mx-auto space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bulk bills to acknowledge.</p>
            <Button onClick={() => go('dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Shared company name (same for all bills in the batch)
  const companyName = bills[0]?.companyName ?? '—';
  const totalAmount = bills.reduce((s, b) => s + b.basicAmount, 0);

  async function handleUploadedSigChange(file: File | null) {
    if (!file) {
      setUploadedSig(null);
      setSigEmpty(true);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    try {
      const compressed = await compressImage(file, 800, 0.9);
      setUploadedSig(compressed);
      setSigEmpty(false);
    } catch {
      toast.error('Failed to process signature image.');
    }
  }

  async function confirmReceipt() {
    if (!receiverName.trim()) {
      toast.error('Please enter receiver name and signature.');
      return;
    }
    let signatureData: string | null = null;
    if (sigMethod === 'DIGITAL') {
      signatureData = sigPadRef.current?.toPng() ?? null;
    } else {
      signatureData = uploadedSig;
    }
    if (!signatureData) {
      toast.error('Please enter receiver name and signature.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.bulkConfirmReceipt({
        billIds: bills.map((b) => b.dbId),
        receiverName: receiverName.trim(),
        signatureType: sigMethod,
        signatureData,
      });
      toast.success(`${result.bills.length} bills received successfully.`);
      // Refresh the bill summaries with the updated info from the API response.
      const updatedSummaries = bills.map((b) => {
        const updated = result.bills.find((ub) => ub.id === b.dbId);
        return updated
          ? {
              dbId: updated.id,
              billId: updated.billId,
              billNumber: updated.billNumber,
              basicAmount: updated.basicAmount,
              companyName: updated.companyName,
            }
          : b;
      });
      showBulkSuccess(updatedSummaries, result.receiverName, result.receivedAt);
    } catch (e) {
      toast.error('Unable to confirm bulk receipt.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('dashboard')} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Bulk Acknowledgment of Receipt
          </h1>
          <p className="text-sm text-muted-foreground">
            Store/Incharge checks all {bills.length} bills in this batch and signs once to confirm receipt for the entire batch.
          </p>
        </div>
      </div>

      {/* Batch summary card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Batch Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Company" value={companyName} />
          <Row label="Total Bills" value={String(bills.length)} />
          <Row label="Total Amount" value={formatINR(totalAmount)} highlight />
          <div className="pt-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Bills in this batch</p>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">#</th>
                    <th className="p-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Bill ID</th>
                    <th className="p-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Bill No.</th>
                    <th className="p-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, idx) => (
                    <tr key={b.dbId} className="border-t">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2 font-mono font-semibold">{b.billId}</td>
                      <td className="p-2 font-medium">{b.billNumber}</td>
                      <td className="p-2 text-right font-semibold">{formatINR(b.basicAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="p-2" colSpan={3}>TOTAL ({bills.length} bills)</td>
                    <td className="p-2 text-right">{formatINR(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receiving confirmation — one name, one signature for the whole batch */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Receiving Confirmation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Received By <span className="text-destructive">*</span></Label>
            <Input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Enter Store / Incharge Name (applies to all bills in this batch)"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              This name and signature will be recorded against all {bills.length} bills in the batch.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Sign <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">Select signature method (one signature for the whole batch)</p>
            <Tabs value={sigMethod} onValueChange={(v) => setSigMethod(v as SignatureType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="DIGITAL" className="gap-1.5">
                  <PenLine className="h-4 w-4" /> Digital Sign
                </TabsTrigger>
                <TabsTrigger value="IMAGE" className="gap-1.5">
                  <Camera className="h-4 w-4" /> Upload Image
                </TabsTrigger>
              </TabsList>
              <TabsContent value="DIGITAL" className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Please sign below</p>
                <SignaturePad ref={sigPadRef} onEmptyChange={setSigEmpty} className="min-h-[220px]" />
              </TabsContent>
              <TabsContent value="IMAGE" className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Upload a photo of your signature</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 gap-2"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.setAttribute('capture', 'environment');
                      input.onchange = () => {
                        const f = input.files?.[0];
                        if (f) void handleUploadedSigChange(f);
                      };
                      input.click();
                    }}
                  >
                    <Camera className="h-5 w-5" /> Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 gap-2"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = () => {
                        const f = input.files?.[0];
                        if (f) void handleUploadedSigChange(f);
                      };
                      input.click();
                    }}
                  >
                    <PenLine className="h-5 w-5" /> Choose File
                  </Button>
                </div>
                {uploadedSig && (
                  <div className="relative rounded-md border overflow-hidden bg-white">
                    <img src={uploadedSig} alt="Uploaded signature" className="max-h-40 mx-auto object-contain" />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setUploadedSig(null);
                        setSigEmpty(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-20 md:bottom-4 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => go('dashboard')}
              className="flex-1 h-12"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmReceipt()}
              className="flex-1 h-12 gap-2"
              disabled={submitting || (sigMethod === 'DIGITAL' ? sigEmpty : !uploadedSig) || !receiverName.trim()}
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Confirming {bills.length} bills...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" /> Confirm Receipt for All ({bills.length})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
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
