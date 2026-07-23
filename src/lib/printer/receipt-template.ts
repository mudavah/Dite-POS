import type { PaperSize } from './thermal-printer';
import { formatCurrency, calculateVatBreakdown } from '@/lib/utils';

export type TemplateFormat = 'html' | 'text' | 'escpos';

export interface ReceiptItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface ReceiptData {
  shopName: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  branchEmail?: string;
  branchWebsite?: string;
  kraPin?: string;
  receiptNo: string;
  saleId: string;
  date: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerPin?: string;
  paymentMethod: string;
  paymentReference?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  currency: string;
  currencySymbol: string;
  footerText?: string;
  qrData?: string;
  receiptPrefix?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED';
  isOffline?: boolean;
  saleNotes?: string;
}

const PAPER_WIDTHS: Record<PaperSize, number> = {
  '58mm': 48,
  '80mm': 64,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function center(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

export function generateReceiptTemplate(
  data: ReceiptData,
  format: TemplateFormat = 'text',
  paperSize: PaperSize = '80mm'
): string {
  switch (format) {
    case 'html':
      return generateHtmlTemplate(data, paperSize);
    case 'text':
    default:
      return generateTextTemplate(data, paperSize);
  }
}

function generateTextTemplate(data: ReceiptData, paperSize: PaperSize): string {
  const width = PAPER_WIDTHS[paperSize];
  const lines: string[] = [];
  const sep = '─'.repeat(width);
  const vat = calculateVatBreakdown(data.total);
  const displayCustomer = data.customerName || 'Walk-in Customer';

  lines.push(center(data.shopName || 'Dite POS', width));
  if (data.branchName) lines.push(center(data.branchName, width));
  if (data.branchAddress) lines.push(center(data.branchAddress, width));
  lines.push(sep);

  lines.push(center('RECEIPT', width));
  lines.push(`Receipt No: ${data.receiptNo}`);
  lines.push(`Sale No: ${data.saleId}`);
  lines.push(`Date: ${new Date(data.date).toLocaleString()}`);
  lines.push(`Cashier: ${data.cashierName}`);
  lines.push(`Customer: ${displayCustomer}`);
  if (data.paymentReference) lines.push(`Reference: ${data.paymentReference}`);
  lines.push(sep);

  for (const item of data.items) {
    lines.push(`Item: ${item.productName}`);
    if (item.sku) lines.push(`SKU: ${item.sku}`);
    lines.push(`  ${item.quantity} x ${formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}    ${formatCurrency(item.total, data.currency, data.currencySymbol)}`);
  }

  lines.push(sep);
  lines.push(`Subtotal:`.padEnd(width - 10) + formatCurrency(vat.vatExclusive, data.currency, data.currencySymbol).padStart(10));
  lines.push(`VAT (16%):`.padEnd(width - 10) + formatCurrency(vat.vatAmount, data.currency, data.currencySymbol).padStart(10));
  if ((data.discountAmount || 0) > 0) {
    lines.push(`Discount:`.padEnd(width - 10) + formatCurrency(data.discountAmount || 0, data.currency, data.currencySymbol).padStart(10));
  }
  lines.push(`TOTAL:`.padEnd(width - 10) + formatCurrency(data.total || 0, data.currency, data.currencySymbol).padStart(10));
  lines.push(sep);
  lines.push(`Payment: ${data.paymentMethod || 'CASH'}`);
  lines.push(`Paid: ${data.currencySymbol || 'KSh'} ${formatCurrency(data.amountPaid || 0, data.currency, data.currencySymbol)}`);
  lines.push(`Change: ${data.currencySymbol || 'KSh'} ${formatCurrency(data.changeAmount || 0, data.currency, data.currencySymbol)}`);
  lines.push(sep);
  if (data.qrData) {
    lines.push(center('[QR CODE]', width));
    lines.push(center(data.qrData, width));
  }
  if (data.footerText) {
    lines.push(center(data.footerText, width));
  }
  if (data.branchWebsite && !data.footerText) {
    lines.push(center(data.branchWebsite, width));
  }
  lines.push('');
  lines.push(center('Thank you for shopping with us.', width));
  lines.push(center('Please come again.', width));
  lines.push('');
  lines.push(center('All prices are VAT Inclusive.', width));
  lines.push('');

  return lines.join('\n');
}

function generateHtmlTemplate(data: ReceiptData, paperSize: PaperSize): string {
  const width = paperSize === '58mm' ? '280px' : '380px';
  const fontSize = paperSize === '58mm' ? '10px' : '12px';
  const vat = calculateVatBreakdown(data.total);
  const displayCustomer = data.customerName || 'Walk-in Customer';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${escapeHtml(data.receiptNo)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; margin: 0 auto; }
    }
    .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; margin: 0 auto; color: #000; background: #fff; }
    .center { text-align: center; }
    .right { text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; }
    .border-top { border-top: 1px dashed #000; }
    .border-bottom { border-bottom: 1px dashed #000; }
    .bold { font-weight: bold; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold">${escapeHtml(data.shopName || 'Dite POS')}</div>
    ${data.branchName ? `<div class="center">${escapeHtml(data.branchName)}</div>` : ''}
    ${data.branchAddress ? `<div class="center">${escapeHtml(data.branchAddress)}</div>` : ''}
    ${data.branchPhone ? `<div class="center">${escapeHtml(data.branchPhone)}</div>` : ''}
    ${data.branchEmail ? `<div class="center">${escapeHtml(data.branchEmail)}</div>` : ''}
    ${data.branchWebsite ? `<div class="center">${escapeHtml(data.branchWebsite)}</div>` : ''}
    ${data.kraPin ? `<div class="center">KRA PIN: ${escapeHtml(data.kraPin)}</div>` : ''}
    <div class="border-top"></div>
    <div class="center bold">RECEIPT</div>
    <table>
      <tr><td>Receipt No:</td><td class="right">${escapeHtml(data.receiptNo)}</td></tr>
      <tr><td>Sale No:</td><td class="right">${escapeHtml(data.saleId)}</td></tr>
      <tr><td>Date:</td><td class="right">${new Date(data.date).toLocaleString()}</td></tr>
      <tr><td>Cashier:</td><td class="right">${escapeHtml(data.cashierName)}</td></tr>
      <tr><td>Customer:</td><td class="right">${escapeHtml(displayCustomer)}</td></tr>
      ${data.paymentReference ? `<tr><td>Reference:</td><td class="right">${escapeHtml(data.paymentReference)}</td></tr>` : ''}
    </table>
    <div class="border-top"></div>
    <table>
      ${data.items.map(item => `
        <tr class="border-bottom">
          <td colspan="4" class="left bold">${escapeHtml(item.productName)}</td>
        </tr>
        <tr class="border-bottom">
          <td colspan="4" class="left" style="color:#666">SKU: ${escapeHtml(item.sku || '-')} &nbsp; ${item.quantity} x ${formatCurrency(item.unitPrice, data.currency, data.currencySymbol)} &nbsp; ${formatCurrency(item.total, data.currency, data.currencySymbol)}</td>
        </tr>
      `).join('')}
    </table>
    <div class="border-top"></div>
    <table>
      <tr><td>Subtotal</td><td class="right">${formatCurrency(vat.vatExclusive, data.currency, data.currencySymbol)}</td></tr>
      <tr><td>VAT (16%)</td><td class="right">${formatCurrency(vat.vatAmount, data.currency, data.currencySymbol)}</td></tr>
      ${data.discountAmount > 0 ? `<tr><td>Discount</td><td class="right">${formatCurrency(data.discountAmount, data.currency, data.currencySymbol)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL</td><td class="right">${formatCurrency(data.total || 0, data.currency, data.currencySymbol)}</td></tr>
    </table>
    <div class="border-top"></div>
    <table>
      <tr><td>Payment</td><td class="right">${escapeHtml(data.paymentMethod)}</td></tr>
      <tr><td>Paid</td><td class="right">${formatCurrency(data.amountPaid, data.currency, data.currencySymbol)}</td></tr>
      <tr><td>Change</td><td class="right">${formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</td></tr>
    </table>
    <div class="border-top"></div>
    ${data.qrData ? `<div class="center">[QR: ${escapeHtml(data.qrData)}]</div>` : ''}
    ${data.footerText ? `<div class="center">${escapeHtml(data.footerText)}</div>` : ''}
    ${data.branchWebsite && !data.footerText ? `<div class="center">${escapeHtml(data.branchWebsite)}</div>` : ''}
    <div class="center">Thank you for shopping with us.</div>
    <div class="center" style="color:#666">Please come again.</div>
    <div class="center" style="color:#999;font-size:9px">All prices are VAT Inclusive.</div>
  </div>
</body>
</html>`;
}

export function textToEscpos(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text + '\n');
}

export function buildEscpos(data: ReceiptData, paperSize: PaperSize = '80mm'): Uint8Array {
  const text = generateTextTemplate(data, paperSize);
  const bytes: number[] = [];

  bytes.push(0x1B, 0x40);

  for (const char of text) {
    bytes.push(char.charCodeAt(0));
  }

  bytes.push(0x1D, 0x56, 0x42, 0x00);
  return new Uint8Array(bytes);
}
