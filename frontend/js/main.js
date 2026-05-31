/**
 * Main Application Entry Point
 * 
 * This file contains the core JavaScript logic for the e-commerce application.
 * It's structured as a boilerplate ready for vanilla JS and Firebase integration.
 * 
 * STRUCTURE:
 * - Initialization on DOM ready
 * - Event listeners and delegation
 * - Core functionality (cart, navigation, products, etc.)
 * - Utility functions
 * - Firebase integration points (to be added later)
 * 
 * TODO:
 * - Implement product filtering and search
 * - Add to cart functionality
 * - User authentication with Firebase
 * - Shopping cart management
 * - Order processing
 * - Wishlist functionality
 */

'use strict';

// =============================================
// GLOBAL APP STATE
// =============================================
const appState = {
    cart: [],
    wishlist: [],
    currentPage: 'home',
    userAuthenticated: false,
};

// =============================================
// APPLICATION INITIALIZATION
// =============================================

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('App loaded');
    
    // Load persisted data from localStorage
    loadPersistedData();
    
    // Initialize components
    initNavigation();
    initProducts();
    initCart();
    initButtons();
});

/**
 * Load data persisted in localStorage
 */
function loadPersistedData() {
    const savedCart = localStorage.getItem('minimalist_cart');
    const savedWishlist = localStorage.getItem('minimalist_wishlist');
    
    if (savedCart) {
        try {
            appState.cart = JSON.parse(savedCart);
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    }
    
    if (savedWishlist) {
        try {
            appState.wishlist = JSON.parse(savedWishlist);
        } catch (error) {
            console.error('Error loading wishlist:', error);
        }
    }
}

/**
 * Persist data to localStorage
 */
function persistData() {
    localStorage.setItem('minimalist_cart', JSON.stringify(appState.cart));
    localStorage.setItem('minimalist_wishlist', JSON.stringify(appState.wishlist));
}

// =============================================
// NAVIGATION
// =============================================

/**
 * Initialize navigation menu interactions
 */
function initNavigation() {
    console.log('Navigation initialized');
    
    // Update active nav link based on current page
    updateActiveNavLink();
    
    // Add smooth scroll behavior (already in CSS, but we can enhance it here)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Don't prevent default - let browser handle normal navigation
            console.log('Navigation clicked:', this.href);
        });
    });
}

/**
 * Update active navigation link
 */
function updateActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Match current path with nav link
        if (currentPath === href || (currentPath === '/' && href === '/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// =============================================
// PRODUCTS
// =============================================

/**
 * Initialize product listing and interactions
 */
function initProducts() {
    console.log('Products initialized');
    
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const wishlistBtn = card.querySelector('.wishlist-btn');
        const addToCartBtn = card.querySelector('.add-to-cart-btn');
        
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleWishlist(card);
            });
        }
        
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleAddToCart(card);
            });
        }
    });
}

/**
 * Handle adding products to wishlist
 */
function handleWishlist(productCard) {
    const productName = productCard.querySelector('.product-name').textContent;
    const productPrice = productCard.querySelector('.product-price').textContent;
    
    console.log('Added to wishlist:', productName, productPrice);
    
    // Visual feedback
    const wishlistBtn = productCard.querySelector('.wishlist-btn');
    wishlistBtn.style.opacity = '0.5';
    
    // Simple alert for now (replace with toast notification later)
    // showNotification(`${productName} added to wishlist!`);
}

/**
 * Handle adding products to cart
 */
function handleAddToCart(productCard) {
    const productName = productCard.querySelector('.product-name').textContent;
    const productPrice = productCard.querySelector('.product-price').textContent;
    const productCategory = productCard.querySelector('.product-category').textContent;
    
    const product = {
        id: Math.random(), // Replace with real product ID later
        name: productName,
        price: productPrice,
        category: productCategory,
        quantity: 1,
    };
    
    appState.cart.push(product);
    persistData();
    
    console.log('Added to cart:', productName, 'Cart size:', appState.cart.length);
    
    // Visual feedback
    const addBtn = productCard.querySelector('.add-to-cart-btn');
    addBtn.textContent = 'Added!';
    setTimeout(() => {
        addBtn.textContent = 'Add to Cart';
    }, 1500);
}

// =============================================
// SHOPPING CART
// =============================================

/**
 * Initialize shopping cart functionality
 */
function initCart() {
    console.log('Cart initialized - Items:', appState.cart.length);
    
    // Cart icon click handler
    const cartIcon = document.querySelector('[aria-label="Cart"]');
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            console.log('Cart clicked. Current cart:', appState.cart);
            // TODO: Show cart modal/sidebar
        });
    }
}

/**
 * Get cart total
 */
function getCartTotal() {
    return appState.cart.reduce((total, item) => {
        const price = parseFloat(item.price.replace('$', ''));
        return total + (price * item.quantity);
    }, 0);
}

/**
 * Get cart item count
 */
function getCartItemCount() {
    return appState.cart.reduce((count, item) => count + item.quantity, 0);
}

// =============================================
// BUTTON & FORM HANDLERS
// =============================================

/**
 * Initialize button and form event handlers
 */
function initButtons() {
    console.log('Buttons initialized');
    
    // Search button
    const searchBtn = document.querySelector('[aria-label="Search"]');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            console.log('Search clicked');
            // TODO: Show search modal
        });
    }
    
    // Account button
    const accountBtn = document.querySelector('[aria-label="Account"]');
    if (accountBtn) {
        accountBtn.addEventListener('click', function() {
            console.log('Account clicked');
            // TODO: Show account menu or redirect to login
        });
    }
    
    // Sort select (on shop page)
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            console.log('Sort changed to:', this.value);
            // TODO: Implement sorting logic
        });
    }
    
    // Filter buttons (on shop page)
    const filterLabels = document.querySelectorAll('.filter-label');
    filterLabels.forEach(label => {
        label.addEventListener('change', function() {
            console.log('Filter changed');
            // TODO: Implement filtering logic
        });
    });
    
    // Reset filters button (on shop page)
    const resetBtn = document.querySelector('.filter-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            console.log('Filters reset');
            // Reset all filter checkboxes
            const checkboxes = document.querySelectorAll('.filter-label input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            // TODO: Reset products display
        });
    }
    
    // Pagination buttons (on shop page)
    const paginationBtns = document.querySelectorAll('.pagination-btn');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('Pagination clicked:', this.textContent);
            paginationBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // TODO: Implement pagination
        });
    });
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Show a notification toast
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, info)
 */
function showNotification(message, type = 'success') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // TODO: Implement a proper toast notification system
    // This is a placeholder for future implementation
}

/**
 * Format price to currency string
 * @param {number} price - The price to format
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
function isUserAuthenticated() {
    return appState.userAuthenticated;
}

// =============================================
// FIREBASE INTEGRATION (Placeholder)
// =============================================

/**
 * Initialize Firebase
 * This will be called after firebase-config.js is loaded
 */
function initFirebase() {
    console.log('Firebase initialization placeholder');
    // TODO: Implement Firebase initialization
    // - Set up authentication listeners
    // - Load products from Firestore
    // - Set up real-time listeners for user data
}

/**
 * Firebase user authentication state changed
 */
function onAuthStateChanged() {
    console.log('Auth state listener placeholder');
    // TODO: Listen for auth state changes from Firebase
}

// =============================================
// ERROR HANDLING
// =============================================

/**
 * Global error handler
 */
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    // TODO: Send error to logging service
});

/**
 * Unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    // TODO: Send error to logging service
});
