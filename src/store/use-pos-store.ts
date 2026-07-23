import { create } from 'zustand';
import { db } from '@/lib/offline/dexie-db';

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
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflict';
  serverTimeOffset: number;

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
  serverTimeOffset: 0,

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
        id: `${product.id}-${Date.now()}`,
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
    } catch {
      // ignore persistence errors
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
    } catch {
      // ignore restore errors
    }
  },
}));
