import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TurnstileWidget, type TurnstileHandle } from '../components/TurnstileWidget';
import { api } from '../lib/api';
import { Select } from '../components/Select';
import { money, productImage } from '../lib/images';
import type { OrderRecord, Product } from '../lib/types';
import { signInWithGuard, supabase } from '../lib/supabase';
import { useSession } from '../state/session';

const STATUSES = ['pending', 'confirmed', 'ready', 'completed'] as const;
type OrderFilter = 'all' | (typeof STATUSES)[number];

const CATEGORIES: { value: string; label: string }[] = [
    { value: 'meat', label: 'Meat & seafood' },
    { value: 'fresh', label: 'Fresh vegetables & fruits' },
    { value: 'dairy', label: 'Dairy & eggs' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'pantry', label: 'Pantry' },
    { value: 'households', label: 'Households' },
    { value: 'others', label: 'Others' },
    { value: 'oils', label: 'Oils & ghee' },
    { value: 'spices', label: 'Spices & seasonings' },
    { value: 'rice', label: 'Rice & grains' },
    { value: 'beverages', label: 'Beverages' },
    { value: 'tea', label: 'Tea & coffee' },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((category) => [category.value, category.label]));

type ProductDraft = {
    id: string;
    name: string;
    price: string;
    unit: string;
    category: string;
    subcategory: string;
    sortOrder: string;
    image: string;
    fallbackEmoji: string;
    description: string;
    inStock: boolean;
    featured: boolean;
    taxExempt: boolean;
};

const emptyDraft = (): ProductDraft => ({
    id: '',
    name: '',
    price: '',
    unit: '',
    category: 'meat',
    subcategory: '',
    sortOrder: '',
    image: '',
    fallbackEmoji: '🛒',
    description: '',
    inStock: true,
    featured: false,
    taxExempt: true,
});

function draftFromProduct(product: Product): ProductDraft {
    return {
        id: product.id,
        name: product.name,
        price: Number.isFinite(product.price) ? String(product.price) : '',
        unit: product.unit || '',
        category: product.category || 'meat',
        subcategory: product.subcategory || '',
        sortOrder: product.sortOrder == null ? '' : String(product.sortOrder),
        image: product.image || '',
        fallbackEmoji: product.fallbackEmoji || '🛒',
        description: product.description || '',
        inStock: product.inStock !== false,
        featured: Boolean(product.featured),
        taxExempt: product.taxExempt,
    };
}

function categoryTitle(value: string) {
    return CATEGORY_LABELS[value] || value || 'Uncategorized';
}

function subcategoryTitle(product: Product) {
    const sub = product.subcategory?.trim();
    if (!sub) return '';
    if (sub.toLowerCase() === product.category.toLowerCase()) return '';
    if (sub.toLowerCase() === categoryTitle(product.category).toLowerCase()) return '';
    return sub;
}

function dollars(value: unknown) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function chargedTotal(order: OrderRecord) {
    const pricing = order.pricing || {};
    if (pricing.adjusted_total != null && Number.isFinite(Number(pricing.adjusted_total))) return Number(pricing.adjusted_total);
    const total = Number(pricing.total);
    return Number.isFinite(total) ? total : 0;
}

function normalizeStatus(status: string | undefined): (typeof STATUSES)[number] {
    const value = (status || '').trim().toLowerCase();
    return STATUSES.includes(value as (typeof STATUSES)[number]) ? value as (typeof STATUSES)[number] : 'pending';
}

function formatQty(quantity: number) {
    if (!Number.isFinite(quantity)) return '0';
    return Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 10) / 10);
}

function productPayload(draft: ProductDraft) {
    return {
        name: draft.name.trim(),
        price: Number(draft.price) || 0,
        unit: draft.unit.trim() || 'each',
        category: draft.category,
        subcategory: draft.subcategory.trim(),
        sortOrder: draft.sortOrder.trim() ? Number(draft.sortOrder) : 9999,
        image: draft.image.trim(),
        fallbackEmoji: draft.fallbackEmoji.trim() || '🛒',
        description: draft.description.trim(),
        inStock: draft.inStock,
        featured: draft.featured,
        taxExempt: draft.taxExempt,
    };
}

