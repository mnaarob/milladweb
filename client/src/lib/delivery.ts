export const DELIVERY_FEE = 5.99;
export const FREE_DELIVERY_AT = 200;

export const DELIVERY_SLOTS = [
    { value: '2pm', label: '2:00 PM', hint: 'Afternoon' },
    { value: '8pm', label: '8:00 PM', hint: 'Evening' },
] as const;

export type DeliverySlot = (typeof DELIVERY_SLOTS)[number]['value'];

const CANADIAN_POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function isCanadianPostal(value: string) {
    return CANADIAN_POSTAL.test(value.trim());
}

export function formatDeliveryAddress(street: string, unit: string, postal: string) {
    const line1 = unit.trim() ? `${street.trim()}, ${unit.trim()}` : street.trim();
    const code = postal.replace(/\s+/g, ' ').trim().toUpperCase();
    return `${line1}, Winnipeg, MB ${code}`;
}

export function deliveryFee(subtotal: number, fulfillment: 'pickup' | 'delivery') {
    if (fulfillment !== 'delivery' || subtotal >= FREE_DELIVERY_AT) return 0;
    return DELIVERY_FEE;
}
