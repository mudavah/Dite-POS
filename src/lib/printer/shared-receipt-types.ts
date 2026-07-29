export interface ReceiptItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface ReceiptDataBase {
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
  customerTin?: string;
  paymentMethod: string;
  paymentReference?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  currency?: string;
  currencySymbol?: string;
  footerText?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED';
  isOffline?: boolean;
  saleNotes?: string;
}
