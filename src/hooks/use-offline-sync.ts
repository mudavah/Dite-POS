'use client';

import { useEffect, useState } from 'react';
import { syncEngine, type OfflineSale } from '@/lib/offline/sync-engine';

async function refreshQueue(setQueueItems: React.Dispatch<React.SetStateAction<OfflineSale[]>>) {
  const items = await syncEngine.getQueue();
  setQueueItems(items);
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'complete'>('idle');
  const [queueItems, setQueueItems] = useState<OfflineSale[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncEngine.subscribe(() => {
      refreshQueue(setQueueItems);
    });

    refreshQueue(setQueueItems);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const triggerSync = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      await syncEngine.processQueue();
      setSyncStatus('complete');
      await refreshQueue(setQueueItems);
    } catch {
      setSyncStatus('error');
    }
  };

  const retryItem = async (itemId: string) => {
    await syncEngine.retry(itemId);
    await refreshQueue(setQueueItems);
  };

  const clearSynced = async () => {
    await syncEngine.clearSynced();
    await refreshQueue(setQueueItems);
  };

  const pendingCount = queueItems.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length;
  const conflictCount = queueItems.filter((i) => i.status === 'CONFLICT').length;

  return {
    isOnline,
    syncStatus,
    queueItems,
    pendingCount,
    conflictCount,
    triggerSync,
    retryItem,
    clearSynced,
  };
}
