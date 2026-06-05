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

  // Auth guard: redirect to login for protected pages
  const protectedPaths = ['/cart/', '/checkout/', '/profile/'];
  const isProtectedPage = protectedPaths.some(p => path.includes(p));
  
  if (isProtectedPage && !appState.isAuthenticated) {
    // Wait for auth state to resolve before redirecting
    // The subscribeToAuthState callback in step 1 will set appState
    // We use a timeout to allow Firebase auth to initialize
    setTimeout(() => {
      if (!appState.isAuthenticated) {
        const inRoot = !path.includes('/frontend/') || path.endsWith('/frontend/') || path.endsWith('/frontend/index.html');
        window.location.href = inRoot ? 'login/' : '../login/';
      }
    }, 2000);
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
    loadShopProducts('featuredProductsGrid', 4);
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
      appState.cart = [];
      updateCartBadge();
      // Redirect away from protected pages if not logged in
      const protectedPaths = ['/cart/', '/checkout/', '/profile/'];
      if (protectedPaths.some(p => window.location.pathname.includes(p))) {
        const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/');
        window.location.href = inRoot ? 'login/' : '../login/';
      }
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
    appState.cart = await getCartItems(appState.currentUser.uid);
    updateCartBadge();
    
    if (window.location.pathname.includes('/cart/')) {
      displayCartItems();
    }
    if (window.location.pathname.includes('/profile/')) {
      loadProfileData();
    }
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
        
        if (!appState.isAuthenticated) {
          showLoginModal();
          return;
        }

        const productName = card.querySelector('.product-name')?.textContent || 'Product';
        const productPriceStr = card.querySelector('.product-price')?.textContent || '0';
        const productId = card.dataset.productId || Math.random().toString(36).substr(2, 9);
        const priceNum = parseFloat(productPriceStr.replace(/[^\d.]/g, ''));

        const originalText = addBtn.textContent;
        addBtn.textContent = 'Adding...';
        addBtn.disabled = true;

        try {
          await addToCart(appState.currentUser.uid, productId, 1);
          appState.cart = await getCartItems(appState.currentUser.uid);
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
    
    container.innerHTML = displayProducts.map(product => `
      <article class="product-card" data-product-id="${product.id}">
          <div class="product-image-container">
              <img src="${product.image || '../assets/images/placeholder.jpg'}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'"/>
              <button class="wishlist-btn" aria-label="Add to wishlist">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
              </button>
          </div>
          <div class="product-info">
              <h3 class="product-name">${product.name}</h3>
              <p class="product-category">${product.category || 'General'}</p>
              <div class="product-footer">
                  <span class="product-price">₹${product.price}</span>
                  <button class="add-to-cart-btn">Add to Cart</button>
              </div>
          </div>
      </article>
    `).join('');
    
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
  if (appState.isAuthenticated) displayCartItems();
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
  
  container.innerHTML = appState.cart.map(item => `
    <div class="cart-item" data-id="${item.productId}" style="display: flex; gap: 1rem; padding: 1.5rem; border-bottom: 1px solid #eee; align-items: center;">
      <div style="flex: 1;">
        <h4 style="font-size: 1.1rem; color: #0a0e27; margin-bottom: 0.5rem;">${item.name}</h4>
        <p style="color: #0066cc; font-weight: bold; margin-bottom: 1rem;">₹${item.price}</p>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div style="display: flex; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
            <button class="qty-btn dec" style="padding: 0.5rem 0.8rem; background: #f5f5f5; border: none; cursor: pointer;">−</button>
            <span style="padding: 0.5rem 1rem; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">${item.quantity}</span>
            <button class="qty-btn inc" style="padding: 0.5rem 0.8rem; background: #f5f5f5; border: none; cursor: pointer;">+</button>
          </div>
          <button class="remove-btn" style="color: #e74c3c; background: none; border: none; cursor: pointer; font-size: 0.9rem;">Remove</button>
        </div>
      </div>
      <div style="font-weight: bold; font-size: 1.1rem;">
        ₹${item.price * item.quantity}
      </div>
    </div>
  `).join('');
  
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
    await addToCart(appState.currentUser.uid, productId, change);
    appState.cart = await getCartItems(appState.currentUser.uid);
    displayCartItems();
    updateCartBadge();
  } catch (error) {
    showNotification('Error updating quantity', 'error');
  }
}

