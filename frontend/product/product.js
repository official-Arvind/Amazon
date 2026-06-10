import { db } from '../../backend/js/firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { subscribeToAuthState, getCurrentUser } from '../../backend/js/auth.js';
import { addToCart, getCartItems, addReview, getReviews } from '../../backend/js/db.js';

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
        
        // Track recently viewed
        let recentIds = JSON.parse(localStorage.getItem('zonix_recently_viewed')) || [];
        recentIds = recentIds.filter(id => id !== product.id);
        recentIds.unshift(product.id);
        if (recentIds.length > 8) recentIds = recentIds.slice(0, 8);
        localStorage.setItem('zonix_recently_viewed', JSON.stringify(recentIds));
        
        populateUI(product);
        setupActions(product);
        loadReviews(productId);
        setupReviewForm(productId);

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

    // ======================================
    // Images — use 'images' array if present
    // ======================================
    const mainImage = document.getElementById('pdpMainImage');
    const thumbnailsContainer = document.getElementById('pdpThumbnails');
    
    const allImages = (product.images && product.images.length > 0)
        ? product.images
        : (product.image ? [product.image] : ['../assets/images/placeholder.jpg']);
    
    mainImage.src = allImages[0];
    mainImage.alt = product.name;

    thumbnailsContainer.innerHTML = allImages.map((url, i) =>
        `<img src="${url}" class="pdp-thumbnail${i === 0 ? ' active' : ''}" alt="Product image ${i + 1}" data-src="${url}">`
    ).join('');

    // Click thumbnail → update main image
    thumbnailsContainer.querySelectorAll('.pdp-thumbnail').forEach(thumb => {
        thumb.addEventListener('click', () => {
            mainImage.src = thumb.dataset.src;
            thumbnailsContainer.querySelectorAll('.pdp-thumbnail').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
    });

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
    for (let i = 1; i <= 5; i++) starsStr += i <= roundedStars ? '★' : '☆';
    document.getElementById('pdpStars').textContent = starsStr;
    document.getElementById('pdpReviewsLink').textContent = `${(product.reviews || 0).toLocaleString()} ratings`;

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

    // ======================================
    // Feature Bullets — prefer 'bullets' array
    // ======================================
    const featureList = document.getElementById('pdpFeatureList');
    const bullets = product.bullets;
    if (bullets && bullets.length > 0) {
        featureList.innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
    } else if (product.description) {
        const lines = product.description.split('\n').filter(l => l.trim().length > 0).slice(0, 6);
        featureList.innerHTML = lines.map(line => `<li>${line.replace(/^[•\-]\s*/, '')}</li>`).join('');
    }

    // ======================================
    // Full Product Description
    // ======================================
    if (product.description) {
        document.getElementById('pdpDetailedDescContainer').style.display = 'block';
        document.getElementById('pdpDetailedDescription').innerHTML =
            `<p>${product.description.replace(/\n/g, '<br>')}</p>`;
    }

    // ======================================
    // Specifications Table
    // ======================================
    const specs = product.specs;
    if (specs && Object.keys(specs).length > 0) {
        document.getElementById('pdpSpecsContainer').style.display = 'block';
        const table = document.getElementById('pdpSpecsTable');
        table.innerHTML = Object.entries(specs).map(([key, val]) =>
            `<tr><th>${key}</th><td>${val}</td></tr>`
        ).join('');
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

    const btnAddToWishlist = document.getElementById('btnAddToWishlist');
    if (btnAddToWishlist) {
        btnAddToWishlist.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                window.location.href = '../login/';
                return;
            }

            const originalText = btnAddToWishlist.innerHTML;
            btnAddToWishlist.textContent = 'Adding...';
            btnAddToWishlist.disabled = true;

            try {
                // Must import addToWishlist, but wait, db.js is exported as default. Let's use db.addToWishlist 
                // Wait, db is not imported entirely, but wait at top of file: import { addToCart, getCartItems } from '../../backend/js/db.js';
                // I need to use dynamic import or just modify top imports.
                // Let's assume I modify the import in a bit or use dynamic import.
                const dbModule = await import('../../backend/js/db.js');
                await dbModule.addToWishlist(currentUser.uid, product.id);
                btnAddToWishlist.innerHTML = '✓ Added to Wishlist';
                
                const event = new CustomEvent('show-toast', { detail: 'Added to wishlist!' });
                window.dispatchEvent(event);
                
                setTimeout(() => {
                    btnAddToWishlist.innerHTML = originalText;
                    btnAddToWishlist.disabled = false;
                }, 2000);
            } catch (err) {
                console.error('Error adding to wishlist:', err);
                btnAddToWishlist.innerHTML = originalText;
                btnAddToWishlist.disabled = false;
            }
        });
    }
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

