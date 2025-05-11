
// @ts-nocheck
'use client';

import type { Order, OrderItem, FranchiseDetails } from '@/types';
import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Eye, PackageSearch, Printer, Filter, FileSpreadsheet, History } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { FRANCHISE_SHOP_NAME, FRANCHISE_CONTACT_NUMBERS, FRANCHISE_ADDRESS, FRANCHISE_GSTIN, FRANCHISE_STATE } from '@/lib/constants';
import { BarcodeDisplay } from '@/components/inventory/BarcodeDisplay';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import * as dataStore from '@/lib/data-store';
import * as XLSX from 'xlsx';

const fetchFranchiseInvoicesFromStore = async (dateRange?: DateRange, searchTerm: string = ''): Promise<Order[]> => {
  const filters: any = { orderBy: 'createdAt', orderDirection: 'desc' };
  if (dateRange?.from) filters.startDate = dateRange.from;
  if (dateRange?.to) filters.endDate = dateRange.to;
  if (searchTerm) filters.orderNumber = searchTerm; 

  // Use the new dedicated function for fetching franchise invoices
  const invoices = await dataStore.getFranchiseInvoices(filters);
  return invoices;
};


export default function FranchiseInvoiceHistoryPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const printOrderRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: franchiseInvoices = [], isLoading } = useQuery<Order[]>({
    queryKey: ['franchiseInvoices', dateRange, searchTerm], // Keep this query key specific to franchise invoices
    queryFn: () => fetchFranchiseInvoicesFromStore(dateRange, searchTerm),
  });

  const handlePrintOrder = () => {
    if (printOrderRef.current && selectedOrder) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            let contentToPrint = printOrderRef.current.innerHTML;
            
            const styles = `
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    font-size: 12px; 
                    color: #000; 
                    background-color: #fff; 
                }
                .print-container { 
                    width: 100%; 
                    margin: 0 auto; 
                    color: #000; 
                    background-color: #fff;
                }
                .header { text-align: center; margin-bottom: 15px; }
                .shop-name { font-size: 1.5em; font-weight: bold; color: #333; }
                .address-info { font-size: 0.9em; color: #404040 !important; margin-bottom: 3px; line-height: 1.3; }
                .contact-info { font-size: 0.9em; color: #555; }
                .gstin-info { font-size: 0.9em; font-weight: bold; color: #303030 !important; margin-bottom: 10px; }
                .order-details { margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px dashed #888; }
                .order-details p { margin: 2px 0; font-size: 0.95em; color: #333; }
                .order-details strong { color: #000; }
                .payment-method-info { font-style: italic; font-size: 0.9em; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .items-table th, .items-table td { 
                    border: 1px solid #ccc; 
                    padding: 6px; 
                    text-align: left; 
                    font-size: 0.95em; 
                    color: #333; 
                }
                .items-table th { background-color: #f0f0f0; font-weight: bold; color: #000; }
                .items-table .text-right { text-align: right; }
                .total-section { text-align: right; margin-top: 15px; }
                .total-section p { margin: 4px 0; font-size: 1.1em; font-weight: bold; color: #000; }
                .footer { text-align: center; margin-top: 25px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.8em; color: #555; }
                .barcode-section { text-align: center; margin-top: 15px; }
                .barcode-svg svg { max-width: 200px !important; height: auto !important; display: block !important; margin: 0 auto !important; } 
                * { 
                    visibility: visible !important;
                    color: #000 !important;
                    background-color: #fff !important;
                }
                 @media print {
                    @page { size: A4; margin: 15mm; } 
                    body { 
                      -webkit-print-color-adjust: exact !important; 
                      print-color-adjust: exact !important; 
                    }
                }
            `;

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Franchise Invoice - ${selectedOrder.orderNumber}</title>
                        <style>${styles}</style>
                    </head>
                    <body>
                        <div class="print-container">
                            ${contentToPrint}
                        </div>
                        <script>
                            window.onload = function() {
                                setTimeout(function() {
                                    window.print();
                                    window.onafterprint = function() { window.close(); };
                                }, 250); 
                            }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
            toast({ title: "Printing", description: `Invoice ${selectedOrder.orderNumber} sent to printer.` });
        } else {
            toast({ title: "Print Error", description: "Could not open print window. Please check pop-up blocker.", variant: "destructive" });
        }
    } else {
        toast({ title: "Print Error", description: "No invoice content to print or invoice not selected.", variant: "destructive" });
    }
  };


  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExportFranchiseInvoices = () => {
    if (franchiseInvoices.length === 0) {
      toast({ title: 'No Data', description: 'There are no franchise invoices to export.', variant: 'destructive' });
      return;
    }
    const dataToExport = franchiseInvoices.map(order => ({
      'Invoice Number': order.orderNumber,
      'Firestore Order ID': order.id, 
      'City': order.city,
      'Date': format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      'Total Amount (₹)': order.totalAmount.toFixed(2),
      'Number of Items': order.items.length,
      'Payment Method': order.paymentMethod ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1) : 'N/A',
      'Items': order.items.map(item => `${item.name} (Qty: ${item.quantity}, Price: ₹${item.price.toFixed(2)}, ProductID: ${item.productId})`).join('; '),
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FranchiseInvoices');
    XLSX.writeFile(workbook, 'franchise_invoices_export.xlsx');
    toast({ title: 'Export Successful', description: 'Franchise invoices data has been exported to Excel.' });
  };


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center">
          <History className="mr-2 h-7 w-7" /> Franchise Invoice History
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Search by Invoice No..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full sm:w-auto flex-grow"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" /> Filter by Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 space-y-2">
                <Label>Invoice Date Range</Label>
                <DatePickerWithRange
                    className="w-full"
                    date={dateRange}
                    onDateChange={setDateRange}
                />
                {dateRange && (
                    <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="w-full text-destructive">
                        Clear Dates
                    </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handleExportFranchiseInvoices} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export to Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="p-0 md:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-16" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : franchiseInvoices.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">No Franchise Invoices Found</h2>
            <p className="text-muted-foreground mt-1">
                {searchTerm || dateRange ? "No franchise invoices match your current filters." : "There are no franchise invoices in the system yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>All Franchise Invoices</CardTitle>
            <CardDescription>
              A list of all processed franchise invoices.
              {dateRange?.from && (
                <span> Filtered from {format(dateRange.from, "LLL dd, y")}
                  {dateRange.to && ` to ${format(dateRange.to, "LLL dd, y")}`}.
                </span>
              )}
              {searchTerm && ` Searching for "${searchTerm}".`}
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {franchiseInvoices.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</TableCell>
                <TableCell>{order.city || 'N/A'}</TableCell>
                <TableCell>₹{order.totalAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => viewOrderDetails(order)} className="text-primary hover:text-primary/80">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md"> 
          <DialogHeader>
            <DialogTitle>Franchise Invoice - {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && selectedOrder.type === 'franchise' && (
            <>
                <div ref={printOrderRef} className="printable-bill-content space-y-3 text-xs"> 
                    <div className="header text-center mb-3">
                        <h2 className="shop-name text-base font-bold">
                            {FRANCHISE_SHOP_NAME}
                        </h2>
                        <p className="address-info">{FRANCHISE_ADDRESS}</p>
                        <p className="address-info">{selectedOrder.city}, {FRANCHISE_STATE}</p>
                        <p className="contact-info">Contact: {FRANCHISE_CONTACT_NUMBERS.join(' / ')}</p>
                        <p className="gstin-info">GSTIN: {FRANCHISE_GSTIN}</p>
                    </div>
                    <div className="order-details mb-2 pb-1 border-b border-dashed border-gray-400">
                        <p><strong>Invoice No:</strong> {selectedOrder.orderNumber}</p>
                        <p><strong>Date:</strong> {format(new Date(selectedOrder.createdAt), 'dd/MM/yy HH:mm')}</p>
                        {selectedOrder.city && <p><strong>City:</strong> {selectedOrder.city}</p>}
                        {selectedOrder.paymentMethod && <p className="payment-method-info"><strong>Payment Method:</strong> {selectedOrder.paymentMethod.charAt(0).toUpperCase() + selectedOrder.paymentMethod.slice(1)}</p>}
                    </div>
                    <table className="items-table w-full border-collapse mb-2">
                        <thead>
                        <tr className="border-b border-gray-400">
                            <th className="p-0.5 text-left">#</th>
                            <th className="p-0.5 text-left">Item</th>
                            <th className="p-0.5 text-right">Price</th>
                            <th className="p-0.5 text-right">Qty</th>
                            <th className="p-0.5 text-right">Total</th>
                        </tr>
                        </thead>
                        <tbody>
                        {selectedOrder.items.map((item, index) => (
                            <tr key={item.productId} className="border-b border-dashed border-gray-300">
                            <td className="p-0.5">{index + 1}</td>
                            <td className="p-0.5">{item.name}</td>
                            <td className="p-0.5 text-right">₹{item.price.toFixed(2)}</td>
                            <td className="p-0.5 text-right">{item.quantity}</td>
                            <td className="p-0.5 text-right">₹{item.subtotal.toFixed(2)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    <div className="total-section text-right mt-2">
                        <p className="text-sm font-bold">Total: ₹{selectedOrder.totalAmount.toFixed(2)}</p>
                    </div>
                     <div className="barcode-section text-center mt-3 barcode-svg"> 
                        <BarcodeDisplay value={selectedOrder.orderNumber} />
                    </div>
                    <div className="footer text-center mt-4 text-xs">
                        <p>Thank you for your business!</p>
                        <p>{FRANCHISE_SHOP_NAME}</p>
                    </div>
                </div>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={handlePrintOrder}>
                        <Printer className="mr-2 h-4 w-4" /> Print Invoice
                    </Button>
                    <DialogClose asChild>
                        <Button type="button">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

