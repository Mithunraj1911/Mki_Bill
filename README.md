# Digital Bill Management Portal

A complete, production-ready, mobile-first **Digital Bill Submission and Management Portal** for internal company use. Replaces the paper-based bill submission register with a fully digital workflow:

1. Employee enters bill details on a phone
2. Employee hands the phone to the Store/Incharge person
3. Store/Incharge signs **directly on the phone screen** with their finger
4. Receipt is confirmed → bill status becomes `RECEIVED`
5. Bills are searchable, exportable to PDF / Excel, and a weekly Excel report is emailed to management automatically

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma** (Postgres via Supabase), **Supabase Storage**, **Zustand**, **TanStack Query**, **react-signature-canvas**, **SheetJS (xlsx)**, **jsPDF**.

> This build is wired directly to **Supabase** — Postgres for the database and Supabase Storage for bill documents, signatures, and generated reports. It's ready to deploy to **Vercel**. See the step-by-step deployment guide below.

---

## Table of contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Project structure](#project-structure)
4. [Environment variables](#environment-variables)
5. [Architecture adaptations (sandbox → production)](#architecture-adaptations-sandbox--production)
6. [API reference](#api-reference)
7. [Database schema](#database-schema)
8. [Security model](#security-model)
9. [Weekly automated report & email](#weekly-automated-report--email)
10. [PWA support](#pwa-support)
11. [Deployment (Vercel + Supabase + Resend)](#deployment-vercel--supabase--resend)
12. [Testing checklist](#testing-checklist)
13. [Future Android/Play Store packaging](#future-androidplay-store-packaging)

---

## Features

- **No login** — opens directly to the dashboard. (Authentication can be added later; see Security model.)
- **Mobile-first responsive UI** — bottom navigation on mobile, sidebar on desktop, sticky footer.
- **Dashboard** with summary cards: total bills, this week, this month, total amount, weekly amount, monthly amount, plus recent bills.
- **New Bill Entry** with mobile camera capture, file upload (JPG/PNG/PDF, max 10 MB), client-side image compression, and a review step before submission.
- **Acknowledgment of Receipt** — the Store/Incharge person signs directly on the phone screen using a touch-friendly digital signature pad (with undo / clear), or optionally uploads a signature image. Receiver name is required.
- **Server-generated bill IDs** in the format `BILL-YYYY-NNNNN` (concurrency-safe inside a Prisma transaction).
- **Existing Bills** list with desktop table & mobile cards, plus:
  - Search by Bill ID / Company / Bill Number / Submitted By / Receiver
  - Filters: status, department, company, date range, amount range
  - Sort: newest, oldest, highest amount, lowest amount
  - Pagination (25 / 50 / 100 per page)
- **Bill Details** page with full audit trail and signature preview.
- **PDF export** (single bill) using jsPDF — embeds the digital signature and bill document image.
- **Excel export** (SheetJS) with three sheets: Bills, Summary, Company Summary, plus a totals row.
- **Reports** page with weekly / monthly / yearly summaries, plus company-wise and department-wise tables.
- **Weekly automated report** endpoint protected by `CRON_SECRET`, idempotent via `report_logs` table (will not double-send if already sent for a period).
- **Settings** page for company profile, report recipients, and weekly schedule.
- **PWA** — installable on mobile via manifest.json + service worker (offline app shell caching).
- **Audit trail** — every important action is recorded in `bill_history`.
- **Soft delete** — deleted bills are marked `CANCELLED` with `deleted_at` set; records preserved for audit.
- **Duplicate detection** — warns if a bill with the same company + bill number + bill date + amount already exists.
- **Zod + React Hook Form** validation on every input.
- **Toast notifications** (sonner) for every action.
- **Indian Rupee formatting** and Indian date format (DD-MM-YYYY).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables — copy the example and fill in your
#    Supabase project's values (see "Environment variables" below)
cp .env.example .env

# 3. Push the Prisma schema to your Supabase Postgres database
npm run db:push

# 4. Run the dev server
npm run dev   # http://localhost:3000

# 5. Lint
npm run lint
```

You need a Supabase project (free tier is fine) before step 2 — see the full
[Deployment](#deployment-vercel--supabase--resend) walkthrough below, which
covers creating the project, the storage buckets, and getting every key you
need.

---

## Project structure

```
prisma/
  schema.prisma              # Bill, BillHistory, ReportLog, AppSetting models
  db/                        # SQLite database file (auto-created)

public/
  manifest.json              # PWA manifest
  sw.js                      # Service worker (network-first for API)
  icons/
    icon-192.png             # PWA icon 192x192
    icon-512.png             # PWA icon 512x512

# Uploaded files live in Supabase Storage, not on disk, under these buckets:
#   bill-documents/  YYYY/MM/BILL-YYYY-NNNNN/document.<ext>
#   signatures/      YYYY/MM/BILL-YYYY-NNNNN/BILL-YYYY-NNNNN-receiving-signature.png
#   reports/         YYYY/weekly/Weekly_Bill_Report_YYYY-MM-DD.xlsx

src/
  app/
    layout.tsx               # Root layout (metadata, viewport, toaster)
    page.tsx                 # SPA container — view switcher + TanStack Query provider
    api/                     # All backend APIs (see below)
  components/
    layout/
      navigation.tsx         # Sidebar (desktop) + BottomNav (mobile) + MobileHeader
      service-worker-register.tsx
    signature/
      signature-pad.tsx      # Digital signature canvas (touch + mouse, undo/clear)
    views/
      dashboard-view.tsx
      new-bill-view.tsx       # Form + upload
      bill-review-view.tsx    # Review & submit
      acknowledgment-view.tsx # Receiver name + signature pad
      success-view.tsx
      existing-bills-view.tsx # Search/filter/sort/pagination
      bill-details-view.tsx   # Full bill + audit trail + signature
      reports-view.tsx
      settings-view.tsx
    ui/                      # shadcn/ui components (preinstalled)
  lib/
    db.ts                    # Prisma client singleton
    types.ts                 # Shared types
    format.ts                # INR / date / file helpers
    nav-store.ts             # Zustand navigation store
    bill-draft-store.ts      # Zustand persisted bill draft
    api.ts                   # Frontend API client
    bill-id.ts               # Server-side BILL-YYYY-NNNNN generator
    storage.ts               # Supabase Storage upload/delete helpers
    bill-mappers.ts          # Prisma ↔ API mappers, audit history helpers
    validation.ts            # Zod schemas
    excel.ts                 # SheetJS workbook builders
    pdf.ts                   # jsPDF builder for a single bill

vercel.json                  # Cron config (Sunday 18:00 IST = 12:30 UTC)
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in your Supabase project's values:

```bash
# Database (Supabase Postgres — from Project Settings → Database)
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-xx.pooler.supabase.com:5432/postgres"

# Supabase Storage (from Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Company configuration
COMPANY_NAME="Munjal Kiriu Industries"
COMPANY_CURRENCY=INR

# Email automation (Resend). Leave blank — email will be stubbed (saved but not sent).
RESEND_API_KEY=
REPORT_EMAIL_TO=accounts@company.com,mgmt@company.com
REPORT_EMAIL_CC=finance@company.com
REPORT_FROM_EMAIL=bills@company.com

# Cron protection secret (any long random string)
CRON_SECRET=change-this-to-a-long-random-secret
```

> **Never commit `.env`.** It's already git-ignored. `SUPABASE_SERVICE_ROLE_KEY` is a server-only secret — it bypasses Row Level Security, so it must only ever be read on the server (which is exactly how `src/lib/storage.ts` uses it) and must never be exposed with a `NEXT_PUBLIC_` prefix or shipped to the browser.

---

## API reference

All APIs live under `/api/` and use JSON for requests/responses (except Excel/PDF which stream binary files).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard/stats` | Dashboard summary cards + recent bills |
| GET | `/api/bills` | List bills (paginated, searchable, filterable, sortable) |
| POST | `/api/bills` | Create a bill (with optional base64 document) |
| GET | `/api/bills/[id]` | Get a single bill + its audit history |
| DELETE | `/api/bills/[id]` | Soft-delete a bill (status → CANCELLED) |
| POST | `/api/bills/[id]/receipt` | Confirm receipt: validates receiver name + signature, saves signature PNG, sets `received_at`, status → RECEIVED |
| GET | `/api/reports` | Aggregated weekly/monthly/yearly + company/department summaries |
| POST | `/api/reports/weekly` | Generate & (optionally) email the weekly Excel report. Protected by `CRON_SECRET`. `?test=true` + `?secret=` for manual testing. |
| GET | `/api/settings` | Get app settings (creates default row if missing) |
| PUT | `/api/settings` | Update settings |
| GET | `/api/export/excel?scope=all|week|month|year|filtered|custom` | Download an `.xlsx` workbook |
| GET | `/api/export/pdf?billId=<db-id>` | Download a single-bill PDF |

### Request bodies

**POST `/api/bills`**
```json
{
  "payload": {
    "submissionDate": "2026-09-08",
    "companyName": "ABC Technologies",
    "billNumber": "FY26-27/1203",
    "billDate": "2026-08-31",
    "basicAmount": 50000,
    "submittedBy": "Mithun",
    "department": "IT",
    "description": "Software service bill"
  },
  "document": {
    "dataUrl": "data:image/jpeg;base64,...",
    "mime": "image/jpeg",
    "name": "bill.jpg"
  }
}
```

**POST `/api/bills/[id]/receipt`**
```json
{
  "receiverName": "Store Incharge",
  "signatureType": "DIGITAL",
  "signatureData": "data:image/png;base64,..."
}
```

---

## Database schema

See `prisma/schema.prisma` for the authoritative schema. Four models:

- **Bill** — one row per submitted bill. Amounts stored as **integer paise** (no float drift); converted to rupees in the API layer.
- **BillHistory** — audit trail. One row per action (CREATED, DOCUMENT_UPLOADED, SIGNATURE_CAPTURED, RECEIPT_CONFIRMED, STATUS_CHANGED, DELETED, etc.).
- **ReportLog** — generated reports. Unique on `(reportType, periodStart, periodEnd)` to prevent duplicate weekly emails.
- **AppSetting** — single-row table (`id = "default"`) for company profile, recipients, and weekly schedule.

Indexes on: `billId`, `submissionDate`, `companyName`, `billNumber`, `submittedBy`, `receiverName`, `status`, `createdAt`.

---

## Security model

Because the application has **no login**, all sensitive operations happen through server-side API routes that use the service role / privileged DB access. The browser only ever talks to `/api/*`.

- Server-side validation with **Zod** on every API body.
- File uploads: MIME type + extension allowlist (JPG/PNG/PDF), max 10 MB, client-side image compression.
- Text inputs are length-capped.
- All Prisma queries are parameterized (no raw SQL, no SQL injection surface).
- The `CRON_SECRET` protects `/api/reports/weekly` — both `?test=true` (with secret) and the Vercel Cron header must match.
- Deleted bills are soft-deleted (`deleted_at` set); records preserved for audit.
- The Resend API key and `CRON_SECRET` are **server-only** environment variables and never exposed to the client.
- Rate limiting: a basic in-memory rate limiter can be added per route if abuse is observed in production. (Not enabled in the sandbox.)

The browser never talks to Supabase directly — the app connects to Postgres only from server-side API routes (via `DATABASE_URL`) and uses the `SUPABASE_SERVICE_ROLE_KEY` only in server code for Storage uploads. Because of this, you don't strictly need Row Level Security policies for this app to function (Postgres itself isn't reachable from the browser). If you want defense-in-depth, you can still enable RLS on each table in the Supabase dashboard (**Authentication** → **Policies**) with no public policies — that blocks any access from Supabase's REST/client API, while your server's direct Postgres connection is unaffected.

---

## Weekly automated report & email

The weekly report runs every Sunday at 18:00 IST (configured in `vercel.json` as `30 12 * * 0` UTC).

1. Calculate the most recent completed **Monday → Sunday** week in IST.
2. Query all bills for that period.
3. Build an Excel workbook with three sheets: `Weekly Bills`, `Summary`, `Company Summary`.
4. Save the workbook to storage under `reports/{year}/weekly/Weekly_Bill_Report_{periodEnd}.xlsx`.
5. Send an email via **Resend** to `REPORT_EMAIL_TO` (CC: `REPORT_EMAIL_CC`), from `REPORT_FROM_EMAIL`, with the Excel attached.
6. Insert / update a row in `report_logs`. If `email_sent` is already `true` for this period, the endpoint returns early — **duplicate sends are prevented**.
7. If email fails (e.g. Resend key missing), the report is still saved, `email_sent = false`, and the error is recorded in `email_error` for retry.

**Manual testing** (no need to wait for Sunday):

```bash
curl -X POST "https://your-domain.com/api/reports/weekly?test=true&secret=$CRON_SECRET"
```

The "Generate & Send Now" button on the Reports page does the same from the UI.

---

## PWA support

- `public/manifest.json` — app name, short name, icons, theme color, standalone display.
- `public/sw.js` — service worker: caches the app shell, network-first for API and `_next/data`, cache-first for static assets.
- `src/components/layout/service-worker-register.tsx` — registers the SW in production only (to avoid dev-caching surprises).
- Viewport meta tag in `src/app/layout.tsx` with `viewport-fit=cover` for safe-area-aware layout.
- Mobile bottom navigation respects `env(safe-area-inset-bottom)`.

To install on a phone: open the URL → browser "Add to Home Screen" → use like a native app.

---

## Deployment (Vercel + Supabase + Resend)

This walks through the whole process from zero, assuming no prior Supabase/Vercel experience.

### Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up / log in → **New Project**.
2. Pick an organization, name it (e.g. `mki-bill-portal`), set a **database password** (save it somewhere — you'll need it in a minute), pick the region closest to you, and click **Create new project**. Wait ~2 minutes for it to provision.

### Step 2 — Get your database connection strings

1. In the Supabase dashboard: **Project Settings** (gear icon) → **Database**.
2. Scroll to **Connection string**. You need two of them:
   - **Transaction pooler** (port `6543`) → this is your `DATABASE_URL`. Add `?pgbouncer=true` to the end if it isn't already there.
   - **Session pooler** or **Direct connection** (port `5432`) → this is your `DIRECT_URL`.
3. Both strings contain `[YOUR-PASSWORD]` — replace that with the database password you set in Step 1.

### Step 3 — Get your API keys

1. **Project Settings** → **API**.
2. Copy the **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **`service_role` secret key** (not the `anon` key) → this is `SUPABASE_SERVICE_ROLE_KEY`. Keep this one private — it has full admin access to your project.

### Step 4 — Create the storage buckets

1. In the Supabase dashboard sidebar: **Storage** → **New bucket**.
2. Create three buckets, and for each one **toggle "Public bucket" ON** (so the app can show bill photos and signatures directly, and so exported PDFs can embed them):
   - `bill-documents`
   - `signatures`
   - `reports`

### Step 5 — Create the database tables

You have two options — pick whichever is easier for you:

- **Option A (recommended, from your own computer):**
  ```bash
  npm install
  cp .env.example .env
  # paste in the values from Steps 2 and 3
  npm run db:push
  ```
  This reads `prisma/schema.prisma` and creates all four tables (`Bill`, `BillHistory`, `ReportLog`, `AppSetting`) in your Supabase database automatically.

- **Option B (no local setup):** open the Supabase **SQL Editor** and run a hand-written `CREATE TABLE` script matching `prisma/schema.prisma`. This is more error-prone — Option A is strongly preferred if you can install Node.js locally.

### Step 6 — (Optional) Resend for the weekly email report

The app works fully without this — reports just won't be emailed automatically.

1. Go to [resend.com](https://resend.com) → sign up.
2. **Domains** → add and verify your sending domain (or use their test domain while trying things out).
3. **API Keys** → create one → this is `RESEND_API_KEY`.

### Step 7 — Push the code to GitHub

1. Create a new empty repository on [github.com](https://github.com/new).
2. From inside the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

### Step 8 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up / log in with GitHub.
2. **Add New...** → **Project** → select the repo you just pushed → **Import**.
3. Before clicking Deploy, open **Environment Variables** and add every value from your `.env` file:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | from Step 2 |
   | `DIRECT_URL` | from Step 2 |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 3 |
   | `COMPANY_NAME` | e.g. `Munjal Kiriu Industries` |
   | `COMPANY_CURRENCY` | `INR` |
   | `RESEND_API_KEY` | from Step 6 (or leave blank) |
   | `REPORT_EMAIL_TO` | e.g. `accounts@yourcompany.com` |
   | `REPORT_EMAIL_CC` | optional |
   | `REPORT_FROM_EMAIL` | e.g. `bills@yourcompany.com` |
   | `CRON_SECRET` | any long random string you make up |

4. Click **Deploy**. Vercel will run `npm install`, generate the Prisma client, and build the app. This takes 1–3 minutes.
5. Once it's live, open the URL Vercel gives you (e.g. `mki-bill-portal.vercel.app`).

Vercel Cron is already configured in `vercel.json` to run the weekly report every Sunday at 18:00 IST — no extra setup needed on a paid Vercel plan. (Vercel's free Hobby plan only supports one cron run per day, so the schedule may need adjusting for a free account — see Vercel's Cron docs if that applies to you.)

### Step 9 — Test it end to end

New Bill → Review & Submit → Acknowledge Receipt (signature) → Success → View Bill → Download PDF → Export Excel → Trigger weekly report (Reports page → "Generate & Send Now").

### Updating the app later

Any time you want to ship a change: edit the code, `git push`, and Vercel redeploys automatically. If you changed `prisma/schema.prisma`, also run `npm run db:push` (from your computer, pointed at the same `DATABASE_URL`) so Supabase's tables match.

---

## Testing checklist

- [ ] Dashboard loads with summary cards
- [ ] New Bill form loads with all required fields
- [ ] Required field validation triggers
- [ ] Camera capture works on mobile
- [ ] File upload (image/PDF) works
- [ ] Image compression kicks in for large images
- [ ] Review screen shows all entered details
- [ ] Bill is created on submit (status = SUBMITTED)
- [ ] Bill ID is generated as BILL-YYYY-NNNNN
- [ ] Acknowledgment screen appears
- [ ] Receiver name is required
- [ ] Signature is required
- [ ] Finger signature works on touch devices
- [ ] Mouse signature works on desktop
- [ ] Clear signature works
- [ ] Undo works (last stroke)
- [ ] Upload-signature fallback works
- [ ] Confirm Receipt saves signature to storage
- [ ] Received timestamp is captured server-side
- [ ] Status changes to RECEIVED
- [ ] Success screen shows bill ID and receiver
- [ ] Existing Bills loads (table on desktop, cards on mobile)
- [ ] Search works (Bill ID, Company, etc.)
- [ ] Filters work (status, department, date range, amount range)
- [ ] Sort works (newest/oldest/amount)
- [ ] Pagination works (25/50/100)
- [ ] Bill Details shows full info + signature + audit trail
- [ ] PDF download works for a single bill
- [ ] Excel export works (All/Week/Month/Year/Filtered)
- [ ] Reports page shows weekly/monthly/yearly summaries
- [ ] Company-wise and department-wise tables render
- [ ] Weekly report can be triggered manually (test mode)
- [ ] Weekly report is idempotent (no duplicate sends)
- [ ] Settings page can save company profile and recipients
- [ ] Footer sticks to bottom on short pages
- [ ] Footer is pushed down on long pages (no overlap)
- [ ] Bottom nav works on mobile
- [ ] Sidebar works on desktop
- [ ] PWA installs on mobile (Add to Home Screen)
- [ ] No raw stack traces shown to users (friendly error messages)

---

## Future Android/Play Store packaging

The first version is a PWA. To package it later as an Android APK/AAB:

1. Install [Capacitor](https://capacitorjs.com/):
   ```bash
   bun add @capacitor/core @capacitor/cli
   bunx cap init "Digital Bills" com.company.digitalbills --web-dir=out
   bun add @capacitor/android
   bunx cap add android
   ```
2. Build the Next.js app and copy the static export into the Android project:
   ```bash
   bun run build
   bunx cap copy android
   bunx cap open android
   ```
3. In Android Studio, build a signed APK or AAB and upload to Google Play.

No changes to the application code are required — Capacitor wraps the same PWA assets.
