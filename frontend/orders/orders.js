import { auth } from '../../backend/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getOrders } from '../../backend/js/db.js';

let allOrders = [];
let filteredOrders = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadOrders(user.uid);
        } else {
            document.getElementById('ordersListContainer').innerHTML = `
                <div style="padding: 3rem; text-align: center;">
                    <p style="margin-bottom: 1rem;">Please sign in to view your orders.</p>
                    <a href="../login/" class="btn btn-primary">Sign In</a>
                </div>
            `;
        }
    });

    // Search
    const searchBtn = document.getElementById('searchOrdersBtn');
    const searchInput = document.getElementById('searchOrdersInput');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            applyFilters();
        });
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }

    // Time filter
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', () => {
            applyFilters();
        });
    }
});

async function loadOrders(userId) {
    const container = document.getElementById('ordersListContainer');
    try {
        allOrders = await getOrders(userId);
        applyFilters();
    } catch (error) {
        console.error('Error loading orders:', error);
        container.innerHTML = '<div style="padding: 3rem; text-align: center; color: red;">Failed to load orders. Please try again later.</div>';
    }
}

function applyFilters() {
    const searchQuery = document.getElementById('searchOrdersInput')?.value.toLowerCase().trim() || '';
    const timeVal = document.getElementById('timeFilter')?.value || 'all';

    filteredOrders = allOrders.filter(order => {
        // Time filter
        if (timeVal !== 'all') {
            const days = parseInt(timeVal, 10);
            const orderDate = new Date(order.createdAt);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            if (orderDate < cutoffDate) return false;
        }

        // Search filter (search by order number or item name)
        if (searchQuery) {
            const matchOrderNum = order.orderNumber?.toLowerCase().includes(searchQuery);
            const matchItems = order.items?.some(item => item.name?.toLowerCase().includes(searchQuery));
            if (!matchOrderNum && !matchItems) return false;
        }

        return true;
    });

    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('ordersListContainer');

    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center; border: 1px solid #d5d9d9; border-radius: 8px;">
                <p>No orders found matching your criteria.</p>
                <a href="../shop/" style="color: var(--color-accent-primary); text-decoration: none; margin-top: 10px; display: inline-block;">Continue Shopping</a>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredOrders.map(order => {
        const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown Date';
        const totalStr = typeof order.total === 'number' ? `₹${order.total.toLocaleString('en-IN')}` : 'N/A';
        
        let statusClass = 'status-processing';
        let statusText = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Processing';
        
        if (order.status === 'shipped') statusClass = 'status-shipped';
        if (order.status === 'delivered') statusClass = 'status-delivered';
        if (order.status === 'cancelled') statusClass = 'status-cancelled';

        // Map status to progress (1: Ordered, 2: Shipped, 3: Out for Delivery, 4: Delivered)
        let progressPercent = 25; // default Ordered
        let activeStep = 1;
        if (order.status === 'shipped') { progressPercent = 50; activeStep = 2; }
        // mock out for delivery for demo
        if (order.status === 'out_for_delivery') { progressPercent = 75; activeStep = 3; statusText = 'Out for Delivery'; statusClass = 'status-shipped'; }
        if (order.status === 'delivered') { progressPercent = 100; activeStep = 4; }
        if (order.status === 'cancelled') { progressPercent = 0; activeStep = 0; }

        let timelineHtml = '';
        if (order.status !== 'cancelled') {
            timelineHtml = `
            <div class="timeline">
                <div class="timeline-progress" style="width: ${progressPercent}%;"></div>
                <div class="timeline-step">
                    <div class="timeline-dot ${activeStep >= 1 ? 'active' : ''}"></div>
                    <span class="timeline-label ${activeStep >= 1 ? 'active' : ''}">Ordered</span>
                </div>
                <div class="timeline-step">
                    <div class="timeline-dot ${activeStep >= 2 ? 'active' : ''}"></div>
                    <span class="timeline-label ${activeStep >= 2 ? 'active' : ''}">Shipped</span>
                </div>
                <div class="timeline-step">
                    <div class="timeline-dot ${activeStep >= 3 ? 'active' : ''}"></div>
                    <span class="timeline-label ${activeStep >= 3 ? 'active' : ''}">Out for Delivery</span>
                </div>
                <div class="timeline-step">
                    <div class="timeline-dot ${activeStep >= 4 ? 'active' : ''}"></div>
                    <span class="timeline-label ${activeStep >= 4 ? 'active' : ''}">Delivered</span>
                </div>
            </div>
            `;
        } else {
            timelineHtml = `<div style="color: #991b1b; font-weight: bold; margin-top: 1rem;">Order Cancelled</div>`;
        }

        const itemsHtml = order.items && order.items.length > 0 ? order.items.map(item => `
            <div class="order-item">
                <img src="${item.image || '../assets/images/placeholder.jpg'}" alt="${item.name}" class="order-item-img">
                <div class="order-item-details">
                    <a href="../product/?id=${item.productId || ''}" class="order-item-title">${item.name}</a>
                    <div style="font-size: 0.85rem; color: #565959; margin-bottom: 5px;">Return eligible through 30 days</div>
                    <div style="font-size: 0.9rem; font-weight: bold;">₹${(item.price || 0).toLocaleString('en-IN')} x ${item.quantity || 1}</div>
                </div>
                <div class="order-actions">
                    <a href="#" class="btn-order-action btn-track" onclick="event.preventDefault(); alert('Tracking information will be available soon.');">Track Package</a>
                    <a href="#" class="btn-order-action btn-return" onclick="event.preventDefault(); alert('Return process initiated.');">Return or Replace Items</a>
                    <a href="#" class="btn-order-action btn-return" onclick="event.preventDefault(); alert('Leaving review...');">Leave Seller Feedback</a>
                </div>
            </div>
        `).join('') : '<p>No items found for this order.</p>';

        return `
            <div class="order-card">
                <div class="order-card-header">
                    <div class="order-header-info">
                        <div>
                            ORDER PLACED
                            <span>${dateStr}</span>
                        </div>
                        <div>
                            TOTAL
                            <span>${totalStr}</span>
                        </div>
                        <div>
                            SHIP TO
                            <span>${order.shippingAddress?.fullName || currentUser?.displayName || 'User'}</span>
                        </div>
                    </div>
                    <div class="order-header-right">
                        <span>ORDER # ${order.orderNumber || order.id}</span>
                        <a href="#" style="color: #007185; text-decoration: none;">View order details</a>
                    </div>
                </div>
                <div class="order-card-body">
                    <div class="order-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    
                    ${itemsHtml}
                    ${timelineHtml}
                    
                </div>
            </div>
        `;
    }).join('');
}
