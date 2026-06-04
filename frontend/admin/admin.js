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
  updateProduct,
  deleteProduct,
  updateOrderStatus,
  deleteUser,
  formatTimestamp,
  formatCurrency,
  getStatusClass
} from '../../backend/js/admin.js';
import { logoutUser } from '../../backend/js/auth.js';
import { importCjProductsToFirebase } from '../../backend/js/cj_import.js';
import { createCjOrder } from '../../backend/js/cj_api.js';

// =============================================
// DOM ELEMENTS
// =============================================

const pageTitle = document.getElementById('pageTitle');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Navigation
const navLinks = document.querySelectorAll('.nav-link');

// Forms
const addProductForm = document.getElementById('addProductForm');
const editProductForm = document.getElementById('editProductForm');
const editProductModal = document.getElementById('editProductModal');
const closeEditModal = document.getElementById('closeEditModal');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const importCjBtn = document.getElementById('importCjBtn');

// CJ Modal elements
const cjImportModal = document.getElementById('cjImportModal');
const closeCjModal = document.getElementById('closeCjModal');
const confirmImportCj = document.getElementById('confirmImportCj');
const cjKeywordInput = document.getElementById('cjKeyword');

// Store data globally for editing
window.adminData = {
  products: [],
  orders: [],
  users: []
};

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
    if (userAvatar) {
      userAvatar.textContent = user.email.charAt(0).toUpperCase();
    }
    
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

  // Import CJ Products button — opens keyword modal
  if (importCjBtn) {
    importCjBtn.addEventListener('click', () => {
      cjImportModal.classList.add('show');
    });
  }

  // Close CJ modal
  if (closeCjModal) {
    closeCjModal.addEventListener('click', () => cjImportModal.classList.remove('show'));
  }
  if (cjImportModal) {
    cjImportModal.addEventListener('click', (e) => {
      if (e.target === cjImportModal) cjImportModal.classList.remove('show');
    });
  }

  // Confirm CJ import
  if (confirmImportCj) {
    confirmImportCj.addEventListener('click', handleImportCjProducts);
  }
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

/**
 * Handle CJ Products import
 */
async function handleImportCjProducts() {
  const keyword = (cjKeywordInput ? cjKeywordInput.value.trim() : '') || 'tech';
  
  try {
    if (cjImportModal) cjImportModal.classList.remove('show');
    showLoading(true);
    showToast(`Importing "${keyword}" products from CJ Dropshipping...`, 'info');
    
    const result = await importCjProductsToFirebase(keyword);
    
    if (result.success && result.imported > 0) {
      showToast(result.message, 'success');
    } else if (result.success && result.imported === 0) {
      showToast('⚠️ No products returned from CJ. Your store may need verification on the CJ Dropshipping platform (My CJ → API Management). Try a different keyword or contact CJ support.', 'warning');
    }
    
    // Always refresh inventory
    const products = await getInventory();
    window.adminData.products = products;
    populateInventoryTable(products);
    const countEl = document.getElementById('inventoryCount');
    if (countEl) countEl.textContent = `${products.length} products`;
    
  } catch (error) {
    showToast('CJ Import failed: ' + error.message, 'error');
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
    window.adminData.products = products;
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
    window.adminData.orders = orders;
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
    window.adminData.users = users;
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
      <td>
        <select class="status-select" data-id="${order.id}" onchange="window.handleStatusChange(this)">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
        </select>
      </td>
    </tr>
  `).join('');
}

/**
 * Populate inventory table
 */
function populateInventoryTable(products) {
  const countEl = document.getElementById('inventoryCount');
  if (products.length === 0) {
    inventoryBody.innerHTML = '<tr><td colspan="6" class="empty-state">No products yet. Add one above or import from CJ!</td></tr>';
    if (countEl) countEl.textContent = '0 products';
    return;
  }

  if (countEl) countEl.textContent = `${products.length} products`;

  inventoryBody.innerHTML = products.map(product => {
    let stockStatus = 'in-stock';
    if (product.stock === 0) {
      stockStatus = 'out-of-stock';
    } else if (product.stock < 10) {
      stockStatus = 'low-stock';
    }

    return `
      <tr>
        <td><strong>${product.name}</strong>${product.source === 'cj_dropshipping' ? ' <span style="font-size:0.7rem;color:#f59e0b;font-weight:600;">CJ</span>' : ''}</td>
        <td>${formatCurrency(product.price)}</td>
        <td>${product.stock}</td>
        <td>${product.category || 'Uncategorized'}</td>
        <td><span class="status-badge ${stockStatus}">${stockStatus.replace(/-/g, ' ')}</span></td>
        <td class="actions-cell">
          <button class="btn btn-secondary btn-sm" onclick="window.openEditModal('${product.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="window.handleDeleteProduct('${product.id}')">Delete</button>
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
    allOrdersBody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders found</td></tr>';
    return;
  }

  allOrdersBody.innerHTML = orders.map(order => {
    const itemsCount = order.items ? order.items.length : 0;
    return `
      <tr>
        <td><code style="font-size:0.8rem;background:#f3f4f6;padding:2px 6px;border-radius:3px;">${order.id.substring(0, 8)}</code></td>
        <td>${order.userEmail || '—'}</td>
        <td><strong>${formatCurrency(order.totalAmount)}</strong></td>
        <td>${itemsCount}</td>
        <td><span class="status-badge ${getStatusClass(order.status)}">${order.status || 'pending'}</span></td>
        <td>${formatTimestamp(order.createdAt)}</td>
        <td class="actions-cell">
          <select class="status-select" data-id="${order.id}" onchange="window.handleStatusChange(this)">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="window.handleCjFulfillment('${order.id}')">
            🚀 Fulfill via CJ
          </button>
        </td>
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
      <td><code style="font-size:0.8rem;background:#f3f4f6;padding:2px 6px;border-radius:3px;">${user.id.substring(0, 8)}</code></td>
      <td>${user.email}</td>
      <td>${user.displayName || 'N/A'}</td>
      <td>${formatTimestamp(user.createdAt)}</td>
      <td class="actions-cell">
        <button class="btn btn-danger btn-sm" onclick="window.handleDeleteUser('${user.id}')">Delete</button>
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

// =============================================
// GLOBAL HANDLERS FOR INLINE EVENTS
// =============================================

window.handleStatusChange = async (select) => {
  const orderId = select.dataset.id;
  const newStatus = select.value;
  
  try {
    showLoading(true);
    await updateOrderStatus(orderId, newStatus);
    showToast('Order status updated successfully', 'success');
    
    // Update local data
    const orderIndex = window.adminData.orders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
      window.adminData.orders[orderIndex].status = newStatus;
    }
  } catch (error) {
    showToast('Failed to update order status: ' + error.message, 'error');
    // Revert select visually
    const order = window.adminData.orders.find(o => o.id === orderId);
    if (order) {
      select.value = order.status;
    }
  } finally {
    showLoading(false);
  }
};

window.handleCjFulfillment = async (orderId) => {
  const order = window.adminData.orders.find(o => o.id === orderId);
  if (!order) return;
  
  if (!confirm(`Are you sure you want to push Order ${order.id.substring(0,8)} to CJ Dropshipping for fulfillment?`)) {
    return;
  }
  
  try {
    showLoading(true);
    showToast('Sending order to CJ Dropshipping...', 'info');
    
    // Ensure missing fields have defaults for CJ API
    const orderData = {
      ...order,
      orderNumber: order.orderNumber || `ZONIX-${order.id}`,
      shippingAddress: {
        ...order.shippingAddress,
        name: order.shippingAddress?.name || order.userEmail || 'Customer',
        street: order.shippingAddress?.street || '123 Main St',
        city: order.shippingAddress?.city || 'New York',
        state: order.shippingAddress?.state || 'NY',
        zip: order.shippingAddress?.zip || '10001',
        phone: order.shippingAddress?.phone || '1234567890'
      }
    };

    const cjResult = await createCjOrder(orderData);
    
    // Update status to confirmed if successfully pushed
    await updateOrderStatus(orderId, 'confirmed');
    
    showToast(`Order pushed successfully to CJ! CJ Order ID: ${cjResult.orderId || 'Success'}`, 'success');
    
    // Refresh table
    const orders = await getAllOrders();
    window.adminData.orders = orders;
    populateAllOrdersTable(orders);
    
  } catch (error) {
    showToast('Failed to fulfill via CJ: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
};

window.openEditModal = function(productId) {
  const product = window.adminData.products.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('editProductId').value = product.id;
  document.getElementById('editProductName').value = product.name;
  document.getElementById('editProductPrice').value = product.price;
  document.getElementById('editProductStock').value = product.stock;
  document.getElementById('editProductCategory').value = product.category || '';
  document.getElementById('editProductImage').value = product.image;
  document.getElementById('editProductDescription').value = product.description;
  
  editProductModal.classList.add('show');
};

window.closeEditModalFn = function() {
  editProductModal.classList.remove('show');
};
if (closeEditModal) closeEditModal.addEventListener('click', window.closeEditModalFn);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', window.closeEditModalFn);

if (editProductForm) {
  editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('editProductId').value;
    const updates = {
      name: document.getElementById('editProductName').value,
      price: parseFloat(document.getElementById('editProductPrice').value),
      stock: parseInt(document.getElementById('editProductStock').value),
      category: document.getElementById('editProductCategory').value,
      image: document.getElementById('editProductImage').value,
      description: document.getElementById('editProductDescription').value
    };
    
    try {
      showLoading(true);
      await updateProduct(productId, updates);
      showToast('Product updated successfully', 'success');
      window.closeEditModalFn();
      const loadInventoryDataFn = async function() {
        const products = await getInventory();
        window.adminData.products = products;
        populateInventoryTable(products);
      };
      await loadInventoryDataFn();
    } catch (error) {
      showToast('Error updating product: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

window.handleDeleteProduct = async function(productId) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      showLoading(true);
      await deleteProduct(productId);
      showToast('Product deleted', 'success');
      const loadInventoryDataFn = async function() {
        const products = await getInventory();
        window.adminData.products = products;
        populateInventoryTable(products);
      };
      await loadInventoryDataFn();
    } catch (error) {
      showToast('Failed to delete product', 'error');
    } finally {
      showLoading(false);
    }
  }
};

window.handleDeleteUser = async function(userId) {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      showLoading(true);
      await deleteUser(userId);
      showToast('User deleted', 'success');
      const loadUsersDataFn = async function() {
        const users = await getAllUsers();
        window.adminData.users = users;
        populateUsersTable(users);
      };
      await loadUsersDataFn();
    } catch (error) {
      showToast('Failed to delete user', 'error');
    } finally {
      showLoading(false);
    }
  }
};

