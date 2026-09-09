'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav-store';
import { DEPARTMENTS, BILL_STATUSES, type BillsListParams, type BillsListResponse, type BillStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, FileText, Eye, Download, ChevronLeft, ChevronRight, X, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatINR, formatDateDMY, statusBadgeClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function ExistingBillsView() {
  const go = useNav((s) => s.go);
  const openBill = useNav((s) => s.openBill);
  const startEditBill = useNav((s) => s.startEditBill);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<BillStatus | 'ALL'>('ALL');
  const [department, setDepartment] = useState<string>('ALL');
  const [company, setCompany] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; billId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const params: BillsListParams = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      status,
      department,
      company: company || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      amountMin: amountMin ? parseFloat(amountMin) : undefined,
      amountMax: amountMax ? parseFloat(amountMax) : undefined,
      sort,
    }),
    [page, pageSize, search, status, department, company, dateFrom, dateTo, amountMin, amountMax, sort]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery<BillsListResponse>({
    queryKey: ['bills', params],
    queryFn: () => api.listBills(params),
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const bills = data?.bills ?? [];

  const activeFilterCount =
    (status !== 'ALL' ? 1 : 0) +
    (department !== 'ALL' ? 1 : 0) +
    (company ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  function clearFilters() {
    setStatus('ALL');
    setDepartment('ALL');
    setCompany('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setPage(1);
  }

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  function downloadExcel(scope: 'all' | 'week' | 'month' | 'year' | 'filtered') {
    const url = api.excelExportUrl({
      scope,
      search: search || undefined,
      status: status === 'ALL' ? undefined : status,
      department: department === 'ALL' ? undefined : department,
      company: company || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      amountMin: amountMin ? parseFloat(amountMin) : undefined,
      amountMax: amountMax ? parseFloat(amountMax) : undefined,
    });
    window.location.href = url;
    toast.success('Generating Excel download...');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteBill(deleteTarget.id);
      toast.success(`Bill ${deleteTarget.billId} deleted.`);
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      setDeleteTarget(null);
    } catch (e) {
      toast.error('Unable to delete bill.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-7xl w-full mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Existing Bills</h1>
          <p className="text-sm text-muted-foreground">Search, filter, edit, and export bills.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => go('new-bill')} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Bill
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /> Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Export bills</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => downloadExcel('all')}>All Bills</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel('week')}>Current Week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel('month')}>Current Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel('year')}>Current Year</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel('filtered')} disabled={activeFilterCount === 0 && !search}>
                Filtered Bills
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch();
            }}
            placeholder="Search by Bill ID, Company, Bill No, Submitted By, Receiver"
            className="pl-9 h-11"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={applySearch} className="h-11">Search</Button>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 gap-1.5 relative">
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Filters</h3>
                  {activeFilterCount > 0 && (
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </div>
                <Field label="Status">
                  <Select value={status} onValueChange={(v) => { setStatus(v as BillStatus | 'ALL'); setPage(1); }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {BILL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Department">
                  <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1); }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Company">
                  <Input value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }} placeholder="Company name" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date From">
                    <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                  </Field>
                  <Field label="Date To">
                    <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Min Amount (₹)">
                    <Input type="number" min="0" step="0.01" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(1); }} placeholder="0" />
                  </Field>
                  <Field label="Max Amount (₹)">
                    <Input type="number" min="0" step="0.01" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(1); }} placeholder="0" />
                  </Field>
                </div>
                <Field label="Sort By">
                  <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="amount_desc">Highest Amount</SelectItem>
                      <SelectItem value="amount_asc">Lowest Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {status !== 'ALL' && (
            <Chip label={`Status: ${status}`} onClear={() => { setStatus('ALL'); setPage(1); }} />
          )}
          {department !== 'ALL' && (
            <Chip label={`Dept: ${department}`} onClear={() => { setDepartment('ALL'); setPage(1); }} />
          )}
          {company && <Chip label={`Company: ${company}`} onClear={() => { setCompany(''); setPage(1); }} />}
          {dateFrom && <Chip label={`From: ${formatDateDMY(dateFrom)}`} onClear={() => { setDateFrom(''); setPage(1); }} />}
          {dateTo && <Chip label={`To: ${formatDateDMY(dateTo)}`} onClear={() => { setDateTo(''); setPage(1); }} />}
          {amountMin && <Chip label={`Min ₹${amountMin}`} onClear={() => { setAmountMin(''); setPage(1); }} />}
          {amountMax && <Chip label={`Max ₹${amountMax}`} onClear={() => { setAmountMax(''); setPage(1); }} />}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Unable to load bills. {String((error as Error).message)}
          </CardContent>
        </Card>
      )}

      {/* Desktop: table; Mobile: cards */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <Th>Bill ID</Th>
                  <Th>Submission</Th>
                  <Th>Company</Th>
                  <Th>Bill No.</Th>
                  <Th>Bill Date</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Submitted By</Th>
                  <Th>Receiver</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !bills.length ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading bills...</td></tr>
                ) : bills.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No bills found. Try adjusting your filters.</td></tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-semibold whitespace-nowrap">{b.billId}</td>
                      <td className="p-3 whitespace-nowrap">{formatDateDMY(b.submissionDate)}</td>
                      <td className="p-3 max-w-[200px] truncate">{b.companyName}</td>
                      <td className="p-3 max-w-[140px] truncate">{b.billNumber}</td>
                      <td className="p-3 whitespace-nowrap">{formatDateDMY(b.billDate)}</td>
                      <td className="p-3 text-right font-semibold whitespace-nowrap">{formatINR(b.basicAmount)}</td>
                      <td className="p-3 whitespace-nowrap">{b.submittedBy}</td>
                      <td className="p-3 whitespace-nowrap">{b.receiverName ?? '—'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase tracking-wide', statusBadgeClass(b.status))}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openBill(b.id)} className="h-8 gap-1">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditBill(b.id)}
                            className="h-8 gap-1"
                            aria-label={`Edit ${b.billId}`}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget({ id: b.id, billId: b.billId })}
                            className="h-8 gap-1 text-destructive hover:text-destructive"
                            aria-label={`Delete ${b.billId}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {isLoading && !bills.length ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading bills...</CardContent></Card>
        ) : bills.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No bills found.</CardContent></Card>
        ) : (
          bills.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{b.billId}</span>
                  <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase tracking-wide', statusBadgeClass(b.status))}>
                    {b.status}
                  </Badge>
                </div>
                <div className="text-sm font-medium truncate">{b.companyName}</div>
                <div className="text-xs text-muted-foreground">Bill No: {b.billNumber}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-base">{formatINR(b.basicAmount)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateDMY(b.submissionDate)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted by: {b.submittedBy} · Receiver: {b.receiverName ?? '—'}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => openBill(b.id)}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => startEditBill(b.id)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1 text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => setDeleteTarget({ id: b.id, billId: b.billId })}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPage(1); }}>
            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="hidden sm:inline">
            · Showing {bills.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + bills.length} of {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog (shared by desktop + mobile) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete bill?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-semibold">{deleteTarget?.billId}</span>? The bill will be marked as CANCELLED and preserved for audit. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('p-3 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
      {label}
      <button onClick={onClear} aria-label={`Clear ${label}`} className="hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
