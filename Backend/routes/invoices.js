const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');

// Helper to check if role has full management/read access to invoices
const isManagementRole = (user) => {
  if (!user) return false;
  const roleName = ((user.role && user.role.name) || user.roleName || (typeof user.role === 'string' ? user.role : '')).toLowerCase().trim();
  const managementRoles = [
    'admin',
    'sales head',
    'saleshead',
    'head of sales',
    'team leader',
    'teamleader',
    'manager',
    'hr manager',
    'hr',
    'director',
    'project manager',
    'super admin',
    'superadmin',
    'accountant',
    'accounts',
    'finance',
    'finance manager',
    'billing'
  ];
  if (managementRoles.includes(roleName)) return true;

  const hasPerm = user.role && user.role.permissions && user.role.permissions.some(
    p => p.module && ['accounts', 'projects', 'invoices'].includes(p.module.toLowerCase()) && (p.actions.includes('read') || p.actions.includes('create'))
  );
  return !!hasPerm;
};

// GET /api/invoices - Fetch all invoices
router.get('/', auth, async (req, res) => {
  try {
    const hasFullAccess = isManagementRole(req.user);

    let query = {};
    if (!hasFullAccess) {
      // Non-management users can see invoices they created, or unassigned/synced invoices
      query = {
        $or: [
          { createdBy: req.user._id },
          { createdBy: null }
        ]
      };
    }

    const invoices = await Invoice.find(query)
      .populate('prefillProjectId', 'projectId name clientName totalAmount paidAmount')
      .populate('createdBy', 'firstName lastName employeeId email')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
});

// GET /api/invoices/next-number - Calculate next sequential invoice number
router.get('/next-number', auth, async (req, res) => {
  try {
    const category = req.query.category === 'proforma' ? 'proforma' : 'tax';
    const now = new Date();
    // Indian Financial Year: April 1 (month index 3) to March 31
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStr = `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;
    const prefix = category === 'proforma' ? 'PI' : 'BT';

    // Find all invoices with this prefix and FY (including legacy INV/ for tax invoices)
    const existingInvoices = await Invoice.find({
      $or: [
        { invoiceNo: { $regex: `^${prefix}/${fyStr}/`, $options: 'i' } },
        ...(category === 'tax' ? [{ invoiceNo: { $regex: `^INV/${fyStr}/`, $options: 'i' } }] : [])
      ]
    });

    let maxSeq = 0;
    existingInvoices.forEach(inv => {
      const match = (inv.invoiceNo || '').match(new RegExp(`^${prefix}/${fyStr}/(\\d+)`, 'i')) ||
                    (category === 'tax' ? (inv.invoiceNo || '').match(new RegExp(`^INV/${fyStr}/(\\d+)`, 'i')) : null);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });

    let nextNum;
    if (category === 'tax') {
      // For FY 26-27: sequence starts from 026. If maxSeq < 25, start from 26 (BT/26-27/026).
      // For future FYs (e.g. 27-28 on 1 April onwards): sequence starts from 001.
      if (fyStr === '26-27') {
        nextNum = maxSeq < 25 ? 26 : maxSeq + 1;
      } else {
        nextNum = maxSeq + 1;
      }
    } else {
      // Proforma invoice (PI) starts from 001 every financial year
      nextNum = maxSeq + 1;
    }

    const nextInvoiceNo = `${prefix}/${fyStr}/${String(nextNum).padStart(3, '0')}`;

    res.json({
      prefix,
      fyStr,
      nextSeq: nextNum,
      invoiceNo: nextInvoiceNo
    });
  } catch (error) {
    console.error('Error computing next invoice number:', error);
    res.status(500).json({ message: 'Error generating next invoice number' });
  }
});

// POST /api/invoices - Create or update an invoice
router.post('/', auth, async (req, res) => {
  try {
    const data = req.body;
    if (!data.invoiceNo || !data.clientName || !data.itemDescription) {
      return res.status(400).json({ message: 'invoiceNo, clientName, and itemDescription are required' });
    }

    const cleanInvoiceNo = String(data.invoiceNo).trim().replace(/^INV-PRJPRJ/i, 'INV-PRJ');
    const isProf = data.invoiceCategory === 'proforma' || cleanInvoiceNo.startsWith('PI/');

    const rateVal = parseFloat(data.rate) || 0;
    const qtyVal = parseFloat(data.qty) || 1;
    const discVal = parseFloat(data.discount) || 0;
    const lineTot = rateVal * qtyVal - discVal;
    const gstRateVal = parseFloat(data.gstRate) || 0;
    const noGstVal = data.gstType === 'none' || gstRateVal === 0;
    const isIgstVal = data.gstType === 'igst';
    const isCgstSgstVal = data.gstType === 'cgst_sgst' || (!isIgstVal && !noGstVal);
    const cgstVal = (!noGstVal && isCgstSgstVal) ? Math.round(lineTot * (gstRateVal / 200)) : 0;
    const sgstVal = (!noGstVal && isCgstSgstVal) ? Math.round(lineTot * (gstRateVal / 200)) : 0;
    const igstVal = (!noGstVal && isIgstVal) ? Math.round(lineTot * (gstRateVal / 100)) : 0;
    const grandTot = lineTot + cgstVal + sgstVal + igstVal;
    const advVal = parseFloat(data.advanceAmount) || 0;

    const invoicePayload = {
      invoiceNo: cleanInvoiceNo,
      invoiceCategory: isProf ? 'proforma' : 'tax',
      invoiceType: isProf ? 'Proforma Invoice' : 'Tax Invoice',
      invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      prefillProjectId: (data.prefillProjectId && mongoose.Types.ObjectId.isValid(data.prefillProjectId)) ? data.prefillProjectId : null,
      clientName: data.clientName,
      clientEmail: data.clientEmail || data.email || '',
      clientPhone: data.clientPhone || data.phone || '',
      clientAddress: data.clientAddress || '',
      clientCity: data.clientCity || '',
      clientPostalCode: data.clientPostalCode || '',
      clientState: data.clientState || '',
      clientGstin: data.clientGstin || '',
      clientPan: data.clientPan || '',
      projectName: data.projectName || data.itemDescription || '',
      itemDescription: data.itemDescription,
      itemDetails: data.itemDetails || data.description || '',
      description: data.itemDetails || data.description || '',
      hsnSac: data.hsnSac || '9975',
      qty: String(qtyVal),
      rate: String(rateVal),
      discount: String(discVal),
      gstType: data.gstType || 'cgst_sgst',
      gstRate: String(gstRateVal),
      advanceAmount: String(advVal),
      totalAmount: grandTot,
      baseAmount: lineTot,
      paidAmount: advVal,
      dueAmount: Math.max(0, grandTot - advVal),
      status: advVal >= grandTot && grandTot > 0 ? 'Paid' : advVal > 0 ? 'Partially Paid' : 'Unpaid',
      projectStatus: data.projectStatus || 'Active',
      generatedBy: data.generatedBy || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''} (${req.user.employeeId || 'ADMIN'})`.trim() : 'Admin'),
      generatedOn: data.generatedOn || new Date().toISOString(),
      rawForm: data.rawForm || data,
      createdBy: req.user?._id || null
    };

    // Upsert by invoiceNo with regex escaping
    const escapedInvoiceNo = cleanInvoiceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Invoice.findOne({ invoiceNo: { $regex: `^${escapedInvoiceNo}$`, $options: 'i' } });

    let savedInvoice;
    if (existing) {
      Object.assign(existing, invoicePayload);
      savedInvoice = await existing.save();
    } else {
      savedInvoice = await Invoice.create(invoicePayload);
    }

    res.status(201).json(savedInvoice);
  } catch (error) {
    console.error('Error saving invoice:', error);
    res.status(500).json({ message: 'Error saving invoice', error: error.message });
  }
});

