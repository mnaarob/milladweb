import { getAllProducts } from './products.js?v=3';
import { addToCartAndNotify } from './cart-ui.js';
import { lockBodyScroll, unlockBodyScroll } from './scroll-lock.js';

const IMAGE_PREFIXES = [
    'meat/', 'pantry/', 'dairy/', 'vegetables/', 'bakery/', 'beverages/', 'fruits/',
    'oils/', 'spices/', 'rice/', 'tea/', 'households/'
];

function getImageUrl(product) {
    const raw = product?.image != null ? String(product.image).trim() : '';
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (IMAGE_PREFIXES.some(p => raw.startsWith(p))) return 'images/' + raw;
    if (raw.startsWith('images/')) return raw;
    return raw.length > 4 ? raw : null;
}

function openProductModal(product) {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    const imgEl = modal.querySelector('.product-modal__img');
    const nameEl = modal.querySelector('.product-modal__name');
    const priceEl = modal.querySelector('.product-modal__price');
    const unitEl = modal.querySelector('.product-modal__unit');
    const qtyInput = modal.querySelector('#productModalQty');
    const notesWrap = modal.querySelector('.product-modal__notes-wrap');
    const notesInput = modal.querySelector('#productModalNotes');
    const addBtn = modal.querySelector('#productModalAddBtn');

    const imgUrl = getImageUrl(product);
    if (imgEl) {
        if (imgUrl) {
            imgEl.style.backgroundImage = `url(${imgUrl})`;
            imgEl.style.backgroundSize = 'contain';
            imgEl.style.backgroundPosition = 'center';
            imgEl.style.backgroundRepeat = 'no-repeat';
            imgEl.innerHTML = '';
        } else {
            imgEl.style.backgroundImage = '';
            imgEl.style.backgroundRepeat = '';
            imgEl.innerHTML = `<div class="product-emoji" style="font-size:64px;display:flex;align-items:center;justify-content:center;height:100%;">${product.fallbackEmoji || '🛒'}</div>`;
        }
    }
    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = '$' + product.price.toFixed(2);
    if (unitEl) unitEl.textContent = ' / ' + (product.unit || 'each');
    if (qtyInput) qtyInput.value = '1';
    if (notesInput) notesInput.value = '';

    const isMeat = product.category === 'meat';
    if (notesWrap) notesWrap.style.display = isMeat ? 'block' : 'none';

    if (addBtn) {
        if (!product.inStock) {
            addBtn.disabled = true;
            addBtn.textContent = 'Out of Stock';
            addBtn.onclick = null;
        } else {
            addBtn.disabled = false;
            addBtn.textContent = 'Add to Cart';
            addBtn.onclick = () => {
                const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10) || 1);
                const notes = (notesInput?.value || '').trim();
                addToCartAndNotify(product, qty, notes);
                closeProductModal();
            };
        }
    }

    if (modal.dataset.scrollLocked !== '1') {
        lockBodyScroll();
        modal.dataset.scrollLocked = '1';
    }
    modal.style.display = 'flex';
    var body = modal.querySelector('.product-modal__body');
    if (body) body.scrollTop = 0;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            modal.classList.add('open');
        });
    });
}

export function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    modal.classList.remove('open');
    if (modal.dataset.scrollLocked === '1') {
        delete modal.dataset.scrollLocked;
        unlockBodyScroll();
    }
    var handler = function () {
        if (modal.classList.contains('open')) return;
        modal.style.display = 'none';
        modal.removeEventListener('transitionend', handler);
    };
    modal.addEventListener('transitionend', handler);
    setTimeout(function () {
        if (!modal.classList.contains('open')) modal.style.display = 'none';
    }, 350);
}

export function openProductModalById(productId) {
    const products = getAllProducts();
    const product = products.find(p => p.id === productId);
    if (product) openProductModal(product);
}

export function initProductModal() {
    document.addEventListener('openProductModal', (e) => {
        const { productId } = e.detail || {};
        if (productId) openProductModalById(productId);
    });

    document.addEventListener('click', (e) => {
        const card = e.target.closest('[data-product-id]');
        if (card) {
            e.preventDefault();
            e.stopPropagation();
            const id = card.dataset.productId;
            if (id) openProductModalById(id);  // modal itself handles the out-of-stock state
        }

        const qtyBtn = e.target.closest('[data-product-qty]');
        if (qtyBtn) {
            const input = document.getElementById('productModalQty');
            if (input) {
                const delta = parseInt(qtyBtn.dataset.productQty, 10);
                let val = parseInt(input.value, 10) || 1;
                val = Math.max(1, Math.min(99, val + delta));
                input.value = String(val);
            }
        }
    });

    const modal = document.getElementById('productModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProductModal();
        });
        const closeBtn = modal.querySelector('.product-modal__close');
        if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
    }
}
