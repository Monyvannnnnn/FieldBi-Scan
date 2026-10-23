/**
 * pdf-export.js - Multi-Page PDF & ZIP Export via pdf-lib and JSZip
 */
class PDFExporter {
  static async exportPDF(pages, options = {}) {
    if (!pages || pages.length === 0) return;
    const { PDFDocument } = PDFLib;

    const pdfDoc = await PDFDocument.create();
    const pageSize = options.pageSize || 'a4'; // a4, letter, fit
    const orientation = options.orientation || 'portrait';

    for (const page of pages) {
      const imgBytes = await fetch(page.displayDataUrl).then(res => res.arrayBuffer());
      const embeddedImage = await pdfDoc.embedJpg(imgBytes);

      const imgW = embeddedImage.width;
      const imgH = embeddedImage.height;

      let pageW = imgW;
      let pageH = imgH;

      if (pageSize === 'a4') {
        const baseW = orientation === 'landscape' ? 841.89 : 595.28;
        pageW = baseW;
        pageH = (baseW * imgH) / imgW;
      } else if (pageSize === 'letter') {
        const baseW = orientation === 'landscape' ? 792 : 612;
        pageW = baseW;
        pageH = (baseW * imgH) / imgW;
      }

      const pdfPage = pdfDoc.addPage([pageW, pageH]);
      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageW,
        height: pageH,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Scanly_Document_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async exportZip(pages) {
    if (!pages || pages.length === 0) return;
    const zip = new JSZip();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const base64Data = page.displayDataUrl.split(',')[1];
      zip.file(`Page_${i + 1}.jpg`, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Scanned_Pages_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
