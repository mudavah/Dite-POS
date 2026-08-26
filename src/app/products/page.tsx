'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';
import {
  Search,
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Filter,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  X,
  Sheet,
  Printer,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

async function fetchProducts(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.brand) query.set('brand', params.brand);
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.status) query.set('status', params.status);
  if (params?.archived) query.set('archived', params.archived);
  if (params?.page) query.set('page', params.page);
  if (params?.limit) query.set('limit', params.limit);
  const res = await fetch(`/api/products?${query}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

async function bulkAction(data: { action: string; productIds: string[]; data?: Record<string, unknown> }) {
  const res = await fetch('/api/products/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to perform bulk action');
  return res.json();
}

async function exportProducts(params?: Record<string, string>) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.brand) query.set('brand', params.brand);
  if (params?.status) query.set('status', params.status);
  query.set('format', 'csv');
  const res = await fetch(`/api/export?${query}`);
  if (!res.ok) throw new Error('Failed to export');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function downloadTemplate() {
  const res = await fetch('/api/products/template');
  if (!res.ok) throw new Error('Failed to download template');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isManager = ['ADMIN', 'MANAGER'].includes(session?.user?.role || '');

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [importFile, setImportFile] = useState<File | null>(null);
interface ImportRow {
  row: number;
  data: {
    productName: string;
    sku: string;
    barcode?: string;
    category?: string;
    brand?: string;
    buyingPrice: number;
    sellingPrice: number;
    quantity: number;
    unit: string;
    reorderLevel: number;
    supplier?: string;
    tax: number;
    description?: string;
  };
  warnings?: string[];
}

interface ImportError {
  row: number;
  errors: string[];
  productName: string;
}

interface ImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicates: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importMode, setImportMode] = useState('skip');
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, categoryId, brand, supplierId, status, archived: showArchived, page: currentPage, limit }],
    queryFn: () => fetchProducts({ search, categoryId, brand, supplierId, status, archived: String(showArchived), page: String(currentPage), limit: String(limit) }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Success', description: 'Product archived successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to archive product', variant: 'destructive' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: bulkAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds([]);
      toast({ title: 'Success', description: 'Bulk action completed', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to perform bulk action', variant: 'destructive' });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.products?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.products?.map((p: { id: string }) => p.id) || []);
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    const actionLabel = action === 'delete' ? 'delete (archive)' : action;
    setConfirmDialog({
      open: true,
      title: `Confirm ${actionLabel}`,
      description: `Are you sure you want to ${actionLabel} ${selectedIds.length} product(s)? This action cannot be undone.`,
      action: () => {
        bulkMutation.mutate({ action, productIds: selectedIds });
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Archive Product',
      description: 'Are you sure you want to archive this product? It will be hidden from the active product list.',
      action: () => {
        deleteMutation.mutate(id);
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Import failed');
      const result = await res.json();
      setImportPreview(result.preview || []);
      setImportErrors(result.errors || []);
      if (result.summary) {
        setImportSummary(result.summary);
        setImportStep(4);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to process import file', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importPreview, mode: importMode, fileName: importFile?.name }),
      });
      if (!res.ok) throw new Error('Import failed');
      const result = await res.json();
      toast({ title: 'Import Complete', description: `Imported: ${result.imported}, Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`, variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowImportDialog(false);
      setImportPreview([]);
      setImportErrors([]);
      setImportSummary(null);
      setImportStep(1);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to import products', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    exportProducts({ search, categoryId, brand, status })
      .catch((err) => {
        toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
      });
  };

  const handleDownloadTemplate = () => {
    downloadTemplate();
  };

  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push('/products/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Products
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Template
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-8 w-full md:w-[300px]"
                />
              </div>
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full md:w-[160px]"
              >
                <option value="">All Categories</option>
                {data?.categories?.map((cat: { id: string; name: string }) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={brand}
                onChange={(e) => { setBrand(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full md:w-[160px]"
              >
                <option value="">All Brands</option>
              </select>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full md:w-[140px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button
                variant={showArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'Show Active' : 'Show Archived'}
              </Button>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('archive')}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('unarchive')}>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
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
            <>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
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
                      <th className="p-3 text-left font-medium">Buying Price</th>
                      <th className="p-3 text-left font-medium">Selling Price</th>
                      <th className="p-3 text-left font-medium">Stock</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.products?.map((product: { id: string; name: string; sku: string; category?: { name: string }; costPrice: number; price: number; totalStock?: number; lowStockThreshold: number; isActive: boolean; image?: string; description?: string }) => (
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
                          <div className="flex items-center gap-3">
                            {product.image && (
                              <img src={product.image} alt={product.name} className="h-10 w-10 rounded-md object-cover border" />
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{product.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs">{product.sku}</td>
                        <td className="p-3">{product.category?.name || '-'}</td>
                        <td className="p-3">{formatCurrency(product.costPrice)}</td>
                        <td className="p-3">{formatCurrency(product.price)}</td>
                        <td className="p-3">
                          {product.totalStock !== undefined ? (
                            <span className={product.totalStock <= product.lowStockThreshold ? 'text-destructive font-medium' : ''}>
                              {product.totalStock}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant={product.isActive ? 'success' : 'secondary'}>
                            {product.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)}>
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    {data?.products?.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * limit) + 1}–{Math.min(currentPage * limit, data?.total || 0)} of {data?.total} products
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <select
                      value={limit}
                      onChange={(e) => { setLimit(parseInt(e.target.value)); setCurrentPage(1); }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
            <DialogDescription>
              Import products from Excel or CSV files. Supports .xlsx, .xls, and .csv formats.
            </DialogDescription>
          </DialogHeader>

          {importStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Choose a file to import</p>
                <p className="text-sm text-muted-foreground mb-4">Supported formats: .xlsx, .xls, .csv</p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="max-w-sm mx-auto"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-muted-foreground">Selected: {importFile.name}</p>
                )}
              </div>
              <div>
                <Label>Import Mode</Label>
                <Select value={importMode} onValueChange={setImportMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip Duplicates</SelectItem>
                    <SelectItem value="update">Update Existing</SelectItem>
                    <SelectItem value="merge">Merge Inventory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={!importFile || isImporting}>
                  {isImporting ? 'Processing...' : 'Preview Import'}
                </Button>
              </div>
            </div>
          )}

          {importStep === 4 && (
            <div className="space-y-4 py-4">
              <h3 className="text-lg font-semibold">Import Results</h3>
              {importSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{importSummary.imported}</p>
                      <p className="text-sm text-muted-foreground">Imported</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{importSummary.updated}</p>
                      <p className="text-sm text-muted-foreground">Updated</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{importSummary.skipped}</p>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importSummary.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{importSummary.duplicates}</p>
                      <p className="text-sm text-muted-foreground">Duplicates</p>
                    </CardContent>
                  </Card>
                </div>
              )}
              {importErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                       {importErrors.map((err: { row: number; errors?: string[]; error?: string }, i: number) => (
                        <div key={i} className="text-sm text-destructive">
                          Row {err.row}: {err.errors?.join(', ') || err.error}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Close</Button>
                <Button onClick={() => window.location.reload()}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDialog.action}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