// ==========================================
// REVIEWS
// ==========================================
async function loadReviews(productId) {
    try {
        const reviews = await getReviews(productId);
        const listContainer = document.getElementById('reviewsList');
        
        if (reviews.length === 0) {
            listContainer.innerHTML = '<p class="no-reviews" style="color: #565959; font-style: italic;">No reviews yet. Be the first to review this product!</p>';
            document.getElementById('overallStars').textContent = '☆☆☆☆☆';
            document.getElementById('overallScore').textContent = '0 out of 5';
            document.getElementById('globalRatingsCount').textContent = '0 global ratings';
            return;
        }

        const avgRating = reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length;
        const roundedAvg = Math.round(avgRating * 10) / 10;
        const fullStars = Math.round(roundedAvg);
        
        let starsStr = '';
        for (let i = 1; i <= 5; i++) {
            starsStr += i <= fullStars ? '★' : '☆';
        }
        
        document.getElementById('overallStars').textContent = starsStr;
        document.getElementById('overallScore').textContent = `${roundedAvg} out of 5`;
        document.getElementById('globalRatingsCount').textContent = `${reviews.length} global rating${reviews.length > 1 ? 's' : ''}`;
        
        listContainer.innerHTML = reviews.map(r => {
            let rStars = '';
            for (let i = 1; i <= 5; i++) rStars += i <= Number(r.rating) ? '★' : '☆';
            
            const dateStr = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently';
            
            return `
                <div class="review-item">
                    <div class="review-user">
                        <div class="review-avatar">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <span class="review-user-name">${r.userName || 'Amazon Customer'}</span>
                    </div>
                    <div class="review-rating-row">
                        <span class="rating-stars" style="font-size: 14px;">${rStars}</span>
                        <span class="review-title">${r.title || ''}</span>
                    </div>
                    <div class="review-date">Reviewed in India on ${dateStr}</div>
                    <div class="review-verified">Verified Purchase</div>
                    <div class="review-text">${r.text || ''}</div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function setupReviewForm(productId) {
    const btnWrite = document.getElementById('btnWriteReview');
    const formContainer = document.getElementById('reviewFormContainer');
    const form = document.getElementById('reviewForm');
    
    btnWrite.addEventListener('click', () => {
        const user = getCurrentUser();
        if (!user) {
            window.location.href = '../login/';
            return;
        }
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;
        
        const btnSubmit = form.querySelector('.btn-submit-review');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = 'Submitting...';
        btnSubmit.disabled = true;
        
        try {
            const rating = document.getElementById('reviewRating').value;
            const title = document.getElementById('reviewTitle').value;
            const text = document.getElementById('reviewText').value;
            
            await addReview(productId, {
                userId: user.uid,
                userName: user.displayName || 'Amazon Customer',
                rating: rating,
                title: title,
                text: text
            });
            
            form.reset();
            formContainer.style.display = 'none';
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
            
            // Reload reviews to show the new one
            await loadReviews(productId);
            
            const event = new CustomEvent('show-toast', { detail: 'Review submitted successfully!' });
            window.dispatchEvent(event);
            
        } catch (error) {
            console.error('Error submitting review:', error);
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
            alert('Failed to submit review. Please try again later.');
        }
    });
}
