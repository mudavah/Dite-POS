import { db, type OfflineSale } from './dexie-db';
import { logger } from '@/lib/logger';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type { OfflineSale } from './dexie-db';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

function getBackoffDelayImpl(retries: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, retries), MAX_DELAY);
}

export function getBackoffDelay(retries: number): number {
  return getBackoffDelayImpl(retries);
}

export const syncEngine = {
  getBackoffDelay(retries: number): number {
    return getBackoffDelayImpl(retries);
  },
  async queueMutation(item: Omit<OfflineSale, 'id' | 'createdAt' | 'updatedAt' | 'retries'>): Promise<string> {
    const queueItem: OfflineSale = {
      ...item,
      id: crypto.randomUUID(),
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.salesQueue.add(queueItem);
    this.notifyListeners();
    return queueItem.id;
  },

  async processQueue(): Promise<void> {
    if (typeof window !== 'undefined' && !navigator.onLine) return;

    const queue = await db.salesQueue
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .toArray();

    for (const item of queue) {
      if (item.status === 'FAILED' && item.retries >= MAX_RETRIES) {
        logger.warn('sync: max retries exceeded', { saleId: item.entityId, retries: item.retries });
        continue;
      }

      if (item.status === 'PENDING' || item.status === 'FAILED') {
        item.status = 'PROCESSING';
        item.updatedAt = new Date().toISOString();
        await db.salesQueue.put(item);
        this.notifyListeners();
      }

      const delay = item.retries > 0 ? getBackoffDelay(item.retries) : 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          item.status = 'SYNCED';
          item.updatedAt = new Date().toISOString();
          await db.salesQueue.put(item);
          logger.info('sync: item synced', { saleId: item.entityId, idempotencyKey: item.idempotencyKey });

          const result = await response.json().catch(() => ({}));
          if (result.saleId) {
            const receipt = await db.receipts.where('saleId').equals(item.entityId).first();
            if (receipt) {
              await db.receipts.update(receipt.id, {
                status: 'SYNCED',
                printedAt: new Date().toISOString(),
              });
            }
          }
        } else if (response.status === 409) {
          item.status = 'CONFLICT';
          item.updatedAt = new Date().toISOString();
          await db.salesQueue.put(item);
          logger.warn('sync: conflict detected', { saleId: item.entityId, idempotencyKey: item.idempotencyKey });
        } else if (response.status === 429 || response.status >= 500) {
          throw new Error(`Sync failed with status ${response.status}, retrying`);
        } else {
          throw new Error(`Sync failed with status ${response.status}`);
        }
      } catch (error) {
        item.retries += 1;
        item.lastError = error instanceof Error ? error.message : 'Unknown error';
        item.status = item.retries >= MAX_RETRIES ? 'FAILED' : 'PENDING';
        item.updatedAt = new Date().toISOString();
        await db.salesQueue.put(item);
        logger.error('sync: item failed', error, { saleId: item.entityId, retries: item.retries, maxRetries: MAX_RETRIES });
      }
    }

    this.notifyListeners();
  },

  async retryWithBackoff(itemId: string): Promise<void> {
    const item = await db.salesQueue.get(itemId);
    if (!item) return;

    item.status = 'PENDING';
    item.retries = 0;
    item.lastError = undefined;
    item.updatedAt = new Date().toISOString();
    await db.salesQueue.put(item);

    await this.retry(itemId);
  },

  async retry(itemId: string): Promise<void> {
    const item = await db.salesQueue.get(itemId);
    if (!item) return;

    item.status = 'PENDING';
    item.retries = 0;
    item.lastError = undefined;
    item.updatedAt = new Date().toISOString();
    await db.salesQueue.put(item);
    await this.processQueue();
  },

  async clearSynced(): Promise<void> {
    const synced = await db.salesQueue.where('status').equals('SYNCED').toArray();
    const ids = synced.map((i) => i.id);
    if (ids.length > 0) {
      await db.salesQueue.bulkDelete(ids);
    }
    this.notifyListeners();
  },

  async getQueue(): Promise<OfflineSale[]> {
    return db.salesQueue.toArray();
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