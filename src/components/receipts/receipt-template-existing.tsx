'use client';

import * as React from 'react';
import { formatCurrency, formatDate, calculateVatBreakdown } from '@/lib/utils';
import type { ReceiptData } from '@/lib/printer/receipt-template';

interface ReceiptTemplateExistingProps {
  data: ReceiptData;
  paperSize?: '58mm' | '80mm';
}

export function ReceiptTemplateExisting({ data, paperSize = '80mm' }: ReceiptTemplateExistingProps) {
  const vat = calculateVatBreakdown(data.total);
  const displayCustomer = data.customerName || 'Walk-in Customer';
  const width = paperSize === '58mm' ? 280 : 320;
  const padding = paperSize === '58mm' ? 10 : 14;
  const fontSize = paperSize === '58mm' ? 10 : 11;

  const centerStyle: React.CSSProperties = { textAlign: 'center' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 4 };

  return (
    <div
      className="font-mono text-black bg-white"
      style={{ width, maxWidth: '100%', padding, margin: '0 auto', fontSize }}
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
        <div style={rowStyle} className="text-xs"><span>Receipt No:</span><span>{data.receiptNo}</span></div>
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

      {data.saleNotes && (
        <div className="text-xs text-slate-500 border-t border-dashed border-slate-300 pt-2 mt-2">
          <p className="font-medium text-slate-600 mb-1">Notes</p>
          <p>{data.saleNotes}</p>
        </div>
      )}

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

      <div style={centerStyle} className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs space-y-0.5">
        <p className="font-medium">Thank you for shopping with us.</p>
        <p>Please come again.</p>
        {data.footerText && <p className="mt-1 text-slate-500">{data.footerText}</p>}
        {data.branchWebsite && !data.footerText && <p>{data.branchWebsite}</p>}
      </div>

      <div style={centerStyle} className="text-[10px] text-slate-400 mt-2">All prices are VAT Inclusive.</div>
    </div>
  );
}