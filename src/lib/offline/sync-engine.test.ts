import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncEngine } from './sync-engine';
import { db } from './db';

vi.mock('./db', () => ({
  db: {
    get: vi.fn(),
    getAll: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queueMutation', () => {
    it('should queue a mutation and notify listeners', async () => {
      const item = {
        entityType: 'sale',
        entityId: 'sale-1',
        action: 'CREATE' as const,
        payload: { test: true },
        status: 'PENDING' as const,
      };

      vi.mocked(db.set).mockResolvedValue(undefined);
      const notifySpy = vi.spyOn(syncEngine, 'notifyListeners');

      const id = await syncEngine.queueMutation(item);

      expect(id).toBeDefined();
      expect(db.set).toHaveBeenCalledWith(
        'sales-queue',
        expect.any(String),
        expect.objectContaining({
          entityType: 'sale',
          entityId: 'sale-1',
          action: 'CREATE',
          status: 'PENDING',
          retries: 0,
        })
      );
      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('should not process when offline', async () => {
      const originalNavigator = global.navigator;
      (global as unknown as { navigator: { onLine: boolean } }).navigator = { onLine: false };

      await syncEngine.processQueue();

      expect(db.getAll).not.toHaveBeenCalled();

      (global as unknown as { navigator: Navigator }).navigator = originalNavigator;
    });
  });

  describe('retry', () => {
    it('should reset item status to PENDING and process queue', async () => {
      const item = {
        id: 'item-1',
        status: 'FAILED' as const,
        retries: 3,
      };

      vi.mocked(db.get).mockResolvedValue(item);
      vi.mocked(db.set).mockResolvedValue(undefined);
      const processSpy = vi.spyOn(syncEngine, 'processQueue').mockResolvedValue(undefined);

      await syncEngine.retry('item-1');

      expect(db.set).toHaveBeenCalledWith(
        'sales-queue',
        'item-1',
        expect.objectContaining({
          status: 'PENDING',
          retries: 0,
        })
      );
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('clearSynced', () => {
    it('should delete synced items from queue', async () => {
      const queue = [
        { id: '1', status: 'SYNCED' as const },
        { id: '2', status: 'PENDING' as const },
      ];

      vi.mocked(db.getAll).mockResolvedValue(queue);
      vi.mocked(db.delete).mockResolvedValue(undefined);

      await syncEngine.clearSynced();

      expect(db.delete).toHaveBeenCalledWith('sales-queue', '1');
      expect(db.delete).not.toHaveBeenCalledWith('sales-queue', '2');
    });
  });
});
