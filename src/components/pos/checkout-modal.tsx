'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Printer, CheckCircle2, CreditCard, Banknote, Building2, Smartphone, Split } from 'lucide-react';
import { Button, Input, Badge } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

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
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  customer: Customer | null;
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

export function CheckoutModal({ open, onOpenChange, items, customer, onComplete }: CheckoutModalProps) {
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = React.useState('');
  const [cardRef, setCardRef] = React.useState('');
  const [transferRef, setTransferRef] = React.useState('');
  const [mobileRef, setMobileRef] = React.useState('');
  const [splitAmounts, setSplitAmounts] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const taxAmount = subtotal * 0.16;
  const total = subtotal - totalDiscount + taxAmount;

  const cashNum = parseFloat(cashReceived) || 0;
  const change = method === 'CASH' ? Math.max(0, cashNum - total) : 0;

  const checkoutMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Checkout failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });
      toast({ title: 'Sale completed', description: `Receipt: ${data.receiptNo || data.id}` });
      onComplete(data.id, data.receiptNo);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Checkout failed', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setMethod('CASH');
    setCashReceived('');
    setCardRef('');
    setTransferRef('');
    setMobileRef('');
    setSplitAmounts({});
    setNotes('');
  };

  const handleSubmit = () => {
    if (method === 'CASH' && cashNum < total) {
      toast({ title: 'Insufficient cash', description: `Need ${formatCurrency(total - cashNum)} more`, variant: 'destructive' });
      return;
    }
    if (method === 'CARD' && !cardRef.trim()) {
      toast({ title: 'Card reference required', description: 'Enter card transaction reference', variant: 'destructive' });
      return;
    }
    if (method === 'BANK_TRANSFER' && !transferRef.trim()) {
      toast({ title: 'Transfer reference required', description: 'Enter bank transfer reference', variant: 'destructive' });
      return;
    }
    if (method === 'MOBILE_MONEY' && !mobileRef.trim()) {
      toast({ title: 'Mobile money reference required', description: 'Enter mobile money reference', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
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
      customerName: customer?.name,
      paymentMethod: method,
      amountPaid: method === 'CASH' ? cashNum : total,
      changeAmount: change,
      notes,
      taxAmount,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Checkout
          </DialogTitle>
          <DialogDescription>Complete payment for {items.length} item(s)</DialogDescription>
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
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax (16%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
            {customer && (
              <div className="text-sm text-muted-foreground">
                Customer: <span className="font-medium text-foreground">{customer.name}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SPLIT'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-all ${
                    method === m
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
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
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cash Reference (optional)</label>
                <Input
                  value={splitAmounts.cashRef || ''}
                  onChange={(e) => setSplitAmounts((s) => ({ ...s, cashRef: e.target.value }))}
                  placeholder="Cash reference"
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Card Reference (optional)</label>
                <Input
                  value={splitAmounts.cardRef || ''}
                  onChange={(e) => setSplitAmounts((s) => ({ ...s, cardRef: e.target.value }))}
                  placeholder="Card reference"
                  className="h-11"
                />
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
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12">
              Cancel (ESC)
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={checkoutMutation.isPending}
              className="flex-1 h-12 gap-2"
            >
              <Printer className="h-4 w-4" />
              {checkoutMutation.isPending ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
