const PREFIXES = ['meat/', 'pantry/', 'dairy/', 'vegetables/', 'bakery/', 'beverages/', 'fruits/', 'oils/', 'spices/', 'rice/', 'tea/', 'households/'];

export function productImage(image: string) {
    const raw = image.trim();
    if (!raw || raw.length <= 4) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (PREFIXES.some((prefix) => raw.startsWith(prefix))) return `/images/${raw}`;
    if (raw.startsWith('images/')) return `/${raw}`;
    return raw.startsWith('/') ? raw : `/${raw}`;
}

export function money(value: number | undefined) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `$${amount.toFixed(2)}`;
}

export function lineTotal(price: number, quantity: number) {
    return Math.round(price * quantity * 100) / 100;
}
