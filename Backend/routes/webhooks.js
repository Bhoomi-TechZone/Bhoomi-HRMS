const express = require('express');
const router = express.Router();
const axios = require('axios');
const LeadAssignment = require('../models/LeadAssignment');
const User = require('../models/User');
const Role = require('../models/Role');
const nodemailer = require('nodemailer');

// Environment variables
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'hrms_verify_token';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

// Create transporter for emails (using existing env vars if available)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// ✅ GET Request for Webhook Verification
router.get('/instagram', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ✅ POST Request for Webhook Event
router.post('/instagram', async (req, res) => {
    try {
        const body = req.body;

        console.log('📨 Received Webhook Event:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            for (const entry of body.entry) {
                // Iterate over each change - there may be multiple if batched
                for (const change of entry.changes) {
                    // Check if the change is a leadgen
                    if (change.field === 'leadgen') {
                        const leadGenId = change.value.leadgen_id;
                        console.log('🆔 LeadGen ID:', leadGenId);

                        // Fetch lead details from Graph API
                        await processLead(leadGenId);
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Webhook Error:', error.message);
        res.sendStatus(500);
    }
});

// Function to process lead
async function processLead(leadGenId) {
    try {
        if (!PAGE_ACCESS_TOKEN) {
            console.error('❌ Missing FACEBOOK_PAGE_ACCESS_TOKEN in env');
            return;
        }

        // 1. Fetch Lead Details from Meta Graph API
        const response = await axios.get(`https://graph.facebook.com/v19.0/${leadGenId}`, {
            params: { access_token: PAGE_ACCESS_TOKEN }
        });

        const leadData = response.data;
        console.log('📋 Lead Details:', leadData);

        // Extract fields
        let leadName = 'Unknown';
        let email = null;
        let phone = 'N/A';
        let company = null;
        const extraFields = {};

        // Map fields dynamically based on field_data
        if (leadData.field_data) {
            leadData.field_data.forEach(field => {
                const name = field.name.toLowerCase();
                const value = field.values[0];

                if (name.includes('name') || name.includes('full_name')) leadName = value;
                else if (name.includes('email')) email = value;
                else if (name.includes('phone')) phone = value;
                else if (name.includes('company')) company = value;
                else extraFields[field.name] = value;
            });
        }

        // 2. Find HR to Assign
        // Find HR Role
        const hrRole = await Role.findOne({ name: { $regex: /hr|human resources/i } });
        if (!hrRole) {
            console.error('❌ HR Role not found for auto-assignment');
            return;
        }

        // Find first active HR user
        const hrUser = await User.findOne({ role: hrRole._id, isActive: true });
        if (!hrUser) {
            console.error('❌ No active HR User found for auto-assignment');
            return;
        }

        // Find a system user or admin to use as 'assignedBy'
        // Usually the first admin
        const adminRole = await Role.findOne({ name: { $regex: /admin/i } });
        const adminUser = await User.findOne({ role: adminRole?._id });
        const assignedById = adminUser ? adminUser._id : hrUser._id; // Fallback to HR themselves if no admin

        // 3. Save to MongoDB (LeadAssignment)
        const newLead = new LeadAssignment({
            employee: hrUser._id,

            contactNumber: phone,
            email,
            company,
            source: 'Instagram Lead Form',
            status: 'New',
            leadDate: new Date(leadData.created_time || Date.now()),
            extraFields,
            assignedBy: assignedById,
            notes: `Auto-generated from Instagram Lead ID: ${leadGenId}`
        });

        await newLead.save();
        console.log(`✅ Lead saved and assigned to HR: ${hrUser.firstName} ${hrUser.lastName}`);

        // 4. Send Email Notification
        if (hrUser.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: hrUser.email,
                subject: '🚀 New Instagram Lead Assigned',
                html: `
          <h3>New Lead Received from Instagram</h3>
          <p><strong>Name:</strong> ${leadName}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email || 'N/A'}</p>
          <p><strong>Source:</strong> Instagram Lead Form</p>
          <br>
          <p>This lead has been automatically assigned to you.</p>
          <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/hrms/leads">View in Dashboard</a></p>
        `
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) console.error('❌ Email Error:', err);
                else console.log('📧 Email Sent:', info.response);
            });
        }

    } catch (error) {
        console.error('❌ Error processing lead:', error.message);
    }
}

module.exports = router;
