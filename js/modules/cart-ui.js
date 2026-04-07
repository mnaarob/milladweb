import * as cart from './cart.js';
import { cartItemTemplate, pricingBreakdownTemplate } from '../templates/html.js';
import { openCartModal, closeCartModal } from './animations.js';

function renderCartItems() {
    const cartItemsEl = document.getElementById('cartItems');
    if (!cartItemsEl) return;

    const items = cart.getItems();

    if (items.length === 0) {
        cartItemsEl.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        return;
    }

    const pricing = cart.getPricing();
    const itemsHtml = items.map(item => cartItemTemplate(item)).join('');
    const breakdownHtml = pricingBreakdownTemplate(pricing, cart.hasTaxExemptItems());

    cartItemsEl.innerHTML = itemsHtml + breakdownHtml;
}

function updateBadges() {
    const count = cart.getCount();
    const pricing = cart.getPricing();
    const totalStr = '$' + pricing.total.toFixed(2);

    const ids = {
        counts: ['cartCount', 'mobileCartCount'],
        totals: ['cartTotal', 'mobileCartTotal'],
        amounts: ['cartTotalAmount']
    };

    ids.counts.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = count;
    });

    ids.totals.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = totalStr;
    });

    ids.amounts.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = pricing.total.toFixed(2);
    });
}

function showNotification() {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = 'Added to cart!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

export function addToCartAndNotify(product, quantity = 1, notes = '') {
    cart.addItem(product, quantity, notes);
    showNotification();
}

export function initCart() {
    cart.onChange(() => {
        renderCartItems();
        updateBadges();
    });

    renderCartItems();
    updateBadges();

    const cartBtn = document.getElementById('cartBtn');
    const mobileCartBtn = document.getElementById('mobileCartBtn');
    const closeCartBtn = document.getElementById('closeCart');
    const cartModal = document.getElementById('cartModal');

    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCartModal();
        });
    }

    if (mobileCartBtn) {
        mobileCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCartModal();
        });
    }

    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => closeCartModal());
    }

    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) closeCartModal();
        });

        cartModal.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-qty-change]');
            if (!btn) return;
            const id = btn.dataset.qtyChange;
            const delta = parseInt(btn.dataset.delta, 10);
            cart.updateQuantity(id, delta);
        });
    }
}
