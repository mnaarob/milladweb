/**
 * Customer and admin sign-in.
 *
 * Wrong passwords share one ladder (email, browser, and IP):
 *   4 failures -> 10 minutes, next 4 -> 30 minutes, every further 4 -> 60.
 * The IP ladder starts at 12 failures. More than 20 requests from one
 * address in 10 minutes are rejected before the password is checked.
 *
 * Deploy (allow anonymous calls — no JWT):
 *   supabase functions deploy sign-in --no-verify-jwt
 *
 * Run database/migrations/migration-login-lockout.sql first.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getClientIp } from '../_shared/rate-limit.ts';

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRONG_PASSWORD = 'Sign in failed. Please check your email and password.';

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

function lockMessage(minutes: number): string {
    const n = Math.max(1, Math.ceil(minutes));
    return `Too many attempts. Try again in ${n} minute${n === 1 ? '' : 's'}.`;
}

function hostMatchesStore(host: string, domain: string | null): boolean {
    if (!domain) return false;
    const normalized = domain.toLowerCase();
    return host === normalized || host === `www.${normalized}` || `www.${host}` === normalized;
}

function isAllowedHost(host: string, domains: Array<string | null>): boolean {
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return domains.some((domain) => hostMatchesStore(host, domain));
}

async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isCredentialFailure(message: string): boolean {
    return /invalid login credentials|invalid credentials|email or password/i.test(message);
}

function isCaptchaFailure(message: string): boolean {
    return /captcha/i.test(message);
}

interface GuardDecision {
    allowed?: boolean;
    retry_minutes?: number;
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('Origin');

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders(origin) });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
        console.error('sign-in: missing Supabase env');
        return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let host = '';
    try {
        host = origin ? new URL(origin).hostname.toLowerCase() : '';
    } catch {
        host = '';
    }

    const { data: stores, error: storeErr } = await admin.from('stores').select('domain');
    if (storeErr || !stores || !isAllowedHost(host, stores.map((row) => row.domain ?? null))) {
        return json({ error: 'Origin not allowed' }, 403, origin);
    }

    const ip = getClientIp(req);
    const floodKey = `flood:${await sha256Hex(ip)}`;

    let body: {
        email?: unknown;
        password?: unknown;
        captchaToken?: unknown;
        deviceId?: unknown;
    };
    try {
        body = await req.json();
    } catch {
        const limited = await rejectFlood(admin, floodKey, origin);
        if (limited) return limited;
        return json({ error: WRONG_PASSWORD }, 400, origin);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken.trim() : '';
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';

    const shapeOk = EMAIL_RE.test(email)
        && email.length <= 254
        && password.length > 0
        && password.length <= 1024
        && DEVICE_RE.test(deviceId)
        && captchaToken.length <= 4096;

    if (!shapeOk) {
        const limited = await rejectFlood(admin, floodKey, origin);
        if (limited) return limited;
        return json({ error: WRONG_PASSWORD }, 400, origin);
    }

    const emailKey = `email:${await sha256Hex(email)}`;
    const deviceKey = `device:${await sha256Hex(deviceId)}`;
    const ipKey = `ip:${await sha256Hex(ip)}`;

    const { data: decisionRaw, error: beginErr } = await admin.rpc('login_guard_begin', {
        p_email_key: emailKey,
        p_device_key: deviceKey,
        p_ip_key: ipKey,
        p_flood_key: floodKey,
    });
    if (beginErr) {
        console.error('sign-in: login_guard_begin', beginErr.message);
        return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503, origin);
    }

    const decision = (typeof decisionRaw === 'string' ? JSON.parse(decisionRaw) : decisionRaw) as GuardDecision;
    if (!decision?.allowed) {
        const minutes = Number(decision?.retry_minutes) || 1;
        return json(
            { error: lockMessage(minutes) },
            429,
            origin,
            { 'Retry-After': String(minutes * 60) },
        );
    }

    if (!captchaToken) {
        return json({ error: 'Please complete the CAPTCHA verification.' }, 400, origin);
    }

    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
    });

    if (error || !data.session) {
        const message = error?.message ?? '';
        if (isCaptchaFailure(message)) {
            return json({ error: 'Please complete the CAPTCHA verification.' }, 400, origin);
        }
        if (isCredentialFailure(message) || !error) {
            const { data: failRaw, error: failErr } = await admin.rpc('login_guard_fail', {
                p_email_key: emailKey,
                p_device_key: deviceKey,
                p_ip_key: ipKey,
            });
            if (failErr) {
                console.error('sign-in: login_guard_fail', failErr.message);
            } else {
                const fail = (typeof failRaw === 'string' ? JSON.parse(failRaw) : failRaw) as GuardDecision & { locked?: boolean };
                if (fail?.locked) {
                    const minutes = Number(fail.retry_minutes) || 1;
                    return json(
                        { error: lockMessage(minutes) },
                        429,
                        origin,
                        { 'Retry-After': String(minutes * 60) },
                    );
                }
            }
        }
        return json({ error: WRONG_PASSWORD }, 401, origin);
    }

    const { error: clearErr } = await admin.rpc('login_guard_clear', {
        p_email_key: emailKey,
        p_device_key: deviceKey,
    });
    if (clearErr) console.error('sign-in: login_guard_clear', clearErr.message);

    return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: 'bearer',
    }, 200, origin);
});

async function rejectFlood(
    admin: ReturnType<typeof createClient>,
    floodKey: string,
    origin: string | null,
): Promise<Response | null> {
    const { data, error } = await admin.rpc('login_guard_note_request', { p_flood_key: floodKey });
    if (error) {
        console.error('sign-in: login_guard_note_request', error.message);
        return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503, origin);
    }
    const flood = (typeof data === 'string' ? JSON.parse(data) : data) as { limited?: boolean; retry_minutes?: number };
    if (!flood?.limited) return null;
    const minutes = Number(flood.retry_minutes) || 1;
    return json(
        { error: lockMessage(minutes) },
        429,
        origin,
        { 'Retry-After': String(minutes * 60) },
    );
}
