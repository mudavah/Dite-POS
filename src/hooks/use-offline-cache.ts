'use client';

import * as React from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { db } from '@/lib/offline/dexie-db';

export function useCachedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  cacheKey: 'products' | 'categories' | 'customers'
) {
  const [cachedData, setCachedData] = React.useState<T | null>(null);

  const serverQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!navigator.onLine) {
        const items = await db[cacheKey].toArray();
        return items as T;
      }
      const result = await queryFn();
      const data = result as unknown as Record<string, unknown> | Record<string, unknown>[];
      if (data) {
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const record = item as Record<string, unknown>;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db[cacheKey].put({ ...record, cachedAt: new Date().toISOString() } as any);
        }
      }
      return result;
    },
    staleTime: 60_000,
    retry: 1,
  });

  React.useEffect(() => {
    if (!navigator.onLine && serverQuery.error && !cachedData) {
      db[cacheKey].toArray().then((items) => {
        setCachedData(items as T);
      });
    }
  }, [serverQuery.error, cachedData, cacheKey]);

  if ((serverQuery.error || serverQuery.isLoading) && cachedData && !navigator.onLine) {
    return {
      ...serverQuery,
      data: cachedData,
      isLoading: false,
    } as UseQueryResult<T>;
  }

  return serverQuery;
}
