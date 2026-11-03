import { signIn, signOut, onAuthChange, isAdmin } from './services/auth.js';
import { getTurnstileSiteKey } from './config/supabase.js';
import {
    getProductsForAdmin,
    addProduct,
    updateProduct,
    deleteProduct,
    setProductFeatured,
    getOrders,
    updateOrderStatus,
    updateOrderPricing
} from './services/database.js?v=4';
import { notifyCatalogChanged } from './modules/catalog-sync.js?v=3';

let allOrders = [];
let filteredOrders = [];
let allProducts = [];
let filteredProducts = [];

/** Match DB / legacy casing (e.g. Pending vs pending) */
function normalizeOrderStatus(s) {
    const v = (s == null ? '' : String(s)).trim().toLowerCase();
    if (['pending', 'confirmed', 'ready', 'completed'].includes(v)) return v;
    return v || 'pending';
}

const CATEGORY_LABELS = {
    meat: 'Meat & seafood',
    fresh: 'Fresh vegetables & fruits',
    dairy: 'Dairy & eggs',
    bakery: 'Bakery',
    pantry: 'Pantry',
    households: 'Households',
    others: 'Others',
    oils: 'Oils & ghee',
    spices: 'Spices & seasonings',
    rice: 'Rice & grains',
    beverages: 'Beverages',
    tea: 'Tea & coffee',
};

const CATEGORY_ORDER = [
    'meat', 'fresh', 'dairy', 'bakery', 'pantry', 'households', 'others',
    'oils', 'spices', 'rice', 'beverages', 'tea',
];

function populateProductCategoryFilter() {
    const sel = document.getElementById('productCategoryFilter');
    if (!sel) return;
    const prev = sel.value;
    const fromDb = [...new Set(allProducts.map((p) => p.category).filter(Boolean))];
    const ordered = [
        ...CATEGORY_ORDER.filter((c) => fromDb.includes(c)),
        ...fromDb.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
    ];
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All categories';
    sel.appendChild(optAll);
    ordered.forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = CATEGORY_LABELS[c] || c;
        sel.appendChild(o);
    });
    if (prev && [...sel.options].some((opt) => opt.value === prev)) sel.value = prev;
}

function syncOrderFilterButtons(activeStatus) {
    document.querySelectorAll('#ordersTab .admin-filters [data-order-filter]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.orderFilter === activeStatus);
    });
}

function hideAuthLoading() {
    const el = document.getElementById('authLoading');
    if (el) el.style.display = 'none';
}

function showLogin() {
    hideAuthLoading();
    const loginSection = document.getElementById('loginSection');
    const adminPanel = document.getElementById('adminPanel');
    if (loginSection) loginSection.style.display = 'flex';
    if (adminPanel) adminPanel.style.display = 'none';
    initAdminTurnstile();
}

function showAdmin() {
    hideAuthLoading();
    const loginSection = document.getElementById('loginSection');
    const adminPanel = document.getElementById('adminPanel');
    if (loginSection) loginSection.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
}

onAuthChange(async (user) => {
    if (!user) {
        showLogin();
        return;
    }
    const admin = await isAdmin(user);
    if (!admin) {
        alert(
            "We couldn't open the store dashboard for this account.\n\n" +
                'If you work at the store, ask the person who set up the website to add your email in the admin list. ' +
                'If you already received an invite email, make sure you signed up with that same email address.'
        );
        signOut();
        return;
    }
    showAdmin();
    loadOrders();
    setupAdminTabs();
    if (getAdminTabFromHash() === 'products') loadProducts();
});

async function loadOrders() {
    try {
        const container = document.getElementById('ordersContainer');
        if (container) container.innerHTML = '<div class="loading">Loading orders...</div>';

        const raw = await getOrders();
        allOrders = raw.map((o) => ({ ...o, status: normalizeOrderStatus(o.status) }));

        filteredOrders = [...allOrders];
        syncOrderFilterButtons('all');
        updateStatistics();
        displayOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = '<div class="error">Error loading orders. Please check your Supabase configuration.</div>';
        }
    }
}