export function AdminPage() {
    const session = useSession();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'orders' | 'products'>(() => (window.location.hash === '#products' ? 'products' : 'orders'));
    const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [featuredFilter, setFeaturedFilter] = useState('');
    const [draft, setDraft] = useState<ProductDraft | null>(null);
    const [adjustingId, setAdjustingId] = useState<string | null>(null);
    const [adjustValue, setAdjustValue] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
    const [notice, setNotice] = useState('');
    const [draftError, setDraftError] = useState('');
    const [savingProduct, setSavingProduct] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [optimisticStatus, setOptimisticStatus] = useState<Partial<Record<string, (typeof STATUSES)[number]>>>({});
    const [statusSaving, setStatusSaving] = useState<Partial<Record<string, true>>>({});
    const statusLock = useRef(new Set<string>());

    useEffect(() => {
        document.body.classList.add('admin-body');
        return () => document.body.classList.remove('admin-body');
    }, []);

    const dialogOpen = draft != null;
    useEffect(() => {
        if (!dialogOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        function onKey(event: KeyboardEvent) {
            if (event.key !== 'Escape' || document.querySelector('.ui-select--open')) return;
            setDraft(null);
        }
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', onKey);
        };
    }, [dialogOpen]);

    const products = useQuery({
        queryKey: ['admin-products'],
        enabled: session.isStaff,
        queryFn: () => api<Product[]>('/api/admin/products', { token: session.token }),
    });
    const orders = useQuery({
        queryKey: ['admin-orders'],
        enabled: session.isStaff,
        refetchInterval: Object.keys(statusSaving).length > 0 ? false : 30_000,
        queryFn: () => api<OrderRecord[]>('/api/admin/orders', { token: session.token }),
    });

    useEffect(() => {
        const rows = orders.data;
        if (!rows) return;
        setOptimisticStatus((current) => {
            let changed = false;
            const next = { ...current };
            for (const [id, status] of Object.entries(next)) {
                if (!status || statusSaving[id]) continue;
                const order = rows.find((item) => item.id === id);
                if (order && normalizeStatus(order.status) === status) {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : current;
        });
    }, [orders.data, statusSaving]);

    const refresh = () => {
        setNotice('');
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
    };

    const orderRows = (orders.data ?? []).map((order) => {
        const override = optimisticStatus[order.id];
        if (!override || override === normalizeStatus(order.status)) return order;
        return { ...order, status: override };
    });
    const stats = useMemo(() => {
        const today = new Date();
        const revenue = orderRows.reduce((sum, order) => sum + chargedTotal(order), 0);
        const todayCount = orderRows.filter((order) => {
            if (!order.created_at) return false;
            const placed = new Date(order.created_at);
            return placed.getFullYear() === today.getFullYear()
                && placed.getMonth() === today.getMonth()
                && placed.getDate() === today.getDate();
        }).length;
        return {
            total: orderRows.length,
            awaiting: orderRows.filter((order) => normalizeStatus(order.status) === 'pending').length,
            revenue,
            today: todayCount,
        };
    }, [orderRows]);

    const visibleOrders = orderRows.filter((order) => orderFilter === 'all' || normalizeStatus(order.status) === orderFilter);
    const categoryOptions = useMemo(() => {
        const present = new Set((products.data ?? []).map((product) => product.category).filter(Boolean));
        const known = CATEGORIES.filter((category) => present.has(category.value));
        const extra = [...present].filter((value) => !CATEGORY_LABELS[value]).sort();
        return [...known, ...extra.map((value) => ({ value, label: value }))];
    }, [products.data]);
    const visibleProducts = (products.data ?? []).filter((product) => {
        const query = search.trim().toLowerCase();
        if (query && !product.name.toLowerCase().includes(query) && !product.description.toLowerCase().includes(query)) return false;
        if (categoryFilter && product.category !== categoryFilter) return false;
        if (featuredFilter === 'yes' && !product.featured) return false;
        if (featuredFilter === 'no' && product.featured) return false;
        return true;
    });

    if (session.loading || !session.staffReady) {
        return <div className="auth-loading"><div className="spinner" /></div>;
    }
    if (!session.user) return <AdminSignIn />;
    if (!session.isStaff) {
        const missingKey = session.staffError.includes('SUPABASE_SERVICE_ROLE_KEY');
        return (
            <div className="login-section">
                <div className="login-card">
                    <div className="login-card__brand">
                        <span>Millad's Supermarket</span>
                        <h2>Store dashboard</h2>
                    </div>
                    <div className="login-card__body">
                        <p className="login-intro">{missingKey ? session.staffError : "This account isn't on the store staff list."}</p>
                    </div>
                </div>
            </div>
        );
    }

    function showTab(next: 'orders' | 'products') {
        setTab(next);
        const hash = `#${next}`;
        if (window.location.hash !== hash) history.replaceState(null, '', hash);
    }

    async function updateStatus(orderId: string, status: string) {
        if (statusLock.current.has(orderId)) return;
        const nextStatus = normalizeStatus(status);
        statusLock.current.add(orderId);
        setNotice('');
        setOptimisticStatus((current) => ({ ...current, [orderId]: nextStatus }));
        setStatusSaving((current) => ({ ...current, [orderId]: true }));
        void queryClient.cancelQueries({ queryKey: ['admin-orders'] });
        try {
            await api(`/api/admin/orders/${orderId}/status`, {
                method: 'PATCH',
                token: session.token,
                body: JSON.stringify({ status: nextStatus }),
            });
            await queryClient.cancelQueries({ queryKey: ['admin-orders'] });
            queryClient.setQueryData<OrderRecord[]>(['admin-orders'], (current) =>
                current?.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order)),
            );
        } catch (err) {
            setOptimisticStatus((current) => {
                if (current[orderId] !== nextStatus) return current;
                const next = { ...current };
                delete next[orderId];
                return next;
            });
            setNotice(err instanceof Error ? err.message : 'Failed to update order status.');
        } finally {
            statusLock.current.delete(orderId);
            setStatusSaving((current) => {
                if (!current[orderId]) return current;
                const next = { ...current };
                delete next[orderId];
                return next;
            });
        }
    }

    function openAdjust(order: OrderRecord) {
        if (adjustingId === order.id) {
            setAdjustingId(null);
            return;
        }
        const pricing = order.pricing || {};
        const current = pricing.adjusted_total != null ? pricing.adjusted_total : pricing.total;
        setAdjustingId(order.id);
        setAdjustValue(dollars(current));
        setAdjustNote(pricing.adjust_note || '');
    }

    async function saveAdjust(orderId: string, reset = false) {
        setNotice('');
        const value = Number(adjustValue);
        if (!reset && (!Number.isFinite(value) || value < 0)) {
            setNotice('Please enter a valid dollar amount.');
            return;
        }
        try {
            await api(`/api/admin/orders/${orderId}/total`, {
                method: 'PATCH',
                token: session.token,
                body: JSON.stringify(reset ? { total: null } : { total: value, note: adjustNote }),
            });
            setAdjustingId(null);
            refresh();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to adjust total.');
        }
    }

    async function saveWeights(orderId: string, quantities: { index: number; quantity: number; cancelled?: boolean }[]) {
        setNotice('');
        try {
            await api(`/api/admin/orders/${orderId}/weights`, {
                method: 'PATCH',
                token: session.token,
                body: JSON.stringify({ quantities }),
            });
            refresh();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to save weights.');
            throw err;
        }
    }

    function openProduct(product?: Product) {
        setDraftError('');
        setDraft(product ? draftFromProduct(product) : emptyDraft());
    }

    async function saveProduct(event: FormEvent) {
        event.preventDefault();
        if (!draft) return;
        if (!draft.name.trim()) {
            setDraftError('Enter a product name.');
            return;
        }
        const price = Number(draft.price);
        if (!Number.isFinite(price) || price < 0) {
            setDraftError('Enter a price, such as 2.50.');
            return;
        }
        if (draft.sortOrder.trim() && !/^\d+$/.test(draft.sortOrder.trim())) {
            setDraftError('Sort order needs a whole number.');
            return;
        }
        setDraftError('');
        setSavingProduct(true);
        try {
            if (draft.id) {
                await api(`/api/admin/products/${draft.id}`, {
                    method: 'PUT',
                    token: session.token,
                    body: JSON.stringify(productPayload(draft)),
                });
            } else {
                await api('/api/admin/products', {
                    method: 'POST',
                    token: session.token,
                    body: JSON.stringify(productPayload(draft)),
                });
            }
            setDraft(null);
            refresh();
        } catch (err) {
            setDraftError(err instanceof Error ? err.message : 'Failed to save product.');
        } finally {
            setSavingProduct(false);
        }
    }

    async function saveProductFlags(product: Product, patch: Partial<ProductDraft>) {
        setNotice('');
        setSavingId(product.id);
        try {
            await api(`/api/admin/products/${product.id}`, {
                method: 'PUT',
                token: session.token,
                body: JSON.stringify(productPayload({ ...draftFromProduct(product), ...patch })),
            });
            refresh();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to update.');
        } finally {
            setSavingId(null);
        }
    }

    async function removeProduct(product: Product) {
        if (!window.confirm(`Permanently remove "${product.name}"? This cannot be undone.`)) return;
        setNotice('');
        try {
            await api(`/api/admin/products/${product.id}`, { method: 'DELETE', token: session.token });
            refresh();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to remove.');
        }
    }

    return (
        <div className="admin-panel">
            <header className="admin-header">
                <div className="admin-header-brand">
                    <a href="/">Millad's Supermarket</a>
                    <h1><LeafIcon /> Store dashboard</h1>
                </div>
                <div className="admin-actions">
                    <button type="button" className="btn-primary" onClick={refresh}>
                        <RefreshIcon /> Refresh
                    </button>
                    <a href="/" className="btn-secondary"><StoreIcon /> View store</a>
                    <Link to="/account" className="btn-secondary">My account</Link>
                    <span className="header__cart" style={{ padding: 0, width: 'auto' }}>
                        <button type="button" className="signout-link" aria-label="Log out" onClick={() => supabase.auth.signOut()}>
                            <span className="tooltip" aria-hidden="true">Log out</span>
                            <LogoutIcon />
                        </button>
                    </span>
                </div>
            </header>

            <main className="admin-main">
                <div className="admin-container">
                    {notice && <div className="error">{notice}</div>}
                    <section className="admin-stats" aria-label="Store summary">
                        <Stat icon={<BagIcon />} value={String(stats.total)} label="Total orders" />
                        <Stat icon={<HourglassIcon />} value={String(stats.awaiting)} label="Awaiting action" />
                        <Stat icon={<ReceiptIcon />} value={`$${stats.revenue.toFixed(2)}`} label="Order total (all time)" />
                        <Stat icon={<SunIcon />} value={String(stats.today)} label="Orders today" />
                    </section>

                    <div className="admin-tabs-wrap">
                        <div className="admin-tabs" role="tablist" aria-label="Dashboard sections">
                            <button type="button" className={tab === 'orders' ? 'active' : ''} role="tab" aria-selected={tab === 'orders'} onClick={() => showTab('orders')}>Orders</button>
                            <button type="button" className={tab === 'products' ? 'active' : ''} role="tab" aria-selected={tab === 'products'} onClick={() => showTab('products')}>Products</button>
                        </div>
                    </div>

                    <div className={`tab-content${tab === 'orders' ? ' active' : ''}`} role="tabpanel">
                        <div className="admin-filters" role="toolbar" aria-label="Filter orders by status">
                            {(['all', ...STATUSES] as OrderFilter[]).map((status) => (
                                <button key={status} type="button" className={orderFilter === status ? 'active' : ''} onClick={() => setOrderFilter(status)}>
                                    {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="orders-wrapper">
                            {orders.isLoading && <div className="loading">Loading orders…</div>}
                            {orders.isError && <div className="error">Error loading orders.</div>}
                            {orders.isSuccess && visibleOrders.length === 0 && <div className="no-orders">No orders found.</div>}
                            {visibleOrders.map((order) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    adjusting={adjustingId === order.id}
                                    adjustValue={adjustValue}
                                    adjustNote={adjustNote}
                                    onStatus={(status) => updateStatus(order.id, status)}
                                    statusLocked={Boolean(statusSaving[order.id])}
                                    onToggleAdjust={() => openAdjust(order)}
                                    onAdjustValue={setAdjustValue}
                                    onAdjustNote={setAdjustNote}
                                    onSave={() => saveAdjust(order.id)}
                                    onReset={() => saveAdjust(order.id, true)}
                                    onSaveWeights={(quantities) => saveWeights(order.id, quantities)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className={`tab-content${tab === 'products' ? ' active' : ''}`} role="tabpanel">
                        <div className="migration-link">
                            <strong>Developer sync:</strong> Catalog from repo → <a href="/scripts/migrate-products" target="_blank" rel="noopener">Migrate tool</a>. Admin edits → <code>npm run export</code> back to <code>products.json</code>. <a href="/scripts/README-SYNC.md" target="_blank" rel="noopener">Full guide</a>
                        </div>
                        <div className="products-toolbar">
                            <div className="products-toolbar__fields">
                                <input type="search" placeholder="Search by name…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products" />
                                <Select
                                    value={categoryFilter}
                                    ariaLabel="Filter by category"
                                    options={[{ value: '', label: 'All categories' }, ...categoryOptions]}
                                    onChange={setCategoryFilter}
                                />
                                <Select
                                    value={featuredFilter}
                                    ariaLabel="Featured filter"
                                    options={[
                                        { value: '', label: 'All products' },
                                        { value: 'yes', label: 'Featured only' },
                                        { value: 'no', label: 'Not featured' },
                                    ]}
                                    onChange={setFeaturedFilter}
                                />
                            </div>
                            <div className="products-toolbar__actions">
                                <button type="button" className="btn-secondary" onClick={refresh}><RefreshIcon /> Refresh</button>
                                <button type="button" className="btn-primary" onClick={() => openProduct()}><PlusIcon /> Add product</button>
                            </div>
                        </div>
                        <div className="product-catalog">
                            {products.isLoading && <div className="loading">Loading products…</div>}
                            {products.isError && <div className="error">Error loading products.</div>}
                            {products.isSuccess && visibleProducts.length === 0 && <div className="no-orders">No products found.</div>}
                            {visibleProducts.length > 0 && (
                                <ul className="product-list">
                                    {visibleProducts.map((product) => (
                                        <ProductRow
                                            key={product.id}
                                            product={product}
                                            broken={Boolean(brokenImages[product.id])}
                                            busy={savingId === product.id}
                                            onBroken={() => setBrokenImages((current) => ({ ...current, [product.id]: true }))}
                                            onEdit={() => openProduct(product)}
                                            onRemove={() => removeProduct(product)}
                                            onFeatured={() => saveProductFlags(product, { featured: !product.featured })}
                                            onStock={() => saveProductFlags(product, { inStock: product.inStock === false })}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {draft && (
                <ProductDialog
                    draft={draft}
                    error={draftError}
                    saving={savingProduct}
                    onChange={setDraft}
                    onClose={() => setDraft(null)}
                    onSubmit={saveProduct}
                />
            )}
        </div>
    );
}

function ProductRow({
    product, broken, busy, onBroken, onEdit, onRemove, onFeatured, onStock,
}: {
    product: Product;
    broken: boolean;
    busy: boolean;
    onBroken: () => void;
    onEdit: () => void;
    onRemove: () => void;
    onFeatured: () => void;
    onStock: () => void;
}) {
    const src = productImage(product.image);
    const showImage = Boolean(src) && !broken;
    const sub = subcategoryTitle(product);
    const inStock = product.inStock !== false;
    return (
        <li className="product-row">
            <div className="product-row__photo">
                {showImage
                    ? <img src={src!} alt="" onError={onBroken} />
                    : <span>{product.fallbackEmoji || '🛒'}</span>}
            </div>
            <div className="product-row__main">
                <strong>{product.name}</strong>
                <span>{categoryTitle(product.category)}{sub ? ` · ${sub}` : ''}</span>
            </div>
            <div className="product-row__price">
                <b>{money(product.price)}</b>
                <span>{product.unit || 'each'}</span>
            </div>
            <div className="product-row__switches">
                <button type="button" className={`product-switch${product.featured ? ' is-on' : ''}`} aria-pressed={product.featured} disabled={busy} onClick={onFeatured}>
                    {product.featured ? 'Featured' : 'Not featured'}
                </button>
                <button type="button" className={`product-switch${inStock ? ' is-on' : ' is-off'}`} aria-pressed={inStock} disabled={busy} onClick={onStock}>
                    {inStock ? 'In stock' : 'Out of stock'}
                </button>
            </div>
            <div className="product-row__actions">
                <button type="button" className="product-row__edit" onClick={onEdit}>Edit</button>
                <button type="button" className="product-row__remove" onClick={onRemove}>Remove</button>
            </div>
        </li>
    );
}

function ProductDialog({
    draft, error, saving, onChange, onClose, onSubmit,
}: {
    draft: ProductDraft;
    error: string;
    saving: boolean;
    onChange: (draft: ProductDraft) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
}) {
    const preview = productImage(draft.image);
    const categories = CATEGORIES.some((category) => category.value === draft.category)
        ? CATEGORIES
        : [...CATEGORIES, { value: draft.category, label: draft.category }];
    return (
        <div className="product-dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <form className="product-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="productDialogTitle" onSubmit={onSubmit}>
                <header className="product-dialog__header">
                    <h3 id="productDialogTitle">{draft.id ? 'Edit product' : 'Add product'}</h3>
                    <button type="button" className="product-dialog__close" onClick={onClose} aria-label="Close">×</button>
                </header>
                <div className="product-dialog__body">
                    <label className="product-dialog__field">
                        <span>Name</span>
                        <input value={draft.name} placeholder="Beef Boneless" onChange={(event) => onChange({ ...draft, name: event.target.value })} />
                    </label>
                    <div className="product-dialog__pair">
                        <label className="product-dialog__field">
                            <span>Price</span>
                            <input inputMode="decimal" value={draft.price} placeholder="21.99" onChange={(event) => onChange({ ...draft, price: event.target.value })} />
                        </label>
                        <label className="product-dialog__field">
                            <span>Unit</span>
                            <input value={draft.unit} placeholder="per kg" onChange={(event) => onChange({ ...draft, unit: event.target.value })} />
                        </label>
                    </div>
                    <div className="product-dialog__field">
                        <span>Category</span>
                        <Select
                            className="ui-select--block"
                            value={draft.category}
                            options={categories}
                            ariaLabel="Category"
                            onChange={(category) => onChange({ ...draft, category })}
                        />
                    </div>
                    <label className="product-dialog__field">
                        <span>Subcategory</span>
                        <input value={draft.subcategory} placeholder="beef, chicken, lamb, seafood" onChange={(event) => onChange({ ...draft, subcategory: event.target.value })} />
                        <small>Used for meat: beef, chicken, lamb, or seafood.</small>
                    </label>
                    <label className="product-dialog__field">
                        <span>Sort order</span>
                        <input inputMode="numeric" value={draft.sortOrder} placeholder="9999" onChange={(event) => onChange({ ...draft, sortOrder: event.target.value })} />
                        <small>Lower numbers show first in that category.</small>
                    </label>
                    <label className="product-dialog__field">
                        <span>Image</span>
                        <input value={draft.image} placeholder="meat/photo.webp or a full https:// link" onChange={(event) => onChange({ ...draft, image: event.target.value })} />
                        <small>A folder path such as meat/photo.webp, or a public https:// link.</small>
                    </label>
                    {preview && (
                        <div className="product-dialog__preview">
                            <img src={preview} alt="" />
                        </div>
                    )}
                    <label className="product-dialog__field">
                        <span>Fallback emoji</span>
                        <input value={draft.fallbackEmoji} placeholder="🛒" maxLength={4} onChange={(event) => onChange({ ...draft, fallbackEmoji: event.target.value })} />
                    </label>
                    <label className="product-dialog__field">
                        <span>Description</span>
                        <textarea value={draft.description} placeholder="Product description" onChange={(event) => onChange({ ...draft, description: event.target.value })} />
                    </label>
                    <div className="product-dialog__toggles">
                        <button type="button" className={`product-switch${draft.inStock ? ' is-on' : ' is-off'}`} aria-pressed={draft.inStock} onClick={() => onChange({ ...draft, inStock: !draft.inStock })}>
                            {draft.inStock ? 'In stock' : 'Out of stock'}
                        </button>
                        <button type="button" className={`product-switch${draft.featured ? ' is-on' : ''}`} aria-pressed={draft.featured} onClick={() => onChange({ ...draft, featured: !draft.featured })}>
                            {draft.featured ? 'Featured' : 'Not featured'}
                        </button>
                        <button type="button" className={`product-switch${draft.taxExempt ? ' is-on' : ''}`} aria-pressed={draft.taxExempt} onClick={() => onChange({ ...draft, taxExempt: !draft.taxExempt })}>
                            {draft.taxExempt ? 'Tax exempt' : 'Taxable'}
                        </button>
                    </div>
                    <p className="product-dialog__hint">Basic groceries are tax exempt. Henna and beverages are taxable.</p>
                    {error && <p className="product-dialog__error">{error}</p>}
                </div>
                <footer className="product-dialog__footer">
                    <button type="button" className="product-dialog__cancel" onClick={onClose}>Cancel</button>
                    <button type="submit" className="product-dialog__save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </footer>
            </form>
        </div>
    );
}

function AdminSignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const captcha = useRef<TurnstileHandle>(null);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError('');
        const captchaToken = captcha.current?.getToken() ?? '';
        if (!captchaToken) {
            setError('Complete the check above.');
            return;
        }
        try {
            await signInWithGuard(email, password, captchaToken);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed. Please check your email and password.');
            captcha.current?.reset();
        }
    }

    return (
        <div className="login-section">
            <form className="login-card" onSubmit={submit}>
                <div className="login-card__brand">
                    <span>Millad&apos;s Supermarket</span>
                    <h2>Store dashboard</h2>
                </div>
                <div className="login-card__body">
                    <p className="login-intro">Sign in with the store staff account to open the dashboard.</p>
                    <label className="checkout-field">
                        <span>Email</span>
                        <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </label>
                    <label className="checkout-field">
                        <span>Password</span>
                        <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    </label>
                    <TurnstileWidget ref={captcha} />
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit">Sign in</button>
                </div>
            </form>
        </div>
    );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
    return (
        <div className="stat-card">
            <div className="stat-icon" aria-hidden="true">{icon}</div>
            <div className="stat-info">
                <h3>{value}</h3>
                <p>{label}</p>
            </div>
        </div>
    );
}

function phoneHref(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `tel:+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
    return phone ? `tel:${phone}` : '';
}

function phoneLabel(phone: string) {
    const digits = phone.replace(/\D/g, '');
    const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
    return phone;
}

function slotLabel(slot: string | undefined) {
    if (slot === '2pm') return '2:00 PM';
    if (slot === '8pm') return '8:00 PM';
    return '';
}

const TAX_EXEMPT_CATEGORIES = new Set(['bakery', 'dairy', 'fresh', 'meat', 'oils', 'pantry', 'rice', 'spices', 'tea']);

function isKg(unit: string | undefined) {
    return /\bkg\b/i.test(unit || '');
}

function formatKg(quantity: number) {
    return String(Math.round(quantity * 1000) / 1000);
}

function lineAmount(price: number | undefined, quantity: number) {
    if (!Number.isFinite(price)) return null;
    return Math.round(Number(price) * quantity * 100) / 100;
}

function itemIsExempt(item: OrderRecord['items'][number]) {
    if (typeof item.tax_exempt === 'boolean') return item.tax_exempt;
    return TAX_EXEMPT_CATEGORIES.has(item.category || '');
}

function quoteOrder(items: { price?: number; quantity: number; exempt: boolean }[], deliveryFee: number) {
    let rawSubtotal = 0;
    let rawTaxable = 0;
    for (const item of items) {
        const line = (Number(item.price) || 0) * item.quantity;
        rawSubtotal += line;
        if (!item.exempt) rawTaxable += line;
    }
    const subtotal = Math.round(rawSubtotal * 100) / 100;
    const taxable = Math.round(rawTaxable * 100) / 100;
    const gst = Math.round(taxable * 0.05 * 100) / 100;
    const pst = Math.round(taxable * 0.07 * 100) / 100;
    return {
        subtotal,
        gst,
        pst,
        total: Math.round((subtotal + gst + pst + deliveryFee) * 100) / 100,
    };
}

function OrderCard({
    order, adjusting, adjustValue, adjustNote, onStatus, statusLocked, onToggleAdjust, onAdjustValue, onAdjustNote, onSave, onReset, onSaveWeights,
}: {
    order: OrderRecord;
    adjusting: boolean;
    adjustValue: string;
    adjustNote: string;
    onStatus: (status: string) => void;
    statusLocked: boolean;
    onToggleAdjust: () => void;
    onAdjustValue: (value: string) => void;
    onAdjustNote: (value: string) => void;
    onSave: () => void;
    onReset: () => void;
    onSaveWeights: (quantities: { index: number; quantity: number; cancelled?: boolean }[]) => Promise<void>;
}) {
    const status = normalizeStatus(order.status);
    const pricing = order.pricing || {};
    const adjusted = pricing.adjusted_total != null && Number.isFinite(Number(pricing.adjusted_total));
    const delivery = order.customer?.fulfillment === 'delivery';
    const fulfillment = delivery ? 'Delivery' : 'Pickup';
    const slot = slotLabel(order.customer?.delivery_slot);
    const phone = order.customer?.phone || '';
    const placed = order.created_at
        ? new Date(order.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
    const deliveryFee = Number(pricing.deliveryFee ?? pricing.delivery_fee);
    const fee = Number.isFinite(deliveryFee) && deliveryFee > 0 ? deliveryFee : 0;
    const items = order.items || [];
    const savedKey = items.map((item) => `${item.quantity}:${item.cancelled ? 1 : 0}`).join(',');
    const [weights, setWeights] = useState<Record<number, string>>({});
    const [removed, setRemoved] = useState<Record<number, boolean>>({});
    const [savingWeights, setSavingWeights] = useState(false);
    useEffect(() => {
        setWeights({});
        setRemoved({});
    }, [order.id, savedKey]);

    function weightFor(index: number, saved: number) {
        const draft = weights[index];
        if (draft == null) return { quantity: saved, valid: true };
        if (!/^\d+(\.\d{0,3})?$/.test(draft)) return { quantity: saved, valid: false };
        const quantity = Math.round(Number(draft) * 1000) / 1000;
        if (quantity < 0.001 || quantity > 99.999) return { quantity: saved, valid: false };
        return { quantity, valid: true };
    }

    const lines = items.map((item, index) => {
        const saved = Number(item.quantity) || 0;
        const weighed = isKg(item.unit);
        const current = weighed ? weightFor(index, saved) : { quantity: saved, valid: true };
        const cancelled = removed[index] ?? Boolean(item.cancelled);
        return { item, index, saved, weighed, cancelled, ...current };
    });
    const weightsValid = lines.every((line) => line.cancelled || line.valid);
    const weightsDirty = lines.some((line) => !line.cancelled && line.weighed && line.valid && Math.abs(line.quantity - line.saved) >= 0.0005);
    const cancelDirty = lines.some((line) => line.cancelled !== Boolean(line.item.cancelled));
    const changesDirty = weightsDirty || cancelDirty;
    const activeFee = lines.some((line) => !line.cancelled) ? fee : 0;
    const preview = changesDirty && weightsValid
        ? quoteOrder(lines.filter((line) => !line.cancelled).map((line) => ({ price: line.item.price, quantity: line.quantity, exempt: itemIsExempt(line.item) })), activeFee)
        : null;
    const shown = preview ?? {
        subtotal: Number(pricing.subtotal) || 0,
        gst: Number(pricing.gst) || 0,
        pst: Number(pricing.pst) || 0,
        total: Number(pricing.total) || 0,
    };

    async function saveWeights() {
        const quantities = lines.map((line) => ({
            index: line.index,
            quantity: line.weighed && line.valid ? line.quantity : Math.max(line.saved, 0.001),
            cancelled: line.cancelled,
        }));
        if (!quantities.length || !weightsValid) return;
        setSavingWeights(true);
        try {
            await onSaveWeights(quantities);
        } finally {
            setSavingWeights(false);
        }
    }

    return (
        <article className="order-card">
            <header className="order-card__top">
                <div>
                    <strong className="order-card__title">Order #{order.id.slice(-6)}</strong>
                    {placed && <p className="order-card__when">Placed {placed}</p>}
                </div>
                <span className={`status-badge status-${status}`}>{status[0].toUpperCase() + status.slice(1)}</span>
            </header>

            <div className="order-card__who">
                <h3>{order.customer?.name || 'Customer'}</h3>
                <div className="order-card__chips">
                    {phone && <a className="order-chip" href={phoneHref(phone)}>{phoneLabel(phone)}</a>}
                    <span className="order-chip order-chip--green">{fulfillment}{slot ? ` · ${slot}` : ''}</span>
                    <span className="order-chip">Cash</span>
                </div>
                {order.customer?.delivery_address && <p className="order-card__address">{order.customer.delivery_address}</p>}
                {order.customer?.email && <p className="order-card__address">{order.customer.email}</p>}
            </div>

            <div className="order-items">
                <h3>Items</h3>
                {lines.some((line) => line.weighed) && <p className="order-items__hint">Kilogram items can be changed by 1 gram. The line price is the price per kg times the weight.</p>}
                {lines.length === 0 && <p className="order-line order-line--empty">No items on this order.</p>}
                {lines.map((line) => {
                    const total = line.cancelled || !line.valid ? null : lineAmount(line.item.price, line.quantity);
                    const unit = line.item.unit?.trim();
                    const original = line.item.ordered_quantity ?? line.saved;
                    const showOrdered = !line.cancelled && line.weighed && line.valid && Math.abs(line.quantity - Number(original)) >= 0.0005;
                    return (
                        <div className={`order-line${line.cancelled ? ' is-cancelled' : ''}`} key={`${line.item.name}-${line.index}`}>
                            <div>
                                <strong>{line.item.name || 'Item'}</strong>
                                {Number.isFinite(line.item.price) && <span>${dollars(line.item.price)}{unit ? ` ${unit}` : ' each'}</span>}
                                {line.item.notes && <span>{line.item.notes}</span>}
                                {showOrdered && <span>Ordered {formatKg(Number(original))} kg</span>}
                                <button
                                    type="button"
                                    className="order-line__cancel"
                                    onClick={() => setRemoved((current) => ({ ...current, [line.index]: !line.cancelled }))}
                                >
                                    {line.cancelled ? 'Restore' : 'Cancel item'}
                                </button>
                            </div>
                            {line.weighed && !line.cancelled ? (
                                <label className={`order-weight${line.valid ? '' : ' is-invalid'}`}>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        aria-label={`Final weight for ${line.item.name || 'item'} in kilograms`}
                                        value={weights[line.index] ?? formatKg(line.saved)}
                                        onChange={(event) => {
                                            const raw = event.target.value;
                                            const keep = raw === '' || /^\d+\.$/.test(raw) || /^\d+(\.\d{0,3})?$/.test(raw);
                                            const next = keep || !Number.isFinite(Number(raw)) ? raw : formatKg(Number(raw));
                                            setWeights((current) => ({ ...current, [line.index]: next }));
                                        }}
                                    />
                                    <span>kg</span>
                                </label>
                            ) : (
                                <span className="order-qty">{line.cancelled ? 'Cancelled' : line.weighed ? `${formatKg(line.saved)} kg` : `× ${formatQty(line.saved)}`}</span>
                            )}
                            <b>{line.cancelled ? 'Cancelled' : total == null ? '—' : `$${dollars(total)}`}</b>
                        </div>
                    );
                })}
                {changesDirty && weightsValid && (
                    <div className="order-weight-save">
                        {cancelDirty && order.customer?.email && <p>The customer will get an updated receipt with the cancelled item and the new total.</p>}
                        <button type="button" onClick={saveWeights} disabled={savingWeights}>
                            {savingWeights ? 'Saving…' : cancelDirty && order.customer?.email ? 'Save and email customer' : cancelDirty ? 'Save changes' : 'Save weights'}
                        </button>
                    </div>
                )}
            </div>

            <dl className="order-totals">
                <div><dt>Subtotal</dt><dd>${dollars(shown.subtotal)}</dd></div>
                <div><dt>GST</dt><dd>${dollars(shown.gst)}</dd></div>
                <div><dt>PST</dt><dd>${dollars(shown.pst)}</dd></div>
                {(preview ? activeFee : fee) > 0 && <div><dt>Delivery</dt><dd>${dollars(preview ? activeFee : fee)}</dd></div>}
                <div className="is-total"><dt>Order total</dt><dd>${dollars(shown.total)}</dd></div>
                {adjusted && !preview && (
                    <div className="is-final">
                        <dt>Final total</dt>
                        <dd>${dollars(pricing.adjusted_total)} <span className="adjusted-badge">adjusted</span></dd>
                    </div>
                )}
                {pricing.adjust_note && <div className="is-note"><dt>Note</dt><dd>{pricing.adjust_note}</dd></div>}
            </dl>

            <div className="order-actions">
                <div className="order-status" role="group" aria-label="Update order status" aria-busy={statusLocked}>
                    {STATUSES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={option === status ? 'is-current' : ''}
                            aria-pressed={option === status}
                            disabled={statusLocked}
                            onClick={() => { if (option !== status) onStatus(option); }}
                        >
                            {option[0].toUpperCase() + option.slice(1)}
                        </button>
                    ))}
                </div>
                <button type="button" className="btn-adjust-total" onClick={onToggleAdjust} aria-expanded={adjusting}>
                    <DollarIcon /> Adjust total
                </button>
                {adjusting && (
                    <div className="adjust-panel">
                        <p className="adjust-panel__hint">Weights on fresh items may differ. Enter the final amount the customer should pay.</p>
                        <div className="adjust-panel__fields">
                            <div className="adjust-panel__input-wrap">
                                <span className="adjust-panel__currency">$</span>
                                <input type="number" step="0.01" min="0" value={adjustValue} className="adjust-panel__input" aria-label="Adjusted total" onChange={(event) => onAdjustValue(event.target.value)} />
                            </div>
                            <input type="text" className="adjust-panel__note" value={adjustNote} placeholder="Reason (optional, e.g. weight adjusted)" onChange={(event) => onAdjustNote(event.target.value)} />
                        </div>
                        <div className="adjust-panel__actions">
                            <button type="button" className="btn-adjust-save" onClick={onSave}>Save</button>
                            <button type="button" className="btn-adjust-cancel" onClick={onToggleAdjust}>Cancel</button>
                            {adjusted && <button type="button" className="btn-adjust-reset" onClick={onReset}>Reset to original</button>}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

function Icon({ children }: { children: ReactNode }) {
    return (
        <svg className="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    );
}

function LeafIcon() {
    return <Icon><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></Icon>;
}
function RefreshIcon() {
    return <Icon><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></Icon>;
}
function StoreIcon() {
    return <Icon><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" /></Icon>;
}
function LogoutIcon() {
    return <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></Icon>;
}
function BagIcon() {
    return <Icon><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></Icon>;
}
function HourglassIcon() {
    return <Icon><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></Icon>;
}
function ReceiptIcon() {
    return <Icon><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></Icon>;
}
function SunIcon() {
    return <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></Icon>;
}
function PlusIcon() {
    return <Icon><path d="M5 12h14" /><path d="M12 5v14" /></Icon>;
}
function DollarIcon() {
    return <Icon><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Icon>;
}
