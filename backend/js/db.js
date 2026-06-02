/**
 * Firebase Firestore Database Module
 * Uses Firebase v9+ Modular Web SDK
 * 
 * FUNCTIONS:
 * - getProducts()
 * - getProductById(productId)
 * - addToCart(userId, productId, quantity)
 * - getCartItems(userId)
 * - removeFromCart(userId, productId)
 * - clearCart(userId)
 * - createOrder(userId, orderData)
 * - getOrders(userId)
 * - updateOrderStatus(orderId, status)
 * 
 * COLLECTION STRUCTURE:
 * /products - Product catalog
 * /users/{userId}/cart - User's cart items
 * /orders - Order records
 * /users/{userId}/addresses - Saved addresses
 * 
 * DEPENDENCIES:
 * - firebase-config.js (db instance)
 * 
 * USAGE:
 * import { getProducts, addToCart, createOrder } from './db.js';
 */

'use strict';

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  Timestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// =============================================
// PRODUCT FUNCTIONS
// =============================================

/**
 * Fetch all products from Firestore
 * @returns {Promise<Array>} Array of product objects
 * @throws {Error} If fetch fails
 */
export async function getProducts() {
  try {
    console.log('Fetching all products');
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
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
    console.error('✗ Error fetching products:', error.message);
    throw error;
  }
}

/**
 * Fetch a single product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Product object or null
 * @throws {Error} If fetch fails
 */
