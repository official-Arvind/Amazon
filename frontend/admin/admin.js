/**
 * Admin Panel Frontend JavaScript
 * Integrates admin UI with backend Firebase functions
 * 
 * Handles:
 * - Authentication guard
 * - Product management
 * - Order viewing
 * - User management
 * - Dashboard statistics
 */

'use strict';

import {
  checkAdminAuth,
  addProduct,
  getAllOrders,
  getInventory,
  getAllUsers,
  getAdminStats,
  getRecentOrders,
  formatTimestamp,
  formatCurrency,
  getStatusClass
} from '../../backend/js/admin.js';
import { logoutUser } from '../../backend/js/auth.js';

// =============================================
// DOM ELEMENTS
// =============================================

const pageTitle = document.getElementById('pageTitle');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Navigation
const navLinks = document.querySelectorAll('.nav-link');

// Forms
const addProductForm = document.getElementById('addProductForm');

// Sections
const sections = document.querySelectorAll('.section');

// Tables
const recentOrdersBody = document.getElementById('recentOrdersBody');
const allOrdersBody = document.getElementById('allOrdersBody');
const inventoryBody = document.getElementById('inventoryBody');
const usersBody = document.getElementById('usersBody');

// Stats
const totalProductsEl = document.getElementById('totalProducts');
const totalOrdersEl = document.getElementById('totalOrders');
const totalUsersEl = document.getElementById('totalUsers');
const totalRevenueEl = document.getElementById('totalRevenue');

// =============================================
// INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('✓ Admin panel loading...');
  
  try {
    showLoading(true);
    
    // Check authentication
    const user = await checkAdminAuth();
    console.log('✓ Admin authenticated:', user.email);
    
    // Update UI with user info
    userEmail.textContent = user.email;
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load initial data
    await loadDashboardData();
    
    showLoading(false);
    showToast('Welcome to Admin Panel', 'info');
  } catch (error) {
    console.error('✗ Admin panel error:', error.message);
    showLoading(false);
  }
});

// =============================================
// EVENT LISTENERS
// =============================================

function initializeEventListeners() {
  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', handleNavigation);
  });

  // Forms
  addProductForm.addEventListener('submit', handleAddProduct);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);
}

/**
 * Handle navigation between sections
 */
function handleNavigation(e) {
  const sectionName = e.currentTarget.getAttribute('data-section');
  
  // Update active nav link
  navLinks.forEach(link => link.classList.remove('active'));
  e.currentTarget.classList.add('active');

  // Show correct section
  sections.forEach(section => section.classList.remove('active'));
  const section = document.getElementById(sectionName);
  if (section) {
    section.classList.add('active');
  }

  // Update page title
  const titleMap = {
    'dashboard': 'Dashboard',
    'products': 'Manage Products',
    'orders': 'View Orders',
    'users': 'User Management'
  };
  pageTitle.textContent = titleMap[sectionName] || 'Dashboard';

  // Load section-specific data
  if (sectionName === 'products') {
    loadInventoryData();
  } else if (sectionName === 'orders') {
    loadAllOrdersData();
  } else if (sectionName === 'users') {
    loadUsersData();
  }
}

/**
 * Handle logout
 */
async function handleLogout(e) {
  e.preventDefault();
  
  if (confirm('Are you sure you want to logout?')) {
    try {
      showLoading(true);
      await logoutUser();
      console.log('✓ Admin logged out');
      window.location.href = '../login/';
    } catch (error) {
      console.error('✗ Logout error:', error.message);
      showToast('Logout failed: ' + error.message, 'error');
      showLoading(false);
    }
  }
}

/**
 * Handle add product form submission
 */
