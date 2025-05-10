'use server';

import type { Product, Order, OrderItem } from '@/types';
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
  setDoc
} from 'firebase/firestore';

// Firestore collection references
const productsCollection = collection(db, 'products');
const ordersCollection = collection(db, 'orders');
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
  if (data.createdAt) data.createdAt = Timestamp.fromDate(new Date(data.createdAt));
  if (data.updatedAt) data.updatedAt = Timestamp.fromDate(new Date(data.updatedAt));
  else data.updatedAt = serverTimestamp(); // Set/update on write
  return data;
};

const toFirestoreOrderData = (orderData: Partial<Order>): any => {
    const data: any = { ...orderData };
    if (data.createdAt) data.createdAt = Timestamp.fromDate(new Date(data.createdAt));
    else data.createdAt = serverTimestamp();
    
    if (data.items && Array.isArray(data.items)) {
        data.items = data.items.map((item: OrderItem) => ({
            ...item,
            // Ensure numeric types are correct if coming from string sources
            price: Number(item.price),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
        }));
    }
    data.totalAmount = Number(data.totalAmount);
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
  };
};

type SeedOrderItem = Omit<OrderItem, 'productId'> & { productUniqueId: string, name: string };

const internalSeedInitialData = async () => {
  console.log("Seeding initial product and order data to Firestore...");
  const seedBatch = writeBatch(db);

  const productsToSeed = [
    { name: 'Organic Apples', price: 2.99, quantity: 50, uniqueId: 'PROD-APPLE-001' },
    { name: 'Brown Rice (1kg)', price: 5.49, quantity: 30, uniqueId: 'PROD-RICE-BR01' },
    { name: 'Almond Milk', price: 3.19, quantity: 5, uniqueId: 'PROD-MILK-ALM01' },
    { name: 'Whole Wheat Bread', price: 4.00, quantity: 15, uniqueId: 'PROD-BREAD-WW01' },
    { name: 'Organic Bananas (Bunch)', price: 1.99, quantity: 60, uniqueId: 'PROD-BANANA-001' },
    { name: 'Free-range Eggs (Dozen)', price: 6.50, quantity: 8, uniqueId: 'PROD-EGGS-FR01' },
  ];

  const productRefs: { [key: string]: string } = {}; // To store Firestore IDs for seeded products

  for (const prodData of productsToSeed) {
    const productRef = doc(productsCollection); // Auto-generate ID
    productRefs[prodData.uniqueId] = productRef.id; // Store ID by uniqueId for order items
    seedBatch.set(productRef, toFirestoreProductData({ ...prodData, createdAt: new Date(), updatedAt: new Date() }));
  }

  // Seed Orders
  const orderItems1: SeedOrderItem[] = [
    { productUniqueId: 'PROD-APPLE-001', name: 'Organic Apples', price: 2.99, quantity: 2, subtotal: 5.98, stockQuantityBeforeOrder: 50 },
    { productUniqueId: 'PROD-RICE-BR01', name: 'Brown Rice (1kg)', price: 5.49, quantity: 1, subtotal: 5.49, stockQuantityBeforeOrder: 30 },
  ];
  const order1Data = {
    orderNumber: 'ORD-0001',
    items: orderItems1.map(item => ({ ...item, productId: productRefs[item.productUniqueId] })),
    totalAmount: orderItems1.reduce((sum, item) => sum + item.subtotal, 0),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  };
  seedBatch.set(doc(ordersCollection), toFirestoreOrderData(order1Data));


  const orderItems2: SeedOrderItem[] = [
    { productUniqueId: 'PROD-MILK-ALM01', name: 'Almond Milk', price: 3.19, quantity: 3, subtotal: 9.57, stockQuantityBeforeOrder: 5 },
  ];
   const order2Data = {
    orderNumber: 'ORD-0002',
    items: orderItems2.map(item => ({ ...item, productId: productRefs[item.productUniqueId] })),
    totalAmount: orderItems2.reduce((sum, item) => sum + item.subtotal, 0),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  };
  seedBatch.set(doc(ordersCollection), toFirestoreOrderData(order2Data));
  
  await seedBatch.commit();
  
  // Mark as seeded
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
        // Further check if collections are actually empty as a fallback
        const productsSnap = await getDocs(query(productsCollection, limit(1)));
        const ordersSnap = await getDocs(query(ordersCollection, limit(1)));

        if (productsSnap.empty && ordersSnap.empty) {
            console.log("Collections are empty. Proceeding to seed initial data.");
            await internalSeedInitialData();
        } else {
            console.log("Collections are not empty, but seeding flag was missing. Setting flag.");
             // Mark as seeded if collections are not empty but flag was missing
            await setDoc(seededDocRef, { seeded: true, lastSeeded: serverTimestamp() });
        }
    } else {
        console.log("Firestore already seeded.");
    }
  } catch (error) {
    console.error("Error during Firestore initialization or seeding check:", error);
    // Fallback: If metadata check fails, but collections might exist, don't re-seed blindly.
    // This prevents data loss if the 'metadata' collection itself has issues.
    // A more robust solution might involve manual intervention or more sophisticated checks.
  }
  
  storeInitialized = true; 
  if (process.env.NODE_ENV === 'development') {
    if (!(global as any).dataStoreInitializedLog) {
        (global as any).dataStoreInitializedLog = true;
        console.log("Firestore data store initialization logic completed for development.");
    }
  }
};


