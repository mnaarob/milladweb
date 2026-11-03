import { env } from '../../config/env.js';
import { rowToProduct } from '../../lib/catalog.js';
import { HttpError } from '../../lib/http.js';
import { adminDb } from '../../lib/supabase.js';

export async function listProducts(category?: string) {
    let query = adminDb
        .from('products')
        .select('*')
        .eq('store_id', env.storeId)
        .eq('is_published', true)
        .order('sort_order');
    if (category && category !== 'all') query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw new HttpError(500, error.message);
    return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

export async function listFeatured() {
    const { data, error } = await adminDb
        .from('products')
        .select('*')
        .eq('store_id', env.storeId)
        .eq('is_published', true)
        .eq('featured', true)
        .order('sort_order')
        .limit(24);
    if (error) throw new HttpError(500, error.message);
    return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

const CATEGORY_UUID_TO_SLUG: Record<string, string> = {
    f19b9811825e5a0cad314bb2305c60aa: 'meat',
    ccebe08a1ba459028fd93e7e8df6673e: 'fresh',
    c66f3a316d9958e190b61b13440b0d14: 'dairy',
    '5e30bfa6d55453aa926ea3702576feb5': 'bakery',
    '269fabb86ba657f7a7d3ab24858136c3': 'pantry',
    '57ca56d92d7656c1b94d45890f54bb92': 'households',
    '9a2ebefb1492502680e0db1f0fed38d6': 'others',
    c311af30229c43c096078b3c0803196b: 'oils',
    f7198992d84d41a4a5ecd4578c6853eb: 'spices',
    af1dd051a8c24734b6859cbf9af7557a: 'rice',
    '80954aea6ba645b6a50d60578c3e80e7': 'beverages',
    '68b10d36009e401f9e7db8b81e27e990': 'tea',
};

const CATEGORY_NAME_TO_SLUG: Record<string, string> = {
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

function categorySlug(row: { id: string; name?: string | null; slug?: string | null; category_slug?: string | null }) {
    const fromColumn = row.slug || row.category_slug;
    if (fromColumn) return fromColumn.trim();
    const byUuid = CATEGORY_UUID_TO_SLUG[String(row.id).replace(/-/g, '').toLowerCase()];
    if (byUuid) return byUuid;
    const byName = CATEGORY_NAME_TO_SLUG[String(row.name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()];
    return byName || String(row.id);
}

export async function listCategories() {
    const { data, error } = await adminDb
        .from('categories')
        .select('*')
        .eq('store_id', env.storeId)
        .order('sort_order');
    if (error) throw new HttpError(500, error.message);
    return (data ?? []).map((row) => ({
        id: categorySlug(row),
        name: String(row.name ?? ''),
        sortOrder: Number(row.sort_order ?? 0),
    }));
}
