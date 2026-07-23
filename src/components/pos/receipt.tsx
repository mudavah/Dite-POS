'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, calculateVatBreakdown } from '@/lib/utils';

export interface ReceiptItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface ReceiptData {
  shopName?: string;
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
  saleNotes?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  paymentReference?: string;
  currency?: string;
  currencySymbol?: string;
  footerText?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED';
  isOffline?: boolean;
  qrData?: string;
}

interface ReceiptProps {
  data: ReceiptData;
  paperSize?: '58mm' | '80mm';
  format?: 'thermal' | 'full';
}

export function Receipt({ data, paperSize = '80mm', format = 'full' }: ReceiptProps) {
  if (format === 'thermal') {
    return <ThermalReceipt data={data} paperSize={paperSize} />;
  }

  const vat = calculateVatBreakdown(data.total);
  const displayCustomer = data.customerName || 'Walk-in Customer';

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-white text-slate-900 shadow-sm">
      <div className="p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{data.shopName || 'Dite POS'}</h1>
          {data.branchName && <p className="text-sm text-slate-600">{data.branchName}</p>}
          {data.branchAddress && <p className="text-xs text-slate-500 leading-relaxed">{data.branchAddress}</p>}
          <div className="text-xs text-slate-500 space-y-0.5">
            {data.branchPhone && <p>{data.branchPhone}</p>}
            {data.branchEmail && <p>{data.branchEmail}</p>}
            {data.branchWebsite && <p>{data.branchWebsite}</p>}
          </div>
          {data.kraPin && <p className="text-xs text-slate-500">KRA PIN: {data.kraPin}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Receipt No</span>
            <span className="font-medium">{data.receiptNo}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sale No</span>
            <span className="font-medium">{data.saleId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Date & Time</span>
            <span className="font-medium">{formatDate(data.date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Cashier</span>
            <span className="font-medium">{data.cashierName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Customer</span>
            <span className="font-medium">{displayCustomer}</span>
          </div>
          {(data.customerPhone || data.customerEmail || data.customerPin) && (
            <div className="text-xs text-slate-500 space-y-0.5 pt-0.5">
              {data.customerPhone && <p>Phone: {data.customerPhone}</p>}
              {data.customerEmail && <p>Email: {data.customerEmail}</p>}
              {data.customerPin && <p>PIN: {data.customerPin}</p>}
            </div>
          )}
          {data.syncStatus && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className={`font-medium ${data.syncStatus === 'PENDING_SYNC' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}
              </span>
            </div>
          )}
          {data.isOffline && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Mode</span>
              <span className="font-medium text-amber-600">Offline</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {data.items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <p className="font-medium text-sm leading-snug">{item.productName}</p>
              {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
              <div className="flex justify-between text-sm text-slate-600">
                <span>{item.quantity} x {formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}</span>
                <span className="font-medium">{formatCurrency(item.total, data.currency, data.currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>

        {data.saleNotes && (
          <div className="text-xs text-slate-500 border-t border-dashed border-slate-200 pt-3">
            <p className="font-medium text-slate-600 mb-1">Notes</p>
            <p>{data.saleNotes}</p>
          </div>
        )}

        <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-3">
          {data.paymentReference && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Payment Reference</span>
              <span className="font-medium">{data.paymentReference}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal (VAT Exclusive)</span>
            <span>{formatCurrency(vat.vatExclusive, data.currency, data.currencySymbol)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>VAT (16%)</span>
            <span>{formatCurrency(vat.vatAmount, data.currency, data.currencySymbol)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Discount</span>
              <span>-{formatCurrency(data.discountAmount, data.currency, data.currencySymbol)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1.5 border-t border-slate-200">
            <span>Grand Total</span>
            <span>{formatCurrency(data.total, data.currency, data.currencySymbol)}</span>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-3">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Payment Method</span>
            <span className="font-medium">{data.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Amount Paid</span>
            <span className="font-medium">{formatCurrency(data.amountPaid, data.currency, data.currencySymbol)}</span>
          </div>
          {data.changeAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Change</span>
              <span className="font-medium text-emerald-600">{formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
          <div className="flex justify-center">
            <div className="inline-block p-2 bg-white border border-slate-200 rounded-lg">
              {data.qrData ? (
                <QRCodeSVG value={data.qrData} size={96} level="M" includeMargin={false} />
              ) : (
                <div className="w-24 h-24 bg-slate-50 flex items-center justify-center text-xs text-slate-400 border border-slate-200 rounded">
                  QR: {data.receiptNo}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center">Scan to verify receipt</p>
        </div>

        <div className="border-t border-dashed border-slate-200 pt-3 text-center space-y-1">
          <p className="text-sm font-medium">Thank you for shopping with us.</p>
          <p className="text-sm text-slate-500">Please come again.</p>
          {data.footerText && <p className="text-xs text-slate-500 mt-2">{data.footerText}</p>}
          {data.branchWebsite && !data.footerText && <p className="text-xs text-slate-500">{data.branchWebsite}</p>}
        </div>

        <p className="text-xs text-slate-400 text-center pt-1">All prices are VAT Inclusive.</p>
      </div>
    </div>
  );
}

function ThermalReceipt({ data, paperSize }: { data: ReceiptData; paperSize: '58mm' | '80mm' }) {
  const width = paperSize === '58mm' ? 280 : 380;
  const padding = paperSize === '58mm' ? 12 : 16;
  const vat = calculateVatBreakdown(data.total);
  const displayCustomer = data.customerName || 'Walk-in Customer';

  const centerStyle: React.CSSProperties = { textAlign: 'center' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 };

  return (
    <div
      className="font-mono text-black bg-white"
      style={{ width, maxWidth: '100%', padding, margin: '0 auto' }}
    >
      <div style={centerStyle} className="space-y-1">
        <div className="font-bold text-sm">{data.shopName || 'Dite POS'}</div>
        {data.branchName && <div className="text-xs">{data.branchName}</div>}
        {data.branchAddress && <div className="text-xs">{data.branchAddress}</div>}
        <div className="text-xs space-y-0.5">
          {data.branchPhone && <div>{data.branchPhone}</div>}
          {data.branchEmail && <div>{data.branchEmail}</div>}
          {data.branchWebsite && <div>{data.branchWebsite}</div>}
        </div>
        {data.kraPin && <div className="text-xs">KRA PIN: {data.kraPin}</div>}
      </div>

      <div className="border-t border-b border-dashed border-slate-400 py-2 mt-2 space-y-1">
        <div style={centerStyle} className="font-bold text-xs">RECEIPT</div>
        <div style={rowStyle} className="text-xs"><span>Receipt:</span><span>{data.receiptNo}</span></div>
        <div style={rowStyle} className="text-xs"><span>Sale No:</span><span>{data.saleId}</span></div>
        <div style={rowStyle} className="text-xs"><span>Date:</span><span>{formatDate(data.date)}</span></div>
        <div style={rowStyle} className="text-xs"><span>Cashier:</span><span>{data.cashierName}</span></div>
        <div style={rowStyle} className="text-xs"><span>Customer:</span><span>{displayCustomer}</span></div>
        {data.paymentReference && <div style={rowStyle} className="text-xs"><span>Reference:</span><span>{data.paymentReference}</span></div>}
        {data.syncStatus && (
          <div style={rowStyle} className="text-xs">
            <span>Status:</span>
            <span className={data.syncStatus === 'PENDING_SYNC' ? 'text-amber-700' : 'text-emerald-700'}>
              {data.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}
            </span>
          </div>
        )}
        {data.isOffline && (
          <div style={rowStyle} className="text-xs"><span>Mode:</span><span className="text-amber-700">Offline</span></div>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {data.items.map((item, idx) => (
          <div key={idx} className="text-xs space-y-1">
            <div className="font-medium leading-snug">{item.productName}</div>
            {item.sku && <div className="text-slate-500">SKU: {item.sku}</div>}
            <div style={rowStyle} className="text-slate-600">
              <span>{item.quantity} x {formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}</span>
              <span>{formatCurrency(item.total, data.currency, data.currencySymbol)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 space-y-1 text-xs">
        <div style={rowStyle}><span>Subtotal</span><span>{formatCurrency(vat.vatExclusive, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>VAT (16%)</span><span>{formatCurrency(vat.vatAmount, data.currency, data.currencySymbol)}</span></div>
        {data.discountAmount > 0 && (
          <div style={rowStyle}><span>Discount</span><span>-{formatCurrency(data.discountAmount, data.currency, data.currencySymbol)}</span></div>
        )}
        <div style={rowStyle} className="font-bold text-sm pt-1 border-t border-slate-400"><span>TOTAL</span><span>{formatCurrency(data.total, data.currency, data.currencySymbol)}</span></div>
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 space-y-1 text-xs">
        <div style={rowStyle}><span>Payment</span><span>{data.paymentMethod}</span></div>
        <div style={rowStyle}><span>Paid</span><span>{formatCurrency(data.amountPaid, data.currency, data.currencySymbol)}</span></div>
        {data.changeAmount > 0 && (
          <div style={rowStyle}><span>Change</span><span>{formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</span></div>
        )}
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-center text-xs">
        <div style={centerStyle} className="w-16 h-16 mx-auto bg-white border border-slate-300 rounded flex items-center justify-center">
          {data.qrData ? (
            <QRCodeSVG value={data.qrData} size={56} level="M" includeMargin={false} />
          ) : (
            <span className="text-slate-400 text-[10px]">QR</span>
          )}
        </div>
        <div className="mt-1 text-slate-500">Scan to verify</div>
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-center text-xs space-y-0.5">
        <p className="font-medium">Thank you for shopping with us.</p>
        <p>Please come again.</p>
        {data.footerText && <p className="mt-1 text-slate-500">{data.footerText}</p>}
        {data.branchWebsite && !data.footerText && <p>{data.branchWebsite}</p>}
      </div>

      <div className="text-center text-[10px] text-slate-400 mt-2">All prices are VAT Inclusive.</div>
    </div>
  );
}
