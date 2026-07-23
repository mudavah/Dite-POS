'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { Plus, Trash2, MoreVertical, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; inventories: number };
  sales?: Array<{ totalAmount: { toNumber: () => number } }>;
  monthlySales?: number;
  saleCount?: number;
}

async function fetchBranches(): Promise<Branch[]> {
  const res = await fetch('/api/branches');
  if (!res.ok) throw new Error('Failed to fetch branches');
  return res.json();
}

async function createBranch(data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
  const res = await fetch('/api/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create branch');
  return res.json();
}

async function deleteBranch(id: string): Promise<void> {
  const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}

async function transferStock(data: { fromBranchId: string; toBranchId: string; productId: string; quantity: number; notes?: string }): Promise<{ success: boolean }> {
  const res = await fetch('/api/branches/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to transfer');
  return res.json();
}

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', email: '', isActive: true });
  const [transferForm, setTransferForm] = useState({ fromBranchId: '', toBranchId: '', productId: '', quantity: '', notes: '' });

  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: fetchBranches });

  const createMutation = useMutation({ mutationFn: createBranch, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowAddModal(false); setForm({ name: '', code: '', address: '', phone: '', email: '', isActive: true }); } });
  const deleteMutation = useMutation({ mutationFn: deleteBranch, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }) });
  const transferMutation = useMutation({ mutationFn: transferStock, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowTransferModal(false); } });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...form, isActive: true });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    transferMutation.mutate({ ...transferForm, quantity: Number(transferForm.quantity) || 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branches</h1>
          <p className="text-muted-foreground">Manage your business locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransferModal(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer Stock
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          branches?.map((branch: Branch) => (
            <Card key={branch.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{branch.name}</CardTitle>
                  <Badge variant={branch.isActive ? 'success' : 'secondary'}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Code: {branch.code}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {branch.address && <p className="text-sm"><span className="text-muted-foreground">Address:</span> {branch.address}</p>}
                {branch.phone && <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {branch.phone}</p>}
                {branch.email && <p className="text-sm"><span className="text-muted-foreground">Email:</span> {branch.email}</p>}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Users:</span> {branch._count?.users || 0}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Sales:</span> {branch.saleCount || 0}
                  </div>
                  <div className="text-sm font-medium">
                    {formatCurrency(branch.monthlySales || 0)}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(branch.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Branch</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                  <MoreVertical className="h-4 w-4 rotate-90" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code</label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Branch'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transfer Stock</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowTransferModal(false)}>
                  <MoreVertical className="h-4 w-4 rotate-90" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Branch</label>
                  <select
                    value={transferForm.fromBranchId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromBranchId: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches?.map((b: Branch) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Branch</label>
                  <select
                    value={transferForm.toBranchId}
                    onChange={(e) => setTransferForm({ ...transferForm, toBranchId: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches?.map((b: Branch) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product ID</label>
                  <Input value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity</label>
                  <Input type="number" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={transferMutation.isPending}>
                    {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