function updateStatistics() {
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const totalRevenue = allOrders.reduce((sum, o) => {
        const p = o.pricing || {};
        return sum + (p.adjusted_total != null ? p.adjusted_total : (p.total || o.total || 0));
    }, 0);

    const today = new Date();
    const todayOrders = allOrders.filter(o => {
        const d = o.timestamp;
        return d.getFullYear() === today.getFullYear() &&
               d.getMonth() === today.getMonth() &&
               d.getDate() === today.getDate();
    }).length;

    const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };

    el('totalOrders', totalOrders);
    el('pendingOrders', pendingOrders);
    el('totalRevenue', '$' + totalRevenue.toFixed(2));
    el('todayOrders', todayOrders);
}

function displayOrders() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="no-orders">No orders found.</div>';
        return;
    }

    container.innerHTML = filteredOrders.map((order) => {
        const items = (order.items || [])
            .map((i) => `${escapeHtml(String(i.name || ''))} × ${Number(i.quantity) || 0}`)
            .join(', ');
        const date = order.timestamp.toLocaleString();
        const pricing = order.pricing || {};
        const total = (pricing.total || order.total || 0).toFixed(2);
        const subtotal = (pricing.subtotal || 0).toFixed(2);
        const gst = (pricing.gst || 0).toFixed(2);
        const pst = (pricing.pst || 0).toFixed(2);
        const adjusted = pricing.adjusted_total != null;
        const displayTotal = adjusted
            ? Number(pricing.adjusted_total).toFixed(2)
            : total;
        const status = order.status || 'pending';
        const statusLabel = status.replace(/^\w/, (c) => c.toUpperCase());
        const custName = escapeHtml(String(order.customer?.name || 'N/A'));
        const custPhone = escapeHtml(String(order.customer?.phone || 'N/A'));
        const pay = escapeHtml(String(order.paymentMethod || 'N/A'));
        const fulfillment = order.customer?.fulfillment === 'delivery' ? 'Delivery' : 'Pickup';
        const deliveryAddr = order.customer?.delivery_address
            ? escapeHtml(String(order.customer.delivery_address))
            : '';
        const slotLabels = { '2pm': '2:00 PM', '8pm': '8:00 PM' };
        const deliverySlot = slotLabels[order.customer?.delivery_slot] || '';
        const adjustNote = pricing.adjust_note ? escapeHtml(String(pricing.adjust_note)) : '';
        const oid = order.id;

        return `
        <article class="order-card">
            <div class="order-header">
                <strong class="order-card__title">Order #${escapeHtml(oid.slice(-6))}</strong>
                <span class="status-badge status-${status}">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="order-details">
                <p><span class="order-detail__label">Customer</span> ${custName} · ${custPhone}</p>
                <p><span class="order-detail__label">Fulfillment</span> ${escapeHtml(fulfillment)}</p>
                ${deliveryAddr ? `<p><span class="order-detail__label">Deliver to</span> ${deliveryAddr}</p>` : ''}
                ${deliverySlot ? `<p><span class="order-detail__label">Delivery time</span> ${deliverySlot}</p>` : ''}
                <p><span class="order-detail__label">Items</span> ${items || 'N/A'}</p>
                <p><span class="order-detail__label">Subtotal</span> $${subtotal}</p>
                <p><span class="order-detail__label">GST / PST</span> $${gst} / $${pst}</p>
                <p><span class="order-detail__label">Order total</span> <strong>$${total}</strong></p>
                ${adjusted ? `
                <p class="adjusted-total-line">
                    <span class="order-detail__label">Final total</span>
                    <strong class="adjusted-amount">$${displayTotal}</strong>
                    <span class="adjusted-badge">adjusted</span>
                </p>` : ''}
                ${adjustNote ? `<p class="adjust-note-line"><span class="order-detail__label">Adjust note</span> ${adjustNote}</p>` : ''}
                <p><span class="order-detail__label">Payment</span> ${pay}</p>
                <p><span class="order-detail__label">Placed</span> ${date}</p>
            </div>
            <div class="order-actions">
                <div class="order-actions__row">
                    <select id="order-status-${oid}" onchange="handleUpdateOrderStatus('${oid}', this.value)" aria-label="Update order status">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="ready" ${status === 'ready' ? 'selected' : ''}>Ready</option>
                        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    <button type="button" class="btn-adjust-total" onclick="toggleAdjustTotal('${oid}')" aria-label="Adjust final total">
                        <svg class="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Adjust total
                    </button>
                </div>
                <div id="adjust-panel-${oid}" class="adjust-panel" hidden>
                    <p class="adjust-panel__hint">Weights on fresh items may differ. Enter the final amount the customer should pay.</p>
                    <div class="adjust-panel__fields">
                        <div class="adjust-panel__input-wrap">
                            <span class="adjust-panel__currency">$</span>
                            <input type="number" id="adjust-value-${oid}" step="0.01" min="0"
                                   value="${adjusted ? Number(pricing.adjusted_total).toFixed(2) : total}"
                                   class="adjust-panel__input" aria-label="Adjusted total">
                        </div>
                        <input type="text" id="adjust-note-${oid}" class="adjust-panel__note"
                               value="${adjustNote}" placeholder="Reason (optional, e.g. weight adjusted)">
                    </div>
                    <div class="adjust-panel__actions">
                        <button type="button" class="btn-adjust-save" onclick="saveAdjustedTotal('${oid}')">Save</button>
                        <button type="button" class="btn-adjust-cancel" onclick="toggleAdjustTotal('${oid}')">Cancel</button>
                        ${adjusted ? `<button type="button" class="btn-adjust-reset" onclick="resetAdjustedTotal('${oid}')">Reset to original</button>` : ''}
                    </div>
                </div>
            </div>
        </article>`;
    }).join('');
}

