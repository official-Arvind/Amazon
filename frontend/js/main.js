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
  saveAddress,
  getWishlistItems
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
  wishlist: [],
  isLoading: false
};

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('✓ ZONIX App initializing...');
  
  // 0. Render dynamic Amazon Navbar & mobile drawer
  renderNavbar();
  
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
    // Let shop.js handle it
  } else if (path.includes('/info/') || path.endsWith('info/index.html')) {
    loadInfoPage();
  } else if (path === '/' || path.endsWith('/index.html') || path.endsWith('/frontend/')) {
    loadShopProducts('featuredProductsGrid', 8);
    loadBestSellers();
    loadRecentlyViewed();
    initHeroCarousel();
  }

  // 3. Initialize Products (Add to Cart buttons) everywhere
  initProducts();

  // 4. Listen for custom events to update cart and wishlist badges
  window.addEventListener('cart-updated', async () => {
    if (appState.isAuthenticated && appState.currentUser) {
      appState.cart = await getCartItems(appState.currentUser.uid);
      updateCartBadge();
    }
  });

  window.addEventListener('wishlist-updated', async () => {
    if (appState.isAuthenticated && appState.currentUser) {
      appState.wishlist = await getWishlistItems(appState.currentUser.uid);
      updateWishlistBadge();
    }
  });
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
  const accountBtn = document.getElementById('authNavLink');
  if (!accountBtn) return;
  
  // Check if we are in the root directory or a subdirectory to set correct relative path
  const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
  const prefix = inRoot ? '' : '../';

  const smallText = accountBtn.querySelector('.nav-small');
  const boldText = accountBtn.querySelector('.nav-bold');

  if (appState.isAuthenticated && appState.currentUser) {
    accountBtn.href = prefix + 'profile/';
    if (smallText) smallText.textContent = `Hello, ${appState.currentUser.displayName || 'User'}`;
    if (boldText) boldText.textContent = 'Account & Lists';
    accountBtn.title = 'My Profile';
  } else {
    accountBtn.href = prefix + 'login/';
    if (smallText) smallText.textContent = 'Hello, sign in';
    if (boldText) boldText.textContent = 'Account & Lists';
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
    
    appState.wishlist = await getWishlistItems(appState.currentUser.uid);
    updateWishlistBadge();
    
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
function renderNavbar() {
  const navbar = document.querySelector('.navbar');
  const subNavbar = document.querySelector('.sub-navbar');
  if (!navbar) return;

  const path = window.location.pathname;
  const inRoot = !path.includes('/frontend/') || path.endsWith('/frontend/') || path.endsWith('/frontend/index.html');
  const prefix = inRoot ? '' : '../';

  // Amazon Logo SVG with yellow curved smile arrow underneath
  const logoHTML = `
    <a href="${prefix}" class="logo-text" style="position:relative; display:inline-block; padding-bottom: 5px;">
      ZONIX<span class="logo-in">.in</span>
    </a>
  `;

  // Standard Navbar top row (containing logo, deliver location, search, icons)
  navbar.innerHTML = `
    <div class="navbar-container">
      <div class="navbar-left">
        <!-- Mobile Hamburger Button -->
        <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Menu" style="display:none; align-items:center; color:#fff; padding:6px; background:none; border:none; cursor:pointer;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div class="navbar-logo">
          ${logoHTML}
        </div>

        <div class="navbar-deliver">
            <div class="deliver-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path><circle cx="12" cy="9" r="2.5"></circle></svg>
            </div>
            <div class="deliver-text-container">
                <span class="deliver-to">Delivering to New Delhi 110001</span>
                <span class="deliver-location">Update location</span>
            </div>
        </div>
      </div>

      <div class="navbar-search">
        <select class="search-category">
          <option>All</option>
          <option>Electronics</option>
          <option>Fashion</option>
          <option>Home & Living</option>
          <option>Gaming</option>
          <option>Audio</option>
        </select>
        <input type="text" class="search-input" placeholder="Search Amazon.in">
        <button class="search-btn" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1111" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      </div>

      <div class="navbar-right">
        <div class="navbar-language nav-link-custom">
            <span class="nav-bold">EN</span>
        </div>
        
        <a href="${prefix}login/" class="nav-link-custom" id="authNavLink">
          <span class="nav-small">Hello, sign in</span>
          <span class="nav-bold">Account & Lists</span>
        </a>
        
        <a href="${prefix}profile/" class="nav-link-custom">
          <span class="nav-small">Returns</span>
          <span class="nav-bold">& Orders</span>
        </a>

        <a href="${prefix}wishlist/" class="nav-link-custom wishlist-link" style="position: relative;">
          <span class="wishlist-count" id="wishlistBadge" style="display:none; position:absolute; top:2px; right:5px; background:var(--color-accent-primary, #ff9900); color:#000; border-radius:10px; font-size:12px; font-weight:bold; padding:2px 6px; align-items:center; justify-content:center;">0</span>
          <span class="nav-small">Your</span>
          <span class="nav-bold">Wishlist</span>
        </a>

        <a href="${prefix}cart/" class="nav-link-custom cart-link">
          <div class="cart-icon-wrapper">
            <span class="cart-count" id="cartBadge" style="display:none;">0</span>
            <svg width="38" height="26" viewBox="0 0 38 26" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 24 A2 2 0 1 0 14 24 A2 2 0 1 0 10 24 Z"></path>
                <path d="M24 24 A2 2 0 1 0 28 24 A2 2 0 1 0 24 24 Z"></path>
                <path d="M4 4 h4 l3.5 12 h15 l3-9 h-18"></path>
            </svg>
          </div>
          <span class="nav-bold cart-text">Cart</span>
        </a>
      </div>
    </div>
  `;

  // Inject dynamic sub-navbar
  if (subNavbar) {
    subNavbar.innerHTML = `
      <a href="#" class="sub-nav-link all-menu" id="desktopMenuToggle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
        All
      </a>
      <a href="${prefix}deals/" class="sub-nav-link">Today's Deals</a>
      <a href="${prefix}wishlist/" class="sub-nav-link">Wishlist</a>
      <a href="${prefix}shop/" class="sub-nav-link">Best Sellers</a>
      <a href="${prefix}shop/?q=electronics" class="sub-nav-link">Mobiles</a>
      <a href="${prefix}shop/?q=electronics" class="sub-nav-link">Electronics</a>
      <a href="${prefix}premium/" class="sub-nav-link" style="color: #ffd700; font-weight: bold;">ZONIX Premium</a>
      <a href="${prefix}contact/" class="sub-nav-link">Customer Service</a>
      <a href="${prefix}help/" class="sub-nav-link">New Releases</a>
      <a href="${prefix}admin/" class="sub-nav-link" style="color:var(--color-accent-primary); font-weight:bold; margin-left:auto;">Admin Dashboard</a>
    `;
  }

  // Inject Mobile Location Bar just below the subnavbar (only visible on mobile via media query)
  const locBar = document.createElement('div');
  locBar.className = 'mobile-location-bar';
  locBar.style.cssText = 'display:none;';
  locBar.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
    <span>Deliver to India</span>
  `;
  subNavbar.parentNode.insertBefore(locBar, subNavbar.nextSibling);

  // Inject Navigation drawer into body
  let drawer = document.getElementById('mobileNavDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobileNavDrawer';
    drawer.innerHTML = `
      <div class="mega-menu-overlay" id="drawerOverlay"></div>
      <div class="mega-menu-drawer" id="drawerMenu">
        <div class="mega-menu-header">
          <div class="mega-menu-user">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span id="drawerGreeting">Hello, Sign In</span>
          </div>
          <button class="mega-menu-close" id="drawerCloseBtn" aria-label="Close menu">&times;</button>
        </div>
        <div class="mega-menu-content">
          <h3 class="mega-menu-title">Digital Content & Devices</h3>
          <ul class="mega-menu-list">
            <li><a href="${prefix}shop/?q=amazon+music">Amazon Music <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=kindle">Kindle E-readers & Books <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=appstore">Appstore for Android <span class="mega-arrow">›</span></a></li>
          </ul>
          <hr>
          <h3 class="mega-menu-title">Shop by Category</h3>
          <ul class="mega-menu-list">
            <li><a href="${prefix}shop/?q=electronics">Electronics <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=computers">Computers <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=smart+home">Smart Home <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=arts+crafts">Arts & Crafts <span class="mega-arrow">›</span></a></li>
          </ul>
          <hr>
          <h3 class="mega-menu-title">Programs & Features</h3>
          <ul class="mega-menu-list">
            <li><a href="${prefix}shop/?q=gift+cards">Gift Cards <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=amazon+live">Amazon Live <span class="mega-arrow">›</span></a></li>
            <li><a href="${prefix}shop/?q=international">International Shopping <span class="mega-arrow">›</span></a></li>
          </ul>
          <hr>
          <h3 class="mega-menu-title">Help & Settings</h3>
          <ul class="mega-menu-list">
            <li><a href="${prefix}profile/">Your Account</a></li>
            <li><a href="${prefix}help/">Customer Service</a></li>
            <li><a href="${prefix}login/" id="drawerAuthBtn">Sign In</a></li>
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  // Setup navigation drawer listeners
  const openBtn = document.getElementById('mobileMenuToggle');
  const desktopOpenBtn = document.getElementById('desktopMenuToggle');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const overlay = document.getElementById('drawerOverlay');
  const menu = document.getElementById('drawerMenu');

  const toggleDrawer = (active) => {
    if (active) {
      menu.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Update greeting in drawer
      const greeting = document.getElementById('drawerGreeting');
      const authBtn = document.getElementById('drawerAuthBtn');
      if (appState.currentUser) {
        if (greeting) greeting.textContent = `Hello, ${appState.currentUser.displayName || 'User'}`;
        if (authBtn) {
          authBtn.textContent = 'Sign Out';
          authBtn.href = '#';
          authBtn.onclick = async (e) => {
            e.preventDefault();
            await logoutUser();
            window.location.reload();
          };
        }
      } else {
        if (greeting) greeting.textContent = 'Hello, Sign In';
        if (authBtn) {
          authBtn.textContent = 'Sign In';
          authBtn.href = `${prefix}login/`;
          authBtn.onclick = null;
        }
      }
    } else {
      menu.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  if (openBtn) openBtn.addEventListener('click', () => toggleDrawer(true));
  if (desktopOpenBtn) desktopOpenBtn.addEventListener('click', (e) => { e.preventDefault(); toggleDrawer(true); });
  if (closeBtn) closeBtn.addEventListener('click', () => toggleDrawer(false));
  if (overlay) overlay.addEventListener('click', () => toggleDrawer(false));
}

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

let cachedProducts = [];

function setupSearch() {
  const searchInputs = document.querySelectorAll('.search-input');
  const searchBtns = document.querySelectorAll('.search-btn');

  // Pre-fetch products for autocomplete
  getProducts().then(products => {
    cachedProducts = products;
  }).catch(err => console.error('Failed to load products for autocomplete', err));

  const executeSearch = (input) => {
    const query = input.value.trim();
    if (query) {
      const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
      const shopPath = inRoot ? 'shop/' : '../shop/';
      window.location.href = `${shopPath}?q=${encodeURIComponent(query)}`;
    }
  };

  searchInputs.forEach(input => {
    // Setup Autocomplete Container
    const parent = input.parentElement;
    parent.style.position = 'relative';
    // Remove overflow hidden from parent if exists
    parent.style.overflow = 'visible';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    parent.appendChild(dropdown);

    input.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query || cachedProducts.length === 0) {
        dropdown.classList.remove('active');
        return;
      }
      
      const results = cachedProducts.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query))).slice(0, 6);
      
      if (results.length > 0) {
        const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
        dropdown.innerHTML = results.map(p => {
            const imgPath = p.image || (inRoot ? 'assets/images/placeholder.jpg' : '../assets/images/placeholder.jpg');
            const productLink = (inRoot ? 'product/' : '../product/') + '?id=' + p.id;
            return `
              <a href="${productLink}" class="autocomplete-item">
                  <img src="${imgPath}" alt="${p.name}" class="autocomplete-img" onerror="this.src='https://via.placeholder.com/40'">
                  <div class="autocomplete-info">
                      <div class="autocomplete-name">${p.name}</div>
                      <div class="autocomplete-cat">${p.category || 'General'}</div>
                  </div>
              </a>
            `;
        }).join('');
        dropdown.classList.add('active');
      } else {
        dropdown.classList.remove('active');
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!parent.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeSearch(input);
        dropdown.classList.remove('active');
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
          
          playFlyToCartAnimation(card);
          
          setTimeout(() => {
              updateCartBadge();
              addBtn.textContent = '✓ Added';
              showNotification(`${productName} added to cart!`, 'success');
              
              setTimeout(() => {
                  addBtn.textContent = originalText;
                  addBtn.disabled = false;
              }, 2000);
          }, 800);
          
        } catch (error) {
          showNotification('Failed to add to cart', 'error');
          addBtn.textContent = originalText;
          addBtn.disabled = false;
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

    // Initial search filter
    let searchFiltered = products;
    if (searchQuery) {
      searchFiltered = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery) || 
        (p.category && p.category.toLowerCase().includes(searchQuery))
      );
      
      const searchTitle = document.querySelector('.section-title');
      if (searchTitle) {
        searchTitle.textContent = `Search Results for "${searchQuery}"`;
      }
    }

    // Cloning Sidebar Filters to Mobile Drawer
    const sidebar = document.querySelector('.shop-sidebar');
    const mobileFiltersContainer = document.getElementById('mobileFiltersContainer');
    if (sidebar && mobileFiltersContainer && mobileFiltersContainer.children.length === 0) {
      mobileFiltersContainer.innerHTML = sidebar.innerHTML;
      
      // Sync mobile input changes to desktop inputs
      const mobileInputs = mobileFiltersContainer.querySelectorAll('input');
      const desktopInputs = sidebar.querySelectorAll('input');
      mobileInputs.forEach((mobInput, idx) => {
        mobInput.addEventListener('change', () => {
          if (desktopInputs[idx]) {
            desktopInputs[idx].checked = mobInput.checked;
            applyFilters();
          }
        });
      });
      
      // Sync Price link clicks
      mobileFiltersContainer.querySelectorAll('.filter-options a').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const href = a.getAttribute('href');
          const desktopLink = Array.from(sidebar.querySelectorAll('.filter-options a'))
            .find(da => da.getAttribute('href') === href || da.textContent === a.textContent);
          if (desktopLink) {
            desktopLink.click();
          }
        });
      });
    }

    // Setup Desktop filter listeners
    if (sidebar && !sidebar.dataset.listenersAttached) {
      sidebar.dataset.listenersAttached = 'true';
      sidebar.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
          const desktopInputs = Array.from(sidebar.querySelectorAll('input'));
          const idx = desktopInputs.indexOf(input);
          const mobInputs = document.querySelectorAll('#mobileFiltersContainer input');
          if (mobInputs[idx]) {
            mobInputs[idx].checked = input.checked;
          }
          applyFilters();
        });
      });

      // Price filter clicks logic
      sidebar.querySelectorAll('.filter-options a').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          sidebar.querySelectorAll('.filter-options a').forEach(link => link.style.fontWeight = 'normal');
          a.style.fontWeight = 'bold';
          sidebar.dataset.selectedPriceFilter = a.textContent.trim();
          applyFilters();
        });
      });

      // Clear mobile filters button hook
      const clearBtn = document.getElementById('clearMobileFiltersBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          sidebar.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
          document.querySelectorAll('#mobileFiltersContainer input[type="checkbox"]').forEach(i => i.checked = false);
          sidebar.querySelectorAll('.filter-options a').forEach(link => link.style.fontWeight = 'normal');
          delete sidebar.dataset.selectedPriceFilter;
          applyFilters();
        });
      }
    }

    // Mobile filter drawer toggles
    const filterBtn = document.getElementById('mobileFilterBtn');
    const closeFilterBtn = document.getElementById('closeFiltersBtn');
    const applyFilterBtn = document.getElementById('applyMobileFiltersBtn');
    const filtersOverlay = document.getElementById('filtersOverlay');
    const filtersDrawer = document.getElementById('filtersDrawer');

    if (filterBtn) {
      filterBtn.onclick = () => {
        filtersDrawer.classList.add('active');
        filtersOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      };
    }
    const hideFilterDrawer = () => {
      filtersDrawer.classList.remove('active');
      filtersOverlay.classList.remove('active');
      document.body.style.overflow = '';
    };
    if (closeFilterBtn) closeFilterBtn.onclick = hideFilterDrawer;
    if (applyFilterBtn) applyFilterBtn.onclick = hideFilterDrawer;
    if (filtersOverlay) filtersOverlay.onclick = hideFilterDrawer;

    // Apply Filter Logic
    const applyFilters = () => {
      let result = searchFiltered;

      // 1. Department Filter
      if (sidebar) {
        const checkedCategories = Array.from(sidebar.querySelectorAll('input[name="category"]:checked'))
          .map(input => input.parentElement.textContent.trim().toLowerCase())
          .filter(cat => cat !== 'all products');
        
        if (checkedCategories.length > 0) {
          result = result.filter(product => 
            product.category && checkedCategories.includes(product.category.toLowerCase())
          );
        }

        // 2. Price Filter (from selected link)
        const priceFilter = sidebar.dataset.selectedPriceFilter;
        if (priceFilter) {
          result = result.filter(product => {
            const price = product.price;
            if (priceFilter.includes('Under ₹1,000')) return price < 1000;
            if (priceFilter.includes('₹1,000 - ₹5,000')) return price >= 1000 && price <= 5000;
            if (priceFilter.includes('₹5,000 - ₹20,000')) return price >= 5000 && price <= 20000;
            if (priceFilter.includes('₹20,000 - ₹50,000')) return price >= 20000 && price <= 50000;
            if (priceFilter.includes('Over ₹50,000')) return price > 50000;
            return true;
          });
        }

        // 3. Discount Filter
        const checkedDiscounts = Array.from(sidebar.querySelectorAll('input[name="discount"]:checked'))
          .map(input => input.parentElement.textContent.trim().toLowerCase());
          
        if (checkedDiscounts.length > 0) {
          result = result.filter(product => {
            if (!product.originalPrice) return false;
            const pct = Math.round((1 - product.price / product.originalPrice) * 100);
            return checkedDiscounts.some(discText => {
              if (discText.includes('10%')) return pct >= 10;
              if (discText.includes('25%')) return pct >= 25;
              if (discText.includes('50%')) return pct >= 50;
              return false;
            });
          });
        }

        // 4. Availability Filter
        const includeOutOfStockInput = sidebar.querySelector('input[name="availability"]');
        const includeOutOfStock = includeOutOfStockInput ? includeOutOfStockInput.checked : true;
        if (!includeOutOfStock) {
          result = result.filter(product => product.stock > 0);
        }
      }

      renderProductGrid(result);
    };

    const renderProductGrid = (displayProducts) => {
      if (displayProducts.length === 0) {
        container.innerHTML = '<div class="empty-state">No products found matching your filters.</div>';
        const countEl = document.querySelector('.products-count');
        if(countEl) countEl.textContent = 'Showing 0 Products';
        return;
      }
      
      const sliceProducts = maxItems > 0 ? displayProducts.slice(0, maxItems) : displayProducts;
      
      container.innerHTML = sliceProducts.map(product => {
        const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
        
        // Generate Star Rating HTML
        const roundedStars = Math.round(product.rating || 4.5);
        let starsStr = '';
        for (let i = 1; i <= 5; i++) {
          starsStr += i <= roundedStars ? '★' : '☆';
        }
        const starsHTML = `<span class="amazon-stars">${starsStr}</span>`;
        
        // Format price with superscript layout
        const priceNum = Number(product.price) || 0;
        const wholePrice = Math.floor(priceNum).toLocaleString('en-IN');
        const fractionPrice = (priceNum % 1).toFixed(2).split('.')[1] || '00';
        
        // Dynamic Delivery Text
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const tomorrowStr = tomorrow.toLocaleDateString('en-US', options);
        
        const standard = new Date();
        standard.setDate(standard.getDate() + 3);
        const standardStr = standard.toLocaleDateString('en-US', options);
        
        let deliveryHTML = '';
        if (priceNum >= 999) {
          deliveryHTML = `<p class="product-delivery" style="font-size:0.8rem; margin: 4px 0 0; color:#0f1111;">Get it by <strong>Tomorrow, ${tomorrowStr}</strong><br><span style="color:#565959; font-size:0.75rem;">FREE Delivery by ZONIX</span></p>`;
        } else {
          deliveryHTML = `<p class="product-delivery" style="font-size:0.8rem; margin: 4px 0 0; color:#0f1111;">Get it by <strong>${standardStr}</strong><br><span style="color:#565959; font-size:0.75rem;">FREE Delivery over ₹499</span></p>`;
        }
        
        const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
        const productLink = (inRoot ? 'product/' : '../product/') + '?id=' + product.id;

        return `
        <article class="product-card" data-product-id="${product.id}">
            <a href="${productLink}" class="product-image-container" style="text-decoration:none;">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                <img src="${product.image || (inRoot ? 'assets/images/placeholder.jpg' : '../assets/images/placeholder.jpg')}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'"/>
            </a>
            <div class="product-info">
                <p class="product-category">${product.category || 'General'}</p>
                <a href="${productLink}" style="text-decoration:none;">
                    <h3 class="product-name">${product.name}</h3>
                </a>
                
                <div class="product-rating" style="display:flex; align-items:center; gap:4px; margin-bottom: 4px;">
                    ${starsHTML}
                    <a href="#" class="rating-count-link" onclick="event.preventDefault();">${(product.reviews || 100).toLocaleString()}</a>
                </div>

                <div class="product-pricing" style="margin-bottom: 4px;">
                    <div class="amazon-price-wrapper">
                        <span class="amazon-price-symbol">₹</span>
                        <span class="amazon-price-whole">${wholePrice}</span>
                        <span class="amazon-price-fraction">${fractionPrice}</span>
                    </div>
                    ${product.originalPrice ? `
                    <span class="product-original-price" style="text-decoration:line-through; color:#565959; font-size:0.85rem; margin-left:6px;">₹${Math.floor(product.originalPrice).toLocaleString('en-IN')}</span>
                    <span class="product-discount" style="color:#b12704; font-size:0.85rem; font-weight:600; margin-left:6px;">(${discount}% off)</span>` : ''}
                </div>

                <div style="margin-bottom: 8px; display:flex; flex-direction:column; gap:2px;">
                    ${priceNum >= 499 ? '<span class="zonix-premium-badge" style="background: linear-gradient(90deg, #d4af37, #f3e5ab); color: #1a1a2e; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; max-width: max-content; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">ZONIX Premium</span>' : ''}
                    ${deliveryHTML}
                </div>

            </div>
        </article>
      `}).join('');
      
      const countEl = document.querySelector('.products-count');
      if(countEl) countEl.textContent = `Showing ${sliceProducts.length} Products`;
      
      initProducts();
    };

    applyFilters();

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
  const badge = document.getElementById('cartBadge');
  const mobileBadge = document.getElementById('mobileCartBadge');
  
  const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  
  if (badge) {
      badge.textContent = totalItems;
      badge.style.display = totalItems > 0 ? 'flex' : 'none';
      badge.style.transform = 'scale(1.4)';
      setTimeout(() => badge.style.transform = 'scale(1)', 300);
  }
  
  if (mobileBadge) {
      mobileBadge.textContent = totalItems;
      mobileBadge.style.display = totalItems > 0 ? 'flex' : 'none';
      mobileBadge.style.transform = 'scale(1.4)';
      setTimeout(() => mobileBadge.style.transform = 'scale(1)', 300);
  }
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlistBadge');
  if (!badge) return;
  const totalItems = appState.wishlist ? appState.wishlist.length : 0;
  badge.textContent = totalItems;
  badge.style.display = totalItems > 0 ? 'flex' : 'none';
  badge.style.transform = 'scale(1.4)';
  badge.style.transition = 'transform 0.3s ease';
  setTimeout(() => badge.style.transform = 'scale(1)', 300);
}

