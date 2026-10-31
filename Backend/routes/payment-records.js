const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const router = express.Router();
const PaymentRecord = require('../models/PaymentRecord');
const Deal = require('../models/Deal');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendCrmNotification } = require('../utils/crmNotifier');

// Robust helper to sync Project paidAmount and paymentStatus from PaymentRecord collection
async function syncProjectPaymentStatusAndPaidAmount(projectId, fallbackProjectName, fallbackClientName) {
  try {
    let targetProject = null;
    if (projectId) {
      if (mongoose.isValidObjectId(projectId)) {
        targetProject = await Project.findById(projectId);
      }
      if (!targetProject) {
        targetProject = await Project.findOne({ projectId: String(projectId) });
      }
    }
    if (!targetProject && fallbackProjectName) {
      const pNameRegex = new RegExp('^' + fallbackProjectName.trim() + '$', 'i');
      const cQuery = { name: pNameRegex };
      if (fallbackClientName) {
        cQuery.clientName = new RegExp('^' + fallbackClientName.trim() + '$', 'i');
      }
      targetProject = await Project.findOne(cQuery);
    }

    if (!targetProject) return null;

    // Find all payment records for this project
    const matchConditions = [];
    if (targetProject._id) matchConditions.push({ projectId: targetProject._id });
    if (targetProject.projectId) matchConditions.push({ projectId: targetProject.projectId });
    if (targetProject.name) {
      matchConditions.push({
        projectName: targetProject.name,
        ...(targetProject.clientName ? { clientName: targetProject.clientName } : {})
      });
    }

    const allRecords = await PaymentRecord.find({ $or: matchConditions });
    const totalPaid = allRecords
      .filter(r => (r.paymentStatus || 'Paid').toLowerCase() === 'paid')
      .reduce((sum, r) => sum + (parseFloat(String(r.paidAmount).replace(/[^0-9.-]/g, '')) || 0), 0);

    const baseVal = targetProject.projectValue || targetProject.budget || targetProject.totalAmount || 0;
    let newStatus = 'Unpaid';
    if (baseVal > 0 && totalPaid >= baseVal) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partially Paid';
    } else if (baseVal <= 0 && totalPaid > 0) {
      newStatus = 'Paid';
    }

    // Direct update to bypass schema validations
    await Project.updateOne(
      { _id: targetProject._id },
      {
        $set: {
          paidAmount: totalPaid,
          paymentStatus: newStatus
        }
      }
    );

    return { totalPaid, newStatus };
  } catch (err) {
    console.error('Error in syncProjectPaymentStatusAndPaidAmount:', err);
    return null;
  }
}


