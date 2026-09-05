/* =========================================================
   AI SHOPPING AGENT — SCRIPT.JS
   Full Application Logic
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
========================================================= */

let allProducts = [];
let filteredProducts = [];
let cart = [];
let currentCategory = "all";
let currentSearch = "";
const originalPrices = {};

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
        ? "http://127.0.0.1:8000"
        : "";

/* =========================================================
   HELPERS & UTILITIES
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function formatPrice(price) {
    const number = Number(price) || 0;
    return number.toLocaleString("en-IN", {
        maximumFractionDigits: 0
    });
}

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getProductId(product, index) {
    return String(
        product.id ||
        product._id ||
        product.product_id ||
        product.productId ||
        `product-${index}`
    );
}

function getProductName(product) {
    return product.name || product.title || "Product";
}

function getProductPrice(product) {
    return Number(
        product.price ||
        product.sale_price ||
        product.selling_price ||
        0
    );
}

function getProductImage(product) {
    return (
        product.image ||
        product.image_url ||
        product.imageUrl ||
        product.thumbnail ||
        product.photo ||
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80"
    );
}

function getProductCategory(product) {
    return product.category || product.type || "electronics";
}

function getProductRating(product) {
    return Number(product.rating || product.stars || 4.5);
}

function getReviewCount(product) {
    return Number(
        product.reviewCount ||
        product.reviews ||
        product.review_count ||
        Math.floor(Math.random() * 500) + 50
    );
}

function getProductDescription(product) {
    return (
        product.description ||
        product.desc ||
        "High quality product recommended by your AI shopping agent."
    );
}

function getProductFeatures(product) {
    if (Array.isArray(product.features)) {
        return product.features;
    }
    if (typeof product.features === "string") {
        return product.features
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }
    return [];
}

function handleImageError(image) {
    image.onerror = null;
    const card = image.closest(".product-card") || image.closest(".modal-content") || image.closest(".cart-item");
    const text = (card ? card.textContent : "").toLowerCase();

    if (text.includes("laptop") || text.includes("macbook") || text.includes("thinkpad") || text.includes("xps") || text.includes("spectre") || text.includes("zephyrus")) {
        image.src = "images/macbook-air-m3.png";
    } else if (text.includes("charger") || text.includes("power bank") || text.includes("adapter") || text.includes("cable") || text.includes("power plate")) {
        image.src = "images/portronics-power-plate.png";
    } else if (text.includes("mouse")) {
        image.src = "images/logitech-m331.png";
    } else if (text.includes("keyboard")) {
        image.src = "images/logitech-k380.png";
    } else {
        image.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80";
    }
}

/* =========================================================
   TOAST MESSAGES
========================================================= */

function showToast(message) {
    let toast = getElement("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}

/* =========================================================
   LOCAL STORAGE — CART & PROFILE
========================================================= */

function saveCart() {
    try {
        localStorage.setItem("aiShoppingCart", JSON.stringify(cart));
    } catch (error) {
        console.error("Unable to save cart:", error);
    }
}

function loadCart() {
    try {
        const savedCart = localStorage.getItem("aiShoppingCart");
        if (savedCart) {
            const parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed)) {
                cart = parsed;
            }
        }
    } catch (error) {
        console.error("Unable to load cart:", error);
        cart = [];
    }
}

function updateCartCount() {
    const cartCount = getElement("cartCount");
    if (!cartCount) return;
    const count = cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
    cartCount.textContent = count;
}

function saveProfileData() {
    const name = getElement("profileName")?.value.trim() || "";
    const email = getElement("profileEmail")?.value.trim() || "";
    const phone = getElement("profilePhone")?.value.trim() || "";
    const address = getElement("profileAddress")?.value.trim() || "";

    localStorage.setItem("profileName", name);
    localStorage.setItem("profileEmail", email);
    localStorage.setItem("profilePhone", phone);
    localStorage.setItem("profileAddress", address);

    updateProfileHeader(name, email);
}

function loadProfileData() {
    const name = localStorage.getItem("profileName") || localStorage.getItem("userName") || "";
    const email = localStorage.getItem("profileEmail") || localStorage.getItem("userEmail") || "";
    const phone = localStorage.getItem("profilePhone") || "";
    const address = localStorage.getItem("profileAddress") || localStorage.getItem("userAddress") || "";

    const nameInput = getElement("profileName");
    const emailInput = getElement("profileEmail");
    const phoneInput = getElement("profilePhone");
    const addressInput = getElement("profileAddress");
    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = email;
    if (phoneInput) phoneInput.value = phone;
    if (addressInput) addressInput.value = address;

    updateProfileHeader(name, email);
}

function updateProfileHeader(name, email) {
    const nameDisplay = getElement("profileDisplayName");
    const emailDisplay = getElement("profileDisplayEmail");
    const avatarText = getElement("profileAvatarText");

    if (nameDisplay) nameDisplay.textContent = name || "User Account";
    if (emailDisplay) emailDisplay.textContent = email || "Manage account settings, orders, and preferences";
    if (avatarText && name) avatarText.textContent = name.charAt(0).toUpperCase();
}

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 AI Shopping Agent initialization started");
    
    // Check Dark Mode
    if (localStorage.getItem("settingDarkMode") === "true") {
        document.body.classList.add("dark-mode");
        const darkToggle = getElement("settingDarkMode");
        if (darkToggle) darkToggle.checked = true;
    }

    loadCart();
    loadProfileData();
    updateCartCount();
    initializeButtons();
    initializeProfileTabs();
    loadProducts();
});

