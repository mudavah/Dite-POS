'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useMiniPrinter } from '@/hooks/use-mini-printer';
import { buildEscpos, type ReceiptData } from '@/lib/printer/receipt-template';
import { Receipt, type ReceiptItem } from '@/components/pos/receipt';

interface ReceiptPreviewModalProps {
  saleId: string;
  receiptNo?: string;
  onClose: () => void;
  onReprint?: () => void;
}

export function ReceiptPreviewModal({ saleId, receiptNo, onClose, onReprint }: ReceiptPreviewModalProps) {
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

  const receiptData: ReceiptData | null = React.useMemo(() => {
    if (!data) return null;
    return {
      shopName: data.shopName || 'Dite POS',
      branchName: data.branchName,
      branchAddress: data.branchAddress,
      branchPhone: data.branchPhone,
      receiptNo: receiptNo || data.receiptNo,
      saleId: data.id,
      date: data.createdAt || new Date().toISOString(),
      cashierName: data.cashier?.name || 'Unknown',
      customerName: data.customerName,
      customerPhone: data.customerPhone,
        items: (data.items || []).map((i: ReceiptItem) => ({
          productName: i.productName || 'Unknown',
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: i.total,
        })),
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
  }, [data, receiptNo]);

  const handlePrint = async () => {
    if (!receiptData) return;

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
        onReprint?.();
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
        config: printerConfig ? { ...printerConfig, ipAddress: printerConfig.ipAddress, port: printerConfig.port, macAddress: printerConfig.macAddress } : undefined,
        data: receiptData,
      }),
    });
    if (res.ok) {
      alert('Receipt sent to printer');
      onReprint?.();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Failed to print receipt');
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptData) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const centerText = (text: string, fontSize = 10) => {
        doc.setFontSize(fontSize);
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
        y += fontSize / 2.5;
      };

      const rightText = (label: string, value: string) => {
        doc.setFontSize(9);
        doc.text(`${label}: `, margin, y);
        doc.text(value, pageWidth - margin - doc.getTextWidth(value), y);
        y += 5;
      };

      doc.setFont('helvetica', 'bold');
      centerText(receiptData.shopName || 'Dite POS', 14);
      doc.setFont('helvetica', 'normal');
      if (receiptData.branchName) centerText(receiptData.branchName, 10);
      if (receiptData.branchAddress) centerText(receiptData.branchAddress, 9);
      if (receiptData.branchPhone) centerText(receiptData.branchPhone, 9);

      y += 3;
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      centerText('RECEIPT', 10);
      rightText('Receipt No', receiptData.receiptNo);
      rightText('Sale ID', receiptData.saleId.slice(-8));
      rightText('Date', formatDate(receiptData.date));
      rightText('Cashier', receiptData.cashierName);
      if (receiptData.customerName) {
        rightText('Customer', receiptData.customerName);
      }

      y += 3;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Item', margin, y);
      doc.text('Qty', pageWidth / 2, y);
      doc.text('Total', pageWidth - margin, y);
      y += 3;
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      receiptData.items.forEach((item) => {
        const name = item.productName.length > 25 ? item.productName.slice(0, 25) + '...' : item.productName;
        doc.text(name, margin, y);
        doc.text(String(item.quantity), pageWidth / 2, y);
        doc.text(formatCurrency(item.total), pageWidth - margin, y);
        y += 5;
      });

      y += 2;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      rightText('Subtotal', formatCurrency(receiptData.subtotal));
      if (receiptData.discountAmount > 0) {
        rightText('Discount', `-${formatCurrency(receiptData.discountAmount)}`);
      }
      doc.setFont('helvetica', 'bold');
      rightText('TOTAL', formatCurrency(receiptData.total));

      y += 3;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      rightText('Payment', receiptData.paymentMethod);
      rightText('Paid', formatCurrency(receiptData.amountPaid));
      if (receiptData.changeAmount > 0) {
        rightText('Change', formatCurrency(receiptData.changeAmount));
      }

      y += 3;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      centerText('Thank you for shopping!', 9);

      doc.save(`Receipt-${receiptData.receiptNo}.pdf`);
      onReprint?.();
    } catch {
      alert('Failed to generate PDF');
    }
  };

  const handleShare = async () => {
    if (!receiptData) return;
    const shareData = {
      title: `Receipt ${receiptData.receiptNo}`,
      text: `Receipt: ${receiptData.receiptNo}\nTotal: ${formatCurrency(receiptData.total)}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onReprint?.();
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(`Receipt: ${receiptData.receiptNo}\nTotal: ${formatCurrency(receiptData.total)}`);
      alert('Receipt details copied to clipboard');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        ) : receiptData ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Receipt data={receiptData} format="full" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-1 gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Receipt not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
