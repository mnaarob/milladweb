import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http.js';
import { adminDb, hasServiceRole } from '../../lib/supabase.js';
import { orderAlertHtml, orderReceiptHtml } from './receipt.js';

const GST = 0.05;
const PST = 0.07;
const DELIVERY_FEE = 5.99;
const FREE_DELIVERY_AT = 200;
const MAX_ITEMS = 50;

function isStorePhone(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('+1')) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1');
}

const orderSchema = z.object({
    ageConfirmed: z.literal(true, { errorMap: () => ({ message: 'You must be at least 18 years old to place an order.' }) }),
    customer: z.object({
        name: z.string().trim().min(2, 'Enter your name.'),
        phone: z.string().trim().refine(isStorePhone, 'Phone number must start with +1 and include 10 digits.'),
        email: z.string().trim().min(1, 'Enter an email address.').email('Enter an email address.'),
        fulfillment: z.enum(['pickup', 'delivery']),
        deliveryAddress: z.string().optional(),
        deliverySlot: z.enum(['2pm', '8pm']).optional(),
    }).superRefine((customer, ctx) => {
        if (customer.fulfillment === 'delivery' && (customer.deliveryAddress?.trim().length ?? 0) < 5) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Enter a delivery address with the street, Winnipeg, and postal code.',
                path: ['deliveryAddress'],
            });
        }
    }),
    items: z.array(z.object({
        id: z.string().min(1),
        quantity: z.number().positive().max(99),
        notes: z.string().optional(),
    })).min(1).max(MAX_ITEMS),
    pricing: z.object({ total: z.number() }),
});

export type OrderInput = z.infer<typeof orderSchema>;

export function parseOrder(body: unknown) {
    return orderSchema.parse(body);
}

function acceptedQuantity(unit: string, quantity: number) {
    if (/\bkg\b/i.test(unit)) {
        const steps = Math.round(quantity * 2);
        if (Math.abs(quantity * 2 - steps) > 0.001 || steps < 2 || steps > 198) {
            throw new HttpError(400, 'Choose a weight of at least 1 kg, in 0.5 kg steps.');
        }
        return steps / 2;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new HttpError(400, 'Choose a whole number of items.');
    }
    return quantity;
}

