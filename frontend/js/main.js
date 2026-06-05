/**
 * ZONIX Main Application - Complete Frontend Integration
 * Firebase v9+ Modular Web SDK
 */

'use strict';

// =============================================
// IMPORTS
// =============================================
import {
  subscribeToAuthState, 
  loginWithEmail, 
  logoutUser 
} from '../../backend/js/auth.js';

import {
  getProducts,
  addToCart,
  getCartItems,
  removeFromCart,
  clearCart,
  createOrder,
  createGuestOrder,
  getOrders,
  getSavedAddresses,
  saveAddress
} from '../../backend/js/db.js';

// =============================================
// GLOBAL STATE
// =============================================
const appState = {
  currentUser: null,
  isAuthenticated: false,
  cart: [],
  orders: [],
  addresses: [],
  isLoading: false
};

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('✓ ZONIX App initializing...');
  
  // 1. Setup Auth & Navigation
  initAuthListener();
  setupNavigation();
  setupSearch();
  
  // 2. Initialize Page-Specific Logic based on URL
  const path = window.location.pathname;

  // Auth guard: only /profile/ requires login — cart/checkout work for guests
  const protectedPaths = ['/profile/'];
  const isProtectedPage = protectedPaths.some(p => path.includes(p));
  
  if (isProtectedPage) {
    setTimeout(() => {
      if (!appState.isAuthenticated) {
        const inRoot = !path.includes('/frontend/') || path.endsWith('/frontend/') || path.endsWith('/frontend/index.html');
        window.location.href = inRoot ? 'login/' : '../login/';
      }
    }, 2000);
  }

  // Load guest cart from localStorage on init
  if (!appState.isAuthenticated) {
    appState.cart = getGuestCart();
    updateCartBadge();
  }

  if (path.includes('/cart/')) {
    initCart();
  } else if (path.includes('/checkout/')) {
    initCheckout();
  } else if (path.includes('/profile/')) {
    initProfile();
  } else if (path.includes('/help/')) {
    initHelp();
  } else if (path.includes('/shop/') || path.endsWith('shop/index.html')) {
    loadShopProducts();
  } else if (path.includes('/info/') || path.endsWith('info/index.html')) {
    loadInfoPage();
  } else if (path === '/' || path.endsWith('/index.html') || path.endsWith('/frontend/')) {
    loadShopProducts('featuredProductsGrid', 8);
    initHeroCarousel();
  }

  // 3. Initialize Products (Add to Cart buttons) everywhere
  initProducts();
});

// =============================================
// AUTHENTICATION & USER DATA
// =============================================
function initAuthListener() {
  subscribeToAuthState((authState) => {
    appState.isAuthenticated = authState.isAuthenticated;
    appState.currentUser = authState.user;
    
    updateAuthUI();
    
    if (authState.isAuthenticated) {
      loadUserData();
    } else {
      appState.cart = getGuestCart();
      updateCartBadge();
      // Only redirect from profile (login-required page)
      if (window.location.pathname.includes('/profile/')) {
        const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/');
        window.location.href = inRoot ? 'login/' : '../login/';
      }
      // Re-display cart for guest
      if (window.location.pathname.includes('/cart/')) displayCartItems();
      if (window.location.pathname.includes('/checkout/')) updateCheckoutSummary();
    }
  });
}

function updateAuthUI() {
  const accountBtn = document.querySelector('[aria-label="Account"]');
  if (!accountBtn) return;
  
  // Check if we are in the root directory or a subdirectory to set correct relative path
  const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
  const prefix = inRoot ? '' : '../';

  if (appState.isAuthenticated) {
    accountBtn.href = prefix + 'profile/';
    accountBtn.title = 'My Profile';
  } else {
    accountBtn.href = prefix + 'login/';
    accountBtn.title = 'Login';
  }
}

async function loadUserData() {
  if (!appState.currentUser) return;
  try {
    // Merge any guest cart items into user's Firebase cart
    const guestCart = getGuestCart();
    if (guestCart.length > 0) {
      for (const item of guestCart) {
        await addToCart(appState.currentUser.uid, item.productId, item.quantity);
      }
      clearGuestCart();
      console.log('✓ Merged guest cart into account');
    }

    appState.cart = await getCartItems(appState.currentUser.uid);
    updateCartBadge();
    
    if (window.location.pathname.includes('/cart/')) displayCartItems();
    if (window.location.pathname.includes('/checkout/')) updateCheckoutSummary();
    if (window.location.pathname.includes('/profile/')) loadProfileData();
  } catch (error) {
    console.error('✗ Error loading user data:', error);
  }
}

function showLoginModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
  
  // Calculate correct path to login page
  const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
  const loginPath = inRoot ? 'login/' : '../login/';

  modal.innerHTML = `
    <div class="modal-content" style="background: white; padding: 2.5rem; border-radius: 8px; max-width: 400px; width: 90%; position: relative;">
      <button class="modal-close" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
      <h2 style="margin-bottom: 1.5rem; color: #0a0e27;">Login Required</h2>
      <p style="margin-bottom: 1.5rem; color: #565656;">Please login to add items to your cart and checkout.</p>
      <form id="loginModalForm">
        <input type="email" id="modalLoginEmail" placeholder="Email address" required style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        <input type="password" id="modalLoginPassword" placeholder="Password" required style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        <button type="submit" style="width: 100%; padding: 0.75rem; background: #0066cc; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Login</button>
      </form>
      <div style="text-align: center; margin-top: 1.5rem;">
        <a href="${loginPath}" style="color: #0066cc; text-decoration: none; font-size: 0.875rem;">Don't have an account? Sign up</a>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  
  document.getElementById('loginModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('modalLoginEmail').value;
    const password = document.getElementById('modalLoginPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    try {
      await loginWithEmail(email, password);
      modal.remove();
      showNotification('Login successful!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// =============================================
// NAVIGATION & UI
// =============================================
function setupNavigation() {
  const navLinks = document.querySelectorAll('.navbar-menu .nav-link');
  navLinks.forEach(link => {
    const currentPath = window.location.pathname;
    const href = link.getAttribute('href');
    // Prevent matching root to everything
    if (href !== './' && href !== '../' && currentPath.includes(href.replace('../', ''))) {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
}

function setupSearch() {
  const searchInputs = document.querySelectorAll('.search-input');
  const searchBtns = document.querySelectorAll('.search-btn');

  const executeSearch = (input) => {
    const query = input.value.trim();
    if (query) {
      const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
      const shopPath = inRoot ? 'shop/' : '../shop/';
      window.location.href = `${shopPath}?q=${encodeURIComponent(query)}`;
    }
  };

  searchInputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeSearch(input);
      }
    });
  });

  searchBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      if (searchInputs[index]) {
        executeSearch(searchInputs[index]);
      }
    });
  });
}

function showNotification(message, type = 'info') {
  const colors = { success: '#16a34a', error: '#dc2626', warning: '#ea8c2b', info: '#0066cc' };
  const toast = document.createElement('div');
  
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; padding: 1rem 1.5rem;
    background-color: ${colors[type] || colors['info']}; color: white;
    border-radius: 4px; font-size: 0.95rem; z-index: 10000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// =============================================
// PRODUCTS & ADD TO CART
// =============================================
function initProducts() {
  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    // Avoid attaching multiple listeners if re-rendered
    if (card.dataset.initialized === 'true') return;
    card.dataset.initialized = 'true';
    
    const addBtn = card.querySelector('.add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const productName = card.querySelector('.product-name')?.textContent || 'Product';
        const productPriceStr = card.querySelector('.product-price')?.textContent || '0';
        const productId = card.dataset.productId || Math.random().toString(36).substr(2, 9);
        const priceNum = parseFloat(productPriceStr.replace(/[^\d.]/g, ''));
        const productImage = card.querySelector('.product-image')?.src || '';
        const productCategory = card.querySelector('.product-category')?.textContent || 'General';

        const originalText = addBtn.textContent;
        addBtn.textContent = 'Adding...';
        addBtn.disabled = true;

        try {
          if (appState.isAuthenticated) {
            await addToCart(appState.currentUser.uid, productId, 1);
            appState.cart = await getCartItems(appState.currentUser.uid);
          } else {
            // Guest cart — use localStorage
            addToGuestCart({ productId, name: productName, price: priceNum, image: productImage, category: productCategory, quantity: 1 });
            appState.cart = getGuestCart();
          }
          updateCartBadge();
          addBtn.textContent = '✓ Added';
          showNotification(`${productName} added to cart!`, 'success');
        } catch (error) {
          showNotification('Failed to add to cart', 'error');
          addBtn.textContent = originalText;
        } finally {
          setTimeout(() => { addBtn.textContent = originalText; addBtn.disabled = false; }, 2000);
        }
      });
    }
  });
}

async function loadShopProducts(containerId = 'shopProductsGrid', maxItems = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  try {
    const products = await getProducts();
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q')?.toLowerCase();

    let filteredProducts = products;
    if (searchQuery && maxItems === 0) {
      filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery) || 
        (p.category && p.category.toLowerCase().includes(searchQuery))
      );
      
      const searchTitle = document.querySelector('.section-title');
      if (searchTitle) {
        searchTitle.textContent = `Search Results for "${searchQuery}"`;
      }
    }
    
    if (filteredProducts.length === 0) {
      container.innerHTML = '<div class="empty-state">No products found matching your search.</div>';
      const countEl = document.querySelector('.products-count');
      if(countEl) countEl.textContent = 'Showing 0 Products';
      return;
    }
    
    const displayProducts = maxItems > 0 ? filteredProducts.slice(0, maxItems) : filteredProducts;
    
    container.innerHTML = displayProducts.map(product => {
      const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
      const ratingStars = product.rating ? '★'.repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? '½' : '') : '';
      const ratingColor = product.rating >= 4 ? '#16a34a' : product.rating >= 3 ? '#ea8c2b' : '#dc2626';
      
      return `
      <article class="product-card" data-product-id="${product.id}">
          <div class="product-image-container">
              ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
              <img src="${product.image || '../assets/images/placeholder.jpg'}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'"/>
              <button class="wishlist-btn" aria-label="Add to wishlist">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
              </button>
          </div>
          <div class="product-info">
              <p class="product-category">${product.category || 'General'}</p>
              <h3 class="product-name">${product.name}</h3>
              ${product.rating ? `
              <div class="product-rating">
                  <span class="rating-badge" style="background:${ratingColor}">${product.rating} ★</span>
                  <span class="rating-count">(${(product.reviews || 0).toLocaleString()})</span>
              </div>` : ''}
              <div class="product-pricing">
                  <span class="product-price">₹${product.price.toLocaleString()}</span>
                  ${product.originalPrice ? `
                  <span class="product-original-price">₹${product.originalPrice.toLocaleString()}</span>
                  <span class="product-discount">${discount}% off</span>` : ''}
              </div>
              ${product.price > 499 ? '<p class="product-delivery">FREE delivery by ZONIX</p>' : ''}
              <button class="add-to-cart-btn">Add to Cart</button>
          </div>
      </article>
    `}).join('');
    
    // Update products count
    const countEl = document.querySelector('.products-count');
    if(countEl) countEl.textContent = `Showing ${displayProducts.length} Products`;
    
    // Re-initialize add to cart listeners
    initProducts();
  } catch (error) {
    container.innerHTML = '<div class="error-state">Failed to load products. Please try again later.</div>';
    console.error('Error loading products:', error);
  }
}

// =============================================
// SHOPPING CART
// =============================================
function initCart() {
  // Works for both guests and logged-in users
  displayCartItems();
}

function updateCartBadge() {
  const cartIcon = document.querySelector('[aria-label="Cart"]');
  if (!cartIcon) return;
  
  let badge = cartIcon.querySelector('.badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #e74c3c; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;';
    cartIcon.style.position = 'relative';
    cartIcon.appendChild(badge);
  }
  
  const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = totalItems;
  badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

function displayCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  
  if (appState.cart.length === 0) {
    const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
    const shopPath = inRoot ? 'shop/' : '../shop/';
    container.innerHTML = `
      <div class="empty-cart" style="text-align: center; padding: 3rem;">
        <p style="color: #565656; margin-bottom: 1rem; font-size: 1.1rem;">Your cart is empty</p>
        <a href="${shopPath}" class="cta-button">Continue Shopping</a>
      </div>
    `;
    updateCartSummary();
    return;
  }
  
  container.innerHTML = appState.cart.map((item, index) => {
    const isFirst = index === 0;
    return `
      <div class="cart-item" data-id="${item.productId}" style="display: flex; gap: 1.5rem; padding: 1.5rem 0; border-top: ${isFirst ? 'none' : '1px solid #e8e8e8'};">
        <div style="flex-shrink: 0; width: 140px; height: 140px; background: #f7f7f7; display: flex; align-items: center; justify-content: center; border-radius: 4px; padding: 10px;">
            <img src="${item.image || '../assets/images/placeholder.jpg'}" alt="${item.name}" style="max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply;" onerror="this.src='https://via.placeholder.com/150x150?text=Image+Not+Found'"/>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem;">
            <h4 class="cart-item-title" style="font-size: 1.15rem; color: #0f1111; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.name}</h4>
            <div style="text-align: right; min-width: 100px;">
              <span style="font-size: 1.3rem; font-weight: 700; color: #0f1111;">₹${(item.price * item.quantity).toLocaleString()}</span>
            </div>
          </div>
          
          <div style="color: #007185; font-size: 0.85rem; margin-bottom: 0.5rem;">In Stock</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.8rem;">
            <img src="https://m.media-amazon.com/images/G/31/marketing/fba/fba-badge_18px-2x._CB485936079_.png" alt="ZONIX Fulfilled" style="height: 18px;">
          </div>
          
          <div style="display: flex; align-items: center; gap: 1.5rem; margin-top: auto;">
            <div style="display: flex; align-items: center; border: 1px solid #d5d9d9; border-radius: 8px; background: #f0f2f2; box-shadow: 0 2px 5px rgba(15,17,17,.15); overflow: hidden;">
              <button class="qty-btn dec" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; font-size: 1.2rem; transition: background 0.1s;">−</button>
              <span style="width: 40px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fff; font-size: 0.95rem; font-weight: 600; border-left: 1px solid #d5d9d9; border-right: 1px solid #d5d9d9;">${item.quantity}</span>
              <button class="qty-btn inc" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; font-size: 1.2rem; transition: background 0.1s;">+</button>
            </div>
            <div style="width: 1px; height: 16px; background: #ddd;"></div>
            <button class="remove-btn" style="color: #007185; background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Delete</button>
            <div style="width: 1px; height: 16px; background: #ddd;"></div>
            <button style="color: #007185; background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Save for later</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.qty-btn.inc').forEach(btn => 
    btn.addEventListener('click', e => updateCartQty(e.target.closest('.cart-item').dataset.id, 1)));
    
  container.querySelectorAll('.qty-btn.dec').forEach(btn => 
    btn.addEventListener('click', e => updateCartQty(e.target.closest('.cart-item').dataset.id, -1)));
    
  container.querySelectorAll('.remove-btn').forEach(btn => 
    btn.addEventListener('click', e => removeCartItem(e.target.closest('.cart-item').dataset.id)));
    
  updateCartSummary();
}

