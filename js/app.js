import { renderFeatured, clearProductsCache } from './modules/products.js?v=3';
import { clearCache, subscribeToProductCatalogChanges } from './services/database.js?v=3';
import { onCatalogChanged } from './modules/catalog-sync.js?v=3';
import { initCart } from './modules/cart-ui.js?v=3';
import { initCheckout } from './modules/checkout.js?v=3';
import { initSearch } from './modules/search.js?v=3';
import { initAnimations, initBlurUpImages } from './modules/animations.js?v=4';
import { initProductModal } from './modules/product-modal.js?v=4';
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
