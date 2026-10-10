const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } = require('docx');
const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendNotification } = require('../utils/socketNotifier');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for leave attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/leave-attachments');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG are allowed.'));
  }
});

// Middleware to safely handle multer uploads with clean error responses
const handleUploadAttachment = (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Attachment file size cannot exceed 5MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'Error uploading attachment' });
    }
    next();
  });
};

// Get My Leave Balance
router.get('/balance', auth, async (req, res) => {
  try {
    // 1. Get Company Settings (for Quota)
    let settings = await CompanySettings.findOne();
    const monthlyQuota = settings?.monthlyLeaveQuota || 2; // Default to 2 if not set

    // 2. Calculate Used Leaves for Current Month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const usedLeaves = await Leave.countDocuments({
      employee: req.user._id,
      status: 'approved',
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } }
        // This logic is simple; for more complex spanning leaves, we might need better calculation
        // but for "2 leaves a month" usually implies count of requests or days. 
        // Let's assume day count if possible, or request count. 
        // The prompt says "max 2 leave", could mean 2 requests or 2 days. 
        // Typically "2 leaves" means 2 days. 
      ]
    });

    // Better logic: Calculate actual days taken
    // Fetch all approved leaves that overlap with this month
    const approvedLeaves = await Leave.find({
      employee: req.user._id,
      status: 'approved',
      $or: [
        { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }
      ]
    });

    let totalDaysTaken = 0;
    approvedLeaves.forEach(leave => {
      let start = new Date(leave.startDate);
      let end = new Date(leave.endDate);

      // Clamp to current month
      if (start < startOfMonth) start = startOfMonth;
      if (end > endOfMonth) end = endOfMonth;

      // Calculate days (inclusive)
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      totalDaysTaken += diffDays;
    });


    res.json({
      monthlyQuota: monthlyQuota,
      used: totalDaysTaken,
      remaining: Math.max(0, monthlyQuota - totalDaysTaken)
    });

  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ message: 'Error fetching leave balance' });
  }
});

// Get all leaves
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    // Fetch user to ensure role is populated
    const user = await User.findById(req.user._id || req.user.userId).populate('role');
    const restrictedRoles = ['Developer', 'Sales'];
    const isRestrictedRole = restrictedRoles.includes(user?.role?.name);
    const fullAccessRoles = ['Admin', 'HR', 'Manager', 'HR Manager', 'Team Leader'];
    const hasFullAccess = !isRestrictedRole && fullAccessRoles.includes(user?.role?.name);

    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      query.employee = user._id;
    }

    const leaves = await Leave.find(query).populate('employee', 'firstName lastName employeeId').populate('approvedBy', 'firstName lastName').populate('timeline.by', 'firstName lastName').sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ message: 'Error fetching leaves' });
  }
});

// Get all holidays
router.get('/holidays', auth, async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching holidays' });
  }
});

// Create holiday (admin only)
router.post('/holidays', auth, checkPermission('leaves', 'create'), async (req, res) => {
  try {
    const holiday = await Holiday.create(req.body);
    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ message: 'Error creating holiday' });
  }
});

// Update holiday (admin only)
router.put('/holidays/:id', auth, checkPermission('leaves', 'update'), async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    res.json(holiday);
  } catch (error) {
    res.status(500).json({ message: 'Error updating holiday' });
  }
});

// Delete holiday (admin only)
router.delete('/holidays/:id', auth, checkPermission('leaves', 'delete'), async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);

    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting holiday' });
  }
});

