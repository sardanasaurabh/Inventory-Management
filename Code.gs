// ================================================================
//  INVENTORY APP — Google Apps Script Backend
//  File: Code.gs
//
//  SETUP INSTRUCTIONS:
//  1. Open your Google Sheet → Extensions → Apps Script
//  2. Paste this entire file, replacing any existing code
//  3. Edit the SETTINGS section below
//  4. Run "setupSheets()" once to create the required tabs
//  5. Deploy → New deployment → Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  6. Copy the Web App URL into your config.js (API_URL)
// ================================================================

// ── SETTINGS ────────────────────────────────────────────────────
const SETTINGS = {
  ADMIN_PASSWORD: "admin123",          // Change this before deploying!
  TOKEN_SECRET:   "inv_secret_2025",   // Change this too
  TAX_RATE:       0.18,                // 18% — must match config.js

  // Sheet names (do not change unless you rename tabs)
  SHEET_INVENTORY: "Inventory",
  SHEET_ORDERS:    "Orders",
  SHEET_CONFIG:    "Config",
};
// ────────────────────────────────────────────────────────────────


// ── CORS HEADERS ─────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, code = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── ROUTER ───────────────────────────────────────────────────────

function doGet(e) {
  const p = e.parameter || {};
  try {
    switch (p.action) {
      case "getInventory": return handleGetInventory(p);
      case "getOrders":    return handleGetOrders(p);
      case "verifyAdmin":  return handleVerifyAdmin(p);
      default:             return jsonResponse({ error: "Unknown action" });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch { return jsonResponse({ error: "Invalid JSON" }); }

  try {
    switch (body.action) {
      case "placeOrder":    return handlePlaceOrder(body);
      case "addProduct":    return handleAddProduct(body);
      case "updateProduct": return handleUpdateProduct(body);
      default:              return jsonResponse({ error: "Unknown action" });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}


// ── AUTH ─────────────────────────────────────────────────────────

function generateToken(password) {
  const raw = password + SETTINGS.TOKEN_SECRET + new Date().toDateString();
  return Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, raw
  )).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

function verifyToken(token) {
  const expected = generateToken(SETTINGS.ADMIN_PASSWORD);
  return token === expected;
}

function handleVerifyAdmin(p) {
  if (p.password === SETTINGS.ADMIN_PASSWORD) {
    return jsonResponse({ valid: true, token: generateToken(p.password) });
  }
  return jsonResponse({ valid: false });
}

function requireAdmin(token) {
  if (!verifyToken(token)) throw new Error("Unauthorized");
}


// ── INVENTORY HANDLERS ────────────────────────────────────────────

function handleGetInventory(p) {
  const activeOnly = p.activeOnly === "true";
  const sheet = getSheet(SETTINGS.SHEET_INVENTORY);
  const rows = sheetToObjects(sheet);

  const products = rows
    .filter(r => r.sku)
    .filter(r => !activeOnly || String(r.active).toUpperCase() !== "FALSE")
    .map(r => ({
      sku:         String(r.sku).trim(),
      name:        String(r.name || "").trim(),
      category:    String(r.category || "").trim(),
      description: String(r.description || "").trim(),
      price:       parseFloat(r.price) || 0,
      stock:       parseInt(r.stock) || 0,
      imageUrl:    String(r.imageUrl || "").trim(),
      active:      String(r.active).toUpperCase() !== "FALSE",
    }));

  return jsonResponse({ success: true, products });
}

function handleAddProduct(body) {
  requireAdmin(body.token);
  const d = body.data;
  if (!d || !d.sku || !d.name) throw new Error("Missing required fields");

  const sheet = getSheet(SETTINGS.SHEET_INVENTORY);
  const existing = findRowBySku(sheet, d.sku);
  if (existing > -1) throw new Error(`SKU "${d.sku}" already exists`);

  sheet.appendRow([
    d.sku, d.name, d.category || "", d.description || "",
    parseFloat(d.price) || 0, parseInt(d.stock) || 0,
    d.imageUrl || "", d.active !== false ? "TRUE" : "FALSE",
    new Date().toISOString()
  ]);

  return jsonResponse({ success: true });
}

function handleUpdateProduct(body) {
  requireAdmin(body.token);
  const d = body.data;
  if (!d) throw new Error("Missing data");

  const sheet = getSheet(SETTINGS.SHEET_INVENTORY);
  const rowIdx = findRowBySku(sheet, body.sku);
  if (rowIdx === -1) throw new Error(`SKU "${body.sku}" not found`);

  const row = rowIdx + 1; // 1-indexed, +1 for header
  sheet.getRange(row, 1, 1, 9).setValues([[
    d.sku || body.sku,
    d.name || "",
    d.category || "",
    d.description || "",
    parseFloat(d.price) || 0,
    parseInt(d.stock) || 0,
    d.imageUrl || "",
    d.active !== false ? "TRUE" : "FALSE",
    new Date().toISOString()
  ]]);

  return jsonResponse({ success: true });
}


// ── ORDER HANDLERS ────────────────────────────────────────────────

function handlePlaceOrder(body) {
  const items = body.items;
  if (!items || !items.length) throw new Error("No items in order");

  const invSheet = getSheet(SETTINGS.SHEET_INVENTORY);
  const ordSheet = getSheet(SETTINGS.SHEET_ORDERS);

  // Validate stock and calculate totals
  let subtotal = 0;
  const lineItems = [];

  for (const item of items) {
    const rowIdx = findRowBySku(invSheet, item.sku);
    if (rowIdx === -1) throw new Error(`SKU "${item.sku}" not found`);

    const dataRow = rowIdx + 1;
    const stockCell = invSheet.getRange(dataRow, 6); // column F = stock
    const currentStock = parseInt(stockCell.getValue()) || 0;

    if (currentStock < item.qty) {
      throw new Error(`Insufficient stock for "${item.name}" (available: ${currentStock})`);
    }

    // Deduct stock
    stockCell.setValue(currentStock - item.qty);

    const lineTotal = parseFloat(item.price) * parseInt(item.qty);
    subtotal += lineTotal;
    lineItems.push(`${item.name} ×${item.qty}`);
  }

  const tax   = subtotal * SETTINGS.TAX_RATE;
  const total = subtotal + tax;
  const orderId = "ORD-" + new Date().getTime();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

  // Save order row
  ordSheet.appendRow([
    orderId,
    timestamp,
    lineItems.join("; "),
    subtotal.toFixed(2),
    tax.toFixed(2),
    total.toFixed(2),
    body.note || "",
    JSON.stringify(items)
  ]);

  return jsonResponse({ success: true, orderId, total: total.toFixed(2) });
}

function handleGetOrders(p) {
  requireAdmin(p.token);
  const sheet = getSheet(SETTINGS.SHEET_ORDERS);
  const rows = sheetToObjects(sheet);
  const orders = rows.map(r => ({
    orderId:   r.orderId,
    timestamp: r.timestamp,
    items:     r.items,
    subtotal:  r.subtotal,
    tax:       r.tax,
    total:     r.total,
    note:      r.note,
  }));
  return jsonResponse({ success: true, orders });
}


// ── SHEET HELPERS ─────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found. Run setupSheets() first.`);
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function findRowBySku(sheet, sku) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const skuCol = headers.indexOf("sku");
  if (skuCol === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][skuCol]).trim() === String(sku).trim()) {
      return i; // 0-indexed (not including header)
    }
  }
  return -1;
}


