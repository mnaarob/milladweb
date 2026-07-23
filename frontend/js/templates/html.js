export function featuredCardTemplate(product) {
    const filterClass = product.subcategory || product.category;
    const imagePath = resolveImagePath(product);
    const hasImage = imagePath && !imagePath.startsWith('data:');

    const picContent = hasImage
        ? `data-setbg="${imagePath}"`
        : '';
    const picClass = hasImage ? 'featured__item__pic set-bg' : 'featured__item__pic';
    const picInner = hasImage
        ? ''
        : `<div class="product-emoji" style="font-size:80px;display:flex;align-items:center;justify-content:center;height:100%;">${product.fallbackEmoji || '🛒'}</div>`;

    return `
    <div class="col-6 col-lg-3 col-md-4 col-sm-6 mix ${filterClass}" data-product-id="${product.id}">
        <div class="featured__item">
            <div class="${picClass}" ${picContent}>
                ${picInner}
                <ul class="featured__item__pic__hover">
                    <li><a href="#" data-add-to-cart="${product.id}">
                        <svg class="icon icon-shopping-cart" aria-hidden="true"><use href="/img/icons.svg#icon-shopping-cart"></use></svg>
                    </a></li>
                </ul>
            </div>
            <div class="featured__item__text">
                <h6><a href="#">${product.name}</a></h6>
                <h5>$${product.price.toFixed(2)}/${product.unit}</h5>
            </div>
        </div>
    </div>`;
}

const IMAGE_PATH_PREFIXES = [
    'meat/', 'pantry/', 'dairy/', 'vegetables/', 'bakery/', 'beverages/', 'fruits/',
    'oils/', 'spices/', 'rice/', 'tea/', 'households/'
];

function resolveImagePath(product) {
    const raw = product.image != null ? String(product.image).trim() : '';
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (IMAGE_PATH_PREFIXES.some(p => raw.startsWith(p))) {
        return 'images/' + raw;
    }
    if (raw.startsWith('images/')) return raw;
    if (raw.length <= 4) return null;
    return raw;
}

export function shopProductCardTemplate(product) {
    const imagePath = resolveImagePath(product);
    const hasImage = imagePath && !imagePath.startsWith('data:');
    const outOfStock = !product.inStock;

    const imageHtml = hasImage
        ? `<img src="${imagePath}" alt="${product.name}" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<div class=product-emoji>${product.fallbackEmoji || '🛒'}</div>'">`
        : `<div class="product-emoji">${product.fallbackEmoji || '🛒'}</div>`;

    const addToCartHtml = outOfStock
        ? `<li><span class="out-of-stock-btn" title="Out of stock"><svg class="icon icon-ban" aria-hidden="true"><use href="/img/icons.svg#icon-ban"></use></svg></span></li>`
        : `<li><a href="#" data-add-to-cart="${product.id}"><svg class="icon icon-shopping-cart" aria-hidden="true"><use href="/img/icons.svg#icon-shopping-cart"></use></svg></a></li>`;

    const outOfStockBadge = outOfStock
        ? `<div class="out-of-stock-badge">Out of Stock</div>`
        : '';

    return `
    <div class="col-6 col-lg-4 col-md-6 col-sm-6" data-product-id="${product.id}"${outOfStock ? ' data-out-of-stock="true"' : ''}>
        <div class="product__item${outOfStock ? ' product__item--out-of-stock' : ''}">
            <div class="product__item__pic">
                ${imageHtml}
                ${outOfStockBadge}
                <ul class="product__item__pic__hover">
                    ${addToCartHtml}
                </ul>
            </div>
            <div class="product__item__text">
                <h6><a href="#">${product.name}</a></h6>
                <span>${product.unit}</span>
                <h5>${outOfStock ? '<span class="price-muted">$' + product.price.toFixed(2) + '</span>' : '$' + product.price.toFixed(2)}</h5>
            </div>
        </div>
    </div>`;
}

export function cartItemTemplate(item) {
    const imagePath = resolveImagePath(item);
    const hasImage = imagePath && !imagePath.startsWith('data:');
    const imgHtml = hasImage
        ? `<img src="${imagePath}" alt="${item.name}" decoding="async">`
        : `<span style="font-size:24px">${item.fallbackEmoji || '🛒'}</span>`;
    const lineId = item.lineId || item.id + '|' + (item.notes || '');
    const notesHtml = item.notes
        ? `<div class="cart-item-notes">${escapeHtml(item.notes)}</div>`
        : '';

    return `
    <div class="cart-item">
        <div class="cart-item-image">${imgHtml}</div>
        <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            ${notesHtml}
            <div class="cart-item-price">$${item.price.toFixed(2)} ${item.unit}</div>
        </div>
        <div class="quantity-controls">
            <button class="quantity-btn" data-qty-change="${lineId}" data-delta="-1">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" data-qty-change="${lineId}" data-delta="1">+</button>
        </div>
        <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
    </div>`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function pricingBreakdownTemplate(pricing, hasTaxExemptItems) {
    const taxNote = hasTaxExemptItems
        ? '<div class="tax-exempt-note">* Some items are tax-exempt</div>'
        : '';

    return `
    <div class="pricing-breakdown">
        <div class="pricing-line"><span>Subtotal:</span><span>$${pricing.subtotal.toFixed(2)}</span></div>
        <div class="pricing-line"><span>GST (5%):</span><span>$${pricing.gst.toFixed(2)}</span></div>
        <div class="pricing-line"><span>PST (7%):</span><span>$${pricing.pst.toFixed(2)}</span></div>
        ${taxNote}
        <div class="pricing-line total-line"><span><strong>Total:</strong></span><span><strong>$${pricing.total.toFixed(2)}</strong></span></div>
    </div>`;
}

export function checkoutItemTemplate(item) {
    const notesPart = item.notes ? ` (${item.notes})` : '';
    return `
    <div class="checkout-item">
        <span>${item.name} x ${item.quantity}${notesPart}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
    </div>`;
}

export function checkoutPricingTemplate(pricing, hasTaxExemptItems) {
    const taxNote = hasTaxExemptItems
        ? '<div class="checkout-tax-exempt-note">* Some items are tax-exempt</div>'
        : '';

    return `
    <div class="checkout-pricing-breakdown">
        <div class="checkout-pricing-line"><span>Subtotal:</span><span>$${pricing.subtotal.toFixed(2)}</span></div>
        <div class="checkout-pricing-line"><span>GST (5%):</span><span>$${pricing.gst.toFixed(2)}</span></div>
        <div class="checkout-pricing-line"><span>PST (7%):</span><span>$${pricing.pst.toFixed(2)}</span></div>
        ${taxNote}
    </div>`;
}

export function categoryLinkTemplate(category) {
    const id = encodeURIComponent(category.id);
    return `<li><a href="/shop?category=${id}" data-category="${category.id}">${category.name}</a></li>`;
}
