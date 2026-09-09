'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ReportsData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, CalendarDays, Building2, Layers, Send, Sparkles } from 'lucide-react';
import { formatINR, formatDateDMY } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ReportsView() {
  const { data, isLoading, error } = useQuery<ReportsData>({
    queryKey: ['reports'],
    queryFn: api.getReports,
  });
  const [sendingWeekly, setSendingWeekly] = useState(false);

  function downloadReport(scope: 'all' | 'week' | 'month' | 'year' | 'filtered') {
    window.location.href = api.excelExportUrl({ scope });
    toast.success('Generating Excel download...');
  }

  async function sendWeeklyNow() {
    setSendingWeekly(true);
    try {
      const result = await api.triggerWeeklyReport();
      if (result.alreadySent) {
        toast.success(result.message);
      } else if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Unable to trigger weekly report.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSendingWeekly(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-5xl w-full mx-auto space-y-4">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Unable to load reports. {String((error as Error).message)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl w-full mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Summary of bills by period, company, and department.</p>
      </div>

      {/* Period summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          title="Weekly Report"
          subtitle={isLoading ? 'Loading...' : `${formatDateDMY(data?.weekly.periodStart)} to ${formatDateDMY(data?.weekly.periodEnd)}`}
          totalBills={data?.weekly.totalBills}
          totalAmount={data?.weekly.totalAmount}
          average={data?.weekly.averageAmount}
          loading={isLoading}
          icon={<CalendarDays className="h-4 w-4" />}
          onExportExcel={() => downloadReport('week')}
        />
        <SummaryCard
          title="Monthly Report"
          subtitle={isLoading ? 'Loading...' : `${formatDateDMY(data?.monthly.periodStart)} to ${formatDateDMY(data?.monthly.periodEnd)}`}
          totalBills={data?.monthly.totalBills}
          totalAmount={data?.monthly.totalAmount}
          average={data?.monthly.averageAmount}
          loading={isLoading}
          icon={<CalendarDays className="h-4 w-4" />}
          onExportExcel={() => downloadReport('month')}
        />
        <SummaryCard
          title="Yearly Report"
          subtitle={isLoading ? 'Loading...' : `${formatDateDMY(data?.yearly.periodStart)} to ${formatDateDMY(data?.yearly.periodEnd)}`}
          totalBills={data?.yearly.totalBills}
          totalAmount={data?.yearly.totalAmount}
          average={data?.yearly.averageAmount}
          loading={isLoading}
          icon={<CalendarDays className="h-4 w-4" />}
          onExportExcel={() => downloadReport('year')}
        />
      </div>

      {/* Weekly automation card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Weekly Automated Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The weekly report runs automatically every Sunday at 6:00 PM IST. It generates an Excel workbook covering the
            most recent Monday–Sunday and emails it to the configured recipients via Resend.
          </p>
          <p className="text-muted-foreground">
            You can trigger the most recent week&apos;s report manually here for testing. (Requires CRON_SECRET.)
          </p>
          <Button onClick={() => void sendWeeklyNow()} disabled={sendingWeekly} className="gap-1.5">
            {sendingWeekly ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Generating & Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Generate & Send Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Company-wise report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Company-wise Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : data && data.companyWise.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.companyWise.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell className="text-right">{row.billCount}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(row.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{data.companyWise.reduce((s, r) => s + r.billCount, 0)}</TableCell>
                    <TableCell className="text-right">{formatINR(data.companyWise.reduce((s, r) => s + r.totalAmount, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Department-wise report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Department-wise Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : data && data.departmentWise.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.departmentWise.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.department}</TableCell>
                      <TableCell className="text-right">{row.billCount}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(row.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{data.departmentWise.reduce((s, r) => s + r.billCount, 0)}</TableCell>
                    <TableCell className="text-right">{formatINR(data.departmentWise.reduce((s, r) => s + r.totalAmount, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  totalBills,
  totalAmount,
  average,
  loading,
  icon,
  onExportExcel,
}: {
  title: string;
  subtitle: string;
  totalBills?: number;
  totalAmount?: number;
  average?: number;
  loading: boolean;
  icon: React.ReactNode;
  onExportExcel: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 p-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Bills</span>
              <span className="font-semibold">{totalBills ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold">{formatINR(totalAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Average</span>
              <span className="font-semibold">{formatINR(average ?? 0)}</span>
            </div>
          </>
        )}
        <Button variant="outline" size="sm" className="w-full mt-3 gap-1.5" onClick={onExportExcel}>
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </CardContent>
    </Card>
  );
}
