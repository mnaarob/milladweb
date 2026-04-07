# Deploy Millad’s site to Vercel (`milladssupermarket.com`)

**Hosting is Vercel only** (Firebase Hosting config was removed from this repo). See also **`docs/HOSTING.md`**.

This repo is a **static** site. **`npm run build`** runs `scripts/vercel-build.js`, which copies HTML, `css/`, `js/`, `img/`, `fonts/`, `images/`, `products.json`, etc. into **`dist/`**. Vercel’s **Output Directory** is **`dist`**.

> I can’t log into your Vercel account. Use the steps below on your machine or in the Vercel dashboard.

## Option A — Git (recommended if the project is on GitHub/GitLab/Bitbucket)

1. **Push this repo** to your Git host (if it isn’t already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. In **Vercel** → **Add New…** → **Project** → import that repository (or open the existing project linked to it).
3. **Project settings** (if anything looks wrong):
   - **Root Directory:** `.` (repository root)
   - **Framework Preset:** Other / no framework (should match `framework: null` in `vercel.json`)
   - **Build Command:** `npm run build` (default from `vercel.json`)
   - **Output Directory:** `dist` (same as `vercel.json`)
   - **Install Command:** `npm install` (optional; needed for any future Node tooling)
4. **Domains:** add **`milladssupermarket.com`** (and `www` if you use it) under **Project → Settings → Domains**. Point DNS as Vercel shows (usually A/CNAME to Vercel).
5. **Deploy:** every push to the production branch (e.g. `main`) triggers a deployment.

## Option B — Vercel CLI (no Git, or one-off deploy)

1. Install and log in:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. From the **milladweb** folder:
   ```bash
   vercel        # preview
   vercel --prod # production → uses milladssupermarket.com if already linked
   ```
3. First time, the CLI will ask to link the folder to a project; choose your existing project or create one, then attach **milladssupermarket.com** in the dashboard if needed.

## After deploy — check these

| Item | Why |
|------|-----|
| **Supabase Auth → URL Configuration** | Add **`https://milladssupermarket.com/account`** and **`https://www.milladssupermarket.com/account`** under **Redirect URLs** (you can keep `…/account.html` too for old links). Set **Site URL** to your canonical origin. |
| **`js/config/supabase.js`** | Uses your live Supabase URL/keys; no Vercel env vars required unless you change to a build-time inject later. |
| **`stores.domain`** | Should match the hostname customers use (`milladssupermarket.com`) for Edge Functions (e.g. password reset, place-order CORS). |
| **HTTPS** | Vercel provides SSL automatically once the domain is verified. |

## Troubleshooting

- **404 on pages:** Confirm **Output Directory** is **`dist`** and `npm run build` runs successfully (run it locally to verify `dist/index.html` exists).
- **Huge deploy / slow:** `.vercelignore` excludes `node_modules`; don’t remove that unless you need them on Vercel (you don’t for this static site).
- **Old content:** Hard refresh or **Purge** in Vercel **Deployments** if CDN caches an old asset.
