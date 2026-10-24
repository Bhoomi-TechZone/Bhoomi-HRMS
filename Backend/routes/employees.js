const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const User = require('../models/User');
const Role = require('../models/Role');
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


// Helper to format dates cleanly for reports
const formatExportDate = (d) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return 'N/A';
  }
};

// Helper to query employees for export respecting all active filters
const getExportEmployees = async (req) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const { ids, status, role, department, search, quickFilter } = params || {};

  const queryObj = {};

  // Status filter (active / inactive)
  if (status === 'active') {
    queryObj.isActive = true;
  } else if (status === 'inactive') {
    queryObj.isActive = false;
  }

  // If specific IDs array passed from UI (matches current filtered table)
  if (ids) {
    const idList = Array.isArray(ids) ? ids : (typeof ids === 'string' ? ids.split(',').map(s => s.trim()).filter(Boolean) : []);
    if (idList.length > 0) {
      queryObj._id = { $in: idList };
    }
  }

  // If IDs were not provided, apply individual filters
  if (!queryObj._id) {
    if (role && role !== 'all' && role !== '') {
      queryObj.role = role;
    }

    if (department && department !== 'all' && department !== '') {
      queryObj.department = department;
    }

    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      const regex = new RegExp(q, 'i');
      queryObj.$or = [
        { firstName: regex },
        { lastName: regex },
        { employeeId: regex },
        { email: regex },
        { officialEmail: regex },
        { phone: regex },
        { department: regex },
        { designation: regex }
      ];
    }

    if (quickFilter === 'developers' || quickFilter === 'sales') {
      const kw = quickFilter === 'developers' ? /developer|dev/i : /sales|business development|bde/i;
      const matchingRoles = await Role.find({ name: kw }).select('_id');
      const rIds = matchingRoles.map(r => r._id);
      if (!queryObj.role) {
        queryObj.role = { $in: rIds };
      }
    } else if (quickFilter === 'newJoinees') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      queryObj.createdAt = { $gte: thirtyDaysAgo };
    }
  }

  const employees = await User.find(queryObj)
    .select('-password')
    .populate('role')
    .populate('assignedManager', 'firstName lastName employeeId designation')
    .sort({ employeeId: 1, createdAt: -1 });

  return { employees, params };
};

