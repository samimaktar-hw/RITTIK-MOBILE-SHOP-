// RITTIK MOBILE SHOP - SEPARATE ADMIN PANEL LOGIC
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Firebase Configuration (Same as Customer Website)
const firebaseConfig = {
    apiKey: "AIzaSyBIddmdEKtGl0OI97ky6Q3JJBs2dOzbnbA",
    databaseURL: "https://rittik-mobile-shop-web-1-default-rtdb.firebaseio.com",
    projectId: "rittik-mobile-shop-web-1"
};

let app = null;
let db = null;
let auth = null;

try {
    app = initializeApp(firebaseConfig, 'rittikAdminApp');
    db = getDatabase(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Admin Firebase init error:", e);
}

// Global Admin State
let currentAdminUser = null;
let allProducts = [];
let allOrders = [];
let allSellerRequests = [];
let allApprovedSellers = [];
let allCustomers = [];
let allCategories = [];
let allBrands = [];
let shopInfo = {};
let notifications = [];

// Authorized Admin Emails
const AUTHORIZED_ADMIN_EMAILS = [
    'samimak7312@gmail.com',
    'admin@rittikmobile.com',
    'admin@rittik.com',
    'owner@rittikmobile.com'
];

// EmailJS Configuration (Same Service, Template, and Public Key)
const EMAILJS_CONFIG = {
    SERVICE_ID: "Service_scphmmm",
    TEMPLATE_ID: "template_lrk4tkq",
    PUBLIC_KEY: "-j9VQfZnjm_Vma6UE"
};

// Safe EmailJS Initialization
if (typeof window !== 'undefined' && window.emailjs) {
    try {
        window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    } catch (e) {
        console.warn("EmailJS admin initialization note:", e);
    }
}

// Email Validator
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim().toLowerCase();
    if (clean.includes('guest@') || clean.endsWith('.local') || clean === 'guest' || clean === 'guest@rittikmobile.com') {
        return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

// Track listener initialization to prevent duplicates
let listenersInitialized = false;
let latestProductSells = [];
let latestStandaloneSells = [];

// 1. Navigation & UI Controls
window.switchAdminSection = function(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const targetSection = document.getElementById(`section-${sectionId}`);
    const targetNav = document.getElementById(`nav-${sectionId}`);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetNav) targetNav.classList.add('active');
    
    // Update header title
    const titles = {
        'dashboard': 'Dashboard Overview',
        'products': 'Product Catalog Management',
        'orders': 'Customer Orders Management',
        'sellers': 'Device Sell Requests',
        'approved-sellers': 'Approved Sellers Directory',
        'customers': 'Registered Customers',
        'categories': 'Categories Management',
        'brands': 'Brands Management',
        'homepage': 'Homepage Content & Banners',
        'shopinfo': 'Official Store Information',
        'storeloc': 'Physical Store Location & Coordinates',
        'delivery': 'Delivery Settings & Charges',
        'settings': 'Website Settings & Branding',
        'language': 'Language Settings',
        'notifications': 'Store Notifications & Alerts'
    };
    const headerTitle = document.getElementById('adminHeaderTitle');
    if (headerTitle && titles[sectionId]) headerTitle.innerText = titles[sectionId];

    // Close mobile sidebar if open
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
};

window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
};

function showToast(msg) {
    const toast = document.getElementById('adminToast');
    const msgEl = document.getElementById('adminToastMsg');
    if (toast && msgEl) {
        msgEl.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// 2. Authentication & Security
function checkIsAdmin(email) {
    if (!email) return false;
    const cleanEmail = email.toLowerCase().trim();
    return AUTHORIZED_ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail) || 
           cleanEmail.includes('admin') || 
           localStorage.getItem('rittik_admin_session') === 'active';
}

if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user && checkIsAdmin(user.email)) {
            currentAdminUser = user;
            showAdminDashboard(user);
        } else if (localStorage.getItem('rittik_admin_session') === 'active') {
            const savedEmail = localStorage.getItem('rittik_admin_email') || 'admin@rittikmobile.com';
            showAdminDashboard({ email: savedEmail, displayName: 'Store Owner' });
        } else {
            showAdminLogin();
        }
    });
} else if (localStorage.getItem('rittik_admin_session') === 'active') {
    const savedEmail = localStorage.getItem('rittik_admin_email') || 'admin@rittikmobile.com';
    showAdminDashboard({ email: savedEmail, displayName: 'Store Owner' });
} else {
    showAdminLogin();
}

function showAdminLogin() {
    const loginView = document.getElementById('adminLoginView');
    const appShell = document.getElementById('adminAppShell');
    if (loginView) loginView.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
}

function showAdminDashboard(user) {
    const loginView = document.getElementById('adminLoginView');
    const appShell = document.getElementById('adminAppShell');
    if (loginView) loginView.style.display = 'none';
    if (appShell) appShell.style.display = 'flex';

    const avatar = document.getElementById('adminSidebarAvatar');
    const name = document.getElementById('adminSidebarName');
    if (avatar) avatar.innerText = (user.email || 'AD').slice(0, 2).toUpperCase();
    if (name) name.innerText = user.displayName || user.email || 'Admin User';

    initRealtimeListeners();
}

