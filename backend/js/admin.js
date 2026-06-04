/**
 * Admin Backend Logic
 * Firebase v9+ Modular Web SDK
 * 
 * FUNCTIONS:
 * - checkAdminAuth() - Verify user is admin and logged in
 * - addProduct(productData) - Add new product to Firestore
 * - getAllOrders() - Fetch all orders from Firestore
 * - getInventory() - Fetch all products for inventory
 * - getAllUsers() - Fetch all registered users
 * - getAdminStats() - Get dashboard statistics
 * - getRecentOrders(limit) - Get recent orders
 * 
 * DEPENDENCIES:
 * - firebase-config.js (db and auth instances)
 * - auth.js (authentication functions)
 * 
 * USAGE:
 * import { checkAdminAuth, addProduct, getAllOrders } from './admin.js';
 */

'use strict';

import { auth, db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// =============================================
// CONFIGURATION
// =============================================

const ADMIN_EMAIL = 'admin@zonix.com'; // Must match login page ADMIN_EMAIL

// =============================================
// AUTH GUARD
// =============================================

/**
 * Check if current user is authenticated and is admin
 * Redirects to login if not authorized
 * @returns {Promise<Object>} User object if authorized
 * @throws {Error} If not authorized
 */
export async function checkAdminAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        console.warn('✗ No user logged in');
        window.location.href = '../login/';
        reject(new Error('User not authenticated'));
        return;
      }

      if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        console.warn('✗ Unauthorized admin access attempt:', user.email);
        window.location.href = '../login/';
        reject(new Error('Unauthorized admin access'));
        return;
      }

      console.log('✓ Admin authorized:', user.email);
      resolve({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Admin'
      });
    });
  });
}

// =============================================
// PRODUCT FUNCTIONS
// =============================================

/**
 * Add a new product to the database
 * @param {Object} productData - Product information
 * @param {string} productData.name - Product name
 * @param {number} productData.price - Product price
 * @param {number} productData.stock - Stock quantity
 * @param {string} productData.image - Product image URL
 * @param {string} productData.description - Product description
 * @param {string} productData.category - Product category (optional)
 * @returns {Promise<Object>} Created product with ID
 * @throws {Error} If validation fails or database operation fails
 */
