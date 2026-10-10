const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Asset = require('../models/Asset');

// Ensure signature is available as base64 and clean path in frontend
try {
  const pngSign = path.join(__dirname, '../../Frontend/public/nehamam_sign.png');
  const jpegSign = path.join(__dirname, '../../Frontend/public/nehamam sign.jpeg');
  const fileToUse = fs.existsSync(pngSign) ? pngSign : jpegSign;
  if (fs.existsSync(fileToUse)) {
    const data = fs.readFileSync(fileToUse);
    const mime = fileToUse.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const b64Export = path.join(__dirname, '../../Frontend/src/constants_nehaSign.js');
    const b64Str = `data:${mime};base64,${data.toString('base64')}`;
    fs.writeFileSync(b64Export, `export const NEHA_MAM_SIGNATURE = "${b64Str}";\nexport default NEHA_MAM_SIGNATURE;\n`);
  }
} catch (e) {
  console.error('Error syncing Neha Mam signature:', e);
}

// Helper to get next auto-incremented asset code AST001, AST002...
async function getNextAssetCode() {
  const allAssets = await Asset.find({}, 'assetId createdAt').sort({ createdAt: 1 });
  let maxNum = 0;
  allAssets.forEach(a => {
    if (a.assetId) {
      const match = a.assetId.match(/^AST(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return `AST${String(nextNum).padStart(3, '0')}`;
}

// Auto migrate legacy asset IDs like AST-MU8D6OJ1 to sequential AST001, AST002...
async function migrateLegacyAssetCodes() {
  try {
    const allAssets = await Asset.find({}).sort({ createdAt: 1 });
    const hasLegacy = allAssets.some(a => !a.assetId || !/^AST\d{3,}$/i.test(a.assetId));
    if (hasLegacy) {
      // Pass 1: Set temporary IDs to avoid duplicate key errors during swap
      for (let i = 0; i < allAssets.length; i++) {
        await Asset.updateOne({ _id: allAssets[i]._id }, { $set: { assetId: `__TEMP_AST__${i + 1}__` } });
      }
      // Pass 2: Assign sequential AST001, AST002...
      for (let i = 0; i < allAssets.length; i++) {
        const cleanCode = `AST${String(i + 1).padStart(3, '0')}`;
        await Asset.updateOne({ _id: allAssets[i]._id }, { $set: { assetId: cleanCode } });
      }
    }
  } catch (err) {
    console.error('Error migrating legacy asset codes:', err);
  }
}

// Get all assets (employee sees their assigned assets, admin sees all)
router.get('/', auth, async (req, res) => {
  try {
    await migrateLegacyAssetCodes();

    let query = {};
    
    // Check if user has admin access (can create or delete assets)
    const hasFullAccess = req.user.role.permissions.find(
      p => p.module === 'assets' && (p.actions.includes('create') || p.actions.includes('delete'))
    );
    
    // If not admin, only show assets assigned to this user
    if (!hasFullAccess) {
      query.assignedTo = req.user._id;
    }
    
    const assets = await Asset.find(query)
      .populate('assignedTo', 'firstName lastName employeeId username designation department role joiningDate')
      .populate('assignedBy', 'firstName lastName employeeId username designation department role')
      .sort({ createdAt: -1 });
    
    res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ message: 'Error fetching assets' });
  }
});

// Get single asset with history
router.get('/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName employeeId username designation department role joiningDate')
      .populate('assignedBy', 'firstName lastName employeeId username designation department role')
      .populate('assignmentHistory.employee', 'firstName lastName employeeId username designation department role joiningDate')
      .populate('assignmentHistory.assignedBy', 'firstName lastName employeeId username designation department role');
    
    if (!asset) {
      return res.status(404).json({ message: `Asset with ID ${req.params.id} not found` });
    }
    
    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset details:', error);
    res.status(500).json({ message: 'Error fetching asset details', error: error.message });
  }
});

// Create asset
router.post('/', auth, checkPermission('assets', 'create'), async (req, res) => {
  try {
    const assetData = { ...req.body };
    if (!assetData.assetId || !/^AST\d{3,}$/i.test(assetData.assetId)) {
      assetData.assetId = await getNextAssetCode();
    }
    if (req.body.assignedTo) {
      assetData.assignedBy = req.user._id;
      assetData.assignedDate = new Date();
      assetData.signature = req.body.signature || '';
      assetData.acknowledgement = !!(req.body.signature || req.body.acknowledgement);
      assetData.acknowledgementText = req.body.acknowledgementText || '';
      assetData.signedAt = req.body.signature ? new Date() : null;
      assetData.assignmentHistory = [{
        employee: req.body.assignedTo,
        assignedBy: req.user._id,
        signature: req.body.signature || '',
        acknowledgement: !!(req.body.signature || req.body.acknowledgement),
        acknowledgementText: req.body.acknowledgementText || '',
        signedAt: req.body.signature ? new Date() : null,
        assignedDate: new Date()
      }];
    }
    const asset = await Asset.create(assetData);
    await asset.populate('assignedTo', 'firstName lastName employeeId username designation department role joiningDate');
    await asset.populate('assignedBy', 'firstName lastName employeeId username designation department role');
    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({ message: 'Error creating asset' });
  }
});