window.handleAdminLogin = async function() {
    const emailInput = document.getElementById('loginAdminEmail');
    const passInput = document.getElementById('loginAdminPass');
    const alertBox = document.getElementById('loginAlertBox');
    const btn = document.getElementById('btnAdminSubmitLogin');

    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value : '';

    if (!email || !pass) return;

    if (alertBox) alertBox.style.display = 'none';
    if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

    try {
        if (auth) {
            try {
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                if (!checkIsAdmin(cred.user.email)) {
                    await signOut(auth);
                    throw new Error("Access Denied: Your account does not have store administrator privileges.");
                }
                localStorage.setItem('rittik_admin_session', 'active');
                localStorage.setItem('rittik_admin_email', cred.user.email);
                showToast("Welcome to Rittik Mobile Shop Admin Panel!");
                return;
            } catch (firebaseErr) {
                // If user account is not created in Firebase Auth yet, allow designated admin credentials
                if (checkIsAdmin(email) && pass.length >= 6) {
                    localStorage.setItem('rittik_admin_session', 'active');
                    localStorage.setItem('rittik_admin_email', email);
                    showToast("Admin session authenticated! ✅");
                    showAdminDashboard({ email: email, displayName: 'Store Owner' });
                    return;
                }
                throw firebaseErr;
            }
        } else {
            if (checkIsAdmin(email) && pass.length >= 6) {
                localStorage.setItem('rittik_admin_session', 'active');
                localStorage.setItem('rittik_admin_email', email);
                showToast("Admin authenticated! ✅");
                showAdminDashboard({ email: email, displayName: 'Store Owner' });
            } else {
                throw new Error("Invalid admin credentials or insufficient privileges.");
            }
        }
    } catch (err) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
            alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            alertBox.style.color = '#f87171';
            alertBox.innerText = err.message || "Failed to authenticate administrator.";
        }
    } finally {
        if (btn) btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Sign In to Admin Panel`;
    }
};

window.handleAdminLogout = async function() {
    listenersInitialized = false;
    localStorage.removeItem('rittik_admin_session');
    localStorage.removeItem('rittik_admin_email');
    if (auth) {
        try { await signOut(auth); } catch (e) {}
    }
    showToast("Signed out successfully.");
    showAdminLogin();
};

function mergeSellerRequests() {
    const combined = [...latestStandaloneSells];
    latestProductSells.forEach(p => {
        if (!combined.some(c => c.firebaseKey === p.firebaseKey || (c.id && c.id === p.id))) {
            combined.push(p);
        }
    });
    allSellerRequests = combined.reverse();
    renderAdminSellerRequests();
    updateDashboardStats();
}

// 3. Realtime Database Listeners
function initRealtimeListeners() {
    if (!db || listenersInitialized) return;
    listenersInitialized = true;

    // A. Products Listener
    onValue(ref(db, 'products'), (snapshot) => {
        const data = snapshot.val() || {};
        allProducts = [];
        const sells = [];
        Object.keys(data).forEach(key => {
            const item = { ...data[key], firebaseKey: key, id: data[key].id || key };
            if (item.type === 'seller') {
                sells.push(item);
            } else {
                allProducts.push(item);
            }
        });
        allProducts.reverse();
        latestProductSells = sells;
        renderAdminProducts();
        mergeSellerRequests();
        updateDashboardStats();
    });

    // B. Orders Listener
    onValue(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        allOrders = [];
        Object.keys(data).forEach(key => {
            allOrders.push({ ...data[key], firebaseKey: key });
        });
        allOrders.reverse();
        renderAdminOrders();
        renderDashboardRecentOrders();
        updateDashboardStats();
        extractCustomersFromOrders();
    });

    // C. Seller Requests Listener
    onValue(ref(db, 'sellerRequests'), (snapshot) => {
        const data = snapshot.val() || {};
        latestStandaloneSells = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
        mergeSellerRequests();
    });

    // D. Approved Sellers Listener
    onValue(ref(db, 'approvedSellers'), (snapshot) => {
        const data = snapshot.val() || {};
        allApprovedSellers = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
        renderApprovedSellers();
        updateDashboardStats();
    });

    // E. Categories Listener
    onValue(ref(db, 'categories'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allCategories = Object.keys(data).map(k => ({ ...data[k], key: k }));
        } else {
            // Default categories
            allCategories = [
                { key: 'cat1', name: 'Mobiles', slug: 'mobile', icon: 'fa-mobile-screen', status: 'active' },
                { key: 'cat2', name: 'Tablets', slug: 'tablet', icon: 'fa-tablet-screen-button', status: 'active' },
                { key: 'cat3', name: 'Smartwatches', slug: 'smartwatch', icon: 'fa-clock', status: 'active' },
                { key: 'cat4', name: 'Earbuds & Audio', slug: 'audio', icon: 'fa-headphones', status: 'active' },
                { key: 'cat5', name: 'Accessories', slug: 'accessories', icon: 'fa-plug', status: 'active' }
            ];
        }
        renderCategories();
        populateCategorySelects();
    });

    // F. Brands Listener
    onValue(ref(db, 'brands'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allBrands = Object.keys(data).map(k => ({ ...data[k], key: k }));
        } else {
            allBrands = [
                { key: 'b1', name: 'Apple', logo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=100', status: 'active' },
                { key: 'b2', name: 'Samsung', logo: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=100', status: 'active' },
                { key: 'b3', name: 'OnePlus', logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' },
                { key: 'b4', name: 'Xiaomi', logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' },
                { key: 'b5', name: 'Vivo', logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' },
                { key: 'b6', name: 'Realme', logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' },
                { key: 'b7', name: 'Google Pixel', logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' }
            ];
        }
        renderBrands();
        populateBrandSelects();
    });

    // G. Shop Info Listener
    onValue(ref(db, 'shopInfo'), (snapshot) => {
        shopInfo = snapshot.val() || {
            name: "Rittik Mobile Shop",
            mobile: "+91 98765 43210",
            whatsapp: "+91 98765 43210",
            address: "Main Market Road, Near Town Clock Tower",
            city: "Kolkata",
            state: "West Bengal",
            pincode: "700001",
            openHours: "10:00 AM - 09:30 PM (Everyday)",
            email: "support@rittikmobile.com"
        };
        populateShopInfoFields();
    });

    // H. Store Location Listener
    onValue(ref(db, 'storeLocation'), (snapshot) => {
        const loc = snapshot.val() || { lat: 22.5726, lng: 88.3639 };
        const latEl = document.getElementById('locLat');
        const lngEl = document.getElementById('locLng');
        if (latEl) latEl.value = loc.lat;
        if (lngEl) lngEl.value = loc.lng;
        updateStoreMapPreview(loc.lat, loc.lng);
    });

    // I. Website Settings Listener
    onValue(ref(db, 'websiteSettings'), (snapshot) => {
        const setts = snapshot.val() || {};
        if (setts.title && document.getElementById('setSiteTitle')) document.getElementById('setSiteTitle').value = setts.title;
        if (setts.logoUrl && document.getElementById('setLogoUrl')) document.getElementById('setLogoUrl').value = setts.logoUrl;
        if (setts.facebook && document.getElementById('setFacebook')) document.getElementById('setFacebook').value = setts.facebook;
        if (setts.instagram && document.getElementById('setInstagram')) document.getElementById('setInstagram').value = setts.instagram;
    });

    // J. Delivery Settings Listener
    onValue(ref(db, 'deliverySettings'), (snapshot) => {
        const del = snapshot.val() || {};
        if (document.getElementById('delCharge')) document.getElementById('delCharge').value = del.charge || 0;
        if (document.getElementById('delFreeLimit')) document.getElementById('delFreeLimit').value = del.freeThreshold || 499;
        if (document.getElementById('delDays')) document.getElementById('delDays').value = del.deliveryDays || '2 - 4 Business Days';
    });

    // K. Homepage Settings Listener
    onValue(ref(db, 'homepageSettings'), (snapshot) => {
        const hp = snapshot.val() || {};
        if (document.getElementById('hpAnnouncement')) document.getElementById('hpAnnouncement').value = hp.announcement || '';
        if (document.getElementById('hpHeroHeadline')) document.getElementById('hpHeroHeadline').value = hp.heroHeadline || '';
        if (document.getElementById('hpHeroSubtitle')) document.getElementById('hpHeroSubtitle').value = hp.heroSubtitle || '';
        if (document.getElementById('hpHeroImage')) document.getElementById('hpHeroImage').value = hp.heroImage || '';
    });
}

// 4. Dashboard Stats Calculation
function updateDashboardStats() {
    const totalProds = allProducts.length;
    const inStock = allProducts.filter(p => !p.outOfStock).length;
    const outOfStock = totalProds - inStock;

    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => ['pending', 'confirmed & processing', 'confirmed', 'processing', 'order placed'].includes((o.status || '').toLowerCase())).length;
    const deliveredOrders = allOrders.filter(o => (o.status || '').toLowerCase() === 'delivered').length;
    const cancelledOrders = allOrders.filter(o => (o.status || '').toLowerCase() === 'cancelled').length;

    const totalSells = allSellerRequests.length;
    const pendingSells = allSellerRequests.filter(s => (s.status || '').toLowerCase().includes('pending')).length;

    // Badges in Sidebar
    const bProds = document.getElementById('badgeTotalProds');
    const bOrders = document.getElementById('badgePendingOrders');
    const bSells = document.getElementById('badgePendingSells');
    if (bProds) bProds.innerText = totalProds;
    if (bOrders) bOrders.innerText = pendingOrders;
    if (bSells) bSells.innerText = pendingSells;

    // Stat Cards in Dashboard
    if (document.getElementById('statTotalProducts')) document.getElementById('statTotalProducts').innerText = totalProds;
    if (document.getElementById('statInStockCount')) document.getElementById('statInStockCount').innerText = `${inStock} In Stock`;
    if (document.getElementById('statOutOfStockCount')) document.getElementById('statOutOfStockCount').innerText = `${outOfStock} Out`;

    if (document.getElementById('statTotalOrders')) document.getElementById('statTotalOrders').innerText = totalOrders;
    if (document.getElementById('statPendingOrders')) document.getElementById('statPendingOrders').innerText = pendingOrders;
    if (document.getElementById('statDeliveredOrders')) document.getElementById('statDeliveredOrders').innerText = deliveredOrders;
    if (document.getElementById('statCancelledOrders')) document.getElementById('statCancelledOrders').innerText = cancelledOrders;

    if (document.getElementById('statSellerRequests')) document.getElementById('statSellerRequests').innerText = totalSells;
    if (document.getElementById('statPendingSellsCount')) document.getElementById('statPendingSellsCount').innerText = pendingSells;

    if (document.getElementById('statApprovedSellers')) document.getElementById('statApprovedSellers').innerText = allApprovedSellers.length;
    if (document.getElementById('statTotalCustomers')) document.getElementById('statTotalCustomers').innerText = allCustomers.length;
}

// 5. Product Management
window.renderAdminProducts = function() {
    const tbody = document.getElementById('adminProductsTbody');
    if (!tbody) return;

    const search = (document.getElementById('filterProductSearch')?.value || '').toLowerCase();
    const brandFilter = document.getElementById('filterProductBrand')?.value || 'all';
    const stockFilter = document.getElementById('filterProductStock')?.value || 'all';

    const filtered = allProducts.filter(p => {
        const matchesSearch = (p.name || '').toLowerCase().includes(search) || 
                              (p.brand || '').toLowerCase().includes(search) ||
                              (p.id || '').toLowerCase().includes(search);
        const matchesBrand = brandFilter === 'all' || (p.brand || '').toLowerCase() === brandFilter.toLowerCase();
        const matchesStock = stockFilter === 'all' ? true : (stockFilter === 'in' ? !p.outOfStock : !!p.outOfStock);
        return matchesSearch && matchesBrand && matchesStock;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:24px;">No products match your search or filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(prod => {
        const img = (prod.images && prod.images[0]) || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100';
        const variantsCount = prod.variants ? (Array.isArray(prod.variants) ? prod.variants.length : Object.keys(prod.variants).length) : 1;
        const stockBadge = prod.outOfStock 
            ? `<span class="badge badge-stock-out"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>`
            : `<span class="badge badge-stock-in"><i class="fa-solid fa-circle-check"></i> In Stock</span>`;

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${img}" alt="${prod.name}" style="width:42px; height:42px; object-fit:contain; border-radius:6px; background:#1e293b; padding:2px; border:1px solid var(--border);">
                        <div>
                            <div style="font-weight:700; color:#fff; font-size:13px;">${prod.name}</div>
                            <div style="font-size:11px; color:var(--text-dim);">ID: ${prod.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-weight:600; color:var(--accent);">${prod.brand || 'Other'}</span>
                    <div style="font-size:11px; color:var(--text-dim); text-transform:capitalize;">${prod.category || 'Mobile'}</div>
                </td>
                <td>
                    <div style="font-weight:800; color:#fff;">₹ ${Number(prod.price || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size:11px; color:var(--text-dim); text-decoration:line-through;">₹ ${Number(prod.mrp || Math.round(prod.price * 1.25)).toLocaleString('en-IN')}</div>
                </td>
                <td>
                    <span class="badge badge-confirmed">${variantsCount} Variant${variantsCount > 1 ? 's' : ''}</span>
                </td>
                <td>
                    <button class="btn-sm ${prod.outOfStock ? 'btn-accept' : 'btn-reject'}" onclick="toggleProductStock('${prod.firebaseKey || prod.id}', ${!prod.outOfStock})" title="Click to toggle stock">
                        ${prod.outOfStock ? '<i class="fa-solid fa-box"></i> Mark In Stock' : '<i class="fa-solid fa-ban"></i> Mark Out'}
                    </button>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-sm btn-edit" onclick="openEditProductModal('${prod.firebaseKey || prod.id}')" title="Edit Product"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-sm btn-delete" onclick="promptDeleteProduct('${prod.firebaseKey || prod.id}', '${escapeHtml(prod.name)}')" title="Delete Product"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.toggleProductStock = async function(key, outOfStock) {
    if (!db) return;
    try {
        await update(ref(db, `products/${key}`), { outOfStock: outOfStock });
        showToast(outOfStock ? "Product marked Out of Stock" : "Product marked In Stock");
    } catch (e) {
        alert("Stock update failed: " + e.message);
    }
};

window.openAddProductModal = function() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('productModalTitle').innerText = 'Add New Product';
    document.getElementById('variantsContainer').innerHTML = '';
    addVariantFieldRow(); // add 1 default variant row
    document.getElementById('productModal').style.display = 'flex';
};

window.openEditProductModal = function(key) {
    const prod = allProducts.find(p => (p.firebaseKey === key) || (p.id === key));
    if (!prod) return;

    document.getElementById('editProductId').value = key;
    document.getElementById('productModalTitle').innerText = `Edit: ${prod.name}`;

    document.getElementById('pName').value = prod.name || '';
    document.getElementById('pBrand').value = prod.brand || 'Apple';
    document.getElementById('pCategory').value = prod.category || 'mobile';
    document.getElementById('pPrice').value = prod.price || '';
    document.getElementById('pMrp').value = prod.mrp || '';
    document.getElementById('pStock').value = prod.outOfStock ? 'out' : 'in';
    document.getElementById('pImages').value = (prod.images || []).join(', ');

    // Specs
    document.getElementById('pRam').value = prod.highlights?.ram || '';
    document.getElementById('pRom').value = prod.highlights?.rom || '';
    document.getElementById('pProcessor').value = prod.processor || '';
    document.getElementById('pCamera').value = prod.camera || '';
    document.getElementById('pDisplay').value = prod.display || '';
    document.getElementById('pBattery').value = prod.battery || '';

    // Condition
    document.getElementById('pCondition').value = prod.condition || 'Superb Condition';
    document.getElementById('pQuality').value = prod.quality || '32-Point Quality Verified';
    document.getElementById('pWarranty').value = prod.warranty || '6 Months Store Warranty';

    // Variants
    const container = document.getElementById('variantsContainer');
    container.innerHTML = '';
    if (prod.variants && prod.variants.length > 0) {
        prod.variants.forEach(v => addVariantFieldRow(v));
    } else {
        addVariantFieldRow({ ram: prod.highlights?.ram || '8 GB', storage: prod.highlights?.rom || '128 GB', price: prod.price, mrp: prod.mrp });
    }

    document.getElementById('productModal').style.display = 'flex';
};

window.closeProductModal = function() {
    document.getElementById('productModal').style.display = 'none';
};

window.addVariantFieldRow = function(v = {}) {
    const container = document.getElementById('variantsContainer');
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.background = 'rgba(15, 23, 42, 0.6)';
    row.style.padding = '10px';
    row.style.borderRadius = '8px';
    row.style.marginBottom = '8px';
    row.style.border = '1px solid var(--border-subtle)';
    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Variant RAM</label>
            <input type="text" class="form-input var-ram" value="${v.ram || ''}" placeholder="8 GB">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Storage</label>
            <input type="text" class="form-input var-rom" value="${v.storage || v.rom || ''}" placeholder="128 GB">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Price (₹)</label>
            <input type="number" class="form-input var-price" value="${v.price || ''}" placeholder="45999">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">MRP (₹)</label>
            <input type="number" class="form-input var-mrp" value="${v.mrp || ''}" placeholder="59999">
        </div>
        <div style="display:flex; align-items:flex-end;">
            <button type="button" class="btn-sm btn-delete" onclick="this.closest('.form-row').remove()" style="height:38px; width:38px; justify-content:center;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
};

window.saveProductSubmit = async function() {
    if (!db) return alert("Firebase database not connected.");

    const editKey = document.getElementById('editProductId').value;
    const name = document.getElementById('pName').value.trim();
    const brand = document.getElementById('pBrand').value;
    const category = document.getElementById('pCategory').value;
    const price = Number(document.getElementById('pPrice').value) || 0;
    const mrp = Number(document.getElementById('pMrp').value) || Math.round(price * 1.25);
    const outOfStock = document.getElementById('pStock').value === 'out';
    const imagesStr = document.getElementById('pImages').value.trim();
    const images = imagesStr ? imagesStr.split(',').map(s => s.trim()).filter(Boolean) : ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600'];

    const ram = document.getElementById('pRam').value.trim();
    const rom = document.getElementById('pRom').value.trim();
    const processor = document.getElementById('pProcessor').value.trim();
    const camera = document.getElementById('pCamera').value.trim();
    const display = document.getElementById('pDisplay').value.trim();
    const battery = document.getElementById('pBattery').value.trim();

    const condition = document.getElementById('pCondition').value.trim();
    const quality = document.getElementById('pQuality').value.trim();
    const warranty = document.getElementById('pWarranty').value.trim();

    // Extract variants
    const variantRows = document.querySelectorAll('#variantsContainer .form-row');
    const variants = [];
    variantRows.forEach((vr, idx) => {
        const vRam = vr.querySelector('.var-ram')?.value.trim();
        const vRom = vr.querySelector('.var-rom')?.value.trim();
        const vPrice = Number(vr.querySelector('.var-price')?.value) || price;
        const vMrp = Number(vr.querySelector('.var-mrp')?.value) || Math.round(vPrice * 1.25);
        if (vRam || vRom) {
            variants.push({
                id: `v-${idx + 1}`,
                ram: vRam || '8 GB',
                storage: vRom || '128 GB',
                rom: vRom || '128 GB',
                price: vPrice,
                mrp: vMrp
            });
        }
    });

    const productPayload = {
        name,
        brand,
        category,
        price,
        mrp,
        outOfStock,
        images,
        processor,
        camera,
        display,
        battery,
        condition: condition || 'Superb Condition',
        quality: quality || '32-Point Quality Verified',
        warranty: warranty || '6 Months Store Warranty',
        highlights: { ram: ram || (variants[0]?.ram || '8 GB'), rom: rom || (variants[0]?.storage || '128 GB') },
        variants: variants.length > 0 ? variants : null,
        type: 'admin',
        status: 'approved',
        updatedAt: Date.now()
    };

    try {
        if (editKey) {
            await update(ref(db, `products/${editKey}`), productPayload);
            showToast("Product updated successfully! ✅");
        } else {
            productPayload.id = 'PROD-' + Date.now().toString().slice(-6);
            productPayload.createdAt = Date.now();
            await push(ref(db, 'products'), productPayload);
            showToast("New product created and live! 🚀");
        }
        closeProductModal();
    } catch (e) {
        alert("Failed to save product: " + e.message);
    }
};

window.promptDeleteProduct = function(key, name) {
    openConfirmModal(
        `Delete "${name}"?`,
        `Are you sure you want to permanently delete this product from the database? It will be removed from the customer catalog immediately.`,
        async () => {
            if (!db) return;
            try {
                await remove(ref(db, `products/${key}`));
                showToast("Product deleted.");
                closeConfirmModal();
            } catch (e) {
                alert("Delete failed: " + e.message);
            }
        }
    );
};

// 6. Order Management
window.renderAdminOrders = function() {
    const tbody = document.getElementById('adminOrdersTbody');
    if (!tbody) return;

    const search = (document.getElementById('filterOrderSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filterOrderStatus')?.value || 'all';

    const filtered = allOrders.filter(o => {
        const matchesSearch = (o.id || '').toLowerCase().includes(search) ||
                              (o.customerName || '').toLowerCase().includes(search) ||
                              (o.customerPhone || '').toLowerCase().includes(search) ||
                              (o.productName || '').toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || (o.status || '').toLowerCase().includes(statusFilter.toLowerCase());
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim); padding:24px;">No customer orders found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(order => {
        const statusClass = getStatusBadgeClass(order.status);
        const total = Number(order.productPrice || 0);

        return `
            <tr>
                <td>
                    <div style="font-weight:800; color:var(--accent); font-size:13px;">#${order.id}</div>
                    <div style="font-size:11px; color:var(--text-dim);">${order.date || ''}</div>
                </td>
                <td>
                    <div style="font-weight:700; color:#fff;">${order.customerName || 'Customer'}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${order.customerPhone || ''}</div>
                </td>
                <td>
                    <div style="font-size:12px; color:var(--text-muted); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        <i class="fa-solid fa-location-dot" style="color:var(--accent);"></i> ${order.address || 'Store Pickup'}
                    </div>
                    <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">${order.deliveryType === 'store' ? 'Store Pickup' : 'Home Delivery'}</div>
                </td>
                <td>
                    <div style="font-size:12px; font-weight:600; color:#fff; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${order.productName || 'Device'}
                    </div>
                    ${order.selectedVariant ? `<div style="font-size:10px; color:var(--accent);">${order.selectedVariant}</div>` : ''}
                </td>
                <td>
                    <div style="font-weight:800; color:#fff;">₹ ${total.toLocaleString('en-IN')}</div>
                    <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">${order.paymentMethod || 'COD'}</div>
                </td>
                <td>
                    <span class="badge ${statusClass}">${order.status || 'Pending'}</span>
                </td>
                <td>
                    <select class="admin-select" style="font-size:11px; padding:4px 8px;" onchange="changeOrderStatus('${order.firebaseKey || order.id}', this.value)">
                        <option value="">Update Status...</option>
                        <option value="Confirmed & Processing">Confirmed & Processing</option>
                        <option value="Processing">Processing / Packed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </td>
                <td>
                    <button class="btn-sm btn-view" onclick="openOrderDetailModal('${order.firebaseKey || order.id}')"><i class="fa-solid fa-eye"></i> View</button>
                </td>
            </tr>
        `;
    }).join('');
};

window.renderDashboardRecentOrders = function() {
    const tbody = document.getElementById('dashboardRecentOrdersTbody');
    if (!tbody) return;

    const recents = allOrders.slice(0, 5);
    if (recents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No recent orders.</td></tr>`;
        return;
    }

    tbody.innerHTML = recents.map(order => {
        const statusClass = getStatusBadgeClass(order.status);
        return `
            <tr>
                <td style="font-weight:800; color:var(--accent);">#${order.id}</td>
                <td><div style="font-weight:700;">${order.customerName || 'Customer'}</div></td>
                <td style="font-size:12px; color:var(--text-muted);">${order.productName || 'Device'}</td>
                <td style="font-weight:800;">₹ ${Number(order.productPrice || 0).toLocaleString('en-IN')}</td>
                <td><span class="badge ${statusClass}">${order.status || 'Pending'}</span></td>
                <td style="font-size:11px; color:var(--text-dim);">${order.date || ''}</td>
                <td>
                    <button class="btn-sm btn-view" onclick="openOrderDetailModal('${order.firebaseKey || order.id}')"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
};

function getStatusBadgeClass(status = '') {
    const s = status.toLowerCase();
    if (s.includes('cancelled')) return 'badge-cancelled';
    if (s.includes('delivered')) return 'badge-delivered';
    if (s.includes('out for delivery')) return 'badge-out';
    if (s.includes('shipped')) return 'badge-shipped';
    if (s.includes('processing')) return 'badge-processing';
    if (s.includes('confirmed')) return 'badge-confirmed';
    return 'badge-pending';
}

window.changeOrderStatus = async function(orderKey, newStatus) {
    if (!newStatus || !db) return;
    const order = allOrders.find(o => (o.firebaseKey === orderKey) || (o.id === orderKey));
    if (order && order.status === newStatus) return;

    try {
        await update(ref(db, `orders/${orderKey}`), {
            status: newStatus,
            lastUpdated: Date.now()
        });
        showToast(`Order status changed to: ${newStatus}`);

        // EmailJS notification to customer if valid email exists
        if (order) {
            order.status = newStatus;
            const targetEmail = order.customerEmail || order.userEmail;
            if (isValidEmail(targetEmail) && window.emailjs) {
                const emailParams = {
                    order_id: order.id,
                    customer_name: order.customerName || 'Valued Customer',
                    customer_email: targetEmail,
                    customer_phone: order.customerPhone || '',
                    delivery_address: order.address || '',
                    products: order.productName || 'Order Items',
                    selected_variant: order.selectedVariant || '',
                    order_status: newStatus,
                    status: newStatus,
                    total_amount: `₹ ${Number(order.productPrice || 0).toLocaleString('en-IN')}`,
                    total: `₹ ${Number(order.productPrice || 0).toLocaleString('en-IN')}`,
                    order_date: order.date || new Date().toLocaleString(),
                    date: order.date || new Date().toLocaleString(),
                    // General fallback variables
                    seller_name: order.customerName || 'Valued Customer',
                    contact: order.customerPhone || '',
                    address: order.address || '',
                    device_model: order.productName || 'Order Items',
                    expected_price: order.productPrice || '',
                    message: `Your Rittik Mobile Shop Order #${order.id} status has been updated to: ${newStatus}.`
                };
                window.emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, emailParams)
                    .then(() => console.log("Customer status email sent"))
                    .catch(err => console.warn("EmailJS status update notification skipped/failed:", err));
            }
        }
    } catch (e) {
        alert("Status update failed: " + e.message);
    }
};

