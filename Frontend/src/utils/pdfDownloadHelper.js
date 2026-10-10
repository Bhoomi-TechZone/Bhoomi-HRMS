import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renders an HTML string into an A4 PDF and downloads it directly.
 * @param {string} htmlContent - Full HTML document string
 * @param {string} fileName - Destination filename (e.g. 'Letter.pdf')
 */
export async function downloadHtmlAsPdf(htmlContent, fileName = 'letter.pdf') {
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error('No content available to generate PDF');
  }

  // Ensure fileName ends with .pdf
  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // Create an off-screen container iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '794px'; // Standard A4 at 96dpi (210mm)
  iframe.style.height = '1123px'; // Standard A4 at 96dpi (297mm)
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  iframe.style.zIndex = '-1000';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for document and all images to load
    await new Promise((resolve) => {
      if (iframeDoc.readyState === 'complete') {
        resolve();
      } else {
        iframe.contentWindow.addEventListener('load', () => resolve(), { once: true });
        setTimeout(resolve, 1500); // Fallback timeout
      }
    });

    const imgs = Array.from(iframeDoc.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 2000);
        });
      })
    );

    // Small delay to ensure styles and web fonts are applied
    await new Promise((r) => setTimeout(r, 400));

    // Check if the HTML contains multiple .page or .page-break elements
    let pageElements = Array.from(iframeDoc.querySelectorAll('.page, .letter-page, .pdf-page'));
    
    // If no explicit .page containers found, render body
    if (!pageElements.length) {
      pageElements = [iframeDoc.body];
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    for (let i = 0; i < pageElements.length; i++) {
      const el = pageElements[i];
      
      const canvas = await html2canvas(el, {
        scale: 2, // High resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Check if element is single page height or tall multi-page
      const elHeightMm = (canvas.height * pdfWidth) / canvas.width;
      
      if (pageElements.length === 1 && elHeightMm > pdfHeight + 10) {
        // Continuous tall document: split across pages
        let heightLeft = elHeightMm;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, elHeightMm, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 5) {
          position = position - pdfHeight;
          pdf.addPage('a4', 'portrait');
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, elHeightMm, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      } else {
        // Normal single page container
        const renderHeight = Math.min(elHeightMm, pdfHeight);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, renderHeight, undefined, 'FAST');
      }
    }

    // Directly download the file onto user's machine
    pdf.save(safeFileName);
  } finally {
    // Clean up iframe
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
