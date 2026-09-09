// Server-side file storage helpers. Uploads bill documents, signature PNGs, and
// generated reports to Supabase Storage and returns a public URL.
//
// Buckets expected in Supabase (create these once — see README "Deployment"):
//   bill-documents
//   signatures
//   reports

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Server-only client using the service role key — bypasses RLS. Never import
// this file into a client component.
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export interface SaveFileResult {
  /** Public URL that can be used directly in <img src>/fetch. */
  publicUrl: string;
  /** Storage path within the bucket. */
  relativePath: string;
}

function bucketFor(bucket: string) {
  return supabaseAdmin.storage.from(bucket);
}

/**
 * Upload a base64 data URL to the given Supabase Storage bucket/path.
 * @param bucket 'bill-documents' | 'signatures' | 'reports'
 * @param nestedPath e.g. '2026/09/BILL-2026-00001'
 * @param filename e.g. 'bill.jpg' or 'receiving-signature.png'
 * @param dataUrl base64 data URL like "data:image/png;base64,...."
 */
export async function saveDataUrl(
  bucket: string,
  nestedPath: string,
  filename: string,
  dataUrl: string
): Promise<SaveFileResult> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return uploadBuffer(bucket, nestedPath, filename, buffer, contentType);
}

/** Upload a raw binary buffer to Supabase Storage. */
export async function saveBuffer(
  bucket: string,
  nestedPath: string,
  filename: string,
  buffer: Buffer
): Promise<SaveFileResult> {
  const ext = filename.split('.').pop() || '';
  return uploadBuffer(bucket, nestedPath, filename, buffer, extToMime(ext));
}

async function uploadBuffer(
  bucket: string,
  nestedPath: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<SaveFileResult> {
  const relativePath = `${nestedPath}/${filename}`;
  const { error } = await bucketFor(bucket).upload(relativePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Supabase Storage upload failed (${bucket}/${relativePath}): ${error.message}`);
  }
  const { data } = bucketFor(bucket).getPublicUrl(relativePath);
  return { publicUrl: data.publicUrl, relativePath: `${bucket}/${relativePath}` };
}

/** Delete a file given its public URL (as returned by saveDataUrl/saveBuffer). */
export async function deleteByPublicUrl(publicUrl: string): Promise<void> {
  try {
    // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const marker = '/object/public/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const rest = publicUrl.slice(idx + marker.length); // "<bucket>/<path>"
    const [bucket, ...pathParts] = rest.split('/');
    const objectPath = pathParts.join('/');
    if (!bucket || !objectPath) return;
    await bucketFor(bucket).remove([objectPath]);
  } catch {
    // ignore missing file / delete errors — non-fatal
  }
}

/** Compute the nested folder path for a bill document (e.g. 2026/09/BILL-2026-00001). */
export function billDocumentNestedPath(billId: string, submissionDate: string): string {
  const d = new Date(submissionDate + 'T00:00:00');
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${billId}`;
}

/** Compute the nested folder path for a signature (e.g. 2026/09/BILL-2026-00001). */
export function signatureNestedPath(billId: string, receivedAt: Date): string {
  const yyyy = receivedAt.getFullYear();
  const mm = String(receivedAt.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${billId}`;
}

/** Compute the nested folder path for a shared bulk-batch signature (e.g. 2026/09/bulk-1736314800000). */
export function bulkSignatureNestedPath(receivedAt: Date): string {
  const yyyy = receivedAt.getFullYear();
  const mm = String(receivedAt.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/bulk-${receivedAt.getTime()}`;
}

/** Compute the nested folder path for a weekly report (e.g. 2026/weekly). */
export function reportNestedPath(periodEnd: string): string {
  const d = new Date(periodEnd + 'T00:00:00');
  return `${d.getFullYear()}/weekly`;
}

/** Convert an extension to a mime type guess. */
export function extToMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}
