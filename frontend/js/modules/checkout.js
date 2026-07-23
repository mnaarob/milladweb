import * as cart from './cart.js';
import { saveOrder } from '../services/database.js?v=3';
import { getCurrentUser } from '../services/auth.js';
import { checkoutItemTemplate, checkoutPricingTemplate } from '../templates/html.js';
import { closeCartModal } from './animations.js';
import { lockBodyScroll, unlockBodyScroll } from './scroll-lock.js';

const PAYMENT_HTML = {
    pickup: '<strong>Cash on pickup</strong> — pay when you collect your order at the store.',
    delivery:
        '<strong>Cash on delivery</strong> — pay when your order arrives. If weights differ, we\'ll confirm the final total by phone.',
};

const DELIVERY_CITY_LINE = 'Winnipeg, MB';

/** Single-line address for orders and email (city is always Winnipeg). */
function formatDeliveryAddress(street, unit, postal) {
    const s = street.trim();
    const u = unit.trim();
    const pc = postal.replace(/\s+/g, ' ').trim().toUpperCase();
    const line1 = u ? `${s}, ${u}` : s;
    return `${line1}, ${DELIVERY_CITY_LINE} ${pc}`;
}

function resetCheckoutUI() {
    const form = document.getElementById('checkout-form');
    const success = document.getElementById('checkoutSuccess');
    const err = document.getElementById('checkoutError');
    if (form) form.hidden = false;
    if (success) success.hidden = true;
    if (err) {
        err.hidden = true;
        err.textContent = '';
    }
}

/** In-modal confirmation (reliable after async; browsers often block post-await alert()). */
function showCheckoutSuccess(fulfillment, orderId) {
    const form = document.getElementById('checkout-form');
    const panel = document.getElementById('checkoutSuccess');
    const msgEl = document.getElementById('checkoutSuccessMessage');
    const refEl = document.getElementById('checkoutSuccessOrderRef');

    if (form) form.hidden = true;
    if (panel) {
        panel.hidden = false;
        requestAnimationFrame(() => {
            panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }
    if (msgEl) {
        msgEl.textContent =
            fulfillment === 'delivery'
                ? 'We received your order. We will call you to confirm delivery and your order.'
                : 'We received your order. We will call you when it is ready for pickup.';
    }
    if (refEl) {
        if (orderId && typeof orderId === 'string' && orderId.length > 0) {
            refEl.textContent = `Order reference: #${orderId.slice(-6).toUpperCase()}`;
            refEl.hidden = false;
        } else {
            refEl.textContent = '';
            refEl.hidden = true;
        }
    }
}

function syncFulfillmentUI() {
    const mode = document.querySelector('input[name="fulfillment"]:checked')?.value || 'pickup';
    const pickupBlock = document.getElementById('pickupLocationBlock');
    const deliveryFields = document.getElementById('deliveryFields');
    const pickupOnly = document.getElementById('pickupOnlyBlock');
    const deliveryOnly = document.getElementById('deliveryOnlyBlock');
    const streetEl = document.getElementById('deliveryStreet');
    const postalEl = document.getElementById('deliveryPostal');
    const cashText = document.getElementById('cashPaymentText');

    if (pickupBlock) pickupBlock.hidden = mode !== 'pickup';
    if (deliveryFields) deliveryFields.hidden = mode !== 'delivery';
    if (pickupOnly) pickupOnly.hidden = mode !== 'pickup';
    if (deliveryOnly) deliveryOnly.hidden = mode !== 'delivery';
    const req = mode === 'delivery';
    if (streetEl) streetEl.required = req;
    if (postalEl) postalEl.required = req;
    if (cashText) cashText.innerHTML = PAYMENT_HTML[mode] || PAYMENT_HTML.pickup;
}

function populateCheckoutItems() {
    const checkoutItemsEl = document.getElementById('checkoutItems');
    const checkoutTotalEl = document.getElementById('checkoutTotal');
    if (!checkoutItemsEl) return;

    const items = cart.getItems();
    const pricing = cart.getPricing();

    const itemsHtml = items.map(item => checkoutItemTemplate(item)).join('');
    const pricingHtml = checkoutPricingTemplate(pricing, cart.hasTaxExemptItems());

    checkoutItemsEl.innerHTML = itemsHtml + pricingHtml;
    if (checkoutTotalEl) checkoutTotalEl.textContent = pricing.total.toFixed(2);
}

async function openCheckout() {
    if (cart.getItems().length === 0) {
        alert('Your cart is empty!');
        return;
    }

    const modal = document.getElementById('checkoutModal');
    if (modal && modal.dataset.scrollLocked !== '1') {
        lockBodyScroll();
        modal.dataset.scrollLocked = '1';
    }
    closeCartModal();
    if (modal) {
        modal.classList.add('checkout-modal--open');
    }

    populateCheckoutItems();
    resetCheckoutUI();
    syncFulfillmentUI();

    const user = await getCurrentUser();
    if (user?.user_metadata) {
        const nameEl = document.getElementById('customerName');
        const phoneEl = document.getElementById('customerPhone');
        const emailEl = document.getElementById('customerEmail');
        if (nameEl) nameEl.value = user.user_metadata.full_name || '';
        if (phoneEl) phoneEl.value = user.user_metadata.phone || '';
        if (emailEl && !emailEl.value) emailEl.value = user.email || '';
    }
}

function closeCheckout() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.classList.remove('checkout-modal--open');
        if (modal.dataset.scrollLocked === '1') {
            delete modal.dataset.scrollLocked;
            unlockBodyScroll();
        }
    }
    resetCheckoutUI();
}

