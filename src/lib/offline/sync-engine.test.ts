import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncEngine } from './sync-engine';

vi.mock('./dexie-db', () => {
  const mockPut = vi.fn();
  const mockGet = vi.fn();
  const mockToArray = vi.fn();
  const mockBulkDelete = vi.fn();
  const mockWhere = vi.fn(() => ({
    equals: vi.fn().mockResolvedValue([]),
    anyOf: vi.fn().mockResolvedValue([]),
  }));

  return {
    db: {
      salesQueue: {
        put: mockPut,
        get: mockGet,
        toArray: mockToArray,
        bulkDelete: mockBulkDelete,
        where: mockWhere,
      },
    },
  };
});

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queueMutation', () => {
    it('should queue a mutation and notify listeners', async () => {
      const notifySpy = vi.spyOn(syncEngine, 'notifyListeners');

      const id = await syncEngine.queueMutation({
        entityType: 'sale',
        entityId: 'sale-1',
        action: 'CREATE',
        payload: JSON.stringify({ test: true }),
        status: 'PENDING',
      });

      expect(id).toBeDefined();
      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('should not process when offline', async () => {
      const originalNavigator = global.navigator;
      (global as unknown as { navigator: { onLine: boolean } }).navigator = { onLine: false };

      await syncEngine.processQueue();

      (global as unknown as { navigator: Navigator }).navigator = originalNavigator;
    });
  });

  describe('getBackoffDelay', () => {
    it('should return increasing delay with capped maximum', () => {
      expect(syncEngine.getBackoffDelay(0)).toBe(1000);
      expect(syncEngine.getBackoffDelay(1)).toBe(2000);
      expect(syncEngine.getBackoffDelay(4)).toBe(16000);
      expect(syncEngine.getBackoffDelay(5)).toBe(30000);
      expect(syncEngine.getBackoffDelay(10)).toBe(30000);
    });
  });
});
