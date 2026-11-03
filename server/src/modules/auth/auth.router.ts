import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { adminDb, hasServiceRole } from '../../lib/supabase.js';

const resetLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: 'Too many reset requests. Try again later.' },
});

export const authRouter = Router();

authRouter.post(
    '/auth/forgot-password',
    resetLimit,
    asyncHandler(async (req, res) => {
        const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
        const redirectTo = `${env.clientOrigin}/account`;
        const linkResult = hasServiceRole
            ? await adminDb.auth.admin.generateLink({
                type: 'recovery',
                email,
                options: { redirectTo },
            })
            : { data: null, error: new Error('no service role') };
        const { data: linkData, error: linkErr } = linkResult;

        const { data: secrets } = await adminDb
            .from('store_secrets')
            .select('resend_api_key, from_email')
            .eq('store_id', env.storeId)
            .maybeSingle();

        const actionLink = linkData?.properties?.action_link;
        if (!linkErr && actionLink && secrets?.resend_api_key && secrets.from_email) {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secrets.resend_api_key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: secrets.from_email,
                    to: [email],
                    subject: "Reset your password — Millad's Supermarket",
                    html: `<p>You requested a password reset for <strong>${email}</strong>.</p><p><a href="${actionLink}">Reset password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
                }),
            });
            if (!response.ok) throw new HttpError(502, 'Could not send email');
        } else {
            const { error } = await adminDb.auth.resetPasswordForEmail(email, { redirectTo });
            if (error && !/user not found/i.test(error.message)) {
                console.error('resetPasswordForEmail', error.message);
            }
        }
        res.json({ ok: true });
    }),
);
