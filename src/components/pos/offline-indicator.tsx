'use client';

import * as React from 'react';
import { usePosStore } from '@/store/use-pos-store';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineIndicator() {
  const isOnline = usePosStore((s) => s.isOnline);
  const pendingSyncCount = usePosStore((s) => s.pendingSyncCount);
  const syncStatus = usePosStore((s) => s.syncStatus);

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
      isOnline ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
    }`}>
      {isOnline ? (
        <>
          <RefreshCw className={`h-3 w-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Syncing...'}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </div>
  );
}