async function handleSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('customerName')?.value?.trim();
    const phone = document.getElementById('customerPhone')?.value?.trim();
    if (!name || !phone) {
        alert('Please fill in your name and phone number.');
        return;
    }

    const fulfillment =
        document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery' ? 'delivery' : 'pickup';

    let deliveryAddressRaw = '';
    if (fulfillment === 'delivery') {
        const street = document.getElementById('deliveryStreet')?.value?.trim() || '';
        const unit = document.getElementById('deliveryUnit')?.value?.trim() || '';
        const postal = document.getElementById('deliveryPostal')?.value?.trim() || '';
        const postalCompact = postal.replace(/\s/g, '');
        if (street.length < 3) {
            alert('Please enter your street address.');
            return;
        }
        if (postalCompact.length < 6) {
            alert('Please enter a complete postal code (e.g. R3B 1A1).');
            return;
        }
        if (!/^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(postalCompact)) {
            alert('Please enter a valid Canadian postal code (e.g. R3B 1A1).');
            return;
        }
        deliveryAddressRaw = formatDeliveryAddress(street, unit, postal);
    }

    const errEl = document.getElementById('checkoutError');
    if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
    }

    const submitBtn = document.querySelector('#checkout-form .place-order-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    }

    try {
        const email = document.getElementById('customerEmail')?.value?.trim() || undefined;
        const paymentMethod = 'cash';
        const paymentToken = null;

        const items = cart.getItems();
        const pricing = cart.getPricing();

        const orderData = {
            customer: {
                name,
                phone,
                ...(email && { email }),
                fulfillment,
                ...(fulfillment === 'delivery' && deliveryAddressRaw
                    ? { delivery_address: deliveryAddressRaw }
                    : {}),
            },
            items: items.map(i => ({
                id: i.id,
                name: i.name,
                price: i.price,
                unit: i.unit,
                quantity: i.quantity,
                category: i.category,
                notes: i.notes || ''
            })),
            pricing: {
                subtotal: pricing.subtotal,
                gst: pricing.gst,
                pst: pricing.pst,
                total: pricing.total
            },
            paymentMethod,
            paymentToken: paymentToken ? paymentToken.id : null
        };

        const result = await saveOrder(orderData);
        cart.clear();

        const orderId = result?.order?.id;
        showCheckoutSuccess(fulfillment, orderId);
    } catch (err) {
        console.error('Order error:', err);
        let message = 'Error placing order. Please try again.';
        if (err instanceof Error && err.message) message = err.message;
        else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            message = err.message;
        }
        if (errEl) {
            errEl.textContent = message;
            errEl.hidden = false;
            errEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Place Order';
        }
    }
}

export function initCheckout() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', openCheckout);
    }

    const closeBtn = document.getElementById('closeCheckoutBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCheckout);
    }

    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.addEventListener('click', (e) => {
            if (e.target === checkoutModal) closeCheckout();
        });
    }

    const form = document.getElementById('checkout-form');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
        radio.addEventListener('change', syncFulfillmentUI);
    });
    syncFulfillmentUI();

    const successDone = document.getElementById('checkoutSuccessDone');
    if (successDone) {
        successDone.addEventListener('click', () => {
            closeCheckout();
        });
    }
}
