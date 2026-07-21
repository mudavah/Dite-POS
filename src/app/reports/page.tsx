'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { Calendar, Download, FileText } from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';

async function fetchReports(type: string, startDate?: string, endDate?: string) {
  const query = new URLSearchParams({ type, ...(startDate && { startDate }), ...(endDate && { endDate }) });
  const res = await fetch(`/api/reports?${query}`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

const reportTypes = [
  { id: 'sales', label: 'Sales Reports', icon: FileText },
  { id: 'category-sales', label: 'Category Sales', icon: FileText },
  { id: 'products', label: 'Product Reports', icon: FileText },
  { id: 'inventory', label: 'Inventory Reports', icon: FileText },
  { id: 'profit', label: 'Profit Reports', icon: FileText },
  { id: 'cashiers', label: 'Cashier Reports', icon: FileText },
  { id: 'branches', label: 'Branch Reports', icon: FileText },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', { reportType, startDate, endDate }],
    queryFn: () => fetchReports(reportType, startDate, endDate),
  });

  const exportCSV = () => {
    if (!data?.data) return;
    const csv = Papa.unparse(data.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportType}-report.csv`;
    link.click();
  };

  const exportPDF = () => {
    if (!data?.data) return;
    const doc = new jsPDF();
    doc.text(`${reportType.toUpperCase()} REPORT`, 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Period: ${startDate || 'All'} - ${endDate || 'All'}`, 14, 29);

    let y = 40;
    const lineHeight = 7;

    data.data.forEach((item: any, index: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const text = Object.values(item).map((v: any) => String(v ?? '')).join(' | ');
      doc.text(`${index + 1}. ${text}`, 14, y);
      y += lineHeight;
    });

    doc.save(`${reportType}-report.pdf`);
  };

  const renderSalesReport = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.data?.reduce((sum: number, s: any) => sum + s.totalAmount, 0) || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.data?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.data?.length ? data.data.reduce((sum: number, s: any) => sum + s.totalAmount, 0) / data.data.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">ID</th>
              <th className="p-3 text-left font-medium">Cashier</th>
              <th className="p-3 text-left font-medium">Branch</th>
              <th className="p-3 text-left font-medium">Total</th>
              <th className="p-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((sale: any) => (
              <tr key={sale.id} className="border-t">
                <td className="p-3 font-mono">#{sale.id.slice(-8)}</td>
                <td className="p-3">{sale.cashier?.name || '-'}</td>
                <td className="p-3">{sale.branch?.name || '-'}</td>
                <td className="p-3">{formatCurrency(sale.totalAmount)}</td>
                <td className="p-3">{formatDate(sale.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCategorySalesReport = () => {
    const categories = data?.data || [];
    const totals = categories.reduce((acc: any, cat: any) => ({
      cash: acc.cash + cat.cash,
      card: acc.card + cat.card,
      bankTransfer: acc.bankTransfer + cat.bankTransfer,
      mobileMoney: acc.mobileMoney + cat.mobileMoney,
      total: acc.total + cat.total,
    }), { cash: 0, card: 0, bankTransfer: 0, mobileMoney: 0, total: 0 });

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Category Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Category</th>
                <th className="p-3 text-right font-medium">Cash</th>
                <th className="p-3 text-right font-medium">Card</th>
                <th className="p-3 text-right font-medium">Bank Transfer</th>
                <th className="p-3 text-right font-medium">M-Pesa</th>
                <th className="p-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat: any) => (
                <tr key={cat.category} className="border-t">
                  <td className="p-3 font-medium">{cat.category}</td>
                  <td className="p-3 text-right">{formatCurrency(cat.cash)}</td>
                  <td className="p-3 text-right">{formatCurrency(cat.card)}</td>
                  <td className="p-3 text-right">{formatCurrency(cat.bankTransfer)}</td>
                  <td className="p-3 text-right">{formatCurrency(cat.mobileMoney)}</td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(cat.total)}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-bold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right">{formatCurrency(totals.cash)}</td>
                <td className="p-3 text-right">{formatCurrency(totals.card)}</td>
                <td className="p-3 text-right">{formatCurrency(totals.bankTransfer)}</td>
                <td className="p-3 text-right">{formatCurrency(totals.mobileMoney)}</td>
                <td className="p-3 text-right">{formatCurrency(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProductsReport = () => (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Name</th>
            <th className="p-3 text-left font-medium">SKU</th>
            <th className="p-3 text-left font-medium">Category</th>
            <th className="p-3 text-left font-medium">Price</th>
            <th className="p-3 text-left font-medium">Stock</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((product: any) => (
            <tr key={product.id} className="border-t">
              <td className="p-3">{product.name}</td>
              <td className="p-3 font-mono">{product.sku}</td>
              <td className="p-3">{product.category?.name || '-'}</td>
              <td className="p-3">{formatCurrency(product.price)}</td>
              <td className="p-3">{product.inventories?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderInventoryReport = () => (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Product</th>
            <th className="p-3 text-left font-medium">Branch</th>
            <th className="p-3 text-left font-medium">Quantity</th>
            <th className="p-3 text-left font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((item: any) => (
            <tr key={item.id} className="border-t">
              <td className="p-3">{item.product?.name || '-'}</td>
              <td className="p-3">{item.branch?.name || '-'}</td>
              <td className="p-3">{item.quantity}</td>
              <td className="p-3">{formatCurrency((item.product?.costPrice?.toNumber?.() || item.product?.price?.toNumber?.() || 0) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderProfitReport = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.data?.reduce((sum: number, s: any) => sum + s.totalAmount, 0) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.data?.reduce((sum: number, s: any) => sum + s.items?.reduce((itemSum: number, item: any) => itemSum + (item.product?.costPrice?.toNumber?.() || 0) * item.quantity, 0), 0) || 0)}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">ID</th>
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Revenue</th>
              <th className="p-3 text-left font-medium">Cost</th>
              <th className="p-3 text-left font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((sale: any) => {
              const cost = sale.items?.reduce((sum: number, item: any) => sum + (item.product?.costPrice?.toNumber?.() || 0) * item.quantity, 0) || 0;
              const profit = sale.totalAmount - cost;
              return (
                <tr key={sale.id} className="border-t">
                  <td className="p-3 font-mono">#{sale.id.slice(-8)}</td>
                  <td className="p-3">{formatDate(sale.createdAt)}</td>
                  <td className="p-3">{formatCurrency(sale.totalAmount)}</td>
                  <td className="p-3">{formatCurrency(cost)}</td>
                  <td className="p-3">{formatCurrency(profit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCashierReport = () => (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Cashier</th>
            <th className="p-3 text-left font-medium">Email</th>
            <th className="p-3 text-left font-medium">Sales Count</th>
            <th className="p-3 text-left font-medium">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((cashier: any) => (
            <tr key={cashier.id} className="border-t">
              <td className="p-3">{cashier.name}</td>
              <td className="p-3">{cashier.email}</td>
              <td className="p-3">{cashier.sales?.length || 0}</td>
              <td className="p-3">
                {formatCurrency(cashier.sales?.reduce((sum: number, s: any) => sum + s.totalAmount, 0) || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderBranchReport = () => (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Branch</th>
            <th className="p-3 text-left font-medium">Code</th>
            <th className="p-3 text-left font-medium">Sales Count</th>
            <th className="p-3 text-left font-medium">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((branch: any) => (
            <tr key={branch.id} className="border-t">
              <td className="p-3">{branch.name}</td>
              <td className="p-3">{branch.code}</td>
              <td className="p-3">{branch.sales?.length || 0}</td>
              <td className="p-3">
                {formatCurrency(branch.sales?.reduce((sum: number, s: any) => sum + s.totalAmount, 0) || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and export business reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {reportTypes.map((type) => (
                <Button
                  key={type.id}
                  variant={reportType === type.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportType(type.id)}
                >
                  <type.icon className="h-4 w-4 mr-2" />
                  {type.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-8"
                />
              </div>
              <span className="text-muted-foreground">to</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button size="sm" onClick={() => refetch()}>
                Apply
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {reportType === 'sales' && renderSalesReport()}
              {reportType === 'category-sales' && renderCategorySalesReport()}
              {reportType === 'products' && renderProductsReport()}
              {reportType === 'inventory' && renderInventoryReport()}
              {reportType === 'profit' && renderProfitReport()}
              {reportType === 'cashiers' && renderCashierReport()}
              {reportType === 'branches' && renderBranchReport()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
