'use client';

import type { LowStockProduct, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Package, ShoppingCart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; 
import Link from 'next/link';
import * as dataStore from '@/lib/data-store';

const fetchLowStockProducts = async (): Promise<LowStockProduct[]> => {
  // Assuming dataStore.getProducts can be filtered or will be filtered here
  const allProducts = await dataStore.getProducts({ orderBy: 'quantity', orderDirection: 'asc' });
  return allProducts
    .filter(product => product.quantity < 10) as LowStockProduct[]; // Dates already Date objects
};


export default function LowStockPage() {
  const { data: lowStockProducts = [], isLoading, error } = useQuery<LowStockProduct[]>({
    queryKey: ['lowStockProducts'],
    queryFn: fetchLowStockProducts,
  });

  if (isLoading) return <LowStockSkeleton />;
  if (error) return <div className="text-destructive text-center py-10 p-6">Error loading low stock products. Please try again.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
          <AlertTriangle className="mr-3 h-8 w-8 text-yellow-500" />
          Low Stock Alerts
        </h1>
      </div>

      {lowStockProducts.length === 0 ? (
         <Card className="shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-xl font-semibold text-foreground">All Products Well Stocked!</h2>
                <p className="text-muted-foreground mt-1">
                    There are currently no products with quantity less than 10.
                </p>
                <Link href="/dashboard/inventory" passHref>
                    <Button variant="outline" className="mt-4">
                        View Full Inventory
                    </Button>
                </Link>
            </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Products Running Low</CardTitle>
            <CardDescription>
              The following products have a quantity of less than 10. Consider restocking soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Product Name</TableHead>
                  <TableHead>Current Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-yellow-500/10">
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-semibold text-destructive">{product.quantity}</TableCell>
                    <TableCell>₹{product.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {/* Link will pass Firestore ID to inventory page for editing */}
                      <Link href={`/dashboard/inventory?edit=${product.id}&openDialog=true`} passHref>
                        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                           Restock / Edit
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


function LowStockSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md mt-1" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                <TableHead><Skeleton className="h-5 w-16" /></TableHead>
                <TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead>
              </TableRow>
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
