'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, DollarSign, CreditCard, Smartphone, Building2, Split, Receipt } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Sale {
  id: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  customerName?: string;
  items: { name: string; quantity: number; total: number }[];
}

interface Summary {
  count: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalMobile: number;
  totalTransfer: number;
  totalSplit: number;
}

interface CashierSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function CashierSummaryModal({ open, onOpenChange, userId }: CashierSummaryModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['pos-cashier-summary', userId],
    queryFn: async () => {
      const res = await fetch('/api/pos/cashier-summary');
      if (!res.ok) throw new Error('Failed to fetch cashier summary');
      return res.json() as Promise<{ sales: Sale[]; summary: Summary }>;
    },
    enabled: open,
  });

  const summary = data?.summary;
  const sales = data?.sales || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Daily Cashier Summary
          </DialogTitle>
          <DialogDescription>Sales summary for today</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Loading summary...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalSales)}</p>
                  <p className="text-xs text-muted-foreground">{summary.count} transactions</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalCash)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Card</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalCard)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Mobile Money</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalMobile)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Bank Transfer</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalTransfer)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Split</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalSplit)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Net Sales</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalSales)}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No sales recorded today
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="text-sm">{formatDate(sale.createdAt)}</TableCell>
                          <TableCell className="text-sm">{sale.customerName || 'Walk-in'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {sale.paymentMethod.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {sale.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
