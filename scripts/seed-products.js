#!/usr/bin/env node
/**
 * Seed Supabase with products.json data.
 *
 * Run: SUPABASE_SERVICE_KEY=sb_secret_... node scripts/seed-products.js
 *
 * Categories are inserted first (products reference them via FK).
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
    console.error('Usage: SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... node scripts/seed-products.js');
    process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_KEY env var is required.');
    console.error('Usage: SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... node scripts/seed-products.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PRODUCTS_JSON = path.join(__dirname, '..', 'frontend', 'products.json');

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

async function seed() {
    const json = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));

    console.log('Seeding categories...');
    const categories = (json.categories || []).map((c, i) => ({
        id: c.id,
        name: c.name || c.id,
        icon: c.icon || '',
        sort_order: i + 1
    }));

    const { error: catError } = await supabase
        .from('categories')
        .upsert(categories, { onConflict: 'id' });
    if (catError) {
        console.error('Categories error:', catError.message);
        process.exit(1);
    }
    console.log(`  ${categories.length} categories upserted.`);

    console.log('Seeding products...');
    const products = (json.products || []).map((p, i) => ({
        id: String(p.id),
        name: p.name || '',
        category: p.category || 'others',
        price: p.price ?? 0,
        unit: p.unit || 'each',
        description: p.description || '',
        image: p.image || '',
        fallback_emoji: p.fallbackEmoji || '🛒',
        in_stock: p.inStock !== false,
        featured: p.featured === true,
        subcategory: getSubcategory(p),
        sort_order: i + 1,
        variable_weight: p.variableWeight || false,
        display_price: p.displayPrice || null,
        estimated_max_weight: p.estimatedMaxWeight || null,
        image_width: p.imageWidth || null,
        image_height: p.imageHeight || null,
    }));

    const BATCH_SIZE = 50;
    let total = 0;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('products')
            .upsert(batch, { onConflict: 'id' });
        if (error) {
            console.error(`  Error at batch ${i}: ${error.message}`);
        } else {
            total += batch.length;
            console.log(`  Upserted ${total}/${products.length} products`);
        }
    }

    console.log('Seed complete!');
}

seed().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
