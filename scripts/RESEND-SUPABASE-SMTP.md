# Resend + Supabase — Auth emails (password reset, signup, etc.)

## Recommended: password reset via Edge Function + Resend (working link every time)

The storefront **Forgot password** flow calls the Edge Function **`send-password-reset`**, which:

1. Uses **`auth.admin.generateLink`** (`type: 'recovery'`) to build the real Supabase verify URL  
2. Sends **HTML email through the Resend API** (same credentials as order receipts: **`store_secrets`**)

You do **not** depend on the Supabase “Reset password” email template for this path — the message always includes a proper `<a href="…">` and a copy-paste URL.

### Setup

1. **`store_secrets`** for your store (`millads`) must have **`resend_api_key`** and **`from_email`** (verified domain in Resend).  
2. **`stores.domain`** must match the site customers use (e.g. `milladssupermarket.com`) so the function can validate the browser **Origin**.  
3. **Auth → URL Configuration → Redirect URLs** must include your account page, e.g. `https://www.milladssupermarket.com/account` (clean URL; add `…/account.html` too if you keep legacy redirects).  
4. Deploy the function and **disable JWT verification** for it (anonymous “forgot password”):

```bash
supabase functions deploy send-password-reset --no-verify-jwt
```

In the Dashboard: **Edge Functions → send-password-reset →** turn off “Enforce JWT verification” if you deploy from the UI.

If the function is missing (404) or Resend is not configured (503), the app **falls back** to `supabase.auth.resetPasswordForEmail` (Supabase SMTP / template).

---

## Alternative: Supabase Custom SMTP (all auth emails through Resabase dashboard)

Supabase can send **password reset** and other auth emails through **Custom SMTP** (Resend) configured in the Supabase Dashboard.

> **Note:** With SMTP, the **Reset password** template must still include `{{ .ConfirmationURL }}` or the body will have no link. The Edge Function path above avoids that problem for resets.

You can use the **same** Resend API key in **SMTP** and in **`store_secrets`** if you like.

## 1. Prepare Resend

1. [Verify your domain](https://resend.com/domains) in Resend (e.g. `milladssupermarket.com`) and add the DNS records Resend shows (SPF/DKIM). This improves inbox placement and working links.
2. Create an [API key](https://resend.com/api-keys) (or use an existing one).

## 2. SMTP values for Supabase

From [Resend SMTP docs](https://resend.com/docs/send-with-supabase-smtp):

| Field | Value |
|--------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | Your Resend **API key** (not your Resend login password) |

## 3. Enable in Supabase

1. Open your project → **Authentication**.
2. Under **Notifications** (or **Emails**), open **SMTP** / **SMTP Settings** (wording varies slightly by dashboard version).
3. Turn **custom SMTP** on if there is a toggle.
4. Enter the host, port, username, and password above.
5. **Sender email** must be an address on a domain you verified in Resend, e.g. `noreply@milladssupermarket.com`.
6. **Sender name** e.g. `Millad's Supermarket`.
7. Save.

After saving, trigger a test **Forgot password** from your site; the message should come **from Resend** (check headers / Resend dashboard logs).

## 4. Reset email must include the real link

Resend only delivers what Supabase puts in the template. The **Reset password** template must include `{{ .ConfirmationURL }}`.

**Supabase → Authentication → Email Templates → Reset password** — use HTML like:

```html
<h2>Reset your password</h2>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p style="font-size:12px;word-break:break-all;">{{ .ConfirmationURL }}</p>
```

See also **`TROUBLESHOOTING-AUTH.md` §5** for a styled version.

## 5. Redirect URL allow list

**Authentication → URL Configuration:**

- **Site URL** — your main site origin (e.g. `https://milladssupermarket.com`).
- **Redirect URLs** — include every URL users land on after clicking the email link, e.g.  
  `https://milladssupermarket.com/account` and `https://www.milladssupermarket.com/account`  
  (and `http://localhost:3000/account` for local testing).

The app passes `redirectTo` as the current page path (e.g. `/account`); that full URL must be allowed here.

## Optional: same key for order receipts

If you use **Tech to Store** / `store_secrets` for Resend, you can store the **same** API key there so receipts and auth both use one Resend account — still two **places** to configure (Supabase SMTP + your secrets / dashboard).
