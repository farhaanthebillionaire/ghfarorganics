
'use server';

import type { Product, Order, OrderItem, GodownProduct, PaymentMethod, PaymentMethodTrendData } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
  setDoc,
  runTransaction
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, subWeeks, subYears, startOfYear, endOfYear, getYear } from 'date-fns';


// Firestore collection references
const productsCollection = collection(db, 'products');
const godownProductsCollection = collection(db, 'godownProducts');
const ordersCollection = collection(db, 'orders'); // For standard customer bills
const franchiseInvoicesCollection = collection(db, 'franchiseInvoices'); // For franchise invoices
const metadataCollection = collection(db, 'metadata'); // For seeding flag

let storeInitialized = false;

// Helper to convert Firestore Timestamps to Dates and vice-versa
const fromFirestoreTimestamp = (timestamp: Timestamp | Date | undefined): Date | undefined => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return timestamp instanceof Date ? timestamp : undefined;
};

const toFirestoreProductData = (productData: Partial<Product>): any => {
  const data: any = { ...productData };
  if (productData.createdAt === undefined && !productData.id) { // Only set on creation
    data.createdAt = serverTimestamp();
  } else if (productData.createdAt) {
    data.createdAt = Timestamp.fromDate(new Date(productData.createdAt));
  }
  data.updatedAt = serverTimestamp(); // Always set/update on write
  if (typeof productData.price === 'number') data.price = Number(productData.price);
  if (typeof productData.quantity === 'number') data.quantity = Number(productData.quantity);
  return data;
};

const toFirestoreGodownProductData = (godownProductData: Partial<GodownProduct>): any => {
  const data: any = { ...godownProductData };
   if (godownProductData.createdAt === undefined && !godownProductData.id) { // Only set on creation
    data.createdAt = serverTimestamp();
  } else if (godownProductData.createdAt) {
    data.createdAt = Timestamp.fromDate(new Date(godownProductData.createdAt));
  }
  data.updatedAt = serverTimestamp(); // Always set/update on write
  if (typeof godownProductData.price === 'number') data.price = Number(godownProductData.price);
  if (typeof godownProductData.quantity === 'number') data.quantity = Number(godownProductData.quantity);
  return data;
};


const toFirestoreOrderData = (orderData: Partial<Order>): any => {
    const data: any = { ...orderData };
    if (orderData.createdAt === undefined && !orderData.id) {
        data.createdAt = serverTimestamp();
    } else if (orderData.createdAt) {
        data.createdAt = Timestamp.fromDate(new Date(orderData.createdAt));
    }
    
    if (data.items && Array.isArray(data.items)) {
        data.items = data.items.map((item: OrderItem) => ({
            ...item,
            price: Number(item.price),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
        }));
    }
    data.totalAmount = Number(data.totalAmount);
    data.type = orderData.type || 'standard'; 

    if (orderData.type === 'franchise') {
      if (orderData.city) data.city = orderData.city;
      if (orderData.buyerName) data.buyerName = orderData.buyerName;
      if (orderData.buyerPhoneNumber) data.buyerPhoneNumber = orderData.buyerPhoneNumber;
    } else {
      delete data.city;
      delete data.buyerName;
      delete data.buyerPhoneNumber;
    }

    if (orderData.paymentMethod) {
      data.paymentMethod = orderData.paymentMethod;
    } else {
      delete data.paymentMethod; 
    }

    return data;
};


const mapDocToProduct = (docSnap: any): Product => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    price: Number(data.price),
    quantity: Number(data.quantity),
    uniqueId: data.uniqueId,
    createdAt: fromFirestoreTimestamp(data.createdAt),
    updatedAt: fromFirestoreTimestamp(data.updatedAt),
  };
};

const mapDocToGodownProduct = (docSnap: any): GodownProduct => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    price: Number(data.price),
    quantity: Number(data.quantity),
    uniqueId: data.uniqueId,
    createdAt: fromFirestoreTimestamp(data.createdAt),
    updatedAt: fromFirestoreTimestamp(data.updatedAt),
  };
};

