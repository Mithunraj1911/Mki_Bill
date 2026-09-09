'use client';

import { useNav, ViewKey } from '@/lib/nav-store';
import { LayoutDashboard, Plus, FileText, BarChart3, Settings, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { key: 'new-bill', label: 'New Bill', icon: Plus },
  { key: 'bulk-bill', label: 'Bulk', icon: Layers },
  { key: 'existing-bills', label: 'Bills', icon: FileText },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

/// Determine which primary nav key is "active" for a given view (some views are sub-screens).
function activeKeyFor(view: ViewKey): ViewKey {
  switch (view) {
    case 'bill-review':
    case 'acknowledgment':
    case 'success':
      return 'new-bill';
    case 'bulk-bill-review':
    case 'bulk-acknowledgment':
    case 'bulk-success':
      return 'bulk-bill';
    case 'bill-details':
    case 'bill-edit':
      return 'existing-bills';
    default:
      return view;
  }
}

export function BottomNav() {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const activeKey = activeKeyFor(view);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-6">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <li key={item.key}>
              <button
                onClick={() => go(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex flex-col items-center gap-0.5 py-1.5 px-0.5 text-[10px] font-medium transition-colors min-h-[56px] justify-center',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar() {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const activeKey = activeKeyFor(view);

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <img src="/logo.png" alt="Munjal Kiriu Industries" className="h-9 w-9 rounded-md object-contain" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">Digital Bills</span>
          <span className="text-[11px] text-muted-foreground mt-1">Management Portal</span>
        </div>
      </div>
      <nav aria-label="Primary" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => go(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t px-6 py-4">
        <p className="text-[11px] text-muted-foreground">Munjal Kiriu Industries</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">Internal use only</p>
      </div>
    </aside>
  );
}

/// Mobile top header (visible only on mobile, replaces the sidebar's brand area).
export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur px-4">
      <div className="flex h-8 w-8 items-center justify-center">
        <img src="/logo.png" alt="Munjal Kiriu Industries" className="h-8 w-8 rounded-md object-contain" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none">Digital Bills</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">Management Portal</span>
      </div>
    </header>
  );
}
