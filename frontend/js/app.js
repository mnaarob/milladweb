import { renderFeatured, clearProductsCache } from './modules/products.js?v=6';
import { clearCache, subscribeToProductCatalogChanges } from './services/database.js?v=4';
import { onCatalogChanged } from './modules/catalog-sync.js?v=3';
import { initCart } from './modules/cart-ui.js?v=4';
import { initCheckout } from './modules/checkout.js?v=6';
import { initSearch } from './modules/search.js?v=3';
import { initAnimations, initBlurUpImages } from './modules/animations.js?v=5';
import { initProductModal } from './modules/product-modal.js?v=6';
import { initAuthUI } from './modules/auth-ui.js?v=3';

document.addEventListener('DOMContentLoaded', async () => {
    initAnimations();
    initCart();
    initAuthUI();
    initProductModal();
    initSearch({ featuredFilter: true, navigateToShopOnSubmit: true });
    initCheckout();

    async function refreshFeatured() {
        clearCache();
        clearProductsCache();
        await renderFeatured('#featuredGrid');
    }

    await renderFeatured('#featuredGrid');
    initBlurUpImages();

    document.querySelector('.featured__controls')?.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-filter]');
        if (!li) return;
        e.preventDefault();

        li.parentElement.querySelectorAll('li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');

        const filter = li.dataset.filter;
        const grid = document.getElementById('featuredGrid');
        if (!grid) return;

        grid.querySelectorAll('.mix').forEach(item => {
            if (filter === '*' || item.classList.contains(filter.replace('.', ''))) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });

    const unsubBroadcast = onCatalogChanged(() => {
        refreshFeatured();
    });

    const unsubRealtime = subscribeToProductCatalogChanges(() => {
        clearProductsCache();
        renderFeatured('#featuredGrid');
    });

    window.addEventListener('beforeunload', () => {
        unsubBroadcast();
        unsubRealtime();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        refreshFeatured();
    });
});