const mapDocToOrder = (docSnap: any): Order => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    orderNumber: data.orderNumber,
    items: data.items.map((item: any) => ({
        ...item,
        price: Number(item.price),
        quantity: Number(item.quantity),
        subtotal: Number(item.subtotal),
    })),
    totalAmount: Number(data.totalAmount),
    createdAt: fromFirestoreTimestamp(data.createdAt)!,
    type: data.type || 'standard', 
    city: data.city, 
    buyerName: data.buyerName,
    buyerPhoneNumber: data.buyerPhoneNumber,
    paymentMethod: data.paymentMethod as PaymentMethod | undefined,
  };
};

type SeedOrderItem = (Omit<OrderItem, 'productId'> & { productUniqueId: string; name: string });


const internalSeedInitialData = async () => {
  console.log("Seeding initial product, godown product, order, and franchise invoice data to Firestore...");
  const seedBatch = writeBatch(db);

  const productsToSeed = [
    { name: 'Organic Apples', price: 2.99, quantity: 50, uniqueId: 'PROD-APPLE-001' },
    { name: 'Brown Rice (1kg)', price: 5.49, quantity: 30, uniqueId: 'PROD-RICE-BR01' },
    { name: 'Almond Milk', price: 3.19, quantity: 5, uniqueId: 'PROD-MILK-ALM01' },
  ];
   const godownProductsToSeed = [
    { name: 'Organic Apples - Bulk', price: 2.50, quantity: 200, uniqueId: 'PROD-APPLE-BULK' }, // Changed prefix
    { name: 'Sunflower Oil (5L Can)', price: 25.00, quantity: 50, uniqueId: 'PROD-SUNOIL-5L' }, // Changed prefix
    { name: 'Wheat Flour (10kg Bag)', price: 8.00, quantity: 100, uniqueId: 'PROD-WFLOUR-10KG' }, // Changed prefix
  ];

  const productRefs: { [key: string]: string } = {};
  const godownProductRefs: { [key: string]: string } = {};


  for (const prodData of productsToSeed) {
    const productRef = doc(productsCollection); 
    productRefs[prodData.uniqueId] = productRef.id; 
    seedBatch.set(productRef, toFirestoreProductData({ ...prodData, createdAt: new Date(), updatedAt: new Date() }));
  }

  for (const gpData of godownProductsToSeed) {
    const godownProductRef = doc(godownProductsCollection);
    godownProductRefs[gpData.uniqueId] = godownProductRef.id;
    seedBatch.set(godownProductRef, toFirestoreGodownProductData({ ...gpData, createdAt: new Date(), updatedAt: new Date() }));
  }

  // Seed Standard Orders
  const orderItems1: SeedOrderItem[] = [
    { productUniqueId: 'PROD-APPLE-001', name: 'Organic Apples', price: 2.99, quantity: 2, subtotal: 5.98, stockQuantityBeforeOrder: 50 },
    { productUniqueId: 'PROD-RICE-BR01', name: 'Brown Rice (1kg)', price: 5.49, quantity: 1, subtotal: 5.49, stockQuantityBeforeOrder: 30 },
  ];
  const order1Data: Omit<Order, 'id'> = {
    orderNumber: 'ORD-0001',
    items: orderItems1.map(item => ({ ...item, productId: productRefs[item.productUniqueId] })),
    totalAmount: orderItems1.reduce((sum, item) => sum + item.subtotal, 0),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    type: 'standard',
    paymentMethod: 'cash',
  };
  seedBatch.set(doc(ordersCollection), toFirestoreOrderData(order1Data));

  // Seed Franchise Invoice
  const franchiseOrderItems1: SeedOrderItem[] = [
    { productUniqueId: 'PROD-SUNOIL-5L', name: 'Sunflower Oil (5L Can)', price: 25.00, quantity: 2, subtotal: 50.00, stockQuantityBeforeOrder: 50 },
    { productUniqueId: 'PROD-WFLOUR-10KG', name: 'Wheat Flour (10kg Bag)', price: 8.00, quantity: 5, subtotal: 40.00, stockQuantityBeforeOrder: 100 },
  ];
  const franchiseInvoice1Data: Omit<Order, 'id'> = {
    orderNumber: 'FINV-0001', 
    items: franchiseOrderItems1.map(item => ({ ...item, productId: godownProductRefs[item.productUniqueId] })),
    totalAmount: franchiseOrderItems1.reduce((sum, item) => sum + item.subtotal, 0),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    type: 'franchise',
    buyerName: 'Kadapa Franchise Store',
    buyerPhoneNumber: '9876543210',
    city: 'Kadapa',
    paymentMethod: 'online',
  };
  seedBatch.set(doc(franchiseInvoicesCollection), toFirestoreOrderData(franchiseInvoice1Data));
  
  await seedBatch.commit();
  
  const seededDocRef = doc(metadataCollection, 'seedingStatus');
  await setDoc(seededDocRef, { seeded: true, lastSeeded: serverTimestamp() });
  console.log("Initial data seeded to Firestore.");
};