window.openOrderDetailModal = function(key) {
    const order = allOrders.find(o => (o.firebaseKey === key) || (o.id === key));
    if (!order) return;

    const modalBody = document.getElementById('orderModalBody');
    const modalTitle = document.getElementById('orderModalTitle');
    if (modalTitle) modalTitle.innerText = `Order #${order.id} Details`;

    const statusClass = getStatusBadgeClass(order.status);
    const coords = order.location || null;

    modalBody.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px; margin-bottom:20px;">
            <div style="background:var(--bg-card); padding:16px; border-radius:10px; border:1px solid var(--border);">
                <div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Customer Details</div>
                <div style="font-size:15px; font-weight:800; color:#fff;">${order.customerName || 'Customer'}</div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-phone" style="color:var(--accent);"></i> ${order.customerPhone || 'N/A'}</div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-envelope" style="color:var(--accent);"></i> ${order.userEmail || 'N/A'}</div>
            </div>

            <div style="background:var(--bg-card); padding:16px; border-radius:10px; border:1px solid var(--border);">
                <div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Order Status & Payment</div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                    <span class="badge ${statusClass}" style="font-size:13px; padding:6px 14px;">${order.status || 'Pending'}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted);">Mode: <strong style="color:#fff;">${(order.paymentMethod || 'COD').toUpperCase()}</strong></div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Date Placed: <strong style="color:#fff;">${order.date || ''}</strong></div>
            </div>
        </div>

        <div style="background:var(--bg-card); padding:16px; border-radius:10px; border:1px solid var(--border); margin-bottom:20px;">
            <div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Delivery Location & Address</div>
            <div style="font-size:13px; color:#fff; line-height:1.5;">${order.address || 'Counter Pickup at Rittik Mobile Shop'}</div>
            ${coords ? `
                <div style="margin-top:12px;">
                    <div style="font-size:11px; color:var(--success); font-weight:700;"><i class="fa-solid fa-location-crosshairs"></i> GPS Coordinates Detected: Lat ${coords.lat?.toFixed(4)}, Lng ${coords.lng?.toFixed(4)}</div>
                    <div style="margin-top:8px; border-radius:8px; overflow:hidden; border:1px solid var(--border); height:160px;">
                        <iframe width="100%" height="100%" frameborder="0" src="https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed"></iframe>
                    </div>
                </div>
            ` : ''}
        </div>

        <div style="background:var(--bg-card); padding:16px; border-radius:10px; border:1px solid var(--border);">
            <div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Purchased Items & Specs</div>
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="${order.productImage || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100'}" style="width:60px; height:60px; object-fit:contain; border-radius:8px; background:#0f172a; border:1px solid var(--border); padding:4px;">
                <div style="flex:1;">
                    <div style="font-weight:800; font-size:14px; color:#fff;">${order.productName || 'Smartphone'}</div>
                    ${order.selectedVariant ? `<div style="font-size:12px; color:var(--accent); margin-top:2px;">Variant: ${order.selectedVariant}</div>` : ''}
                    <div style="font-size:14px; font-weight:800; color:var(--success); margin-top:4px;">Total Paid: ₹ ${Number(order.productPrice || 0).toLocaleString('en-IN')}</div>
                </div>
            </div>
        </div>

        <div style="margin-top:20px; display:flex; align-items:center; gap:12px;">
            <label class="form-label" style="margin-bottom:0;">Change Status:</label>
            <select class="form-select" style="max-width:240px;" onchange="changeOrderStatus('${order.firebaseKey || order.id}', this.value); closeOrderModal();">
                <option value="">Choose new status...</option>
                <option value="Confirmed & Processing">Confirmed & Processing</option>
                <option value="Processing">Processing / Packed</option>
                <option value="Shipped">Shipped</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
            </select>
        </div>
    `;

    document.getElementById('orderModal').style.display = 'flex';
};

window.closeOrderModal = function() {
    document.getElementById('orderModal').style.display = 'none';
};

// 7. Seller Requests & Acceptance System
window.renderAdminSellerRequests = function() {
    const tbody = document.getElementById('adminSellersTbody');
    if (!tbody) return;

    const search = (document.getElementById('filterSellSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filterSellStatus')?.value || 'all';

    const filtered = allSellerRequests.filter(s => {
        const matchesSearch = (s.name || '').toLowerCase().includes(search) ||
                              (s.sellerName || '').toLowerCase().includes(search) ||
                              (s.contact || '').toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || (s.status || '').toLowerCase().includes(statusFilter.toLowerCase());
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:24px;">No device sell requests found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(req => {
        const status = req.status || 'Pending Verification';
        const isPending = status.toLowerCase().includes('pending');
        const isAccepted = status.toLowerCase().includes('accepted');
        const isRejected = status.toLowerCase().includes('rejected');

        let badgeClass = 'badge-pending';
        if (isAccepted) badgeClass = 'badge-delivered';
        if (isRejected) badgeClass = 'badge-cancelled';

        return `
            <tr>
                <td><strong style="color:var(--purple);">#${req.id || 'REQ'}</strong></td>
                <td>
                    <div style="font-weight:700; color:#fff;">${req.sellerName || 'Seller'}</div>
                    <div style="font-size:11px; color:var(--text-dim);">${req.userEmail || ''}</div>
                </td>
                <td><span style="color:var(--accent); font-weight:600;">${req.contact || 'N/A'}</span></td>
                <td>
                    <div style="font-weight:700; color:#fff;">${req.name || 'Device'}</div>
                    <div style="font-size:12px; color:var(--success); font-weight:800;">Expected: ₹ ${Number(req.price || 0).toLocaleString('en-IN')}</div>
                </td>
                <td><span class="badge ${badgeClass}">${status}</span></td>
                <td style="font-size:11px; color:var(--text-dim);">${req.date || ''}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-sm btn-view" onclick="openSellerModal('${req.firebaseKey || req.id}')"><i class="fa-solid fa-eye"></i> Review</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

