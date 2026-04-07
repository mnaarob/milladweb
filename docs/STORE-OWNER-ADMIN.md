# Store owner: using your dashboard

You do **not** need to write code or use developer tools. Your website helper sets this up once; after that you only use a normal web link and your email/password.

## What you can do here

- See **new orders** and update their status  
- **Add or edit products** (prices, descriptions, in stock, **image link**)

### Product photos without the website folder on your computer

You can paste a **full image link** (`https://…`) from **Supabase Storage**, Cloudinary, or another host — see **`docs/ADMIN-IMAGES.md`**.

## How to sign in (after the site is live)

1. **Bookmark** the dashboard link your helper gives you.  
   It will look like: `https://yourstore.com/admin` (or `…/admin.html`, which redirects to `/admin`.)  
   (During setup on a dev machine it may be `http://localhost:3000/admin` — testing only.)

2. Open that link in **Chrome, Safari, or Edge** (not by opening a file from your computer).

3. Enter:
   - **Email** — the same one you used when you accepted the **invite email**  
   - **Password** — the one you chose when you created the account  

4. Click **Sign in**.

## If sign-in fails

- **Wrong email** — Use the exact email from the invite.  
- **Forgot password** — On the main website, open **My account** (`/account`) and use password reset, or ask your website helper.  
- **“We couldn’t open the store dashboard”** — Your account exists but isn’t linked to the store yet. Your helper must add you in Supabase (see `scripts/onboard-new-merchant.sql` — `store_admins` row for your user), or add you to `super_admins` for full platform access.

## For the person who maintains the site

- **Store owner / staff:** add them to `store_admins` for this store’s `store_id` (see `scripts/onboard-new-merchant.sql`). They can use **`/admin`** without being in `super_admins`.  
- **Platform operators only:** use `super_admins` for users who should access any store’s data via the same panel (optional).  
- More troubleshooting: `scripts/TROUBLESHOOTING-AUTH.md`
