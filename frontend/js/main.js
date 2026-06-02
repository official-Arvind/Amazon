/**
 * ZONIX Main Application - Complete Frontend Integration
 * Firebase v9+ Modular Web SDK
 * 
 * Handles all user interactions:
 * - Authentication & session management
 * - Product catalog & search
 * - Shopping cart management
 * - Checkout & order creation
 * - User profile & addresses
 * - Navigation & UI updates
 */

'use strict';

// =============================================
// IMPORTS
// =============================================

import { 
  subscribeToAuthState, 
  getCurrentUser,
  loginWithEmail, 
  signUpWithEmail, 
  logoutUser, 
  resetPassword
} from '../backend/js/auth.js';

import {
  getProducts,
  getProductById,
  addToCart,
  getCartItems,
  removeFromCart,
  clearCart,
  createOrder,
  getOrders,
  saveUserProfile,
  getUserProfile,
  getSavedAddresses,
  saveAddress
} from '../backend/js/db.js';

// =============================================
// GLOBAL STATE
// =============================================

const appState = {
  currentUser: null,
  isAuthenticated: false,
  cart: [],
  products: [],
  orders: [],
  currentPage: 'home',
  isLoading: false,
  addresses: []
};

// =============================================
// INITIALIZATION
// =============================================

/**
 * Initialize application on DOM ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✓ ZONIX App initializing...');
  
  try {
    // Initialize Firebase auth listener
    initAuthListener();
    
    // Initialize UI components
    initializeUI();
    
    // Load initial data
    await loadProducts();
    
    console.log('✓ App ready');
  } catch (error) {
    console.error('✗ Initialization error:', error);
    showNotification('Failed to load application', 'error');
  }
});

/**
 * Initialize auth state listener
 */
function initAuthListener() {
  subscribeToAuthState((authState) => {
    appState.isAuthenticated = authState.isAuthenticated;
    appState.currentUser = authState.user;
    
    console.log('Auth state:', authState.isAuthenticated ? 'authenticated' : 'not authenticated');
    
    updateAuthUI();
    
    if (authState.isAuthenticated) {
      loadUserData();
    }
  });
}

/**
 * Initialize all UI components
 */
function initializeUI() {
  setupNavigation();
  setupSearch();
  setupCartIcon();
  setupProductCards();
}

/**
 * Setup navigation links
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.navbar-menu .nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/**
 * Setup search functionality
 */
function setupSearch() {
  const searchBtns = document.querySelectorAll('[aria-label="Search"]');
  searchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.querySelector('input[placeholder*="search"], input[placeholder*="Search"]');
      if (input && input.value.trim()) {
        window.location.href = `shop/?q=${encodeURIComponent(input.value)}`;
      }
    });
  });
}

/**
 * Setup cart icon click
 */
function setupCartIcon() {
  const cartIcon = document.querySelector('[aria-label="Cart"]');
  if (cartIcon) {
    cartIcon.addEventListener('click', () => {
      window.location.href = 'cart/';
    });
  }
}

/**
 * Setup product cards
 */
function setupProductCards() {
  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const productName = card.querySelector('.product-name')?.textContent;
      if (productName) {
        window.location.href = `shop/?search=${encodeURIComponent(productName)}`;
      }
    });
  });
}

// =============================================
// AUTHENTICATION
// =============================================

/**
 * Update UI based on auth status
 */
function updateAuthUI() {
  const accountBtn = document.querySelector('[aria-label="Account"]');
  if (!accountBtn) return;
  
  if (appState.isAuthenticated && appState.currentUser) {
    accountBtn.href = 'profile/';
    accountBtn.title = `Logged in as ${appState.currentUser.email}`;
  } else {
    accountBtn.href = 'login/';
    accountBtn.title = 'Login to your account';
  }
}

/**
 * Load user data
 */
async function loadUserData() {
  if (!appState.currentUser) return;
  
  try {
    // Load cart
    const cartItems = await getCartItems(appState.currentUser.uid);
    appState.cart = cartItems;
    updateCartBadge();
    console.log('✓ Cart loaded:', cartItems.length, 'items');
    
    // Load addresses
    const addresses = await getSavedAddresses(appState.currentUser.uid);
    appState.addresses = addresses;
    console.log('✓ Addresses loaded');
    
  } catch (error) {
    console.error('✗ Error loading user data:', error);
  }
}

/**
 * Update cart badge count
 */