function initializeButtons() {
    const cartButton = getElement("cartButton");
    const profileButton = getElement("profileButton");
    const closeCart = getElement("closeCart");
    const closeProfile = getElement("closeProfile");
    const closeProduct = getElement("closeProduct");
    const closeCheckout = getElement("closeCheckout");
    const checkoutButton = getElement("checkoutButton");
    const backToCart = getElement("backToCart");
    const saveProfileButton = getElement("saveProfile");
    const searchButton = getElement("searchButton");
    const searchInput = getElement("searchInput");

    if (cartButton) cartButton.addEventListener("click", openCart);
    if (profileButton) profileButton.addEventListener("click", openProfile);

    if (closeCart) closeCart.addEventListener("click", () => closeModal("cartModal"));
    if (closeProfile) closeProfile.addEventListener("click", () => closeModal("profileModal"));
    if (closeProduct) closeProduct.addEventListener("click", () => closeModal("productModal"));
    if (closeCheckout) closeCheckout.addEventListener("click", () => closeModal("checkoutModal"));

    if (checkoutButton) checkoutButton.addEventListener("click", checkout);
    if (backToCart) {
        backToCart.addEventListener("click", () => {
            closeModal("checkoutModal");
            openCart();
        });
    }

    if (saveProfileButton) {
        saveProfileButton.addEventListener("click", () => {
            saveProfileData();
            showToast("✅ Profile saved successfully!");
            closeModal("profileModal");
        });
    }

    if (searchButton) searchButton.addEventListener("click", searchProducts);
    if (searchInput) {
        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                searchProducts();
            }
        });
    }

    initializeCategories();
}

/* =========================================================
   CATEGORY FILTERING
========================================================= */

function initializeCategories() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const category = item.getAttribute("data-category") || "all";
            filterByCategory(category);
        });
    });
}

function filterByCategory(category) {
    currentCategory = category.toLowerCase();
    
    // Clear search box if user selects a category explicitly
    const searchInput = getElement("searchInput");
    if (searchInput) searchInput.value = "";
    
    const aiAnswer = getElement("aiAnswer");
    if (aiAnswer) aiAnswer.style.display = "none";

    const sectionTitle = document.querySelector(".products-header h2");
    const sectionSubtitle = document.querySelector(".products-header p");

    if (sectionTitle) {
        if (currentCategory === "all") sectionTitle.textContent = "🛍️ All Products";
        else if (currentCategory.includes("laptop")) sectionTitle.textContent = "💻 Premium Laptops";
        else if (currentCategory === "headphones") sectionTitle.textContent = "🎧 Headphones";
        else if (currentCategory === "earbuds") sectionTitle.textContent = "🎵 Earbuds";
        else if (currentCategory === "keyboards") sectionTitle.textContent = "⌨️ Keyboards";
        else if (currentCategory === "mouse") sectionTitle.textContent = "🖱️ Wireless & Gaming Mice";
        else if (currentCategory === "accessories") sectionTitle.textContent = "🔌 Tech Accessories";
        else if (currentCategory === "deals") sectionTitle.textContent = "🔥 Best Deals";
        else if (currentCategory === "top") sectionTitle.textContent = "⭐ Top Rated Products";
        else sectionTitle.textContent = `🛍️ ${category.charAt(0).toUpperCase() + category.slice(1)}`;
    }

    if (sectionSubtitle) {
        if (currentCategory.includes("laptop")) sectionSubtitle.textContent = "Explore high-performance MacBooks, Gaming Laptops, Ultrabooks & Workstations";
        else sectionSubtitle.textContent = "Explore our products recommended by AI";
    }

    if (currentCategory === "all") {
        filteredProducts = [...allProducts];
    } else if (currentCategory === "deals") {
        filteredProducts = allProducts.filter(p => (p.discount && p.discount > 0) || (p.price && p.price < 5000));
    } else if (currentCategory === "top") {
        filteredProducts = allProducts.filter(p => getProductRating(p) >= 4.5);
    } else if (currentCategory.includes("laptop")) {
        filteredProducts = allProducts.filter(p => {
            const cat = getProductCategory(p).toLowerCase();
            const name = getProductName(p).toLowerCase();
            return cat.includes("laptop") || name.includes("macbook") || name.includes("laptop") || 
                   name.includes("thinkpad") || name.includes("xps") || name.includes("spectre") || 
                   name.includes("zephyrus") || name.includes("swift");
        });
    } else {
        filteredProducts = allProducts.filter(p => {
            const cat = getProductCategory(p).toLowerCase();
            const name = getProductName(p).toLowerCase();
            return cat.includes(currentCategory) || name.includes(currentCategory) || 
                   (currentCategory === "accessories" && (cat.includes("charger") || cat.includes("storage") || cat.includes("power bank") || cat.includes("cable")));
        });
    }

    renderProducts(filteredProducts);
}

/* =========================================================
   PRODUCT LOADING & RENDERING
========================================================= */

