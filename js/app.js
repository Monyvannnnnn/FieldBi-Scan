/**
 * app.js - FieldBi Document Scanner Studio Controller
 */

class StudioApp {
  constructor() {
    this.pages = [];
    this.activePageIndex = 0;
    this.currentFilter = 'original';
    this.rotation = 0;
    this.straightenAngle = 0;
    this.p2p = null;
    this.ocr = new OCRInvoiceEngine();

    this.initElements();
    this.initEvents();
    this.initP2P();
    this.loadFromIndexedDB();
  }

  get activePage() {
    return this.pages[this.activePageIndex];
  }

  initElements() {
    this.canvas = document.getElementById('docCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.fileInput = document.getElementById('fileInput');
    this.pagesList = document.getElementById('pagesList');
    this.pageCountBadge = document.getElementById('pageCountBadge');
  }

  initEvents() {
    // Upload files
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Connect button
    document.getElementById('btnConnect').addEventListener('click', () => {
      const modal = new bootstrap.Modal(document.getElementById('qrModal'));
      modal.show();
    });

    // Rotate buttons
    document.getElementById('btnRotateLeft')?.addEventListener('click', () => this.rotate(-90));
    document.getElementById('btnRotateRight')?.addEventListener('click', () => this.rotate(90));

    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.currentTarget.getAttribute('data-filter');
        this.applyFilter(filter);
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // OCR Modal Trigger
    document.getElementById('btnRunOcr')?.addEventListener('click', () => this.runOCR(true));

    // Export PDF
    document.getElementById('btnExportPdf')?.addEventListener('click', () => {
      PDFExporter.exportPDF(this.pages);
    });

    // Export ZIP
    document.getElementById('btnExportZip')?.addEventListener('click', () => {
      PDFExporter.exportZip(this.pages);
    });

    // Save to PHP Backend
    document.getElementById('btnSavePhp')?.addEventListener('click', () => this.saveToBackend());
  }

  initP2P() {
    this.p2p = new P2PScanner({
      onStatusChanged: (status, info) => {
        const pillText = document.getElementById('connectionPillText');
        const pillDot = document.getElementById('connectionStatusDot');
        const modalStatus = document.getElementById('modalPeerStatus');

        if (status === 'connected') {
          pillText.innerText = 'Connected: ' + info;
          pillDot.className = 'status-dot connected';
          if (modalStatus) modalStatus.innerText = 'Connected to mobile device!';
        } else if (status === 'waiting') {
          pillText.innerText = 'Scan with Phone';
          pillDot.className = 'status-dot';
          document.getElementById('displayPeerId').innerText = info;
          if (modalStatus) modalStatus.innerText = 'Waiting for phone to scan...';
        }
      },
      onPageReceived: (dataUrl, fileName) => {
        this.addPage(dataUrl, fileName);
        this.showToast('✨ Page received from mobile phone!');
      }
    });

    this.p2p.initHost();
  }

  async handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const dataUrl = await this.readFileAsDataUrl(files[i]);
      this.addPage(dataUrl, files[i].name);
    }
    e.target.value = '';
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  addPage(dataUrl, fileName = 'Document.jpg') {
    const page = {
      id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      fileName: fileName,
      originalDataUrl: dataUrl,
      displayDataUrl: dataUrl,
      filter: 'original',
      rotation: 0
    };

    this.pages.push(page);
    this.activePageIndex = this.pages.length - 1;
    this.renderThumbnails();
    this.renderActivePage();
    this.saveToIndexedDB();

    // Auto-backup to PHP Backend uploads directory
    fetch('api/upload.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: dataUrl, fileName: fileName })
    }).catch(() => {});