function updateCartBadge() {
  const cartIcon = document.querySelector('[aria-label="Cart"]');
  if (!cartIcon) return;
  
  const existingBadge = cartIcon.querySelector('.badge');
  if (existingBadge) existingBadge.remove();
  
  if (appState.cart.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = appState.cart.length;
    badge.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      background-color: #ff9900;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    `;
    cartIcon.style.position = 'relative';
    cartIcon.appendChild(badge);
  }
}

// =============================================
// PRODUCTS
// =============================================

/**
 * Load all products
 */
async function loadProducts() {
  try {
    console.log('Loading products...');
    const products = await getProducts();
    appState.products = products;
    console.log('✓ Loaded', products.length, 'products');
    return products;
  } catch (error) {
    console.error('✗ Error loading products:', error);
    showNotification('Failed to load products', 'error');
    return [];
  }
}

/**
 * Get single product
 */
async function getProduct(productId) {
  try {
    return await getProductById(productId);
  } catch (error) {
    console.error('✗ Error fetching product:', error);
    return null;
  }
}

// =============================================
// SHOPPING CART
// =============================================

/**
 * Add item to cart
 */
async function addItemToCart(productId, quantity = 1) {
  if (!appState.isAuthenticated) {
    showNotification('Please login to add items', 'warning');
    setTimeout(() => {
      window.location.href = 'login/';
    }, 1000);
    return false;
  }
  
  try {
    await addToCart(appState.currentUser.uid, productId, quantity);
    
    const cartItems = await getCartItems(appState.currentUser.uid);
    appState.cart = cartItems;
    updateCartBadge();
    
    showNotification('Item added to cart', 'success');
    return true;
  } catch (error) {
    console.error('✗ Error:', error);
    showNotification(error.message || 'Failed to add to cart', 'error');
    return false;
  }
}

/**
 * Remove item from cart
 */
async function removeItemFromCart(productId) {
  if (!appState.isAuthenticated) return false;
  
  try {
    await removeFromCart(appState.currentUser.uid, productId);
    
    const cartItems = await getCartItems(appState.currentUser.uid);
    appState.cart = cartItems;
    updateCartBadge();
    
    showNotification('Item removed', 'success');
    return true;
  } catch (error) {
    console.error('✗ Error:', error);
    showNotification('Failed to remove item', 'error');
    return false;
  }
}

/**
 * Clear cart
 */
async function clearUserCart() {
  if (!appState.isAuthenticated) return false;
  
  try {
    await clearCart(appState.currentUser.uid);
    appState.cart = [];
    updateCartBadge();
    showNotification('Cart cleared', 'success');
    return true;
  } catch (error) {
    console.error('✗ Error:', error);
    return false;
  }
}

/**
 * Get cart total
 */
function getCartTotal() {
  return appState.cart.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
}

// =============================================
// ORDERS
// =============================================

/**
 * Create order from cart
 */
async function createUserOrder(shippingData) {
  if (!appState.isAuthenticated) {
    showNotification('Please login first', 'warning');
    return false;
  }
  
  if (appState.cart.length === 0) {
    showNotification('Cart is empty', 'warning');
    return false;
  }
  
  try {
    const orderData = {
      items: appState.cart.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      shippingAddress: shippingData.address,
      shippingMethod: shippingData.method || 'standard',
      paymentMethod: shippingData.payment || 'card',
      subtotal: getCartTotal(),
      shippingCost: shippingData.shippingCost || 0,
      tax: shippingData.tax || 0,
      total: shippingData.total || getCartTotal()
    };
    
    const order = await createOrder(appState.currentUser.uid, orderData);
    
    if (shippingData.address) {
      await saveAddress(appState.currentUser.uid, shippingData.address);
    }
    
    appState.cart = [];
    updateCartBadge();
    
    showNotification('Order created successfully!', 'success');
    return order;
  } catch (error) {
    console.error('✗ Error:', error);
    showNotification(error.message || 'Failed to create order', 'error');
    return false;
  }
}

/**
 * Get user orders
 */
async function getUserOrders() {
  if (!appState.isAuthenticated) return [];
  
  try {
    const orders = await getOrders(appState.currentUser.uid);
    appState.orders = orders;
    console.log('✓ Loaded', orders.length, 'orders');
    return orders;
  } catch (error) {
    console.error('✗ Error:', error);
    return [];
  }
}

