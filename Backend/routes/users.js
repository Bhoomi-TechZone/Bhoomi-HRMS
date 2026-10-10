const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for QR code uploads
const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/qr-codes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use timestamp and random string for unique filename (req.user may not be available here)
    const uniqueName = `qr-${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const qrUpload = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('role');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// Update user profile
router.put('/me', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, department, designation, email } = req.body;

    const user = await User.findById(req.user._id);

    // If email is being changed, check if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.email = email;
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;
    user.department = department || user.department;
    user.designation = designation || user.designation;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password').populate('role');

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Employee: Update own bank details (sets status to pending for HR verification)
router.put('/my-bank-details', auth, async (req, res) => {
  try {
    const { bankName, accountNumber, ifscCode, accountHolderName, panNumber, upiId } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        bankName, 
        accountNumber, 
        ifscCode, 
        accountHolderName, 
        panNumber, 
        upiId,
        bankDetailsStatus: 'pending', // Reset to pending when employee updates
        bankDetailsVerifiedBy: null,
        bankDetailsVerifiedAt: null,
        bankDetailsRejectionReason: ''
      },
      { new: true, runValidators: true }
    ).select('-password').populate('role');

    res.json({ message: 'Bank details submitted for verification', user });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ message: 'Error updating bank details' });
  }
});

// Employee: Upload payment QR code
router.post('/upload-qr-code', auth, qrUpload.single('qrCode'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Delete old QR code if exists
    const oldUser = await User.findById(req.user._id);
    if (oldUser.paymentQRCode) {
      const oldPath = oldUser.paymentQRCode;
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        paymentQRCode: req.file.path,
        bankDetailsStatus: 'pending', // Reset to pending when QR is updated
        bankDetailsVerifiedBy: null,
        bankDetailsVerifiedAt: null,
        bankDetailsRejectionReason: ''
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'QR code uploaded successfully', qrCodePath: req.file.path, user });
  } catch (error) {
    console.error('Error uploading QR code:', error);
    res.status(500).json({ message: 'Error uploading QR code' });
  }
});

// Employee: Delete payment QR code
router.delete('/delete-qr-code', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user.paymentQRCode && fs.existsSync(user.paymentQRCode)) {
      fs.unlinkSync(user.paymentQRCode);
    }

    await User.findByIdAndUpdate(req.user._id, { paymentQRCode: '' });

    res.json({ message: 'QR code deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({ message: 'Error deleting QR code' });
  }
});

// Get employee's own bank details
router.get('/my-bank-details', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('bankName accountNumber ifscCode accountHolderName panNumber aadharNumber upiId paymentQRCode bankDetailsStatus bankDetailsVerifiedAt bankDetailsRejectionReason')
      .populate('bankDetailsVerifiedBy', 'firstName lastName');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bank details' });
  }
});

// HR: Verify/Approve bank details
router.patch('/verify-bank-details/:userId', auth, async (req, res) => {
  try {
    // Check if user has HR/Admin permission
    const hasPermission = req.user.role.permissions.find(
      p => p.module === 'payroll' && p.actions.includes('update')
    );
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to verify bank details' });
    }

    const { status, rejectionReason } = req.body;
    
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use "verified" or "rejected"' });
    }

    const updateData = {
      bankDetailsStatus: status,
      bankDetailsVerifiedBy: req.user._id,
      bankDetailsVerifiedAt: new Date()
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.bankDetailsRejectionReason = rejectionReason;
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true }
    ).select('-password').populate('role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `Bank details ${status}`, user });
  } catch (error) {
    console.error('Error verifying bank details:', error);
    res.status(500).json({ message: 'Error verifying bank details' });
  }
});

// HR: Get all employees with bank details for verification
router.get('/bank-details-list', auth, async (req, res) => {
  try {
    // Check if user has HR/Admin permission
    const hasPermission = req.user.role.permissions.find(
      p => p.module === 'payroll' && p.actions.includes('read')
    );
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to view bank details' });
    }

    const { status } = req.query;
    let query = { isActive: true };
    
    if (status) {
      query.bankDetailsStatus = status;
    }

    const users = await User.find(query)
      .select('firstName lastName employeeId designation department bankName accountNumber ifscCode accountHolderName panNumber upiId paymentQRCode bankDetailsStatus bankDetailsVerifiedAt bankDetailsRejectionReason')
      .populate('bankDetailsVerifiedBy', 'firstName lastName')
      .sort({ updatedAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching bank details list:', error);
    res.status(500).json({ message: 'Error fetching bank details' });
  }
});

module.exports = router;
