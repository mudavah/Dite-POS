'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import {
  Search,
  Package,
  TrendingUp,
  AlertTriangle,
  History,
  DollarSign,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

async function fetchInventory(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.branchId) query.set('branchId', params.branchId);
  if (params?.search) query.set('search', params.search);
  if (params?.lowStock) query.set('lowStock', params.lowStock);
  const res = await fetch(`/api/inventory?${query}`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

async function adjustStock(data: any) {
  const res = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to adjust stock');
  return res.json();
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', { branchId, search, lowStock: showLowStock }],
    queryFn: () => fetchInventory({ branchId, search, lowStock: String(showLowStock) }),
  });

  const adjustMutation = useMutation({ mutationFn: adjustStock, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }) });

  const [adjustForm, setAdjustForm] = useState({ quantity: '', type: 'ADJUSTMENT', notes: '' });

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    adjustMutation.mutate({
      inventoryId: selectedItem.id,
      quantity: parseInt(adjustForm.quantity),
      type: adjustForm.type,
      notes: adjustForm.notes,
    });
    setShowAdjustModal(false);
    setAdjustForm({ quantity: '', type: 'ADJUSTMENT', notes: '' });
    setSelectedItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage stock across branches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-2" />
            Stock History
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.totalItems || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.summary?.totalValue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.inventory?.filter((inv: any) => inv.quantity <= inv.product.lowStockThreshold).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.inventory?.filter((inv: any) => inv.quantity === 0).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inventory..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Branches</option>
                {data?.branches?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <Button
                variant={showLowStock ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowLowStock(!showLowStock)}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Low Stock
              </Button>
            </div>
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
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="p-3 text-left font-medium">SKU</th>
                    <th className="p-3 text-left font-medium">Branch</th>
                    <th className="p-3 text-left font-medium">Quantity</th>
                    <th className="p-3 text-left font-medium">Reserved</th>
                    <th className="p-3 text-left font-medium">Available</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.inventory?.map((item: any) => {
                    const available = item.quantity - item.reserved;
                    const isLowStock = item.quantity <= item.product.lowStockThreshold;
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
                          </div>
                        </td>
                        <td className="p-3 font-mono">{item.product.sku}</td>
                        <td className="p-3">{item.branch.name}</td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">{item.reserved}</td>
                        <td className="p-3">{available}</td>
                        <td className="p-3">
                          {isLowStock ? (
                            <Badge variant="destructive">Low Stock</Badge>
                          ) : item.quantity === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAdjustModal(true);
                            }}
                          >
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.inventory?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No inventory found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stock Adjustment</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowAdjustModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="font-medium">{selectedItem.product.name}</p>
                <p className="text-sm text-muted-foreground">Current stock: {selectedItem.quantity}</p>
              </div>
              <form onSubmit={handleAdjust} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity Change</label>
                  <Input
                    type="number"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                    placeholder="Enter quantity"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="RETURN">Return</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={adjustForm.notes}
                    onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdjustModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adjustMutation.isPending}>
                    {adjustMutation.isPending ? 'Saving...' : 'Save Adjustment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl mx-4 max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stock Movement History</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.inventory?.flatMap((item: any) =>
                  item.movements?.map((movement: any) => (
                    <div key={movement.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {movement.type} - {movement.notes || 'No notes'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By {movement.createdBy?.name || 'Unknown'} on {new Date(movement.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={movement.quantity > 0 ? 'success' : 'destructive'}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
