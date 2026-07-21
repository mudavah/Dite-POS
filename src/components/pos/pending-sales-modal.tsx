'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, DollarSign, User, Tag } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PendingSale {
  id: string;
  branchId: string;
  cashierId: string;
  cashier: { id: string; name: string; email: string };
  branch: { id: string; name: string; code: string };
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    notes?: string;
    product?: { name: string; sku: string; price: number };
  }[];
}

interface PendingSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (saleId: string, receiptNo?: string) => void;
}

export function PendingSalesModal({ open, onOpenChange, onComplete }: PendingSalesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pos-pending-sales'],
    queryFn: async () => {
      const res = await fetch('/api/pos/pending-sales', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch pending sales');
      return res.json();
    },
    enabled: open,
  });

  const completeMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await fetch(`/api/pos/pending-sales/${saleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to complete sale');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-pending-sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Sale completed', description: `Receipt: ${data.receiptNo || data.id}` });
      onComplete?.(data.id, data.receiptNo);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to complete sale', description: err.message, variant: 'destructive' });
    },
  });

  const handleComplete = (saleId: string) => {
    completeMutation.mutate(saleId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Sales
          </DialogTitle>
          <DialogDescription>Complete payment for pending sales</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Loading pending sales...</p>
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No pending sales</p>
            </div>
          ) : (
            pendingSales.map((sale: PendingSale) => (
              <div key={sale.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">#{sale.id.slice(-8)}</span>
                      <Badge variant="warning" className="text-xs">PENDING</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {sale.cashier?.name || 'Unknown'}
                      </span>
                      <span>{sale.branch?.name || '-'}</span>
                      <span>{formatDate(sale.createdAt)}</span>
                    </div>
                    {sale.customerName && (
                      <p className="text-xs text-muted-foreground">
                        Customer: <span className="font-medium text-foreground">{sale.customerName}</span>
                      </p>
                    )}
                    {sale.notes && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {sale.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(sale.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{sale.paymentMethod}</p>
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 p-2 space-y-1">
                  {sale.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="truncate flex-1">
                        {item.productName} x{item.quantity}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-medium">{formatCurrency(sale.amountPaid)}</span>
                </div>
                {sale.changeAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change:</span>
                    <span className="font-medium text-success">{formatCurrency(sale.changeAmount)}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleComplete(sale.id)}
                    disabled={completeMutation.isPending}
                    className="flex-1 gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    {completeMutation.isPending ? 'Processing...' : 'Complete Sale'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
