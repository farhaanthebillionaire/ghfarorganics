
// @ts-nocheck
'use client';

import type { GodownProduct, Product } from '@/types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Edit3, Trash2, Search, Warehouse, Package, Move, RefreshCw, QrCode, MoreVertical, FileSpreadsheet, DollarSign, FileUp, ChevronLeft, ChevronRight, TrendingUp, Receipt } from 'lucide-react';
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

const ITEMS_PER_PAGE = 50;

const fetchGodownProducts = async (): Promise<GodownProduct[]> => {
  const products = await dataStore.getGodownProducts({ orderBy: 'name', orderDirection: 'asc' });
  return products;
};

// Standardized Unique ID generator using "PROD-" prefix
const generateUniqueId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PROD-${timestampPart}-${randomPart}`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<GodownProduct | null>(null);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
  
  const [productToMove, setProductToMove] = useState<GodownProduct | null>(null);
  const [isMoveToInventoryDialogOpen, setIsMoveToInventoryDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
      uniqueId: generateUniqueId(), 
    }
  });
  
  const currentUniqueId = productForm.watch('uniqueId');
  const currentName = productForm.watch('name');


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
             productForm.setValue('uniqueId', generateUniqueId());
        }
    }
  }, [editingProduct, isProductDialogOpen, productForm]);

  const addGodownProductMutation = useMutation({
    mutationFn: async (newProductData: GodownProductFormData) => {
      let dataToSubmit = { ...newProductData };
      const isAutoGeneratedId = newProductData.uniqueId.startsWith('PROD-');

      if (isAutoGeneratedId && newProductData.name) {
        // Check Inventory for matching name to sync uniqueId and price
        const inventoryMatches = await dataStore.getProducts({ name: newProductData.name });
        if (inventoryMatches.length === 1) {
            const inventoryProduct = inventoryMatches[0];
            // Check if this inventory uniqueId is already in godown with a different name
            const godownCheckWithInventoryId = await dataStore.getGodownProductByUniqueId(inventoryProduct.uniqueId);
            if (!godownCheckWithInventoryId || godownCheckWithInventoryId.name.toLowerCase() === newProductData.name.toLowerCase()) {
                dataToSubmit.uniqueId = inventoryProduct.uniqueId;
                dataToSubmit.price = inventoryProduct.price;
                toast({ title: "Synced with Inventory", description: `Using Barcode ID '${inventoryProduct.uniqueId}' and Price ₹${inventoryProduct.price.toFixed(2)} from Inventory for '${inventoryProduct.name}'.`, duration: 7000});
            } else {
                 toast({ title: "ID Conflict", description: `Barcode ID ${inventoryProduct.uniqueId} (from Inventory item '${inventoryProduct.name}') is already used by Godown item '${godownCheckWithInventoryId.name}'. Using new PROD- ID.`, variant: 'destructive', duration: 8000});
                 dataToSubmit.uniqueId = generateUniqueId(); // Generate new ID if conflict
            }
        }
      }
      
      const existingProductByBarcodeInGodown = await dataStore.getGodownProductByUniqueId(dataToSubmit.uniqueId);
      if (existingProductByBarcodeInGodown) {
         throw new Error(`Barcode ID ${dataToSubmit.uniqueId} already exists in godown for '${existingProductByBarcodeInGodown.name}'. Please use a different ID or update.`);
      }

      const inventoryProductWithSameId = await dataStore.getProductByUniqueId(dataToSubmit.uniqueId);
      if (inventoryProductWithSameId && inventoryProductWithSameId.name.toLowerCase() !== dataToSubmit.name.toLowerCase()) {
          throw new Error(`Error: Barcode ID ${dataToSubmit.uniqueId} is already used by '${inventoryProductWithSameId.name}' in Inventory. Barcodes must be unique per product entity and names should match.`);
      }

      return dataStore.addGodownProduct(dataToSubmit); 
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      queryClient.invalidateQueries({ queryKey: ['godownLowStockProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      toast({ title: 'Godown Product Added', description: 'New product added to godown.', className: 'bg-primary text-primary-foreground'});
      setIsProductDialogOpen(false); 
    },
    onError: (error: Error) => {
      toast({ title: 'Error Adding Godown Product', description: error.message, variant: 'destructive' });
    },
  });

  const updateGodownProductMutation = useMutation({
    mutationFn: async (updatedProductData: GodownProductFormData & { id: string }) => {
      if (!updatedProductData.id) throw new Error('Product ID not found for update.');
      
      if (updatedProductData.uniqueId !== editingProduct?.uniqueId && editingProduct) { 
        const existingProductByBarcode = await dataStore.getGodownProductByUniqueId(updatedProductData.uniqueId);
         if (existingProductByBarcode && existingProductByBarcode.id !== updatedProductData.id) {
           throw new Error(`Barcode ID ${updatedProductData.uniqueId} already exists for another godown product.`);
        }
        const inventoryProductWithSameId = await dataStore.getProductByUniqueId(updatedProductData.uniqueId);
        if (inventoryProductWithSameId && inventoryProductWithSameId.name.toLowerCase() !== updatedProductData.name.toLowerCase()) {
             throw new Error(`Error: Barcode ID ${updatedProductData.uniqueId} is already used by '${inventoryProductWithSameId.name}' in Inventory. Cannot change ID to conflict.`);
        }
      }
      const { id, ...payload } = updatedProductData;
      return dataStore.updateGodownProduct(id, payload); 
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      queryClient.invalidateQueries({ queryKey: ['godownLowStockProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
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
      queryClient.invalidateQueries({ queryKey: ['godownLowStockProducts'] });
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
            queryClient.invalidateQueries({ queryKey: ['godownLowStockProducts'] });
            queryClient.invalidateQueries({ queryKey: ['products'] }); 
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
      await updateGodownProductMutation.mutateAsync({ ...data, id: editingProduct.id });
    } else {
      // Check if product with the same name already exists in Godown
      const existingGodownProductsByName = await dataStore.getGodownProducts({ name: data.name });
      if (existingGodownProductsByName.length === 1) {
          const productToUpdate = existingGodownProductsByName[0];
          const newQuantity = productToUpdate.quantity + data.quantity;
          await updateGodownProductMutation.mutateAsync({
              id: productToUpdate.id,
              name: data.name, // Update name in case of casing changes
              price: data.price, // Update price
              quantity: newQuantity, // Add to existing quantity
              uniqueId: productToUpdate.uniqueId // Keep existing uniqueId
          });
          toast({ title: 'Godown Product Updated', description: `${data.name} quantity increased and price updated.`, className: 'bg-primary text-primary-foreground' });
          setIsProductDialogOpen(false);
      } else if (existingGodownProductsByName.length > 1) {
          toast({ title: 'Error', description: `Multiple products found in Godown with the name "${data.name}". Please use a unique name or update via Barcode ID.`, variant: 'destructive' });
      }
      else { // Product name does not exist in Godown, proceed to add new (with potential sync from Inventory)
        await addGodownProductMutation.mutateAsync(data);
      }
    }
  };
  
  const openAddProductDialog = () => {
    setEditingProduct(null);
    productForm.reset({ name: '', price: 0, quantity: 0, uniqueId: generateUniqueId() });
    setIsProductDialogOpen(true);
  };

  const openEditProductDialog = (product: GodownProduct) => {
    setEditingProduct(product);
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

  useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredGodownProducts.slice(startIndex, endIndex);
  }, [filteredGodownProducts, currentPage]);

  const totalPages = Math.ceil(filteredGodownProducts.length / ITEMS_PER_PAGE);
  
  const totalGodownStockValue = useMemo(() => {
    if (productsLoading || !godownProducts) return 0;
    return godownProducts.reduce((acc, product) => acc + (product.quantity * product.price), 0);
  }, [godownProducts, productsLoading]);

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
      'Total Value (₹)': (p.quantity * p.price).toFixed(2),
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }
    if (event.target) event.target.value = ''; 

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Error reading file data.");
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData.length === 0) {
          toast({ title: "Empty Excel Sheet", description: "No data found in the Excel sheet.", variant: "destructive" });
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const findHeader = (target: string) => headers.find(h => h.toLowerCase() === target.toLowerCase());
        
        const nameHeader = findHeader('name');
        const priceHeader = findHeader('price');
        const quantityHeader = findHeader('quantity');
        let uniqueIdHeader = findHeader('uniqueid') || findHeader('barcodeid') || findHeader('barcode id');

        if (!nameHeader || !priceHeader || !quantityHeader) { 
          toast({
            title: "Invalid Excel Format",
            description: "Missing required columns. Ensure 'Name', 'Price', 'Quantity' are present. 'UniqueID' (or 'BarcodeID') is optional.",
            variant: "destructive",
            duration: 10000,
          });
          return;
        }

        let importedCount = 0, updatedCount = 0, skippedCount = 0, errorCount = 0;
        const errorsList: string[] = [];
        toast({ title: "Importing Godown Products...", description: `Processing ${jsonData.length} rows...` });

        for (const row of jsonData) {
          let uniqueIdFromExcel = String(row[uniqueIdHeader] || '').trim();
          const nameFromExcel = String(row[nameHeader] || '').trim();
          const priceFromExcel = parseFloat(String(row[priceHeader] || 0));
          const quantityFromExcel = parseInt(String(row[quantityHeader] || 0), 10);
          
          let finalUniqueId = uniqueIdFromExcel;
          let finalPrice = priceFromExcel;
          let finalName = nameFromExcel;
          let autoSyncMessage = "";

          if (!finalName) {
            skippedCount++;
            errorsList.push(`Skipped row: Name is missing.`);
            continue;
          }
           if (isNaN(priceFromExcel) || priceFromExcel <= 0) {
            skippedCount++;
            errorsList.push(`Skipped row for "${finalName}": Price is invalid or missing.`);
            continue;
          }
           if (isNaN(quantityFromExcel) || quantityFromExcel < 0) {
            skippedCount++;
            errorsList.push(`Skipped row for "${finalName}": Quantity is invalid or missing.`);
            continue;
          }

          try {
            let existingGodownProductByUID = null;
            if (finalUniqueId) {
                existingGodownProductByUID = await dataStore.getGodownProductByUniqueId(finalUniqueId);
            }

            if (existingGodownProductByUID) { // Match by UniqueID in Godown
                const updates: Partial<GodownProduct> = {
                    name: finalName, // Update name from Excel
                    price: finalPrice, // Update price from Excel
                    quantity: existingGodownProductByUID.quantity + quantityFromExcel,
                };
                await dataStore.updateGodownProduct(existingGodownProductByUID.id, updates);
                updatedCount++;
            } else { // No match by UniqueID in Godown, try matching by Name in Godown
                const godownMatchesByName = await dataStore.getGodownProducts({ name: finalName });
                if (godownMatchesByName.length === 1) {
                    const existingGodownProductByName = godownMatchesByName[0];
                    const updates: Partial<GodownProduct> = {
                        price: finalPrice, // Update price from Excel
                        quantity: existingGodownProductByName.quantity + quantityFromExcel,
                        // Name remains same, uniqueId also remains same
                    };
                    await dataStore.updateGodownProduct(existingGodownProductByName.id, updates);
                    updatedCount++;
                    autoSyncMessage = ` (Updated existing Godown product by name: '${finalName}', ID: ${existingGodownProductByName.uniqueId})`;
                    toast({title: "Info", description: `Updated godown product '${finalName}'` + autoSyncMessage, duration: 5000 });
                } else if (godownMatchesByName.length > 1) {
                    skippedCount++;
                    errorsList.push(`Skipped "${finalName}": Multiple Godown products found with this name. Please provide a UniqueID to update, or ensure names are unique in Godown to update by name.`);
                    continue;
                } else { // Product does not exist in Godown by UniqueID or Name, proceed to add new
                    if (!finalUniqueId) { // If UniqueID was empty, try to sync from Inventory by name
                        const inventoryMatchesByName = await dataStore.getProducts({ name: finalName });
                        if (inventoryMatchesByName.length === 1) {
                            const inventoryProduct = inventoryMatchesByName[0];
                            const godownCheckWithInvId = await dataStore.getGodownProductByUniqueId(inventoryProduct.uniqueId);
                            if (godownCheckWithInvId && godownCheckWithInvId.name.toLowerCase() !== finalName.toLowerCase()) {
                                skippedCount++;
                                errorsList.push(`Skipped "${finalName}": Inventory product with same name has Barcode ID ${inventoryProduct.uniqueId}, which is used by a different product ('${godownCheckWithInvId.name}') in Godown. Using new PROD- ID.`);
                                finalUniqueId = generateUniqueId();
                            } else {
                                finalUniqueId = inventoryProduct.uniqueId;
                                if(priceFromExcel === 0 || isNaN(priceFromExcel)) finalPrice = inventoryProduct.price; 
                                autoSyncMessage = ` (Synced ID ${finalUniqueId} & Price ₹${finalPrice.toFixed(2)} from Inventory based on name match for '${finalName}')`;
                            }
                        } else {
                            finalUniqueId = generateUniqueId(); 
                        }
                    }

                    // Final check: Is the `finalUniqueId` (whether from Excel, synced, or generated) used by a *different named* product in Inventory?
                    const inventoryProductWithSameFinalId = await dataStore.getProductByUniqueId(finalUniqueId);
                    if (inventoryProductWithSameFinalId && inventoryProductWithSameFinalId.name.toLowerCase() !== finalName.toLowerCase()) {
                        skippedCount++;
                        errorsList.push(`Skipped "${finalName}": Resulting Barcode ID ${finalUniqueId} is used by a different product ('${inventoryProductWithSameFinalId.name}') in Inventory. Please resolve conflict or use a different ID.`);
                        continue;
                    }

                    const newGodownProductData: Omit<GodownProduct, 'id' | 'createdAt' | 'updatedAt'> = {
                        name: finalName,
                        price: finalPrice,
                        quantity: quantityFromExcel,
                        uniqueId: finalUniqueId,
                    };
                    await dataStore.addGodownProduct(newGodownProductData);
                    importedCount++;
                    if(autoSyncMessage) toast({title: "Info", description: `Imported godown product '${finalName}'` + autoSyncMessage, duration: 5000 });
                }
            }
          } catch (error: any) {
            errorCount++;
            errorsList.push(`Error processing godown product "${finalName}" (ID: ${finalUniqueId}): ${error.message}`);
          }
        }
        
        let summaryDesc = `Processed: ${jsonData.length}. Imported: ${importedCount}. Updated: ${updatedCount}.`;
        if (skippedCount > 0) summaryDesc += ` Skipped: ${skippedCount}.`;
        if (errorCount > 0) summaryDesc += ` Failed: ${errorCount}.`;
        toast({ title: "Godown Import Complete", description: summaryDesc, duration: 7000 });

        if (errorsList.length > 0) {
          toast({
            title: "Godown Import Details",
            description: (<ScrollArea className="h-24"><ul className="text-xs list-disc pl-4">{errorsList.map((err, i) => <li key={i}>{err}</li>)}</ul></ScrollArea>),
            variant: "destructive",
            duration: 15000
          });
          console.error("Godown Import errors/skipped rows:", errorsList);
        }
        
        if (importedCount > 0 || updatedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
          queryClient.invalidateQueries({ queryKey: ['godownLowStockProducts'] });
          queryClient.invalidateQueries({ queryKey: ['products'] }); 
        }

      } catch (error: any) {
        toast({ title: "Godown Import Failed", description: `Error processing file: ${error.message}`, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };


  if (productsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
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
      productForm.setValue('uniqueId', generateUniqueId(), { shouldValidate: true });
  };

  const handleNameBlur = async () => {
    if (!editingProduct && currentName && productForm.watch('uniqueId').startsWith('PROD-')) { 
      try {
        // Check if name already exists in GODOWN
        const godownMatches = await dataStore.getGodownProducts({ name: currentName });
        if (godownMatches.length === 1) {
            const existingGodownProduct = godownMatches[0];
            productForm.setValue('uniqueId', existingGodownProduct.uniqueId, { shouldValidate: true });
            productForm.setValue('price', existingGodownProduct.price, { shouldValidate: true });
            productForm.setValue('quantity', 0); // Default to 0 for adding, user can specify
            toast({
              title: "Product Exists in Godown",
              description: `"${currentName}" found. Barcode ID and Price pre-filled. Enter quantity to add or update details.`,
              duration: 6000,
            });
            productForm.trigger(['uniqueId', 'price', 'quantity']);
            return; 
        }

        // If not in GODOWN, then check INVENTORY
        const inventoryMatches = await dataStore.getProducts({ name: currentName });
        if (inventoryMatches.length === 1) {
          const inventoryProduct = inventoryMatches[0];
          // Ensure this inventory product's uniqueId isn't already in godown with a *different* name
          const godownCheckWithInventoryId = await dataStore.getGodownProductByUniqueId(inventoryProduct.uniqueId);
          if (!godownCheckWithInventoryId || godownCheckWithInventoryId.name.toLowerCase() === currentName.toLowerCase()) {
            productForm.setValue('uniqueId', inventoryProduct.uniqueId, { shouldValidate: true });
            productForm.setValue('price', inventoryProduct.price, { shouldValidate: true });
            toast({
              title: "Auto-filled from Inventory",
              description: `Barcode ID and Price for "${currentName}" have been pre-filled from Inventory stock.`,
              duration: 6000,
            });
            productForm.trigger(['uniqueId', 'price']);
          }
        }
      } catch (error) {
        console.error("Error checking inventory/godown for product:", error);
      }
    }
  };


  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6 p-4 md:p-6">
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
           <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileImport} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          <Button onClick={handleImportClick} variant="outline" className="w-full sm:w-auto">
            <FileUp className="mr-2 h-5 w-5" /> Import Excel
          </Button>
          <Button onClick={handleExportGodownStock} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-5 w-5" /> Export Excel
          </Button>
          <Button onClick={openAddProductDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Product to Godown
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Total Godown Stock Value</CardTitle>
          <Receipt className="h-6 w-6 text-green-500" />
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-3xl font-bold text-primary">
              ₹{totalGodownStockValue.toFixed(2)}
            </div>
          )}
           <CardDescription className="text-xs text-muted-foreground mt-1">
            Estimated total value of all products currently in godown.
          </CardDescription>
        </CardContent>
      </Card>

      <Card className="shadow-lg flex-grow flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Godown Product List</CardTitle>
          <CardDescription>
            Manage godown products. Import from Excel: Name, Price, Quantity. UniqueID (optional); if name matches existing Godown item, qty added, price updated. If UniqueID empty & name matches Inventory, Inventory ID/Price used.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-0 md:p-0 overflow-hidden">
          {productsLoading ? (
            <GodownStockSkeleton />
          ) : paginatedProducts.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground h-full flex flex-col justify-center items-center">
                <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-3" />
                <p className="text-base md:text-lg font-medium">No godown products found.</p>
                {searchTerm ? 
                    <p className="text-sm md:text-base">Try adjusting your search term.</p> : 
                    <p className="text-sm md:text-base">Add products to your godown to get started or import from Excel.</p>
                }
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%] min-w-[60px]">S.No.</TableHead>
                    <TableHead className="w-[20%] min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[80px]">Price (₹)</TableHead>
                    <TableHead className="min-w-[80px]">Quantity</TableHead>
                    <TableHead className="min-w-[100px]">Total Value (₹)</TableHead>
                    <TableHead className="min-w-[180px]">Barcode ID</TableHead>
                    <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>₹{product.price.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">{product.quantity}</TableCell>
                      <TableCell className="font-semibold">₹{(product.quantity * product.price).toFixed(2)}</TableCell>
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
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground pt-4 border-t">
          <div>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1 > filteredGodownProducts.length && filteredGodownProducts.length > 0 ? filteredGodownProducts.length : Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredGodownProducts.length)}
            &nbsp;to {Math.min(currentPage * ITEMS_PER_PAGE, filteredGodownProducts.length)} of {filteredGodownProducts.length} godown products.
          </div>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2 mt-2 sm:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      <Dialog open={isProductDialogOpen} onOpenChange={ (isOpen) => {
        setIsProductDialogOpen(isOpen);
        if (!isOpen) {
          setEditingProduct(null); 
          productForm.reset({ name: '', price: 0, quantity: 0, uniqueId: generateUniqueId() }); 
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Godown Product' : 'Add New Godown Product'}</DialogTitle>
             <DialogDescription>
              {editingProduct ? `Update details for ${editingProduct.name}.` : 'Enter details. If name matches existing Godown item, quantity added & price updated. If name matches Inventory item & Barcode ID is auto, Inventory ID/Price may be used.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4 py-2">
            <div>
              <label htmlFor="name" className={cn("block text-sm font-medium mb-1", productForm.formState.errors.name && "text-destructive")}>Product Name</label>
              <Input 
                id="name" 
                {...productForm.register('name')} 
                onBlur={handleNameBlur}
                className={cn(productForm.formState.errors.name && "border-destructive")} 
              />
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
                  readOnly={!!editingProduct || (productForm.watch('uniqueId') && !productForm.watch('uniqueId').startsWith('PROD-'))} 
                />
                <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={handleRegenerateUniqueId} 
                    title={editingProduct || (productForm.watch('uniqueId') && !productForm.watch('uniqueId').startsWith('PROD-')) ? "ID fixed for existing/synced product" : "Regenerate PROD- ID"}
                    disabled={!!editingProduct || (productForm.watch('uniqueId') && !productForm.watch('uniqueId').startsWith('PROD-'))}
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
                      The inventory product's price (if it exists or is newly created) will be set to ₹{productToMove?.price.toFixed(2)} to match the godown price.
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

      <Dialog open={isBarcodeDialogOpen} onOpenChange={(isOpen) => {
        setIsBarcodeDialogOpen(isOpen);
        if (!isOpen) setSelectedProductForBarcode(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Barcode for {selectedProductForBarcode?.name}</DialogTitle>
             <DialogDescription>
                Use this barcode for scanning purposes. You can download or print it.
             </DialogDescription>
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
          <TableRow>
            <TableHead className="w-[5%] min-w-[60px]"><Skeleton className="h-5 w-10" /></TableHead>
            <TableHead className="w-[20%] min-w-[150px]"><Skeleton className="h-5 w-32" /></TableHead>
            <TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead>
            <TableHead className="min-w-[80px]"><Skeleton className="h-5 w-16" /></TableHead>
            <TableHead className="min-w-[100px]"><Skeleton className="h-5 w-20" /></TableHead> 
            <TableHead className="min-w-[180px]"><Skeleton className="h-5 w-24" /></TableHead>
            <TableHead className="text-right min-w-[180px]"><Skeleton className="h-5 w-32" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell> 
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell className="text-right space-x-1">
                <Skeleton className="h-8 w-24 inline-block" />
                <Skeleton className="h-8 w-8 inline-block" />
                <Skeleton className="h-8 w-8 inline-block" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
       <CardFooter className="flex justify-between items-center text-sm text-muted-foreground pt-4 border-t">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
      </CardFooter>
    </>
  );
}