// =============================================
// UI HELPERS
// =============================================

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  let toast = document.getElementById('toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  
  const colors = {
    'success': '#16a34a',
    'error': '#dc2626',
    'warning': '#ea8c2b',
    'info': '#0066cc'
  };
  
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background-color: ${colors[type] || colors['info']};
    color: white;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    z-index: 9999;
    display: block;
  `;
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// =============================================
// EXPORTS
// =============================================

export {
  appState,
  addItemToCart,
  removeItemFromCart,
  clearUserCart,
  getCartTotal,
  createUserOrder,
  getUserOrders,
  getProduct,
  loadProducts,
  showNotification,
  updateCartBadge,
  loadUserData,
  getCurrentUser
};

export default {
  appState,
  addItemToCart,
  removeItemFromCart,
  createUserOrder,
  showNotification
};

/**
 * Load data from localStorage
 */
function loadLocalData() {
  try {
    const savedCart = localStorage.getItem('zonix_cart');
    if (savedCart) {
      appState.cart = JSON.parse(savedCart);
    }
  } catch (error) {
    console.error('Error loading persisted data:', error);
  }
}

/**
 * Save cart to localStorage
 */
function saveCartToLocal() {
  try {
    localStorage.setItem('zonix_cart', JSON.stringify(appState.cart));
  } catch (error) {
    console.error('Error saving cart:', error);
  }
}

// =============================================
// AUTHENTICATION
// =============================================

/**
 * Initialize Firebase auth state listener
 */
function initAuthListener() {
  subscribeToAuthState((authState) => {
    appState.isAuthenticated = authState.isAuthenticated;
    appState.currentUser = authState.user;
    
    updateAuthUI();
    
    if (authState.isAuthenticated) {
      console.log('✓ User authenticated:', authState.user.email);
      loadUserCart();
    } else {
      console.log('User not authenticated');
    }
  });
}

/**
 * Update UI based on auth status
 */
function updateAuthUI() {
  const accountBtn = document.querySelector('[aria-label="Account"]');
  if (!accountBtn) return;
  
  if (appState.isAuthenticated) {
    accountBtn.textContent = 'Profile';
    accountBtn.href = './profile/index.html';
  } else {
    accountBtn.textContent = 'Login';
    accountBtn.onclick = () => showLoginModal();
  }
}

/**
 * Load user's cart from Firebase
 */
async function loadUserCart() {
  try {
    if (!appState.currentUser) return;
    
    const cartItems = await getCartItems(appState.currentUser.uid);
    appState.cart = cartItems;
    updateCartDisplay();
  } catch (error) {
    console.error('Error loading cart:', error);
  }
}

/**
 * Show login modal
 */
function showLoginModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; padding: 2rem;">
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      <h2>Login to Your Account</h2>
      <form id="loginModalForm" style="margin-top: 1.5rem;">
        <div style="margin-bottom: 1rem;">
          <input type="email" id="modalLoginEmail" placeholder="Email address" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 1rem;">
          <input type="password" id="modalLoginPassword" placeholder="Password" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <button type="submit" style="width: 100%; padding: 0.75rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">Login</button>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('loginModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('modalLoginEmail').value;
    const password = document.getElementById('modalLoginPassword').value;
    
    try {
      await loginWithEmail(email, password);
      modal.remove();
      showNotification('Login successful!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}

/**
 * Initialize authentication forms on dedicated auth pages
 */
function initAuthForms() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector('input[type="password"]').value;
      
      try {
        appState.isLoading = true;
        await loginWithEmail(email, password);
        showNotification('Login successful!', 'success');
        setTimeout(() => window.location.href = '../index.html', 1000);
      } catch (error) {
        showNotification(error.message, 'error');
      } finally {
        appState.isLoading = false;
      }
    });
  }
  
  // Signup form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelector('input[type="password"]').value;
      const name = signupForm.querySelector('input[type="text"]').value;
      
      try {
        appState.isLoading = true;
        await signUpWithEmail(email, password, name);
        showNotification('Account created! Logging in...', 'success');
        setTimeout(() => window.location.href = '../index.html', 1000);
      } catch (error) {
        showNotification(error.message, 'error');
      } finally {
        appState.isLoading = false;
      }
    });
  }
}

// =============================================
// NAVIGATION
// =============================================

/**
 * Initialize navigation menu
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const currentPath = window.location.pathname;
    const href = link.getAttribute('href');
    
    if (currentPath.includes(href.replace('../', '')) || (currentPath.endsWith('/') && href === '#')) {
      link.classList.add('active');
    }
  });
}

/**
 * Handle logout
 */
function handleLogout() {
  logoutUser()
    .then(() => {
      showNotification('Logged out successfully', 'success');
      setTimeout(() => window.location.href = '../index.html', 1000);
    })
    .catch(error => showNotification(error.message, 'error'));
}

// =============================================
// PRODUCTS
// =============================================

/**
 * Initialize product listing
 */
function initProducts() {
  const productCards = document.querySelectorAll('.product-card');
  
  if (productCards.length === 0) return;
  
  productCards.forEach(card => {
    const addBtn = card.querySelector('.add-to-cart-btn');
    
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAddToCart(card);
      });
    }
  });
}

/**
 * Handle adding product to cart
 */
async function handleAddToCart(productCard) {
  try {
    if (!appState.isAuthenticated) {
      showNotification('Please login to add items to cart', 'error');
      showLoginModal();
      return;
    }
    
    const productName = productCard.querySelector('.product-name')?.textContent || 'Product';
    const productPrice = productCard.querySelector('.product-price')?.textContent || '0';
    const productId = productCard.dataset.productId || Math.random().toString();
    
    const priceNum = parseFloat(productPrice.replace(/[^\d.]/g, ''));
    
    // Add to Firebase cart
    await addToCart(appState.currentUser.uid, productId, 1);
    
    // Update local state
    appState.cart.push({
      productId,
      name: productName,
      price: priceNum,
      quantity: 1
    });
    
    saveCartToLocal();
    updateCartDisplay();
    
    // Visual feedback
    const btn = productCard.querySelector('.add-to-cart-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Added!';
    setTimeout(() => btn.textContent = originalText, 1500);
    
    showNotification(`${productName} added to cart!`, 'success');
  } catch (error) {
    console.error('Add to cart error:', error);
    showNotification(error.message, 'error');
  }
}

// =============================================
// SHOPPING CART
// =============================================

/**
 * Initialize cart functionality
 */
function initCart() {
  const cartIcon = document.querySelector('[aria-label="Cart"]');
  if (cartIcon) {
    cartIcon.addEventListener('click', () => {
      const cartPage = document.location.origin + '/cart/';
      window.location.href = cartPage;
    });
  }
  
  // Cart page initialization
  const cartItemsContainer = document.getElementById('cartItems');
  if (cartItemsContainer) {
    displayCartItems();
  }
}

/**
 * Display cart items
 */
function displayCartItems() {
  const cartItemsContainer = document.getElementById('cartItems');
  if (!cartItemsContainer) return;
  
  if (appState.cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart" style="text-align: center; padding: 2rem;">
        <p style="color: #565656; margin-bottom: 1rem;">Your cart is empty</p>
        <a href="../shop/" style="color: #0066cc; text-decoration: none;">Continue Shopping</a>
      </div>
    `;
    updateCartSummary();
    return;
  }
  
  const cartHTML = appState.cart.map(item => `
    <div class="cart-item" data-product-id="${item.productId}" style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid #eee;">
      <div style="flex: 1;">
        <h4>${item.name}</h4>
        <p style="color: #565656; margin: 0.5rem 0;">₹${item.price}</p>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="qty-btn qty-decrease" style="padding: 0.25rem 0.5rem; border: 1px solid #ddd; background: white; cursor: pointer;">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-increase" style="padding: 0.25rem 0.5rem; border: 1px solid #ddd; background: white; cursor: pointer;">+</button>
          <button class="remove-btn" style="margin-left: auto; padding: 0.25rem 0.75rem; background: #f5f5f5; border: none; color: #0066cc; cursor: pointer;">Remove</button>
        </div>
      </div>
    </div>
  `).join('');
  
  cartItemsContainer.innerHTML = cartHTML;
  
  // Add event listeners to cart item buttons
  document.querySelectorAll('.qty-increase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.cart-item').dataset.productId;
      updateCartQuantity(productId, 1);
    });
  });
  
  document.querySelectorAll('.qty-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.cart-item').dataset.productId;
      updateCartQuantity(productId, -1);
    });
  });
  
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.cart-item').dataset.productId;
      removeCartItem(productId);
    });
  });
  
  updateCartSummary();
}

