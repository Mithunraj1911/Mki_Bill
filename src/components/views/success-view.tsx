'use client';

import { useNav } from '@/lib/nav-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Eye, Plus, LayoutDashboard } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export function SuccessView() {
  const go = useNav((s) => s.go);
  const openBill = useNav((s) => s.openBill);
  const billId = useNav((s) => s.lastConfirmedBillId);
  const billDbId = useNav((s) => s.lastConfirmedBillDbId);
  const receiverName = useNav((s) => s.lastConfirmedReceiverName);
  const receivedAt = useNav((s) => s.lastConfirmedReceivedAt);

  return (
    <div className="max-w-2xl w-full mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              Bill Received Successfully
            </h1>
            <p className="text-sm text-muted-foreground mt-1">The receipt has been recorded with the digital signature.</p>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Bill ID</span>
              <span className="font-mono font-semibold">{billId ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Received By</span>
              <span className="font-medium">{receiverName ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Received At</span>
              <span className="font-medium">{receivedAt ? formatDateTime(receivedAt) : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Status</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ RECEIVED</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Button variant="outline" onClick={() => (billDbId ? openBill(billDbId) : go('existing-bills'))} className="h-12 gap-2">
              <Eye className="h-4 w-4" /> View Bill
            </Button>
            <Button variant="outline" onClick={() => go('new-bill')} className="h-12 gap-2">
              <Plus className="h-4 w-4" /> New Bill
            </Button>
            <Button onClick={() => go('dashboard')} className="h-12 gap-2">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
