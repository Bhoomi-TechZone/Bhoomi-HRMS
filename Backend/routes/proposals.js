const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const Role = require('../models/Role');
const CompanySettings = require('../models/CompanySettings');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const userPopulate = {
    path: 'createdBy',
    select: 'firstName lastName role email phone',
    populate: { 
        path: 'role', 
        model: 'Role',
        select: 'name' 
    }
};

// Configure multer for signature image uploads
const signatureStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'signatures');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'sig-' + uniqueSuffix + ext);
    }
});

const signatureUpload = multer({
    storage: signatureStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype.split('/')[1]);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (jpg, png, webp) are allowed'));
        }
    }
});

// Helper to check if user has full access to ALL proposals (Admin, Sales Head, Team Leader, Manager)
const hasFullProposalAccess = (user) => {
    if (!user) return false;
    const roleName = ((user.role && user.role.name) || user.roleName || (typeof user.role === 'string' ? user.role : '')).toLowerCase().trim();
    if (!roleName) return false;

    const fullAccessRoles = [
        'admin',
        'super admin',
        'superadmin',
        'director',
        'sales head',
        'saleshead',
        'head of sales',
        'team leader',
        'teamleader',
        'team lead',
        'teamlead',
        'tl',
        'manager',
        'project manager',
        'sales manager',
        'general manager',
        'hr manager',
        'operations manager'
    ];

    if (fullAccessRoles.includes(roleName)) return true;

    // Check keyword containment
    if (
        roleName.includes('admin') ||
        roleName.includes('director') ||
        roleName.includes('sales head') ||
        roleName.includes('saleshead') ||
        roleName.includes('team leader') ||
        roleName.includes('team lead') ||
        roleName.includes('teamleader') ||
        roleName.includes('manager')
    ) {
        return true;
    }

    return false;
};

// Helper to check if a specific proposal is accessible to the user
const isProposalAccessible = (proposal, user) => {
    if (hasFullProposalAccess(user)) return true;
    if (!proposal || !user) return false;

    const userId = (user._id || user.id || '').toString();
    const createdBy = (proposal.createdBy?._id || proposal.createdBy || '').toString();

    return Boolean(userId && createdBy && userId === createdBy);
};

// Get all proposals (filtered by ownership unless user is Admin, Sales Head, Team Leader, or Manager)
router.get('/', auth, checkPermission('proposals', 'read'), async (req, res) => {
    try {
        const fullAccess = hasFullProposalAccess(req.user);
        let query = {};
        if (!fullAccess) {
            query.createdBy = req.user._id;
        }

        let proposals = await Proposal.find(query)
            .select('-pdfEditorState.base64Pdf')
            .populate('deal', 'dealName clientName')
            .populate('template', 'name')
            .populate({
                path: 'createdBy',
                populate: { path: 'role' }
            })
            .sort({ createdAt: -1 })
            .lean();

        // Fail-safe: If deep population failed, manually fetch roles
        for (let prop of proposals) {
            if (prop.createdBy && prop.createdBy.role && !prop.createdBy.role.name) {
                const roleDoc = await Role.findById(prop.createdBy.role);
                if (roleDoc) {
                    prop.createdBy.role = {
                        _id: roleDoc._id,
                        name: roleDoc.name
                    };
                }
            }
        }

        res.json(proposals);
    } catch (error) {
        console.error('Error fetching proposals:', error);
        res.status(500).json({ message: 'Error fetching proposals' });
    }
});

// Get single proposal (requires read permission and ownership check)
router.get('/:id', auth, checkPermission('proposals', 'read'), async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id)
            .populate('deal', 'dealName clientName')
            .populate(userPopulate)
            .populate('template', 'name content');

        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(proposal, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only view your own proposals' });
        }

        res.json(proposal);
    } catch (error) {
        console.error('Error fetching proposal:', error);
        res.status(500).json({ message: 'Error fetching proposal' });
    }
});

// Create proposal (requires create permission)
router.post('/', auth, checkPermission('proposals', 'create'), async (req, res) => {
    try {
        // Generate proposal number if not provided, ensuring uniqueness
        let proposalNumber = req.body.proposalNumber;
        if (!proposalNumber) {
            const year = new Date().getFullYear();
            let count = await Proposal.countDocuments();
            let exists = true;
            while (exists) {
                count++;
                proposalNumber = `PROP-${year}-${String(count).padStart(4, '0')}`;
                const existing = await Proposal.findOne({ proposalNumber });
                if (!existing) {
                    exists = false;
                }
            }
        }

        const proposalData = {
            ...req.body,
            proposalNumber,
            createdBy: req.user._id
        };

        if (!proposalData.validTill) {
            delete proposalData.validTill;
        }

        const proposal = await Proposal.create(proposalData);
        await proposal.populate('deal', 'dealName clientName');
        await proposal.populate('template', 'name');
        await Proposal.populate(proposal, [
            { path: 'createdBy', select: 'firstName lastName role email phone' },
            { path: 'createdBy.role', model: 'Role', select: 'name' }
        ]);

        res.status(201).json(proposal);
    } catch (error) {
        console.error('Error creating proposal:', error);
        res.status(500).json({ message: 'Error creating proposal', error: error.message });
    }
});

