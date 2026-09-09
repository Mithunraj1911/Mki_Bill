'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, Building2, Mail, CalendarClock, Send } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export function SettingsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync form with query data when it loads (only once per data load)
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.updateSettings(form);
      toast.success('Settings saved.');
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) {
      toast.error('Unable to save settings.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  async function sendTest() {
    if (!form) return;
    if (!testEmailAddr.trim()) {
      toast.error('Enter an email address to send the test to.');
      return;
    }
    setSendingTest(true);
    try {
      await api.sendTestEmail({
        to: testEmailAddr.trim(),
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpUser: form.smtpUser,
        smtpPassword: form.smtpPassword,
        fromEmail: form.fromEmail,
      });
      toast.success('Test email sent.', { description: `Check ${testEmailAddr.trim()}` });
    } catch (e) {
      toast.error('Unable to send test email.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSendingTest(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="max-w-2xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading settings...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl w-full mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Company profile, report recipients, and weekly report schedule.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Company Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Company Name">
            <Input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              maxLength={200}
            />
          </Field>
          <Field label="Company Address">
            <Textarea
              rows={2}
              value={form.companyAddress}
              onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
              maxLength={500}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              maxLength={10}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Alerts (SMTP)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-enabled" className="text-sm font-medium">Enabled</Label>
              <Switch
                id="smtp-enabled"
                checked={form.smtpEnabled}
                onCheckedChange={(v) => setForm({ ...form, smtpEnabled: v })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Optional. In-app alerts always work. SMTP config is validated before saving.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP Host">
              <Input
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.office365.com"
              />
            </Field>
            <Field label="SMTP Port">
              <Input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value, 10) || 0 })}
                placeholder="587"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP User">
              <Input
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                placeholder="scan@company.com"
              />
            </Field>
            <Field label="SMTP Password">
              <Input
                type="password"
                value={form.smtpPassword}
                onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Email">
              <Input
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="scan@company.com"
              />
            </Field>
            <Field label="To Email (comma-separated)">
              <Input
                value={form.reportEmailTo}
                onChange={(e) => setForm({ ...form, reportEmailTo: e.target.value })}
                placeholder="accounts@company.com, mgmt@company.com"
              />
            </Field>
          </div>
          <Field label="CC Email (optional, comma-separated)">
            <Input
              value={form.reportEmailCc}
              onChange={(e) => setForm({ ...form, reportEmailCc: e.target.value })}
              placeholder="finance@company.com"
            />
          </Field>

          <div className="border-t pt-4 space-y-2">
            <Label className="text-sm font-medium">Send a test email to verify your SMTP configuration</Label>
            <div className="flex gap-2">
              <Input
                value={testEmailAddr}
                onChange={(e) => setTestEmailAddr(e.target.value)}
                placeholder="your@email.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void sendTest()}
                disabled={sendingTest}
                className="gap-2 shrink-0"
              >
                {sendingTest ? (
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test Email
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Weekly Report Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weekly Report Day">
              <Select
                value={form.weeklyReportDay}
                onValueChange={(v) => setForm({ ...form, weeklyReportDay: v })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Weekly Report Time">
              <Select
                value={form.weeklyReportTime}
                onValueChange={(v) => setForm({ ...form, weeklyReportTime: v })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: Every Sunday at 18:00 (6:00 PM IST). Configure the Vercel Cron job separately to match this schedule.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3 sticky bottom-20 md:bottom-4 bg-background pt-2">
        <Button variant="outline" onClick={() => setForm(data)} className="flex-1 h-12" disabled={saving}>
          Reset
        </Button>
        <Button onClick={() => void save()} disabled={saving} className="flex-1 h-12 gap-2">
          {saving ? (
            <>
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
