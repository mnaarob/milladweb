// Payment and Order Management System
// Replace these with your actual keys
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RiO2SIkESFylAb6N1vBYXxOshbsJYH54TpaNwCFpZQql7M1sQthWxw73VknkLAFBWzM6dovrnGAhjRNJz66m61n003wWCYIYA';
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA0vbztYZu0Z1Nj8fZXI2Yc2_43HkAwoS0",
    authDomain: "milladweb-aec90.firebaseapp.com",
    projectId: "milladweb-aec90",
    storageBucket: "milladweb-aec90.firebasestorage.app",
    messagingSenderId: "52950163965",
    appId: "1:52950163965:web:cd685de1110b1f3586b994"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

// Initialize Stripe
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
const elements = stripe.elements();

// Create card element without postal code for local Winnipeg delivery
const cardElement = elements.create('card', {
    style: {
        base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
                color: '#aab7c4',
            },
        },
    },
    hidePostalCode: true // Hide postal code for local delivery
});

// Mount card element and setup payment method toggles
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('card-element')) {
        cardElement.mount('#card-element');
        
        // Setup payment method change handlers
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(method => {
            method.addEventListener('change', function() {
                const cardElementContainer = document.getElementById('card-element');
                if (this.value === 'card') {
                    cardElementContainer.style.display = 'block';
                } else {
                    cardElementContainer.style.display = 'none';
                }
            });
        });
        
        // Initially show card element since card is default
        document.getElementById('card-element').style.display = 'block';
    }
});

// Proceed to checkout
function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    // Show checkout modal
    document.getElementById('checkoutModal').style.display = 'flex';
    
    // Populate checkout items
    populateCheckoutItems();
    
    // Mount card element if not already mounted
    if (!cardElement._mounted) {
        cardElement.mount('#card-element');
    }
    
    // Setup payment method handlers if not already set up
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(method => {
        method.addEventListener('change', function() {
            const cardElementContainer = document.getElementById('card-element');
            if (this.value === 'card') {
                cardElementContainer.style.display = 'block';
            } else {
                cardElementContainer.style.display = 'none';
            }
        });
    });
    
    // Set initial card element visibility based on default selection
    const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (selectedPaymentMethod && selectedPaymentMethod.value === 'card') {
        document.getElementById('card-element').style.display = 'block';
    } else {
        document.getElementById('card-element').style.display = 'none';
    }
}

// Close checkout modal
function closeCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
}

