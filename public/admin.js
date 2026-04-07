// Admin Panel JavaScript
// Firebase configuration (same as payment.js)
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

// Global variables
let allOrders = [];
let filteredOrders = [];

// DEPRECATED: This legacy admin panel is no longer used.
// The current admin panel uses Supabase Auth — see /admin.html + js/admin-app.js.
const ADMIN_PASSWORD = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    setupLogin();
});

// Setup login functionality
function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginModal = document.getElementById('loginModal');
    const adminPanel = document.getElementById('adminPanel');
    
    // Check if already authenticated
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        showAdminPanel();
        return;
    }
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            showAdminPanel();
        } else {
            loginError.style.display = 'block';
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
        }
    });
}

// Show admin panel after successful authentication
function showAdminPanel() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadOrders();
}

// Logout function
function logout() {
    sessionStorage.removeItem('adminAuthenticated');
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
}

// Adjust item price for variable weight products
function adjustItemPrice(orderId, itemIndex) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order || !order.items[itemIndex]) return;
    
    const item = order.items[itemIndex];
    
    // Handle legacy orders - set default values for Frozen Whole Turkey
    const defaultWeight = item.estimatedMaxWeight || 9.0; // Default to 9kg for turkey
    const currentPrice = item.price || 11.0; // Default price per kg
    const isLegacyOrder = !item.variableWeight;
    
    // For legacy orders, if it shows $11 it's likely per kg, if it shows $99 it's estimated total
    let displayPrice = currentPrice;
    let currentTotal;
    
    if (isLegacyOrder && item.name.toLowerCase().includes('frozen whole turkey')) {
        // If price is around $11, it's per kg. If around $99, it's total estimated
        if (currentPrice > 50) {
            // This is likely the estimated total, calculate back to per kg
            displayPrice = (currentPrice / defaultWeight);
            currentTotal = currentPrice;
        } else {
            // This is per kg price
            displayPrice = currentPrice;
            currentTotal = currentPrice * defaultWeight * item.quantity;
        }
    } else {
        currentTotal = (currentPrice * defaultWeight * item.quantity);
    }
    
    // Create price adjustment modal
    const modal = document.createElement('div');
    modal.className = 'price-adjust-modal';
    modal.innerHTML = `
        <div class="price-adjust-container">
            <div class="price-adjust-header">
                <h3><i class="fas fa-balance-scale"></i> Adjust Price: ${item.name}</h3>
                <button onclick="closePriceModal()" class="close-btn">&times;</button>
            </div>
            <div class="price-adjust-content">
                <div class="current-info">
                    <p><strong>Current:</strong> $${displayPrice.toFixed(2)}/kg × ${defaultWeight}kg (estimated) = $${currentTotal.toFixed(2)}</p>
                    ${isLegacyOrder ? '<p><em>Note: This is a legacy order. Estimated values shown.</em></p>' : ''}
                </div>
                <div class="form-group">
                    <label for="actualWeight">Actual Weight (kg):</label>
                    <input type="number" id="actualWeight" step="0.1" min="0" value="${defaultWeight}" required>
                </div>
                <div class="form-group">
                    <label for="pricePerKg">Price per kg:</label>
                    <input type="number" id="pricePerKg" step="0.01" min="0" value="${displayPrice.toFixed(2)}" required>
                </div>
                <div class="calculated-total">
                    <p><strong>New Total:</strong> $<span id="calculatedTotal">${currentTotal.toFixed(2)}</span></p>
                </div>
                <div class="price-adjust-actions">
                    <button onclick="updateItemPrice('${orderId}', ${itemIndex})" class="btn-primary">
                        <i class="fas fa-check"></i> Update Price
                    </button>
                    <button onclick="closePriceModal()" class="btn-secondary">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for real-time calculation
    const actualWeightInput = document.getElementById('actualWeight');
    const pricePerKgInput = document.getElementById('pricePerKg');
    const calculatedTotalSpan = document.getElementById('calculatedTotal');
    
    function updateCalculation() {
        const weight = parseFloat(actualWeightInput.value) || 0;
        const pricePerKg = parseFloat(pricePerKgInput.value) || 0;
        const newTotal = (weight * pricePerKg * item.quantity).toFixed(2);
        calculatedTotalSpan.textContent = newTotal;
    }
    
    actualWeightInput.addEventListener('input', updateCalculation);
    pricePerKgInput.addEventListener('input', updateCalculation);
    
    // Focus on actual weight input
    actualWeightInput.focus();
    actualWeightInput.select();
}

// Close price adjustment modal
function closePriceModal() {
    const modal = document.querySelector('.price-adjust-modal');
    if (modal) {
        modal.remove();
    }
}

// Update item price in Firebase
async function updateItemPrice(orderId, itemIndex) {
    try {
        const actualWeight = parseFloat(document.getElementById('actualWeight').value);
        const pricePerKg = parseFloat(document.getElementById('pricePerKg').value);
        
        if (!actualWeight || !pricePerKg) {
            alert('Please enter valid weight and price values.');
            return;
        }
        
        const order = allOrders.find(o => o.id === orderId);
        const item = order.items[itemIndex];
        
        // Calculate new item total
        const newItemTotal = actualWeight * pricePerKg * item.quantity;
        
        // Calculate old item total (handle legacy orders)
        let oldItemTotal;
        if (item.estimatedMaxWeight) {
            // New variable weight item
            oldItemTotal = item.price * item.estimatedMaxWeight * item.quantity;
        } else {
            // Legacy order - calculate based on current setup
            if (item.name.toLowerCase().includes('frozen whole turkey')) {
                if (item.price > 50) {
                    // Price is the estimated total
                    oldItemTotal = item.price * item.quantity;
                } else {
                    // Price is per kg, multiply by estimated 9kg
                    oldItemTotal = item.price * 9.0 * item.quantity;
                }
            } else {
                oldItemTotal = item.price * item.quantity;
            }
        }
        
        // Update item details
        order.items[itemIndex].actualWeight = actualWeight;
        order.items[itemIndex].adjustedPrice = pricePerKg;
        order.items[itemIndex].finalTotal = newItemTotal;
        order.items[itemIndex].priceAdjusted = true;
        
        // Update order total
        const totalDifference = newItemTotal - oldItemTotal;
        order.total = (order.total || 0) + totalDifference;
        
        // Update in Firebase
        await db.collection('orders').doc(orderId).update({
            items: order.items,
            total: order.total,
            priceAdjusted: true,
            lastAdjusted: new Date()
        });
        
        // Update local data
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex] = order;
            filteredOrders = [...allOrders];
        }
        
        // Close modal and refresh display
        closePriceModal();
        displayOrders();
        
        alert(`Price updated successfully!\nActual weight: ${actualWeight}kg\nNew total: $${newItemTotal.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error updating item price:', error);
        alert('Error updating price. Please try again.');
    }
}