    // Auto-run OCR after page is added (extract data without manual trigger)
    setTimeout(() => {
      if (this.activePageIndex === this.pages.length - 1) {
        this.runOCR(false).then((success) => {
          if (success) {
            this.showToast('✅ Data extracted and updated in the form!');
          } else {
            this.showToast('❌ OCR extraction failed.');
          }
        }).catch(() => {
          this.showToast('❌ OCR extraction failed.');
        });
      }
    }, 400);
  }

  selectPage(index) {
    if (index >= 0 && index < this.pages.length) {
      this.activePageIndex = index;
      this.renderThumbnails();
      this.renderActivePage();
    }
  }

  deletePage(index, e) {
    e.stopPropagation();
    this.pages.splice(index, 1);
    if (this.activePageIndex >= this.pages.length) {
      this.activePageIndex = Math.max(0, this.pages.length - 1);
    }
    this.renderThumbnails();
    this.renderActivePage();
    this.saveToIndexedDB();
  }

  renderThumbnails() {
    this.pageCountBadge.innerText = this.pages.length;
    this.pagesList.innerHTML = '';

    this.pages.forEach((page, idx) => {
      const col = document.createElement('div');
      col.className = 'mb-2';
      col.innerHTML = `
        <div class="thumb-card ${idx === this.activePageIndex ? 'active' : ''}" onclick="app.selectPage(${idx})">
          <img src="${page.displayDataUrl}" alt="Page ${idx + 1}" />
          <div class="d-flex justify-content-between p-2 align-items-center">
            <small class="text-muted">Page ${idx + 1}</small>
            <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="app.deletePage(${idx}, event)">×</button>
          </div>
        </div>
      `;
      this.pagesList.appendChild(col);
    });
  }

  renderActivePage() {
    if (!this.activePage) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      document.getElementById('emptyState').style.display = 'block';
      this.canvas.style.display = 'none';
      return;
    }

    document.getElementById('emptyState').style.display = 'none';
    this.canvas.style.display = 'block';

    const img = new Image();
    img.onload = () => {
      const rot = (this.activePage.rotation || 0) % 360;
      const is90 = Math.abs(rot) === 90 || Math.abs(rot) === 270;

      this.canvas.width = is90 ? img.height : img.width;
      this.canvas.height = is90 ? img.width : img.height;

      this.ctx.save();
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.rotate((rot * Math.PI) / 180);
      this.ctx.drawImage(img, -img.width / 2, -img.height / 2);
      this.ctx.restore();

      // Apply pixel filter
      this.applyPixelFilter(this.activePage.filter || 'original');
    };
    img.src = this.activePage.originalDataUrl;
  }

  rotate(deltaDeg) {
    if (!this.activePage) return;
    this.activePage.rotation = ((this.activePage.rotation || 0) + deltaDeg + 360) % 360;
    this.renderActivePage();
    this.saveToIndexedDB();
  }

  applyFilter(filterType) {
    if (!this.activePage) return;
    this.activePage.filter = filterType;
    this.renderActivePage();
    this.saveToIndexedDB();
  }

  applyPixelFilter(filterType) {
    if (filterType === 'original') return;

    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (filterType === 'magic') {
        if (lum > 155) {
          const boost = (lum - 155) / 100;
          d[i] = Math.min(255, r + (255 - r) * boost);
          d[i + 1] = Math.min(255, g + (255 - g) * boost);
          d[i + 2] = Math.min(255, b + (255 - b) * boost);
        } else {
          d[i] = Math.max(0, r * 0.88);
          d[i + 1] = Math.max(0, g * 0.88);
          d[i + 2] = Math.max(0, b * 0.88);
        }
      } else if (filterType === 'bw') {
        const val = lum > 138 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = val;
      } else if (filterType === 'enhance') {
        d[i] = Math.min(255, r * 1.15 + 10);
        d[i + 1] = Math.min(255, g * 1.15 + 10);
        d[i + 2] = Math.min(255, b * 1.15 + 10);
      } else if (filterType === 'lighten') {
        d[i] = Math.min(255, r * 1.25 + 20);
        d[i + 1] = Math.min(255, g * 1.25 + 20);
        d[i + 2] = Math.min(255, b * 1.25 + 20);
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
    this.activePage.displayDataUrl = this.canvas.toDataURL('image/jpeg', 0.92);
  }

  async runOCR(showModal = true) {
    if (!this.activePage) {
      alert('Please add or scan a page first');
      return false;
    }

    if (showModal) {
      const modal = new bootstrap.Modal(document.getElementById('ocrModal'));
      modal.show();
    }

    const progressEl = document.getElementById('ocrProgressBar');
    const statusEl = document.getElementById('ocrStatusText');
    progressEl.style.width = '10%';
    statusEl.innerText = 'Recognizing text...';

    try {
      const text = await this.ocr.runTesseractOCR(this.activePage.displayDataUrl, (pct) => {
        progressEl.style.width = `${pct}%`;
        statusEl.innerText = `Recognizing text (${pct}%)...`;
      });

      document.getElementById('rawOcrTextarea').value = text;
      const parsedInvoice = this.ocr.parseInvoiceText(text);
      document.getElementById('invoiceJsonDisplay').innerText = JSON.stringify(parsedInvoice, null, 2);

      // Populate form
      document.getElementById('formInvoiceNum').value = parsedInvoice.invoiceNumber;
      document.getElementById('formInvoiceDate').value = parsedInvoice.invoiceDate;
      document.getElementById('formVendorName').value = parsedInvoice.vendor.name;
      document.getElementById('formGrandTotal').value = parsedInvoice.grandTotal;

      statusEl.innerText = 'OCR extraction complete! Ready to save to PHP database.';
      return true;
    } catch (err) {
      statusEl.innerText = 'OCR Failed: ' + err.message;
      return false;
    }
  }

  selectPage(index) {
    if (index >= 0 && index < this.pages.length) {
      this.activePageIndex = index;
      this.renderThumbnails();
      this.renderActivePage();
    }
  }

  async saveToBackend() {
    if (!this.activePage) return;

    const invoiceData = {
      invoiceNumber: document.getElementById('formInvoiceNum')?.value || 'INV-' + Date.now(),
      invoiceDate: document.getElementById('formInvoiceDate')?.value || new Date().toISOString().split('T')[0],
      vendorName: document.getElementById('formVendorName')?.value || 'Vendor',
      grandTotal: parseFloat(document.getElementById('formGrandTotal')?.value) || 0,
      subtotal: parseFloat(document.getElementById('formGrandTotal')?.value) || 0,
      rawOcrText: document.getElementById('rawOcrTextarea')?.value || '',
      imageUrl: this.activePage.displayDataUrl
    };

    try {
      const res = await fetch('api/invoices.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      const json = await res.json();
      if (json.status === 'success') {
        this.showToast('✅ Invoice saved to PHP MySQL/SQLite Backend! (ID: ' + json.invoice_id + ')');
      } else {
        alert('Save error: ' + json.message);
      }
    } catch (e) {
      alert('Network error while saving to PHP: ' + e.message);
    }
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-dark position-fixed bottom-0 end-0 m-3 shadow-lg';
    toast.style.zIndex = '99999';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  saveToIndexedDB() {
    try {
      localStorage.setItem('fieldbi_web_pages', JSON.stringify(this.pages));
    } catch (e) {}
  }

  loadFromIndexedDB() {
    try {
      const saved = localStorage.getItem('fieldbi_web_pages');
      if (saved) {
        this.pages = JSON.parse(saved);
        if (this.pages.length > 0) {
          this.activePageIndex = 0;
          this.renderThumbnails();
          this.renderActivePage();
        }
      }
    } catch (e) {}
  }
}

// Global bootstrap initialization
window.addEventListener('DOMContentLoaded', () => {
  window.app = new StudioApp();
});
