'use client';

import * as React from 'react';
import { useCachedQuery } from '@/hooks/use-offline-cache';
import { Search, Package } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  image?: string;
  categoryId: string;
  category?: { name: string };
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface ProductGridProps {
  onSelect: (product: Product) => void;
}

async function fetchProducts(search?: string, categoryId?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (categoryId) params.set('categoryId', categoryId);
  const res = await fetch(`/api/pos/products?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/pos/categories');
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export function ProductGrid({ onSelect }: ProductGridProps) {
  const [search, setSearch] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const [barcodeBuffer, setBarcodeBuffer] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading: productsLoading } = useCachedQuery(
    ['pos-products', search, activeCategory],
    () => fetchProducts(search || undefined, activeCategory === 'all' ? undefined : activeCategory),
    'products',
    false
  );

  const { data: categories = [], isLoading: categoriesLoading } = useCachedQuery(
    ['pos-categories'],
    fetchCategories,
    'categories'
  );

  const filtered = React.useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
    );
  }, [products, search]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 text-base"
          />
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} defaultValue="all" className="flex-1">
        <TabsList className="mb-3 w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="shrink-0">All</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="shrink-0">
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-0 flex-1">
          <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {productsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-3">
                  <div className="flex h-24 items-center justify-center rounded-md bg-muted" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-1 h-3 w-1/2 rounded bg-muted" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="mb-2 h-12 w-12" />
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm">Try a different search or category</p>
              </div>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => onSelect(product)}
                  className="group flex flex-col items-start rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex h-24 w-full items-center justify-center rounded-md bg-muted/50 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-2 w-full">
                    <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(product.price)}</p>
                </button>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