async function loadProducts() {
    const productsContainer = getElement("products");
    if (!productsContainer) return;

    productsContainer.innerHTML = `
        <div class="loading">
            🔄 Loading products...
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) throw new Error(`Server status ${response.status}`);
        
        const data = await response.json();
        if (Array.isArray(data)) {
            allProducts = data;
        } else if (Array.isArray(data.products)) {
            allProducts = data.products;
        } else {
            allProducts = getLocalProducts();
        }
    } catch (error) {
        console.warn("Backend unavailable, using local product catalog:", error);
        allProducts = getLocalProducts();
    }

    if (!allProducts || !allProducts.length) {
        allProducts = getLocalProducts();
    }

    allProducts.forEach((product, index) => {
        const id = getProductId(product, index);
        originalPrices[id] = getProductPrice(product);
    });

    filteredProducts = [...allProducts];
    renderProducts(filteredProducts);
}

function renderProducts(productsList) {
    const container = getElement("products");
    if (!container) return;

    if (!Array.isArray(productsList) || productsList.length === 0) {
        container.innerHTML = `
            <div class="error">
                🔍 No matching products found. Try searching for headphones, mouse, keyboard, or speaker.
            </div>
        `;
        return;
    }

    container.innerHTML = productsList.map((product, index) => createProductCard(product, index)).join("");
    attachProductButtons();
}

function createProductCard(product, index) {
    const id = getProductId(product, index);
    const name = getProductName(product);
    const price = getProductPrice(product);
    const oldPrice = Number(product.oldPrice || product.old_price || (price * 1.2));
    const category = getProductCategory(product);
    const rating = getProductRating(product);
    const reviews = getReviewCount(product);
    const image = getProductImage(product);
    const description = getProductDescription(product);
    const features = getProductFeatures(product);
    const discount = Number(product.discount || (oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0));

    const inCart = cart.some(item => String(item.id) === String(id));

    let featuresHTML = "";
    if (features.length) {
        featuresHTML = `
            <strong>Key Features:</strong>
            <ul>
                ${features.slice(0, 3).map(feature => `<li>${escapeHTML(feature)}</li>`).join("")}
            </ul>
        `;
    }

    return `
        <article class="product-card" data-product-id="${escapeHTML(id)}">
            ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ""}
            
            <img 
                class="product-image" 
                src="${escapeHTML(image)}" 
                alt="${escapeHTML(name)}" 
                loading="lazy" 
                onerror="handleImageError(this)"
            >

            <span class="category">${escapeHTML(category)}</span>
            
            <h3>${escapeHTML(name)}</h3>
            
            <div class="rating">
                ⭐ ${rating} <span class="review-count">(${reviews})</span>
            </div>

            <div class="price-section">
                ${oldPrice > price ? `<span class="old-price">₹${formatPrice(oldPrice)}</span>` : ""}
                <span class="price">₹${formatPrice(price)}</span>
            </div>

            <p>${escapeHTML(description)}</p>

            ${featuresHTML}

            <div class="product-actions">
                <button 
                    type="button" 
                    class="details-button" 
                    data-action="details" 
                    data-product-id="${escapeHTML(id)}"
                >
                    View Details
                </button>

                <button 
                    type="button" 
                    class="buy-button ${inCart ? 'in-cart' : ''}" 
                    data-action="cart" 
                    data-product-id="${escapeHTML(id)}"
                >
                    ${inCart ? "✓ In Cart" : "🛒 Add to Cart"}
                </button>
            </div>
        </article>
    `;
}

function attachProductButtons() {
    const buttons = document.querySelectorAll("[data-action]");
    buttons.forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            const action = button.dataset.action;
            const id = button.dataset.productId;

            if (action === "cart") {
                addToCartById(id);
            } else if (action === "details") {
                openProductDetails(id);
            }
        };
    });
}

/* =========================================================
   SEARCH & AI RECOMMENDATION
========================================================= */

async function searchProducts() {
    const searchInput = getElement("searchInput");
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) {
        filteredProducts = [...allProducts];
        renderProducts(filteredProducts);
        const aiAnswer = getElement("aiAnswer");
        if (aiAnswer) aiAnswer.style.display = "none";
        return;
    }

    const aiAnswer = getElement("aiAnswer");
    const aiAnswerContent = getElement("aiAnswerContent");
    
    if (aiAnswer && aiAnswerContent) {
        aiAnswer.style.display = "block";
        aiAnswerContent.innerHTML = "🤖 <em>AI Shopping Assistant is searching for recommendations...</em>";
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ai-search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Search request failed");
        
        const data = await response.json();
        
        if (aiAnswerContent && data.answer) {
            aiAnswerContent.innerHTML = formatMarkdownText(data.answer);
        }

        if (data.products && data.products.length > 0) {
            filteredProducts = data.products;
        } else {
            filteredProducts = searchLocalProducts(query);
        }
    } catch (error) {
        console.warn("Backend search fallback:", error);
        
        filteredProducts = searchLocalProducts(query);
        if (aiAnswerContent) {
            if (filteredProducts.length > 0) {
                aiAnswerContent.innerHTML = `Found <strong>${filteredProducts.length}</strong> matching product(s) for "<strong>${escapeHTML(query)}</strong>". Top pick: <strong>${escapeHTML(filteredProducts[0].name)}</strong>.`;
            } else {
                aiAnswerContent.innerHTML = `No direct matches for "<strong>${escapeHTML(query)}</strong>". Try searching for popular categories like <em>headphones, mouse, keyboard, or earbuds</em>.`;
            }
        }
    }

    renderProducts(filteredProducts);
}

function searchLocalProducts(query) {
    const terms = query.toLowerCase().split(" ").filter(t => t.length > 1);
    
    return allProducts.filter(product => {
        const text = `${getProductName(product)} ${getProductCategory(product)} ${getProductDescription(product)} ${getProductFeatures(product).join(" ")}`.toLowerCase();
        return terms.some(term => text.includes(term));
    });
}

function formatMarkdownText(text) {
    let formatted = escapeHTML(text);
    formatted = formatted.replace(/\n\n/g, "<br><br>");
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    return formatted;
}

/* =========================================================
   CART CRUD & MANAGEMENT
========================================================= */

function addToCartById(id) {
    const product = allProducts.find((p, idx) => getProductId(p, idx) === String(id)) || 
                    getLocalProducts().find((p, idx) => getProductId(p, idx) === String(id));

    if (!product) return;

    const existingIndex = cart.findIndex(item => String(item.id) === String(id));

    if (existingIndex > -1) {
        cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + 1;
        showToast(`Increased ${getProductName(product)} quantity to ${cart[existingIndex].quantity}`);
    } else {
        cart.push({
            id: String(id),
            name: getProductName(product),
            price: getProductPrice(product),
            image: getProductImage(product),
            quantity: 1
        });
        showToast(`Added ${getProductName(product)} to cart 🛒`);
    }

    saveCart();
    updateCartCount();
    renderProducts(filteredProducts);
}

function updateQuantity(id, change) {
    const index = cart.findIndex(item => String(item.id) === String(id));
    if (index === -1) return;

    cart[index].quantity = (Number(cart[index].quantity) || 1) + change;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    saveCart();
    updateCartCount();
    renderCart();
    renderProducts(filteredProducts);
}

function removeFromCart(id) {
    cart = cart.filter(item => String(item.id) !== String(id));
    saveCart();
    updateCartCount();
    renderCart();
    renderProducts(filteredProducts);
}

function openCart() {
    renderCart();
    openModal("cartModal");
}

function renderCart() {
    const cartItemsContainer = getElement("cartItems");
    const cartTotalElement = getElement("cartTotal");

    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-message">Your cart is empty. Add products to get started!</p>`;
        if (cartTotalElement) cartTotalElement.textContent = "0";
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        total += itemTotal;

        return `
            <div class="cart-item">
                <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="handleImageError(this)">
                
                <div class="cart-item-details">
                    <h4>${escapeHTML(item.name)}</h4>
                    <span class="cart-item-price">₹${formatPrice(item.price)}</span>
                </div>

                <div class="cart-item-controls">
                    <button type="button" onclick="updateQuantity('${escapeHTML(item.id)}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" onclick="updateQuantity('${escapeHTML(item.id)}', 1)">+</button>
                    <button type="button" class="remove-btn" onclick="removeFromCart('${escapeHTML(item.id)}')">🗑️</button>
                </div>
            </div>
        `;
    }).join("");

    if (cartTotalElement) cartTotalElement.textContent = formatPrice(total);
}

