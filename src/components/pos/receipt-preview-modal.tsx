'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Printer, Download, Usb, Bluetooth, Wifi } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useMiniPrinter } from '@/hooks/use-mini-printer';
import { buildEscpos, type ReceiptData } from '@/lib/printer/receipt-template';

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

  const { data: printerConfigs = [] } = useQuery({
    queryKey: ['printer-configs'],
    queryFn: async () => {
      const res = await fetch('/api/printer-configs');
      if (!res.ok) throw new Error('Failed to fetch printer configs');
      return res.json();
    },
  });

  const printerConfig = printerConfigs[0];
  const printerType = printerConfig?.type || 'NETWORK';
  const { printer: miniPrinter, connect, print } = useMiniPrinter();

  const handlePrint = async () => {
    try {
      if (!data) return;

      const receiptData: ReceiptData = {
        shopName: data.shopName || 'Dite POS',
        branchName: data.branchName,
        branchAddress: data.branchAddress,
        branchPhone: data.branchPhone,
        receiptNo: receiptNo || data.receiptNo,
        date: data.createdAt || new Date().toISOString(),
        cashierName: data.cashier?.name || 'Unknown',
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        items: data.items?.map((i: any) => ({
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: i.total,
          notes: i.notes,
        })) || [],
        subtotal: data.subtotal || 0,
        discountAmount: data.discountAmount || 0,
        total: data.totalAmount || 0,
        amountPaid: data.amountPaid || 0,
        changeAmount: data.changeAmount || 0,
        paymentMethod: data.paymentMethod || 'CASH',
        currency: data.currency || 'KES',
        currencySymbol: data.currencySymbol || 'KSh',
        footerText: data.footerText,
      };

      if (printerType === 'USB' || printerType === 'BLUETOOTH') {
        if (!miniPrinter.connected) {
          const connected = await connect();
          if (!connected) {
            alert('Failed to connect to printer');
            return;
          }
        }
        const escposData = buildEscpos(receiptData, printerConfig?.paperSize || '80mm');
        const success = await print(escposData);
        if (success) {
          alert('Receipt sent to printer');
        } else {
          alert(miniPrinter.error || 'Failed to print receipt');
        }
        return;
      }

      const res = await fetch('/api/printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'print',
          config: printerType === 'NETWORK' ? { endpoint: printerConfig?.endpoint, paperSize: printerConfig?.paperSize } : undefined,
          data: receiptData,
        }),
      });
      if (res.ok) {
        alert('Receipt sent to printer');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to print receipt');
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
            <Printer className="h-5 w-5" />
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
                <p className="font-bold text-lg">{data?.shopName || 'DITE POS'}</p>
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
