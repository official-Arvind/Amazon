/**
 * Firebase Firestore Database Module
 * Uses Firebase v9+ Modular Web SDK
 */

'use strict';

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, 
  query, where, orderBy, limit, arrayUnion, Timestamp, runTransaction
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// =============================================
// PRODUCT FUNCTIONS
// =============================================

export async function getProducts() {
  try {
    console.log('Fetching all products');
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    const products = [];
    snapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });

    console.log(`✓ Fetched ${products.length} products`);
    return products;
  } catch (error) {
    console.error('✗ Error fetching products:', error.message);
    throw error;
  }
}

export async function getProductById(productId) {
  try {
    console.log('Fetching product:', productId);
    const productRef = doc(db, 'products', productId);
    const docSnap = await getDoc(productRef);

    if (!docSnap.exists()) {
      console.warn('Product not found:', productId);
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('✗ Error fetching product:', error.message);
    throw error;
  }
}

// =============================================
// REVIEWS FUNCTIONS
// =============================================

export async function addReview(productId, reviewData) {
  try {
    console.log('Adding review to product:', productId);
    const reviewsRef = collection(db, 'products', productId, 'reviews');
    const docRef = await addDoc(reviewsRef, {
      userId: reviewData.userId,
      userName: reviewData.userName || 'Anonymous',
      rating: Number(reviewData.rating),
      title: reviewData.title || '',
      text: reviewData.text || '',
      createdAt: Timestamp.now(),
      helpful: 0
    });
    
    // Note: To implement a real aggregated rating, you would use a transaction 
    // to update the product document's average rating and review count.
    
    console.log('✓ Review added:', docRef.id);
    return { id: docRef.id, ...reviewData };
  } catch (error) {
    console.error('✗ Error adding review:', error.message);
    throw error;
  }
}

export async function getReviews(productId) {
  try {
    console.log('Fetching reviews for product:', productId);
    const reviewsRef = collection(db, 'products', productId, 'reviews');
    const q = query(reviewsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✓ Fetched ${reviews.length} reviews`);
    return reviews;
  } catch (error) {
    console.error('✗ Error fetching reviews:', error.message);
    throw error;
  }
}

// =============================================
// CART FUNCTIONS
// =============================================

export async function addToCart(userId, productId, quantity = 1) {
  try {
    if (!userId || !productId || quantity < 1) {
      throw new Error('Invalid userId, productId, or quantity');
    }

    console.log(`Adding to cart: user=${userId}, product=${productId}, qty=${quantity}`);

    const product = await getProductById(productId);
    if (!product) throw new Error('Product not found');

    const cartItemRef = doc(db, 'users', userId, 'cart', productId);
    const cartItemSnap = await getDoc(cartItemRef);

    if (cartItemSnap.exists()) {
      const currentQty = cartItemSnap.data().quantity || 0;
      await updateDoc(cartItemRef, {
        quantity: currentQty + quantity,
        updatedAt: Timestamp.now()
      });
      console.log(`✓ Cart item quantity updated: ${currentQty + quantity}`);
    } else {
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

    return { productId, quantity, price: product.price };
  } catch (error) {
    console.error('✗ Error adding to cart:', error.message);
    throw error;
  }
}

export async function getCartItems(userId, retries = 3) {
  try {
    console.log('Fetching cart for user:', userId);
    const cartRef = collection(db, 'users', userId, 'cart');
    const snapshot = await getDocs(cartRef);

    const cartItems = [];
    snapshot.forEach((doc) => {
      cartItems.push({ id: doc.id, ...doc.data() });
    });

    console.log(`✓ Fetched ${cartItems.length} cart items`);
    return cartItems;
  } catch (error) {
    console.error(`✗ Error fetching cart: ${error.message}. Retries left: ${retries}`);
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return getCartItems(userId, retries - 1);
    }
    throw error;
  }
}

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

export async function clearCart(userId) {
  try {
    console.log('Clearing cart for user:', userId);
    const cartItems = await getCartItems(userId);
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
// WISHLIST FUNCTIONS
// =============================================

export async function addToWishlist(userId, productId) {
  try {
    if (!userId || !productId) {
      throw new Error('Invalid userId or productId');
    }

    console.log(`Adding to wishlist: user=${userId}, product=${productId}`);

    const product = await getProductById(productId);
    if (!product) throw new Error('Product not found');

    const wishlistItemRef = doc(db, 'users', userId, 'wishlist', productId);
    const wishlistItemSnap = await getDoc(wishlistItemRef);

    if (!wishlistItemSnap.exists()) {
      await setDoc(wishlistItemRef, {
        productId: productId,
        name: product.name,
        price: product.price,
        image: product.image || '',
        addedAt: Timestamp.now()
      });
      console.log('✓ Item added to wishlist');
    } else {
      console.log('Item already in wishlist');
    }

    return { productId };
  } catch (error) {
    console.error('✗ Error adding to wishlist:', error.message);
    throw error;
  }
}

export async function getWishlistItems(userId) {
  try {
    console.log('Fetching wishlist for user:', userId);
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const snapshot = await getDocs(wishlistRef);

    const wishlistItems = [];
    snapshot.forEach((doc) => {
      wishlistItems.push({ id: doc.id, ...doc.data() });
    });

    console.log(`✓ Fetched ${wishlistItems.length} wishlist items`);
    return wishlistItems;
  } catch (error) {
    console.error('✗ Error fetching wishlist:', error.message);
    throw error;
  }
}

export async function removeFromWishlist(userId, productId) {
  try {
    console.log(`Removing from wishlist: user=${userId}, product=${productId}`);
    const wishlistItemRef = doc(db, 'users', userId, 'wishlist', productId);
    await deleteDoc(wishlistItemRef);
    console.log('✓ Item removed from wishlist');
  } catch (error) {
    console.error('✗ Error removing from wishlist:', error.message);
    throw error;
  }
}

export async function clearWishlist(userId) {
  try {
    console.log('Clearing wishlist for user:', userId);
    const wishlistItems = await getWishlistItems(userId);
    const deletePromises = wishlistItems.map(item =>
      deleteDoc(doc(db, 'users', userId, 'wishlist', item.id))
    );
    await Promise.all(deletePromises);
    console.log('✓ Wishlist cleared');
  } catch (error) {
    console.error('✗ Error clearing wishlist:', error.message);
    throw error;
  }
}

// =============================================
// ORDER FUNCTIONS
// =============================================

export async function createOrder(userId, orderData) {
  try {
    if (!userId || !orderData) throw new Error('Invalid userId or orderData');
    if (!orderData.items || orderData.items.length === 0) throw new Error('Order must have at least one item');

    console.log('Creating order for user:', userId);

    const orderId = await runTransaction(db, async (transaction) => {
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
 * Create a guest order (no userId)
 */
export async function createGuestOrder(orderData) {
  try {
    if (!orderData.items || orderData.items.length === 0) throw new Error('Order must have at least one item');

    console.log('Creating guest order for:', orderData.shippingAddress?.email);

    const ordersRef = collection(db, 'guestOrders');
    const orderDoc = await addDoc(ordersRef, {
      userId: null,
      guestEmail: orderData.shippingAddress?.email || 'unknown',
      orderNumber: `ZNX-${Date.now().toString(36).toUpperCase()}`,
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

    console.log('✓ Guest order created:', orderDoc.id);
    return {
      orderId: orderDoc.id,
      orderNumber: `ZNX-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      total: orderData.total,
      createdAt: new Date()
    };
  } catch (error) {
    console.error('✗ Error creating guest order:', error.message);
    throw error;
  }
}

export async function getOrders(userId) {
  try {
    console.log('Fetching orders for user:', userId);
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    
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

export async function updateOrderStatus(orderId, status) {
  try {
    console.log('Updating order status:', orderId, '->', status);
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status: status, updatedAt: Timestamp.now() });
    console.log('✓ Order status updated');
  } catch (error) {
    console.error('✗ Error updating order status:', error.message);
    throw error;
  }
}

// =============================================
// USER & ADDRESS FUNCTIONS
// =============================================

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

export async function getUserProfile(userId) {
  try {
    console.log('Fetching user profile:', userId);
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('✗ Error fetching user profile:', error.message);
    throw error;
  }
}

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

export async function getSavedAddresses(userId) {
  try {
    console.log('Fetching addresses for user:', userId);
    const addressesRef = collection(db, 'users', userId, 'addresses');
    const snapshot = await getDocs(addressesRef);

    const addresses = [];
    snapshot.forEach((doc) => {
      addresses.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✓ Fetched ${addresses.length} addresses`);
    return addresses;
  } catch (error) {
    console.error('✗ Error fetching addresses:', error.message);
    throw error;
  }
}

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
  addToWishlist,
  getWishlistItems,
  removeFromWishlist,
  clearWishlist,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  saveUserProfile,
  getUserProfile,
  saveAddress,
  getSavedAddresses,
  deleteAddress,
  addReview,
  getReviews
};