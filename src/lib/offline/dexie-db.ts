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

const db = new Dexie('DitePOS') as Dexie & {
  products: Dexie.Table<Product, string>;
  categories: Dexie.Table<Category, string>;
  customers: Dexie.Table<Customer, string>;
  salesQueue: Dexie.Table<OfflineSale, string>;
  syncMeta: Dexie.Table<SyncMeta, string>;
  cartDraft: Dexie.Table<CartDraft, string>;
};

db.version(1).stores({
  products: 'id, sku, barcode, categoryId, isActive',
  categories: 'id, name, isActive',
  customers: 'id, name, isActive',
  salesQueue: 'id, status, createdAt, entityType',
  syncMeta: 'id, key',
  cartDraft: 'id',
});

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

export interface CartDraft {
  id: string;
  items: string;
  selectedCustomer: string | null;
  updatedAt: string;
}

export { db };