/**
 * Update cart quantity
 */
async function updateCartQuantity(productId, change) {
  const item = appState.cart.find(item => item.productId === productId);
  if (!item) return;
  
  item.quantity += change;
  if (item.quantity <= 0) {
    removeCartItem(productId);
    return;
  }
  
  if (appState.isAuthenticated) {
    try {
      await addToCart(appState.currentUser.uid, productId, change);
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  }
  
  saveCartToLocal();
  displayCartItems();
}

/**
 * Remove item from cart
 */
async function removeCartItem(productId) {
  appState.cart = appState.cart.filter(item => item.productId !== productId);
  
  if (appState.isAuthenticated) {
    try {
      await removeFromCart(appState.currentUser.uid, productId);
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  }
  
  saveCartToLocal();
  displayCartItems();
}

/**
 * Update cart display (count, total)
 */
function updateCartDisplay() {
  const cartCount = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountElement = document.querySelector('.cart-count');
  if (cartCountElement) {
    cartCountElement.textContent = cartCount;
  }
}

/**
 * Update cart summary
 */
function updateCartSummary() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = subtotal > 500 ? 0 : 100;
  const tax = Math.round(subtotal * 0.05); // 5% tax
  const total = subtotal + shippingCost + tax;
  
  const subtotalEl = document.querySelector('[data-field="subtotal"]');
  const shippingEl = document.querySelector('[data-field="shipping"]');
  const taxEl = document.querySelector('[data-field="tax"]');
  const totalEl = document.querySelector('[data-field="total"]');
  
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
  if (shippingEl) shippingEl.textContent = shippingCost === 0 ? 'FREE' : `₹${shippingCost}`;
  if (taxEl) taxEl.textContent = `₹${tax}`;
  if (totalEl) totalEl.textContent = `₹${total}`;
}

// =============================================
// CHECKOUT
// =============================================

/**
 * Initialize checkout functionality
 */
function initCheckout() {
  const checkoutForm = document.getElementById('checkoutForm');
  if (!checkoutForm) return;
  
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await processCheckout();
  });
}

