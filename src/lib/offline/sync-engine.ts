import { db } from './db';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  action: SyncAction;
  payload: unknown;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  retries: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_RETRIES = 5;

export const syncEngine = {
  async queueMutation(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'updatedAt' | 'retries'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      retries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.set('sales-queue', queueItem.id, queueItem);
    this.notifyListeners();
    return queueItem.id;
  },

  async processQueue(): Promise<void> {
    if (typeof window !== 'undefined' && !navigator.onLine) return;

    const queue = await db.getAll<SyncQueueItem>('sales-queue');
    const pending = queue.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');

    for (const item of pending) {
      if (item.status === 'FAILED' && item.retries >= MAX_RETRIES) continue;

      item.status = 'SYNCING';
      item.updatedAt = new Date();
      await db.set('sales-queue', item.id, item);

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          item.status = 'SYNCED';
          item.updatedAt = new Date();
          await db.set('sales-queue', item.id, item);
        } else if (response.status === 409) {
          item.status = 'CONFLICT';
          item.updatedAt = new Date();
          await db.set('sales-queue', item.id, item);
        } else {
          throw new Error(`Sync failed with status ${response.status}`);
        }
      } catch (error) {
        item.retries += 1;
        item.lastError = error instanceof Error ? error.message : 'Unknown error';
        item.status = item.retries >= MAX_RETRIES ? 'FAILED' : 'FAILED';
        item.updatedAt = new Date();
        await db.set('sales-queue', item.id, item);
      }
    }

    this.notifyListeners();
  },

  async retry(itemId: string): Promise<void> {
    const item = await db.get<SyncQueueItem>('sales-queue', itemId);
    if (!item) return;

    item.status = 'PENDING';
    item.retries = 0;
    item.lastError = undefined;
    item.updatedAt = new Date();
    await db.set('sales-queue', item.id, item);
    await this.processQueue();
  },

  async clearSynced(): Promise<void> {
    const queue = await db.getAll<SyncQueueItem>('sales-queue');
    for (const item of queue) {
      if (item.status === 'SYNCED') {
        await db.delete('sales-queue', item.id);
      }
    }
    this.notifyListeners();
  },

  async getQueue(): Promise<SyncQueueItem[]> {
    return db.getAll<SyncQueueItem>('sales-queue');
  },

  listeners: new Set<() => void>(),

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notifyListeners(): void {
    this.listeners.forEach((l) => l());
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncEngine.processQueue());
}
