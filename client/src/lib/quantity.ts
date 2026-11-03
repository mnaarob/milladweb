export function isSoldByWeight(unit: string) {
    return /\bkg\b/i.test(unit);
}

export function quantityStep(unit: string) {
    return isSoldByWeight(unit) ? 0.5 : 1;
}

export function formatAmount(quantity: number) {
    return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
}

export function clampQuantity(unit: string, quantity: number): number | null {
    if (isSoldByWeight(unit)) {
        const snapped = Math.round(quantity * 2) / 2;
        if (snapped < 1) return 1;
        return Math.min(99, snapped);
    }
    if (quantity < 1) return null;
    return Math.min(99, Math.floor(quantity));
}