/**
 * Process checkout and create order
 */
async function processCheckout() {
  try {
    if (!appState.isAuthenticated) {
      showNotification('Please login to checkout', 'error');
      return;
    }
    
    if (appState.cart.length === 0) {
      showNotification('Your cart is empty', 'error');
      return;
    }
    
    appState.isLoading = true;
    
    // Collect form data
    const firstName = document.querySelector('input[name="firstName"]')?.value;
    const lastName = document.querySelector('input[name="lastName"]')?.value;
    const email = document.querySelector('input[name="email"]')?.value;
    const street = document.querySelector('input[name="street"]')?.value;
    const city = document.querySelector('input[name="city"]')?.value;
    const state = document.querySelector('input[name="state"]')?.value;
    const zipcode = document.querySelector('input[name="zipcode"]')?.value;
    const country = document.querySelector('input[name="country"]')?.value;
    const phone = document.querySelector('input[name="phone"]')?.value;
    const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'card';
    
    // Validation
    if (!firstName || !lastName || !email || !street || !city || !state || !zipcode || !country || !phone) {
      showNotification('Please fill in all shipping details', 'error');
      return;
    }
    
    // Calculate totals
    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCosts = { standard: 0, express: 299, overnight: 999 };
    const shippingCost = shippingCosts[shippingMethod] || 0;
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + shippingCost + tax;
    
    // Create order
    const orderData = {
      items: appState.cart,
      shippingAddress: {
        name: `${firstName} ${lastName}`,
        email,
        street,
        city,
        state,
        zip: zipcode,
        country,
        phone
      },
      shippingMethod,
      paymentMethod,
      subtotal,
      shippingCost,
      tax,
      total
    };
    
    const order = await createOrder(appState.currentUser.uid, orderData);
    
    showNotification('Order placed successfully!', 'success');
    
    // Clear cart
    appState.cart = [];
    saveCartToLocal();
    
    // Redirect to order confirmation or profile
    setTimeout(() => {
      window.location.href = `../profile/?orderId=${order.orderId}`;
    }, 1500);
    
  } catch (error) {
    console.error('Checkout error:', error);
    showNotification(error.message, 'error');
  } finally {
    appState.isLoading = false;
  }
}

// =============================================
// USER PROFILE
// =============================================

/**
 * Initialize profile functionality
 */