export async function getProductById(productId) {
  try {
    console.log('Fetching product:', productId);
    const productRef = doc(db, 'products', productId);
    const docSnap = await getDoc(productRef);

    if (!docSnap.exists()) {
      console.warn('Product not found:', productId);
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } catch (error) {
    console.error('✗ Error fetching product:', error.message);
    throw error;
  }
}

// =============================================
// CART FUNCTIONS
// =============================================

/**
 * Add item to user's cart
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add (default: 1)
 * @returns {Promise<Object>} Cart item object
 * @throws {Error} If operation fails
 */
export async function addToCart(userId, productId, quantity = 1) {
  try {
    if (!userId || !productId || quantity < 1) {
      throw new Error('Invalid userId, productId, or quantity');
    }

    console.log(`Adding to cart: user=${userId}, product=${productId}, qty=${quantity}`);

    // Get product to verify it exists and get price
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Reference to user's cart item
    const cartItemRef = doc(db, 'users', userId, 'cart', productId);
    const cartItemSnap = await getDoc(cartItemRef);

    if (cartItemSnap.exists()) {
      // Item exists - update quantity
      const currentQty = cartItemSnap.data().quantity || 0;
      await updateDoc(cartItemRef, {
        quantity: currentQty + quantity,
        updatedAt: Timestamp.now()
      });
      console.log(`✓ Cart item quantity updated: ${currentQty + quantity}`);
    } else {
      // New item - create cart entry
      await setDoc(cartItemRef, {
        productId: productId,
        name: product.name,
        price: product.price,
        image: product.image || '',
        quantity: quantity,
        addedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log('✓ Item added to cart');
    }

    return {
      productId: productId,
      quantity: quantity,
      price: product.price
    };
  } catch (error) {
    console.error('✗ Error adding to cart:', error.message);
    throw error;
  }
}

/**
 * Get all cart items for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of cart items
 * @throws {Error} If fetch fails
 */
export async function getCartItems(userId) {
  try {
    console.log('Fetching cart for user:', userId);
    
    const cartRef = collection(db, 'users', userId, 'cart');
    const snapshot = await getDocs(cartRef);

    const cartItems = [];
    snapshot.forEach((doc) => {
      cartItems.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✓ Fetched ${cartItems.length} cart items`);
    return cartItems;
  } catch (error) {
    console.error('✗ Error fetching cart:', error.message);
    throw error;
  }
}

/**
 * Remove item from user's cart
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function removeFromCart(userId, productId) {
  try {
    console.log(`Removing from cart: user=${userId}, product=${productId}`);
    
    const cartItemRef = doc(db, 'users', userId, 'cart', productId);
    await deleteDoc(cartItemRef);
    
    console.log('✓ Item removed from cart');
  } catch (error) {
    console.error('✗ Error removing from cart:', error.message);
    throw error;
  }
}

/**
 * Clear entire cart for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function clearCart(userId) {
  try {
    console.log('Clearing cart for user:', userId);
    
    const cartItems = await getCartItems(userId);
    
    // Delete all cart items
    const deletePromises = cartItems.map(item =>
      deleteDoc(doc(db, 'users', userId, 'cart', item.id))
    );
    
    await Promise.all(deletePromises);
    console.log('✓ Cart cleared');
  } catch (error) {
    console.error('✗ Error clearing cart:', error.message);
    throw error;
  }
}

// =============================================
// ORDER FUNCTIONS
// =============================================

/**
 * Create a new order from cart items
 * @param {string} userId - User ID
 * @param {Object} orderData - Order information
 *   - items: Array of {productId, quantity, price}
 *   - shippingAddress: {name, email, street, city, state, zip, country, phone}
 *   - shippingMethod: 'standard' | 'express' | 'overnight'
 *   - paymentMethod: 'card' | 'upi' | 'wallet'
 *   - subtotal: number
 *   - shippingCost: number
 *   - tax: number
 *   - total: number
 * @returns {Promise<Object>} Order object with orderId
 * @throws {Error} If order creation fails
 */
export async function createOrder(userId, orderData) {
  try {
    if (!userId || !orderData) {
      throw new Error('Invalid userId or orderData');
    }

    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    console.log('Creating order for user:', userId);

    // Use transaction to ensure cart is cleared after order is created
    const orderId = await runTransaction(db, async (transaction) => {
      // Create order document
      const ordersRef = collection(db, 'orders');
      const orderDoc = await addDoc(ordersRef, {
        userId: userId,
        orderNumber: `ORD-${Date.now()}`,
        items: orderData.items,
        shippingAddress: orderData.shippingAddress,
        shippingMethod: orderData.shippingMethod,
        paymentMethod: orderData.paymentMethod,
        subtotal: orderData.subtotal,
        shippingCost: orderData.shippingCost || 0,
        tax: orderData.tax || 0,
        total: orderData.total,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return orderDoc.id;
    });

    // Clear user's cart after successful order
    await clearCart(userId);

    console.log('✓ Order created:', orderId);
    return {
      orderId: orderId,
      orderNumber: `ORD-${Date.now()}`,
      status: 'pending',
      total: orderData.total,
      createdAt: new Date()
    };
  } catch (error) {
    console.error('✗ Error creating order:', error.message);
    throw error;
  }
}

/**
 * Get all orders for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of order objects
 * @throws {Error} If fetch fails
 */
export async function getOrders(userId) {
  try {
    console.log('Fetching orders for user:', userId);
    
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const orders = [];
    
    snapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
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
 * Get a single order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order object or null
 * @throws {Error} If fetch fails
 */
export async function getOrderById(orderId) {
  try {
    console.log('Fetching order:', orderId);
    
    const orderRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(orderRef);

    if (!docSnap.exists()) {
      console.warn('Order not found:', orderId);
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate()
    };
  } catch (error) {
    console.error('✗ Error fetching order:', error.message);
    throw error;
  }
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
 * @returns {Promise<void>}
 * @throws {Error} If update fails
 */
export async function updateOrderStatus(orderId, status) {
  try {
    console.log('Updating order status:', orderId, '->', status);
    
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: status,
      updatedAt: Timestamp.now()
    });

    console.log('✓ Order status updated');
  } catch (error) {
    console.error('✗ Error updating order status:', error.message);
    throw error;
  }
}

// =============================================
// USER FUNCTIONS
// =============================================

/**
 * Create or update user profile
 * @param {string} userId - User ID
 * @param {Object} userData - User information
 * @returns {Promise<Object>} User object
 * @throws {Error} If operation fails
 */
export async function saveUserProfile(userId, userData) {
  try {
    console.log('Saving user profile:', userId);

    const userRef = doc(db, 'users', userId);
    
    await setDoc(userRef, {
      email: userData.email,
      displayName: userData.displayName || 'User',
      phone: userData.phone || '',
      profilePicture: userData.profilePicture || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...userData
    }, { merge: true });

    console.log('✓ User profile saved');
    return { id: userId, ...userData };
  } catch (error) {
    console.error('✗ Error saving user profile:', error.message);
    throw error;
  }
}

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object or null
 * @throws {Error} If fetch fails
 */
export async function getUserProfile(userId) {
  try {
    console.log('Fetching user profile:', userId);

    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      console.warn('User profile not found:', userId);
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } catch (error) {
    console.error('✗ Error fetching user profile:', error.message);
    throw error;
  }
}

// =============================================
// ADDRESS FUNCTIONS
// =============================================

/**
 * Save an address for a user
 * @param {string} userId - User ID
 * @param {Object} addressData - Address information
 * @returns {Promise<Object>} Address object with ID
 * @throws {Error} If operation fails
 */
export async function saveAddress(userId, addressData) {
  try {
    console.log('Saving address for user:', userId);

    const addressesRef = collection(db, 'users', userId, 'addresses');
    const docRef = await addDoc(addressesRef, {
      ...addressData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✓ Address saved');
    return { id: docRef.id, ...addressData };
  } catch (error) {
    console.error('✗ Error saving address:', error.message);
    throw error;
  }
}

/**
 * Get all addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of addresses
 * @throws {Error} If fetch fails
 */
export async function getSavedAddresses(userId) {
  try {
    console.log('Fetching addresses for user:', userId);

    const addressesRef = collection(db, 'users', userId, 'addresses');
    const snapshot = await getDocs(addressesRef);

    const addresses = [];
    snapshot.forEach((doc) => {
      addresses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✓ Fetched ${addresses.length} addresses`);
    return addresses;
  } catch (error) {
    console.error('✗ Error fetching addresses:', error.message);
    throw error;
  }
}

/**
 * Delete an address
 * @param {string} userId - User ID
 * @param {string} addressId - Address ID
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function deleteAddress(userId, addressId) {
  try {
    console.log('Deleting address:', addressId);

    const addressRef = doc(db, 'users', userId, 'addresses', addressId);
    await deleteDoc(addressRef);

    console.log('✓ Address deleted');
  } catch (error) {
    console.error('✗ Error deleting address:', error.message);
    throw error;
  }
}

// =============================================
// EXPORTS
// =============================================

export default {
  getProducts,
  getProductById,
  addToCart,
  getCartItems,
  removeFromCart,
  clearCart,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  saveUserProfile,
  getUserProfile,
  saveAddress,
  getSavedAddresses,
  deleteAddress
};
    if (!['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      throw new Error('Invalid order status');
    }

    console.log(`Updating order ${orderId} status to ${status}`);
    
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: status,
      updatedAt: Timestamp.now()
    });

    console.log('✓ Order status updated');
  } catch (error) {
    console.error('✗ Error updating order:', error.message);
    throw error;
  }
}

// =============================================
// ADDRESS FUNCTIONS
// =============================================

/**
 * Save an address for a user
 * @param {string} userId - User ID
 * @param {Object} addressData - Address information
 *   - name: string
 *   - street: string
 *   - city: string
 *   - state: string
 *   - zip: string
 *   - country: string
 *   - phone: string
 *   - isDefault: boolean (optional)
 * @returns {Promise<Object>} Saved address with ID
 * @throws {Error} If save fails
 */
export async function saveAddress(userId, addressData) {
  try {
    if (!userId || !addressData) {
      throw new Error('Invalid userId or addressData');
    }

    console.log('Saving address for user:', userId);
    
    const addressesRef = collection(db, 'users', userId, 'addresses');
    const addressDoc = await addDoc(addressesRef, {
      ...addressData,
      isDefault: addressData.isDefault || false,
      createdAt: Timestamp.now()
    });

    console.log('✓ Address saved:', addressDoc.id);
    return {
      id: addressDoc.id,
      ...addressData
    };
  } catch (error) {
    console.error('✗ Error saving address:', error.message);
    throw error;
  }
}

/**
 * Get all saved addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of address objects
 * @throws {Error} If fetch fails
 */
export async function getSavedAddresses(userId) {
  try {
    console.log('Fetching addresses for user:', userId);
    
    const addressesRef = collection(db, 'users', userId, 'addresses');
    const snapshot = await getDocs(addressesRef);

    const addresses = [];
    snapshot.forEach((doc) => {
      addresses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✓ Fetched ${addresses.length} addresses`);
    return addresses;
  } catch (error) {
    console.error('✗ Error fetching addresses:', error.message);
    throw error;
  }
}

export default {
  getProducts,
  getProductById,
  addToCart,
  getCartItems,
  removeFromCart,
  clearCart,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  saveAddress,
  getSavedAddresses
};
