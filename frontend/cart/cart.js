import { getCartItems, removeFromCart, addToCart } from '../../backend/js/db.js';
import { subscribeToAuthState } from '../../backend/js/auth.js';

let appState = {
    currentUser: null,
    isAuthenticated: false,
    cart: []
};

document.addEventListener('DOMContentLoaded', () => {
    subscribeToAuthState(async (authState) => {
        appState.isAuthenticated = authState.isAuthenticated;
        appState.currentUser = authState.user;
        
        if (appState.isAuthenticated) {
            appState.cart = await getCartItems(appState.currentUser.uid);
        } else {
            const guestCart = localStorage.getItem('zonix_guest_cart');
            appState.cart = guestCart ? JSON.parse(guestCart) : [];
        }

        renderCart();
    });
});

function renderCart() {
    const container = document.getElementById('cartItems');
    const summaryAside = document.querySelector('.cart-summary');
    
    if (appState.cart.length === 0) {
        if (summaryAside) summaryAside.style.display = 'none';
        container.innerHTML = `
            <div class="empty-cart" style="text-align: center; padding: 3rem;">
                <p style="color: #565656; margin-bottom: 1rem; font-size: 1.1rem;">Your Amazon Cart is empty.</p>
                <a href="../shop/" style="color: #007185; text-decoration: none;">Shop today's deals</a>
            </div>
        `;
        updateSubtotal();
        return;
    }
    
    if (summaryAside) summaryAside.style.display = 'block';

    container.innerHTML = appState.cart.map((item, index) => {
        return `
            <div class="cart-item" data-id="${item.productId}" style="display: flex; gap: 1.5rem; padding: 1.5rem 0; border-top: ${index === 0 ? 'none' : '1px solid #ddd'};">
                <div style="width: 180px; height: 180px; display: flex; align-items: center; justify-content: center;">
                    <img src="${item.image || '../assets/images/placeholder.jpg'}" alt="${item.name}" loading="lazy" style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: pointer;">
                </div>
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; gap: 1rem;">
                        <h4 style="font-size: 1.15rem; color: #0f1111; font-weight: 400; line-height: 1.4;">${item.name}</h4>
                        <div style="text-align: right; min-width: 100px;">
                            <span style="font-size: 1.3rem; font-weight: 700; color: #0f1111;">₹${item.price.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div style="color: #007600; font-size: 0.85rem; margin-top: 5px; margin-bottom: 5px;">In stock</div>
                    <div style="color: #565959; font-size: 0.85rem; margin-bottom: 15px;">Eligible for FREE Shipping</div>
                    
                    <div style="display: flex; align-items: center; gap: 1rem; margin-top: auto;">
                        <select class="qty-select" data-id="${item.productId}" style="padding: 4px; border: 1px solid #d5d9d9; border-radius: 8px; background: #f0f2f2; box-shadow: 0 2px 5px rgba(15,17,17,.15); cursor: pointer;">
                            ${[...Array(10)].map((_, i) => `<option value="${i}" ${i === item.quantity ? 'selected' : ''}>Qty: ${i}</option>`).join('')}
                        </select>
                        <span style="color: #ddd;">|</span>
                        <button class="remove-btn" data-id="${item.productId}" style="color: #007185; background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Delete</button>
                        <span style="color: #ddd;">|</span>
                        <button style="color: #007185; background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Save for later</button>
                        <span style="color: #ddd;">|</span>
                        <button style="color: #007185; background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0;">Share</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach events
    container.querySelectorAll('.qty-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const newQty = parseInt(e.target.value);
            const productId = e.target.dataset.id;
            await changeItemQuantity(productId, newQty);
        });
    });

    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const productId = e.target.dataset.id;
            await changeItemQuantity(productId, 0);
        });
    });

    updateSubtotal();
}

async function changeItemQuantity(productId, newQty) {
    try {
        if (appState.isAuthenticated) {
            if (newQty === 0) {
                await removeFromCart(appState.currentUser.uid, productId);
            } else {
                const item = appState.cart.find(i => i.productId === productId);
                const diff = newQty - item.quantity;
                await addToCart(appState.currentUser.uid, productId, diff);
            }
            appState.cart = await getCartItems(appState.currentUser.uid);
        } else {
            let guestCart = JSON.parse(localStorage.getItem('zonix_guest_cart') || '[]');
            if (newQty === 0) {
                guestCart = guestCart.filter(i => i.productId !== productId);
            } else {
                const item = guestCart.find(i => i.productId === productId);
                if (item) item.quantity = newQty;
            }
            localStorage.setItem('zonix_guest_cart', JSON.stringify(guestCart));
            appState.cart = guestCart;
        }

        // Update top-nav badge if present
        const badge = document.getElementById('cartBadge');
        if (badge) {
            const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        renderCart();
    } catch (err) {
        console.error("Error updating cart", err);
    }
}

function updateSubtotal() {
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const countEls = document.querySelectorAll('#summaryItemCount');
    countEls.forEach(el => el.textContent = totalItems);

    const totalEl = document.getElementById('total');
    if (totalEl) totalEl.textContent = `₹${subtotal.toLocaleString()}`;
}
