# Staff TOTP MFA — TTS Dashboard Integration

Add these steps to the Tech to Store inventory dashboard login flow.
No edge function needed — Supabase handles TOTP natively.

## 1. Enable MFA in Supabase Dashboard

Settings → Authentication → Multi-Factor Authentication → Enable TOTP

## 2. Login flow (add to TTS dashboard JS)

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(TTS_URL, TTS_ANON_KEY);

// STEP 1: Normal password login
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check if MFA is required
    if (data.session) {
        // No MFA enrolled — log in normally
        return { status: 'logged_in', session: data.session };
    }

    // MFA required — get available factors
    const { data: mfa } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfa.nextLevel === 'aal2') {
        return { status: 'mfa_required' };
    }

    return { status: 'logged_in' };
}

// STEP 2: MFA challenge (after password login if MFA is enrolled)
async function completeMfaLogin(totpCode) {
    // Get the enrolled factor
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors.totp[0];
    if (!totp) throw new Error('No TOTP factor enrolled');

    // Create and verify the challenge
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
    const { data, error } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: totpCode,
    });
    if (error) throw error;
    return data;
}
```

## 3. MFA enrollment (first-time setup for staff)

Show this flow after first login if the user has no TOTP factor:

```js
async function enrollTotp() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) throw error;

    // data.totp.qr_code — display as <img src="{qr_code}"> for Google Authenticator
    // data.totp.uri     — or show as text for manual entry
    // data.id           — factor ID needed for verification

    return data;
}

async function verifyTotpEnrollment(factorId, code) {
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
    });
    if (error) throw error;
    // MFA is now active for this account
}
```

## 4. Supabase Dashboard setting

To **require** MFA for all store admins (enforce it, not just offer it):
- Authentication → Policies → set "Require verified factors for authenticated users"
- Or enforce in your RLS using: `auth.jwt() ->> 'aal' = 'aal2'`