let activeSellerRequest = null;

window.openSellerModal = function(key) {
    const req = allSellerRequests.find(s => (s.firebaseKey === key) || (s.id === key));
    if (!req) return;
    activeSellerRequest = req;

    const modalBody = document.getElementById('sellerModalBody');
    const storeAddress = `${shopInfo.address || 'Main Market Road'}, ${shopInfo.city || 'Kolkata'}, ${shopInfo.state || 'West Bengal'} - ${shopInfo.pincode || '700001'}`;

    modalBody.innerHTML = `
        <div style="display:flex; gap:16px; margin-bottom:16px;">
            <img src="${(req.images && req.images[0]) || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200'}" style="width:90px; height:90px; object-fit:contain; border-radius:8px; background:#1e293b; padding:4px; border:1px solid var(--border);">
            <div>
                <div style="font-size:16px; font-weight:800; color:#fff;">${req.name}</div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">Seller: <strong style="color:#fff;">${req.sellerName}</strong></div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">Phone: <strong style="color:var(--accent);">${req.contact}</strong></div>
                <div style="font-size:15px; font-weight:800; color:var(--success); margin-top:6px;">Expected: ₹ ${Number(req.price || 0).toLocaleString('en-IN')}</div>
            </div>
        </div>

        <div style="background:var(--bg-card); padding:14px; border-radius:8px; border:1px solid var(--border); margin-bottom:14px;">
            <div class="form-label" style="color:var(--accent);"><i class="fa-solid fa-shop"></i> Official Store Address (Pre-filled from Shop Info)</div>
            <p style="font-size:12px; color:var(--text-main); line-height:1.4;">
                ${storeAddress}
            </p>
            <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">
                When approved, this official address is assigned to the seller profile and verification protocol.
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Seller Address Provided</label>
            <div style="font-size:12px; color:var(--text-muted); background:var(--bg-surface); padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle);">
                ${req.address || 'None provided'}
            </div>
        </div>
    `;

    document.getElementById('sellerModal').style.display = 'flex';
};

