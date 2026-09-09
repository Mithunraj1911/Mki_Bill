// Formatting and small utility helpers shared across the app.

/// Convert paise (int) to rupees (float).
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/// Convert rupees (float) to paise (int).
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/// Format a number as Indian Rupees, e.g. ₹50,000.
export function formatINR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  // Indian number formatting (lakhs/crores)
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return formatter.format(rounded);
}

/// Format a plain number using Indian grouping (no currency symbol).
export function formatNumberIN(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/// Convert YYYY-MM-DD to DD-MM-YYYY for display.
export function formatDateDMY(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/// Format a Date or ISO string as DD-MM-YYYY.
export function formatDateDMYFromISO(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/// Format an ISO timestamp as DD-MM-YYYY hh:mm AM/PM in IST (server already returns UTC, display in local tz).
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;
  const hhStr = String(hh).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hhStr}:${min} ${ampm}`;
}

/// Format an ISO timestamp as just the time portion hh:mm AM/PM.
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${String(hh).padStart(2, '0')}:${min} ${ampm}`;
}

/// Today's date as YYYY-MM-DD (local tz).
export function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/// Generate a human-readable Bill ID like BILL-2026-00001.
/// yearSeed is used to keep the per-year counter.
export function formatBillId(year: number, seq: number): string {
  return `BILL-${year}-${String(seq).padStart(5, '0')}`;
}

/// Compute the current week's Monday and Sunday as YYYY-MM-DD (local tz).
export function currentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  // Treat Monday as start of week
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoDate(monday), end: isoDate(sunday) };
}

/// Compute the previous completed week's Monday and Sunday (the most recent Monday-Sunday that ended).
export function previousWeekRange(): { start: string; end: string } {
  const { start } = currentWeekRange();
  const monday = new Date(start + 'T00:00:00');
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return { start: isoDate(prevMonday), end: isoDate(prevSunday) };
}

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/// Truncate text safely.
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

/// Status badge color mapping for shadcn Badge variant.
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'RECEIVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    case 'SUBMITTED':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    case 'COMPLETED':
      return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

/// Convert a File (image) to a downscaled JPEG data URL for lighter storage.
/// Returns a Promise resolving to a data URL string.
export async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  const dataUrl = await readFileAsDataURL(file);
  // Only attempt compression for image types
  if (!file.type.startsWith('image/')) return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      // For PNG with transparency, keep PNG to avoid black bg; otherwise JPEG
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      try {
        resolve(canvas.toDataURL(outType, quality));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/// Pretty file size formatter.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/// Validate that a file matches the allowed bill document MIME types.
export function isValidBillDocument(file: File): boolean {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  return allowed.includes(file.type);
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
