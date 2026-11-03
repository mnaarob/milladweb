import { supabase, STORE_ID, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

let productsCache = null;
let categoriesCache = null;
let _organizationId = null;

const DB_TIMEOUT_MS = 12000;
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

async function getOrganizationId() {
    if (_organizationId) return _organizationId;
    const { data, error } = await supabase
        .from('stores')
        .select('organization_id')
        .eq('id', STORE_ID)
        .single();
    if (error) throw new Error('Could not look up organization: ' + error.message);
    _organizationId = data.organization_id;
    return _organizationId;
}

function withTimeout(promise, ms = DB_TIMEOUT_MS) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), ms))
    ]);
}

async function loadProductsFromJson(category = null) {
    const resp = await fetch('products.json');
    const data = await resp.json();
    let products = (data.products || [])
        .filter(p => p.inStock !== false)
        .map((p, i) => ({
            id: String(p.id),
            name: p.name,
            category: p.category,
            price: p.price,
            unit: p.unit || 'each',
            description: p.description || '',
            image: p.image || '',
            fallbackEmoji: p.fallbackEmoji || '🛒',
            inStock: true,
            taxExempt: p.taxExempt || false,
            subcategory: getSubcategory(p),
            sortOrder: i + 1
        }));
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    return products;
}

async function loadCategoriesFromJson() {
    const resp = await fetch('products.json');
    const data = await resp.json();
    return (data.categories || []).map((c, i) => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '',
        sortOrder: i + 1
    }));
}

function getSubcategory(product) {
    const name = (product.name || '').toLowerCase();
    if (product.category !== 'meat') return product.category;
    if (name.includes('beef') || name.includes('oxtail')) return 'beef';
    if (name.includes('chicken') || name.includes('poultry') || name.includes('stewing')) return 'chicken';
    if (name.includes('lamb')) return 'lamb';
    if (name.includes('goat')) return 'lamb';
    if (name.includes('turkey')) return 'chicken';
    if (name.includes('fish') || name.includes('tilapia') || name.includes('mackerel') || name.includes('salmon') || name.includes('shrimp') || name.includes('prawns') || name.includes('catfish') || name.includes('croaker')) return 'seafood';
    return 'beef';
}

/**
 * DB `categories.id` is UUID; `products.category` is a text slug (meat, fresh, oils, …).
 * Shop filters compare `data-category` on links to `product.category`, so category `id`
 * exposed to the storefront must be the slug. Optional DB columns `slug` / `category_slug`
 * on categories override this. Name fallback covers different UUIDs in production.
 */
function normalizeUuid(u) {
    return String(u || '').replace(/-/g, '').toLowerCase();
}

/** UUID without hyphens → slug (must match `products.category` in DB). */
const CATEGORY_UUID_TO_SLUG_NORM = {
    'f19b9811825e5a0cad314bb2305c60aa': 'meat',
    'ccebe08a1ba459028fd93e7e8df6673e': 'fresh',
    'c66f3a316d9958e190b61b13440b0d14': 'dairy',
    '5e30bfa6d55453aa926ea3702576feb5': 'bakery',
    '269fabb86ba657f7a7d3ab24858136c3': 'pantry',
    '57ca56d92d7656c1b94d45890f54bb92': 'households',
    '9a2ebefb1492502680e0db1f0fed38d6': 'others',
    'c311af30229c43c096078b3c0803196b': 'oils',
    'f7198992d84d41a4a5ecd4578c6853eb': 'spices',
    'af1dd051a8c24734b6859cbf9af7557a': 'rice',
    '80954aea6ba645b6a50d60578c3e80e7': 'beverages',
    '68b10d36009e401f9e7db8b81e27e990': 'tea',
};

