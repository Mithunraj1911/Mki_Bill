'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNav } from '@/lib/nav-store';
import { useBulkBillDraft, newBulkRowId, type BulkBillEntry } from '@/lib/bulk-bill-draft-store';
import { DEPARTMENTS } from '@/lib/types';
import { todayISODate, compressImage, isValidBillDocument, MAX_FILE_SIZE, formatFileSize, formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, FileText, X, ArrowLeft, Check, Plus, Trash2, Layers } from 'lucide-react';

// Form schema validates only the shared (single-valued) fields here.
// Per-row fields are validated separately when the user adds them.
const sharedSchema = z.object({
  submissionDate: z.string().min(1, 'Submission date is required'),
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  billDate: z.string().min(1, 'Bill date is required'),
  submittedBy: z.string().trim().min(1, 'Submitted by is required').max(200),
  department: z.string().min(1, 'Department is required'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

type SharedFormValues = z.infer<typeof sharedSchema>;

interface BulkRow extends BulkBillEntry {
  billNumberError?: string;
  amountError?: string;
}

export function BulkBillView() {
  const go = useNav((s) => s.go);
  const setDraft = useBulkBillDraft((s) => s.setDraft);
  const existingDraft = useBulkBillDraft((s) => s.draft);

  // Initialize from persisted draft (if any) or with a single empty row
  const [rows, setRows] = useState<BulkRow[]>(() => {
    if (existingDraft && existingDraft.entries.length > 0) {
      return existingDraft.entries.map((e) => ({ ...e }));
    }
    return [{ rowId: newBulkRowId(), billNumber: '', basicAmount: null }];
  });

  const [file, setFile] = useState<File | null>(existingDraft?.documentName ? new File([], existingDraft.documentName) : null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(existingDraft?.documentDataUrl ?? null);
  const [fileMime, setFileMime] = useState<string | null>(existingDraft?.documentMime ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  const form = useForm<SharedFormValues>({
    resolver: zodResolver(sharedSchema),
    defaultValues: existingDraft
      ? {
          submissionDate: existingDraft.shared.submissionDate,
          companyName: existingDraft.shared.companyName,
          billDate: existingDraft.shared.billDate,
          submittedBy: existingDraft.shared.submittedBy,
          department: existingDraft.shared.department,
          description: existingDraft.shared.description,
        }
      : {
          submissionDate: todayISODate(),
          companyName: '',
          billDate: todayISODate(),
          submittedBy: '',
          department: 'IT',
          description: '',
        },
  });

  async function handleFileChange(selected: File | null) {
    setFileError(null);
    if (!selected) {
      setFile(null);
      setFileDataUrl(null);
      setFileMime(null);
      return;
    }
    if (!isValidBillDocument(selected)) {
      setFileError('Only JPG, PNG, or PDF files are allowed.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError(`File too large. Max size is 10 MB (file is ${formatFileSize(selected.size)}).`);
      return;
    }
    setFile(selected);
    setFileBusy(true);
    try {
      if (selected.type.startsWith('image/')) {
        const compressed = await compressImage(selected, 1600, 0.85);
        setFileDataUrl(compressed);
        setFileMime(compressed.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
      } else {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read PDF'));
          reader.readAsDataURL(selected);
        });
        setFileDataUrl(dataUrl);
        setFileMime('application/pdf');
      }
    } catch {
      setFileError('Failed to process file. Please try again.');
      setFile(null);
    } finally {
      setFileBusy(false);
    }
  }

  function addRow() {
    setRows((prev) => [...prev, { rowId: newBulkRowId(), billNumber: '', basicAmount: null }]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  function updateRow(rowId: string, field: 'billNumber' | 'basicAmount', value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        if (field === 'billNumber') {
          return { ...r, billNumber: value, billNumberError: undefined };
        }
        // basicAmount
        const num = value === '' ? null : parseFloat(value);
        return { ...r, basicAmount: Number.isNaN(num as number) ? null : num, amountError: undefined };
      })
    );
  }

  function validateRows(): { ok: boolean; validatedRows: BulkRow[] } {
    let ok = true;
    const validatedRows = rows.map((r) => {
      const row: BulkRow = { rowId: r.rowId, billNumber: r.billNumber.trim(), basicAmount: r.basicAmount };
      if (!row.billNumber) {
        row.billNumberError = 'Bill number is required';
        ok = false;
      } else if (row.billNumber.length > 200) {
        row.billNumberError = 'Bill number is too long';
        ok = false;
      }
      if (row.basicAmount == null) {
        row.amountError = 'Amount is required';
        ok = false;
      } else if (row.basicAmount <= 0) {
        row.amountError = 'Amount must be positive';
        ok = false;
      } else if (row.basicAmount > 99_99_99_999) {
        row.amountError = 'Amount too large';
        ok = false;
      }
      return row;
    });
    // Also detect duplicate bill numbers within the batch (case-insensitive on trimmed value)
    const seen = new Map<string, number>();
    validatedRows.forEach((r, idx) => {
      if (!r.billNumber) return;
      const key = r.billNumber.toLowerCase();
      if (seen.has(key)) {
        validatedRows[idx].billNumberError = 'Duplicate bill number in this batch';
        ok = false;
      } else {
        seen.set(key, idx);
      }
    });
    setRows(validatedRows);
    return { ok, validatedRows };
  }

  async function reviewAndSubmit() {
    // Validate shared fields
    const sharedValid = await form.trigger();
    if (!sharedValid) {
      toast.error('Please fix the shared field errors.');
      return;
    }
    // Validate rows
    const { ok, validatedRows } = validateRows();
    if (!ok) {
      toast.error('Please fix the bill entry errors.');
      return;
    }
    const values = form.getValues();
    setDraft({
      shared: {
        submissionDate: values.submissionDate,
        companyName: values.companyName.trim(),
        billDate: values.billDate,
        submittedBy: values.submittedBy.trim(),
        department: values.department,
        description: values.description ?? '',
      },
      entries: validatedRows.map((r) => ({
        rowId: r.rowId,
        billNumber: r.billNumber,
        basicAmount: r.basicAmount,
      })),
      documentDataUrl: fileDataUrl,
      documentMime: fileMime,
      documentName: file ? file.name : null,
    });
    go('bulk-bill-review');
  }

  const totalAmount = rows.reduce((s, r) => s + (r.basicAmount ?? 0), 0);

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('dashboard')} aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Bulk Bill Entry
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit multiple bills for the same company in one go. The shared fields apply to every bill; add a row per bill number + amount.
          </p>
        </div>
      </div>

      {/* Shared fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Submission Date" required error={form.formState.errors.submissionDate?.message}>
            <Input type="date" {...form.register('submissionDate')} />
          </Field>
          <Field label="Company Name" required error={form.formState.errors.companyName?.message}>
            <Input placeholder="e.g. ABC Technologies" {...form.register('companyName')} autoComplete="off" />
          </Field>
          <Field label="Bill Date" required error={form.formState.errors.billDate?.message}>
            <Input type="date" {...form.register('billDate')} />
          </Field>
          <Field label="Submitted By" required error={form.formState.errors.submittedBy?.message}>
            <Input placeholder="e.g. Mithun" {...form.register('submittedBy')} autoComplete="off" />
          </Field>
          <Field label="Department" required error={form.formState.errors.department?.message}>
            <Select value={form.watch('department')} onValueChange={(v) => form.setValue('department', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description / Remarks" error={form.formState.errors.description?.message}>
            <Textarea rows={2} placeholder="Optional notes shared across all bills" {...form.register('description')} />
          </Field>
        </CardContent>
      </Card>

      {/* Shared document */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared Bill Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-14 gap-2"
              onClick={() => triggerFileInput('camera')}
            >
              <Camera className="h-5 w-5" /> Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 gap-2"
              onClick={() => triggerFileInput('file')}
            >
              <Upload className="h-5 w-5" /> Upload Document
            </Button>
          </div>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {fileBusy && <p className="text-sm text-muted-foreground">Processing file...</p>}
          {file && !fileBusy && (
            <div className="rounded-md border p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.size > 0 ? formatFileSize(file.size) : 'Restored from draft'} · shared across all bills
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => handleFileChange(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {fileDataUrl && fileMime?.startsWith('image/') && (
            <div className="rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
              <img src={fileDataUrl} alt="Shared bill document preview" className="max-h-64 mx-auto object-contain" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            This document is attached to every bill in the batch. Allowed: JPG, JPEG, PNG, PDF. Max 10 MB.
          </p>
        </CardContent>
      </Card>

      {/* Bill entries (per-row) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Bill Entries ({rows.length})</CardTitle>
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatINR(totalAmount)}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r, idx) => (
            <div
              key={r.rowId}
              className="rounded-md border p-3 space-y-3 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bill #{idx + 1}
                </span>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(r.rowId)}
                    aria-label="Remove this bill entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Field label="Bill Number" required error={r.billNumberError}>
                <Input
                  value={r.billNumber}
                  onChange={(e) => updateRow(r.rowId, 'billNumber', e.target.value)}
                  placeholder="e.g. FY26-27/1203"
                  autoComplete="off"
                />
              </Field>
              <Field label="Basic / Claim Amount (₹)" required error={r.amountError}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.basicAmount ?? ''}
                  onChange={(e) => updateRow(r.rowId, 'basicAmount', e.target.value)}
                  placeholder="e.g. 50000"
                />
              </Field>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            className="w-full h-12 gap-2 border-dashed"
          >
            <Plus className="h-5 w-5" /> Add Another Bill
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(null);
            go('dashboard');
          }}
          className="flex-1 h-12"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void reviewAndSubmit()}
          className="flex-1 h-12 gap-2"
        >
          <Check className="h-5 w-5" /> Review & Submit ({rows.length})
        </Button>
      </div>
    </div>
  );

  function triggerFileInput(mode: 'camera' | 'file') {
    const input = document.createElement('input');
    input.type = 'file';
    if (mode === 'camera') {
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
    } else {
      input.accept = 'image/*,.pdf';
    }
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void handleFileChange(f);
    };
    input.click();
  }
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