// Export Employees to Excel (Full details entered during Add Employee)
const exportEmployeesToExcel = async (req, res) => {
  try {
    const { employees, params } = await getExportEmployees(req);

    const data = employees.map((emp, i) => {
      const managerName = emp.assignedManager
        ? `${emp.assignedManager.firstName || ''} ${emp.assignedManager.lastName || ''} (${emp.assignedManager.employeeId || ''})`.trim()
        : 'N/A';

      const shiftTimings = (emp.shiftStartTime && emp.shiftEndTime)
        ? `${emp.shiftStartTime} - ${emp.shiftEndTime}`
        : (emp.shiftStartTime || emp.shiftEndTime || 'N/A');

      const shiftTypeName = emp.shiftType
        ? emp.shiftType.charAt(0).toUpperCase() + emp.shiftType.slice(1)
        : 'N/A';

      const formatDoc = (docPath) => (docPath && String(docPath).trim().length > 0 ? 'Uploaded' : 'Not Uploaded');

      return {
        '#': i + 1,
        'Employee ID': emp.employeeId || 'N/A',
        'First Name': emp.firstName || '',
        'Last Name': emp.lastName || '',
        'Full Name': `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
        'Status': emp.isActive ? 'Active' : 'Inactive',
        'Role': emp.role?.name || 'N/A',
        'Department': emp.department || 'N/A',
        'Designation': emp.designation || 'N/A',
        'Reporting Manager': managerName,
        'Date of Joining': formatExportDate(emp.joiningDate),
        'Gender': emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : 'N/A',
        'Date of Birth': formatExportDate(emp.dateOfBirth),
        'Father Name': emp.fatherName || 'N/A',
        'Highest Qualification': emp.highestQualification || 'N/A',
        'Primary Phone': emp.phone || 'N/A',
        'Alternate Phone': emp.alternatePhone || 'N/A',
        'Login Email': emp.email || 'N/A',
        'Official Email': emp.officialEmail || 'N/A',
        'Aadhaar Number': emp.aadharNumber || 'N/A',
        'Current Address': emp.currentAddress || 'N/A',
        'Permanent Address': emp.permanentAddress || 'N/A',
        'Shift Type': shiftTypeName,
        'Shift Timings': shiftTimings,
        'Bank Name': emp.bankName || 'N/A',
        'Account Holder Name': emp.accountHolderName || 'N/A',
        'Account Number': emp.accountNumber || 'N/A',
        'IFSC Code': emp.ifscCode || 'N/A',
        'PAN Number': emp.panNumber || 'N/A',
        'UPI ID': emp.upiId || 'N/A',
        'Bank Verification Status': emp.bankDetailsStatus ? emp.bankDetailsStatus.toUpperCase() : 'PENDING',
        'Aadhaar Card': formatDoc(emp.aadharCard),
        'PAN Card': formatDoc(emp.panCard),
        '10th Marksheet': formatDoc(emp.markSheet10),
        '12th Marksheet': formatDoc(emp.markSheet12),
        'Graduation Doc': formatDoc(emp.graduation),
        'Other Documents': formatDoc(emp.otherDocs),
        'Profile Created At': formatExportDate(emp.createdAt),
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 14 }, // Employee ID
      { wch: 14 }, // First Name
      { wch: 14 }, // Last Name
      { wch: 22 }, // Full Name
      { wch: 10 }, // Status
      { wch: 18 }, // Role
      { wch: 20 }, // Department
      { wch: 22 }, // Designation
      { wch: 24 }, // Reporting Manager
      { wch: 15 }, // Date of Joining
      { wch: 10 }, // Gender
      { wch: 15 }, // Date of Birth
      { wch: 20 }, // Father Name
      { wch: 22 }, // Highest Qualification
      { wch: 16 }, // Primary Phone
      { wch: 16 }, // Alternate Phone
      { wch: 28 }, // Login Email
      { wch: 28 }, // Official Email
      { wch: 16 }, // Aadhaar Number
      { wch: 35 }, // Current Address
      { wch: 35 }, // Permanent Address
      { wch: 14 }, // Shift Type
      { wch: 22 }, // Shift Timings
      { wch: 22 }, // Bank Name
      { wch: 22 }, // Account Holder Name
      { wch: 20 }, // Account Number
      { wch: 14 }, // IFSC Code
      { wch: 14 }, // PAN Number
      { wch: 20 }, // UPI ID
      { wch: 16 }, // Bank Verification Status
      { wch: 15 }, // Aadhaar Card
      { wch: 15 }, // PAN Card
      { wch: 15 }, // 10th Marksheet
      { wch: 15 }, // 12th Marksheet
      { wch: 18 }, // Graduation Doc
      { wch: 16 }, // Other Documents
      { wch: 15 }, // Created At
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Employees');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const statusLabel = params?.status ? `${params.status.charAt(0).toUpperCase() + params.status.slice(1)}_` : '';
    res.setHeader('Content-Disposition', `attachment; filename="Employees_${statusLabel}Complete_Report.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting employees excel:', error);
    res.status(500).json({ message: 'Error exporting employees' });
  }
};

// Export Employees to PDF (Directory overview + Complete 360° Profile Dossiers)
const exportEmployeesToPDF = async (req, res) => {
  try {
    const { employees, params } = await getExportEmployees(req);

    const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape', bufferPages: true });

    const statusLabel = params?.status ? `${params.status.charAt(0).toUpperCase() + params.status.slice(1)}_` : '';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Employees_${statusLabel}Complete_Report.pdf"`);
    doc.pipe(res);

    // ── Palette ──
    const GREEN_DARK = '#14532d';
    const GREEN_MED = '#166534';
    const GREEN_LIGHT = '#f0fdf4';
    const GREEN_BORDER = '#86efac';
    const LIME = '#bef264';
    const WHITE = '#ffffff';
    const SLATE_BG = '#f8fafc';
    const BORDER = '#cbd5e1';
    const TEXT_MAIN = '#0f172a';
    const TEXT_MUTED = '#64748b';
    const ACTIVE_BG = '#dcfce7';
    const ACTIVE_TEXT = '#15803d';
    const INACTIVE_BG = '#fee2e2';
    const INACTIVE_TEXT = '#b91c1c';

    const marginL = 28;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const contentW = pageW - marginL * 2; // 842 - 56 = 786 pt

    const activeFilterText = params?.status
      ? (params.status === 'active' ? 'Active Employees' : params.status === 'inactive' ? 'Inactive Employees' : 'All Employees')
      : 'All Filtered Employees';

    // ── Header Banner function ──
    const drawReportHeader = (yPos) => {
      doc.rect(0, 0, pageW, 52).fill(GREEN_DARK);

      doc.fillColor(LIME).font('Helvetica-Bold').fontSize(14)
        .text('BHOOMI TECHZONE', marginL, 12);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10)
        .text('EMPLOYEE MASTER DOSSIER — COMPLETE DETAILS', marginL + 160, 15);

      const sub = `Filter: ${activeFilterText}   ·   Total Records: ${employees.length} Employees   ·   Export Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      doc.fillColor('#e2e8f0').font('Helvetica').fontSize(8)
        .text(sub, marginL, 34);

      const badgeW = 120;
      const badgeX = pageW - marginL - badgeW;
      doc.roundedRect(badgeX, 14, badgeW, 24, 6).fill('#1e3a29');
      doc.roundedRect(badgeX, 14, badgeW, 24, 6).strokeColor('#86efac').lineWidth(0.8).stroke();
      doc.fillColor(LIME).font('Helvetica-Bold').fontSize(8.5)
        .text(`● ${activeFilterText.toUpperCase()}`, badgeX, 21, { width: badgeW, align: 'center' });

      return 62;
    };

    // ── Summary Table Columns ──
    const summaryCols = [
      { label: '#', w: 26, get: (e, i) => String(i + 1) },
      { label: 'Emp ID', w: 60, get: e => e.employeeId || 'N/A' },
      { label: 'Employee Name', w: 124, get: e => `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'N/A' },
      { label: 'Role', w: 85, get: e => e.role?.name || 'N/A' },
      { label: 'Department', w: 90, get: e => e.department || 'N/A' },
      { label: 'Designation', w: 105, get: e => e.designation || 'N/A' },
      { label: 'Contact Phone', w: 86, get: e => e.phone || 'N/A' },
      { label: 'Official Email', w: 105, get: e => e.officialEmail || e.email || 'N/A' },
      { label: 'Shift', w: 55, get: e => e.shiftType ? e.shiftType.toUpperCase() : 'N/A' },
      { label: 'Status', w: 50, get: e => e.isActive ? 'Active' : 'Inactive' },
    ];

    const drawSummaryTableHeader = (y) => {
      doc.rect(marginL, y, contentW, 20).fill(GREEN_MED);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(7.5);
      let curX = marginL;
      summaryCols.forEach(col => {
        doc.text(col.label, curX + 3, y + 6, { width: col.w - 6, lineBreak: false });
        curX += col.w;
      });
      return y + 20;
    };

    let y = drawReportHeader(0);

    doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(9)
      .text('DIRECTORY OVERVIEW', marginL, y);
    y += 14;

    y = drawSummaryTableHeader(y);

    const rowH = 17;
    employees.forEach((emp, idx) => {
      if (y + rowH > pageH - 40) {
        doc.addPage();
        y = drawReportHeader(0);
        doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(9)
          .text('DIRECTORY OVERVIEW (CONT.)', marginL, y);
        y += 14;
        y = drawSummaryTableHeader(y);
      }

      const bg = idx % 2 === 0 ? WHITE : SLATE_BG;
      doc.rect(marginL, y, contentW, rowH).fill(bg);
      doc.rect(marginL, y, contentW, rowH).strokeColor('#e2e8f0').lineWidth(0.4).stroke();

      let curX = marginL;
      summaryCols.forEach(col => {
        const val = col.get(emp, idx);
        if (col.label === 'Status') {
          doc.fillColor(emp.isActive ? ACTIVE_TEXT : INACTIVE_TEXT).font('Helvetica-Bold').fontSize(7);
        } else if (col.label === 'Emp ID' || col.label === 'Employee Name') {
          doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(7.5);
        } else {
          doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7);
        }
        doc.text(val, curX + 3, y + 4.5, { width: col.w - 6, lineBreak: false, ellipsis: true });
        curX += col.w;
      });

      y += rowH;
    });

    // ── Detailed Employee Profile Cards (360° Dossier) ──
    doc.addPage();
    y = drawReportHeader(0);

    doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(9.5)
      .text('EMPLOYEE COMPLETE DETAILS (360° DOSSIER)', marginL, y);
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(7.5)
      .text('Comprehensive profile records including personal, contact, job, shift, address, banking, and document statuses', marginL, y + 12);
    y += 26;

    const cardH = 228;
    const cardGap = 12;

    const drawEmployeeCard = (emp, index, cardY) => {
      const managerName = emp.assignedManager
        ? `${emp.assignedManager.firstName || ''} ${emp.assignedManager.lastName || ''} (${emp.assignedManager.employeeId || ''})`.trim()
        : 'N/A';

      const shiftTimings = (emp.shiftStartTime && emp.shiftEndTime)
        ? `${emp.shiftStartTime} - ${emp.shiftEndTime}`
        : (emp.shiftStartTime || emp.shiftEndTime || 'N/A');

      const shiftTypeName = emp.shiftType
        ? emp.shiftType.charAt(0).toUpperCase() + emp.shiftType.slice(1)
        : 'N/A';

      doc.roundedRect(marginL, cardY, contentW, cardH, 6).fill(WHITE);
      doc.roundedRect(marginL, cardY, contentW, cardH, 6).strokeColor(BORDER).lineWidth(0.8).stroke();

      const cardHeaderH = 24;
      doc.roundedRect(marginL, cardY, contentW, cardHeaderH, 6).fill(GREEN_LIGHT);
      doc.rect(marginL, cardY + 12, contentW, 12).fill(GREEN_LIGHT);
      doc.lineCap('butt').moveTo(marginL, cardY + cardHeaderH).lineTo(marginL + contentW, cardY + cardHeaderH)
        .strokeColor(GREEN_BORDER).lineWidth(0.8).stroke();

      const empTitle = `#${index + 1}  ${emp.firstName || ''} ${emp.lastName || ''}  (${emp.employeeId || 'No ID'})`;
      doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(9)
        .text(empTitle, marginL + 10, cardY + 6.5);

      const jobSub = `${emp.designation || 'N/A'}  ·  ${emp.role?.name || 'N/A'}  ·  Dept: ${emp.department || 'N/A'}`;
      doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(8)
        .text(jobSub, marginL + 250, cardY + 7.5);

      const statusPillW = 75;
      const statusPillH = 16;
      const statusPillX = marginL + contentW - statusPillW - 8;
      const statusPillY = cardY + 4;
      doc.roundedRect(statusPillX, statusPillY, statusPillW, statusPillH, 4)
        .fill(emp.isActive ? ACTIVE_BG : INACTIVE_BG);
      doc.fillColor(emp.isActive ? ACTIVE_TEXT : INACTIVE_TEXT).font('Helvetica-Bold').fontSize(7.5)
        .text(emp.isActive ? '● ACTIVE' : '● INACTIVE', statusPillX, statusPillY + 4, { width: statusPillW, align: 'center' });

      const col1X = marginL + 10;
      const col2X = marginL + 265;
      const col3X = marginL + 520;
      const innerY = cardY + cardHeaderH + 8;

      doc.strokeColor('#e2e8f0').lineWidth(0.6)
        .moveTo(col2X - 8, innerY).lineTo(col2X - 8, cardY + cardH - 6).stroke();
      doc.strokeColor('#e2e8f0').lineWidth(0.6)
        .moveTo(col3X - 8, innerY).lineTo(col3X - 8, cardY + cardH - 6).stroke();

      const renderField = (label, val, xPos, lineY, maxW = 240) => {
        doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7)
          .text(label + ':', xPos, lineY, { width: 75, lineBreak: false });
        doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.2)
          .text(String(val || 'N/A'), xPos + 78, lineY, { width: maxW - 78, lineBreak: false, ellipsis: true });
      };

      // ── COL 1: PERSONAL & CONTACT ──
      doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(7.5)
        .text('PERSONAL & CONTACT DETAILS', col1X, innerY);
      doc.strokeColor(GREEN_BORDER).lineWidth(0.5)
        .moveTo(col1X, innerY + 11).lineTo(col1X + 130, innerY + 11).stroke();

      let lY = innerY + 16;
      renderField('Personal Email', emp.email, col1X, lY, 245); lY += 14;
      renderField('Official Email', emp.officialEmail, col1X, lY, 245); lY += 14;
      renderField('Primary Phone', emp.phone, col1X, lY, 245); lY += 14;
      renderField('Alternate Phone', emp.alternatePhone, col1X, lY, 245); lY += 14;
      renderField('Gender', emp.gender ? emp.gender.toUpperCase() : 'N/A', col1X, lY, 245); lY += 14;
      renderField('Date of Birth', formatExportDate(emp.dateOfBirth), col1X, lY, 245); lY += 14;
      renderField('Father Name', emp.fatherName, col1X, lY, 245); lY += 14;
      renderField('Qualification', emp.highestQualification, col1X, lY, 245); lY += 14;
      renderField('Aadhaar No.', emp.aadharNumber, col1X, lY, 245); lY += 14;
      renderField('Joined Date', formatExportDate(emp.joiningDate), col1X, lY, 245); lY += 14;
      renderField('Created At', formatExportDate(emp.createdAt), col1X, lY, 245);

      // ── COL 2: EMPLOYMENT, SHIFT & ADDRESSES ──
      doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(7.5)
        .text('EMPLOYMENT & RESIDENTIAL INFO', col2X, innerY);
      doc.strokeColor(GREEN_BORDER).lineWidth(0.5)
        .moveTo(col2X, innerY + 11).lineTo(col2X + 145, innerY + 11).stroke();

      lY = innerY + 16;
      renderField('Employee ID', emp.employeeId, col2X, lY, 245); lY += 14;
      renderField('Department', emp.department, col2X, lY, 245); lY += 14;
      renderField('Designation', emp.designation, col2X, lY, 245); lY += 14;
      renderField('Role / Access', emp.role?.name, col2X, lY, 245); lY += 14;
      renderField('Reporting Mgr', managerName, col2X, lY, 245); lY += 14;
      renderField('Shift Type', shiftTypeName, col2X, lY, 245); lY += 14;
      renderField('Shift Timing', shiftTimings, col2X, lY, 245); lY += 14;
      renderField('Current Addr', emp.currentAddress, col2X, lY, 245); lY += 14;
      renderField('Permanent Addr', emp.permanentAddress, col2X, lY, 245); lY += 14;
      renderField('Work Status', emp.isActive ? 'Active Staff' : 'Deactivated / Relieved', col2X, lY, 245);

      // ── COL 3: BANKING & ATTACHMENTS ──
      doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(7.5)
        .text('BANKING & VERIFIED DOCUMENTS', col3X, innerY);
      doc.strokeColor(GREEN_BORDER).lineWidth(0.5)
        .moveTo(col3X, innerY + 11).lineTo(col3X + 150, innerY + 11).stroke();

      lY = innerY + 16;
      renderField('Bank Name', emp.bankName, col3X, lY, 250); lY += 14;
      renderField('Account Holder', emp.accountHolderName, col3X, lY, 250); lY += 14;
      renderField('Account No.', emp.accountNumber, col3X, lY, 250); lY += 14;
      renderField('IFSC Code', emp.ifscCode, col3X, lY, 250); lY += 14;
      renderField('PAN Number', emp.panNumber, col3X, lY, 250); lY += 14;
      renderField('UPI ID', emp.upiId, col3X, lY, 250); lY += 14;
      renderField('Bank Status', emp.bankDetailsStatus ? emp.bankDetailsStatus.toUpperCase() : 'PENDING', col3X, lY, 250); lY += 16;

      doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7)
        .text('Uploaded Document Checklist:', col3X, lY);
      lY += 11;

      const docCheck = (isUploaded, name) => isUploaded ? `[✓] ${name}` : `[ ] ${name}`;
      const docCol1 = [
        docCheck(Boolean(emp.aadharCard), 'Aadhaar Card'),
        docCheck(Boolean(emp.panCard), 'PAN Card'),
        docCheck(Boolean(emp.markSheet10), '10th Marksheet')
      ];
      const docCol2 = [
        docCheck(Boolean(emp.markSheet12), '12th Marksheet'),
        docCheck(Boolean(emp.graduation), 'Degree / Grad'),
        docCheck(Boolean(emp.otherDocs), 'Other Docs')
      ];

      doc.font('Helvetica').fontSize(6.8);
      docCol1.forEach((txt, di) => {
        const isUp = txt.startsWith('[✓]');
        doc.fillColor(isUp ? '#15803d' : '#94a3b8').text(txt, col3X, lY + di * 12);
      });
      docCol2.forEach((txt, di) => {
        const isUp = txt.startsWith('[✓]');
        doc.fillColor(isUp ? '#15803d' : '#94a3b8').text(txt, col3X + 120, lY + di * 12);
      });
    };

    employees.forEach((emp, index) => {
      if (y + cardH > pageH - 30) {
        doc.addPage();
        y = drawReportHeader(0);
        doc.fillColor(GREEN_DARK).font('Helvetica-Bold').fontSize(9.5)
          .text('EMPLOYEE COMPLETE DETAILS (CONT.)', marginL, y);
        y += 18;
      }

      drawEmployeeCard(emp, index, y);
      y += cardH + cardGap;
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
        .text(
          `Bhoomi TechZone HRMS — Confidential Employee Record   ·   Page ${i + 1} of ${range.count}`,
          marginL,
          pageH - 20,
          { align: 'center', width: contentW }
        );
    }

    doc.end();
  } catch (error) {
    console.error('Error exporting employees PDF:', error);
    res.status(500).json({ message: 'Error exporting employees PDF' });
  }
};

