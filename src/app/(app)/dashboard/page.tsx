'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Archive, ShoppingCart, PackageSearch, DollarSign, AlertTriangle, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, LineChart, Line } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import type { Product, Order } from '@/types';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import * as dataStore from '@/lib/data-store';


const fetchDashboardData = async () => {
  // Data store functions now interact with Firestore
  const allProducts = await dataStore.getProducts();
  const totalProducts = allProducts.length;
  const lowStockProducts = allProducts.filter(product => product.quantity < 10).length;

  const allOrders = await dataStore.getOrders(); // Dates are already Date objects
  const totalOrders = allOrders.length;
  let totalSales = 0;
  allOrders.forEach(order => {
    totalSales += order.totalAmount;
  });

  // Sales data for chart (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const salesByDate: Record<string, number> = {};
  // Filter orders based on Date objects
  const relevantOrders = allOrders.filter(order => new Date(order.createdAt) >= sevenDaysAgo);

  relevantOrders.forEach(order => {
    const dateStr = format(new Date(order.createdAt), 'MMM dd');
    salesByDate[dateStr] = (salesByDate[dateStr] || 0) + order.totalAmount;
  });
  
  const dailySales: { date: string; sales: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'MMM dd');
    dailySales.push({ date: dateStr, sales: salesByDate[dateStr] || 0 });
  }
  dailySales.sort((a,b) => new Date(a.date + " " + new Date().getFullYear()).getTime() - new Date(b.date + " " + new Date().getFullYear()).getTime());

  // Recent Orders from Firestore
  const recentOrders = await dataStore.getOrders({ orderBy: "createdAt", orderDirection: "desc", limit: 5 });
  // Dates are already Date objects from dataStore

  return { totalProducts, lowStockProducts, totalOrders, totalSales, dailySales, recentOrders };
};


export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: fetchDashboardData,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return <div className="text-destructive p-6">Error loading dashboard data: {error instanceof Error ? error.message : "Unknown error"}. Please try again later.</div>;
  }

  const { totalProducts, lowStockProducts, totalOrders, totalSales, dailySales, recentOrders } = data;

  const summaryCards = [
    { title: 'Total Products', value: totalProducts, icon: Archive, color: 'text-blue-500', link: '/dashboard/inventory' },
    { title: 'Total Orders', value: totalOrders, icon: PackageSearch, color: 'text-green-500', link: '/dashboard/orders' },
    { title: 'Total Sales', value: `₹${totalSales.toFixed(2)}`, icon: DollarSign, color: 'text-yellow-500', link: '/dashboard/reports' },
    { title: 'Low Stock Items', value: lowStockProducts, icon: AlertTriangle, color: 'text-red-500', link: '/dashboard/low-stock' },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Link href={card.link} key={card.title}>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Sales Overview
            </CardTitle>
            <CardDescription>Sales performance for the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales}>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--primary))' }}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6, fill: "hsl(var(--primary))" }} name="Sales (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-primary" />
              Recent Orders
            </CardTitle>
            <CardDescription>Last 5 processed orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <ul className="space-y-3">
                {recentOrders.map(order => (
                  <li key={order.id} className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                    <div>
                      <p className="font-medium text-sm">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <p className="font-semibold text-primary text-sm">₹{order.totalAmount.toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No recent orders found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-9 w-48" />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
