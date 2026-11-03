import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http.js';
import { adminDb } from '../lib/supabase.js';
import type { AuthedRequest } from './authenticate.js';

export async function requireStaff(req: Request, _res: Response, next: NextFunction) {
    try {
        const user = (req as AuthedRequest).user;
        if (!user) throw new HttpError(401, 'Sign in required');

        const { data: superRow } = await adminDb
            .from('super_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (superRow) {
            next();
            return;
        }

        const { data: storeRow, error } = await adminDb
            .from('store_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('store_id', env.storeId)
            .maybeSingle();
        if (error || !storeRow) throw new HttpError(403, 'Store staff only');
        next();
    } catch (err) {
        next(err);
    }
}
