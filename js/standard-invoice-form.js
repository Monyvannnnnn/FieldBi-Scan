/**
 * standard-invoice-form.js - FieldBi Standard Invoice Schema & Conditional Form Enhancer
 * Implements the 7 standard invoice categories with conditional rendering:
 * 1. Supplier (Vendor) Information
 * 2. Customer (Client) Information
 * 3. Invoice Meta & Tracking Details
 * 4. References & Tracking Codes (Conditional)
 * 5. Line Items (Itemized Table)
 * 6. Totals & Financial Summary (Conditional discounts/shipping)
 * 7. Payment Instructions & Footer (Conditional)
 */

(function() {
  'use strict';

  let currentData = null;

  // Listen for extraction events
  window.addEventListener('fieldbiInvoiceExtracted', (e) => {
    currentData = e.detail;
    renderConditionalFormFields();
  });

  // Also check periodically for the AP Invoice sidebar
  const observer = new MutationObserver(() => {
    const sidebar = document.querySelector('.cs-panel-invoice-sidebar, .invoice-tab-content.tab-form');
    if (sidebar && !sidebar.dataset.standardFormEnhanced) {
      renderConditionalFormFields();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function getData() {
    return window.currentInvoiceData || currentData || {};
  }

  function renderConditionalFormFields() {
    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    formContainer.dataset.standardFormEnhanced = 'true';
    const data = getData();

    // Check if enhanced section container already exists
    let extSection = document.getElementById('fieldbi-standard-invoice-extras');
    if (!extSection) {
      extSection = document.createElement('div');
      extSection.id = 'fieldbi-standard-invoice-extras';
      extSection.className = 'fieldbi-standard-form-wrapper';
      
      // Insert right after the first form section
      const firstSection = formContainer.querySelector('.invoice-form-section');
      if (firstSection && firstSection.parentNode) {
        firstSection.parentNode.insertBefore(extSection, firstSection.nextSibling);
      } else {
        formContainer.appendChild(extSection);
      }
    }

    // Determine conditional visibility
    const hasReferences = Boolean(data.poNumber || data.projectCode || data.costCenter);
    const hasCustomerExtras = Boolean(data.contactPerson || data.shippingAddress || data.customerTaxId);
    const hasSupplierExtras = Boolean(data.tradingName || data.vendorEmail || data.vendorWebsite);
    const hasPaymentExtras = Boolean(data.paymentMethods || data.bankDetails);
    const hasFinancialExtras = Boolean((data.discounts && Number(data.discounts) > 0) || (data.shippingFees && Number(data.shippingFees) > 0));

    extSection.innerHTML = `
      <style>
        .fieldbi-standard-form-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 10px;
          margin-bottom: 12px;
        }
        .standard-section-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .standard-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .standard-section-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .standard-badge {
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #475569;
        }
        .standard-badge.active {
          background: #dcfce7;
          color: #15803d;
        }
        .standard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .standard-field-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .standard-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .standard-input {
          height: 38px;
          border: 1.5px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          color: #1e293b;
          outline: none;
          transition: border-color 0.15s ease;
          background: #fff;
        }
        .standard-input:focus {
          border-color: #ec1f28;
          box-shadow: 0 0 0 2px rgba(236,31,40,0.1);
        }
        .standard-toggle-btn {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .standard-toggle-btn:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }
      </style>

      <!-- 1. Supplier Extra Info (Conditional) -->
      ${hasSupplierExtras ? `
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">1. Supplier (Vendor) Details <span class="standard-badge active">Auto-Detected</span></h5>
        </div>
        <div class="standard-grid">
          ${data.tradingName ? `
          <div class="standard-field-group">
            <label class="standard-label">Trading Name / Brand</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.tradingName)}" onchange="window.currentInvoiceData.tradingName=this.value">
          </div>` : ''}
          ${data.vendorEmail ? `
          <div class="standard-field-group">
            <label class="standard-label">Supplier Email</label>
            <input type="email" class="standard-input" value="${escapeHtml(data.vendorEmail)}" onchange="window.currentInvoiceData.vendorEmail=this.value">
          </div>` : ''}
          ${data.vendorWebsite ? `
          <div class="standard-field-group">
            <label class="standard-label">Supplier Website</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.vendorWebsite)}" onchange="window.currentInvoiceData.vendorWebsite=this.value">
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- 2. Customer Extra Info (Conditional) -->
      ${hasCustomerExtras ? `
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">2. Customer (Client) Details <span class="standard-badge active">Auto-Detected</span></h5>
        </div>
        <div class="standard-grid">
          ${data.contactPerson ? `
          <div class="standard-field-group">
            <label class="standard-label">Contact Person / Attn</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.contactPerson)}" onchange="window.currentInvoiceData.contactPerson=this.value">
          </div>` : ''}
          ${data.shippingAddress ? `
          <div class="standard-field-group">
            <label class="standard-label">Shipping / Delivery Address</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.shippingAddress)}" onchange="window.currentInvoiceData.shippingAddress=this.value">
          </div>` : ''}
          ${data.customerTaxId ? `
          <div class="standard-field-group">
            <label class="standard-label">Customer Tax ID / VAT</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.customerTaxId)}" onchange="window.currentInvoiceData.customerTaxId=this.value">
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- 4. References & Tracking Codes (Conditional) -->
      ${hasReferences ? `
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">4. References & Tracking Codes <span class="standard-badge active">Auto-Detected</span></h5>
        </div>
        <div class="standard-grid">
          ${data.poNumber ? `
          <div class="standard-field-group">
            <label class="standard-label">Purchase Order (PO) #</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.poNumber)}" onchange="window.currentInvoiceData.poNumber=this.value">
          </div>` : ''}
          ${data.projectCode ? `
          <div class="standard-field-group">
            <label class="standard-label">Project Name / Code</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.projectCode)}" onchange="window.currentInvoiceData.projectCode=this.value">
          </div>` : ''}
          ${data.costCenter ? `
          <div class="standard-field-group">
            <label class="standard-label">Cost Center / Vendor ID</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.costCenter)}" onchange="window.currentInvoiceData.costCenter=this.value">
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- 6. Discounts & Shipping (Conditional) -->
      ${hasFinancialExtras ? `
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">6. Discounts & Delivery Fees <span class="standard-badge active">Auto-Detected</span></h5>
        </div>
        <div class="standard-grid">
          ${data.discounts != null ? `
          <div class="standard-field-group">
            <label class="standard-label">Discounts Deducted</label>
            <input type="number" step="0.01" class="standard-input" value="${data.discounts}" onchange="window.currentInvoiceData.discounts=Number(this.value)">
          </div>` : ''}
          ${data.shippingFees != null ? `
          <div class="standard-field-group">
            <label class="standard-label">Shipping / Handling Fees</label>
            <input type="number" step="0.01" class="standard-input" value="${data.shippingFees}" onchange="window.currentInvoiceData.shippingFees=Number(this.value)">
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- 7. Payment Instructions & Footer (Conditional) -->
      ${hasPaymentExtras ? `
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">7. Payment Instructions & Bank Details <span class="standard-badge active">Auto-Detected</span></h5>
        </div>
        <div class="standard-grid">
          ${data.paymentMethods ? `
          <div class="standard-field-group">
            <label class="standard-label">Payment Methods</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.paymentMethods)}" onchange="window.currentInvoiceData.paymentMethods=this.value">
          </div>` : ''}
          ${data.bankDetails ? `
          <div class="standard-field-group" style="grid-column: 1 / -1;">
            <label class="standard-label">Bank Account Details / IBAN / SWIFT</label>
            <input type="text" class="standard-input" value="${escapeHtml(data.bankDetails)}" onchange="window.currentInvoiceData.bankDetails=this.value">
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- Optional Manual Field Expansion Button -->
      <button type="button" class="standard-toggle-btn" onclick="window.toggleAllStandardInvoiceFields()">
        <span>⚡ Customize / Add All Standard Invoice Fields (Null / Optional)</span>
      </button>
    `;
  }

  window.toggleAllStandardInvoiceFields = function() {
    const data = getData();
    data.tradingName = data.tradingName || '';
    data.vendorEmail = data.vendorEmail || '';
    data.vendorWebsite = data.vendorWebsite || '';
    data.contactPerson = data.contactPerson || '';
    data.shippingAddress = data.shippingAddress || '';
    data.customerTaxId = data.customerTaxId || '';
    data.projectCode = data.projectCode || '';
    data.costCenter = data.costCenter || '';
    data.paymentMethods = data.paymentMethods || '';
    data.bankDetails = data.bankDetails || '';
    data.discounts = data.discounts || 0;
    data.shippingFees = data.shippingFees || 0;
    renderConditionalFormFields();
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