// Populate checkout items
function populateCheckoutItems() {
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');
    
    const pricing = calculatePricing();
    
    const itemsHTML = cart.map(item => `
        <div class="checkout-item">
            <span>${item.name} x ${item.quantity}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    
    // Add pricing breakdown
    const hasTaxExemptItems = cart.some(item => item.taxExempt);
    const taxExemptNote = hasTaxExemptItems ? '<div class="checkout-tax-exempt-note">* Some items are tax-exempt</div>' : '';
    
    const pricingBreakdown = `
        <div class="checkout-pricing-breakdown">
            <div class="checkout-pricing-line">
                <span>Subtotal:</span>
                <span>$${pricing.subtotal.toFixed(2)}</span>
            </div>
            <div class="checkout-pricing-line">
                <span>GST (5%):</span>
                <span>$${pricing.gst.toFixed(2)}</span>
            </div>
            <div class="checkout-pricing-line">
                <span>PST (7%):</span>
                <span>$${pricing.pst.toFixed(2)}</span>
            </div>
            ${taxExemptNote}
        </div>
    `;
    
    checkoutItems.innerHTML = itemsHTML + pricingBreakdown;
    checkoutTotal.textContent = pricing.total.toFixed(2);
}

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleFormSubmit);
    }
});

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const submitButton = document.querySelector('.place-order-btn');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    try {
        // Validate required fields exist
        const nameEl = document.getElementById('customerName');
        const phoneEl = document.getElementById('customerPhone');
        
        if (!nameEl || !phoneEl) {
            throw new Error('Required form fields are missing');
        }
        
        // Validate all fields are filled
        const name = nameEl.value.trim();
        const phone = phoneEl.value.trim();
        
        if (!name || !phone) {
            throw new Error('Please fill in all required fields');
        }
        
        // Get customer information for pickup
        const customerInfo = {
            name: name,
            phone: phone,
            pickupLocation: 'Millads Supermarket, 460 Notre Dame Ave, Winnipeg, MB'
        };
        
        // Get payment method
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        
        // Calculate total with taxes for pickup
        const pricing = calculatePricing();
        
        // Create order object
        const order = {
            id: generateOrderId(),
            customer: customerInfo,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                unit: item.unit
            })),
            pricing: {
                subtotal: pricing.subtotal,
                gst: pricing.gst,
                pst: pricing.pst,
                total: pricing.total
            },
            total: pricing.total,
            paymentMethod: paymentMethod,
            orderType: 'pickup',
            status: 'pending',
            timestamp: new Date(),
            pickupLocation: customerInfo.pickupLocation
        };
        
        if (paymentMethod === 'card') {
            // Process card payment
            await processCardPayment(order);
        } else {
            // Process cash on pickup
            await processCashOrder(order);
        }
        
    } catch (error) {
        console.error('Error processing order:', error);
        alert('There was an error processing your order. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Place Order';
    }
}

// Process card payment
async function processCardPayment(order) {
    try {
        // In a real implementation, you would create a payment intent on your server
        // For demo purposes, we'll simulate the payment
        
        const {token, error} = await stripe.createToken(cardElement);
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Here you would send the token to your server to process the payment
        // For now, we'll just simulate success
        console.log('Payment token:', token);
        
        // Update order status
        order.status = 'paid';
        order.paymentToken = token.id;
        
        // Save order to database
        await saveOrder(order);
        
        // Show success message
        showOrderSuccess(order);
        
    } catch (error) {
        throw new Error(`Payment failed: ${error.message}`);
    }
}

// Process cash on pickup order
async function processCashOrder(order) {
    try {
        // Save order to database
        await saveOrder(order);
        
        // Show success message
        showOrderSuccess(order);
        
    } catch (error) {
        throw new Error(`Order failed: ${error.message}`);
    }
}

// Save order to Firebase
async function saveOrder(order) {
    try {
        console.log('Attempting to save order:', order);
        
        // Check if Firebase is initialized
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        
        await db.collection('orders').doc(order.id).set(order);
        console.log('Order saved successfully to Firebase');
    } catch (error) {
        console.error('Detailed Firebase error:', error);
        
        if (error.code === 'permission-denied') {
            throw new Error('Database permission denied. Please check if Firestore is set up in test mode.');
        } else if (error.code === 'unavailable') {
            throw new Error('Database is currently unavailable. Please try again.');
        } else {
            throw new Error(`Failed to save order: ${error.message}`);
        }
    }
}

// Show order success
function showOrderSuccess(order) {
    closeCheckout();
    
    // Clear cart
    cart = [];
    updateCartDisplay();
    
    // Show success message
    alert(`Pickup order placed successfully! Order ID: ${order.id}\nWe'll call you when your order is ready for pickup.`);
    
    // You can also redirect to a success page
    // window.location.href = 'order-success.html?id=' + order.id;
}

// Generate order ID
function generateOrderId() {
    return 'MSM' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Toggle payment method visibility
document.addEventListener('change', function(e) {
    if (e.target.name === 'paymentMethod') {
        const cardElement = document.getElementById('card-element');
        if (e.target.value === 'card') {
            cardElement.style.display = 'block';
        } else {
            cardElement.style.display = 'none';
        }
    }
});

// Admin functions for checking orders
window.adminFunctions = {
    // Get all orders
    async getAllOrders() {
        try {
            const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
            const orders = [];
            snapshot.forEach(doc => {
                orders.push({id: doc.id, ...doc.data()});
            });
            return orders;
        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    },
    
    // Get orders by status
    async getOrdersByStatus(status) {
        try {
            const snapshot = await db.collection('orders').where('status', '==', status).get();
            const orders = [];
            snapshot.forEach(doc => {
                orders.push({id: doc.id, ...doc.data()});
            });
            return orders;
        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    },
    
    // Update order status
    async updateOrderStatus(orderId, newStatus) {
        try {
            await db.collection('orders').doc(orderId).update({
                status: newStatus,
                updatedAt: new Date()
            });
            console.log('Order status updated successfully');
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    },
    
    // Display orders in console (for testing)
    async displayOrders() {
        const orders = await this.getAllOrders();
        console.table(orders);
    }
};

// Make admin functions globally accessible
window.checkOrders = window.adminFunctions.displayOrders;
window.getAllOrders = window.adminFunctions.getAllOrders;
window.updateOrderStatus = window.adminFunctions.updateOrderStatus; 