'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ProductGrid } from '@/components/pos/product-grid';
import { CartPanel } from '@/components/pos/cart-panel';
import { MobileCartSheet } from '@/components/pos/mobile-cart-sheet';
import { PosHeader } from '@/components/pos/pos-header';
import { CheckoutModal } from '@/components/pos/checkout-modal';
import { HeldSalesModal } from '@/components/pos/held-sales-modal';
import { CashierSummaryModal } from '@/components/pos/cashier-summary-modal';
import { ReceiptPreviewModal } from '@/components/pos/receipt-preview-modal';
import { PendingSalesModal } from '@/components/pos/pending-sales-modal';
import { useToast } from '@/components/ui/toast';
import { useCartPersistence } from '@/lib/offline/cart-persistence';
import { usePosStore, subtotal, totalDiscount } from '@/store/use-pos-store';

interface PosTerminalProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    branchId?: string | null;
  };
}

interface HeldSale {
  id: string;
  customerName?: string;
  itemsJson: string;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  notes?: string;
}

export function PosTerminal({ user }: PosTerminalProps) {
  useCartPersistence();

  const {
    cart,
    selectedCustomer,
    addToCart,
    updateQuantity,
    updateQuantityDirect,
    removeItem,
    updateItemNote,
    clearCart,
    setSelectedCustomer,
    isOnline,
    pendingSyncCount,
    syncStatus,
    setSyncStatus,
  } = usePosStore();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [showHeldSales, setShowHeldSales] = React.useState(false);
  const [showCashierSummary, setShowCashierSummary] = React.useState(false);
  const [showPendingSales, setShowPendingSales] = React.useState(false);
  const [lastSale, setLastSale] = React.useState<{ id: string; receiptNo?: string } | null>(null);
  const [searchFocused] = React.useState(false);

  const subtotalVal = subtotal(cart);
  const totalDiscountVal = totalDiscount(cart);
  const total = subtotalVal - totalDiscountVal;

  const holdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/pos/held-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: selectedCustomer?.name,
          items: cart.map((i) => ({
            productId: i.productId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            total: i.total,
            notes: i.notes,
          })),
          subtotal: subtotalVal,
          totalAmount: total,
        }),
      });
      if (!res.ok) throw new Error('Failed to hold sale');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });
      clearCart();
      toast({ title: 'Sale held successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to hold sale', description: err.message, variant: 'destructive' });
    },
  });

  const handleHoldSale = () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', description: 'Add items before holding a sale', variant: 'destructive' });
      return;
    }
    holdMutation.mutate();
  };

  const handleRecallSale = (sale: HeldSale) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: CartItem[] = JSON.parse(sale.itemsJson).map((item: any) => ({
      ...item,
      id: `${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }));
    clearCart();
    items.forEach((item) => {
      addToCart({
        id: item.productId,
        name: item.name,
        price: item.unitPrice,
        sku: item.sku,
      });
    });
    if (sale.customerName) {
      setSelectedCustomer({ id: '', name: sale.customerName });
    }
    toast({ title: 'Sale recalled', description: `${items.length} items loaded` });
  };

  const handleCheckoutComplete = (saleId: string, receiptNo?: string) => {
    setLastSale({ id: saleId, receiptNo });
    clearCart();
    setSyncStatus('idle');
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast({ title: 'Offline', description: 'Connect to the internet to sync', variant: 'destructive' });
      return;
    }
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setSyncStatus('idle');
        toast({ title: 'Sync complete' });
      } else {
        throw new Error('Sync failed');
      }
    } catch (err) {
      setSyncStatus('error');
      toast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  useKeyboardShortcuts({
    F1: () => {
      const searchInput = document.querySelector('input[placeholder*="Search by name"]') as HTMLInputElement;
      searchInput?.focus();
    },
    Enter: () => {
      if (searchFocused) return;
      const firstProduct = document.querySelector('[data-product-card]') as HTMLElement;
      firstProduct?.click();
    },
    F2: () => {
      if (cart.length > 0) setShowCheckout(true);
    },
    Escape: () => {
      if (showCheckout) setShowCheckout(false);
      if (showHeldSales) setShowHeldSales(false);
      if (showCashierSummary) setShowCashierSummary(false);
      if (showPendingSales) setShowPendingSales(false);
    },
    'Ctrl+p': () => {
      setShowPendingSales(true);
    },
    'Ctrl+h': () => {
      handleHoldSale();
    },
  }, [cart.length, showCheckout, showHeldSales, showCashierSummary, showPendingSales, searchFocused, subtotalVal, total, selectedCustomer]);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="flex-1 min-w-0 flex flex-col">
        <PosHeader />
        <ProductGrid onSelect={addToCart} />
      </div>

      <div className="hidden md:block w-96 shrink-0">
        <CartPanel
          items={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onClearCart={clearCart}
          onHoldSale={handleHoldSale}
          onRecallSale={() => setShowHeldSales(true)}
          onCheckout={() => setShowCheckout(true)}
          onOpenSummary={() => setShowCashierSummary(true)}
          onOpenPendingSales={() => setShowPendingSales(true)}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onUpdateItemNote={updateItemNote}
          onUpdateItemQuantityDirect={updateQuantityDirect}
          pendingSyncCount={pendingSyncCount}
          syncStatus={syncStatus}
          isOnline={isOnline}
          onManualSync={handleManualSync}
        />
      </div>

      <CheckoutModal
        open={showCheckout}
        onOpenChange={setShowCheckout}
        items={cart}
        customer={selectedCustomer}
        onComplete={handleCheckoutComplete}
      />

      <HeldSalesModal
        open={showHeldSales}
        onOpenChange={setShowHeldSales}
        onRecall={handleRecallSale}
      />

      <CashierSummaryModal
        open={showCashierSummary}
        onOpenChange={setShowCashierSummary}
        userId={user.id}
      />

      <PendingSalesModal
        open={showPendingSales}
        onOpenChange={setShowPendingSales}
        onComplete={handleCheckoutComplete}
      />

      {lastSale && (
        <ReceiptPreviewModal
          saleId={lastSale.id}
          receiptNo={lastSale.receiptNo}
          onClose={() => setLastSale(null)}
        />
      )}

      <MobileCartSheet user={user} onCheckoutComplete={handleCheckoutComplete} />
    </div>
  );
}
