import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RateLimiter, getClientIp } from '../_shared/rate-limit.ts';

const orderLimiter = new RateLimiter({ windowMs: 5 * 60_000, max: 10 });

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

function corsHeaders(origin?: string | null): Record<string, string> {
    // Browsers require 2xx preflight + explicit Allow-Methods; missing function (404) breaks CORS entirely.
    const allowOrigin = origin?.trim() || '*';
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '86400',
    };
}

function isAllowedOrigin(origin: string | null, storeDomain: string | null): boolean {
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const host = url.hostname;
        if (storeDomain && (host === storeDomain || host === `www.${storeDomain}`)) return true;
        if (host.endsWith('.supabase.co')) return true;
        if (host === 'localhost' || host === '127.0.0.1') return true;
    } catch { /* invalid origin */ }
    return false;
}

const MAX_ITEMS = 50;
const TAX_GST = 0.05;
const TAX_PST = 0.07;

function roundMoney(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Same line math as frontend/js/modules/cart.js so estimated-weight items match the cart. */
function lineAmount(product: {
    price: number;
    variable_weight?: boolean;
    display_price?: string | null;
    estimated_max_weight?: number | null;
}, quantity: number): number {
    const price = Number(product.price) || 0;
    const qty = Number(quantity) || 0;
    if (product.variable_weight && product.display_price === 'estimated') {
        return price * (Number(product.estimated_max_weight) || 1) * qty;
    }
    return price * qty;
}

interface OrderItem {
    id: string;
    name: string;
    price: number;
    unit: string;
    quantity: number;
    category: string;
    notes?: string;
    variableWeight?: boolean;
    displayPrice?: string | null;
    estimatedMaxWeight?: number | null;
}

type DeliverySlot = '2pm' | '8pm';
const DELIVERY_SLOT_LABELS: Record<DeliverySlot, string> = { '2pm': '2:00 PM', '8pm': '8:00 PM' };

interface CustomerPayload {
    name: string;
    phone: string;
    email?: string;
    fulfillment: 'pickup' | 'delivery';
    delivery_address?: string;
    delivery_slot?: DeliverySlot;
}

interface OrderBody {
    store_id: string;
    customer: {
        name: string;
        phone: string;
        email?: string;
        fulfillment?: 'pickup' | 'delivery';
        delivery_address?: string;
        delivery_slot?: string;
    };
    items: OrderItem[];
    pricing: { subtotal: number; gst: number; pst: number; total: number };
    payment_method: string;
    payment_token?: string | null;
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('Origin');

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders(origin) });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const ip = getClientIp(req);
    const rateResult = orderLimiter.check(ip);
    if (!rateResult.allowed) {
        const retryAfter = Math.ceil(rateResult.retryAfterMs / 1000);
        return new Response(JSON.stringify({ error: 'Too many orders — please try again later' }), {
            status: 429,
            headers: {
                ...corsHeaders(origin),
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
            },
        });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } }
        );

        // ── Derive authenticated user from JWT (never trust body) ────
        let authenticatedUserId: string | null = null;
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) authenticatedUserId = user.id;
            } catch {
                // Token may be the anon/publishable key or an expired JWT — ignore
            }
        }

        const body: OrderBody = await req.json();
        const { store_id, items, pricing, payment_method, payment_token } = body;
        const rawCustomer = body.customer;

        // ── Validate store_id ────────────────────────────────────────
        if (!store_id) return json({ error: 'store_id is required' }, 400, origin);

        const { data: store, error: storeErr } = await supabase
            .from('stores')
            .select('id, name, domain')
            .eq('id', store_id)
            .maybeSingle();

        if (storeErr) {
            console.error('stores lookup error:', storeErr);
            return json({ error: `Store lookup failed: ${storeErr.message}` }, 400, origin);
        }
        if (!store) return json({ error: 'Invalid store' }, 400, origin);

        if (origin && !isAllowedOrigin(origin, store.domain)) {
            return json({ error: 'Origin not allowed' }, 403, origin);
        }

        // ── Validate & normalize customer (fulfillment, delivery) ────
        if (!rawCustomer?.name?.trim() || !rawCustomer?.phone?.trim()) {
            return json({ error: 'Name and phone are required' }, 400, origin);
        }
        const fulfillment = rawCustomer.fulfillment === 'delivery' ? 'delivery' : 'pickup';
        let delivery_address: string | undefined;
        let delivery_slot: DeliverySlot | undefined;
        if (fulfillment === 'delivery') {
            delivery_address = String(rawCustomer.delivery_address ?? '').trim();
            if (delivery_address.length < 5) {
                return json({
                    error: 'Please enter a complete delivery address (street, city, postal code).',
                }, 400, origin);
            }
            const rawSlot = String(rawCustomer.delivery_slot ?? '').trim();
            if (rawSlot === '2pm' || rawSlot === '8pm') {
                delivery_slot = rawSlot;
            } else if (rawSlot) {
                return json({ error: 'Please choose a delivery time (2:00 PM or 8:00 PM).' }, 400, origin);
            }
        }
        const customer: CustomerPayload = {
            name: rawCustomer.name.trim(),
            phone: rawCustomer.phone.trim(),
            ...(rawCustomer.email?.trim() && { email: rawCustomer.email.trim() }),
            fulfillment,
            ...(delivery_address && { delivery_address }),
            ...(delivery_slot && { delivery_slot }),
        };

        // ── Validate items ───────────────────────────────────────────
        if (!items || items.length === 0) return json({ error: 'Cart is empty' }, 400, origin);
        if (items.length > MAX_ITEMS) return json({ error: `Orders are limited to ${MAX_ITEMS} line items` }, 400, origin);

        // ── Validate every item belongs to this store AND fetch real prices
        const itemIds = [...new Set(items.map(i => i.id))];
        const { data: validProducts, error: prodErr } = await supabase
            .from('products')
            .select('id, price, name, tax_exempt, variable_weight, display_price, estimated_max_weight')
            .eq('store_id', store_id)
            .in('id', itemIds);

        if (prodErr) {
            console.error('products lookup error:', prodErr);
            return json({ error: `Product validation failed: ${prodErr.message}` }, 500, origin);
        }

        const productMap = new Map(
            (validProducts ?? []).map((p: {
                id: string;
                price: number;
                name: string;
                tax_exempt: boolean;
                variable_weight?: boolean;
                display_price?: string | null;
                estimated_max_weight?: number | null;
            }) => [p.id, p])
        );

        const missingIds = itemIds.filter(id => !productMap.has(id));
        if (missingIds.length > 0) return json({ error: 'One or more items do not belong to this store' }, 400, origin);

        // ── Recompute pricing server-side ─────────────────────────────
        let serverSubtotal = 0;
        let taxableSubtotal = 0;
        const verifiedItems = items.map(item => {
            const product = productMap.get(item.id)!;
            const lineTotal = lineAmount(product, item.quantity);
            serverSubtotal += lineTotal;
            if (!product.tax_exempt) taxableSubtotal += lineTotal;
            return {
                ...item,
                price: Number(product.price),
                name: product.name,
                variableWeight: !!product.variable_weight,
                displayPrice: product.display_price || null,
                estimatedMaxWeight: product.estimated_max_weight || null,
            };
        });

        serverSubtotal = roundMoney(serverSubtotal);
        taxableSubtotal = roundMoney(taxableSubtotal);
        const serverGst = roundMoney(taxableSubtotal * TAX_GST);
        const serverPst = roundMoney(taxableSubtotal * TAX_PST);
        const serverTotal = roundMoney(serverSubtotal + serverGst + serverPst);

        // Sanity-check client total (reject if tampered by more than $0.01)
        if (Math.abs(pricing.total - serverTotal) > 0.01) {
            return json({
                error: 'Order total mismatch — please refresh and try again',
                expected: serverTotal,
            }, 400, origin);
        }

        const serverPricing = { subtotal: serverSubtotal, gst: serverGst, pst: serverPst, total: serverTotal };

        // ── Insert order (DB trigger handles stock decrement) ────────
        const orderRow: Record<string, unknown> = {
            store_id,
            customer,
            items: verifiedItems,
            pricing: serverPricing,      // store server-computed pricing only
            payment_method,
            payment_token: payment_token ?? null,
            status: 'pending',
        };

        // user_id from JWT only — never from request body (Fix 2)
        if (authenticatedUserId) orderRow.user_id = authenticatedUserId;

        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert(orderRow)
            .select()
            .single();

        if (orderErr) {
            console.error('order insert error:', orderErr);
            return json({ error: `Order could not be saved: ${orderErr.message}` }, 500, origin);
        }

        // ── Send receipt via merchant's own Resend account ───────────
        const { data: secrets } = await supabase
            .from('store_secrets')
            .select('resend_api_key, from_email')
            .eq('store_id', store_id)
            .maybeSingle();

        const resendKey = secrets?.resend_api_key;
        const fromEmail = secrets?.from_email;
        const customerEmail = customer.email;

        if (resendKey && fromEmail && customerEmail) {
            sendOrderReceipt(resendKey, fromEmail, store.name, order, customer, verifiedItems, serverPricing).catch(
                err => console.error('Resend error:', err)
            );
        }

        return json({ success: true, order }, 200, origin);

    } catch (err: unknown) {
        let message = 'Unexpected error';
        if (err instanceof Error) {
            message = err.message;
        } else if (err && typeof err === 'object' && 'message' in err) {
            message = String((err as { message: unknown }).message);
        } else if (typeof err === 'string') {
            message = err;
        }
        console.error('place-order error:', message, err);
        return json({ error: message }, 500, origin);
    }
});

