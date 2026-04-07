# Product images without access to the website project folder

Store staff can **change product pictures from the dashboard** (`/admin`) by editing a product and filling in the **Image** field. They do **not** need the GitHub/Vercel project on their computer.

## Option A — Use a full image URL (recommended)

1. Put the photo on any **public** image host that gives you a direct **https://…** link, for example:
   - **Supabase Storage** (same project as the store): Dashboard → **Storage** → create a **public** bucket → **Upload** → copy the **public URL** for the file.
   - **Cloudinary**, **Imgur**, **your own CDN**, or another host your business already uses.
2. In **Store dashboard → Products → Edit**, paste that URL into **Image**.
3. Save. The shop loads that URL directly in the browser.

**Requirements:** The URL must be **public** (no login), start with `https://`, and the host should allow your site to **embed** images (some hosts block “hotlinking”).

## Option B — Paths that live on the website (developer deploy)

If the Image value looks like `meat/Beef.webp` or `images/meat/beef.jpg`, that file must **exist in the site’s `images/` folder** on the server. Only someone with **deploy access** (or Git) can add or replace those files, then redeploy to Vercel.

Use **Option A** when the admin should manage images alone.

## Option C — Emoji / no photo

Leave Image empty or use a short **fallback emoji** in the emoji field (e.g. 🥩). The storefront shows the emoji when there is no usable image URL.

## Site banners & static pages (not products)

Hero images on the homepage (`img/banner/…`) are part of the **static site files**, not the product editor. Updating those still requires **someone with repo/deploy access**, unless you later move them to hosted URLs and change the HTML (a developer task).

---

**Summary:** Admins without the project folder should use **hosted image URLs (https://…)** in the product **Image** field. See the hint under that field in the admin product form.
