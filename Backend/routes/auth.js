const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const auth = require('../middleware/auth');
const Activity = require('../models/Activity');

// Admin Registration
router.post('/admin/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, employeeId, department, designation } = req.body;

    console.log('Admin registration attempt for:', email);

    // Validate input
    if (!email || !password || !firstName || !employeeId) {
      return res.status(400).json({ 
        message: 'Please provide email, password, firstName, and employeeId' 
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { employeeId }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or employee ID already exists' 
      });
    }

    // Get or create Admin role
    let adminRole = await Role.findOne({ name: 'Admin' });
    
    if (!adminRole) {
      // Create Admin role if it doesn't exist
      adminRole = await Role.create({
        name: 'Admin',
        permissions: [
          { module: 'broadcasts', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'goals', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'projects', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'assets', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'leaves', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'requests', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'leads', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'sales', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'deals', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'products', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'documents', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'profile', actions: ['read', 'update'] }
        ],
        isDefault: true
      });
    }

    // Create admin user
    const adminUser = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      employeeId,
      role: adminRole._id,
      department: department || 'Administration',
      designation: designation || 'Administrator',
      isActive: true
    });

    console.log('Admin user created successfully:', email);

    // Create token
    const token = jwt.sign(
      { id: adminUser._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      message: 'Admin registered successfully',
      token,
      user: {
        id: adminUser._id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        employeeId: adminUser.employeeId,
        role: adminRole,
        department: adminUser.department,
        designation: adminUser.designation
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Admin login attempt for:', email);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() }).populate('role');
    
    if (!user) {
      console.log('Admin not found:', email);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Check if user is admin
    if (!user.role || user.role.name !== 'Admin') {
      console.log('User is not admin:', email);
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('Admin account inactive:', email);
      return res.status(401).json({ message: 'Your account has been deactivated. Please contact your administrator for assistance.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log('Password mismatch for admin:', email);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    console.log('Admin login successful for:', email);

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Regular Login (existing functionality)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt for:', email);

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database not connected. Please try again shortly.' });
    }

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() }).populate('role');
    
    console.log('========== LOGIN ATTEMPT ==========');
    console.log('User query result:', user ? 'Found' : 'Not found');
    console.log('Query email:', email);
    
    if (!user) {
      console.log('User not found:', email);
      console.log('===================================');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User ID:', user._id);
    console.log('User isActive status:', user.isActive);
    console.log('User isActive type:', typeof user.isActive);

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ LOGIN BLOCKED - User inactive:', email);
      console.log('===================================');
      return res.status(401).json({ message: 'Your account has been deactivated. Please contact HR or your manager for assistance.' });
    }
    
    console.log('✓ isActive check passed');

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      console.log('===================================');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✓ Password verified successfully');
    console.log('✓ LOGIN SUCCESSFUL for:', email);
    console.log('===================================');

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Initialize default roles (for first-time setup)
router.post('/init', async (req, res) => {
  try {
    // Check if roles already exist
    const existingRoles = await Role.find();
    
    if (existingRoles.length > 0) {
      return res.status(400).json({ message: 'System already initialized' });
    }

    // Create Admin role
    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [
        { module: 'broadcasts', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'goals', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'assets', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'leaves', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'requests', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'documents', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'my-documents', actions: ['read'] },
        { module: 'profile', actions: ['read', 'update'] }
      ],
      isDefault: true
    });

    // Create Employee role
    const employeeRole = await Role.create({
      name: 'Employee',
      permissions: [
        { module: 'broadcasts', actions: ['read'] },
        { module: 'goals', actions: ['create', 'read', 'update'] },
        { module: 'assets', actions: ['read'] },
        { module: 'leaves', actions: ['create', 'read'] },
        { module: 'requests', actions: ['create', 'read'] },
        { module: 'documents', actions: ['create', 'read'] },
        { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'profile', actions: ['read', 'update'] }
      ],
      isDefault: true
    });

    // Create default admin user
    const adminUser = await User.create({
      email: 'admin@hrms.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      employeeId: 'EMP001',
      role: adminRole._id,
      department: 'Administration',
      designation: 'System Administrator'
    });

    res.json({
      message: 'System initialized successfully',
      adminCredentials: {
        email: 'admin@hrms.com',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error initializing system' });
  }
});

// Verify Admin Token
router.get('/admin/verify', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role');
    
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Check if user is admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Admin account is inactive' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// Get Admin Profile
router.get('/admin/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role').select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Check if user is admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation,
        phone: user.phone,
        joiningDate: user.joiningDate,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Admin Profile
router.put('/admin/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, department, designation, phone } = req.body;

    const user = await User.findById(req.user.id).populate('role');
    
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Check if user is admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (department) user.department = department;
    if (designation) user.designation = designation;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      message: 'Admin profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password - Reset password using email, employee ID and old password verification
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, employeeId, oldPassword, newPassword, confirmPassword } = req.body;

    console.log('Change password attempt for:', email);

    // Validate input
    if (!email || !employeeId || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    // Check if new password is same as old password
    if (oldPassword === newPassword) {
      return res.status(400).json({ 
        message: 'New password must be different from current password' 
      });
    }

    // Find user by email and employee ID
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      employeeId: employeeId 
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'No account found with this email and employee ID combination' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Your account is inactive. Please contact HR.' 
      });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log('Password changed successful for:', email);

    res.json({ 
      message: 'Password changed successfully! You can now login with your new password.',
      success: true
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error during password change' });
  }
});

// Verify user exists for forgot password (Step 1) - with old password verification
router.post('/verify-user', async (req, res) => {
  try {
    const { email, employeeId, oldPassword } = req.body;

    if (!email || !employeeId || !oldPassword) {
      return res.status(400).json({ 
        message: 'Please provide email, employee ID and current password' 
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      employeeId: employeeId 
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'No account found with this email and employee ID' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Your account is inactive. Please contact HR.' 
      });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    res.json({ 
      message: 'User verified successfully',
      success: true,
      userName: `${user.firstName} ${user.lastName}`
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== CHANGE PASSWORD WITH OTP (Admin Settings) ====================

/**
 * POST /api/auth/send-change-password-otp
 * Send OTP to user's email for password change (from Settings)
 * Requires: Authentication
 */
router.post('/send-change-password-otp', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Only allow if user is Admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. Admin only.'
      });
    }

    // Check if user has email
    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'No email address found for your account. Please update your profile.'
      });
    }

    console.log('Sending OTP to email:', user.email);

    // Generate OTP
    const otp = user.generateChangePasswordOtp();
    await user.save();

    // Send OTP via email
    const { sendChangePasswordOtp } = require('../utils/emailService');
    console.log('Calling sendChangePasswordOtp with email:', user.email);
    const emailResult = await sendChangePasswordOtp(
      user.email,
      otp,
      `${user.firstName} ${user.lastName}`
    );

    console.log('Email result:', emailResult);

    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: `Failed to send OTP email: ${emailResult.error}. Please try again.`
      });
    }

    console.log('OTP sent successfully to:', user.email);

    res.status(200).json({
      success: true,
      message: `OTP has been sent to ${user.email}. Please check your email.`,
      otpExpiry: user.changePasswordOtpExpiry
    });

  } catch (error) {
    console.error('Send change password OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error. Please try again.' 
    });
  }
});

