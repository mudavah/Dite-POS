'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useQuery } from '@tanstack/react-query';

async function fetchSuppliers() {
  const res = await fetch('/api/suppliers');
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState([
    { productId: '', productName: '', sku: '', barcode: '', quantity: 1, buyingPrice: 0, sellingPrice: 0, discount: 0, tax: 0, lineTotal: 0, notes: '' },
  ]);

  const { data: suppliersData } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  const [form, setForm] = useState({
    supplierId: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    deliveryNote: '',
    paymentMethod: 'CASH',
    status: 'DRAFT',
    notes: '',
  });

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'buyingPrice') {
      newItems[index].lineTotal = (newItems[index].quantity || 0) * (newItems[index].buyingPrice || 0);
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { productId: '', productName: '', sku: '', barcode: '', quantity: 1, buyingPrice: 0, sellingPrice: 0, discount: 0, tax: 0, lineTotal: 0, notes: '' },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        items: items.map((item) => ({
          productId: item.productId || null,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          quantity: item.quantity,
          buyingPrice: item.buyingPrice,
          sellingPrice: item.sellingPrice,
          discount: item.discount,
          tax: item.tax,
          lineTotal: item.lineTotal,
          notes: item.notes,
        })),
        subtotal,
        grandTotal: subtotal,
      }),
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'Purchase created successfully', variant: 'success' });
      router.push('/purchases');
    } else {
      const error = await res.json();
      toast({ title: 'Error', description: error.error || 'Failed to create purchase', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Purchase</h1>
            <p className="text-muted-foreground">Create a new purchase order</p>
          </div>
        </div>
        <Button type="submit" form="purchase-form">
          <Save className="h-4 w-4 mr-2" />
          Save Purchase
        </Button>
      </div>

      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Purchase Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Supplier</label>
                <select
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliersData?.suppliers?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Purchase Date</label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Invoice Number</label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                  placeholder="INV-001"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
            </div>
<div className="space-y-2">
                <label className="text-sm font-medium">Delivery Note</label>
                <Input
                  value={form.deliveryNote}
                  onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })}
                  placeholder="Delivery note reference"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                />
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Purchase Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-2 p-4 border rounded-md">
                <div className="flex-1 grid gap-2 md:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium">Product</label>
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const product = productsData?.products?.find((p: any) => p.id === e.target.value);
                        updateItem(index, 'productId', e.target.value);
                        updateItem(index, 'productName', product?.name || '');
                        updateItem(index, 'sku', product?.sku || '');
                        updateItem(index, 'barcode', product?.barcode || '');
                        updateItem(index, 'sellingPrice', product?.price || 0);
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Select Product</option>
                      {productsData?.products?.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Qty</label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Buying Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.buyingPrice}
                      onChange={(e) => updateItem(index, 'buyingPrice', parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Selling Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.sellingPrice}
                      onChange={(e) => updateItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-xl font-bold">{formatCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}