async function sendOrderReceipt(
    apiKey: string,
    fromEmail: string,
    storeName: string,
    order: { id: string },
    customer: CustomerPayload,
    items: OrderItem[],
    pricing: { subtotal: number; gst: number; pst: number; total: number }
) {
    const shortId = order.id.slice(-6).toUpperCase();
    const isDelivery = customer.fulfillment === 'delivery';
    const slotLabel = customer.delivery_slot ? DELIVERY_SLOT_LABELS[customer.delivery_slot] : '';
    const introLine = isDelivery
        ? `We will call you at <strong>${escHtml(customer.phone)}</strong> to confirm delivery and your order.${
            customer.delivery_address
                ? ` Delivery address: <strong>${escHtml(customer.delivery_address)}</strong>.`
                : ''
        }${
            slotLabel
                ? ` Delivery window: <strong>${escHtml(slotLabel)}</strong> (arrival can be about 20–30 minutes earlier or later).`
                : ''
        }`
        : `We will call you at <strong>${escHtml(customer.phone)}</strong> when it is ready for pickup.`;
    const footerTitle = isDelivery ? 'Delivery information' : 'Pickup information';
    const footerBody = isDelivery
        ? `${slotLabel ? `Your delivery window is ${escHtml(slotLabel)}. ` : ''}We will confirm the final total by phone (weights on fresh items may vary slightly).`
        : 'We will call you when your order is ready. Please bring this confirmation.';

    const itemRows = items.map(i => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333">
            ${escHtml(i.name)}${i.notes ? ` <span style="color:#888;font-size:12px">(${escHtml(i.notes)})</span>` : ''}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#555">${i.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#333">$${lineAmount({
                price: i.price,
                variable_weight: i.variableWeight,
                display_price: i.displayPrice,
                estimated_max_weight: i.estimatedMaxWeight,
            }, i.quantity).toFixed(2)}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:32px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);max-width:100%">

      <!-- Header -->
      <tr><td style="background:#2D6A4F;padding:28px 40px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">${escHtml(storeName)}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px">Order received</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 40px">
        <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:20px">Thank you, ${escHtml(customer.name)}!</h2>
        <p style="margin:0 0 24px;color:#555;font-size:15px">
          Your order <strong>#${shortId}</strong> has been received.
          ${introLine}
        </p>

        <!-- Items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          <thead>
            <tr style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">
              <th style="padding:0 0 8px;text-align:left;border-bottom:2px solid #eee">Item</th>
              <th style="padding:0 0 8px;text-align:center;border-bottom:2px solid #eee">Qty</th>
              <th style="padding:0 0 8px;text-align:right;border-bottom:2px solid #eee">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <!-- Totals -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;font-size:14px">
          <tr>
            <td style="padding:4px 0;color:#555">Subtotal</td>
            <td style="padding:4px 0;text-align:right;color:#555">$${pricing.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555">GST (5%)</td>
            <td style="padding:4px 0;text-align:right;color:#555">$${pricing.gst.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555">PST (7%)</td>
            <td style="padding:4px 0;text-align:right;color:#555">$${pricing.pst.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 0;color:#1a1a1a;font-weight:700;font-size:16px;border-top:2px solid #eee">Total</td>
            <td style="padding:10px 0 0;text-align:right;color:#2D6A4F;font-weight:700;font-size:16px;border-top:2px solid #eee">$${pricing.total.toFixed(2)}</td>
          </tr>
        </table>

        <!-- Fulfillment notice -->
        <div style="margin-top:28px;padding:16px 20px;background:#f0f7f4;border-radius:8px;border-left:4px solid #2D6A4F">
          <p style="margin:0;color:#2D6A4F;font-size:14px;font-weight:600">${footerTitle}</p>
          <p style="margin:6px 0 0;color:#555;font-size:13px">${footerBody}</p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee;text-align:center">
        <p style="margin:0;color:#aaa;font-size:12px">&copy; ${new Date().getFullYear()} ${escHtml(storeName)}</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: `${storeName} <${fromEmail}>`,
            to: [customer.email!],
            subject: `Your order #${shortId} has been received — ${storeName}`,
            html,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend API error ${res.status}: ${body}`);
    }
}

function escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json(data: unknown, status = 200, origin?: string | null): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
}