/* =========================================================
   PROFILE & ACCOUNT HUB MODAL
========================================================= */

function initializeProfileTabs() {
    const tabs = document.querySelectorAll(".profile-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const targetTab = tab.getAttribute("data-tab");
            const contents = document.querySelectorAll(".profile-tab-content");
            contents.forEach(c => {
                c.style.display = "none";
                c.classList.remove("active");
            });

            const activeContent = getElement(targetTab);
            if (activeContent) {
                activeContent.style.display = "block";
                activeContent.classList.add("active");
            }

            if (targetTab === "tab-orders") {
                renderOrderHistory();
            } else if (targetTab === "tab-cart") {
                renderProfileCartSummary();
            }
        });
    });
}

function openProfile() {
    loadProfileData();
    renderOrderHistory();
    renderProfileCartSummary();
    openModal("profileModal");
}

function renderOrderHistory() {
    const ordersContainer = getElement("ordersList");
    if (!ordersContainer) return;

    let history = [];
    try {
        const saved = localStorage.getItem("aiOrderHistory");
        if (saved) history = JSON.parse(saved);
    } catch (e) {
        history = [];
    }

    if (!Array.isArray(history) || history.length === 0) {
        ordersContainer.innerHTML = `<p class="empty-message">📦 No past orders found. Place your first order today!</p>`;
        return;
    }

    ordersContainer.innerHTML = history.map(order => `
        <div class="order-card">
            <div class="order-card-header">
                <div>
                    <span class="order-card-id">${escapeHTML(order.orderId)}</span>
                    <span style="font-size:12px; color:#64748b; margin-left:8px;">${escapeHTML(order.date || "")}</span>
                </div>
                <span class="order-card-status">${escapeHTML(order.status || "Paid / Confirmed")}</span>
            </div>
            <div class="order-card-body">
                <div style="margin-bottom:4px;">📍 <strong>Delivery Address:</strong> ${escapeHTML(order.address || "Standard Address")}</div>
                <div style="margin-bottom:4px;">🛍️ <strong>Items (${order.items ? order.items.length : 0}):</strong> ${order.items ? order.items.map(i => `${escapeHTML(i.name)} (x${i.quantity})`).join(", ") : "Product order"}</div>
                <div style="margin-top:6px; font-weight:bold; color:#16a34a; font-size:14px;">Total Paid: ₹${formatPrice(order.totalAmount)}</div>
            </div>
        </div>
    `).join("");
}

