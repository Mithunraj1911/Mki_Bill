// Zod validation schemas for API request bodies.

import { z } from 'zod';

export const newBillPayloadSchema = z.object({
  submissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Submission date must be YYYY-MM-DD'),
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  billNumber: z.string().trim().min(1, 'Bill number is required').max(200),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bill date must be YYYY-MM-DD'),
  basicAmount: z.number().positive('Amount must be positive').max(1_00_00_00_000, 'Amount too large'),
  submittedBy: z.string().trim().min(1, 'Submitted by is required').max(200),
  department: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const documentSchema = z
  .object({
    dataUrl: z.string().refine((v) => v.startsWith('data:'), 'Invalid data URL'),
    mime: z.string().optional(),
    name: z.string().max(255).optional(),
  })
  .optional()
  .nullable();

export const createBillSchema = z.object({
  payload: newBillPayloadSchema,
  document: documentSchema,
});

export const confirmReceiptSchema = z.object({
  receiverName: z.string().trim().min(1, 'Receiver name is required').max(200),
  signatureType: z.enum(['DIGITAL', 'IMAGE']),
  signatureData: z.string().refine((v) => v.startsWith('data:image/png'), 'Signature must be a PNG data URL'),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  companyAddress: z.string().trim().max(500).or(z.literal('')),
  currency: z.string().trim().min(1).max(10),
  reportEmailTo: z.string().trim().max(2000).or(z.literal('')),
  reportEmailCc: z.string().trim().max(2000).or(z.literal('')),
  weeklyReportDay: z.string().trim().min(1).max(50),
  weeklyReportTime: z.string().trim().min(1).max(10),
  smtpEnabled: z.boolean(),
  smtpHost: z.string().trim().max(255).or(z.literal('')),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().trim().max(255).or(z.literal('')),
  smtpPassword: z.string().max(500).or(z.literal('')),
  fromEmail: z.string().trim().max(255).or(z.literal('')),
});

/// Send a test email using the SMTP config currently in the settings form (may be unsaved).
export const testEmailSchema = z.object({
  to: z.string().trim().email('Enter a valid email address'),
  smtpHost: z.string().trim().min(1, 'SMTP Host is required'),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().trim().min(1, 'SMTP User is required'),
  smtpPassword: z.string().min(1, 'SMTP Password is required'),
  fromEmail: z.string().trim().email('From Email must be a valid email address'),
});

/// Shared fields for a bulk submission (everything except bill number + amount, which are per-row).
export const bulkSharedSchema = z.object({
  submissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Submission date must be YYYY-MM-DD'),
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bill date must be YYYY-MM-DD'),
  submittedBy: z.string().trim().min(1, 'Submitted by is required').max(200),
  department: z.string().trim().min(1, 'Department is required').max(100),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

/// Single per-row entry in a bulk submission.
export const bulkEntrySchema = z.object({
  billNumber: z.string().trim().min(1, 'Bill number is required').max(200),
  basicAmount: z.number().positive('Amount must be positive').max(99_99_99_999, 'Amount too large'),
});

export const bulkCreateSchema = z.object({
  payload: z.object({
    submissionDate: bulkSharedSchema.shape.submissionDate,
    companyName: bulkSharedSchema.shape.companyName,
    billDate: bulkSharedSchema.shape.billDate,
    submittedBy: bulkSharedSchema.shape.submittedBy,
    department: bulkSharedSchema.shape.department,
    description: bulkSharedSchema.shape.description,
    entries: z.array(bulkEntrySchema).min(1, 'At least one bill entry is required').max(100, 'Maximum 100 entries per bulk submission'),
  }),
  document: documentSchema,
});

/// Bulk receipt confirmation: one signature for the whole batch.
export const bulkReceiptSchema = z.object({
  billIds: z.array(z.string().min(1)).min(1, 'At least one bill is required').max(100, 'Maximum 100 bills per bulk receipt'),
  receiverName: z.string().trim().min(1, 'Receiver name is required').max(200),
  signatureType: z.enum(['DIGITAL', 'IMAGE']),
  signatureData: z.string().refine((v) => v.startsWith('data:image/png'), 'Signature must be a PNG data URL'),
});

/// Update bill — same shape as create, all fields required (full replacement of editable fields).
/// Receipt fields (receiverName, signaturePath, signatureType, receivedAt, status) are NOT
/// touched by this endpoint.
export const updateBillSchema = z.object({
  payload: newBillPayloadSchema,
  /// Optional new document. If absent, the existing document is kept.
  document: documentSchema,
  /// If true and document is null, the existing document is removed (set to null).
  removeDocument: z.boolean().optional(),
});

export type NewBillPayloadInput = z.infer<typeof newBillPayloadSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type ConfirmReceiptInput = z.infer<typeof confirmReceiptSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type TestEmailInput = z.infer<typeof testEmailSchema>;
export type BulkCreateInput = z.infer<typeof bulkCreateSchema>;
export type BulkEntryInput = z.infer<typeof bulkEntrySchema>;
export type BulkReceiptInput = z.infer<typeof bulkReceiptSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
