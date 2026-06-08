import { db } from '../../backend/js/firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { subscribeToAuthState, getCurrentUser } from '../../backend/js/auth.js';
import { addToCart, getCartItems } from '../../backend/js/db.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        document.getElementById('pdpLoading').innerHTML = '<p>Product ID not provided. <a href="../shop/">Go back to shop</a></p>';
        return;
    }

    try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            document.getElementById('pdpLoading').innerHTML = '<p>Product not found. <a href="../shop/">Go back to shop</a></p>';
            return;
        }

        const product = productSnap.data();
        product.id = productSnap.id;
        
        populateUI(product);
        setupActions(product);

        document.getElementById('pdpLoading').style.display = 'none';
        document.getElementById('pdpContent').style.display = 'grid';
        if (product.description) {
            document.getElementById('pdpDetailedDescContainer').style.display = 'block';
        }

    } catch (error) {
        console.error("Error fetching product:", error);
        document.getElementById('pdpLoading').innerHTML = '<p>Error loading product details.</p>';
    }
});

function populateUI(product) {
    // Title & Brand
    document.title = `ZONIX: ${product.name}`;
    document.getElementById('pdpTitle').textContent = product.name;
    document.getElementById('pdpBrand').textContent = `Brand: ${product.category || 'ZONIX'}`;

    // Images
    const mainImage = document.getElementById('pdpMainImage');
    mainImage.src = product.image || '../assets/images/placeholder.jpg';
    
    // Thumbnails - just one for now, as schema only has 'image' not an array
    const thumbnailsContainer = document.getElementById('pdpThumbnails');
    thumbnailsContainer.innerHTML = `<img src="${product.image || '../assets/images/placeholder.jpg'}" class="pdp-thumbnail active" alt="Thumbnail">`;

    // Pricing
    const priceNum = Number(product.price) || 0;
    const wholePrice = Math.floor(priceNum).toLocaleString('en-IN');
    document.getElementById('pdpPriceWhole').textContent = wholePrice;
    document.getElementById('buyboxPrice').textContent = wholePrice;

    if (product.originalPrice && product.originalPrice > product.price) {
        const discount = Math.round((1 - product.price / product.originalPrice) * 100);
        const discountBadge = document.getElementById('pdpDiscountBadge');
        discountBadge.textContent = `-${discount}%`;
        discountBadge.style.display = 'inline-block';

        document.getElementById('pdpMrpContainer').style.display = 'block';
        document.getElementById('pdpMrpValue').textContent = `₹${Math.floor(product.originalPrice).toLocaleString('en-IN')}`;
    }

    // Rating
    const roundedStars = Math.round(product.rating || 4.5);
    let starsStr = '';
    for (let i = 1; i <= 5; i++) {
        starsStr += i <= roundedStars ? '★' : '☆';
    }
    document.getElementById('pdpStars').textContent = starsStr;
    document.getElementById('pdpReviewsLink').textContent = `${(product.reviews || 100).toLocaleString()} ratings`;

    // Stock Status
    const stockStatus = document.getElementById('stockStatus');
    if (product.stock > 0) {
        stockStatus.textContent = 'In stock';
        stockStatus.className = 'stock-status in-stock';
    } else {
        stockStatus.textContent = 'Out of stock';
        stockStatus.className = 'stock-status out-of-stock';
        document.getElementById('btnAddToCart').disabled = true;
        document.getElementById('btnBuyNow').disabled = true;
    }

    // Description / Features
    if (product.description) {
        // Simple heuristic: split by newlines for bullets, otherwise just a paragraph
        const lines = product.description.split('\n').filter(l => l.trim().length > 0);
        
        // Populate feature list (bullets)
        const featureList = document.getElementById('pdpFeatureList');
        if (lines.length > 1) {
            featureList.innerHTML = lines.map(line => `<li>${line}</li>`).join('');
            document.getElementById('pdpDetailedDescription').innerHTML = `<p>${product.description.replace(/\\n/g, '<br>')}</p>`;
        } else {
            featureList.innerHTML = `<li>${product.description}</li>`;
            document.getElementById('pdpDetailedDescription').innerHTML = `<p>${product.description}</p>`;
        }
    }
}

function setupActions(product) {
    const btnAddToCart = document.getElementById('btnAddToCart');
    const btnBuyNow = document.getElementById('btnBuyNow');
    const qtySelect = document.getElementById('pdpQty');

    let currentUser = getCurrentUser();

    // Re-sync auth state quietly
    subscribeToAuthState((authState) => {
        currentUser = authState.user;
    });

    const handleAdd = async (e) => {
        e.preventDefault();
        const qty = parseInt(qtySelect.value, 10) || 1;
        const originalText = btnAddToCart.textContent;
        btnAddToCart.textContent = 'Adding...';
        btnAddToCart.disabled = true;

        try {
            if (currentUser) {
                await addToCart(currentUser.uid, product.id, qty);
                // Badge update is handled by main.js observing global cart logic, 
                // but since we are isolated, we dispatch a custom event or let main.js handle on reload
                // Wait, main.js does not poll, so we should update badge manually here
                const cart = await getCartItems(currentUser.uid);
                updateBadge(cart.reduce((sum, item) => sum + item.quantity, 0));
            } else {
                addToGuestCart(product, qty);
                const guestCart = JSON.parse(localStorage.getItem('zonix_guest_cart')) || [];
                updateBadge(guestCart.reduce((sum, item) => sum + item.quantity, 0));
            }

            btnAddToCart.textContent = '✓ Added';
            setTimeout(() => {
                btnAddToCart.textContent = originalText;
                btnAddToCart.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('Error adding to cart:', error);
            btnAddToCart.textContent = originalText;
            btnAddToCart.disabled = false;
        }
    };

    btnAddToCart.addEventListener('click', handleAdd);

    btnBuyNow.addEventListener('click', async (e) => {
        await handleAdd(e);
        window.location.href = '../checkout/';
    });
}

function updateBadge(count) {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function addToGuestCart(product, quantity) {
    const GUEST_CART_KEY = 'zonix_guest_cart';
    const cart = JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
    
    const item = {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category || 'General',
        quantity: quantity
    };

    const existing = cart.find(i => i.productId === item.productId);
    if (existing) {
        existing.quantity += item.quantity;
    } else {
        cart.push(item);
    }

    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}
