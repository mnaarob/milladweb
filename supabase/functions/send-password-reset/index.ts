/**
 * Sends password reset email via Resend with an explicit recovery link from
 * auth.admin.generateLink — avoids Supabase mailer templates that omit {{ .ConfirmationURL }}.
 *
 * Deploy (allow anonymous calls — no JWT):
 *   supabase functions deploy send-password-reset --no-verify-jwt
 *
 * Requires store_secrets.resend_api_key + from_email for the given store_id.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RateLimiter, getClientIp } from '../_shared/rate-limit.ts';

const resetLimiter = new RateLimiter({ windowMs: 60 * 60_000, max: 5 });

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

function corsHeaders(origin: string | null): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': origin ?? '*',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    };
}

function json(body: unknown, status: number, origin: string | null) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders(origin),
            'Content-Type': 'application/json',
        },
    });
}

function isAllowedOriginForStore(origin: string | null, storeDomain: string | null): boolean {
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const host = url.hostname;
        if (storeDomain && (host === storeDomain || host === `www.${storeDomain}`)) return true;
        if (host === 'localhost' || host === '127.0.0.1') return true;
    } catch {
        /* invalid */
    }
    return false;
}

/** redirect_to must match the browser origin (same host as Origin header). */
function redirectMatchesOrigin(redirectTo: string, origin: string | null): boolean {
    if (!origin) return false;
    try {
        const r = new URL(redirectTo);
        const o = new URL(origin);
        return r.hostname === o.hostname;
    } catch {
        return false;
    }
}

function toAbsoluteActionLink(actionLink: string, supabaseUrl: string): string {
    if (!actionLink) return actionLink;
    if (actionLink.startsWith('http://') || actionLink.startsWith('https://')) return actionLink;
    const base = supabaseUrl.replace(/\/$/, '');
    const path = actionLink.startsWith('/') ? actionLink : `/${actionLink}`;
    return `${base}${path}`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hrefEscape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('Origin');

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders(origin) });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const ip = getClientIp(req);
    const rateResult = resetLimiter.check(ip);
    if (!rateResult.allowed) {
        const retryAfter = Math.ceil(rateResult.retryAfterMs / 1000);
        return new Response(JSON.stringify({ error: 'Too many reset requests — try again later' }), {
            status: 429,
            headers: {
                ...corsHeaders(origin),
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
            },
        });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

        const body = (await req.json()) as {
            email?: string;
            store_id?: string;
            redirect_to?: string;
        };

        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const store_id = typeof body.store_id === 'string' ? body.store_id.trim() : '';
        const redirect_to =
            typeof body.redirect_to === 'string' ? body.redirect_to.trim() : '';

        if (!email || !EMAIL_RE.test(email)) {
            return json({ error: 'Invalid email' }, 400, origin);
        }
        if (!store_id) return json({ error: 'store_id is required' }, 400, origin);
        if (!redirect_to) return json({ error: 'redirect_to is required' }, 400, origin);

        const { data: store, error: storeErr } = await adminClient
            .from('stores')
            .select('id, name, domain')
            .eq('id', store_id)
            .maybeSingle();

        if (storeErr || !store) return json({ error: 'Invalid store' }, 400, origin);

        if (!origin || !isAllowedOriginForStore(origin, store.domain)) {
            return json({ error: 'Origin not allowed' }, 403, origin);
        }

        if (!redirectMatchesOrigin(redirect_to, origin)) {
            return json({ error: 'redirect_to must match site origin' }, 400, origin);
        }

        const { data: secrets } = await adminClient
            .from('store_secrets')
            .select('resend_api_key, from_email')
            .eq('store_id', store_id)
            .maybeSingle();

        const resendKey = secrets?.resend_api_key;
        const fromEmail = secrets?.from_email;

        if (!resendKey || !fromEmail) {
            console.error('send-password-reset: missing store_secrets resend_api_key or from_email');
            return json({ error: 'Email is not configured for this store' }, 503, origin);
        }

        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: { redirectTo: redirect_to },
        });

        if (linkErr || !linkData?.properties?.action_link) {
            // Do not reveal whether the account exists
            console.warn('send-password-reset: generateLink skipped or failed:', linkErr?.message ?? 'no link');
            return json({ ok: true }, 200, origin);
        }

        const rawLink = linkData.properties.action_link;
        const resetUrl = toAbsoluteActionLink(rawLink, supabaseUrl);
        const safeHref = hrefEscape(resetUrl);
        const storeName = store.name ?? 'Millad\'s Supermarket';

        const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222">
<h2 style="margin:0 0 12px">Reset your password</h2>
<p>You requested a password reset for <strong>${escapeHtml(email)}</strong>.</p>
<p><a href="${safeHref}" style="display:inline-block;padding:12px 20px;background:#2D6A4F;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a></p>
<p style="font-size:13px;color:#555">If the button does not work, copy and paste this link into your browser:</p>
<p style="font-size:12px;word-break:break-all;color:#333">${escapeHtml(resetUrl)}</p>
<p style="font-size:12px;color:#888">— ${escapeHtml(storeName)}</p>
</body></html>`;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromEmail,
                to: [email],
                subject: `Reset your password — ${storeName}`,
                html,
            }),
        });

        if (!res.res.ok) {
            const errText = await res.text();
            console.error('Resend error:', res.status, errText);
            return json({ error: 'Could not send email' }, 502, origin);
        }

        return json({ ok: true }, 200, origin);
    } catch (e) {
        console.error('send-password-reset:', e);
        return json({ error: 'Unexpected error' }, 500, origin);
    }
});