// Update asset (assign/unassign)
router.put('/:id', auth, checkPermission('assets', 'update'), async (req, res) => {
  try {
    const existingAsset = await Asset.findById(req.params.id);
    if (!existingAsset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const updateData = { ...req.body };
    
    // Handle assignment change history
    if (req.body.assignedTo !== undefined) {
      // 1. If currently assigned to someone, and it's being unassigned or changed
      if (existingAsset.assignedTo && existingAsset.assignedTo.toString() !== String(req.body.assignedTo)) {
        // Close current history record
        const historyIdx = existingAsset.assignmentHistory.findIndex(h => !h.returnedDate && h.employee && h.employee.toString() === existingAsset.assignedTo.toString());
        if (historyIdx !== -1) {
          existingAsset.assignmentHistory[historyIdx].returnedDate = new Date();
        } else {
          // Fallback for legacy assignments
          existingAsset.assignmentHistory.push({
            employee: existingAsset.assignedTo,
            assignedBy: existingAsset.assignedBy || null,
            signature: existingAsset.signature || '',
            acknowledgement: existingAsset.acknowledgement || false,
            acknowledgementText: existingAsset.acknowledgementText || '',
            signedAt: existingAsset.signedAt || null,
            assignedDate: existingAsset.assignedDate || existingAsset.updatedAt || new Date(),
            returnedDate: new Date()
          });
        }
      }

      // 2. If being assigned to someone new
      if (req.body.assignedTo && (!existingAsset.assignedTo || existingAsset.assignedTo.toString() !== req.body.assignedTo)) {
        updateData.assignedDate = new Date();
        updateData.assignedBy = req.user._id;
        updateData.status = 'assigned';
        updateData.issuerSignature = req.body.issuerSignature || '';
        updateData.issuerDeclarationText = req.body.issuerDeclarationText || '';
        updateData.signature = req.body.signature || '';
        updateData.acknowledgement = !!(req.body.signature || req.body.acknowledgement);
        updateData.acknowledgementText = req.body.acknowledgementText || '';
        updateData.signedAt = req.body.signature ? new Date() : null;
        
        if (!existingAsset.assignmentHistory) existingAsset.assignmentHistory = [];
        existingAsset.assignmentHistory.push({
          employee: req.body.assignedTo,
          assignedBy: req.user._id,
          issuerSignature: req.body.issuerSignature || '',
          issuerDeclarationText: req.body.issuerDeclarationText || '',
          signature: req.body.signature || '',
          acknowledgement: !!(req.body.signature || req.body.acknowledgement),
          acknowledgementText: req.body.acknowledgementText || '',
          signedAt: req.body.signature ? new Date() : null,
          assignedDate: new Date()
        });
        console.log(`Pushed new history record for employee: ${req.body.assignedTo} by ${req.user._id}`);
      } else if (req.body.assignedTo === null) {
        updateData.assignedDate = null;
        updateData.assignedBy = null;
        updateData.issuerSignature = '';
        updateData.issuerDeclarationText = '';
        updateData.signature = '';
        updateData.acknowledgement = false;
        updateData.acknowledgementText = '';
        updateData.signedAt = null;
        if (!req.body.status || req.body.status === 'assigned') {
          updateData.status = 'available';
        }
      }
    }

    // 3. Status changes (Maintenance / Available / Retired)
    if (req.body.status) {
      if (['maintenance', 'retired'].includes(req.body.status)) {
        if (existingAsset.assignedTo && req.body.assignedTo === undefined) {
          const historyIdx = existingAsset.assignmentHistory.findIndex(h => !h.returnedDate && h.employee && h.employee.toString() === existingAsset.assignedTo.toString());
          if (historyIdx !== -1) {
            existingAsset.assignmentHistory[historyIdx].returnedDate = new Date();
          }
          updateData.assignedTo = null;
          updateData.assignedBy = null;
          updateData.signature = '';
          updateData.acknowledgement = false;
          updateData.acknowledgementText = '';
          updateData.signedAt = null;
          updateData.assignedDate = null;
        }

        if (req.body.status === 'maintenance' && req.body.maintenanceDetails) {
          existingAsset.assignmentHistory.push({
            statusType: 'maintenance',
            maintenanceDetails: req.body.maintenanceDetails,
            assignedDate: new Date()
          });
        }
      } else if (req.body.status === 'available') {
        if (existingAsset.assignedTo && req.body.assignedTo === undefined) {
          const historyIdx = existingAsset.assignmentHistory.findIndex(h => !h.returnedDate && h.employee && h.employee.toString() === existingAsset.assignedTo.toString());
          if (historyIdx !== -1) {
            existingAsset.assignmentHistory[historyIdx].returnedDate = new Date();
          }
          updateData.assignedTo = null;
          updateData.assignedBy = null;
          updateData.signature = '';
          updateData.acknowledgement = false;
          updateData.acknowledgementText = '';
          updateData.signedAt = null;
          updateData.assignedDate = null;
        }
        // Close open maintenance records
        if (existingAsset.status === 'maintenance') {
          existingAsset.assignmentHistory.forEach(h => {
            if (h.statusType === 'maintenance' && !h.returnedDate) {
              h.returnedDate = new Date();
            }
          });
        }
      }
    }
    
    // Merge updateData into existingAsset
    Object.assign(existingAsset, updateData);
    
    // Explicitly tell Mongoose that assignmentHistory has changed
    existingAsset.markModified('assignmentHistory');
    
    const asset = await existingAsset.save();
    console.log(`Asset ${asset.assetId} updated. History count: ${asset.assignmentHistory.length}`);
    
    await asset.populate('assignedTo', 'firstName lastName employeeId username designation department role joiningDate');
    await asset.populate('assignedBy', 'firstName lastName employeeId username designation department role');
    await asset.populate('assignmentHistory.employee', 'firstName lastName employeeId username designation department role joiningDate');
    await asset.populate('assignmentHistory.assignedBy', 'firstName lastName employeeId username designation department role');
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    res.json(asset);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ message: 'Error updating asset', error: error.message });
  }
});