function normalizeCategoryName(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Display name (lowercased) → slug when UUID map misses (e.g. re-seeded categories). */
const CATEGORY_NAME_TO_SLUG = {
    'meat & sea food': 'meat',
    'meat & seafood': 'meat',
    'fresh vegetables & fruits': 'fresh',
    'dairy & eggs': 'dairy',
    bakery: 'bakery',
    pantry: 'pantry',
    households: 'households',
    others: 'others',
    'oils & ghee': 'oils',
    'spices & seasonings': 'spices',
    'rice & grains': 'rice',
    beverages: 'beverages',
    'tea & coffee': 'tea',
};

function uuidToCategorySlug(row) {
    const fromCol = row.slug || row.category_slug;
    if (fromCol && typeof fromCol === 'string') return fromCol.trim();
    const key = normalizeUuid(row.id);
    const byUuid = CATEGORY_UUID_TO_SLUG_NORM[key];
    if (byUuid) return byUuid;
    const byName = CATEGORY_NAME_TO_SLUG[normalizeCategoryName(row.name)];
    if (byName) return byName;
    return String(row.id);
}

function rowToCategory(row) {
    const slug = uuidToCategorySlug(row);
    return {
        id: slug,
        name: row.name,
        icon: row.icon || '',
        sortOrder: row.sort_order ?? 0,
    };
}

function categoryIdToSlug(categoryId) {
    if (!categoryId) return '';
    const k = normalizeUuid(categoryId);
    return CATEGORY_UUID_TO_SLUG_NORM[k] || '';
}

/** If `products.category` was mistakenly stored as a UUID, map it to slug. */
function slugFromMaybeUuid(val) {
    if (!val || typeof val !== 'string') return '';
    const t = val.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
        return CATEGORY_UUID_TO_SLUG_NORM[normalizeUuid(t)] || '';
    }
    return '';
}

function rowToProduct(row) {
    // TTS: category = text slug for filtering; category_id = UUID FK for inventory
    let category = (row.category && String(row.category).trim()) || '';
    const fromUuidCol = slugFromMaybeUuid(category);
    if (fromUuidCol) category = fromUuidCol;
    if (!category && row.category_id) {
        category = categoryIdToSlug(row.category_id);
    }
    return {
        id: row.id,
        name: row.name,
        category,
        price: Number(row.price),
        unit: row.unit || 'each',
        description: row.description || '',
        image: (row.image != null && String(row.image).trim()) || '',
        fallbackEmoji: row.fallback_emoji || '🛒',
        inStock: row.in_stock !== false,
        featured: row.featured || false,
        subcategory: row.subcategory || getSubcategory({ ...row, category }),
        sortOrder: row.sort_order ?? 9999,
        variableWeight: row.variable_weight || false,
        displayPrice: row.display_price || null,
        estimatedMaxWeight: row.estimated_max_weight || null,
        taxExempt: row.tax_exempt || false,
        stockQuantity: row.quantity ?? null,
        stockManaged: row.stock_managed ?? true,
    };
}

function productToRow(data) {
    const row = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.category !== undefined) row.category = data.category; // text slug for website filtering
    if (data.price !== undefined) row.price = data.price;
    if (data.unit !== undefined) row.unit = data.unit;
    if (data.description !== undefined) row.description = data.description;
    if (data.image !== undefined) row.image = data.image;
    if (data.fallbackEmoji !== undefined) row.fallback_emoji = data.fallbackEmoji;
    if (data.inStock !== undefined) row.in_stock = data.inStock;
    if (data.featured !== undefined) row.featured = data.featured;
    if (data.subcategory !== undefined) row.subcategory = data.subcategory;
    if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
    if (data.variableWeight !== undefined) row.variable_weight = data.variableWeight;
    if (data.displayPrice !== undefined) row.display_price = data.displayPrice;
    if (data.estimatedMaxWeight !== undefined) row.estimated_max_weight = data.estimatedMaxWeight;
    return row;
}

export async function getProducts(category = null) {
    if (productsCache && !category) return productsCache;

    let products = [];

    // Prefer Supabase (same as production) so admin edits show on localhost; JSON is offline fallback.
    try {
        let query = supabase.from('products').select('*').eq('store_id', STORE_ID).eq('is_published', true);
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        const { data, error } = await withTimeout(query.order('sort_order'));
        if (error) throw error;
        products = (data || []).map(rowToProduct);
    } catch (err) {
        console.warn('Supabase getProducts failed, falling back to products.json:', err.message || err);
    }

    if (products.length === 0) {
        try {
            products = await loadProductsFromJson(category);
        } catch (e) {
            console.warn('products.json load failed:', e);
        }
    }

    products.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    if (!category || category === 'all') productsCache = products;
    return products;
}

const FEATURED_IDS = [15, 16, 19, 23, 22, 20, 27, 25, 26, 28, 17, 18, 21, 29, 59, 56];

export async function getFeaturedProducts() {
    let products = [];
    let loadedFromDatabase = false;

    function featuredFromJson(allProducts) {
        return allProducts
            .filter(p => FEATURED_IDS.includes(Number(p.id)))
            .map((p, i) => ({ ...p, featured: true, sortOrder: FEATURED_IDS.indexOf(Number(p.id)) }));
    }

    try {
        const { data, error } = await withTimeout(
            supabase
                .from('products')
                .select('*')
                .eq('store_id', STORE_ID)
                .eq('is_published', true)
                .eq('featured', true)
                .order('sort_order')
                .limit(24)
        );
        if (error) throw error;
        products = (data || []).map(rowToProduct);
        loadedFromDatabase = true;
    } catch (err) {
        console.warn('Supabase getFeaturedProducts failed, falling back to products.json:', err.message || err);
    }

    // An empty database result is a real answer. The JSON list is only for
    // when the catalog cannot be reached, so a timeout cannot replace the
    // products marked featured in the admin.
    if (!loadedFromDatabase) {
        try {
            const all = await loadProductsFromJson();
            products = featuredFromJson(all);
        } catch (e) {
            console.warn('products.json featured fallback failed:', e);
        }
    }

    return products
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .slice(0, 24);
}

export async function getCategories() {
    if (categoriesCache) return categoriesCache;

    if (IS_LOCAL) {
        try {
            categoriesCache = await loadCategoriesFromJson();
            return categoriesCache;
        } catch (e) {
            console.warn('products.json categories load failed:', e);
        }
    }

    try {
        const { data, error } = await withTimeout(
            supabase
                .from('categories')
                .select('*')
                .eq('store_id', STORE_ID)
                .order('sort_order')
        );
        if (error) throw error;
        if (data && data.length > 0) {
            categoriesCache = data.map(rowToCategory);
            return categoriesCache;
        }
    } catch (err) {
        console.warn('Supabase getCategories failed, falling back to products.json:', err.message || err);
    }

    try {
        categoriesCache = await loadCategoriesFromJson();
    } catch (e) {
        console.warn('products.json categories fallback failed:', e);
        categoriesCache = [];
    }
    return categoriesCache;
}

/** Extra detail from FunctionsFetchError (browser blocked fetch, DNS, offline, etc.). */
function unwrapFunctionsError(err) {
    if (!err) return 'Unknown error';
    const base = err.message || String(err);
    const ctx = err.context;
    if (ctx instanceof Error && ctx.message) return `${base} — ${ctx.message}`;
    if (ctx != null && typeof ctx === 'object' && 'message' in ctx && ctx.message) {
        return `${base} — ${String(ctx.message)}`;
    }
    if (typeof ctx === 'string' && ctx) return `${base} — ${ctx}`;
    return base;
}

/**
 * Same request as supabase.functions.invoke but uses fetch directly.
 * Helps when the JS client's internal request fails (some browsers/extensions).
 */
async function invokePlaceOrderViaFetch(payload) {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const bearer = session?.access_token ?? SUPABASE_ANON_KEY;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/place-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = {};
    if (text) {
        try {
            json = JSON.parse(text);
        } catch {
            throw new Error(`Order service returned an invalid response (HTTP ${res.status}).`);
        }
    }

    if (!res.ok) {
        const msg =
            typeof json?.error === 'string'
                ? json.error
                : text || res.statusText || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    if (json?.error) throw new Error(json.error);
    return json;
}

export async function saveOrder(orderData) {
    // Orders go through the Edge Function so store_id is validated server-side
    // and the service role key (which bypasses RLS) never touches the browser.
    const payload = {
        store_id: STORE_ID,
        customer: orderData.customer,
        items: orderData.items,
        pricing: orderData.pricing,
        payment_method: orderData.paymentMethod,
        payment_token: orderData.paymentToken || null,
        // user_id is intentionally omitted — the edge function derives it
        // from the Authorization JWT header, never from the request body
    };

    const { data, error } = await supabase.functions.invoke('place-order', {
        body: payload,
    });

    if (!error) {
        if (data?.error) throw new Error(data.error);
        return data;
    }

    const isNetworkLayerFailure =
        error.name === 'FunctionsFetchError' ||
        (typeof error.message === 'string' && error.message.includes('Failed to send'));

    if (isNetworkLayerFailure) {
        try {
            return await invokePlaceOrderViaFetch(payload);
        } catch (fallbackErr) {
            const detail = unwrapFunctionsError(error);
            const fb =
                fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            const looksLikeNetwork =
                /failed to fetch/i.test(detail) || /failed to fetch/i.test(fb);
            if (looksLikeNetwork) {
                throw new Error(
                    'Orders are unavailable because the Supabase Edge Function "place-order" is not deployed ' +
                        '(or your network blocked the request). Deploy it from your project: see supabase/DEPLOY.md, ' +
                        'or run: npx supabase functions deploy place-order (after supabase login && supabase link). ' +
                        'If the function is already deployed, try disabling ad blockers for this page.'
                );
            }
            throw new Error(
                `Could not complete the order (${detail}). Retry: ${fb}.`
            );
        }
    }

    throw new Error(unwrapFunctionsError(error));
}

export async function getOrdersByUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
        id: row.id,
        customer: row.customer,
        items: row.items,
        pricing: row.pricing,
        paymentMethod: row.payment_method,
        paymentToken: row.payment_token,
        status: row.status,
        timestamp: new Date(row.created_at),
    }));
}

