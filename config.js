// ============================================================
//  INVENTORY APP — SHARED CONFIGURATION
//  Edit this file after deploying your Google Apps Script.
// ============================================================

const APP_CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here:
  API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",

  STORE_NAME: "My Inventory Store",
  CURRENCY: "₹",          // Change to $ £ € etc.
  TAX_RATE: 0.18,          // 18% GST — set to 0 if no tax
  TAX_LABEL: "GST (18%)",

  // Admin panel access — also set the same password in your Apps Script
  ADMIN_PASSWORD: "admin123",   // Change before going live!
};
