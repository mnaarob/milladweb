import { supabase, STORE_ID, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

export async function signUp(email, password, metadata = {}, captchaToken = '') {
    const options = { data: metadata };
    if (captchaToken) options.captchaToken = captchaToken;
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options
    });
    if (error) throw error;
    return data;
}

export async function signIn(email, password, captchaToken = '') {
    const opts = { email, password };
    if (captchaToken) opts.options = { captchaToken };
    const { data, error } = await supabase.auth.signInWithPassword(opts);
    if (error) throw error;
    return data;
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
