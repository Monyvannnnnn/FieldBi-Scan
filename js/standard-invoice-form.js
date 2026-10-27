/**
 * standard-invoice-form.js - FieldBi Standard Invoice Schema & Dynamic Conditional Form Enhancer
 * - Automatically hides empty/null fields so only populated fields appear
 * - Sanitizes "null" strings so literal "null" never appears in inputs
 * - Safe mutation handling (no infinite loops)
 * - "+ Add Field / Column" dropdown to easily add hidden standard fields or custom fields
 * - Individual "✕" button on visible fields to hide/remove them
 * - Full expand/collapse toggle for all standard invoice categories
 */

(function() {
  'use strict';

  let currentData = null;
  let isRendering = false;
  let debounceTimeout = null;
  let isCustomFieldsExpanded = false;
  const manuallyAddedFields = new Set();

  function cleanFieldValue(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    if (/^(null|undefined|none|n\/a)$/i.test(s)) return '';
    return s;
  }

  function hasValue(val) {
    return cleanFieldValue(val) !== '';
  }

  window.cleanFieldValue = cleanFieldValue;
  window.hasInvoiceValue = hasValue;

  window.setStandardInvoiceField = function(key, val) {
    if (!window.currentInvoiceData) {
      window.currentInvoiceData = {};
    }
    const clean = cleanFieldValue(val);
    window.currentInvoiceData[key] = clean !== '' ? val : '';
    if (currentData) {
      currentData[key] = clean !== '' ? val : '';
    }
    if (window.homePageComponent) {
      if (window.homePageComponent.extractedInvoiceJson) {
        window.homePageComponent.extractedInvoiceJson[key] = clean !== '' ? val : '';
      }
      if (window.homePageComponent.extractedApInvoice) {
        window.homePageComponent.extractedApInvoice[key] = clean !== '' ? val : '';
      }
    }
  };

  window.setStandardFieldLabel = function(key, label) {
    const data = getData();
    if (!data.customLabels) {
      data.customLabels = {};
    }
    data.customLabels[key] = label;
    window.setStandardInvoiceField('customLabels', data.customLabels);
  };

  window.addStandardCustomColumn = function(initialName, initialVal) {
    const data = getData();
    if (!data.customColumns) {
      data.customColumns = [];
    }
    const newId = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const colName = initialName || ('Custom Field ' + (data.customColumns.length + 1));
    data.customColumns.push({
      id: newId,
      name: colName,
      value: initialVal || ''
    });
    syncCustomFieldsToData();
    isRendering = false;
    renderAllEnhancedSections(true);
    setTimeout(function() {
      const el = document.querySelector(`[data-col-id="${newId}"] .standard-editable-label`);
      if (el) {
        el.focus();
        el.select();
      }
    }, 60);
  };

  window.removeStandardCustomColumn = function(colId) {
    const data = getData();
    if (data.customColumns && Array.isArray(data.customColumns)) {
      data.customColumns = data.customColumns.filter(c => c.id !== colId);
      syncCustomFieldsToData();
      isRendering = false;
      renderAllEnhancedSections(true);
    }
  };

  window.setCustomColumnName = function(colId, newName) {
    const data = getData();
    if (data.customColumns && Array.isArray(data.customColumns)) {
      const col = data.customColumns.find(c => c.id === colId);
      if (col) {
        col.name = newName;
        syncCustomFieldsToData();
      }
    }
  };

  window.setCustomColumnValue = function(colId, newVal) {
    const data = getData();
    if (data.customColumns && Array.isArray(data.customColumns)) {
      const col = data.customColumns.find(c => c.id === colId);
      if (col) {
        col.value = newVal;
        syncCustomFieldsToData();
      }
    }
  };

  function syncCustomFieldsToData() {
    const data = getData();
    if (!data.customColumns) data.customColumns = [];
    const fieldsMap = {};
    data.customColumns.forEach(c => {
      if (c && c.name) {
        fieldsMap[c.name.trim()] = c.value || '';
      }
    });
    data.customFields = fieldsMap;
    window.setStandardInvoiceField('customColumns', data.customColumns);
    window.setStandardInvoiceField('customFields', fieldsMap);
  }

  
    // =========================================================================
  // Clean Totals Grid Enhancer (Reconciliation & Watermark Badge Removed)
  // =========================================================================

  function enhanceInvoiceTotalsGrid() {
    // 1. Remove reconciliation container completely if present
    const oldReconBoxes = document.querySelectorAll('.totals-reconciliation-container');
    oldReconBoxes.forEach(el => el.remove());

    const grid = document.querySelector('.invoice-totals-grid');
    if (!grid) return;

    // 2. Remove watermark audit badge if present
    const oldWatermark = grid.querySelector('.ai-watermark-provenance');
    if (oldWatermark) oldWatermark.remove();
    const leftNotes = grid.querySelector('.totals-left-notes');
    if (leftNotes) {
      leftNotes.innerHTML = '';
      leftNotes.style.display = 'none';
    }

    const rows = grid.querySelectorAll('.totals-right-breakdown .total-row');
    if (!rows || rows.length < 4) return;

    // Clean up any old injected elements in rows
    rows.forEach(r => {
      const oldSubBadge = r.querySelector('.subtotal-missing-hint-box');
      if (oldSubBadge) oldSubBadge.remove();
      const oldTaxAlert = r.querySelector('.tax-rate-contradiction-alert');
      if (oldTaxAlert) oldTaxAlert.remove();
    });

    // Ensure insert button is unblocked
    const insertBtn = document.querySelector('.btn-insert-ap-invoice');
    if (insertBtn) {
      insertBtn.classList.remove('btn-recon-blocked');
      insertBtn.removeAttribute('title');
      insertBtn.dataset.reconBlocked = 'false';
    }
  }

  function enhanceLineItemsTable() {
    const table = document.querySelector('.line-items-table');
    if (!table || table.dataset.headersEnhanced === 'true') return;
    table.dataset.headersEnhanced = 'true';

    const ths = table.querySelectorAll('thead th');
    const headerKeys = ['#', 'itemCode', 'description', 'quantity', 'unitPrice', 'total', 'actions'];
    const data = getData();
    data.tableHeaderLabels = data.tableHeaderLabels || {};

    ths.forEach((th, i) => {
      if (i === 0 || i === ths.length - 1) return;
      const key = headerKeys[i] || ('col_' + i);
      const defaultText = th.textContent.trim();
      if (data.tableHeaderLabels[key]) {
        th.textContent = data.tableHeaderLabels[key];
      }
      th.setAttribute('title', 'Double-click to rename this column');
      th.style.cursor = 'pointer';

      th.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        const current = th.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.style.cssText = 'width: 95%; max-width: 110px; font-size: 11px; font-weight: 700; padding: 2px 4px; border: 1.5px solid #ec1f28; border-radius: 4px; outline: none; background: #fff; color: #0f172a; text-transform: uppercase; font-family: inherit;';
        th.textContent = '';
        th.appendChild(input);
        input.focus();
        input.select();

        let finished = false;
        function finish() {
          if (finished) return;
          finished = true;
          const val = input.value.trim() || current;
          th.textContent = val;
          data.tableHeaderLabels[key] = val;
          window.setStandardInvoiceField('tableHeaderLabels', data.tableHeaderLabels);
        }

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', function(evt) {
          if (evt.key === 'Enter') {
            finish();
          } else if (evt.key === 'Escape') {
            th.textContent = current;
            finished = true;
          }
        });
      });
    });
  }

  function getData() {
    let activeExtracted = null;
    if (window.homePageComponent) {
      const p = window.homePageComponent.pages && window.homePageComponent.pages[window.homePageComponent.activePageIndex];
      activeExtracted = (p && p.extractedInvoice) || window.homePageComponent.extractedInvoiceJson || window.homePageComponent.extractedApInvoice;
    }
    const src = activeExtracted || window.currentInvoiceData || currentData || {};
    // Sanitize literal "null" values in place
    for (const k in src) {
      if (typeof src[k] === 'string' && /^(null|undefined|none|n\/a)$/i.test(src[k].trim())) {
        src[k] = '';
      }
    }
    return src;
  }

  // Listen for extraction events
  window.addEventListener('fieldbiInvoiceExtracted', function(e) {
    currentData = e.detail;
    manuallyAddedFields.clear();
    const extras = document.getElementById('fieldbi-standard-invoice-extras');
    if (extras) extras.style.removeProperty('display');
    scheduleRender(true);
  });

  function scheduleRender(force) {
    if (isRendering) return;
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(function() {
      renderAllEnhancedSections(force);
    }, 50);
  }

  function renderAllEnhancedSections(force) {
    if (isRendering) return;
    isRendering = true;
    try {
      enhanceDocumentVendorSection();
      renderConditionalFormFields(force);
      enhanceInvoiceTotalsGrid();
    } finally {
      setTimeout(function() {
        isRendering = false;
      }, 60);
    }
  }

  // Standard fields mapped to first card
  const STANDARD_DOC_FIELDS = [
    { key: 'vendorName', labelMatch: 'vendor name', label: 'Vendor Name' },
    { key: 'vendorPhone', labelMatch: 'vendor phone', label: 'Vendor Phone' },
    { key: 'vendorTaxId', labelMatch: 'tax', label: 'Tax / VAT ID' },
    { key: 'vendorAddress', labelMatch: 'vendor address', label: 'Vendor Address' },
    { key: 'invoiceNumber', labelMatch: 'invoice / doc no', label: 'Invoice / Doc No' },
    { key: 'poNumber', labelMatch: 'po number', label: 'PO Number' },
    { key: 'invoiceDate', labelMatch: 'invoice date', label: 'Invoice Date' },
    { key: 'dueDate', labelMatch: 'due date', label: 'Due Date' },
    { key: 'paymentTerms', labelMatch: 'payment terms', label: 'Payment Terms' },
    { key: 'currency', labelMatch: 'currency', label: 'Currency' },
    { key: 'billedTo', labelMatch: 'billed to', label: 'Billed To (Customer / Recipient)' },
    { key: 'billedAddress', labelMatch: 'billing / delivery address', label: 'Billing / Delivery Address' },
    { key: 'notes', labelMatch: 'notes / remarks', label: 'Notes / Remarks' }
  ];

  /**
   * Enhances the first section ("Document & Vendor Information")
   * - Hides empty/null fields by default so only populated data appears
   * - Provides "+ Add Field / Column" dropdown to easily add hidden standard fields or custom fields
   * - Provides "✕" button on visible fields to hide/remove them
   */
  function enhanceDocumentVendorSection() {
    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    const firstSection = formContainer.querySelector('.invoice-form-section');
    if (!firstSection) return;

    const rawTitle = firstSection.querySelector('.form-section-title');
    if (!rawTitle) return;

    // Inject custom header wrapper if not already enhanced
    let headerWrap = firstSection.querySelector('.doc-vendor-header');
    if (!headerWrap) {
      headerWrap = document.createElement('div');
      headerWrap.className = 'standard-section-header doc-vendor-header';
      headerWrap.innerHTML = `
        <h4 class="form-section-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
          Document & Vendor Information
          <span class="standard-badge active" id="doc-active-count-badge">Active</span>
        </h4>
        <div class="section-actions-right" style="position: relative;">
          <button type="button" class="btn-add-custom-col" id="btn-doc-add-field" title="Add hidden or custom field">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Field / Column
          </button>
          <div class="doc-add-field-menu" id="doc-add-field-menu" style="display: none;"></div>
        </div>
      `;
      rawTitle.parentNode.insertBefore(headerWrap, rawTitle);
      rawTitle.style.display = 'none';

      // Dropdown toggle
      const btnAdd = headerWrap.querySelector('#btn-doc-add-field');
      const menu = headerWrap.querySelector('#doc-add-field-menu');
      if (btnAdd && menu) {
        btnAdd.addEventListener('click', function(e) {
          e.stopPropagation();
          const isOpen = menu.style.display !== 'none';
          if (isOpen) {
            menu.style.display = 'none';
          } else {
            populateDocAddMenu(menu);
            menu.style.display = 'flex';
          }
        });
      }
    }

    const grid = firstSection.querySelector('.form-grid-sidebar');
    if (!grid) return;

    const fieldGroups = grid.querySelectorAll('.form-field-group');
    const data = getData();
    let visibleCount = 0;

    fieldGroups.forEach(fg => {
      const labelEl = fg.querySelector('.form-field-label');
      if (!labelEl) return;
      const labelText = labelEl.textContent.trim().toLowerCase();

      // Find matching standard field def
      const def = STANDARD_DOC_FIELDS.find(f => labelText.includes(f.labelMatch));
      const key = def ? def.key : null;
      if (key) {
        fg.dataset.docFieldKey = key;
      }

      const input = fg.querySelector('input, select, textarea');
      if (input) {
        // Sanitize literal "null" value in input
        if (/^(null|undefined|none|n\/a)$/i.test(input.value.trim())) {
          input.value = '';
          if (key) {
            window.setStandardInvoiceField(key, '');
          }
        }

        // Attach listener so typing keeps field visible
        if (!input.dataset.listenerAttached) {
          input.dataset.listenerAttached = 'true';
          input.addEventListener('input', function() {
            if (key && input.value.trim() !== '') {
              manuallyAddedFields.add(key);
            }
            updateDocHeaderStatus();
          });
        }
      }

      // Check both data and DOM input
      const dataVal = key ? cleanFieldValue(data[key]) : '';
      const inputVal = input ? cleanFieldValue(input.value) : '';
      const hasDataVal = dataVal !== '';
      const hasInputVal = inputVal !== '';

      // If data has a value but input doesn't, sync input value
      if (hasDataVal && !hasInputVal && input && input.tagName !== 'SELECT') {
        input.value = dataVal;
      }

      const isPopulated = hasDataVal || hasInputVal;
      const isVisible = isCustomFieldsExpanded || isPopulated || (key && manuallyAddedFields.has(key));

      if (isVisible) {
        if (fg.style.display !== '') {
          fg.style.display = '';
        }
        visibleCount++;

        // Add remove "✕" button in label if not present
        if (!labelEl.dataset.hasRemoveBtn && key) {
          labelEl.dataset.hasRemoveBtn = 'true';
          labelEl.style.display = 'flex';
          labelEl.style.alignItems = 'center';
          labelEl.style.justifyContent = 'space-between';

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'btn-remove-doc-field';
          btnRemove.title = 'Hide this column/field';
          btnRemove.textContent = '✕';
          btnRemove.onclick = function(e) {
            e.stopPropagation();
            if (input) {
              input.value = '';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (key) {
              manuallyAddedFields.delete(key);
              window.setStandardInvoiceField(key, '');
            }
            fg.style.display = 'none';
            updateDocHeaderStatus();
          };
          labelEl.appendChild(btnRemove);
        }
      } else {
        if (fg.style.display !== 'none') {
          fg.style.display = 'none';
        }
      }
    });

    updateDocHeaderStatus(visibleCount);
  }

  function updateDocHeaderStatus(count) {
    const firstSection = document.querySelector('.invoice-tab-content.tab-form .invoice-form-section');
    if (!firstSection) return;

    if (count === undefined) {
      count = firstSection.querySelectorAll('.form-field-group:not([style*="display: none"])').length;
    }
    const badge = firstSection.querySelector('#doc-active-count-badge');
    if (badge) {
      badge.textContent = `${count} Active Fields`;
    }
  }

  function populateDocAddMenu(menu) {
    const firstSection = document.querySelector('.invoice-tab-content.tab-form .invoice-form-section');
    if (!firstSection) return;

    menu.innerHTML = '';

    // Find all currently hidden standard fields in the first section
    const hiddenGroups = firstSection.querySelectorAll('.form-field-group[style*="display: none"]');
    const hiddenDefs = [];

    hiddenGroups.forEach(fg => {
      const key = fg.dataset.docFieldKey;
      if (key) {
        const def = STANDARD_DOC_FIELDS.find(f => f.key === key);
        if (def && !hiddenDefs.some(d => d.key === key)) {
          hiddenDefs.push(def);
        }
      }
    });

    if (hiddenDefs.length > 0) {
      const headerItem = document.createElement('div');
      headerItem.className = 'doc-menu-header';
      headerItem.textContent = 'HIDDEN STANDARD FIELDS';
      menu.appendChild(headerItem);

      hiddenDefs.forEach(def => {
        const item = document.createElement('div');
        item.className = 'doc-menu-item';
        item.innerHTML = `<span>＋ ${escapeHtml(def.label)}</span>`;
        item.onclick = function(e) {
          e.stopPropagation();
          manuallyAddedFields.add(def.key);
          const fg = firstSection.querySelector(`[data-doc-field-key="${def.key}"]`);
          if (fg) {
            fg.style.display = '';
            const inp = fg.querySelector('input, select, textarea');
            if (inp) {
              setTimeout(() => {
                inp.focus();
                if (inp.select) inp.select();
              }, 40);
            }
          }
          menu.style.display = 'none';
          updateDocHeaderStatus();
        };
        menu.appendChild(item);
      });
    } else {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'doc-menu-item disabled';
      emptyItem.textContent = 'All standard fields visible';
      menu.appendChild(emptyItem);
    }

    // Divider
    const divider = document.createElement('div');
    divider.className = 'doc-menu-divider';
    menu.appendChild(divider);

    // Add Custom Column Item
    const customItem = document.createElement('div');
    customItem.className = 'doc-menu-item custom-item';
    customItem.innerHTML = `<span>✨ ＋ Add Custom Field / Column</span>`;
    customItem.onclick = function(e) {
      e.stopPropagation();
      menu.style.display = 'none';
      window.addStandardCustomColumn();
    };
    menu.appendChild(customItem);
  }

  // Close dropdown on click outside
  document.addEventListener('click', function(e) {
    const menu = document.getElementById('doc-add-field-menu');
    const btn = document.getElementById('btn-doc-add-field');
    if (menu && menu.style.display !== 'none') {
      if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
        menu.style.display = 'none';
      }
    }
  });

  // Inject AnalyzingImage scanning UI placeholder
  function injectAnalyzingImage() {
    const wrap = document.querySelector('.invoice-extracting-state .extracting-spinner-wrap');
    if (!wrap || wrap.querySelector('.analyzing-image-component')) return;

    wrap.innerHTML = `
      <div class="analyzing-image-component" role="status" aria-label="Analyzing image">
        <div class="analyzing-image-inner">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="analyzing-matrix-svg">
            <path d="M6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27976 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3H6.8C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8V16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="6" y="19" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="19" width="3" height="1" fill="currentColor"/>
            <rect x="9" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="14" y="19" width="3" height="1" fill="currentColor"/>
            <rect x="15" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="5" y="18" width="2" height="1" fill="currentColor"/>
            <rect x="5" y="17" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="19" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="17" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="19" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="17" y="19" width="1" height="1" fill="currentColor"/>
            <rect x="15" y="4" width="2" height="1" fill="currentColor"/>
            <rect x="3" y="9" width="1" height="3" fill="currentColor"/>
            <rect x="4" y="10" width="1" height="2" fill="currentColor"/>
            <rect x="6" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="15" y="5" width="1" height="1" fill="currentColor"/>
            <rect x="20" y="8" width="1" height="3" fill="currentColor"/>
            <rect x="19" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="13" width="1" height="1" fill="currentColor"/>
            <rect x="9" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="16" y="12" width="1" height="2" fill="currentColor"/>
            <rect x="13" y="14" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="15" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="13" width="1" height="1" fill="currentColor"/>
            <rect x="15" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="13" y="10" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="14" width="1" height="1" fill="currentColor"/>
            <rect x="5" y="4" width="3" height="1" fill="currentColor"/>
            <rect x="6" y="5" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="14" width="1" height="2" fill="currentColor"/>
            <rect x="6" y="14" width="3" height="1" fill="currentColor"/>
            <rect x="16" y="8" width="1" height="1" fill="currentColor"/>
            <rect x="8" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="20" y="16" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="12" width="1" height="1" fill="currentColor"/>
            <rect x="8" y="8" width="1" height="1" fill="currentColor"/>
            <rect x="14" y="12" width="1" height="1" fill="currentColor"/>
            <rect x="17" y="16" width="2" height="1" fill="currentColor"/>
            <rect x="14" y="17" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="5" width="3" height="1" fill="currentColor"/>
            <rect x="12" y="4" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="7" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="15" y="15" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="13" y="9" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="15" width="1" height="1" fill="currentColor"/>
            <rect x="9" y="12" width="2" height="1" fill="currentColor"/>
            <rect x="19" y="13" width="2" height="1" fill="currentColor"/>
            <rect x="9" y="6" width="1" height="1" fill="currentColor"/>
            <rect x="20" y="4" width="1" height="1" fill="currentColor"/>
            <rect x="19" y="4" width="1" height="1" fill="currentColor"/>
            <rect x="3" y="15" width="1" height="2" fill="currentColor"/>
            <rect x="3" y="19" width="1" height="1" fill="currentColor"/>
          </svg>
          <div class="analyzing-clip-layer">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="analyzing-photo-svg">
              <path d="M4.27209 20.7279L10.8686 14.1314C11.2646 13.7354 11.4627 13.5373 11.691 13.4632C11.8918 13.3979 12.1082 13.3979 12.309 13.4632C12.5373 13.5373 12.7354 13.7354 13.1314 14.1314L19.6839 20.6839M14 15L16.8686 12.1314C17.2646 11.7354 17.4627 11.5373 17.691 11.4632C17.8918 11.3979 18.1082 11.3979 18.309 11.4632C18.5373 11.5373 18.7354 11.7354 19.1314 12.1314L22 15M10 9C10 10.1046 9.10457 11 8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9ZM6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27976 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3H6.8C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8V16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="analyzing-laser-beam"></div>
        </div>
      </div>
    `;
  }

  setInterval(function() {
    if (document.querySelector('.invoice-extracting-state')) {
      injectAnalyzingImage();
    }
  }, 100);

  // Safe mutation observer to detect when the tab or sidebar opens
  const observer = new MutationObserver(function(mutations) {
    if (isRendering) return;
    enhanceLineItemsTable();

    const isExtracting = Boolean(document.querySelector('.invoice-extracting-state'));
    if (isExtracting) {
      injectAnalyzingImage();
      const extras = document.getElementById('fieldbi-standard-invoice-extras');
      if (extras) extras.style.setProperty('display', 'none', 'important');
      return;
    } else {
      const extras = document.getElementById('fieldbi-standard-invoice-extras');
      if (extras && extras.style.display === 'none') {
        extras.style.removeProperty('display');
      }
    }

    // Ignore mutations on our own enhanced elements to prevent infinite loops
    let hasRelevantMutation = false;
    for (let i = 0; i < mutations.length; i++) {
      const t = mutations[i].target;
      if (!t) continue;
      if (t.id === 'fieldbi-standard-invoice-extras' || (t.closest && t.closest('#fieldbi-standard-invoice-extras'))) continue;
      if (t.classList && (t.classList.contains('doc-vendor-header') || t.classList.contains('doc-add-field-menu') || t.classList.contains('btn-remove-doc-field') || t.classList.contains('totals-reconciliation-container') || t.classList.contains('tax-rate-contradiction-alert') || t.classList.contains('ai-provenance-badge-btn') || t.classList.contains('subtotal-missing-hint-box'))) continue;
      if (t.closest && (t.closest('.doc-vendor-header') || t.closest('.doc-add-field-menu') || t.closest('.totals-reconciliation-container') || t.closest('.tax-rate-contradiction-alert') || t.closest('#ai-provenance-audit-modal'))) continue;
      if (t.closest && (t.closest('.doc-vendor-header') || t.closest('.doc-add-field-menu'))) continue;
      hasRelevantMutation = true;
      break;
    }
    if (!hasRelevantMutation) return;

    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    scheduleRender(false);
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

  function renderConditionalFormFields(force) {
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
    const hasFinancialExtras = isCustomFieldsExpanded || (data.discounts && Number(data.discounts) > 0) || (data.shippingFees && Number(data.shippingFees) > 0);
    const hasPaymentExtras = isCustomFieldsExpanded || hasValue(data.paymentMethods) || hasValue(data.bankDetails);

    extSection.innerHTML = `
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

      <!-- 4. References, Tracking & Custom Columns (Always Editable & Expandable) -->
      <div class="standard-section-card">
        <div class="standard-section-header">
          <h5 class="standard-section-title">
            4. References & Custom Columns 
            <span class="standard-badge ${hasValue(data.poNumber) || hasValue(data.projectCode) || hasValue(data.costCenter) || (data.customColumns && data.customColumns.length) ? 'active' : ''}">
              ${hasValue(data.poNumber) || hasValue(data.projectCode) || hasValue(data.costCenter) || (data.customColumns && data.customColumns.length) ? 'Active' : 'Optional'}
            </span>
          </h5>
          <div class="section-actions-right">
            <button type="button" class="btn-add-custom-col" onclick="window.addStandardCustomColumn()" title="Add custom column or tracking code">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Column
            </button>
          </div>
        </div>
        <div class="standard-hint-row">
          <span>Only populated columns appear. Click any column name (✎) to rename it, or click <strong>Add Column</strong> to add new fields.</span>
        </div>
        <div class="standard-grid">
          ${(isCustomFieldsExpanded || hasValue(data.poNumber) || manuallyAddedFields.has('poNumber')) ? `
          <div class="standard-field-group">
            <div class="standard-label-row">
              <input type="text" class="standard-editable-label" value="${escapeHtml((data.customLabels && data.customLabels.poNumber) || 'Purchase Order (PO) #')}" oninput="window.setStandardFieldLabel('poNumber', this.value)" title="Click to rename this column">
              <span class="label-edit-icon" title="Rename column">✎</span>
            </div>
            <input type="text" class="standard-input" placeholder="PO-12345" value="${escapeHtml(data.poNumber || '')}" oninput="window.setStandardInvoiceField('poNumber', this.value)">
          </div>` : ''}
          
          ${(isCustomFieldsExpanded || hasValue(data.projectCode) || manuallyAddedFields.has('projectCode')) ? `
          <div class="standard-field-group">
            <div class="standard-label-row">
              <input type="text" class="standard-editable-label" value="${escapeHtml((data.customLabels && data.customLabels.projectCode) || 'Project Name / Code')}" oninput="window.setStandardFieldLabel('projectCode', this.value)" title="Click to rename this column">
              <span class="label-edit-icon" title="Rename column">✎</span>
            </div>
            <input type="text" class="standard-input" placeholder="PRJ-ALPHA" value="${escapeHtml(data.projectCode || '')}" oninput="window.setStandardInvoiceField('projectCode', this.value)">
          </div>` : ''}

          ${(isCustomFieldsExpanded || hasValue(data.costCenter) || manuallyAddedFields.has('costCenter')) ? `
          <div class="standard-field-group">
            <div class="standard-label-row">
              <input type="text" class="standard-editable-label" value="${escapeHtml((data.customLabels && data.customLabels.costCenter) || 'Cost Center / Vendor ID')}" oninput="window.setStandardFieldLabel('costCenter', this.value)" title="Click to rename this column">
              <span class="label-edit-icon" title="Rename column">✎</span>
            </div>
            <input type="text" class="standard-input" placeholder="CC-001" value="${escapeHtml(data.costCenter || '')}" oninput="window.setStandardInvoiceField('costCenter', this.value)">
          </div>` : ''}

          ${(data.customColumns || []).map(col => `
          <div class="standard-field-group standard-custom-col-item" data-col-id="${escapeHtml(col.id)}">
            <div class="standard-label-row">
              <input type="text" class="standard-editable-label custom-col-label" value="${escapeHtml(col.name || 'Custom Column')}" oninput="window.setCustomColumnName('${escapeHtml(col.id)}', this.value)" placeholder="Column Name..." title="Click to rename this column">
              <button type="button" class="btn-remove-col" onclick="window.removeStandardCustomColumn('${escapeHtml(col.id)}')" title="Delete column">✕</button>
            </div>
            <input type="text" class="standard-input" placeholder="Enter value..." value="${escapeHtml(col.value || '')}" oninput="window.setCustomColumnValue('${escapeHtml(col.id)}', this.value)">
          </div>
          `).join('')}
        </div>
      </div>

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
        <span>${isCustomFieldsExpanded ? '✕ Collapse / Hide Optional Empty Fields' : '⚡ Customize / Show All Fields (Null / Optional)'}</span>
      </button>
    `;
    enhanceLineItemsTable();
  }

  window.toggleAllStandardInvoiceFields = function() {
    isCustomFieldsExpanded = !isCustomFieldsExpanded;
    isRendering = false;
    renderAllEnhancedSections(true);
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

  // Dynamically ensure all file inputs accept both images and PDF files
  function updateFileInputAccepts() {
    const inputs = document.querySelectorAll('input[type="file"]');
    inputs.forEach(function(input) {
      const cur = input.getAttribute('accept');
      if (!cur || !cur.includes('.pdf') || !cur.includes('application/pdf')) {
        input.setAttribute('accept', 'image/*,application/pdf,.pdf');
      }
    });
  }
  updateFileInputAccepts();
  setInterval(updateFileInputAccepts, 800);

  // Global Drag & Drop File Upload Support (Images & PDFs)
  window.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      if (window.homePageComponent && typeof window.homePageComponent.onFilesSelected === 'function') {
        window.homePageComponent.onFilesSelected({ target: { files: files }, files: files });
      } else {
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          try {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(err) {
            console.warn('Unable to directly set input files:', err);
          }
        }
      }
    }
  });

  // Helper to open Data from PDF, Image sidebar anytime
  window.openDataFromPdfImg = function() {
    if (window.homePageComponent && typeof window.homePageComponent.extractAndConvertApInvoice === 'function') {
      window.homePageComponent.extractAndConvertApInvoice();
    }
  };

  // Helper to trigger auto-scan explicitly on the current or newly uploaded page
  window.autoScanCurrentDocument = function() {
    if (window.homePageComponent) {
      if (typeof window.homePageComponent.extractAndConvertApInvoice === 'function') {
        window.homePageComponent.extractAndConvertApInvoice();
      } else if (typeof window.homePageComponent.runOcr === 'function') {
        window.homePageComponent.runOcr();
      }
    }
  };
})();