const initializeDataStore = async () => {
  if (storeInitialized) return;
  
  console.log("Initializing Firestore data store...");
  try {
    const seededDocRef = doc(metadataCollection, 'seedingStatus');
    const seededDocSnap = await getDoc(seededDocRef);

    if (!seededDocSnap.exists() || !seededDocSnap.data()?.seeded) {
        console.log("Firestore not seeded or flag not set. Checking collections...");
        const productsSnap = await getDocs(query(productsCollection, limit(1)));
        const ordersSnap = await getDocs(query(ordersCollection, limit(1)));
        const godownProductsSnap = await getDocs(query(godownProductsCollection, limit(1)));
        const franchiseInvoicesSnap = await getDocs(query(franchiseInvoicesCollection, limit(1)));


        if (productsSnap.empty && ordersSnap.empty && godownProductsSnap.empty && franchiseInvoicesSnap.empty) {
            console.log("Collections are empty. Proceeding to seed initial data.");
            await internalSeedInitialData();
        } else {
            console.log("Collections are not empty, but seeding flag was missing. Setting flag.");
            await setDoc(seededDocRef, { seeded: true, lastSeeded: serverTimestamp() });
        }
    } else {
        console.log("Firestore already seeded.");
    }
  } catch (error) {
    console.error("Error during Firestore initialization or seeding check:", error);
  }
  
  storeInitialized = true; 
  if (process.env.NODE_ENV === 'development') {
    if (!(global as any).dataStoreInitializedLog) {
        (global as any).dataStoreInitializedLog = true;
        console.log("Firestore data store initialization logic completed for development.");
    }
  }
};


// --- Product Functions (Main Inventory) ---
export const getProducts = async (filters?: { name?: string, uniqueId?: string, limit?: number, orderBy?: string, orderDirection?: 'asc' | 'desc' }): Promise<Product[]> => {
  await initializeDataStore();
  let qConstraints = [];

  if (filters?.uniqueId) {
    qConstraints.push(where('uniqueId', '==', filters.uniqueId));
  }

  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    qConstraints.push(orderBy(filters.orderBy, filters.orderDirection));
  }
  
  if (filters?.limit) {
    qConstraints.push(limit(filters.limit));
  }
  
  const q = query(productsCollection, ...qConstraints);
  const snapshot = await getDocs(q);
  let result = snapshot.docs.map(mapDocToProduct);

  if (filters?.name) {
    result = result.filter(p => p.name.toLowerCase().includes(filters.name!.toLowerCase()));
  }

  return result;
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  await initializeDataStore();
  const docRef = doc(db, 'products', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? mapDocToProduct(docSnap) : undefined;
};

