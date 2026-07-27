'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/sidebar';
import { CheckCircle2, ShoppingCart, Printer, Download, Share2, FileText } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { formatCurrency, formatDate, calculateVatBreakdown } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useQuery } from '@tanstack/react-query';
import { type ReceiptData, type ReceiptItem } from '@/components/pos/receipt';
import { ReceiptPreviewModal } from '@/components/pos/receipt-preview-modal';
import { receiptService, type PrintReceiptInput } from '@/lib/printer/receipt-service';
import type { ReceiptTemplate } from '@/lib/printer/receipt-template';

async function fetchPrinterConfigs() {
  const res = await fetch('/api/printer-configs');
  if (!res.ok) throw new Error('Failed to fetch printer configs');
  return res.json();
}

async function fetchReceipt(saleId: string) {
  const res = await fetch(`/api/pos/sales/${saleId}`);
  if (!res.ok) throw new Error('Failed to fetch receipt');
  return res.json();
}

function ReceiptActionsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
    refetchOnMount: true,
  });

  const { data: printerConfigs = [] } = useQuery({
    queryKey: ['printer-configs'],
    queryFn: fetchPrinterConfigs,
  });

  const [offlineSale, setOfflineSale] = React.useState<ReceiptData | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [editableFields, setEditableFields] = React.useState({
    customerPin: '',
    customerTin: '',
    branchAddress: '',
    branchPhone: '',
    kraPin: '',
  });

  React.useEffect(() => {
    if (!saleId || sale) return;
    let cancelled = false;

    async function load() {
      setOfflineSale(null);
      if (!saleId) return;
      try {
        const { db } = await import('@/lib/offline/dexie-db');
        const item = await db.salesQueue.get(saleId);
        if (!item || !item.payload || cancelled) return;
        const payload = JSON.parse(item.payload) as {
          customerName?: string;
          customerPhone?: string;
          customerEmail?: string;
          items?: Array<{ productName: string; sku?: string; quantity: number; unitPrice: number; discount?: number; total: number }>;
          totalAmount?: number;
          amountPaid?: number;
          changeAmount?: number;
          paymentMethod?: string;
          notes?: string;
        };
        const receipt = await db.receipts.where('saleId').equals(saleId).first();
        const totalAmount = payload.totalAmount || parseFloat(total || '0');
        const amountPaid = payload.amountPaid || totalAmount;
        const changeAmount = payload.changeAmount || 0;
        const subtotal = calculateVatBreakdown(totalAmount).vatExclusive;
        const items = (payload.items || []).map((i) => ({
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: i.total,
        }));
        if (!cancelled) {
          setOfflineSale({
            shopName: 'Dite POS',
            receiptNo: receipt?.receiptNo || offlineReceiptNo || '',
            saleId,
            date: item.createdAt,
            cashierName: 'Current User',
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            customerEmail: payload.customerEmail,
            items,
            subtotal,
            discountAmount: items.reduce((sum, i) => sum + (i.discount || 0), 0),
            total: totalAmount,
            amountPaid,
            changeAmount,
            paymentMethod: payload.paymentMethod || 'CASH',
            currency: 'KES',
            currencySymbol: 'KSh',
            syncStatus: 'PENDING_SYNC',
            isOffline: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to parse offline sale payload', error);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [saleId, sale, offlineReceiptNo, total]);

  const receiptData: ReceiptData | null = React.useMemo(() => {
    const base = sale
      ? {
          shopName: sale.shopName || 'Dite POS',
          branchName: sale.branchName,
          branchAddress: sale.branchAddress,
          branchPhone: sale.branchPhone,
          branchEmail: sale.branchEmail,
          branchWebsite: sale.branchWebsite,
          kraPin: sale.kraPin,
          receiptNo: sale.receiptNo || offlineReceiptNo || '',
          saleId: sale.id,
          date: sale.createdAt,
          cashierName: sale.cashier?.name || 'Unknown',
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          customerEmail: sale.customerEmail,
          customerPin: sale.customerPin,
          saleNotes: sale.notes,
          items: (sale.items || []).map((i: ReceiptItem) => ({
            productName: i.productName,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
            total: i.total,
          })),
          subtotal: calculateVatBreakdown(sale.totalAmount || 0).vatExclusive,
          discountAmount: sale.discountAmount || 0,
          total: sale.totalAmount || 0,
          amountPaid: sale.amountPaid || 0,
          changeAmount: sale.changeAmount || 0,
          paymentMethod: sale.paymentMethod || 'CASH',
          paymentReference: sale.paymentReference,
          currency: sale.currency || 'KES',
          currencySymbol: sale.currencySymbol || 'KSh',
          footerText: sale.footerText,
          syncStatus: 'SYNCED',
        }
      : offlineSale;

    if (!base) return null;
    return {
      ...(base as ReceiptData),
      customerPin: editableFields.customerPin || base.customerPin,
      customerTin: editableFields.customerTin || (base as any).customerTin,
      branchAddress: editableFields.branchAddress || base.branchAddress,
      branchPhone: editableFields.branchPhone || base.branchPhone,
      kraPin: editableFields.kraPin || base.kraPin,
    };
  }, [sale, offlineSale, offlineReceiptNo, editableFields]);

  React.useEffect(() => {
    if (receiptData) {
      setEditableFields({
        customerPin: receiptData.customerPin || '',
        customerTin: (receiptData as any).customerTin || '',
        branchAddress: receiptData.branchAddress || '',
        branchPhone: receiptData.branchPhone || '',
        kraPin: receiptData.kraPin || '',
      });
    }
  }, [receiptData]);

  const [printTemplate, setPrintTemplate] = React.useState<ReceiptTemplate>('existing');

  const handlePrintThermal = async (size: '58mm' | '80mm') => {
    if (!receiptData) return;
    const config = printerConfigs[0];
    if (!config) {
      toast({ title: 'No printer configured. Please configure a printer in Settings.', variant: 'destructive' });
      return;
    }

    const printConfig = { ...config, paperSize: size };

    try {
      const saleData: PrintReceiptInput = {
        saleId: receiptData.saleId,
        receiptNo: receiptData.receiptNo,
        date: receiptData.date,
        time: new Date().toLocaleTimeString('en-KE'),
        cashierName: receiptData.cashierName,
        customerName: receiptData.customerName,
        customerPin: editableFields.customerPin || receiptData.customerPin || '',
        customerTin: editableFields.customerTin || '',
        country: 'Kenya',
        items: receiptData.items.map((i) => ({
          qty: i.quantity,
          description: i.productName,
          vatCode: 'A',
          unitPrice: i.unitPrice,
          discount: i.discount,
          lineTotal: i.total,
        })),
        subtotal: receiptData.subtotal,
        totalAmount: receiptData.total,
        cashReceived: receiptData.amountPaid,
        changeAmount: receiptData.changeAmount,
        controlUnitSerial: '0020105870000640339',
        controlUnitInvoice: '640339',
        attendedBy: receiptData.cashierName,
        companyPin: editableFields.kraPin || receiptData.kraPin || '',
        companyAddress: editableFields.branchAddress || receiptData.branchAddress || '',
        companyPoBox: '',
        companyPhone: editableFields.branchPhone || receiptData.branchPhone || '',
        shopName: receiptData.shopName || 'Dite POS',
        currency: receiptData.currency || 'KES',
        currencySymbol: receiptData.currencySymbol || 'KSh',
      };
      const result = await receiptService.printReceipt(saleData, printTemplate, printConfig);
      if (result.success) {
        toast({ title: 'Receipt sent to printer' });
      } else {
        toast({ title: result.message || 'Failed to print receipt', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to print receipt', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptData) return;
    try {
      const { jsPDF } = await import('jspdf');
      const isFiscal = printTemplate === 'fiscal';
      const isBoth = printTemplate === 'both';
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 6;

      const centerText = (y: number, text: string, fontSize = 10) => {
        doc.setFontSize(fontSize);
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
        return y + fontSize / 2.5;
      };

      const rightText = (y: number, label: string, value: string) => {
        doc.setFontSize(9);
        doc.text(`${label}: `, margin, y);
        doc.text(value, pageWidth - margin - doc.getTextWidth(value), y);
        return y + 4.5;
      };

      const drawExistingReceipt = () => {
        let y = margin;
        doc.setFont('helvetica', 'bold');
        y = centerText(y, receiptData!.shopName || 'Dite POS', 12);
        doc.setFont('helvetica', 'normal');
        if (receiptData!.branchName) y = centerText(y, receiptData!.branchName, 9);
        if (receiptData!.branchAddress) y = centerText(y, receiptData!.branchAddress, 8);
        if (receiptData!.branchPhone) y = centerText(y, receiptData!.branchPhone, 8);
        if (receiptData!.branchEmail) y = centerText(y, receiptData!.branchEmail, 8);
        if (receiptData!.branchWebsite) y = centerText(y, receiptData!.branchWebsite, 8);
        if (receiptData!.kraPin) y = centerText(y, `KRA PIN: ${receiptData!.kraPin}`, 8);

        y += 2;
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        y = centerText(y, 'RECEIPT', 10);
        y = rightText(y, 'Receipt No', receiptData!.receiptNo);
        y = rightText(y, 'Sale No', receiptData!.saleId);
        y = rightText(y, 'Date', formatDate(receiptData!.date));
        y = rightText(y, 'Cashier', receiptData!.cashierName);
        y = rightText(y, 'Customer', receiptData!.customerName || 'Walk-in Customer');
        if (receiptData!.paymentReference) y = rightText(y, 'Reference', receiptData!.paymentReference);
        if (receiptData!.syncStatus) y = rightText(y, 'Status', receiptData!.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced');
        if (receiptData!.isOffline) y = rightText(y, 'Mode', 'Offline');

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Item', margin, y);
        doc.text('Qty', pageWidth - margin, y);
        y += 3;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        receiptData!.items.forEach((item) => {
          const name = item.productName.length > 28 ? item.productName.slice(0, 28) + '...' : item.productName;
          doc.setFont('helvetica', 'bold');
          doc.text(name, margin, y);
          doc.setFont('helvetica', 'normal');
          const qtyPriceText = `${item.quantity} x ${formatCurrency(item.unitPrice, receiptData!.currency, receiptData!.currencySymbol)}`;
          doc.text(qtyPriceText, pageWidth - doc.getTextWidth(qtyPriceText), y);
          y += 4;
          doc.text(`Total: ${formatCurrency(item.total, receiptData!.currency, receiptData!.currencySymbol)}`, margin + 2, y);
          y += 5;
        });

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        const vat = calculateVatBreakdown(receiptData!.total);
        doc.setFont('helvetica', 'normal');
        y = rightText(y, 'Subtotal (VAT Exclusive)', formatCurrency(vat.vatExclusive, receiptData!.currency, receiptData!.currencySymbol));
        y = rightText(y, 'VAT (16%)', formatCurrency(vat.vatAmount, receiptData!.currency, receiptData!.currencySymbol));
        if (receiptData!.discountAmount > 0) y = rightText(y, 'Discount', `-${formatCurrency(receiptData!.discountAmount, receiptData!.currency, receiptData!.currencySymbol)}`);
        doc.setFont('helvetica', 'bold');
        y = rightText(y, 'Grand Total', formatCurrency(receiptData!.total, receiptData!.currency, receiptData!.currencySymbol));

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        y = rightText(y, 'Payment', receiptData!.paymentMethod);
        y = rightText(y, 'Paid', formatCurrency(receiptData!.amountPaid, receiptData!.currency, receiptData!.currencySymbol));
        if (receiptData!.changeAmount > 0) y = rightText(y, 'Change', formatCurrency(receiptData!.changeAmount, receiptData!.currency, receiptData!.currencySymbol));

        y += 4;
        y = centerText(y, 'Thank you for shopping with us.', 8);
        y = centerText(y, 'Please come again.', 8);
        if (receiptData!.footerText) y = centerText(y, receiptData!.footerText, 8);
        if (receiptData!.branchWebsite && !receiptData!.footerText) y = centerText(y, receiptData!.branchWebsite, 8);

        y += 3;
        centerText(y, 'All prices are VAT Inclusive.', 7);
      };

      const drawFiscalReceipt = () => {
        let y = margin;
        doc.setFont('helvetica', 'bold');
        y = centerText(y, receiptData!.shopName || 'Dite POS', 12);
        doc.setFont('helvetica', 'normal');
        if (editableFields.kraPin || receiptData!.kraPin) y = centerText(y, editableFields.kraPin || receiptData!.kraPin || '', 9);
        if (editableFields.branchAddress || receiptData!.branchAddress) y = centerText(y, editableFields.branchAddress || receiptData!.branchAddress || '', 8);
        if (editableFields.branchPhone || receiptData!.branchPhone) y = centerText(y, editableFields.branchPhone || receiptData!.branchPhone || '', 8);
        if (receiptData!.branchWebsite) y = centerText(y, receiptData!.branchWebsite, 8);

        y += 2;
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        y = centerText(y, 'FISCAL RECEIPT', 10);
        y = rightText(y, 'Receipt No', receiptData!.receiptNo);
        y = rightText(y, 'Date', formatDate(receiptData!.date));
        y = rightText(y, 'Time', new Date(receiptData!.date).toLocaleTimeString('en-KE'));
        y = rightText(y, 'Customer', receiptData!.customerName || 'Walk-in Customer');
        if (editableFields.customerPin || receiptData!.customerPin) y = rightText(y, 'Customer PIN', editableFields.customerPin || receiptData!.customerPin || '');
        if (editableFields.customerTin) y = rightText(y, 'Customer TIN', editableFields.customerTin);
        y = rightText(y, 'Country', 'Kenya');

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Qty', margin, y);
        doc.text('Description', margin + 12, y);
        doc.text('VAT', margin + 58, y);
        doc.text('Price', margin + 68, y);
        doc.text('Amount', pageWidth - margin, y);
        y += 3;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        receiptData!.items.forEach((item) => {
          const desc = item.productName.length > 18 ? item.productName.slice(0, 18) + '...' : item.productName;
          doc.setFont('helvetica', 'normal');
          doc.text(String(item.quantity), margin, y);
          doc.text(desc, margin + 12, y);
          doc.text('A', margin + 58, y);
          doc.text(formatCurrency(item.unitPrice, receiptData!.currency, receiptData!.currencySymbol), margin + 68, y);
          doc.text(formatCurrency(item.total, receiptData!.currency, receiptData!.currencySymbol), pageWidth - margin, y);
          y += 4;
        });

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        const vat = calculateVatBreakdown(receiptData!.total);
        doc.setFont('helvetica', 'normal');
        y = rightText(y, 'SUBTOTAL', formatCurrency(receiptData!.subtotal, receiptData!.currency, receiptData!.currencySymbol));
        y = rightText(y, 'TOTAL AMOUNT', formatCurrency(receiptData!.total, receiptData!.currency, receiptData!.currencySymbol));
        y = rightText(y, 'CASH', formatCurrency(receiptData!.amountPaid, receiptData!.currency, receiptData!.currencySymbol));
        if (receiptData!.changeAmount > 0) y = rightText(y, 'CHANGE', formatCurrency(receiptData!.changeAmount, receiptData!.currency, receiptData!.currencySymbol));

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        y = rightText(y, 'VAT CODE', 'A');
        y = rightText(y, 'RATE', '16%');
        y = rightText(y, 'TAXABLE AMOUNT', formatCurrency(vat.vatExclusive, receiptData!.currency, receiptData!.currencySymbol));
        y = rightText(y, 'VAT AMOUNT', formatCurrency(vat.vatAmount, receiptData!.currency, receiptData!.currencySymbol));

        y += 4;
        centerText(y, 'Thank you for your visit.', 8);
      };

      if (isBoth) {
        drawExistingReceipt();
        doc.addPage();
        drawFiscalReceipt();
        doc.save(`Receipt-${receiptData.receiptNo}-both.pdf`);
      } else if (isFiscal) {
        drawFiscalReceipt();
        doc.save(`Receipt-${receiptData.receiptNo}-fiscal.pdf`);
      } else {
        drawExistingReceipt();
        doc.save(`Receipt-${receiptData.receiptNo}.pdf`);
      }
      toast({ title: 'PDF downloaded' });
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!receiptData) return;
    const vat = calculateVatBreakdown(receiptData.total);
    const isFiscal = printTemplate === 'fiscal';
    const fullReceiptText = isFiscal ? [
      `${receiptData.shopName || 'Dite POS'}`,
      editableFields.kraPin || receiptData.kraPin || '',
      editableFields.branchAddress || receiptData.branchAddress || '',
      editableFields.branchPhone || receiptData.branchPhone || '',
      '',
      'FISCAL RECEIPT',
      '',
      `Receipt No: ${receiptData.receiptNo}`,
      `Date: ${formatDate(receiptData.date)}`,
      `Time: ${new Date(receiptData.date).toLocaleTimeString('en-KE')}`,
      `Customer: ${receiptData.customerName || 'Walk-in Customer'}`,
      `Customer PIN: ${editableFields.customerPin || receiptData.customerPin || ''}`,
      `Customer TIN: ${editableFields.customerTin || ''}`,
      `Country: Kenya`,
      '',
      'QTY  DESCRIPTION        VAT    PRICE       AMOUNT',
      ...receiptData.items.map(i => `${i.quantity}  ${i.productName}  A  ${formatCurrency(i.unitPrice, receiptData.currency, receiptData.currencySymbol)}  ${formatCurrency(i.total, receiptData.currency, receiptData.currencySymbol)}`),
      '',
      `SUBTOTAL: ${formatCurrency(receiptData.subtotal, receiptData.currency, receiptData.currencySymbol)}`,
      `TOTAL AMOUNT: ${formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol)}`,
      `CASH: ${formatCurrency(receiptData.amountPaid, receiptData.currency, receiptData.currencySymbol)}`,
      `CHANGE: ${formatCurrency(receiptData.changeAmount, receiptData.currency, receiptData.currencySymbol)}`,
      '',
      'VAT CODE  RATE   TAXABLE AMOUNT     VAT AMOUNT',
      `A         16%    ${formatCurrency(calculateVatBreakdown(receiptData.total).vatExclusive, receiptData.currency, receiptData.currencySymbol)}  ${formatCurrency(calculateVatBreakdown(receiptData.total).vatAmount, receiptData.currency, receiptData.currencySymbol)}`,
      '',
      'Thank you for your visit.',
    ].filter(Boolean).join('\n') : [
      `${receiptData.shopName || 'Dite POS'}`,
      receiptData.branchName,
      receiptData.branchAddress,
      receiptData.branchPhone,
      receiptData.branchEmail,
      receiptData.branchWebsite,
      receiptData.kraPin ? `KRA PIN: ${receiptData.kraPin}` : '',
      ``,
      `Receipt: ${receiptData.receiptNo}`,
      `Sale No: ${receiptData.saleId}`,
      `Date: ${formatDate(receiptData.date)}`,
      `Cashier: ${receiptData.cashierName}`,
      `Customer: ${receiptData.customerName || 'Walk-in Customer'}`,
      receiptData.paymentReference ? `Reference: ${receiptData.paymentReference}` : '',
      receiptData.syncStatus ? `Status: ${receiptData.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}` : '',
      receiptData.isOffline ? 'Mode: Offline' : '',
      ``,
      ...receiptData.items.map(i => `${i.productName}\n  ${i.quantity} x ${formatCurrency(i.unitPrice, receiptData.currency, receiptData.currencySymbol)}    ${formatCurrency(i.total, receiptData.currency, receiptData.currencySymbol)}`),
      ``,
      `Subtotal (VAT Exclusive): ${formatCurrency(vat.vatExclusive, receiptData.currency, receiptData.currencySymbol)}`,
      `VAT (16%): ${formatCurrency(vat.vatAmount, receiptData.currency, receiptData.currencySymbol)}`,
      receiptData.discountAmount > 0 ? `Discount: -${formatCurrency(receiptData.discountAmount, receiptData.currency, receiptData.currencySymbol)}` : '',
      `Grand Total: ${formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol)}`,
      ``,
      `Payment: ${receiptData.paymentMethod}`,
      `Paid: ${formatCurrency(receiptData.amountPaid, receiptData.currency, receiptData.currencySymbol)}`,
      `Change: ${formatCurrency(receiptData.changeAmount, receiptData.currency, receiptData.currencySymbol)}`,
      ``,
      'Thank you for shopping with us.',
      'Please come again.',
      'All prices are VAT Inclusive.',
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receiptData.receiptNo}`,
          text: fullReceiptText,
        });
      } catch {
        await navigator.clipboard.writeText(fullReceiptText);
        toast({ title: 'Receipt copied to clipboard' });
      }
    } else {
      await navigator.clipboard.writeText(fullReceiptText);
      toast({ title: 'Receipt copied to clipboard' });
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
                  <span className="font-medium">{receiptData.saleId}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol)}</span>
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
            <div className="col-span-2 sm:col-span-3 flex items-center gap-2 mb-2">
              <label htmlFor="checkout-template" className="text-sm font-medium">Template:</label>
              <select
                id="checkout-template"
                value={printTemplate}
                onChange={(e) => setPrintTemplate(e.target.value as ReceiptTemplate)}
                className="h-8 rounded border border-input bg-background px-2 text-sm"
              >
                <option value="existing">Existing Receipt</option>
                <option value="fiscal">Fiscal Receipt</option>
                <option value="both">Both Receipts</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-3 rounded-lg border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-medium">Receipt Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Customer PIN</label>
                  <Input value={editableFields.customerPin} onChange={(e) => setEditableFields((f) => ({ ...f, customerPin: e.target.value }))} placeholder="Enter customer PIN" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Customer TIN</label>
                  <Input value={editableFields.customerTin} onChange={(e) => setEditableFields((f) => ({ ...f, customerTin: e.target.value }))} placeholder="Enter customer TIN" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Branch PIN / KRA PIN</label>
                  <Input value={editableFields.kraPin} onChange={(e) => setEditableFields((f) => ({ ...f, kraPin: e.target.value }))} placeholder="Enter branch PIN" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Branch Phone</label>
                  <Input value={editableFields.branchPhone} onChange={(e) => setEditableFields((f) => ({ ...f, branchPhone: e.target.value }))} placeholder="Enter branch phone" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Branch Address</label>
                  <Input value={editableFields.branchAddress} onChange={(e) => setEditableFields((f) => ({ ...f, branchAddress: e.target.value }))} placeholder="Enter branch address" />
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={() => handlePrintThermal('58mm')} className="h-10 gap-2">
              <Printer className="h-4 w-4" />
              58mm
            </Button>
            <Button variant="outline" onClick={() => handlePrintThermal('80mm')} className="h-10 gap-2">
              <Printer className="h-4 w-4" />
              80mm
            </Button>
            <Button variant="outline" onClick={() => handleDownloadPDF()} className="h-10 gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={handleShare} className="h-10 gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(true)} className="h-10 gap-2">
              <FileText className="h-4 w-4" />
              View
            </Button>
            <Button onClick={handleNewSale} className="h-10 gap-2">
              <ShoppingCart className="h-4 w-4" />
              New Sale
            </Button>
          </div>
        </>
      )}
      {receiptData && showPreview && (
        <ReceiptPreviewModal
          saleId={saleId || receiptData.saleId}
          receiptNo={receiptData.receiptNo}
          onClose={() => setShowPreview(false)}
        />
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
