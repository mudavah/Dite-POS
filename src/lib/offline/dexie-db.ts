import Dexie from 'dexie';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  image?: string;
  categoryId: string;
  category?: { name: string };
  isActive: boolean;
  cachedAt: string;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  cachedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  cachedAt: string;
}

export interface SyncMeta {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface OfflineSale {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: string;
  status: string;
  retries: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes?: string;
}

export interface OfflineReceipt {
  id: string;
  saleId: string;
  receiptNo: string;
  branchId: string;
  status: string;
  printedAt?: string;
  createdAt: string;
}

export interface OfflineInventory {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  updatedAt: string;
}

const db = new Dexie('DitePOS') as Dexie & {
  products: Dexie.Table<Product, string>;
  categories: Dexie.Table<Category, string>;
  customers: Dexie.Table<Customer, string>;
  salesQueue: Dexie.Table<OfflineSale, string>;
  saleItems: Dexie.Table<OfflineSaleItem, string>;
  receipts: Dexie.Table<OfflineReceipt, string>;
  inventory: Dexie.Table<OfflineInventory, string>;
  syncMeta: Dexie.Table<SyncMeta, string>;
  cartDraft: Dexie.Table<CartDraft, string>;
};

db.version(1).stores({
  products: 'id, sku, barcode, categoryId, isActive',
  categories: 'id, name, isActive',
  customers: 'id, name, isActive',
  salesQueue: 'id, status, createdAt, entityType',
  saleItems: 'id, saleId',
  receipts: 'id, saleId, receiptNo, status',
  inventory: 'id, branchId, productId',
  syncMeta: 'id, key',
  cartDraft: 'id',
});

export interface CartDraft {
  id: string;
  items: string;
  selectedCustomer: string | null;
  updatedAt: string;
}

export { db };
