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
    payment: 'card',
    useWallet: false,
    walletApplied: 0
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

    // Toggle UPI details
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const upiDetails = document.getElementById('upi-details');
            if (upiDetails) {
                if (e.target.value === 'upi') {
                    upiDetails.style.display = 'block';
                } else {
                    upiDetails.style.display = 'none';
                }
            }
        });
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
        renderReviewItems(); // Update review items to show full summary

        // Enable final submit buttons
        document.getElementById('summaryPlaceOrderBtn').style.opacity = '1';
        document.getElementById('summaryPlaceOrderBtn').style.pointerEvents = 'auto';
    });

    // Final Review Placed Order
    document.getElementById('finalPlaceOrderBtn').addEventListener('click', placeFinalOrder);
    document.getElementById('summaryPlaceOrderBtn').addEventListener('click', placeFinalOrder);

    const useWalletBalance = document.getElementById('useWalletBalance');
    if (useWalletBalance) {
        useWalletBalance.addEventListener('change', (e) => {
            checkoutData.useWallet = e.target.checked;
            updateCheckoutSummary();
        });
    }
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

    // Update Step Indicator
    const stepId = stepEl.id;
    let stepNum = 1;
    if (stepId === 'step-delivery') stepNum = 2;
    if (stepId === 'step-payment') stepNum = 3;
    if (stepId === 'step-review') stepNum = 4;
    
    for (let i = 2; i <= 4; i++) {
        const ind = document.getElementById(`indicator-${i}`);
        const text = document.getElementById(`indicator-text-${i}`);
        if (ind && text) {
            if (i <= stepNum) {
                ind.style.background = '#007185';
                ind.style.color = 'white';
                text.style.color = '#007185';
                text.style.fontWeight = 'bold';
            } else {
                ind.style.background = '#ddd';
                ind.style.color = '#555';
                text.style.color = '#555';
                text.style.fontWeight = 'normal';
            }
        }
    }
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
    let total = subtotal + shippingCost + tax;

    let walletApplied = 0;
    if (checkoutData.useWallet) {
        const walletBalance = 500;
        walletApplied = Math.min(walletBalance, total);
        total -= walletApplied;
        const appliedText = document.getElementById('walletAppliedText');
        if (appliedText) {
            appliedText.textContent = `- ₹${walletApplied.toLocaleString()}`;
            appliedText.style.display = walletApplied > 0 ? 'block' : 'none';
        }
    } else {
        const appliedText = document.getElementById('walletAppliedText');
        if (appliedText) appliedText.style.display = 'none';
    }

    checkoutData.walletApplied = walletApplied;

    document.getElementById('checkoutSubtotal').textContent = `₹${subtotal.toLocaleString()}`;
    document.getElementById('checkoutShipping').textContent = shippingCost === 0 ? 'Free' : `₹${shippingCost}`;
    document.getElementById('checkoutTax').textContent = `₹${tax.toLocaleString()}`;
    
    let walletRow = document.getElementById('checkoutWalletRow');
    if (walletApplied > 0) {
        if (!walletRow) {
            const taxRow = document.getElementById('checkoutTax').parentNode;
            walletRow = document.createElement('div');
            walletRow.id = 'checkoutWalletRow';
            walletRow.style.display = 'flex';
            walletRow.style.justifyContent = 'space-between';
            walletRow.style.marginBottom = '0.5rem';
            walletRow.style.color = '#007185';
            walletRow.style.fontSize = '0.9rem';
            walletRow.innerHTML = `<span>ZONIX Pay Balance:</span> <span id="checkoutWalletApplied">-₹0</span>`;
            taxRow.parentNode.insertBefore(walletRow, taxRow.nextSibling);
        }
        document.getElementById('checkoutWalletApplied').textContent = `-₹${walletApplied.toLocaleString()}`;
        walletRow.style.display = 'flex';
    } else if (walletRow) {
        walletRow.style.display = 'none';
    }

    document.getElementById('checkoutTotal').textContent = `₹${total.toLocaleString()}`;
    
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('checkoutHeaderItemCount').textContent = totalItems;
}