async function updateCartQty(productId, change) {
  const item = appState.cart.find(i => i.productId === productId);
  if (!item) return;
  
  if (item.quantity + change <= 0) {
    removeCartItem(productId);
    return;
  }
  
  try {
    if (appState.isAuthenticated) {
      await addToCart(appState.currentUser.uid, productId, change);
      appState.cart = await getCartItems(appState.currentUser.uid);
    } else {
      updateGuestCartQty(productId, change);
      appState.cart = getGuestCart();
    }
    displayCartItems();
    updateCartBadge();
  } catch (error) {
    showNotification('Error updating quantity', 'error');
  }
}

async function removeCartItem(productId) {
  try {
    if (appState.isAuthenticated) {
      await removeFromCart(appState.currentUser.uid, productId);
      appState.cart = await getCartItems(appState.currentUser.uid);
    } else {
      removeFromGuestCart(productId);
      appState.cart = getGuestCart();
    }
    displayCartItems();
    updateCartBadge();
    showNotification('Item removed', 'success');
  } catch (error) {
    showNotification('Error removing item', 'error');
  }
}

function updateCartSummary() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal > 0 ? (subtotal > 5000 ? 0 : 299) : 0;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + shipping + tax;
  
  if (document.getElementById('summaryItemCount')) document.getElementById('summaryItemCount').textContent = totalItems;
  if (document.getElementById('subtotal')) document.getElementById('subtotal').textContent = `₹${subtotal.toLocaleString()}`;
  if (document.getElementById('shipping')) document.getElementById('shipping').textContent = shipping === 0 ? 'Free' : `₹${shipping.toLocaleString()}`;
  if (document.getElementById('tax')) document.getElementById('tax').textContent = `₹${tax.toLocaleString()}`;
  if (document.getElementById('total')) document.getElementById('total').textContent = `₹${total.toLocaleString()}`;
}

