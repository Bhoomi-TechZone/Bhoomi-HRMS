const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');

// Get all events
router.get('/', auth, async (req, res) => {
    try {
        const events = await Event.find().populate('createdBy', 'firstName lastName');
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create an event
router.post('/', auth, async (req, res) => {
    const event = new Event({
        title: req.body.title,
        description: req.body.description,
        start: req.body.start,
        end: req.body.end,
        type: req.body.type,
        createdBy: req.user._id
    });

    try {
        const newEvent = await event.save();
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update an event
router.patch('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Check permission logic here if needed (e.g. only creator or admin)

        if (req.body.title != null) event.title = req.body.title;
        if (req.body.description != null) event.description = req.body.description;
        if (req.body.start != null) event.start = req.body.start;
        if (req.body.end != null) event.end = req.body.end;
        if (req.body.type != null) event.type = req.body.type;

        const updatedEvent = await event.save();
        res.json(updatedEvent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update an event (PUT method - same as PATCH for compatibility)
router.put('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Check permission logic here if needed (e.g. only creator or admin)

        if (req.body.title != null) event.title = req.body.title;
        if (req.body.description != null) event.description = req.body.description;
        if (req.body.start != null) event.start = req.body.start;
        if (req.body.end != null) event.end = req.body.end;
        if (req.body.type != null) event.type = req.body.type;

        const updatedEvent = await event.save();
        res.json(updatedEvent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete an event
router.delete('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        await event.deleteOne();
        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
