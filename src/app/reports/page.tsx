'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { Calendar, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';

async function fetchReports(type: string, startDate?: string, endDate?: string, page = 1, limit = 50) {
  const query = new URLSearchParams({ type, ...(startDate && { startDate }), ...(endDate && { endDate }), page: String(page), limit: String(limit) });
  const res = await fetch(`/api/reports?${query}`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

const reportTypes = [
  { id: 'sales', label: 'Sales', icon: FileText },
  { id: 'category-sales', label: 'Category Sales', icon: FileText },
  { id: 'products', label: 'Products', icon: FileText },
  { id: 'inventory', label: 'Inventory', icon: FileText },
  { id: 'profit', label: 'Profit', icon: FileText },
  { id: 'cashiers', label: 'Cashiers', icon: FileText },
  { id: 'branches', label: 'Branches', icon: FileText },
];

const ITEMS_PER_PAGE = 50;

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    BANK_TRANSFER: 'Bank Transfer',
    MOBILE_MONEY: 'M-Pesa',
    SPLIT: 'Split',
  };
  return labels[method] || method;
}

function getPaymentMethodBadgeVariant(method: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    CASH: 'default',
    CARD: 'secondary',
    BANK_TRANSFER: 'outline',
    MOBILE_MONEY: 'default',
    SPLIT: 'secondary',
  };
  return variants[method] || 'outline';
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', { reportType, startDate, endDate, page }],
    queryFn: () => fetchReports(reportType, startDate, endDate, page, ITEMS_PER_PAGE),
  });

  const totalPages = useMemo(() => {
    if (!data?.total) return 1;
    return Math.max(1, Math.ceil(data.total / ITEMS_PER_PAGE));
  }, [data?.total]);

  const handleReportTypeChange = (type: string) => {
    setReportType(type);
    setPage(1);
  };

  const handleDateApply = () => {
    setPage(1);
    refetch();
  };

  const exportCSV = () => {
    if (!data?.data || data.data.length === 0) return;

    const exportData = data.data.map((item: Record<string, unknown>) => {
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(item)) {
        if (key.startsWith('raw')) continue;
        clean[key] = value === null || value === undefined ? '' : String(value);
      }
      return clean;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportPDF = () => {
    if (!data?.data || data.data.length === 0) return;

    const doc = new jsPDF();
    const title = `${reportType.replace(/-/g, ' ').toUpperCase()} REPORT`;
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Period: ${startDate || 'All'} - ${endDate || 'All'}`, 14, 28);
    doc.text(`Total Records: ${data.total}`, 14, 34);

    let y = 42;
    const lineHeight = 6;
    const pageHeight = 280;

    if (reportType === 'sales') {
      doc.setFontSize(10);
      doc.text('Receipt No', 14, y);
      doc.text('Date', 50, y);
      doc.text('Cashier', 90, y);
      doc.text('Branch', 130, y);
      doc.text('Payment', 165, y);
      doc.text('Total', 190, y);
      y += lineHeight;

      doc.setFontSize(9);
      data.data.forEach((item: any, index: number) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.receiptNo || '-', 14, y);
        doc.text(item.date || '-', 50, y);
        doc.text((item.cashier || '-').slice(0, 18), 90, y);
        doc.text((item.branch || '-').slice(0, 18), 130, y);
        doc.text(getPaymentMethodLabel(item.paymentMethod), 165, y);
        doc.text(item.total || '-', 190, y);
        y += lineHeight;
      });
    } else if (reportType === 'category-sales') {
      doc.setFontSize(10);
      doc.text('Category', 14, y);
      doc.text('Cash', 60, y);
      doc.text('Card', 85, y);
      doc.text('Bank Transfer', 105, y);
      doc.text('M-Pesa', 135, y);
      doc.text('Total', 165, y);
      y += lineHeight;

      doc.setFontSize(9);
      data.data.forEach((item: any) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.category || '-', 14, y);
        doc.text(item.cash || '0', 60, y);
        doc.text(item.card || '0', 85, y);
        doc.text(item.bankTransfer || '0', 105, y);
        doc.text(item.mobileMoney || '0', 135, y);
        doc.text(item.total || '0', 165, y);
        y += lineHeight;
      });
    } else if (reportType === 'profit') {
      doc.setFontSize(10);
      doc.text('ID', 14, y);
      doc.text('Date', 50, y);
      doc.text('Cashier', 90, y);
      doc.text('Revenue', 130, y);
      doc.text('Cost', 160, y);
      doc.text('Profit', 190, y);
      y += lineHeight;

      doc.setFontSize(9);
      data.data.forEach((item: any) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.id?.slice(-8) || '-', 14, y);
        doc.text(item.date || '-', 50, y);
        doc.text((item.cashier || '-').slice(0, 18), 90, y);
        doc.text(item.revenue || '-', 130, y);
        doc.text(item.cost || '-', 160, y);
        doc.text(item.profit || '-', 190, y);
        y += lineHeight;
      });
    } else {
      const keys = Object.keys(data.data[0] || {}).filter((k) => !k.startsWith('raw'));
      doc.setFontSize(10);
      let xOffset = 14;
      keys.forEach((key, i) => {
        doc.text(key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()), xOffset, y);
        xOffset += Math.max(25, key.length * 3.5);
      });
      y += lineHeight;

      doc.setFontSize(9);
      data.data.forEach((item: any) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 20;
        }
        xOffset = 14;
        keys.forEach((key) => {
          const value = String(item[key] ?? '-');
          const truncated = value.length > 20 ? value.slice(0, 18) + '..' : value;
          doc.text(truncated, xOffset, y);
          xOffset += Math.max(25, key.length * 3.5);
        });
        y += lineHeight;
      });
    }

    doc.save(`${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const renderSummaryCards = () => {
    if (reportType === 'sales') {
      const totalSales = data?.data?.reduce((sum: number, s: any) => sum + (s.rawTotal || 0), 0) || 0;
      const avgSale = data?.data?.length ? totalSales / data.data.length : 0;
      const totalTx = data?.data?.length || 0;

      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTx.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Sale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(avgSale)}</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (reportType === 'category-sales') {
      const total = data?.data?.reduce((sum: number, cat: any) => sum + (cat.rawTotal || 0), 0) || 0;
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(data?.data?.length || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{startDate || 'All'} to {endDate || 'All'}</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (reportType === 'profit') {
      const totalRevenue = data?.data?.reduce((sum: number, s: any) => sum + (s.rawProfit || 0) + (s.cost ? parseFloat(s.cost.replace(/[^0-9.-]/g, '')) : 0), 0) || 0;
      const totalProfit = data?.data?.reduce((sum: number, s: any) => sum + (s.rawProfit || 0), 0) || 0;
      const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{margin}%</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{page} of {totalPages}</div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderSalesReport = () => (
    <div className="space-y-4">
      {renderSummaryCards()}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">Receipt No</th>
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Cashier</th>
              <th className="p-3 text-left font-medium">Branch</th>
              <th className="p-3 text-left font-medium">Payment</th>
              <th className="p-3 text-right font-medium">Subtotal</th>
              <th className="p-3 text-right font-medium">Discount</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((sale: any) => (
              <tr key={sale.id} className="border-t hover:bg-muted/20">
                <td className="p-3 font-mono text-xs">{sale.receiptNo}</td>
                <td className="p-3 whitespace-nowrap">{sale.date}</td>
                <td className="p-3">{sale.cashier}</td>
                <td className="p-3">{sale.branch}</td>
                <td className="p-3">
                  <Badge variant={getPaymentMethodBadgeVariant(sale.paymentMethod)}>
                    {getPaymentMethodLabel(sale.paymentMethod)}
                  </Badge>
                </td>
                <td className="p-3 text-right tabular-nums">{sale.subtotal}</td>
                <td className="p-3 text-right tabular-nums">{sale.discount}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{sale.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );

  const renderCategorySalesReport = () => {
    const categories = data?.data || [];
    const totals = categories.reduce((acc: any, cat: any) => {
      const cash = parseFloat(cat.cash?.replace(/[^0-9.-]/g, '') || '0');
      const card = parseFloat(cat.card?.replace(/[^0-9.-]/g, '') || '0');
      const bankTransfer = parseFloat(cat.bankTransfer?.replace(/[^0-9.-]/g, '') || '0');
      const mobileMoney = parseFloat(cat.mobileMoney?.replace(/[^0-9.-]/g, '') || '0');
      const total = parseFloat(cat.total?.replace(/[^0-9.-]/g, '') || '0');
      return {
        cash: acc.cash + cash,
        card: acc.card + card,
        bankTransfer: acc.bankTransfer + bankTransfer,
        mobileMoney: acc.mobileMoney + mobileMoney,
        total: acc.total + total,
      };
    }, { cash: 0, card: 0, bankTransfer: 0, mobileMoney: 0, total: 0 });

    return (
      <div className="space-y-4">
        {renderSummaryCards()}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
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
                <tr key={cat.category} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{cat.category}</td>
                  <td className="p-3 text-right tabular-nums">{cat.cash}</td>
                  <td className="p-3 text-right tabular-nums">{cat.card}</td>
                  <td className="p-3 text-right tabular-nums">{cat.bankTransfer}</td>
                  <td className="p-3 text-right tabular-nums">{cat.mobileMoney}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{cat.total}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-bold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(totals.cash)}</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(totals.card)}</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(totals.bankTransfer)}</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(totals.mobileMoney)}</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProductsReport = () => (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Name</th>
            <th className="p-3 text-left font-medium">SKU</th>
            <th className="p-3 text-left font-medium">Category</th>
            <th className="p-3 text-right font-medium">Price</th>
            <th className="p-3 text-right font-medium">Cost</th>
            <th className="p-3 text-right font-medium">Stock</th>
            <th className="p-3 text-center font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((product: any) => (
            <tr key={product.id} className="border-t hover:bg-muted/20">
              <td className="p-3">{product.name}</td>
              <td className="p-3 font-mono text-xs">{product.sku}</td>
              <td className="p-3">{product.category}</td>
              <td className="p-3 text-right tabular-nums">{product.price}</td>
              <td className="p-3 text-right tabular-nums">{product.costPrice}</td>
              <td className="p-3 text-right tabular-nums">{product.stock}</td>
              <td className="p-3 text-center">
                <Badge variant={product.status === 'Active' ? 'default' : 'secondary'}>{product.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderInventoryReport = () => (
    <div className="space-y-4">
      {renderSummaryCards()}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">Product</th>
              <th className="p-3 text-left font-medium">SKU</th>
              <th className="p-3 text-left font-medium">Branch</th>
              <th className="p-3 text-right font-medium">Quantity</th>
              <th className="p-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((item: any) => (
              <tr key={item.id} className="border-t hover:bg-muted/20">
                <td className="p-3">{item.product}</td>
                <td className="p-3 font-mono text-xs">{item.sku}</td>
                <td className="p-3">{item.branch}</td>
                <td className="p-3 text-right tabular-nums">{item.quantity}</td>
                <td className="p-3 text-right tabular-nums">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );

  const renderProfitReport = () => (
    <div className="space-y-4">
      {renderSummaryCards()}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">ID</th>
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Cashier</th>
              <th className="p-3 text-left font-medium">Branch</th>
              <th className="p-3 text-right font-medium">Revenue</th>
              <th className="p-3 text-right font-medium">Cost</th>
              <th className="p-3 text-right font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((sale: any) => (
              <tr key={sale.id} className="border-t hover:bg-muted/20">
                <td className="p-3 font-mono text-xs">#{sale.id?.slice(-8)}</td>
                <td className="p-3 whitespace-nowrap">{sale.date}</td>
                <td className="p-3">{sale.cashier}</td>
                <td className="p-3">{sale.branch}</td>
                <td className="p-3 text-right tabular-nums">{sale.revenue}</td>
                <td className="p-3 text-right tabular-nums">{sale.cost}</td>
                <td className={`p-3 text-right font-semibold tabular-nums ${sale.rawProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sale.profit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );

  const renderCashierReport = () => (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Cashier</th>
            <th className="p-3 text-left font-medium">Email</th>
            <th className="p-3 text-right font-medium">Sales Count</th>
            <th className="p-3 text-right font-medium">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((cashier: any) => (
            <tr key={cashier.id} className="border-t hover:bg-muted/20">
              <td className="p-3">{cashier.name}</td>
              <td className="p-3 text-muted-foreground">{cashier.email}</td>
              <td className="p-3 text-right tabular-nums">{cashier.salesCount}</td>
              <td className="p-3 text-right font-semibold tabular-nums">{cashier.totalSales}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderBranchReport = () => (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm min-w-[400px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-medium">Branch</th>
            <th className="p-3 text-left font-medium">Code</th>
            <th className="p-3 text-right font-medium">Sales Count</th>
            <th className="p-3 text-right font-medium">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((branch: any) => (
            <tr key={branch.id} className="border-t hover:bg-muted/20">
              <td className="p-3">{branch.name}</td>
              <td className="p-3 font-mono text-xs">{branch.code}</td>
              <td className="p-3 text-right tabular-nums">{branch.salesCount}</td>
              <td className="p-3 text-right font-semibold tabular-nums">{branch.totalSales}</td>
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
          <Button variant="outline" onClick={exportCSV} disabled={!data?.data?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportPDF} disabled={!data?.data?.length}>
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
                  onClick={() => handleReportTypeChange(type.id)}
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
              <span className="text-muted-foreground text-sm">to</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button size="sm" onClick={handleDateApply}>Apply</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-8 text-muted-foreground">No records found</div>
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
