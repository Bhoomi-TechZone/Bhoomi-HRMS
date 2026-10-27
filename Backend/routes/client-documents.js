const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const ClientDocument = require('../models/ClientDocument');
const Client = require('../models/Client');

// Configure multer for client document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/client-documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|webp|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');

    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP, ZIP.'));
  }
});

// GET all client documents
router.get('/', auth, async (req, res) => {
  try {
    const query = {};
    if (req.query.clientId) {
      query.client = req.query.clientId;
    }
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }

    const documents = await ClientDocument.find(query)
      .populate('client')
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    console.error('Fetch client documents error:', error);
    res.status(500).json({ message: 'Error fetching client documents', error: error.message });
  }
});

// POST upload client document(s) - supports single or multiple files
router.post('/', auth, (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);

  try {
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { clientId, category, title, description, metadata } = req.body;

    if (!clientId) {
      files.forEach(f => {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      });
      return res.status(400).json({ message: 'Client ID is required' });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      files.forEach(f => {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      });
      return res.status(404).json({ message: 'Client not found' });
    }

    let parsedMeta = [];
    if (metadata) {
      try {
        parsedMeta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (e) {
        parsedMeta = [];
      }
    }

    const validCategories = ['Aadhar Card', 'PAN Card', 'Agreement', 'Receipts', 'Other'];
    const createdDocs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemMeta = (Array.isArray(parsedMeta) && parsedMeta[i]) ? parsedMeta[i] : {};

      let docCategory = itemMeta.category || category || 'Other';
      if (!validCategories.includes(docCategory)) {
        docCategory = 'Other';
      }

      const defaultTitle = files.length === 1 && title
        ? title
        : (itemMeta.title || `${docCategory} - ${file.originalname}`);
      const docDescription = itemMeta.description !== undefined ? itemMeta.description : (description || '');

      const document = await ClientDocument.create({
        client: clientId,
        title: defaultTitle,
        category: docCategory,
        description: docDescription,
        filename: file.originalname,
        filepath: file.path,
        filesize: file.size,
        mimetype: file.mimetype,
        uploadedBy: req.user._id,
        status: 'approved'
      });

      await document.populate('client');
      await document.populate('uploadedBy', 'firstName lastName email');
      createdDocs.push(document);
    }

    if (createdDocs.length === 1) {
      const singleDocObj = createdDocs[0].toObject ? createdDocs[0].toObject() : createdDocs[0];
      return res.status(201).json({
        ...singleDocObj,
        documents: createdDocs,
        count: 1
      });
    }

    const firstDocObj = createdDocs[0].toObject ? createdDocs[0].toObject() : createdDocs[0];
    return res.status(201).json({
      success: true,
      message: `${createdDocs.length} client documents uploaded successfully`,
      count: createdDocs.length,
      documents: createdDocs,
      ...firstDocObj
    });
  } catch (error) {
    if (files && files.length > 0) {
      files.forEach(f => {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      });
    }
    console.error('Upload client document error:', error);
    res.status(500).json({ message: 'Error uploading client document', error: error.message });
  }
});

// Helper to safely resolve client document file paths across various formats
const resolveClientDocPath = (filePath) => {
  if (!filePath) return null;

  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  const cleanPath = filePath.replace(/\\/g, '/');
  if (path.isAbsolute(cleanPath) && fs.existsSync(cleanPath)) {
    return cleanPath;
  }

  const candidate1 = path.resolve(__dirname, '..', cleanPath);
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.resolve(__dirname, '..', cleanPath.replace(/^\/+/, ''));
  if (fs.existsSync(candidate2)) return candidate2;

  const baseName = path.basename(cleanPath);
  const candidate3 = path.resolve(__dirname, '..', 'uploads', 'client-documents', baseName);
  if (fs.existsSync(candidate3)) return candidate3;

  const candidate4 = path.resolve(__dirname, '..', 'uploads', baseName);
  if (fs.existsSync(candidate4)) return candidate4;

  return null;
};

// GET preview client document (inline stream)
router.get('/:id/preview', auth, async (req, res) => {
  try {
    const document = await ClientDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Client document not found' });
    }

    const absFilePath = resolveClientDocPath(document.filepath);
    if (!absFilePath) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const stat = fs.statSync(absFilePath);
    const mimeType = document.mimetype || 'application/octet-stream';
    const downloadFilename = document.filename || path.basename(absFilePath);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    fs.createReadStream(absFilePath).pipe(res);
  } catch (error) {
    console.error('Preview client document error:', error);
    res.status(500).json({ message: 'Error previewing client document' });
  }
});

// GET download client document
router.get('/:id/download', auth, async (req, res) => {
  try {
    const document = await ClientDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Client document not found' });
    }

    const absFilePath = resolveClientDocPath(document.filepath);
    if (!absFilePath) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const downloadFilename = document.filename || path.basename(absFilePath);
    res.download(absFilePath, downloadFilename);
  } catch (error) {
    console.error('Download client document error:', error);
    res.status(500).json({ message: 'Error downloading client document' });
  }
});

// DELETE client document
router.delete('/:id', auth, async (req, res) => {
  try {
    const document = await ClientDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Client document not found' });
    }

    const absFilePath = resolveClientDocPath(document.filepath);
    if (absFilePath && fs.existsSync(absFilePath)) {
      try {
        fs.unlinkSync(absFilePath);
      } catch (e) {
        console.warn('Could not remove file on delete:', e.message);
      }
    }

    await ClientDocument.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client document deleted successfully' });
  } catch (error) {
    console.error('Delete client document error:', error);
    res.status(500).json({ message: 'Error deleting client document' });
  }
});

module.exports = router;
