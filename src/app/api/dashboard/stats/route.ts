// GET /api/dashboard/stats - dashboard summary cards and recent bills.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mapBill } from '@/lib/bill-mappers';
import { paiseToRupees, currentWeekRange } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const totalBills = await db.bill.count({ where: { deletedAt: null } });
    const totalPaiseAgg = await db.bill.aggregate({
      where: { deletedAt: null },
      _sum: { basicAmount: true },
    });
    const totalAmount = totalPaiseAgg._sum.basicAmount ?? 0;

    // Current week (Mon-Sun) range
    const week = currentWeekRange();
    const thisWeek = await db.bill.count({
      where: { deletedAt: null, submissionDate: { gte: week.start, lte: week.end } },
    });
    const weekAgg = await db.bill.aggregate({
      where: { deletedAt: null, submissionDate: { gte: week.start, lte: week.end } },
      _sum: { basicAmount: true },
    });
    const weeklyAmount = weekAgg._sum.basicAmount ?? 0;

    // Current month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
    const thisMonth = await db.bill.count({
      where: { deletedAt: null, submissionDate: { gte: monthStart, lte: monthEnd } },
    });
    const monthAgg = await db.bill.aggregate({
      where: { deletedAt: null, submissionDate: { gte: monthStart, lte: monthEnd } },
      _sum: { basicAmount: true },
    });
    const monthlyAmount = monthAgg._sum.basicAmount ?? 0;

    // Recent bills (latest 10)
    const recent = await db.bill.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      totalBills,
      thisWeek,
      thisMonth,
      totalAmount: paiseToRupees(totalAmount),
      weeklyAmount: paiseToRupees(weeklyAmount),
      monthlyAmount: paiseToRupees(monthlyAmount),
      recentBills: recent.map(mapBill),
    });
  } catch (err) {
    console.error('[GET /api/dashboard/stats]', err);
    return NextResponse.json({ error: 'Unable to load dashboard.' }, { status: 500 });
  }
}