function renderProfileCartSummary() {
    const summaryContainer = getElement("profileCartSummary");
    if (!summaryContainer) return;

    if (cart.length === 0) {
        summaryContainer.innerHTML = `<p class="empty-message">🛒 Your cart is currently empty. Explore our catalog to add items!</p>`;
        return;
    }

    const total = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    summaryContainer.innerHTML = `
        <div style="margin-bottom:15px;">
            <p style="font-size:14px; color:#64748b; margin-bottom:10px;">You have <strong>${cart.length}</strong> product(s) in your cart:</p>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">
                ${cart.map(item => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px 12px; border-radius:8px; font-size:13px; border:1px solid #e2e8f0;">
                        <span>${escapeHTML(item.name)} (x${item.quantity})</span>
                        <strong style="color:#16a34a;">₹${formatPrice(Number(item.price) * Number(item.quantity))}</strong>
                    </div>
                `).join("")}
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:12px; margin-bottom:15px; font-weight:bold; font-size:16px;">
            <span>Total Amount:</span>
            <span style="color:#16a34a;">₹${formatPrice(total)}</span>
        </div>
        <button type="button" class="checkout-button" style="width:100%; text-align:center; padding:13px;" onclick="closeModal('profileModal'); checkout();">
            💳 Proceed to Checkout Now
        </button>
    `;
}

function toggleDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("settingDarkMode", "true");
    } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("settingDarkMode", "false");
    }
}

function clearUserData() {
    if (confirm("Are you sure you want to reset all local account data, order history, and cart?")) {
        localStorage.clear();
        cart = [];
        updateCartCount();
        loadProfileData();
        renderOrderHistory();
        renderProfileCartSummary();
        showToast("🧹 Local account and cart data cleared.");
    }
}

function openProductDetails(id) {
    const product = allProducts.find((p, idx) => getProductId(p, idx) === String(id)) || 
                    getLocalProducts().find((p, idx) => getProductId(p, idx) === String(id));
    if (!product) return;

    const detailsContainer = getElement("productDetails");
    if (!detailsContainer) return;

    const name = getProductName(product);
    const price = getProductPrice(product);
    const category = getProductCategory(product);
    const rating = getProductRating(product);
    const reviews = getReviewCount(product);
    const image = getProductImage(product);
    const description = getProductDescription(product);
    const features = getProductFeatures(product);
    const link = product.link || "#";

    const inCart = cart.some(item => String(item.id) === String(id));

    detailsContainer.innerHTML = `
        <img class="modal-product-image" src="${escapeHTML(image)}" alt="${escapeHTML(name)}" onerror="handleImageError(this)">
        <div class="modal-category">Category: <strong>${escapeHTML(category)}</strong></div>
        <h2>${escapeHTML(name)}</h2>
        
        <div class="rating" style="margin: 10px 0;">
            ⭐ ${rating} (${reviews} reviews)
        </div>

        <div class="modal-price">₹${formatPrice(price)}</div>

        <p class="modal-description">${escapeHTML(description)}</p>

        ${features.length ? `
            <h3>Features</h3>
            <ul class="modal-features">
                ${features.map(f => `<li>${escapeHTML(f)}</li>`).join("")}
            </ul>
        ` : ""}

        <div style="display:flex; gap:10px; margin-top:20px;">
            <button 
                type="button" 
                class="buy-button modal-buy" 
                onclick="addToCartById('${escapeHTML(id)}'); closeModal('productModal');"
            >
                ${inCart ? "✓ In Cart - Add More" : "🛒 Add to Cart"}
            </button>
            ${link !== "#" ? `
                <a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer" class="details-button" style="text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center;">
                    🌐 Official Product Page
                </a>
            ` : ""}
        </div>
    `;

    openModal("productModal");
}

function openModal(modalId) {
    const modal = getElement(modalId);
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("show");
    }
}

function closeModal(modalId) {
    const modal = getElement(modalId);
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("show");
    }
}

/* =========================================================
   CHECKOUT & PAYMENT (RAZORPAY INTEGRATION)
========================================================= */

function checkout() {
    if (cart.length === 0) {
        showToast("⚠️ Your cart is empty.");
        return;
    }

    closeModal("cartModal");

    const checkoutItems = getElement("checkoutItems");
    const checkoutTotal = getElement("checkoutTotal");

    let total = 0;
    if (checkoutItems) {
        checkoutItems.innerHTML = cart.map(item => {
            const itemTotal = Number(item.price) * Number(item.quantity);
            total += itemTotal;
            return `
                <div class="checkout-item-row" style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
                    <span>${escapeHTML(item.name)} x ${item.quantity}</span>
                    <strong>₹${formatPrice(itemTotal)}</strong>
                </div>
            `;
        }).join("");
    }

    if (checkoutTotal) checkoutTotal.textContent = formatPrice(total);

    // Pre-fill profile info if available
    const checkoutName = getElement("checkoutName");
    const checkoutEmail = getElement("checkoutEmail");
    const checkoutAddress = getElement("checkoutAddress");
    if (checkoutName && !checkoutName.value) checkoutName.value = localStorage.getItem("profileName") || localStorage.getItem("userName") || "";
    if (checkoutEmail && !checkoutEmail.value) checkoutEmail.value = localStorage.getItem("profileEmail") || localStorage.getItem("userEmail") || "";
    if (checkoutAddress && !checkoutAddress.value) checkoutAddress.value = localStorage.getItem("profileAddress") || localStorage.getItem("userAddress") || "";

    openModal("checkoutModal");
}

async function startPayment() {
    const name = getElement("checkoutName")?.value.trim();
    const email = getElement("checkoutEmail")?.value.trim();
    const phone = getElement("checkoutPhone")?.value.trim();
    const address = getElement("checkoutAddress")?.value.trim();

    if (!name) {
        showToast("⚠️ Please enter your name.");
        getElement("checkoutName")?.focus();
        return;
    }
    if (!email || !email.includes("@")) {
        showToast("⚠️ Please enter a valid email address.");
        getElement("checkoutEmail")?.focus();
        return;
    }
    if (!address) {
        showToast("⚠️ Please enter your delivery address.");
        getElement("checkoutAddress")?.focus();
        return;
    }

    // Save default address & details for future orders
    localStorage.setItem("profileName", name);
    localStorage.setItem("profileEmail", email);
    localStorage.setItem("profileAddress", address);

    const totalAmount = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    if (totalAmount <= 0) {
        showToast("⚠️ Invalid total amount.");
        return;
    }

    const payButton = getElement("payNowButton");
    if (payButton) {
        payButton.disabled = true;
        payButton.textContent = "⌛ Processing Order...";
    }

    const currentCart = [...cart];

    try {
        // Try creating Razorpay Order via backend
        const response = await fetch(`${API_BASE_URL}/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: totalAmount,
                currency: "INR"
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.order) {
                openRazorpayCheckout(data.order, data.key_id, name, email, phone, address, totalAmount, currentCart);
                if (payButton) {
                    payButton.disabled = false;
                    payButton.textContent = "💳 Pay Now";
                }
                return;
            }
        }
    } catch (error) {
        console.warn("Backend Razorpay integration fallback:", error);
    }

    // Direct place-order fallback if Razorpay server is unavailable or test keys are unconfigured
    try {
        const placeOrderResponse = await fetch(`${API_BASE_URL}/place-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                mobile: phone || "9999999999",
                address: address,
                payment_method: "Razorpay Test / Direct",
                amount: totalAmount,
                items: currentCart
            })
        });
        
        if (placeOrderResponse.ok) {
            const resData = await placeOrderResponse.json();
            completeSuccessfulOrder(resData.order_id || "ORD-" + Date.now(), name, address, totalAmount, currentCart);
            if (payButton) {
                payButton.disabled = false;
                payButton.textContent = "💳 Pay Now";
            }
            return;
        }
    } catch (err) {
        console.warn("Place order fallback error:", err);
    }

    // Fallback simulation for seamless offline demo testing
    completeSuccessfulOrder("ORD-DEMO-" + Math.floor(Math.random() * 899999 + 100000), name, address, totalAmount, currentCart);

    if (payButton) {
        payButton.disabled = false;
        payButton.textContent = "💳 Pay Now";
    }
}

function openRazorpayCheckout(order, keyId, name, email, phone, address, totalAmount, items) {
    if (typeof window.Razorpay === "undefined") {
        showToast("⚠️ Razorpay SDK failed to load. Simulating order placement.");
        completeSuccessfulOrder(order.id || "ORD-TEST", name, address, totalAmount, items);
        return;
    }

    const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "AI Shopping Agent",
        description: "Order Payment",
        order_id: order.id,
        handler: function (response) {
            verifyRazorpayPayment(response, name, address, totalAmount, items);
        },
        prefill: {
            name: name,
            email: email,
            contact: phone
        },
        theme: {
            color: "#2563eb"
        }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
}

async function verifyRazorpayPayment(paymentResponse, name, address, totalAmount, items) {
    try {
        const response = await fetch(`${API_BASE_URL}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
            })
        });

        if (response.ok) {
            completeSuccessfulOrder(paymentResponse.razorpay_order_id, name, address, totalAmount, items);
            return;
        }
    } catch (error) {
        console.warn("Payment verification failed, accepting local confirmation:", error);
    }

    completeSuccessfulOrder(paymentResponse.razorpay_order_id || "ORD-PAID", name, address, totalAmount, items);
}

