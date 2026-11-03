export type ProductDto = {
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

type ProductRow = Record<string, unknown>;

export function rowToProduct(row: ProductRow): ProductDto {
    const category = String(row.category ?? '').trim();
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        category,
        price: Number(row.price),
        unit: String(row.unit ?? 'each'),
        description: String(row.description ?? ''),
        image: String(row.image ?? '').trim(),
        fallbackEmoji: String(row.fallback_emoji ?? '🛒'),
        inStock: row.in_stock !== false,
        featured: Boolean(row.featured),
        subcategory: String(row.subcategory ?? ''),
        sortOrder: Number(row.sort_order ?? 9999),
        variableWeight: Boolean(row.variable_weight),
        displayPrice: row.display_price == null ? null : String(row.display_price),
        estimatedMaxWeight: row.estimated_max_weight == null ? null : Number(row.estimated_max_weight),
        taxExempt: Boolean(row.tax_exempt),
    };
}

export function productToRow(data: Partial<ProductDto>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.category !== undefined) row.category = data.category;
    if (data.price !== undefined) row.price = data.price;
    if (data.unit !== undefined) row.unit = data.unit;
    if (data.description !== undefined) row.description = data.description;
    if (data.image !== undefined) row.image = data.image;
    if (data.fallbackEmoji !== undefined) row.fallback_emoji = data.fallbackEmoji;
    if (data.inStock !== undefined) row.in_stock = data.inStock;
    if (data.featured !== undefined) row.featured = data.featured;
    if (data.subcategory !== undefined) row.subcategory = data.subcategory;
    if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
    if (data.variableWeight !== undefined) row.variable_weight = data.variableWeight;
    if (data.displayPrice !== undefined) row.display_price = data.displayPrice;
    if (data.estimatedMaxWeight !== undefined) row.estimated_max_weight = data.estimatedMaxWeight;
    if (data.taxExempt !== undefined) row.tax_exempt = data.taxExempt;
    return row;
}
