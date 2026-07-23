'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/sidebar';
import { CheckCircle2, ShoppingCart, Printer, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Receipt, type ReceiptData, type ReceiptItem } from '@/components/pos/receipt';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { logger } from '@/lib/logger';

async function fetchReceipt(saleId: string) {
  const res = await fetch(`/api/pos/sales/${saleId}`);
  if (!res.ok) throw new Error('Failed to fetch receipt');
  return res.json();
}

function ReceiptActionsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const saleId = searchParams.get('saleId');
  const offlineReceiptNo = searchParams.get('receiptNo');
  const total = searchParams.get('total');

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      if (!saleId) throw new Error('Missing sale ID');
      return fetchReceipt(saleId);
    },
    enabled: !!saleId,
    retry: 1,
    staleTime: 60_000,
  });

  const [offlineSale, setOfflineSale] = React.useState<ReceiptData | null>(null);
  React.useEffect(() => {
    if (!saleId || sale) return;
    import('@/lib/offline/dexie-db').then(({ db }) => {
      db.salesQueue.get(saleId).then((item) => {
        if (item && item.payload) {
          try {
            const payload = JSON.parse(item.payload) as {
              customerName?: string;
              items?: Array<{ productName: string; sku?: string; quantity: number; unitPrice: number; discount?: number; total: number }>;
              totalAmount?: number;
              amountPaid?: number;
              changeAmount?: number;
              paymentMethod?: string;
            };
            db.receipts.where('saleId').equals(saleId).first().then((receipt) => {
              setOfflineSale({
                shopName: 'Dite POS',
                receiptNo: receipt?.receiptNo || offlineReceiptNo || '',
                saleId,
                date: item.createdAt,
                cashierName: 'Current User',
                customerName: payload.customerName,
                items: (payload.items || []).map((i) => ({
                  productName: i.productName,
                  sku: i.sku,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  discount: i.discount || 0,
                  total: i.total,
                })),
                subtotal: (payload.items || []).reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
                discountAmount: (payload.items || []).reduce((sum, i) => sum + (i.discount || 0), 0),
                total: payload.totalAmount || parseFloat(total || '0'),
                amountPaid: payload.amountPaid || parseFloat(total || '0'),
                changeAmount: payload.changeAmount || 0,
                paymentMethod: payload.paymentMethod || 'CASH',
                currency: 'KES',
                currencySymbol: 'KSh',
                syncStatus: 'PENDING_SYNC',
                isOffline: true,
              });
            });
          } catch (error) {
            logger.error('Failed to parse offline sale payload', error);
          }
        }
      });
    });
  }, [saleId, sale, offlineReceiptNo, total]);

  const receiptData: ReceiptData | null = React.useMemo(() => {
    if (sale) {
      return {
        shopName: sale.shopName || 'Dite POS',
        branchName: sale.branchName,
        branchAddress: sale.branchAddress,
        branchPhone: sale.branchPhone,
        receiptNo: sale.receiptNo || offlineReceiptNo || '',
        saleId: sale.id,
        date: sale.createdAt,
        cashierName: sale.cashier?.name || 'Unknown',
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        items: (sale.items || []).map((i: ReceiptItem) => ({
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: i.total,
        })),
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        total: sale.totalAmount,
        amountPaid: sale.amountPaid,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.paymentMethod,
        currency: sale.currency || 'KES',
        currencySymbol: sale.currencySymbol || 'KSh',
        footerText: sale.footerText,
        syncStatus: 'SYNCED',
      };
    }
    return offlineSale;
  }, [sale, offlineSale, offlineReceiptNo]);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${receiptData?.receiptNo || 'draft'}`,
    pageStyle: `
      @page {
        size: auto;
        margin: 0mm;
      }
    `,
  });

  const handlePrintThermal = async (size: '58mm' | '80mm') => {
    if (!receiptData) return;
    try {
      const res = await fetch('/api/printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'print',
          paperSize: size,
          data: receiptData,
        }),
      });
      if (res.ok) {
        toast({ title: 'Receipt sent to printer' });
      } else {
        toast({ title: 'Failed to print receipt', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to print receipt', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptData) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
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

      if (receiptData.syncStatus) {
        rightText('Status', receiptData.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced');
      }
      if (receiptData.isOffline) {
        rightText('Mode', 'Offline');
      }

      y += 5;
      centerText('Thank you for shopping!', 9);

      doc.save(`Receipt-${receiptData.receiptNo}.pdf`);
      toast({ title: 'PDF downloaded' });
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
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
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(`Receipt: ${receiptData.receiptNo}\nTotal: ${formatCurrency(receiptData.total)}`);
      toast({ title: 'Receipt details copied to clipboard' });
    }
  };

  const handleNewSale = () => {
    router.push('/pos');
  };

  if (isLoading || (!receiptData && !offlineSale)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h1 className="text-2xl font-bold">Payment Complete</h1>
        <p className="text-muted-foreground">Sale completed successfully</p>
      </div>

      {receiptData && (
        <>
          <div className="hidden print:block">
            <div id="receipt-print-area" ref={receiptRef}>
              <Receipt data={receiptData} format="full" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                {receiptData.receiptNo && (
                  <div>
                    <span className="text-muted-foreground">Receipt: </span>
                    <span className="font-medium">{receiptData.receiptNo}</span>
                  </div>
                )}
                {receiptData.saleId && (
                  <div>
                    <span className="text-muted-foreground">Sale ID: </span>
                    <span className="font-medium">{receiptData.saleId.slice(-8)}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-medium">{formatCurrency(receiptData.total)}</span>
                </div>
                {receiptData.syncStatus && (
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className={`font-medium ${receiptData.syncStatus === 'PENDING_SYNC' ? 'text-warning' : 'text-success'}`}>
                      {receiptData.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}
                    </span>
                  </div>
                )}
                {receiptData.isOffline && (
                  <div>
                    <span className="text-muted-foreground">Mode: </span>
                    <span className="font-medium text-warning">Offline</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => handlePrintThermal('58mm')} className="h-10 gap-2">
                <Printer className="h-4 w-4" />
                58mm
              </Button>
              <Button variant="outline" onClick={() => handlePrintThermal('80mm')} className="h-10 gap-2">
                <Printer className="h-4 w-4" />
                80mm
              </Button>
              <Button variant="outline" onClick={handlePrint} className="h-10 gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} className="h-10 gap-2">
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={handleShare} className="h-10 gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button onClick={handleNewSale} className="h-10 gap-2">
                <ShoppingCart className="h-4 w-4" />
                New Sale
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CheckoutCompletePage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading...</p></div>}>
        <ReceiptActionsInner />
      </Suspense>
    </AppLayout>
  );
}
