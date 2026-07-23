'use client';

import * as React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

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
  receiptNo: string;
  saleId: string;
  date: string;
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
  currency?: string;
  currencySymbol?: string;
  footerText?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED';
  isOffline?: boolean;
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

  return (
    <div className="mx-auto max-w-md rounded-lg border border-border bg-white text-black">
      <div className="p-6 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">{data.shopName || 'Dite POS'}</h1>
          {data.branchName && <p className="text-sm text-gray-600">{data.branchName}</p>}
          {data.branchAddress && <p className="text-xs text-gray-500">{data.branchAddress}</p>}
          {data.branchPhone && <p className="text-xs text-gray-500">{data.branchPhone}</p>}
        </div>

        <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Receipt No</span>
            <span className="font-medium">{data.receiptNo}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sale ID</span>
            <span className="font-medium">{data.saleId.slice(-8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Date & Time</span>
            <span className="font-medium">{formatDate(data.date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cashier</span>
            <span className="font-medium">{data.cashierName}</span>
          </div>
          {data.customerName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Customer</span>
              <span className="font-medium">{data.customerName}</span>
            </div>
          )}
          {data.syncStatus && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status</span>
              <span className={`font-medium ${data.syncStatus === 'PENDING_SYNC' ? 'text-warning' : 'text-success'}`}>
                {data.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}
              </span>
            </div>
          )}
          {data.isOffline && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Mode</span>
              <span className="font-medium text-warning">Offline</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="border-b border-gray-200 pb-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
          </div>
          {data.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 text-sm">
              <div className="col-span-6">
                <p className="font-medium truncate">{item.productName}</p>
                {item.sku && <p className="text-xs text-gray-500">{item.sku}</p>}
              </div>
              <div className="col-span-2 text-center">{item.quantity}</div>
              <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
              <div className="col-span-2 text-right">{formatCurrency(item.total)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Discount</span>
              <span>-{formatCurrency(data.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Payment Method</span>
            <span className="font-medium">{data.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Amount Paid</span>
            <span className="font-medium">{formatCurrency(data.amountPaid)}</span>
          </div>
          {data.changeAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Change</span>
              <span className="font-medium text-green-600">{formatCurrency(data.changeAmount)}</span>
            </div>
          )}
        </div>

        {/* QR Code placeholder */}
        <div className="border-t border-dashed border-gray-300 pt-3 text-center">
          <div className="inline-block p-2 border border-gray-300 rounded">
            <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
              QR: {data.receiptNo}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Scan to verify</p>
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 text-center">
          <p className="text-sm text-gray-500">Thank you for shopping with us!</p>
        </div>
      </div>
    </div>
  );
}

function ThermalReceipt({ data, paperSize }: { data: ReceiptData; paperSize: '58mm' | '80mm' }) {
  const width = paperSize === '58mm' ? '280px' : '380px';
  const fontSize = paperSize === '58mm' ? '10px' : '12px';

  return (
    <div
      className="font-mono text-black bg-white p-4 mx-auto"
      style={{ width, fontSize }}
    >
      <div className="text-center space-y-1">
        <div className="font-bold text-sm">{data.shopName || 'Dite POS'}</div>
        {data.branchName && <div className="text-xs">{data.branchName}</div>}
        {data.branchAddress && <div className="text-xs">{data.branchAddress}</div>}
        {data.branchPhone && <div className="text-xs">{data.branchPhone}</div>}
      </div>

      <div className="border-t border-b border-dashed border-gray-400 py-2 mt-2 space-y-1">
        <div className="text-center font-bold text-xs">RECEIPT</div>
        <div className="flex justify-between text-xs">
          <span>Receipt:</span>
          <span>{data.receiptNo}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Date:</span>
          <span>{formatDate(data.date)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Cashier:</span>
          <span>{data.cashierName}</span>
        </div>
        {data.customerName && (
          <div className="flex justify-between text-xs">
            <span>Customer:</span>
            <span>{data.customerName}</span>
          </div>
        )}
        {data.syncStatus && (
          <div className="flex justify-between text-xs">
            <span>Status:</span>
            <span className={data.syncStatus === 'PENDING_SYNC' ? 'text-amber-600' : 'text-green-600'}>
              {data.syncStatus === 'PENDING_SYNC' ? 'Pending Synchronization' : 'Synced'}
            </span>
          </div>
        )}
        {data.isOffline && (
          <div className="flex justify-between text-xs">
            <span>Mode:</span>
            <span className="text-amber-600">Offline</span>
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1">
        <div className="border-b border-dashed border-gray-400 pb-1 text-xs font-bold">
          <div className="flex justify-between">
            <span>ITEM</span>
            <span>QTY</span>
            <span>TOTAL</span>
          </div>
        </div>
        {data.items.map((item, idx) => (
          <div key={idx} className="text-xs">
            <div className="font-medium truncate">{item.productName}</div>
            <div className="flex justify-between text-gray-600">
              <span>x{item.quantity} @ {formatCurrency(item.unitPrice)}</span>
              <span>{formatCurrency(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 pt-2 mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(data.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-400">
          <span>TOTAL</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 pt-2 mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Payment</span>
          <span>{data.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid</span>
          <span>{formatCurrency(data.amountPaid)}</span>
        </div>
        {data.changeAmount > 0 && (
          <div className="flex justify-between">
            <span>Change</span>
            <span>{formatCurrency(data.changeAmount)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 pt-2 mt-2 text-center text-xs">
        <div className="font-bold">Scan to verify</div>
        <div className="mt-1 inline-block p-1 border border-gray-400 rounded">
          <div className="w-16 h-16 bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
            QR
          </div>
        </div>
        <p className="mt-1">{data.receiptNo}</p>
      </div>

      <div className="border-t border-dashed border-gray-400 pt-2 mt-2 text-center text-xs">
        <p>Thank you for shopping!</p>
      </div>
    </div>
  );
}
