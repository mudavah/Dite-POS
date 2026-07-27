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
  const maxDescLen = paperSize === '58mm' ? 16 : 22;

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
          <span style={{ width: 30 }}>QTY</span>
          <span style={{ flex: 1 }}>DESCRIPTION</span>
          <span style={{ width: 36, textAlign: 'right' }}>VAT</span>
          <span style={{ width: 60, textAlign: 'right' }}>PRICE</span>
          <span style={{ width: 60, textAlign: 'right' }}>AMOUNT</span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {data.items.map((item, idx) => {
          const desc = item.description.length > maxDescLen ? item.description.slice(0, maxDescLen - 1) + '..' : item.description;
          return (
            <div key={idx} style={rowStyle}>
              <span style={{ width: 30 }}>{item.qty}</span>
              <span style={{ flex: 1 }} className="truncate">{desc}</span>
              <span style={{ width: 36, textAlign: 'right' }}>{item.vatCode}</span>
              <span style={{ width: 60, textAlign: 'right' }}>{formatCurrency(item.unitPrice, data.currency, data.currencySymbol)}</span>
              <span style={{ width: 60, textAlign: 'right' }}>{formatCurrency(item.lineTotal, data.currency, data.currencySymbol)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 space-y-1 text-xs">
        <div style={rowStyle}><span>SUBTOTAL</span><span>{formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>TOTAL AMOUNT</span><span>{formatCurrency(data.totalAmount, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>CASH</span><span>{formatCurrency(data.cashReceived, data.currency, data.currencySymbol)}</span></div>
        <div style={rowStyle}><span>CHANGE</span><span>{formatCurrency(data.changeAmount, data.currency, data.currencySymbol)}</span></div>
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs space-y-1">
        <div style={rowStyle}>
          <span style={{ width: 60 }} className="font-bold">VAT CODE</span>
          <span style={{ width: 50 }} className="font-bold">RATE</span>
          <span style={{ width: 90, textAlign: 'right' }} className="font-bold">TAXABLE AMOUNT</span>
          <span style={{ width: 80, textAlign: 'right' }} className="font-bold">VAT AMOUNT</span>
        </div>
        <div style={rowStyle}>
          <span style={{ width: 60 }}>A</span>
          <span style={{ width: 50 }}>16%</span>
          <span style={{ width: 90, textAlign: 'right' }}>{formatCurrency(data.subtotal, data.currency, data.currencySymbol)}</span>
          <span style={{ width: 80, textAlign: 'right' }}>{formatCurrency(data.totalAmount - data.subtotal, data.currency, data.currencySymbol)}</span>
        </div>
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