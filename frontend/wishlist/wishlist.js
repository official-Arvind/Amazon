import { auth } from '../../backend/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import db from '../../backend/js/db.js';

document.addEventListener('DOMContentLoaded', () => {
    const wishlistGrid = document.getElementById('wishlistGrid');
    const loadingEl = document.getElementById('wishlistLoading');
    const emptyEl = document.getElementById('emptyWishlist');
    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            loadWishlist();
        } else {
            // Not logged in
            window.location.href = '../login/';
        }
    });

    async function loadWishlist() {
        if (!currentUser) return;
        
        loadingEl.style.display = 'block';
        wishlistGrid.innerHTML = '';
        emptyEl.style.display = 'none';

        try {
            const items = await db.getWishlistItems(currentUser.uid);
            loadingEl.style.display = 'none';

            if (items.length === 0) {
                emptyEl.style.display = 'block';
                return;
            }

            items.forEach(item => {
                const card = createWishlistCard(item);
                wishlistGrid.appendChild(card);
            });
        } catch (error) {
            console.error("Error loading wishlist:", error);
            loadingEl.innerText = 'Failed to load wishlist. Please try again.';
        }
    }

    function createWishlistCard(item) {
        const div = document.createElement('div');
        div.className = 'wishlist-card';
        
        const priceFormatted = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(item.price);

        div.innerHTML = `
            <button class="remove-btn" data-id="${item.productId}" aria-label="Remove from wishlist" title="Remove from Wishlist">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="wishlist-img-container">
                <img src="${item.image || '../assets/images/placeholder.jpg'}" alt="${item.name}" class="wishlist-img" loading="lazy">
            </div>
            <div class="wishlist-details">
                <a href="../product/?id=${item.productId}" class="wishlist-name">${item.name}</a>
                <div class="wishlist-price">${priceFormatted}</div>
                <button class="add-to-cart-btn" data-id="${item.productId}">
                    Add to Cart
                </button>
            </div>
        `;

        const removeBtn = div.querySelector('.remove-btn');
        removeBtn.addEventListener('click', async () => {
            const originalHtml = removeBtn.innerHTML;
            removeBtn.innerHTML = '...';
            removeBtn.disabled = true;
            try {
                await db.removeFromWishlist(currentUser.uid, item.productId);
                div.remove();
                if (wishlistGrid.children.length === 0) {
                    emptyEl.style.display = 'block';
                }
                
                // Show toast
                const event = new CustomEvent('show-toast', { detail: 'Removed from wishlist' });
                window.dispatchEvent(event);
            } catch (error) {
                console.error("Failed to remove from wishlist", error);
                removeBtn.innerHTML = originalHtml;
                removeBtn.disabled = false;
            }
        });

        const addToCartBtn = div.querySelector('.add-to-cart-btn');
        addToCartBtn.addEventListener('click', async () => {
            addToCartBtn.disabled = true;
            addToCartBtn.innerText = 'Adding...';
            try {
                await db.addToCart(currentUser.uid, item.productId, 1);
                const event = new CustomEvent('show-toast', { detail: 'Added to cart!' });
                window.dispatchEvent(event);
                
                // Optionally trigger cart refresh if your main.js handles it via custom event
                window.dispatchEvent(new Event('cart-updated'));
            } catch (error) {
                console.error("Error adding to cart", error);
            } finally {
                addToCartBtn.disabled = false;
                addToCartBtn.innerText = 'Add to Cart';
            }
        });

        return div;
    }
});
