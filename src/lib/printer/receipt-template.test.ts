import { describe, it, expect } from 'vitest';
import { generateReceiptTemplate, generateFiscalReceiptTemplate } from './receipt-template';
import type { ReceiptData, FiscalReceiptData } from './receipt-template';

const baseReceipt: ReceiptData = {
  shopName: 'DITE SATELITE SOLUTIONS',
  receiptNo: 'RCP-20260907-00001',
  saleId: 'sale-1',
  date: '2026-09-07T10:00:00.000Z',
  cashierName: 'Cashier',
  customerName: 'Walk-in Customer',
  items: [{ productName: 'Widget', quantity: 1, unitPrice: 100, discount: 0, total: 100 }],
  subtotal: 100,
  discountAmount: 0,
  total: 100,
  amountPaid: 100,
  changeAmount: 0,
  paymentMethod: 'CASH',
  currency: 'KES',
  currencySymbol: 'KSh',
};

const multilineShopName =
  'DITE SATELITE SOLUTIONS\nDealers; cctv, internet products and services\ncontacts: 0701573855\n0726739101\nditesatelite@gmail.com';

const baseFiscal: FiscalReceiptData = {
  shopName: 'DITE SATELITE SOLUTIONS',
  companyPin: 'P051234567X',
  companyAddress: 'Nairobi',
  companyPoBox: '123',
  companyPhone: '0700000000',
  receiptNo: 'RCP-20260907-00001',
  saleId: 'sale-1',
  date: '2026-09-07',
  time: '10:00:00',
  customerName: 'Walk-in Customer',
  customerPin: '',
  customerTin: '',
  country: 'Kenya',
  items: [{ qty: 1, description: 'Widget', vatCode: 'A', unitPrice: 100, discount: 0, lineTotal: 100 }],
  subtotal: 100,
  totalAmount: 100,
  cashReceived: 100,
  changeAmount: 0,
  cashierName: 'Cashier',
  controlUnitSerial: '0020105870000640339',
  controlUnitInvoice: '640339',
  attendedBy: 'Cashier',
  currency: 'KES',
  currencySymbol: 'KSh',
};

describe('multiline shopName rendering', () => {
  it('preserves all newline characters in text template', () => {
    const text = generateReceiptTemplate({ ...baseReceipt, shopName: multilineShopName }, 'text', '80mm');
    const lines = text.split('\n');
    expect(lines[0].trim()).toBe('DITE SATELITE SOLUTIONS');
    expect(lines[1].trim()).toBe('Dealers; cctv, internet products and services');
    expect(lines[2].trim()).toBe('contacts: 0701573855');
    expect(lines[3].trim()).toBe('0726739101');
    expect(lines[4].trim()).toBe('ditesatelite@gmail.com');
  });

  it('preserves all newline characters in html template', () => {
    const html = generateReceiptTemplate({ ...baseReceipt, shopName: multilineShopName }, 'html', '80mm');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('DITE SATELITE SOLUTIONS');
    expect(html).toContain('Dealers; cctv, internet products and services');
    expect(html).toContain('contacts: 0701573855');
    expect(html).toContain('0726739101');
    expect(html).toContain('ditesatelite@gmail.com');
  });

  it('does not collapse newlines to spaces in html template', () => {
    const html = generateReceiptTemplate({ ...baseReceipt, shopName: multilineShopName }, 'html', '80mm');
    const shopNameDiv = html.match(/<div class="center bold" style="white-space:pre-wrap">[^<]*<\/div>/);
    expect(shopNameDiv).not.toBeNull();
    // The escaped newline must be present literally inside the div content.
    expect(shopNameDiv![0]).toContain('DITE SATELITE SOLUTIONS\nDealers');
  });

  it('preserves newlines in fiscal text template', () => {
    const text = generateFiscalReceiptTemplate({ ...baseFiscal, shopName: multilineShopName }, 'text', '80mm');
    const lines = text.split('\n');
    expect(lines[0].trim()).toBe('DITE SATELITE SOLUTIONS');
    expect(lines[1].trim()).toBe('Dealers; cctv, internet products and services');
    expect(lines[2].trim()).toBe('contacts: 0701573855');
    expect(lines[3].trim()).toBe('0726739101');
    expect(lines[4].trim()).toBe('ditesatelite@gmail.com');
  });

  it('preserves newlines in fiscal html template', () => {
    const html = generateFiscalReceiptTemplate({ ...baseFiscal, shopName: multilineShopName }, 'html', '80mm');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('DITE SATELITE SOLUTIONS\nDealers');
  });
});