// Update proposal (requires update permission and ownership check)
router.put('/:id', auth, checkPermission('proposals', 'update'), async (req, res) => {
    try {
        const existing = await Proposal.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(existing, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only edit your own proposals' });
        }

        const updateData = { ...req.body };
        delete updateData.createdBy; // Prevent transferring ownership

        const proposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        )
            .populate('deal', 'dealName clientName')
            .populate('template', 'name');

        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        await Proposal.populate(proposal, [
            { path: 'createdBy', select: 'firstName lastName role email phone' },
            { path: 'createdBy.role', model: 'Role', select: 'name' }
        ]);

        res.json(proposal);
    } catch (error) {
        console.error('Error updating proposal:', error);
        res.status(500).json({ message: 'Error updating proposal' });
    }
});

// Update proposal status (requires update permission and ownership check)
router.patch('/:id/status', auth, checkPermission('proposals', 'update'), async (req, res) => {
    try {
        const existing = await Proposal.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(existing, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only edit your own proposals' });
        }

        const { status } = req.body;
        const updateData = { status };

        // Track status change dates
        if (status === 'sent') updateData.sentDate = new Date();
        if (status === 'viewed') updateData.viewedDate = new Date();
        if (status === 'accepted' || status === 'rejected') updateData.respondedDate = new Date();

        const proposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('deal');

        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        await Proposal.populate(proposal, [
            { path: 'createdBy', select: 'firstName lastName role email phone' },
            { path: 'createdBy.role', model: 'Role', select: 'name' }
        ]);

        res.json(proposal);
    } catch (error) {
        console.error('Error updating proposal status:', error);
        res.status(500).json({ message: 'Error updating proposal status' });
    }
});