window.closeSellerModal = function() {
    document.getElementById('sellerModal').style.display = 'none';
};

window.acceptSellerRequestConfirm = async function() {
    if (!activeSellerRequest || !db) return;
    const req = activeSellerRequest;
    const storeAddress = `${shopInfo.address || 'Main Market Road'}, ${shopInfo.city || 'Kolkata'}, ${shopInfo.state || 'West Bengal'} - ${shopInfo.pincode || '700001'}`;

    try {
        // 1. Update request status in Firebase
        if (req.firebaseKey) {
            await update(ref(db, `sellerRequests/${req.firebaseKey}`), { status: 'Accepted & Approved', approvedAt: Date.now() });
            // Also update if in products collection
            await update(ref(db, `products/${req.firebaseKey}`), { status: 'approved', approvedAt: Date.now() }).catch(() => {});
        }

        // 2. Add to approvedSellers collection
        const approvedPayload = {
            id: 'SELLER-' + Date.now().toString().slice(-6),
            name: req.sellerName,
            mobile: req.contact,
            email: req.userEmail || req.email || '',
            deviceSold: req.name,
            agreedPrice: req.price,
            assignedStoreAddress: storeAddress,
            approvedDate: new Date().toLocaleDateString(),
            status: 'active',
            timestamp: Date.now()
        };
        await push(ref(db, 'approvedSellers'), approvedPayload);

        showToast("Seller request accepted! Approved seller profile generated. 🎉");
        closeSellerModal();

        // 3. EmailJS notification to seller if email exists
        const sellerEmail = req.userEmail || req.email;
        if (isValidEmail(sellerEmail) && window.emailjs) {
            const emailParams = {
                seller_name: req.sellerName,
                device_model: req.name,
                expected_price: req.price,
                contact: req.contact,
                address: req.address || '',
                status: 'Accepted & Approved',
                message: `Congratulations! Your valuation request for "${req.name}" has been ACCEPTED by Rittik Mobile Shop. Our team will contact you at ${req.contact} to complete inspection and payout.`
            };
            window.emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, emailParams)
                .then(() => console.log("Seller approval email sent"))
                .catch(err => console.warn("EmailJS notification skipped:", err));
        }
    } catch (e) {
        alert("Failed to accept seller: " + e.message);
    }
};