function playFlyToCartAnimation(cardElement) {
    const img = cardElement.querySelector('.product-image');
    const cartIcon = document.querySelector('.cart-link');
    
    if (!img || !cartIcon) return;
    
    const imgRect = img.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();
    
    const flyingImg = img.cloneNode(true);
    flyingImg.style.position = 'fixed';
    flyingImg.style.top = imgRect.top + 'px';
    flyingImg.style.left = imgRect.left + 'px';
    flyingImg.style.width = imgRect.width + 'px';
    flyingImg.style.height = imgRect.height + 'px';
    flyingImg.style.borderRadius = '50%';
    flyingImg.style.zIndex = '99999';
    flyingImg.style.opacity = '0.9';
    flyingImg.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    flyingImg.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
    
    document.body.appendChild(flyingImg);
    
    requestAnimationFrame(() => {
        flyingImg.style.top = cartRect.top + 10 + 'px';
        flyingImg.style.left = cartRect.left + 10 + 'px';
        flyingImg.style.width = '20px';
        flyingImg.style.height = '20px';
        flyingImg.style.opacity = '0.1';
    });
    
    setTimeout(() => {
        flyingImg.remove();
        cartIcon.style.transform = 'scale(1.1)';
        cartIcon.style.transition = 'transform 0.2s';
        setTimeout(() => {
            cartIcon.style.transform = 'scale(1)';
        }, 200);
    }, 800);
}

function displayCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  
  const summaryAside = document.querySelector('.cart-summary');
  
  if (appState.cart.length === 0) {
    if (summaryAside) summaryAside.style.display = 'none';
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
  
  if (summaryAside) summaryAside.style.display = 'block';
  
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
          
          <div style="color: #10b981; font-size: 0.85rem; margin-bottom: 0.5rem;">In Stock</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.8rem;">
            <span style="display: inline-flex; align-items: center; background: #e0e7ff; color: #4338ca; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe; letter-spacing: 0.5px;">✓ ZONIX VERIFIED</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 1.5rem; margin-top: auto;">
            <div style="display: flex; align-items: center; border: 1px solid #d5d9d9; border-radius: 8px; background: #f0f2f2; box-shadow: 0 2px 5px rgba(15,17,17,.15); overflow: hidden;">
              <button class="qty-btn dec" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; font-size: 1.2rem; transition: background 0.1s;">−</button>
              <span style="width: 40px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fff; font-size: 0.95rem; font-weight: 600; border-left: 1px solid #d5d9d9; border-right: 1px solid #d5d9d9;">${item.quantity}</span>
              <button class="qty-btn inc" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; font-size: 1.2rem; transition: background 0.1s;">+</button>
            </div>
            <div style="width: 1px; height: 16px; background: #ddd;"></div>
            <button class="remove-btn" style="color: var(--color-accent-primary); background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Delete</button>
            <span style="color: #d5d9d9;">|</span>
            <button style="color: var(--color-accent-primary); background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Save for later</button>
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
      <a href="../shop/" class="cta-button" style="display:inline-block;background:var(--color-text-primary);color:white;">Continue Shopping</a>
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
        <button id="checkoutSignIn" style="padding:0.9rem;background:var(--color-accent-primary);color:#ffffff;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;transition:all 0.2s;">
          Sign In to Your Account
        </button>
        <button id="checkoutSignUp" style="padding:0.9rem;background:var(--color-text-primary);color:#fff;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;transition:all 0.2s;">
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
  if (document.getElementById('checkoutHeaderItemCount')) {
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('checkoutHeaderItemCount').textContent = totalItems;
  }
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
  if (document.getElementById('settingsEmailDisplay')) document.getElementById('settingsEmailDisplay').textContent = appState.currentUser.email;
  if (document.getElementById('settingsNameDisplay')) document.getElementById('settingsNameDisplay').textContent = appState.currentUser.displayName || 'Guest User';

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
  const carousel = document.getElementById('heroCarousel');
  const slides = document.querySelectorAll('.hero-slide');
  const prevBtn = document.querySelector('.hero-prev');
  const nextBtn = document.querySelector('.hero-next');
  const dots = document.querySelectorAll('.hero-dots .dot');
  if (slides.length === 0) return;

  let current = 0;
  let intervalId;
  
  function showSlide(n) {
    slides[current].classList.remove('active');
    if (dots.length > 0) dots[current].classList.remove('active');
    
    current = (n + slides.length) % slides.length;
    
    slides[current].classList.add('active');
    if (dots.length > 0) dots[current].classList.add('active');
  }

  function nextSlide() { showSlide(current + 1); }
  function prevSlide() { showSlide(current - 1); }

  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetInterval(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetInterval(); });

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showSlide(index);
      resetInterval();
    });
  });

  if (carousel) {
      let touchStartX = 0;
      let touchEndX = 0;
      
      carousel.addEventListener('touchstart', e => {
          touchStartX = e.changedTouches[0].screenX;
      }, {passive: true});
      
      carousel.addEventListener('touchend', e => {
          touchEndX = e.changedTouches[0].screenX;
          if (touchEndX < touchStartX - 50) { nextSlide(); resetInterval(); }
          if (touchEndX > touchStartX + 50) { prevSlide(); resetInterval(); }
      }, {passive: true});
      
      carousel.addEventListener('mouseenter', () => clearInterval(intervalId));
      carousel.addEventListener('mouseleave', () => startInterval());
  }

  function startInterval() {
    clearInterval(intervalId);
    intervalId = setInterval(nextSlide, 4000);
  }
  
  function resetInterval() {
    startInterval();
  }

  startInterval();
}

