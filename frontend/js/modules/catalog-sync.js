/**
 * When the admin saves a product, notify other tabs on the same origin so the
 * shop/home page can refetch from Supabase without a manual refresh.
 */
const CHANNEL = 'millads-catalog-sync-v1';

export function notifyCatalogChanged() {
    try {
        const bc = new BroadcastChannel(CHANNEL);
        bc.postMessage({ type: 'products-updated', t: Date.now() });
        bc.close();
    } catch (_) {
        /* BroadcastChannel unsupported */
    }
}

/** @param {() => void} callback */
export function onCatalogChanged(callback) {
    try {
        const bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = () => {
            callback();
        };
        return () => {
            bc.close();
        };
    } catch (_) {
        return () => {};
    }
}
