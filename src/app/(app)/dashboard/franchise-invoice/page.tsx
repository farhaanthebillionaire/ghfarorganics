
// @ts-nocheck
'use client';

import type { GodownProduct, OrderItem, Order, PaymentMethod } from '@/types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Trash2, Printer, CheckCircle, ShoppingCart, Loader2, Building, Banknote, CreditCard, User, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FRANCHISE_SHOP_NAME, FRANCHISE_CONTACT_NUMBERS, FRANCHISE_ADDRESS, FRANCHISE_GSTIN, FRANCHISE_STATE } from '@/lib/constants';
import { BarcodeDisplay } from '@/components/inventory/BarcodeDisplay';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import * as dataStore from '@/lib/data-store';

const fetchGodownProductsForFranchiseBilling = async (searchTerm: string = ''): Promise<GodownProduct[]> => {
  let filters: any = { orderBy: 'name', orderDirection: 'asc' };
  if (searchTerm) {
    filters.name = searchTerm;
  }
  const products = await dataStore.getGodownProducts(filters);
  return products;
};

export default function FranchiseInvoicePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhoneNumber, setBuyerPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const [latestFranchiseOrder, setLatestFranchiseOrder] = useState<Order | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const billWrapperRef = useRef<HTMLDivElement>(null);

  const { data: searchResults = [] } = useQuery<GodownProduct[]>({
    queryKey: ['franchiseBillingGodownProducts', searchTerm],
    queryFn: () => fetchGodownProductsForFranchiseBilling(searchTerm),
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
    if (printRef.current && latestFranchiseOrder && billWrapperRef.current) {
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

        toast({ title: "Printed", description: `Invoice ${latestFranchiseOrder.orderNumber} has been processed for printing.` });
        setLatestFranchiseOrder(null);
      }, 250);
    }
  }, [toast, latestFranchiseOrder, setLatestFranchiseOrder]);


  const addProductToOrder = useCallback(async (product: GodownProduct, quantity: number = 1) => {
    const freshProduct = await dataStore.getGodownProductById(product.id);
    if (!freshProduct) {
        toast({ title: 'Product Not Found', description: `${product.name} could not be fetched from godown.`, variant: 'destructive' });
        return;
    }

    if (freshProduct.quantity < quantity) {
      toast({ title: 'Out of Stock', description: `Not enough ${freshProduct.name} in godown. Available: ${freshProduct.quantity}`, variant: 'destructive' });
      return;
    }

    setCurrentOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === freshProduct.id);
      if (existingItem) {
        if (freshProduct.quantity < existingItem.quantity + quantity) {
          toast({ title: 'Stock Limit', description: `Cannot add more ${freshProduct.name}. Available in godown: ${freshProduct.quantity}`, variant: 'destructive' });
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


  const updateOrderItemQuantity = async (productId: string, newQuantity: number) => {
    const productInGodown = await dataStore.getGodownProductById(productId);
    if (!productInGodown) {
        toast({ title: 'Product Error', description: 'Could not verify godown stock for item.', variant: 'destructive'});
        return;
    }

    if (newQuantity > productInGodown.quantity) {
        toast({ title: 'Stock Limit', description: `Cannot set quantity for ${productInGodown.name} to ${newQuantity}. Available in godown: ${productInGodown.quantity}`, variant: 'destructive' });
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
        toast({ title: 'Empty Invoice', description: 'Add items to the invoice before finalizing.', variant: 'destructive' });
        throw new Error("Empty invoice");
      }
      if (!buyerName.trim()) {
        toast({ title: 'Buyer Name Required', description: 'Please enter the buyer\'s name.', variant: 'destructive' });
        throw new Error("Buyer name required");
      }
      if (!buyerPhoneNumber.trim()) {
        toast({ title: 'Buyer Phone Required', description: 'Please enter the buyer\'s phone number.', variant: 'destructive' });
        throw new Error("Buyer phone number required");
      }
      if (!city.trim()) {
        toast({ title: 'City Required', description: 'Please enter the city name for the franchise invoice.', variant: 'destructive' });
        throw new Error("City name required");
      }
      if (!paymentMethod) {
        toast({ title: 'Payment Method Required', description: 'Please select a payment method.', variant: 'destructive' });
        throw new Error("Payment method required");
      }

      const orderNumber = await dataStore.generateNextOrderNumber('franchise');
      const newOrderData: Omit<Order, 'id'> = {
        orderNumber,
        items: currentOrderItems,
        totalAmount,
        createdAt: new Date(),
        type: 'franchise',
        buyerName: buyerName.trim(),
        buyerPhoneNumber: buyerPhoneNumber.trim(),
        city: city.trim(),
        paymentMethod: paymentMethod,
      };

      for (const item of currentOrderItems) {
        const godownProduct = await dataStore.getGodownProductById(item.productId);
        if (!godownProduct) {
          toast({
            title: 'Product Not Found During Finalization',
            description: `Godown product ${item.name} (ID: ${item.productId}) could not be found. Invoice cannot be finalized.`,
            variant: 'destructive'
          });
          throw new Error(`Godown product ${item.name} not found during finalization.`);
        }
        if (godownProduct.quantity < item.quantity) {
          toast({
            title: 'Insufficient Stock During Finalization',
            description: `Not enough ${item.name} in godown. Available: ${godownProduct.quantity}, Ordered: ${item.quantity}. Invoice cannot be finalized.`,
            variant: 'destructive'
          });
          throw new Error(`Insufficient stock for ${item.name} in godown. Available: ${godownProduct.quantity}, Ordered: ${item.quantity}`);
        }
        await dataStore.updateGodownProduct(item.productId, { quantity: godownProduct.quantity - item.quantity });
      }

      const createdOrder = await dataStore.addOrder(newOrderData);
      return createdOrder;
    },
    onSuccess: (createdOrder) => {
      queryClient.invalidateQueries({ queryKey: ['godownProducts'] });
      queryClient.invalidateQueries({ queryKey: ['franchiseBillingGodownProducts'] });
      queryClient.invalidateQueries({ queryKey: ['franchiseInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      toast({ title: 'Franchise Invoice Placed!', description: `Invoice ${createdOrder.orderNumber} finalized for ${createdOrder.buyerName}, ${createdOrder.city}. Total: ₹${createdOrder.totalAmount.toFixed(2)}`, className: "bg-primary text-primary-foreground" });
      setCurrentOrderItems([]);
      setBuyerName('');
      setBuyerPhoneNumber('');
      setCity('');
      setPaymentMethod('cash');
      setLatestFranchiseOrder(createdOrder);
    },
    onError: (error: Error) => {
      const title = 'Invoice Failed';
      let description = `Error finalizing invoice: ${error.message}`;

      const isIndexError = error.message.toLowerCase().includes('query requires an index') || error.message.toLowerCase().includes('index required');

      if (isIndexError) {
        const fullLinkRegex = /https:\/\/console\.firebase\.google\.com\/project\/[^/]+\/database\/firestore\/indexes\?create_composite=[^)\s]+/;
        let createIndexLink = error.message.match(fullLinkRegex)?.[0] || null;

        const collectionNameMatch = error.message.match(/collection:\s*(\w+)/i);
        const collectionName = collectionNameMatch ? collectionNameMatch[1] : 'your collection';


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

        description = `A database operation failed because a required Firestore index is missing for the '${collectionName}' collection. `;
        if (createIndexLink) {
          description += `Please use this link to create it: ${createIndexLink}. `;
        } else {
          description += `Please go to your Firebase console (Firestore > Indexes section) and create the required composite index. `;
          description += `Look at the full error message in your browser's developer console for specific field details (e.g., 'createdAt' descending, 'city' ascending etc.). `;
        }
        description += " It may take a few minutes for the index to become active after creation.";
        toast({ title, description, variant: 'destructive', duration: 20000 });
      } else if (error.message.includes('Insufficient stock') || error.message.includes('not found during finalization') || error.message.includes('Empty invoice') || error.message.includes('Buyer name required') || error.message.includes('Buyer phone number required') || error.message.includes('City name required') || error.message.includes('Payment method required')) {
         toast({ title, description: error.message, variant: 'destructive' });
      } else {
        toast({ title, description: `An unexpected error occurred: ${error.message}`, variant: 'destructive' });
      }
    },
  });

  useEffect(() => {
    if(latestFranchiseOrder && printRef.current) {
        handleDirectPrint();
    }
  }, [latestFranchiseOrder, handleDirectPrint]);

  const isBuyerNameMissing = !buyerName.trim() && finalizeOrderMutation.isError && finalizeOrderMutation.error?.message.includes('Buyer name required');
  const isBuyerPhoneMissing = !buyerPhoneNumber.trim() && finalizeOrderMutation.isError && finalizeOrderMutation.error?.message.includes('Buyer phone number required');
  const isCityMissing = !city.trim() && finalizeOrderMutation.isError && finalizeOrderMutation.error?.message.includes('City name required');


  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary franchise-invoice-page-title">Create Franchise Invoice</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 franchise-invoice-form-area">
        <div className="lg:col-span-1 space-y-4">
           <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Buyer &amp; Destination Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="buyerName" className={cn(isBuyerNameMissing ? "text-destructive" : "")}>
                        Buyer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="buyerName"
                        type="text"
                        placeholder="Enter buyer's full name"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className={cn(isBuyerNameMissing ? "border-destructive" : "")}
                    />
                     {isBuyerNameMissing && (
                        <p className="text-xs text-destructive mt-1">Buyer name is required.</p>
                     )}
                </div>
                 <div>
                    <Label htmlFor="buyerPhoneNumber" className={cn(isBuyerPhoneMissing ? "text-destructive" : "")}>
                        Buyer Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="buyerPhoneNumber"
                        type="tel"
                        placeholder="Enter buyer's phone number"
                        value={buyerPhoneNumber}
                        onChange={(e) => setBuyerPhoneNumber(e.target.value)}
                        className={cn(isBuyerPhoneMissing ? "border-destructive" : "")}
                    />
                     {isBuyerPhoneMissing && (
                        <p className="text-xs text-destructive mt-1">Buyer phone number is required.</p>
                     )}
                </div>
                <div>
                    <Label htmlFor="city" className={cn(isCityMissing ? "text-destructive" : "")}>
                        City Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="city"
                        type="text"
                        placeholder="Enter city name"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={cn(isCityMissing ? "border-destructive" : "")}
                    />
                     {isCityMissing && (
                        <p className="text-xs text-destructive mt-1">City name is required.</p>
                     )}
                </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Search Godown Products</CardTitle>
            </CardHeader>
            <CardContent ref={searchInputRef}>
              <Input
                type="text"
                placeholder="Enter godown product name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSearchResults(true); }}
                onFocus={() => searchTerm && setShowSearchResults(true)}
                className="mb-2"
              />
              {showSearchResults && searchResults.length > 0 && (
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
               {showSearchResults && searchTerm && searchResults.length === 0 && (
                 <p className="text-sm text-muted-foreground p-2">No godown products found matching "{searchTerm}".</p>
               )}
            </CardContent>
          </Card>

        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Current Franchise Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {currentOrderItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2" />
                  <p>No items in the invoice. Add godown products by searching.</p>
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
              <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t pt-4 gap-4 franchise-bill-actions-footer">
                 <div className="w-full sm:w-auto">
                  <Label className="text-sm font-medium mb-2 block">Payment Method</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}
                    className="flex flex-row space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="franchise-cash" />
                      <Label htmlFor="franchise-cash" className="flex items-center gap-1 cursor-pointer"><Banknote className="h-4 w-4"/> Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="online" id="franchise-online" />
                      <Label htmlFor="franchise-online" className="flex items-center gap-1 cursor-pointer"><CreditCard className="h-4 w-4"/> Online</Label>
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
                          <CheckCircle className="mr-2 h-5 w-5" /> Finalize &amp; Print Invoice
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {latestFranchiseOrder && (
          <div ref={billWrapperRef} className="hidden">
            <PrintableFranchiseBill ref={printRef} order={latestFranchiseOrder} />
          </div>
      )}
    </div>
  );
}

interface PrintableFranchiseBillProps {
  order: Order;
}

const PrintableFranchiseBill = React.forwardRef<HTMLDivElement, PrintableFranchiseBillProps>(({ order }, ref) => {
  if (!order || order.type !== 'franchise') return null;

  return (
    <div ref={ref} className="printable-bill-actual-content p-0 m-0 font-sans text-sm bg-white text-black">
      <style type="text/css">
        {`
          @media print {
            body.body-is-printing {
              background-color: white !important;
            }
            body.body-is-printing header,
            body.body-is-printing aside,
            body.body-is-printing div[data-sidebar="sidebar"],
            body.body-is-printing .ToastViewport,
            body.body-is-printing .franchise-invoice-page-title, /* Hides H1 title */
            body.body-is-printing .franchise-invoice-form-area, /* Hides main form grid */
            body.body-is-printing .franchise-bill-actions-footer /* Hides the specific CardFooter with the button */ {
              display: none !important;
              visibility: hidden !important;
            }
            .print-bill-wrapper-active {
              display: block !important;
              visibility: visible !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              background-color: white !important;
              z-index: 999999 !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: auto !important;
            }
            .print-bill-wrapper-active > .printable-bill-actual-content {
              display: block !important;
              visibility: visible !important;
              margin: 15mm !important;
              padding: 0 !important;
              background-color: white !important;
              color: black !important;
              width: auto !important;
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-bill-wrapper-active > .printable-bill-actual-content * {
                visibility: visible !important;
            }
            .print-bill-wrapper-active .print-container,
            .print-bill-wrapper-active .print-container * {
                color: black !important;
                background-color: transparent !important;
                visibility: visible !important;
            }
            @page {
              size: A4;
              margin: 0;
            }
            .print-bill-wrapper-active .print-container { width: 100%; margin: 0 auto; }
            .print-bill-wrapper-active .header { text-align: center; margin-bottom: 10px; }
            .print-bill-wrapper-active .shop-name { font-size: 1.8em; font-weight: bold; color: #1a1a1a !important; margin-bottom: 3px; }
            .print-bill-wrapper-active .address-info { font-size: 0.9em; color: #404040 !important; margin-bottom: 3px; line-height: 1.3; }
            .print-bill-wrapper-active .contact-info { font-size: 0.9em; color: #404040 !important; margin-bottom: 3px; }
            .print-bill-wrapper-active .gstin-info { font-size: 0.9em; font-weight: bold; color: #303030 !important; margin-bottom: 8px; }

            .print-bill-wrapper-active .buyer-details-section { margin-bottom: 10px; padding: 8px; border: 1px solid #bbb !important; background-color: #f7f7f7 !important; border-radius: 4px; }
            .print-bill-wrapper-active .buyer-details-section h3 { margin-top:0; margin-bottom: 6px; font-size: 1.0em; color: #222 !important; border-bottom: 1px solid #ddd !important; padding-bottom: 3px; font-weight: bold; }
            .print-bill-wrapper-active .buyer-details-section p { margin: 2px 0; font-size: 0.9em; line-height: 1.3; }
            .print-bill-wrapper-active .buyer-details-section strong { color: #1a1a1a !important; }

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
            body.body-is-printing * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>
      <div className="print-container">
        <div className="header">
          <div className="shop-name">{FRANCHISE_SHOP_NAME}</div>
          <div className="address-info">{FRANCHISE_ADDRESS}</div>
          <div className="contact-info">Contact: {FRANCHISE_CONTACT_NUMBERS.join(' / ')}</div>
          <div className="gstin-info">GSTIN: {FRANCHISE_GSTIN}</div>
        </div>

        <div className="buyer-details-section">
            <h3>Bill To:</h3>
            <p><strong>Name:</strong> {order.buyerName}</p>
            <p><strong>Phone:</strong> {order.buyerPhoneNumber}</p>
            <p><strong>City:</strong> {order.city}, {FRANCHISE_STATE}</p>
        </div>

        <div className="order-details">
          <p><strong>Invoice Number:</strong> {order.orderNumber}</p>
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
            <p className="text-xs mb-1">Invoice ID:</p>
            <BarcodeDisplay value={order.orderNumber} />
        </div>

        <div className="footer">
          <p>Thank you for your business!</p>
          <p>{FRANCHISE_SHOP_NAME}</p>
        </div>
      </div>
    </div>
  );
});
PrintableFranchiseBill.displayName = 'PrintableFranchiseBill';

