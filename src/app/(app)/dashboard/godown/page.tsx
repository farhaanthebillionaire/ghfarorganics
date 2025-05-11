

// @ts-nocheck
'use client';

import type { GodownProduct, Product } from '@/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Edit3, Trash2, Search, Warehouse, Package, Move, RefreshCw, QrCode, MoreVertical, FileSpreadsheet, DollarSign } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';

const godownProductSchema = z.object({
  name: z.string().min(1, { message: 'Product name is required' }),
  price: z.coerce.number().positive({ message: 'Price must be a positive number' }),
  quantity: z.coerce.number().int().nonnegative({ message: 'Quantity must be a non-negative integer' }),
  uniqueId: z.string().min(1, { message: 'Barcode ID is required' }),
});

type GodownProductFormData = z.infer<typeof godownProductSchema>;

const moveToInventorySchema = z.object({
    quantityToMove: z.coerce.number().positive({ message: "Quantity must be positive" }),
});

type MoveToInventoryFormData = z.infer<typeof moveToInventorySchema>;


const fetchGodownProducts = async (): Promise<GodownProduct[]> => {
  const products = await dataStore.getGodownProducts({ orderBy: 'name', orderDirection: 'asc', limit: 100 });
  return products;
};

const generateGodownUniqueId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `GDN-${timestampPart}-${randomPart}`;
};

