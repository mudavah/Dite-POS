'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/sidebar';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

function CheckoutCompleteContent() {
  const searchParams = useSearchParams();
  const saleId = searchParams.get('saleId');
  const receiptNo = searchParams.get('receiptNo');
  const total = searchParams.get('total');

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="rounded-lg border border-border bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Payment Complete</h1>
          <p className="text-muted-foreground">Sale completed successfully</p>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-left">
          {receiptNo && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receipt No</span>
              <span className="font-medium">{receiptNo}</span>
            </div>
          )}
          {saleId && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sale ID</span>
              <span className="font-medium">{saleId.slice(-8)}</span>
            </div>
          )}
          {total && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatCurrency(parseFloat(total))}</span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button onClick={() => (window.location.href = '/pos')} className="w-full h-12">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Back to POS
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutCompletePage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading...</p></div>}>
        <CheckoutCompleteContent />
      </Suspense>
    </AppLayout>
  );
}
