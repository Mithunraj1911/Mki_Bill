// GET /api/export/excel - export bills as an .xlsx file.
// Query params:
//   scope: 'all' | 'week' | 'month' | 'year' | 'filtered' | 'custom'
//   dateFrom, dateTo (for 'custom' or 'week'/'month'/'year' overrides)
//   search, status, department, company, amountMin, amountMax (for 'filtered')

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildBillsWorkbook, workbookToBuffer, addSummarySheet, addCompanySummarySheet, addDepartmentSummarySheet } from '@/lib/excel';
import { paiseToRupees, currentWeekRange, previousWeekRange, formatDateDMYFromISO } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'all';
    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status') || 'ALL';
    const department = url.searchParams.get('department') || 'ALL';
    const company = url.searchParams.get('company')?.trim() || '';
    const amountMin = url.searchParams.get('amountMin');
    const amountMax = url.searchParams.get('amountMax');

     
    const where: any = { deletedAt: null };

    let periodStart = '';
    let periodEnd = '';

    if (scope === 'week') {
      // Most recent complete week (Mon-Sun)
      const r = previousWeekRange();
      where.submissionDate = { gte: r.start, lte: r.end };
      periodStart = r.start;
      periodEnd = r.end;
    } else if (scope === 'month') {
      const now = new Date();
      const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const me = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
      where.submissionDate = { gte: ms, lte: me };
      periodStart = ms;
      periodEnd = me;
    } else if (scope === 'year') {
      const yr = new Date().getFullYear();
      where.submissionDate = { gte: `${yr}-01-01`, lte: `${yr}-12-31` };
      periodStart = `${yr}-01-01`;
      periodEnd = `${yr}-12-31`;
    } else if (scope === 'custom' || scope === 'filtered') {
      const dateFrom = url.searchParams.get('dateFrom')?.trim() || '';
      const dateTo = url.searchParams.get('dateTo')?.trim() || '';
      if (dateFrom || dateTo) {
         
        const cond: any = {};
        if (dateFrom) cond.gte = dateFrom;
        if (dateTo) cond.lte = dateTo;
        where.submissionDate = cond;
        periodStart = dateFrom;
        periodEnd = dateTo;
      }
    }

    if (status !== 'ALL') where.status = status;
    if (department !== 'ALL') where.department = department;
    if (company) where.companyName = { contains: company };
    if (amountMin != null || amountMax != null) {
       
      const cond: any = {};
      if (amountMin != null) cond.gte = Math.round(parseFloat(amountMin) * 100);
      if (amountMax != null) cond.lte = Math.round(parseFloat(amountMax) * 100);
      where.basicAmount = cond;
    }
    if (search) {
      where.OR = [
        { billId: { contains: search } },
        { companyName: { contains: search } },
        { billNumber: { contains: search } },
        { submittedBy: { contains: search } },
        { receiverName: { contains: search } },
      ];
    }

    const rows = await db.bill.findMany({ where, orderBy: { submissionDate: 'desc' } });
     
    const billsApi = rows.map((b: any) => ({
      ...b,
      basicAmount: paiseToRupees(b.basicAmount),
      receivedAt: b.receivedAt ? b.receivedAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      signatureType: b.signatureType,
      status: b.status,
    }));

    const wb = buildBillsWorkbook(billsApi, { sheetName: 'Bills', includeTotals: true });

    // Add summary sheet
    const totalAmount = billsApi.reduce((s: number, b: { basicAmount: number }) => s + b.basicAmount, 0);
    const totalBills = billsApi.length;
    addSummarySheet(wb, {
      reportPeriod: periodStart && periodEnd ? `${formatDateDMYFromISO(periodStart)} to ${formatDateDMYFromISO(periodEnd)}` : 'All bills',
      totalBills,
      totalAmount,
      averageBillAmount: totalBills > 0 ? totalAmount / totalBills : 0,
    });

    // Add company-wise summary
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

    // Add department-wise summary
    const deptMap = new Map<string, { count: number; total: number }>();
    for (const b of billsApi as { department: string | null; basicAmount: number }[]) {
      const key = b.department || 'Unspecified';
      const v = deptMap.get(key) ?? { count: 0, total: 0 };
      v.count++;
      v.total += b.basicAmount;
      deptMap.set(key, v);
    }
    addDepartmentSummarySheet(
      wb,
      Array.from(deptMap.entries()).map(([department, v]) => ({
        department,
        billCount: v.count,
        totalAmount: v.total,
      }))
    );

    const buf = workbookToBuffer(wb);

    let filename = 'Bills.xlsx';
    if (scope === 'week') {
      const r = previousWeekRange();
      filename = `Weekly_Bill_Report_${r.end}.xlsx`;
    } else if (scope === 'month') {
      const now = new Date();
      filename = `Monthly_Bill_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
    } else if (scope === 'year') {
      filename = `Yearly_Bill_Report_${new Date().getFullYear()}.xlsx`;
    } else if (scope === 'custom' && periodStart && periodEnd) {
      filename = `Bills_${periodStart}_to_${periodEnd}.xlsx`;
    } else if (scope === 'filtered') {
      filename = `Bills_filtered.xlsx`;
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/export/excel]', err);
    return NextResponse.json({ error: 'Excel export failed.' }, { status: 500 });
  }
}

// (utility alias for /api/reports/route.ts references)
export { currentWeekRange };