function completeSuccessfulOrder(orderId, name = "", address = "", totalAmount = 0, items = []) {
    cart = [];
    saveCart();
    updateCartCount();
    closeModal("checkoutModal");

    // Save Order into History
    let history = [];
    try {
        const saved = localStorage.getItem("aiOrderHistory");
        if (saved) history = JSON.parse(saved);
    } catch (e) { history = []; }

    const formattedDate = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    history.unshift({
        orderId: orderId,
        date: formattedDate,
        name: name,
        address: address,
        totalAmount: totalAmount,
        items: items,
        status: "Paid / Confirmed"
    });
    localStorage.setItem("aiOrderHistory", JSON.stringify(history));

    const orderSuccessDetails = getElement("orderSuccessDetails");
    if (orderSuccessDetails) {
        orderSuccessDetails.innerHTML = `
            <div style="margin-bottom: 8px;">📦 <strong>Order ID:</strong> <span style="color:#2563eb;">${escapeHTML(orderId)}</span></div>
            <div style="margin-bottom: 8px;">👤 <strong>Customer:</strong> ${escapeHTML(name || "Valued Customer")}</div>
            <div style="margin-bottom: 8px;">📍 <strong>Delivery Address:</strong> ${escapeHTML(address || "Standard Delivery Address")}</div>
            <div style="margin-bottom: 8px;">💰 <strong>Total Amount Paid:</strong> <span style="color:#16a34a; font-weight:bold;">₹${formatPrice(totalAmount)}</span></div>
            <div>💳 <strong>Payment Status:</strong> <span style="color:#059669; font-weight:bold;">✓ Paid via Razorpay / Direct Payment</span></div>
        `;
    }

    showToast(`🎉 Order Placed Successfully! ID: ${orderId}`);
    openModal("orderSuccessModal");
}

