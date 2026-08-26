'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

async function fetchSuppliers(params?: Record<string, string>): Promise<{ suppliers: Array<{ id: string; name: string; companyName?: string | null; contactPerson?: string | null; phone?: string | null; email?: string | null; totalPurchases: number; totalAmountPurchased: number; outstandingBalance: number; lastPurchaseDate: string | null; status: string }>; total: number; page: number; limit: number; totalPages: number; summary: { totalSuppliers: number; activeSuppliers: number; totalPurchases: number; totalAmountPurchased: number; outstandingBalance: number } }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', params.page);
  if (params?.limit) query.set('limit', params.limit);
  const res = await fetch(`/api/suppliers?${query}`);
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

async function deleteSupplier(id: string) {
  const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete supplier');
  return res.json();
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { search, status, page: currentPage, limit }],
    queryFn: () => fetchSuppliers({ search, status, page: String(currentPage), limit: String(limit) }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Success', description: 'Supplier deactivated successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete supplier', variant: 'destructive' });
    },
  });

  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">Manage your suppliers and view purchase history</p>
        </div>
        <Button onClick={() => (window.location.href = '/suppliers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {data?.summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
              <Package className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalSuppliers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
              <RefreshCw className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.activeSuppliers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalPurchases || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.summary.outstandingBalance || 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Supplier</th>
                      <th className="p-3 text-left font-medium">Company</th>
                      <th className="p-3 text-left font-medium">Contact</th>
                      <th className="p-3 text-left font-medium">Phone</th>
                      <th className="p-3 text-left font-medium">Email</th>
                      <th className="p-3 text-left font-medium">Total Purchases</th>
                      <th className="p-3 text-left font-medium">Total Purchased</th>
                      <th className="p-3 text-left font-medium">Outstanding</th>
                      <th className="p-3 text-left font-medium">Last Purchase</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                     {data?.suppliers?.map((supplier) => (
                      <tr key={supplier.id} className="border-t">
                        <td className="p-3 font-medium">{supplier.name}</td>
                        <td className="p-3">{supplier.companyName || '-'}</td>
                        <td className="p-3">{supplier.contactPerson || '-'}</td>
                        <td className="p-3">{supplier.phone || '-'}</td>
                        <td className="p-3">{supplier.email || '-'}</td>
                        <td className="p-3">{supplier.totalPurchases || 0}</td>
                        <td className="p-3 font-medium">{formatCurrency(supplier.totalAmountPurchased || 0)}</td>
                        <td className="p-3">{formatCurrency(supplier.outstandingBalance || 0)}</td>
                        <td className="p-3 text-xs">
                          {supplier.lastPurchaseDate ? new Date(supplier.lastPurchaseDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {supplier.status}
                          </Badge>
                        </td>
                         <td className="p-3">
                           <div className="flex items-center gap-2">
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => deleteMutation.mutate(supplier.id)}
                             >
                               <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                           </div>
                         </td>
                      </tr>
                    ))}
                    {data?.suppliers?.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-muted-foreground">
                          No suppliers found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
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
    </div>
  );
}