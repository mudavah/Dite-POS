'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
                return false;
              }
              if ((error as { code?: string })?.code === 'CHECKOUT_UNAUTHORIZED') return false;
              return failureCount < 3;
            },
            networkMode: 'offlineFirst',
          },
        },
      })
  );

  return (
    <SessionProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
