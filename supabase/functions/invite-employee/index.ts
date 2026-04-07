import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RateLimiter, getClientIp } from '../_shared/rate-limit.ts';

const inviteLimiter = new RateLimiter({ windowMs: 15 * 60_000, max: 5 });

// Restrict to TTS dashboard origin only — this is a privileged admin operation
const ttsDashboardUrl = Deno.env.get('TTS_DASHBOARD_URL') ?? 'https://app.techtostore.com';

const corsHeaders = {
    'Access-Control-Allow-Origin': ttsDashboardUrl,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['owner', 'manager', 'staff'] as const;
type StoreRole = typeof VALID_ROLES[number];

// Called by the TTS inventory dashboard when a store owner adds a team member.
// Requires the caller to be authenticated as a store admin or super admin.
//
// Body: { email: string, role: 'owner' | 'manager' | 'staff', store_id: string }
// Returns: { success: true } or { error: string }

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const ip = getClientIp(req);
    const rateResult = inviteLimiter.check(ip);
    if (!rateResult.allowed) {
        const retryAfter = Math.ceil(rateResult.retryAfterMs / 1000);
        return new Response(JSON.stringify({ error: 'Too many invite requests — please try again later' }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
            },
        });
    }

    try {
        // Verify the calling user is authenticated
        const callerClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            {
                global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
                auth: { persistSession: false },
            }
        );

        const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
        if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

        const body = await req.json();
        const { email, role = 'staff', store_id } = body;

        if (!email || !store_id) return json({ error: 'email and store_id are required' }, 400);
        if (!VALID_ROLES.includes(role as StoreRole)) {
            return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);
        }

        // Service role client for admin operations
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } }
        );

        // Verify the caller is an admin of this store (or a super admin)
        const { data: callerAdmin } = await adminClient
            .from('store_admins')
            .select('role')
            .eq('user_id', caller.id)
            .eq('store_id', store_id)
            .maybeSingle();

        const { data: superAdmin } = await adminClient
            .from('super_admins')
            .select('user_id')
            .eq('user_id', caller.id)
            .maybeSingle();

        if (!callerAdmin && !superAdmin) {
            return json({ error: 'You do not have permission to invite to this store' }, 403);
        }

        // Get store name for the invite email
        const { data: store } = await adminClient
            .from('stores')
            .select('name')
            .eq('id', store_id)
            .maybeSingle();

        const storeName = store?.name ?? 'the store';

        // Send Supabase invite — emails the user a set-password link
        const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
            email,
            {
                redirectTo: `${ttsDashboardUrl}/login`,
                data: {
                    invited_to_store: store_id,
                    invited_to_store_name: storeName,
                    invited_role: role,
                },
            }
        );

        if (inviteErr) {
            // If user already exists, continue to upsert store_admins row
            if (!inviteErr.message.includes('already been registered')) throw inviteErr;
        }

        // Find the user ID — use targeted lookup instead of listing all users
        const invitedUserId = invited?.user?.id ?? await findUserIdByEmail(adminClient, email);

        if (invitedUserId) {
            const { error: admErr } = await adminClient
                .from('store_admins')
                .upsert(
                    { user_id: invitedUserId, store_id, role },
                    { onConflict: 'user_id,store_id' }
                );
            if (admErr) throw admErr;
        }

        return json({ success: true, message: `Invite sent to ${email}` });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        console.error('invite-employee error:', message);
        return json({ error: message }, 500);
    }
});

// Targeted email lookup — avoids fetching all users (previous impl used listUsers())
async function findUserIdByEmail(
    client: ReturnType<typeof createClient>,
    email: string
): Promise<string | null> {
    const { data, error } = await client.auth.admin.getUserByEmail(email);
    if (error || !data?.user) return null;
    return data.user.id;
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