export const getProductByUniqueId = async (uniqueId: string): Promise<Product | undefined> => {
  await initializeDataStore();
  const q = query(productsCollection, where('uniqueId', '==', uniqueId), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return undefined;
  return mapDocToProduct(snapshot.docs[0]);
};

export const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  await initializeDataStore();
  const dataWithTimestamps = toFirestoreProductData({ ...productData });
  const docRef = await addDoc(productsCollection, dataWithTimestamps);
  const newProductSnap = await getDoc(docRef);
  const newProduct = mapDocToProduct(newProductSnap);

  if (newProduct.price !== undefined) {
    const godownProduct = await getGodownProductByUniqueId(newProduct.uniqueId);
    if (godownProduct && godownProduct.price !== newProduct.price) {
        console.log(`Syncing price from new Inventory product to Godown for ${newProduct.name} (ID: ${newProduct.uniqueId})`);
        await updateGodownProduct(godownProduct.id, { price: newProduct.price }, { _isSyncCall: true });
    }
  }
  return newProduct;
};

export const updateProduct = async (id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>, options?: { _isSyncCall?: boolean }): Promise<Product | undefined> => {
  await initializeDataStore();
  const docRef = doc(db, 'products', id);
  const dataToUpdate = toFirestoreProductData(updates); 
  await updateDoc(docRef, dataToUpdate);

  if (updates.price !== undefined && !options?._isSyncCall) {
    const updatedProductSnap = await getDoc(docRef);
    if (updatedProductSnap.exists()) {
      const updatedProduct = mapDocToProduct(updatedProductSnap);
      const godownProduct = await getGodownProductByUniqueId(updatedProduct.uniqueId);
      if (godownProduct && godownProduct.price !== updatedProduct.price) {
        console.log(`Syncing price from Inventory to Godown for ${updatedProduct.name} (ID: ${updatedProduct.uniqueId})`);
        await updateGodownProduct(godownProduct.id, { price: updatedProduct.price }, { _isSyncCall: true });
      }
    }
  }
  const finalSnap = await getDoc(docRef);
  return finalSnap.exists() ? mapDocToProduct(finalSnap) : undefined;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  await initializeDataStore();
  try {
    await deleteDoc(doc(db, 'products', id));
    return true;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
};

// --- Godown Product Functions ---
export const getGodownProducts = async (filters?: { name?: string, uniqueId?: string, limit?: number, orderBy?: string, orderDirection?: 'asc' | 'desc' }): Promise<GodownProduct[]> => {
  await initializeDataStore();
  let qConstraints = [];

  if (filters?.uniqueId) {
    qConstraints.push(where('uniqueId', '==', filters.uniqueId));
  }
  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    qConstraints.push(orderBy(filters.orderBy, filters.orderDirection));
  }
  if (filters?.limit) {
    qConstraints.push(limit(filters.limit));
  }

  const q = query(godownProductsCollection, ...qConstraints);
  const snapshot = await getDocs(q);
  let result = snapshot.docs.map(mapDocToGodownProduct);

  if (filters?.name) {
    result = result.filter(p => p.name.toLowerCase().includes(filters.name!.toLowerCase()));
  }
  return result;
};

