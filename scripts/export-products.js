#!/usr/bin/env node
/**
 * Export Supabase products to products.json.
 * Keeps codebase and Supabase in sync when you add products via Admin Panel.
 *
 * Run: node scripts/export-products.js
 *
 * Prerequisites: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars,
 * or a .env file in the project root.
 */

const path = require('path');
const fs = require('fs');

let createClient;
try {
    createClient = require('@supabase/supabase-js').createClient;
} catch {
    console.error('@supabase/supabase-js not found. Run: npm install @supabase/supabase-js');
    process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL) {
    console.error('SUPABASE_URL env var is required.');
    console.error('Usage: SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... node scripts/export-products.js');
    process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_KEY env var is required (secret/service_role key).');
    console.error('Usage: SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... node scripts/export-products.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PRODUCTS_JSON = path.join(__dirname, '..', 'frontend', 'products.json');

function toPlainProduct(row) {
    const out = {
        id: row.id,
        name: row.name || '',
        category: row.category || 'others',
        price: Number(row.price) || 0,
        unit: row.unit || 'each',
        description: row.description || '',
        image: row.image || '',
        fallbackEmoji: row.fallback_emoji || '🛒',
        inStock: row.in_stock !== false,
        ...(row.featured && { featured: true }),
        ...(row.variable_weight && { variableWeight: row.variable_weight }),
        ...(row.display_price && { displayPrice: row.display_price }),
        ...(row.estimated_max_weight && { estimatedMaxWeight: row.estimated_max_weight }),
        ...(row.image_width && { imageWidth: row.image_width }),
        ...(row.image_height && { imageHeight: row.image_height })
    };
    return out;
}

async function exportProducts() {
    console.log('Fetching products from Supabase...');
    const { data: rows, error } = await supabase
        .from('products')
        .select('*')
        .order('category')
        .order('sort_order');

    if (error) throw new Error(error.message);

    const products = rows.map(toPlainProduct);
    console.log(`Exported ${products.length} products`);

    const { data: catRows, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

    let categories = [];
    if (!catError && catRows && catRows.length > 0) {
        categories = catRows.map(row => ({
            id: row.id,
            name: row.name || row.id,
            icon: row.icon || ''
        }));
    } else {
        const existing = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
        categories = existing.categories || [];
    }

    const data = { categories, products };
    fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Exported to ${PRODUCTS_JSON}`);
}

exportProducts().catch(err => {
    console.error('Export failed:', err.message);
    process.exit(1);
});