async function loadBestSellers() {
  const container = document.getElementById('bestSellersRow');
  if (!container) return;
  try {
    const products = await getProducts();
    products.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
    renderHorizontalRow(container, products.slice(0, 12));
    setupHorizontalScroll('bestSellers');
  } catch (err) {
    container.innerHTML = '<div class="loading-state">Failed to load best sellers.</div>';
  }
}

async function loadRecentlyViewed() {
  const section = document.getElementById('recentlyViewedSection');
  const container = document.getElementById('recentlyViewedRow');
  if (!section || !container) return;
  try {
    let recentIds = JSON.parse(localStorage.getItem('zonix_recently_viewed')) || [];
    if (recentIds.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    const products = await getProducts();
    const recentProducts = recentIds.map(id => products.find(p => p.id === id)).filter(p => p);
    renderHorizontalRow(container, recentProducts.slice(0, 8));
    setupHorizontalScroll('recentlyViewedSection');
  } catch (err) {
    section.style.display = 'none';
  }
}

function renderHorizontalRow(container, products) {
  const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
  const pathPrefix = inRoot ? '' : '../';
  container.innerHTML = products.map(product => {
    const defaultImage = `${pathPrefix}assets/images/placeholder.jpg`;
    const image = product.image ? (product.image.startsWith('http') ? product.image : pathPrefix + product.image) : defaultImage;
    const badgeHTML = product.badge ? `<span class="product-badge">${product.badge}</span>` : '';
    return `
      <div class="product-card" data-product-id="${product.id}" onclick="window.location.href='${pathPrefix}product/?id=${product.id}'" style="cursor:pointer;">
          ${badgeHTML}
          <div class="product-image-container">
              <img src="${image}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='${defaultImage}'">
          </div>
          <div class="product-info">
              <h3 class="product-name">${product.name}</h3>
              <div class="product-rating">
                  <span class="rating-badge">★ ${product.rating || '4.5'}</span>
              </div>
              <div class="product-pricing">
                  <span class="product-price">₹${(product.price || 0).toLocaleString('en-IN')}</span>
              </div>
              <button class="add-to-cart-btn" aria-label="Add to cart">Add to Cart</button>
          </div>
      </div>
    `;
  }).join('');
  setTimeout(initProducts, 100);
}

function setupHorizontalScroll(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const row = section.querySelector('.products-row');
  const prevBtn = section.querySelector('.scroll-prev');
  const nextBtn = section.querySelector('.scroll-next');
  if (!row || !prevBtn || !nextBtn) return;
  prevBtn.addEventListener('click', () => row.scrollBy({ left: -300, behavior: 'smooth' }));
  nextBtn.addEventListener('click', () => row.scrollBy({ left: 300, behavior: 'smooth' }));
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