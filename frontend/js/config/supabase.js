// ================================================================
// Tech to Store — Shared Database Configuration
//
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with credentials
// from the Tech to Store Supabase project:
//   Dashboard → Settings → API → Project URL & anon public key
//
// STORE_ID is the unique slug assigned to this store in the
// Tech to Store system (matches the `id` column in `stores`).
// ================================================================

export const SUPABASE_URL = 'https://iyubmgzxypcanrbyuyck.supabase.co';
export const SUPABASE_ANON_KEY =
    'sb_publishable_ZrDGLZ4Gkva4h5U-6ucPFw_wle3cJmd';

export const STORE_ID = 'millads';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RiO2SIkESFylAb6N1vBYXxOshbsJYH54TpaNwCFpZQql7M1sQthWxw73VknkLAFBWzM6dovrnGAhjRNJz66m61n003wWCYIYA';

// Cloudflare Turnstile — site key (public, safe in frontend).
// 1) Cloudflare Dashboard → Turnstile → Add widget → copy Site Key.
// 2) Supabase Dashboard → Authentication → Attack Protection → enable CAPTCHA → Provider: Turnstile → paste Secret Key (not the site key).
// 3) Set the site key via meta tag in account.html, or window.__MILLAD_TURNSTILE_SITE_KEY__, or keep the dev test key below.
const TURNSTILE_DEFAULT_SITE_KEY = '1x00000000000000000000AA'; // Cloudflare test key (always passes); replace for production

/**
 * Resolved at call time so account.html can set meta / window before modules run.
 * @returns {string}
 */
export function getTurnstileSiteKey() {
    if (typeof window !== 'undefined' && window.__MILLAD_TURNSTILE_SITE_KEY__) {
        const k = String(window.__MILLAD_TURNSTILE_SITE_KEY__).trim();
        if (k.length >= 20) return k;
    }
    if (typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="cf-turnstile-site-key"]');
        const c = meta?.getAttribute('content')?.trim();
        if (c && c.length >= 20) return c;
    }
    return TURNSTILE_DEFAULT_SITE_KEY;
}

/** @deprecated Prefer getTurnstileSiteKey() — value is fixed at first import in some bundles */
export const TURNSTILE_SITE_KEY = getTurnstileSiteKey();
