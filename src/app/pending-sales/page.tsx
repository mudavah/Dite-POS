'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/sidebar';
import { PendingSalesModal } from '@/components/pos/pending-sales-modal';
import { useSession } from 'next-auth/react';

export default function PendingSalesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (!session?.user) {
    router.push('/login');
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pending Sales</h1>
          <p className="text-muted-foreground">Complete payment for pending sales</p>
        </div>
        <PendingSalesModal
          open={true}
          onOpenChange={(open) => {
            if (!open) router.push('/pos');
          }}
          onComplete={(saleId) => {
            router.push('/pos');
          }}
        />
      </div>
    </AppLayout>
  );
}
