const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const LeadAssignment = require('../models/LeadAssignment');
const User = require('../models/User');
const { sendAdminDataActivityNotification } = require('../utils/crmNotifier');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Multer configuration for Excel files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/lead-assignments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ];

    // Also check file extension
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExts = ['xlsx', 'xls'];

    if ((allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Only Excel files (.xlsx, .xls) are allowed. Received: ${file.mimetype}`));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Import Excel and automatically assign leads to sales persons
router.post('/import-excel', auth, checkPermission('leads', 'create'), (req, res, next) => {
  // Wrap multer in callback to handle errors
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
          return res.status(400).json({ message: 'File too large. Max 10MB.' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📥 Import Excel route called');

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('📄 Processing file:', req.file.originalname);

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('📊 Found', jsonData.length, 'rows');

    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    // Get all active sales persons (employees with sales role or sales-related designation)
    // First, find roles that contain 'Sales' in their name
    const Role = require('../models/Role');
    const salesRoles = await Role.find({ name: { $regex: /sales/i } });
    const salesRoleIds = salesRoles.map(r => r._id);

    const salesPersons = await User.find({
      isActive: true,
      $or: [
        { role: { $in: salesRoleIds } },
        { designation: { $regex: /sales|representative|executive/i } }
      ]
    }).populate('role', 'name');

    if (salesPersons.length === 0) {
      return res.status(400).json({ message: 'No active sales persons found. Please create sales employees first or assign Sales role to employees.' });
    }

    console.log('👥 Found', salesPersons.length, 'sales persons for assignment:', salesPersons.map(s => `${s.firstName} ${s.lastName} (${s.role?.name})`));

    const assignedLeads = [];
    const errors = [];
    let assignmentIndex = 0; // For round-robin assignment

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      try {
        // Flexible column mapping - check multiple possible column names
        const getField = (row, ...possibleNames) => {
          for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
              return String(row[name]).trim();
            }
          }
          return '';
        };

        const leadName = getField(row, 'LeadName', 'Lead Name', 'Name', 'Customer Name', 'Client Name', 'Contact Name', 'Full Name', 'CustomerName', 'ClientName');
        const contactNumber = getField(row, 'ContactNumber', 'Contact Number', 'Phone', 'Mobile', 'Phone Number', 'Mobile Number', 'PhoneNumber', 'MobileNumber', 'Contact');
        const email = getField(row, 'Email', 'Email Address', 'EmailAddress', 'E-mail', 'Mail');
        const company = getField(row, 'Company', 'Company Name', 'CompanyName', 'Organization', 'Business Name', 'Firm');
        const source = getField(row, 'Source', 'Lead Source', 'LeadSource', 'Channel', 'Origin');
        const product = getField(row, 'Product', 'Product Name', 'Service', 'Interest', 'Interested In', 'ProductName');
        const city = getField(row, 'City', 'Location', 'Town');
        const state = getField(row, 'State', 'Province', 'Region');
        const address = getField(row, 'Address', 'Full Address', 'Street', 'Location');
        const designation = getField(row, 'Designation', 'Title', 'Position', 'Job Title', 'Role');
        const industry = getField(row, 'Industry', 'Sector', 'Business Type', 'Category');
        const description = getField(row, 'Description', 'Client Requirements', 'Requirements', 'Requirement', 'Client Needs', 'Details', 'Project Details', 'Project Description');
        const notes = getField(row, 'Notes', 'Comments', 'Remarks', 'Internal Notes');

        // Handle value/amount
        const valueStr = getField(row, 'Value', 'Lead Value', 'Amount', 'Budget', 'Deal Value', 'Price');
        const value = parseFloat(valueStr.replace(/[^0-9.]/g, '')) || 0;

        // Handle lead date
        const leadDateStr = getField(row, 'Date', 'Lead Date', 'Created Date', 'Entry Date', 'Received Date');
        let leadDate = null;
        if (leadDateStr) {
          const parsedDate = new Date(leadDateStr);
          if (!isNaN(parsedDate.getTime())) {
            leadDate = parsedDate;
          }
        }

        // Store any extra fields that weren't mapped
        const mappedFields = ['LeadName', 'Lead Name', 'Name', 'Customer Name', 'Client Name', 'Contact Name', 'Full Name', 'CustomerName', 'ClientName',
          'ContactNumber', 'Contact Number', 'Phone', 'Mobile', 'Phone Number', 'Mobile Number', 'PhoneNumber', 'MobileNumber', 'Contact',
          'Email', 'Email Address', 'EmailAddress', 'E-mail', 'Mail',
          'Company', 'Company Name', 'CompanyName', 'Organization', 'Business Name', 'Firm',
          'Source', 'Lead Source', 'LeadSource', 'Channel', 'Origin',
          'Product', 'Product Name', 'Service', 'Interest', 'Interested In', 'ProductName',
          'City', 'Location', 'Town', 'State', 'Province', 'Region',
          'Address', 'Full Address', 'Street', 'Designation', 'Title', 'Position', 'Job Title', 'Role',
          'Industry', 'Sector', 'Business Type', 'Category',
          'Description', 'Client Requirements', 'Requirements', 'Requirement', 'Client Needs', 'Details', 'Project Details', 'Project Description',
          'Notes', 'Comments', 'Remarks', 'Internal Notes',
          'Value', 'Lead Value', 'Amount', 'Budget', 'Deal Value', 'Price',
          'Date', 'Lead Date', 'Created Date', 'Entry Date', 'Received Date'];

        const extraFields = {};
        for (const key of Object.keys(row)) {
          if (!mappedFields.includes(key) && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
            extraFields[key] = String(row[key]).trim();
          }
        }

        if (!contactNumber) {
          errors.push(`Row ${i + 2}: Missing Contact Number`);
          continue;
        }

        // Validate contact number format
        if (!/^[0-9+\-\s()]*$/.test(contactNumber)) {
          errors.push(`Row ${i + 2}: Invalid contact number format`);
          continue;
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Row ${i + 2}: Invalid email format`);
          continue;
        }

        // Round-robin assignment
        const assignedEmployee = salesPersons[assignmentIndex % salesPersons.length];
        assignmentIndex++;

        const lead = await LeadAssignment.create({
          employee: assignedEmployee._id,

          contactNumber,
          email: email || null,
          company: company || null,
          source: source || null,
          product: product || null,
          city: city || null,
          state: state || null,
          address: address || null,
          designation: designation || null,
          industry: industry || null,
          description: description || null,
          leadDate: leadDate,
          extraFields: Object.keys(extraFields).length > 0 ? extraFields : null,
          status: 'New',
          value: value,
          notes: notes || null,
          assignedBy: req.user._id,
          uploadedFile: req.file.filename
        });

        assignedLeads.push({
          ...lead.toObject(),
          assignedTo: `${assignedEmployee.firstName} ${assignedEmployee.lastName}`
        });

        console.log(`✅ Row ${i + 2}: Lead "${leadName}" assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName}`);
      } catch (error) {
        console.error(`Row ${i + 2} error:`, error.message);
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    console.log('✅ Completed:', assignedLeads.length, 'leads created,', errors.length, 'errors');

    // Clean up uploaded file after processing
    fs.unlinkSync(req.file.path);

    if (assignedLeads.length > 0) {
      try {
        const io = req.app.get('socketio');
        await sendAdminDataActivityNotification(io, {
          actorUser: req.user,
          activityType: 'import',
          category: 'Leads',
          count: assignedLeads.length,
          details: `${assignedLeads.length} leads assigned to ${salesPersons.length} sales persons`,
          link: '/leads'
        });
      } catch (notifErr) {
        console.error('Lead assignments import admin notification error:', notifErr);
      }
    }

    res.status(201).json({
      message: `${assignedLeads.length} leads imported and assigned successfully`,
      count: assignedLeads.length,
      assignedLeads: assignedLeads,
      errors: errors.length > 0 ? errors : null,
      salesPersonsCount: salesPersons.length
    });
  } catch (error) {
    console.error('Import error:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// Upload Excel and assign leads
router.post('/upload', auth, (req, res, next) => {
  // Wrap multer in callback to handle errors
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
          return res.status(400).json({ message: 'File too large. Max 10MB.' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📥 Upload route called');

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const selectedEmployeeId = req.body.employeeId;
    if (!selectedEmployeeId) {
      return res.status(400).json({ message: 'No employee selected' });
    }

    // Get the selected employee
    const selectedEmployee = await User.findById(selectedEmployeeId);
    if (!selectedEmployee) {
      return res.status(400).json({ message: 'Selected employee not found' });
    }

    console.log('📄 Processing file:', req.file.originalname);
    console.log('👤 Assigning to employee:', selectedEmployee.firstName, selectedEmployee.lastName);

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('📊 Found', jsonData.length, 'rows');

    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    const assignedLeads = [];
    const errors = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      try {
        // Accept any format - just get the first few columns that exist
        const keys = Object.keys(row);
        const leadName = String(row[keys[0]] || row.LeadName || row['Lead Name'] || '').trim();
        const contactNumber = String(row[keys[1]] || row.ContactNumber || row['Contact Number'] || row.Phone || '').trim();
        const email = String(row[keys[2]] || row.Email || row['Email Address'] || '').trim();
        const company = String(row[keys[3]] || row.Company || row['Company Name'] || '').trim();

        // Allow rows with at least lead name - don't strictly validate
        if (!contactNumber) {
          errors.push(`Row ${i + 2}: Skipped (empty contact number)`);
          continue;
        }

        const lead = await LeadAssignment.create({
          employee: selectedEmployee._id,
          contactNumber: contactNumber || 'N/A',
          email: email || null,
          company: company || null,
          status: 'New',
          value: 0,
          notes: null,
          assignedBy: req.user._id,
          uploadedFile: req.file.filename
        });

        assignedLeads.push(lead);
        console.log(`✅ Row ${i + 2}: Lead "${leadName}" assigned to ${selectedEmployee.firstName} ${selectedEmployee.lastName}`);
      } catch (error) {
        console.error(`Row ${i + 2} error:`, error.message);
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    console.log('✅ Completed:', assignedLeads.length, 'created,', errors.length, 'errors');

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      message: `${assignedLeads.length} leads assigned to ${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
      count: assignedLeads.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// Get assigned leads for current employee
router.get('/my-leads', auth, async (req, res) => {
  try {
    // If employeeId is provided, use that (for export), otherwise use current user
    const employeeId = req.query.employeeId || req.user._id;
    const leads = await LeadAssignment.find({ employee: employeeId })
      .populate('assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads' });
  }
});

// Get all assigned leads (HR/Admin only)
router.get('/', auth, checkPermission('leads', 'read'), async (req, res) => {
  try {
    const leads = await LeadAssignment.find()
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads' });
  }
});

// Update lead status
router.put('/:id', auth, async (req, res) => {
  try {
    const lead = await LeadAssignment.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check if user is the assigned employee
    const isAssigned = lead.employee && lead.employee.toString() === req.user._id.toString();

    if (!isAssigned) {
      const roleNormalized = (req.user.role?.name || '').toLowerCase().replace(/\s+/g, ' ');
      const permissions = req.user.role?.permissions || [];

      const canManage =
        roleNormalized.includes('admin') ||
        roleNormalized.includes('director') ||
        roleNormalized.includes('hr') ||
        roleNormalized.includes('leader') ||
        roleNormalized.includes('team lead') ||
        roleNormalized.includes('head') ||
        roleNormalized.includes('sales team') ||
        roleNormalized.includes('manager');

      const hasPermission = permissions.some(p =>
        p.module === 'leads' &&
        (Array.isArray(p.actions) ? p.actions : []).some(a => a.toLowerCase() === 'update')
      );

      if (!canManage && !hasPermission) {
        return res.status(403).json({ message: `Access denied. Role: ${roleName}, Assigned: ${isAssigned}` });
      }
    }

    if (!lead.history) lead.history = [];

    // Update only allowed fields
    if (req.body.status && req.body.status !== lead.status) {
      lead.history.push({
        action: 'Status Change',
        details: `Status changed from ${lead.status} to ${req.body.status}`,
        by: req.user._id,
        date: new Date()
      });
      lead.status = req.body.status;
    }

    if (req.body.newNote) {
      lead.history.push({
        action: 'Note Added',
        details: req.body.newNote,
        by: req.user._id,
        date: new Date()
      });
      // specific note also appends to main notes for visibility
      lead.notes = (lead.notes ? lead.notes + '\n\n' : '') + `[${new Date().toLocaleDateString()}] ${req.body.newNote}`;
    }

    if (req.body.notes && req.body.notes !== lead.notes) {
      lead.notes = req.body.notes;
    }

    if (req.body.value !== undefined) lead.value = req.body.value;

    // termination or assignment change
    if (req.body.employee && req.body.employee !== lead.employee.toString()) {
      // logic for checking permission to assign?
      // For now assuming the checkPermission middleware or admin check above is sufficient
      lead.history.push({
        action: 'Assignment Change',
        details: `Assigned to different employee`, // Could fetch name if needed
        by: req.user._id,
        date: new Date()
      });
      lead.employee = req.body.employee;
    }

    await lead.save();
    await lead.populate('assignedBy', 'firstName lastName');

    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error updating lead' });
  }
});

// Update follow-up for a lead
router.put('/:id/follow-up', auth, async (req, res) => {
  try {
    const lead = await LeadAssignment.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const { nextFollowUp, followUpNotes, followUpCompleted, followUpCompletedNotes } = req.body;

    if (nextFollowUp) {
      lead.nextFollowUp = new Date(nextFollowUp);
      lead.followUpNotes = followUpNotes || '';
      lead.followUpCompleted = false;
    }

    if (followUpCompleted) {
      lead.followUpCompleted = true;
      lead.followUpCompletedDate = new Date();
      lead.followUpCompletedNotes = followUpCompletedNotes || '';
    }

    await lead.save();
    await lead.populate('assignedBy', 'firstName lastName');

    res.json(lead);
  } catch (error) {
    console.error('Error updating follow-up:', error);
    res.status(500).json({ message: 'Error updating follow-up' });
  }
});

// Get upcoming follow-ups (HR/Admin only)
router.get('/upcoming/list', auth, checkPermission('leads', 'read'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingLeads = await LeadAssignment.find({
      nextFollowUp: { $exists: true, $ne: null },
      followUpCompleted: false,
      $expr: { $gte: [{ $dateFromString: { dateString: { $toString: '$nextFollowUp' } } }, today] }
    })
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ nextFollowUp: 1 });

    res.json(upcomingLeads);
  } catch (error) {
    console.error('Error fetching upcoming leads:', error);
    res.status(500).json({ message: 'Error fetching upcoming leads' });
  }
});

// Get all follow-ups with filtering (HR/Admin only)
router.get('/follow-ups/tracker', auth, checkPermission('leads', 'read'), async (req, res) => {
  try {
    const { employee, status, dateRange, completed } = req.query;

    // Build query
    let query = { nextFollowUp: { $exists: true, $ne: null } };

    // Filter by employee if specified
    if (employee && employee !== 'all') {
      query.employee = employee;
    }

    // Filter by lead status if specified
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by completion status
    if (completed === 'true') {
      query.followUpCompleted = true;
    } else if (completed === 'false') {
      query.followUpCompleted = false;
    }

    // Filter by date range
    if (dateRange) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      switch (dateRange) {
        case 'today':
          const startOfToday = new Date(today);
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date(today);
          endOfToday.setHours(23, 59, 59, 999);
          query.nextFollowUp = { $gte: startOfToday, $lte: endOfToday };
          break;
        case 'upcoming':
          query.nextFollowUp = { $gte: today };
          query.followUpCompleted = false;
          break;
        case 'overdue':
          query.nextFollowUp = { $lt: today };
          query.followUpCompleted = false;
          break;
        case 'this_week':
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          query.nextFollowUp = { $gte: startOfWeek, $lte: endOfWeek };
          break;
      }
    }

    const followUps = await LeadAssignment.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ nextFollowUp: 1 });

    // Get summary statistics
    const stats = {
      total: followUps.length,
      pending: followUps.filter(f => !f.followUpCompleted).length,
      completed: followUps.filter(f => f.followUpCompleted).length,
      overdue: followUps.filter(f => !f.followUpCompleted && new Date(f.nextFollowUp) < new Date()).length,
      today: followUps.filter(f => {
        const today = new Date();
        const followUpDate = new Date(f.nextFollowUp);
        return followUpDate.toDateString() === today.toDateString();
      }).length
    };

    res.json({ followUps, stats });
  } catch (error) {
    console.error('Error fetching follow-up tracker:', error);
    res.status(500).json({ message: 'Error fetching follow-up tracker' });
  }
});

// Get due follow-ups for current user (or all for admin)
router.get('/followups/due', auth, async (req, res) => {
  try {
    const now = new Date();

    const roleNormalized = (req.user.role?.name || '').toLowerCase().replace(/\s+/g, ' ');
    const canManage =
      roleNormalized.includes('admin') ||
      roleNormalized.includes('director') ||
      roleNormalized.includes('hr') ||
      roleNormalized.includes('leader') ||
      roleNormalized.includes('team lead') ||
      roleNormalized.includes('head') ||
      roleNormalized.includes('sales team') ||
      roleNormalized.includes('manager');

    const query = {
      nextFollowUp: { $ne: null, $lte: now },
      followUpCompleted: { $ne: true },
      status: { $nin: ['Converted', 'Closed', 'Not Interested'] }
    };
    if (!canManage) query.employee = req.user._id;

    const leads = await LeadAssignment.find(query)
      .populate('employee', 'firstName lastName')
      .select('company contactNumber email nextFollowUp followUpNotes status employee')
      .sort({ nextFollowUp: 1 })
      .lean();

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching due follow-ups' });
  }
});

// Delete lead (HR/Admin only)
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const lead = await LeadAssignment.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting lead' });
  }
});

// Error handling middleware for multer
router.use((err, req, res, next) => {
  console.error('❌ ERROR MIDDLEWARE:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
  next();
});

module.exports = router;
