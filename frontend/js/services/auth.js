import { supabase, STORE_ID, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

const DEVICE_KEY = 'millads_device_id';
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memoryDeviceId = '';

function getDeviceId() {
    try {
        const existing = localStorage.getItem(DEVICE_KEY);
        if (existing && DEVICE_RE.test(existing)) return existing;
        const id = crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, id);
        return id;
    } catch {
        if (!memoryDeviceId) memoryDeviceId = crypto.randomUUID();
        return memoryDeviceId;
    }
}

async function postSignup(action, fields) {
    let res;
    try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/sign-up`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            action,
            email: String(fields.email || '').trim(),
            password: fields.password,
            fullName: fields.fullName,
            captchaToken: fields.captchaToken || '',
            code: fields.code || '',
            ageConfirmed: true,
            deviceId: getDeviceId(),
            storeId: STORE_ID,
        }),
    });
    } catch {
        throw new Error('Could not reach the server. Please try again.');
    }

    let payload = {};
    try {
        payload = await res.json();
    } catch {
        /* non-JSON body */
    }

    if (!res.ok) {
        const msg = typeof payload.error === 'string' ? payload.error : 'Could not create the account. Please try again.';
        throw new Error(msg);
    }

    if (payload.access_token && payload.refresh_token) {
        const { error } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
        });
        if (error) throw error;
    }
    return payload;
}

/** Emails a 6-digit code. The server caps how often Resend is called. */
export async function requestSignupCode(email, password, fullName, captchaToken) {
    return postSignup('send', { email, password, fullName, captchaToken });
}

/** Creates the account after the emailed code matches, then signs in. */
export async function verifySignupCode(email, password, fullName, code) {
    return postSignup('verify', { email, password, fullName, code });
}

/**
 * Signs in through the `sign-in` edge function so a wrong password is counted
 * on the server (account and admin share the 10 / 30 / 60 minute ladder).
 * Deploy with: supabase functions deploy sign-in --no-verify-jwt
 */
export async function signIn(email, password, captchaToken = '') {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-in`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            email: String(email || '').trim(),
            password,
            captchaToken,
            deviceId: getDeviceId(),
        }),
    });

    let payload = {};
    try {
        payload = await res.json();
    } catch {
        /* non-JSON body */
    }

    if (!res.ok) {
        const msg = typeof payload.error === 'string'
            ? payload.error
            : 'Sign in failed. Please check your email and password.';
        throw new Error(msg);
    }

    const { error } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
    });
    if (error) throw error;
    return payload;
}

export async function updateUserMetadata(metadata) {
    const { data, error } = await supabase.auth.updateUser({ data: metadata });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/** Second callback arg is the Supabase auth event (e.g. PASSWORD_RECOVERY); existing callers may ignore it. */
export function onAuthChange(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user || null, event);
    });

    supabase.auth.getUser().then(({ data }) => {
        callback(data?.user || null, 'INITIAL_GET_USER');
    });
}

/**
 * True if the user may use the store admin panel (orders, products).
 * - Super admins (platform): `super_admins` table
 * - Store owner/staff: `store_admins` for this site's `STORE_ID` (see onboard-new-merchant.sql)
 */
export async function isAdmin(user) {
    if (!user) return false;

    const { data: superRow, error: superErr } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (!superErr && superRow) return true;

    const { data: storeRow, error: storeErr } = await supabase
        .from('store_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('store_id', STORE_ID)
        .maybeSingle();
    if (storeErr) return false;
    return !!storeRow;
}

export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
}

/**
 * Sends password reset email.
 * Prefers Edge Function `send-password-reset` (builds link via Admin API + sends HTML via Resend from `store_secrets`).
 * Falls back to Supabase Auth mailer if the function is missing (404) or Resend is not configured (503).
 * Add `https://…/account` (and legacy `…/account.html` if you like) to Supabase → Auth → Redirect URLs.
 */
export async function resetPasswordForEmail(email) {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const trimmed = email.trim();

    let res;
    try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
                email: trimmed,
                store_id: STORE_ID,
                redirect_to: redirectTo,
            }),
        });
    } catch {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
        if (error) throw error;
        return;
    }

    let payload = {};
    try {
        payload = await res.json();
    } catch {
        /* non-JSON body */
    }

    if (res.ok) return;

    if (res.status === 503 || res.status === 404) {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
        if (error) throw error;
        return;
    }

    const msg = typeof payload.error === 'string' ? payload.error : 'Failed to send reset email';
    throw new Error(msg);
}

export async function updateUserPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}
