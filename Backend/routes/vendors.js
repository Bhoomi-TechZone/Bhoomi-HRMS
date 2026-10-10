const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Vendor = require('../models/Vendor');

// Get all vendor records
router.get('/', auth, async (req, res) => {
  try {
    const { search, paymentMode, unit } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (paymentMode && paymentMode !== 'All') {
      query.paymentMode = paymentMode;
    }

    if (unit && unit !== 'All') {
      query.unit = unit;
    }

    const vendors = await Vendor.find(query)
      .populate('createdBy', 'firstName lastName employeeId username')
      .sort({ createdAt: -1 });

    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Error fetching vendors', error: error.message });
  }
});

// Get single vendor order
router.get('/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate('createdBy', 'firstName lastName employeeId username');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor record not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ message: 'Error fetching vendor record', error: error.message });
  }
});

// Validation helpers
const isValidEmail = (email) => {
  if (!email || !email.trim()) return true;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
};

const isValidPhone = (phone, isRequired = true) => {
  if (!phone || !phone.trim()) return !isRequired;
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
};

// Create new vendor order
router.post('/', auth, checkPermission('vendor-management', 'create'), async (req, res) => {
  try {
    const { vendorName, phone, email, alternatePhone, productName, amount } = req.body;

    if (!vendorName || !vendorName.trim()) {
      return res.status(400).json({ message: 'Vendor Name is required' });
    }
    if (!phone || !isValidPhone(phone, true)) {
      return res.status(400).json({ message: 'Please provide a valid 10 to 15-digit primary phone number' });
    }
    if (alternatePhone && !isValidPhone(alternatePhone, false)) {
      return res.status(400).json({ message: 'Please provide a valid 10 to 15-digit alternate phone number' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    const isProfileOnly = Boolean(req.body.isProfileOnly);
    const resolvedProductName = isProfileOnly ? '' : (productName && productName.trim() ? productName.trim() : '');
    const resolvedAmount = isProfileOnly ? 0 : ((amount !== undefined && amount !== null && !isNaN(amount)) ? Number(amount) : 0);
    if (resolvedAmount < 0) {
      return res.status(400).json({ message: 'Amount cannot be negative' });
    }

    const vendorData = {
      ...req.body,
      isProfileOnly,
      productName: resolvedProductName,
      amount: resolvedAmount,
      createdBy: req.user._id
    };

    const vendor = await Vendor.create(vendorData);
    await vendor.populate('createdBy', 'firstName lastName employeeId username');

    res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor record:', error);
    res.status(500).json({ message: 'Error creating vendor record', error: error.message });
  }
});

// Update vendor order
router.put('/:id', auth, checkPermission('vendor-management', 'update'), async (req, res) => {
  try {
    const { vendorName, phone, email, alternatePhone, productName, amount } = req.body;

    if (vendorName !== undefined && !vendorName.trim()) {
      return res.status(400).json({ message: 'Vendor Name cannot be empty' });
    }
    if (phone !== undefined && !isValidPhone(phone, true)) {
      return res.status(400).json({ message: 'Please provide a valid 10 to 15-digit primary phone number' });
    }
    if (alternatePhone && !isValidPhone(alternatePhone, false)) {
      return res.status(400).json({ message: 'Please provide a valid 10 to 15-digit alternate phone number' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (productName !== undefined && !productName.trim()) {
      return res.status(400).json({ message: 'Product / Service Name cannot be empty' });
    }
    if (amount !== undefined && (isNaN(amount) || Number(amount) < 0)) {
      return res.status(400).json({ message: 'Valid positive amount is required' });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName employeeId username');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor record not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Error updating vendor record:', error);
    res.status(500).json({ message: 'Error updating vendor record', error: error.message });
  }
});

// Delete vendor order
router.delete('/:id', auth, checkPermission('vendor-management', 'delete'), async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor record not found' });
    }

    res.json({ message: 'Vendor record deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor record:', error);
    res.status(500).json({ message: 'Error deleting vendor record', error: error.message });
  }
});

module.exports = router;