function initProfile() {
  // Tab switching
  const profileNavItems = document.querySelectorAll('.profile-nav-item');
  profileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.dataset.tab;
      switchProfileTab(tabName);
    });
  });
  
  // Load profile data if authenticated
  if (appState.isAuthenticated) {
    loadProfileData();
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

/**
 * Switch profile tabs
 */
function switchProfileTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Update nav item active state
  document.querySelectorAll('.profile-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Show selected tab
  const selectedTab = document.getElementById(`${tabName}Tab`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }
  
  // Mark nav item as active
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
}

/**
 * Load user profile data
 */
async function loadProfileData() {
  try {
    if (!appState.currentUser) return;
    
    // Update profile header
    const displayNameEl = document.querySelector('.profile-display-name');
    const emailEl = document.querySelector('.profile-email');
    
    if (displayNameEl) displayNameEl.textContent = appState.currentUser.displayName || appState.currentUser.email;
    if (emailEl) emailEl.textContent = appState.currentUser.email;
    
    // Load orders
    const orders = await getOrders(appState.currentUser.uid);
    displayOrders(orders);
    
    // Load addresses
    const addresses = await getSavedAddresses(appState.currentUser.uid);
    displayAddresses(addresses);
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

/**
 * Display user orders
 */
function displayOrders(orders) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  
  if (orders.length === 0) {
    ordersList.innerHTML = '<p style="color: #565656;">No orders yet</p>';
    return;
  }
  
  const ordersHTML = orders.map(order => `
    <div style="border: 1px solid #eee; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <strong>${order.orderNumber}</strong>
        <span style="background: #e8f4f8; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem;">${order.status}</span>
      </div>
      <p style="color: #565656; margin: 0.5rem 0; font-size: 0.875rem;">${new Date(order.createdAt).toLocaleDateString()}</p>
      <p style="margin: 0.5rem 0;"><strong>₹${order.total}</strong></p>
      <p style="color: #0066cc; cursor: pointer; font-size: 0.875rem;">View Details →</p>
    </div>
  `).join('');
  
  ordersList.innerHTML = ordersHTML;
}

/**
 * Display saved addresses
 */
function displayAddresses(addresses) {
  const addressesList = document.getElementById('addressesList');
  if (!addressesList) return;
  
  if (addresses.length === 0) {
    addressesList.innerHTML = '<p style="color: #565656;">No saved addresses</p>';
    return;
  }
  
  const addressesHTML = addresses.map(address => `
    <div style="border: 1px solid #eee; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
      <strong>${address.name}</strong>
      <p style="color: #565656; margin: 0.5rem 0; font-size: 0.875rem;">
        ${address.street}<br>
        ${address.city}, ${address.state} ${address.zip}<br>
        ${address.country}
      </p>
      <p style="color: #565656; margin: 0.5rem 0; font-size: 0.875rem;">${address.phone}</p>
    </div>
  `).join('');
  
  addressesList.innerHTML = addressesHTML;
}

// =============================================
// HELP/FAQ
// =============================================

/**
 * Initialize help/FAQ functionality
 */
function initHelp() {
  // Accordion toggle
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const content = item.querySelector('.accordion-content');
      
      // Close other items in same category
      const category = item.closest('.accordion-category');
      category.querySelectorAll('.accordion-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.querySelector('.accordion-content').style.display = 'none';
        }
      });
      
      // Toggle current item
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  });
  
  // Category filter
  const categoryCards = document.querySelectorAll('.category-card');
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      filterFAQByCategory(category);
    });
  });
  
  // Search
  const helpSearch = document.getElementById('helpSearch');
  if (helpSearch) {
    helpSearch.addEventListener('input', (e) => {
      searchFAQs(e.target.value);
    });
  }
}

/**
 * Filter FAQs by category
 */
function filterFAQByCategory(category) {
  const categories = document.querySelectorAll('.accordion-category');
  
  categories.forEach(cat => {
    if (category === 'all' || cat.id === category) {
      cat.style.display = 'block';
    } else {
      cat.style.display = 'none';
    }
  });
}

/**
 * Search FAQs
 */
function searchFAQs(query) {
  const accordionItems = document.querySelectorAll('.accordion-item');
  
  accordionItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(query.toLowerCase())) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// =============================================
// BUTTONS & GENERAL UI
// =============================================

/**
 * Initialize button handlers
 */
function initButtons() {
  // Search button
  const searchBtn = document.querySelector('[aria-label="Search"]');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      console.log('Search clicked');
    });
  }
  
  // Shop page filters
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      console.log('Sort changed:', e.target.value);
    });
  }
}

// =============================================
// NOTIFICATIONS
// =============================================

/**
 * Show notification toast
 */
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
    color: ${type === 'success' ? '#155724' : '#721c24'};
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Format number as currency
 */
function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(price);
}

/**
 * Get cart totals
 */
function getCartTotals() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = subtotal > 500 ? 0 : 100;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shippingCost + tax;
  
  return { subtotal, shippingCost, tax, total };
}

export { appState, showNotification };