export async function addProduct(productData) {
  try {
    // Validate required fields
    if (!productData.name || !productData.price || productData.stock === undefined || 
        !productData.image || !productData.description) {
      throw new Error('Missing required fields: name, price, stock, image, description');
    }

    // Validate data types
    if (typeof productData.name !== 'string' || productData.name.trim().length === 0) {
      throw new Error('Product name must be a non-empty string');
    }

    if (typeof productData.price !== 'number' || productData.price < 0) {
      throw new Error('Product price must be a non-negative number');
    }

    if (typeof productData.stock !== 'number' || productData.stock < 0) {
      throw new Error('Stock quantity must be a non-negative number');
    }

    if (typeof productData.image !== 'string' || productData.image.trim().length === 0) {
      throw new Error('Image URL must be a non-empty string');
    }

    if (typeof productData.description !== 'string' || productData.description.trim().length === 0) {
      throw new Error('Description must be a non-empty string');
    }

    console.log('Adding new product:', productData.name);

    // Prepare product object
    const newProduct = {
      name: productData.name.trim(),
      price: parseFloat(productData.price),
      stock: parseInt(productData.stock),
      image: productData.image.trim(),
      description: productData.description.trim(),
      category: productData.category ? productData.category.trim() : 'Uncategorized',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    };

    // Add to Firestore
    const productsRef = collection(db, 'products');
    const docRef = await addDoc(productsRef, newProduct);

    console.log('✓ Product added successfully:', docRef.id);

    return {
      id: docRef.id,
      ...newProduct,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('✗ Error adding product:', error.message);
    throw error;
  }
}

/**
 * Fetch all products from inventory
 * @returns {Promise<Array>} Array of products with IDs
 * @throws {Error} If fetch fails
 */
export async function getInventory() {
  try {
    console.log('Fetching inventory...');

    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const products = [];
    snapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✓ Fetched ${products.length} products`);
    return products;
  } catch (error) {
    console.error('✗ Error fetching inventory:', error.message);
    throw error;
  }
}

// =============================================

export async function updateProduct(productId, updates) {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    console.log(`✓ Product ${productId} updated`);
  } catch (error) {
    console.error(`✗ Error updating product ${productId}:`, error.message);
    throw error;
  }
}

export async function deleteProduct(productId) {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
    console.log(`✓ Product ${productId} deleted`);
  } catch (error) {
    console.error(`✗ Error deleting product ${productId}:`, error.message);
    throw error;
  }
}

// =============================================
// ORDER FUNCTIONS
// =============================================

/**
 * Fetch all orders from the database
 * @returns {Promise<Array>} Array of orders with IDs
 * @throws {Error} If fetch fails
 */
export async function getAllOrders() {
  try {
    console.log('Fetching all orders...');

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const orders = [];
    snapshot.forEach((doc) => {
      const orderData = doc.data();
      orders.push({
        id: doc.id,
        orderId: orderData.orderId || doc.id,
        userId: orderData.userId || 'Unknown',
        userEmail: orderData.userEmail || 'Unknown',
        items: orderData.items || [],
        totalAmount: orderData.totalAmount || 0,
        status: orderData.status || 'pending',
        createdAt: orderData.createdAt,
        ...orderData
      });
    });

    console.log(`✓ Fetched ${orders.length} orders`);
    return orders;
  } catch (error) {
    console.error('✗ Error fetching orders:', error.message);
    throw error;
  }
}

/**
 * Fetch recent orders for dashboard
 * @param {number} limitCount - Number of recent orders to fetch
 * @returns {Promise<Array>} Array of recent orders
 * @throws {Error} If fetch fails
 */
export async function getRecentOrders(limitCount = 5) {
  try {
    console.log(`Fetching ${limitCount} recent orders...`);

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    const orders = [];
    snapshot.forEach((doc) => {
      const orderData = doc.data();
      orders.push({
        id: doc.id,
        orderId: orderData.orderId || doc.id,
        userEmail: orderData.userEmail || 'Unknown',
        totalAmount: orderData.totalAmount || 0,
        status: orderData.status || 'pending',
        createdAt: orderData.createdAt,
        ...orderData
      });
    });

    console.log(`✓ Fetched ${orders.length} recent orders`);
    return orders;
  } catch (error) {
    console.error('✗ Error fetching recent orders:', error.message);
    throw error;
  }
}

// =============================================

export async function updateOrderStatus(orderId, newStatus) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    console.log(`✓ Order ${orderId} status updated to ${newStatus}`);
  } catch (error) {
    console.error(`✗ Error updating order ${orderId} status:`, error.message);
    throw error;
  }
}

// =============================================
// USER FUNCTIONS
// =============================================

/**
 * Fetch all registered users
 * Note: Firebase Authentication doesn't allow direct user listing via client SDK
 * This function attempts to get users from a custom 'users' collection
 * @returns {Promise<Array>} Array of users
 * @throws {Error} If fetch fails
 */
export async function getAllUsers() {
  try {
    console.log('Fetching all users...');

    // Try to fetch from custom users collection
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    const users = [];
    snapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        email: userData.email || 'Unknown',
        displayName: userData.displayName || 'User',
        createdAt: userData.createdAt,
        ...userData
      });
    });

    console.log(`✓ Fetched ${users.length} users`);
    return users;
  } catch (error) {
    console.error('✗ Error fetching users:', error.message);
    throw error;
  }
}

// =============================================

export async function deleteUser(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    console.log(`✓ User ${userId} deleted from collection`);
  } catch (error) {
    console.error(`✗ Error deleting user ${userId}:`, error.message);
    throw error;
  }
}

// =============================================
// STATISTICS FUNCTIONS
// =============================================

/**
 * Get admin dashboard statistics
 * @returns {Promise<Object>} Statistics object with counts and totals
 * @throws {Error} If fetch fails
 */
export async function getAdminStats() {
  try {
    console.log('Calculating admin statistics...');

    // Get total products
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
    const totalProducts = productsSnapshot.size;

    // Get total orders and revenue
    const ordersRef = collection(db, 'orders');
    const ordersSnapshot = await getDocs(ordersRef);
    const totalOrders = ordersSnapshot.size;
    
    let totalRevenue = 0;
    ordersSnapshot.forEach((doc) => {
      const amount = doc.data().totalAmount || 0;
      totalRevenue += amount;
    });

    // Get total users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const totalUsers = usersSnapshot.size;

    const stats = {
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenue,
      timestamp: new Date()
    };

    console.log('✓ Statistics calculated:', stats);
    return stats;
  } catch (error) {
    console.error('✗ Error calculating statistics:', error.message);
    throw error;
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Format timestamp for display
 * @param {Timestamp} timestamp - Firebase timestamp
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Format currency for display
 * @param {number} amount - Amount in rupees
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  if (!amount) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Get status color class
 * @param {string} status - Order status
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
  const statusMap = {
    'pending': 'pending',
    'confirmed': 'confirmed',
    'shipped': 'shipped',
    'in-stock': 'in-stock',
    'low-stock': 'low-stock',
    'out-of-stock': 'out-of-stock'
  };
  return statusMap[status] || 'pending';
}