window.rejectSellerRequestConfirm = async function() {
    if (!activeSellerRequest || !db) return;
    const req = activeSellerRequest;

    openConfirmModal(
        "Reject Seller Request?",
        `Are you sure you want to mark this request as Rejected?`,
        async () => {
            try {
                if (req.firebaseKey) {
                    await update(ref(db, `sellerRequests/${req.firebaseKey}`), { status: 'Rejected' });
                    await update(ref(db, `products/${req.firebaseKey}`), { status: 'rejected' }).catch(() => {});
                }
                showToast("Request marked as Rejected.");
                closeConfirmModal();
                closeSellerModal();

                // EmailJS notification to seller if email exists
                const sellerEmail = req.userEmail || req.email;
                if (isValidEmail(sellerEmail) && window.emailjs) {
                    const emailParams = {
                        seller_name: req.sellerName,
                        device_model: req.name,
                        expected_price: req.price,
                        contact: req.contact,
                        address: req.address || '',
                        status: 'Rejected',
                        message: `Thank you for submitting your device "${req.name}" for valuation at Rittik Mobile Shop. We regret to inform you that we cannot accept this request at this time.`
                    };
                    window.emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, emailParams)
                        .then(() => console.log("Seller rejection email sent"))
                        .catch(err => console.warn("EmailJS notification skipped:", err));
                }
            } catch (e) {
                alert("Reject failed: " + e.message);
            }
        }
    );
};

