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
      enhanceRawOcrTab(force);
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
      if (t.id === 'fieldbi-enhanced-raw-ocr' || (t.closest && t.closest('#fieldbi-enhanced-raw-ocr'))) continue;
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

  // ==========================================================
  // Enhanced Raw OCR Inspector & Formatter
  // ==========================================================
  let ocrViewMode = 'formatted'; // 'formatted' | 'lines' | 'raw'
  let ocrSearchQuery = '';

  function getRawOcrText() {
    if (window.homePageComponent && window.homePageComponent.ocrExtractedText) {
      return window.homePageComponent.ocrExtractedText;
    }
    const origTextarea = document.querySelector('.invoice-tab-content.tab-raw .ocr-textarea');
    if (origTextarea && origTextarea.value) {
      return origTextarea.value;
    }
    const data = getData();
    if (data && data.rawOcrText) {
      return data.rawOcrText;
    }
    return '';
  }

  function standardizeDateString(dStr) {
    if (!dStr) return '';
    dStr = String(dStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;

    const monthNames = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    const namedMatch = dStr.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i) || dStr.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i);
    if (namedMatch) {
      const isMonthFirst = isNaN(parseInt(namedMatch[1], 10));
      const mStr = (isMonthFirst ? namedMatch[1] : namedMatch[2]).toLowerCase().slice(0, 3);
      const m = monthNames[mStr];
      const d = parseInt(isMonthFirst ? namedMatch[2] : namedMatch[1], 10);
      const y = parseInt(namedMatch[3], 10);
      if (m && d && y) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    const parts = dStr.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (parts) {
      let p1 = parseInt(parts[1], 10), p2 = parseInt(parts[2], 10), yr = parseInt(parts[3], 10);
      if (yr < 100) yr += 2000;
      let m = p1, d = p2;
      if (p1 > 12 && p2 <= 12) { d = p1; m = p2; }
      return `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    const testD = new Date(dStr);
    if (!isNaN(testD.getTime())) {
      const y = testD.getFullYear();
      const m = String(testD.getMonth() + 1).padStart(2, '0');
      const day = String(testD.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return dStr;
  }

  function convertKhmerNumerals(t) {
    if (!t) return '';
    const khmerDigits = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
    return t.replace(/[០-៩]/g, i => {
      const idx = khmerDigits.indexOf(i);
      return idx !== -1 ? String(idx) : i;
    });
  }

  function parseFullApInvoiceUniversal(rawText) {
    if (!rawText || !rawText.trim()) return null;

    let normalized = rawText.normalize('NFC').replace(/\u200B/g, '');
    normalized = convertKhmerNumerals(normalized);
    const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. Invoice Number
    let invoiceNumber = '';
    const invMatch = normalized.match(/(?:invoice\s*(?:no|number|#)|inv\s*(?:no|#|[:#])|bill\s*#|receipt\s*#)\s*[:#.]?\s*([A-Za-z0-9-_]+)/i)
      || normalized.match(/#(\d{4,10})/);
    if (invMatch) invoiceNumber = invMatch[1];

    // 2. Dates
    let invoiceDate = '';
    let dueDate = '';
    const dateMatch = normalized.match(/(?:invoice\s*date|date\s*issued|issue\s*date|dated|date)\s*[:.]?\s*([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}|\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i);
    if (dateMatch) invoiceDate = standardizeDateString(dateMatch[1]);

    const dueMatch = normalized.match(/(?:due\s*date|payment\s*due)\s*[:.]?\s*([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}|\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i);
    if (dueMatch) dueDate = standardizeDateString(dueMatch[1]);
    if (!dueDate && invoiceDate) dueDate = invoiceDate;

    // 3. PO / Reference Number
    let poNumber = '';
    const poMatch = normalized.match(/(?:booking\s*reference|p\.?o\.?\s*(?:no|#)?|po\s*number|purchase\s*order|order\s*#|ref\s*#)\s*[:.#-]?\s*([A-Za-z0-9-_]+)/i);
    if (poMatch) poNumber = poMatch[1].trim();

    // 4. Payment Terms
    let paymentTerms = '';
    for (let i = 0; i < lines.length; i++) {
      if (/^payment\s*terms\b/i.test(lines[i])) {
        const inline = lines[i].replace(/^payment\s*terms\s*[:.-]?\s*/i, '').trim();
        if (inline) {
          paymentTerms = inline;
        } else if (lines[i + 1] && !/^(notes|address|total|tax|created)/i.test(lines[i + 1])) {
          paymentTerms = lines[i + 1];
        }
        break;
      }
    }
    if (!paymentTerms) {
      const ptMatch = normalized.match(/(?:terms|payment\s*terms)\s*[:.]?\s*([^\n\r]+)/i);
      if (ptMatch) paymentTerms = ptMatch[1].trim();
    }

    // 5. Vendor Details
    let vendorName = '';
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const l = lines[i];
      if (!/^(invoice|bill\s*to|ship\s*to|prepared\s*for|date|phone|tel|email|due|tax|total|booking|description|qty)/i.test(l) &&
          l.replace(/[^A-Za-z0-9\u1780-\u17FF]/g, '').length >= 3) {
        vendorName = l.replace(/^[_\s\-.:|#~*+=]+/, '').replace(/[_\s\-.:|#~*+=]+$/, '').trim();
        break;
      }
    }
    if (!vendorName) vendorName = 'Unknown Vendor';

    let vendorAddress = '';
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^address\b/i.test(l)) {
        if (lines[i + 1] && !/^(created|date|invoice|total|tax|payment)/i.test(lines[i + 1])) {
          vendorAddress = lines[i + 1];
          break;
        }
      } else if (/\b[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?\b/.test(l) && !vendorAddress) {
        vendorAddress = l;
      }
    }

    // Vendor Phone & Email
    let vendorPhone = '';
    const phoneMatch = normalized.match(/(?:phone|tel|mobile)\s*[:.]?\s*([+\d()\s-]{7,20})|\b(\(\d{3}\)\s*\d{3}-\d{4})\b/i);
    if (phoneMatch) vendorPhone = (phoneMatch[1] || phoneMatch[2]).trim();

    let vendorEmail = '';
    const emailMatch = normalized.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) vendorEmail = emailMatch[1].trim();

    // 6. Customer / Billed To
    let customerName = '';
    const custMatch = normalized.match(/(?:prepared\s*for|bill\s*to|billed\s*to|customer|client)\s*[:.]?\s*([^\n\r]+)/i);
    if (custMatch) {
      customerName = custMatch[1].replace(/^(?:to|for)\s*[:.]?\s*/i, '').trim();
    }

    const custCodeMatch = normalized.match(/(?:customer\s*code|cust\s*code|customer\s*id|client\s*id)\s*[:.]?\s*([A-Za-z0-9-_]+)/i);
    const customerTaxId = custCodeMatch ? custCodeMatch[1].trim() : '';

    // 7. Notes
    let notes = '';
    for (let i = 0; i < lines.length; i++) {
      if (/^notes?\b/i.test(lines[i])) {
        const inline = lines[i].replace(/^notes?\s*[:.-]?\s*/i, '').trim();
        if (inline) {
          notes = inline;
        } else if (lines[i + 1] && !/^(address|created|terms|total|tax)/i.test(lines[i + 1])) {
          notes = lines[i + 1];
        }
        break;
      }
    }

    // 8. Line Items Extraction
    const items = [];
    const stopKeywords = /^(tax|sub\s*total|subtotal|net|total|payment\s*terms|notes?|address|created\s*with|thank\s*you)/i;

    // Pattern A: Multi-line vertical items (4-line: Name \n Qty \n UnitPrice \n Total)
    for (let j = 0; j < lines.length - 2; j++) {
      const l1 = lines[j];
      const l2 = lines[j + 1];
      const l3 = lines[j + 2];
      const l4 = lines[j + 3];

      if (l4 && !stopKeywords.test(l1)) {
        const qV = parseFloat(l2.replace(/[^\d.]/g, ''));
        const pV = parseFloat(l3.replace(/[^\d.]/g, ''));
        const tV = parseFloat(l4.replace(/[^\d.]/g, ''));

        if (!isNaN(qV) && !isNaN(pV) && !isNaN(tV) && qV > 0 && pV > 0 && tV > 0) {
          if (Math.abs(qV * pV - tV) < 0.5 || Math.abs(tV - qV * pV) / tV < 0.05) {
            if (!/^(description|item|qty|unit\s*price|price|total)/i.test(l1)) {
              items.push({
                itemNo: items.length + 1,
                sku: '-',
                description: l1.trim(),
                quantity: qV,
                unitPrice: pV,
                total: tV
              });
              j += 3;
              continue;
            }
          }
        }
      }

      // Pattern B: 3-line vertical items (Name \n Qty \n Total)
      if (l3 && !stopKeywords.test(l1)) {
        const qV = parseFloat(l2.replace(/[^\d.]/g, ''));
        const tV = parseFloat(l3.replace(/[^\d.]/g, ''));
        if (!isNaN(qV) && !isNaN(tV) && qV > 0 && tV > 0 && !/[A-Za-z]/.test(l2)) {
          if (!/^(description|item|qty|price|total)/i.test(l1)) {
            const pV = Math.round((tV / qV) * 100) / 100;
            items.push({
              itemNo: items.length + 1,
              sku: '-',
              description: l1.trim(),
              quantity: qV,
              unitPrice: pV,
              total: tV
            });
            j += 2;
            continue;
          }
        }
      }
    }

    // Pattern C: Horizontal single-line items
    if (items.length === 0) {
      const lineItemRegexes = [
        /^(?:(\d{3,8}|[A-Z0-9-]{3,10})\s+)?(.+?)\s+([\d,.]+)\s+[$៛]?([\d,.]+)\s+[$៛]?([\d,.]+)$/,
        /^(.+?)\s+([\d,.]+)\s+[$៛]?([\d,.]+)\s+[$៛]?([\d,.]+)$/,
        /^(.+?)\s+(\d+)\s+[$៛]?([\d,.]+)$/
      ];

      for (const line of lines) {
        if (/^(#|item|description|sku|sub\s*total|net|total|tax|vat|terms|payment|due|date)/i.test(line)) continue;

        for (const rx of lineItemRegexes) {
          const m = line.match(rx);
          if (m) {
            if (m.length === 6) {
              const sku = m[1] || '-';
              const desc = m[2].trim();
              const qty = parseFloat(m[3].replace(/,/g, ''));
              const price = parseFloat(m[4].replace(/,/g, ''));
              const total = parseFloat(m[5].replace(/,/g, ''));
              items.push({ itemNo: items.length + 1, sku, description: desc, quantity: qty, unitPrice: price, total });
              break;
            } else if (m.length === 5) {
              const desc = m[1].trim();
              const qty = parseFloat(m[2].replace(/,/g, ''));
              const price = parseFloat(m[3].replace(/,/g, ''));
              const total = parseFloat(m[4].replace(/,/g, ''));
              items.push({ itemNo: items.length + 1, sku: '-', description: desc, quantity: qty, unitPrice: price, total });
              break;
            } else if (m.length === 4) {
              const desc = m[1].trim();
              const qty = parseFloat(m[2].replace(/,/g, ''));
              const total = parseFloat(m[3].replace(/,/g, ''));
              items.push({ itemNo: items.length + 1, sku: '-', description: desc, quantity: qty, unitPrice: Math.round((total / qty) * 100) / 100, total });
              break;
            }
          }
        }
      }
    }

    // 9. Financial Totals
    let subtotal = 0;
    let taxAmount = 0;
    let taxRate = 0;
    let grandTotal = 0;

    for (let i = 0; i < lines.length; i++) {
      if (/^tax\b/i.test(lines[i])) {
        const inline = lines[i].replace(/^tax\s*[:.-]?\s*[$]?\s*/i, '').trim();
        const rateM = inline.match(/(\d+(?:\.\d+)?)\s*%/);
        if (rateM) taxRate = parseFloat(rateM[1]);
        const valM = inline.replace(/\(\d+%\)/, '').replace(/[$,]/g, '').trim();
        if (valM && !isNaN(parseFloat(valM))) {
          taxAmount = parseFloat(valM);
        } else if (lines[i + 1]) {
          const nextVal = lines[i + 1].replace(/[$,]/g, '').trim();
          if (!isNaN(parseFloat(nextVal))) taxAmount = parseFloat(nextVal);
        }
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (/^(sub\s*total|net)\b/i.test(lines[i])) {
        const inline = lines[i].replace(/^(sub\s*total|net)\s*[:.-]?\s*[$]?\s*/i, '').trim();
        if (inline && !isNaN(parseFloat(inline.replace(/,/g, '')))) {
          subtotal = parseFloat(inline.replace(/,/g, ''));
        } else if (lines[i + 1]) {
          const nextVal = lines[i + 1].replace(/[$,]/g, '').trim();
          if (!isNaN(parseFloat(nextVal))) subtotal = parseFloat(nextVal);
        }
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (/^total\b/i.test(lines[i]) && !/^total\s*(items|tax|qty|discount)/i.test(lines[i])) {
        const inline = lines[i].replace(/^total\s*[:.-]?\s*[$]?\s*/i, '').trim();
        if (inline && !isNaN(parseFloat(inline.replace(/,/g, '')))) {
          grandTotal = parseFloat(inline.replace(/,/g, ''));
        } else if (lines[i + 1]) {
          const nextVal = lines[i + 1].replace(/[$,]/g, '').trim();
          if (!isNaN(parseFloat(nextVal))) grandTotal = parseFloat(nextVal);
        }
        break;
      }
    }

    const itemsSum = items.length > 0
      ? Math.round(items.reduce((s, it) => s + (it.total || 0), 0) * 100) / 100
      : 0;

    if (subtotal === 0 && itemsSum > 0) {
      subtotal = itemsSum;
    }

    if (taxAmount > 0 && subtotal > 0 && taxRate === 0) {
      taxRate = Math.round((taxAmount / subtotal) * 100);
    }

    if (grandTotal === 0 && subtotal > 0) {
      grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
    } else if (grandTotal === subtotal && taxAmount > 0) {
      grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
    }

    return {
      documentType: 'AP_INVOICE',
      currency: 'USD',
      vendor: {
        name: vendorName,
        address: vendorAddress,
        phone: vendorPhone,
        email: vendorEmail,
        taxId: ''
      },
      vendorName: vendorName,
      vendorAddress: vendorAddress,
      vendorPhone: vendorPhone,
      vendorEmail: vendorEmail,
      invoiceNumber: invoiceNumber,
      invoiceDate: invoiceDate,
      dueDate: dueDate,
      paymentTerms: paymentTerms || 'Within 30 days',
      poNumber: poNumber,
      bookingReference: poNumber,
      customerTaxId: customerTaxId,
      customerCode: customerTaxId,
      billTo: {
        name: customerName,
        address: vendorAddress
      },
      billedTo: customerName,
      billingAddress: vendorAddress,
      billedAddress: vendorAddress,
      items: items,
      subtotal: subtotal,
      taxRate: taxRate,
      taxAmount: taxAmount,
      grandTotal: grandTotal,
      notes: notes,
      rawOcrText: rawText
    };
  }

  function cleanAndAlignOcrText(rawText) {
    if (!rawText || !rawText.trim()) return '';
    const parsed = parseFullApInvoiceUniversal(rawText);
    if (!parsed) return rawText.trim();

    let out = [];

    if (parsed.vendorName && parsed.vendorName !== 'Unknown Vendor') {
      out.push(parsed.vendorName.toUpperCase());
    }
    if (parsed.vendorAddress) {
      out.push(parsed.vendorAddress);
    }
    if (parsed.vendorPhone) {
      out.push('Tel: ' + parsed.vendorPhone);
    }
    if (parsed.vendorEmail) {
      out.push('Email: ' + parsed.vendorEmail);
    }
    out.push('');

    if (parsed.invoiceNumber) out.push(`Invoice No. : ${parsed.invoiceNumber}`);
    if (parsed.invoiceDate)   out.push(`Date        : ${parsed.invoiceDate}`);
    if (parsed.dueDate)       out.push(`Due Date    : ${parsed.dueDate}`);
    if (parsed.poNumber)      out.push(`Booking Ref : ${parsed.poNumber}`);
    if (parsed.customerCode)  out.push(`Customer ID : ${parsed.customerCode}`);
    if (parsed.billedTo)      out.push(`Prepared For: ${parsed.billedTo}`);
    out.push('');

    if (parsed.items && parsed.items.length > 0) {
      out.push('DESCRIPTION                             QTY   UNIT PRICE        TOTAL');
      out.push('---------------------------------------------------------------------');
      for (const it of parsed.items) {
        const desc = (it.description || '').padEnd(38).slice(0, 38);
        const qty = String(it.quantity || 1).padStart(5);
        const price = ('$' + Number(it.unitPrice || 0).toFixed(2)).padStart(12);
        const total = ('$' + Number(it.total || 0).toFixed(2)).padStart(13);
        out.push(`${desc} ${qty} ${price} ${total}`);
      }
      out.push('---------------------------------------------------------------------');
      out.push('');
    }

    if (parsed.subtotal) {
      out.push(`SUBTOTAL:        $${Number(parsed.subtotal).toFixed(2)}`);
    }
    if (parsed.taxAmount) {
      const rateStr = parsed.taxRate ? ` (${parsed.taxRate}%)` : '';
      out.push(`TAX${rateStr}:       $${Number(parsed.taxAmount).toFixed(2)}`);
    }
    if (parsed.grandTotal) {
      out.push(`TOTAL:           $${Number(parsed.grandTotal).toFixed(2)}`);
    }
    out.push('');

    if (parsed.paymentTerms) {
      out.push(`PAYMENT TERMS : ${parsed.paymentTerms}`);
    }
    if (parsed.notes) {
      out.push(`NOTES         : ${parsed.notes}`);
    }

    return out.join('\n').trim();
  }

  window.parseFullApInvoiceUniversal = parseFullApInvoiceUniversal;
  window.cleanAndAlignOcrText = cleanAndAlignOcrText;

  function formatInvoiceOcrText(data, rawText) {
    let lines = [];
    lines.push('================================================================================');
    lines.push('                   FIELDBI AP VISION - STRUCTURED OCR DATA');
    lines.push('================================================================================\n');

    if ((!data || !data.items || data.items.length === 0) && rawText && rawText.trim()) {
      const fallback = parseFullApInvoiceUniversal(rawText);
      if (fallback && fallback.items && fallback.items.length > 0) {
        data = Object.assign({}, data, fallback);
      }
    }

    if (data && (data.vendorName || data.invoiceNumber || (data.items && data.items.length) || data.grandTotal)) {
      lines.push('[ 1. DOCUMENT & SUPPLIER INFORMATION ]');
      const vName = data.vendorName || (data.vendor && data.vendor.name);
      if (vName) lines.push('  Vendor Name      : ' + vName);
      const vPhone = data.vendorPhone || (data.vendor && data.vendor.phone);
      if (vPhone) lines.push('  Vendor Phone     : ' + vPhone);
      const vTax = data.vendorTaxId || (data.vendor && data.vendor.taxId) || data.customerTaxId;
      if (vTax) lines.push('  Tax ID / VAT     : ' + vTax);
      const vEmail = data.vendorEmail || (data.vendor && data.vendor.email);
      if (vEmail) lines.push('  Vendor Email     : ' + vEmail);
      let addr = (data.vendor && data.vendor.address) || [data.vendor?.street, data.vendor?.city, data.vendor?.country].filter(Boolean).join(', ') || data.vendorAddress;
      if (addr) lines.push('  Vendor Address   : ' + addr);
      lines.push('');

      lines.push('[ 2. INVOICE META & PAYMENT TERMS ]');
      if (data.invoiceNumber) lines.push('  Invoice / Doc No : ' + data.invoiceNumber);
      if (data.poNumber || data.bookingReference) lines.push('  PO / Booking Ref : ' + (data.poNumber || data.bookingReference));
      if (data.invoiceDate) lines.push('  Invoice Date     : ' + data.invoiceDate);
      if (data.dueDate) lines.push('  Payment Due Date : ' + data.dueDate);
      if (data.paymentTerms) lines.push('  Payment Terms    : ' + data.paymentTerms);
      if (data.currency) lines.push('  Currency         : ' + data.currency);
      lines.push('');

      const bName = data.billedTo || data.billTo?.name || data.customer?.name;
      const bAddr = data.billingAddress || data.billedAddress || data.billTo?.address || data.billTo?.street || data.customer?.billingAddress;
      const cCode = data.customerCode || data.customerTaxId;
      if (bName || bAddr || cCode) {
        lines.push('[ 3. CUSTOMER / BILLED TO ]');
        if (bName) lines.push('  Billed To        : ' + bName);
        if (cCode) lines.push('  Customer Code    : ' + cCode);
        if (bAddr) lines.push('  Billing Address  : ' + bAddr);
        lines.push('');
      }

      if (data.items && data.items.length) {
        lines.push('[ 4. ITEM DETAILS & LINE CHARGES ]');
        lines.push('  #  | SKU / Item Code | Description                        | Qty | Unit Price | Total Amount');
        lines.push('  ---+-----------------+------------------------------------+-----+------------+--------------');
        data.items.forEach((it, idx) => {
          let no = String(idx + 1).padEnd(2);
          let sku = String(it.sku || it.itemCode || '-').padEnd(15);
          let desc = String(it.description || 'Item').padEnd(34);
          let qty = String(it.quantity || 1).padStart(3);
          let price = Number(it.unitPrice || 0).toFixed(2).padStart(10);
          let total = Number(it.total || 0).toFixed(2).padStart(12);
          lines.push('  ' + no + ' | ' + sku + ' | ' + desc + ' | ' + qty + ' | ' + price + ' | ' + total);
        });
        lines.push('');
      }

      lines.push('[ 5. FINANCIAL TOTALS ]');
      if (data.subtotal != null && Number(data.subtotal) > 0) lines.push('  Net Subtotal     : ' + Number(data.subtotal).toFixed(2));
      if (data.discounts != null && Number(data.discounts) > 0) lines.push('  Discounts        : -' + Number(data.discounts).toFixed(2));
      if (data.shippingFees != null && Number(data.shippingFees) > 0) lines.push('  Shipping / Fees  : ' + Number(data.shippingFees).toFixed(2));
      if (data.taxRate != null && Number(data.taxRate) > 0) lines.push('  Tax Rate         : ' + data.taxRate + '%');
      if (data.taxAmount != null && Number(data.taxAmount) > 0) lines.push('  Tax Amount       : ' + Number(data.taxAmount).toFixed(2));
      if (data.grandTotal != null) lines.push('  Grand Total      : ' + Number(data.grandTotal).toFixed(2));
      lines.push('');

      if (data.notes || data.remarks) {
        lines.push('[ 6. NOTES & REMARKS ]');
        lines.push('  ' + (data.notes || data.remarks));
        lines.push('');
      }
    }

    if (rawText && rawText.trim()) {
      lines.push('================================================================================');
      lines.push('                   RAW VERBATIM OCR TRANSCRIPTION');
      lines.push('================================================================================\n');
      lines.push(rawText.trim());
    } else if (!data || (!data.vendorName && !data.invoiceNumber)) {
      lines.push('(No readable text detected on this document yet. Click "+ Scan" to extract.)');
    }

    return lines.join('\n');
  }

  function highlightSearchMatches(escapedText, query) {
    if (!query || !query.trim()) return { html: escapedText, count: 0 };
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + q + ')', 'gi');
    let matches = 0;
    const html = escapedText.replace(regex, function(m) {
      matches++;
      return '<mark class="ocr-search-match">' + m + '</mark>';
    });
    return { html: html, count: matches };
  }

  function syntaxColorFormattedText(text, query) {
    let esc = escapeHtml(text);
    const searchRes = highlightSearchMatches(esc, query);
    let html = searchRes.html;

    html = html.replace(/(\[ \d+\. [^\]]+ \])/g, '<span class="enhanced-ocr-section-header">$1</span>');
    html = html.replace(/(=+)/g, '<span class="enhanced-ocr-table-border">$1</span>');
    html = html.replace(/(\s{2}[A-Za-z /#]+)(\s*:\s*)([^\n<]+)/g, function(_, k, colon, val) {
      let isAmt = /[$€£¥]?\d+[.,]\d{2}/.test(val);
      return '<span class="enhanced-ocr-key">' + k + colon + '</span>' + (isAmt ? '<span class="enhanced-ocr-amount">' + val + '</span>' : '<span class="enhanced-ocr-val">' + val + '</span>');
    });

    return { html: html, count: searchRes.count };
  }

  function enhanceRawOcrTab(force) {
    const tabRaw = document.querySelector('.invoice-tab-content.tab-raw');
    if (!tabRaw) return;

    tabRaw.classList.add('has-enhanced-ocr');

    let container = document.getElementById('fieldbi-enhanced-raw-ocr');
    if (!container) {
      container = document.createElement('div');
      container.id = 'fieldbi-enhanced-raw-ocr';
      container.className = 'enhanced-raw-ocr-container';
      tabRaw.appendChild(container);
    }

    const rawText = getRawOcrText();
    const data = getData();
    const formattedText = formatInvoiceOcrText(data, rawText);
    const activeText = ocrViewMode === 'formatted' ? formattedText : rawText;

    // Word, char, line counts
    const lines = activeText.split('\n');
    const lineCount = activeText.trim() ? lines.length : 0;
    const words = activeText.trim() ? activeText.trim().split(/\s+/).length : 0;
    const chars = activeText.length;
    const docName = (window.homePageComponent && window.homePageComponent.activeDocFileName) || 'Document.pdf';

    let bodyHtml = '';
    let matchCount = 0;

    if (ocrViewMode === 'formatted') {
      const res = syntaxColorFormattedText(formattedText, ocrSearchQuery);
      matchCount = res.count;
      bodyHtml = `
        <pre class="enhanced-ocr-formatted-view"><code>${res.html}</code></pre>
      `;
    } else if (ocrViewMode === 'lines') {
      const linesList = (rawText.trim() ? rawText : formattedText).split('\n');
      let linesHtml = '';
      linesList.forEach((line, idx) => {
        const lineEsc = escapeHtml(line);
        const searchRes = highlightSearchMatches(lineEsc, ocrSearchQuery);
        matchCount += searchRes.count;
        linesHtml += `
          <div class="enhanced-ocr-line-row">
            <span class="enhanced-ocr-line-num">${String(idx + 1).padStart(2, '0')}</span>
            <span class="enhanced-ocr-line-content">${searchRes.html || '&nbsp;'}</span>
          </div>
        `;
      });
      bodyHtml = `
        <div class="enhanced-ocr-lines-view">
          ${linesHtml}
        </div>
      `;
    } else { // 'raw'
      bodyHtml = `
        <div class="enhanced-ocr-textarea-view">
          <textarea class="enhanced-ocr-editor" id="enhancedOcrTextareaInput" placeholder="Edit or transcribe raw OCR text...">${escapeHtml(rawText)}</textarea>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="enhanced-ocr-toolbar">
        <div class="enhanced-ocr-toolbar-left">
          <span class="enhanced-ocr-badge">📄 ${escapeHtml(docName)}</span>
          <span class="enhanced-ocr-badge status-verified">✓ Verbatim OCR</span>
          <span class="enhanced-ocr-badge stat-pill">${lineCount} lines</span>
          <span class="enhanced-ocr-badge stat-pill">${words} words</span>
          <span class="enhanced-ocr-badge stat-pill">${chars} chars</span>
        </div>

        <div class="enhanced-ocr-view-switch">
          <button type="button" class="enhanced-ocr-view-btn ${ocrViewMode === 'formatted' ? 'active' : ''}" data-view="formatted" title="Structured format with section headers and aligned line items">
            📋 Formatted
          </button>
          <button type="button" class="enhanced-ocr-view-btn ${ocrViewMode === 'lines' ? 'active' : ''}" data-view="lines" title="Line-by-line view with numbered gutter">
            🔢 Lines
          </button>
          <button type="button" class="enhanced-ocr-view-btn ${ocrViewMode === 'raw' ? 'active' : ''}" data-view="raw" title="Editable raw textarea">
            ✏️ Raw Editor
          </button>
        </div>

        <div class="enhanced-ocr-search-wrap">
          <input type="text" class="enhanced-ocr-search-input" id="enhancedOcrSearchInput" placeholder="🔍 Search OCR text..." value="${escapeHtml(ocrSearchQuery)}">
          ${ocrSearchQuery.trim() ? `<span class="enhanced-ocr-search-count">${matchCount}</span>` : ''}
        </div>

        <div class="enhanced-ocr-actions-right">
          <button type="button" class="btn-ocr-tool" id="btnOcrFormatClean" title="Clean extra spaces and format line wraps">
            ✨ Clean & Align
          </button>
          <button type="button" class="btn-ocr-tool" id="btnOcrCopyAll" title="Copy text to clipboard">
            📋 Copy
          </button>
          <button type="button" class="btn-ocr-tool" id="btnOcrExportTxt" title="Export as UTF-8 .TXT file">
            💾 Export .TXT
          </button>
          <button type="button" class="btn-ocr-tool btn-primary-action" id="btnOcrUpdateForm" title="Re-parse text and update standard form">
            ⚡ Update Form
          </button>
        </div>
      </div>

      <div class="enhanced-ocr-body">
        ${bodyHtml}
      </div>

      <div class="enhanced-ocr-footer">
        <div class="enhanced-ocr-tip">
          💡 <span><b>Pro-Tip:</b> You can edit text in the <b>Raw Editor</b> mode and click <b>"Update Form"</b> to immediately sync all fields.</span>
        </div>
        <div class="enhanced-ocr-status">
          <span>Mode: <b>${ocrViewMode.toUpperCase()}</b></span>
        </div>
      </div>
    `;

    // Bind View Switcher buttons
    container.querySelectorAll('.enhanced-ocr-view-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        ocrViewMode = this.getAttribute('data-view') || 'formatted';
        enhanceRawOcrTab(true);
      });
    });

    // Bind Search Input
    const searchInput = container.querySelector('#enhancedOcrSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        ocrSearchQuery = this.value;
        enhanceRawOcrTab(true);
        setTimeout(() => {
          const inp = document.getElementById('enhancedOcrSearchInput');
          if (inp) {
            inp.focus();
            inp.selectionStart = inp.selectionEnd = inp.value.length;
          }
        }, 10);
      });
    }

    // Bind Textarea Input (if raw mode)
    const editor = container.querySelector('#enhancedOcrTextareaInput');
    if (editor) {
      editor.addEventListener('input', function(e) {
        const val = this.value;
        const origTextarea = tabRaw.querySelector('.ocr-textarea');
        if (origTextarea) {
          origTextarea.value = val;
          origTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (window.homePageComponent) {
          window.homePageComponent.ocrExtractedText = val;
        }
      });
    }

    // Bind Copy Button
    const copyBtn = container.querySelector('#btnOcrCopyAll');
    if (copyBtn) {
      copyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const textToCopy = ocrViewMode === 'formatted' ? formattedText : rawText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = '✓ Copied!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '📋 Copy';
          }, 2000);
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = textToCopy;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = '✓ Copied!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '📋 Copy';
          }, 2000);
        });
      });
    }

    // Bind Export .TXT Button
    const exportBtn = container.querySelector('#btnOcrExportTxt');
    if (exportBtn) {
      exportBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.homePageComponent && typeof window.homePageComponent.exportOcrTxt === 'function') {
          window.homePageComponent.exportOcrTxt();
        } else {
          const textToExport = ocrViewMode === 'formatted' ? formattedText : rawText;
          const blob = new Blob(['\uFEFF' + textToExport], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = docName.replace(/\.pdf$/i, '') + '_OCR_Text.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    }

    // Bind Clean & Align Button
    const cleanBtn = container.querySelector('#btnOcrFormatClean');
    if (cleanBtn) {
      cleanBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const curText = getRawOcrText() || rawText || formattedText;
        const cleaned = cleanAndAlignOcrText(curText);

        if (window.homePageComponent) {
          window.homePageComponent.ocrExtractedText = cleaned;
        }
        const origTextarea = tabRaw.querySelector('.ocr-textarea');
        if (origTextarea) {
          origTextarea.value = cleaned;
          origTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        cleanBtn.innerHTML = '✓ Cleaned & Aligned!';
        setTimeout(() => {
          cleanBtn.innerHTML = '✨ Clean & Align';
        }, 1800);
        enhanceRawOcrTab(true);
      });
    }

    // Bind Update Form Button
    const updateBtn = container.querySelector('#btnOcrUpdateForm');
    if (updateBtn) {
      updateBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const curText = getRawOcrText() || rawText;
        const parsed = parseFullApInvoiceUniversal(curText);
        if (parsed) {
          window.currentInvoiceData = parsed;
          currentData = parsed;
          if (window.homePageComponent) {
            if (window.homePageComponent.ngZone) {
              window.homePageComponent.ngZone.run(() => {
                window.homePageComponent.extractedInvoiceJson = parsed;
                window.homePageComponent.extractedApInvoice = parsed;
                window.homePageComponent.currentApInvoice = parsed;
                if (window.homePageComponent.pages && window.homePageComponent.pages[window.homePageComponent.activePageIndex]) {
                  window.homePageComponent.pages[window.homePageComponent.activePageIndex].extractedInvoice = parsed;
                }
                if (window.homePageComponent.cdr) {
                  window.homePageComponent.cdr.detectChanges();
                }
              });
            } else {
              window.homePageComponent.extractedInvoiceJson = parsed;
              window.homePageComponent.extractedApInvoice = parsed;
              window.homePageComponent.currentApInvoice = parsed;
            }
          }
          window.dispatchEvent(new CustomEvent('fieldbiInvoiceExtracted', { detail: parsed }));
          syncParsedDataToInputs(parsed);
          renderAllEnhancedSections(true);
        } else if (window.homePageComponent && typeof window.homePageComponent.reParseOcrTextToJson === 'function') {
          window.homePageComponent.reParseOcrTextToJson();
        }
        updateBtn.innerHTML = '✓ Form Updated!';
        setTimeout(() => {
          updateBtn.innerHTML = '⚡ Update Form';
        }, 2000);
      });
    }
  }

  function syncParsedDataToInputs(data) {
    if (!data) return;
    const formContainer = document.querySelector('.invoice-tab-content.tab-form, .cs-panel-invoice-sidebar .sidebar-body');
    if (!formContainer) return;

    const fieldMap = {
      'vendor name': data.vendorName || (data.vendor && data.vendor.name),
      'vendor phone': data.vendorPhone || (data.vendor && data.vendor.phone),
      'tax': data.vendorTaxId || (data.vendor && data.vendor.taxId) || data.customerTaxId,
      'vendor address': data.vendorAddress || (data.vendor && data.vendor.address),
      'invoice / doc no': data.invoiceNumber,
      'po number': data.poNumber || data.bookingReference,
      'invoice date': data.invoiceDate,
      'due date': data.dueDate,
      'payment terms': data.paymentTerms,
      'currency': data.currency,
      'billed to': data.billedTo || (data.billTo && data.billTo.name),
      'billing / delivery address': data.billingAddress || data.billedAddress || (data.billTo && data.billTo.address),
      'notes / remarks': data.notes
    };

    const formGroups = formContainer.querySelectorAll('.form-group');
    formGroups.forEach(fg => {
      const label = fg.querySelector('label');
      const input = fg.querySelector('input, select, textarea');
      if (!label || !input) return;
      const lText = label.textContent.toLowerCase().trim();
      for (const [keyPattern, val] of Object.entries(fieldMap)) {
        if (lText.includes(keyPattern) && val != null && String(val).trim() !== '') {
          if (input.value !== String(val).trim()) {
            input.value = String(val).trim();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }
      }
    });

    const totalsGrid = formContainer.querySelector('.invoice-totals-grid');
    if (totalsGrid) {
      const rows = totalsGrid.querySelectorAll('.total-row');
      rows.forEach(r => {
        const label = r.querySelector('.total-label');
        const input = r.querySelector('input');
        if (!label || !input) return;
        const lt = label.textContent.toLowerCase();
        if (lt.includes('subtotal') || lt.includes('net')) {
          if (data.subtotal) {
            input.value = Number(data.subtotal).toFixed(2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else if (lt.includes('tax') || lt.includes('vat')) {
          if (data.taxAmount) {
            input.value = Number(data.taxAmount).toFixed(2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else if (lt.includes('grand total') || lt.includes('total due') || (lt.includes('total') && !lt.includes('sub'))) {
          if (data.grandTotal) {
            input.value = Number(data.grandTotal).toFixed(2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
    }
  }

  function hookAngularHomePage() {
    if (!window.homePageComponent) return;
    if (window.homePageComponent._isUniversalHooked) return;
    window.homePageComponent._isUniversalHooked = true;

    const origParse = window.homePageComponent.parseFullApInvoice;
    window.homePageComponent.parseFullApInvoice = function(text) {
      const res = parseFullApInvoiceUniversal(text);
      if (res && res.items && res.items.length > 0) {
        return res;
      }
      if (origParse) {
        try {
          const origRes = origParse.call(this, text);
          if (origRes && origRes.items && origRes.items.length > 0) return origRes;
        } catch(e) {}
      }
      return res || (origParse ? origParse.call(this, text) : null);
    };

    window.homePageComponent.parseApInvoiceText = window.homePageComponent.parseFullApInvoice;
    window.homePageComponent.parseRawTextToApInvoiceJson = window.homePageComponent.parseFullApInvoice;
  }

  setInterval(hookAngularHomePage, 800);
  hookAngularHomePage();

  // Also bind tab click listener to switch to Raw OCR seamlessly
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (btn && btn.textContent && /raw\s*ocr/i.test(btn.textContent)) {
      setTimeout(function() {
        enhanceRawOcrTab(true);
      }, 60);
    }
  });

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
