export interface Product {
  id: string; // Will be Firestore's auto-generated ID
  name: string;
  price: number;
  quantity: number;
  uniqueId: string; // For barcode
  createdAt?: Date; // Firestore Timestamps will be converted to Date objects
  updatedAt?: Date; // Firestore Timestamps will be converted to Date objects
}

export interface OrderItem {
  productId: string; // Will be Firestore's auto-generated Product ID
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  stockQuantityBeforeOrder?: number;
}

export interface Order {
  id: string; // Will be Firestore's auto-generated ID
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date; // Firestore Timestamps will be converted to Date objects
}

export interface SalesData {
  period: string; 
  totalSales: number;
  totalOrders: number;
}

export interface LowStockProduct extends Product {
  // Potentially add more fields if needed specifically for low stock view
}
