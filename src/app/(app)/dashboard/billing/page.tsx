
// @ts-nocheck
'use client';

import type { Product, OrderItem, Order, PaymentMethod } from '@/types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ScanLine, PlusCircle, Trash2, Printer, CheckCircle, ShoppingCart, Loader2, Banknote, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SHOP_NAME, CONTACT_NUMBERS, SHOP_ADDRESS, SHOP_GSTIN, SHOP_STATE } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { BarcodeDisplay } from '@/components/inventory/BarcodeDisplay';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import * as dataStore from '@/lib/data-store';

const fetchProductsForBilling = async (searchTerm: string = ''): Promise<Product[]> => {
  let filters: any = { orderBy: 'name', orderDirection: 'asc' };
  if (searchTerm) {
    filters.name = searchTerm;
    // No limit when searching, so dataStore.getProducts fetches all matching products
  } else {
    filters.limit = 10; // Keep limit for initial/empty search to show some products
  }
  const products = await dataStore.getProducts(filters);
  return products;
};

const fetchProductByBarcode = async (barcode: string): Promise<Product | null> => {
  const product = await dataStore.getProductByUniqueId(barcode);
  return product || null;
};

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const printRef = useRef<HTMLDivElement>(null); 
  const billWrapperRef = useRef<HTMLDivElement>(null); 

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<Product[]>({
    queryKey: ['billingProducts', searchTerm],
    queryFn: () => fetchProductsForBilling(searchTerm),
    enabled: searchTerm.length > 0 && showSearchResults,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleDirectPrint = useCallback(() => {
    if (printRef.current && latestOrder && billWrapperRef.current) {
      const wrapper = billWrapperRef.current;
      const bodyEl = document.body;

      bodyEl.classList.add('body-is-printing');
      wrapper.classList.add('print-bill-wrapper-active');
      wrapper.classList.remove('hidden');
      
      const printTimeout = setTimeout(() => {
        window.print();
        
        wrapper.classList.remove('print-bill-wrapper-active');
        wrapper.classList.add('hidden');
        bodyEl.classList.remove('body-is-printing');

        toast({ title: "Printed", description: `Bill for order ${latestOrder.orderNumber} has been processed for printing.` });
        setLatestOrder(null); 
      }, 250); 
    }
  }, [toast, latestOrder, setLatestOrder]);


  const addProductToOrder = useCallback(async (product: Product, quantity: number = 1) => {
    const freshProduct = await dataStore.getProductById(product.id);
    if (!freshProduct) {
        toast({ title: 'Product Not Found', description: `${product.name} could not be fetched.`, variant: 'destructive' });
        return;
    }

    if (freshProduct.quantity < quantity) {
      toast({ title: 'Out of Stock', description: `Not enough ${freshProduct.name} in stock. Available: ${freshProduct.quantity}`, variant: 'destructive' });
      return;
    }

    setCurrentOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === freshProduct.id);
      if (existingItem) {
        if (freshProduct.quantity < existingItem.quantity + quantity) {
          toast({ title: 'Stock Limit', description: `Cannot add more ${freshProduct.name}. Available: ${freshProduct.quantity}`, variant: 'destructive' });
          return prevItems;
        }
        return prevItems.map(item =>
          item.productId === freshProduct.id
            ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * item.price }
            : item
        );
      } else {
        return [...prevItems, { productId: freshProduct.id, name: freshProduct.name, price: freshProduct.price, quantity, subtotal: freshProduct.price * quantity, stockQuantityBeforeOrder: freshProduct.quantity }];
      }
    });
    setSearchTerm('');
    setShowSearchResults(false);
  }, [toast]);


  useEffect(() => {
    const scannedBarcode = searchParams.get('scannedBarcode');
    if (scannedBarcode) {
      const processScannedBarcode = async () => {
        const product = await fetchProductByBarcode(scannedBarcode.trim());
        if (product) {
          addProductToOrder(product, 1);
          toast({ title: "Product Added", description: `${product.name} added via scanner.` });
        } else {
          toast({ title: "Not Found", description: `Product with barcode ${scannedBarcode} not found.`, variant: "destructive" });
        }
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete('scannedBarcode');
        router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
      };
      processScannedBarcode();
    }
  }, [searchParams, addProductToOrder, toast, router, pathname]);


  const handleManualBarcodeScan = async () => {
    if (!barcodeSearchTerm.trim()) return;
    const product = await fetchProductByBarcode(barcodeSearchTerm.trim());
    if (product) {
      addProductToOrder(product);
      setBarcodeSearchTerm(''); 
      toast({ title: "Product Added", description: `${product.name} added to bill via manual barcode entry.` });
    } else {
      toast({ title: "Not Found", description: `Product with barcode ${barcodeSearchTerm} not found.`, variant: "destructive" });
    }
    barcodeInputRef.current?.focus();
  };

  const updateOrderItemQuantity = async (productId: string, newQuantity: number) => {
    const productInStore = await dataStore.getProductById(productId);
    if (!productInStore) {
        toast({ title: 'Product Error', description: 'Could not verify stock for item.', variant: 'destructive'});
        return;
    }

    if (newQuantity > productInStore.quantity) {
        toast({ title: 'Stock Limit', description: `Cannot set quantity for ${productInStore.name} to ${newQuantity}. Available: ${productInStore.quantity}`, variant: 'destructive' });
        return; 
    }

    setCurrentOrderItems(prevItems =>
      prevItems.map(item => {
        if (item.productId === productId) {
          if (newQuantity <=0) return null; 
          return { ...item, quantity: newQuantity, subtotal: newQuantity * item.price };
        }
        return item;
      }).filter(item => item !== null) as OrderItem[] 
    );
  };

  const removeOrderItem = (productId: string) => {
    setCurrentOrderItems(prevItems => prevItems.filter(item => item.productId !== productId));
  };

  const totalAmount = currentOrderItems.reduce((sum, item) => sum + item.subtotal, 0);

  const finalizeOrderMutation = useMutation({
    mutationFn: async () => {
      if (currentOrderItems.length === 0) {
        toast({ title: 'Empty Bill', description: 'Add items to the bill before finalizing.', variant: 'destructive' });
        throw new Error("Empty bill");
      }
      if (!paymentMethod) {
        toast({ title: 'Payment Method Required', description: 'Please select a payment method.', variant: 'destructive'});
        throw new Error("Payment method required");
      }

      const orderNumber = await dataStore.generateNextOrderNumber('standard');
      const newOrderData: Omit<Order, 'id'> = { 
        orderNumber,
        items: currentOrderItems,
        totalAmount,
        createdAt: new Date(),
        type: 'standard', 
        paymentMethod: paymentMethod,
      };
      
      for (const item of currentOrderItems) {
        const product = await dataStore.getProductById(item.productId); 
        if (!product) {
          toast({
            title: 'Product Not Found During Finalization',
            description: `Product ${item.name} (ID: ${item.productId}) could not be found. Order cannot be finalized.`,
            variant: 'destructive'
          });
          throw new Error(`Product ${item.name} not found during finalization.`);
        }
        if (product.quantity < item.quantity) {
          toast({
            title: 'Insufficient Stock During Finalization',
            description: `Not enough ${item.name} in stock. Available: ${product.quantity}, Ordered: ${item.quantity}. Order cannot be finalized.`,
            variant: 'destructive'
          });
          throw new Error(`Insufficient stock for ${item.name} during finalization. Available: ${product.quantity}, Ordered: ${item.quantity}`);
        }
        await dataStore.updateProduct(item.productId, { quantity: product.quantity - item.quantity });
      }
      
      const createdOrder = await dataStore.addOrder(newOrderData); 
      return createdOrder; 
    },
    onSuccess: (createdOrder) => {
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      queryClient.invalidateQueries({ queryKey: ['billingProducts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] }); 
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
      queryClient.invalidateQueries({ queryKey: ['orders']});
      queryClient.invalidateQueries({ queryKey: ['standardOrders']});
      toast({ title: 'Order Placed!', description: `Order ${createdOrder.orderNumber} finalized. Total: ₹${createdOrder.totalAmount.toFixed(2)}`, className: "bg-primary text-primary-foreground" });
      setCurrentOrderItems([]);
      setPaymentMethod('cash'); // Reset payment method
      setLatestOrder(createdOrder); 
    },
    onError: (error: Error) => {
      const title = 'Order Failed';
      let description = `Error finalizing order: ${error.message}`;

      const isIndexError = error.message.toLowerCase().includes('query requires an index') || error.message.toLowerCase().includes('index required');

      if (isIndexError) {
        const fullLinkRegex = /https:\/\/console\.firebase\.google\.com\/project\/[^/]+\/database\/firestore\/indexes\?create_composite=[^)\s]+/;
        let createIndexLink = error.message.match(fullLinkRegex)?.[0] || null;

        if (!createIndexLink) {
          const compositeParamRegex = /create_composite=([^)\s]+)/;
          const compositeParamMatch = error.message.match(compositeParamRegex);
          if (compositeParamMatch && compositeParamMatch[1]) {
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            if (projectId) {
              createIndexLink = `https://console.firebase.google.com/project/${projectId}/database/firestore/indexes?create_composite=${compositeParamMatch[1]}`;
            }
          }
        }
        
        description = "A database operation failed because a required Firestore index is missing. ";
        if (createIndexLink) {
          description += `Please use this link to create it: ${createIndexLink}. `;
        } else {
          description += "Please go to your Firebase console (Firestore > Indexes section). ";
          description += "You most likely need to create a composite index for the 'orders' collection with the following fields: 1. 'type' (Ascending) and 2. 'createdAt' (Descending). ";
          description += "For detailed instructions, review the full error message from Firebase in your browser's developer console.";
        }
        description += " It may take a few minutes for the index to become active after creation.";
        toast({ title, description, variant: 'destructive', duration: 20000 });
      } else if (error.message.includes('Insufficient stock') || error.message.includes('not found during finalization') || error.message.includes('Empty bill') || error.message.includes('Payment method required')) {
         toast({ title, description: error.message, variant: 'destructive' });
      } else {
        toast({ title, description, variant: 'destructive' });
      }
    },
  });

  useEffect(() => {
    if(latestOrder && printRef.current) { 
        handleDirectPrint();
    }
  }, [latestOrder, handleDirectPrint]);


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary">Create New Bill</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Search Products</CardTitle>
            </CardHeader>
            <CardContent ref={searchInputRef}>
              <Input
                type="text"
                placeholder="Enter product name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSearchResults(true); }}
                onFocus={() => searchTerm && setShowSearchResults(true)}
                className="mb-2"
              />
              {showSearchResults && searchLoading && searchTerm.length > 0 && (
                 <div className="p-2 text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...</div>
              )}
              {showSearchResults && !searchLoading && searchResults.length > 0 && (
                <ScrollArea className="h-[200px] border rounded-md">
                  {searchResults.map(product => (
                    <div
                      key={product.id}
                      className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
                      onClick={() => addProductToOrder(product)}
                    >
                      <span>{product.name} (₹{product.price.toFixed(2)})</span>
                      <span className={cn("text-xs", product.quantity < 10 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                        Stock: {product.quantity}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              )}
               {showSearchResults && !searchLoading && searchTerm && searchResults.length === 0 && (
                 <p className="text-sm text-muted-foreground p-2">No products found matching "{searchTerm}".</p>
               )}
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan Barcode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-2">
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Manually enter barcode ID"
                  value={barcodeSearchTerm}
                  onChange={(e) => setBarcodeSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeScan()}
                />
                <Button onClick={handleManualBarcodeScan} variant="outline" className="shrink-0">Add</Button>
              </div>
               <p className="text-xs text-muted-foreground mt-2">
                Connect a USB barcode scanner to your device. Click the input field above, then scan a product barcode.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Current Bill</CardTitle>
            </CardHeader>
            <CardContent>
              {currentOrderItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2" />
                  <p>No items in the bill. Add products by searching or scanning.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrderItems.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>₹{item.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                                const newQuantity = parseInt(e.target.value);
                                if (!isNaN(newQuantity)) {
                                     updateOrderItemQuantity(item.productId, newQuantity);
                                }
                            }}
                            className="w-20 h-8"
                          />
                        </TableCell>
                        <TableCell>₹{item.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.productId)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {currentOrderItems.length > 0 && (
              <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t pt-4 gap-4">
                <div className="w-full sm:w-auto">
                  <Label className="text-sm font-medium mb-2 block">Payment Method</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}
                    className="flex flex-row space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer"><Banknote className="h-4 w-4"/> Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="online" id="online" />
                      <Label htmlFor="online" className="flex items-center gap-1 cursor-pointer"><CreditCard className="h-4 w-4"/> Online</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:items-end gap-2">
                  <div className="text-xl font-bold text-primary self-center sm:self-end">
                    Total: ₹{totalAmount.toFixed(2)}
                  </div>
                  <Button 
                      onClick={() => finalizeOrderMutation.mutate()} 
                      disabled={finalizeOrderMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                      size="lg"
                  >
                    {finalizeOrderMutation.isPending ? (
                      <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...
                      </>
                    ) : (
                      <>
                          <CheckCircle className="mr-2 h-5 w-5" /> Finalize & Print Bill
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {latestOrder && (
          <div ref={billWrapperRef} className="hidden"> 
            <PrintableBill ref={printRef} order={latestOrder} />
          </div>
      )}
    </div>
  );
}

interface PrintableBillProps {
  order: Order;
}

const PrintableBill = React.forwardRef<HTMLDivElement, PrintableBillProps>(({ order }, ref) => {
  if (!order) return null;

  return (
    <div ref={ref} className="printable-bill-actual-content p-0 m-0 font-sans text-sm bg-white text-black">
      <style type="text/css">
        {`
          @media print {
            body.body-is-printing {
              background-color: white !important; /* Ensure body bg is white */
            }

            /* Hide specific known parts of the app shell */
            body.body-is-printing header, 
            body.body-is-printing aside, 
            body.body-is-printing div[data-sidebar="sidebar"], 
            body.body-is-printing .ToastViewport {
              display: none !important;
              visibility: hidden !important;
            }
            
            .print-bill-wrapper-active {
              display: block !important;
              visibility: visible !important;
              position: fixed !important; /* Fixed positioning for print overlay */
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important; /* Full viewport */
              height: 100vh !important; /* Full viewport */
              background-color: white !important;
              z-index: 999999 !important; /* Very high z-index */
              padding: 0 !important;
              margin: 0 !important;
              overflow: auto !important; /* Allow scroll for long bills */
            }

            .print-bill-wrapper-active > .printable-bill-actual-content {
              display: block !important;
              visibility: visible !important;
              margin: 15mm !important; /* Standard A4 margins */
              padding: 0 !important;
              background-color: white !important; /* Ensure content background is white */
              color: black !important; /* Ensure text is black */
              width: auto !important; /* Content flows naturally within margins */
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* Ensure all children within .printable-bill-actual-content are visible */
            .print-bill-wrapper-active > .printable-bill-actual-content * {
                visibility: visible !important;
            }

            /* Reset styles for elements inside the bill that might be hidden by generic rules */
            .print-bill-wrapper-active .print-container,
            .print-bill-wrapper-active .print-container * {
                color: black !important;
                background-color: transparent !important;
                visibility: visible !important;
            }
            
            @page { 
              size: A4; 
              margin: 0; /* Page margins are handled by .printable-bill-actual-content's margin */
            }

            .print-bill-wrapper-active .print-container { width: 100%; margin: 0 auto; }
            .print-bill-wrapper-active .header { text-align: center; margin-bottom: 15px; }
            .print-bill-wrapper-active .shop-name { font-size: 1.8em; font-weight: bold; color: #1a1a1a !important; margin-bottom: 3px; }
            .print-bill-wrapper-active .address-info { font-size: 0.9em; color: #404040 !important; margin-bottom: 3px; line-height: 1.3; }
            .print-bill-wrapper-active .contact-info { font-size: 0.9em; color: #404040 !important; margin-bottom: 3px; }
            .print-bill-wrapper-active .gstin-info { font-size: 0.9em; font-weight: bold; color: #303030 !important; margin-bottom: 10px; }
            .print-bill-wrapper-active .order-details { margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px dashed #ccc !important; }
            .print-bill-wrapper-active .order-details p { margin: 3px 0; font-size: 0.95em; }
            .print-bill-wrapper-active .order-details strong { color: #1a1a1a !important; }
            .print-bill-wrapper-active .payment-method-info { margin-top: 5px; font-size: 0.9em; font-style: italic; color: #303030 !important; }
            .print-bill-wrapper-active .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .print-bill-wrapper-active .items-table th, .print-bill-wrapper-active .items-table td { border: 1px solid #ddd !important; padding: 7px; text-align: left; font-size: 0.9em; }
            .print-bill-wrapper-active .items-table th { background-color: #eaeaea !important; font-weight: bold; color: #1a1a1a !important; }
            .print-bill-wrapper-active .items-table .text-right { text-align: right; }
            .print-bill-wrapper-active .total-section { text-align: right; margin-top: 15px; }
            .print-bill-wrapper-active .total-section p { margin: 5px 0; font-size: 1.1em; font-weight: bold; }
            .print-bill-wrapper-active .total-section .grand-total { font-size: 1.3em; color: #1a1a1a !important; }
            .print-bill-wrapper-active .footer { text-align: center; margin-top: 25px; padding-top: 12px; border-top: 1px solid #eee !important; font-size: 0.85em; color: #505050 !important; }
            .print-bill-wrapper-active .barcode-section { text-align: center; margin-top: 15px; }
            
            /* Ensure all elements are exactly colored for printing */
            body.body-is-printing * { /* Apply this to all elements when printing */
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>
      <div className="print-container">
        <div className="header">
          <div className="shop-name">{SHOP_NAME}</div>
          <div className="address-info">{SHOP_ADDRESS}</div>
          <div className="address-info">{SHOP_STATE}</div>
          <div className="contact-info">Contact: {CONTACT_NUMBERS.join(' / ')}</div>
          {SHOP_GSTIN && <div className="gstin-info">GSTIN: {SHOP_GSTIN}</div>}
        </div>

        <div className="order-details">
          <p><strong>Order Number:</strong> {order.orderNumber}</p>
          <p><strong>Date:</strong> {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm:ss')}</p>
           {order.paymentMethod && <p className="payment-method-info"><strong>Payment Method:</strong> {order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)}</p>}
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th className="text-right">Price</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.productId}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td className="text-right">₹{item.price.toFixed(2)}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">₹{item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total-section">
          <p className="grand-total">Total Amount: ₹{order.totalAmount.toFixed(2)}</p>
        </div>
        
        <div className="barcode-section">
            <p className="text-xs mb-1">Order ID:</p>
            <BarcodeDisplay value={order.orderNumber} />
        </div>

        <div className="footer">
          <p>Thank you for your purchase!</p>
          <p>Visit us again at {SHOP_NAME.split(',')[0]}.</p>
        </div>
      </div>
    </div>
  );
});
PrintableBill.displayName = 'PrintableBill';





