import { z } from 'zod';
import { env } from '../../config/env.js';
import { productToRow, rowToProduct, type ProductDto } from '../../lib/catalog.js';
import { HttpError } from '../../lib/http.js';
import { adminDb } from '../../lib/supabase.js';
import { sendUpdatedReceipt } from '../orders/orders.service.js';

const productSchema = z.object({
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    price: z.number().nonnegative(),
    unit: z.string().trim().min(1).default('each'),
    description: z.string().optional().default(''),
    image: z.string().optional().default(''),
    fallbackEmoji: z.string().optional().default('🛒'),
    inStock: z.boolean().optional().default(true),
    featured: z.boolean().optional().default(false),
    subcategory: z.string().optional().default(''),
    sortOrder: z.number().int().min(0).max(999999).optional(),
    taxExempt: z.boolean().optional(),
});

export async function listAdminProducts() {
    const { data, error } = await adminDb
        .from('products')
        .select('*')
        .eq('store_id', env.storeId)
        .order('sort_order');
    if (error) throw new HttpError(500, error.message);
    return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

export async function createProduct(input: z.infer<typeof productSchema>) {
    const { data: store, error: storeErr } = await adminDb
        .from('stores')
        .select('organization_id')
        .eq('id', env.storeId)
        .single();
    if (storeErr || !store) throw new HttpError(500, 'Could not look up organization');
    const row = productToRow({
        ...input,
        taxExempt: input.taxExempt ?? true,
        sortOrder: input.sortOrder ?? 9999,
    } as Partial<ProductDto>);
    row.store_id = env.storeId;
    row.organization_id = store.organization_id;
    row.is_published = true;
    const { data, error } = await adminDb.from('products').insert(row).select('id').single();
    if (error || !data) throw new HttpError(500, error?.message || 'Could not add product');
    return { id: String(data.id) };
}

export async function updateProduct(id: string, input: z.infer<typeof productSchema>) {
    const row = productToRow(input as Partial<ProductDto>);
    const { error } = await adminDb.from('products').update(row).eq('id', id).eq('store_id', env.storeId);
    if (error) throw new HttpError(500, error.message);
}

export async function removeProduct(id: string) {
    const { error } = await adminDb.from('products').delete().eq('id', id).eq('store_id', env.storeId);
    if (error) throw new HttpError(500, error.message);
}

export async function listOrders() {
    const { data, error } = await adminDb
        .from('orders')
        .select('id, customer, items, pricing, payment_method, status, created_at')
        .eq('store_id', env.storeId)
        .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
}

const statuses = ['pending', 'confirmed', 'ready', 'completed'] as const;

export async function setOrderStatus(id: string, status: string) {
    if (!statuses.includes(status as (typeof statuses)[number])) throw new HttpError(400, 'Invalid status');
    const { error } = await adminDb.from('orders').update({ status }).eq('id', id).eq('store_id', env.storeId);
    if (error) throw new HttpError(500, error.message);
}

const TAX_EXEMPT_CATEGORIES = new Set(['bakery', 'dairy', 'fresh', 'meat', 'oils', 'pantry', 'rice', 'spices', 'tea']);
const GST = 0.05;
const PST = 0.07;

type StoredItem = {
    id?: string;
    name?: string;
    unit?: string;
    price?: number;
    quantity?: number;
    ordered_quantity?: number;
    category?: string;
    tax_exempt?: boolean;
    notes?: string;
    cancelled?: boolean;
};

type StoredCustomer = {
    name?: string;
    phone?: string;
    email?: string;
    fulfillment?: 'pickup' | 'delivery';
    delivery_address?: string;
    delivery_slot?: '2pm' | '8pm';
};

function soldByWeight(unit: string | undefined) {
    return /\bkg\b/i.test(unit || '');
}

function snapToGram(quantity: number) {
    return Math.round(quantity * 1000) / 1000;
}

export async function setOrderWeights(id: string, updates: { index: number; quantity: number; cancelled?: boolean }[]) {
    const { data, error: readErr } = await adminDb
        .from('orders')
        .select('items, pricing, customer')
        .eq('id', id)
        .eq('store_id', env.storeId)
        .single();
    if (readErr || !data) throw new HttpError(404, 'Order not found');

    const items = ((data.items as StoredItem[] | null) ?? []).map((item) => ({ ...item }));
    let cancelChanged = false;
    for (const update of updates) {
        const item = items[update.index];
        if (!item) throw new HttpError(400, 'That item is not on this order.');
        const wasCancelled = Boolean(item.cancelled);
        if (update.cancelled) item.cancelled = true;
        else if (update.cancelled === false) delete item.cancelled;
        if (Boolean(item.cancelled) !== wasCancelled) cancelChanged = true;
        if (!soldByWeight(item.unit)) continue;
        const quantity = snapToGram(update.quantity);
        if (quantity < 0.001 || quantity > 99.999) throw new HttpError(400, 'Enter a weight from 1 g to 99.999 kg.');
        if (item.ordered_quantity == null) item.ordered_quantity = Number(item.quantity) || quantity;
        item.quantity = quantity;
    }

    const productIds = [...new Set(items.map((item) => item.id).filter((value): value is string => Boolean(value)))];
    const taxById = new Map<string, boolean>();
    if (productIds.length) {
        const { data: products, error: productErr } = await adminDb
            .from('products')
            .select('id, tax_exempt')
            .in('id', productIds)
            .eq('store_id', env.storeId);
        if (productErr) throw new HttpError(500, productErr.message);
        for (const product of products ?? []) taxById.set(String(product.id), Boolean(product.tax_exempt));
    }

    let rawSubtotal = 0;
    let rawTaxable = 0;
    const activeItems = items.filter((item) => !item.cancelled);
    for (const item of items) {
        const known = item.id ? taxById.get(item.id) : undefined;
        item.tax_exempt = known ?? TAX_EXEMPT_CATEGORIES.has(String(item.category || ''));
        if (item.cancelled) continue;
        const line = (Number(item.price) || 0) * (Number(item.quantity) || 0);
        rawSubtotal += line;
        if (!item.tax_exempt) rawTaxable += line;
    }

    const subtotal = Math.round(rawSubtotal * 100) / 100;
    const taxable = Math.round(rawTaxable * 100) / 100;
    const gst = Math.round(taxable * GST * 100) / 100;
    const pst = Math.round(taxable * PST * 100) / 100;
    const pricing = { ...(data.pricing as Record<string, unknown>) };
    const storedFee = Number(pricing.deliveryFee ?? pricing.delivery_fee ?? 0);
    const deliveryFee = activeItems.length && Number.isFinite(storedFee) ? storedFee : 0;
    pricing.subtotal = subtotal;
    pricing.gst = gst;
    pricing.pst = pst;
    pricing.total = Math.round((subtotal + gst + pst + deliveryFee) * 100) / 100;
    delete pricing.adjusted_total;
    delete pricing.adjust_note;

    const { error } = await adminDb.from('orders').update({ items, pricing }).eq('id', id).eq('store_id', env.storeId);
    if (error) throw new HttpError(500, error.message);

    if (cancelChanged) {
        const customer = (data.customer ?? {}) as StoredCustomer;
        if (customer.email && customer.name && customer.phone && customer.fulfillment) {
            void sendUpdatedReceipt(
                id,
                {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                    fulfillment: customer.fulfillment,
                    delivery_address: customer.delivery_address,
                    delivery_slot: customer.delivery_slot,
                },
                items.map((item) => ({
                    name: item.name || 'Item',
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0,
                    notes: item.notes,
                    unit: item.unit,
                    cancelled: Boolean(item.cancelled),
                })),
                {
                    subtotal,
                    gst,
                    pst,
                    deliveryFee,
                    total: Number(pricing.total),
                },
            ).catch((err) => console.error('Updated receipt failed', err));
        }
    }

    return { items, pricing };
}

export async function setOrderTotal(id: string, total: number | null, note?: string) {
    const { data, error: readErr } = await adminDb
        .from('orders')
        .select('pricing')
        .eq('id', id)
        .eq('store_id', env.storeId)
        .single();
    if (readErr || !data) throw new HttpError(404, 'Order not found');
    const pricing = { ...(data.pricing as Record<string, unknown>) };
    if (total == null) {
        delete pricing.adjusted_total;
        delete pricing.adjust_note;
    } else {
        pricing.adjusted_total = Math.round(total * 100) / 100;
        if (note?.trim()) pricing.adjust_note = note.trim();
        else delete pricing.adjust_note;
    }
    const { error } = await adminDb.from('orders').update({ pricing }).eq('id', id).eq('store_id', env.storeId);
    if (error) throw new HttpError(500, error.message);
    return pricing;
}

export function parseProduct(body: unknown) {
    return productSchema.parse(body);
}

export async function inviteStaff(email: string, role: 'owner' | 'manager' | 'staff') {
    const { data: invited, error } = await adminDb.auth.admin.inviteUserByEmail(email, {
        data: { invited_to_store: env.storeId, invited_role: role },
    });
    let userId = invited?.user?.id;
    if (error) {
        if (!/already been registered/i.test(error.message)) throw new HttpError(400, error.message);
        userId = await findUserId(email) ?? undefined;
    }
    if (userId) {
        const { error: upsertErr } = await adminDb
            .from('store_admins')
            .upsert({ user_id: userId, store_id: env.storeId, role }, { onConflict: 'user_id,store_id' });
        if (upsertErr) throw new HttpError(500, upsertErr.message);
    }
}

async function findUserId(email: string) {
    for (let page = 1; page <= 5; page += 1) {
        const { data, error } = await adminDb.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return null;
        const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
        if (match) return match.id;
        if (data.users.length < 200) break;
    }
    return null;
}
