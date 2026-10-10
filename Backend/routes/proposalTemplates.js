const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const ProposalTemplate = require('../models/ProposalTemplate');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Normalize bracket/custom placeholder syntax to {{key}} format
function normalizePlaceholders(html) {
    // Known mapping: regex → standard key
    const knownMap = [
        // Name
        { p: /\[candidate['\u2019\u2018]?s?\s*name\]/gi,        k: 'candidate_name' },
        { p: /\[employee['\u2019\u2018]?s?\s*name\]/gi,          k: 'employee_name' },
        { p: /\[full\s*name\]/gi,                                  k: 'full_name' },
        { p: /\[name\]/gi,                                         k: 'name' },
        { p: /\[applicant['\u2019\u2018]?s?\s*name\]/gi,          k: 'candidate_name' },
        // Designation
        { p: /\[designation\]/gi,                                  k: 'designation' },
        { p: /\[position\]/gi,                                     k: 'position' },
        { p: /\[job\s*title\]/gi,                                  k: 'job_title' },
        { p: /\[role\]/gi,                                         k: 'role' },
        // Department
        { p: /\[department\]/gi,                                   k: 'department' },
        { p: /\[division\]/gi,                                     k: 'division' },
        { p: /\[team\]/gi,                                         k: 'team' },
        // Dates
        { p: /\[date\s*of\s*joining\]/gi,                         k: 'joining_date' },
        { p: /\[joining\s*date\]/gi,                               k: 'joining_date' },
        { p: /\[start\s*date\]/gi,                                 k: 'start_date' },
        { p: /\[commencement\s*date\]/gi,                          k: 'commencement_date' },
        { p: /\[current\s*date\]/gi,                               k: 'current_date' },
        { p: /\[today['\u2019\u2018]?s?\s*date\]/gi,              k: 'current_date' },
        { p: /\[letter\s*date\]/gi,                                k: 'letter_date' },
        { p: /\[effective\s*date\]/gi,                             k: 'effective_date' },
        { p: /\[issue\s*date\]/gi,                                 k: 'issue_date' },
        { p: /\[date\]/gi,                                         k: 'current_date' },
        // Salary
        { p: /\[monthly\s*salary\s*\(?ctc\)?\]/gi,                k: 'salary' },
        { p: /\[salary\s*\(?ctc\)?\]/gi,                          k: 'salary' },
        { p: /\[annual\s*salary\s*\(?ctc\)?\]/gi,                 k: 'annual_salary' },
        { p: /\[ctc\]/gi,                                          k: 'salary' },
        { p: /\[salary\]/gi,                                       k: 'salary' },
        { p: /\[package\]/gi,                                      k: 'salary' },
        // HR / Company
        { p: /\[hr\s*name\]/gi,                                    k: 'hr_name' },
        { p: /\[manager\s*name\]/gi,                               k: 'manager_name' },
        { p: /\[company\s*name\]/gi,                               k: 'company_name' },
        { p: /\[organization\]/gi,                                 k: 'company_name' },
        { p: /\[location\]/gi,                                     k: 'location' },
        { p: /\[office\s*address\]/gi,                             k: 'office_address' },
        // Contact
        { p: /\[email\s*(id|address)?\]/gi,                       k: 'email' },
        { p: /\[phone\s*(number)?\]/gi,                            k: 'phone' },
        { p: /\[mobile\s*(number)?\]/gi,                           k: 'mobile' },
        { p: /\[contact\s*(number)?\]/gi,                          k: 'phone' },
        // Employee ID
        { p: /\[employee\s*(id|code|no\.?)\]/gi,                  k: 'employee_id' },
        { p: /\[emp\.?\s*(id|code|no\.?)\]/gi,                    k: 'employee_id' },
        { p: /\[staff\s*id\]/gi,                                   k: 'employee_id' },
        // Bank
        { p: /\[bank\s*name\]/gi,                                  k: 'bank_name' },
        { p: /\[account\s*(number|no\.?)\]/gi,                    k: 'account_number' },
        { p: /\[ifsc\s*(code)?\]/gi,                               k: 'ifsc_code' },
        { p: /\[pan\s*(number|no\.?)?\]/gi,                        k: 'pan_number' },
        // Notice / probation
        { p: /\[notice\s*period\]/gi,                              k: 'notice_period' },
        { p: /\[probation\s*period\]/gi,                           k: 'probation_period' },
        // Reason / remarks
        { p: /\[reason\]/gi,                                       k: 'reason' },
        { p: /\[remarks\]/gi,                                      k: 'remarks' },
    ];

    let result = html;

    // 1. Apply known mappings
    for (const { p, k } of knownMap) {
        result = result.replace(p, `{{${k}}}`);
    }

    // 2. Convert remaining [Text] → {{text_key}} (inside HTML, avoid matching HTML attributes)
    result = result.replace(/\[([A-Za-z][^\]<>]{1,60})\]/g, (match, text) => {
        const key = text.trim()
            .toLowerCase()
            .replace(/['\u2019\u2018]/g, '')
            .replace(/[()]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .trim()
            .replace(/\s+/g, '_');
        return key ? `{{${key}}}` : match;
    });

    // 3. {Single brace text} → {{key}} (but skip already-double-braced {{...}})
    result = result.replace(/(?<!\{)\{([^{}]{1,60})\}(?!\})/g, (match, text) => {
        const key = text.trim()
            .toLowerCase()
            .replace(/['\u2019\u2018]/g, '')
            .replace(/[()]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .trim()
            .replace(/\s+/g, '_');
        return key ? `{{${key}}}` : match;
    });

    // 4. <<Text>> → {{key}}
    result = result.replace(/<<([^>]{1,60})>>/g, (match, text) => {
        const key = text.trim()
            .toLowerCase()
            .replace(/['\u2019\u2018]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .trim()
            .replace(/\s+/g, '_');
        return key ? `{{${key}}}` : match;
    });

    return result;
}

// Convert a file to HTML content based on its type
async function extractHtmlContent(filePath, fileType) {
    if (fileType === 'html' || fileType === 'htm') {
        const html = await fs.readFile(filePath, 'utf-8');
        return normalizePlaceholders(html);
    }
    if (fileType === 'txt' || fileType === 'text') {
        const text = await fs.readFile(filePath, 'utf-8');
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;padding:40px;">${
            text
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\n/g, '<br/>')
        }</div>`;
        return normalizePlaceholders(html);
    }
    if (fileType === 'docx') {
        const result = await mammoth.convertToHtml({ path: filePath }, {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "b => strong",
                "i => em",
                "u => u",
            ]
        });
        const body = normalizePlaceholders(result.value);
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #1a1a1a; margin: 0; padding: 0; }
  p { margin: 0 0 10px; }
  h1,h2,h3 { margin: 16px 0 8px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 10px; }
</style></head><body>${body}</body></html>`;
    }
    return '';
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/templates');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.html', '.htm', '.pdf', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only HTML, PDF, DOCX, and TXT are allowed.'));
        }
    }
});

// Get all templates (requires read permission)
router.get('/', auth, checkPermission('proposals', 'read'), async (req, res) => {
    try {
        const templates = await ProposalTemplate.find()
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ message: 'Error fetching templates' });
    }
});

// Create template (requires create permission)
router.post('/', auth, checkPermission('proposals', 'create'), upload.single('template'), async (req, res) => {
    try {
        const templateData = {
            name: req.body.name,
            description: req.body.description,
            type: req.body.type,
            content: req.body.content || '',
            createdBy: req.user._id
        };

        // If file was uploaded, extract HTML content
        if (req.file) {
            templateData.fileName = req.file.originalname;
            templateData.filePath = req.file.path;
            templateData.fileType = path.extname(req.file.originalname).substring(1).toLowerCase();

            try {
                const extracted = await extractHtmlContent(req.file.path, templateData.fileType);
                if (extracted) templateData.content = extracted;
            } catch (error) {
                console.error('Error extracting template content:', error);
            }
        }

        const template = await ProposalTemplate.create(templateData);
        await template.populate('createdBy', 'firstName lastName');
        res.status(201).json(template);
    } catch (error) {
        console.error('Error creating template:', error);
        // Clean up uploaded file if template creation failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({ message: 'Error creating template' });
    }
});

// Update template (requires update permission)
router.put('/:id', auth, checkPermission('proposals', 'update'), upload.single('template'), async (req, res) => {
    try {
        const template = await ProposalTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Update basic fields
        template.name = req.body.name || template.name;
        template.description = req.body.description;
        template.type = req.body.type || template.type;
        template.content = req.body.content || template.content;

        // If new file was uploaded, extract HTML content
        if (req.file) {
            // Delete old file if it exists
            if (template.filePath) {
                try { await fs.unlink(template.filePath); } catch (error) { console.error('Error deleting old file:', error); }
            }

            template.fileName = req.file.originalname;
            template.filePath = req.file.path;
            template.fileType = path.extname(req.file.originalname).substring(1).toLowerCase();

            try {
                const extracted = await extractHtmlContent(req.file.path, template.fileType);
                if (extracted) template.content = extracted;
            } catch (error) {
                console.error('Error extracting template content:', error);
            }
        }

        await template.save();
        await template.populate('createdBy', 'firstName lastName');
        res.json(template);
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ message: 'Error updating template' });
    }
});

// Re-convert existing uploaded file to HTML (requires update permission)
router.post('/:id/convert', auth, checkPermission('proposals', 'update'), async (req, res) => {
    try {
        const template = await ProposalTemplate.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });
        if (!template.filePath) return res.status(400).json({ message: 'No file to convert' });
        const extracted = await extractHtmlContent(template.filePath, template.fileType);
        template.content = extracted;
        await template.save();
        res.json({ message: 'Converted successfully', content: extracted });
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({ message: 'Conversion failed: ' + error.message });
    }
});

// Delete template (requires delete permission)
router.delete('/:id', auth, checkPermission('proposals', 'delete'), async (req, res) => {
    try {
        const template = await ProposalTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Delete associated file if it exists
        if (template.filePath) {
            try {
                await fs.unlink(template.filePath);
            } catch (error) {
                console.error('Error deleting file:', error);
            }
        }

        await template.deleteOne();
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ message: 'Error deleting template' });
    }
});

// Download template file (requires read permission)
router.get('/:id/download', auth, checkPermission('proposals', 'read'), async (req, res) => {
    try {
        const template = await ProposalTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (!template.filePath) {
            return res.status(404).json({ message: 'No file associated with this template' });
        }

        // Check if file exists
        try {
            await fs.access(template.filePath);
        } catch (error) {
            return res.status(404).json({ message: 'Template file not found on server' });
        }

        // Send file
        res.download(template.filePath, template.fileName);
    } catch (error) {
        console.error('Error downloading template:', error);
        res.status(500).json({ message: 'Error downloading template' });
    }
});

module.exports = router;