// =============================================
// CHECKOUT
// =============================================
function initCheckout() {
  const checkoutForm = document.getElementById('checkoutForm');
  if (!checkoutForm) return;

  // Auto-fill summary on load
  setTimeout(updateCheckoutSummary, 500);

  // Restore form data from sessionStorage if returning from login
  restoreCheckoutFormData();

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (appState.cart.length === 0) {
      showNotification('Your cart is empty', 'error');
      return;
    }

    const orderData = buildOrderData();

    if (appState.isAuthenticated) {
      // Logged-in user: place order directly
      await placeOrder(orderData, false);
    } else {
      // Guest: show the auth/guest checkout modal
      saveCheckoutFormData();
      showCheckoutAuthModal(orderData);
    }
  });

  // Re-calculate when shipping changes
  document.querySelectorAll('input[name="shipping"]').forEach(radio => {
    radio.addEventListener('change', updateCheckoutSummary);
  });
}

function buildOrderData() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';
  let shippingCost = 0;
  if (shippingMethod === 'express') shippingCost = 299;
  if (shippingMethod === 'overnight') shippingCost = 999;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shippingCost + tax;

  return {
    items: appState.cart,
    shippingAddress: {
      name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
      email: document.getElementById('email').value,
      street: document.getElementById('street').value,
      city: document.getElementById('city').value,
      state: document.getElementById('state').value,
      zip: document.getElementById('zipcode').value,
      country: document.getElementById('country').value,
      phone: document.getElementById('phone').value
    },
    shippingMethod,
    paymentMethod: document.querySelector('input[name="payment"]:checked')?.value || 'card',
    subtotal, shippingCost, tax, total
  };
}

async function placeOrder(orderData, isGuest) {
  const submitBtn = document.querySelector('#checkoutForm button[type="submit"]');
  if (submitBtn) { submitBtn.textContent = 'Processing...'; submitBtn.disabled = true; }

  try {
    if (isGuest) {
      await createGuestOrder(orderData);
    } else {
      await createOrder(appState.currentUser.uid, orderData);
      await saveAddress(appState.currentUser.uid, orderData.shippingAddress);
    }
    
    clearGuestCart();
    appState.cart = [];
    updateCartBadge();
    sessionStorage.removeItem('zonix_checkout_form');
    
    showOrderConfirmation(orderData, isGuest);
  } catch (error) {
    showNotification(error.message, 'error');
    if (submitBtn) { submitBtn.textContent = 'Complete Order'; submitBtn.disabled = false; }
  }
}