export const getGodownProductById = async (id: string): Promise<GodownProduct | undefined> => {
  await initializeDataStore();
  const docRef = doc(db, 'godownProducts', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? mapDocToGodownProduct(docSnap) : undefined;
};

export const getGodownProductByUniqueId = async (uniqueId: string): Promise<GodownProduct | undefined> => {
  await initializeDataStore();
  const q = query(godownProductsCollection, where('uniqueId', '==', uniqueId), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return undefined;
  return mapDocToGodownProduct(snapshot.docs[0]);
};

export const addGodownProduct = async (godownProductData: Omit<GodownProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<GodownProduct> => {
  await initializeDataStore();
  const dataWithTimestamps = toFirestoreGodownProductData({ ...godownProductData });
  const docRef = await addDoc(godownProductsCollection, dataWithTimestamps);
  const newGodownProductSnap = await getDoc(docRef);
  const newGodownProduct = mapDocToGodownProduct(newGodownProductSnap);

  if (newGodownProduct.price !== undefined) {
      const inventoryProduct = await getProductByUniqueId(newGodownProduct.uniqueId);
      if (inventoryProduct && inventoryProduct.price !== newGodownProduct.price) {
          console.log(`Syncing price from new Godown product to Inventory for ${newGodownProduct.name} (ID: ${newGodownProduct.uniqueId})`);
          await updateProduct(inventoryProduct.id, { price: newGodownProduct.price }, { _isSyncCall: true });
      }
  }
  return newGodownProduct;
};

export const updateGodownProduct = async (id: string, updates: Partial<Omit<GodownProduct, 'id' | 'createdAt'>>, options?: { _isSyncCall?: boolean }): Promise<GodownProduct | undefined> => {
  await initializeDataStore();
  const docRef = doc(db, 'godownProducts', id);
  const dataToUpdate = toFirestoreGodownProductData(updates);
  await updateDoc(docRef, dataToUpdate);

  if (updates.price !== undefined && !options?._isSyncCall) {
    const updatedGodownProductSnap = await getDoc(docRef);
     if (updatedGodownProductSnap.exists()) {
      const updatedGodownProduct = mapDocToGodownProduct(updatedGodownProductSnap);
      const inventoryProduct = await getProductByUniqueId(updatedGodownProduct.uniqueId);
      if (inventoryProduct && inventoryProduct.price !== updatedGodownProduct.price) {
        console.log(`Syncing price from Godown to Inventory for ${updatedGodownProduct.name} (ID: ${updatedGodownProduct.uniqueId})`);
        await updateProduct(inventoryProduct.id, { price: updatedGodownProduct.price }, { _isSyncCall: true });
      }
    }
  }
  const finalSnap = await getDoc(docRef);
  return finalSnap.exists() ? mapDocToGodownProduct(finalSnap) : undefined;
};

export const deleteGodownProduct = async (id: string): Promise<boolean> => {
  await initializeDataStore();
  try {
    await deleteDoc(doc(db, 'godownProducts', id));
    return true;
  } catch (error) {
    console.error("Error deleting godown product:", error);
    return false;
  }
};

// --- Move Stock Function ---
export const moveGodownStockToInventory = async (
  godownProductId: string, 
  quantityToMove: number
): Promise<{ success: boolean; message: string }> => {
  await initializeDataStore();
  let godownProductName = "Product"; 

  try {
    await runTransaction(db, async (transaction) => {
      const godownProductRef = doc(db, 'godownProducts', godownProductId);
      const godownProductSnap = await transaction.get(godownProductRef);

      if (!godownProductSnap.exists()) {
        throw new Error("Godown product not found.");
      }
      const godownProduct = mapDocToGodownProduct(godownProductSnap);
      godownProductName = godownProduct.name; 

      if (godownProduct.quantity < quantityToMove) {
        throw new Error(`Insufficient stock in godown for ${godownProduct.name}. Available: ${godownProduct.quantity}, Trying to move: ${quantityToMove}`);
      }
      if (godownProduct.price === undefined || godownProduct.price <= 0) {
          throw new Error(`Price for godown product ${godownProduct.name} is not set or invalid. Cannot move to inventory.`);
      }

      const inventoryProductQuery = query(productsCollection, where('uniqueId', '==', godownProduct.uniqueId), limit(1));
      const inventoryProductQuerySnapshot = await getDocs(inventoryProductQuery); 


      let inventoryProductRef;
      let newInventoryQuantity;

      if (!inventoryProductQuerySnapshot.empty) {
        const existingInventoryProductDoc = inventoryProductQuerySnapshot.docs[0];
        inventoryProductRef = existingInventoryProductDoc.ref;
        const existingInventoryProduct = mapDocToProduct(existingInventoryProductDoc);
        newInventoryQuantity = existingInventoryProduct.quantity + quantityToMove;
        
        const inventoryUpdatePayload: Partial<Product> = { 
          quantity: newInventoryQuantity,
          price: godownProduct.price 
        };
        transaction.update(inventoryProductRef, toFirestoreProductData(inventoryUpdatePayload));

      } else {
        inventoryProductRef = doc(productsCollection); 
        newInventoryQuantity = quantityToMove;
        const newInventoryProductData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          name: godownProduct.name, 
          price: godownProduct.price, 
          quantity: newInventoryQuantity,
          uniqueId: godownProduct.uniqueId, 
        };
        transaction.set(inventoryProductRef, toFirestoreProductData(newInventoryProductData));
      }

      const newGodownQuantity = godownProduct.quantity - quantityToMove;
      transaction.update(godownProductRef, toFirestoreGodownProductData({ quantity: newGodownQuantity }));
    });
    return { success: true, message: `${quantityToMove} unit(s) of ${godownProductName} moved to inventory successfully. Inventory price updated if applicable.` };
  } catch (error: any) {
    console.error("Error moving stock to inventory:", error);
    return { success: false, message: `Failed to move stock for ${godownProductName}: ${error.message}` };
  }
};


// --- Order/Invoice Functions ---
export const generateNextOrderNumber = async (type: 'standard' | 'franchise'): Promise<string> => {
  await initializeDataStore();
  
  const targetCollection = type === 'standard' ? ordersCollection : franchiseInvoicesCollection;
  const prefix = type === 'standard' ? 'ORD-' : 'FINV-';
  
  let q = query(targetCollection, orderBy('createdAt', 'desc'), limit(500)); 
  
  const snapshot = await getDocs(q);
  let maxSuffix = 0;
  
  if (!snapshot.empty) {
    snapshot.docs.forEach(docSnap => {
      const orderData = docSnap.data();
      if (orderData.orderNumber && typeof orderData.orderNumber === 'string' && orderData.orderNumber.startsWith(prefix)) {
        const suffixStr = orderData.orderNumber.substring(prefix.length);
        const suffix = parseInt(suffixStr, 10);
        if (!isNaN(suffix) && suffix > maxSuffix) {
          maxSuffix = suffix;
        }
      }
    });
  }
  
  return `${prefix}${String(maxSuffix + 1).padStart(4, '0')}`;
};


// Fetches standard orders from the 'orders' collection
export const getStandardOrders = async (filters?: { startDate?: Date, endDate?: Date, orderNumber?: string, limit?: number, orderBy?: string, orderDirection?: 'desc' | 'asc' }): Promise<Order[]> => {
  await initializeDataStore();
  let qConstraints = [];

  if (filters?.startDate) {
    qConstraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
  }
  if (filters?.endDate) {
    const inclusiveEndDate = new Date(filters.endDate);
    inclusiveEndDate.setHours(23, 59, 59, 999); 
    qConstraints.push(where('createdAt', '<=', Timestamp.fromDate(inclusiveEndDate)));
  }
  
  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    qConstraints.push(orderBy(filters.orderBy, filters.orderDirection));
  } else {
    qConstraints.push(orderBy('createdAt', 'desc')); // Default sort
  }
  
  if (filters?.limit) {
    qConstraints.push(limit(filters.limit));
  }
  
  const q = query(ordersCollection, ...qConstraints);
  const snapshot = await getDocs(q);
  let result = snapshot.docs.map(mapDocToOrder);

  if (filters?.orderNumber) {
    result = result.filter(o => o.orderNumber.toLowerCase().includes(filters.orderNumber!.toLowerCase()));
  }

  return result;
};

// Fetches franchise invoices from the 'franchiseInvoices' collection
export const getFranchiseInvoices = async (filters?: { startDate?: Date, endDate?: Date, orderNumber?: string, city?: string, buyerName?: string, buyerPhoneNumber?: string, limit?: number, orderBy?: string, orderDirection?: 'desc' | 'asc' }): Promise<Order[]> => {
  await initializeDataStore();
  let qConstraints = [];

  if (filters?.startDate) {
    qConstraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
  }
  if (filters?.endDate) {
    const inclusiveEndDate = new Date(filters.endDate);
    inclusiveEndDate.setHours(23, 59, 59, 999); 
    qConstraints.push(where('createdAt', '<=', Timestamp.fromDate(inclusiveEndDate)));
  }
  if (filters?.city) {
    qConstraints.push(where('city', '==', filters.city));
  }
  // Note: Firestore does not support direct text search like 'includes' for buyerName, buyerPhoneNumber, orderNumber.
  // These will be client-side filtered if broad results are acceptable, or more specific queries would be needed.
  
  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    qConstraints.push(orderBy(filters.orderBy, filters.orderDirection));
  } else {
    qConstraints.push(orderBy('createdAt', 'desc')); // Default sort
  }
  
  if (filters?.limit) {
    qConstraints.push(limit(filters.limit));
  }
  
  const q = query(franchiseInvoicesCollection, ...qConstraints);
  const snapshot = await getDocs(q);
  let result = snapshot.docs.map(mapDocToOrder);

  // Client-side filtering for fields not easily queryable with 'includes' in Firestore
  if (filters?.orderNumber) {
    result = result.filter(o => o.orderNumber.toLowerCase().includes(filters.orderNumber!.toLowerCase()));
  }
  if (filters?.buyerName) {
    result = result.filter(o => o.buyerName && o.buyerName.toLowerCase().includes(filters.buyerName!.toLowerCase()));
  }
  if (filters?.buyerPhoneNumber) {
     result = result.filter(o => o.buyerPhoneNumber && o.buyerPhoneNumber.includes(filters.buyerPhoneNumber!));
  }


  return result;
};


