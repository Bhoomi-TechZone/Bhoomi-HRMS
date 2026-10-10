const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const LeadDocument = require('../models/LeadDocument');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Create uploads/lead-documents directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/lead-documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname).name;
    cb(null, `${originalName}-${timestamp}.pdf`);
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow PDF files
  if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all lead documents
router.get('/', auth, async (req, res) => {
  try {
    const documents = await LeadDocument.find()
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload lead document (HR only)
router.post('/upload', auth, checkPermission('leads', 'create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description } = req.body;

    if (!title) {
      // Delete uploaded file if title is missing
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
      return res.status(400).json({ message: 'Title is required' });
    }

    const leadDocument = new LeadDocument({
      title,
      fileName: req.file.originalname,
      filePath: req.file.filename,
      fileSize: req.file.size,
      description: description || '',
      uploadedBy: req.user.id
    });

    await leadDocument.save();

    const populatedDoc = await LeadDocument.findById(leadDocument._id)
      .populate('uploadedBy', 'firstName lastName email');

    res.status(201).json(populatedDoc);
  } catch (error) {
    // Delete file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download lead document
router.get('/download/:id', auth, async (req, res) => {
  try {
    const document = await LeadDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const filePath = path.join(uploadDir, document.filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      res.status(500).json({ message: 'Error downloading file' });
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete lead document (HR only)
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const document = await LeadDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(uploadDir, document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete document from database
    await LeadDocument.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