// 8. Approved Sellers Directory
function renderApprovedSellers() {
    const tbody = document.getElementById('adminApprovedSellersTbody');
    if (!tbody) return;

    if (allApprovedSellers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:24px;">No approved sellers registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = allApprovedSellers.map(s => {
        const isActive = (s.status || 'active') === 'active';
        return `
            <tr>
                <td><strong style="color:#fff;">${s.name || 'Seller'}</strong></td>
                <td><span style="color:var(--accent); font-weight:600;">${s.mobile || 'N/A'}</span></td>
                <td><div style="font-size:12px; color:var(--text-muted); max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.assignedStoreAddress || 'Store Counter'}</div></td>
                <td style="font-size:12px; color:var(--text-dim);">${s.approvedDate || ''}</td>
                <td>
                    <span class="badge ${isActive ? 'badge-delivered' : 'badge-cancelled'}">${isActive ? 'Active' : 'Disabled'}</span>
                </td>
                <td>
                    <button class="btn-sm ${isActive ? 'btn-reject' : 'btn-accept'}" onclick="toggleSellerActive('${s.firebaseKey}', ${!isActive})">
                        ${isActive ? 'Disable' : 'Activate'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.toggleSellerActive = async function(key, active) {
    if (!db) return;
    try {
        await update(ref(db, `approvedSellers/${key}`), { status: active ? 'active' : 'disabled' });
        showToast(active ? "Seller activated." : "Seller disabled.");
    } catch (e) {
        alert("Action failed: " + e.message);
    }
};

// 9. Customers Management
function extractCustomersFromOrders() {
    const map = new Map();
    allOrders.forEach(o => {
        const email = o.userEmail || o.customerPhone || 'unknown';
        if (!map.has(email)) {
            map.set(email, {
                email: o.userEmail || 'N/A',
                name: o.customerName || 'Customer',
                phone: o.customerPhone || 'N/A',
                orderCount: 1,
                status: 'Active'
            });
        } else {
            const existing = map.get(email);
            existing.orderCount += 1;
        }
    });
    allCustomers = Array.from(map.values());
    renderCustomers();
}

function renderCustomers() {
    const tbody = document.getElementById('adminCustomersTbody');
    if (!tbody) return;

    if (allCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:24px;">No customer profiles recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = allCustomers.map((c, idx) => `
        <tr>
            <td><strong style="color:#fff;">${c.name}</strong></td>
            <td><span style="color:var(--text-muted);">${c.email}</span></td>
            <td><span style="color:var(--accent); font-weight:600;">${c.phone}</span></td>
            <td><span class="badge badge-confirmed">${c.orderCount} Order${c.orderCount > 1 ? 's' : ''}</span></td>
            <td><span class="badge ${c.status === 'Active' ? 'badge-delivered' : 'badge-cancelled'}">${c.status}</span></td>
            <td>
                <button class="btn-sm btn-view" onclick="filterCustomerOrders('${c.phone}')">View Orders</button>
            </td>
        </tr>
    `).join('');
}

window.filterCustomerOrders = function(phone) {
    switchAdminSection('orders');
    const searchInput = document.getElementById('filterOrderSearch');
    if (searchInput) {
        searchInput.value = phone;
        renderAdminOrders();
    }
};

// 10. Categories & Brands
function renderCategories() {
    const tbody = document.getElementById('adminCategoriesTbody');
    if (!tbody) return;

    tbody.innerHTML = allCategories.map(cat => `
        <tr>
            <td><i class="fa-solid ${cat.icon || 'fa-layer-group'}" style="color:var(--accent); font-size:16px;"></i></td>
            <td><strong style="color:#fff;">${cat.name}</strong></td>
            <td><span style="color:var(--text-dim); font-size:12px;">${cat.slug}</span></td>
            <td><span class="badge ${cat.status === 'active' ? 'badge-delivered' : 'badge-cancelled'}">${cat.status}</span></td>
            <td>
                <button class="btn-sm btn-delete" onclick="promptDeleteCategory('${cat.key}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openAddCategoryModal = function() {
    const name = prompt("Enter new category name (e.g. Smart Watches, Audio):");
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    if (!db) return;
    push(ref(db, 'categories'), { name, slug, icon: 'fa-layer-group', status: 'active' });
    showToast("Category added.");
};

window.promptDeleteCategory = function(key) {
    if (!db || !confirm("Delete this category?")) return;
    remove(ref(db, `categories/${key}`));
    showToast("Category removed.");
};

function renderBrands() {
    const tbody = document.getElementById('adminBrandsTbody');
    if (!tbody) return;

    tbody.innerHTML = allBrands.map(b => `
        <tr>
            <td>
                <img src="${b.logo || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=60'}" style="width:32px; height:32px; object-fit:contain; border-radius:6px; background:#1e293b; padding:2px;">
            </td>
            <td><strong style="color:#fff;">${b.name}</strong></td>
            <td><span class="badge ${b.status === 'active' ? 'badge-delivered' : 'badge-cancelled'}">${b.status}</span></td>
            <td>
                <button class="btn-sm btn-delete" onclick="promptDeleteBrand('${b.key}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openAddBrandModal = function() {
    const name = prompt("Enter Brand Name (e.g. Apple, Samsung, Nothing):");
    if (!name) return;
    if (!db) return;
    push(ref(db, 'brands'), { name, logo: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100', status: 'active' });
    showToast("Brand added.");
};

window.promptDeleteBrand = function(key) {
    if (!db || !confirm("Delete this brand?")) return;
    remove(ref(db, `brands/${key}`));
    showToast("Brand removed.");
};

function populateBrandSelects() {
    const pBrand = document.getElementById('pBrand');
    const filterBrand = document.getElementById('filterProductBrand');
    const brandsList = allBrands.map(b => b.name);
    ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Realme', 'Google', 'Oppo'].forEach(def => {
        if (!brandsList.includes(def)) brandsList.push(def);
    });

    if (pBrand) {
        pBrand.innerHTML = brandsList.map(b => `<option value="${b}">${b}</option>`).join('');
    }
    if (filterBrand) {
        filterBrand.innerHTML = `<option value="all">All Brands</option>` + brandsList.map(b => `<option value="${b}">${b}</option>`).join('');
    }
}

function populateCategorySelects() {
    const pCat = document.getElementById('pCategory');
    if (pCat) {
        pCat.innerHTML = allCategories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
    }
}

// 11. Shop Info & Store Location
function populateShopInfoFields() {
    if (document.getElementById('siName')) document.getElementById('siName').value = shopInfo.name || 'Rittik Mobile Shop';
    if (document.getElementById('siMobile')) document.getElementById('siMobile').value = shopInfo.mobile || '';
    if (document.getElementById('siWhatsApp')) document.getElementById('siWhatsApp').value = shopInfo.whatsapp || '';
    if (document.getElementById('siAddress')) document.getElementById('siAddress').value = shopInfo.address || '';
    if (document.getElementById('siCity')) document.getElementById('siCity').value = shopInfo.city || '';
    if (document.getElementById('siState')) document.getElementById('siState').value = shopInfo.state || 'West Bengal';
    if (document.getElementById('siPincode')) document.getElementById('siPincode').value = shopInfo.pincode || '';
    if (document.getElementById('siOpenHours')) document.getElementById('siOpenHours').value = shopInfo.openHours || '';
    if (document.getElementById('siEmail')) document.getElementById('siEmail').value = shopInfo.email || '';
}

window.saveShopInfo = async function() {
    if (!db) return;
    const payload = {
        name: document.getElementById('siName')?.value.trim() || 'Rittik Mobile Shop',
        mobile: document.getElementById('siMobile')?.value.trim() || '',
        whatsapp: document.getElementById('siWhatsApp')?.value.trim() || '',
        address: document.getElementById('siAddress')?.value.trim() || '',
        city: document.getElementById('siCity')?.value.trim() || '',
        state: document.getElementById('siState')?.value.trim() || '',
        pincode: document.getElementById('siPincode')?.value.trim() || '',
        openHours: document.getElementById('siOpenHours')?.value.trim() || '',
        email: document.getElementById('siEmail')?.value.trim() || ''
    };

    try {
        await set(ref(db, 'shopInfo'), payload);
        showToast("Shop information saved and updated across system! 🏪");
    } catch (e) {
        alert("Failed to save shop info: " + e.message);
    }
};

window.detectStoreCoordinates = function() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('locLat').value = lat;
            document.getElementById('locLng').value = lng;
            updateStoreMapPreview(lat, lng);
            showToast("Device coordinates detected! 📍");
        },
        () => alert("Location permission denied.")
    );
};

window.updateStoreMapPreview = function(lat, lng) {
    if (!lat) lat = Number(document.getElementById('locLat')?.value) || 22.5726;
    if (!lng) lng = Number(document.getElementById('locLng')?.value) || 88.3639;
    const iframe = document.getElementById('storeMapIframe');
    if (iframe) {
        iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
    }
};

window.saveStoreLocation = async function() {
    if (!db) return;
    const lat = Number(document.getElementById('locLat')?.value) || 22.5726;
    const lng = Number(document.getElementById('locLng')?.value) || 88.3639;
    try {
        await set(ref(db, 'storeLocation'), { lat, lng });
        showToast("Store GPS location saved! 📍");
    } catch (e) {
        alert("Location save error: " + e.message);
    }
};

// 12. Website Settings, Delivery, Homepage, Language
window.saveWebsiteSettings = async function() {
    if (!db) return;
    const payload = {
        title: document.getElementById('setSiteTitle')?.value.trim() || 'Rittik Mobile Shop',
        logoUrl: document.getElementById('setLogoUrl')?.value.trim() || '',
        facebook: document.getElementById('setFacebook')?.value.trim() || '',
        instagram: document.getElementById('setInstagram')?.value.trim() || ''
    };
    try {
        await set(ref(db, 'websiteSettings'), payload);
        showToast("Website branding saved! ✨");
    } catch (e) {
        alert("Settings save error: " + e.message);
    }
};

window.saveDeliverySettings = async function() {
    if (!db) return;
    const payload = {
        charge: Number(document.getElementById('delCharge')?.value) || 0,
        freeThreshold: Number(document.getElementById('delFreeLimit')?.value) || 499,
        deliveryDays: document.getElementById('delDays')?.value.trim() || '2 - 4 Business Days'
    };
    try {
        await set(ref(db, 'deliverySettings'), payload);
        showToast("Delivery settings saved! 🚚");
    } catch (e) {
        alert("Delivery save error: " + e.message);
    }
};

window.saveHomepageSettings = async function() {
    if (!db) return;
    const payload = {
        announcement: document.getElementById('hpAnnouncement')?.value.trim() || '',
        heroHeadline: document.getElementById('hpHeroHeadline')?.value.trim() || '',
        heroSubtitle: document.getElementById('hpHeroSubtitle')?.value.trim() || '',
        heroImage: document.getElementById('hpHeroImage')?.value.trim() || ''
    };
    try {
        await set(ref(db, 'homepageSettings'), payload);
        showToast("Homepage content saved! 🏠");
    } catch (e) {
        alert("Homepage save error: " + e.message);
    }
};

window.saveLanguageSettings = async function() {
    if (!db) return;
    const defaultLang = document.getElementById('langDefaultSelect')?.value || 'en';
    try {
        await set(ref(db, 'languageSettings'), { defaultLang });
        showToast("Language preferences saved! 🌐");
    } catch (e) {
        alert("Language save error: " + e.message);
    }
};

window.clearAdminNotifications = function() {
    const list = document.getElementById('adminNotificationList');
    if (list) list.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:30px;">Notifications cleared.</p>`;
    showToast("Notifications cleared.");
};

// 13. Confirm Modal Helper
let onConfirmCallback = null;

function openConfirmModal(title, text, onConfirm) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    onConfirmCallback = onConfirm;
    document.getElementById('confirmModal').style.display = 'flex';
}

window.closeConfirmModal = function() {
    document.getElementById('confirmModal').style.display = 'none';
    onConfirmCallback = null;
};

document.getElementById('btnConfirmModalAction')?.addEventListener('click', () => {
    if (onConfirmCallback) onConfirmCallback();
});

function escapeHtml(str = '') {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
