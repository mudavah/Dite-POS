'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

async function fetchStockMovements(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.type) query.set('type', params.type);
  if (params?.productId) query.set('productId', params.productId);
  if (params?.page) query.set('page', params.page);
  if (params?.limit) query.set('limit', params.limit);
  const res = await fetch(`/api/stock-movements?${query}`);
  if (!res.ok) throw new Error('Failed to fetch stock movements');
  return res.json();
}

export default function StockMovementsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['stockMovements', { search, type, page: currentPage, limit }],
    queryFn: () => fetchStockMovements({ search, type, page: String(currentPage), limit: String(limit) }),
  });

  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">Track all inventory changes</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search movements..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Types</option>
                <option value="PURCHASE">Purchase</option>
                <option value="SALE">Sale</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="RETURN">Return</option>
                <option value="DAMAGE">Damage</option>
                <option value="OPENING_STOCK">Opening Stock</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
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
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">Product</th>
                      <th className="p-3 text-left font-medium">SKU</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-left font-medium">Quantity</th>
                      <th className="p-3 text-left font-medium">Branch</th>
                      <th className="p-3 text-left font-medium">Reference</th>
                      <th className="p-3 text-left font-medium">User</th>
                      <th className="p-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                      {(data?.movements || []).map((movement: { id: string; type: string; quantity: number; notes: string | null; createdAt: string; reference?: string; inventory?: { product?: { name: string; sku: string }; branch?: { name: string } }; user?: { name: string } | null }) => (
                      <tr key={movement.id} className="border-t">
                        <td className="p-3 text-xs">{formatDate(movement.createdAt)}</td>
                        <td className="p-3 font-medium">
                          {movement.inventory?.product?.name || '-'}
                        </td>
                        <td className="p-3 font-mono text-xs">{movement.inventory?.product?.sku || '-'}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              movement.type === 'PURCHASE' || movement.type === 'RETURN'
                                ? 'success'
                                : movement.type === 'SALE' || movement.type === 'DAMAGE'
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {movement.type?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className={movement.quantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </td>
                        <td className="p-3">{movement.inventory?.branch?.name || '-'}</td>
                        <td className="p-3 font-mono text-xs">{movement.reference || '-'}</td>
                        <td className="p-3 text-xs">{movement.user?.name || 'Unknown'}</td>
                        <td className="p-3 text-xs line-clamp-1 max-w-[200px]">{movement.notes || '-'}</td>
                      </tr>
                    ))}
                    {(!data?.movements || data.movements.length === 0) && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          No stock movements found
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