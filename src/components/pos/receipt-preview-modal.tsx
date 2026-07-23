'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Share2, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate, calculateVatBreakdown } from '@/lib/utils';
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
    const vat = calculateVatBreakdown(data.totalAmount || 0);
    const qrData = data.receiptNo || data.id;
    return {
      shopName: data.shopName || 'Dite POS',
      branchName: data.branchName,
      branchAddress: data.branchAddress,
      branchPhone: data.branchPhone,
      branchEmail: data.branchEmail,
      branchWebsite: data.branchWebsite,
      kraPin: data.kraPin,
      receiptNo: receiptNo || data.receiptNo,
      saleId: data.id,
      date: data.createdAt || new Date().toISOString(),
      cashierName: data.cashier?.name || 'Unknown',
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      customerPin: data.customerPin,
      saleNotes: data.notes,
      items: (data.items || []).map((i: ReceiptItem) => ({
        productName: i.productName || 'Unknown',
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        total: i.total,
      })),
      subtotal: vat.vatExclusive,
      discountAmount: data.discountAmount || 0,
      total: data.totalAmount || 0,
      amountPaid: data.amountPaid || 0,
      changeAmount: data.changeAmount || 0,
      paymentMethod: data.paymentMethod || 'CASH',
      paymentReference: data.paymentReference,
      currency: data.currency || 'KES',
      currencySymbol: data.currencySymbol || 'KSh',
      footerText: data.footerText,
      syncStatus: 'SYNCED',
      qrData,
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
        config: printerConfig ? {
          ...printerConfig,
          ipAddress: printerConfig.ipAddress,
          port: printerConfig.port,
          macAddress: printerConfig.macAddress,
        } : undefined,
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

  function escapeHtmlAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const generateFullHtml = React.useCallback(() => {
    if (!receiptData) return '';
    const vat = calculateVatBreakdown(receiptData.total);
    const displayCustomer = receiptData.customerName || 'Walk-in Customer';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt ${escapeHtmlAttr(receiptData.receiptNo)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #0f172a; }
  .page { max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .center { text-align: center; }
  .text-sm { font-size: 14px; }
  .text-xs { font-size: 12px; color: #64748b; }
  .font-medium { font-weight: 500; }
  .font-bold { font-weight: 700; }
  .mt-1 { margin-top: 4px; }
  .mt-2 { margin-top: 8px; }
  .mt-3 { margin-top: 12px; }
  .space-y-1 > * + * { margin-top: 4px; }
  .space-y-2 > * + * { margin-top: 8px; }
  .space-y-3 > * + * { margin-top: 12px; }
  .border-t { border-top: 1px dashed #cbd5e1; }
  .border-b { border-bottom: 1px dashed #cbd5e1; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .gap-2 { gap: 8px; }
  .pt-3 { padding-top: 12px; }
  .pb-2 { padding-bottom: 8px; }
  .text-emerald-600 { color: #16a34a; }
  .text-amber-600 { color: #d97706; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 0; }
  .tracking-tight { letter-spacing: -0.02em; }
</style>
</head>
<body>
<div class="page">
    <div class="center">
      <div class="font-bold text-lg tracking-tight">${escapeHtmlAttr(receiptData.shopName || 'Dite POS')}</div>
      ${escapeHtmlAttr(receiptData.branchName || '') ? `<div class="text-sm">${escapeHtmlAttr(receiptData.branchName || '')}</div>` : ''}
      ${escapeHtmlAttr(receiptData.branchAddress || '') ? `<div class="text-xs">${escapeHtmlAttr(receiptData.branchAddress || '')}</div>` : ''}
      <div class="text-xs space-y-0.5">
        ${escapeHtmlAttr(receiptData.branchPhone || '') ? `<div>${escapeHtmlAttr(receiptData.branchPhone || '')}</div>` : ''}
        ${escapeHtmlAttr(receiptData.branchEmail || '') ? `<div>${escapeHtmlAttr(receiptData.branchEmail || '')}</div>` : ''}
        ${escapeHtmlAttr(receiptData.branchWebsite || '') ? `<div>${escapeHtmlAttr(receiptData.branchWebsite || '')}</div>` : ''}
      </div>
      ${escapeHtmlAttr(receiptData.kraPin || '') ? `<div class="text-xs">KRA PIN: ${escapeHtmlAttr(receiptData.kraPin || '')}</div>` : ''}
    </div>

  <div class="space-y-1 mt-3 border-t border-b border-dashed border-slate-300 py-3">
    <div class="flex justify-between text-sm"><span class="text-slate-500">Receipt No</span><span class="font-medium">${escapeHtmlAttr(receiptData.receiptNo)}</span></div>
    <div class="flex justify-between text-sm"><span class="text-slate-500">Sale No</span><span class="font-medium">${escapeHtmlAttr(receiptData.saleId)}</span></div>
    <div class="flex justify-between text-sm"><span class="text-slate-500">Date & Time</span><span class="font-medium">${escapeHtmlAttr(formatDate(receiptData.date))}</span></div>
    <div class="flex justify-between text-sm"><span class="text-slate-500">Cashier</span><span class="font-medium">${escapeHtmlAttr(receiptData.cashierName)}</span></div>
    <div class="flex justify-between text-sm"><span class="text-slate-500">Customer</span><span class="font-medium">${escapeHtmlAttr(displayCustomer)}</span></div>
    ${escapeHtmlAttr(receiptData.paymentReference || '') ? `<div class="flex justify-between text-sm"><span class="text-slate-500">Reference</span><span class="font-medium">${escapeHtmlAttr(receiptData.paymentReference || '')}</span></div>` : ''}
    ${receiptData.syncStatus ? `<div class="flex justify-between text-sm"><span class="text-slate-500">Status</span><span class="font-medium ${receiptData.syncStatus === 'PENDING_SYNC' ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtmlAttr(receiptData.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced')}</span></div>` : ''}
    ${receiptData.isOffline ? `<div class="flex justify-between text-sm"><span class="text-slate-500">Mode</span><span class="font-medium text-amber-600">Offline</span></div>` : ''}
  </div>

  <div class="mt-3 space-y-3">
    ${receiptData.items.map(item => `
      <div class="space-y-1">
        <p class="font-medium text-sm">${escapeHtmlAttr(item.productName)}</p>
        ${item.sku ? `<p class="text-xs text-slate-500">SKU: ${escapeHtmlAttr(item.sku)}</p>` : ''}
        <div class="flex justify-between text-sm text-slate-600">
          <span>${item.quantity} x ${escapeHtmlAttr(formatCurrency(item.unitPrice, receiptData.currency, receiptData.currencySymbol))}</span>
          <span class="font-medium">${escapeHtmlAttr(formatCurrency(item.total, receiptData.currency, receiptData.currencySymbol))}</span>
        </div>
      </div>
    `).join('')}
  </div>

  ${escapeHtmlAttr(receiptData.saleNotes || '') ? `<div class="mt-3 text-xs text-slate-500 border-t border-dashed border-slate-200 pt-3"><p class="font-medium text-slate-600 mb-1">Notes</p><p>${escapeHtmlAttr(receiptData.saleNotes || '')}</p></div>` : ''}

  <div class="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3">
    <div class="flex justify-between text-sm text-slate-600"><span>Subtotal (VAT Exclusive)</span><span>${escapeHtmlAttr(formatCurrency(vat.vatExclusive, receiptData.currency, receiptData.currencySymbol))}</span></div>
    <div class="flex justify-between text-sm text-slate-600"><span>VAT (16%)</span><span>${escapeHtmlAttr(formatCurrency(vat.vatAmount, receiptData.currency, receiptData.currencySymbol))}</span></div>
    ${receiptData.discountAmount > 0 ? `<div class="flex justify-between text-sm text-slate-600"><span>Discount</span><span>-${escapeHtmlAttr(formatCurrency(receiptData.discountAmount, receiptData.currency, receiptData.currencySymbol))}</span></div>` : ''}
    <div class="flex justify-between text-lg font-bold pt-1.5 border-t border-slate-200"><span>Grand Total</span><span>${escapeHtmlAttr(formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol))}</span></div>
  </div>

  <div class="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3">
    <div class="flex justify-between text-sm text-slate-600"><span>Payment Method</span><span class="font-medium">${escapeHtmlAttr(receiptData.paymentMethod)}</span></div>
    <div class="flex justify-between text-sm text-slate-600"><span>Amount Paid</span><span class="font-medium">${escapeHtmlAttr(formatCurrency(receiptData.amountPaid, receiptData.currency, receiptData.currencySymbol))}</span></div>
    ${receiptData.changeAmount > 0 ? `<div class="flex justify-between text-sm text-slate-600"><span>Change</span><span class="font-medium text-emerald-600">${escapeHtmlAttr(formatCurrency(receiptData.changeAmount, receiptData.currency, receiptData.currencySymbol))}</span></div>` : ''}
  </div>

  <div class="border-t border-dashed border-slate-200 pt-3 mt-3 space-y-2 center">
    <div class="inline-block p-2 bg-slate-50 border border-slate-200 rounded">
      <div class="center text-xs text-slate-500">Scan to verify</div>
      <div class="center text-xs text-slate-400 mt-1">QR: ${escapeHtmlAttr(receiptData.qrData || receiptData.receiptNo)}</div>
    </div>
  </div>

  <div class="border-t border-dashed border-slate-200 pt-3 mt-3 text-center space-y-0.5">
    <p class="text-sm font-medium">Thank you for shopping with us.</p>
    <p class="text-sm text-slate-500">Please come again.</p>
    ${escapeHtmlAttr(receiptData.footerText || '') ? `<p class="text-xs text-slate-500 mt-2">${escapeHtmlAttr(receiptData.footerText || '')}</p>` : ''}
    ${escapeHtmlAttr(receiptData.branchWebsite || '') && !escapeHtmlAttr(receiptData.footerText || '') ? `<p class="text-xs text-slate-500">${escapeHtmlAttr(receiptData.branchWebsite || '')}</p>` : ''}
  </div>

  <p class="text-xs text-slate-400 text-center pt-1">All prices are VAT Inclusive.</p>
</div>
</body>
</html>`;
  }, [receiptData]);

  const handleDownloadImage = async (imageType: 'png' | 'jpeg') => {
    if (!receiptData) return;
    try {
      const html = generateFullHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const win = window.open(url, '_blank', 'width=600,height=900');
        if (!win) {
          URL.revokeObjectURL(url);
          reject(new Error('Popup blocked'));
          return;
        }
        win.onload = () => {
          try {
            const canvas = win.document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              win.close();
              URL.revokeObjectURL(url);
              reject(new Error('Canvas not supported'));
              return;
            }
            canvas.width = 800;
            canvas.height = 1400;
            if (imageType === 'jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(win.document.body as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height);
            const result = canvas.toDataURL(`image/${imageType}`, 0.95);
            win.close();
            URL.revokeObjectURL(url);
            resolve(result);
          } catch (err) {
            win.close();
            URL.revokeObjectURL(url);
            reject(err);
          }
        };
        win.onerror = () => {
          win.close();
          URL.revokeObjectURL(url);
          reject(new Error('Window load failed'));
        };
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Receipt-${receiptData.receiptNo}.${imageType}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onReprint?.();
    } catch {
      alert('Failed to generate image. Please use the PDF option instead.');
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptData) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 6;
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
        y += 4.5;
      };

      doc.setFont('helvetica', 'bold');
      centerText(receiptData.shopName || 'Dite POS', 12);
      doc.setFont('helvetica', 'normal');
      if (receiptData.branchName) centerText(receiptData.branchName, 9);
      if (receiptData.branchAddress) centerText(receiptData.branchAddress, 8);
      if (receiptData.branchPhone) centerText(receiptData.branchPhone, 8);
      if (receiptData.branchEmail) centerText(receiptData.branchEmail, 8);
      if (receiptData.branchWebsite) centerText(receiptData.branchWebsite, 8);
      if (receiptData.kraPin) centerText(`KRA PIN: ${receiptData.kraPin}`, 8);

      y += 2;
      doc.setDrawColor(150);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      centerText('RECEIPT', 10);
      rightText('Receipt No', receiptData.receiptNo);
      rightText('Sale No', receiptData.saleId);
      rightText('Date', formatDate(receiptData.date));
      rightText('Cashier', receiptData.cashierName);
      rightText('Customer', receiptData.customerName || 'Walk-in Customer');
      if (receiptData.paymentReference) rightText('Reference', receiptData.paymentReference);
      if (receiptData.syncStatus) rightText('Status', receiptData.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced');
      if (receiptData.isOffline) rightText('Mode', 'Offline');

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
      receiptData.items.forEach((item) => {
        const name = item.productName.length > 28 ? item.productName.slice(0, 28) + '...' : item.productName;
        doc.setFont('helvetica', 'bold');
        doc.text(name, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.quantity} x ${formatCurrency(item.unitPrice, receiptData.currency, receiptData.currencySymbol)}`, pageWidth - doc.getTextWidth(`${item.quantity} x ${formatCurrency(item.unitPrice, receiptData.currency, receiptData.currencySymbol)}`), y);
        y += 4;
        doc.text(`Total: ${formatCurrency(item.total, receiptData.currency, receiptData.currencySymbol)}`, margin + 2, y);
        y += 5;
      });

      y += 2;
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      const vat = calculateVatBreakdown(receiptData.total);
      doc.setFont('helvetica', 'normal');
      rightText('Subtotal (VAT Exclusive)', formatCurrency(vat.vatExclusive, receiptData.currency, receiptData.currencySymbol));
      rightText('VAT (16%)', formatCurrency(vat.vatAmount, receiptData.currency, receiptData.currencySymbol));
      if (receiptData.discountAmount > 0) rightText('Discount', `-${formatCurrency(receiptData.discountAmount, receiptData.currency, receiptData.currencySymbol)}`);
      doc.setFont('helvetica', 'bold');
      rightText('Grand Total', formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol));

      y += 2;
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      rightText('Payment', receiptData.paymentMethod);
      rightText('Paid', formatCurrency(receiptData.amountPaid, receiptData.currency, receiptData.currencySymbol));
      if (receiptData.changeAmount > 0) rightText('Change', formatCurrency(receiptData.changeAmount, receiptData.currency, receiptData.currencySymbol));

      y += 4;
      centerText('Thank you for shopping with us.', 8);
      centerText('Please come again.', 8);
      if (receiptData.footerText) centerText(receiptData.footerText, 8);
      if (receiptData.branchWebsite && !receiptData.footerText) centerText(receiptData.branchWebsite, 8);

      y += 3;
      centerText('All prices are VAT Inclusive.', 7);

      doc.save(`Receipt-${receiptData.receiptNo}.pdf`);
      onReprint?.();
    } catch {
      alert('Failed to generate PDF');
    }
  };

  const handleShare = async () => {
    if (!receiptData) return;

    const fullReceiptText = [
      `${receiptData.shopName || 'Dite POS'}`,
      receiptData.branchName,
      receiptData.branchAddress,
      `Receipt: ${receiptData.receiptNo}`,
      `Sale No: ${receiptData.saleId}`,
      `Date: ${formatDate(receiptData.date)}`,
      `Cashier: ${receiptData.cashierName}`,
      `Customer: ${receiptData.customerName || 'Walk-in Customer'}`,
      '-'.repeat(32),
      ...receiptData.items.map(i => `${i.productName}\n  ${i.quantity} x ${formatCurrency(i.unitPrice, receiptData.currency, receiptData.currencySymbol)}    ${formatCurrency(i.total, receiptData.currency, receiptData.currencySymbol)}`),
      '-'.repeat(32),
      `Subtotal: ${formatCurrency(calculateVatBreakdown(receiptData.total).vatExclusive, receiptData.currency, receiptData.currencySymbol)}`,
      `VAT (16%): ${formatCurrency(calculateVatBreakdown(receiptData.total).vatAmount, receiptData.currency, receiptData.currencySymbol)}`,
      receiptData.discountAmount > 0 ? `Discount: -${formatCurrency(receiptData.discountAmount, receiptData.currency, receiptData.currencySymbol)}` : '',
      `Grand Total: ${formatCurrency(receiptData.total, receiptData.currency, receiptData.currencySymbol)}`,
      '-'.repeat(32),
      `Payment: ${receiptData.paymentMethod}`,
      `Paid: ${formatCurrency(receiptData.amountPaid, receiptData.currency, receiptData.currencySymbol)}`,
      `Change: ${formatCurrency(receiptData.changeAmount, receiptData.currency, receiptData.currencySymbol)}`,
      '-'.repeat(32),
      'Thank you for shopping with us.',
      'Please come again.',
      'All prices are VAT Inclusive.',
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [] })) {
          const htmlBlob = new Blob([generateFullHtml()], { type: 'text/html' });
          const file = new File([htmlBlob], `Receipt-${receiptData.receiptNo}.html`, { type: 'text/html' });
          await navigator.share({
            title: `Receipt ${receiptData.receiptNo}`,
            text: fullReceiptText,
            files: [file],
          });
        } else {
          await navigator.share({
            title: `Receipt ${receiptData.receiptNo}`,
            text: fullReceiptText,
          });
        }
        onReprint?.();
      } catch {
        await navigator.clipboard.writeText(fullReceiptText);
        alert('Receipt copied to clipboard');
      }
    } else {
      await navigator.clipboard.writeText(fullReceiptText);
      alert('Receipt copied to clipboard');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
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
              <Button variant="outline" onClick={() => handleDownloadPDF()} className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={() => handleDownloadImage('png')} className="flex-1 gap-2">
                <ImageIcon className="h-4 w-4" />
                PNG
              </Button>
              <Button variant="outline" onClick={() => handleDownloadImage('jpeg')} className="flex-1 gap-2">
                <ImageIcon className="h-4 w-4" />
                JPEG
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
