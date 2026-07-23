'use client';

import * as React from 'react';
import { usePosStore } from '@/store/use-pos-store';
import { syncEngine } from '@/lib/offline/sync-engine';
import { logger } from '@/lib/logger';

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const setOnline = usePosStore((s) => s.setOnline);
  const setPendingSyncCount = usePosStore((s) => s.setPendingSyncCount);
  const setSyncStatus = usePosStore((s) => s.setSyncStatus);
  const isOnline = usePosStore((s) => s.isOnline);

  const updateSyncStatus = React.useCallback(async () => {
    try {
      const queue = await syncEngine.getQueue();
      const pending = queue.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length;
      const hasConflict = queue.some((i) => i.status === 'CONFLICT');
      setPendingSyncCount(pending);
      setSyncStatus(pending > 0 ? (hasConflict ? 'conflict' : 'error') : 'idle');
    } catch (error) {
      logger.error('Failed to update sync status', error);
    }
  }, [setPendingSyncCount, setSyncStatus]);

  const triggerSync = React.useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      await syncEngine.processQueue();
      await updateSyncStatus();
    } catch {
      setSyncStatus('error');
    }
  }, [setSyncStatus, updateSyncStatus]);

  React.useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setOnline(navigator.onLine);
    updateSyncStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline, triggerSync, updateSyncStatus]);

  React.useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, [isOnline, triggerSync]);

  return <>{children}</>;
}