export default function GodownStockPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<GodownProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<GodownProduct | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();

  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<GodownProduct | null>(null);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
  
  const [productToMove, setProductToMove] = useState<GodownProduct | null>(null);
  const [isMoveToInventoryDialogOpen, setIsMoveToInventoryDialogOpen] = useState(false);

  const { data: godownProducts = [], isLoading: productsLoading, error: productsError, refetch: refetchGodownProducts } = useQuery<GodownProduct[], Error>({
    queryKey: ['godownProducts'],
    queryFn: fetchGodownProducts,
  });

  const productForm = useForm<GodownProductFormData>({
    resolver: zodResolver(godownProductSchema),
    defaultValues: {
      name: '',
      price: 0,
      quantity: 0,
      uniqueId: generateGodownUniqueId(), 
    }
  });
  
  const currentUniqueId = productForm.watch('uniqueId');

  const moveForm = useForm<MoveToInventoryFormData>({
    resolver: zodResolver(moveToInventorySchema),
    defaultValues: {
        quantityToMove: 1,
    }
  });


  useEffect(() => {
    if (editingProduct && isProductDialogOpen) {
      productForm.setValue('name', editingProduct.name);
      productForm.setValue('price', editingProduct.price);
      productForm.setValue('quantity', editingProduct.quantity);
      productForm.setValue('uniqueId', editingProduct.uniqueId);
    } else if (!editingProduct && isProductDialogOpen) {
        if (!productForm.watch('uniqueId')) {
             productForm.setValue('uniqueId', generateGodownUniqueId());
        }
    }
  }, [editingProduct, isProductDialogOpen, productForm]);

  const addGodownProductMutation = useMutation({
    mutationFn: async (newProductData: GodownProductFormData) => {
      const existingProductByBarcode = await dataStore.getGodownProductByUniqueId(newProductData.uniqueId);
      if (existingProductByBarcode) {
         throw new Error(`Barcode ID ${newProductData.uniqueId} already exists in godown. Please regenerate.`);
      }
      return dataStore.addGodownProduct(newProductData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      toast({ title: 'Godown Product Added', description: 'New product added to godown.', className: 'bg-primary text-primary-foreground'});
      setIsProductDialogOpen(false); 
    },
    onError: (error: Error) => {
      toast({ title: 'Error Adding Godown Product', description: error.message, variant: 'destructive' });
    },
  });

  const updateGodownProductMutation = useMutation({
    mutationFn: async (updatedProductData: GodownProductFormData) => {
      if (!editingProduct?.id) throw new Error('Product ID not found for update.');
      if (updatedProductData.uniqueId !== editingProduct.uniqueId) {
        const existingProductByBarcode = await dataStore.getGodownProductByUniqueId(updatedProductData.uniqueId);
         if (existingProductByBarcode && existingProductByBarcode.id !== editingProduct.id) {
           throw new Error(`Barcode ID ${updatedProductData.uniqueId} already exists for another godown product.`);
        }
      }
      return dataStore.updateGodownProduct(editingProduct.id, updatedProductData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      toast({ title: 'Godown Product Updated', description: 'Details updated successfully.', className: 'bg-primary text-primary-foreground'});
      setIsProductDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error Updating Godown Product', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGodownProductMutation = useMutation({
    mutationFn: (productId: string) => dataStore.deleteGodownProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      toast({ title: 'Godown Product Deleted', className: 'bg-destructive text-destructive-foreground' });
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error Deleting Godown Product', description: error.message, variant: 'destructive' });
    },
  });

  const moveStockMutation = useMutation({
    mutationFn: async (data: { godownProductId: string, quantityToMove: number }) => {
        return dataStore.moveGodownStockToInventory(data.godownProductId, data.quantityToMove);
    },
    onSuccess: (result) => {
        if (result.success) {
            queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
            queryClient.invalidateQueries({ queryKey: ['products'] }); // Main inventory
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
            queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
            toast({ title: 'Stock Moved', description: result.message, className: 'bg-primary text-primary-foreground' });
            setIsMoveToInventoryDialogOpen(false);
        } else {
            toast({ title: 'Move Failed', description: result.message, variant: 'destructive' });
        }
    },
    onError: (error: Error) => {
        toast({ title: 'Error Moving Stock', description: error.message, variant: 'destructive' });
    }
  });


  const onProductSubmit: SubmitHandler<GodownProductFormData> = async (data) => {
    if (editingProduct) {
      await updateGodownProductMutation.mutateAsync(data);
    } else {
      await addGodownProductMutation.mutateAsync(data);
    }
  };
  
  const openAddProductDialog = () => {
    setEditingProduct(null);
    productForm.reset({ name: '', price: 0, quantity: 0, uniqueId: generateGodownUniqueId() });
    setIsProductDialogOpen(true);
  };

  const openEditProductDialog = (product: GodownProduct) => {
    setEditingProduct(product);
    productForm.setValue('price', product.price); // Ensure price is set when editing
    setIsProductDialogOpen(true);
  };

  const openDeleteConfirmDialog = (product: GodownProduct) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  const openViewBarcodeDialog = (product: GodownProduct) => {
    setSelectedProductForBarcode(product);
    setIsBarcodeDialogOpen(true);
  };

  const openMoveToInventoryDialog = async (product: GodownProduct) => {
    setProductToMove(product);
    moveForm.reset({ quantityToMove: 1 });
    setIsMoveToInventoryDialogOpen(true);
  };
  
  const onMoveToInventorySubmit: SubmitHandler<MoveToInventoryFormData> = async (data) => {
    if (!productToMove) return;
    await moveStockMutation.mutateAsync({
        godownProductId: productToMove.id,
        quantityToMove: data.quantityToMove,
    });
  };


  const filteredGodownProducts = useMemo(() => {
    if (!searchTerm) return godownProducts;
    return godownProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.uniqueId && product.uniqueId.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [godownProducts, searchTerm]);
  
  const handleExportGodownStock = () => {
    if (filteredGodownProducts.length === 0) {
      toast({ title: 'No Data', description: 'There are no godown products to export.', variant: 'destructive' });
      return;
    }
    const dataToExport = filteredGodownProducts.map(p => ({
      'Godown Product ID (Firestore)': p.id,
      'Name': p.name,
      'Price (₹)': p.price.toFixed(2),
      'Quantity': p.quantity,
      'Barcode ID': p.uniqueId,
      'Created At': p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A',
      'Updated At': p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'N/A',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GodownStock');
    XLSX.writeFile(workbook, 'godown_stock_export.xlsx');
    toast({ title: 'Export Successful', description: 'Godown stock data has been exported to Excel.' });
  };


  if (productsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-destructive">
        <Warehouse className="w-16 h-16 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Godown Stock</h2>
        <p className="text-center mb-1">Could not fetch godown product data.</p>
        <p className="text-center text-xs mb-4">Details: {productsError.message}</p>
        <Button onClick={() => refetchGodownProducts()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const handleRegenerateUniqueId = () => {
      productForm.setValue('uniqueId', generateGodownUniqueId(), { shouldValidate: true });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center">
          <Warehouse className="mr-2 md:mr-3 h-7 w-7 md:h-8 md:w-8" />
          Godown Stock Management
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search godown products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-56 md:w-64"
            />
          </div>
          <Button onClick={handleExportGodownStock} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-5 w-5" /> Export
          </Button>
          <Button onClick={openAddProductDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Product to Godown
          </Button>
        </div>
      </div>

      <Card className="shadow-lg flex-grow flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Godown Product List</CardTitle>
          <CardDescription>Manage products stored in your godown. Prices here are for reference and used when moving new items to inventory.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-0 md:p-6 overflow-hidden">
          {productsLoading ? (
            <GodownStockSkeleton />
          ) : filteredGodownProducts.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground h-full flex flex-col justify-center items-center">
                <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-3" />
                <p className="text-base md:text-lg font-medium">No godown products found.</p>
                {searchTerm ? 
                    <p className="text-sm md:text-base">Try adjusting your search term.</p> : 
                    <p className="text-sm md:text-base">Add products to your godown to get started.</p>
                }
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[80px]">Price (₹)</TableHead>
                    <TableHead className="min-w-[80px]">Quantity</TableHead>
                    <TableHead className="min-w-[180px]">Barcode ID</TableHead>
                    <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGodownProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>₹{product.price.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">{product.quantity}</TableCell>
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
                               <DropdownMenuItem onClick={() => openMoveToInventoryDialog(product)}>
                                <Move className="mr-2 h-4 w-4" /> Move to Inventory
                              </DropdownMenuItem>
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
                            <Button variant="outline" size="sm" onClick={() => openMoveToInventoryDialog(product)} className="mr-1 text-primary border-primary hover:bg-primary/10">
                              <Move className="mr-1 h-4 w-4" /> Move to Inventory
                            </Button>
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
        {filteredGodownProducts.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground pt-4 border-t">
                Showing {filteredGodownProducts.length} of {godownProducts.length} godown products.
            </CardFooter>
        )}
      </Card>

      {/* Add/Edit Godown Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={ (isOpen) => {
        setIsProductDialogOpen(isOpen);
        if (!isOpen) {
          setEditingProduct(null); 
          productForm.reset({ name: '', price: 0, quantity: 0, uniqueId: generateGodownUniqueId() }); 
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Godown Product' : 'Add New Godown Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4 py-2">
            <div>
              <label htmlFor="name" className={cn("block text-sm font-medium mb-1", productForm.formState.errors.name && "text-destructive")}>Product Name</label>
              <Input id="name" {...productForm.register('name')} className={cn(productForm.formState.errors.name && "border-destructive")} />
              {productForm.formState.errors.name && <p className="text-xs text-destructive mt-1">{productForm.formState.errors.name.message}</p>}
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className={cn("block text-sm font-medium mb-1", productForm.formState.errors.price && "text-destructive")}>Price (₹)</label>
                <Input id="price" type="number" step="0.01" {...productForm.register('price')} className={cn(productForm.formState.errors.price && "border-destructive")} />
                {productForm.formState.errors.price && <p className="text-xs text-destructive mt-1">{productForm.formState.errors.price.message}</p>}
              </div>
              <div>
                <label htmlFor="quantity" className={cn("block text-sm font-medium mb-1", productForm.formState.errors.quantity && "text-destructive")}>Quantity</label>
                <Input id="quantity" type="number" step="1" {...productForm.register('quantity')} className={cn(productForm.formState.errors.quantity && "border-destructive")} />
                {productForm.formState.errors.quantity && <p className="text-xs text-destructive mt-1">{productForm.formState.errors.quantity.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="uniqueId" className={cn("block text-sm font-medium mb-1", productForm.formState.errors.uniqueId && "text-destructive")}>
                Barcode ID
              </label>
              <div className="flex items-center gap-2">
                <Input 
                  id="uniqueId" 
                  {...productForm.register('uniqueId')} 
                  className={cn(productForm.formState.errors.uniqueId && "border-destructive", "flex-grow")}
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
              {productForm.formState.errors.uniqueId && <p className="text-xs text-destructive mt-1">{productForm.formState.errors.uniqueId.message}</p>}
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
              <Button type="submit" disabled={productForm.formState.isSubmitting || addGodownProductMutation.isPending || updateGodownProductMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {productForm.formState.isSubmitting || addGodownProductMutation.isPending || updateGodownProductMutation.isPending ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Add Product')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move to Inventory Dialog */}
      <Dialog open={isMoveToInventoryDialogOpen} onOpenChange={(isOpen) => {
          setIsMoveToInventoryDialogOpen(isOpen);
          if (!isOpen) setProductToMove(null);
      }}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Move to Inventory</DialogTitle>
                  <DialogDescription>
                      Move <span className="font-semibold">{productToMove?.name}</span> (ID: {productToMove?.uniqueId}) from godown to main inventory.
                      Godown Quantity: {productToMove?.quantity}. Godown Price: ₹{productToMove?.price.toFixed(2)}.
                  </DialogDescription>
              </DialogHeader>
              <form onSubmit={moveForm.handleSubmit(onMoveToInventorySubmit)} className="space-y-4 py-2">
                  <div>
                      <label htmlFor="quantityToMove" className={cn("block text-sm font-medium mb-1", moveForm.formState.errors.quantityToMove && "text-destructive")}>
                          Quantity to Move
                      </label>
                      <Input 
                        id="quantityToMove" 
                        type="number" 
                        min="1"
                        max={productToMove?.quantity}
                        {...moveForm.register('quantityToMove')}
                        className={cn(moveForm.formState.errors.quantityToMove && "border-destructive")}
                      />
                      {moveForm.formState.errors.quantityToMove && <p className="text-xs text-destructive mt-1">{moveForm.formState.errors.quantityToMove.message}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                      If this product is new to the main inventory, its selling price will be set to ₹{productToMove?.price.toFixed(2)}. 
                      If it already exists in inventory, its current selling price there will be maintained.
                  </p>
                  <DialogFooter className="pt-4">
                      <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={moveStockMutation.isPending} className="bg-primary hover:bg-primary/90">
                          {moveStockMutation.isPending ? 'Moving...' : 'Confirm Move'}
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
              This action cannot be undone. This will permanently delete the godown product: 
              <span className="font-semibold"> {productToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => productToDelete && deleteGodownProductMutation.mutate(productToDelete.id)}
              disabled={deleteGodownProductMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteGodownProductMutation.isPending ? 'Deleting...' : 'Delete'}
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


function GodownStockSkeleton() {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow><TableHead className="w-[30%] min-w-[150px]"><Skeleton className="h-5 w-32" /></TableHead><TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead><TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead><TableHead className="min-w-[180px]"><Skeleton className="h-5 w-24" /></TableHead><TableHead className="text-right min-w-[180px]"><Skeleton className="h-5 w-32" /></TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right space-x-1"><Skeleton className="h-8 w-24 inline-block" /><Skeleton className="h-8 w-8 inline-block" /><Skeleton className="h-8 w-8 inline-block" /></TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
       <CardFooter className="text-sm text-muted-foreground pt-4 border-t">
          <Skeleton className="h-4 w-40" />
      </CardFooter>
    </>
  );
}