/**
 * POST /api/auth/verify-change-password-otp
 * Verify OTP for password change
 * Requires: Authentication
 */
router.post('/verify-change-password-otp', auth, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP is required' 
      });
    }

    const user = await User.findById(req.user.id).populate('role');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Only allow if user is Admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access. Admin only.' 
      });
    }

    // Verify OTP
    const verification = user.verifyChangePasswordOtp(otp);

    if (!verification.valid) {
      await user.save();
      return res.status(400).json({ 
        success: false,
        message: verification.message,
        attemptsRemaining: 5 - user.changePasswordOtpAttempts
      });
    }

    // Save verified state
    await user.save();

    res.status(200).json({ 
      success: true,
      message: 'OTP verified successfully. You can now reset your password.'
    });

  } catch (error) {
    console.error('Verify change password OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error. Please try again.' 
    });
  }
});

/**
 * POST /api/auth/confirm-password-change
 * Change password after OTP verification
 * Requires: Authentication & Verified OTP
 */
router.post('/confirm-password-change', auth, async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    // Validate input
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Passwords do not match' 
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(req.user.id).populate('role');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Only allow if user is Admin
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access. Admin only.' 
      });
    }

    // Check if OTP was verified
    if (!user.changePasswordOtpVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'OTP verification required before changing password' 
      });
    }

    // Update password
    user.password = newPassword;
    user.clearChangePasswordOtp();
    
    await user.save();

    console.log(`✅ Password changed successfully for user: ${user.email}`);

    res.status(200).json({ 
      success: true,
      message: 'Password has been changed successfully.' 
    });

  } catch (error) {
    console.error('Confirm password change error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error. Please try again.' 
    });
  }
});

module.exports = router;
