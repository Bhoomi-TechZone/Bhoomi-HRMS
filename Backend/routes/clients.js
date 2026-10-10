const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendNotification } = require('../utils/socketNotifier');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// GET all clients
router.get('/', auth, checkPermission(['clients', 'proposals', 'projects', 'invoices', 'deals', 'assignments'], 'read'), async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'User or role not found' });
    }
    
    let query = {};
    
    // Check if user has full access - Admin, HR, Manager, HR Manager or any user with explicit read permissions on CRM modules
    const userRoleName = user.role.name || '';
    const hasModulePerm = user.role.permissions && user.role.permissions.some(
      p => ['clients', 'proposals', 'projects', 'invoices', 'deals', 'assignments'].includes(p.module?.toLowerCase()) && p.actions.includes('read')
    );
    const hasFullAccess = 
      ['Admin', 'HR', 'Manager', 'HR Manager', 'Sales Head', 'Super Admin'].includes(userRoleName) ||
      hasModulePerm;
    
    // Regular employees without module read permissions only see clients assigned to them or created by them
    if (!hasFullAccess) {
      query.$or = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
    }
    
    const clients = await Client.find(query)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('relatedDeal', 'dealName stage dealValue')
      .sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET single client
router.get('/:id', auth, checkPermission(['clients', 'proposals', 'projects', 'invoices', 'deals', 'assignments'], 'read'), async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'User or role not found' });
    }
    const client = await Client.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('relatedDeal', 'dealName stage dealValue');
    
    if (!client) return res.status(404).json({ message: 'Client not found' });
    
    const userRoleName = user.role.name || '';
    const hasModulePerm = user.role.permissions && user.role.permissions.some(
      p => ['clients', 'proposals', 'projects', 'invoices', 'deals', 'assignments'].includes(p.module?.toLowerCase()) && p.actions.includes('read')
    );
    const hasFullAccess = 
      ['Admin', 'HR', 'Manager', 'HR Manager', 'Sales Head', 'Super Admin'].includes(userRoleName) ||
      hasModulePerm;
    
    // Regular employees can only view their assigned/created clients
    if (!hasFullAccess && 
        client.assignedTo?._id?.toString() !== user._id.toString() &&
        client.createdBy?._id?.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create client directly
router.post('/', auth, checkPermission('clients', 'create'), async (req, res) => {
  try {
    const {
      name, company, email, phone, source, requirements, notes, dealValue, assignedTo,
      // Basic / Personal details
      firstName, lastName,
      phoneCountryCode, altPhoneCountryCode, alternatePhone,
      personalEmail, personalAddress,
      // Company details
      ownedBy, businessIdentifier, registrationNo, gstNo,
      companyContactCode, companyContactNo,
      companyAltCode, companyAltNo,
      businessEmail, companyAddress,
    } = req.body;
    
    const newClient = new Client({
      name,
      company,
      email,
      phone,
      source: source || 'Manual',
      requirements,
      notes,
      dealValue: dealValue || 0,
      assignedTo: assignedTo || req.user.id,
      createdBy: req.user.id,
      convertedAt: new Date(),
      status: 'Active',
      // Personal details
      firstName: firstName || '',
      lastName: lastName || '',
      phoneCountryCode: phoneCountryCode || '+91',
      altPhoneCountryCode: altPhoneCountryCode || '+91',
      alternatePhone: alternatePhone || '',
      personalEmail: personalEmail || '',
      personalAddress: personalAddress || {},
      // Company details
      ownedBy: ownedBy || '',
      businessIdentifier: businessIdentifier || 'GSTIN',
      registrationNo: registrationNo || gstNo || '',
      gstNo: gstNo || registrationNo || '',
      companyContactCode: companyContactCode || '+91',
      companyContactNo: companyContactNo || '',
      companyAltCode: companyAltCode || '+91',
      companyAltNo: companyAltNo || '',
      businessEmail: businessEmail || '',
      companyAddress: companyAddress || {},
    });

    await newClient.save();
    
    // Notifications logic
    try {
      const recipientIds = [];
      if (assignedTo && assignedTo.toString() !== req.user.id.toString()) {
        recipientIds.push(assignedTo);
      }
      
      for (const recId of recipientIds) {
        await Notification.create({
          recipient: recId,
          type: 'Client',
          title: 'New Client Created',
          message: `A new client "${name || company}" was created by ${req.user.name || 'someone'}.`,
          link: '/clients'
        });
      }
    } catch (notifErr) {
      console.error('Failed to create notification for new client:', notifErr);
    }

    res.status(201).json(newClient);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update client
router.put('/:id', auth, checkPermission('clients', 'edit'), async (req, res) => {
  try {
    const {
      name, company, email, phone, source, requirements, notes, dealValue, status, assignedTo,
      firstName, lastName,
      phoneCountryCode, altPhoneCountryCode, alternatePhone,
      personalEmail, personalAddress,
      ownedBy, businessIdentifier, registrationNo, gstNo,
      companyContactCode, companyContactNo,
      companyAltCode, companyAltNo,
      businessEmail, companyAddress,
    } = req.body;
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    if (name) client.name = name;
    if (company !== undefined) client.company = company;
    if (email) client.email = email;
    if (phone) client.phone = phone;
    if (source) client.source = source;
    if (requirements !== undefined) client.requirements = requirements;
    if (notes !== undefined) client.notes = notes;
    if (dealValue !== undefined) client.dealValue = dealValue;
    if (status) client.status = status;
    if (assignedTo !== undefined) client.assignedTo = assignedTo;
    // Personal
    if (firstName !== undefined) client.firstName = firstName;
    if (lastName !== undefined) client.lastName = lastName;
    if (phoneCountryCode !== undefined) client.phoneCountryCode = phoneCountryCode;
    if (altPhoneCountryCode !== undefined) client.altPhoneCountryCode = altPhoneCountryCode;
    if (alternatePhone !== undefined) client.alternatePhone = alternatePhone;
    if (personalEmail !== undefined) client.personalEmail = personalEmail;
    if (personalAddress !== undefined) client.personalAddress = personalAddress;
    // Company
    if (ownedBy !== undefined) client.ownedBy = ownedBy;
    if (businessIdentifier !== undefined) client.businessIdentifier = businessIdentifier;
    if (registrationNo !== undefined) {
      client.registrationNo = registrationNo;
      client.gstNo = registrationNo;
    } else if (gstNo !== undefined) {
      client.gstNo = gstNo;
      client.registrationNo = gstNo;
    }
    if (companyContactCode !== undefined) client.companyContactCode = companyContactCode;
    if (companyContactNo !== undefined) client.companyContactNo = companyContactNo;
    if (companyAltCode !== undefined) client.companyAltCode = companyAltCode;
    if (companyAltNo !== undefined) client.companyAltNo = companyAltNo;
    if (businessEmail !== undefined) client.businessEmail = businessEmail;
    if (companyAddress !== undefined) client.companyAddress = companyAddress;

    await client.save();
    const updated = await Client.findById(client._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email');
    res.json(updated);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE client
router.delete('/:id', auth, checkPermission('clients', 'delete'), async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