// ── SETUP FUNCTION ────────────────────────────────────────────────
//  Run this ONCE from the Apps Script editor to create all sheets.

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Inventory sheet ──────────────────────────────
  let inv = ss.getSheetByName(SETTINGS.SHEET_INVENTORY);
  if (!inv) {
    inv = ss.insertSheet(SETTINGS.SHEET_INVENTORY);
    inv.getRange(1, 1, 1, 9).setValues([[
      "sku", "name", "category", "description",
      "price", "stock", "imageUrl", "active", "updatedAt"
    ]]);
    // Sample data
    const samples = [
      ["PROD-001", "Wireless Mouse",    "Electronics", "Ergonomic 2.4GHz wireless mouse",     599,   25, "", "TRUE", new Date().toISOString()],
      ["PROD-002", "USB-C Hub",         "Electronics", "7-in-1 USB-C hub with HDMI",          1299,  10, "", "TRUE", new Date().toISOString()],
      ["PROD-003", "Notebook A5",       "Stationery",  "200-page ruled notebook, premium paper", 149, 50, "", "TRUE", new Date().toISOString()],
      ["PROD-004", "Blue Pen Set",      "Stationery",  "Pack of 12 ballpoint pens",            89,   100,"", "TRUE", new Date().toISOString()],
      ["PROD-005", "Laptop Stand",      "Electronics", "Aluminium adjustable laptop stand",   1899,  4,  "", "TRUE", new Date().toISOString()],
      ["PROD-006", "Sticky Notes Pack", "Stationery",  "4 colours, 100 sheets each",           129,  0,  "", "TRUE", new Date().toISOString()],
    ];
    inv.getRange(2, 1, samples.length, 9).setValues(samples);

    // Style header row
    inv.getRange(1, 1, 1, 9).setBackground("#1f1f25").setFontColor("#e8c468").setFontWeight("bold");
    inv.setFrozenRows(1);
  }

  // ── Orders sheet ─────────────────────────────────
  let ord = ss.getSheetByName(SETTINGS.SHEET_ORDERS);
  if (!ord) {
    ord = ss.insertSheet(SETTINGS.SHEET_ORDERS);
    ord.getRange(1, 1, 1, 8).setValues([[
      "orderId", "timestamp", "items", "subtotal", "tax", "total", "note", "itemsJson"
    ]]);
    ord.getRange(1, 1, 1, 8).setBackground("#1f1f25").setFontColor("#e8c468").setFontWeight("bold");
    ord.setFrozenRows(1);
  }

  // ── Config sheet ─────────────────────────────────
  let cfg = ss.getSheetByName(SETTINGS.SHEET_CONFIG);
  if (!cfg) {
    cfg = ss.insertSheet(SETTINGS.SHEET_CONFIG);
    cfg.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
    cfg.getRange(2, 1, 3, 2).setValues([
      ["storeName", "My Inventory Store"],
      ["currency",  "₹"],
      ["taxRate",   "0.18"],
    ]);
    cfg.getRange(1, 1, 1, 2).setBackground("#1f1f25").setFontColor("#e8c468").setFontWeight("bold");
  }

  SpreadsheetApp.getUi().alert(
    "✅ Setup complete!\n\n" +
    "3 sheets created: Inventory, Orders, Config\n" +
    "Sample products added to Inventory.\n\n" +
    "Next: Deploy this script as a Web App and paste the URL in config.js"
  );
}


// ── TEST FUNCTION ─────────────────────────────────────────────────
//  Run from the editor to verify the sheet is working correctly.

function testGetInventory() {
  const result = handleGetInventory({ activeOnly: "true" });
  Logger.log(result.getContent());
}
