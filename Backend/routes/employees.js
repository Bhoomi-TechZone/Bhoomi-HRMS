const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const { Document: DocxDocument, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle } = require('docx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if not exists
const uploadDir = 'uploads/employees';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
}).fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'markSheet10', maxCount: 1 },
  { name: 'markSheet12', maxCount: 1 },
  { name: 'graduation', maxCount: 1 },
  { name: 'otherDocs', maxCount: 1 }
]);

// Get employee statistics
router.get('/stats', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Current counts
    const total = await User.countDocuments();
    const active = await User.countDocuments({ isActive: true });
    const inactive = await User.countDocuments({ isActive: false });

    // Previous month counts (employees that existed before this month)
    const totalLastMonth = await User.countDocuments({ createdAt: { $lt: firstDayThisMonth } });
    const activeLastMonth = await User.countDocuments({
      isActive: true,
      createdAt: { $lt: firstDayThisMonth }
    });
    const inactiveLastMonth = await User.countDocuments({
      isActive: false,
      createdAt: { $lt: firstDayThisMonth }
    });

    // For role-based counts, we need to find the Role IDs first or aggregate
    const employees = await User.find().populate('role');
    const employeesLastMonth = await User.find({ createdAt: { $lt: firstDayThisMonth } }).populate('role');

    let developers = 0;
    let sales = 0;
    let developersLastMonth = 0;
    let salesLastMonth = 0;

    employees.forEach(emp => {
      if (emp.role && emp.role.name) {
        const roleName = emp.role.name.toLowerCase();
        if (roleName.includes('developer') || roleName.includes('dev')) {
          developers++;
        } else if (roleName.includes('sales') || roleName.includes('business development') || roleName.includes('bde')) {
          sales++;
        }
      }
    });

    employeesLastMonth.forEach(emp => {
      if (emp.role && emp.role.name) {
        const roleName = emp.role.name.toLowerCase();
        if (roleName.includes('developer') || roleName.includes('dev')) {
          developersLastMonth++;
        } else if (roleName.includes('sales') || roleName.includes('business development') || roleName.includes('bde')) {
          salesLastMonth++;
        }
      }
    });

    // New Joinees (Joined in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newJoinees = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const newJoineesLastMonth = await User.countDocuments({
      createdAt: {
        $gte: new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth() - 1, thirtyDaysAgo.getDate()),
        $lt: firstDayThisMonth
      }
    });

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      total,
      active,
      inactive,
      developers,
      sales,
      newJoinees,
      changes: {
        total: calculateChange(total, totalLastMonth),
        active: calculateChange(active, activeLastMonth),
        inactive: calculateChange(inactive, inactiveLastMonth),
        developers: calculateChange(developers, developersLastMonth),
        sales: calculateChange(sales, salesLastMonth),
        newJoinees: calculateChange(newJoinees, newJoineesLastMonth)
      }
    });
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({ message: 'Error fetching employee statistics' });
  }
});

