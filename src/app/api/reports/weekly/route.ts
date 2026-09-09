// POST /api/reports/weekly - generate the weekly Excel report, optionally email it via
// the SMTP settings configured on the Settings page.
//
// Protect via CRON_SECRET header (or ?test=true with a dev secret).
// Idempotent: will not regenerate or resend if report_logs shows an already-sent entry for the period.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildBillsWorkbook, workbookToBuffer, addSummarySheet, addCompanySummarySheet } from '@/lib/excel';
import { saveBuffer, reportNestedPath } from '@/lib/storage';
import { paiseToRupees, previousWeekRange, formatDateDMYFromISO } from '@/lib/format';
import { sendMail, validateSmtpConfig, type SmtpConfig } from '@/lib/mailer';

export const runtime = 'nodejs';

interface WeeklyReportResult {
  success: boolean;
  message: string;
  periodStart: string;
  periodEnd: string;
  totalBills: number;
  totalAmount: number;
  emailSent: boolean;
  emailError?: string;
  filePath?: string;
  alreadySent?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // Authorization: CRON_SECRET via header or ?secret=, OR ?test=true with dev CRON_SECRET
    const url = new URL(req.url);
    const isTest = url.searchParams.get('test') === 'true';
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers.get('x-cron-secret') || url.searchParams.get('secret');