window.handleUpdateOrderStatus = async function(orderId, newStatus) {
    try {
        const normalized = normalizeOrderStatus(newStatus);
        await updateOrderStatus(orderId, normalized);
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = normalized;
        updateStatistics();
        displayOrders();
    } catch (err) {
        console.error('Error updating order:', err);
        alert('Failed to update order status.');
    }
};

window.toggleAdjustTotal = function(orderId) {
    const panel = document.getElementById('adjust-panel-' + orderId);
    if (panel) panel.hidden = !panel.hidden;
};

window.saveAdjustedTotal = async function(orderId) {
    const input = document.getElementById('adjust-value-' + orderId);
    const noteInput = document.getElementById('adjust-note-' + orderId);
    const value = parseFloat(input?.value);
    if (isNaN(value) || value < 0) {
        alert('Please enter a valid dollar amount.');
        return;
    }
    const note = noteInput?.value?.trim() || '';
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const newPricing = {
        ...order.pricing,
        adjusted_total: Math.round(value * 100) / 100,
        adjust_note: note || undefined,
    };
    if (!note) delete newPricing.adjust_note;

    try {
        const saved = await updateOrderPricing(orderId, newPricing);
        order.pricing = saved;
        updateStatistics();
        displayOrders();
    } catch (err) {
        console.error('Error adjusting total:', err);
        alert('Failed to adjust total: ' + (err.message || err));
    }
};

window.resetAdjustedTotal = async function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    const newPricing = { ...order.pricing };
    delete newPricing.adjusted_total;
    delete newPricing.adjust_note;

    try {
        const saved = await updateOrderPricing(orderId, newPricing);
        order.pricing = saved;
        updateStatistics();
        displayOrders();
    } catch (err) {
        console.error('Error resetting total:', err);
        alert('Failed to reset total: ' + (err.message || err));
    }
};

window.refreshOrders = function() {
    loadOrders();
};

window.filterOrders = function(status) {
    const key = status === 'all' ? 'all' : normalizeOrderStatus(status);
    if (key === 'all') {
        filteredOrders = [...allOrders];
    } else {
        filteredOrders = allOrders.filter((o) => normalizeOrderStatus(o.status) === key);
    }
    syncOrderFilterButtons(status === 'all' ? 'all' : key);
    displayOrders();
};

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tabs button').forEach((b) => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    var panel = document.getElementById(tab + 'Tab');
    if (panel) panel.classList.add('active');
    if (tab === 'products' && allProducts.length === 0) loadProducts();
    if (window.location.hash !== '#' + tab) {
        history.replaceState(null, '', '#' + tab);
    }
}

function getAdminTabFromHash() {
    var hash = window.location.hash.replace('#', '');
    var valid = ['orders', 'products'];
    return valid.indexOf(hash) >= 0 ? hash : 'orders';
}

function setupAdminTabs() {
    document.querySelectorAll('.admin-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
    });
    window.addEventListener('hashchange', () => switchAdminTab(getAdminTabFromHash()));
    switchAdminTab(getAdminTabFromHash());
}

