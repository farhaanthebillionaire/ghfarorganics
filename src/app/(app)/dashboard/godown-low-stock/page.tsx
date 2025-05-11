
'use client';

import type { GodownProduct } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Package, Warehouse } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import * as dataStore from '@/lib/data-store';

const GODOWN_LOW_STOCK_THRESHOLD = 20;

const fetchGodownLowStockProducts = async (): Promise<GodownProduct[]> => {
  const allGodownProducts = await dataStore.getGodownProducts({ orderBy: 'quantity', orderDirection: 'asc' });
  return allGodownProducts.filter(product => product.quantity <= GODOWN_LOW_STOCK_THRESHOLD);
};


export default function GodownLowStockPage() {
  const { data: lowStockGodownProducts = [], isLoading, error } = useQuery<GodownProduct[]>({
    queryKey: ['godownLowStockProducts'],
    queryFn: fetchGodownLowStockProducts,
  });

  if (isLoading) return <GodownLowStockSkeleton />;
  if (error) return <div className="text-destructive text-center py-10 p-6">Error loading godown low stock products. Please try again.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
          <AlertTriangle className="mr-3 h-8 w-8 text-yellow-500" />
          Godown Low Stock Alerts
        </h1>
      </div>

      {lowStockGodownProducts.length === 0 ? (
         <Card className="shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Warehouse className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-xl font-semibold text-foreground">All Godown Products Well Stocked!</h2>
                <p className="text-muted-foreground mt-1">
                    There are currently no godown products with quantity less than or equal to {GODOWN_LOW_STOCK_THRESHOLD}.
                </p>
                <Link href="/dashboard/godown" passHref>
                    <Button variant="outline" className="mt-4">
                        View Godown Stock
                    </Button>
                </Link>
            </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Godown Products Running Low</CardTitle>
            <CardDescription>
              The following godown products have a quantity of {GODOWN_LOW_STOCK_THRESHOLD} or less. Consider restocking or moving stock soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Product Name</TableHead>
                  <TableHead>Current Quantity</TableHead>
                  <TableHead>Reference Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockGodownProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-yellow-500/10">
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-semibold text-destructive">{product.quantity}</TableCell>
                    <TableCell>₹{product.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/godown?edit=${product.id}&openDialog=true`} passHref>
                        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                           Manage Stock
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function GodownLowStockSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-72" /> {/* Adjusted width for longer title */}
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-56" /> {/* Adjusted width */}
          <Skeleton className="h-4 w-full max-w-lg mt-1" /> {/* Adjusted width */}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead><Skeleton className="h-5 w-32" /></TableHead><TableHead><Skeleton className="h-5 w-24" /></TableHead><TableHead><Skeleton className="h-5 w-24" /></TableHead><TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

