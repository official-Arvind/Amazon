import { getCartItems, createOrder, createGuestOrder, saveAddress } from '../../backend/js/db.js';
import { subscribeToAuthState } from '../../backend/js/auth.js';

let appState = {
    currentUser: null,
    isAuthenticated: false,
    cart: []
};

let checkoutData = {
    address: null,
    shipping: 'standard',
    payment: 'card'
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Wait for Auth state
    subscribeToAuthState(async (authState) => {
        appState.isAuthenticated = authState.isAuthenticated;
        appState.currentUser = authState.user;
        
        // 2. Load Cart
        if (appState.isAuthenticated) {
            appState.cart = await getCartItems(appState.currentUser.uid);
        } else {
            const guestCart = localStorage.getItem('zonix_guest_cart');
            appState.cart = guestCart ? JSON.parse(guestCart) : [];
        }
        
        if (appState.cart.length === 0) {
            window.location.href = '../cart/';
            return;
        }

        updateCheckoutSummary();
        renderReviewItems();
        setupAccordion();
    });
});

function setupAccordion() {
    const addressForm = document.getElementById('addressForm');
    const deliveryForm = document.getElementById('deliveryForm');
    const paymentForm = document.getElementById('paymentForm');

    const stepAddress = document.getElementById('step-address');
    const stepDelivery = document.getElementById('step-delivery');
    const stepPayment = document.getElementById('step-payment');
    const stepReview = document.getElementById('step-review');

    // Handle Edit Buttons
    document.querySelectorAll('.step-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const step = e.target.closest('.checkout-step');
            activateStep(step);
        });
    });

    // Step 1: Address Submit
    addressForm.addEventListener('submit', (e) => {
        e.preventDefault();
        checkoutData.address = {
            name: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            street: document.getElementById('street').value,
            city: document.getElementById('city').value,
            zip: document.getElementById('zipcode').value,
            state: document.getElementById('state').value,
            country: 'India'
        };
        
        // Save Address state
        document.getElementById('addressSummaryText').innerHTML = `
            <strong>${checkoutData.address.name}</strong><br>
            ${checkoutData.address.street}<br>
            ${checkoutData.address.city}, ${checkoutData.address.state} ${checkoutData.address.zip}<br>
            Phone: ${checkoutData.address.phone}
        `;

        completeStep(stepAddress);
        activateStep(stepDelivery);
    });

    // Step 2: Delivery Submit
    deliveryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        checkoutData.shipping = document.querySelector('input[name="shipping"]:checked').value;
        let shippingText = checkoutData.shipping === 'standard' ? 'Standard Delivery' : 'Express Delivery';
        document.getElementById('deliverySummaryText').innerHTML = `<strong>${shippingText}</strong>`;
        
        updateCheckoutSummary(); // update cost

        completeStep(stepDelivery);
        activateStep(stepPayment);
    });

    // Handle Delivery cost update when radio changes
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateCheckoutSummary);
    });

    // Step 3: Payment Submit
    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        checkoutData.payment = document.querySelector('input[name="payment"]:checked').value;
        
        let payText = 'Credit or debit card';
        if (checkoutData.payment === 'upi') payText = 'UPI App';
        if (checkoutData.payment === 'cod') payText = 'Cash on Delivery';

        document.getElementById('paymentSummaryText').innerHTML = `<strong>${payText}</strong>`;
        
        completeStep(stepPayment);
        activateStep(stepReview);

        // Enable final submit buttons
        document.getElementById('summaryPlaceOrderBtn').style.opacity = '1';
        document.getElementById('summaryPlaceOrderBtn').style.pointerEvents = 'auto';
    });

    // Final Review Placed Order
    document.getElementById('finalPlaceOrderBtn').addEventListener('click', placeFinalOrder);
    document.getElementById('summaryPlaceOrderBtn').addEventListener('click', placeFinalOrder);
}

function activateStep(stepEl) {
    // Deactivate all steps
    document.querySelectorAll('.checkout-step').forEach(el => {
        el.querySelector('h2').style.color = '#0f1111';
        el.querySelector('.step-content').style.display = 'none';
        if (el.classList.contains('completed')) {
            el.querySelector('.step-summary').style.display = 'block';
            el.querySelector('.step-edit-btn').style.display = 'block';
        }
    });

    // Activate target
    stepEl.classList.remove('completed');
    stepEl.querySelector('h2').style.color = '#c45500';
    stepEl.querySelector('.step-content').style.display = 'block';
    stepEl.querySelector('.step-summary').style.display = 'none';
    const editBtn = stepEl.querySelector('.step-edit-btn');
    if(editBtn) editBtn.style.display = 'none';
}

