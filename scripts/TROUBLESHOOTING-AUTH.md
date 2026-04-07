# Fix: Admin Login Issues (Supabase Auth)

## Common Issues

### 1. Opening admin.html via file://

Supabase Auth will not work from `file://` URLs. Serve the site over HTTP:

```bash
npm run serve
```

Then open: **http://localhost:3000/admin.html**

### 2. User not allowed to open the store dashboard

The admin panel (`admin.html`) allows users who are either:

- In **`store_admins`** for this site’s store (recommended for the store owner — use `scripts/onboard-new-merchant.sql`), or  
- In **`super_admins`** (platform / legacy full access).

After the user exists in **Authentication → Users**:

1. Copy their UUID from the Users table  
2. Ensure a row exists in **`store_admins`** with `user_id` = that UUID and `store_id` = your store slug (e.g. `millads`), **or** add them to **`super_admins`**.

See also **`docs/STORE-OWNER-ADMIN.md`** for plain-language instructions you can share with the owner.

### 3. RLS blocking access

If you get permission errors, verify:

1. The `is_admin()` function exists (check SQL Editor)
2. The `admin_users` table has the correct user_id
3. RLS policies are applied (run the schema SQL if not)

### 4. Supabase project URL or key is wrong

Check `js/config/supabase.js` and verify:
- `SUPABASE_URL` matches your project URL
- `SUPABASE_ANON_KEY` matches your publishable key

You can find these in: Supabase Dashboard > Settings > API

### 5. Password reset email has no clickable link

**If the email is in Spam (e.g. Gmail)**  
Gmail often **removes or disables links** on messages it thinks are phishing. You may only see plain text like “Reset Password”. Fix deliverability first:

1. Move the message to **Inbox** and use **“Looks safe”** if Gmail offers it — the link may work after that.  
2. Long term: set up **SPF**, **DKIM**, and **DMARC** for `milladssupermarket.com` in your DNS (Amazon SES + your domain host). Warm up the domain and avoid spammy wording.  
3. Ask recipients to **add the from-address to contacts** and mark “Not spam”.

**If the template never had a real URL**  
Supabase only inserts the reset link when the **Reset password** template includes `{{ .ConfirmationURL }}` inside an anchor (or you paste the URL as text).

1. Open **Supabase Dashboard → Authentication → Email Templates → Reset password**.  
2. Set the body to something like (HTML):

```html
<h2>Reset your password</h2>
<p>Click the button below to choose a new password for your Millad's Supermarket account.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#2D6A4F;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
<p style="font-size:13px;color:#666;">If the button doesn’t work, copy and paste this link into your browser:</p>
<p style="font-size:12px;word-break:break-all;">{{ .ConfirmationURL }}</p>
```

3. Under **Authentication → URL Configuration**, add **Redirect URLs** for your account page, e.g. `https://www.yourdomain.com/account` (clean URL) and optionally `…/account.html` for old links.

The plain URL line helps when a mail client strips the button link but still shows text.

### 6. Using Resend for Supabase Auth (password reset, confirmations)

Auth emails are sent by **Supabase**, not by your storefront JS. To send them through **Resend**:

1. In **Supabase → Authentication → SMTP Settings** (under Email / Notifications), enable custom SMTP.  
2. Use Resend’s SMTP: host **`smtp.resend.com`**, port **`465`**, username **`resend`**, password = your **Resend API key**.  
3. Set **sender email** to an address on a domain **verified in Resend** (e.g. `noreply@milladssupermarket.com`).  

This is separate from **`store_secrets.resend_api_key`** (used by Edge Functions for order emails); you can use the same Resend API key in both places.

Full checklist: **`scripts/RESEND-SUPABASE-SMTP.md`**.
