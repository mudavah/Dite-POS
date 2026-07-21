import type { PaperSize } from './thermal-printer';

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
  receiptNo: string;
  date: Date;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  currency: string;
  currencySymbol: string;
  footerText?: string;
  qrData?: string;
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

  lines.push(center(data.shopName, width));
  if (data.branchName) lines.push(center(data.branchName, width));
  if (data.branchAddress) lines.push(center(data.branchAddress, width));
  if (data.branchPhone) lines.push(center(data.branchPhone, width));
  lines.push(sep);

  lines.push(center('RECEIPT', width));
  lines.push(`Receipt No: ${data.receiptNo}`);
  lines.push(`Date: ${new Date(data.date).toLocaleString()}`);
  lines.push(`Cashier: ${data.cashierName}`);
  if (data.customerName) {
    lines.push(`Customer: ${data.customerName}`);
    if (data.customerPhone) lines.push(`Phone: ${data.customerPhone}`);
  }
  lines.push(sep);

  const nameWidth = width - 20;
  const header = `ITEM`.padEnd(nameWidth - 20) + `QTY`.padEnd(4) + `PRICE`.padStart(8) + `TOTAL`.padStart(8);
  lines.push(header);
  lines.push(sep);

  for (const item of data.items) {
    const name = item.productName.slice(0, nameWidth - 20) || item.productName;
    const qty = String(item.quantity).padEnd(4);
    const price = formatNum(item.unitPrice).padStart(8);
    const total = formatNum(item.total).padStart(8);
    lines.push(`${name}${qty}${price}${total}`);
  }

  lines.push(sep);
  lines.push(`Subtotal:`.padEnd(width - 10) + formatNum(data.subtotal).padStart(10));
  if (data.discountAmount > 0) {
    lines.push(`Discount:`.padEnd(width - 10) + formatNum(data.discountAmount).padStart(10));
  }
  lines.push(`TOTAL:`.padEnd(width - 10) + formatNum(data.total).padStart(10));
  lines.push(sep);
  lines.push(`Payment: ${data.paymentMethod}`);
  lines.push(`Paid: ${data.currency} ${formatNum(data.amountPaid)}`);
  lines.push(`Change: ${data.currency} ${formatNum(data.changeAmount)}`);
  lines.push(sep);
  if (data.qrData) {
    lines.push(center('[QR CODE]', width));
    lines.push(center(data.qrData, width));
  }
  if (data.footerText) {
    lines.push(sep);
    lines.push(center(data.footerText, width));
  }
  lines.push('');
  lines.push(center('Thank you for shopping!', width));
  lines.push('');

  return lines.join('\n');
}

function generateHtmlTemplate(data: ReceiptData, paperSize: PaperSize): string {
  const width = paperSize === '58mm' ? '280px' : '380px';
  const fontSize = paperSize === '58mm' ? '10px' : '12px';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${escapeHtml(data.receiptNo)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; }
    }
    .receipt { width: ${width}; font-family: monospace; font-size: ${fontSize}; margin: 0 auto; }
    .center { text-align: center; }
    .right { text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; }
    .border-top { border-top: 1px solid #000; }
    .border-bottom { border-bottom: 1px solid #000; }
    .bold { font-weight: bold; }
    .total { font-size: 14px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold">${escapeHtml(data.shopName)}</div>
    ${data.branchName ? `<div class="center">${escapeHtml(data.branchName)}</div>` : ''}
    ${data.branchAddress ? `<div class="center">${escapeHtml(data.branchAddress)}</div>` : ''}
    ${data.branchPhone ? `<div class="center">${escapeHtml(data.branchPhone)}</div>` : ''}
    <div class="border-top"></div>
    <div class="center bold">RECEIPT</div>
    <table>
      <tr><td>Receipt No:</td><td class="right">${escapeHtml(data.receiptNo)}</td></tr>
      <tr><td>Date:</td><td class="right">${new Date(data.date).toLocaleString()}</td></tr>
      <tr><td>Cashier:</td><td class="right">${escapeHtml(data.cashierName)}</td></tr>
      ${data.customerName ? `<tr><td>Customer:</td><td class="right">${escapeHtml(data.customerName)}</td></tr>` : ''}
    </table>
    <div class="border-top"></div>
    <table>
      <thead>
        <tr class="border-bottom">
          <th class="left">Item</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr class="border-bottom">
            <td class="left">${escapeHtml(item.productName)}</td>
            <td class="right">${item.quantity}</td>
            <td class="right">${formatNum(item.unitPrice)}</td>
            <td class="right">${formatNum(item.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="border-top"></div>
    <table>
      <tr><td>Subtotal</td><td class="right">${formatNum(data.subtotal)}</td></tr>
      ${data.discountAmount > 0 ? `<tr><td>Discount</td><td class="right">${formatNum(data.discountAmount)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL</td><td class="right">${formatNum(data.total)}</td></tr>
    </table>
    <div class="border-top"></div>
    <table>
      <tr><td>Payment</td><td class="right">${escapeHtml(data.paymentMethod)}</td></tr>
      <tr><td>Paid</td><td class="right">${data.currency} ${formatNum(data.amountPaid)}</td></tr>
      <tr><td>Change</td><td class="right">${data.currency} ${formatNum(data.changeAmount)}</td></tr>
    </table>
    <div class="border-top"></div>
    ${data.qrData ? `<div class="center">[QR: ${escapeHtml(data.qrData)}]</div>` : ''}
    ${data.footerText ? `<div class="center">${escapeHtml(data.footerText)}</div>` : ''}
    <div class="center">Thank you for shopping!</div>
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

function formatNum(num: number): string {
  return num.toFixed(2);
}
