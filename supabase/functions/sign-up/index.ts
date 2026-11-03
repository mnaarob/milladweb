/**
 * Creates an account only after a 6-digit code is emailed through Resend.
 *
 * Sends are capped per email, browser, and IP so a script cannot drain Resend.
 * Five wrong codes invalidate that code. Checking a code does not send mail.
 *
 * Deploy (allow anonymous calls — no JWT):
 *   supabase functions deploy sign-up --no-verify-jwt
 *
 * Run database/migrations/migration-signup-verification.sql first.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getClientIp } from '../_shared/rate-limit.ts';

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^\d{6}$/;

function corsHeaders(origin: string | null): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': origin ?? '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '86400',
    };
}

function json(body: unknown, status: number, origin: string | null, extra?: Record<string, string>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders(origin),
            'Content-Type': 'application/json',
            ...extra,
        },
    });
}

function waitMessage(minutes: number): string {
    const n = Math.max(1, Math.ceil(minutes));
    return `Too many verification emails. Try again in ${n} minute${n === 1 ? '' : 's'}.`;
}

function hostMatchesStore(host: string, domain: string | null): boolean {
    if (!domain) return false;
    const normalized = domain.toLowerCase();
    return host === normalized || host === `www.${normalized}` || `www.${host}` === normalized;
}

async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCode(email: string, code: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email}:${code}`));
    return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function newCode(): string {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return String(bytes[0] % 1000000).padStart(6, '0');
}

type StoreRow = { id: string; name: string | null; domain: string | null };

function storeForHost(stores: StoreRow[], host: string): StoreRow | null {
    if (host === 'localhost' || host === '127.0.0.1') {
        return stores.find((store) => store.id === 'millads') ?? stores[0] ?? null;
    }
    return stores.find((store) => hostMatchesStore(host, store.domain)) ?? null;
}

/** GoTrue already has the Turnstile secret. Only a normal rejected login means the captcha was accepted. */
async function captchaAccepted(anon: SupabaseClient, token: string): Promise<'ok' | 'captcha' | 'unavailable'> {
    try {
        const { error } = await anon.auth.signInWithPassword({
            email: 'signup-captcha-check@milladssupermarket.com',
            password: 'captcha-probe-does-not-authenticate',
            options: { captchaToken: token },
        });
        if (!error) return 'ok';
        if (/captcha/i.test(error.message)) return 'captcha';
        if (/invalid login credentials|invalid credentials|email not confirmed|user not found/i.test(error.message)) return 'ok';
        console.error('sign-up: captcha probe', error.message);
        return 'unavailable';
    } catch (err) {
        console.error('sign-up: captcha probe', err);
        return 'unavailable';
    }
}

