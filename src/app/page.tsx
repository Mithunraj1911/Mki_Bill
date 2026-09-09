'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Sidebar, BottomNav, MobileHeader } from '@/components/layout/navigation';
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register';
import { useNav } from '@/lib/nav-store';
import { DashboardView } from '@/components/views/dashboard-view';
import { NewBillView } from '@/components/views/new-bill-view';
import { BillReviewView } from '@/components/views/bill-review-view';
import { AcknowledgmentView } from '@/components/views/acknowledgment-view';
import { SuccessView } from '@/components/views/success-view';
import { BulkBillView } from '@/components/views/bulk-bill-view';
import { BulkBillReviewView } from '@/components/views/bulk-bill-review-view';
import { BulkAcknowledgmentView } from '@/components/views/bulk-acknowledgment-view';
import { BulkSuccessView } from '@/components/views/bulk-success-view';
import { ExistingBillsView } from '@/components/views/existing-bills-view';
import { BillDetailsView } from '@/components/views/bill-details-view';
import { BillEditView } from '@/components/views/bill-edit-view';
import { ReportsView } from '@/components/views/reports-view';
import { SettingsView } from '@/components/views/settings-view';

function CurrentView() {
  const view = useNav((s) => s.view);

  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'new-bill':
      return <NewBillView />;
    case 'bill-review':
      return <BillReviewView />;
    case 'acknowledgment':
      return <AcknowledgmentView />;
    case 'success':
      return <SuccessView />;
    case 'bulk-bill':
      return <BulkBillView />;
    case 'bulk-bill-review':
      return <BulkBillReviewView />;
    case 'bulk-acknowledgment':
      return <BulkAcknowledgmentView />;
    case 'bulk-success':
      return <BulkSuccessView />;
    case 'existing-bills':
      return <ExistingBillsView />;
    case 'bill-details':
      return <BillDetailsView />;
    case 'bill-edit':
      return <BillEditView />;
    case 'reports':
      return <ReportsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ServiceWorkerRegister />
      <div className="min-h-screen flex flex-col bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col md:pl-60 min-w-0">
          <MobileHeader />
          <main className="flex-1 flex flex-col px-4 md:px-8 py-6 pb-24 md:pb-8 min-w-0">
            <CurrentView />
          </main>
          <footer className="mt-auto border-t bg-background px-4 md:px-8 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4 text-center text-xs text-muted-foreground">
            <span className="block">
              © {new Date().getFullYear()} Munjal Kiriu Industries — Digital Bill Management
            </span>
            <span className="block mt-1 text-muted-foreground/70">Internal company application · Do not share externally</span>
          </footer>
        </div>
        <BottomNav />
      </div>
    </QueryClientProvider>
  );
}
