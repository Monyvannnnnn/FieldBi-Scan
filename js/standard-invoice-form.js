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
  let isRendering = false;
  let debounceTimeout = null;
  let isCustomFieldsExpanded = false;

  window.setStandardInvoiceField = function(key, val) {
    if (!window.currentInvoiceData) {
      window.currentInvoiceData = {};
    }
    window.currentInvoiceData[key] = val;
    if (currentData) {
      currentData[key] = val;
    }
  };

  function getData() {
    return window.currentInvoiceData || currentData || {};
  }

  // Listen for extraction events
  window.addEventListener('fieldbiInvoiceExtracted', function(e) {
    currentData = e.detail;
    const extras = document.getElementById('fieldbi-standard-invoice-extras');
    if (extras) extras.style.removeProperty('display');
    scheduleRender(true);
  });

  function scheduleRender(force) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(function() {
      renderConditionalFormFields(force);
    }, 60);
  }

  // Safe mutation observer to detect when the tab or sidebar opens without recursion
  const observer = new MutationObserver(function(mutations) {
    if (isRendering) return;

    // Check if mutation was solely inside our own extras element
    let onlyInternal = true;
    for (let i = 0; i < mutations.length; i++) {
      const t = mutations[i].target;
      if (!t || (t.id !== 'fieldbi-standard-invoice-extras' && (!t.closest || !t.closest('#fieldbi-standard-invoice-extras')))) {
        onlyInternal = false;
        break;
      }
    }
    if (onlyInternal) return;

    // Check if currently extracting
    const isExtracting = Boolean(document.querySelector('.invoice-extracting-state'));
    const extras = document.getElementById('fieldbi-standard-invoice-extras');
    if (isExtracting) {
      if (extras) extras.style.setProperty('display', 'none', 'important');
      return;
    } else if (extras && extras.style.display === 'none') {
      extras.style.removeProperty('display');
    }

    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    // Only schedule if our component is missing or container has not been enhanced
    const existing = formContainer.querySelector('#fieldbi-standard-invoice-extras');
    if (!existing || formContainer.dataset.standardFormEnhanced !== 'true') {
      scheduleRender(false);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  function hasValue(val) {
    return val !== undefined && val !== null && String(val).trim() !== '';
  }

  function renderConditionalFormFields(force) {
    if (isRendering) return;

    const isExtracting = Boolean(document.querySelector('.invoice-extracting-state'));
    let extSection = document.getElementById('fieldbi-standard-invoice-extras');
    if (isExtracting) {
      if (extSection) extSection.style.setProperty('display', 'none', 'important');
      return;
    } else if (extSection && extSection.style.display === 'none') {
      extSection.style.removeProperty('display');
    }

    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    const sidebar = document.querySelector('.cs-panel-invoice-sidebar');
    if (sidebar) sidebar.dataset.standardFormEnhanced = 'true';
    formContainer.dataset.standardFormEnhanced = 'true';

    if (extSection && !force && extSection.parentNode === formContainer) {
      return;
    }

    isRendering = true;
    try {
      const data = getData();

      if (!extSection) {
        extSection = document.createElement('div');
        extSection.id = 'fieldbi-standard-invoice-extras';
        extSection.className = 'fieldbi-standard-form-wrapper';
      }

      // Insert right after the first form section if found
      const firstSection = formContainer.querySelector('.invoice-form-section');
      if (firstSection && firstSection.parentNode) {
        if (extSection.parentNode !== firstSection.parentNode || extSection.previousSibling !== firstSection) {
          firstSection.parentNode.insertBefore(extSection, firstSection.nextSibling);
        }
      } else if (extSection.parentNode !== formContainer) {
        formContainer.appendChild(extSection);
      }

      // Determine visibility: show section if expanded OR if any field in that section has a value
      const hasSupplierExtras = isCustomFieldsExpanded || hasValue(data.tradingName) || hasValue(data.vendorEmail) || hasValue(data.vendorWebsite);
      const hasCustomerExtras = isCustomFieldsExpanded || hasValue(data.contactPerson) || hasValue(data.shippingAddress) || hasValue(data.customerTaxId);
      const hasReferences = isCustomFieldsExpanded || hasValue(data.poNumber) || hasValue(data.projectCode) || hasValue(data.costCenter);
      const hasFinancialExtras = isCustomFieldsExpanded || (data.discounts && Number(data.discounts) > 0) || (data.shippingFees && Number(data.shippingFees) > 0);
      const hasPaymentExtras = isCustomFieldsExpanded || hasValue(data.paymentMethods) || hasValue(data.bankDetails);

      extSection.innerHTML = `
        <style>
          .fieldbi-standard-form-wrapper {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-top: 10px;
            margin-bottom: 12px;
          }
          .standard-section-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            transition: border-color 0.15s ease;
          }
          .standard-section-card:hover {
            border-color: #cbd5e1;
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
            transition: all 0.15s ease;
            background: #fff;
          }
          .standard-input:focus {
            border-color: #ec1f28;
            box-shadow: 0 0 0 2px rgba(236,31,40,0.1);
          }
          .standard-toggle-btn {
            background: #f8fafc;
            border: 1.5px dashed #cbd5e1;
            color: #334155;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            box-sizing: border-box;
            transition: all 0.2s ease;
            user-select: none;
          }
          .standard-toggle-btn:hover {
            background: #f1f5f9;
            border-color: #ec1f28;
            color: #ec1f28;
          }
          .standard-toggle-btn.expanded {
            background: #fef2f2;
            border: 1.5px solid #fca5a5;
            color: #b91c1c;
          }
          .standard-toggle-btn.expanded:hover {
            background: #fee2e2;
            border-color: #ef4444;
            color: #991b1b;
          }
        </style>

        <!-- 1. Supplier Extra Info (Conditional / Expandable) -->
        ${hasSupplierExtras ? `
        <div class="standard-section-card">
          <div class="standard-section-header">
            <h5 class="standard-section-title">
              1. Supplier (Vendor) Details 
              <span class="standard-badge ${hasValue(data.tradingName) || hasValue(data.vendorEmail) || hasValue(data.vendorWebsite) ? 'active' : ''}">
                ${hasValue(data.tradingName) || hasValue(data.vendorEmail) || hasValue(data.vendorWebsite) ? 'Auto-Detected' : 'Optional'}
              </span>
            </h5>
          </div>
          <div class="standard-grid">
            ${(isCustomFieldsExpanded || hasValue(data.tradingName)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Trading Name / Brand</label>
              <input type="text" class="standard-input" placeholder="e.g. Acme Trading" value="${escapeHtml(data.tradingName || '')}" oninput="window.setStandardInvoiceField('tradingName', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.vendorEmail)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Supplier Email</label>
              <input type="email" class="standard-input" placeholder="supplier@domain.com" value="${escapeHtml(data.vendorEmail || '')}" oninput="window.setStandardInvoiceField('vendorEmail', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.vendorWebsite)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Supplier Website</label>
              <input type="text" class="standard-input" placeholder="https://supplier.com" value="${escapeHtml(data.vendorWebsite || '')}" oninput="window.setStandardInvoiceField('vendorWebsite', this.value)">
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- 2. Customer Extra Info (Conditional / Expandable) -->
        ${hasCustomerExtras ? `
        <div class="standard-section-card">
          <div class="standard-section-header">
            <h5 class="standard-section-title">
              2. Customer (Client) Details 
              <span class="standard-badge ${hasValue(data.contactPerson) || hasValue(data.shippingAddress) || hasValue(data.customerTaxId) ? 'active' : ''}">
                ${hasValue(data.contactPerson) || hasValue(data.shippingAddress) || hasValue(data.customerTaxId) ? 'Auto-Detected' : 'Optional'}
              </span>
            </h5>
          </div>
          <div class="standard-grid">
            ${(isCustomFieldsExpanded || hasValue(data.contactPerson)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Contact Person / Attn</label>
              <input type="text" class="standard-input" placeholder="Attn: John Doe" value="${escapeHtml(data.contactPerson || '')}" oninput="window.setStandardInvoiceField('contactPerson', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.shippingAddress)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Shipping / Delivery Address</label>
              <input type="text" class="standard-input" placeholder="Delivery destination address" value="${escapeHtml(data.shippingAddress || '')}" oninput="window.setStandardInvoiceField('shippingAddress', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.customerTaxId)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Customer Tax ID / VAT</label>
              <input type="text" class="standard-input" placeholder="Client Tax ID" value="${escapeHtml(data.customerTaxId || '')}" oninput="window.setStandardInvoiceField('customerTaxId', this.value)">
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- 4. References & Tracking Codes (Conditional / Expandable) -->
        ${hasReferences ? `
        <div class="standard-section-card">
          <div class="standard-section-header">
            <h5 class="standard-section-title">
              4. References & Tracking Codes 
              <span class="standard-badge ${hasValue(data.poNumber) || hasValue(data.projectCode) || hasValue(data.costCenter) ? 'active' : ''}">
                ${hasValue(data.poNumber) || hasValue(data.projectCode) || hasValue(data.costCenter) ? 'Auto-Detected' : 'Optional'}
              </span>
            </h5>
          </div>
          <div class="standard-grid">
            ${(isCustomFieldsExpanded || hasValue(data.poNumber)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Purchase Order (PO) #</label>
              <input type="text" class="standard-input" placeholder="PO-12345" value="${escapeHtml(data.poNumber || '')}" oninput="window.setStandardInvoiceField('poNumber', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.projectCode)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Project Name / Code</label>
              <input type="text" class="standard-input" placeholder="PRJ-ALPHA" value="${escapeHtml(data.projectCode || '')}" oninput="window.setStandardInvoiceField('projectCode', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.costCenter)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Cost Center / Vendor ID</label>
              <input type="text" class="standard-input" placeholder="CC-001" value="${escapeHtml(data.costCenter || '')}" oninput="window.setStandardInvoiceField('costCenter', this.value)">
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- 6. Discounts & Shipping (Conditional / Expandable) -->
        ${hasFinancialExtras ? `
        <div class="standard-section-card">
          <div class="standard-section-header">
            <h5 class="standard-section-title">
              6. Discounts & Delivery Fees 
              <span class="standard-badge ${(data.discounts && Number(data.discounts) > 0) || (data.shippingFees && Number(data.shippingFees) > 0) ? 'active' : ''}">
                ${(data.discounts && Number(data.discounts) > 0) || (data.shippingFees && Number(data.shippingFees) > 0) ? 'Auto-Detected' : 'Optional'}
              </span>
            </h5>
          </div>
          <div class="standard-grid">
            ${(isCustomFieldsExpanded || (data.discounts != null && Number(data.discounts) > 0)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Discounts Deducted</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" class="standard-input" value="${data.discounts != null ? data.discounts : ''}" oninput="window.setStandardInvoiceField('discounts', this.value === '' ? null : Number(this.value))">
            </div>` : ''}
            ${(isCustomFieldsExpanded || (data.shippingFees != null && Number(data.shippingFees) > 0)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Shipping / Handling Fees</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" class="standard-input" value="${data.shippingFees != null ? data.shippingFees : ''}" oninput="window.setStandardInvoiceField('shippingFees', this.value === '' ? null : Number(this.value))">
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- 7. Payment Instructions & Footer (Conditional / Expandable) -->
        ${hasPaymentExtras ? `
        <div class="standard-section-card">
          <div class="standard-section-header">
            <h5 class="standard-section-title">
              7. Payment Instructions & Bank Details 
              <span class="standard-badge ${hasValue(data.paymentMethods) || hasValue(data.bankDetails) ? 'active' : ''}">
                ${hasValue(data.paymentMethods) || hasValue(data.bankDetails) ? 'Auto-Detected' : 'Optional'}
              </span>
            </h5>
          </div>
          <div class="standard-grid">
            ${(isCustomFieldsExpanded || hasValue(data.paymentMethods)) ? `
            <div class="standard-field-group">
              <label class="standard-label">Payment Methods</label>
              <input type="text" class="standard-input" placeholder="e.g. Bank Transfer, Cash, Card" value="${escapeHtml(data.paymentMethods || '')}" oninput="window.setStandardInvoiceField('paymentMethods', this.value)">
            </div>` : ''}
            ${(isCustomFieldsExpanded || hasValue(data.bankDetails)) ? `
            <div class="standard-field-group" style="grid-column: 1 / -1;">
              <label class="standard-label">Bank Account Details / IBAN / SWIFT</label>
              <input type="text" class="standard-input" placeholder="Bank Name, Account #, SWIFT / IBAN" value="${escapeHtml(data.bankDetails || '')}" oninput="window.setStandardInvoiceField('bankDetails', this.value)">
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- Interactive Expansion Toggle Button -->
        <button type="button" class="standard-toggle-btn ${isCustomFieldsExpanded ? 'expanded' : ''}" onclick="window.toggleAllStandardInvoiceFields()">
          <span>${isCustomFieldsExpanded ? '✕ Collapse / Hide Optional Empty Fields' : '⚡ Customize / Add All Standard Invoice Fields (Null / Optional)'}</span>
        </button>
      `;
    } finally {
      setTimeout(function() {
        isRendering = false;
      }, 30);
    }
  }

  window.toggleAllStandardInvoiceFields = function() {
    isCustomFieldsExpanded = !isCustomFieldsExpanded;
    renderConditionalFormFields(true);
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