export async function placeOrder(input: OrderInput, userId: string | null) {
    if (!hasServiceRole) throw new HttpError(503, 'Add SUPABASE_SERVICE_ROLE_KEY before taking orders.');
    const { data: store, error: storeErr } = await adminDb
        .from('stores')
        .select('id, name')
        .eq('id', env.storeId)
        .maybeSingle();
    if (storeErr || !store) throw new HttpError(400, 'Invalid store');

    const fulfillment = input.customer.fulfillment;
    const deliveryAddress = input.customer.deliveryAddress?.trim();
    const deliverySlot = input.customer.deliverySlot;
    if (fulfillment === 'delivery' && (!deliveryAddress || deliveryAddress.length < 5)) {
        throw new HttpError(400, 'Please enter a complete delivery address (street, city, postal code).');
    }
    if (fulfillment === 'delivery' && !deliverySlot) {
        throw new HttpError(400, 'Choose a delivery time.');
    }

    const ids = [...new Set(input.items.map((item) => item.id))];
    const { data: products, error: prodErr } = await adminDb
        .from('products')
        .select('id, price, name, tax_exempt, unit')
        .eq('store_id', env.storeId)
        .in('id', ids);
    if (prodErr) throw new HttpError(500, prodErr.message);

    const productMap = new Map((products ?? []).map((product) => [String(product.id), product]));
    if (ids.some((id) => !productMap.has(id))) throw new HttpError(400, 'One or more items do not belong to this store');

    let subtotal = 0;
    let taxable = 0;
    const verified = input.items.map((item) => {
        const product = productMap.get(item.id)!;
        const price = Number(product.price);
        const quantity = acceptedQuantity(String(product.unit ?? ''), item.quantity);
        const line = price * quantity;
        subtotal += line;
        if (!product.tax_exempt) taxable += line;
        return {
            id: item.id,
            name: String(product.name),
            price,
            quantity,
            unit: String(product.unit ?? ''),
            notes: item.notes?.trim() || '',
        };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    taxable = Math.round(taxable * 100) / 100;
    const gst = Math.round(taxable * GST * 100) / 100;
    const pst = Math.round(taxable * PST * 100) / 100;
    const deliveryFee = fulfillment === 'delivery' && subtotal < FREE_DELIVERY_AT ? DELIVERY_FEE : 0;
    const total = Math.round((subtotal + gst + pst + deliveryFee) * 100) / 100;
    if (Math.abs(input.pricing.total - total) > 0.01) {
        throw new HttpError(400, 'Order total mismatch — please refresh and try again');
    }

    const customer = {
        name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email,
        fulfillment,
        ...(deliveryAddress ? { delivery_address: deliveryAddress } : {}),
        ...(deliverySlot ? { delivery_slot: deliverySlot } : {}),
    };
    const pricing = { subtotal, gst, pst, deliveryFee, total };
    const row: Record<string, unknown> = {
        store_id: env.storeId,
        customer,
        items: verified,
        pricing,
        payment_method: 'cash',
        payment_token: null,
        status: 'pending',
    };
    if (userId) row.user_id = userId;

    const { data: order, error } = await adminDb.from('orders').insert(row).select('id').single();
    if (error || !order) throw new HttpError(500, error?.message || 'Order could not be saved');

    void sendOrderMail(String(store.name ?? "Millad's Supermarket"), String(order.id), customer, verified, pricing)
        .catch((err) => console.error('Order mail failed', err));

    return { id: String(order.id), pricing };
}

type OrderMail = {
    name: string;
    phone: string;
    email?: string;
    fulfillment: 'pickup' | 'delivery';
    delivery_address?: string;
    delivery_slot?: '2pm' | '8pm';
};

async function sendOrderMail(
    storeName: string,
    orderId: string,
    customer: OrderMail,
    items: { name: string; quantity: number; price: number; notes: string; unit?: string }[],
    pricing: { subtotal: number; gst: number; pst: number; deliveryFee: number; total: number },
) {
    const { data: secrets } = await adminDb
        .from('store_secrets')
        .select('resend_api_key, from_email')
        .eq('store_id', env.storeId)
        .maybeSingle();
    if (!secrets?.resend_api_key || !secrets.from_email) {
        console.error('Order mail skipped: store Resend settings are missing');
        return;
    }
    const shortId = orderId.slice(-6).toUpperCase();
    const from = `${storeName} <${secrets.from_email}>`;
    const shared = {
        storeName,
        orderId,
        customerName: customer.name,
        phone: customer.phone,
        fulfillment: customer.fulfillment,
        deliveryAddress: customer.delivery_address,
        deliverySlot: customer.delivery_slot,
        items,
        pricing,
    };
    if (customer.email) {
        await postMail(secrets.resend_api_key, {
            from,
            to: [customer.email],
            subject: `Your order #${shortId} has been received — ${storeName}`,
            html: orderReceiptHtml(shared),
        });
    }
    await postMail(secrets.resend_api_key, {
        from,
        to: [env.storeNotifyEmail],
        subject: `New order #${shortId}`,
        html: orderAlertHtml({ ...shared, email: customer.email }),
    });
}

export async function sendUpdatedReceipt(
    orderId: string,
    customer: OrderMail,
    items: { name: string; quantity: number; price: number; notes?: string; unit?: string; cancelled?: boolean }[],
    pricing: { subtotal: number; gst: number; pst: number; deliveryFee?: number; total: number },
) {
    if (!customer.email) return;
    const { data: secrets } = await adminDb
        .from('store_secrets')
        .select('resend_api_key, from_email')
        .eq('store_id', env.storeId)
        .maybeSingle();
    if (!secrets?.resend_api_key || !secrets.from_email) {
        console.error('Updated receipt skipped: store Resend settings are missing');
        return;
    }
    const { data: store } = await adminDb.from('stores').select('name').eq('id', env.storeId).maybeSingle();
    const storeName = String(store?.name ?? "Millad's Supermarket");
    const shortId = orderId.slice(-6).toUpperCase();
    await postMail(secrets.resend_api_key, {
        from: `${storeName} <${secrets.from_email}>`,
        to: [customer.email],
        subject: `Your order #${shortId} has been updated — ${storeName}`,
        html: orderReceiptHtml({
            storeName,
            orderId,
            customerName: customer.name,
            phone: customer.phone,
            fulfillment: customer.fulfillment,
            deliveryAddress: customer.delivery_address,
            deliverySlot: customer.delivery_slot,
            items,
            pricing,
            updated: true,
        }),
    });
}

async function postMail(apiKey: string, message: { from: string; to: string[]; subject: string; html: string }) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
    if (!res.ok) console.error('Resend error', res.status, await res.text());
}

export async function listMyOrders(userId: string) {
    const { data, error } = await adminDb
        .from('orders')
        .select('id, customer, items, pricing, payment_method, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
}
