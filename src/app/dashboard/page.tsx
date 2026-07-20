'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Store,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

async function fetchDashboard() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

const statCards = [
  { title: 'Today&apos;s Sales', key: 'todaySales', icon: DollarSign, color: 'text-blue-400' },
  { title: 'Weekly Sales', key: 'weekSales', icon: TrendingUp, color: 'text-green-400' },
  { title: 'Monthly Sales', key: 'monthSales', icon: ShoppingCart, color: 'text-purple-400' },
  { title: 'Revenue', key: 'revenue', icon: DollarSign, color: 'text-emerald-400' },
  { title: 'Profit', key: 'profit', icon: TrendingUp, color: 'text-amber-400' },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(data?.[card.key] || 0)}
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
              ) : data?.lowStock?.length > 0 ? (
                data.lowStock.map((item: any) => (
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
                {data?.recentSales?.map((sale: any) => (
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
                {data?.branchPerformance?.map((branch: any) => (
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
    </div>
  );
}
