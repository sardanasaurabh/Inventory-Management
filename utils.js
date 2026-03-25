// ============================================================
//  INVENTORY APP — SHARED CART + UTILITIES
// ============================================================

// ── Cart (persisted in localStorage) ──────────────────────

const Cart = {
  _key: 'inv_cart',
  get() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch { return []; } },
  save(items) { localStorage.setItem(this._key, JSON.stringify(items)); },
  add(product, qty = 1) {
    const items = this.get();
    const idx = items.findIndex(i => i.sku === product.sku);
    if (idx >= 0) {
      items[idx].qty = Math.min(items[idx].qty + qty, product.stock);
    } else {
      items.push({ sku: product.sku, name: product.name, price: product.price, qty, stock: product.stock, category: product.category });
    }
    this.save(items);
    this._notify();
  },
  remove(sku) {
    this.save(this.get().filter(i => i.sku !== sku));
    this._notify();
  },
  updateQty(sku, qty) {
    const items = this.get();
    const idx = items.findIndex(i => i.sku === sku);
    if (idx >= 0) { if (qty <= 0) { items.splice(idx, 1); } else { items[idx].qty = qty; } }
    this.save(items);
    this._notify();
  },
  clear() { localStorage.removeItem(this._key); this._notify(); },
  count() { return this.get().reduce((s, i) => s + i.qty, 0); },
  subtotal() { return this.get().reduce((s, i) => s + i.price * i.qty, 0); },
  _notify() { window.dispatchEvent(new CustomEvent('cartUpdated')); }
};

// ── API calls ─────────────────────────────────────────────

const API = {
  async call(params) {
    const url = APP_CONFIG.API_URL;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(data) {
    const res = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  getInventory(activeOnly = true) {
    return this.call({ action: 'getInventory', activeOnly });
  },
  placeOrder(items, note = '') {
    return this.post({ action: 'placeOrder', items, note });
  },
  getOrders(token) {
    return this.call({ action: 'getOrders', token });
  },
  addProduct(data, token) {
    return this.post({ action: 'addProduct', data, token });
  },
  updateProduct(sku, data, token) {
    return this.post({ action: 'updateProduct', sku, data, token });
  },
  verifyAdmin(password) {
    return this.call({ action: 'verifyAdmin', password });
  }
};

// ── Toast notifications ───────────────────────────────────

function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 350); }, 2800);
}

// ── Number formatting ─────────────────────────────────────

function fmt(amount) {
  return APP_CONFIG.CURRENCY + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Nav cart badge ────────────────────────────────────────

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const c = Cart.count();
    badge.textContent = c;
    badge.style.display = c > 0 ? 'inline-flex' : 'none';
  }
}
window.addEventListener('cartUpdated', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

// ── Stock badge helper ────────────────────────────────────

function stockBadge(qty) {
  if (qty === 0)  return `<span class="stock-badge out-stock">Out of stock</span>`;
  if (qty <= 5)   return `<span class="stock-badge low-stock">Low: ${qty}</span>`;
  return `<span class="stock-badge in-stock">In stock: ${qty}</span>`;
}

// ── Product image placeholder ─────────────────────────────

function productImgHtml(p) {
  if (p.imageUrl && p.imageUrl.trim()) {
    return `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="product-img-placeholder" style="display:none">📦</div>`;
  }
  const icons = { Electronics:'💻', Clothing:'👕', Food:'🥗', Books:'📚', Furniture:'🛋️', Tools:'🔧', Toys:'🎮', default:'📦' };
  return icons[p.category] || icons.default;
}
