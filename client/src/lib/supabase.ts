import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://iyubmgzxypcanrbyuyck.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZrDGLZ4Gkva4h5U-6ucPFw_wle3cJmd';

export const supabase = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
});

const DEVICE_KEY = 'millads_device_id';
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memoryDeviceId = '';

function getDeviceId(): string {
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

/** Account and admin sign-in. The edge function owns the 10 / 30 / 60 minute ladder. */
export async function signInWithGuard(email: string, password: string, captchaToken: string) {
    const res = await fetch(`${url}/functions/v1/sign-in`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
        },
        body: JSON.stringify({
            email: email.trim(),
            password,
            captchaToken,
            deviceId: getDeviceId(),
        }),
    });

    let payload: { error?: string; access_token?: string; refresh_token?: string } = {};
    try {
        payload = await res.json();
    } catch {
        /* non-JSON body */
    }

    if (!res.ok) {
        throw new Error(payload.error || 'Sign in failed. Please check your email and password.');
    }

    const { error } = await supabase.auth.setSession({
        access_token: payload.access_token ?? '',
        refresh_token: payload.refresh_token ?? '',
    });
    if (error) throw error;
}

type SignupPayload = {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    needsSignIn?: boolean;
};

async function postSignup(action: 'send' | 'verify', fields: {
    email: string;
    password: string;
    fullName: string;
    captchaToken?: string;
    code?: string;
}): Promise<SignupPayload> {
    let res: Response;
    try {
        res = await fetch(`${url}/functions/v1/sign-up`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${anonKey}`,
                apikey: anonKey,
            },
            body: JSON.stringify({
                action,
                email: fields.email.trim(),
                password: fields.password,
                fullName: fields.fullName,
                captchaToken: fields.captchaToken ?? '',
                code: fields.code ?? '',
                ageConfirmed: true,
                deviceId: getDeviceId(),
            }),
        });
    } catch {
        throw new Error('Could not reach the server. Please try again.');
    }

    let payload: SignupPayload = {};
    try {
        payload = await res.json();
    } catch {
        /* non-JSON body */
    }

    if (!res.ok) {
        throw new Error(payload.error || 'Could not create the account. Please try again.');
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

/** Emails a 6-digit code. The server caps how often that mail can be sent. */
export function requestSignupCode(email: string, password: string, fullName: string, captchaToken: string) {
    return postSignup('send', { email, password, fullName, captchaToken });
}

/** Creates the account after the emailed code matches, then signs in. */
export function verifySignupCode(email: string, password: string, fullName: string, code: string) {
    return postSignup('verify', { email, password, fullName, code });
}
