import { db } from '../../backend/js/firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 20;

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('shopProductsGrid');
    
    const mobileFiltersContainer = document.getElementById('mobileFiltersContainer');
    const sidebar = document.querySelector('.shop-sidebar');

    if (sidebar && mobileFiltersContainer) {
        mobileFiltersContainer.innerHTML = sidebar.innerHTML;
        
        // Sync mobile input changes to desktop inputs
        const mobileInputs = mobileFiltersContainer.querySelectorAll('input');
        const desktopInputs = sidebar.querySelectorAll('input');
        mobileInputs.forEach((mobInput, idx) => {
            mobInput.addEventListener('change', () => {
                if (desktopInputs[idx]) {
                    desktopInputs[idx].checked = mobInput.checked;
                    applyFilters();
                }
            });
        });
    }

    // View toggles
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    if (gridViewBtn && listViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            grid.className = 'products-grid';
            gridViewBtn.style.background = 'var(--color-accent-primary)';
            gridViewBtn.style.color = '#fff';
            listViewBtn.style.background = '#fff';
            listViewBtn.style.color = '#333';
        });
        listViewBtn.addEventListener('click', () => {
            grid.className = 'products-list-view';
            listViewBtn.style.background = 'var(--color-accent-primary)';
            listViewBtn.style.color = '#fff';
            gridViewBtn.style.background = '#fff';
            gridViewBtn.style.color = '#333';
        });
    }

    // Sort by
    const sortBySelect = document.getElementById('sortBySelect');
    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => {
            applyFilters();
        });
    }

    // Pagination buttons
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
        }
    });

    try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setupFilters();
        applyFilters(); 
    } catch (error) {
        console.error("Error fetching products:", error);
        grid.innerHTML = '<p>Error loading products.</p>';
    }

    // Set up clear filters and apply for mobile
    document.getElementById('clearMobileFiltersBtn')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
        checkboxes.forEach(cb => cb.checked = false);
        window.history.pushState({}, '', window.location.pathname);
        applyFilters();
    });

    document.getElementById('applyMobileFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('filtersDrawer').classList.remove('active');
        document.getElementById('filtersOverlay').classList.remove('active');
        applyFilters();
    });
});

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        q: params.get('q')?.toLowerCase() || '',
        category: params.get('category') || ''
    };
}

function setupFilters() {
    const checkboxes = document.querySelectorAll('.shop-sidebar input[type="checkbox"], .shop-sidebar input[type="radio"]');
    checkboxes.forEach((cb, idx) => {
        cb.addEventListener('change', () => {
            const mobInputs = document.querySelectorAll('#mobileFiltersContainer input');
            if (mobInputs[idx]) {
                mobInputs[idx].checked = cb.checked;
            }
            applyFilters();
        });
    });

    // Check boxes based on URL params initially
    const params = getUrlParams();
    if (params.category) {
        const catBoxes = document.querySelectorAll(`input[name="category"]`);
        catBoxes.forEach(cb => {
            if (cb.value.toLowerCase() === params.category.toLowerCase()) {
                cb.checked = true;
            }
        });
    }

    if (params.q) {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.value = params.q;
    }
}

function updateActiveFilterBadges() {
    const strip = document.getElementById('activeFiltersStrip');
    if (!strip) return;
    strip.innerHTML = '';
    
    const checkboxes = document.querySelectorAll('.shop-sidebar input[type="checkbox"]:checked, .shop-sidebar input[type="radio"]:checked');
    checkboxes.forEach(cb => {
        if (cb.name === 'availability') return; // ignore include out of stock
        if (cb.value === '') return; // ignore "all products"
        
        let labelText = cb.parentElement.textContent.trim();
        const badge = document.createElement('div');
        badge.className = 'filter-badge';
        badge.innerHTML = `${labelText} <span class="remove-filter" data-name="${cb.name}" data-value="${cb.value}">&times;</span>`;
        strip.appendChild(badge);
    });

    // Add click listeners to remove
    strip.querySelectorAll('.remove-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            const val = e.target.getAttribute('data-value');
            const inputs = document.querySelectorAll(`input[name="${name}"][value="${val}"]`);
            inputs.forEach(input => {
                input.checked = false;
            });
            applyFilters();
        });
    });
}