    if (isTest) {
      if (!cronSecret || headerSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized (test mode requires secret)' }, { status: 401 });
      }
    } else {
      if (!headerSecret || headerSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const week = previousWeekRange();

    // Idempotency: check if already sent
    const existing = await db.reportLog.findUnique({
      where: {
        reportType_periodStart_periodEnd: {
          reportType: 'weekly',
          periodStart: week.start,
          periodEnd: week.end,
        },
      },
    });
    if (existing && existing.emailSent) {
      const result: WeeklyReportResult = {
        success: true,
        message: 'Weekly report already sent for this period.',
        periodStart: week.start,
        periodEnd: week.end,
        totalBills: existing.totalBills,
        totalAmount: paiseToRupees(existing.totalAmount),
        emailSent: true,
        filePath: existing.filePath ?? undefined,
        alreadySent: true,
      };
      return NextResponse.json(result);
    }

    // Fetch bills for the week (Mon-Sun, IST local tz)
    const rows = await db.bill.findMany({
      where: { deletedAt: null, submissionDate: { gte: week.start, lte: week.end } },
      orderBy: { submissionDate: 'asc' },
    });
     
    const billsApi: any[] = rows.map((b) => ({
      ...b,
      basicAmount: paiseToRupees(b.basicAmount),
      receivedAt: b.receivedAt ? b.receivedAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    const totalBills = billsApi.length;
    const totalAmountPaise = rows.reduce((s, b) => s + b.basicAmount, 0);
    const totalAmount = paiseToRupees(totalAmountPaise);
    const averageAmount = totalBills > 0 ? totalAmount / totalBills : 0;

    // Build workbook with 3 sheets: Weekly Bills, Summary, Company Summary
    const wb = buildBillsWorkbook(billsApi, { sheetName: 'Weekly Bills', includeTotals: true });
    addSummarySheet(wb, {
      reportPeriod: `${formatDateDMYFromISO(week.start)} to ${formatDateDMYFromISO(week.end)}`,
      totalBills,
      totalAmount,
      averageBillAmount: averageAmount,
    });
    const companyMap = new Map<string, { count: number; total: number }>();
    for (const b of billsApi as { companyName: string; basicAmount: number }[]) {
      const v = companyMap.get(b.companyName) ?? { count: 0, total: 0 };
      v.count++;
      v.total += b.basicAmount;
      companyMap.set(b.companyName, v);
    }
    addCompanySummarySheet(
      wb,
      Array.from(companyMap.entries()).map(([companyName, v]) => ({
        companyName,
        billCount: v.count,
        totalAmount: v.total,
      }))
    );

    const buf = workbookToBuffer(wb);

    // Save the file under public/uploads/reports/{year}/weekly
    const filename = `Weekly_Bill_Report_${week.end}.xlsx`;
    const nested = reportNestedPath(week.end);
    const saved = await saveBuffer('reports', nested, filename, buf);

    // Try to send email via the SMTP settings configured on the Settings page
    let emailSent = false;
    let emailError: string | undefined;
    const settings = await db.appSetting.findUnique({ where: { id: 'default' } });
    const emailTo = settings?.reportEmailTo || '';
    const emailCc = settings?.reportEmailCc || '';

    if (settings?.smtpEnabled && emailTo) {
      try {
        const emailResult = await sendWeeklyEmail({
          to: emailTo,
          cc: emailCc || undefined,
          periodStart: week.start,
          periodEnd: week.end,
          totalBills,
          totalAmount,
          attachmentBuffer: buf,
          attachmentFilename: filename,
          smtp: {
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPassword: settings.smtpPassword,
            fromEmail: settings.fromEmail,
          },
        });
        emailSent = emailResult.success;
        if (!emailResult.success) emailError = emailResult.error;
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Unknown email error';
      }
    } else if (!settings?.smtpEnabled) {
      emailError = 'Email Alerts (SMTP) is turned off in Settings. Report saved but not emailed.';
    } else {
      emailError = 'No report recipient configured in Settings (Report Email To). Report saved but not emailed.';
    }

    // Log the report
    if (existing) {
      await db.reportLog.update({
        where: { id: existing.id },
        data: {
          filePath: saved.publicUrl,
          totalBills,
          totalAmount: totalAmountPaise,
          emailSent,
          emailError: emailError ?? null,
          sentAt: emailSent ? new Date() : null,
        },
      });
    } else {
      await db.reportLog.create({
        data: {
          reportType: 'weekly',
          periodStart: week.start,
          periodEnd: week.end,
          filePath: saved.publicUrl,
          totalBills,
          totalAmount: totalAmountPaise,
          emailSent,
          emailError: emailError ?? null,
          sentAt: emailSent ? new Date() : null,
        },
      });
    }

    const result: WeeklyReportResult = {
      success: true,
      message: emailSent
        ? 'Weekly report generated and emailed.'
        : 'Weekly report generated but email not sent (see emailError).',
      periodStart: week.start,
      periodEnd: week.end,
      totalBills,
      totalAmount,
      emailSent,
      emailError,
      filePath: saved.publicUrl,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/reports/weekly]', err);
    return NextResponse.json({ error: 'Weekly report generation failed.' }, { status: 500 });
  }
}

/// Send the weekly email via the configured SMTP server.
async function sendWeeklyEmail(opts: {
  to: string;
  cc?: string;
  periodStart: string;
  periodEnd: string;
  totalBills: number;
  totalAmount: number;
  attachmentBuffer: Buffer;
  attachmentFilename: string;
  smtp: SmtpConfig;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, cc, periodStart, periodEnd, totalBills, totalAmount, attachmentBuffer, attachmentFilename, smtp } = opts;

    const validationError = validateSmtpConfig(smtp);
    if (validationError) return { success: false, error: validationError };

    const subject = `Weekly Digital Bill Submission Report - ${formatDateDMYFromISO(periodStart)} to ${formatDateDMYFromISO(periodEnd)}`;
    const html = `<p>Dear Team,</p>
<p>Please find attached the weekly Digital Bill Submission Report.</p>
<p><strong>Report Period:</strong> ${formatDateDMYFromISO(periodStart)} to ${formatDateDMYFromISO(periodEnd)}</p>
<p><strong>Total Bills:</strong> ${totalBills}<br/>
<strong>Total Amount:</strong> ₹${totalAmount.toLocaleString('en-IN')}</p>
<p>The detailed report is attached as an Excel file.</p>
<p>Regards,<br/>Digital Bill Management System</p>`;

    await sendMail(smtp, {
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      subject,
      html,
      attachments: [
        {
          filename: attachmentFilename,
          content: attachmentBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown email error' };
  }
}
