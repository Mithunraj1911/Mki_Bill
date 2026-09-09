'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNav } from '@/lib/nav-store';
import { useBillDraft } from '@/lib/bill-draft-store';
import { DEPARTMENTS } from '@/lib/types';
import { todayISODate, compressImage, isValidBillDocument, MAX_FILE_SIZE, formatFileSize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, FileText, X, ArrowLeft, Check } from 'lucide-react';

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

export function NewBillView() {
  const go = useNav((s) => s.go);
  const setDraft = useBillDraft((s) => s.setDraft);
  const existingDraft = useBillDraft((s) => s.draft);

  const [file, setFile] = useState<File | null>(existingDraft?.documentName ? new File([], existingDraft.documentName) : null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(existingDraft?.documentDataUrl ?? null);
  const [fileMime, setFileMime] = useState<string | null>(existingDraft?.documentMime ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existingDraft
      ? {
          ...existingDraft.payload,
          basicAmount: existingDraft.payload.basicAmount ?? (undefined as unknown as number),
        }
      : {
          submissionDate: todayISODate(),
          companyName: '',
          billNumber: '',
          billDate: todayISODate(),
          basicAmount: undefined as unknown as number,
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

  async function reviewAndSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      toast.error('Please fix the errors before continuing.');
      return;
    }
    const values = form.getValues();
    setDraft({
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
      documentDataUrl: fileDataUrl,
      documentMime: fileMime,
      documentName: file ? file.name : null,
    });
    go('bill-review');
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => go('dashboard')} aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">New Bill Entry</h1>
          <p className="text-sm text-muted-foreground">Enter bill details and upload the document.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void reviewAndSubmit();
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
              <Textarea rows={3} placeholder="Optional notes about this bill" {...form.register('description')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Document</CardTitle>
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
                    {file.size > 0 ? formatFileSize(file.size) : 'Restored from draft'}
                  </p>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => handleFileChange(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {fileDataUrl && fileMime?.startsWith('image/') && (
              <div className="rounded-md border overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img src={fileDataUrl} alt="Bill document preview" className="max-h-72 mx-auto object-contain" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Allowed: JPG, JPEG, PNG, PDF. Max 10 MB. Large images are compressed automatically.
            </p>
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
          <Button type="submit" className="flex-1 h-12 gap-2">
            <Check className="h-5 w-5" /> Review & Submit
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
