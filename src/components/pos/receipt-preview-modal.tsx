'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ReceiptPreviewModalProps {
  saleId: string;
  receiptNo?: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ saleId, receiptNo, onClose }: ReceiptPreviewModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      const res = await fetch(`/api/pos/sales/${saleId}`);
      if (!res.ok) throw new Error('Failed to fetch sale');
      return res.json();
    },
  });

  const handlePrint = async () => {
    try {
      const res = await fetch('/api/printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'print',
          data: {
            receiptNo: receiptNo || data?.receiptNo,
            date: data?.createdAt || new Date().toISOString(),
            cashier: data?.cashier?.name || 'Unknown',
            customerName: data?.customerName,
            items: data?.items?.map((i: any) => ({
              name: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
            subtotal: data?.subtotal,
            tax: data?.taxAmount,
            total: data?.totalAmount,
            paymentMethod: data?.paymentMethod,
            amountPaid: data?.amountPaid,
            change: data?.changeAmount,
          },
        }),
      });
      if (res.ok) {
        alert('Receipt sent to printer');
      }
    } catch {
      alert('Failed to print receipt');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receipt Preview
          </DialogTitle>
          <DialogDescription>
            {receiptNo ? `Receipt: ${receiptNo}` : 'Review before printing'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Loading receipt...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm space-y-2">
              <div className="text-center border-b border-dashed border-border pb-2">
                <p className="font-bold text-lg">DITE POS</p>
                <p className="text-xs text-muted-foreground">Point of Sale System</p>
              </div>
              <div className="flex justify-between text-xs">
                <span>Receipt:</span>
                <span>{receiptNo || '---'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Date:</span>
                <span>{data?.createdAt ? formatDate(data.createdAt) : '---'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Cashier:</span>
                <span>{data?.cashier?.name || 'Unknown'}</span>
              </div>
              {data?.customerName && (
                <div className="flex justify-between text-xs">
                  <span>Customer:</span>
                  <span>{data.customerName}</span>
                </div>
              )}
              <div className="border-t border-dashed border-border pt-2 mt-2">
                {data?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="flex-1">{item.productName} x{item.quantity}</span>
                    <span className="ml-2">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-border pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Subtotal</span>
                  <span>{formatCurrency(data?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Tax (16%)</span>
                  <span>{formatCurrency(data?.taxAmount || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                  <span>TOTAL</span>
                  <span>{formatCurrency(data?.totalAmount || 0)}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-border pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Payment</span>
                  <span>{data?.paymentMethod?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Paid</span>
                  <span>{formatCurrency(data?.amountPaid || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Change</span>
                  <span>{formatCurrency(data?.changeAmount || 0)}</span>
                </div>
              </div>
              <div className="text-center text-xs text-muted-foreground pt-2 border-t border-dashed border-border">
                Thank you for your purchase!
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button onClick={handlePrint} className="flex-1 gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
