const GST_RATE = 0.05;
const PST_RATE = 0.07;
const STORAGE_KEY = 'millads_cart';

let items = [];
const listeners = new Set();

function load() {
    try {
        items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        items = items.map(i => ({
            ...i,
            lineId: i.lineId || i.id + '|' + (i.notes || ''),
            notes: i.notes || ''
        }));
    } catch {
        items = [];
    }
}

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach(fn => fn(items));
}

load();

export function addItem(product, quantity = 1, notes = '') {
    const notesStr = (notes || '').trim();
    const existing = items.find(i => i.id === product.id && (i.notes || '') === notesStr);
    if (existing) {
        existing.quantity += quantity;
    } else {
        const lineId = product.id + '|' + notesStr;
        items.push({
            lineId,
            id: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            category: product.category,
            image: product.image,
            fallbackEmoji: product.fallbackEmoji,
            variableWeight: product.variableWeight || false,
            displayPrice: product.displayPrice || null,
            estimatedMaxWeight: product.estimatedMaxWeight || null,
            taxExempt: product.taxExempt || false,
            quantity,
            notes: notesStr
        });
    }
    persist();
}

export function updateQuantity(lineId, delta) {
    const item = items.find(i => (i.lineId || i.id) === lineId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        items = items.filter(i => (i.lineId || i.id) !== lineId);
    }
    persist();
}

export function removeItem(lineId) {
    items = items.filter(i => (i.lineId || i.id) !== lineId);
    persist();
}

export function getItems() {
    return [...items];
}

export function clear() {
    items = [];
    persist();
}

export function onChange(fn) {
    listeners.add(fn);
}

export function getCount() {
    return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function getPricing() {
    const subtotal = items.reduce((sum, item) => {
        if (item.variableWeight && item.displayPrice === 'estimated') {
            return sum + (item.price * (item.estimatedMaxWeight || 1) * item.quantity);
        }
        return sum + (item.price * item.quantity);
    }, 0);

    const taxableSubtotal = items
        .filter(i => !i.taxExempt)
        .reduce((sum, item) => {
            if (item.variableWeight && item.displayPrice === 'estimated') {
                return sum + (item.price * (item.estimatedMaxWeight || 1) * item.quantity);
            }
            return sum + (item.price * item.quantity);
        }, 0);

    const gst = taxableSubtotal * GST_RATE;
    const pst = taxableSubtotal * PST_RATE;

    return { subtotal, taxableSubtotal, gst, pst, total: subtotal + gst + pst };
}

export function hasTaxExemptItems() {
    return items.some(i => i.taxExempt);
}
