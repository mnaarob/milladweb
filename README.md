# Millad's Supermarket — storefront

Static site (HTML/CSS/JS) with **Supabase** (auth, catalog, orders).

## Hosting

**Production:** **Vercel** only → [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) and [`docs/HOSTING.md`](docs/HOSTING.md).

```bash
npm install
npm run serve    # local: http://localhost:3000 (serve.json maps /shop → shop.html, etc.)
npm run build    # output in dist/ (used by Vercel)
```

Clean URLs (`/`, `/shop`, `/account`, `/admin`) match production on **Vercel**; **`serve.json`** helps **`npm run serve`** behave the same locally.

## Legacy / unused

- **`public/`** — older copies; the live pages are **`index.html`**, **`shop.html`**, etc. at the repo root.
- **Firebase Hosting** — not configured in this repo; use Vercel for `milladssupermarket.com`.
