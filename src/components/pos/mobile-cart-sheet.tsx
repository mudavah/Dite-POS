'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui';
import { usePosStore, subtotal, totalDiscount } from '@/store/use-pos-store';
import { CheckoutModal } from '@/components/pos/checkout-modal';
import { HeldSalesModal } from '@/components/pos/held-sales-modal';
import { ReceiptPreviewModal } from '@/components/pos/receipt-preview-modal';
import { Minus, Plus, Trash2, RotateCcw, ClipboardList, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MobileCartSheetProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    branchId?: string | null;
  };
  onCheckoutComplete: (saleId: string, receiptNo?: string) => void;
}

export function MobileCartSheet({ user, onCheckoutComplete }: MobileCartSheetProps) {
  const router = useRouter();
  const cartSheetOpen = usePosStore((s) => s.cartSheetOpen);
  const checkoutOpen = usePosStore((s) => s.checkoutOpen);
  const setCartSheetOpen = usePosStore((s) => s.setCartSheetOpen);
  const setCheckoutOpen = usePosStore((s) => s.setCheckoutOpen);
  const openCheckoutFlow = usePosStore((s) => s.openCheckoutFlow);
  const closeCheckoutFlow = usePosStore((s) => s.closeCheckoutFlow);

  const [showHeldSales, setShowHeldSales] = React.useState(false);
  const [lastSale, setLastSale] = React.useState<{ id: string; receiptNo?: string } | null>(null);

  const cart = usePosStore((s) => s.cart);
  const selectedCustomer = usePosStore((s) => s.selectedCustomer);
  const addToCart = usePosStore((s) => s.addToCart);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const updateQuantityDirect = usePosStore((s) => s.updateQuantityDirect);
  const removeItem = usePosStore((s) => s.removeItem);
  const updateItemNote = usePosStore((s) => s.updateItemNote);
  const clearCart = usePosStore((s) => s.clearCart);
  const setSelectedCustomer = usePosStore((s) => s.setSelectedCustomer);
  const isOnline = usePosStore((s) => s.isOnline);
  const pendingSyncCount = usePosStore((s) => s.pendingSyncCount);

  const subtotalVal = subtotal(cart);
  const totalDiscountVal = totalDiscount(cart);
  const total = subtotalVal - totalDiscountVal;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const holdSale = async () => {
    try {
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
      clearCart();
      setCartSheetOpen(false);
    } catch {
      // handle error
    }
  };

  const recallSale = async (sale: { itemsJson: string; customerName?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = JSON.parse(sale.itemsJson).map((item: any) => ({
      ...item,
      id: `${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }));
    clearCart();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items.forEach((item: any) => {
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
    setCartSheetOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 md:hidden">
        {cart.length > 0 && (
          <>
            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                {pendingSyncCount} pending
              </div>
            )}
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isOnline ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive animate-pulse'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </>
        )}
        <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setCartSheetOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingCart className="h-6 w-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Button>

          <SheetContent side="bottom" className="h-[100dvh] w-full max-w-none rounded-none border-l-0 border-r-0 border-t-0 p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-lg">Cart ({itemCount})</SheetTitle>
                  <SheetDescription>
                    {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                  </SheetDescription>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                    aria-label="Clear cart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs">Add products from the grid</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border bg-background/50 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="h-6 w-6 shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="h-8 w-8 rounded-md border border-input bg-background flex items-center justify-center disabled:opacity-50"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) {
                              updateQuantityDirect(item.id, val);
                            }
                          }}
                          className="h-8 w-14 rounded-md border border-input bg-background text-center text-sm p-1"
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="h-8 w-8 rounded-md border border-input bg-background flex items-center justify-center"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(item.total)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          const newNotes = item.notes === '' ? null : '';
                          updateItemNote(item.id, newNotes || '');
                        }}
                        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        {item.notes ? 'Clear note' : 'Add note'}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        @ {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-3 pb-8">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotalVal)}</span>
                  </div>
                  {totalDiscountVal > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount</span>
                      <span>-{formatCurrency(totalDiscountVal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setCartSheetOpen(false);
                      setTimeout(() => setShowHeldSales(true), 300);
                    }}
                    className="h-11 rounded-md border border-input bg-background flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Recall
                  </button>
                  <button
                    onClick={holdSale}
                    className="h-11 rounded-md border border-input bg-background flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    Hold
                  </button>
                </div>
                <button
                  onClick={() => {
                    setCartSheetOpen(false);
                    setTimeout(() => router.push('/pending-sales'), 300);
                  }}
                  className="w-full h-11 rounded-md border border-input bg-background flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Clock className="h-4 w-4" />
                  Pending Sales
                </button>
                <button
                  onClick={openCheckoutFlow}
                  className="w-full h-12 rounded-md bg-primary text-primary-foreground text-base font-semibold"
                >
                  Checkout
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open) {
            closeCheckoutFlow(true);
          }
        }}
        items={cart}
        customer={selectedCustomer}
        branchId={user.branchId || ''}
        cashierId={user.id}
        onComplete={(saleId, receiptNo) => {
          setLastSale({ id: saleId, receiptNo });
          onCheckoutComplete(saleId, receiptNo);
          closeCheckoutFlow(false);
          if (isOnline) {
            const totalAmount = subtotalVal - totalDiscountVal;
            router.push(`/checkout/complete?saleId=${saleId}&receiptNo=${encodeURIComponent(receiptNo || '')}&total=${totalAmount}`);
          }
        }}
      />

      <HeldSalesModal
        open={showHeldSales}
        onOpenChange={setShowHeldSales}
        onRecall={recallSale}
      />

      {lastSale && (
        <ReceiptPreviewModal
          saleId={lastSale.id}
          receiptNo={lastSale.receiptNo}
          onClose={() => setLastSale(null)}
        />
      )}
    </>
  );
}