async function removeCartItem(productId) {
  try {
    await removeFromCart(appState.currentUser.uid, productId);
    appState.cart = await getCartItems(appState.currentUser.uid);
    displayCartItems();
    updateCartBadge();
    showNotification('Item removed', 'success');
  } catch (error) {
    showNotification('Error removing item', 'error');
  }
}

function updateCartSummary() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal > 0 ? (subtotal > 5000 ? 0 : 299) : 0;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + shipping + tax;
  
  if (document.getElementById('subtotal')) document.getElementById('subtotal').textContent = `₹${subtotal}`;
  if (document.getElementById('shipping')) document.getElementById('shipping').textContent = shipping === 0 ? 'Free' : `₹${shipping}`;
  if (document.getElementById('tax')) document.getElementById('tax').textContent = `₹${tax}`;
  if (document.getElementById('total')) document.getElementById('total').textContent = `₹${total}`;
}

// =============================================
// CHECKOUT
// =============================================
function initCheckout() {
  const checkoutForm = document.getElementById('checkoutForm');
  if (!checkoutForm) return;

  // Auto-fill summary on load
  setTimeout(updateCheckoutSummary, 1000);

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!appState.isAuthenticated) {
      showLoginModal();
      return;
    }
    
    if (appState.cart.length === 0) {
      showNotification('Your cart is empty', 'error');
      return;
    }
    
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';
    let shippingCost = 0;
    if(shippingMethod === 'express') shippingCost = 299;
    if(shippingMethod === 'overnight') shippingCost = 999;
    
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + shippingCost + tax;

    const orderData = {
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

    try {
      await createOrder(appState.currentUser.uid, orderData);
      
      // Save address for future
      await saveAddress(appState.currentUser.uid, orderData.shippingAddress);
      
      appState.cart = [];
      updateCartBadge();
      
      showNotification('Order placed successfully!', 'success');
      setTimeout(() => window.location.href = '../profile/', 1500);
    } catch (error) {
      showNotification(error.message, 'error');
      submitBtn.textContent = 'Complete Order';
      submitBtn.disabled = false;
    }
  });

  // Re-calculate when shipping changes
  document.querySelectorAll('input[name="shipping"]').forEach(radio => {
    radio.addEventListener('change', updateCheckoutSummary);
  });
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
        <p>Welcome to the ZONIX Help Center. How can we assist you today?</p>
        <h3>Frequently Asked Questions</h3>
        <ul>
          <li><strong>How do I track my order?</strong> You can track your order in the "Returns & Orders" section of your account.</li>
          <li><strong>What payment methods do you accept?</strong> We accept major credit cards, debit cards, and UPI.</li>
        </ul>
      `
    },
    shipping: {
      title: 'Shipping Information',
      content: `
        <p>At ZONIX, we strive to deliver your products as quickly and safely as possible.</p>
        <h3>Standard Delivery</h3>
        <p>Orders are typically processed within 24 hours and delivered within 3-5 business days.</p>
        <h3>Express Delivery</h3>
        <p>Available in select pin codes for next-day delivery.</p>
      `
    },
    privacy: {
      title: 'Privacy Policy',
      content: `
        <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
        <h3>Information Collection</h3>
        <p>We collect information you provide directly to us when you create an account, make a purchase, or contact customer support.</p>
      `
    },
    terms: {
      title: 'Terms of Service',
      content: `
        <p>Please read these Terms of Service carefully before using the ZONIX website.</p>
        <p>By accessing or using our service, you agree to be bound by these terms.</p>
      `
    },
    returns: {
      title: 'Returns & Refunds',
      content: `
        <p>If you're not completely satisfied with your purchase, you can return it within 30 days of delivery.</p>
        <h3>Return Process</h3>
        <p>Go to your Orders page, select the item, and click "Return Item". Follow the instructions to print your return label.</p>
      `
    },
    collections: {
      title: 'ZONIX Collections',
      content: `
        <p>Discover our curated collections of premium tech, lifestyle, and home goods.</p>
        <p>Check out our <a href="../shop/">Shop</a> page to explore all available products.</p>
      `
    }
  };

  const pageData = contentMap[page] || contentMap['help'];
  titleEl.textContent = pageData.title;
  contentEl.innerHTML = pageData.content;
}