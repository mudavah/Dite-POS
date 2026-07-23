'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/sidebar';
import { PosTerminal } from '@/components/pos/pos-terminal';
import { ConnectivityProvider } from '@/components/offline/connectivity-provider';

async function fetchSession() {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export default function PosClient() {
  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    retry: false,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading POS terminal...</p>
        </div>
      </AppLayout>
    );
  }

  if (!session?.user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Please log in to access the POS terminal.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ConnectivityProvider>
        <PosTerminal user={session.user} />
      </ConnectivityProvider>
    </AppLayout>
  );
}
