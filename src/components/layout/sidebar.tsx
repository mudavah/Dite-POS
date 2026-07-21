'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Warehouse, BarChart3, Settings, Users, Store, LogOut, Clock } from 'lucide-react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['ADMIN', 'CASHIER'] },
  { href: '/pending-sales', label: 'Pending Sales', icon: Clock, roles: ['ADMIN', 'CASHIER'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['ADMIN'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['ADMIN'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/branches', label: 'Branches', icon: Store, roles: ['ADMIN'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === 'loading') {
    return (
      <aside className="flex h-full w-64 flex-col border-r bg-background">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold">Dite POS</h1>
        </div>
      </aside>
    );
  }

  if (!session?.user) {
    return null;
  }

  const userRole = session.user.role as string;
  const filteredItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Dite POS</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {filteredItems.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {session.user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole.toLowerCase()}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
