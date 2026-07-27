'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Filter,
  ShoppingCart,
  DollarSign,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

async function fetchPurchases(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.status) query.set('status', params.status);
  const res = await fetch(`/api/purchases?${query}`);
  if (!res.ok) throw new Error('Failed to fetch purchases');
  return res.json();
}

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', { search, status }],
    queryFn: () => fetchPurchases({ search, status }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/purchases/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({ title: 'Success', description: 'Purchase deleted successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete purchase', variant: 'destructive' });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/purchases/${id}/receive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Success', description: 'Purchase received successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to receive purchase', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchases</h1>
          <p className="text-muted-foreground">Manage purchase orders and stock receiving</p>
        </div>
        <Button onClick={() => (window.location.href = '/purchases/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.purchases?.reduce((sum: number, p: any) => sum + p.grandTotal, 0) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <Package className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.purchases?.filter((p: any) => p.status === 'RECEIVED').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.purchases?.filter((p: any) => ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(p.status)).length || 0}
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
                  placeholder="Search purchases..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="ORDERED">Ordered</option>
                <option value="RECEIVED">Received</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
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
                    <th className="p-3 text-left font-medium">Purchase #</th>
                    <th className="p-3 text-left font-medium">Supplier</th>
                    <th className="p-3 text-left font-medium">Date</th>
                    <th className="p-3 text-left font-medium">Invoice</th>
                    <th className="p-3 text-left font-medium">Items</th>
                    <th className="p-3 text-left font-medium">Total</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.purchases?.map((purchase: any) => (
                    <tr key={purchase.id} className="border-t">
                      <td className="p-3 font-mono">{purchase.purchaseNumber}</td>
                      <td className="p-3">{purchase.supplier?.name || '-'}</td>
                      <td className="p-3">{new Date(purchase.createdAt).toLocaleDateString()}</td>
                      <td className="p-3">{purchase.invoiceNumber || '-'}</td>
                      <td className="p-3">{purchase.items?.length || 0}</td>
                      <td className="p-3">{formatCurrency(purchase.grandTotal)}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            purchase.status === 'RECEIVED'
                              ? 'success'
                              : purchase.status === 'CANCELLED'
                              ? 'destructive'
                              : purchase.status === 'DRAFT'
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          {purchase.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => (window.location.href = `/purchases/${purchase.id}`)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {purchase.status !== 'RECEIVED' && purchase.status !== 'CANCELLED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => receiveMutation.mutate(purchase.id)}
                            >
                              Receive
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(purchase.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.purchases?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No purchases found
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