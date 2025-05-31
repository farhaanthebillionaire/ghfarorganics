
export interface Product {
  id: string; // Will be Firestore's auto-generated ID
  name: string;
  price: number;
  quantity: number;
  uniqueId: string; // For barcode
  createdAt?: Date; // Firestore Timestamps will be converted to Date objects
  updatedAt?: Date; // Firestore Timestamps will be converted to Date objects
}

export interface GodownProduct {
  id: string; // Will be Firestore's auto-generated ID
  name: string;
  price: number; // Price of the product in godown
  quantity: number;
  uniqueId: string; // For barcode, to potentially link with inventory items
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  productId: string; // Will be Firestore's auto-generated Product ID
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  stockQuantityBeforeOrder?: number; // Original stock of the product before this order item was added
}

export type PaymentMethod = 'cash' | 'online';

export interface Order {
  id: string; // Will be Firestore's auto-generated ID
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date; // Firestore Timestamps will be converted to Date objects
  type: 'standard' | 'franchise'; // To distinguish between regular and franchise orders
  city?: string; // City for franchise invoices
  buyerName?: string; // Buyer's name for franchise invoices
  buyerPhoneNumber?: string; // Buyer's phone number for franchise invoices
  paymentMethod?: PaymentMethod; // Payment method used
}

export interface FranchiseDetails {
  shopName: string;
  address: string;
  gstin: string;
  state: string;
  contactNumbers: string[];
}


export interface SalesData {
  period: string; 
  totalSales: number;
  totalOrders: number;
}

export interface LowStockProduct extends Product {
  // Potentially add more fields if needed specifically for low stock view
}

export interface LowStockGodownProduct extends GodownProduct {
  // Potentially add more fields if needed specifically for godown low stock view
}

export interface PaymentMethodBreakdown {
  cash: number;
  online: number;
  unknown: number;
}

export interface PaymentMethodTrendData {
  period: string;
  cash: number;
  online: number;
  unknown: number;
}

export interface ReportData {
  periodData: SalesData[];
  totalSalesAllTime: number;
  totalOrdersAllTime: number;
  averageOrderValue: number;
  paymentMethodCounts: PaymentMethodBreakdown;
  paymentMethodTrends: PaymentMethodTrendData[];
}

