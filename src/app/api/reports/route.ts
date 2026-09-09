// GET /api/reports - aggregated weekly/monthly/yearly summaries, plus company- and department-wise breakdowns.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paiseToRupees, currentWeekRange, previousWeekRange } from '@/lib/format';

export const runtime = 'nodejs';

interface SummaryInput {
  start: string;
  end: string;
}

async function summaryFor({ start, end }: SummaryInput) {
  const count = await db.bill.count({
    where: { deletedAt: null, submissionDate: { gte: start, lte: end } },
  });
  const agg = await db.bill.aggregate({
    where: { deletedAt: null, submissionDate: { gte: start, lte: end } },
    _sum: { basicAmount: true },
  });
  const total = agg._sum.basicAmount ?? 0;
  return {
    periodStart: start,
    periodEnd: end,
    totalBills: count,
    totalAmount: paiseToRupees(total),
    averageAmount: count > 0 ? paiseToRupees(Math.round(total / count)) : 0,
  };
}

export async function GET() {
  try {
    // Weekly: use the most recent completed week (Mon-Sun) for the report header.
    // For the dashboard's "this week" we use currentWeekRange; here we show the most recent
    // complete week's data so the report is stable. (UI shows the range either way.)
    const week = previousWeekRange();
    const weekly = await summaryFor(week);

    // Monthly: current month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
    const monthly = await summaryFor({ start: monthStart, end: monthEnd });

    // Yearly: current year
    const yearStart = `${now.getFullYear()}-01-01`;
    const yearEnd = `${now.getFullYear()}-12-31`;
    const yearly = await summaryFor({ start: yearStart, end: yearEnd });

    // Company-wise: all-time group by company
    const allBills = await db.bill.findMany({
      where: { deletedAt: null },
      select: { companyName: true, basicAmount: true, department: true },
    });
    const companyMap = new Map<string, { count: number; totalPaise: number }>();
    const deptMap = new Map<string, { count: number; totalPaise: number }>();
    for (const b of allBills) {
      const c = companyMap.get(b.companyName) ?? { count: 0, totalPaise: 0 };
      c.count++;
      c.totalPaise += b.basicAmount;
      companyMap.set(b.companyName, c);
      const dKey = b.department || 'Unspecified';
      const d = deptMap.get(dKey) ?? { count: 0, totalPaise: 0 };
      d.count++;
      d.totalPaise += b.basicAmount;
      deptMap.set(dKey, d);
    }

    const companyWise = Array.from(companyMap.entries())
      .map(([companyName, v]) => ({
        companyName,
        billCount: v.count,
        totalAmount: paiseToRupees(v.totalPaise),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const departmentWise = Array.from(deptMap.entries())
      .map(([department, v]) => ({
        department,
        billCount: v.count,
        totalAmount: paiseToRupees(v.totalPaise),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({
      weekly,
      monthly,
      yearly,
      companyWise,
      departmentWise,
    });
  } catch (err) {
    console.error('[GET /api/reports]', err);
    return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 });
  }
}

// Also export currentWeekRange for any consumers via this module (no-op).
export { currentWeekRange };
