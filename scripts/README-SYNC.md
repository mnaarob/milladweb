# Products Sync: Codebase <-> Supabase

Keep `products.json` and Supabase in sync whether you add products from the **codebase** or the **Admin Panel**.

## Workflow

### Add from codebase (products.json)

1. Edit `products.json` -- add or update products.
2. Open `scripts/migrate-products.html` in a browser.
3. Sign in (if required) and click **Migrate Products** / **Migrate Categories**.

Alternatively, use the CLI seed script:

```bash
SUPABASE_SERVICE_KEY=sb_secret_... npm run seed
```

### Add from Admin Panel

1. Go to `admin.html` -> Products tab -> Add Product.
2. Fill in details. For **category**, choose "Fresh" for vegetables.
3. Set **Sort order** (e.g. 11) so it appears with vegetables.
4. Save.
5. Run export to update `products.json`:

   ```bash
   SUPABASE_SERVICE_KEY=sb_secret_... npm run export
   ```

## Commands

| Command | Description |
|---------|-------------|
| `npm run export` | Export Supabase -> products.json (needs SUPABASE_SERVICE_KEY) |
| `npm run seed` | Seed products.json -> Supabase (needs SUPABASE_SERVICE_KEY) |
| `scripts/migrate-products.html` | Import products.json -> Supabase (open in browser) |

## Fixing product order (e.g. Organic Ginger with vegetables)

1. Open **Admin Panel** -> Products.
2. Find the product -> **Edit**.
3. Set **Category** to "Fresh".
4. Set **Sort order** to 11 (or another value between other vegetables).
5. Save.
6. Run `npm run export` to update `products.json`.
