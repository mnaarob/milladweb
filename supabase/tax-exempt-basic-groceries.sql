-- Basic groceries are GST zero-rated and generally Manitoba PST exempt.
-- Checkout reads products.tax_exempt from this table, not products.json.
-- Run in the Supabase SQL editor for store millads.
-- Beverages (pop, energy drinks, juice) are left unchanged.

UPDATE products
SET tax_exempt = true
WHERE store_id = 'millads'
  AND (
    category IN ('bakery', 'dairy', 'fresh', 'meat', 'oils', 'pantry', 'rice', 'spices', 'tea')
    OR name IN (
      'Beans Flour 1kg',
      'INSTANT YEAST',
      'Shredded Cheese Mozza-Cheddar',
      'SHREDDED CHEESE PIZZA MOZZARELLA'
    )
  );

-- Henna is a cosmetic, not a basic grocery.
UPDATE products
SET tax_exempt = false
WHERE store_id = 'millads'
  AND name ILIKE '%henna%';
