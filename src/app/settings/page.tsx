'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { Save, Printer, Monitor, Store as StoreIcon, Moon } from 'lucide-react';

async function fetchSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function updateSettings(data: any) {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

async function fetchBranches() {
  const res = await fetch('/api/branches');
  if (!res.ok) throw new Error('Failed to fetch branches');
  return res.json();
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('shop');

  const { data: settings, isLoading: settingsLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: fetchBranches });

  const [shopForm, setShopForm] = useState({ branchId: '', shopName: '', currency: 'KES', currencySymbol: 'KSh', footerText: '' });
  const [printerForm, setPrinterForm] = useState({ branchId: '', name: '', type: 'USB', protocol: 'ESC_POS', paperSize: '80mm', vendorId: '', productId: '' });
  const [etrsForm, setEtrsForm] = useState({ branchId: '', deviceId: '', isActive: false, isSimulated: true, deviceName: '' });
  const [darkMode, setDarkMode] = useState(true);

  const updateMutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) });

  useEffect(() => {
    if (settings?.length) {
      const s = settings[0];
      setShopForm({
        branchId: s.branchId,
        shopName: s.shopName || '',
        currency: s.currency || 'KES',
        currencySymbol: s.currencySymbol || 'KSh',
        footerText: s.footerText || '',
      });
    }
  }, [settings]);

  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    const { branchId, ...rest } = shopForm;
    updateMutation.mutate(rest);
  };

  const handleSavePrinter = (e: React.FormEvent) => {
    e.preventDefault();
    const { branchId, ...rest } = printerForm;
    updateMutation.mutate({ ...rest });
  };

  const handleSaveEtrs = (e: React.FormEvent) => {
    e.preventDefault();
    const { branchId, ...rest } = etrsForm;
    updateMutation.mutate({ ...rest });
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const tabs = [
    { id: 'shop', label: 'Shop Information', icon: StoreIcon },
    { id: 'receipt', label: 'Receipt Template', icon: Printer },
    { id: 'printer', label: 'Thermal Printer', icon: Printer },
    { id: 'etrs', label: 'eTRS Config', icon: Monitor },
    { id: 'system', label: 'System Preferences', icon: Moon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your POS system</p>
      </div>

      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'shop' && (
        <Card>
          <CardHeader>
            <CardTitle>Shop Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveShop} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <select
                  value={shopForm.branchId}
                  onChange={(e) => setShopForm({ ...shopForm, branchId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select branch</option>
                  {branches?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shop Name</label>
                <Input value={shopForm.shopName} onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <Input value={shopForm.currency} onChange={(e) => setShopForm({ ...shopForm, currency: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency Symbol</label>
                  <Input value={shopForm.currencySymbol} onChange={(e) => setShopForm({ ...shopForm, currencySymbol: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Footer Text</label>
                <textarea
                  value={shopForm.footerText}
                  onChange={(e) => setShopForm({ ...shopForm, footerText: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'receipt' && (
        <Card>
          <CardHeader>
            <CardTitle>Receipt Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Receipt template configuration is managed per branch in Shop Information settings. Configure shop name and footer text above.</p>
            <div className="border rounded-md p-4 bg-muted/30">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`Receipt Template Preview:
=======================
${shopForm.shopName || 'Your Shop Name'}
=======================
Footer: ${shopForm.footerText || 'Thank you for your purchase!'}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'printer' && (
        <Card>
          <CardHeader>
            <CardTitle>Thermal Printer Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePrinter} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <select
                  value={printerForm.branchId}
                  onChange={(e) => setPrinterForm({ ...printerForm, branchId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select branch</option>
                  {branches?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Printer Name</label>
                <Input value={printerForm.name} onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Connection Type</label>
                  <select
                    value={printerForm.type}
                    onChange={(e) => setPrinterForm({ ...printerForm, type: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="USB">USB</option>
                    <option value="BLUETOOTH">Bluetooth</option>
                    <option value="NETWORK">Network</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Protocol</label>
                  <select
                    value={printerForm.protocol}
                    onChange={(e) => setPrinterForm({ ...printerForm, protocol: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="ESC_POS">ESC/POS</option>
                    <option value="EPL2">EPL2</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Paper Size</label>
                <select
                  value={printerForm.paperSize}
                  onChange={(e) => setPrinterForm({ ...printerForm, paperSize: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vendor ID (optional)</label>
                  <Input value={printerForm.vendorId} onChange={(e) => setPrinterForm({ ...printerForm, vendorId: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product ID (optional)</label>
                  <Input value={printerForm.productId} onChange={(e) => setPrinterForm({ ...printerForm, productId: e.target.value })} />
                </div>
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Printer Config
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'etrs' && (
        <Card>
          <CardHeader>
            <CardTitle>eTRS Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEtrs} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <select
                  value={etrsForm.branchId}
                  onChange={(e) => setEtrsForm({ ...etrsForm, branchId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select branch</option>
                  {branches?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Device ID</label>
                <Input value={etrsForm.deviceId} onChange={(e) => setEtrsForm({ ...etrsForm, deviceId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Device Name</label>
                <Input value={etrsForm.deviceName} onChange={(e) => setEtrsForm({ ...etrsForm, deviceName: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="etrsActive"
                  checked={etrsForm.isActive}
                  onChange={(e) => setEtrsForm({ ...etrsForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="etrsActive" className="text-sm font-medium">Enable eTRS</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="etrsSimulated"
                  checked={etrsForm.isSimulated}
                  onChange={(e) => setEtrsForm({ ...etrsForm, isSimulated: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="etrsSimulated" className="text-sm font-medium">Use simulation mode</label>
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save eTRS Config
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'system' && (
        <Card>
          <CardHeader>
            <CardTitle>System Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Toggle dark mode theme</p>
              </div>
              <Button variant="outline" onClick={toggleDarkMode}>
                <Moon className="h-4 w-4 mr-2" />
                {darkMode ? 'Dark' : 'Light'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
