import { useEffect } from 'react';
import { usePosStore } from '@/store/use-pos-store';

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function useCartPersistence() {
  const cart = usePosStore((s) => s.cart);
  const selectedCustomer = usePosStore((s) => s.selectedCustomer);
  const persistCart = usePosStore((s) => s.persistCart);

  useEffect(() => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistCart();
    }, 150);
    return () => {
      if (persistTimer) clearTimeout(persistTimer);
    };
  }, [cart, selectedCustomer, persistCart]);
}
