import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });

const publicUrl = 'https://iyubmgzxypcanrbyuyck.supabase.co';
const publicAnonKey = 'sb_publishable_ZrDGLZ4Gkva4h5U-6ucPFw_wle3cJmd';

export const env = {
    port: Number(process.env.PORT || 4000),
    storeId: process.env.STORE_ID?.trim() || 'millads',
    clientOrigin: process.env.CLIENT_ORIGIN?.trim() || 'http://localhost:5173',
    supabaseUrl: process.env.SUPABASE_URL?.trim() || publicUrl,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || publicAnonKey,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '',
    storeNotifyEmail: process.env.STORE_NOTIFY_EMAIL?.trim() || 'milladssupermarket@gmail.com',
};
