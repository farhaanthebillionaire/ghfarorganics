
// @ts-nocheck
'use client';

import { useState, useMemo } from 'react'; // Added useMemo
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Order, SalesData } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, subWeeks, subYears, startOfYear, endOfYear } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Package, CalendarDays, FileSpreadsheet } from 'lucide-react';
import * as dataStore from '@/lib/data-store';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';


type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

interface ReportData {
  periodData: SalesData[];
  totalSalesAllTime: number;
  totalOrdersAllTime: number;
  averageOrderValue: number;
}

const fetchReportData = async (period: ReportPeriod): Promise<ReportData> => {
  // dataStore.getOrders fetches from Firestore and converts Timestamps to Dates
  const orders = await dataStore.getOrders({ orderBy: "createdAt", orderDirection: "asc" });
  
  let periodData: SalesData[] = [];
  const now = new Date();

  if (period === 'weekly') {
    const weeks = Array.from({ length: 4 }, (_, i) => subWeeks(now, i)).reverse();
    periodData = weeks.map(weekStartTarget => {
      const start = startOfWeek(weekStartTarget, { weekStartsOn: 1 }); 
      const end = endOfWeek(weekStartTarget, { weekStartsOn: 1 });
      // Filter using Date objects
      const weekOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      return {
        period: `Week of ${format(start, 'MMM dd')}`,
        totalSales: weekOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalOrders: weekOrders.length,
      };
    });
  } else if (period === 'monthly') {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(now, i)).reverse();
     periodData = months.map(monthStartTarget => {
      const start = startOfMonth(monthStartTarget);
      const end = endOfMonth(monthStartTarget);
      const monthOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      return {
        period: format(start, 'MMM yyyy'),
        totalSales: monthOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalOrders: monthOrders.length,
      };
    });
  } else if (period === 'yearly') {
    const currentYear = now.getFullYear();
    const firstOrderYear = orders.length > 0 ? new Date(orders[0].createdAt).getFullYear() : currentYear;
    const yearsToDisplay = Math.min(3, currentYear - firstOrderYear + 1);

    const years = Array.from({ length: Math.max(1, yearsToDisplay) }, (_, i) => subYears(now, i)).reverse();
    periodData = years.map(yearStartTarget => {
      const start = startOfYear(yearStartTarget);
      const end = endOfYear(yearStartTarget);
      const yearOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      return {
        period: format(start, 'yyyy'),
        totalSales: yearOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalOrders: yearOrders.length,
      };
    });
  }
  
  const totalSalesAllTime = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersAllTime = orders.length;
  const averageOrderValue = totalOrdersAllTime > 0 ? totalSalesAllTime / totalOrdersAllTime : 0;

  return { periodData, totalSalesAllTime, totalOrdersAllTime, averageOrderValue };
};


export default function ReportsPage() {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const { toast } = useToast();

  const { data: reportData, isLoading, error } = useQuery<ReportData, Error>({
    queryKey: ['reportData', reportPeriod],
    queryFn: () => fetchReportData(reportPeriod),
  });


  const summaryStats = useMemo(() => {
    if (!reportData) return [];
    return [
      { title: 'Total Sales (All Time)', value: `₹${reportData.totalSalesAllTime.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
      { title: 'Total Orders (All Time)', value: reportData.totalOrdersAllTime.toString(), icon: Package, color: "text-blue-500" },
      { title: 'Average Order Value', value: `₹${reportData.averageOrderValue.toFixed(2)}`, icon: TrendingUp, color: "text-yellow-500" },
    ];
  }, [reportData]);

  const handleExportReportsToExcel = () => {
    if (!reportData) {
        toast({ title: 'No Data', description: 'Report data is not available for export.', variant: 'destructive' });
        return;
    }

    const workbook = XLSX.utils.book_new();

    const summarySheetData = summaryStats.map(stat => ({ Statistic: stat.title, Value: stat.value }));
    const summaryWorksheet = XLSX.utils.json_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary Stats");

    if (reportData.periodData.length > 0) {
        const salesDataForExcel = reportData.periodData.map(d => ({
            Period: d.period,
            'Total Sales (₹)': d.totalSales,
        }));
        const salesWorksheet = XLSX.utils.json_to_sheet(salesDataForExcel);
        XLSX.utils.book_append_sheet(workbook, salesWorksheet, "Sales Over Time");

        const ordersDataForExcel = reportData.periodData.map(d => ({
            Period: d.period,
            'Total Orders': d.totalOrders,
        }));
        const ordersWorksheet = XLSX.utils.json_to_sheet(ordersDataForExcel);
        XLSX.utils.book_append_sheet(workbook, ordersWorksheet, "Orders Over Time");
    } else {
        const emptySheet = XLSX.utils.json_to_sheet([{ Message: "No detailed period data available for the selected timeframe." }]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, "Period Data");
    }
    
    XLSX.writeFile(workbook, `Sales_Reports_${reportPeriod}.xlsx`);
    toast({ title: 'Export Successful', description: `Sales_Reports_${reportPeriod}.xlsx has been downloaded.`});
  };


  if (isLoading) return <ReportsSkeleton />;
  if (error || !reportData) return <div className="text-destructive p-6">Error loading reports: {error?.message || "Unknown error"}</div>;

  const { periodData } = reportData;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Sales Reports</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <Select value={reportPeriod} onValueChange={(value: ReportPeriod) => setReportPeriod(value)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card shadow-sm">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
           <Button onClick={handleExportReportsToExcel} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export All
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        {summaryStats.map(stat => (
          <Card key={stat.title} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Sales Over Time ({reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)})</CardTitle>
          <CardDescription>
            Visualizing total sales for the selected {reportPeriod} periods.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {periodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={periodData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                 />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Line type="monotone" dataKey="totalSales" name="Total Sales (₹)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6, fill: "hsl(var(--primary))" }}  />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-10">No sales data available for the selected period.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Orders Over Time ({reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)})</CardTitle>
           <CardDescription>
            Visualizing total orders for the selected {reportPeriod} periods.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {periodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={periodData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--chart-2))' }}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Bar dataKey="totalOrders" name="Total Orders" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <p className="text-center text-muted-foreground py-10">No order data available for the selected period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-32" /> 
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
           <Skeleton className="h-4 w-3/4 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
