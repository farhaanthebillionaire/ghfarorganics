
// @ts-nocheck
'use client';

import type { Product } from '@/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PlusCircle, Edit3, Trash2, Search, Package, PackageOpen, AlertCircle, XCircle, RefreshCw, FileSpreadsheet, MoreVertical, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { BarcodeDisplay } from '@/components/inventory/BarcodeDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as dataStore from '@/lib/data-store';
import * as XLSX from 'xlsx';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const productSchema = z.object({
  name: z.string().min(1, { message: 'Product name is required' }),
  price: z.coerce.number().positive({ message: 'Price must be a positive number' }),
  quantity: z.coerce.number().int().nonnegative({ message: 'Quantity must be a non-negative integer' }),
  uniqueId: z.string().min(1, { message: 'Barcode ID is required' }),
});

type ProductFormData = z.infer<typeof productSchema>;

const fetchProducts = async (): Promise<Product[]> => {
  console.log("[InventoryPage] fetchProducts: Starting (Firestore)...");
  try {
    // Firestore `getProducts` will handle ordering and mapping Timestamps
    const products = await dataStore.getProducts({ orderBy: 'name', orderDirection: 'asc', limit: 100 });
    console.log(`[InventoryPage] fetchProducts: Received ${products.length} products from Firestore.`);
    return products; // Dates are already handled by dataStore
  } catch (error) {
    console.error("[InventoryPage] fetchProducts: Firestore error:", error);
    throw error;
  }
};


