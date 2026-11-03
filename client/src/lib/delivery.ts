export const DELIVERY_FEE = 5.99;
export const FREE_DELIVERY_AT = 200;

export const DELIVERY_SLOTS = [
    { value: '2pm', label: '2:00 PM', hint: 'Afternoon' },
    { value: '8pm', label: '8:00 PM', hint: 'Evening' },
] as const;

export type DeliverySlot = (typeof DELIVERY_SLOTS)[number]['value'];

export function deliveryFee(subtotal: number, fulfillment: 'pickup' | 'delivery') {
    if (fulfillment !== 'delivery' || subtotal >= FREE_DELIVERY_AT) return 0;
    return DELIVERY_FEE;
}
