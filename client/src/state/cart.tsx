import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clampQuantity } from '../lib/quantity';
import type { CartItem, Product } from '../lib/types';

const KEY = 'millads_cart';
const GST = 0.05;
const PST = 0.07;

type CartContextValue = {
    items: CartItem[];
    count: number;
    subtotal: number;
    gst: number;
    pst: number;
    total: number;
    add: (product: Product, quantity?: number) => void;
    setQuantity: (lineId: string, quantity: number) => void;
    remove: (lineId: string) => void;
    clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function load(): CartItem[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) as CartItem[] : [];
    } catch {
        return [];
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>(load);

    useEffect(() => {
        localStorage.setItem(KEY, JSON.stringify(items));
    }, [items]);

    const value = useMemo<CartContextValue>(() => {
        const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const rawTaxable = items.reduce((sum, item) => sum + (item.taxExempt ? 0 : item.price * item.quantity), 0);
        const subtotal = Math.round(rawSubtotal * 100) / 100;
        const taxable = Math.round(rawTaxable * 100) / 100;
        const gst = Math.round(taxable * GST * 100) / 100;
        const pst = Math.round(taxable * PST * 100) / 100;
        const total = Math.round((subtotal + gst + pst) * 100) / 100;
        return {
            items,
            count: items.length,
            subtotal,
            gst,
            pst,
            total,
            add(product, quantity = 1) {
                if (!product.inStock) return;
                const next = clampQuantity(product.unit, quantity);
                if (next == null) return;
                setItems((current) => {
                    const existing = current.find((item) => item.id === product.id && !item.notes);
                    if (existing) {
                        const combined = clampQuantity(product.unit, existing.quantity + next) ?? next;
                        return current.map((item) => item.lineId === existing.lineId ? { ...item, quantity: combined } : item);
                    }
                    return [...current, { ...product, lineId: product.id, quantity: next, notes: '' }];
                });
            },
            setQuantity(lineId, quantity) {
                setItems((current) => current.flatMap((item) => {
                    if (item.lineId !== lineId) return [item];
                    const next = clampQuantity(item.unit, quantity);
                    if (next == null) return [];
                    return [{ ...item, quantity: next }];
                }));
            },
            remove(lineId) {
                setItems((current) => current.filter((item) => item.lineId !== lineId));
            },
            clear() {
                setItems([]);
            },
        };
    }, [items]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const value = useContext(CartContext);
    if (!value) throw new Error('Cart is unavailable');
    return value;
}