// POST /api/invoices/bulk-sync - Sync multiple invoices from client cache/storage
router.post('/bulk-sync', auth, async (req, res) => {
  try {
    const { invoices } = req.body;
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.json({ syncedCount: 0, message: 'No invoices provided' });
    }

    let syncedCount = 0;
    for (const inv of invoices) {
      const invNo = String(inv.invoiceNo || inv.id || '').trim().replace(/^INV-PRJPRJ/i, 'INV-PRJ');
      if (!invNo || !inv.clientName) continue;

      const existing = await Invoice.findOne({ invoiceNo: { $regex: `^${invNo}$`, $options: 'i' } });
      if (!existing) {
        const isProf = inv.invoiceCategory === 'proforma' || invNo.startsWith('PI/');
        const rateVal = parseFloat(inv.rate) || 0;
        const qtyVal = parseFloat(inv.qty) || 1;
        const discVal = parseFloat(inv.discount) || 0;
        const lineTot = rateVal * qtyVal - discVal;
        const gstRateVal = parseFloat(inv.gstRate) || 0;
        const grandTot = inv.totalAmount !== undefined ? inv.totalAmount : (gstRateVal > 0 ? Math.round(lineTot * (1 + gstRateVal / 100)) : lineTot);
        const advVal = parseFloat(inv.advanceAmount || inv.paidAmount) || 0;

        await Invoice.create({
          invoiceNo: invNo,
          invoiceCategory: isProf ? 'proforma' : 'tax',
          invoiceType: isProf ? 'Proforma Invoice' : 'Tax Invoice',
          invoiceDate: inv.invoiceDate || inv.generatedOn || new Date().toISOString().split('T')[0],
          dueDate: inv.dueDate || new Date().toISOString().split('T')[0],
          prefillProjectId: inv.prefillProjectId && inv.prefillProjectId.length === 24 ? inv.prefillProjectId : null,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail || inv.email || '',
          clientPhone: inv.clientPhone || inv.phone || '',
          clientAddress: inv.clientAddress || '',
          clientCity: inv.clientCity || '',
          clientPostalCode: inv.clientPostalCode || '',
          clientState: inv.clientState || '',
          clientGstin: inv.clientGstin || '',
          clientPan: inv.clientPan || '',
          projectName: inv.projectName || inv.itemDescription || '',
          itemDescription: inv.itemDescription || inv.projectName || 'Services',
          itemDetails: inv.itemDetails || inv.description || '',
          description: inv.itemDetails || inv.description || '',
          hsnSac: inv.hsnSac || '9975',
          qty: String(qtyVal),
          rate: String(rateVal),
          discount: String(discVal),
          gstType: inv.gstType || 'cgst_sgst',
          gstRate: String(gstRateVal),
          advanceAmount: String(advVal),
          totalAmount: grandTot,
          baseAmount: lineTot,
          paidAmount: advVal,
          dueAmount: Math.max(0, grandTot - advVal),
          status: inv.status || 'Generated',
          projectStatus: inv.projectStatus || 'Active',
          generatedBy: inv.generatedBy || 'Admin System (ADMIN001)',
          generatedOn: inv.generatedOn || new Date().toISOString(),
          rawForm: inv.rawForm || inv,
          createdBy: req.user?._id || null
        });
        syncedCount++;
      }
    }

    res.json({ syncedCount, message: `Successfully synced ${syncedCount} invoices` });
  } catch (error) {
    console.error('Error bulk syncing invoices:', error);
    res.status(500).json({ message: 'Error syncing invoices', error: error.message });
  }
});

// PUT /api/invoices/:id - Update an invoice
router.put('/:id', auth, async (req, res) => {
  try {
    const idOrNo = req.params.id;
    let invoice = null;

    if (idOrNo.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await Invoice.findById(idOrNo);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNo: { $regex: `^${idOrNo}$`, $options: 'i' } });
    }

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Error updating invoice', error: error.message });
  }
});

// DELETE /api/invoices/:id - Delete an invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const idOrNo = req.params.id;
    let deleted = null;

    if (idOrNo.match(/^[0-9a-fA-F]{24}$/)) {
      deleted = await Invoice.findByIdAndDelete(idOrNo);
    }
    if (!deleted) {
      deleted = await Invoice.findOneAndDelete({ invoiceNo: { $regex: `^${idOrNo}$`, $options: 'i' } });
    }

    if (!deleted) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted successfully', invoice: deleted });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
});

module.exports = router;
