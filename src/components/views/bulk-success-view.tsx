'use client';

import { useNav } from '@/lib/nav-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Eye, Layers, LayoutDashboard } from 'lucide-react';
import { formatINR, formatDateTime } from '@/lib/format';

export function BulkSuccessView() {
  const go = useNav((s) => s.go);
  const openBill = useNav((s) => s.openBill);
  const bills = useNav((s) => s.bulkCreatedBills);
  const receiverName = useNav((s) => s.bulkReceiverName);
  const receivedAt = useNav((s) => s.bulkReceivedAt);

  if (bills.length === 0) {
    return (
      <div className="max-w-2xl w-full mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No bulk bills were created.</p>
            <Button onClick={() => go('dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAmount = bills.reduce((s, b) => s + b.basicAmount, 0);

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {bills.length} Bills Received Successfully
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              The entire batch has been acknowledged with a single signature.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Total Bills</span>
              <span className="font-semibold">{bills.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Total Amount</span>
              <span className="font-semibold">{formatINR(totalAmount)}</span>
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
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ RECEIVED (all bills)</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 md:p-4 space-y-2 text-left">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Bills in this batch ({bills.length})
            </p>
            <ul className="divide-y">
              {bills.map((b) => (
                <li key={b.dbId} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{b.billId}</span>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        ✓ Received
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      Bill No: {b.billNumber} · {formatINR(b.basicAmount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openBill(b.dbId)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Button variant="outline" onClick={() => go('existing-bills')} className="h-12 gap-2">
              <Eye className="h-4 w-4" /> View All Bills
            </Button>
            <Button variant="outline" onClick={() => go('bulk-bill')} className="h-12 gap-2">
              <Layers className="h-4 w-4" /> New Bulk Entry
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