function completeStep(stepEl) {
    stepEl.classList.add('completed');
}

function updateCheckoutSummary() {
    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || checkoutData.shipping;
    let shippingCost = 0;
    if(shippingMethod === 'express') shippingCost = 299;
    
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + shippingCost + tax;

    document.getElementById('checkoutSubtotal').textContent = `₹${subtotal.toLocaleString()}`;
    document.getElementById('checkoutShipping').textContent = shippingCost === 0 ? 'Free' : `₹${shippingCost}`;
    document.getElementById('checkoutTax').textContent = `₹${tax.toLocaleString()}`;
    document.getElementById('checkoutTotal').textContent = `₹${total.toLocaleString()}`;
    
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('checkoutHeaderItemCount').textContent = totalItems;
}

function renderReviewItems() {
    const container = document.getElementById('reviewItemsContainer');
    container.innerHTML = appState.cart.map(item => `
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
            <img src="${item.image || '../assets/images/placeholder.jpg'}" style="width: 80px; height: 80px; object-fit: contain;">
            <div>
                <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: #0f1111;">${item.name}</h4>
                <div style="color: #b12704; font-weight: 700; margin-bottom: 5px;">₹${item.price.toLocaleString()}</div>
                <div style="color: #565959; font-size: 0.9rem;">Qty: ${item.quantity}</div>
            </div>
        </div>
    `).join('');
}

async function placeFinalOrder() {
    const btn1 = document.getElementById('finalPlaceOrderBtn');
    const btn2 = document.getElementById('summaryPlaceOrderBtn');
    btn1.textContent = 'Processing...'; btn1.disabled = true;
    btn2.textContent = 'Processing...'; btn2.disabled = true;

    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let shippingCost = checkoutData.shipping === 'express' ? 299 : 0;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + shippingCost + tax;

    const orderData = {
        items: appState.cart,
        shippingAddress: checkoutData.address,
        shippingMethod: checkoutData.shipping,
        paymentMethod: checkoutData.payment,
        subtotal,
        shippingCost,
        tax,
        total,
        status: 'Processing',
        createdAt: new Date().toISOString(),
        orderNumber: 'ZNX-' + Date.now().toString(36).toUpperCase()
    };

    try {
        if (appState.isAuthenticated) {
            await createOrder(appState.currentUser.uid, orderData);
            await saveAddress(appState.currentUser.uid, checkoutData.address);
        } else {
            await createGuestOrder(orderData);
            localStorage.removeItem('zonix_guest_cart');
        }

        // Redirect or show success
        showOrderConfirmation(orderData);
    } catch (error) {
        console.error('Order failed', error);
        btn1.textContent = 'Place your order'; btn1.disabled = false;
        btn2.textContent = 'Place your order'; btn2.disabled = false;
        alert('Failed to place order: ' + error.message);
    }
}

function showOrderConfirmation(orderData) {
    const main = document.querySelector('.content-section');
    main.innerHTML = `
        <div style="max-width:600px;margin:3rem auto;text-align:center;padding:2rem; background: #fff; border: 1px solid #d5d9d9; border-radius: 8px;">
            <div style="width:80px;height:80px;border-radius:50%;background:#067d62;margin:0 auto 1.5rem;display:flex;align-items:center;justify-content:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h1 style="color:#0f1111;margin-bottom:0.5rem;">Order Placed, Thank You!</h1>
            <p style="color:#565959;margin-bottom:1rem;">Confirmation will be sent to your mobile number.</p>
            <p style="color:#0f1111; font-weight: 700; font-size: 1.1rem; margin-bottom:2rem;">Order Number: ${orderData.orderNumber}</p>
            <div style="text-align:left; background: #f0f2f2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <p style="margin-bottom: 10px;"><strong>Delivery to:</strong><br>${orderData.shippingAddress.name}<br>${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}</p>
                <p><strong>Total:</strong> ₹${orderData.total.toLocaleString()}</p>
            </div>
            <a href="../shop/" class="btn-amazon-primary" style="display:inline-block; text-decoration: none; padding: 0.6rem 2rem;">Continue Shopping</a>
        </div>
    `;
}