async function handleAddProduct(e) {
  e.preventDefault();

  // Get form data
  const formData = new FormData(addProductForm);
  const productData = {
    name: formData.get('name'),
    price: parseFloat(formData.get('price')),
    stock: parseInt(formData.get('stock')),
    image: formData.get('image'),
    description: formData.get('description'),
    category: formData.get('category')
  };

  // Clear previous messages
  document.getElementById('productError').classList.remove('show');
  document.getElementById('productSuccess').classList.remove('show');

  try {
    showLoading(true);

    // Add product to database
    const newProduct = await addProduct(productData);
    console.log('✓ Product added:', newProduct.id);

    // Reset form
    addProductForm.reset();

    // Show success message
    const successEl = document.getElementById('productSuccess');
    successEl.textContent = `Product "${newProduct.name}" added successfully!`;
    successEl.classList.add('show');

    showToast('Product added successfully!', 'success');

    // Reload inventory
    await loadInventoryData();
  } catch (error) {
    console.error('✗ Error adding product:', error.message);
    const errorEl = document.getElementById('productError');
    errorEl.textContent = error.message || 'Failed to add product';
    errorEl.classList.add('show');
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// =============================================
// DATA LOADING
// =============================================

/**
 * Load dashboard data (stats and recent orders)
 */
async function loadDashboardData() {
  try {
    showLoading(true);

    // Get statistics
    const stats = await getAdminStats();
    totalProductsEl.textContent = stats.totalProducts;
    totalOrdersEl.textContent = stats.totalOrders;
    totalUsersEl.textContent = stats.totalUsers;
    totalRevenueEl.textContent = formatCurrency(stats.totalRevenue);

    // Load recent orders
    const recentOrders = await getRecentOrders(5);
    populateRecentOrdersTable(recentOrders);

    showLoading(false);
  } catch (error) {
    console.error('✗ Error loading dashboard:', error.message);
    showToast('Failed to load dashboard data', 'error');
    showLoading(false);
  }
}

/**
 * Load inventory data
 */
async function loadInventoryData() {
  try {
    showLoading(true);

    const products = await getInventory();
    populateInventoryTable(products);

    showLoading(false);
  } catch (error) {
    console.error('✗ Error loading inventory:', error.message);
    showToast('Failed to load inventory', 'error');
    showLoading(false);
  }
}

/**
 * Load all orders data
 */
async function loadAllOrdersData() {
  try {
    showLoading(true);

    const orders = await getAllOrders();
    populateAllOrdersTable(orders);

    showLoading(false);
  } catch (error) {
    console.error('✗ Error loading orders:', error.message);
    showToast('Failed to load orders', 'error');
    showLoading(false);
  }
}

/**
 * Load users data
 */
async function loadUsersData() {
  try {
    showLoading(true);

    const users = await getAllUsers();
    populateUsersTable(users);

    showLoading(false);
  } catch (error) {
    console.error('✗ Error loading users:', error.message);
    showToast('Failed to load users', 'error');
    showLoading(false);
  }
}

// =============================================
// TABLE POPULATION
// =============================================

/**
 * Populate recent orders table
 */
function populateRecentOrdersTable(orders) {
  if (orders.length === 0) {
    recentOrdersBody.innerHTML = '<tr><td colspan="5" class="empty-state">No orders yet</td></tr>';
    return;
  }

  recentOrdersBody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.id.substring(0, 8)}</td>
      <td>${order.userEmail}</td>
      <td>${formatCurrency(order.totalAmount)}</td>
      <td>
        <span class="status-badge ${getStatusClass(order.status)}">
          ${order.status || 'pending'}
        </span>
      </td>
      <td>${formatTimestamp(order.createdAt)}</td>
    </tr>
  `).join('');
}

/**
 * Populate inventory table
 */
function populateInventoryTable(products) {
  if (products.length === 0) {
    inventoryBody.innerHTML = '<tr><td colspan="5" class="empty-state">No products yet</td></tr>';
    return;
  }

  inventoryBody.innerHTML = products.map(product => {
    let stockStatus = 'in-stock';
    if (product.stock === 0) {
      stockStatus = 'out-of-stock';
    } else if (product.stock < 10) {
      stockStatus = 'low-stock';
    }

    return `
      <tr>
        <td>${product.name}</td>
        <td>${formatCurrency(product.price)}</td>
        <td>${product.stock}</td>
        <td>${product.category || 'Uncategorized'}</td>
        <td>
          <span class="status-badge ${stockStatus}">
            ${stockStatus.replace('-', ' ')}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Populate all orders table
 */
function populateAllOrdersTable(orders) {
  if (orders.length === 0) {
    allOrdersBody.innerHTML = '<tr><td colspan="6" class="empty-state">No orders found</td></tr>';
    return;
  }

  allOrdersBody.innerHTML = orders.map(order => {
    const itemsCount = order.items ? order.items.length : 0;
    return `
      <tr>
        <td>${order.id.substring(0, 8)}</td>
        <td>${order.userEmail}</td>
        <td>${formatCurrency(order.totalAmount)}</td>
        <td>${itemsCount}</td>
        <td>
          <span class="status-badge ${getStatusClass(order.status)}">
            ${order.status || 'pending'}
          </span>
        </td>
        <td>${formatTimestamp(order.createdAt)}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Populate users table
 */
function populateUsersTable(users) {
  if (users.length === 0) {
    usersBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found</td></tr>';
    return;
  }

  usersBody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id.substring(0, 8)}</td>
      <td>${user.email}</td>
      <td>${user.displayName || 'N/A'}</td>
      <td>${formatTimestamp(user.createdAt)}</td>
      <td>
        <button class="btn-small" title="View Details">Details</button>
      </td>
    </tr>
  `).join('');
}

// =============================================
// UI HELPERS
// =============================================

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.add('show');
  } else {
    loadingOverlay.classList.remove('show');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
