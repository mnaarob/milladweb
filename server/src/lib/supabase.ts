import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const hasServiceRole = Boolean(env.supabaseServiceRoleKey);

export const adminDb: SupabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey || env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

export function userDb(accessToken: string): SupabaseClient {
    return createClient(env.supabaseUrl, env.supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