function asDecision(raw: unknown): { allowed?: boolean; retry_minutes?: number } {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as { allowed?: boolean; retry_minutes?: number };
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
        console.error('sign-up: missing Supabase env');
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    let host = '';
    try {
        host = origin ? new URL(origin).hostname.toLowerCase() : '';
    } catch {
        host = '';
    }

    const { data: stores, error: storeErr } = await admin.from('stores').select('id, name, domain');
    const store = !storeErr && stores ? storeForHost(stores as StoreRow[], host) : null;
    if (!store) return json({ error: 'Origin not allowed' }, 403, origin);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Enter a valid email address.' }, 400, origin);
    }

    const action = body.action === 'verify' ? 'verify' : body.action === 'send' ? 'send' : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const ageConfirmed = body.ageConfirmed === true;

    if (!EMAIL_RE.test(email) || email.length > 254 || !DEVICE_RE.test(deviceId)) {
        return json({ error: 'Enter a valid email address.' }, 400, origin);
    }
    if (password.length < 6 || password.length > 1024 || name.length < 2 || name.length > 100 || !ageConfirmed) {
        return json({ error: 'Check your name, email, and password, and confirm you are at least 18.' }, 400, origin);
    }
    if (!action) return json({ error: 'Enter a valid email address.' }, 400, origin);

    const ip = getClientIp(req);
    const emailKey = `email:${await sha256Hex(email)}`;
    const deviceKey = `device:${await sha256Hex(deviceId)}`;
    const ipKey = `ip:${await sha256Hex(ip)}`;

    if (action === 'verify') {
        return verifyAccount({
            admin, anon, origin, email, password, name, code, emailKey, ipKey, serviceKey,
        });
    }

    if (!captchaToken || captchaToken.length > 4096) {
        return json({ error: 'Please complete the CAPTCHA verification.' }, 400, origin);
    }
    const captcha = await captchaAccepted(anon, captchaToken);
    if (captcha === 'captcha') {
        return json({ error: 'Please complete the CAPTCHA verification.' }, 400, origin);
    }
    if (captcha !== 'ok') {
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const { data: secrets } = await admin
        .from('store_secrets')
        .select('resend_api_key, from_email')
        .eq('store_id', store.id)
        .maybeSingle();
    if (!secrets?.resend_api_key || !secrets.from_email) {
        console.error('sign-up: missing Resend settings');
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const { data: decisionRaw, error: limitErr } = await admin.rpc('signup_prepare_send', {
        p_email_key: emailKey,
        p_device_key: deviceKey,
        p_ip_key: ipKey,
    });
    if (limitErr) {
        console.error('sign-up: signup_prepare_send', limitErr.message);
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }
    const decision = asDecision(decisionRaw);
    if (!decision?.allowed) {
        const minutes = Number(decision?.retry_minutes) || 1;
        return json({ error: waitMessage(minutes) }, 429, origin, { 'Retry-After': String(minutes * 60) });
    }

    const { data: taken, error: existsErr } = await admin.rpc('signup_email_exists', { p_email: email });
    if (existsErr) {
        console.error('sign-up: signup_email_exists', existsErr.message);
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }
    if (taken === true) {
        return json({ error: 'An account with this email already exists. Sign in instead.' }, 409, origin);
    }

    const verificationCode = newCode();
    const codeHash = await hashCode(email, verificationCode, serviceKey);
    const { error: putErr } = await admin.rpc('signup_put_code', {
        p_email_key: emailKey,
        p_code_hash: codeHash,
    });
    if (putErr) {
        console.error('sign-up: signup_put_code', putErr.message);
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const storeName = store.name ?? "Millad's Supermarket";
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secrets.resend_api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: secrets.from_email,
            to: [email],
            subject: `Your verification code — ${storeName}`,
            html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222">
<h2 style="margin:0 0 12px">Confirm your email</h2>
<p>Enter this code to create your ${escapeHtml(storeName)} account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${escapeHtml(verificationCode)}</p>
<p>The code expires in 15 minutes. If you did not try to create an account, you can ignore this email.</p>
</body></html>`,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error('sign-up: Resend error', res.status, errText);
        await admin.rpc('signup_delete_code', { p_email_key: emailKey });
        return json({ error: 'Could not send the verification email. Please try again.' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
});

async function verifyAccount(input: {
    admin: SupabaseClient;
    anon: SupabaseClient;
    origin: string | null;
    email: string;
    password: string;
    name: string;
    code: string;
    emailKey: string;
    ipKey: string;
    serviceKey: string;
}) {
    const { admin, anon, origin, email, password, name, code, emailKey, ipKey, serviceKey } = input;
    if (!CODE_RE.test(code)) {
        return json({ error: 'Enter the 6-digit code from your email.' }, 400, origin);
    }

    const floodKey = `flood:${ipKey.slice(3)}`;
    const { data: floodRaw, error: floodErr } = await admin.rpc('signup_prepare_verify', { p_flood_key: floodKey });
    if (floodErr) {
        console.error('sign-up: signup_prepare_verify', floodErr.message);
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }
    const flood = asDecision(floodRaw);
    if (!flood?.allowed) {
        const minutes = Number(flood?.retry_minutes) || 1;
        const n = Math.max(1, Math.ceil(minutes));
        return json(
            { error: `Too many attempts. Try again in ${n} minute${n === 1 ? '' : 's'}.` },
            429,
            origin,
            { 'Retry-After': String(minutes * 60) },
        );
    }

    const codeHash = await hashCode(email, code, serviceKey);
    const { data: checkRaw, error: checkErr } = await admin.rpc('signup_check_code', {
        p_email_key: emailKey,
        p_code_hash: codeHash,
    });
    if (checkErr) {
        console.error('sign-up: signup_check_code', checkErr.message);
        return json({ error: 'Account creation is temporarily unavailable. Please try again.' }, 503, origin);
    }
    const check = (typeof checkRaw === 'string' ? JSON.parse(checkRaw) : checkRaw) as { ok?: boolean; reason?: string };
    if (!check?.ok) {
        if (check?.reason === 'expired') {
            return json({ error: 'That code expired. Request a new one.' }, 400, origin);
        }
        if (check?.reason === 'locked') {
            return json({ error: 'Too many incorrect codes. Request a new one.' }, 400, origin);
        }
        return json({ error: 'That code is incorrect.' }, 400, origin);
    }

    const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, age_confirmed: true },
    });
    if (createErr) {
        if (/already|registered|exists/i.test(createErr.message)) {
            return json({ error: 'An account with this email already exists. Sign in instead.' }, 409, origin);
        }
        console.error('sign-up: createUser', createErr.message);
        return json({ error: 'Could not create the account. Please try again.' }, 500, origin);
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
        console.error('sign-up: generateLink', linkErr?.message ?? 'no token');
        return json({ ok: true, needsSignIn: true }, 200, origin);
    }

    const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
    });
    if (sessionErr || !sessionData.session) {
        console.error('sign-up: verifyOtp', sessionErr?.message ?? 'no session');
        return json({ ok: true, needsSignIn: true }, 200, origin);
    }

    return json({
        ok: true,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
    }, 200, origin);
}
