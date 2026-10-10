const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const THEME_GREEN = '#649e62';
const HEADER_BG = '#649e62';
const STRIPE_LIGHT = '#f4f8f3';
const BORDER_CLR = '#c8d9c5';
const TEXT_DARK = '#263238';
const TEXT_MUTED = '#607d8b';
const WHITE = '#ffffff';

const fmt = (amount) => {
    const num = Number(amount) || 0;
    return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPlain = (amount) => {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function numberToWords(num) {
    if (!num || num === 0) return 'ZERO RUPEES ONLY';
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const convert = (n) => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    return convert(Math.floor(num)) + ' RUPEES ONLY';
}

const generateSalaryReceiptPDF = async (payroll) => {
    return new Promise((resolve, reject) => {
        try {
            // A4 Landscape is ideal to match Payslip BHOOMI.pdf template
            const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const employee = payroll.employee || {};
            const sd = payroll.salaryDetails || {};
            const allowances = sd.allowances || {};
            const deductions = sd.deductions || {};
            const month = payroll.payPeriod?.month;
            const year = payroll.payPeriod?.year;
            const monthName = month ? monthNames[month - 1] : 'N/A';

            const mg = 28;
            const pw = doc.page.width - mg * 2;
            let y = mg;
            const TEXT_DARK = '#334155'; // Softer elegant slate dark
            const TEXT_VAL = '#1e293b';  // Clean crisp text for values
            const TEXT_MUTED = '#64748b'; // Balanced muted label color
            const WHITE = '#ffffff';

            let logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
            if (!fs.existsSync(logoPath)) {
                logoPath = path.join(__dirname, '..', '..', '..', 'HRMSfront', 'public', 'logo.png');
            }

            // ═══════════ WATERMARK (Tilted 45 degrees, centered in table section) ═══════════
            if (fs.existsSync(logoPath)) {
                try {
                    doc.save();
                    doc.opacity(0.045);
                    const centerX = doc.page.width / 2;
                    const centerY = 270; // Moved higher up to stay fully contained within the table section
                    const wmWidth = 260; // Scaled nicely so it does not bleed into the bottom words area
                    const wmHeight = 120;

                    // Rotate 45 degrees around the table center
                    doc.rotate(-30, { origin: [centerX, centerY] });
                    doc.image(logoPath, centerX - (wmWidth / 2), centerY - (wmHeight / 2), {
                        width: wmWidth,
                        height: wmHeight,
                        fit: [wmWidth, wmHeight],
                        align: 'center'
                    });
                    doc.restore();
                } catch (e) {
                    // Ignore watermark error
                }
            }

            // Register Unicode font that natively supports ₹ (Indian Rupee symbol)
            const segoePath = 'C:\\Windows\\Fonts\\segoeui.ttf';
            const segoeBoldPath = 'C:\\Windows\\Fonts\\segoeuib.ttf';
            const hasUnicodeFont = fs.existsSync(segoePath);
            if (hasUnicodeFont) {
                doc.registerFont('AppFont', segoePath);
                if (fs.existsSync(segoeBoldPath)) {
                    doc.registerFont('AppFont-Bold', segoeBoldPath);
                } else {
                    doc.registerFont('AppFont-Bold', segoePath);
                }
            }

            const fontNorm = hasUnicodeFont ? 'AppFont' : 'Helvetica';
            const fontBold = hasUnicodeFont ? 'AppFont-Bold' : 'Helvetica-Bold';
            const rupeeSym = '₹';

            // Outer decorative container border
            doc.rect(mg - 8, mg - 8, pw + 16, doc.page.height - mg * 2 + 16)
                .strokeColor('#d1e0ce')
                .lineWidth(1)
                .stroke();

            // ═══════════ 1. HEADER (Company Logo & Details) ═══════════
            // Company Info on Left
            doc.fillColor('#1b3815').fontSize(16).font(fontBold)
                .text('BHOOMI TECHZONE PVT LTD', mg, y);

            doc.fillColor(TEXT_MUTED).fontSize(8.5).font(fontNorm)
                .text('A-43, A Block, Sector 63', mg, y + 20)
                .text('Noida, Uttar Pradesh 201301', mg, y + 31)
                .text('Email: info@bhoomitechzone.in | Phone: +91 8130787194, +1 (307) 533 5310', mg, y + 43);

            // Logo on Right & Pay Period
            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, mg + pw - 130, y - 4, { width: 130, height: 46, fit: [130, 46], align: 'right' });
                } catch (e) {
                    doc.fillColor('#1b3815').fontSize(18).font(fontBold)
                        .text('BHOOMI', mg + pw - 120, y, { width: 120, align: 'right' });
                }
            }

            // Month and Year below Logo
            doc.fillColor('#1b3815').fontSize(9.5).font(fontBold)
                .text(`${monthName} ${year}`, mg + pw - 160, y + 45, { width: 160, align: 'right' });

            y += 62;

            // ═══════════ 2. EMPLOYEE INFORMATION BANNER ═══════════
            const bannerH = 20;
            doc.rect(mg, y, pw, bannerH).fill(HEADER_BG);
            doc.fillColor(WHITE).fontSize(9.5).font(fontBold)
                .text('EMPLOYEE INFORMATION', mg + 8, y + 5);
            y += bannerH;

            // Employee Information Grid (4 Columns x 2 Rows)
            const colW = pw / 4;
            const empRowH = 26;

            const empName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
            const empId = employee.employeeId || payroll.employeeId || 'N/A';
            const dept = employee.department || 'N/A';
            const desig = employee.designation || 'N/A';
            const email = employee.email || 'N/A';
            const lopDays = payroll.workingDays?.absent || 0;
            const paidDays = (payroll.workingDays?.present || 0) + (payroll.workingDays?.weekoff || 0) + (payroll.workingDays?.holiday || 0) + (payroll.workingDays?.leave || 0);
            const bankAcc = employee.accountNumber || '—';

            const drawEmpCell = (x, cy, label, val) => {
                doc.rect(x, cy, colW, empRowH).fillAndStroke(WHITE, BORDER_CLR);
                doc.fillColor(TEXT_MUTED).fontSize(7).font(fontBold)
                    .text(label.toUpperCase(), x + 6, cy + 4);
                doc.fillColor(TEXT_VAL).fontSize(8.5).font(fontNorm)
                    .text(String(val), x + 6, cy + 13, { width: colW - 12, ellipsis: true });
            };

            // Row 1
            drawEmpCell(mg, y, 'Employee Name', empName);
            drawEmpCell(mg + colW, y, 'Employee ID', empId);
            drawEmpCell(mg + colW * 2, y, 'Department', dept);
            drawEmpCell(mg + colW * 3, y, 'Designation', desig);
            y += empRowH;

            // Row 2
            drawEmpCell(mg, y, 'Email ID', email);
            drawEmpCell(mg + colW, y, 'LOP Days', `${lopDays} Days`);
            drawEmpCell(mg + colW * 2, y, 'Paid Days', `${paidDays} Days`);
            drawEmpCell(mg + colW * 3, y, 'Bank A/C No', bankAcc);
            y += empRowH + 10;

            // ═══════════ 3. EARNINGS & DEDUCTIONS TABLES ═══════════
            const halfW = pw / 2;
            const subH = 20;

            // Headers
            // Earnings Header
            doc.rect(mg, y, halfW, subH).fill(HEADER_BG);
            doc.fillColor(WHITE).fontSize(8.5).font(fontBold)
                .text('EARNINGS', mg + 12, y + 5)
                .text(`AMOUNT (${rupeeSym})`, mg + halfW - 90, y + 5, { width: 78, align: 'right' });

            // Deductions Header
            doc.rect(mg + halfW, y, halfW, subH).fill(HEADER_BG);
            doc.fillColor(WHITE).fontSize(8.5).font(fontBold)
                .text('DEDUCTIONS', mg + halfW + 12, y + 5)
                .text(`AMOUNT (${rupeeSym})`, mg + pw - 90, y + 5, { width: 78, align: 'right' });

            y += subH;

            // Earnings Rows: Always show all standard earnings titles (Basic Salary, HRA, Conveyance, Food, Additional Bonus)
            const basicSal = sd.basicSalary || 0;
            const hra = allowances.hra || 0;
            const conveyance = allowances.conveyance || allowances.transport || 0;
            const food = allowances.food || 0;
            const bonus = sd.bonus || 0;

            const earningsItems = [
                ['Basic Salary', basicSal],
                ['House Rent Allowance (HRA)', hra],
                ['Conveyance Allowance', conveyance],
                ['Food Allowance', food],
                ['Additional Bonus', bonus]
            ];

            // Deductions Rows: Only show Penalty and Loss of Pay (LOP)
            const manualPenalty = deductions.penalty || 0;
            const lateDed = deductions.lateDeduction || 0;
            const halfDayDed = deductions.halfDayDeduction || 0;
            const totalPenalty = manualPenalty + lateDed + halfDayDed;
            const lopDeduction = deductions.lossOfPay || 0;

            const deductionItems = [
                ['Penalty', totalPenalty, totalPenalty > 0],
                ['Loss of Pay (LOP)', lopDeduction, false]
            ];

            const rowHeight = 22;
            const numRows = Math.max(earningsItems.length, deductionItems.length);
            const contentBoxH = numRows * rowHeight;

            // Draw single clean outer box around both sides (NO inner horizontal row lines, transparent fill so watermark shows)
            doc.rect(mg, y, halfW, contentBoxH).strokeColor(BORDER_CLR).lineWidth(0.8).stroke();
            doc.rect(mg + halfW, y, halfW, contentBoxH).strokeColor(BORDER_CLR).lineWidth(0.8).stroke();

            for (let i = 0; i < numRows; i++) {
                const earn = earningsItems[i];
                const ded = deductionItems[i];
                const rowY = y + (i * rowHeight);

                // Left (Earnings)
                if (earn && earn[0]) {
                    doc.fillColor(TEXT_DARK).fontSize(8.5).font(fontNorm)
                        .text(earn[0], mg + 12, rowY + 6);
                    doc.fillColor(TEXT_DARK).fontSize(8.5).font(fontBold)
                        .text(`${rupeeSym} ${fmtPlain(earn[1])}`, mg + halfW - 90, rowY + 6, { width: 78, align: 'right' });
                }

                // Right (Deductions)
                if (ded && ded[0]) {
                    doc.fillColor(TEXT_DARK).fontSize(8.5).font(fontNorm)
                        .text(ded[0], mg + halfW + 12, rowY + 6);
                    doc.fillColor(ded[2] ? '#b91c1c' : TEXT_DARK).fontSize(8.5).font(fontBold)
                        .text(`${rupeeSym} ${fmtPlain(ded[1])}`, mg + pw - 90, rowY + 6, { width: 78, align: 'right' });
                }
            }

            y += contentBoxH;

            // Total Earnings & Total Deductions Summary Row
            // Total Earnings = Basic Salary + All Allowances + Bonus
            const totalEarnings = basicSal + hra + conveyance + food + bonus;
            // Total Deductions = Penalty (Late + HalfDay + Manual) + Loss of Pay (LOP)
            const totalDeductions = totalPenalty + lopDeduction;
            const netPayable = Math.max(0, totalEarnings - totalDeductions);

            const totH = 24;
            // Total Earnings Box
            doc.rect(mg, y, halfW, totH).fillAndStroke(STRIPE_LIGHT, BORDER_CLR);
            doc.fillColor('#1b3815').fontSize(9).font(fontBold)
                .text('TOTAL EARNINGS', mg + 12, y + 7)
                .text(`${rupeeSym} ${fmtPlain(totalEarnings)}`, mg + halfW - 100, y + 7, { width: 88, align: 'right' });

            // Total Deductions Box
            doc.rect(mg + halfW, y, halfW, totH).fillAndStroke(STRIPE_LIGHT, BORDER_CLR);
            doc.fillColor('#b91c1c').fontSize(9).font(fontBold)
                .text('TOTAL DEDUCTIONS', mg + halfW + 12, y + 7)
                .text(`${rupeeSym} ${fmtPlain(totalDeductions)}`, mg + pw - 100, y + 7, { width: 88, align: 'right' });

            y += totH + 12;

            // ═══════════ 4. BOTTOM PAYMENT METRICS GRID (6 Columns) ═══════════
            const botH = 20;
            const botColW = pw / 6;

            // Green Header Bar for Metrics
            doc.rect(mg, y, pw, botH).fill(HEADER_BG);
            const headers = ['SLIP NO.', 'PAYMENT STATUS', 'PAYMENT DATE', 'MODE OF PAYMENT', 'GROSS AMOUNT', 'NET AMOUNT'];
            headers.forEach((h, idx) => {
                const align = (idx >= 4) ? 'right' : 'left';
                doc.fillColor(WHITE).fontSize(7.5).font(fontBold)
                    .text(h, mg + botColW * idx + (align === 'right' ? 0 : 6), y + 6, {
                        width: botColW - 12,
                        align: align
                    });
            });
            y += botH;

            // Values Row
            const slipNo = `BT-${year}${String(month).padStart(2, '0')}-${empId}`;
            const payStatus = (payroll.status || 'draft').toUpperCase();
            const payDate = payroll.paidAt ? new Date(payroll.paidAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
            const payMode = (payroll.paymentMethod || 'Bank Transfer').toUpperCase();
            const values = [slipNo, payStatus, payDate, payMode, `${rupeeSym} ${fmtPlain(totalEarnings)}`, `${rupeeSym} ${fmtPlain(netPayable)}`];
            const valH = 24;

            values.forEach((v, idx) => {
                const isNet = (idx === 5);
                const align = (idx >= 4) ? 'right' : 'left';
                doc.rect(mg + botColW * idx, y, botColW, valH).fillAndStroke(WHITE, BORDER_CLR);
                doc.fillColor(isNet ? '#15803d' : TEXT_DARK).fontSize(isNet ? 9 : 8).font(fontBold)
                    .text(v, mg + botColW * idx + (align === 'right' ? 0 : 6), y + 7, {
                        width: botColW - 12,
                        align: align
                    });
            });

            y += valH + 10;

            // ═══════════ 5. AMOUNT IN WORDS BOX ═══════════
            const wordsH = 26;
            const netAmountNum = netPayable;
            doc.rect(mg, y, pw, wordsH).fillAndStroke(STRIPE_LIGHT, BORDER_CLR);
            doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica-Bold')
                .text('AMOUNT IN WORDS -  ', mg + 10, y + 8, { continued: true });
            doc.fillColor('#1b3815').fontSize(8.5).font('Helvetica-Bold')
                .text(numberToWords(netAmountNum));

            // Footer note
            doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Oblique')
                .text('* This is a computer generated salary slip and requires no physical signature.', mg, doc.page.height - mg - 10, { align: 'center', width: pw });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateSalaryReceiptPDF };

