import { subscribeToAuthState, logoutUser } from '../../backend/js/auth.js';
import { getOrders } from '../../backend/js/db.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth State
    subscribeToAuthState((authState) => {
        if (authState.isAuthenticated && authState.user) {
            currentUser = authState.user;
            document.getElementById('userDisplayName').textContent = currentUser.displayName || 'User';
            document.getElementById('userEmail').textContent = currentUser.email;
            
            document.getElementById('settingsNameDisplay').textContent = currentUser.displayName || 'User';
            document.getElementById('settingsEmailDisplay').textContent = currentUser.email;
            
            loadOrders();
        } else {
            // Not authenticated
            window.location.href = '../login/';
        }
    });

    // Tab switching
    const navItems = document.querySelectorAll('.profile-nav-item[data-tab]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.profile-tab').forEach(tab => tab.style.display = 'none');
            const tabId = item.getAttribute('data-tab') + 'Tab';
            document.getElementById(tabId).style.display = 'block';
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logoutUser();
        window.location.href = '../login/';
    });
});

async function loadOrders() {
    try {
        const ordersList = document.getElementById('ordersList');
        ordersList.innerHTML = '<p>Loading orders...</p>';
        const orders = await getOrders(currentUser.uid);
        if (orders.length === 0) {
            ordersList.innerHTML = '<p>You have not placed any orders yet. <a href="../shop/" style="color: var(--color-accent-primary);">Start shopping</a></p>';
            return;
        }

        ordersList.innerHTML = '';
        ordersList.style.textAlign = 'left';
        ordersList.style.padding = '0';
        ordersList.style.border = 'none';

        orders.forEach(order => {
            const date = order.createdAt ? order.createdAt.toLocaleDateString() : 'Unknown Date';
            const total = (order.total || 0).toFixed(2);
            
            const div = document.createElement('div');
            div.style.border = '1px solid #d5d9d9';
            div.style.borderRadius = '8px';
            div.style.marginBottom = '1rem';
            div.style.overflow = 'hidden';

            let itemsHtml = '';
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    itemsHtml += `
                        <div style="display: flex; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f0f2f2;">
                            <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover;">
                            <div>
                                <h4 style="margin: 0; font-size: 1rem;">${item.name}</h4>
                                <p style="color: #565959; margin: 0.2rem 0;">Qty: ${item.quantity}</p>
                                <p style="color: #B12704; font-weight: bold; margin: 0;">$${(item.price || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    `;
                });
            }

            div.innerHTML = `
                <div style="background: #f0f2f2; padding: 1rem; border-bottom: 1px solid #d5d9d9; display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <div>
                        <span style="color: #565959; display: block; margin-bottom: 0.2rem; font-size: 0.75rem;">ORDER PLACED</span>
                        <span>${date}</span>
                    </div>
                    <div>
                        <span style="color: #565959; display: block; margin-bottom: 0.2rem; font-size: 0.75rem;">TOTAL</span>
                        <span>$${total}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #565959; display: block; margin-bottom: 0.2rem; font-size: 0.75rem;">ORDER # ${order.orderNumber || order.id}</span>
                        <a href="#" style="color: #007185; text-decoration: none;">View order details</a>
                    </div>
                </div>
                <div style="padding: 1rem;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f1111;">Status: <span style="text-transform: capitalize; color: #007185;">${order.status || 'Processing'}</span></h3>
                    ${itemsHtml}
                </div>
            `;
            ordersList.appendChild(div);
        });
    } catch (err) {
        console.error('Error loading orders:', err);
        document.getElementById('ordersList').innerHTML = '<p>Error loading orders. Please try again later.</p>';
    }
}
