'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, Clock, User, Tag } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface HeldSale {
  id: string;
  branchId: string;
  cashierId: string;
  customerName?: string;
  itemsJson: string;
  subtotal: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

interface HeldSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecall: (sale: HeldSale) => void;
}

export function HeldSalesModal({ open, onOpenChange, onRecall }: HeldSalesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: heldSales = [], isLoading } = useQuery({
    queryKey: ['pos-held-sales'],
    queryFn: async () => {
      const res = await fetch('/api/pos/held-sales', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch held sales');
      return res.json();
    },
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pos/held-sales/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });
      toast({ title: 'Held sale removed' });
    },
  });

  const handleRecall = (sale: HeldSale) => {
    onRecall(sale);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Held Transactions
          </DialogTitle>
          <DialogDescription>Recall a previously held sale</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Loading held sales...</p>
            </div>
          ) : heldSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No held transactions</p>
            </div>
          ) : (
            heldSales.map((sale: HeldSale) => {
              const items = JSON.parse(sale.itemsJson) as { name: string; quantity: number }[];
              return (
                <div
                  key={sale.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{sale.customerName || 'Walk-in'}</span>
                        <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.createdAt)}</p>
                      {sale.notes && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {sale.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(sale.totalAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-md bg-muted/50 p-2 space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="truncate flex-1">{item.name}</span>
                        <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRecall(sale)}
                      className="flex-1 gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Recall
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this held sale?')) {
                          deleteMutation.mutate(sale.id);
                        }
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