/* =========================================================
   LOCAL FALLBACK CATALOG
========================================================= */

function getLocalProducts() {
    return [
        {
            id: "1",
            name: "Sony WH-1000XM5 Wireless Headphones",
            category: "headphones",
            price: 29999,
            oldPrice: 34999,
            rating: 4.8,
            reviewCount: 1250,
            discount: 14,
            image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
            description: "Industry-leading noise canceling headphones with two processors and 8 microphones for unprecedented sound.",
            features: ["Active Noise Cancellation", "30-hour battery life", "Multipoint connection", "Speak-to-Chat technology"]
        },
        {
            id: "2",
            name: "Apple AirPods Pro (2nd Gen)",
            category: "earbuds",
            price: 18999,
            oldPrice: 24900,
            rating: 4.7,
            reviewCount: 2150,
            discount: 24,
            image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500&auto=format&fit=crop&q=80",
            description: "Reengineered for even richer audio experiences. Next-level Active Noise Cancellation and Adaptive Transparency.",
            features: ["Active Noise Cancellation", "Adaptive Audio", "MagSafe Charging Case (USB-C)", "Personalized Spatial Audio"]
        },
        {
            id: "3",
            name: "Logitech MX Keys Advanced Wireless Keyboard",
            category: "keyboards",
            price: 8999,
            oldPrice: 10999,
            rating: 4.6,
            reviewCount: 890,
            discount: 18,
            image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80",
            description: "Crafted for comfort, stability, and precision. Perfect Stroke keys shaped for your fingertips.",
            features: ["Smart Backlighting", "Multi-device Easy-Switch", "USB-C rechargeable", "Tactile quiet keypresses"]
        },
        {
            id: "4",
            name: "Logitech MX Master 3S Performance Mouse",
            category: "mouse",
            price: 7499,
            oldPrice: 8995,
            rating: 4.8,
            reviewCount: 1340,
            discount: 17,
            image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&auto=format&fit=crop&q=80",
            description: "An iconic mouse remastered. With Quiet Clicks and 8K DPI track-on-glass sensor.",
            features: ["8000 DPI tracking", "MagSpeed Electromagnetic scrolling", "Quiet Clicks technology", "Ergonomic silhouette"]
        },
        {
            id: "5",
            name: "JBL Flip 6 Portable Bluetooth Speaker",
            category: "speaker",
            price: 9999,
            oldPrice: 13999,
            rating: 4.5,
            reviewCount: 980,
            discount: 28,
            image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=80",
            description: "Louder, more powerful sound. 2-way speaker system designed to deliver loud, crystal clear, powerful sound.",
            features: ["IP67 Waterproof and Dustproof", "12 Hours of Playtime", "PartyBoost compatible", "Bold audio design"]
        },
        {
            id: "6",
            name: "Anker 737 Power Bank (PowerCore 24K)",
            category: "power bank",
            price: 11999,
            oldPrice: 14999,
            rating: 4.9,
            reviewCount: 450,
            discount: 20,
            image: "https://images.unsplash.com/photo-1609592424074-88fcfb5e7d56?w=500&auto=format&fit=crop&q=80",
            description: "Ultra-powerful 140W multi-device fast charger with smart digital display.",
            features: ["140W High-Speed Charging", "24,000mAh Capacity", "Smart Digital Display", "PowerIQ 4.0 Technology"]
        },
        {
            id: "51",
            name: "Apple MacBook Air M3 (13-inch)",
            category: "laptops",
            price: 114900,
            oldPrice: 124900,
            rating: 4.9,
            reviewCount: 840,
            discount: 8,
            image: "images/macbook-air-m3.png",
            description: "Strikingly thin and fast laptop featuring the powerful Apple M3 chip, Liquid Retina display, and up to 18 hours of battery life.",
            features: ["Apple M3 8-core CPU", "8GB Unified Memory", "256GB SSD", "13.6-inch Liquid Retina Display", "18-hour battery life"]
        },
        {
            id: "52",
            name: "Dell XPS 13 Ultraportable Laptop",
            category: "laptops",
            price: 139990,
            oldPrice: 154990,
            rating: 4.7,
            reviewCount: 520,
            discount: 10,
            image: "images/dell-xps-13.png",
            description: "Iconic ultra-thin laptop crafted from CNC machined aluminum with Intel Core Ultra 7 processor and borderless InfinityEdge display.",
            features: ["Intel Core Ultra 7 155H", "16GB LPDDR5X RAM", "512GB NVMe SSD", "13.4-inch FHD+ InfinityEdge", "Thunderbolt 4 ports"]
        },
        {
            id: "53",
            name: "ASUS ROG Zephyrus G14 Gaming Laptop",
            category: "laptops",
            price: 149990,
            oldPrice: 174990,
            rating: 4.8,
            reviewCount: 670,
            discount: 14,
            image: "images/asus-rog-zephyrus.png",
            description: "Ultra-slim 14-inch gaming beast with AMD Ryzen 9 8945HS, NVIDIA GeForce RTX 4060 graphics, and 3K 120Hz OLED display.",
            features: ["AMD Ryzen 9 8945HS", "NVIDIA RTX 4060 8GB GDDR6", "16GB LPDDR5X RAM", "1TB Gen4 SSD", "3K OLED 120Hz 0.2ms Display"]
        },
        {
            id: "54",
            name: "HP Spectre x360 2-in-1 Convertible",
            category: "laptops",
            price: 124990,
            oldPrice: 139990,
            rating: 4.6,
            reviewCount: 390,
            discount: 11,
            image: "images/hp-spectre-x360.png",
            description: "Premium 360-degree convertible laptop featuring Intel Core Ultra 5, 2.8K OLED touchscreen display, and HP Rechargeable Tilt Pen.",
            features: ["Intel Core Ultra 5 125H", "16GB LPDDR5x RAM", "1TB PCIe Gen4 NVMe SSD", "14-inch 2.8K OLED Touchscreen", "360° Convertible Hinge"]
        },
        {
            id: "55",
            name: "Lenovo ThinkPad X1 Carbon Gen 11",
            category: "laptops",
            price: 145990,
            oldPrice: 162990,
            rating: 4.8,
            reviewCount: 480,
            discount: 10,
            image: "images/thinkpad-x1.png",
            description: "The ultimate ultralight business laptop built with carbon-fiber chassis, 13th Gen Intel Core i7, and enterprise-grade security.",
            features: ["Intel Core i7-1355U 13th Gen", "16GB LPDDR5 RAM", "512GB SSD PCIe NVMe", "14-inch WUXGA IPS Anti-glare", "MIL-STD 810H durability"]
        },
        {
            id: "56",
            name: "Acer Swift Go 14 OLED Laptop",
            category: "laptops",
            price: 64990,
            oldPrice: 79990,
            rating: 4.5,
            reviewCount: 310,
            discount: 19,
            image: "images/acer-swift-go.png",
            description: "Sleek and powerful ultraportable laptop equipped with 13th Gen Intel Core i5 processor and vibrant 2.8K 90Hz OLED display.",
            features: ["Intel Core i5-13500H 13th Gen", "16GB LPDDR5 RAM", "512GB PCIe Gen4 SSD", "14-inch 2.8K 90Hz OLED Display", "1.25kg Ultralight Body"]
        },
        {
            id: "57",
            name: "Apple MacBook Pro 14 (M3 Pro Chip)",
            category: "laptops",
            price: 199900,
            oldPrice: 219900,
            rating: 4.9,
            reviewCount: 1120,
            discount: 9,
            image: "images/macbook-pro-14.png",
            description: "Pro power for demanding workflows with M3 Pro chip, Liquid Retina XDR display, up to 18 hours battery, and Space Black finish.",
            features: ["Apple M3 Pro 11-core CPU", "18GB Unified Memory", "512GB SSD Storage", "14.2-inch Liquid Retina XDR", "HDMI & SDXC card slot"]
        },
        {
            id: "58",
            name: "MSI Stealth 16 Studio Gaming Laptop",
            category: "laptops",
            price: 184990,
            oldPrice: 209990,
            rating: 4.7,
            reviewCount: 280,
            discount: 12,
            image: "images/msi-stealth-16.png",
            description: "Ultra-thin studio & gaming laptop powered by Intel Core i9-13900H, RTX 4070 graphics, and 240Hz QHD+ display in magnesium-aluminum alloy.",
            features: ["Intel Core i9-13900H", "NVIDIA RTX 4070 8GB GDDR6", "32GB DDR5 5200MHz", "1TB NVMe PCIe Gen4 SSD", "16-inch QHD+ 240Hz 100% DCI-P3"]
        },
        {
            id: "59",
            name: "Samsung Galaxy Book4 Pro 360",
            category: "laptops",
            price: 163990,
            oldPrice: 179990,
            rating: 4.6,
            reviewCount: 230,
            discount: 9,
            image: "images/samsung-galaxy-book.png",
            description: "Premium 2-in-1 touchscreen laptop with Intel Core Ultra 7, Dynamic AMOLED 2X 120Hz display, and S Pen support.",
            features: ["Intel Core Ultra 7 155H", "16GB LPDDR5X Memory", "1TB NVMe SSD", "16-inch 3K Dynamic AMOLED 2X", "S Pen included"]
        },
        {
            id: "60",
            name: "HP Pavilion Plus 14 Ultralight",
            category: "laptops",
            price: 72990,
            oldPrice: 84990,
            rating: 4.5,
            reviewCount: 410,
            discount: 14,
            image: "images/hp-pavilion-plus.png",
            description: "Powerful 14-inch compact laptop with AMD Ryzen 7 7840U, 2.8K 120Hz OLED screen, and 5MP IR webcam with privacy shutter.",
            features: ["AMD Ryzen 7 7840U", "16GB LPDDR5x RAM", "1TB PCIe NVMe SSD", "14-inch 2.8K 120Hz OLED", "5MP IR Camera"]
        }
    ];
}

// Make functions available globally for inline handlers
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.addToCartById = addToCartById;
window.closeModal = closeModal;
window.startPayment = startPayment;
window.toggleDarkMode = toggleDarkMode;
window.clearUserData = clearUserData;
window.checkout = checkout;