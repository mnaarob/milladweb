import { clearCache, subscribeToProductCatalogChanges } from './services/database.js?v=3';
import { onCatalogChanged } from './modules/catalog-sync.js?v=3';
import {
    renderShopProducts,
    renderCategories,
    PRODUCTS_PER_PAGE,
    clearProductsCache
} from './modules/products.js?v=3';
import { initCart } from './modules/cart-ui.js?v=3';
import { initCheckout } from './modules/checkout.js?v=3';
import { initSearch } from './modules/search.js?v=3';
import { initAnimations, initBlurUpImages } from './modules/animations.js?v=4';
import { initProductModal } from './modules/product-modal.js?v=4';
import { initAuthUI } from './modules/auth-ui.js?v=3';

let currentCategory = 'all';
let currentType = null;
let currentSearch = '';
let currentSort = 'default';
let currentPage = 1;
let lastTotalPages = 1;

function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const type = params.get('type');
    const qParam = params.get('q') ?? params.get('search');

    currentSearch = qParam != null ? qParam : '';

    currentType = type || null;

    if (cat) {
        currentCategory = cat;
    } else if (currentType === 'land' || currentType === 'seafood') {
        currentCategory = 'meat';
    } else if (currentType === 'vegetables' || currentType === 'fruits') {
        currentCategory = 'fresh';
    } else {
        currentCategory = 'all';
    }
}

/** Match active state for category + optional data-type (Meat vs Seafood, Vegetables vs Fruits). */
function syncFilterActiveClasses() {
    document.querySelectorAll('[data-category]').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('[data-type]').forEach((el) => el.classList.remove('active'));

    document.querySelectorAll('[data-category]').forEach((el) => {
        if (el.dataset.category !== currentCategory) return;
        const dt = el.dataset.type;
        if (currentType) {
            if (dt === currentType) el.classList.add('active');
        } else if (!dt) {
            el.classList.add('active');
        }
    });

    if (currentType) {
        const typeEl = document.querySelector(`[data-type="${currentType}"]`);
        if (typeEl) typeEl.classList.add('active');
    } else {
        const allType = document.querySelector('[data-type="all"]');
        if (allType) allType.classList.add('active');
    }
}

function syncShopUrl() {
    const params = new URLSearchParams();
    if (currentCategory && currentCategory !== 'all') params.set('category', currentCategory);
    if (currentType) params.set('type', currentType);
    const searchTrim = (currentSearch || '').trim();
    if (searchTrim) params.set('q', searchTrim);
    const q = params.toString();
    const path = q ? `${window.location.pathname}?${q}` : window.location.pathname;
    if (window.history.replaceState) {
        window.history.replaceState({}, '', path);
    }
}

async function rerender() {
    const result = await renderShopProducts({
        gridSelector: '#productsGrid',
        countSelector: '#productCount',
        category: currentCategory,
        type: currentType,
        search: currentSearch,
        sort: currentSort,
        page: currentPage,
        perPage: PRODUCTS_PER_PAGE
    });
    if (result) {
        lastTotalPages = result.totalPages || 1;
        currentPage = result.currentPage || 1;
        renderPagination(result);
    }
    syncFilterActiveClasses();
    syncShopUrl();
    initBlurUpImages();
}

function renderPagination({ totalCount = 0, totalPages = 0, currentPage: page = 1 } = {}) {
    const container = document.getElementById('shopPagination');
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    const items = [];
    items.push(`<a href="#" class="${page <= 1 ? 'disabled' : ''}" data-page="prev" aria-label="Previous">‹</a>`);
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
        items.push(`<a href="#" class="${i === page ? 'active' : ''}" data-page="${i}">${i}</a>`);
    }
    items.push(`<a href="#" class="${page >= totalPages ? 'disabled' : ''}" data-page="next" aria-label="Next">›</a>`);
    container.innerHTML = items.join('');
}

function setupFilters() {
    document.addEventListener('click', (e) => {
        const catLink = e.target.closest('[data-category]');
        if (catLink) {
            e.preventDefault();
            currentCategory = catLink.dataset.category;
            const dt = catLink.dataset.type;
            currentType = dt && String(dt).trim() ? dt.trim() : null;
            currentPage = 1;

            rerender();
        }

        const typeLink = e.target.closest('[data-type]');
        if (typeLink) {
            e.preventDefault();
            const type = typeLink.dataset.type;
            currentType = type === 'all' ? null : type;
            currentCategory = type === 'all' ? 'all' : 'meat';
            currentPage = 1;

            document.querySelectorAll('[data-category]').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('[data-type]').forEach(el => el.classList.remove('active'));
            typeLink.classList.add('active');

            rerender();
        }

        const pageLink = e.target.closest('[data-page]');
        if (pageLink && !pageLink.classList.contains('disabled')) {
            e.preventDefault();
            const val = pageLink.dataset.page;
            if (val === 'prev') currentPage = Math.max(1, currentPage - 1);
            else if (val === 'next') currentPage = Math.min(lastTotalPages, currentPage + 1);
            else currentPage = parseInt(val, 10) || 1;
            rerender();
        }
    });

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            currentPage = 1;
            rerender();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initAnimations();
    initCart();
    initAuthUI();
    initProductModal();
    initCheckout();

    initSearch({
        onSearch: (query) => {
            currentSearch = query;
            currentPage = 1;
            rerender();
        }
    });

    setupFilters();
    initFromUrl();

    const heroSearchInput = document.getElementById('searchInput');
    if (heroSearchInput) heroSearchInput.value = currentSearch;

    await renderCategories('#heroCategories', null);
    await rerender();
    initBlurUpImages();

    async function refreshCatalogFromAdmin() {
        clearCache();
        clearProductsCache();
        await rerender();
    }

    // Same browser: admin saved a product → other tabs refresh immediately.
    const unsubBroadcast = onCatalogChanged(() => {
        refreshCatalogFromAdmin();
    });

    // Any client: Supabase Realtime (enable Replication on `products`).
    const unsubRealtime = subscribeToProductCatalogChanges(() => {
        clearProductsCache();
        rerender();
    });

    window.addEventListener('beforeunload', () => {
        unsubBroadcast();
        unsubRealtime();
    });

    // Fallback: switching back to this tab still refetches.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        clearCache();
        clearProductsCache();
        rerender();
    });
});
