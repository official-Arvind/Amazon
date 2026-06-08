import db from '../../backend/js/db.js';
import { auth } from '../../backend/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const dealsGrid = document.getElementById('dealsGrid');
    const loadingEl = document.getElementById('dealsLoading');
    const dealTabs = document.querySelectorAll('.deal-tab');
    
    let allDeals = [];
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });

    // Start countdown timer to midnight
    function startTimer() {
        const hEl = document.getElementById('timerHours');
        const mEl = document.getElementById('timerMins');
        const sEl = document.getElementById('timerSecs');

        function update() {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            
            const diff = tomorrow - now;
            if (diff <= 0) {
                hEl.textContent = '00';
                mEl.textContent = '00';
                sEl.textContent = '00';
                return;
            }

            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            hEl.textContent = h.toString().padStart(2, '0');
            mEl.textContent = m.toString().padStart(2, '0');
            sEl.textContent = s.toString().padStart(2, '0');
        }

        update();
        setInterval(update, 1000);
    }

    startTimer();

    // Pseudo-random generator based on string
    function getDiscount(productId) {
        let hash = 0;
        for (let i = 0; i < productId.length; i++) {
            hash = productId.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Discount between 15 and 70
        return 15 + Math.abs(hash % 56);
    }

    function getClaimedPercentage(productId) {
        let hash = 0;
        for (let i = productId.length - 1; i >= 0; i--) {
            hash = productId.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Claimed between 30 and 95
        return 30 + Math.abs(hash % 66);
    }

    async function loadDeals() {
        try {
            const products = await db.getProducts();
            
            // Map products to deals
            allDeals = products.map(p => {
                const discount = getDiscount(p.id);
                const originalPrice = Math.round(p.price / (1 - (discount / 100)));
                const claimed = getClaimedPercentage(p.id);
                
                return {
                    ...p,
                    originalPrice,
                    discount,
                    claimed
                };
            }).sort((a, b) => b.discount - a.discount); // Highest discount first

            loadingEl.style.display = 'none';
            renderDeals(allDeals);
        } catch (error) {
            console.error('Error fetching deals', error);
            loadingEl.textContent = 'Failed to load deals. Please try again.';
        }
    }

    function renderDeals(deals) {
        dealsGrid.innerHTML = '';
        if (deals.length === 0) {
            dealsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No deals found for this category.</p>';
            return;
        }

        deals.forEach(deal => {
            const card = document.createElement('div');
            card.className = 'deal-card';

            const priceFormatted = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(deal.price);

            const origPriceFormatted = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(deal.originalPrice);

            card.innerHTML = `
                <div class="deal-badge">${deal.discount}% OFF - Limited Time</div>
                <a href="../product/?id=${deal.id}" class="deal-img-wrapper">
                    <img src="${deal.image || '../assets/images/placeholder.jpg'}" alt="${deal.name}" class="deal-img" loading="lazy">
                </a>
                <div class="deal-info">
                    <a href="../product/?id=${deal.id}" class="deal-title">${deal.name}</a>
                    
                    <div class="deal-claimed">
                        <div class="claimed-bar" style="width: ${deal.claimed}%"></div>
                    </div>
                    <div class="claimed-text">${deal.claimed}% Claimed</div>

                    <div class="price-row">
                        <span class="deal-price">${priceFormatted}</span>
                        <span class="original-price">${origPriceFormatted}</span>
                    </div>

                    <button class="add-to-cart-btn" data-id="${deal.id}">Add to Cart</button>
                </div>
            `;

            const addBtn = card.querySelector('.add-to-cart-btn');
            addBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!currentUser) {
                    window.location.href = '../login/';
                    return;
                }

                addBtn.disabled = true;
                addBtn.textContent = 'Adding...';
                try {
                    await db.addToCart(currentUser.uid, deal.id, 1);
                    const event = new CustomEvent('show-toast', { detail: 'Added to cart!' });
                    window.dispatchEvent(event);
                    window.dispatchEvent(new Event('cart-updated'));
                } catch (err) {
                    console.error('Error adding to cart', err);
                    alert('Could not add item to cart.');
                } finally {
                    addBtn.disabled = false;
                    addBtn.textContent = 'Add to Cart';
                }
            });

            dealsGrid.appendChild(card);
        });
    }

    dealTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            dealTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const filter = tab.getAttribute('data-filter');
            let filteredDeals = allDeals;

            if (filter === 'under-1000') {
                filteredDeals = allDeals.filter(d => d.price < 1000);
            } else if (filter === 'discount') {
                filteredDeals = allDeals.filter(d => d.discount >= 50);
            } else if (filter !== 'all') {
                filteredDeals = allDeals.filter(d => d.category && d.category.includes(filter));
            }

            renderDeals(filteredDeals);
        });
    });

    loadDeals();
});
