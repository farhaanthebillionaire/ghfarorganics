
// @ts-nocheck
'use client';

import { useState, useMemo } from 'react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Order, SalesData, ReportData, PaymentMethodBreakdown, PaymentMethodTrendData } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, subWeeks, subYears, startOfYear, endOfYear, getYear } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Package, CalendarDays, FileSpreadsheet, Banknote, CreditCard, HelpCircle, PieChart as PieChartIcon, TrendingDown } from 'lucide-react';
import * as dataStore from '@/lib/data-store';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';


type ReportPeriod = 'weekly' | 'monthly' | 'yearly';
type ReportDataType = 'all' | 'standard' | 'franchise';


const fetchReportDataForType = async (period: ReportPeriod, dataType: ReportDataType): Promise<ReportData> => {
  let orders: Order[] = [];

  if (dataType === 'all') {
    const standardOrders = await dataStore.getStandardOrders({ orderBy: "createdAt", orderDirection: "asc" });
    const franchiseInvoices = await dataStore.getFranchiseInvoices({ orderBy: "createdAt", orderDirection: "asc" });
    orders = [...standardOrders, ...franchiseInvoices].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (dataType === 'standard') {
    orders = await dataStore.getStandardOrders({ orderBy: "createdAt", orderDirection: "asc" });
  } else if (dataType === 'franchise') {
    orders = await dataStore.getFranchiseInvoices({ orderBy: "createdAt", orderDirection: "asc" });
  }
  
  let periodData: SalesData[] = [];
  let paymentMethodTrends: PaymentMethodTrendData[] = [];
  const now = new Date();

  const processPeriodOrders = (periodOrders: Order[], periodLabel: string) => {
    const sales = periodOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const count = periodOrders.length;
    const paymentCounts = { cash: 0, online: 0, unknown: 0 };
    periodOrders.forEach(o => {
      if (o.paymentMethod === 'cash') paymentCounts.cash++;
      else if (o.paymentMethod === 'online') paymentCounts.online++;
      else paymentCounts.unknown++;
    });
    return {
      salesData: { period: periodLabel, totalSales: sales, totalOrders: count },
      trendData: { period: periodLabel, ...paymentCounts },
    };
  };


  if (period === 'weekly') {
    const weeks = Array.from({ length: 12 }, (_, i) => subWeeks(now, i)).reverse(); 
    weeks.forEach(weekStartTarget => {
      const start = startOfWeek(weekStartTarget, { weekStartsOn: 1 }); 
      const end = endOfWeek(weekStartTarget, { weekStartsOn: 1 });
      const weekOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = `W${format(start, 'w')} ${format(start, 'MMM dd')}`;
      const { salesData, trendData } = processPeriodOrders(weekOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  } else if (period === 'monthly') {
    const months = Array.from({ length: 12 }, (_, i) => subMonths(now, i)).reverse(); 
     months.forEach(monthStartTarget => {
      const start = startOfMonth(monthStartTarget);
      const end = endOfMonth(monthStartTarget);
      const monthOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = format(start, 'MMM yyyy');
      const { salesData, trendData } = processPeriodOrders(monthOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  } else if (period === 'yearly') {
    const currentYear = getYear(now);
    const firstOrderYear = orders.length > 0 ? getYear(new Date(orders[0].createdAt)) : currentYear;
    const yearsToDisplay = Math.min(5, currentYear - firstOrderYear + 1); 

    const years = Array.from({ length: Math.max(1, yearsToDisplay) }, (_, i) => subYears(now, i)).reverse();
    years.forEach(yearStartTarget => {
      const start = startOfYear(yearStartTarget);
      const end = endOfYear(yearStartTarget);
      const yearOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = format(start, 'yyyy');
      const { salesData, trendData } = processPeriodOrders(yearOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  }
  
  const totalSalesAllTime = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersAllTime = orders.length;
  const averageOrderValue = totalOrdersAllTime > 0 ? totalSalesAllTime / totalOrdersAllTime : 0;

  const paymentMethodCounts: PaymentMethodBreakdown = { cash: 0, online: 0, unknown: 0 };
  orders.forEach(order => {
    if (order.paymentMethod === 'cash') {
      paymentMethodCounts.cash++;
    } else if (order.paymentMethod === 'online') {
      paymentMethodCounts.online++;
    } else {
      paymentMethodCounts.unknown++;
    }
  });

  return { periodData, totalSalesAllTime, totalOrdersAllTime, averageOrderValue, paymentMethodCounts, paymentMethodTrends };
};

const paymentMethodChartColors: Record<ReportDataType, { cash: string; online: string; unknown: string }> = {
  all: { cash: 'hsl(var(--chart-1))', online: 'hsl(var(--chart-2))', unknown: 'hsl(var(--muted))' }, 
  standard: { cash: 'hsl(var(--chart-3))', online: 'hsl(var(--chart-4))', unknown: 'hsl(var(--muted))' },
  franchise: { cash: 'hsl(var(--chart-5))', online: 'hsl(var(--chart-1))', unknown: 'hsl(var(--muted))' }, 
};

const paymentMethodTrendLineColors: Record<ReportDataType, { cash: string; online: string; unknown: string }> = {
  all: { cash: 'hsl(var(--chart-1))', online: 'hsl(var(--chart-2))', unknown: 'hsl(var(--muted-foreground))' },
  standard: { cash: 'hsl(var(--chart-3))', online: 'hsl(var(--chart-4))', unknown: 'hsl(var(--muted-foreground))' },
  franchise: { cash: 'hsl(var(--chart-5))', online: 'hsl(var(--primary))', unknown: 'hsl(var(--muted-foreground))' },
};


export default function ReportsPage() {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [reportDataType, setReportDataType] = useState<ReportDataType>('all');
  const { toast } = useToast();

  const { data: reportData, isLoading, error } = useQuery<ReportData, Error>({
    queryKey: ['reportData', reportPeriod, reportDataType],
    queryFn: () => fetchReportDataForType(reportPeriod, reportDataType),
  });


  const summaryStats = useMemo(() => {
    if (!reportData) return [];
    const typeLabel = reportDataType === 'all' ? 'All Orders' : (reportDataType === 'standard' ? 'Standard Bills' : 'Franchise Invoices');
    return [
      { title: `Total Sales (${typeLabel})`, value: `₹${reportData.totalSalesAllTime.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
      { title: `Total Orders (${typeLabel})`, value: reportData.totalOrdersAllTime.toString(), icon: Package, color: "text-blue-500" },
      { title: `Avg. Order Value (${typeLabel})`, value: `₹${reportData.averageOrderValue.toFixed(2)}`, icon: TrendingUp, color: "text-yellow-500" },
    ];
  }, [reportData, reportDataType]);

  const paymentMethodChartData = useMemo(() => {
    if (!reportData || !reportData.paymentMethodCounts) return [];

    const currentColors = paymentMethodChartColors[reportDataType];
    const { cash, online, unknown } = reportData.paymentMethodCounts;

    const data = [
      { name: 'Cash', value: cash, fill: currentColors.cash },
      { name: 'Online', value: online, fill: currentColors.online },
    ];
    if (unknown > 0) {
      data.push({ name: 'Unknown/Other', value: unknown, fill: currentColors.unknown });
    }
    return data.filter(d => d.value > 0); 
  }, [reportData, reportDataType]);


  const handleExportReportsToExcel = () => {
    if (!reportData) {
        toast({ title: 'No Data', description: 'Report data is not available for export.', variant: 'destructive' });
        return;
    }

    const workbook = XLSX.utils.book_new();
    const dataTypeSuffix = reportDataType.charAt(0).toUpperCase() + reportDataType.slice(1);

    const summarySheetData = summaryStats.map(stat => ({ Statistic: stat.title, Value: stat.value }));
    if (reportData.paymentMethodCounts) {
        summarySheetData.push({ Statistic: `Cash Payments (${dataTypeSuffix})`, Value: reportData.paymentMethodCounts.cash.toString() });
        summarySheetData.push({ Statistic: `Online Payments (${dataTypeSuffix})`, Value: reportData.paymentMethodCounts.online.toString() });
        if (reportData.paymentMethodCounts.unknown > 0) {
            summarySheetData.push({ Statistic: `Unknown/Other Payments (${dataTypeSuffix})`, Value: reportData.paymentMethodCounts.unknown.toString() });
        }
    }
    const summaryWorksheet = XLSX.utils.json_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, `Summary ${dataTypeSuffix}`);

    if (reportData.periodData.length > 0) {
        const salesDataForExcel = reportData.periodData.map(d => ({
            Period: d.period,
            'Total Sales (₹)': d.totalSales,
        }));
        const salesWorksheet = XLSX.utils.json_to_sheet(salesDataForExcel);
        XLSX.utils.book_append_sheet(workbook, salesWorksheet, `Sales ${dataTypeSuffix}`);

        const ordersDataForExcel = reportData.periodData.map(d => ({
            Period: d.period,
            'Total Orders': d.totalOrders,
        }));
        const ordersWorksheet = XLSX.utils.json_to_sheet(ordersDataForExcel);
        XLSX.utils.book_append_sheet(workbook, ordersWorksheet, `Orders ${dataTypeSuffix}`);
    } else {
        const emptySheet = XLSX.utils.json_to_sheet([{ Message: "No detailed period data available for the selected timeframe." }]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, `Data ${dataTypeSuffix}`);
    }
    
    XLSX.writeFile(workbook, `Sales_Reports_${dataTypeSuffix}_${reportPeriod}.xlsx`);
    toast({ title: 'Export Successful', description: `Sales_Reports_${dataTypeSuffix}_${reportPeriod}.xlsx has been downloaded.`});
  };


  if (isLoading) return <ReportsSkeleton />;
  if (error || !reportData) return <div className="text-destructive p-6">Error loading reports: {error?.message || "Unknown error"}</div>;

  const { periodData, paymentMethodTrends } = reportData;
  const chartTitleSuffix = reportDataType === 'all' ? '(Combined)' : (reportDataType === 'standard' ? '(Standard Bills)' : '(Franchise Invoices)');

  const salesLineColor = reportDataType === 'franchise' ? 'hsl(var(--chart-5))' : 'hsl(var(--primary))';
  const ordersBarColor = reportDataType === 'franchise' ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))';
  const currentTrendLineColors = paymentMethodTrendLineColors[reportDataType];


  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Sales Reports</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <Select value={reportPeriod} onValueChange={(value: ReportPeriod) => setReportPeriod(value)}>
            <SelectTrigger className="w-full sm:w-[130px] bg-card shadow-sm">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
           <Select value={reportDataType} onValueChange={(value: ReportDataType) => setReportDataType(value)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card shadow-sm">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Combined)</SelectItem>
              <SelectItem value="standard">Standard Bills Only</SelectItem>
              <SelectItem value="franchise">Franchise Invoices Only</SelectItem>
            </SelectContent>
          </Select>
           <Button onClick={handleExportReportsToExcel} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Payment Methods {chartTitleSuffix}</CardTitle>
             <PieChartIcon className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent className="pt-4">
            {paymentMethodChartData.length > 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[100px] space-y-3">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={paymentMethodChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={30} labelLine={false} paddingAngle={3}>
                      {paymentMethodChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill === 'hsl(var(--muted))' ? 'hsl(var(--border))' : entry.fill } />
                      ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}
                        formatter={(value, name) => [`${value} transactions`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-xs space-y-1 w-full flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {paymentMethodChartData.map((entry, index) => (
                     <div key={`legend-${index}`} className="flex items-center">
                       <span className="h-2.5 w-2.5 rounded-full mr-1.5" style={{ backgroundColor: entry.fill }} />
                       {entry.name}: {entry.value}
                     </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 min-h-[100px] flex items-center justify-center">No payment data available.</p>
            )}
          </CardContent>
        </Card>
      </div>


      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Sales Over Time {chartTitleSuffix}</CardTitle>
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
                    itemStyle={{ color: salesLineColor }}
                 />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Line type="monotone" dataKey="totalSales" name="Total Sales (₹)" stroke={salesLineColor} strokeWidth={2} dot={{ r: 4, fill: salesLineColor }} activeDot={{ r: 6, fill: salesLineColor }}  />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-10">No sales data available for the selected period and data type.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Orders Over Time {chartTitleSuffix}</CardTitle>
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
                    itemStyle={{ color: ordersBarColor }}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Bar dataKey="totalOrders" name="Total Orders" fill={ordersBarColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <p className="text-center text-muted-foreground py-10">No order data available for the selected period and data type.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Payment Method Trends {chartTitleSuffix}</CardTitle>
          <CardDescription>
            Trend of payment methods used over the selected {reportPeriod} periods.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethodTrends && paymentMethodTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={paymentMethodTrends} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Line type="monotone" dataKey="cash" name="Cash Payments" stroke={currentTrendLineColors.cash} strokeWidth={2} dot={{ r: 4, fill: currentTrendLineColors.cash }} activeDot={{ r: 6, fill: currentTrendLineColors.cash }} />
                <Line type="monotone" dataKey="online" name="Online Payments" stroke={currentTrendLineColors.online} strokeWidth={2} dot={{ r: 4, fill: currentTrendLineColors.online }} activeDot={{ r: 6, fill: currentTrendLineColors.online }} />
                {paymentMethodTrends.some(d => d.unknown > 0) && (
                   <Line type="monotone" dataKey="unknown" name="Unknown/Other" stroke={currentTrendLineColors.unknown} strokeWidth={2} dot={{ r: 4, fill: currentTrendLineColors.unknown }} activeDot={{ r: 6, fill: currentTrendLineColors.unknown }} strokeDasharray="5 5" />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-10">No payment method trend data available for the selected period and data type.</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-10 w-[130px]" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-32" /> 
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"> 
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
            </CardHeader>
            <CardContent className="pt-4 min-h-[100px]">
              <Skeleton className="h-8 w-24 mb-2" />
               {i === 3 && ( 
                <div className="flex flex-col items-center justify-center space-y-2 mt-1">
                  <Skeleton className="h-[80px] w-[80px] rounded-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              )}
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
      {/* Skeleton for the new Payment Method Trends chart */}
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



