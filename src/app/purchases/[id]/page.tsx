'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { ArrowLeft, Save, Trash2, Download, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

async function fetchPurchase(id: string) {
  const res = await fetch(`/api/purchases/${id}`);
  if (!res.ok) throw new Error('Failed to fetch purchase');
  return res.json();
}

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => fetchPurchase(id),
  });

  const receiveMutation = useMutation({
    mutationFn: () => fetch(`/api/purchases/${id}/receive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Success', description: 'Purchase received successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to receive purchase', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/purchases/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      router.push('/purchases');
      toast({ title: 'Success', description: 'Purchase deleted successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete purchase', variant: 'destructive' });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (!purchase) {
    return <div className="text-center py-8 text-muted-foreground">Purchase not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Purchase {purchase.purchaseNumber}</h1>
            <p className="text-muted-foreground">Purchase Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {purchase.status !== 'RECEIVED' && purchase.status !== 'CANCELLED' && (
            <Button variant="default" onClick={() => receiveMutation.mutate()}>
              <Save className="h-4 w-4 mr-2" />
              Receive Stock
            </Button>
          )}
          <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{purchase.supplier?.name || '-'}</p>
            <p className="text-sm text-muted-foreground">{purchase.supplier?.phone || '-'}</p>
            <p className="text-sm text-muted-foreground">{purchase.supplier?.email || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Purchase Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{new Date(purchase.purchaseDate).toLocaleDateString()}</p>
            <p className="text-sm text-muted-foreground">Invoice: {purchase.invoiceNumber || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{purchase.paymentMethod}</p>
            <Badge variant={purchase.status === 'RECEIVED' ? 'success' : purchase.status === 'CANCELLED' ? 'destructive' : 'default'}>
              {purchase.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(purchase.outstandingBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">Product</th>
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-left font-medium">Quantity</th>
                  <th className="p-3 text-left font-medium">Buying Price</th>
                  <th className="p-3 text-left font-medium">Selling Price</th>
                  <th className="p-3 text-left font-medium">Discount</th>
                  <th className="p-3 text-left font-medium">Tax</th>
                  <th className="p-3 text-left font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.productName}</td>
                    <td className="p-3 font-mono">{item.sku || '-'}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{formatCurrency(item.buyingPrice)}</td>
                    <td className="p-3">{formatCurrency(item.sellingPrice)}</td>
                    <td className="p-3">{formatCurrency(item.discount)}</td>
                    <td className="p-3">{formatCurrency(item.tax)}</td>
                    <td className="p-3 font-medium">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={7} className="p-3 text-right font-medium">Subtotal</td>
                  <td className="p-3 font-medium">{formatCurrency(purchase.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={7} className="p-3 text-right font-medium">Discount</td>
                  <td className="p-3">{formatCurrency(purchase.discountAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={7} className="p-3 text-right font-medium">Tax</td>
                  <td className="p-3">{formatCurrency(purchase.taxAmount)}</td>
                </tr>
                <tr className="border-t">
                  <td colSpan={7} className="p-3 text-right font-bold">Grand Total</td>
                  <td className="p-3 font-bold">{formatCurrency(purchase.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {purchase.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{purchase.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}