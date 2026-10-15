const express = require('express');
const router = express.Router();
const DocumentTemplate = require('../models/DocumentTemplate');
const ProposalTemplate = require('../models/ProposalTemplate');
const GeneratedDocument = require('../models/GeneratedDocument');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/documents/generated');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// ============= TEMPLATE MANAGEMENT =============

// Get all templates
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = await DocumentTemplate.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single template
router.get('/templates/:id', auth, async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id)
      .populate('createdBy', 'name');
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create template
router.post('/templates', auth, checkPermission(['documents', 'letters'], 'create'), async (req, res) => {
  try {
    const template = new DocumentTemplate({
      ...req.body,
      createdBy: req.user.id
    });
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update template
router.put('/templates/:id', auth, checkPermission(['documents', 'letters'], 'update'), async (req, res) => {
  try {
    const template = await DocumentTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete template
router.delete('/templates/:id', auth, checkPermission(['documents', 'letters'], 'delete'), async (req, res) => {
  try {
    const template = await DocumentTemplate.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============= DOCUMENT GENERATION =============

// Get all generated documents
router.get('/', auth, async (req, res) => {
  try {
    const documents = await GeneratedDocument.find()
      .populate('template', 'name type')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single document
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await GeneratedDocument.findById(req.params.id)
      .populate('template')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Find template from DocumentTemplate or ProposalTemplate
async function findTemplate(id) {
  let template = await DocumentTemplate.findById(id).catch(() => null);
  if (template) return { template, htmlContent: template.htmlContent || '' };
  template = await ProposalTemplate.findById(id).catch(() => null);
  if (template) {
    let htmlContent = template.content || '';
    // If content is empty but a file was uploaded, try reading the file
    if (!htmlContent && template.filePath) {
      const ext = (template.fileType || '').toLowerCase();
      if (ext === 'html' || ext === 'htm' || ext === 'txt' || ext === 'text') {
        try { htmlContent = await fs.readFile(template.filePath, 'utf8'); } catch (e) { }
      }
    }
    return { template, htmlContent };
  }
  return null;
}

// Replace placeholders in HTML
function replacePlaceholders(html, data) {
  let processedHtml = html;

  // Replace all {{placeholder}} with actual data
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedHtml = processedHtml.replace(regex, value || '');
  }

  // Add current date if not provided
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  processedHtml = processedHtml.replace(/{{current_date}}/g, currentDate);

  return processedHtml;
}

// Get raw template HTML content (placeholders intact, used by frontend live preview)
router.get('/template-content/:id', auth, async (req, res) => {
  try {
    const result = await findTemplate(req.params.id);
    if (!result) return res.status(404).json({ message: 'Template not found' });
    res.json({ html: result.htmlContent || '' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate document HTML (preview)
router.post('/preview', auth, async (req, res) => {
  try {
    const { templateId, placeholderData } = req.body;

    const result = await findTemplate(templateId);
    if (!result) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const finalHtml = replacePlaceholders(result.htmlContent || '', placeholderData);

    res.json({ html: finalHtml });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const fsSync = require('fs');

function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      if (fsSync.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
      }
    } catch { }
  }

  const potentialPaths = [
    // Windows Chrome & Edge paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : null,
    // Linux paths
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/root/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome',
    '/home/www/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome',
    '/opt/google/chrome/chrome',
    '/opt/google/chrome/google-chrome'
  ].filter(Boolean);

  for (const p of potentialPaths) {
    try {
      if (fsSync.existsSync(p)) return p;
    } catch { }
  }

  // Default for Linux production
  if (process.platform === 'linux') {
    return '/usr/bin/google-chrome';
  }

  return undefined;
}

// Generate PDF from HTML
async function generatePDF(html, fileName) {
  let browser;
  try {
    const execPath = getChromeExecutablePath();
    browser = await puppeteer.launch({
      ...(execPath ? { executablePath: execPath } : {}),
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 60000
    });

    const page = await browser.newPage();
    
    // Set page timeout
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 60000
    });

    // Small delay for web fonts and layout settling
    await new Promise(resolve => setTimeout(resolve, 500));

    await fs.mkdir(uploadsDir, { recursive: true });
    const pdfPath = path.join(uploadsDir, fileName);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    await browser.close();
    return pdfPath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

// Create and generate document
router.post('/generate', auth, checkPermission(['documents', 'letters'], 'create'), async (req, res) => {
  try {
    const { templateId, placeholderData, content, title, employeeId, metadata } = req.body;

    let finalHtml;
    let templateName = 'Custom Document';
    let templateRef = null;

    // Handle two cases: template-based or direct HTML content
    if (templateId) {
      // Template-based generation
      const result = await findTemplate(templateId);
      if (!result) {
        return res.status(404).json({ message: 'Template not found' });
      }
      const { template, htmlContent } = result;
      finalHtml = replacePlaceholders(htmlContent || '', placeholderData || {});
      templateName = template.name;
      templateRef = templateId;
    } else if (content) {
      // Direct HTML content generation (for custom letters)
      finalHtml = content;
      templateName = metadata?.templateName || 'Custom Document';
    } else {
      return res.status(400).json({ message: 'Either templateId or content must be provided' });
    }

    // Create document record
    const document = new GeneratedDocument({
      template: templateRef,
      employee: employeeId,
      title: title || templateName,
      placeholderData: placeholderData ? new Map(Object.entries(placeholderData)) : new Map(),
      finalHtml,
      generatedBy: req.user.id,
      metadata: { ...(metadata || {}), templateName }
    });

    await document.save();

    // Generate PDF
    const pdfFileName = `${document.documentNumber}.pdf`;
    const pdfPath = await generatePDF(finalHtml, pdfFileName);

    // Update document with PDF path
    document.pdfPath = pdfPath;
    document.pdfUrl = `/uploads/documents/generated/${pdfFileName}`;
    document.status = 'generated';
    await document.save();

    const populatedDoc = await GeneratedDocument.findById(document._id)
      .populate('template', 'name type')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName');

    res.status(201).json(populatedDoc);
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload and register an already generated document (e.g. DOCX)
router.post('/upload-generated-docx', auth, checkPermission(['documents', 'letters'], 'create'), async (req, res) => {
  try {
    const { title, employeeId, base64Data, metadata } = req.body;
    
    // Create document record
    const document = new GeneratedDocument({
      template: null,
      employee: employeeId || null,
      title: title || 'Generated Document',
      placeholderData: new Map(),
      finalHtml: '<html><body>Document generated in DOCX format.</body></html>',
      generatedBy: req.user.id,
      metadata: metadata || {}
    });

    await document.save();

    // Decode base64 and save to file
    const docxFileName = `${document.documentNumber}.docx`;
    const docxPath = path.join(uploadsDir, docxFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(docxPath, buffer);

    // Update document with docx path
    document.pdfPath = docxPath;
    document.pdfUrl = `/uploads/documents/generated/${docxFileName}`;
    document.status = 'generated';
    await document.save();

    const populatedDoc = await GeneratedDocument.findById(document._id)
      .populate('template', 'name type')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName');

    res.status(201).json(populatedDoc);
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Preview PDF (return PDF as base64 or stream for frontend preview)
router.get('/:id/preview', auth, async (req, res) => {
  try {
    const document = await GeneratedDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if PDF exists
    if (document.pdfPath && fsSync.existsSync(document.pdfPath)) {
      const pdfBuffer = await fs.readFile(document.pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      return res.send(pdfBuffer);
    }

    // Check alternative path
    if (document.pdfUrl) {
      const altPath = path.join(__dirname, '..', document.pdfUrl);
      if (fsSync.existsSync(altPath)) {
        const pdfBuffer = await fs.readFile(altPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        return res.send(pdfBuffer);
      }
    }

    return res.status(404).json({ message: 'PDF file not found' });
  } catch (error) {
    console.error('Preview handler error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Download PDF
router.get('/:id/download', auth, async (req, res) => {
  try {
    const document = await GeneratedDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const safeFileName = `${document.documentNumber || document.title || 'letter'}.pdf`;

    // 1. If physical PDF exists at pdfPath, download it
    if (document.pdfPath && fsSync.existsSync(document.pdfPath)) {
      return res.download(document.pdfPath, safeFileName);
    }

    // 2. Check if pdfUrl maps to an existing file in uploadsDir
    if (document.pdfUrl) {
      const altPath = path.join(__dirname, '..', document.pdfUrl);
      if (fsSync.existsSync(altPath)) {
        return res.download(altPath, safeFileName);
      }
    }

    // 3. If file missing on disk but finalHtml exists, regenerate PDF on the fly
    if (document.finalHtml) {
      try {
        const pdfFileName = `${document.documentNumber || document._id}.pdf`;
        const pdfPath = await generatePDF(document.finalHtml, pdfFileName);
        document.pdfPath = pdfPath;
        document.pdfUrl = `/uploads/documents/generated/${pdfFileName}`;
        document.status = 'generated';
        await document.save();
        return res.download(pdfPath, safeFileName);
      } catch (pdfErr) {
        console.error('On-the-fly PDF generation error:', pdfErr);
      }
    }

    return res.status(404).json({ message: 'PDF file not available for this letter' });
  } catch (error) {
    console.error('Download handler error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update document (edit content)
router.put('/:id', auth, checkPermission(['documents', 'letters'], 'update'), async (req, res) => {
  try {
    const { finalHtml, title, placeholderData, metadata } = req.body;
    
    const document = await GeneratedDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Update document fields
    if (finalHtml) document.finalHtml = finalHtml;
    if (title) document.title = title;
    if (placeholderData) document.placeholderData = new Map(Object.entries(placeholderData));
    if (metadata) document.metadata = { ...document.metadata, ...metadata };

    // Regenerate PDF with updated content
    if (finalHtml) {
      const pdfFileName = `${document.documentNumber}.pdf`;
      
      // Delete old PDF file if it exists
      if (document.pdfPath) {
        try {
          const fs = require('fs');
          if (fs.existsSync(document.pdfPath)) {
            await fs.unlink(document.pdfPath);
          }
        } catch (err) {
          console.error('Error deleting old PDF:', err);
          // Continue execution even if old PDF deletion fails
        }
      }
      
      // Generate new PDF
      const pdfPath = await generatePDF(finalHtml, pdfFileName);
      document.pdfPath = pdfPath;
      document.pdfUrl = `/uploads/documents/generated/${pdfFileName}`;
    }

    await document.save();

    const populatedDoc = await GeneratedDocument.findById(document._id)
      .populate('template', 'name type')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName');

    res.json(populatedDoc);
  } catch (error) {
    console.error('Document update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update document status
router.patch('/:id/status', auth, checkPermission(['documents', 'letters'], 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    const document = await GeneratedDocument.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('template employee generatedBy');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete document
router.delete('/:id', auth, checkPermission(['documents', 'letters'], 'delete'), async (req, res) => {
  try {
    const document = await GeneratedDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete PDF file if exists
    if (document.pdfPath) {
      try {
        await fs.unlink(document.pdfPath);
      } catch (err) {
        console.error('Error deleting PDF:', err);
      }
    }

    await document.deleteOne();
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate Offer Letter by filling original PDF template
router.post('/generate-offer-letter', auth, checkPermission(['documents', 'letters'], 'create'), async (req, res) => {
  try {
    const {
      selectedEmployeeId,
      name,
      designation,
      department,
      dateOfJoining,
      employmentType,
      officeLocation,
      annualCTC,
      monthlySalary,
      monthlyTarget,
      workingDays,
      workingHours,
      officeTiming,
      observationPeriod,
      probationPeriod,
      noticePeriod,
      reportingManager,
      coreResponsibilities,
      performanceExpectations,
    } = req.body;

    console.log('=== GENERATING OFFER LETTER WITH PUPPETEER ===');
    console.log('Data:', { name, designation, department, dateOfJoining });

    try {
      delete require.cache[require.resolve('../utils/offerLetterTemplate')];
    } catch (e) {}
    const { generateOfferLetterHTML } = require('../utils/offerLetterTemplate');
    const finalHtml = generateOfferLetterHTML({
      name,
      designation,
      department,
      dateOfJoining,
      employmentType,
      officeLocation,
      annualCTC,
      monthlySalary,
      monthlyTarget,
      workingDays,
      workingHours,
      officeTiming,
      observationPeriod,
      probationPeriod,
      noticePeriod,
      reportingManager,
      coreResponsibilities,
      performanceExpectations,
    });

    const pdfFileName = `offer-letter-${Date.now()}.pdf`;
    const pdfPath = await generatePDF(finalHtml, pdfFileName);

    console.log('PDF generated with Puppeteer:', pdfPath);

    // Create document record
    const document = new GeneratedDocument({
      template: null,
      employee: selectedEmployeeId || null,
      title: `Offer Letter - ${name || 'Candidate'}`,
      placeholderData: new Map(Object.entries({
        name, designation, department, dateOfJoining, employmentType,
        officeLocation, annualCTC, monthlySalary, monthlyTarget,
        workingDays, workingHours, officeTiming, observationPeriod,
        probationPeriod, noticePeriod, reportingManager,
        coreResponsibilities, performanceExpectations,
      })),
      finalHtml: finalHtml,
      generatedBy: req.user.id,
      metadata: {
        templateName: 'Offer Letter BTPL10',
        candidateName: name,
        clientName: name,
        designation, department,
      }
    });

    await document.save();

    document.pdfPath = pdfPath;
    document.pdfUrl = `/uploads/documents/generated/${pdfFileName}`;
    document.status = 'generated';
    await document.save();

    const populatedDoc = await GeneratedDocument.findById(document._id)
      .populate('template', 'name type')
      .populate('employee', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName');

    console.log('=== COMPLETED ===');
    res.status(201).json(populatedDoc);
  } catch (error) {
    console.error('ERROR:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
