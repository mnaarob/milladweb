import type { Product } from './types';

export type MeatFilter = 'all' | 'beef' | 'chicken' | 'lamb' | 'seafood';

export const MEAT_FILTERS: { id: MeatFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'beef', label: 'Beef' },
    { id: 'chicken', label: 'Chicken' },
    { id: 'lamb', label: 'Lamb & Goat' },
    { id: 'seafood', label: 'Seafood' },
];

export function meatBucket(product: Product): Exclude<MeatFilter, 'all'> | null {
    const sub = (product.subcategory || '').toLowerCase();
    if (sub === 'beef' || sub === 'chicken' || sub === 'lamb' || sub === 'seafood') return sub;
    if (sub === 'goat') return 'lamb';
    if (product.category && product.category !== 'meat') return null;
    const name = product.name.toLowerCase();
    if (/fish|tilapia|mackerel|salmon|shrimp|prawns?|catfish|croaker|seafood|crab|lobster|squid|octopus|oyster|clam|tuna|sardine|anchovy/.test(name)) return 'seafood';
    if (/chicken|turkey|poultry/.test(name)) return 'chicken';
    if (/lamb|goat|mutton/.test(name)) return 'lamb';
    if (/beef|oxtail|tongue|kidney|liver|steak|veal|mince/.test(name)) return 'beef';
    return null;
}
