'use client';

import * as React from 'react';
import type { FiscalReceiptData } from '@/lib/printer/receipt-template';
import { formatCurrency } from '@/lib/utils';

interface ReceiptTemplateFiscalProps {
  data: FiscalReceiptData;
  paperSize?: '58mm' | '80mm';
}

export function ReceiptTemplateFiscal({ data, paperSize = '80mm' }: ReceiptTemplateFiscalProps) {
  const width = paperSize === '58mm' ? 280 : 320;
  const padding = paperSize === '58mm' ? 10 : 14;
  const fontSize = paperSize === '58mm' ? 9 : 10;

  const centerStyle: React.CSSProperties = { textAlign: 'center' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 4 };

  return (
    <div
      className="font-mono text-black bg-white"
      style={{ width, maxWidth: '100%', padding, margin: '0 auto', fontSize }}
    >
      <div style={centerStyle} className="space-y-0.5">
        <div className="font-bold text-sm">{data.shopName || 'Dite POS'}</div>
        <div>{data.companyPin}</div>
        <div>{data.companyAddress}</div>
        <div>P.O. Box {data.companyPoBox}</div>
        <div>{data.companyPhone}</div>
      </div>

      <div className="border-t border-b border-dashed border-slate-400 py-2 mt-2">
        <div style={centerStyle} className="font-bold">FISCAL RECEIPT</div>
      </div>

      <div className="space-y-0.5 text-xs">
        <div style={rowStyle}><span>Receipt No:</span><span>{data.receiptNo}</span></div>
        <div style={rowStyle}><span>Date:</span><span>{data.date}</span></div>
        <div style={rowStyle}><span>Time:</span><span>{data.time}</span></div>
        <div style={rowStyle}><span>Customer:</span><span>{data.customerName}</span></div>
        <div style={rowStyle}><span>Customer PIN:</span><span>{data.customerPin}</span></div>
        <div style={rowStyle}><span>Customer TIN:</span><span>{data.customerTin}</span></div>
        <div style={rowStyle}><span>Country:</span><span>{data.country}</span></div>
      </div>

      <div className="border-t border-b border-dashed border-slate-400 py-2 mt-2">
        <div style={rowStyle} className="text-xs font-bold">
          <span>QTY</span>
          <span className="flex-1">DESCRIPTION</span>
          <span>VAT</span>
          <span>PRICE</span>
          <span>AMOUNT</span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {data.items.map((item, idx) => (
          <div key={idx} style={rowStyle}>
            <span>{item.qty}</span>
            <span className="flex-1 truncate">{item.description}</span>
            <span>{item.vatCode}</span>
            <span>{formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}</span>
            <span>{formatCurrency(item.lineTotal, data.currency, data.currencySymbol)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 space-y-1 text-xs">
        <div style={rowStyle}><span>SUBTOTAL</span><span>{formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>TOTAL AMOUNT</span><span>{formatCurrency(data.totalAmount, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>CASH</span><span>{formatCurrency(data.cashReceived, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>CHANGE</span><span>{formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</span></div>
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs">
        <div style={rowStyle} className="font-bold"><span>VAT CODE</span><span>RATE</span><span>TAXABLE AMOUNT</span><span>VAT AMOUNT</span></div>
        <div style={rowStyle}><span>A</span><span>16%</span><span>{formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</span><span>{formatCurrency(data.totalAmount - data.subtotal, data.currency, data.currencySymbol)}</span></div>
      </div>

      <div style={centerStyle} className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs">
        <img src="/assets/receipt-qr.png" alt="QR Code" style={{ width: 80, height: 80 }} />
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs space-y-0.5">
        <div>Control Unit Serial: {data.controlUnitSerial}</div>
        <div>Control Unit Invoice: {data.controlUnitInvoice}</div>
        <div>Attended By: {data.attendedBy}</div>
      </div>

      <div style={centerStyle} className="mt-2 text-xs">Thank you for your visit.</div>
    </div>
  );
}