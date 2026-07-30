'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, CheckCircle2, CreditCard, Banknote, Building2, Smartphone, Split, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { usePosStore, type CartItem, type Customer } from '@/store/use-pos-store';
import { CheckoutTimeoutError, CheckoutError, CheckoutSyncError, CheckoutAuthError, CheckoutDuplicateError, isCheckoutError } from '@/lib/checkout-errors';
import { logger } from '@/lib/logger';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  customer: Customer | null;
  branchId: string;
  cashierId: string;
  onComplete: (saleId: string, receiptNo?: string) => void;
}

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'SPLIT';

const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
  BANK_TRANSFER: <Building2 className="h-4 w-4" />,
  MOBILE_MONEY: <Smartphone className="h-4 w-4" />,
  SPLIT: <Split className="h-4 w-4" />,
};

export function CheckoutModal({ open, onOpenChange, items, customer, branchId, cashierId, onComplete }: CheckoutModalProps) {
  const isOnline = usePosStore((s) => s.isOnline);
  const setCheckoutLocked = usePosStore((s) => s.setCheckoutLocked);
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = React.useState('');
  const [cardRef, setCardRef] = React.useState('');
  const [transferRef, setTransferRef] = React.useState('');
  const [mobileRef, setMobileRef] = React.useState('');
  const [splitAmounts, setSplitAmounts] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState('');
  const [customerName, setCustomerName] = React.useState(customer?.name || '');
  const [customerPin, setCustomerPin] = React.useState(customer?.pin || '');
  const [customerTin, setCustomerTin] = React.useState(customer?.tin || '');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());
  const checkoutStartTimeRef = React.useRef<number>(0);
  const checkoutFinishTimeRef = React.useRef<number>(0);
  const hasSubmittedRef = React.useRef(false);
  const [checkoutLocked, setLocalCheckoutLocked] = React.useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - totalDiscount;

  const cashNum = parseFloat(cashReceived) || 0;
  const change = method === 'CASH' ? Math.max(0, cashNum - total) : 0;

  const resetForm = () => {
    setMethod('CASH');
    setCashReceived('');
    setCardRef('');
    setTransferRef('');
    setMobileRef('');
    setSplitAmounts({});
    setNotes('');
    setCustomerName('');
    setCustomerPin('');
    setCustomerTin('');
    checkoutStartTimeRef.current = 0;
    checkoutFinishTimeRef.current = 0;
    hasSubmittedRef.current = false;
    setLocalCheckoutLocked(false);
    setCheckoutLocked(false);
  };

  const enterProcessingState = () => {
    checkoutStartTimeRef.current = Date.now();
    checkoutFinishTimeRef.current = 0;
    hasSubmittedRef.current = true;
    setLocalCheckoutLocked(true);
    setCheckoutLocked(true);
  };

  const exitProcessingState = () => {
    checkoutFinishTimeRef.current = Date.now();
    setLocalCheckoutLocked(false);
    setCheckoutLocked(false);
  };

  const checkoutMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const idempotencyKey = idempotencyKeyRef.current;
      enterProcessingState();

      logger.info('checkout: start', {
        idempotencyKey,
        cashierId,
        branchId,
        itemCount: items.length,
        totalAmount: total,
        paymentMethod: payload.paymentMethod,
      });

      if (!isOnline) {
        const fullPayload = { ...payload, idempotencyKey };
        const result = await usePosStore.getState().completeOfflineSale(fullPayload, branchId, cashierId);
        if (!result) {
          exitProcessingState();
          throw new CheckoutSyncError('Failed to save offline sale', false);
        }
        return { queued: true, ...result };
      }

      const controller = new AbortController();
      const timeoutMs = 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch('/api/pos/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, idempotencyKey }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const message = errBody.error || errBody.message || `Checkout failed with status ${res.status}`;
          const errorCode = errBody.code || 'CHECKOUT_UNKNOWN';
          const details = errBody.details;
          logger.error('checkout: server error', { idempotencyKey, requestId: errorCode, status: res.status, message, details });
          if (res.status === 401) throw new CheckoutAuthError(message);
          if (res.status === 409) {
            throw new CheckoutDuplicateError(errBody.saleId || '', errBody.receiptNo || '');
          }
          if (res.status === 504) throw new CheckoutTimeoutError(timeoutMs);
          if (res.status === 404) throw new CheckoutError('CHECKOUT_NOT_FOUND', message, 404, details);
          if (res.status === 400) throw new CheckoutError(errorCode, message, 400, details);
          if (res.status >= 500) throw new CheckoutError(errorCode, message, 500, details);
          throw new CheckoutError(errorCode, message, res.status, details);
        }

        const data = await res.json();
        logger.info('checkout: server response', {
          idempotencyKey,
          response: data,
          status: res.status,
        });
        return data;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof CheckoutTimeoutError) throw err;
        if (err instanceof CheckoutAuthError) throw err;
        if (err instanceof CheckoutDuplicateError) throw err;
        if (err instanceof CheckoutError) throw err;
        if (err instanceof Error) {
          if (err.name === 'AbortError') throw new CheckoutTimeoutError(timeoutMs);
          throw new CheckoutError('CHECKOUT_NETWORK_ERROR', err.message, 0);
        }
        throw new CheckoutError('CHECKOUT_UNKNOWN_ERROR', 'An unexpected error occurred', 500);
      }
    },
    onSuccess: (data) => {
      checkoutFinishTimeRef.current = Date.now();
      const duration = checkoutFinishTimeRef.current - checkoutStartTimeRef.current;

      logger.info('checkout: mutation success', {
        idempotencyKey: idempotencyKeyRef.current,
        saleId: data.id || data.saleId,
        receiptNo: data.receiptNo || data.id,
        durationMs: duration,
        queued: data.queued,
        duplicate: data.duplicate || false,
        fullResponse: data,
      });

      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });

      exitProcessingState();

      if (data.queued) {
        usePosStore.getState().clearCart();
        toast({ title: 'Sale completed offline', description: `Receipt: ${data.receiptNo} (Pending Sync)` });
        onComplete(data.saleId, data.receiptNo);
        onOpenChange(false);
        resetForm();
        return;
      }

      if (data.duplicate) {
        logger.info('checkout: idempotency duplicate returned by server', {
          idempotencyKey: idempotencyKeyRef.current,
          saleId: data.id,
          receiptNo: data.receiptNo,
        });
        usePosStore.getState().clearCart();
        toast({ title: 'Sale already processed', description: `Receipt: ${data.receiptNo || data.id}. No duplicate created.` });
        onComplete(data.id, data.receiptNo);
        onOpenChange(false);
        resetForm();
        return;
      }

      usePosStore.getState().clearCart();
      toast({ title: 'Sale completed', description: `Receipt: ${data.receiptNo || data.id}` });
      onComplete(data.id, data.receiptNo);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: unknown) => {
      checkoutFinishTimeRef.current = Date.now();
      const duration = checkoutFinishTimeRef.current - checkoutStartTimeRef.current;

      logger.error('checkout: mutation error', err, {
        idempotencyKey: idempotencyKeyRef.current,
        durationMs: duration,
        checkoutStartTime: checkoutStartTimeRef.current,
        checkoutFinishTime: checkoutFinishTimeRef.current,
      });

      exitProcessingState();
      hasSubmittedRef.current = false;

      let description = 'An unexpected error occurred';
      let duplicateReason = '';
      if (isCheckoutError(err)) {
        switch (err.code) {
          case 'CHECKOUT_TIMEOUT':
            description = `Request timed out after ${err.details?.timeoutMs || 30000}ms. Please check your connection and try again.`;
            break;
          case 'CHECKOUT_UNAUTHORIZED':
            description = 'Session expired. Please log in again.';
            break;
          case 'CHECKOUT_INSUFFICIENT_STOCK':
            description = `Stock issue: ${err.message}`;
            break;
          case 'CHECKOUT_PRODUCT_NOT_FOUND':
            description = `Product not found: ${err.details?.productName || err.details?.productId || 'Unknown product'}. Check that the product exists.`;
            break;
          case 'CHECKOUT_DUPLICATE_SALE':
            duplicateReason = 'Idempotency key matched an existing sale on the server (CHECKOUT_DUPLICATE_SALE)';
            description = `Duplicate sale detected${err.details?.receiptNo ? ': ' + err.details.receiptNo : ''}. This sale may have already been processed.`;
            if (err.details?.saleId) {
              onComplete(err.details.saleId as string, err.details.receiptNo as string | undefined);
            }
            break;
          case 'CHECKOUT_DUPLICATE':
            duplicateReason = 'Unique constraint violation on idempotency key or sale ID (CHECKOUT_DUPLICATE)';
            description = `Duplicate sale detected${err.details?.receiptNo ? ': ' + err.details.receiptNo : ''}. This sale may have already been processed.`;
            if (err.details?.saleId) {
              onComplete(err.details.saleId as string, err.details.receiptNo as string | undefined);
            }
            break;
          case 'CHECKOUT_SYNC_FAILED':
            description = err.details?.retryable
              ? 'Network error. Sale saved offline and will sync when connection is restored.'
              : 'Failed to save offline sale. Please try again.';
            break;
          case 'CHECKOUT_BRANCH_NOT_FOUND':
            description = 'Branch settings not found. Please contact your administrator.';
            break;
          case 'CHECKOUT_DATABASE':
            description = `Database error: ${err.message}. Please try again or contact support.`;
            break;
          case 'CHECKOUT_FOREIGN_KEY':
            description = 'A referenced record was not found. Please check the product and try again.';
            break;
          case 'CHECKOUT_NOT_FOUND':
            description = err.message;
            break;
          case 'CHECKOUT_DEADLOCK':
            description = 'A transaction conflict occurred. Please try again.';
            break;
          case 'CHECKOUT_UNKNOWN':
            description = err.message || 'An unknown error occurred. Please try again.';
            break;
          default:
            description = err.message;
        }
      } else if (err instanceof Error) {
        description = err.message;
      }

      if (duplicateReason) {
        logger.warn('checkout: duplicate detected during error handling', {
          idempotencyKey: idempotencyKeyRef.current,
          reason: duplicateReason,
          checkoutDurationMs: duration,
        });
      }

      toast({ title: 'Checkout failed', description, variant: 'destructive' });
    },
  });

  const isProcessing = checkoutMutation.isPending;
  const isLocked = isProcessing || checkoutLocked;

  const handleSubmit = () => {
    if (isLocked || hasSubmittedRef.current) {
      logger.warn('checkout: duplicate click blocked', {
        idempotencyKey: idempotencyKeyRef.current,
        isProcessing,
        checkoutLocked,
        hasSubmitted: hasSubmittedRef.current,
      });
      return;
    }

    checkoutStartTimeRef.current = Date.now();
    checkoutFinishTimeRef.current = 0;
    hasSubmittedRef.current = true;

    logger.info('checkout: start', {
      idempotencyKey: idempotencyKeyRef.current,
      cashierId,
      branchId,
      itemCount: items.length,
      totalAmount: total,
      paymentMethod: method,
    });

    if (method === 'CASH' && cashNum < total) {
      toast({ title: 'Insufficient cash', description: `Need ${formatCurrency(total - cashNum)} more`, variant: 'destructive' });
      hasSubmittedRef.current = false;
      return;
    }
    if (method === 'CARD' && !cardRef.trim()) {
      toast({ title: 'Card reference required', description: 'Enter card transaction reference', variant: 'destructive' });
      hasSubmittedRef.current = false;
      return;
    }
    if (method === 'BANK_TRANSFER' && !transferRef.trim()) {
      toast({ title: 'Transfer reference required', description: 'Enter bank transfer reference', variant: 'destructive' });
      hasSubmittedRef.current = false;
      return;
    }
    if (method === 'MOBILE_MONEY' && !mobileRef.trim()) {
      toast({ title: 'Mobile money reference required', description: 'Enter mobile money reference', variant: 'destructive' });
      hasSubmittedRef.current = false;
      return;
    }

    const payload: Record<string, unknown> = {
      idempotencyKey: idempotencyKeyRef.current,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.total,
        notes: i.notes,
      })),
      customerId: customer?.id,
      customerName: customerName || customer?.name || null,
      customerPhone: customer?.phone || null,
      customerPin: customerPin || customer?.pin || null,
      customerTin: customerTin || customer?.tin || null,
      paymentMethod: method,
      amountPaid: method === 'CASH' ? cashNum : total,
      changeAmount: change,
      notes,
      subtotal,
      discountAmount: totalDiscount,
      totalAmount: total,
    };

    if (method === 'SPLIT') {
      const cashSplit = parseFloat(splitAmounts.cash || '0');
      const cardSplit = parseFloat(splitAmounts.card || '0');
      const totalSplit = cashSplit + cardSplit;
      if (Math.abs(totalSplit - total) > 0.01) {
        toast({ title: 'Split amounts must equal total', description: `Total: ${formatCurrency(total)}`, variant: 'destructive' });
        hasSubmittedRef.current = false;
        return;
      }
      payload.splitPayments = [
        { method: 'CASH', amount: cashSplit, reference: splitAmounts.cashRef },
        { method: 'CARD', amount: cardSplit, reference: splitAmounts.cardRef },
      ];
    }

    checkoutMutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4 self-start sm:self-center">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            {isOnline ? 'Checkout' : 'Checkout (Offline)'}
          </DialogTitle>
          <DialogDescription>
            {isProcessing ? 'Processing sale...' : `Complete payment for ${items.length} item(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Customer Name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="h-10"
                disabled={isLocked}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Customer PIN</label>
                <Input
                  value={customerPin}
                  onChange={(e) => setCustomerPin(e.target.value)}
                  placeholder="Enter PIN"
                  className="h-10"
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Customer TIN</label>
                <Input
                  value={customerTin}
                  onChange={(e) => setCustomerTin(e.target.value)}
                  placeholder="Enter TIN"
                  className="h-10"
                  disabled={isLocked}
                />
              </div>
            </div>
            {!isOnline && (
              <div className="text-sm text-warning">
                You are offline. Sale will be saved locally and synced when connection is restored.
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing sale...</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {((['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SPLIT'] as PaymentMethod[])).map((m) => (
                <button
                  key={m}
                  onClick={() => { if (!isLocked) setMethod(m); }}
                  disabled={isLocked}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-all ${
                    method === m && !isLocked
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : isLocked
                        ? 'opacity-50 cursor-not-allowed border-border'
                        : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  {paymentIcons[m]}
                  <span className="text-xs font-medium">{m.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </div>

          {method === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Cash Received</label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="h-12 text-lg"
                  autoFocus
                  disabled={isLocked}
                />
              </div>
              {cashNum > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Change</span>
                  <span className="font-semibold text-success">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          {method === 'CARD' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Card Reference / Last 4 Digits</label>
              <Input
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                placeholder="e.g. POS-123456"
                className="h-11"
                disabled={isLocked}
              />
            </div>
          )}

          {method === 'BANK_TRANSFER' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Transfer Reference</label>
              <Input
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="e.g. TXN-789012"
                className="h-11"
                disabled={isLocked}
              />
            </div>
          )}

          {method === 'MOBILE_MONEY' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Mobile Money Reference</label>
              <Input
                value={mobileRef}
                onChange={(e) => setMobileRef(e.target.value)}
                placeholder="e.g. MM-345678"
                className="h-11"
                disabled={isLocked}
              />
            </div>
          )}

          {method === 'SPLIT' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Cash Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={splitAmounts.cash || ''}
                    onChange={(e) => setSplitAmounts((s) => ({ ...s, cash: e.target.value }))}
                    placeholder="0.00"
                    className="h-11"
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Card Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={splitAmounts.card || ''}
                    onChange={(e) => setSplitAmounts((s) => ({ ...s, card: e.target.value }))}
                    placeholder="0.00"
                    className="h-11"
                    disabled={isLocked}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total split</span>
                <span>{formatCurrency((parseFloat(splitAmounts.cash || '0') + parseFloat(splitAmounts.card || '0')))}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Sale Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              className="h-11"
              disabled={isLocked}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sticky bottom-0 bg-background pb-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12" disabled={isLocked}>
              Cancel (ESC)
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLocked}
              className="flex-1 h-12 gap-2"
              style={{ touchAction: 'manipulation' }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Complete Sale
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}