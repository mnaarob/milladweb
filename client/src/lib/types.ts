export type Product = {
    id: string;
    name: string;
    category: string;
    price: number;
    unit: string;
    description: string;
    image: string;
    fallbackEmoji: string;
    inStock: boolean;
    featured: boolean;
    subcategory: string;
    sortOrder: number;
    variableWeight: boolean;
    displayPrice: string | null;
    estimatedMaxWeight: number | null;
    taxExempt: boolean;
};

export type Category = { id: string; name: string; sortOrder: number };

export type CartItem = Product & { lineId: string; quantity: number; notes: string };

export type OrderRecord = {
    id: string;
    customer: {
        name?: string;
        phone?: string;
        email?: string;
        fulfillment?: string;
        delivery_address?: string;
        delivery_slot?: string;
    };
    items: {
        id?: string;
        name?: string;
        quantity?: number;
        ordered_quantity?: number;
        price?: number;
        unit?: string;
        notes?: string;
        category?: string;
        tax_exempt?: boolean;
        cancelled?: boolean;
    }[];
    pricing: {
        subtotal?: number;
        gst?: number;
        pst?: number;
        deliveryFee?: number;
        delivery_fee?: number;
        total?: number;
        adjusted_total?: number;
        adjust_note?: string;
    };
    payment_method?: string;
    status: string;
    created_at?: string;
};
