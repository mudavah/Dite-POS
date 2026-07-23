'use client';

import * as React from 'react';
import { usePosStore } from '@/store/use-pos-store';
import { WifiOff, Wifi, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui';

export function PosHeader() {
  const isOnline = usePosStore((s) => s.isOnline);
  const pendingSyncCount = usePosStore((s) => s.pendingSyncCount);
  const lastSyncAt = usePosStore((s) => s.lastSyncAt);
  const syncStatus = usePosStore((s) => s.syncStatus);
  const setLastSyncAt = usePosStore((s) => s.setLastSyncAt);

  const handleManualSync = async () => {
    if (!isOnline) return;
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setLastSyncAt(new Date().toISOString());
      }
    } catch {
      // ignore
    }
  };

  if (isOnline && pendingSyncCount === 0 && !lastSyncAt) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2 mb-4">
      <div className="flex items-center gap-3">
        {isOnline ? (
          <div className="flex items-center gap-1.5 text-success">
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-destructive">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline</span>
          </div>
        )}

        {pendingSyncCount > 0 && (
          <div className="flex items-center gap-1.5 text-warning">
            <RefreshCw className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{pendingSyncCount} pending</span>
          </div>
        )}

        {lastSyncAt && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Last sync: {new Date(lastSyncAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {isOnline && pendingSyncCount > 0 && (
        <Button variant="outline" size="sm" onClick={handleManualSync} className="h-8 gap-2">
          <RefreshCw className="h-3 w-3" />
          Sync Now
        </Button>
      )}
    </div>
  );
}
