const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const SalaryRule = require('../models/SalaryRule');

// Get all rules
router.get('/', auth, async (req, res) => {
    try {
        const rules = await SalaryRule.find().sort({ createdAt: -1 });
        res.json(rules);
    } catch (error) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ message: 'Error fetching salary rules' });
    }
});

// Create a rule
router.post('/', auth, checkPermission('payroll', 'create'), async (req, res) => {
    try {
        const rule = new SalaryRule({
            ...req.body,
            createdBy: req.user._id
        });
        await rule.save();
        res.status(201).json(rule);
    } catch (error) {
        console.error('Error creating rule:', error);
        res.status(500).json({ message: 'Error creating salary rule' });
    }
});

// Update a rule
router.put('/:id', auth, checkPermission('payroll', 'update'), async (req, res) => {
    try {
        const rule = await SalaryRule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        res.json(rule);
    } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ message: 'Error updating salary rule' });
    }
});

// Delete a rule
router.delete('/:id', auth, checkPermission('payroll', 'delete'), async (req, res) => {
    try {
        const rule = await SalaryRule.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ message: 'Error deleting salary rule' });
    }
});

module.exports = router;