// Generate PDF for proposal - Bhoomi Techzone Professional Template (requires read permission and ownership check)
router.get('/:id/pdf', auth, checkPermission('proposals', 'read'), async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id)
            .populate(userPopulate)
            .populate('deal', 'dealName clientName');

        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(proposal, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only view your own proposals' });
        }

        // If high-fidelity base64 PDF is saved from the live preview, stream it directly!
        if (proposal.pdfEditorState && proposal.pdfEditorState.base64Pdf) {
            const rawBase64 = proposal.pdfEditorState.base64Pdf.replace(/^data:application\/pdf;[^;]*;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
            const pdfBuffer = Buffer.from(rawBase64, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=proposal-${proposal.proposalNumber || proposal._id}.pdf`);
            return res.send(pdfBuffer);
        }

        const companyName = 'BHOOMI TECHZONE PRIVATE LIMITED';
        const companyWebsite = 'www.bhoomitechzone.in';
        const companyEmail = 'bhoomi.sales@bhoomitechzone.in';
        const companyAddress = 'A-43, 3rd Floor, Sector 63, Noida (201301), Uttar Pradesh';
        const companyGSTIN = '09AAMCB0572D1ZS';
        const companyCIN = 'U55499UP2023PTC191784';

        const GREEN = '#2e7d32';
        const GREEN_LIGHT = '#e8f5e9';
        const GREEN_DARK = '#1b5e20';
        const BORDER_GREEN = '#4caf50';
        const TABLE_BORDER_WIDTH = 0.35;

        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=proposal-${proposal.proposalNumber}.pdf`);
        doc.pipe(res);

        // Try backend assets first, then fallback to frontend path
        let logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
        if (!fs.existsSync(logoPath)) {
            logoPath = path.join(__dirname, '../../..', 'HRMSfront', 'public', 'logo.png');
        }
        console.log('Logo path:', logoPath, '| Exists:', fs.existsSync(logoPath));
        const hasLogo = fs.existsSync(logoPath);
        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const margin = 40;
        const contentW = pageW - margin * 2;
        const safeBottom = pageH - 75; // reserve space for footer + border

        // ============ HELPER: Draw green border on all pages ============
        function drawPageBorder() {
            doc.rect(20, 20, pageW - 40, pageH - 40)
                .lineWidth(2.5)
                .strokeColor(GREEN)
                .stroke();
        }

        // ============ HELPER: Draw header on every page ============
        function drawHeader() {
            // Logo
            if (hasLogo) {
                doc.image(logoPath, margin + 5, 30, { width: 100, height: 35 });
            }

            // Company info - right aligned
            const headerRightX = pageW - margin - 5;
            doc.fontSize(9).fillColor(GREEN_DARK).font('Helvetica-Bold')
                .text(companyName, margin + 100, 32, { width: headerRightX - margin - 100, align: 'right', lineBreak: false });
            doc.fontSize(7).fillColor('#333').font('Helvetica')
                .text(`${companyWebsite} | ${companyEmail}`, margin + 100, 44, { width: headerRightX - margin - 100, align: 'right', lineBreak: false })
                .text(`GSTIN: ${companyGSTIN}  |  CIN: ${companyCIN}`, margin + 100, 53, { width: headerRightX - margin - 100, align: 'right', lineBreak: false })
                .text(`Registered Office: ${companyAddress}`, margin + 100, 62, { width: headerRightX - margin - 100, align: 'right', lineBreak: false });

            // Green line under header
            doc.moveTo(margin, 78).lineTo(pageW - margin, 78).lineWidth(1.5).strokeColor(GREEN).stroke();
        }

        // ============ HELPER: Draw footer on every page ============
        function drawFooter(fixedY) {
            const footerY = fixedY || pageH - 55;
            // Save current position
            const savedY = doc.y;
            const savedX = doc.x;
            
            // Green line above footer
            doc.moveTo(margin, footerY).lineTo(pageW - margin, footerY).lineWidth(1).strokeColor(GREEN).stroke();

            // Footer - use single line with tab spacing to prevent page breaks
            const colW = contentW / 4;
            const footerTextY = footerY + 8;
            
            doc.fontSize(6.5);
            
            // Draw each column separately with absolute positioning
            doc.fillColor('#333').font('Helvetica');
            doc.text(companyName.split(' PRIVATE')[0] + '.', margin + 5, footerTextY, { 
                width: colW - 10, 
                height: 15,
                lineBreak: false,
                ellipsis: true
            });
            
            doc.fillColor('#333').font('Helvetica');
            doc.text('Noida Sector 63', margin + colW + 5, footerTextY, { 
                width: colW - 10,
                height: 15, 
                lineBreak: false,
                ellipsis: true
            });
            
            doc.fillColor(GREEN).font('Helvetica');
            doc.text(companyEmail.split('@')[0], margin + colW * 2 + 5, footerTextY, { 
                width: colW - 10,
                height: 15, 
                lineBreak: false,
                link: `mailto:${companyEmail}`,
                ellipsis: true
            });
            
            doc.fillColor(GREEN).font('Helvetica');
            doc.text(companyWebsite.replace('https://', ''), margin + colW * 3 + 5, footerTextY, { 
                width: colW - 10,
                height: 15, 
                lineBreak: false,
                link: `https://${companyWebsite}`,
                ellipsis: true
            });
            
            // Restore position to prevent pagination issues
            doc.x = savedX;
            doc.y = savedY;
        }

        function drawFooterOnPage(pageIndex) {
            doc.switchToPage(pageIndex);
            drawFooter();
        }

        // ============ HELPER: Bordered table row ============
        function drawTableRow(x, y, cols, widths, height, opts = {}) {
            const { fill, bold, textColor, fontSize: fSize } = opts;
            let currentX = x;
            cols.forEach((text, i) => {
                if (fill) {
                    doc.rect(currentX, y, widths[i], height).fill(fill);
                }
                doc.rect(currentX, y, widths[i], height).lineWidth(0.5).strokeColor('#999').stroke();
                doc.fontSize(fSize || 9).fillColor(textColor || '#000').font(bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(String(text), currentX + 6, y + (height - (fSize || 9)) / 2, { width: widths[i] - 12, lineBreak: false });
                currentX += widths[i];
            });
        }

        // ============ PAGE 1: Project Proposal ============
        drawPageBorder();
        drawHeader();

        let y = 95;

        // Title
        doc.fontSize(18).fillColor(GREEN_DARK).font('Helvetica-Bold')
            .text('PROJECT PROPOSAL', margin, y, { width: contentW, align: 'center', lineBreak: false });
        y += 22;
        doc.fontSize(12).fillColor('#d32f2f').font('Helvetica-BoldOblique')
            .text(proposal.title || 'Dynamic Website', margin, y, { width: contentW, align: 'center', lineBreak: false });
        y += 30;

        // Company info table (Prepared By, Website, Email, Address)
        const infoRows = [
            ['Prepared By', companyName.split(' PRIVATE')[0] + ' Pvt. Ltd.'],
            ['Website', companyWebsite],
            ['Email', companyEmail],
            ['Address', companyAddress],
        ];
        const labelW = 120;
        const valueW = contentW - labelW;
        infoRows.forEach((row) => {
            doc.rect(margin, y, labelW, 22).fill('#f5f5f5');
            doc.rect(margin, y, labelW, 22).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.rect(margin + labelW, y, valueW, 22).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text(row[0], margin + 6, y + 6, { width: labelW - 12, lineBreak: false });
            doc.fontSize(9).fillColor('#333').font('Helvetica').text(row[1], margin + labelW + 6, y + 6, { width: valueW - 12, lineBreak: false });
            y += 22;
        });

        y += 18;

        // Client Information Table
        doc.fontSize(11).fillColor(GREEN_DARK).font('Helvetica-Bold')
            .text('CLIENT INFORMATION', margin, y, { lineBreak: false });
        y += 16;
        const clientRows = [
            ['Client Name', proposal.clientName || '—'],
            ['Contact Person', proposal.contactName || '—'],
            ['Email', proposal.clientEmail || '—'],
            ['Phone', proposal.clientPhone || '—'],
            ['Address', proposal.clientAddress || '—'],
        ];
        clientRows.forEach((row) => {
            doc.rect(margin, y, labelW, 20).fill('#f5f5f5');
            doc.rect(margin, y, labelW, 20).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.rect(margin + labelW, y, valueW, 20).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold').text(row[0], margin + 6, y + 5, { width: labelW - 12, lineBreak: false });
            doc.fontSize(8.5).fillColor('#333').font('Helvetica').text(row[1], margin + labelW + 6, y + 5, { width: valueW - 12, lineBreak: false });
            y += 20;
        });

        y += 15;

        // Proposal # and Date row
        const dateStr = proposal.date ? new Date(proposal.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
        doc.fontSize(9).fillColor('#333').font('Helvetica')
            .text(`Proposal #: ${proposal.proposalNumber || '—'}`, margin, y, { width: contentW / 2, align: 'left', lineBreak: false })
            .text(`Date: ${dateStr}`, margin + contentW / 2, y, { width: contentW / 2, align: 'right', lineBreak: false });
        y += 20;

        // SUMMARY OF COMPANY PROFILE
        doc.fontSize(11).fillColor(GREEN_DARK).font('Helvetica-Bold')
            .text('SUMMARY OF COMPANY PROFILE', margin, y, { lineBreak: false });
        y += 16;
        doc.fontSize(8.5).fillColor('#333').font('Helvetica');
        const profileText = `At BHOOMI TECHZONE, we help businesses create a strong and professional digital presence through innovative web and digital marketing solutions. We specialize in website design and development, SEO, and targeted digital marketing tailored to meet the unique needs of every business.\n\nOur approach combines creative design, modern technology, functionality, and result-driven strategies to help brands connect with their target audience, improve online visibility, and achieve sustainable growth.\n\nWith a focus on quality and innovation, we aim to deliver effective digital solutions that turn ideas into impactful online experiences and help businesses grow with confidence.`;
        const profileHeight = doc.heightOfString(profileText, { width: contentW, align: 'justify', lineGap: 2 });
        doc.text(profileText, margin, y, { width: contentW, align: 'justify', lineGap: 2 });
        y += profileHeight + 15;

        // OUR SERVICES
        if (y < pageH - 200) {
            doc.fontSize(11).fillColor(GREEN_DARK).font('Helvetica-Bold')
                .text('OUR SERVICES', margin, y, { lineBreak: false });
            y += 16;
            const services = [
                'Website Development', 'Web Portals Development', 'Software Development',
                'Android Application Development', 'Mobile Apps Development', 'Digital Marketing',
                'Graphics Designing', 'Promotional Video', 'Logo & Banner Designing',
                'Content Writing & Hosting', 'ERP, CRM Development', 'MLM Website/App Development',
                'E-Commerce Development', 'Desktop Software Development', 'Taxi Booking Apps',
                'Food Delivery Apps', 'Service Provider Apps', 'Tournament/Contest Apps',
            ];
            const svcColW = contentW / 3;
            const svcRowH = 18;
            for (let i = 0; i < services.length; i += 3) {
                for (let j = 0; j < 3 && i + j < services.length; j++) {
                    doc.rect(margin + j * svcColW, y, svcColW, svcRowH).lineWidth(0.3).strokeColor('#999').stroke();
                    doc.fontSize(7.5).fillColor('#333').font('Helvetica')
                        .text('• ' + services[i + j], margin + j * svcColW + 6, y + 5, { width: svcColW - 12, lineBreak: false });
                }
                y += svcRowH;
            }
        }

        // ============ PAGE 2: Project Details & Costing ============
        doc.addPage();
        drawPageBorder();
        drawHeader();
        y = 95;

        // PROJECT SECTIONS (structured content)
        const hasSections = proposal.projectSections && proposal.projectSections.filter(s => s.content && s.content.trim()).length > 0;
        const hasTimeline = proposal.projectTimeline && proposal.projectTimeline.trim();

        if (hasSections || hasTimeline) {
            const boxX = margin;
            const boxW = contentW;
            let boxStartY = y;
            y += 10; // Add top padding inside the box

            // Close the green border box for the current page segment
            const closeSectionBox = () => {
                const boxH = y - boxStartY + 4;
                if (boxH > 4) {
                    doc.rect(boxX, boxStartY, boxW, boxH).strokeColor(GREEN).lineWidth(1).stroke();
                }
            };

            // Add a new page and restart the box
            const addSectionPage = () => {
                closeSectionBox();
                doc.addPage();
                drawPageBorder();
                drawHeader();
                y = 95;
                boxStartY = y;
                y += 10; // Add top padding for new page box
            };

            // Helper: render a paragraph that may be longer than a single page.
            // Splits word-by-word so each chunk fits before calling addSectionPage().
            const renderParagraphSafe = (text, x, opts, bottomPad) => {
                doc.fontSize(opts.fontSize || 9).fillColor(opts.color || '#333').font(opts.font || 'Helvetica');
                const availH = safeBottom - y;
                const fullH = doc.heightOfString(text, { width: opts.width, align: opts.align, lineGap: opts.lineGap });

                if (fullH <= availH) {
                    // Fits on current page
                    doc.text(text, x, y, { width: opts.width, align: opts.align, lineGap: opts.lineGap });
                    y = doc.y + bottomPad;
                    return;
                }

                // Check if it fits on a fresh page
                const freshH = doc.heightOfString(text, { width: opts.width, align: opts.align, lineGap: opts.lineGap });
                if (freshH <= safeBottom - 95) {
                    addSectionPage();
                    doc.fontSize(opts.fontSize || 9).fillColor(opts.color || '#333').font(opts.font || 'Helvetica');
                    doc.text(text, x, y, { width: opts.width, align: opts.align, lineGap: opts.lineGap });
                    y = doc.y + bottomPad;
                    return;
                }

                // Paragraph is bigger than one page – split word by word into chunks
                const words = text.split(' ');
                let chunk = '';
                words.forEach((word) => {
                    const candidate = chunk ? chunk + ' ' + word : word;
                    doc.fontSize(opts.fontSize || 9).font(opts.font || 'Helvetica');
                    const candidateH = doc.heightOfString(candidate, { width: opts.width, lineGap: opts.lineGap });
                    if (y + candidateH + bottomPad > safeBottom && chunk) {
                        doc.fillColor(opts.color || '#333')
                            .text(chunk, x, y, { width: opts.width, align: opts.align, lineGap: opts.lineGap });
                        y = doc.y + 4;
                        addSectionPage();
                        doc.fontSize(opts.fontSize || 9).fillColor(opts.color || '#333').font(opts.font || 'Helvetica');
                        chunk = word;
                    } else {
                        chunk = candidate;
                    }
                });
                if (chunk) {
                    doc.fillColor(opts.color || '#333')
                        .text(chunk, x, y, { width: opts.width, align: opts.align, lineGap: opts.lineGap });
                    y = doc.y + bottomPad;
                }
            };

            if (proposal.projectSections) {
                proposal.projectSections.forEach(sec => {
                    if (!sec.content || !sec.content.trim()) return;
                if (sec.type === 'page-heading') {
                    if (y + 44 > safeBottom) addSectionPage();
                    // Green background bar
                    doc.rect(boxX, y, boxW, 18).fill('#e8f5e9');
                    doc.rect(boxX, y, 3, 18).fill(GREEN);
                    doc.fontSize(10).fillColor(GREEN_DARK).font('Helvetica-Bold')
                        .text(sec.content, boxX + 10, y + 4, { width: boxW - 14, lineBreak: false });
                    y += 26;
                } else if (sec.type === 'heading') {
                    doc.fontSize(9.5).fillColor('#1e293b').font('Helvetica-Bold');
                    const headingHeight = doc.heightOfString(sec.content, { width: boxW - 12 });
                    if (y + headingHeight + 18 > safeBottom) addSectionPage();
                    doc.text(sec.content, boxX + 6, y, { width: boxW - 12, lineBreak: false });
                    const lineY = doc.y + 2;
                    const lineW = doc.widthOfString(sec.content);
                    doc.moveTo(boxX + 6, lineY).lineTo(boxX + 6 + Math.min(lineW, boxW - 12), lineY).strokeColor(GREEN).lineWidth(0.5).stroke();
                    y = lineY + 8;
                } else if (sec.type === 'sub-heading') {
                    doc.fontSize(8.5).fillColor('#475569').font('Helvetica-Bold');
                    const subHeight = doc.heightOfString(sec.content, { width: boxW - 18 });
                    if (y + subHeight + 15 > safeBottom) addSectionPage();
                    doc.text(sec.content, boxX + 12, y, { width: boxW - 18 });
                    y = doc.y + 7;
                } else if (sec.type === 'bullet') {
                    const lines = sec.content.split('\n').filter(l => l.trim());
                    lines.forEach(line => {
                        doc.fontSize(8).fillColor('#444').font('Helvetica');
                        const bulletHeight = doc.heightOfString('• ' + line.trim(), { width: boxW - 24 });
                        if (y + bulletHeight + 10 > safeBottom) addSectionPage();
                        doc.text('• ' + line.trim(), boxX + 16, y, { width: boxW - 24 });
                        y = doc.y + 2;
                    });
                    y += 3;
                } else {
                    // paragraph – use safe renderer that handles multi-page overflow
                    renderParagraphSafe(
                        sec.content,
                        boxX + 6,
                        { fontSize: 9, color: '#333', font: 'Helvetica', width: boxW - 12, align: 'justify', lineGap: 2 },
                        10
                    );
                }
            });
            }

            if (hasTimeline) {
                if (y + 44 > safeBottom) addSectionPage();
                
                doc.rect(boxX, y, boxW, 18).fill('#e8f5e9');
                doc.rect(boxX, y, 3, 18).fill(GREEN);
                doc.fontSize(10).fillColor(GREEN_DARK).font('Helvetica-Bold')
                    .text('PROJECT TIMELINE', boxX + 10, y + 4, { width: boxW - 14, lineBreak: false });
                y += 26;

                renderParagraphSafe(
                    proposal.projectTimeline,
                    boxX + 6,
                    { fontSize: 9, color: '#333', font: 'Helvetica', width: boxW - 12, align: 'justify', lineGap: 2 },
                    10
                );
            }

            // Draw green border around final box segment
            closeSectionBox();
            y += 10;
        } else {
            // Backward compatibility for old proposals
            if (proposal.projectScope) {
                doc.fontSize(11).fillColor(GREEN_DARK).font('Helvetica-Bold')
                    .text('PROJECT SCOPE', margin, y, { lineBreak: false });
                y += 16;
                doc.fontSize(9).fillColor('#333').font('Helvetica');
                const scopeHeight = doc.heightOfString(proposal.projectScope, { width: contentW, align: 'justify', lineGap: 2 });
                doc.text(proposal.projectScope, margin, y, { width: contentW, align: 'justify', lineGap: 2 });
                y += scopeHeight + 15;
            }
            if (proposal.projectObjectives) {
                doc.fontSize(11).fillColor(GREEN_DARK).font('Helvetica-Bold')
                    .text('OBJECTIVES', margin, y, { lineBreak: false });
                y += 16;
                doc.fontSize(9).fillColor('#333').font('Helvetica');
                const objHeight = doc.heightOfString(proposal.projectObjectives, { width: contentW, align: 'justify', lineGap: 2 });
                doc.text(proposal.projectObjectives, margin, y, { width: contentW, align: 'justify', lineGap: 2 });
                y += objHeight + 15;
            }
        }

        // ============ PAGE N: Costing & Payment (starts on fresh page) ============
        doc.addPage();
        drawPageBorder();
        drawHeader();
        y = 95;
        
        // COSTING TABLE
        y += 10;
        doc.rect(margin, y, contentW, 28).fill(GREEN);
        doc.fontSize(13).fillColor('#fff').font('Helvetica-Bold')
            .text(`COSTING FOR ${(proposal.title || 'PROJECT').toUpperCase()}`, margin, y + 7, { width: contentW, align: 'center', lineBreak: false });
        y += 28;

        // Table header
        const costColWidths = [contentW * 0.45, contentW * 0.25, contentW * 0.30];
        drawTableRow(margin, y, ['Individuals', "Term's", 'Price Rs.(₹)'], costColWidths, 24, { fill: GREEN_LIGHT, bold: true, textColor: GREEN_DARK, fontSize: 9 });
        y += 24;

        // Item rows with page break support
        if (proposal.items && proposal.items.length > 0) {
            proposal.items.forEach((item) => {
                const rowH = 22;
                // Check if row fits on current page
                if (y + rowH > safeBottom - 50) { // Reserve space for totals
                    doc.addPage();
                    drawPageBorder();
                    drawHeader();
                    y = 95;
                }
                drawTableRow(margin, y, [
                    item.description,
                    item.quantity > 1 ? `${item.quantity} units` : 'Total',
                    `${item.amount.toLocaleString('en-IN')}/-`
                ], costColWidths, rowH, { fontSize: 8.5 });
                y += rowH;
            });
        }

        // Sub Total
        const summaryLabelW = costColWidths[0] + costColWidths[1];
        const summaryValW = costColWidths[2];
        drawTableRow(margin, y, ['Sub Total', `${proposal.subtotal.toLocaleString('en-IN')}/-`], [summaryLabelW, summaryValW], 22, { bold: true, fontSize: 9 });
        y += 22;

        // GST
        if (proposal.taxAmount > 0) {
            drawTableRow(margin, y, [`GST ${proposal.taxPercentage}%`, `${proposal.taxAmount.toLocaleString('en-IN')}/-`], [summaryLabelW, summaryValW], 22, { fontSize: 9 });
            y += 22;
        }

        // Discount
        if (proposal.discount > 0) {
            drawTableRow(margin, y, ['Discount', `-${proposal.discount.toLocaleString('en-IN')}/-`], [summaryLabelW, summaryValW], 22, { fontSize: 9 });
            y += 22;
        }

        // Total (highlighted)
        drawTableRow(margin, y, ['Offered Price / Net Amount', `${proposal.total.toLocaleString('en-IN')}/-`], [summaryLabelW, summaryValW], 26, { fill: GREEN_LIGHT, bold: true, textColor: GREEN_DARK, fontSize: 10 });
        y += 40;

        // PAYMENT DETAILS — needs ~5 rows*20 + heading(26) + note(30) + payment-method(36) ~ 190px
        if (y + 190 > safeBottom) {
            doc.addPage();
            drawPageBorder();
            drawHeader();
            y = 95;
        }
        // PAYMENT DETAILS
        doc.fontSize(11).fillColor('#fff').font('Helvetica-Bold');
        doc.rect(margin, y, contentW, 26).fill(GREEN);
        doc.text('PAYMENTS DETAILS', margin, y + 7, { width: contentW, align: 'center', lineBreak: false });
        y += 26;

        const bankDetails = [
            ['Account Name', companyName],
            ['Account Number', '15111100000386'],
            ['IFSC Code', 'PSIB0021511'],
            ['Bank Name', 'Punjab & Sind Bank'],
            ['UPI ID', 'bhoomitechzone@okaxis'],
        ];
        const bankLabelW = 130;
        const bankValW = contentW - bankLabelW;
        bankDetails.forEach((row) => {
            doc.rect(margin, y, bankLabelW, 20).fill('#f5f5f5');
            doc.rect(margin, y, bankLabelW, 20).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.rect(margin + bankLabelW, y, bankValW, 20).lineWidth(TABLE_BORDER_WIDTH).strokeColor(BORDER_GREEN).stroke();
            doc.fontSize(8).fillColor('#000').font('Helvetica-Bold').text(row[0], margin + 6, y + 5, { width: bankLabelW - 12, lineBreak: false });
            doc.fontSize(8).fillColor('#333').font('Helvetica').text(row[1], margin + bankLabelW + 6, y + 5, { width: bankValW - 12, lineBreak: false });
            y += 20;
        });

        y += 12;

        // Payment note
        doc.fontSize(7.5).fillColor('#d32f2f').font('Helvetica-Bold')
            .text("Note: Pay only on Company's account or on QR Code. Don't Pay on any employee's account or QR Code.", margin, y, { width: contentW, align: 'center', lineBreak: false });
        y += 16;

        // Payment Method box
        doc.rect(margin, y, contentW, 24).fill(GREEN_LIGHT).lineWidth(1).strokeColor(GREEN).stroke();
        doc.fontSize(8.5).fillColor(GREEN_DARK).font('Helvetica-Bold')
            .text(proposal.paymentTerms || 'Payment Method: 50% Payment Advance • 30% in between • 20% After Completion', margin, y + 7, { width: contentW, align: 'center', lineBreak: false });

        // ============ PAGE 3: Terms & Conditions + Signatures ============
        doc.addPage();
        drawPageBorder();
        drawHeader();
        y = 95;

        // TERM AND CONDITIONS
        doc.fontSize(14).fillColor('#000').font('Helvetica-Bold')
            .text('TERM AND CONDITIONS', margin, y, { lineBreak: false });
        y += 28;

        // T&C content
        const tcText = proposal.termsAndConditions || `1. Payment terms: 50% advance, 50% on project completion
2. Project timeline is estimated and may vary based on client inputs
3. Any additional features beyond scope will be quoted separately
4. Client must provide all necessary access and resources
5. All intellectual property rights remain with the company until full payment`;

        doc.fontSize(9.5).fillColor('#333').font('Helvetica');
        const tcHeight = doc.heightOfString(tcText, { width: contentW, align: 'justify', lineGap: 4 });
        doc.text(tcText, margin, y, { width: contentW, align: 'justify', lineGap: 4 });
        y += tcHeight + 14;

        // Cancellation / Refund policy
        doc.fontSize(9.5).fillColor('#000').font('Helvetica-Bold');
        const cancelHeight = doc.heightOfString('If you cancel the project midway, the company will not refund your payment.', { width: contentW });
        doc.text('If you cancel the project midway, the company will not refund your payment.', margin, y, { width: contentW });
        y += cancelHeight + 10;
        
        doc.fontSize(9.5).fillColor('#000').font('Helvetica-Bold');
        const refundText = 'Refund Policy: If the Project is canceled by the Company (BTPL), your money will be refunded within 45 days.';
        const refundHeight = doc.heightOfString(refundText, { width: contentW });
        doc.text('Refund Policy: ', margin, y, { continued: true })
            .font('Helvetica').text('If the Project is canceled by the Company (BTPL), your money will be refunded within 45 days.', { width: contentW });
        y += refundHeight + 20;

        // Additional Notes
        if (proposal.notes && proposal.notes.trim()) {
            doc.fontSize(10).fillColor(GREEN_DARK).font('Helvetica-Bold')
                .text('ADDITIONAL NOTES', margin, y, { lineBreak: false });
            y += 16;
            doc.fontSize(9).fillColor('#333').font('Helvetica');
            const notesHeight = doc.heightOfString(proposal.notes, { width: contentW, align: 'justify', lineGap: 2 });
            doc.text(proposal.notes, margin, y, { width: contentW, align: 'justify', lineGap: 2 });
            y += notesHeight + 15;
        }

        // Regards section
        y += 10;
        doc.fontSize(9.5).fillColor('#333').font('Helvetica')
            .text('Regards,', margin, y, { lineBreak: false });
        y += 14;
        doc.fontSize(10).fillColor('#000').font('Helvetica-Bold')
            .text(companyName.split(' PRIVATE')[0] + ' Pvt Ltd', margin, y, { lineBreak: false });
        y += 14;
        doc.fontSize(8.5).fillColor('#333').font('Helvetica')
            .text(`Add – ${companyAddress}`, margin, y, { lineBreak: false });
        y += 12;
        doc.text(`Email: ${companyEmail}`, margin, y, { lineBreak: false });
        y += 30;

        // Signature section
        const sigY = Math.max(y, pageH - 200);
        doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');

        // Left signature header
        doc.text('For ' + companyName.split(' PRIVATE')[0] + ' Pvt. Ltd.', margin, sigY, { width: contentW / 2, lineBreak: false });
        // Right signature header
        doc.text('Acceptance / Client Signature', margin + contentW / 2, sigY, { width: contentW / 2, lineBreak: false });

        // Signature images
        const sigImgY = sigY + 16;
        const sigImgH = 50;

        const authSigPath = proposal.authorizedSignature ? path.join(__dirname, '..', proposal.authorizedSignature) : null;
        if (authSigPath && fs.existsSync(authSigPath)) {
            doc.image(authSigPath, margin, sigImgY, { fit: [150, sigImgH] });
        }

        const clientSigPath = proposal.clientSignature ? path.join(__dirname, '..', proposal.clientSignature) : null;
        if (clientSigPath && fs.existsSync(clientSigPath)) {
            doc.image(clientSigPath, margin + contentW / 2, sigImgY, { fit: [150, sigImgH] });
        }

        const lineY = sigImgY + sigImgH + 4;
        doc.moveTo(margin, lineY).lineTo(margin + 180, lineY).lineWidth(0.5).strokeColor('#000').stroke();
        doc.moveTo(margin + contentW / 2, lineY).lineTo(margin + contentW / 2 + 180, lineY).stroke();

        doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold');
        doc.text('Authorized Signatory', margin, lineY + 4, { width: 180, lineBreak: false });
        doc.text('Client Name & Signature', margin + contentW / 2, lineY + 4, { width: 180, lineBreak: false });

        doc.font('Helvetica').text(companyName.split(' PRIVATE')[0] + ' Pvt. Ltd.', margin, lineY + 16, { width: 180, lineBreak: false });
        doc.text('Date: ________________', margin + contentW / 2, lineY + 16, { width: 180, lineBreak: false });

        const pageRange = doc.bufferedPageRange();
        for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
            drawFooterOnPage(i);
        }

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
});

// Upload signature images for a proposal (requires update permission and ownership check)
router.post('/:id/signatures', auth, checkPermission('proposals', 'update'), signatureUpload.fields([
    { name: 'authorizedSignature', maxCount: 1 },
    { name: 'clientSignature', maxCount: 1 }
]), async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(proposal, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only update your own proposals' });
        }

        const updateData = {};

        if (req.files?.authorizedSignature) {
            if (proposal.authorizedSignature) {
                const oldPath = path.join(__dirname, '..', proposal.authorizedSignature);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.authorizedSignature = 'uploads/signatures/' + req.files.authorizedSignature[0].filename;
        }

        if (req.files?.clientSignature) {
            if (proposal.clientSignature) {
                const oldPath = path.join(__dirname, '..', proposal.clientSignature);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.clientSignature = 'uploads/signatures/' + req.files.clientSignature[0].filename;
        }

        const updated = await Proposal.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updated);
    } catch (error) {
        console.error('Error uploading signatures:', error);
        res.status(500).json({ message: 'Error uploading signatures', error: error.message });
    }
});

// Delete proposal (requires delete permission and ownership check)
router.delete('/:id', auth, checkPermission('proposals', 'delete'), async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!isProposalAccessible(proposal, req.user)) {
            return res.status(403).json({ message: 'Access denied: You can only delete your own proposals' });
        }

        // Prevent deletion of accepted or rejected proposals
        if (proposal.status === 'accepted' || proposal.status === 'rejected') {
            return res.status(400).json({ message: `Cannot delete a proposal that is already ${proposal.status}` });
        }

        await Proposal.findByIdAndDelete(req.params.id);
        res.json({ message: 'Proposal deleted successfully' });
    } catch (error) {
        console.error('Error deleting proposal:', error);
        res.status(500).json({ message: 'Error deleting proposal' });
    }
});

module.exports = router;
