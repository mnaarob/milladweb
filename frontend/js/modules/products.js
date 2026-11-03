import { getFeaturedProducts, getProducts, getCategories } from '../services/database.js?v=4';
import { featuredCardTemplate, shopProductCardTemplate, categoryLinkTemplate } from '../templates/html.js?v=5';

let allProducts = [];

const HIDDEN_PATTERNS = ['shan'];
function shouldHide(product) {
    const name = (product.name || '').toLowerCase();
    return HIDDEN_PATTERNS.some(p => name.includes(p));
}

/** Meat category: fish / shellfish (aligns with DB subcategory + name heuristics). */
function isSeafoodProduct(product) {
    if (product.category !== 'meat') return false;
    const sub = (product.subcategory || '').toLowerCase();
    if (sub === 'seafood') return true;
    const n = (product.name || '').toLowerCase();
    return /fish|tilapia|mackerel|salmon|shrimp|prawns?|catfish|croaker|seafood|crab|lobster|squid|octopus|oyster|clam|tuna|sardine|anchovy|gilbaka|prawn/.test(n);
}

function isLandMeatProduct(product) {
    return product.category === 'meat' && !isSeafoodProduct(product);
}

const FRUIT_NAME_HINTS = [
    'banana', 'mango', 'apple', 'orange', 'grape', 'melon', 'berry', 'berries', 'pear', 'peach', 'plum', 'kiwi',
    'pineapple', 'papaya', 'watermelon', 'lime', 'lemon', 'coconut', 'citrus', 'pomegranate', 'fig', 'date',
];
const VEG_NAME_HINTS = [
    'carrot', 'tomato', 'tomatoes', 'broccoli', 'spinach', 'pepper', 'bell pepper', 'ginger', 'lettuce', 'onion',
    'potato', 'cucumber', 'kale', 'garlic', 'eggplant', 'okra', 'cabbage', 'celery', 'radish', 'squash', 'zucchini',
    'scallion', 'chilli', 'chili', 'herb', 'vegetable', 'greens', 'corn', 'bean sprout', 'bok choy', 'mushroom',
];

function isFreshFruitProduct(product) {
    if (product.category !== 'fresh') return false;
    const img = String(product.image || '').toLowerCase();
    if (/\/fruits\//.test(img) || /fruits\//.test(img)) return true;
    if (/\/vegetables\//.test(img) || /vegetables\//.test(img)) return false;
    const n = (product.name || '').toLowerCase();
    return FRUIT_NAME_HINTS.some((h) => n.includes(h));
}

function isFreshVegetableProduct(product) {
    if (product.category !== 'fresh') return false;
    const img = String(product.image || '').toLowerCase();
    if (/\/vegetables\//.test(img) || /vegetables\//.test(img)) return true;
    if (/\/fruits\//.test(img) || /fruits\//.test(img)) return false;
    const n = (product.name || '').toLowerCase();
    if (FRUIT_NAME_HINTS.some((h) => n.includes(h))) return false;
    if (VEG_NAME_HINTS.some((h) => n.includes(h))) return true;
    return false;
}

function applySetBg() {
    document.querySelectorAll('[data-setbg]').forEach(el => {
        if (!el.style.backgroundImage) {
            el.style.backgroundImage = `url(${el.dataset.setbg})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        }
    });
}

function attachCartDelegation(container) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add-to-cart]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.addToCart;
        document.dispatchEvent(new CustomEvent('openProductModal', { detail: { productId: id } }));
    });
}

export async function renderFeatured(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    try {
        const products = await getFeaturedProducts();
        allProducts = products;
        container.innerHTML = products.map(p => featuredCardTemplate(p)).join('');
        applySetBg();
        attachCartDelegation(container);
    } catch (err) {
        console.error('Error loading featured products:', err);
        container.innerHTML = '<div class="col-12 text-center"><p>Error loading products. Please refresh.</p></div>';
    }
}

export const PRODUCTS_PER_PAGE = 12;

export async function renderShopProducts({
    gridSelector,
    countSelector,
    category = 'all',
    type = null,
    search = '',
    sort = 'default',
    page = 1,
    perPage = PRODUCTS_PER_PAGE
}) {
    const grid = document.querySelector(gridSelector);
    const countEl = document.querySelector(countSelector);
    if (!grid) return;

    if (allProducts.length === 0) {
        try {
            const products = await getProducts();
            allProducts = products.filter(p => !shouldHide(p));
        } catch (err) {
            console.error('Error loading products:', err);
            grid.innerHTML = '<div class="col-12 text-center"><p>Error loading products. Please refresh.</p></div>';
            return;
        }
    }

    let filtered = allProducts.filter(product => {
        if (category !== 'all' && product.category !== category) return false;

        if (type) {
            const t = String(type).toLowerCase();
            if (t === 'land') {
                if (!isLandMeatProduct(product)) return false;
            } else if (t === 'seafood') {
                if (product.category !== 'meat' || !isSeafoodProduct(product)) return false;
            } else if (t === 'vegetables') {
                if (!isFreshVegetableProduct(product)) return false;
            } else if (t === 'fruits') {
                if (!isFreshFruitProduct(product)) return false;
            } else {
                const name = (product.name || '').toLowerCase();
                const subcat = (product.subcategory || '').toLowerCase();
                const typeMatch = name.includes(t) || subcat.includes(t);
                const subcatMap = {
                    beef: 'beef',
                    chicken: 'chicken',
                    lamb: 'lamb',
                    goat: 'lamb',
                    fish: 'seafood',
                    turkey: 'chicken',
                    seafood: 'seafood',
                };
                const mappedSubcat = subcatMap[t];
                const subcatMatch = mappedSubcat && subcat === mappedSubcat;
                if (!typeMatch && !subcatMatch) return false;
            }
        }

        if (search) {
            const q = search.toLowerCase();
            const nameMatch = product.name.toLowerCase().includes(q);
            const descMatch = (product.description || '').toLowerCase().includes(q);
            if (!nameMatch && !descMatch) return false;
        }

        return true;
    });

    switch (sort) {
        case 'name-asc':  filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'name-desc': filtered.sort((a, b) => b.name.localeCompare(a.name)); break;
        case 'price-asc': filtered.sort((a, b) => a.price - b.price); break;
        case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
    }

    const totalCount = filtered.length;
    if (countEl) countEl.textContent = totalCount;

    if (totalCount === 0) {
        grid.innerHTML = '<div class="col-12 text-center"><p>No products found.</p></div>';
        return { totalCount: 0, totalPages: 0 };
    }

    const totalPages = Math.ceil(totalCount / perPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * perPage;
    const pageProducts = filtered.slice(start, start + perPage);

    grid.innerHTML = pageProducts.map(p => shopProductCardTemplate(p)).join('');
    attachCartDelegation(grid);
    applySetBg();

    return { totalCount, totalPages, currentPage: safePage };
}

export async function renderCategories(heroSelector, sidebarSelector) {
    try {
        const categories = await getCategories();

        const heroEl = document.querySelector(heroSelector);
        if (heroEl) {
            const allProductsLink = '<li><a href="/shop" class="active" data-category="all">All Products</a></li>';
            heroEl.innerHTML = allProductsLink + categories.map(c => categoryLinkTemplate(c)).join('');
        }

        const sidebarEl = sidebarSelector ? document.querySelector(sidebarSelector) : null;
        if (sidebarEl) {
            const existing = sidebarEl.innerHTML;
            sidebarEl.innerHTML = existing + categories.map(c => categoryLinkTemplate(c)).join('');
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

export function getAllProducts() {
    return allProducts;
}

export function clearProductsCache() {
    allProducts = [];
}