async function loadProducts() {
    const container = document.getElementById('productsContainer');
    if (container) container.innerHTML = '<div class="loading">Loading products...</div>';
    try {
        allProducts = await getProductsForAdmin();
        populateProductCategoryFilter();
        filteredProducts = [...allProducts];
        filterProductsList();
    } catch (err) {
        console.error('Error loading products:', err);
        if (container) container.innerHTML = '<div class="error">Error loading products. Please check your Supabase configuration.</div>';
    }
}

window.filterProductsList = function() {
    const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const category = document.getElementById('productCategoryFilter')?.value || '';
    const featured = document.getElementById('productFeaturedFilter')?.value || '';
    filteredProducts = allProducts.filter(p => {
        if (search && !(p.name || '').toLowerCase().includes(search) && !(p.description || '').toLowerCase().includes(search)) return false;
        if (category && p.category !== category) return false;
        if (featured === 'yes' && !p.featured) return false;
        if (featured === 'no' && p.featured) return false;
        return true;
    });
    displayProducts();
};

function displayProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="no-orders">No products found.</div>';
        return;
    }
    const getImgPath = (p) => {
        const img = (p.image != null && String(p.image).trim()) || '';
        if (!img || img.length <= 4) return null;
        if (/^https?:\/\//i.test(img)) return img;
        if (img.startsWith('images/')) return img;
        const relPrefixes = ['meat/', 'dairy/', 'pantry/', 'vegetables/', 'bakery/', 'beverages/', 'fruits/', 'oils/', 'spices/', 'rice/', 'tea/', 'households/'];
        if (relPrefixes.some(prefix => img.startsWith(prefix))) return 'images/' + img;
        return 'images/' + img;
    };

    container.innerHTML = `
        <table class="product-table">
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Category</th>
                    <th>Featured</th>
                    <th>Stock</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filteredProducts.map(p => {
                    const imgPath = getImgPath(p);
                    const emoji = p.fallbackEmoji || p.image || '🛒';
                    const imgCell = imgPath
                        ? `<img src="${imgPath}" class="product-img" alt="" onerror="this.outerHTML='<div class=\\'product-img emoji\\'>${emoji.replace(/"/g, '&quot;')}</div>'">`
                        : `<div class="product-img emoji">${emoji}</div>`;
                    return `
                    <tr>
                        <td>${imgCell}</td>
                        <td><strong>${escapeHtml(p.name || '')}</strong></td>
                        <td>$${(p.price || 0).toFixed(2)} / ${escapeHtml(p.unit || '')}</td>
                        <td>${escapeHtml(p.category || '')} ${p.subcategory ? `(${escapeHtml(p.subcategory)})` : ''}</td>
                        <td class="featured-cell"><span class="badge ${p.featured ? 'badge-featured' : ''}">${p.featured ? 'Yes' : 'No'}</span><button type="button" class="btn-featured-toggle" onclick="toggleProductFeatured('${p.id}', ${!p.featured})" title="Toggle">${p.featured ? 'Unfeature' : 'Feature'}</button></td>
                        <td class="stock-cell"><span class="badge badge-stock-state ${p.inStock !== false ? 'badge-stock' : 'badge-out'}">${p.inStock !== false ? 'In stock' : 'Out'}</span></td>
                        <td class="product-actions">
                            <button type="button" class="btn-edit" onclick="editProduct('${p.id}')">Edit</button>
                            <button type="button" class="btn-delete" onclick="confirmDeleteProduct('${p.id}')">Remove</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

window.loadProducts = loadProducts;

window.openProductModal = function(product = null) {
    document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('productId').value = product?.id || '';
    document.getElementById('productName').value = product?.name || '';
    document.getElementById('productPrice').value = product?.price ?? '';
    document.getElementById('productUnit').value = product?.unit || '';
    document.getElementById('productCategory').value = product?.category || 'meat';
    document.getElementById('productSubcategory').value = product?.subcategory || '';
    document.getElementById('productSortOrder').value = product?.sortOrder ?? '';
    document.getElementById('productImage').value = product?.image || '';
    document.getElementById('productFallbackEmoji').value = product?.fallbackEmoji || '🛒';
    document.getElementById('productDescription').value = product?.description || '';
    document.getElementById('productInStock').checked = product?.inStock !== false;
    document.getElementById('productFeatured').checked = !!product?.featured;
    document.getElementById('productModal').classList.add('show');
};

window.closeProductModal = function() {
    document.getElementById('productModal')?.classList.remove('show');
};

window.editProduct = function(id) {
    const p = allProducts.find(x => x.id === id);
    if (p) openProductModal(p);
};

window.saveProduct = async function() {
    const id = document.getElementById('productId').value;
    const sortOrderVal = document.getElementById('productSortOrder').value;
    const data = {
        name: document.getElementById('productName').value.trim(),
        price: parseFloat(document.getElementById('productPrice').value) || 0,
        unit: document.getElementById('productUnit').value.trim() || 'each',
        category: document.getElementById('productCategory').value,
        subcategory: document.getElementById('productSubcategory').value.trim() || null,
        sortOrder: sortOrderVal ? parseInt(sortOrderVal, 10) : 9999,
        image: document.getElementById('productImage').value.trim() || '',
        fallbackEmoji: document.getElementById('productFallbackEmoji').value.trim() || '🛒',
        description: document.getElementById('productDescription').value.trim() || '',
        inStock: document.getElementById('productInStock').checked,
        featured: document.getElementById('productFeatured').checked
    };
    if (!data.name) {
        alert('Name is required');
        return;
    }
    try {
        if (id) {
            await updateProduct(id, data);
            const idx = allProducts.findIndex(p => p.id === id);
            if (idx >= 0) allProducts[idx] = { ...allProducts[idx], ...data };
        } else {
            const newId = await addProduct(data);
            allProducts.push({ id: newId, ...data });
        }
        closeProductModal();
        filterProductsList();
        notifyCatalogChanged();
    } catch (err) {
        console.error('Error saving product:', err);
        alert('Failed to save product: ' + err.message);
    }
};

window.toggleProductFeatured = async function(id, featured) {
    try {
        await setProductFeatured(id, featured);
        const p = allProducts.find(x => x.id === id);
        if (p) p.featured = featured;
        filterProductsList();
        notifyCatalogChanged();
    } catch (err) {
        console.error('Error toggling featured:', err);
        alert('Failed to update: ' + err.message);
    }
};

window.confirmDeleteProduct = function(id) {
    const p = allProducts.find(x => x.id === id);
    const name = p?.name || 'this product';
    if (!confirm(`Permanently remove "${name}"? This cannot be undone.`)) return;
    deleteProduct(id).then(() => {
        allProducts = allProducts.filter(x => x.id !== id);
        filterProductsList();
        notifyCatalogChanged();
    }).catch(err => {
        console.error('Error removing product:', err);
        alert('Failed to remove: ' + err.message);
    });
};

/* ── Admin Turnstile ─────────────────────────────────────────── */
let adminWidgetId = null;
let turnstileFailed = false;

function initAdminTurnstile() {
    if (typeof turnstile === 'undefined') {
        setTimeout(initAdminTurnstile, 150);
        return;
    }
    const mount = document.getElementById('adminCaptcha');
    if (!mount || adminWidgetId !== null) return;
    adminWidgetId = turnstile.render('#adminCaptcha', {
        sitekey: getTurnstileSiteKey(),
        theme: 'light',
        size: 'normal',
        'error-callback': function () {
            turnstileFailed = true;
            console.warn('Turnstile error on admin login — check site key and domain allowlist in Cloudflare.');
        }
    });
}

function getAdminCaptchaToken() {
    if (typeof turnstile === 'undefined' || adminWidgetId === null) return '';
    return turnstile.getResponse(adminWidgetId) || '';
}

function resetAdminCaptcha() {
    if (typeof turnstile !== 'undefined' && adminWidgetId !== null) {
        turnstile.reset(adminWidgetId);
    }
}

function showAdminLoginError(msg) {
    const el = document.getElementById('adminLoginError');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

/* ── DOMContentLoaded ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const btn = loginForm.querySelector('button[type="submit"]');

            showAdminLoginError('');

            const captchaToken = getAdminCaptchaToken();
            if (!captchaToken && !turnstileFailed) {
                showAdminLoginError('Please complete the CAPTCHA verification.');
                return;
            }

            if (btn) btn.disabled = true;
            try {
                await signIn(email, password, captchaToken);
            } catch (err) {
                showAdminLoginError('Login failed: ' + (err.message || 'check your email and password.'));
                resetAdminCaptcha();
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => signOut());
    }

    const productModal = document.getElementById('productModal');
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) closeProductModal();
        });
    }
});
