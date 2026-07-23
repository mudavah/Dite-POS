import { create } from 'zustand';
import { db } from '@/lib/offline/dexie-db';
import { logger } from '@/lib/logger';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface PosState {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflict' | 'complete';
  cartSheetOpen: boolean;
  checkoutOpen: boolean;

  openCheckoutFlow: () => void;
  closeCheckoutFlow: (reopenCart?: boolean) => void;
  setCartSheetOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  addToCart: (product: { id: string; name: string; sku?: string; price: number }) => void;
  updateQuantity: (id: string, delta: number) => void;
  updateQuantityDirect: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  updateItemNote: (id: string, notes: string) => void;
  clearCart: () => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setOnline: (isOnline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncAt: (date: string | null) => void;
  setSyncStatus: (status: PosState['syncStatus']) => void;
  restoreCart: () => Promise<void>;
  persistCart: () => Promise<void>;
  completeOfflineSale: (
    payload: Record<string, unknown>,
    branchId: string,
    cashierId: string
  ) => Promise<{ saleId: string; receiptNo: string } | null>;
  getOfflineSales: () => Promise<{ id: string; totalAmount: number; createdAt: string; syncStatus: string }[]>;
  getOfflineSaleItems: (saleId: string) => Promise<Record<string, unknown>[]>;
  getOfflineReceipt: (saleId: string) => Promise<{ receiptNo: string; status: string } | undefined>;
  deleteOfflineSale: (saleId: string) => Promise<void>;
}

export const subtotal = (cart: CartItem[]) => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
export const totalDiscount = (cart: CartItem[]) => cart.reduce((sum, item) => sum + item.discount, 0);

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  selectedCustomer: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSyncCount: 0,
  lastSyncAt: null,
  syncStatus: 'idle',
  cartSheetOpen: false,
  checkoutOpen: false,

  openCheckoutFlow: () => {
    set({ cartSheetOpen: false });
    setTimeout(() => set({ checkoutOpen: true }), 300);
  },

  closeCheckoutFlow: (reopenCart = true) => {
    set({ checkoutOpen: false });
    setTimeout(() => {
      if (reopenCart && get().cart.length > 0) {
        set({ cartSheetOpen: true });
      }
    }, 100);
  },

  setCartSheetOpen: (cartSheetOpen) => set({ cartSheetOpen }),
  setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),

  addToCart: (product) =>
    set((prev) => {
      const existing = prev.cart.find((item) => item.productId === product.id);
      if (existing) {
        return {
          cart: prev.cart.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
              : item
          ),
        };
      }
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 1,
        discount: 0,
        total: product.price,
      };
      return { cart: [...prev.cart, newItem] };
    }),

  updateQuantity: (id, delta) =>
    set((prev) => ({
      cart: prev.cart
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        })
        .filter((item) => item.quantity > 0),
    })),

  updateQuantityDirect: (id, quantity) =>
    set((prev) => ({
      cart: prev.cart
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(1, quantity);
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        })
        .filter((item) => item.quantity > 0),
    })),

  removeItem: (id) =>
    set((prev) => ({
      cart: prev.cart.filter((item) => item.id !== id),
    })),

  updateItemNote: (id, notes) =>
    set((prev) => ({
      cart: prev.cart.map((item) => (item.id === id ? { ...item, notes } : item)),
    })),

  clearCart: () => set({ cart: [], selectedCustomer: null }),

  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),

  setOnline: (isOnline) => set({ isOnline }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),

  persistCart: async () => {
    const { cart, selectedCustomer } = get();
    try {
      await db.cartDraft.put({
        id: 'current',
        items: JSON.stringify(cart),
        selectedCustomer: selectedCustomer ? JSON.stringify(selectedCustomer) : null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to persist cart', error);
    }
  },

  restoreCart: async () => {
    try {
      const draft = await db.cartDraft.get('current');
      if (draft) {
        const cart = JSON.parse(draft.items) as CartItem[];
        const selectedCustomer = draft.selectedCustomer ? (JSON.parse(draft.selectedCustomer) as Customer) : null;
        set({ cart, selectedCustomer });
      }
    } catch (error) {
      logger.error('Failed to restore cart', error);
    }
  },

  completeOfflineSale: async (payload, branchId) => {
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const receiptNo = `OFF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now() % 100000).padStart(5, '0')}`;

    try {
      await db.salesQueue.add({
        id: saleId,
        entityType: 'sale',
        entityId: saleId,
        action: 'CREATE',
        payload: JSON.stringify(payload),
        status: 'PENDING',
        retries: 0,
        createdAt: now,
        updatedAt: now,
      });

      await db.receipts.add({
        id: crypto.randomUUID(),
        saleId,
        receiptNo,
        branchId,
        status: 'PENDING_SYNC',
        createdAt: now,
      });

      const items = (payload.items as Array<Record<string, unknown>>) || [];
      for (const item of items) {
        await db.saleItems.add({
          id: crypto.randomUUID(),
          saleId,
          productId: item.productId as string,
          productName: (item.productName as string) || (item.sku as string) || '',
          sku: item.sku as string | undefined,
          quantity: item.quantity as number,
          unitPrice: item.unitPrice as number,
          discount: (item.discount as number) || 0,
          total: item.total as number,
          notes: item.notes as string | undefined,
        });
      }

      return { saleId, receiptNo };
    } catch {
      return null;
    }
  },

  getOfflineSales: async () => {
    const sales = await db.salesQueue.where('entityType').equals('sale').toArray();
    return sales.map((s) => ({
      id: s.id,
      totalAmount: (() => {
        try {
          const payload = JSON.parse(s.payload);
          return payload.totalAmount || 0;
        } catch {
          return 0;
        }
      })(),
      createdAt: s.createdAt,
      syncStatus: s.status,
    }));
  },

  getOfflineSaleItems: async (saleId: string) => {
    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    return items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
      notes: item.notes,
    }));
  },

  getOfflineReceipt: async (saleId: string) => {
    const receipt = await db.receipts.where('saleId').equals(saleId).first();
    if (!receipt) return undefined;
    return { receiptNo: receipt.receiptNo, status: receipt.status };
  },

  deleteOfflineSale: async (saleId: string) => {
    await db.salesQueue.delete(saleId);
    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      await db.saleItems.bulkDelete(itemIds);
    }
    const receipts = await db.receipts.where('saleId').equals(saleId).toArray();
    const receiptIds = receipts.map((r) => r.id);
    if (receiptIds.length > 0) {
      await db.receipts.bulkDelete(receiptIds);
    }
  },
}));