// Load all orders from Firebase
async function loadOrders() {
    try {
        const ordersContainer = document.getElementById('ordersContainer');
        ordersContainer.innerHTML = '<div class="loading">Loading orders...</div>';
        
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
        allOrders = [];
        
        snapshot.forEach(doc => {
            allOrders.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            });
        });
        
        filteredOrders = [...allOrders];
        updateStatistics();
        displayOrders();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersContainer').innerHTML = 
            '<div class="error">Error loading orders. Please check your Firebase configuration.</div>';
    }
}

// Update statistics
function updateStatistics() {
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(order => order.status === 'pending').length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = allOrders.filter(order => {
        const orderDate = new Date(order.timestamp);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
    }).length;
    
    // Update DOM elements
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('pendingOrders').textContent = pendingOrders;
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('todayOrders').textContent = todayOrders;
}

// Display orders
function displayOrders() {
    const ordersContainer = document.getElementById('ordersContainer');
    
    if (filteredOrders.length === 0) {
        ordersContainer.innerHTML = '<div class="no-orders">No orders found.</div>';
        return;
    }
    
    const ordersHTML = filteredOrders.map(order => {
        const orderDate = new Date(order.timestamp);
        const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
        
        return `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id">Order #${order.id}</div>
                    <div class="order-status ${order.status}">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
                </div>
                
                <div class="order-info">
                    <div class="order-customer">
                        <strong>Customer:</strong> ${order.customer?.name || 'N/A'}<br>
                        <strong>Email:</strong> ${order.customer?.email || 'N/A'}<br>
                        <strong>Phone:</strong> ${order.customer?.phone || 'N/A'}<br>
                        <strong>Address:</strong> ${order.customer?.address?.formatted || order.customer?.address || 'N/A'}
                    </div>
                    
                    <div class="order-details">
                        <strong>Date:</strong> ${formattedDate}<br>
                        <strong>Payment:</strong> ${order.paymentMethod === 'card' ? 'Credit Card' : 'Cash on Delivery'}
                    </div>
                </div>
                
                <div class="order-items">
                    <h4>Items:</h4>
                    ${order.items?.map((item, index) => {
                        // Check for variable weight items (both new and legacy)
                        const isTurkeyItem = item.name.toLowerCase().includes('turkey');
                        const isVariableWeight = (item.variableWeight && item.displayPrice === 'estimated') || isTurkeyItem;
                        const isPriceAdjusted = item.priceAdjusted;
                        
                        // Debug logging
                        if (item.name.toLowerCase().includes('turkey')) {
                            console.log('Turkey item found:', {
                                name: item.name,
                                price: item.price,
                                isVariableWeight: isVariableWeight,
                                hasVariableWeightFlag: item.variableWeight,
                                displayPrice: item.displayPrice,
                                isPriceAdjusted: isPriceAdjusted
                            });
                        }
                        
                        // Calculate item total based on whether price was adjusted
                        let itemTotal, weightInfo = '';
                        if (isPriceAdjusted) {
                            itemTotal = item.finalTotal || (item.actualWeight * item.adjustedPrice * item.quantity);
                            weightInfo = `<br><small class="weight-info">Actual: ${item.actualWeight}kg @ $${item.adjustedPrice}/kg</small>`;
                        } else if (isVariableWeight) {
                            // Handle both new and legacy variable weight items
                            if (item.estimatedMaxWeight) {
                                // New variable weight item
                                itemTotal = item.price * item.estimatedMaxWeight * item.quantity;
                            } else {
                                // Legacy turkey order - if price is low, multiply by estimated weight
                                if (isTurkeyItem) {
                                    if (item.price > 50) {
                                        // Price is already the estimated total
                                        itemTotal = item.price * item.quantity;
                                        weightInfo = `<br><small class="weight-info">Estimated total price</small>`;
                                    } else {
                                        // Price is per kg, multiply by estimated 9kg
                                        itemTotal = item.price * 9.0 * item.quantity;
                                        weightInfo = `<br><small class="weight-info">Estimated: 9.0kg @ $${item.price}/kg</small>`;
                                    }
                                } else {
                                    itemTotal = item.price * item.quantity;
                                }
                            }
                        } else {
                            itemTotal = item.price * item.quantity;
                        }
                        
                        const adjustPriceBtn = isVariableWeight && !isPriceAdjusted ? 
                            `<button onclick="adjustItemPrice('${order.id}', ${index})" class="btn-adjust-price" title="Adjust price based on actual weight">
                                <i class="fas fa-edit"></i> Adjust
                            </button>` : '';
                        
                        // Debug button generation
                        if (isTurkeyItem) {
                            console.log('Button generation for turkey:', {
                                itemName: item.name,
                                isVariableWeight: isVariableWeight,
                                isPriceAdjusted: isPriceAdjusted,
                                shouldShowButton: isVariableWeight && !isPriceAdjusted,
                                buttonHTML: adjustPriceBtn
                            });
                        }
                        
                        const adjustedBadge = isPriceAdjusted ? '<span class="adjusted-badge">Adjusted</span>' : '';
                        const estimatedBadge = isVariableWeight && !isPriceAdjusted ? '<span class="estimated-badge">Estimated</span>' : '';
                        
                        return `
                        <div class="order-item ${isVariableWeight ? 'variable-weight-item' : ''} ${isPriceAdjusted ? 'price-adjusted' : ''}">
                            <div class="item-info">
                                <span class="item-name">${item.name} x ${item.quantity}</span>
                                ${weightInfo}
                                ${estimatedBadge}${adjustedBadge}
                            </div>
                            <div class="item-actions">
                                <span class="item-price">$${itemTotal.toFixed(2)}</span>
                                ${adjustPriceBtn}
                            </div>
                        </div>
                        `;
                    }).join('') || '<div class="order-item">No items</div>'}
                </div>
                
                <div class="order-footer">
                    <div class="order-total">Total: $${(order.total || 0).toFixed(2)}</div>
                    <div class="order-actions">
                        <button onclick="updateOrderStatus('${order.id}', 'processing')" 
                                class="btn-primary" ${order.status === 'processing' ? 'disabled' : ''}>
                            Mark Processing
                        </button>
                        <button onclick="updateOrderStatus('${order.id}', 'delivered')" 
                                class="btn-primary" ${order.status === 'delivered' ? 'disabled' : ''}>
                            Mark Delivered
                        </button>
                        <button onclick="viewOrderDetails('${order.id}')" class="btn-secondary">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    ordersContainer.innerHTML = ordersHTML;
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: new Date()
        });
        
        // Update local data
        const orderIndex = allOrders.findIndex(order => order.id === orderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex].status = newStatus;
            filteredOrders = [...allOrders];
            updateStatistics();
            displayOrders();
        }
        
        alert(`Order ${orderId} status updated to ${newStatus}`);
        
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Error updating order status. Please try again.');
    }
}

// View order details
function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const orderDate = new Date(order.timestamp);
    const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
    
    const details = `
ORDER DETAILS
=============
Order ID: ${order.id}
Date: ${formattedDate}
Status: ${order.status}

CUSTOMER INFORMATION
==================
Name: ${order.customer?.name || 'N/A'}
Email: ${order.customer?.email || 'N/A'}
Phone: ${order.customer?.phone || 'N/A'}
Address: ${order.customer?.address?.formatted || order.customer?.address || 'N/A'}

ITEMS
=====
${order.items?.map(item => `${item.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`).join('\n') || 'No items'}

PAYMENT
=======
Method: ${order.paymentMethod === 'card' ? 'Credit Card' : 'Cash on Delivery'}
Total: $${(order.total || 0).toFixed(2)}
    `;
    
    alert(details);
}

// Filter orders
function filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    filteredOrders = allOrders.filter(order => {
        // Status filter
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }
        
        // Date filter
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            const orderDate = new Date(order.timestamp);
            
            // Compare dates (ignoring time)
            if (filterDate.toDateString() !== orderDate.toDateString()) {
                return false;
            }
        }
        
        return true;
    });
    
    displayOrders();
}

// Clear filters
function clearFilters() {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('dateFilter').value = '';
    filteredOrders = [...allOrders];
    displayOrders();
}

// Refresh orders
function refreshOrders() {
    loadOrders();
}

// Export orders data (basic implementation)
function exportOrders() {
    const csvData = ['Order ID,Date,Customer Name,Email,Phone,Total,Status,Payment Method'];
    
    allOrders.forEach(order => {
        const orderDate = new Date(order.timestamp).toLocaleDateString();
        const row = [
            order.id,
            orderDate,
            order.customer?.name || '',
            order.customer?.email || '',
            order.customer?.phone || '',
            order.total || 0,
            order.status,
            order.paymentMethod
        ];
        csvData.push(row.join(','));
    });
    
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Console helper functions for debugging
window.debugOrders = {
    viewAll: () => console.table(allOrders),
    viewFiltered: () => console.table(filteredOrders),
    viewStats: () => {
        console.log('Total Orders:', allOrders.length);
        console.log('Pending Orders:', allOrders.filter(o => o.status === 'pending').length);
        console.log('Paid Orders:', allOrders.filter(o => o.status === 'paid').length);
        console.log('Processing Orders:', allOrders.filter(o => o.status === 'processing').length);
        console.log('Delivered Orders:', allOrders.filter(o => o.status === 'delivered').length);
    }
};

// Error handling for Firebase connection
window.addEventListener('error', function(event) {
    if (event.message.includes('Firebase')) {
        console.error('Firebase Error:', event.message);
        document.getElementById('ordersContainer').innerHTML = 
            '<div class="error">Firebase connection error. Please check your configuration.</div>';
    }
}); 