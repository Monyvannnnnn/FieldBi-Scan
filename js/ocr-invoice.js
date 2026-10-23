/**
 * ocr-invoice.js - Tesseract.js OCR (Khmer + English) & AP Invoice Parsing
 */
class OCRInvoiceEngine {
  constructor() {
    this.worker = null;
    this.isProcessing = false;
  }

  async runTesseractOCR(imageUrl, onProgress = () => {}) {
    this.isProcessing = true;
    try {
      const worker = await Tesseract.createWorker('eng+khm', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(imageUrl);
      await worker.terminate();
      this.isProcessing = false;
      return text;
    } catch (err) {
      console.error('Tesseract OCR failed:', err);
      this.isProcessing = false;
      throw err;
    }
  }

  /**
   * Client-side pattern parsing from raw OCR text into structured AP Invoice JSON
   */
  parseInvoiceText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let invoiceNumber = '';
    let invoiceDate = new Date().toISOString().split('T')[0];
    let grandTotal = 0;
    let vendorName = lines.length > 0 ? lines[0] : 'Vendor';

    // Regex matchers
    const invNumMatch = text.match(/(?:invoice|inv|bill)[\s#:]*([A-Za-z0-9-_]+)/i);
    if (invNumMatch) invoiceNumber = invNumMatch[1];

    const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/);
    if (dateMatch) invoiceDate = dateMatch[1];

    const totalMatch = text.match(/(?:total|grand total|amount due)[\s:$]*([0-9,.]+)/i);
    if (totalMatch) {
      grandTotal = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
    }

    return {
      documentType: 'AP_INVOICE',
      currency: 'USD',
      invoiceNumber: invoiceNumber || 'INV-' + Date.now().toString().slice(-6),
      invoiceDate: invoiceDate,
      dueDate: invoiceDate,
      vendor: { name: vendorName },
      billTo: { name: 'Customer' },
      items: [
        { itemNo: 1, description: 'Line Item 1', quantity: 1, unitPrice: grandTotal, total: grandTotal }
      ],
      subtotal: grandTotal,
      taxRate: 0,
      taxAmount: 0,
      grandTotal: grandTotal,
      rawOcrText: text
    };
  }
}