// Get payment records (optional filter by dealId, contactId, or projectId)
router.get('/', auth, async (req, res) => {
  try {
    const { dealId, contactId, projectId } = req.query;
    let query = {};
    if (dealId) query.dealId = dealId;
    if (contactId) query.contactId = contactId;
    if (projectId) {
      query.$or = [{ projectId: projectId }, { dealId: projectId }];
    }

    const records = await PaymentRecord.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (error) {
    console.error('Get payment records error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new payment record
router.post('/', auth, async (req, res) => {
  try {
    const {
      projectId,
      dealId,
      contactId,
      srNo,
      clientName,
      clientEmail,
      projectName,
      paidAmount,
      paymentMode,
      paymentStatus,
      paymentDate,
      recordedOnDate,
      recordedOnTime,
      recordedOn,
      attachmentName,
      notes
    } = req.body;

    const now = new Date();
    const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

    const newRecord = new PaymentRecord({
      projectId: projectId || null,
      dealId: dealId || null,
      contactId: contactId || null,
      srNo: srNo || 1,
      clientName,
      clientEmail: clientEmail || '',
      projectName,
      paidAmount,
      paymentMode: paymentMode || 'Bank Transfer',
      paymentStatus: paymentStatus || 'Paid',
      paymentDate: paymentDate || defaultRecordedDate,
      recordedOnDate: recordedOnDate || defaultRecordedDate,
      recordedOnTime: recordedOnTime || defaultRecordedTime,
      recordedOn: recordedOn || `${recordedOnDate || defaultRecordedDate}, ${recordedOnTime || defaultRecordedTime}`,
      attachmentName: attachmentName || '',
      notes: notes || '',
      createdBy: req.user?._id || null
    });

    await newRecord.save();

    // 0. Sync paid amount to Project if associated with a project
    if (projectId || projectName) {
      await syncProjectPaymentStatusAndPaidAmount(projectId, projectName, clientName);
    }

    // 1. Sync activity to Deal if associated with a deal
    let deal = null;
    if (dealId) {
      try {
        deal = await Deal.findById(dealId);
        if (deal) {
          const authorName = req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Admin System';
          const newActivity = {
            id: `pay-act-${newRecord._id}`,
            type: 'payment',
            title: 'Payment Recorded',
            content: `Recorded payment of ${paidAmount} via ${paymentMode || 'Bank Transfer'}. Status: ${paymentStatus || 'Paid'}.${attachmentName ? ` (Attachment: ${attachmentName})` : ''}`,
            author: authorName,
            time: (recordedOnTime || defaultRecordedTime).toUpperCase(),
            date: paymentDate || defaultRecordedDate,
            createdAt: now.toISOString(),
            timestamp: Date.now()
          };

          if (!Array.isArray(deal.activities)) {
            deal.activities = [];
          }
          deal.activities.unshift(newActivity);
          await deal.save();
        }
      } catch (actErr) {
        console.warn('Sync deal activity for payment record error:', actErr.message);
      }
    }

    // 2. Trigger CRM real-time notification
    try {
      const io = req.app.get('socketio');
      const actor = req.user ? await User.findById(req.user._id).populate('role') : null;
      if (actor) {
        const targetLink = dealId ? `/pipeline?tab=deals&dealId=${dealId}` : (contactId ? `/pipeline?tab=contacts&contactId=${contactId}` : '/pipeline');
        const displayInfo = `${paidAmount} for ${clientName || (deal ? (deal.dealName || deal.clientName) : 'Client')}`;

        sendCrmNotification(io, {
          actorUser: actor,
          entityType: 'Payment',
          action: 'create',
          entityName: displayInfo,
          assigneeUser: deal ? deal.assignedTo : null,
          assigneeName: deal ? deal.salesOwner : '',
          link: targetLink
        });
      }
    } catch (notifErr) {
      console.error('Payment create notification error:', notifErr);
    }

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Create payment record error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a payment record (e.g. status change, amount change, mode change)
router.put('/:id', auth, async (req, res) => {
  try {
    const record = await PaymentRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    const {
      clientName,
      clientEmail,
      projectName,
      paidAmount,
      paymentMode,
      paymentStatus,
      paymentDate,
      attachmentName,
      notes
    } = req.body;

    if (clientName) record.clientName = clientName;
    if (clientEmail !== undefined) record.clientEmail = clientEmail;
    if (projectName) record.projectName = projectName;
    if (paidAmount !== undefined) record.paidAmount = paidAmount;
    if (paymentMode) record.paymentMode = paymentMode;
    if (paymentStatus) record.paymentStatus = paymentStatus;
    if (paymentDate) record.paymentDate = paymentDate;
    if (attachmentName !== undefined) record.attachmentName = attachmentName;
    if (notes !== undefined) record.notes = notes;

    await record.save();

    // Sync project paidAmount & paymentStatus if associated with a project
    if (record.projectId || record.projectName) {
      await syncProjectPaymentStatusAndPaidAmount(record.projectId, record.projectName, record.clientName);
    }

    // Trigger CRM notification on update
    try {
      const io = req.app.get('socketio');
      const actor = req.user ? await User.findById(req.user._id).populate('role') : null;
      if (actor) {
        let deal = null;
        if (record.dealId) {
          deal = await Deal.findById(record.dealId);
        }
        const targetLink = record.dealId ? `/pipeline?tab=deals&dealId=${record.dealId}` : (record.contactId ? `/pipeline?tab=contacts&contactId=${record.contactId}` : '/pipeline');
        const displayInfo = `${record.paidAmount} (${record.paymentStatus}) for ${record.clientName || (deal ? (deal.dealName || deal.clientName) : 'Client')}`;

        sendCrmNotification(io, {
          actorUser: actor,
          entityType: 'Payment',
          action: 'update',
          entityName: displayInfo,
          assigneeUser: deal ? deal.assignedTo : null,
          assigneeName: deal ? deal.salesOwner : '',
          link: targetLink
        });
      }
    } catch (notifErr) {
      console.error('Payment update notification error:', notifErr);
    }

    res.json(record);
  } catch (error) {
    console.error('Update payment record error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a payment record
router.delete('/:id', auth, async (req, res) => {
  try {
    const record = await PaymentRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    await PaymentRecord.findByIdAndDelete(req.params.id);

    // Sync paid amount on Project if associated with a project
    if (record.projectId || record.projectName) {
      await syncProjectPaymentStatusAndPaidAmount(record.projectId, record.projectName, record.clientName);
    }

    // Trigger CRM notification on delete
    try {
      const io = req.app.get('socketio');
      const actor = req.user ? await User.findById(req.user._id).populate('role') : null;
      if (actor) {
        let deal = null;
        if (record.dealId) {
          deal = await Deal.findById(record.dealId);
        }
        const targetLink = record.dealId ? `/pipeline?tab=deals&dealId=${record.dealId}` : (record.contactId ? `/pipeline?tab=contacts&contactId=${record.contactId}` : '/pipeline');
        const displayInfo = `${record.paidAmount} for ${record.clientName || (deal ? (deal.dealName || deal.clientName) : 'Client')}`;

        sendCrmNotification(io, {
          actorUser: actor,
          entityType: 'Payment',
          action: 'delete',
          entityName: displayInfo,
          assigneeUser: deal ? deal.assignedTo : null,
          assigneeName: deal ? deal.salesOwner : '',
          link: targetLink
        });
      }
    } catch (notifErr) {
      console.error('Payment delete notification error:', notifErr);
    }

    res.json({ message: 'Payment record deleted successfully' });
  } catch (error) {
    console.error('Delete payment record error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update milestone status (e.g. default Milestone 3 status)
router.put('/milestone-status/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const { milestoneKey, status } = req.body; // e.g. milestoneKey: "3", status: "Paid"

    const deal = await Deal.findById(targetId);
    if (deal) {
      if (!deal.milestoneStatuses) {
        deal.milestoneStatuses = new Map();
      }
      deal.milestoneStatuses.set(milestoneKey, status);
      await deal.save();
      return res.json({ success: true, milestoneStatuses: deal.milestoneStatuses });
    }

    res.json({ success: true, targetId, milestoneKey, status });
  } catch (error) {
    console.error('Update milestone status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
