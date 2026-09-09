// GET  /api/settings - return current app settings (creates default row if missing).
// PUT  /api/settings - update settings.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settingsSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function getOrCreate(): Promise<{
  id: string;
  companyName: string;
  companyAddress: string;
  currency: string;
  reportEmailTo: string;
  reportEmailCc: string;
  weeklyReportDay: string;
  weeklyReportTime: string;
  updatedAt: Date;
}> {
  let row = await db.appSetting.findUnique({ where: { id: 'default' } });
  if (!row) {
    row = await db.appSetting.create({ data: { id: 'default' } });
  }
  return row;
}

export async function GET() {
  try {
    const row = await getOrCreate();
    return NextResponse.json({
      companyName: row.companyName,
      companyAddress: row.companyAddress,
      currency: row.currency,
      reportEmailTo: row.reportEmailTo,
      reportEmailCc: row.reportEmailCc,
      weeklyReportDay: row.weeklyReportDay,
      weeklyReportTime: row.weeklyReportTime,
    });
  } catch (err) {
    console.error('[GET /api/settings]', err);
    return NextResponse.json({ error: 'Unable to load settings.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid settings' },
        { status: 400 }
      );
    }
    await getOrCreate(); // ensure row exists
    const updated = await db.appSetting.update({
      where: { id: 'default' },
      data: parsed.data,
    });
    return NextResponse.json({
      companyName: updated.companyName,
      companyAddress: updated.companyAddress,
      currency: updated.currency,
      reportEmailTo: updated.reportEmailTo,
      reportEmailCc: updated.reportEmailCc,
      weeklyReportDay: updated.weeklyReportDay,
      weeklyReportTime: updated.weeklyReportTime,
    });
  } catch (err) {
    console.error('[PUT /api/settings]', err);
    return NextResponse.json({ error: 'Unable to save settings.' }, { status: 500 });
  }
}
