'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import {
  Search,
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Filter,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

async function fetchProducts(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.status) query.set('status', params.status);
  if (params?.archived) query.set('archived', params.archived);
  const res = await fetch(`/api/products?${query}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

async function bulkAction(data: { action: string; productIds: string[]; data?: any }) {
  const res = await fetch('/api/products/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to perform bulk action');
  return res.json();
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, categoryId, status, archived: showArchived }],
    queryFn: () => fetchProducts({ search, categoryId, status, archived: String(showArchived) }),
  });

  const deleteMutation = useMutation({ mutationFn: deleteProduct, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }) });
  const bulkMutation = useMutation({ mutationFn: bulkAction, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setSelectedIds([]); } });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.products?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.products?.map((p: any) => p.id) || []);
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    bulkMutation.mutate({ action, productIds: selectedIds });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => (window.location.href = '/products/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background pl-8 pr-8 text-sm"
                >
                  <option value="">All Categories</option>
                  {data?.categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? <><ArchiveRestore className="h-4 w-4 mr-2" />Show Active</> : <><Archive className="h-4 w-4 mr-2" />Show Archived</>}
              </Button>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('archive')}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === data?.products?.length && data?.products?.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="p-3 text-left font-medium">SKU</th>
                    <th className="p-3 text-left font-medium">Category</th>
                    <th className="p-3 text-left font-medium">Price</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.products?.map((product: any) => (
                    <tr key={product.id} className="border-t">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                        </div>
                      </td>
                      <td className="p-3 font-mono">{product.sku}</td>
                      <td className="p-3">{product.category?.name || '-'}</td>
                      <td className="p-3">{formatCurrency(product.price)}</td>
                      <td className="p-3">
                        <Badge variant={product.isActive ? 'success' : 'secondary'}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => (window.location.href = `/products/${product.id}`)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.products?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
