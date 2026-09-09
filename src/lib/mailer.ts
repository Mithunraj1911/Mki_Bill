// Sends email via a directly-configured SMTP server (e.g. Office 365, Gmail, or any
// company mail server) using settings stored in the AppSetting table — configured from
// the Settings page in the app, not environment variables.

import nodemailer from 'nodemailer';

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

/** Basic validation so we fail fast with a clear message instead of a cryptic SMTP error. */
export function validateSmtpConfig(cfg: SmtpConfig): string | null {
  if (!cfg.smtpHost.trim()) return 'SMTP Host is required.';
  if (!cfg.smtpPort || cfg.smtpPort <= 0 || cfg.smtpPort > 65535) return 'SMTP Port is invalid.';
  if (!cfg.smtpUser.trim()) return 'SMTP User is required.';
  if (!cfg.smtpPassword.trim()) return 'SMTP Password is required.';
  if (!cfg.fromEmail.trim()) return 'From Email is required.';
  return null;
}

function buildTransport(cfg: SmtpConfig) {
  // Port 465 = implicit TLS. Port 587/25 = STARTTLS (secure: false, then upgraded).
  const secure = cfg.smtpPort === 465;
  return nodemailer.createTransport({
    host: cfg.smtpHost.trim(),
    port: cfg.smtpPort,
    secure,
    auth: {
      user: cfg.smtpUser.trim(),
      pass: cfg.smtpPassword,
    },
  });
}

/** Verify the SMTP connection/credentials without sending anything. */
export async function verifySmtpConnection(cfg: SmtpConfig): Promise<void> {
  const transporter = buildTransport(cfg);
  await transporter.verify();
}

/** Send an email through the configured SMTP server. */
export async function sendMail(cfg: SmtpConfig, opts: SendMailOptions): Promise<void> {
  const transporter = buildTransport(cfg);
  await transporter.sendMail({
    from: cfg.fromEmail.trim(),
    to: opts.to,
    cc: opts.cc && opts.cc.length > 0 ? opts.cc : undefined,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}
