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
import { Save, Building2, Mail, CalendarClock } from 'lucide-react';

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
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Report Email Recipients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Report Email (To)" hint="Comma-separated email addresses (e.g. accounts@company.com, mgmt@company.com)">
            <Input
              value={form.reportEmailTo}
              onChange={(e) => setForm({ ...form, reportEmailTo: e.target.value })}
              placeholder="accounts@company.com, mgmt@company.com"
            />
          </Field>
          <Field label="Report Email (CC)" hint="Comma-separated email addresses (optional)">
            <Input
              value={form.reportEmailCc}
              onChange={(e) => setForm({ ...form, reportEmailCc: e.target.value })}
              placeholder="finance@company.com"
            />
          </Field>
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            Note: Sensitive email configuration (Resend API key, sender email) is set via environment variables and not exposed in the UI.
            Set <code className="font-mono">RESEND_API_KEY</code>, <code className="font-mono">REPORT_FROM_EMAIL</code>, <code className="font-mono">REPORT_EMAIL_TO</code>, <code className="font-mono">REPORT_EMAIL_CC</code>, and <code className="font-mono">CRON_SECRET</code> in your deployment environment.
          </p>
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
