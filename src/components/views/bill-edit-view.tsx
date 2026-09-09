'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import type { BillWithHistory } from '@/lib/types';
import { DEPARTMENTS } from '@/lib/types';
import { compressImage, isValidBillDocument, MAX_FILE_SIZE, formatFileSize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, FileText, X, ArrowLeft, Save, AlertTriangle, RotateCcw } from 'lucide-react';

const schema = z.object({
  submissionDate: z.string().min(1, 'Submission date is required'),
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  billNumber: z.string().trim().min(1, 'Bill number is required').max(200),
  billDate: z.string().min(1, 'Bill date is required'),
  basicAmount: z
    .number({ invalid_type_error: 'Amount is required' })
    .positive('Amount must be positive')
    .max(99_99_99_999, 'Amount too large'),
  submittedBy: z.string().trim().min(1, 'Submitted by is required').max(200),
  department: z.string().min(1, 'Department is required'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function BillEditView() {
  const go = useNav((s) => s.go);
  const openBill = useNav((s) => s.openBill);
  const editBillId = useNav((s) => s.editBillId);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<BillWithHistory>({
    queryKey: ['bill', editBillId],
    queryFn: () => api.getBill(editBillId!),
    enabled: !!editBillId,
  });

  // Compute the form's `values` prop from the bill data, memoized so the reference
  // is stable across re-renders (avoids re-triggering the form reset on every render).
  const formValues = useMemo<FormValues | undefined>(() => {
    if (!data) return undefined;
    const b = data.bill;
    return {
      submissionDate: b.submissionDate,
      companyName: b.companyName,
      billNumber: b.billNumber,
      billDate: b.billDate,
      basicAmount: b.basicAmount,
      submittedBy: b.submittedBy,
      department: b.department ?? 'Other',
      description: b.description ?? '',
    };
  }, [data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      submissionDate: '',
      companyName: '',
      billNumber: '',
      billDate: '',
      basicAmount: undefined as unknown as number,
      submittedBy: '',
      department: 'IT',
      description: '',
    },
    values: formValues,
  });

  // Sync the document-related state when the bill data arrives.
   
  useEffect(() => {
    if (!data) return;
    const b = data.bill;
    setInitialDocPath(b.billDocumentPath);
    setInitialDocName(b.billDocumentName);
    setInitialDocMime(b.billDocumentMime);
    setFile(null);
    setFileDataUrl(null);
    setFileMime(null);
    setRemoveDocument(false);
  }, [data]);

  const [initialDocPath, setInitialDocPath] = useState<string | null>(null);
  const [initialDocName, setInitialDocName] = useState<string | null>(null);
  const [initialDocMime, setInitialDocMime] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [removeDocument, setRemoveDocument] = useState(false);
  const [saving, setSaving] = useState(false);
  // Local display state for the Select (Radix Select doesn't reliably sync with
  // React Hook Form when the value is set externally via form.reset / values prop).
  const [departmentDisplay, setDepartmentDisplay] = useState<string>('');

  // Sync the local display state with the form values when data loads.
  useEffect(() => {
    if (formValues) {
      setDepartmentDisplay(formValues.department);
    }
  }, [formValues]);

  if (!editBillId) {
    return (
      <div className="max-w-3xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bill selected to edit.</p>
            <Button onClick={() => go('existing-bills')}>Go to Bills</Button>
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
  const isReceived = bill.status === 'RECEIVED' || bill.status === 'COMPLETED';

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
      // Selecting a new file clears any "remove" intent
      setRemoveDocument(false);
    } catch {
      setFileError('Failed to process file. Please try again.');
      setFile(null);
    } finally {
      setFileBusy(false);
    }
  }

  async function save() {
    if (!editBillId) return;
    const valid = await form.trigger();
    if (!valid) {
      toast.error('Please fix the errors before saving.');
      return;
    }
    setSaving(true);
    try {
      const values = form.getValues();
      const result = await api.updateBill(editBillId, {
        payload: {
          submissionDate: values.submissionDate,
          companyName: values.companyName.trim(),
          billNumber: values.billNumber.trim(),
          billDate: values.billDate,
          basicAmount: values.basicAmount,
          submittedBy: values.submittedBy.trim(),
          department: values.department,
          description: values.description ?? '',
        },
        documentDataUrl: fileDataUrl ?? undefined,
        documentMime: fileMime ?? undefined,
        documentName: file ? file.name : undefined,
        removeDocument,
      });
      // Invalidate caches so the lists & details reflect the changes
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['bill', editBillId] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Bill updated successfully.');
      openBill(result.bill.id);
    } catch (e) {
      toast.error('Unable to update bill.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    if (!data) return;
    const b = data.bill;
    form.reset({
      submissionDate: b.submissionDate,
      companyName: b.companyName,
      billNumber: b.billNumber,
      billDate: b.billDate,
      basicAmount: b.basicAmount,
      submittedBy: b.submittedBy,
      department: b.department ?? 'Other',
      description: b.description ?? '',
    });
    setDepartmentDisplay(b.department ?? 'Other');
    setFile(null);
    setFileDataUrl(null);
    setFileMime(null);
    setRemoveDocument(false);
    setFileError(null);
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => openBill(editBillId)} aria-label="Back to bill details">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Edit Bill — {bill.billId}</h1>
          <p className="text-sm text-muted-foreground truncate">Update the bill details and save.</p>
        </div>
      </div>

      {isReceived && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              This bill has already been received.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Editing the bill entry fields will NOT change the receipt acknowledgment (receiver name, signature, received timestamp). Those remain as recorded. If the receipt itself needs correction, contact the administrator.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Submission Date" required error={form.formState.errors.submissionDate?.message}>
              <Input type="date" {...form.register('submissionDate')} />
            </Field>
            <Field label="Company Name" required error={form.formState.errors.companyName?.message}>
              <Input placeholder="e.g. ABC Technologies" {...form.register('companyName')} autoComplete="off" />
            </Field>
            <Field label="Bill Number" required error={form.formState.errors.billNumber?.message}>
              <Input placeholder="e.g. FY26-27/1203" {...form.register('billNumber')} autoComplete="off" />
            </Field>
            <Field label="Bill Date" required error={form.formState.errors.billDate?.message}>
              <Input type="date" {...form.register('billDate')} />
            </Field>
            <Field label="Basic / Claim Amount (₹)" required error={form.formState.errors.basicAmount?.message}>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 50000"
                {...form.register('basicAmount', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Submitted By" required error={form.formState.errors.submittedBy?.message}>
              <Input placeholder="e.g. Mithun" {...form.register('submittedBy')} autoComplete="off" />
            </Field>
            <Field label="Department" required error={form.formState.errors.department?.message}>
              <Select
                // Use a key that changes when the form is prefilled, to force the Select to remount
                // with the correct initial value (Radix Select doesn't reliably sync when the
                // value prop changes from undefined/empty to a real value via React Hook Form).
                key={`dept-${departmentDisplay}`}
                value={departmentDisplay}
                onValueChange={(v) => {
                  setDepartmentDisplay(v);
                  form.setValue('department', v, { shouldValidate: true });
                }}
              >
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
              <Textarea rows={3} placeholder="Optional notes about this bill" {...form.register('description')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Show existing document if present and not being replaced/removed */}
            {initialDocPath && !fileDataUrl && !removeDocument && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{initialDocName ?? 'Current document'}</p>
                    <p className="text-xs text-muted-foreground">Current document on file</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemoveDocument(true)}
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
                {initialDocMime?.startsWith('image/') && (
                  <div className="rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                    { }
                    <img src={initialDocPath} alt="Current bill document" className="max-h-48 mx-auto object-contain" />
                  </div>
                )}
              </div>
            )}

            {/* "Removed" placeholder — user can undo */}
            {initialDocPath && removeDocument && !fileDataUrl && (
              <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Document will be <span className="font-semibold text-destructive">removed</span> on save.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveDocument(false)}
                  className="gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Undo
                </Button>
              </div>
            )}

            {/* New file selected */}
            {file && (
              <div className="rounded-md border p-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.size > 0 ? formatFileSize(file.size) : ''} · replaces current document on save
                  </p>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => handleFileChange(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {fileDataUrl && fileMime?.startsWith('image/') && (
              <div className="rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img src={fileDataUrl} alt="New bill document preview" className="max-h-72 mx-auto object-contain" />
              </div>
            )}

            {/* Upload buttons (only when no new file is pending) */}
            {!file && (
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
            )}

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            {fileBusy && <p className="text-sm text-muted-foreground">Processing file...</p>}
            <p className="text-xs text-muted-foreground">
              Allowed: JPG, JPEG, PNG, PDF. Max 10 MB. Leave as-is or upload a new one to replace.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3 sticky bottom-20 md:bottom-4 bg-background pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openBill(editBillId)}
            className="flex-1 h-12"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            className="flex-1 h-12 gap-2"
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button type="submit" className="flex-1 h-12 gap-2" disabled={saving}>
            {saving ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
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
