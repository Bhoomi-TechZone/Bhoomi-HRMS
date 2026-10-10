const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const auth = require('../middleware/auth');

// Get all holidays
router.get('/', auth, async (req, res) => {
    try {
        const holidays = await Holiday.find().sort({ date: 1 });
        res.json(holidays);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a holiday
router.post('/', auth, async (req, res) => {
    const holiday = new Holiday({
        name: req.body.name,
        date: req.body.date,
        description: req.body.description,
        isOptional: req.body.isOptional
    });

    try {
        const newHoliday = await holiday.save();
        res.status(201).json(newHoliday);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update a holiday
router.put('/:id', auth, async (req, res) => {
    try {
        const holiday = await Holiday.findById(req.params.id);
        if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

        if (req.body.name != null) holiday.name = req.body.name;
        if (req.body.date != null) holiday.date = req.body.date;
        if (req.body.description != null) holiday.description = req.body.description;
        if (req.body.isOptional != null) holiday.isOptional = req.body.isOptional;

        const updatedHoliday = await holiday.save();
        res.json(updatedHoliday);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a holiday
router.delete('/:id', auth, async (req, res) => {
    try {
        const holiday = await Holiday.findById(req.params.id);
        if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

        await holiday.deleteOne();
        res.json({ message: 'Holiday deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