function renderReviewItems() {
    const container = document.getElementById('reviewItemsContainer');
    
    // Build full summary
    let payText = checkoutData.payment === 'upi' ? 'UPI App' : (checkoutData.payment === 'cod' ? 'Cash on Delivery' : 'Credit / Debit Card');
    let shipText = checkoutData.shipping === 'express' ? 'Express Delivery' : 'Standard Delivery';
    
    let summaryHtml = `
        <div style="display: flex; gap: 20px; background: #f8f8f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem;">
            <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 5px;">Delivery Address:</strong>
                ${checkoutData.address ? `${checkoutData.address.name}<br>${checkoutData.address.street}<br>${checkoutData.address.city}, ${checkoutData.address.state} ${checkoutData.address.zip}` : 'Pending...'}
            </div>
            <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 5px;">Payment Method:</strong>
                ${payText}${checkoutData.useWallet && checkoutData.walletApplied > 0 ? `<br><span style="color: #007185; font-weight: bold;">ZONIX Pay (-₹${checkoutData.walletApplied})</span>` : ''}<br><br>
                <strong style="display: block; margin-bottom: 5px;">Delivery Option:</strong>
                ${shipText}
            </div>
        </div>
        <h3 style="font-size: 1.1rem; margin-bottom: 10px; color: #0f1111;">Items in Order</h3>
    `;
    
    const itemsHtml = appState.cart.map(item => `
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
            <img src="${item.image || '../assets/images/placeholder.jpg'}" style="width: 80px; height: 80px; object-fit: contain;">
            <div>
                <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: #0f1111;">${item.name}</h4>
                <div style="color: #b12704; font-weight: 700; margin-bottom: 5px;">₹${item.price.toLocaleString()}</div>
                <div style="color: #565959; font-size: 0.9rem;">Qty: ${item.quantity}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = summaryHtml + itemsHtml;
}

async function placeFinalOrder() {
    const btn1 = document.getElementById('finalPlaceOrderBtn');
    const btn2 = document.getElementById('summaryPlaceOrderBtn');
    btn1.textContent = 'Processing...'; btn1.disabled = true;
    btn2.textContent = 'Processing...'; btn2.disabled = true;

    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let shippingCost = checkoutData.shipping === 'express' ? 299 : 0;
    const tax = Math.round(subtotal * 0.18);
    let total = subtotal + shippingCost + tax;

    let walletApplied = 0;
    if (checkoutData.useWallet) {
        walletApplied = Math.min(500, total);
        total -= walletApplied;
    }

    const orderData = {
        items: appState.cart,
        shippingAddress: checkoutData.address,
        shippingMethod: checkoutData.shipping,
        paymentMethod: checkoutData.payment,
        useWallet: checkoutData.useWallet,
        walletApplied: walletApplied,
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
    
    // Calculate estimated delivery
    const deliveryDays = orderData.shippingMethod === 'express' ? 2 : 5;
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + deliveryDays);
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const deliveryDateStr = estDate.toLocaleDateString('en-IN', dateOptions);
    
    main.innerHTML = `
        <div style="max-width:650px;margin:3rem auto;text-align:center;padding:3rem 2rem; background: #fff; border: 1px solid #d5d9d9; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="width:90px;height:90px;border-radius:50%;background:#067d62;margin:0 auto 1.5rem;display:flex;align-items:center;justify-content:center; box-shadow: 0 4px 10px rgba(6, 125, 98, 0.3);">
                <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h1 style="color:#0f1111;margin-bottom:0.5rem; font-size: 2rem;">Order Placed, Thank You!</h1>
            <p style="color:#007600; font-weight: bold; font-size: 1.1rem; margin-bottom:1rem;">Estimated Delivery: ${deliveryDateStr}</p>
            <p style="color:#565959;margin-bottom:1.5rem; font-size: 0.95rem;">A confirmation email has been sent to your registered address.</p>
            
            <div style="background: #f8f8f8; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid #eee; text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
                    <div>
                        <p style="color:#565959; font-size: 0.85rem; margin-bottom: 5px;">Order Number</p>
                        <p style="color:#0f1111; font-weight: 700; font-size: 1.1rem;">${orderData.orderNumber}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="color:#565959; font-size: 0.85rem; margin-bottom: 5px;">Order Total</p>
                        <p style="color:#b12704; font-weight: 700; font-size: 1.1rem;">₹${orderData.total.toLocaleString()}</p>
                    </div>
                </div>
                <p style="margin-bottom: 5px; color: #565959; font-size: 0.85rem;">Delivering to:</p>
                <p style="color:#0f1111; font-weight: 500;">${orderData.shippingAddress.name}<br>${orderData.shippingAddress.street}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zip}</p>
            </div>
            <a href="../shop/" class="btn-amazon-primary" style="display:inline-block; text-decoration: none; padding: 0.8rem 2.5rem; font-size: 1.05rem; font-weight: bold; background: #ffd814; border-color: #fcd200; border-radius: 8px;">Continue Shopping</a>
        </div>
    `;
}
