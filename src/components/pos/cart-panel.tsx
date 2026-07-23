'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Trash2, ClipboardList, Tag, User, X, RotateCcw, Clock } from 'lucide-react';
import { Button, Badge, Input, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onHoldSale: () => void;
  onRecallSale: () => void;
  onCheckout: () => void;
  onOpenSummary: () => void;
  onOpenPendingSales: () => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onUpdateItemNote: (id: string, notes: string) => void;
  onUpdateItemQuantityDirect: (id: string, quantity: number) => void;
  pendingSyncCount?: number;
  syncStatus?: 'idle' | 'syncing' | 'error' | 'conflict';
  isOnline?: boolean;
  onManualSync?: () => void;
}

export function CartPanel({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onHoldSale,
  onRecallSale,
  onCheckout,
  onOpenSummary,
  onOpenPendingSales,
  selectedCustomer,
  onSelectCustomer,
  onUpdateItemNote,
  onUpdateItemQuantityDirect,
  pendingSyncCount,
  syncStatus,
  isOnline,
  onManualSync,
}: CartPanelProps) {
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false);
  const [showItemNotes, setShowItemNotes] = React.useState<string | null>(null);
  const [itemNoteText, setItemNoteText] = React.useState('');

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - totalDiscount;

  const handleSaveNote = (itemId: string) => {
    onUpdateItemNote(itemId, itemNoteText);
    setShowItemNotes(null);
    setItemNoteText('');
  };

  return (
    <div className="flex h-full flex-col bg-card rounded-lg border border-border">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Cart ({items.length})
          </CardTitle>
          {items.length > 0 && (
            <Button variant="ghost" size="icon" onClick={onClearCart} className="h-8 w-8">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden px-4">
        <div className="flex gap-2">
          <Button
            variant={selectedCustomer ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowCustomerPicker(!showCustomerPicker)}
            className="flex-1 justify-start gap-2"
          >
            <User className="h-4 w-4" />
            {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenSummary} className="shrink-0">
            Summary
          </Button>
        </div>

        {showCustomerPicker && (
          <CustomerQuickSelect
            selected={selectedCustomer}
            onSelect={(customer) => {
              onSelectCustomer(customer);
              setShowCustomerPicker(false);
            }}
            onClear={() => {
              onSelectCustomer(null);
              setShowCustomerPicker(false);
            }}
          />
        )}

        {(pendingSyncCount !== undefined && pendingSyncCount > 0) && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-warning animate-pulse' : 'bg-destructive'}`} />
              <span className="text-xs font-medium text-warning">
                {pendingSyncCount} transaction{pendingSyncCount !== 1 ? 's' : ''} pending sync
              </span>
            </div>
            {isOnline && onManualSync && (
              <Button variant="ghost" size="sm" onClick={onManualSync} className="h-7 text-xs">
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <ClipboardList className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Add products from the grid</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border bg-background/50 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveItem(item.id)}
                    className="h-6 w-6 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="h-8 w-8"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          onUpdateItemQuantityDirect(item.id, val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 1) {
                          onUpdateItemQuantityDirect(item.id, 1);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          if (isNaN(val) || val < 1) {
                            onUpdateItemQuantityDirect(item.id, 1);
                          }
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="h-8 w-14 text-center text-sm p-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="h-8 w-8"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(item.total)}</p>
                    {item.discount > 0 && (
                      <Badge variant="warning" className="text-[10px] h-4 px-1">
                        -{formatCurrency(item.discount)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowItemNotes(item.id === showItemNotes ? null : item.id);
                      setItemNoteText(item.notes || '');
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {item.notes ? 'Edit Note' : 'Add Note'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    @ {formatCurrency(item.unitPrice)}
                  </span>
                </div>

                {showItemNotes === item.id && (
                  <div className="flex gap-2">
                    <Input
                      value={itemNoteText}
                      onChange={(e) => setItemNoteText(e.target.value)}
                      placeholder="Add note or modifier..."
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveNote(item.id)} className="h-8">
                      Save
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3 flex-shrink-0">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={onRecallSale} className="h-11 gap-2">
                <RotateCcw className="h-4 w-4" />
                Recall
              </Button>
              <Button variant="outline" onClick={onHoldSale} className="h-11 gap-2">
                Hold
              </Button>
            </div>
            <Button variant="outline" onClick={onOpenPendingSales} className="w-full h-11 gap-2">
              <Clock className="h-4 w-4" />
              Pending Sales
            </Button>
            <Button onClick={onCheckout} className="w-full h-12 text-base font-semibold">
              Checkout (F2)
            </Button>
          </div>
        )}
      </CardContent>
    </div>
  );
}

interface CustomerQuickSelectProps {
  selected: Customer | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}

function CustomerQuickSelect({ selected, onSelect, onClear }: CustomerQuickSelectProps) {
  const [search, setSearch] = React.useState('');
  const { data: customers = [] } = useQuery({
    queryKey: ['pos-customers', search],
    queryFn: async () => {
      if (!search) return [];
      const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <Input
        placeholder="Search customer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9"
        autoFocus
      />
      <div className="max-h-40 overflow-y-auto space-y-1">
        {selected && (
          <button
            onClick={onClear}
            className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="text-muted-foreground">Clear customer</span>
            <X className="h-3 w-3" />
          </button>
        )}
        {customers.map((c: Customer) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="w-full flex flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <span className="font-medium">{c.name}</span>
            {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
