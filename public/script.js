// Global variables
let products = [];
let cart = [];

// Pricing constants
const GST_RATE = 0.05; // 5% GST
const PST_RATE = 0.07; // 7% PST (Manitoba)

// DOM elements
const cartBtn = document.getElementById('cartBtn');
const mobileCartBtn = document.getElementById('mobileCartBtn');
const cartCount = document.getElementById('cartCount');
const mobileCartCount = document.getElementById('mobileCartCount');
const cartModal = document.getElementById('cartModal');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const mobileCartTotal = document.getElementById('mobileCartTotal');
const cartTotalAmount = document.getElementById('cartTotalAmount');
const searchInput = document.getElementById('searchInput');

// Load products data for cart functionality
async function loadProducts() {
    try {
        const response = await fetch('products.json');
        const data = await response.json();
        products = data.products;
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Add product to cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    updateCartDisplay();
    showCartNotification();
}

// Calculate pricing breakdown
function calculatePricing() {
    const subtotal = cart.reduce((sum, item) => {
        if (item.variableWeight && item.displayPrice === 'estimated') {
            const estimatedPrice = item.price * item.estimatedMaxWeight;
            return sum + (estimatedPrice * item.quantity);
        }
        return sum + (item.price * item.quantity);
    }, 0);
    
    // Tax only for non-meat items (meat is tax-exempt)
    const taxableSubtotal = cart.reduce((sum, item) => {
        if (item.category === 'meat') return sum;
        if (item.variableWeight && item.displayPrice === 'estimated') {
            const estimatedPrice = item.price * item.estimatedMaxWeight;
            return sum + (estimatedPrice * item.quantity);
        }
        return sum + (item.price * item.quantity);
    }, 0);
    
    const gst = taxableSubtotal * GST_RATE;
    const pst = taxableSubtotal * PST_RATE;
    const total = subtotal + gst + pst;
    
    return { subtotal, taxableSubtotal, gst, pst, total };
}

// Update cart display
function updateCartDisplay() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const pricing = calculatePricing();
    
    // Update counts and totals
    if (cartCount) cartCount.textContent = totalItems;
    if (mobileCartCount) mobileCartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = '$' + pricing.total.toFixed(2);
    if (mobileCartTotal) mobileCartTotal.textContent = '$' + pricing.total.toFixed(2);
    if (cartTotalAmount) cartTotalAmount.textContent = pricing.total.toFixed(2);
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        return;
    }
    
    const cartHTML = cart.map(item => {
        const hasImage = item.image && (item.image.includes('.jpg') || item.image.includes('.png'));
        const itemTotal = (item.price * item.quantity).toFixed(2);
        
        return `
        <div class="cart-item">
            <div class="cart-item-image">
                ${hasImage ? `<img src="${item.image}" alt="${item.name}">` : `<span style="font-size:24px">${item.fallbackEmoji || '🛒'}</span>`}
            </div>
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)} ${item.unit}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
            </div>
            <div class="cart-item-total">$${itemTotal}</div>
        </div>
        `;
    }).join('');
    
    const hasTaxExemptItems = cart.some(item => item.taxExempt);
    const taxNote = hasTaxExemptItems ? '<div class="tax-exempt-note">* Some items are tax-exempt</div>' : '';
    
    const pricingBreakdown = `
        <div class="pricing-breakdown">
            <div class="pricing-line"><span>Subtotal:</span><span>$${pricing.subtotal.toFixed(2)}</span></div>
            <div class="pricing-line"><span>GST (5%):</span><span>$${pricing.gst.toFixed(2)}</span></div>
            <div class="pricing-line"><span>PST (7%):</span><span>$${pricing.pst.toFixed(2)}</span></div>
            ${taxNote}
            <div class="pricing-line total-line"><span><strong>Total:</strong></span><span><strong>$${pricing.total.toFixed(2)}</strong></span></div>
        </div>
    `;
    
    cartItems.innerHTML = cartHTML + pricingBreakdown;
}

// Update item quantity
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    item.quantity += change;
    if (item.quantity <= 0) {
        cart = cart.filter(cartItem => cartItem.id !== productId);
    }
    
    updateCartDisplay();
}

// Show notification
function showCartNotification() {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = 'Added to cart!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Proceed to checkout
function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    cartModal.style.display = 'none';
    document.getElementById('checkoutModal').style.display = 'flex';
    
    const pricing = calculatePricing();
    const checkoutItemsHTML = cart.map(item => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;">
            <span>${item.name} x ${item.quantity}</span>
            <span>$${itemTotal}</span>
        </div>`;
    }).join('');
    
    document.getElementById('checkoutItems').innerHTML = checkoutItemsHTML;
    document.getElementById('checkoutTotal').textContent = pricing.total.toFixed(2);
}

// Close checkout
function closeCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cartModal.style.display = 'flex';
        });
    }
    
    if (mobileCartBtn) {
        mobileCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cartModal.style.display = 'flex';
        });
    }
    
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            cartModal.style.display = 'none';
        });
    }
    
    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                cartModal.style.display = 'none';
            }
        });
    }
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.featured__filter .mix').forEach(item => {
                const name = item.querySelector('.featured__item__text h6').textContent.toLowerCase();
                item.style.display = name.includes(query) ? '' : 'none';
            });
        });
        
        searchInput.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupEventListeners();
});

// Close checkout when clicking outside
document.getElementById('checkoutModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('checkoutModal')) {
        closeCheckout();
    }
});
