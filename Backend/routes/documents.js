const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Document = require('../models/Document');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/documents');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/x-zip-compressed',
      'application/zip',
      'application/octet-stream',
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/x-png'
    ];

    if (allowedExtensions.includes(ext) || allowedMimeTypes.includes((file.mimetype || '').toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG are allowed.'));
  }
});

// Auto-sync helper to ensure User profile documents are reflected in Document collection
const syncUserDocuments = async (userId) => {
  try {
    const docFieldMap = {
      aadharCard:  { title: 'Aadhar Card',           category: 'Aadhar Card' },
      panCard:     { title: 'PAN Card',               category: 'PAN Card' },
      markSheet10: { title: '10th Marksheet',         category: 'Marksheet' },
      markSheet12: { title: '12th Marksheet',         category: 'Marksheet' },
      graduation:  { title: 'Graduation Certificate', category: 'Degree Certificate' },
      otherDocs:   { title: 'Other Document',         category: 'Other' },
    };

    const emp = await User.findById(userId);
    if (!emp) return;

    for (const [field, meta] of Object.entries(docFieldMap)) {
      const filePath = emp[field];
      if (!filePath) continue;

      const normalizedPath = filePath.replace(/\\/g, '/');
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(__dirname, '..', filePath);

      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      };
      let filesize = 0;
      try { filesize = fs.statSync(absPath).size; } catch (_) {}

      await Document.findOneAndUpdate(
        {
          $or: [
            { uploadedBy: emp._id, filepath: normalizedPath },
            { user: emp._id, filepath: normalizedPath },
            { user: emp._id, title: meta.title },
            { uploadedBy: emp._id, title: meta.title }
          ]
        },
        {
          $setOnInsert: {
            title: meta.title,
            category: meta.category,
            filename: path.basename(normalizedPath),
            filepath: normalizedPath,
            filesize,
            mimetype: mimeMap[ext] || 'application/octet-stream',
            uploadedBy: emp._id,
            user: emp._id,
            status: 'approved'
          }
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Error auto-syncing user documents:', err);
  }
};

// Get all documents
router.get('/', auth, checkPermission('documents', 'read'), async (req, res) => {
  try {
    const documents = await Document.find()
      .populate('uploadedBy', 'firstName lastName email')
      .populate('user', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// Get my documents (for employees)
router.get('/my-documents', auth, checkPermission(['my-documents', 'documents'], 'read'), async (req, res) => {
  try {
    // Auto-sync profile docs if any are registered on the user record
    await syncUserDocuments(req.user._id);

    const documents = await Document.find({ $or: [{ uploadedBy: req.user._id }, { user: req.user._id }] })
      .populate('uploadedBy', 'firstName lastName email')
      .populate('user', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    console.error('Error fetching my-documents:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// Upload document
router.post('/', auth, checkPermission(['my-documents', 'documents'], ['create', 'read']), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const normalizedPath = req.file.path.replace(/\\/g, '/');

    const document = await Document.create({
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      category: req.body.category || 'Other',
      subCategory: req.body.subCategory || '',
      filename: req.file.originalname,
      filepath: normalizedPath,
      filesize: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user._id,
      user: req.user._id,
      status: 'pending'
    });

    await document.populate('uploadedBy', 'firstName lastName email');
    await document.populate('user', 'firstName lastName email');
    res.status(201).json(document);
  } catch (error) {
    // Delete uploaded file if database save fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
});

// Update document status (approve/reject)
router.put('/:id/status', auth, checkPermission('documents', 'update'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    const updateData = {
      status,
      approvedBy: req.user._id,
      approvedAt: new Date()
    };
    
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('uploadedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document status' });
  }
});

// Sync employee documents — creates Document records for existing employee file uploads
router.post('/sync-employee-docs', auth, checkPermission('documents', 'read'), async (req, res) => {
  try {
    const docFieldMap = {
      aadharCard:  { title: 'Aadhar Card',           category: 'Aadhar Card' },
      panCard:     { title: 'PAN Card',               category: 'PAN Card' },
      markSheet10: { title: '10th Marksheet',         category: 'Marksheet' },
      markSheet12: { title: '12th Marksheet',         category: 'Marksheet' },
      graduation:  { title: 'Graduation Certificate', category: 'Degree Certificate' },
      otherDocs:   { title: 'Other Document',         category: 'Other' },
    };

    // Step 1: Normalize ALL existing filepaths — backslash → forward slash
    await Document.updateMany(
      { filepath: /\\/ },
      [{ $set: { filepath: { $replaceAll: { input: '$filepath', find: '\\', replacement: '/' } } } }]
    );

    // Step 2: Deduplicate by (uploadedBy + normalized filepath)
    const dupByPath = await Document.aggregate([
      { $sort: { createdAt: 1 } },
      { $group: { _id: { uploadedBy: '$uploadedBy', filepath: '$filepath' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    for (const d of dupByPath) {
      await Document.deleteMany({ _id: { $in: d.ids.slice(1) } });
    }

    // Step 3: Also deduplicate by (uploadedBy + title) — catches same doc saved with different path variants
    const dupByTitle = await Document.aggregate([
      { $sort: { createdAt: 1 } },
      { $group: { _id: { uploadedBy: '$uploadedBy', title: '$title' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    for (const d of dupByTitle) {
      await Document.deleteMany({ _id: { $in: d.ids.slice(1) } });
    }

    const employees = await User.find(
      { $or: Object.keys(docFieldMap).map(f => ({ [f]: { $nin: ['', null] } })) },
      ['_id', ...Object.keys(docFieldMap)].join(' ')
    );

    let created = 0;
    for (const emp of employees) {
      for (const [field, meta] of Object.entries(docFieldMap)) {
        const filePath = emp[field];
        if (!filePath) continue;

        // Normalize path separators so Windows backslashes don't cause mismatches
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Resolve absolute path for file size
        const absPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(__dirname, '..', filePath);

        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
        let filesize = 0;
        try { filesize = fs.statSync(absPath).size; } catch (_) {}

        // Atomic upsert keyed on (uploadedBy, filepath) — safe against concurrent calls
        const result = await Document.findOneAndUpdate(
          { uploadedBy: emp._id, filepath: normalizedPath },
          {
            $setOnInsert: {
              title: meta.title,
              category: meta.category,
              filename: path.basename(normalizedPath),
              filepath: normalizedPath,
              filesize,
              mimetype: mimeMap[ext] || 'application/octet-stream',
              uploadedBy: emp._id,
              status: 'pending',
            }
          },
          { upsert: true, new: false }
        );
        if (!result) created++;
      }
    }

    res.json({ message: `Sync complete. ${created} document(s) added.`, created });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Error syncing employee documents' });
  }
});

// Helper to safely resolve document file paths across various formats and upload directories
const resolveDocumentPath = (filePath) => {
  if (!filePath) return null;

  // 1. Direct path check (if absolute and exists)
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  // 2. Normalize slashes
  const cleanPath = filePath.replace(/\\/g, '/');

  // 3. Direct check with clean path if absolute
  if (path.isAbsolute(cleanPath) && fs.existsSync(cleanPath)) {
    return cleanPath;
  }

  // 4. Check relative to backend root directory (__dirname/..)
  const candidate1 = path.resolve(__dirname, '..', cleanPath);
  if (fs.existsSync(candidate1)) return candidate1;

  // 5. Try stripping leading slashes
  const candidate2 = path.resolve(__dirname, '..', cleanPath.replace(/^\/+/, ''));
  if (fs.existsSync(candidate2)) return candidate2;

  // 6. Try basename in uploads/documents
  const baseName = path.basename(cleanPath);
  const candidate3 = path.resolve(__dirname, '..', 'uploads', 'documents', baseName);
  if (fs.existsSync(candidate3)) return candidate3;

  // 7. Try basename in uploads/employees
  const candidate4 = path.resolve(__dirname, '..', 'uploads', 'employees', baseName);
  if (fs.existsSync(candidate4)) return candidate4;

  // 8. Try basename in uploads
  const candidate5 = path.resolve(__dirname, '..', 'uploads', baseName);
  if (fs.existsSync(candidate5)) return candidate5;

  return null;
};

// Preview document (inline, for browser rendering — PDF/image)
router.get('/:id/preview', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Permission check — Admin always allowed; or owner (uploadedBy / user) or documents/my-documents read permission
    const isAdmin = req.user.role && (req.user.role.name === 'Admin' || req.user.role === 'Admin');
    const isOwner = (document.uploadedBy && document.uploadedBy.toString() === req.user._id.toString()) ||
                    (document.user && document.user.toString() === req.user._id.toString());
    const hasPermission = req.user.role?.permissions?.some(
      p => (p.module === 'documents' || p.module === 'my-documents') && p.actions.includes('read')
    );

    if (!isAdmin && !isOwner && !hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to view this document' });
    }

    const absFilePath = resolveDocumentPath(document.filepath);
    if (!absFilePath) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const stat = fs.statSync(absFilePath);
    const mimeType = document.mimetype || 'application/octet-stream';
    const downloadFilename = document.filename || path.basename(absFilePath);

    // Set headers so the browser renders inline instead of downloading
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    fs.createReadStream(absFilePath).pipe(res);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ message: 'Error previewing document' });
  }
});

// Download document
router.get('/:id/download', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user has permission to download
    // Admin always allowed; or owner (uploadedBy / user) or documents/my-documents read permission
    const isAdmin = req.user.role && (req.user.role.name === 'Admin' || req.user.role === 'Admin');
    const isOwner = (document.uploadedBy && document.uploadedBy.toString() === req.user._id.toString()) ||
                    (document.user && document.user.toString() === req.user._id.toString());
    const hasDocumentsPermission = req.user.role?.permissions?.some(
      p => (p.module === 'documents' || p.module === 'my-documents') && p.actions.includes('read')
    );
    
    if (!isAdmin && !isOwner && !hasDocumentsPermission) {
      return res.status(403).json({ message: 'You do not have permission to download this document' });
    }
    
    const absFilePath = resolveDocumentPath(document.filepath);
    if (!absFilePath) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const downloadFilename = document.filename || path.basename(absFilePath);
    res.download(absFilePath, downloadFilename);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Error downloading document' });
  }
});

// Update own document (for employees) - with optional file re-upload/replacement
router.put('/my-documents/:id', auth, checkPermission(['my-documents', 'documents'], ['update', 'create', 'read']), upload.single('document'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Verify ownership or Admin
    const isAdmin = req.user.role && (req.user.role.name === 'Admin' || req.user.role === 'Admin');
    const isOwner = (document.uploadedBy && document.uploadedBy.toString() === req.user._id.toString()) ||
                    (document.user && document.user.toString() === req.user._id.toString());
    if (!isAdmin && !isOwner) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Not authorized to edit this document' });
    }
    
    // Only allow editing if document is pending or rejected
    if (document.status === 'approved' && !isAdmin) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Cannot edit approved documents' });
    }
    
    const { title, description, category, subCategory } = req.body;
    
    document.title = title || document.title;
    document.description = description !== undefined ? description : document.description;
    document.category = category || document.category;
    if (subCategory !== undefined) document.subCategory = subCategory;

    // If new file was uploaded, safely replace the old file and reset status to pending
    if (req.file) {
      const oldFilePath = resolveDocumentPath(document.filepath);
      if (oldFilePath && fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (e) {
          console.warn('Could not remove old document file:', e.message);
        }
      }

      const normalizedPath = req.file.path.replace(/\\/g, '/');
      document.filename = req.file.originalname;
      document.filepath = normalizedPath;
      document.filesize = req.file.size;
      document.mimetype = req.file.mimetype;

      // Reset status to pending for review and clear any previous rejection note
      document.status = 'pending';
      document.rejectionReason = '';
      document.approvedBy = undefined;
      document.approvedAt = undefined;
    }
    
    await document.save();
    await document.populate('uploadedBy', 'firstName lastName email');
    await document.populate('user', 'firstName lastName email');
    
    res.json(document);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Update error:', error);
    res.status(500).json({ message: 'Error updating document', error: error.message });
  }
});

// Delete own document (for employees) - MUST come before /:id routes
router.delete('/my-documents/:id', auth, checkPermission(['my-documents', 'documents'], ['delete', 'create', 'read']), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Verify ownership
    const isOwner = (document.uploadedBy && document.uploadedBy.toString() === req.user._id.toString()) ||
                    (document.user && document.user.toString() === req.user._id.toString());
    if (!isOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }
    
    // Only allow deleting if document is pending or rejected
    if (document.status === 'approved') {
      return res.status(400).json({ message: 'Cannot delete approved documents' });
    }
    
    // Delete file from filesystem
    const absFilePath = resolveDocumentPath(document.filepath);
    if (absFilePath && fs.existsSync(absFilePath)) {
      try {
        fs.unlinkSync(absFilePath);
      } catch (e) {
        console.warn('Could not remove file on delete:', e.message);
      }
    }
    
    // Delete document from database
    await Document.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
});

// Delete document (for HR/Admin)
router.delete('/:id', auth, checkPermission('documents', 'delete'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Delete file from filesystem
    const absFilePath = resolveDocumentPath(document.filepath);
    if (absFilePath && fs.existsSync(absFilePath)) {
      try {
        fs.unlinkSync(absFilePath);
      } catch (e) {
        console.warn('Could not remove file on delete:', e.message);
      }
    }
    
    // Delete document from database
    await Document.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document' });
  }
});

// Upload document for any employee (HR/Manager only)
router.post('/upload-for-employee', auth, upload.single('document'), async (req, res) => {
  try {
    // Check if user is HR, Manager, or HR Manager
    const user = await User.findById(req.user._id).populate('role');
    const isAuthorized = ['Admin', 'HR', 'Manager', 'HR Manager'].includes(user.role.name);
    
    if (!isAuthorized) {
      // Clean up uploaded file if not authorized
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: 'Only HR, Manager, and Admin can upload documents for employees' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { employeeId, title, description, category, subCategory } = req.body;

    if (!employeeId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    // Verify the employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Employee not found' });
    }

    const document = await Document.create({
      title: title || req.file.originalname,
      description: description || `Uploaded by ${user.firstName} ${user.lastName} (${user.role.name})`,
      category: category || 'Other',
      subCategory: subCategory || '',
      filename: req.file.originalname,
      filepath: req.file.path,
      filesize: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user._id, // Admin / HR / Manager who performed the upload
      user: employeeId,         // The employee for whom the document was uploaded
      status: 'approved'        // Auto-approve since HR/Manager is uploading
    });

    await document.populate('uploadedBy', 'firstName lastName email');
    await document.populate('user', 'firstName lastName email');
    res.status(201).json(document);
  } catch (error) {
    // Delete uploaded file if database save fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload for employee error:', error);
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
});

module.exports = router;
