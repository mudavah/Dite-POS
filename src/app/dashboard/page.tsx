'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Store,
  Package,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

import { toNumeric } from '@/lib/numeric';
import { format } from 'date-fns';

interface LowStockItem {
  id: string;
  quantity: number;
  product: { name: string };
  branch: { name: string };
}

interface RecentSale {
  id: string;
  createdAt: string;
  cashier: { name: string } | null;
  totalAmount: number;
  paymentStatus: string;
}

interface BranchPerformance {
  id: string;
  name: string;
  saleCount: number;
  totalSales: number;
}

interface DashboardData {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  revenue: number;
  profit: number;
  todayPurchases: number;
  monthPurchases: number;
  totalPurchases: number;
  totalPurchaseValue: number;
  totalProducts: number;
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
  totalMovements: number;
  recentPurchases: Array<{ id: string; purchaseNumber: string; supplier: string; date: string; grandTotal: number; status: string; items: number }>;
  topPurchasedProducts: Array<Record<string, unknown>>;
  recentSales: RecentSale[];
  topProducts: Array<Record<string, unknown>>;
  lowStockItems: LowStockItem[];
  branchPerformance: BranchPerformance[];
  topSuppliers: Array<{ supplier: { name: string }; _sum: { grandTotal: number }; _count: { id: number } }>;
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

const COLORS = ['#0088FE', '#00C49F', '#FFC658', '#FF8042', '#8884d8', '#82ca9d'];

const statCards: Array<{ title: string; key: keyof DashboardData; icon: React.ElementType; color: string }> = [
  { title: "Today's Sales", key: 'todaySales', icon: DollarSign, color: 'text-blue-400' },
  { title: 'Weekly Sales', key: 'weekSales', icon: TrendingUp, color: 'text-green-400' },
  { title: 'Monthly Sales', key: 'monthSales', icon: ShoppingCart, color: 'text-purple-400' },
  { title: 'Revenue', key: 'revenue', icon: DollarSign, color: 'text-emerald-400' },
  { title: 'Profit', key: 'profit', icon: TrendingUp, color: 'text-amber-400' },
  { title: "Today's Purchases", key: 'todayPurchases', icon: ShoppingCart, color: 'text-orange-400' },
  { title: 'Month Purchases', key: 'monthPurchases', icon: TrendingUp, color: 'text-red-400' },
  { title: 'Purchase Value', key: 'totalPurchaseValue', icon: DollarSign, color: 'text-teal-400' },
  { title: 'Total Products', key: 'totalProducts', icon: Package, color: 'text-indigo-400' },
  { title: 'Inventory Value', key: 'inventoryValue', icon: DollarSign, color: 'text-green-400' },
  { title: 'Low Stock', key: 'lowStock', icon: AlertTriangle, color: 'text-amber-400' },
  { title: 'Out of Stock', key: 'outOfStock', icon: AlertTriangle, color: 'text-destructive' },
  { title: 'Total Movements', key: 'totalMovements', icon: TrendingUp, color: 'text-cyan-400' },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ['dashboard'], queryFn: fetchDashboard });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(Number((data as DashboardData | undefined)?.[card.key]) || 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.topProducts || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="product.name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    labelFormatter={(label) => `Product: ${label}`}
                  />
                  <Bar dataKey="_sum.total" fill="#8884d8" name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : data && data.lowStockItems && data.lowStockItems.length > 0 ? (
                data.lowStockItems.map((item: LowStockItem) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">{item.branch.name}</p>
                    </div>
                    <Badge variant="destructive">{item.quantity} left</Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No low stock alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-4">
                {data?.recentSales?.map((sale: RecentSale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">#{sale.id.slice(-8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {sale.cashier?.name || 'Unknown'} - {new Date(sale.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(sale.totalAmount)}</p>
                      <Badge variant={sale.paymentStatus === 'COMPLETED' ? 'success' : 'secondary'}>
                        {sale.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Branch Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-4">
                {data?.branchPerformance?.map((branch: BranchPerformance) => (
                  <div key={branch.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      <p className="text-sm text-muted-foreground">{branch.saleCount} sales</p>
                    </div>
                    <p className="font-medium">{formatCurrency(branch.totalSales)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data?.topSuppliers && data.topSuppliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Suppliers (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-4">
                {data.topSuppliers.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">{s.supplier?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{s._count.id} purchases</p>
                      </div>
                    </div>
                    <p className="font-medium">{formatCurrency(toNumeric(s._sum.grandTotal) || 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}