// Get all employees for dropdowns (basic info, auth only)
router.get('/list', auth, async (req, res) => {
  try {
    const employees = await User.find({ isActive: true })
      .select('firstName lastName employeeId designation role isActive email phone department officialEmail joiningDate')
      .populate('role', 'name')
      .sort({ firstName: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee list' });
  }
});

// Get all employees
router.get('/', auth, async (req, res) => {
  try {
    const roleName = (req.user?.role?.name || '').toLowerCase();
    const permissions = req.user?.role?.permissions || [];
    const hasEmployeeRead = permissions.some(p => p.module === 'employees' && p.actions.includes('read'));
    const isFullAccess = ['admin', 'director', 'hr', 'hr manager'].some(r => roleName.includes(r)) || hasEmployeeRead;

    if (isFullAccess) {
      const employees = await User.find()
        .select('-password')
        .populate('role')
        .populate('assignedManager', 'firstName lastName employeeId designation role')
        .sort({ createdAt: -1 });

      return res.json(employees);
    }

    // For other roles (e.g. Sales Team, Team Leader, Sales Head, Manager) who need employee list for assignment dropdowns
    // return sanitized active employee list without sensitive HR/salary/banking data
    const employees = await User.find({ isActive: true })
      .select('firstName lastName employeeId designation role isActive email phone department officialEmail joiningDate')
      .populate('role', 'name')
      .sort({ firstName: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees' });
  }
});


// Export Employees to Excel
router.get('/export/excel', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    const employees = await User.find()
      .select('-password')
      .populate('role')
      .sort({ createdAt: -1 });

    const data = employees.map((emp, i) => ({
      '#': i + 1,
      'Employee ID': emp.employeeId || 'N/A',
      'First Name': emp.firstName || '',
      'Last Name': emp.lastName || '',
      'Email': emp.email || '',
      'Phone': emp.phone || 'N/A',
      'Gender': emp.gender || 'N/A',
      'Role': emp.role ? emp.role.name : 'N/A',
      'Department': emp.department || 'N/A',
      'Designation': emp.designation || 'N/A',
      'Status': emp.isActive ? 'Active' : 'Inactive',
      'Joining Date': emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : 'N/A',
      // Banking
      'Bank Name': emp.bankName || 'N/A',
      'Account Holder': emp.accountHolderName || 'N/A',
      'Account Number': emp.accountNumber || 'N/A',
      'IFSC Code': emp.ifscCode || 'N/A',
      'PAN Number': emp.panNumber || 'N/A',
      'UPI ID': emp.upiId || 'N/A',
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 28 },
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
      { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      { wch: 12 }, { wch: 14 }, { wch: 20 },
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Employees');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="employees.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting employees:', error);
    res.status(500).json({ message: 'Error exporting employees' });
  }
});

// Export Employees to PDF
router.get('/export/pdf', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    const employees = await User.find()
      .select('-password')
      .populate('role')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="employees_list.pdf"');
    doc.pipe(res);

    // ── Colours ──
    const GREEN = '#166534';
    const LIME = '#a3e635';
    const HEADER_BG = '#166534';
    const ROW_ALT = '#f0fdf4';
    const BORDER = '#d1d5db';
    const TEXT_DARK = '#111827';
    const TEXT_LIGHT = '#ffffff';

    // ── Columns (landscape A4 ≈ 842pt, minus 60 margins = 782pt usable) ──
    const cols = [
      { label: '#', key: (e, i) => String(i + 1), w: 25 },
      { label: 'Emp ID', key: e => e.employeeId || '', w: 50 },
      { label: 'Name', key: e => `${e.firstName} ${e.lastName}`, w: 100 },
      { label: 'Email', key: e => e.email || '', w: 155 },
      { label: 'Role', key: e => e.role?.name || 'N/A', w: 80 },
      { label: 'Department', key: e => e.department || 'N/A', w: 80 },
      { label: 'Designation', key: e => e.designation || 'N/A', w: 100 },
      { label: 'Phone', key: e => e.phone || 'N/A', w: 80 },
      { label: 'Status', key: e => e.isActive ? 'Active' : 'Inactive', w: 52 },
    ];

    const marginL = 30;
    const tableW = cols.reduce((s, c) => s + c.w, 0);
    const rowH = 20;
    const headerH = 24;
    const pageH = doc.page.height;
    const pageW = doc.page.width;

    // ── Draw table header ──
    const drawHeader = (y) => {
      let x = marginL;
      // Header background
      doc.rect(marginL, y, tableW, headerH).fill(HEADER_BG);
      // Header text
      doc.fillColor(TEXT_LIGHT).font('Helvetica-Bold').fontSize(8);
      cols.forEach(col => {
        doc.text(col.label, x + 4, y + 7, { width: col.w - 8, lineBreak: false });
        x += col.w;
      });
    };

    // ── Draw a single data row ──
    const drawRow = (emp, idx, y) => {
      const bg = idx % 2 === 0 ? '#ffffff' : ROW_ALT;
      let x = marginL;
      // row background
      doc.rect(marginL, y, tableW, rowH).fill(bg);
      // cell borders (vertical)
      doc.strokeColor(BORDER).lineWidth(0.3);
      cols.forEach(col => {
        doc.rect(x, y, col.w, rowH).stroke();
        x += col.w;
      });
      // cell text
      x = marginL;
      doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(7.5);
      cols.forEach((col, ci) => {
        const val = typeof col.key === 'function' ? col.key(emp, idx) : '';
        // Status badge colour
        if (col.label === 'Status') {
          doc.fillColor(emp.isActive ? '#16a34a' : '#dc2626').font('Helvetica-Bold');
        } else {
          doc.fillColor(TEXT_DARK).font('Helvetica');
        }
        doc.text(val, x + 4, y + 6, { width: col.w - 8, lineBreak: false, ellipsis: true });
        x += col.w;
      });
    };

    // ── Document title ──
    doc.rect(0, 0, pageW, 50).fill(HEADER_BG);
    doc.fillColor(LIME).font('Helvetica-Bold').fontSize(16)
      .text('Employee Records', marginL, 15);
    doc.fillColor(TEXT_LIGHT).font('Helvetica').fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  Total: ${employees.length} employees`, marginL, 34);

    let y = 65;
    drawHeader(y);
    y += headerH;

    employees.forEach((emp, i) => {
      if (y + rowH > pageH - 30) {
        doc.addPage();
        y = 30;
        drawHeader(y);
        y += headerH;
      }
      drawRow(emp, i, y);
      y += rowH;
    });

    // outer border
    doc.strokeColor(GREEN).lineWidth(0.8)
      .rect(marginL, 65, tableW, y - 65).stroke();

    // footer
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(7)
      .text('Confidential — HRMS', marginL, pageH - 20, { align: 'center', width: tableW });

    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ message: 'Error exporting PDF' });
  }
});

// Export Employees to Word
router.get('/export/word', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    const employees = await User.find()
      .select('-password')
      .populate('role')
      .sort({ createdAt: -1 });

    // Create table rows
    const tableRows = [
      // Header row
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Employee ID', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'First Name', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Last Name', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Email', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Role', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Department', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Status', bold: true })] }),
        ],
      }),
      // Data rows
      ...employees.map(emp => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(emp.employeeId || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.firstName || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.lastName || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.email || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.role ? emp.role.name : 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.department || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.isActive ? 'Active' : 'Inactive')] }),
        ],
      })),
    ];

    const doc = new DocxDocument({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Employees List',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename="employees.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Word:', error);
    res.status(500).json({ message: 'Error exporting Word document' });
  }
});

// GET /employees/gender-stats — male/female counts overall and per department
// MUST be before /:id to avoid Express matching 'gender-stats' as an ID
router.get('/gender-stats', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    // Build match stage — filter by month if provided (?month=YYYY-MM)
    const matchStage = {};
    if (req.query.month) {
      const [year, month] = req.query.month.split('-').map(Number);
      if (year && month) {
        const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        matchStage.joiningDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    const pipeline = [];
    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });

    pipeline.push(
      {
        $group: {
          _id: {
            department: {
              $cond: [
                { $or: [{ $eq: ['$department', ''] }, { $eq: ['$department', null] }] },
                'Unassigned',
                '$department'
              ]
            },
            gender: { $toLower: { $ifNull: ['$gender', ''] } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.department': 1 } }
    );

    const results = await User.aggregate(pipeline);

    const deptMap = {};
    results.forEach(({ _id, count }) => {
      const dept = _id.department;
      if (!deptMap[dept]) deptMap[dept] = { total: 0, male: 0, female: 0 };
      deptMap[dept].total += count;
      if (_id.gender === 'male' || _id.gender === 'm') deptMap[dept].male += count;
      else if (_id.gender === 'female' || _id.gender === 'f') deptMap[dept].female += count;
    });

    const departments = Object.entries(deptMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, counts]) => ({ name, ...counts }));

    const overall = departments.reduce(
      (acc, d) => { acc.total += d.total; acc.male += d.male; acc.female += d.female; return acc; },
      { total: 0, male: 0, female: 0 }
    );

    res.json({ departments, overall });
  } catch (error) {
    console.error('Error fetching gender stats:', error);
    res.status(500).json({ message: 'Error fetching gender statistics' });
  }
});

// Get employee summary (accessible to any authenticated user for CRM attribution)
router.get('/:id/summary', auth, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id)
      .select('firstName lastName email employeeId joiningDate role department designation phone')
      .populate('role', 'name');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const Lead = require('../models/Lead');
    const totalLeadsAdded = await Lead.countDocuments({ createdBy: employee._id });

    const data = employee.toObject();
    data.totalLeadsAdded = totalLeadsAdded;

    res.json(data);
  } catch (error) {
    console.error('Error fetching employee summary:', error);
    res.status(500).json({ message: 'Error fetching employee summary' });
  }
});

// Get single employee
router.get('/:id', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    const employee = await User.findById(req.params.id)
      .select('-password')
      .populate('role');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee' });
  }
});

// Create employee
router.post('/', auth, checkPermission('employees', 'create'), (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const data = { ...req.body };

      // Add file paths if they exist
      if (req.files) {
        if (req.files.aadharCard) data.aadharCard = req.files.aadharCard[0].path;
        if (req.files.panCard) data.panCard = req.files.panCard[0].path;
        if (req.files.markSheet10) data.markSheet10 = req.files.markSheet10[0].path;
        if (req.files.markSheet12) data.markSheet12 = req.files.markSheet12[0].path;
        if (req.files.graduation) data.graduation = req.files.graduation[0].path;
        if (req.files.otherDocs) data.otherDocs = req.files.otherDocs[0].path;
      }

      if (!data.shiftType || data.shiftType.trim() === '') {
        return res.status(400).json({ message: 'Shift type is required' });
      }

      data.shiftHistory = [{
        shiftType: data.shiftType,
        startDate: new Date(),
        endDate: null,
        updatedBy: req.user._id
      }];

      const employee = await User.create(data);

      // Create Document collection records for all uploaded documents
      const Document = require('../models/Document');
      const docFieldMap = {
        aadharCard:  { title: 'Aadhar Card',           category: 'Aadhar Card' },
        panCard:     { title: 'PAN Card',               category: 'PAN Card' },
        markSheet10: { title: '10th Marksheet',         category: 'Marksheet' },
        markSheet12: { title: '12th Marksheet',         category: 'Marksheet' },
        graduation:  { title: 'Graduation Certificate', category: 'Degree Certificate' },
        otherDocs:   { title: 'Other Document',         category: 'Other' },
      };

      if (req.files) {
        for (const [field, meta] of Object.entries(docFieldMap)) {
          if (req.files[field] && req.files[field][0]) {
            const file = req.files[field][0];
            const normalizedPath = file.path.replace(/\\/g, '/');
            await Document.create({
              title: meta.title,
              category: meta.category,
              filename: file.originalname || path.basename(normalizedPath),
              filepath: normalizedPath,
              filesize: file.size,
              mimetype: file.mimetype,
              uploadedBy: req.user._id,
              user: employee._id,
              status: 'approved'
            }).catch(err => console.error('Error creating document on employee create:', err));
          }
        }
      }

      const employeeData = await User.findById(employee._id)
        .select('-password')
        .populate('role');

      res.status(201).json(employeeData);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email or Employee ID already exists' });
      }
      res.status(500).json({ message: error.message || 'Error creating employee' });
    }
  });
});

// Bulk update gender for multiple employees — MUST be before /:id
// Body: { updates: [{ id: "...", gender: "male"|"female"|"other" }, ...] }
router.put('/bulk/gender', auth, checkPermission('employees', 'update'), async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'updates array is required' });
    }

    const validGenders = ['male', 'female', 'other', ''];
    const ops = updates
      .filter(u => u.id && validGenders.includes((u.gender || '').toLowerCase()))
      .map(u => ({
        updateOne: {
          filter: { _id: u.id },
          update: { $set: { gender: u.gender.toLowerCase() } },
        },
      }));

    if (ops.length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    const result = await User.bulkWrite(ops);
    res.json({ updated: result.modifiedCount, total: ops.length });
  } catch (error) {
    console.error('Error bulk-updating gender:', error);
    res.status(500).json({ message: 'Error updating genders' });
  }
});

  // Update employee
  router.put('/:id', auth, checkPermission('employees', 'update'), async (req, res) => {
    try {
      const { password, ...updateData } = req.body;
  
      const existingEmployee = await User.findById(req.params.id);
      if (!existingEmployee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      if (updateData.shiftType !== undefined && updateData.shiftType !== existingEmployee.shiftType) {
        if (!updateData.shiftType) {
          updateData.shiftStartTime = '';
          updateData.shiftEndTime = '';
        }

        // Fetch Attendance for today to check if they checked in
        const Attendance = require('../models/Attendance');
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todayAttendance = await Attendance.findOne({
          employee: req.params.id,
          date: { $gte: todayStart, $lte: todayEnd },
          loginTime: { $ne: null }
        });

        // Determine effective date for new shift
        // If they checked in today, change applies from tomorrow. Else today.
        let effectiveDate = new Date();
        effectiveDate.setHours(0, 0, 0, 0); // start of today
        
        if (todayAttendance) {
           effectiveDate.setDate(effectiveDate.getDate() + 1); // start of tomorrow
        }

        // Close current active shift history if exists
        let history = existingEmployee.shiftHistory || [];
        if (history.length > 0) {
           const activeIndex = history.findIndex(h => !h.endDate);
           if (activeIndex !== -1) {
              history[activeIndex].endDate = effectiveDate;
           }
        } else if (existingEmployee.shiftType) {
           // If no history exists, backfill the previous shift with a start date far in past
           history.push({
              shiftType: existingEmployee.shiftType,
              startDate: new Date('2000-01-01'), // generic past date
              endDate: effectiveDate,
              updatedBy: req.user._id
           });
        }
        
        if (updateData.shiftType) {
          // Push new shift
          history.push({
             shiftType: updateData.shiftType,
             startDate: effectiveDate,
             endDate: null,
             updatedBy: req.user._id
          });
        }
        
        updateData.shiftHistory = history;
      }

      const employee = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password').populate('role');
  
      res.json(employee);
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({ message: error.message || 'Error updating employee' });
    }
  });

// Change employee password
router.put('/:id/change-password', auth, checkPermission('employees', 'update'), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update password (will be hashed by the pre-save middleware)
    employee.password = newPassword;
    await employee.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Delete employee
router.delete('/:id', auth, checkPermission('employees', 'delete'), async (req, res) => {
  try {
    const employee = await User.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting employee' });
  }
});

module.exports = router;