const generateUniqueId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PROD-${timestampPart}-${randomPart}`;
};

export default function InventoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();

  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);

  const { data: products = [], isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery<Product[], Error>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, setValue: setFormValue, watch } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      price: 0,
      quantity: 0,
      uniqueId: generateUniqueId(), 
    }
  });
  
  const currentUniqueId = watch('uniqueId');

  useEffect(() => {
    if (editingProduct && isProductDialogOpen) {
      setFormValue('name', editingProduct.name);
      setFormValue('price', editingProduct.price);
      setFormValue('quantity', editingProduct.quantity);
      setFormValue('uniqueId', editingProduct.uniqueId);
    } else if (!editingProduct && isProductDialogOpen) {
        if (!watch('uniqueId')) {
             setFormValue('uniqueId', generateUniqueId());
        }
    }
  }, [editingProduct, isProductDialogOpen, setFormValue, watch]);


  const addProductMutation = useMutation({
    mutationFn: async (newProductData: ProductFormData) => {
      // Check if uniqueId (barcode) already exists
      const existingProductByBarcode = await dataStore.getProductByUniqueId(newProductData.uniqueId);
      if (existingProductByBarcode) {
         throw new Error(`Barcode ID ${newProductData.uniqueId} already exists. Please regenerate or check the ID.`);
      }
      // `addProduct` from dataStore now handles Firestore ID generation and Timestamp conversion
      const addedProduct = await dataStore.addProduct(newProductData);
      return addedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
      toast({ title: 'Product Added', description: 'New product has been successfully added.', className: 'bg-primary text-primary-foreground'});
      setIsProductDialogOpen(false); 
    },
    onError: (error: Error) => {
      toast({ title: 'Error Adding Product', description: error.message, variant: 'destructive' });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (updatedProductData: ProductFormData) => {
      if (!editingProduct?.id) throw new Error('Product ID not found for update.');
      
      // Check if new uniqueId (barcode) conflicts with another product
      if (updatedProductData.uniqueId !== editingProduct.uniqueId) {
        const existingProductByBarcode = await dataStore.getProductByUniqueId(updatedProductData.uniqueId);
         if (existingProductByBarcode && existingProductByBarcode.id !== editingProduct.id) {
           throw new Error(`Barcode ID ${updatedProductData.uniqueId} already exists for another product.`);
        }
      }
      // `updateProduct` from dataStore now handles Firestore update and Timestamp conversion
      const updated = await dataStore.updateProduct(editingProduct.id, updatedProductData);
      if (!updated) throw new Error('Failed to update product in data store.');
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
      toast({ title: 'Product Updated', description: 'Product details have been successfully updated.', className: 'bg-primary text-primary-foreground'});
      setIsProductDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error Updating Product', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // `deleteProduct` from dataStore now handles Firestore deletion
      const success = await dataStore.deleteProduct(productId);
      if (!success) throw new Error('Failed to delete product from data store.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
      toast({ title: 'Product Deleted', description: 'Product has been successfully deleted.', className: 'bg-destructive text-destructive-foreground' });
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error Deleting Product', description: error.message, variant: 'destructive' });
    },
  });


  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    if (editingProduct) {
      await updateProductMutation.mutateAsync(data);
    } else {
      await addProductMutation.mutateAsync(data);
    }
  };
  
  const openAddProductDialog = () => {
    setEditingProduct(null);
    reset({ name: '', price: 0, quantity: 0, uniqueId: generateUniqueId() });
    setIsProductDialogOpen(true);
  };

  const openEditProductDialog = (product: Product) => {
    setEditingProduct(product);
    setIsProductDialogOpen(true);
  };

  const openDeleteConfirmDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  const openViewBarcodeDialog = (product: Product) => {
    setSelectedProductForBarcode(product);
    setIsBarcodeDialogOpen(true);
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.uniqueId && product.uniqueId.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);


  const handleExportInventory = () => {
    if (filteredProducts.length === 0) {
      toast({ title: 'No Data', description: 'There are no products to export.', variant: 'destructive' });
      return;
    }
    const dataToExport = filteredProducts.map(p => ({
      'Product ID (Firestore)': p.id, // Firestore ID
      'Name': p.name,
      'Price (₹)': p.price.toFixed(2),
      'Quantity': p.quantity,
      'Barcode ID': p.uniqueId,
      'Created At': p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A',
      'Updated At': p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'N/A',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, 'inventory_export.xlsx');
    toast({ title: 'Export Successful', description: 'Inventory data has been exported to Excel.' });
  };


  if (productsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-destructive">
        <XCircle className="w-16 h-16 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Products</h2>
        <p className="text-center mb-1">Could not fetch product data. Please check your connection or the console for more details.</p>
        <p className="text-center text-xs mb-4">Details: {productsError.message}</p>
        <Button onClick={() => refetchProducts()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const handleRegenerateUniqueId = () => {
      setFormValue('uniqueId', generateUniqueId(), { shouldValidate: true });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center">
          <PackageOpen className="mr-2 md:mr-3 h-7 w-7 md:h-8 md:w-8" />
          Inventory Management
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-56 md:w-64"
            />
          </div>
          <Button onClick={handleExportInventory} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-5 w-5" /> Export to Excel
          </Button>
          <Button onClick={openAddProductDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Product
          </Button>
        </div>
      </div>

      <Card className="shadow-lg flex-grow flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>View, edit, or delete products in your inventory.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-0 md:p-6 overflow-hidden">
          {productsLoading ? (
            <InventorySkeleton />
          ) : filteredProducts.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground h-full flex flex-col justify-center items-center">
                <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-3" />
                <p className="text-base md:text-lg font-medium">No products found.</p>
                {searchTerm ? 
                    <p className="text-sm md:text-base">Try adjusting your search term or add new products.</p> : 
                    <p className="text-sm md:text-base">Get started by adding your first product.</p>
                }
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[80px]">Price</TableHead>
                    <TableHead className="min-w-[80px]">Quantity</TableHead>
                    <TableHead className="min-w-[180px]">Barcode ID</TableHead>
                    <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className={cn(product.quantity < 10 && "bg-yellow-500/10 hover:bg-yellow-500/20")}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>₹{product.price.toFixed(2)}</TableCell>
                      <TableCell className={cn(product.quantity < 10 ? "text-destructive font-bold" : "")}>
                        {product.quantity}
                        {product.quantity < 10 && <AlertCircle className="inline ml-1 h-4 w-4 text-destructive" title="Low Stock"/>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <span>{product.uniqueId}</span>
                          {!isMobile && (
                            <Dialog>
                              <DialogTrigger asChild>
                                 <Button variant="link" size="sm" className="p-0 h-auto text-xs text-primary hover:underline">View Barcode</Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                      <DialogTitle>Barcode for {product.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-4 flex justify-center">
                                      <BarcodeDisplay value={product.uniqueId} interactive />
                                  </div>
                                  <DialogFooter>
                                      <DialogClose asChild><Button type="button">Close</Button></DialogClose>
                                  </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isMobile ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openViewBarcodeDialog(product)}>
                                <QrCode className="mr-2 h-4 w-4" /> View Barcode
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditProductDialog(product)}>
                                <Edit3 className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDeleteConfirmDialog(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditProductDialog(product)} className="text-primary hover:text-primary/80 mr-1">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmDialog(product)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
        {filteredProducts.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground pt-4 border-t">
                Showing {filteredProducts.length} of {products.length} products.
            </CardFooter>
        )}
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={ (isOpen) => {
        setIsProductDialogOpen(isOpen);
        if (!isOpen) {
          setEditingProduct(null); 
          reset({ name: '', price: 0, quantity: 0, uniqueId: generateUniqueId() }); 
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div>
              <label htmlFor="name" className={cn("block text-sm font-medium mb-1", errors.name && "text-destructive")}>Product Name</label>
              <Input id="name" {...register('name')} className={cn(errors.name && "border-destructive")} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className={cn("block text-sm font-medium mb-1", errors.price && "text-destructive")}>Price (₹)</label>
                <Input id="price" type="number" step="0.01" {...register('price')} className={cn(errors.price && "border-destructive")} />
                {errors.price && <p className="text-xs text-destructive mt-1">{errors.price.message}</p>}
              </div>
              <div>
                <label htmlFor="quantity" className={cn("block text-sm font-medium mb-1", errors.quantity && "text-destructive")}>Quantity</label>
                <Input id="quantity" type="number" step="1" {...register('quantity')} className={cn(errors.quantity && "border-destructive")} />
                {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="uniqueId" className={cn("block text-sm font-medium mb-1", errors.uniqueId && "text-destructive")}>
                Barcode ID
              </label>
              <div className="flex items-center gap-2">
                <Input 
                  id="uniqueId" 
                  {...register('uniqueId')} 
                  className={cn(errors.uniqueId && "border-destructive", "flex-grow")}
                  readOnly={!!editingProduct} 
                />
                <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={handleRegenerateUniqueId} 
                    title={editingProduct ? "ID fixed for existing product" : "Regenerate ID"}
                    disabled={!!editingProduct} 
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.uniqueId && <p className="text-xs text-destructive mt-1">{errors.uniqueId.message}</p>}
              {currentUniqueId && (
                <div className="mt-2 flex justify-center">
                   <BarcodeDisplay value={currentUniqueId} />
                </div>
              )}
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || addProductMutation.isPending || updateProductMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting || addProductMutation.isPending || updateProductMutation.isPending ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Add Product')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
       <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product
              <span className="font-semibold"> {productToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => productToDelete && deleteProductMutation.mutate(productToDelete.id)}
              disabled={deleteProductMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode View Dialog (for mobile, triggered from dropdown) */}
      <Dialog open={isBarcodeDialogOpen} onOpenChange={(isOpen) => {
        setIsBarcodeDialogOpen(isOpen);
        if (!isOpen) setSelectedProductForBarcode(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Barcode for {selectedProductForBarcode?.name}</DialogTitle>
          </DialogHeader>
          {selectedProductForBarcode && (
            <div className="py-4 flex justify-center">
              <BarcodeDisplay value={selectedProductForBarcode.uniqueId} interactive />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" onClick={() => setSelectedProductForBarcode(null)}>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function InventorySkeleton() {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%] min-w-[150px]"><Skeleton className="h-5 w-32" /></TableHead>
            <TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead>
            <TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead>
            <TableHead className="min-w-[180px]"><Skeleton className="h-5 w-24" /></TableHead>
            <TableHead className="text-right min-w-[100px]"><Skeleton className="h-5 w-20" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell className="text-right space-x-1">
                <Skeleton className="h-8 w-8 inline-block" />
                <Skeleton className="h-8 w-8 inline-block" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
       <CardFooter className="text-sm text-muted-foreground pt-4 border-t">
          <Skeleton className="h-4 w-32" />
      </CardFooter>
    </>
  );
}
