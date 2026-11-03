import type { NextFunction, Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { adminDb } from '../lib/supabase.js';
import { HttpError } from '../lib/http.js';

export type AuthedRequest = Request & { user: User; accessToken: string };

export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
    const header = req.header('authorization');
    if (!header?.toLowerCase().startsWith('bearer ')) {
        next();
        return;
    }
    const token = header.slice(7).trim();
    const { data, error } = await adminDb.auth.getUser(token);
    if (!error && data.user) {
        (req as AuthedRequest).user = data.user;
        (req as AuthedRequest).accessToken = token;
    }
    next();
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
    try {
        const header = req.header('authorization');
        if (!header?.toLowerCase().startsWith('bearer ')) throw new HttpError(401, 'Sign in required');
        const token = header.slice(7).trim();
        const { data, error } = await adminDb.auth.getUser(token);
        if (error || !data.user) throw new HttpError(401, 'Sign in required');
        (req as AuthedRequest).user = data.user;
        (req as AuthedRequest).accessToken = token;
        next();
    } catch (err) {
        next(err);
    }
}
