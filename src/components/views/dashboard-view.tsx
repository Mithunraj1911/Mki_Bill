'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Receipt, TrendingUp, CalendarDays, Wallet, IndianRupee, Layers } from 'lucide-react';
import { formatINR, formatDateDMY } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types';

export function DashboardView() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });
  const go = useNav((s) => s.go);
  const openBill = useNav((s) => s.openBill);

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Digital Bill Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Internal bill submission & receipt acknowledgment portal
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load dashboard. {String(error.message)}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Total Bills"
          value={isLoading ? null : String(data?.totalBills ?? 0)}
          icon={<Receipt className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          label="This Week"
          value={isLoading ? null : String(data?.thisWeek ?? 0)}
          icon={<CalendarDays className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          label="This Month"
          value={isLoading ? null : String(data?.thisMonth ?? 0)}
          icon={<CalendarDays className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          label="Total Amount"
          value={isLoading ? null : formatINR(data?.totalAmount ?? 0)}
          icon={<IndianRupee className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          label="Weekly Amount"
          value={isLoading ? null : formatINR(data?.weeklyAmount ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          label="Monthly Amount"
          value={isLoading ? null : formatINR(data?.monthlyAmount ?? 0)}
          icon={<Wallet className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button size="lg" onClick={() => go('new-bill')} className="h-16 md:h-20 text-base md:text-lg gap-2">
          <Plus className="h-5 w-5" /> New Bill
        </Button>
        <Button size="lg" variant="secondary" onClick={() => go('bulk-bill')} className="h-16 md:h-20 text-base md:text-lg gap-2">
          <Layers className="h-5 w-5" /> Bulk Bills
        </Button>
        <Button size="lg" variant="outline" onClick={() => go('existing-bills')} className="h-16 md:h-20 text-base md:text-lg gap-2">
          <FileText className="h-5 w-5" /> Existing Bills
        </Button>
      </div>

      {/* Recent bills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Bills</h2>
          <Button variant="link" className="p-0 h-auto text-sm" onClick={() => go('existing-bills')}>
            View all →
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          ) : data && data.recentBills.length > 0 ? (
            data.recentBills.map((b) => (
              <Card key={b.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openBill(b.id)}>
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{b.billId}</span>
                    <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase tracking-wide', statusBadgeInline(b.status))}>
                      {b.status}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium truncate">{b.companyName}</div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatINR(b.basicAmount)}</span>
                    <span>{formatDateDMY(b.submissionDate)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                No bills submitted yet. Click <span className="font-semibold text-foreground">New Bill</span> to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {loading || value === null ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <div className="text-xl md:text-2xl font-bold tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function statusBadgeInline(status: string): string {
  switch (status) {
    case 'RECEIVED':
      return 'text-emerald-700 border-emerald-300 bg-emerald-50';
    case 'SUBMITTED':
      return 'text-amber-700 border-amber-300 bg-amber-50';
    case 'CANCELLED':
      return 'text-rose-700 border-rose-300 bg-rose-50';
    default:
      return 'text-slate-700 border-slate-300 bg-slate-50';
  }
}
