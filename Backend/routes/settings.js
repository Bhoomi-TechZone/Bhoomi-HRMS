const express = require('express');
const router = express.Router();
const CompanySettings = require('../models/CompanySettings');
const auth = require('../middleware/auth');

// Helper to check for Admin role or permission
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role && req.user.role.name === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

// GET company settings (Public or Auth required? Let's say Auth required for now)
router.get('/company', auth, async (req, res) => {
    try {
        let settings = await CompanySettings.findOne();
        if (!settings) {
            // Seed default settings if not exists
            settings = new CompanySettings();
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update company settings
router.put('/company', auth, isAdmin, async (req, res) => {
    try {
        const { companyName, brandColor, website, address, logo } = req.body;

        let settings = await CompanySettings.findOne();
        if (!settings) {
            settings = new CompanySettings();
        }

        settings.companyName = companyName;
        settings.brandColor = brandColor;
        settings.logo = logo;
        settings.website = website;
        settings.address = address;
        settings.updatedBy = req.user.userId;

        await settings.save();
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET HRMS settings
router.get('/hrms', auth, async (req, res) => {
    try {
        let settings = await CompanySettings.findOne();
        if (!settings) {
            settings = new CompanySettings();
            await settings.save();
        }
        res.json({
            defaultLeaveQuota: settings.defaultLeaveQuota,
            monthlyLeaveQuota: settings.monthlyLeaveQuota,
            workingDays: settings.workingDays
        });
    } catch (error) {
        console.error('Error fetching HRMS settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update HRMS settings
router.put('/hrms', auth, isAdmin, async (req, res) => {
    try {
        const { defaultLeaveQuota, workingDays, monthlyLeaveQuota } = req.body;

        let settings = await CompanySettings.findOne();
        if (!settings) {
            settings = new CompanySettings();
        }

        if (defaultLeaveQuota !== undefined) settings.defaultLeaveQuota = defaultLeaveQuota;
        if (monthlyLeaveQuota !== undefined) settings.monthlyLeaveQuota = monthlyLeaveQuota;
        if (workingDays) settings.workingDays = workingDays;

        settings.updatedBy = req.user.userId;

        await settings.save();
        res.json({
            defaultLeaveQuota: settings.defaultLeaveQuota,
            monthlyLeaveQuota: settings.monthlyLeaveQuota,
            workingDays: settings.workingDays
        });
    } catch (error) {
        console.error('Error updating HRMS settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
