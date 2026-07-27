import type { PaperSize } from './thermal-printer';
import { formatCurrency, calculateVatBreakdown } from '@/lib/utils';

export type TemplateFormat = 'html' | 'text' | 'escpos';
export type ReceiptTemplate = 'existing' | 'fiscal' | 'both';

export interface ReceiptItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface FiscalReceiptItem {
  qty: number;
  description: string;
  vatCode: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
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
  customerTin?: string;
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
  receiptPrefix?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED';
  isOffline?: boolean;
  saleNotes?: string;
}

export interface FiscalReceiptData {
  shopName: string;
  companyPin: string;
  companyAddress: string;
  companyPoBox: string;
  companyPhone: string;
  receiptNo: string;
  saleId: string;
  date: string;
  time: string;
  customerName: string;
  customerPin: string;
  customerTin: string;
  country: string;
  items: FiscalReceiptItem[];
  subtotal: number;
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
  cashierName: string;
  controlUnitSerial: string;
  controlUnitInvoice: string;
  attendedBy: string;
  currency: string;
  currencySymbol: string;
}

const PAPER_WIDTHS: Record<PaperSize, number> = {
  '58mm': 48,
  '80mm': 80,
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
    const name = item.productName.length > width - 10 ? item.productName.slice(0, width - 13) + '...' : item.productName;
    lines.push(`Item: ${name}`);
    if (item.sku) lines.push(`SKU: ${item.sku}`);
    const qtyPrice = `${item.quantity} x ${formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}`;
    lines.push(`  ${qtyPrice}${' '.repeat(Math.max(0, width - 12 - qtyPrice.length - formatCurrency(item.total, data.currency, data.currencySymbol).length))}${formatCurrency(item.total, data.currency, data.currencySymbol)}`);
  }

  lines.push(sep);
  lines.push(`Subtotal:`.padEnd(width - 12) + formatCurrency(vat.vatExclusive, data.currency, data.currencySymbol).padStart(12));
  lines.push(`VAT (16%):`.padEnd(width - 12) + formatCurrency(vat.vatAmount, data.currency, data.currencySymbol).padStart(12));
  if ((data.discountAmount || 0) > 0) {
    lines.push(`Discount:`.padEnd(width - 12) + formatCurrency(data.discountAmount || 0, data.currency, data.currencySymbol).padStart(12));
  }
  lines.push(`TOTAL:`.padEnd(width - 12) + formatCurrency(data.total || 0, data.currency, data.currencySymbol).padStart(12));
  lines.push(sep);
  lines.push(`Payment: ${data.paymentMethod || 'CASH'}`);
  lines.push(`Paid: ${data.currencySymbol || 'KSh'} ${formatCurrency(data.amountPaid || 0, data.currency, data.currencySymbol)}`);
  if ((data.changeAmount || 0) > 0) {
    lines.push(`Change: ${data.currencySymbol || 'KSh'} ${formatCurrency(data.changeAmount || 0, data.currency, data.currencySymbol)}`);
  }
  lines.push(sep);
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
  const width = paperSize === '58mm' ? '280px' : '320px';
  const fontSize = paperSize === '58mm' ? '10px' : '11px';
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

export function generateFiscalReceiptTemplate(
  data: FiscalReceiptData,
  format: TemplateFormat = 'text',
  paperSize: PaperSize = '80mm'
): string {
  switch (format) {
    case 'html':
      return generateFiscalHtmlTemplate(data, paperSize);
    case 'text':
    default:
      return generateFiscalTextTemplate(data, paperSize);
  }
}

function generateFiscalTextTemplate(data: FiscalReceiptData, paperSize: PaperSize): string {
  const width = PAPER_WIDTHS[paperSize];
  const lines: string[] = [];
  const sep = '-'.repeat(width);

  lines.push(center(data.shopName || 'Dite POS', width));
  lines.push(center(data.companyPin, width));
  lines.push(center(data.companyAddress, width));
  lines.push(center(`P.O. Box ${data.companyPoBox}`, width));
  lines.push(center(data.companyPhone, width));
  lines.push(sep);
  lines.push(center('FISCAL RECEIPT', width));
  lines.push(sep);
  lines.push(`Receipt No: ${data.receiptNo}`);
  lines.push(`Date: ${data.date}`);
  lines.push(`Time: ${data.time}`);
  lines.push(`Customer: ${data.customerName}`);
  lines.push(`Customer PIN: ${data.customerPin}`);
  lines.push(`Customer TIN: ${data.customerTin}`);
  lines.push(`Country: ${data.country}`);
  lines.push(sep);
  lines.push(center('QTY   DESCRIPTION        VAT    PRICE       AMOUNT', width));
  lines.push(sep);

  for (const item of data.items) {
    const desc = item.description.length > width - 26 ? item.description.slice(0, width - 29) + '...' : item.description;
    const qtyStr = String(item.qty).padStart(4);
    const descStr = desc.padEnd(width - 26);
    const vatStr = item.vatCode.padEnd(4);
    const priceStr = formatCurrency(item.unitPrice, data.currency, data.currencySymbol).padStart(12);
    const totalStr = formatCurrency(item.lineTotal, data.currency, data.currencySymbol).padStart(12);
    lines.push(`${qtyStr}  ${descStr}  ${vatStr}  ${priceStr}  ${totalStr}`);
  }

  lines.push(sep);
  lines.push(`SUBTOTAL`.padEnd(width - 12) + formatCurrency(data.subtotal, data.currency, data.currencySymbol).padStart(12));
  lines.push(`TOTAL AMOUNT`.padEnd(width - 12) + formatCurrency(data.totalAmount, data.currency, data.currencySymbol).padStart(12));
  lines.push(`CASH`.padEnd(width - 12) + formatCurrency(data.cashReceived, data.currency, data.currencySymbol).padStart(12));
  lines.push(`CHANGE`.padEnd(width - 12) + formatCurrency(data.changeAmount, data.currency, data.currencySymbol).padStart(12));
  lines.push(sep);
  lines.push(`VAT CODE  RATE   TAXABLE AMOUNT     VAT AMOUNT`);
  const taxableStr = formatCurrency(data.subtotal, data.currency, data.currencySymbol).padStart(14);
  const vatAmtStr = formatCurrency(data.totalAmount - data.subtotal, data.currency, data.currencySymbol).padStart(12);
  lines.push(`A         16%    ${taxableStr}  ${vatAmtStr}`);
  lines.push(sep);
  lines.push(center('[QR CODE]', width));
  lines.push(sep);
  lines.push(`Control Unit Serial: ${data.controlUnitSerial}`);
  lines.push(`Control Unit Invoice: ${data.controlUnitInvoice}`);
  lines.push(`Attended By: ${data.attendedBy}`);
  lines.push('');
  lines.push(center('Thank you for your visit.', width));
  lines.push('');

  return lines.join('\n');
}