export const addOrder = async (orderData: Omit<Order, 'id'>): Promise<Order> => {
  await initializeDataStore();
  const dataWithTimestampAndType = toFirestoreOrderData({ ...orderData }); 
  
  let targetCollection;
  if (orderData.type === 'franchise') {
    targetCollection = franchiseInvoicesCollection;
  } else {
    targetCollection = ordersCollection; // Default to standard orders
  }

  const docRef = await addDoc(targetCollection, dataWithTimestampAndType);
  const newOrderSnap = await getDoc(docRef);
  return mapDocToOrder(newOrderSnap);
};


export const fetchReportDataForType = async (
  period: 'weekly' | 'monthly' | 'yearly',
  dataType: 'all' | 'standard' | 'franchise'
): Promise<import('@/types').ReportData> => {
  await initializeDataStore();
  let orders: Order[] = [];

  if (dataType === 'all') {
    const standardOrders = await getStandardOrders({ orderBy: "createdAt", orderDirection: "asc" });
    const franchiseInvoices = await getFranchiseInvoices({ orderBy: "createdAt", orderDirection: "asc" });
    orders = [...standardOrders, ...franchiseInvoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (dataType === 'standard') {
    orders = await getStandardOrders({ orderBy: "createdAt", orderDirection: "asc" });
  } else if (dataType === 'franchise') {
    orders = await getFranchiseInvoices({ orderBy: "createdAt", orderDirection: "asc" });
  }

  let periodData: import('@/types').SalesData[] = [];
  let paymentMethodTrends: PaymentMethodTrendData[] = [];
  const now = new Date();

  const processPeriodOrders = (periodOrders: Order[], periodLabel: string) => {
    const sales = periodOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const count = periodOrders.length;
    const paymentCounts = { cash: 0, online: 0, unknown: 0 };
    periodOrders.forEach(o => {
      if (o.paymentMethod === 'cash') paymentCounts.cash++;
      else if (o.paymentMethod === 'online') paymentCounts.online++;
      else paymentCounts.unknown++;
    });
    return {
      salesData: { period: periodLabel, totalSales: sales, totalOrders: count },
      trendData: { period: periodLabel, ...paymentCounts },
    };
  };

  if (period === 'weekly') {
    const weeks = Array.from({ length: 12 }, (_, i) => subWeeks(now, i)).reverse();
    weeks.forEach(weekStartTarget => {
      const start = startOfWeek(weekStartTarget, { weekStartsOn: 1 });
      const end = endOfWeek(weekStartTarget, { weekStartsOn: 1 });
      const weekOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = `W${format(start, 'w')} ${format(start, 'MMM dd')}`;
      const { salesData, trendData } = processPeriodOrders(weekOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  } else if (period === 'monthly') {
    const months = Array.from({ length: 12 }, (_, i) => subMonths(now, i)).reverse();
    months.forEach(monthStartTarget => {
      const start = startOfMonth(monthStartTarget);
      const end = endOfMonth(monthStartTarget);
      const monthOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = format(start, 'MMM yyyy');
      const { salesData, trendData } = processPeriodOrders(monthOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  } else if (period === 'yearly') {
    const currentYear = getYear(now);
    const firstOrderYear = orders.length > 0 ? getYear(new Date(orders[0].createdAt)) : currentYear;
    const yearsToDisplay = Math.max(1, Math.min(5, currentYear - firstOrderYear + 1));
    const years = Array.from({ length: yearsToDisplay }, (_, i) => subYears(now, i)).reverse();
    years.forEach(yearStartTarget => {
      const start = startOfYear(yearStartTarget);
      const end = endOfYear(yearStartTarget);
      const yearOrders = orders.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end);
      const periodLabel = format(start, 'yyyy');
      const { salesData, trendData } = processPeriodOrders(yearOrders, periodLabel);
      periodData.push(salesData);
      paymentMethodTrends.push(trendData);
    });
  }

  const totalSalesAllTime = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersAllTime = orders.length;
  const averageOrderValue = totalOrdersAllTime > 0 ? totalSalesAllTime / totalOrdersAllTime : 0;

  const paymentMethodCounts = { cash: 0, online: 0, unknown: 0 };
  orders.forEach(order => {
    if (order.paymentMethod === 'cash') paymentMethodCounts.cash++;
    else if (order.paymentMethod === 'online') paymentMethodCounts.online++;
    else paymentMethodCounts.unknown++;
  });

  return { periodData, totalSalesAllTime, totalOrdersAllTime, averageOrderValue, paymentMethodCounts, paymentMethodTrends };
};



export const _clearDataStore = async () => {
  console.warn("Clearing Firestore data store. This is destructive.");
  const productsSnap = await getDocs(productsCollection);
  const godownProductsSnap = await getDocs(godownProductsCollection);
  const ordersSnap = await getDocs(ordersCollection);
  const franchiseInvoicesSnap = await getDocs(franchiseInvoicesCollection);
  const metadataSnap = await getDocs(metadataCollection);

  const batch = writeBatch(db);
  productsSnap.docs.forEach(doc => batch.delete(doc.ref));
  godownProductsSnap.docs.forEach(doc => batch.delete(doc.ref));
  ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
  franchiseInvoicesSnap.docs.forEach(doc => batch.delete(doc.ref));
  metadataSnap.docs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  console.log("Firestore data store cleared (products, godownProducts, orders, franchiseInvoices, metadata).");
  storeInitialized = false; 
};

export const seedData = async () => {
  console.warn("Executing seedData for Firestore: This will clear existing data and re-seed.");
  await _clearDataStore(); 
  await initializeDataStore(); 
};

