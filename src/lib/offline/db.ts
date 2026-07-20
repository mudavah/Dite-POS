import { get, set, del, keys } from 'idb-keyval';

export type CacheType = 'products' | 'inventory' | 'sales-queue' | 'customers' | 'sync-status';

const PREFIX = 'dite-pos:';

function key(type: CacheType, id?: string): string {
  return id ? `${PREFIX}${type}:${id}` : `${PREFIX}${type}`;
}

export const db = {
  async getAll<T>(type: CacheType): Promise<T[]> {
    const allKeys = await keys();
    const prefix = `${PREFIX}${type}:`;
    const items: T[] = [];
    for (const k of allKeys) {
      if (typeof k === 'string' && k.startsWith(prefix)) {
        const val = await get<T>(k);
        if (val) items.push(val);
      }
    }
    return items;
  },

  async get<T>(type: CacheType, id: string): Promise<T | undefined> {
    return get<T>(key(type, id));
  },

  async set<T>(type: CacheType, id: string, value: T): Promise<void> {
    await set(key(type, id), value);
  },

  async delete(type: CacheType, id: string): Promise<void> {
    await del(key(type, id));
  },

  async clear(type: CacheType): Promise<void> {
    const allKeys = await keys();
    for (const k of allKeys) {
      if (typeof k === 'string' && k.startsWith(`${PREFIX}${type}:`)) {
        await del(k);
      }
    }
  },
};
