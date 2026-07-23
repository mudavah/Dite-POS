'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Warehouse, BarChart3, Settings, Users, Store, LogOut, Clock, Menu } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { logger } from '@/lib/logger';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within AppLayout');
  return context;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['ADMIN', 'CASHIER'] },
  { href: '/pending-sales', label: 'Pending Sales', icon: Clock, roles: ['ADMIN', 'CASHIER'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['ADMIN'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['ADMIN', 'CASHIER'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/branches', label: 'Branches', icon: Store, roles: ['ADMIN'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const { isCollapsed } = useSidebar();

  if (!session?.user) return null;

  const userRole = session.user.role as string;
  const filteredItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      <div className={cn('flex h-16 items-center border-b px-4', isCollapsed && 'justify-center px-0')}>
        {isCollapsed ? (
          <span className="text-lg font-bold">D</span>
        ) : (
          <h1 className="text-xl font-bold">Dite POS</h1>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {filteredItems.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} isCollapsed={isCollapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t p-2">
        <div className={cn('flex items-center gap-3', isCollapsed && 'flex-col justify-center gap-2')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {session.user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole.toLowerCase()}</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function SidebarItem({ href, icon: Icon, label, isCollapsed, onNavigate }: { href: string; icon: React.ElementType; label: string; isCollapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  const baseClasses = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    isCollapsed && 'justify-center px-0'
  );

  const content = (
    <Link href={href} className={baseClasses} onClick={onNavigate}>
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function DesktopSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        'hidden md:flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarContent onNavigate={onNavigate} />
    </aside>
  );
}

function MobileSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-64 p-0">
        <SidebarContent onNavigate={onNavigate} />
      </SheetContent>
    </Sheet>
  );
}

const subscribeToLocalStorage = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

const getLocalStorageSnapshot = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch (error) {
    logger.warn('localStorage read failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return false;
  }
};

const getServerSnapshot = () => false;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribeToLocalStorage, getLocalStorageSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = !isCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch (error) {
      logger.warn('localStorage write failed', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  };

  const handleMobileNavigate = () => {
    setMobileOpen(false);
  };

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, isMobileOpen, setMobileOpen }}>
      <div className="flex h-screen overflow-hidden">
        <DesktopSidebar onNavigate={handleMobileNavigate} />
        <MobileSidebar onNavigate={handleMobileNavigate} />
        <main className="flex-1 overflow-y-auto bg-muted/30 transition-all duration-300 ease-in-out">
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold">Dite POS</span>
          </div>
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