export function clearCache() {
    productsCache = null;
    categoriesCache = null;
}

/**
 * Subscribe to Supabase Realtime changes on `products` for this store.
 * Enable: Supabase Dashboard → Database → Replication → `products` (or Realtime settings).
 * If disabled, BroadcastChannel from the admin tab still triggers refreshes.
 * @param {() => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeToProductCatalogChanges(onChange) {
    if (typeof window === 'undefined') return () => {};
    const channel = supabase
        .channel(`products-catalog-${STORE_ID}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `store_id=eq.${STORE_ID}`,
            },
            () => {
                clearCache();
                onChange();
            }
        )
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(
                    '[catalog] Realtime subscription issue; enable Replication for `products` in Supabase, or rely on saving from admin (tab sync).'
                );
            }
        });
    return () => {
        supabase.removeChannel(channel);
    };
}

export async function getProductsForAdmin() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', STORE_ID)
        .order('sort_order');
    if (error) throw error;
    return (data || []).map(rowToProduct);
}

export async function addProduct(productData) {
    const row = productToRow(productData);
    row.store_id = STORE_ID;
    row.organization_id = await getOrganizationId();
    row.in_stock = productData.inStock !== false;
    row.featured = productData.featured === true;
    row.sort_order = productData.sortOrder ?? 9999;
    row.is_published = true;

    const { data, error } = await supabase
        .from('products')
        .insert(row)
        .select();
    if (error) throw error;
    clearCache();
    return data[0].id;
}

export async function updateProduct(id, productData) {
    const row = productToRow(productData);
    row.in_stock = productData.inStock !== false;
    row.featured = productData.featured === true;

    const { error } = await supabase
        .from('products')
        .update(row)
        .eq('id', id)
        .eq('store_id', STORE_ID);
    if (error) throw error;
    clearCache();
}

export async function deleteProduct(id) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('store_id', STORE_ID);
    if (error) throw error;
    clearCache();
}

export async function softDeleteProduct(id) {
    const { error } = await supabase
        .from('products')
        .update({ in_stock: false })
        .eq('id', id)
        .eq('store_id', STORE_ID);
    if (error) throw error;
    clearCache();
}

export async function setProductFeatured(id, featured) {
    const { error } = await supabase
        .from('products')
        .update({ featured: !!featured })
        .eq('id', id)
        .eq('store_id', STORE_ID);
    if (error) throw error;
    clearCache();
}

export async function getOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
        id: row.id,
        customer: row.customer,
        items: row.items,
        pricing: row.pricing,
        paymentMethod: row.payment_method,
        paymentToken: row.payment_token,
        status: row.status,
        timestamp: new Date(row.created_at),
    }));
}

export async function updateOrderStatus(orderId, status) {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('store_id', STORE_ID);
    if (error) throw error;
}

export async function updateOrderPricing(orderId, newPricing) {
    const { data, error } = await supabase
        .from('orders')
        .update({ pricing: newPricing })
        .eq('id', orderId)
        .eq('store_id', STORE_ID)
        .select('pricing')
        .single();
    if (error) throw error;
    return data.pricing;
}