// Employee acknowledge asset & upload signature
router.post('/:id/acknowledge', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // Check if the current user is the assigned employee or has asset permissions
    const assignedId = asset.assignedTo ? asset.assignedTo.toString() : '';
    const currentUserId = req.user?._id ? req.user._id.toString() : (req.user?.id ? req.user.id.toString() : '');
    const currentUserEmpId = req.user?.employeeId ? req.user.employeeId.toString().trim().toLowerCase() : '';
    const currentUsername = req.user?.username ? req.user.username.toString().trim().toLowerCase() : '';

    let isAssignedEmployee = false;
    if (assignedId && currentUserId && assignedId === currentUserId) {
      isAssignedEmployee = true;
    } else if (assignedId) {
      const assignedUser = await User.findById(asset.assignedTo);
      if (assignedUser) {
        if (currentUserEmpId && assignedUser.employeeId && assignedUser.employeeId.trim().toLowerCase() === currentUserEmpId) {
          isAssignedEmployee = true;
        } else if (currentUsername && assignedUser.username && assignedUser.username.trim().toLowerCase() === currentUsername) {
          isAssignedEmployee = true;
        }
      }
    }

    const hasFullAccess = req.user?.role && Array.isArray(req.user.role.permissions) && req.user.role.permissions.some(
      p => p.module === 'assets' && (p.actions?.includes('update') || p.actions?.includes('create'))
    );

    if (!isAssignedEmployee && !hasFullAccess) {
      return res.status(403).json({ message: 'You are not authorized to acknowledge this asset' });
    }

    const { signature, acknowledgementText } = req.body;
    if (!signature) {
      return res.status(400).json({ message: 'Signature is required for acknowledgement' });
    }

    asset.signature = signature;
    asset.acknowledgement = true;
    asset.acknowledgementText = acknowledgementText || asset.acknowledgementText || '';
    asset.signedAt = new Date();

    // Update active assignment history record
    if (asset.assignmentHistory && Array.isArray(asset.assignmentHistory) && asset.assignmentHistory.length > 0) {
      const activeIdx = asset.assignmentHistory.findIndex(h => {
        if (h.returnedDate) return false;
        if (!h.employee || !asset.assignedTo) return false;
        return h.employee.toString() === asset.assignedTo.toString();
      });
      if (activeIdx !== -1) {
        asset.assignmentHistory[activeIdx].signature = signature;
        asset.assignmentHistory[activeIdx].acknowledgement = true;
        asset.assignmentHistory[activeIdx].acknowledgementText = acknowledgementText || asset.assignmentHistory[activeIdx].acknowledgementText || '';
        asset.assignmentHistory[activeIdx].signedAt = new Date();
      }
    }

    asset.markModified('assignmentHistory');
    await asset.save();

    await asset.populate([
      { path: 'assignedTo', select: 'firstName lastName employeeId username' },
      { path: 'assignedBy', select: 'firstName lastName employeeId username' },
      { path: 'assignmentHistory.employee', select: 'firstName lastName employeeId username' },
      { path: 'assignmentHistory.assignedBy', select: 'firstName lastName employeeId username' }
    ]);

    res.json(asset);
  } catch (error) {
    console.error('Error acknowledging asset:', error);
    res.status(500).json({ message: 'Error acknowledging asset', error: error.message });
  }
});

// Delete asset
router.delete('/:id', auth, checkPermission('assets', 'delete'), async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting asset' });
  }
});

module.exports = router;
