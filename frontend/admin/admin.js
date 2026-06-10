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
  getStatusClass,
  getAdminAccounts,
  createAdminAccount,
  updateAdminRole,
  deleteAdminAccount,
  getGuestOrders,
  bulkImportProducts,
  updateAmazonProductPrice,
  clearAllProducts
} from '../../backend/js/admin.js';
import { logoutUser } from '../../backend/js/auth.js';

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


// Store data globally for editing
window.adminData = {
  products: [],
  orders: [],
  users: [],
  admins: [],
  currentAdmin: null
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

    // Store admin info including role and permissions
    window.adminData.currentAdmin = user;

    // Show/hide admin management nav based on permissions
    const adminsNavLink = document.querySelector('[data-section="admins"]');
    if (adminsNavLink) {
      adminsNavLink.style.display = user.permissions?.manageAdmins ? 'flex' : 'none';
    }

    // Show role badge
    const roleBadge = document.getElementById('adminRoleBadge');
    if (roleBadge) {
      const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', moderator: 'Moderator' };
      roleBadge.textContent = roleLabels[user.role] || user.role;
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load initial data
    await loadDashboardData();
    
    // Reveal the admin UI by hiding auth overlay
    const authOverlay = document.getElementById('authLoadingOverlay');
    if (authOverlay) authOverlay.classList.add('hidden');

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



  const clearAllProductsBtn = document.getElementById('clearAllProductsBtn');
  if (clearAllProductsBtn) {
    clearAllProductsBtn.addEventListener('click', async () => {
      if (confirm('⚠️ WARNING: This will permanently DELETE all products in your catalog. This action cannot be undone. Continue?')) {
        try {
          showLoading(true);
          const count = await clearAllProducts();
          showToast(`✓ Cleared ${count} products successfully!`, 'success');
          await loadInventoryData();
        } catch (e) {
          showToast('Failed to clear products: ' + e.message, 'error');
        } finally {
          showLoading(false);
        }
      }
    });
  }

  // Scraper Tab Setup
  setupScraperTabs();

  // Scraper Forms Submissions
  const autoScraperForm = document.getElementById('autoScraperForm');
  const htmlPasteForm = document.getElementById('htmlPasteForm');
  const syncAllPricesBtn = document.getElementById('syncAllPricesBtn');

  if (autoScraperForm) {
    autoScraperForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyword = document.getElementById('autoScrapeKeyword').value.trim();
      const category = document.getElementById('autoScrapeCategory').value;
      const limit = parseInt(document.getElementById('autoScrapeLimit').value) || 10;
      const consoleLog = document.getElementById('autoScrapeConsole');
      
      if (!keyword) return;
      
      try {
        showLoading(true);
        const products = await scrapeAmazonKeyword(keyword, category, limit, consoleLog);
        
        if (products.length > 0) {
          consoleLog.textContent += `[INFO] Importing ${products.length} products to database...\n`;
          const result = await bulkImportProducts(products);
          consoleLog.textContent += `[SUCCESS] Done! Added: ${result.added}, Updated: ${result.updated} products.\n`;
          showToast(`Bulk imported ${products.length} products!`, 'success');
          
          // Reload database
          const inventory = await getInventory();
          window.adminData.products = inventory;
        }
      } catch (error) {
        consoleLog.textContent += `[ERROR] Database write failed: ${error.message}\n`;
        showToast('Import failed', 'error');
      } finally {
        showLoading(false);
      }
    });
  }

  if (htmlPasteForm) {
    htmlPasteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const htmlContent = document.getElementById('htmlPasteContent').value.trim();
      const category = document.getElementById('htmlPasteCategory').value;
      const consoleLog = document.getElementById('htmlPasteConsole');
      
      if (!htmlContent) return;
      
      try {
        showLoading(true);
        consoleLog.textContent = `[INFO] Parsing pasted HTML content...\n`;
        const products = parseAmazonHTML(htmlContent, category);
        
        if (products.length === 0) {
          consoleLog.textContent += `[WARNING] Could not parse any products from the HTML. Check that you copied from Amazon Search or Product details page source.\n`;
          showToast('No products found in HTML', 'warning');
          return;
        }
        
        consoleLog.textContent += `[SUCCESS] Parsed ${products.length} products successfully!\n`;
        consoleLog.textContent += `[INFO] Importing to database...\n`;
        
        const result = await bulkImportProducts(products);
        consoleLog.textContent += `[SUCCESS] Done! Added: ${result.added}, Updated: ${result.updated} products.\n`;
        showToast(`Imported ${products.length} products!`, 'success');
        
        // Clear textarea
        document.getElementById('htmlPasteContent').value = '';
        
        // Reload database
        const inventory = await getInventory();
        window.adminData.products = inventory;
      } catch (error) {
        consoleLog.textContent += `[ERROR] Parse/Import failed: ${error.message}\n`;
        showToast('Import failed', 'error');
      } finally {
        showLoading(false);
      }
    });
  }

  if (syncAllPricesBtn) {
    syncAllPricesBtn.addEventListener('click', async () => {
      let products = window.adminData.products;
      if (products.length === 0) {
        products = await getInventory();
        window.adminData.products = products;
      }
      
      const amazonProducts = products.filter(p => p.asin);
      if (amazonProducts.length === 0) {
        showToast('No Amazon products to sync', 'info');
        return;
      }
      
      showToast(`Bulk sync started for ${amazonProducts.length} items...`, 'info');
      let successCount = 0;
      
      try {
        showLoading(true);
        for (const p of amazonProducts) {
          try {
            const targetUrl = `https://www.amazon.in/dp/${p.asin}`;
            const html = await fetchAmazonHTML(targetUrl);
            const extracted = parseAmazonHTML(html, 'Temp');
            if (extracted.length > 0) {
              const ep = extracted[0];
              await updateAmazonProductPrice(p.id, ep.price, ep.originalPrice);
              successCount++;
            }
          } catch (e) {
            console.warn(`Failed to sync ASIN ${p.asin}:`, e);
          }
        }
        showToast(`Synced ${successCount}/${amazonProducts.length} prices!`, 'success');
        const inventory = await getInventory();
        window.adminData.products = inventory;
        await loadScraperData();
      } catch (error) {
        showToast('Sync process failed', 'error');
      } finally {
        showLoading(false);
      }
    });
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
    'users': 'User Management',
    'admins': 'Admin Management',
    'scraper': 'Amazon Scraper & Price Tracker'
  };
  pageTitle.textContent = titleMap[sectionName] || 'Dashboard';

  // Load section-specific data
  if (sectionName === 'products') {
    loadInventoryData();
  } else if (sectionName === 'orders') {
    loadAllOrdersData();
  } else if (sectionName === 'users') {
    loadUsersData();
  } else if (sectionName === 'admins') {
    loadAdminsData();
  } else if (sectionName === 'scraper') {
    loadScraperData();
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
    inventoryBody.innerHTML = '<tr><td colspan="6" class="empty-state">No products yet. Add one above!</td></tr>';
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
        <td><strong>${product.name}</strong></td>
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

// =============================================
// ADMIN MANAGEMENT
// =============================================

async function loadAdminsData() {
  try {
    showLoading(true);
    const admins = await getAdminAccounts();
    window.adminData.admins = admins;
    populateAdminsSection(admins);
  } catch (error) {
    showToast('Failed to load admins', 'error');
  } finally {
    showLoading(false);
  }
}

function populateAdminsSection(admins) {
  const container = document.getElementById('adminsContent');
  if (!container) return;

  const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', moderator: 'Moderator' };
  const roleBadgeColors = { super_admin: '#dc2626', admin: '#2563eb', moderator: '#16a34a' };

  container.innerHTML = `
    <div style="margin-bottom:2rem;">
      <h3 style="margin-bottom:1rem;color:#e2e8f0;">Create New Admin</h3>
      <form id="createAdminForm" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:end;">
        <div style="flex:1;min-width:200px;">
          <label style="display:block;font-size:0.8rem;color:#94a3b8;margin-bottom:0.3rem;">Email Address</label>
          <input type="email" id="newAdminEmail" placeholder="user@example.com" required
            style="width:100%;padding:0.6rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#e2e8f0;box-sizing:border-box;">
        </div>
        <div style="min-width:150px;">
          <label style="display:block;font-size:0.8rem;color:#94a3b8;margin-bottom:0.3rem;">Role</label>
          <select id="newAdminRole" style="width:100%;padding:0.6rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#e2e8f0;">
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="padding:0.6rem 1.5rem;">
          + Add Admin
        </button>
      </form>
    </div>

    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${admins.length === 0 ? '<tr><td colspan="5" class="empty-state">No admin accounts found</td></tr>' : 
            admins.map(admin => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:0.5rem;">
                    <div style="width:32px;height:32px;border-radius:50%;background:${roleBadgeColors[admin.role] || '#6b7280'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;">
                      ${(admin.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>${admin.email}</strong>
                      ${admin.createdBy ? `<br><small style="color:#94a3b8;">Added by ${admin.createdBy}</small>` : ''}
                    </div>
                  </div>
                </td>
                <td>
                  <span style="background:${roleBadgeColors[admin.role] || '#6b7280'}22;color:${roleBadgeColors[admin.role] || '#6b7280'};padding:0.25rem 0.75rem;border-radius:12px;font-size:0.8rem;font-weight:600;">
                    ${roleLabels[admin.role] || admin.role}
                  </span>
                </td>
                <td style="color:#94a3b8;font-size:0.85rem;">${admin.createdAt ? formatTimestamp(admin.createdAt) : 'N/A'}</td>
                <td><span style="color:#16a34a;font-weight:600;">${admin.status || 'Active'}</span></td>
                <td>
                  ${admin.role === 'super_admin' ? '<span style="color:#94a3b8;font-size:0.8rem;">Protected</span>' : `
                    <select onchange="window.handleAdminRoleChange('${admin.id}', this.value)" style="padding:0.3rem;background:#1e293b;border:1px solid #334155;border-radius:4px;color:#e2e8f0;font-size:0.8rem;margin-right:0.5rem;">
                      <option value="admin" ${admin.role === 'admin' ? 'selected' : ''}>Admin</option>
                      <option value="moderator" ${admin.role === 'moderator' ? 'selected' : ''}>Moderator</option>
                    </select>
                    <button onclick="window.handleDeleteAdmin('${admin.id}', '${admin.email}')" class="btn btn-sm" style="background:#dc262622;color:#dc2626;border:1px solid #dc262644;padding:0.3rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.8rem;">
                      Delete
                    </button>
                  `}
                </td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>

    <div style="margin-top:1.5rem;background:#1e293b;border-radius:8px;padding:1.5rem;">
      <h4 style="color:#e2e8f0;margin-bottom:0.75rem;">Permission Levels</h4>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="color:#94a3b8;font-size:0.8rem;"><th style="text-align:left;padding:0.5rem;">Role</th><th>Products</th><th>Orders</th><th>Users</th><th>Admins</th></tr>
        <tr style="font-size:0.85rem;"><td style="padding:0.5rem;color:#e2e8f0;font-weight:600;">Super Admin</td><td style="text-align:center;">✅</td><td style="text-align:center;">✅</td><td style="text-align:center;">✅</td><td style="text-align:center;">✅</td></tr>
        <tr style="font-size:0.85rem;"><td style="padding:0.5rem;color:#e2e8f0;font-weight:600;">Admin</td><td style="text-align:center;">✅</td><td style="text-align:center;">✅</td><td style="text-align:center;">✅</td><td style="text-align:center;">❌</td></tr>
        <tr style="font-size:0.85rem;"><td style="padding:0.5rem;color:#e2e8f0;font-weight:600;">Moderator</td><td style="text-align:center;">❌</td><td style="text-align:center;">✅ (view)</td><td style="text-align:center;">✅ (view)</td><td style="text-align:center;">❌</td></tr>
      </table>
    </div>
  `;

  // Attach create admin form listener
  document.getElementById('createAdminForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newAdminEmail').value.trim();
    const role = document.getElementById('newAdminRole').value;
    
    if (!email) { showToast('Email is required', 'error'); return; }
    
    try {
      showLoading(true);
      await createAdminAccount(email, role, window.adminData.currentAdmin?.email);
      showToast(`Admin account created for ${email}`, 'success');
      document.getElementById('newAdminEmail').value = '';
      await loadAdminsData();
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

window.handleAdminRoleChange = async function(adminId, newRole) {
  try {
    showLoading(true);
    await updateAdminRole(adminId, newRole);
    showToast('Role updated', 'success');
    await loadAdminsData();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
};

window.handleDeleteAdmin = async function(adminId, email) {
  if (confirm(`Remove admin access for ${email}?`)) {
    try {
      showLoading(true);
      await deleteAdminAccount(adminId);
      showToast('Admin removed', 'success');
      await loadAdminsData();
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }
};

// =============================================
// AMAZON SCRAPER & PRICE TRACKER INTEGRATION
// =============================================

function setupScraperTabs() {
  const tabs = document.querySelectorAll('.scraper-tab-btn');
  const panes = document.querySelectorAll('.scraper-pane');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = `pane-${tab.dataset.tab}`;
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
      
      if (tab.dataset.tab === 'price-tracker') {
        loadScraperData();
      }
    });
  });
}

function parseAmazonHTML(htmlString, category = 'General') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const products = [];
  
  // Try search page results
  const items = doc.querySelectorAll('div[data-component-type="s-search-result"], div.s-result-item[data-asin]');
  if (items && items.length > 0) {
    items.forEach(item => {
      const asin = item.getAttribute('data-asin');
      if (!asin) return;
      
      const titleEl = item.querySelector('h2 a span, .a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal');
      const imgEl = item.querySelector('img.s-image');
      const priceEl = item.querySelector('.a-price span.a-offscreen');
      const origPriceEl = item.querySelector('.a-price.a-text-price span.a-offscreen');
      const ratingEl = item.querySelector('span.a-icon-alt');
      const reviewsEl = item.querySelector('span.a-size-base.s-underline-text, a.a-link-normal .a-size-base');
      
      if (!titleEl || !priceEl) return;
      
      const name = titleEl.textContent.trim();
      const image = imgEl ? imgEl.getAttribute('src') : '';
      const priceRaw = priceEl.textContent;
      const priceText = priceRaw.replace(/,/g, '').match(/([0-9.]+)/);
      const price = priceText ? parseFloat(priceText[1]) : 0;
      
      let originalPrice = null;
      if (origPriceEl) {
        const origPriceRaw = origPriceEl.textContent;
        const origPriceText = origPriceRaw.replace(/,/g, '').match(/([0-9.]+)/);
        originalPrice = origPriceText ? parseFloat(origPriceText[1]) : null;
      }
      
      let rating = 4.5;
      if (ratingEl) {
        const ratingMatch = ratingEl.textContent.match(/([0-9.]+)/);
        if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      }
      
      let reviews = 100;
      if (reviewsEl) {
        const reviewsText = reviewsEl.textContent.replace(/[^\d]/g, '');
        if (reviewsText) reviews = parseInt(reviewsText);
      }
      
      products.push({
        asin,
        name,
        price,
        originalPrice: originalPrice || Math.round(price * 1.25),
        image,
        rating,
        reviews,
        category,
        description: `${name}. Real product imported directly from Amazon.`,
        stock: 50,
        badge: originalPrice ? 'Sale' : '',
        source: 'amazon'
      });
    });
  }
  
  // Try single product details page
  if (products.length === 0) {
    const titleEl = doc.querySelector('#productTitle');
    if (titleEl) {
      const name = titleEl.textContent.trim();
      
      // Dynamic image resolution parsing
      const imgEl = doc.querySelector('#landingImage, #imgBlkFront, #ebooksImgBlkFront');
      let image = '';
      if (imgEl) {
        image = imgEl.getAttribute('data-old-hires') || imgEl.getAttribute('src') || '';
        const dynamicImageStr = imgEl.getAttribute('data-a-dynamic-image');
        if (dynamicImageStr) {
          try {
            const dynamicImages = JSON.parse(dynamicImageStr);
            const urls = Object.keys(dynamicImages);
            if (urls.length > 0) image = urls[0];
          } catch (e) {}
        }
      }
      
      // Robust Price Selectors
      const priceEl = doc.querySelector(
        '.a-price.priceToPay span.a-offscreen, ' +
        '#corePrice_feature_div .a-price span.a-offscreen, ' +
        '#priceblock_ourprice, ' +
        '#priceblock_dealprice, ' +
        '#price_inside_buybox, ' +
        '.apexPriceToPay span.a-offscreen, ' +
        '.a-price span.a-offscreen'
      );
      const priceRaw = priceEl ? priceEl.textContent : '0';
      const priceText = priceRaw.replace(/,/g, '').match(/([0-9.]+)/);
      const price = priceText ? parseFloat(priceText[1]) : 0;
      
      // Robust MSRP/List Price Selectors
      const origPriceEl = doc.querySelector(
        '#corePriceDisplay_desktop_feature_div .a-price.a-text-price span.a-offscreen, ' +
        '.a-price.a-text-price span.a-offscreen, ' +
        '.basisPrice .a-offscreen, ' +
        '#priceblock_listprice'
      );
      let originalPrice = null;
      if (origPriceEl) {
        const origPriceRaw = origPriceEl.textContent;
        const origPriceText = origPriceRaw.replace(/,/g, '').match(/([0-9.]+)/);
        originalPrice = origPriceText ? parseFloat(origPriceText[1]) : null;
      }
      
      // Robust Ratings Selectors
      const ratingEl = doc.querySelector(
        'span[data-hook="rating-out-of-five"], ' +
        '#acrPopover span.a-icon-alt, ' +
        '#acrPopover, ' +
        'span.a-icon-alt'
      );
      let rating = 4.5;
      if (ratingEl) {
        const ratingMatch = ratingEl.textContent.match(/([0-9.]+)/);
        if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      }
      
      // Robust Customer Reviews Count
      const reviewsEl = doc.querySelector(
        'span[data-hook="total-review-count"], ' +
        '#acrCustomerReviewText, ' +
        '#acrCustomerReviewLink'
      );
      let reviews = 100;
      if (reviewsEl) {
        const reviewsText = reviewsEl.textContent.replace(/[^\d]/g, '');
        if (reviewsText) reviews = parseInt(reviewsText);
      }
      
      // Full Description Compilation: Bullets + Paragraphs + Specs Table
      const bullets = [];
      doc.querySelectorAll('#feature-bullets ul li span.a-list-item').forEach(li => {
        const text = li.textContent.trim();
        if (text) bullets.push(text);
      });
      
      const descEl = doc.querySelector('#productDescription, #productDescription_feature_div');
      let prodDesc = '';
      if (descEl) {
        prodDesc = descEl.textContent.trim().replace(/\s+/g, ' ');
      }
      
      const specList = [];
      doc.querySelectorAll('#productDetails_techSpec_section_1 tr, .prodDetTable tr').forEach(tr => {
        const keyEl = tr.querySelector('th');
        const valEl = tr.querySelector('td');
        if (keyEl && valEl) {
          const key = keyEl.textContent.trim();
          const val = valEl.textContent.trim().replace(/\s+/g, ' ');
          if (key && val) specList.push(`${key}: ${val}`);
        }
      });
      
      if (specList.length === 0) {
        doc.querySelectorAll('#detailBullets_feature_div ul li span.a-list-item').forEach(li => {
          const text = li.textContent.replace(/\s+/g, ' ').trim();
          if (text) {
            const parts = text.split(':');
            if (parts.length >= 2) {
              const key = parts[0].replace(/[^\w\s-]/g, '').trim();
              const val = parts.slice(1).join(':').trim();
              if (key && val) specList.push(`${key}: ${val}`);
            }
          }
        });
      }
      
      let description = '';
      if (bullets.length > 0) {
        description += "Product Features:\n" + bullets.map(b => `• ${b}`).join('\n') + "\n\n";
      }
      if (prodDesc) {
        description += "Product Description:\n" + prodDesc + "\n\n";
      }
      if (specList.length > 0) {
        description += "Specifications:\n" + specList.map(s => `• ${s}`).join('\n');
      }
      description = description.trim();
      if (!description) {
        description = `${name}. Real product imported directly from Amazon.`;
      }
      
      // ASIN Extraction (Input value, attribute name, or canonical URL search)
      let asin = '';
      const asinEl = doc.querySelector('#ASIN, input[name="ASIN"]');
      if (asinEl && asinEl.value) {
        asin = asinEl.value.trim();
      } else {
        const canonicalEl = doc.querySelector('link[rel="canonical"]');
        if (canonicalEl && canonicalEl.getAttribute('href')) {
          const canonicalUrl = canonicalEl.getAttribute('href');
          const match = canonicalUrl.match(/\/dp\/([A-Z0-9]{10})/i);
          if (match) asin = match[1].toUpperCase();
        }
      }
      if (!asin) {
        asin = 'AMZN' + Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      
      if (name && price) {
        products.push({
          asin,
          name,
          price,
          originalPrice: originalPrice || Math.round(price * 1.25),
          image,
          rating,
          reviews,
          category,
          description,
          stock: 50,
          badge: originalPrice ? 'Sale' : '',
          source: 'amazon'
        });
      }
    }
  }
  
  return products;
}

// List of modern, realistic browser user agents to rotate and emulate browser requests
const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
];