// Export Employees to Word
const exportEmployeesToWord = async (req, res) => {
  try {
    const { employees, params } = await getExportEmployees(req);

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: '#', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Emp ID', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Name', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Email', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Role', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Department', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Designation', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Phone', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Status', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Bank A/C', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'IFSC', bold: true })] }),
        ],
      }),
      ...employees.map((emp, i) => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(i + 1))] }),
          new TableCell({ children: [new Paragraph(emp.employeeId || 'N/A')] }),
          new TableCell({ children: [new Paragraph(`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.officialEmail || emp.email || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.role ? emp.role.name : 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.department || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.designation || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.phone || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.isActive ? 'Active' : 'Inactive')] }),
          new TableCell({ children: [new Paragraph(emp.accountNumber || 'N/A')] }),
          new TableCell({ children: [new Paragraph(emp.ifscCode || 'N/A')] }),
        ],
      })),
    ];

    const doc = new DocxDocument({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Employee Complete Records',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()} · Total Records: ${employees.length}`,
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
    const statusLabel = params?.status ? `${params.status.charAt(0).toUpperCase() + params.status.slice(1)}_` : '';
    res.setHeader('Content-Disposition', `attachment; filename="Employees_${statusLabel}Complete_Report.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Word:', error);
    res.status(500).json({ message: 'Error exporting Word document' });
  }
};

// Export routes - Support both GET and POST with active filter payload
router.get('/export/excel', auth, checkPermission('employees', 'read'), exportEmployeesToExcel);
router.post('/export/excel', auth, checkPermission('employees', 'read'), exportEmployeesToExcel);

router.get('/export/pdf', auth, checkPermission('employees', 'read'), exportEmployeesToPDF);
router.post('/export/pdf', auth, checkPermission('employees', 'read'), exportEmployeesToPDF);

router.get('/export/word', auth, checkPermission('employees', 'read'), exportEmployeesToWord);
router.post('/export/word', auth, checkPermission('employees', 'read'), exportEmployeesToWord);

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
