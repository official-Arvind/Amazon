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

const SUPER_ADMIN_EMAIL = 'admin@zonix.com';
const ADMIN_ROLES = { SUPER_ADMIN: 'super_admin', ADMIN: 'admin', MODERATOR: 'moderator' };

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

      // Check if user is the hardcoded super admin
      if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        console.log('✓ Super admin authenticated via email match:', user.email);
        
        // Try to bootstrap/update the doc if possible, but don't fail if permissions are missing
        try {
          await setDoc(doc(db, 'admins', user.uid), {
            email: user.email,
            role: ADMIN_ROLES.SUPER_ADMIN,
            displayName: user.displayName || 'Super Admin',
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn('Could not write admin doc, likely due to Firestore rules. Proceeding anyway.');
        }

        resolve({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Super Admin',
          role: ADMIN_ROLES.SUPER_ADMIN,
          permissions: getPermissions(ADMIN_ROLES.SUPER_ADMIN)
        });
        return;
      }

      // Check if user is in the admins collection
      try {
        const adminRef = doc(db, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
          const adminData = adminSnap.data();
          console.log('✓ Admin authorized:', user.email, 'Role:', adminData.role);
          resolve({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Admin',
            role: adminData.role,
            permissions: getPermissions(adminData.role)
          });
          return;
        }

        console.warn('✗ Not an admin:', user.email);
        window.location.href = '../login/';
        reject(new Error('Unauthorized admin access'));
      } catch (error) {
        console.error('✗ Admin auth check failed:', error);
        reject(error);
      }
    });
  });
}

function getPermissions(role) {
  switch (role) {
    case ADMIN_ROLES.SUPER_ADMIN:
      return { manageProducts: true, manageOrders: true, manageUsers: true, manageAdmins: true, viewStats: true };
    case ADMIN_ROLES.ADMIN:
      return { manageProducts: true, manageOrders: true, manageUsers: true, manageAdmins: false, viewStats: true };
    case ADMIN_ROLES.MODERATOR:
      return { manageProducts: false, manageOrders: true, manageUsers: true, manageAdmins: false, viewStats: true };
    default:
      return { manageProducts: false, manageOrders: false, manageUsers: false, manageAdmins: false, viewStats: false };
  }
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
    'delivered': 'delivered',
    'in-stock': 'in-stock',
    'low-stock': 'low-stock',
    'out-of-stock': 'out-of-stock'
  };
  return statusMap[status] || 'pending';
}

// =============================================
// ADMIN MANAGEMENT (Super Admin Only)
// =============================================

/**
 * Get all admin accounts
 */
export async function getAdminAccounts() {
  try {
    const adminsRef = collection(db, 'admins');
    const snapshot = await getDocs(adminsRef);
    const admins = [];
    snapshot.forEach((doc) => {
      admins.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✓ Fetched ${admins.length} admin accounts`);
    return admins;
  } catch (error) {
    console.error('✗ Error fetching admins:', error.message);
    throw error;
  }
}

/**
 * Create a new admin account (adds to admins collection)
 * Note: The user must already exist in Firebase Auth (they sign up normally first)
 */
export async function createAdminAccount(email, role, createdByEmail) {
  try {
    if (!email || !role) throw new Error('Email and role are required');
    if (!Object.values(ADMIN_ROLES).includes(role)) throw new Error('Invalid role');
    if (role === ADMIN_ROLES.SUPER_ADMIN) throw new Error('Cannot create another super admin');

    // Check if admin already exists by email
    const adminsRef = collection(db, 'admins');
    const q = query(adminsRef, where('email', '==', email.toLowerCase()));
    const existing = await getDocs(q);
    if (!existing.empty) throw new Error('Admin with this email already exists');

    // Store with a generated ID (will be linked when user logs in)
    const adminDoc = await addDoc(adminsRef, {
      email: email.toLowerCase(),
      role: role,
      displayName: email.split('@')[0],
      createdAt: serverTimestamp(),
      createdBy: createdByEmail || 'super_admin',
      status: 'active'
    });

    console.log('✓ Admin account created:', email, 'Role:', role);
    return { id: adminDoc.id, email, role };
  } catch (error) {
    console.error('✗ Error creating admin:', error.message);
    throw error;
  }
}

/**
 * Update admin role
 */
export async function updateAdminRole(adminId, newRole) {
  try {
    if (!Object.values(ADMIN_ROLES).includes(newRole)) throw new Error('Invalid role');
    const adminRef = doc(db, 'admins', adminId);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) throw new Error('Admin not found');
    if (adminSnap.data().role === ADMIN_ROLES.SUPER_ADMIN) throw new Error('Cannot change super admin role');

    await updateDoc(adminRef, { role: newRole, updatedAt: serverTimestamp() });
    console.log('✓ Admin role updated:', adminId, '->', newRole);
  } catch (error) {
    console.error('✗ Error updating admin role:', error.message);
    throw error;
  }
}

/**
 * Delete admin account
 */
export async function deleteAdminAccount(adminId) {
  try {
    const adminRef = doc(db, 'admins', adminId);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) throw new Error('Admin not found');
    if (adminSnap.data().role === ADMIN_ROLES.SUPER_ADMIN) throw new Error('Cannot delete super admin');

    await deleteDoc(adminRef);
    console.log('✓ Admin account deleted:', adminId);
  } catch (error) {
    console.error('✗ Error deleting admin:', error.message);
    throw error;
  }
}

/**
 * Get all guest orders
 */
export async function getGuestOrders() {
  try {
    const ordersRef = collection(db, 'guestOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate(), isGuest: true });
    });
    console.log(`✓ Fetched ${orders.length} guest orders`);
    return orders;
  } catch (error) {
    console.error('✗ Error fetching guest orders:', error.message);
    return [];
  }
}
