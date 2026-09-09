// POST /api/settings/test-email - send a one-off test email using the SMTP config
// currently in the Settings form (does not need to be saved first).

import { NextRequest, NextResponse } from 'next/server';
import { testEmailSchema } from '@/lib/validation';
import { sendMail, validateSmtpConfig } from '@/lib/mailer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = testEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }
    const { to, smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail } = parsed.data;
    const cfg = { smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail };

    const validationError = validateSmtpConfig(cfg);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await sendMail(cfg, {
      to: [to],
      subject: 'Test email — MKI Digital Bill Portal',
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
          <p>This is a test email from the <strong>MKI Digital Bill Portal</strong> Settings page.</p>
          <p>If you're reading this, your SMTP configuration (${smtpHost}:${smtpPort}) is working correctly.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/settings/test-email]', err);
    const message = err instanceof Error ? err.message : 'Unable to send test email.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
