'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@/components/ui';
import { ArrowLeft, Save, Trash2, Upload, Package, DollarSign, Hash, Barcode, Tag, ShoppingBag, Weight, Box, AlertTriangle, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useSession } from 'next-auth/react';

async function fetchProduct(id: string) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error('Failed to fetch product');
  return res.json();
}

async function fetchCategories() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
}

async function fetchSuppliers() {
  const res = await fetch('/api/suppliers?status=ACTIVE');
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  const data = await res.json();
  return data.suppliers || [];
}

async function createProduct(data: any) {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create product');
  return res.json();
}

async function updateProduct(id: string, data: any) {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update product');
  return res.json();
}

async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  price: '',
  costPrice: '',
  categoryId: '',
  lowStockThreshold: '10',
  reorderLevel: '10',
  maxStock: '1000',
  brand: '',
  unit: 'pcs',
  isActive: true,
  image: '',
  taxRate: '0',
  discount: '0',
  openingStock: '0',
  defaultSupplierId: '',
};

export default function ProductEditPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';
  const { toast } = useToast();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !isNew,
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });

  const initialForm = useMemo(() => {
    if (product) {
      return {
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        costPrice: product.costPrice?.toString() || '',
        categoryId: product.categoryId || '',
        lowStockThreshold: product.lowStockThreshold?.toString() || '10',
        reorderLevel: product.reorderLevel?.toString() || '10',
        maxStock: product.maxStock?.toString() || '1000',
        brand: product.brand || '',
        unit: product.unit || 'pcs',
        isActive: product.isActive ?? true,
        image: product.image || '',
        taxRate: product.taxRate?.toString() || '0',
        discount: product.discount?.toString() || '0',
        openingStock: '0',
        defaultSupplierId: '',
      };
    }
    return emptyForm;
  }, [product]);

  const [form, setForm] = useState(initialForm);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'inventory' | 'supplier' | 'other'>('general');

  const updateMutation = useMutation({
    mutationFn: (data: any) => (isNew ? createProduct(data) : updateProduct(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/products');
      toast({ title: 'Success', description: isNew ? 'Product created successfully' : 'Product updated successfully', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to save product', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/products');
      toast({ title: 'Success', description: 'Product archived successfully', variant: 'success' });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setForm({ ...form, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleImageDelete = () => {
    setImagePreview(null);
    setForm({ ...form, image: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...form,
      price: parseFloat(form.price) || 0,
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      reorderLevel: parseInt(form.reorderLevel) || 10,
      maxStock: parseInt(form.maxStock) || 1000,
      taxRate: parseFloat(form.taxRate) || 0,
      discount: parseFloat(form.discount) || 0,
      openingStock: parseInt(form.openingStock) || 0,
      brand: form.brand || null,
      unit: form.unit || 'pcs',
      image: form.image || null,
      defaultSupplierId: form.defaultSupplierId || null,
    });
  };

  if (productLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isNew ? 'Add Product' : 'Edit Product'}</h1>
            <p className="text-muted-foreground">{isNew ? 'Create a new product with full inventory details' : 'Update product information'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={() => deleteMutation.mutate(id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}
          <Button type="submit" form="product-form" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b bg-muted/30 rounded-t-lg p-1 overflow-x-auto">
        {(['general', 'pricing', 'inventory', 'supplier', 'other'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'general' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Enter product name" />
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required placeholder="e.g. WDG-001" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="EAN/UPC barcode" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None</option>
                    {categories?.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand name" />
                </div>
                <div className="space-y-2">
                  <Label>Unit of Measure</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, liters, etc." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                  placeholder="Product description"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'pricing' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Buying Price</Label>
                  <Input type="number" step="0.01" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price</Label>
                  <Input type="number" step="0.01" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required placeholder="0.00" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input type="number" step="0.01" min={0} max={1} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} placeholder="0.16" />
                </div>
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <Input type="number" step="0.01" min={0} max={1} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="p-4 bg-muted/30 rounded-md text-sm">
                <p className="font-medium mb-2">Price Summary</p>
                <p>Buying Price: {formatCurrency(parseFloat(form.costPrice) || 0)}</p>
                <p>Selling Price: {formatCurrency(parseFloat(form.price) || 0)}</p>
                <p>Margin: {formatCurrency((parseFloat(form.price) || 0) - (parseFloat(form.costPrice) || 0))}</p>
                <p>Tax (at {form.taxRate || 0}%): {formatCurrency((parseFloat(form.price) || 0) * (parseFloat(form.taxRate) || 0))}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'inventory' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventory Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Opening Stock</Label>
                  <Input type="number" min={0} value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} placeholder="Initial stock quantity" />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder="Minimum stock before reorder" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Maximum Stock</Label>
                  <Input type="number" min={0} value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} placeholder="Maximum stock capacity" />
                </div>
                <div className="space-y-2">
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
                </div>
              </div>
              {form.openingStock && parseInt(form.openingStock) > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                  An opening stock transaction will be created for {form.openingStock} units when saved.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'supplier' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Supplier</Label>
                <select
                  value={form.defaultSupplierId}
                  onChange={(e) => setForm({ ...form, defaultSupplierId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {suppliers?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'other' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Other Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Image</Label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="h-24 w-24 object-cover rounded-md border" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={handleImageDelete}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-24 w-24 flex items-center justify-center rounded-md border border-dashed text-muted-foreground text-xs">
                    No image
                  </div>
                )}
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="w-full" />
                <p className="text-xs text-muted-foreground">Upload product image (JPG, PNG, WebP)</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="isActive">Product is Active</Label>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}