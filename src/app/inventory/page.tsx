'use client';

import { useState, useCallback } from 'react';
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
  ShoppingCart,
  Plus,
  Trash2,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

import { toNumeric } from '@/lib/numeric';
import { useToast } from '@/components/ui/toast';
import { StockMovementType } from '@prisma/client';

interface InventoryProduct {
  name: string;
  sku: string;
  price: number;
  isActive: boolean;
  lowStockThreshold: number;
  costPrice: number | null;
  isArchived: boolean;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  user?: { name: string } | null;
}

interface InventoryItem {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  reserved: number;
  createdAt: string;
  updatedAt: string;
  product: InventoryProduct;
  branch: { name: string; code: string };
  movements: StockMovement[];
}

interface InventoryData {
  inventory: InventoryItem[];
  branches: { id: string; name: string; code: string }[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  summary: { totalItems: number; totalProducts: number; totalValue: number; lowStock: number; outOfStock: number };
}

async function fetchInventory(params?: Record<string, string>): Promise<InventoryData> {
  const query = new URLSearchParams();
  if (params?.branchId) query.set('branchId', params.branchId);
  if (params?.search) query.set('search', params.search);
  if (params?.lowStock) query.set('lowStock', params.lowStock);
  if (params?.page) query.set('page', params.page);
  if (params?.limit) query.set('limit', params.limit);
  const res = await fetch(`/api/inventory?${query}`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

async function adjustStock(data: { inventoryId: string; quantity: number; type: StockMovementType; notes?: string }) {
  const res = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to adjust stock');
  return res.json();
}

async function receivePurchaseAction(purchaseId: string) {
  const res = await fetch(`/api/purchases/${purchaseId}/receive`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to receive purchase');
  return res.json();
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', { branchId, search, lowStock: showLowStock, page: currentPage, limit }],
    queryFn: () => fetchInventory({ branchId, search, lowStock: String(showLowStock), page: String(currentPage), limit: String(limit) }),
  });

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowAdjustModal(false);
      toast({ title: 'Success', description: 'Stock adjusted successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to adjust stock', variant: 'destructive' });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: receivePurchaseAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Success', description: 'Purchase received successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to receive purchase', variant: 'destructive' });
    },
  });

  const [adjustForm, setAdjustForm] = useState<{ quantity: string; type: StockMovementType; notes: string }>({ quantity: '', type: 'ADJUSTMENT', notes: '' });
  const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');

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

  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage stock across branches</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => (window.location.href = '/purchases/new')}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            New Purchase
          </Button>
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-2" />
            Stock History
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/stock-movements')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Movements
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.totalProducts || 0}</div>
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
              {data?.summary?.lowStock || 0}
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
              {data?.summary?.outOfStock || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Inventory Overview</CardTitle>
            <div className="flex items-center gap-2">
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
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search inventory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Product</th>
                      <th className="p-3 text-left font-medium">SKU</th>
                      <th className="p-3 text-left font-medium">Quantity</th>
                      <th className="p-3 text-left font-medium">Available</th>
                      <th className="p-3 text-left font-medium">Cost</th>
                      <th className="p-3 text-left font-medium">Value</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                   {(data?.inventory || []).map((item: InventoryItem) => {
                      const available = item.quantity - (item.reserved || 0);
                      const isLowStock = item.quantity <= item.product.lowStockThreshold;
                      const cost = toNumeric(item.product?.costPrice) || toNumeric(item.product?.price) || 0;
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(cost)}</p>
                          </td>
                          <td className="p-3 font-mono text-xs">{item.product.sku}</td>
                          <td className="p-3">
                            <span className={isLowStock && item.quantity > 0 ? 'text-amber-600 font-medium' : item.quantity === 0 ? 'text-destructive font-medium' : ''}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="p-3">{available}</td>
                          <td className="p-3">{formatCurrency(cost)}</td>
                          <td className="p-3 font-medium">{formatCurrency(item.quantity * cost)}</td>
                          <td className="p-3">
                            {isLowStock && item.quantity > 0 ? (
                              <Badge variant="warning">Low Stock</Badge>
                            ) : item.quantity === 0 ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : (
                              <Badge variant="success">In Stock</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!data?.inventory || data.inventory.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No inventory found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
                <p className="font-medium">{selectedItem.product?.name}</p>
                <p className="text-sm text-muted-foreground">Current stock: {selectedItem.quantity}</p>
                <p className="text-sm text-muted-foreground">Available: {selectedItem.quantity - (selectedItem.reserved || 0)}</p>
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
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as StockMovementType })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="RETURN">Return</option>
                    <option value="SALE">Sale</option>
                    <option value="DAMAGE">Damage</option>
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
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-auto">
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
                {(data?.inventory || []).flatMap((item: InventoryItem) =>
                  (item.movements || []).map((movement: StockMovement) => (
                    <div key={movement.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {movement.type?.replace('_', ' ')} - {movement.notes || 'No notes'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By {movement.user?.name || 'Unknown'} on {new Date(movement.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={movement.quantity >= 0 ? 'success' : 'destructive'}>
                        {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
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