// --- Product Functions ---
export const getProducts = async (filters?: { name?: string, uniqueId?: string, limit?: number, orderBy?: string, orderDirection?: 'asc' | 'desc' }): Promise<Product[]> => {
  await initializeDataStore();
  let q = query(productsCollection);

  if (filters?.name) {
    // Firestore doesn't support case-insensitive `includes` directly.
    // For a simple prefix search, you can use >= and < trick, but for general 'includes',
    // you'd typically sync to a search service or do client-side filtering for small datasets.
    // Here, we'll fetch and filter, or use a more complex query if needed.
    // This is NOT efficient for large datasets.
  }
  if (filters?.uniqueId) {
    q = query(q, where('uniqueId', '==', filters.uniqueId));
  }

  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    q = query(q, orderBy(filters.orderBy, filters.orderDirection));
  }
  
  if (filters?.limit) {
    q = query(q, limit(filters.limit));
  }
  
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
  const dataWithTimestamps = toFirestoreProductData({ ...productData, createdAt: new Date() });
  const docRef = await addDoc(productsCollection, dataWithTimestamps);
  const newProductSnap = await getDoc(docRef);
  return mapDocToProduct(newProductSnap);
};

export const updateProduct = async (id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<Product | undefined> => {
  await initializeDataStore();
  const docRef = doc(db, 'products', id);
  const dataToUpdate = toFirestoreProductData(updates); // Ensures updatedAt is handled
  await updateDoc(docRef, dataToUpdate);
  const updatedSnap = await getDoc(docRef);
  return updatedSnap.exists() ? mapDocToProduct(updatedSnap) : undefined;
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

// --- Order Functions ---
export const getOrders = async (filters?: { startDate?: Date, endDate?: Date, orderNumber?: string, limit?: number, orderBy?: string, orderDirection?: 'desc' | 'asc' }): Promise<Order[]> => {
  await initializeDataStore();
  let q = query(ordersCollection);

  if (filters?.startDate) {
    q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
  }
  if (filters?.endDate) {
    const inclusiveEndDate = new Date(filters.endDate);
    inclusiveEndDate.setHours(23, 59, 59, 999); // Make end date inclusive for the entire day
    q = query(q, where('createdAt', '<=', Timestamp.fromDate(inclusiveEndDate)));
  }
  
  if (filters?.orderBy && (filters.orderDirection === 'asc' || filters.orderDirection === 'desc')) {
    q = query(q, orderBy(filters.orderBy, filters.orderDirection));
  } else {
    // Default sort if not specified
    q = query(q, orderBy('createdAt', 'desc'));
  }
  
  if (filters?.limit) {
    q = query(q, limit(filters.limit));
  }
  
  const snapshot = await getDocs(q);
  let result = snapshot.docs.map(mapDocToOrder);

  if (filters?.orderNumber) {
    // Firestore filtering for partial string match (like 'includes') is complex.
    // Fetching and then filtering client-side or server-side after fetch for small datasets.
    // This is NOT efficient for large datasets.
    result = result.filter(o => o.orderNumber.toLowerCase().includes(filters.orderNumber!.toLowerCase()));
  }

  return result;
};


export const addOrder = async (orderData: Omit<Order, 'id'>): Promise<Order> => {
  await initializeDataStore();
  const dataWithTimestamp = toFirestoreOrderData({ ...orderData, createdAt: new Date(orderData.createdAt) });
  const docRef = await addDoc(ordersCollection, dataWithTimestamp);
  const newOrderSnap = await getDoc(docRef);
  return mapDocToOrder(newOrderSnap);
};

// For testing or admin purposes

export const _clearDataStore = async () => {
  console.warn("Clearing Firestore data store. This is destructive.");
  const productsSnap = await getDocs(productsCollection);
  const ordersSnap = await getDocs(ordersCollection);
  const metadataSnap = await getDocs(metadataCollection);

  const batch = writeBatch(db);
  productsSnap.docs.forEach(doc => batch.delete(doc.ref));
  ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
  metadataSnap.docs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  console.log("Firestore data store cleared (products, orders, metadata).");
  storeInitialized = false; // Allow re-initialization if seeded again
};

export const seedData = async () => {
  console.warn("Executing seedData for Firestore: This will clear existing data and re-seed.");
  await _clearDataStore(); // Clear existing data first
  await initializeDataStore(); // This will now run the seeding logic as the store is empty and 'seeded' flag is gone.
};

    