function applyFilters() {
    const params = getUrlParams();
    filteredProducts = [...allProducts];

    // URL parameter filtering
    if (params.q) {
        filteredProducts = filteredProducts.filter(p => 
            p.name?.toLowerCase().includes(params.q) || 
            p.description?.toLowerCase().includes(params.q) || 
            p.category?.toLowerCase().includes(params.q)
        );
    }
    
    // Sidebar Category Filter
    const selectedCategories = Array.from(document.querySelectorAll('.shop-sidebar input[name="category"]:checked')).map(cb => cb.value).filter(v => v !== '');
    if (selectedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(p => selectedCategories.includes(p.category) || selectedCategories.some(sc => p.category?.toLowerCase() === sc.toLowerCase()));
    } else {
        const allProductsCb = document.querySelector('.shop-sidebar input[name="category"][value=""]');
        if (allProductsCb?.checked) {
            document.querySelectorAll('.shop-sidebar input[name="category"]:not([value=""])').forEach(cb => cb.checked = false);
        }
        if (params.category) {
             filteredProducts = filteredProducts.filter(p => p.category === params.category || p.category?.toLowerCase() === params.category.toLowerCase());
        }
    }

    // Rating Filter
    const selectedRating = document.querySelector('.shop-sidebar input[name="rating"]:checked')?.value;
    if (selectedRating) {
        filteredProducts = filteredProducts.filter(p => (p.rating || 0) >= parseFloat(selectedRating));
    }

    // Price Filter
    const selectedPrice = document.querySelector('.shop-sidebar input[name="price"]:checked')?.value;
    if (selectedPrice) {
        const [min, max] = selectedPrice.split('-').map(Number);
        filteredProducts = filteredProducts.filter(p => {
            const price = Number(p.price) || 0;
            return price >= min && price <= max;
        });
    }

    // Discount Filter
    const selectedDiscount = document.querySelector('.shop-sidebar input[name="discount"]:checked')?.value;
    if (selectedDiscount) {
        const discountVal = parseInt(selectedDiscount, 10);
        filteredProducts = filteredProducts.filter(p => {
            if (!p.originalPrice || p.originalPrice <= p.price) return false;
            const discountPercent = ((p.originalPrice - p.price) / p.originalPrice) * 100;
            return discountPercent >= discountVal;
        });
    }

    // Availability Filter
    const includeOutOfStock = document.querySelector('.shop-sidebar input[name="availability"]')?.checked;
    if (!includeOutOfStock) {
        filteredProducts = filteredProducts.filter(p => p.stock > 0);
    }

    // Sort
    const sortVal = document.getElementById('sortBySelect')?.value;
    if (sortVal === 'price_low') {
        filteredProducts.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortVal === 'price_high') {
        filteredProducts.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortVal === 'rating') {
        filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortVal === 'newest') {
        filteredProducts.sort((a, b) => b.id.localeCompare(a.id));
    }

    updateActiveFilterBadges();

    // Reset pagination to page 1
    currentPage = 1;
    updateResultsText();
    renderPage();
}

function updateResultsText() {
    const countEl = document.querySelector('.products-count');
    if (!countEl) return;
    const params = getUrlParams();
    if (params.q) {
        countEl.textContent = `Showing ${filteredProducts.length} results for "${params.q}"`;
    } else {
        countEl.textContent = `Showing ${filteredProducts.length} results`;
    }
}

function renderPage() {
    const grid = document.getElementById('shopProductsGrid');
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    // Pagination UI
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageNumContainer = document.getElementById('paginationNumbers');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1 || totalPages === 0;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;

    if (pageNumContainer) {
        pageNumContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = 'page-num-btn' + (i === currentPage ? ' active' : '');
            btn.textContent = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                renderPage();
            });
            pageNumContainer.appendChild(btn);
        }
    }

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center;">No products found matching your criteria.</div>';
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    grid.innerHTML = paginatedProducts.map(product => {
        const price = Number(product.price) || 0;
        const oldPrice = Number(product.originalPrice) || 0;
        
        let priceHtml = `<div class="product-price">₹${price.toLocaleString('en-IN')}</div>`;
        if (oldPrice > price) {
            const discount = Math.round((1 - price / oldPrice) * 100);
            priceHtml = `
                <div class="product-price">
                    <span style="color:#cc0c39; font-size:1.2rem; margin-right:6px;">-${discount}%</span>
                    ₹${price.toLocaleString('en-IN')}
                </div>
                <div style="font-size:0.8rem; color:#565959; text-decoration:line-through; margin-bottom:4px;">
                    M.R.P: ₹${oldPrice.toLocaleString('en-IN')}
                </div>
            `;
        }

        const rating = product.rating || 4.5;
        const reviews = product.reviews || 100;
        const roundedStars = Math.round(rating);
        let starsStr = '';
        for (let i = 1; i <= 5; i++) {
            starsStr += i <= roundedStars ? '★' : '☆';
        }

        return `
            <a href="../product/?id=${product.id}" class="product-card" style="text-decoration:none; color:inherit;">
                <div class="product-image-container">
                    <img src="${product.image || '../assets/images/placeholder.jpg'}" alt="${product.name}" class="product-image" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
                </div>
                <div class="product-info" style="padding:16px; flex-grow:1; display:flex; flex-direction:column;">
                    <h3 class="product-title" style="font-size:1rem; font-weight:500; margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:#0f1111;">${product.name}</h3>
                    
                    <div class="product-rating" style="color:#f59e0b; font-size:0.9rem; margin-bottom:8px;">
                        ${starsStr} <span style="color:#007185; font-size:0.8rem; margin-left:4px;">(${reviews})</span>
                    </div>

                    <div style="margin-top:auto;">
                        ${priceHtml}
                        <div style="font-size:0.8rem; color:#565959; margin-top:4px;">
                            ${product.stock > 0 ? 'In stock' : '<span style="color:#B12704">Out of stock</span>'}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    // Scroll to top
    // window.scrollTo({top: 0, behavior: 'smooth'});
}
