'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { ArrowLeft, Save, Trash2, Upload } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

async function fetchProduct(id: string) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error('Failed to fetch product');
  return res.json();
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

async function fetchCategories() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
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
  isActive: true,
  image: '',
};

export default function ProductEditPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !isNew,
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

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
        isActive: product.isActive ?? true,
        image: product.image || '',
      };
    }
    return emptyForm;
  }, [product]);

  const [form, setForm] = useState(initialForm);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const updateMutation = useMutation({
    mutationFn: (data: any) => (isNew ? createProduct(data) : updateProduct(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/products');
    },
  });

  const deleteMutation = useMutation({ mutationFn: deleteProduct, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); router.push('/products'); } });

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
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      lowStockThreshold: parseInt(form.lowStockThreshold),
    });
  };

  if (productLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isNew ? 'Add Product' : 'Edit Product'}</h1>
            <p className="text-muted-foreground">{isNew ? 'Create a new product' : 'Update product details'}</p>
          </div>
        </div>
        {!isNew && (
          <Button variant="destructive" onClick={() => deleteMutation.mutate(id)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU</label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Barcode</label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price</label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost Price</label>
                <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Low Stock Threshold</label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="isActive" className="text-sm font-medium">Active</label>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Image</label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="h-24 w-24 object-cover rounded-md border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={handleImageDelete}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 flex items-center justify-center rounded-md border border-dashed text-muted-foreground text-xs">
                      No image
                    </div>
                  )}
                  <div>
                    <Input type="file" accept="image/*" onChange={handleImageUpload} className="w-full" />
                    <p className="text-xs text-muted-foreground mt-1">Upload product image (JPG, PNG)</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