async function fetchAmazonHTML(targetUrl, logConsole = null) {
  const userAgent = BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
  
  // Define a series of proxy configurations to rotate/fallback in case of failures (e.g. 413, 403, 502)
  const proxies = [
    {
      name: 'corsproxy.io (Browser Emulation)',
      url: `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}` + 
           `&reqHeaders=User-Agent:${encodeURIComponent(userAgent)}` + 
           `&reqHeaders=Accept-Language:${encodeURIComponent('en-US,en;q=0.9')}` +
           `&reqHeaders=Accept:${encodeURIComponent('text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')}` +
           `&reqHeaders=Upgrade-Insecure-Requests:${encodeURIComponent('1')}` +
           `&reqHeaders=Sec-Fetch-Dest:${encodeURIComponent('document')}` +
           `&reqHeaders=Sec-Fetch-Mode:${encodeURIComponent('navigate')}` +
           `&reqHeaders=Sec-Fetch-Site:${encodeURIComponent('none')}`
    },
    {
      name: 'corsproxy.io (Standard)',
      url: `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
    },
    {
      name: 'allorigins.win',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    },
    {
      name: 'thingproxy.freeboard.io',
      url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(targetUrl)}`
    }
  ];

  let lastError = null;

  for (const proxy of proxies) {
    const logMsg = `[INFO] Attempting fetch via ${proxy.name}...\n`;
    if (logConsole) {
      logConsole.textContent += logMsg;
    } else {
      console.log(logMsg);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

      const response = await fetch(proxy.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const htmlText = await response.text();
      
      if (htmlText && htmlText.length > 500) {
        const successMsg = `[SUCCESS] Fetch succeeded using ${proxy.name} (${Math.round(htmlText.length / 1024)} KB)\n`;
        if (logConsole) {
          logConsole.textContent += successMsg;
        } else {
          console.log(successMsg);
        }
        return htmlText;
      } else {
        throw new Error('Received empty or extremely short HTML response');
      }
    } catch (error) {
      lastError = error;
      const failMsg = `[WARNING] ${proxy.name} failed: ${error.message}. Trying next proxy...\n`;
      if (logConsole) {
        logConsole.textContent += failMsg;
      } else {
        console.warn(failMsg);
      }
    }
  }

  throw new Error(`All proxies failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

async function scrapeAmazonKeyword(queryStr, category, limit, logConsole) {
  logConsole.textContent = `[INFO] Initializing scrape request for keyword: "${queryStr}"...\n`;
  
  try {
    const targetUrl = `https://www.amazon.in/s?k=${encodeURIComponent(queryStr)}`;
    const htmlText = await fetchAmazonHTML(targetUrl, logConsole);
    
    const products = parseAmazonHTML(htmlText, category);
    
    if (products.length === 0) {
      logConsole.textContent += `[WARNING] No products found. Amazon may be rate-limiting or returning a CAPTCHA page.\n`;
      logConsole.textContent += `[TIP] Please try the "HTML Source Paste Importer" tab instead! It is 100% reliable.\n`;
      return [];
    }
    
    logConsole.textContent += `[SUCCESS] Extracted ${products.length} products from search results page.\n`;
    const limited = products.slice(0, limit);
    logConsole.textContent += `[INFO] Truncating to limit count (${limited.length}). Saving to database...\n`;
    
    return limited;
  } catch (error) {
    logConsole.textContent += `[ERROR] Scrape failed: ${error.message}\n`;
    logConsole.textContent += `[TIP] Bypass this block easily! Open Amazon in your browser, search for "${queryStr}", View Page Source, copy all HTML, and paste it in the "HTML Source Paste Importer" tab.\n`;
    return [];
  }
}

async function loadScraperData() {
  try {
    showLoading(true);
    
    const products = await getInventory();
    window.adminData.products = products;
    
    const amazonProducts = products.filter(p => p.asin);
    
    const tbody = document.getElementById('trackedProductsBody');
    if (!tbody) return;
    
    if (amazonProducts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No products are currently tracked from Amazon. Go to import tabs to add some!</td></tr>`;
      showLoading(false);
      return;
    }
    
    tbody.innerHTML = amazonProducts.map(p => {
      const syncStatus = '<span class="tracked-status-badge sync-ok">Tracked</span>';
      const lastSynced = p.updatedAt ? formatTimestamp(p.updatedAt) : 'Never';
      
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${p.image}" style="width:40px;height:40px;object-fit:contain;background:#f9fafb;border:1px solid #eee;border-radius:4px;" onerror="this.src='https://via.placeholder.com/40px'"/>
              <div style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${p.name}</div>
            </div>
          </td>
          <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:0.8rem;">${p.asin}</code></td>
          <td>${p.category || 'General'}</td>
          <td><strong>${formatCurrency(p.price)}</strong></td>
          <td style="text-decoration:line-through;color:#9ca3af;">${formatCurrency(p.originalPrice)}</td>
          <td>${syncStatus}</td>
          <td style="font-size:0.8rem;color:#6b7280;">${lastSynced}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.syncSinglePrice('${p.id}', '${p.asin}')">Sync</button>
          </td>
        </tr>
      `;
    }).join('');
    
    showLoading(false);
  } catch (error) {
    console.error('Error loading scraper data:', error);
    showToast('Failed to load tracked products', 'error');
    showLoading(false);
  }
}

window.syncSinglePrice = async function(productId, asin) {
  showToast(`Syncing price for ASIN: ${asin}...`, 'info');
  try {
    showLoading(true);
    const targetUrl = `https://www.amazon.in/dp/${asin}`;
    const htmlText = await fetchAmazonHTML(targetUrl);
    const products = parseAmazonHTML(htmlText, 'Temp');
    if (products.length > 0) {
      const p = products[0];
      await updateAmazonProductPrice(productId, p.price, p.originalPrice);
      showToast(`Successfully synced price to ${formatCurrency(p.price)}!`, 'success');
      await loadScraperData();
    } else {
      showToast(`Amazon blocked direct sync. Try pasting updated HTML in Paste Importer.`, 'warning');
    }
  } catch (error) {
    showToast('Sync failed: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
};