function generateFiscalHtmlTemplate(data: FiscalReceiptData, paperSize: PaperSize): string {
  const width = paperSize === '58mm' ? '280px' : '320px';
  const fontSize = paperSize === '58mm' ? '9px' : '10px';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fiscal Receipt ${escapeHtml(data.receiptNo)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; margin: 0 auto; }
    }
    .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; margin: 0 auto; color: #000; background: #fff; }
    .center { text-align: center; }
    .right { text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1px 0; font-size: ${fontSize}; }
    .border-top { border-top: 1px dashed #000; }
    .border-bottom { border-bottom: 1px dashed #000; }
    .bold { font-weight: bold; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold">${escapeHtml(data.shopName || 'Dite POS')}</div>
    <div class="center">${escapeHtml(data.companyPin)}</div>
    <div class="center">${escapeHtml(data.companyAddress)}</div>
    <div class="center">P.O. Box ${escapeHtml(data.companyPoBox)}</div>
    <div class="center">${escapeHtml(data.companyPhone)}</div>
    <div class="border-top"></div>
    <div class="center bold">FISCAL RECEIPT</div>
    <div class="border-top"></div>
    <table>
      <tr><td>Receipt No:</td><td class="right">${escapeHtml(data.receiptNo)}</td></tr>
      <tr><td>Date:</td><td class="right">${escapeHtml(data.date)}</td></tr>
      <tr><td>Time:</td><td class="right">${escapeHtml(data.time)}</td></tr>
      <tr><td>Customer:</td><td class="right">${escapeHtml(data.customerName)}</td></tr>
      <tr><td>Customer PIN:</td><td class="right">${escapeHtml(data.customerPin)}</td></tr>
      <tr><td>Customer TIN:</td><td class="right">${escapeHtml(data.customerTin)}</td></tr>
      <tr><td>Country:</td><td class="right">${escapeHtml(data.country)}</td></tr>
    </table>
    <div class="border-top"></div>
    <table>
      <tr><th>QTY</th><th>DESCRIPTION</th><th>VAT</th><th>PRICE</th><th>AMOUNT</th></tr>
      ${data.items.map(item => `
        <tr>
          <td>${item.qty}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.vatCode)}</td>
          <td class="right">${formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}</td>
          <td class="right">${formatCurrency(item.lineTotal, data.currency, data.currencySymbol)}</td>
        </tr>
      `).join('')}
    </table>
    <div class="border-top"></div>
    <table>
      <tr><td>SUBTOTAL</td><td class="right">${formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</td></tr>
      <tr><td>TOTAL AMOUNT</td><td class="right">${formatCurrency(data.totalAmount, data.currency, data.currencySymbol)}</td></tr>
      <tr><td>CASH</td><td class="right">${formatCurrency(data.cashReceived, data.currency, data.currencySymbol)}</td></tr>
      <tr><td>CHANGE</td><td class="right">${formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</td></tr>
    </table>
    <div class="border-top"></div>
    <table>
      <tr><th>VAT CODE</th><th>RATE</th><th>TAXABLE AMOUNT</th><th>VAT AMOUNT</th></tr>
      <tr><td>A</td><td>16%</td><td class="right">${formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</td><td class="right">${formatCurrency(data.totalAmount - data.subtotal, data.currency, data.currencySymbol)}</td></tr>
    </table>
    <div class="border-top"></div>
    <div class="center"><img src="/assets/receipt-qr.png" alt="QR Code" style="width:100px;height:100px;" /></div>
    <div class="border-top"></div>
    <div class="center">Control Unit Serial: ${escapeHtml(data.controlUnitSerial)}</div>
    <div class="center">Control Unit Invoice: ${escapeHtml(data.controlUnitInvoice)}</div>
    <div class="center">Attended By: ${escapeHtml(data.attendedBy)}</div>
    <div class="center" style="margin-top:8px;">Thank you for your visit.</div>
  </div>
</body>
</html>`;
}

export function buildFiscalEscpos(data: FiscalReceiptData, paperSize: PaperSize = '80mm'): Uint8Array {
  const text = generateFiscalTextTemplate(data, paperSize);
  const bytes: number[] = [];

  bytes.push(0x1B, 0x40);

  for (const char of text) {
    bytes.push(char.charCodeAt(0));
  }

  bytes.push(0x1D, 0x56, 0x42, 0x00);
  return new Uint8Array(bytes);
}