// Export Leaves to Excel
router.get('/export/excel', auth, async (req, res) => {
  try {
    let query = {};

    const hasFullAccess = req.user.role.permissions.find(
      p => p.module === 'leaves' && p.actions.includes('update')
    );

    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      query.employee = req.user._id;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const data = leaves.map(leave => ({
      'Employee ID': leave.employee?.employeeId || 'N/A',
      'Employee Name': leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'N/A',
      'Leave Type': leave.leaveType,
      'Start Date': new Date(leave.startDate).toLocaleDateString(),
      'End Date': new Date(leave.endDate).toLocaleDateString(),
      'Reason': leave.reason,
      'Status': leave.status,
      'Applied On': leave.createdAt ? new Date(leave.createdAt).toLocaleDateString() : 'N/A',
      'Approved By': leave.approvedBy ? `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}` : 'N/A',
      'Admin Response': leave.adminResponse || 'N/A'
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Leaves');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="leaves.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting leaves:', error);
    res.status(500).json({ message: 'Error exporting leaves' });
  }
});

// Export Leaves to PDF
router.get('/export/pdf', auth, async (req, res) => {
  try {
    let query = {};

    const hasFullAccess = req.user.role.permissions.find(
      p => p.module === 'leaves' && p.actions.includes('update')
    );

    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      query.employee = req.user._id;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="leaves.pdf"');

    doc.pipe(res);

    doc.fontSize(20).text('Leave Records', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    leaves.forEach((leave, index) => {
      if (index > 0) doc.moveDown();

      doc.fontSize(12).fillColor('#333').text(`Leave #${index + 1}`, { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#000');
      doc.text(`Employee: ${leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName} (${leave.employee.employeeId})` : 'N/A'}`);
      doc.text(`Leave Type: ${leave.leaveType}`);
      doc.text(`Period: ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`);
      doc.text(`Reason: ${leave.reason}`);
      doc.text(`Status: ${leave.status.toUpperCase()}`);
      if (leave.approvedBy) {
        doc.text(`Approved By: ${leave.approvedBy.firstName} ${leave.approvedBy.lastName}`);
      }
      if (leave.adminResponse) {
        doc.text(`Admin Response: ${leave.adminResponse}`);
      }
      doc.text(`Applied On: ${leave.createdAt ? new Date(leave.createdAt).toLocaleDateString() : 'N/A'}`);

      if (index < leaves.length - 1) {
        doc.moveDown().strokeColor('#ccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      }
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting leaves to PDF:', error);
    res.status(500).json({ message: 'Error exporting leaves' });
  }
});

// Export Leaves to Word
router.get('/export/word', auth, async (req, res) => {
  try {
    let query = {};

    const hasFullAccess = req.user.role.permissions.find(
      p => p.module === 'leaves' && p.actions.includes('update')
    );

    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      query.employee = req.user._id;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Employee', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Leave Type', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Start Date', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'End Date', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Status', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Reason', bold: true })] })
        ]
      })
    ];

    leaves.forEach(leave => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                text: leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'N/A'
              })]
            }),
            new TableCell({ children: [new Paragraph({ text: leave.leaveType })] }),
            new TableCell({ children: [new Paragraph({ text: new Date(leave.startDate).toLocaleDateString() })] }),
            new TableCell({ children: [new Paragraph({ text: new Date(leave.endDate).toLocaleDateString() })] }),
            new TableCell({ children: [new Paragraph({ text: leave.status.toUpperCase() })] }),
            new TableCell({ children: [new Paragraph({ text: leave.reason || 'N/A' })] })
          ]
        })
      );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Leave Records',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: '' }),
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE
            }
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename="leaves.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting leaves to Word:', error);
    res.status(500).json({ message: 'Error exporting leaves' });
  }
});


// Create leave request
router.post('/', auth, checkPermission('leaves', 'create'), handleUploadAttachment, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // 1. Validation: Dates
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    const leaveData = {
      ...req.body,
      employee: req.user._id
    };

    // Add file information if uploaded
    if (req.file) {
      leaveData.attachmentFileName = req.file.originalname;
      leaveData.attachmentFilePath = req.file.path;
    }

    const leave = await Leave.create(leaveData);

    await leave.populate('employee', 'firstName lastName employeeId');

    // Notify Admins, HRs, Managers, and Team Leaders
    try {
      const notifyRoles = await Role.find({ name: { $in: ['Admin', 'HR', 'HR Manager', 'Director', 'Manager', 'Team Leader'] } }).select('_id');
      const roleIds = notifyRoles.map(r => r._id);
      
      const authorizedUsers = await User.find({ role: { $in: roleIds }, isActive: true }).select('_id');
      const io = req.app.get('socketio');
      
      Promise.all(
        authorizedUsers
          .filter(u => String(u._id) !== String(req.user._id))
          .map(u => 
            sendNotification(
              io, 
              u._id, 
              'Leave Applied', 
              `${req.user.firstName} ${req.user.lastName || ''}`.trim() + ` applied for ${req.body.leaveType || 'a'} leave.`, 
              'Leave', 
              '/leaves'
            )
          )
      ).catch(err => console.error('Error sending leave notifications:', err));
    } catch (notifyErr) {
      console.error('Error setting up leave application notifications:', notifyErr);
    }

    res.status(201).json(leave);
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json({ message: 'Error creating leave request' });
  }
});

// Update leave (approve/reject)
router.put('/:id', auth, handleUploadAttachment, async (req, res) => {
  try {
    const { status, rejectionReason, adminResponse, leaveType, leaveCategory, durationType, startDate, endDate, reason, description } = req.body;

    const currentUserRoleName = req.user?.role?.name;
    const canUpdateLeaves = req.user?.role?.permissions?.some(
      p => p.module === 'leaves' && p.actions.includes('update')
    );

    if (!canUpdateLeaves && currentUserRoleName !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: No update permission for leaves' });
    }

    const existingLeave = await Leave.findById(req.params.id)
      .populate({
        path: 'employee',
        select: 'role',
        populate: { path: 'role', select: 'name' }
      });

    if (!existingLeave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    const currentUserId = String(req.user?._id || req.user?.userId || '');
    const leaveEmployeeId = String(existingLeave.employee?._id || '');
    const isOwnLeave = currentUserId && leaveEmployeeId && currentUserId === leaveEmployeeId;

    // CASE 1: Employee is editing their own leave request
    if (isOwnLeave && !status) {
      if (existingLeave.status !== 'pending') {
        return res.status(400).json({ message: 'Only pending leaves can be edited' });
      }

      const updateData = {};
      if (leaveCategory) updateData.leaveCategory = leaveCategory;
      if (leaveType) updateData.leaveType = leaveType;
      if (durationType) updateData.durationType = durationType;
      if (startDate) updateData.startDate = startDate;
      if (endDate) updateData.endDate = endDate;
      if (reason) updateData.reason = reason;
      if (description !== undefined) updateData.description = description;

      if (req.file) {
        updateData.attachmentFileName = req.file.originalname;
        updateData.attachmentFilePath = req.file.path;
      }

      const leave = await Leave.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
        .populate('employee', 'firstName lastName employeeId')
        .populate('approvedBy', 'firstName lastName');

      return res.json(leave);
    }

    // CASE 2: Responding to a leave (Admin/HR/Manager/users with update permission)
    // Team Leaders can view all leaves but CANNOT change leave status
    if (currentUserRoleName === 'Team Leader' && status) {
      return res.status(403).json({ message: 'Access denied: Team Leaders cannot change leave status' });
    }

    // Non-Admin users can manage others, but never their own leave status
    if (currentUserRoleName !== 'Admin' && isOwnLeave && status) {
      return res.status(403).json({ message: 'Access denied: You cannot change status of your own leave' });
    }

    const updateQuery = { $set: {} };
    const timelineEvents = [];

    if (status) {
      updateQuery.$set.status = status;
      updateQuery.$set.approvedBy = req.user._id;
      updateQuery.$set.approvedAt = new Date();
      if (status !== existingLeave.status) {
        timelineEvents.push({
          type: 'status_change',
          message: `Leave status changed to ${status}`,
          by: req.user._id
        });
      }
    }

    if (status === 'rejected' && rejectionReason) {
      updateQuery.$set.rejectionReason = rejectionReason;
      if (status !== existingLeave.status) {
        timelineEvents.push({
          type: 'message',
          message: `Rejection Reason: ${rejectionReason}`,
          by: req.user._id
        });
      }
    }

    if (adminResponse) {
      updateQuery.$set.adminResponse = adminResponse;
      if (!existingLeave.adminResponse || existingLeave.adminResponse !== adminResponse) {
        timelineEvents.push({
          type: 'message',
          message: adminResponse,
          by: req.user._id
        });
      }
    }

    if (timelineEvents.length > 0) {
      updateQuery.$push = { timeline: { $each: timelineEvents } };
    }

    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      { new: true, runValidators: true }
    )
      .populate('employee', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .populate('timeline.by', 'firstName lastName');

    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    // Notifications for Leave Status Update
    if (status) {
      try {
        const io = req.app.get('socketio');
        
        // Notify the employee
        if (String(leave.employee._id) !== String(req.user._id)) {
          sendNotification(
            io,
            leave.employee._id,
            'Leave Status Updated',
            `Your leave request was ${status} by ${req.user.firstName}.`,
            'Leave',
            '/leaves?id=' + leave._id
          );
        }

        // Notify Admins and HR
        const roles = await Role.find({ name: { $in: ['Admin', 'HR', 'HR Manager'] } }).select('_id');
        if (roles && roles.length > 0) {
          const roleIds = roles.map(r => r._id);
          const adminsAndHr = await User.find({ role: { $in: roleIds }, isActive: true }).select('_id');
          adminsAndHr.forEach(adminHr => {
            // Don't notify the person who made the change
            if (String(adminHr._id) !== String(req.user._id)) {
              sendNotification(
                io,
                adminHr._id,
                'Leave Status Updated',
                `${req.user.firstName} ${status} leave for ${leave.employee.firstName}.`,
                'Leave',
                '/leaves?id=' + leave._id
              );
            }
          });
        }
      } catch (notifyErr) {
        console.error('Error sending leave update notifications:', notifyErr);
      }
    }

    res.json(leave);
  } catch (error) {
    console.error('Error updating leave:', error);
    res.status(500).json({ message: 'Error updating leave' });
  }
});

// Delete leave
router.delete('/:id', auth, checkPermission('leaves', 'delete'), async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    const isRoleAdmin = req.user?.role?.name === 'Admin';
    const isOwner = String(leave.employee) === String(req.user?._id || req.user?.userId);

    if (!isRoleAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied: You can only delete your own leaves' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ message: `Cannot delete a leave that is already ${leave.status}` });
    }

    await Leave.findByIdAndDelete(req.params.id);
    res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json({ message: 'Error deleting leave' });
  }
});

// Download leave attachment
router.get('/:id/attachment', auth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    if (!leave.attachmentFilePath) {
      return res.status(404).json({ message: 'No attachment found for this leave' });
    }

    let downloadPath = leave.attachmentFilePath;

    // Check if stored path exists
    if (!fs.existsSync(downloadPath)) {
      // Fallback: Check in local uploads folder by filename
      const filename = path.basename(leave.attachmentFilePath);
      const localPath = path.join(__dirname, '../uploads/leave-attachments', filename);
      if (fs.existsSync(localPath)) {
        downloadPath = localPath;
      } else {
        // Second fallback: Check by original file name
        const localPathAlt = path.join(__dirname, '../uploads/leave-attachments', leave.attachmentFileName);
        if (fs.existsSync(localPathAlt)) {
          downloadPath = localPathAlt;
        } else {
          return res.status(404).json({ message: 'Attachment file not found on disk' });
        }
      }
    }

    res.sendFile(downloadPath);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Error downloading attachment' });
  }
});

// Add a reply message to leave timeline
router.post('/:id/reply', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const leave = await Leave.findById(req.params.id).populate('employee', 'firstName lastName employeeId role');
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    const currentUserId = String(req.user?._id || req.user?.userId || '');
    const leaveEmployeeId = String(leave.employee?._id || '');
    const isOwnLeave = currentUserId === leaveEmployeeId;
    const canRespond = ['Admin', 'HR', 'Manager', 'HR Manager'].includes(req.user?.role?.name) || req.user?.role?.permissions?.some(p => p.module === 'leaves' && p.actions.includes('update'));

    if (!isOwnLeave && !canRespond) {
      return res.status(403).json({ message: 'Access denied: You cannot reply to this leave' });
    }

    const reply = {
      type: 'message',
      message,
      by: req.user._id,
      createdAt: new Date()
    };

    await Leave.updateOne({ _id: leave._id }, { $push: { timeline: reply } });

    // Re-fetch the leave to get the updated timeline and populate
    const updatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'firstName lastName employeeId role')
      .populate('timeline.by', 'firstName lastName');

    // Notifications
    try {
      const io = req.app.get('socketio');
      const senderName = `${req.user.firstName} ${req.user.lastName || ''}`.trim();
      const leaveEmpName = leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName || ''}`.trim() : 'Employee';
      
      if (isOwnLeave) {
        // Employee replied -> notify Admins, HRs, and Managers
        const roles = await Role.find({ name: { $in: ['Admin', 'HR', 'HR Manager', 'Director', 'Manager'] } }).select('_id');
        if (roles && roles.length > 0) {
          const roleIds = roles.map(r => r._id);
          const adminsAndHr = await User.find({ role: { $in: roleIds }, isActive: true }).select('_id');
          adminsAndHr.forEach(adminHr => {
            if (String(adminHr._id) !== currentUserId) {
              sendNotification(io, adminHr._id, 'New Leave Reply', `${senderName} replied to their leave request.`, 'Leave', '/leaves?id=' + leave._id + '&action=chat');
            }
          });
        }
      } else {
        // Admin/HR replied -> notify Employee
        if (String(leave.employee._id) !== currentUserId) {
          sendNotification(io, leave.employee._id, 'New Leave Reply', `${senderName} replied to your leave request.`, 'Leave', '/leaves?id=' + leave._id + '&action=chat');
        }
        // Also notify other HR/Admin team members
        const roles = await Role.find({ name: { $in: ['Admin', 'HR', 'HR Manager', 'Director', 'Manager'] } }).select('_id');
        if (roles && roles.length > 0) {
          const roleIds = roles.map(r => r._id);
          const adminsAndHr = await User.find({ role: { $in: roleIds }, isActive: true }).select('_id');
          adminsAndHr.forEach(adminHr => {
            if (String(adminHr._id) !== currentUserId && String(adminHr._id) !== String(leave.employee?._id)) {
              sendNotification(io, adminHr._id, 'New Leave Reply', `${senderName} replied on ${leaveEmpName}'s leave request.`, 'Leave', '/leaves?id=' + leave._id + '&action=chat');
            }
          });
        }
      }
    } catch (notifErr) {
      console.error('Notification error on reply:', notifErr);
    }

    res.json(updatedLeave);
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Server error adding reply' });
  }
});

module.exports = router;