function showOrderConfirmation(orderData, isGuest) {
  const orderNum = 'ZNX-' + Date.now().toString(36).toUpperCase();
  const main = document.querySelector('.content-section') || document.body;
  main.innerHTML = `
    <div style="max-width:600px;margin:3rem auto;text-align:center;padding:2rem;">
      <div style="width:80px;height:80px;border-radius:50%;background:#16a34a;margin:0 auto 1.5rem;display:flex;align-items:center;justify-content:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h1 style="color:#0a0e27;margin-bottom:0.5rem;">Order Confirmed!</h1>
      <p style="color:#565656;margin-bottom:1rem;">Thank you for your purchase. Your order <strong>${orderNum}</strong> has been placed.</p>
      <p style="color:#565656;margin-bottom:2rem;">We'll send a confirmation email to <strong>${orderData.shippingAddress.email}</strong></p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:1.5rem;margin-bottom:2rem;text-align:left;">
        <p style="font-weight:600;margin-bottom:0.5rem;">Order Total: <span style="color:#16a34a;">₹${orderData.total}</span></p>
        <p style="color:#565656;font-size:0.9rem;">${orderData.items.length} item(s) • ${orderData.shippingMethod} shipping</p>
      </div>
      ${isGuest ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:1.5rem;margin-bottom:2rem;">
          <p style="font-weight:600;margin-bottom:0.5rem;">Create an account to track your order</p>
          <p style="color:#565656;font-size:0.9rem;margin-bottom:1rem;">Sign up with ${orderData.shippingAddress.email} and your order will be automatically linked.</p>
          <a href="../login/" class="cta-button" style="display:inline-block;">Create Account</a>
        </div>
      ` : ''}
      <a href="../shop/" class="cta-button" style="display:inline-block;background:#232f3e;color:white;">Continue Shopping</a>
    </div>
  `;
}

function showCheckoutAuthModal(orderData) {
  const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/');
  const loginPath = inRoot ? 'login/' : '../login/';
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;max-width:480px;width:90%;padding:2.5rem;position:relative;animation:slideUp 0.3s ease;">
      <button class="modal-close" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">&times;</button>
      <div style="text-align:center;margin-bottom:1.5rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" style="margin-bottom:0.5rem;">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <h2 style="color:#0a0e27;margin-bottom:0.25rem;">Almost there!</h2>
        <p style="color:#565656;">How would you like to complete your order?</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <button id="checkoutSignIn" style="padding:0.9rem;background:#ffd814;color:#0a0e27;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;transition:all 0.2s;">
          Sign In to Your Account
        </button>
        <button id="checkoutSignUp" style="padding:0.9rem;background:#232f3e;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;transition:all 0.2s;">
          Create New Account
        </button>
        <div style="display:flex;align-items:center;gap:8px;margin:0.25rem 0;">
          <div style="flex:1;height:1px;background:#ddd;"></div>
          <span style="color:#999;font-size:0.82rem;">or</span>
          <div style="flex:1;height:1px;background:#ddd;"></div>
        </div>
        <button id="checkoutAsGuest" style="padding:0.9rem;background:#fff;color:#0a0e27;border:1.5px solid #ddd;border-radius:6px;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
          Checkout as Guest
        </button>
      </div>
      <p style="text-align:center;margin-top:1rem;font-size:0.8rem;color:#999;">Your cart items and form info will be saved.</p>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#checkoutSignIn').addEventListener('click', () => {
    window.location.href = loginPath;
  });
  modal.querySelector('#checkoutSignUp').addEventListener('click', () => {
    window.location.href = loginPath + '#signup';
  });
  modal.querySelector('#checkoutAsGuest').addEventListener('click', async () => {
    modal.remove();
    await placeOrder(orderData, true);
  });
}

function saveCheckoutFormData() {
  const fields = ['firstName', 'lastName', 'email', 'street', 'city', 'state', 'zipcode', 'country', 'phone'];
  const data = {};
  fields.forEach(f => { const el = document.getElementById(f); if (el) data[f] = el.value; });
  sessionStorage.setItem('zonix_checkout_form', JSON.stringify(data));
}

function restoreCheckoutFormData() {
  const saved = sessionStorage.getItem('zonix_checkout_form');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([k, v]) => { const el = document.getElementById(k); if (el) el.value = v; });
  } catch (e) {}
}

function updateCheckoutSummary() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';
  let shippingCost = 0;
  if(shippingMethod === 'express') shippingCost = 299;
  if(shippingMethod === 'overnight') shippingCost = 999;
  
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shippingCost + tax;

  if (document.getElementById('checkoutSubtotal')) document.getElementById('checkoutSubtotal').textContent = `₹${subtotal}`;
  if (document.getElementById('checkoutShipping')) document.getElementById('checkoutShipping').textContent = shippingCost === 0 ? 'Free' : `₹${shippingCost}`;
  if (document.getElementById('checkoutTax')) document.getElementById('checkoutTax').textContent = `₹${tax}`;
  if (document.getElementById('checkoutTotal')) document.getElementById('checkoutTotal').textContent = `₹${total}`;
}

// =============================================
// PROFILE
// =============================================
function initProfile() {
  document.querySelectorAll('.profile-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if(item.id === 'logoutBtn') {
        logoutUser().then(() => window.location.href = '../login/');
        return;
      }
      
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-nav-item').forEach(n => n.classList.remove('active'));
      
      document.getElementById(`${item.dataset.tab}Tab`).classList.add('active');
      item.classList.add('active');
    });
  });
}

async function loadProfileData() {
  if (!appState.currentUser) return;
  
  if (document.getElementById('userDisplayName')) document.getElementById('userDisplayName').textContent = appState.currentUser.displayName || 'Guest User';
  if (document.getElementById('userEmail')) document.getElementById('userEmail').textContent = appState.currentUser.email;
  if (document.getElementById('settingsEmail')) document.getElementById('settingsEmail').value = appState.currentUser.email;
  if (document.getElementById('settingsName')) document.getElementById('settingsName').value = appState.currentUser.displayName || '';

  try {
    const orders = await getOrders(appState.currentUser.uid);
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
      if (orders.length === 0) {
        const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
        const shopPath = inRoot ? 'shop/' : '../shop/';
        ordersList.innerHTML = `<p>No orders yet. <a href="${shopPath}" style="color:#0066cc;">Start shopping</a></p>`;
      } else {
        ordersList.innerHTML = orders.map(order => `
          <div style="border: 1px solid #eee; padding: 1.5rem; border-radius: 4px; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
              <div>
                <p style="color: #565656; font-size: 0.85rem; margin-bottom: 0.2rem;">ORDER PLACED</p>
                <p><strong>${new Date(order.createdAt).toLocaleDateString()}</strong></p>
              </div>
              <div>
                <p style="color: #565656; font-size: 0.85rem; margin-bottom: 0.2rem;">TOTAL</p>
                <p><strong>₹${order.total}</strong></p>
              </div>
              <div>
                <p style="color: #565656; font-size: 0.85rem; margin-bottom: 0.2rem;">ORDER #</p>
                <p><strong>${order.orderNumber}</strong></p>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="background: #e8f4f8; color: #0066cc; padding: 0.4rem 1rem; border-radius: 4px; font-weight: bold; font-size: 0.9rem; text-transform: uppercase;">${order.status}</span>
              <p style="color: #565656;">${order.items.length} item(s)</p>
            </div>
          </div>
        `).join('');
      }
    }

    const addresses = await getSavedAddresses(appState.currentUser.uid);
    const addrList = document.getElementById('addressesList');
    if (addrList) {
      if (addresses.length === 0) {
        addrList.innerHTML = '<p>No saved addresses.</p>';
      } else {
        addrList.innerHTML = addresses.map(addr => `
          <div style="border: 1px solid #eee; padding: 1.5rem; border-radius: 4px; margin-bottom: 1rem;">
            <h4 style="margin-bottom: 0.5rem; color: #0a0e27;">${addr.name}</h4>
            <p style="color: #565656; line-height: 1.5;">${addr.street}<br>${addr.city}, ${addr.state} ${addr.zip}<br>${addr.country}<br>Phone: ${addr.phone}</p>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error(e);
  }
}

