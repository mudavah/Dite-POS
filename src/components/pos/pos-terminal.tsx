'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ProductGrid } from '@/components/pos/product-grid';
import { CartPanel } from '@/components/pos/cart-panel';
import { CheckoutModal } from '@/components/pos/checkout-modal';
import { HeldSalesModal } from '@/components/pos/held-sales-modal';
import { CashierSummaryModal } from '@/components/pos/cashier-summary-modal';
import { ReceiptPreviewModal } from '@/components/pos/receipt-preview-modal';
import { Button, Badge } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  image?: string;
  categoryId: string;
  category?: { name: string };
  isActive: boolean;
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

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface HeldSale {
  id: string;
  branchId: string;
  cashierId: string;
  customerName?: string;
  itemsJson: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

interface PosTerminalProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    branchId?: string | null;
  };
}

export function PosTerminal({ user }: PosTerminalProps) {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [showHeldSales, setShowHeldSales] = React.useState(false);
  const [showCashierSummary, setShowCashierSummary] = React.useState(false);
  const [lastSale, setLastSale] = React.useState<{ id: string; receiptNo?: string } | null>(null);
  const [searchFocused, setSearchFocused] = React.useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const taxRate = 0.16;
  const taxAmount = subtotal * taxRate;
  const total = subtotal - totalDiscount + taxAmount;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 1,
        discount: 0,
        total: product.price,
      };
      return [...prev, newItem];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemNote = (id: string, notes: string) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

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
          subtotal,
          taxAmount,
          totalAmount: total,
        }),
      });
      if (!res.ok) throw new Error('Failed to hold sale');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });
      setCart([]);
      setSelectedCustomer(null);
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
    const items: CartItem[] = JSON.parse(sale.itemsJson);
    setCart(items);
    setSelectedCustomer(sale.customerName ? { id: '', name: sale.customerName } : null);
    toast({ title: 'Sale recalled', description: `${items.length} items loaded` });
  };

  const handleCheckoutComplete = (saleId: string, receiptNo?: string) => {
    setLastSale({ id: saleId, receiptNo });
    setCart([]);
    setSelectedCustomer(null);
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
    },
    'Ctrl+h': () => {
      handleHoldSale();
    },
  }, [cart.length, showCheckout, showHeldSales, showCashierSummary, searchFocused]);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="flex-1 min-w-0">
        <ProductGrid onSelect={addToCart} />
      </div>

      <div className="w-96 shrink-0">
        <CartPanel
          items={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onClearCart={clearCart}
          onHoldSale={handleHoldSale}
          onRecallSale={() => setShowHeldSales(true)}
          onCheckout={() => setShowCheckout(true)}
          onOpenSummary={() => setShowCashierSummary(true)}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onUpdateItemNote={updateItemNote}
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

      {lastSale && (
        <ReceiptPreviewModal
          saleId={lastSale.id}
          receiptNo={lastSale.receiptNo}
          onClose={() => setLastSale(null)}
        />
      )}
    </div>
  );
}
