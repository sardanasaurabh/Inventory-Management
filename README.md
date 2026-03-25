# 📦 Inventory Management App

A zero-cost inventory management system using Google Sheets as the database, Google Apps Script as the API, and GitHub Pages for hosting.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Inventory catalog — view all products |
| `sales.html` | Order/sales page — browse & add to cart |
| `cart.html` | Cart & checkout — review and confirm |
| `admin.html` | Admin panel — manage products & view orders |
| `styles.css` | Shared styles (dark theme) |
| `config.js` | **Your settings** — API URL, currency, tax rate |
| `utils.js` | Shared cart logic + API helpers |
| `Code.gs` | Google Apps Script backend — paste in Apps Script editor |

---

## 🚀 Setup Guide

### Step 1 — Google Sheet + Apps Script

1. Create a new **Google Sheet** at [sheets.google.com](https://sheets.google.com)
2. Click **Extensions → Apps Script**
3. Delete any existing code and paste the contents of `Code.gs`
4. In the SETTINGS section at the top, change:
   - `ADMIN_PASSWORD` — set a strong password
   - `TOKEN_SECRET` — set a random string
5. Click **Save**, then from the editor run `setupSheets()` (first time only)
   - This creates the Inventory, Orders, and Config sheets with sample data
6. Deploy the script:
   - **Deploy → New deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the Web App URL

### Step 2 — Configure the frontend

Open `config.js` and paste your Web App URL:

```js
const APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/YOUR_ID/exec",  // ← paste here
  STORE_NAME: "My Store",
  CURRENCY: "₹",       // change to $ £ € etc.
  TAX_RATE: 0.18,      // set to 0 for no tax
  TAX_LABEL: "GST (18%)",
  ADMIN_PASSWORD: "admin123",  // must match Code.gs ADMIN_PASSWORD
};
```

### Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial inventory app"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then go to **Settings → Pages → Source: main branch** and save.

Your app will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## 📋 Features

### Inventory Catalog (`index.html`)
- View all products in a card grid
- Search by name, SKU, description
- Filter by category, stock status
- Sort by name, price, stock level
- Click any card to see full details
- Live stats: total, in stock, low stock, out of stock

### Order/Sales Page (`sales.html`)
- Shows only in-stock items
- Per-item quantity selector
- Add to cart with visual confirmation
- Live mini-cart sidebar with running total
- Cart persists across page reloads (localStorage)

### Cart & Checkout (`cart.html`)
- Full cart review with quantity editing
- Remove individual items
- Subtotal + tax + grand total
- Optional order note
- Sends order to Apps Script → saves to Google Sheet → decrements stock
- Success screen with order ID

### Admin Panel (`admin.html`)
- Password-protected login (session-based)
- Dashboard stats: SKUs, active, low stock, revenue
- Inventory table: search, edit any product, toggle active/inactive
- Stock quick-edit for fast restocking
- Add new products via modal form
- Orders history table with all details

---

## 🛠 Customisation

**Add more categories:** Just type any category name when adding a product — filters auto-populate.

**Change currency:** Edit `CURRENCY` in `config.js` (e.g. `"$"`, `"€"`, `"£"`).

**Remove tax:** Set `TAX_RATE: 0` in `config.js` — the tax row hides automatically.

**Add product images:** Paste any public image URL in the Image URL field when adding/editing a product.

**Redeploying Apps Script after changes:** If you update `Code.gs`, you must create a **new deployment version** — go to Deploy → Manage deployments → edit → version "New version".

---

## ⚠️ Limitations (free tier)

- Google Apps Script: 6 min execution limit per request (more than enough)
- Apps Script: ~20,000 cells / reads per day (free quota)
- GitHub Pages: only static files — no server-side code (Apps Script handles this)
- Admin security: session-based token, suitable for internal/team use

---

## 💰 Cost

| Service | Cost |
|---------|------|
| Google Sheets | Free |
| Google Apps Script | Free |
| GitHub (private repo) | Free |
| GitHub Pages | Free |
| **Total** | **₹0 / $0** |
