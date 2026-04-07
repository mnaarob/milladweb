# Deploy Edge Functions (required for checkout orders)

The storefront calls **`place-order`** at:

`https://<project-ref>.supabase.co/functions/v1/place-order`

If that function is **not deployed**, the URL returns **404**. The browser’s CORS preflight then fails, and the app shows **“Failed to fetch”** — not a normal JSON error.

## Deploy `place-order`

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Log in: `supabase login`
3. From this repo root, link the project (use your project ref from **Dashboard → Settings → General**):

   ```bash
   supabase link --project-ref iyubmgzxypcanrbyuyck
   ```

4. Deploy:

   ```bash
   supabase functions deploy place-order --no-verify-jwt
   ```

   Use `--no-verify-jwt` if guests place orders without signing in (the function validates the cart server-side). If you require a logged-in user only, omit it and enforce JWT in the dashboard.

5. Confirm in **Dashboard → Edge Functions** that `place-order` appears. Test:

   ```bash
   curl -sI -X OPTIONS "https://iyubmgzxypcanrbyuyck.supabase.co/functions/v1/place-order" \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST"
   ```

   You should see **HTTP/2 204** or **200**, not **404**.

After deployment, place a test order again from the site.