// =============================================
// HELP / FAQ
// =============================================
function initHelp() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const isActive = content.style.display === 'block';
      
      document.querySelectorAll('.accordion-content').forEach(c => c.style.display = 'none');
      if (!isActive) content.style.display = 'block';
    });
  });

  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const categoryId = card.dataset.category;
      document.querySelectorAll('.accordion-category').forEach(cat => {
        cat.style.display = (cat.id === categoryId) ? 'block' : 'none';
      });
    });
  });
}

// =============================================
// INFO PAGE LOADER
// =============================================
function loadInfoPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page') || 'help';
  
  const titleEl = document.getElementById('infoTitle');
  const contentEl = document.getElementById('infoContent');
  if (!titleEl || !contentEl) return;

  const contentMap = {
    help: {
      title: 'Help Center',
      content: `
        <p>Welcome to the ZONIX Help Center. Find answers to common questions below.</p>
        <h3>Orders & Shipping</h3>
        <ul>
          <li><strong>How do I track my order?</strong><br>Sign in to your account and visit "My Orders" to see real-time tracking for all shipments.</li>
          <li><strong>How long does delivery take?</strong><br>Standard: 5-7 business days. Express: 2-3 business days. Overnight: Next business day (select areas).</li>
          <li><strong>Can I change my shipping address?</strong><br>You can update your address within 2 hours of placing your order from the Orders page.</li>
          <li><strong>Do you ship internationally?</strong><br>Currently, we deliver across India. International shipping is coming soon.</li>
        </ul>
        <h3>Payments</h3>
        <ul>
          <li><strong>What payment methods do you accept?</strong><br>We accept Visa, MasterCard, RuPay, UPI (Google Pay, PhonePe, Paytm), and digital wallets.</li>
          <li><strong>Is my payment information secure?</strong><br>Absolutely. All transactions are encrypted with 256-bit SSL and processed through PCI-DSS compliant payment gateways.</li>
          <li><strong>Can I pay Cash on Delivery?</strong><br>COD is available for select pin codes on orders under ₹10,000.</li>
        </ul>
        <h3>Account & Security</h3>
        <ul>
          <li><strong>How do I reset my password?</strong><br>Click "Forgot Password" on the login page and follow the email instructions.</li>
          <li><strong>Can I delete my account?</strong><br>Contact our support team at support@zonix.com to request account deletion.</li>
          <li><strong>Is my personal data safe?</strong><br>We follow strict data protection practices. Read our <a href="?page=privacy">Privacy Policy</a> for details.</li>
        </ul>
        <h3>Returns & Refunds</h3>
        <ul>
          <li><strong>What is your return policy?</strong><br>Most items can be returned within 30 days. See our full <a href="?page=returns">Returns Policy</a>.</li>
          <li><strong>How long do refunds take?</strong><br>Refunds are processed within 5-7 business days after we receive the returned item.</li>
          <li><strong>Who pays for return shipping?</strong><br>ZONIX covers return shipping for defective or incorrect items. For change-of-mind returns, a small fee may apply.</li>
        </ul>
        <h3>Still Need Help?</h3>
        <p>Contact us at <a href="mailto:support@zonix.com">support@zonix.com</a> or visit our <a href="../contact/">Contact Page</a>. Our team is available Mon-Sat, 9 AM - 9 PM IST.</p>
      `
    },
    shipping: {
      title: 'Shipping Information',
      content: `
        <p><em>Last updated: June 2026</em></p>
        <h3>Delivery Zones</h3>
        <p>ZONIX currently delivers to all major cities and towns across India, covering 19,000+ pin codes.</p>
        <h3>Shipping Options</h3>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
          <tr style="background:#f5f5f5;"><th style="padding:0.75rem;border:1px solid #ddd;text-align:left;">Method</th><th style="padding:0.75rem;border:1px solid #ddd;text-align:left;">Delivery Time</th><th style="padding:0.75rem;border:1px solid #ddd;text-align:left;">Cost</th></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">Standard Shipping</td><td style="padding:0.75rem;border:1px solid #ddd;">5-7 business days</td><td style="padding:0.75rem;border:1px solid #ddd;">Free on orders over ₹5,000 / ₹299 otherwise</td></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">Express Shipping</td><td style="padding:0.75rem;border:1px solid #ddd;">2-3 business days</td><td style="padding:0.75rem;border:1px solid #ddd;">₹299</td></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">Overnight Delivery</td><td style="padding:0.75rem;border:1px solid #ddd;">Next business day</td><td style="padding:0.75rem;border:1px solid #ddd;">₹999 (select metros only)</td></tr>
        </table>
        <h3>Order Tracking</h3>
        <p>Once your order ships, you'll receive a tracking link via email and SMS. You can also track orders from your account dashboard under "My Orders".</p>
        <h3>Delivery Attempts</h3>
        <p>Our delivery partners will attempt delivery up to 3 times. If all attempts fail, the package will be returned to our warehouse and a refund will be initiated.</p>
        <h3>Packaging</h3>
        <p>All items are securely packaged with eco-friendly materials. Fragile items receive additional bubble wrap and reinforced boxes.</p>
      `
    },
    privacy: {
      title: 'Privacy Policy',
      content: `
        <p><em>Effective Date: January 1, 2026 | Last Updated: June 2026</em></p>
        <p>ZONIX ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or make a purchase.</p>
        <h3>1. Information We Collect</h3>
        <p><strong>Personal Information:</strong> When you create an account or make a purchase, we collect your name, email address, shipping address, phone number, and payment information.</p>
        <p><strong>Automatically Collected Information:</strong> We automatically collect device information, IP address, browser type, pages viewed, and time spent on pages using cookies and similar technologies.</p>
        <p><strong>Google Sign-In:</strong> If you sign in via Google, we receive your name, email address, and profile picture from Google. We do not receive or store your Google password.</p>
        <h3>2. How We Use Your Information</h3>
        <ul>
          <li>To process and fulfill your orders</li>
          <li>To communicate order updates and shipping notifications</li>
          <li>To create and manage your account</li>
          <li>To provide customer support</li>
          <li>To personalize your shopping experience</li>
          <li>To send promotional emails (with your consent)</li>
          <li>To detect and prevent fraud</li>
        </ul>
        <h3>3. Information Sharing</h3>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Payment processors, shipping carriers, and cloud hosting (Firebase/Google Cloud)</li>
          <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
        </ul>
        <h3>4. Data Security</h3>
        <p>We use Firebase Authentication and Firestore with encryption at rest and in transit. Payment data is processed by PCI-DSS compliant third parties and never stored on our servers.</p>
        <h3>5. Cookies</h3>
        <p>We use essential cookies for cart functionality and authentication. Analytics cookies help us understand usage patterns. You can disable cookies in your browser settings.</p>
        <h3>6. Your Rights</h3>
        <p>You have the right to: access your data, request correction, request deletion, opt out of marketing emails, and data portability. Contact us at <a href="mailto:privacy@zonix.com">privacy@zonix.com</a>.</p>
        <h3>7. Data Retention</h3>
        <p>We retain your personal data for as long as your account is active or as needed for legal, tax, or business purposes. Order records are kept for 7 years per regulatory requirements.</p>
        <h3>8. Children's Privacy</h3>
        <p>Our services are not directed to individuals under 18. We do not knowingly collect data from minors.</p>
        <h3>9. Changes to This Policy</h3>
        <p>We may update this policy periodically. Changes will be posted here with an updated "Last Updated" date. Continued use constitutes acceptance.</p>
        <h3>10. Contact Us</h3>
        <p>For privacy-related inquiries: <a href="mailto:privacy@zonix.com">privacy@zonix.com</a></p>
      `
    },
    terms: {
      title: 'Terms of Service',
      content: `
        <p><em>Effective Date: January 1, 2026 | Last Updated: June 2026</em></p>
        <p>Please read these Terms of Service ("Terms") carefully before using the ZONIX website and services. By accessing or using our platform, you agree to be bound by these Terms.</p>
        <h3>1. Acceptance of Terms</h3>
        <p>By creating an account, browsing, or making a purchase on ZONIX, you acknowledge that you have read, understood, and agree to these Terms. If you do not agree, please do not use our services.</p>
        <h3>2. Account Registration</h3>
        <p>You must provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use of your account.</p>
        <h3>3. Products & Pricing</h3>
        <p>All product descriptions and images are provided in good faith. We strive for accuracy but do not guarantee that descriptions are error-free. Prices are listed in Indian Rupees (₹) and include applicable taxes unless stated otherwise. We reserve the right to modify prices at any time without prior notice. Pricing errors may result in order cancellation.</p>
        <h3>4. Orders & Payment</h3>
        <p>Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order. Payment must be completed at the time of order through our accepted payment methods. Orders are confirmed only after successful payment processing.</p>
        <h3>5. Shipping & Delivery</h3>
        <p>Delivery timelines are estimates and not guarantees. ZONIX is not liable for delays caused by carriers, natural disasters, or circumstances beyond our control. Risk of loss passes to you upon delivery to the carrier.</p>
        <h3>6. Returns & Refunds</h3>
        <p>Our return policy allows returns within 30 days of delivery for most items. See our <a href="?page=returns">Returns & Refunds Policy</a> for complete details, exclusions, and procedures.</p>
        <h3>7. Intellectual Property</h3>
        <p>All content on ZONIX — including logos, text, images, graphics, and software — is the property of ZONIX or its licensors and is protected by copyright and trademark laws. Unauthorized use is strictly prohibited.</p>
        <h3>8. User Conduct</h3>
        <p>You agree not to: use our platform for unlawful purposes, attempt to gain unauthorized access, upload malicious content, scrape or harvest data, or interfere with the operation of our services.</p>
        <h3>9. Limitation of Liability</h3>
        <p>To the maximum extent permitted by law, ZONIX shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability shall not exceed the amount you paid for the specific product or service giving rise to the claim.</p>
        <h3>10. Indemnification</h3>
        <p>You agree to indemnify and hold harmless ZONIX, its officers, directors, employees, and agents from any claims arising from your use of our services or violation of these Terms.</p>
        <h3>11. Governing Law</h3>
        <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in New Delhi, India.</p>
        <h3>12. Changes to Terms</h3>
        <p>We reserve the right to modify these Terms at any time. Updated Terms will be posted with a new effective date. Your continued use constitutes acceptance of the modified Terms.</p>
        <h3>13. Contact</h3>
        <p>Questions about these Terms? Contact us at <a href="mailto:legal@zonix.com">legal@zonix.com</a></p>
      `
    },
    returns: {
      title: 'Returns & Refunds Policy',
      content: `
        <p><em>Last Updated: June 2026</em></p>
        <h3>30-Day Return Policy</h3>
        <p>We want you to be completely satisfied with your purchase. If you're not, most items can be returned within 30 days of delivery for a full refund or exchange.</p>
        <h3>Eligibility</h3>
        <ul>
          <li>Items must be in original, unused condition with all tags and packaging intact</li>
          <li>Items must be returned within 30 days of the delivery date</li>
          <li>Proof of purchase (order confirmation email or order number) is required</li>
        </ul>
        <h3>Non-Returnable Items</h3>
        <ul>
          <li>Perishable goods (food, flowers, etc.)</li>
          <li>Personal care and hygiene products</li>
          <li>Customized or personalized items</li>
          <li>Downloadable software or digital products</li>
          <li>Gift cards and vouchers</li>
          <li>Items marked as "Final Sale"</li>
        </ul>
        <h3>How to Return an Item</h3>
        <ol>
          <li>Sign in to your ZONIX account and go to "My Orders"</li>
          <li>Select the order containing the item you want to return</li>
          <li>Click "Return Item" and select a reason</li>
          <li>Choose pickup or self-ship option</li>
          <li>Pack the item securely in its original packaging</li>
          <li>Hand it to the pickup agent or drop it at a designated location</li>
        </ol>
        <h3>Refund Process</h3>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
          <tr style="background:#f5f5f5;"><th style="padding:0.75rem;border:1px solid #ddd;text-align:left;">Payment Method</th><th style="padding:0.75rem;border:1px solid #ddd;text-align:left;">Refund Timeline</th></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">Credit/Debit Card</td><td style="padding:0.75rem;border:1px solid #ddd;">5-7 business days</td></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">UPI</td><td style="padding:0.75rem;border:1px solid #ddd;">2-3 business days</td></tr>
          <tr><td style="padding:0.75rem;border:1px solid #ddd;">Digital Wallet</td><td style="padding:0.75rem;border:1px solid #ddd;">1-2 business days</td></tr>
        </table>
        <h3>Damaged or Defective Items</h3>
        <p>If you receive a damaged or defective item, contact us within 48 hours of delivery. We'll arrange a free pickup and send a replacement or full refund immediately. Please keep the item in the condition you received it and take photos for documentation.</p>
        <h3>Exchange Policy</h3>
        <p>Exchanges are available for size or color variations of the same product, subject to availability. The exchange process follows the same timeline as returns.</p>
        <h3>Contact for Returns</h3>
        <p>Need help with a return? Contact us at <a href="mailto:returns@zonix.com">returns@zonix.com</a> or call 1800-123-ZONIX (toll-free).</p>
      `
    },
    collections: {
      title: 'ZONIX Collections',
      content: `
        <p>Discover our carefully curated collections of premium products designed for the modern lifestyle.</p>
        <h3>🔥 Trending Now</h3>
        <p>Our most popular products, updated weekly based on customer favorites and top sellers.</p>
        <h3>💻 Tech Essentials</h3>
        <p>From laptops to smart home devices, find cutting-edge technology at competitive prices.</p>
        <h3>🏠 Home & Living</h3>
        <p>Transform your space with our collection of home décor, furniture, and kitchen essentials.</p>
        <h3>👗 Fashion & Lifestyle</h3>
        <p>Stay stylish with our curated selection of apparel, accessories, and personal care products.</p>
        <h3>🎮 Gaming & Entertainment</h3>
        <p>Level up your entertainment with consoles, peripherals, and streaming accessories.</p>
        <p style="margin-top:2rem;">Explore all products in our <a href="../shop/">Shop</a> page.</p>
      `
    }
  };

  const pageData = contentMap[page] || contentMap['help'];
  titleEl.textContent = pageData.title;
  contentEl.innerHTML = pageData.content;
}

// =============================================
// HERO CAROUSEL
// =============================================
function initHeroCarousel() {
  const slides = document.querySelectorAll('.hero-slide');
  const prevBtn = document.querySelector('.hero-prev');
  const nextBtn = document.querySelector('.hero-next');
  if (slides.length === 0) return;

  let current = 0;
  
  function showSlide(n) {
    slides[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  if (prevBtn) prevBtn.addEventListener('click', () => showSlide(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showSlide(current + 1));

  // Auto-rotate every 5 seconds
  setInterval(() => showSlide(current + 1), 5000);
}

// =============================================
// GUEST CART (localStorage)
// =============================================
const GUEST_CART_KEY = 'zonix_guest_cart';

function getGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
  } catch { return []; }
}

function saveGuestCart(cart) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

function addToGuestCart(item) {
  const cart = getGuestCart();
  const existing = cart.find(i => i.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push({ ...item });
  }
  saveGuestCart(cart);
}

function updateGuestCartQty(productId, change) {
  const cart = getGuestCart();
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) {
    removeFromGuestCart(productId);
    return;
  }
  saveGuestCart(cart);
}

function removeFromGuestCart(productId) {
  const cart = getGuestCart().filter(i => i.productId !== productId);
  saveGuestCart(cart);
}