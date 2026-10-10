const express = require('express');
const router = express.Router();
const NDA = require('../models/NDA');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get active NDA
router.get('/active', auth, async (req, res) => {
  try {
    const nda = await NDA.findOne({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (!nda) {
      return res.json(null);
    }

    // Check if current user has agreed to this version
    const userAgreement = nda.agreementUsers.find(
      a => a.user.toString() === req.user._id.toString() && a.version === nda.version
    );

    res.json({
      ...nda.toObject(),
      hasAgreed: !!userAgreement,
      agreedAt: userAgreement?.agreedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all NDAs (Admin/HR only)
router.get('/', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('read')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const ndas = await NDA.find()
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(ndas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get NDA by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const nda = await NDA.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('agreementUsers.user', 'firstName lastName email');

    if (!nda) {
      return res.status(404).json({ message: 'NDA not found' });
    }

    res.json(nda);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create NDA (Admin/HR only)
router.post('/', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('create')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, content } = req.body;

    // Deactivate all existing NDAs
    await NDA.updateMany({}, { isActive: false });

    const nda = new NDA({
      title,
      content,
      version: 1,
      isActive: true,
      createdBy: req.user._id
    });

    await nda.save();

    // Notify all users (you can implement notification system here)
    // For now, we'll just return the NDA
    
    res.status(201).json(nda);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update NDA (Admin/HR only)
router.put('/:id', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('update')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, content } = req.body;
    const nda = await NDA.findById(req.params.id);

    if (!nda) {
      return res.status(404).json({ message: 'NDA not found' });
    }

    // Increment version if content changed
    const contentChanged = nda.content !== content;
    
    nda.title = title;
    nda.content = content;
    nda.updatedBy = req.user._id;
    
    if (contentChanged) {
      nda.version += 1;
      // Clear old agreements for new version (users need to re-agree)
      nda.agreementUsers = [];
    }

    await nda.save();

    res.json(nda);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete NDA (Admin/HR only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('delete')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const nda = await NDA.findById(req.params.id);

    if (!nda) {
      return res.status(404).json({ message: 'NDA not found' });
    }

    await nda.deleteOne();
    res.json({ message: 'NDA deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Agree to NDA
router.post('/:id/agree', auth, async (req, res) => {
  try {
    const nda = await NDA.findById(req.params.id);

    if (!nda) {
      return res.status(404).json({ message: 'NDA not found' });
    }

    // Check if user already agreed to this version
    const existingAgreement = nda.agreementUsers.find(
      a => a.user.toString() === req.user._id.toString() && a.version === nda.version
    );

    if (existingAgreement) {
      return res.status(400).json({ message: 'You have already agreed to this NDA version' });
    }

    // Add agreement
    nda.agreementUsers.push({
      user: req.user._id,
      agreedAt: new Date(),
      ipAddress: req.ip,
      version: nda.version
    });

    await nda.save();

    res.json({ message: 'NDA agreement recorded successfully', nda });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get users who haven't agreed to active NDA (Admin/HR only)
router.get('/pending/users', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('read')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const activeNDA = await NDA.findOne({ isActive: true });

    if (!activeNDA) {
      return res.json([]);
    }

    // Get all users
    const allUsers = await User.find({ isActive: true }).select('firstName lastName email');
    
    // Filter users who haven't agreed to current version
    const agreedUserIds = activeNDA.agreementUsers
      .filter(a => a.version === activeNDA.version)
      .map(a => a.user.toString());

    const pendingUsers = allUsers.filter(
      user => !agreedUserIds.includes(user._id.toString())
    );

    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get NDA statistics (Admin/HR only)
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('read')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const activeNDA = await NDA.findOne({ isActive: true });
    const totalUsers = await User.countDocuments({ isActive: true });

    if (!activeNDA) {
      return res.json({
        hasActiveNDA: false,
        totalUsers,
        agreedCount: 0,
        pendingCount: totalUsers,
        agreementRate: 0
      });
    }

    const agreedCount = activeNDA.agreementUsers.filter(
      a => a.version === activeNDA.version
    ).length;
    const pendingCount = totalUsers - agreedCount;
    const agreementRate = totalUsers > 0 ? Math.round((agreedCount / totalUsers) * 100) : 0;

    res.json({
      hasActiveNDA: true,
      ndaTitle: activeNDA.title,
      version: activeNDA.version,
      totalUsers,
      agreedCount,
      pendingCount,
      agreementRate,
      createdAt: activeNDA.createdAt,
      updatedAt: activeNDA.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
