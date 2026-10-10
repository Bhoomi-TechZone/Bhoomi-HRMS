const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP (GoDaddy - for salary, offer letters, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // automatically handle
  auth: {
    user: process.env.SMTP_EMAIL || 'arzumehreen050@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'cpus ctsa fdtm dmqs'
  }
});

// Create separate transporter for OTP emails (Gmail - for password reset only)
const otpTransporter = nodemailer.createTransport({
  host: process.env.OTP_SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.OTP_SMTP_PORT) || 465,
  secure: process.env.OTP_SMTP_SECURE === 'true',
  auth: {
    user: process.env.OTP_SMTP_EMAIL || 'bhoomitherealestate@gmail.com',
    pass: process.env.OTP_SMTP_PASSWORD || 'lcfz yqtf dueo dxwh'
  }
});


// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.log('[MailService] General SMTP   : Offline/Auth Failed (' + (error.code || 'Auth Error') + ')');
  } else {
    console.log('[MailService] General SMTP   : Ready');
  }
});

// Verify OTP email connection configuration
otpTransporter.verify((error) => {
  if (error) {
    console.log('[MailService] OTP Service    : Offline/Auth Failed (' + (error.code || 'Auth Error') + ')');
  } else {
    console.log('[MailService] OTP Service    : Ready');
  }
});

/**
 * Send salary paid notification email to employee
 * @param {Object} employee - Employee details
 * @param {Object} payroll - Payroll details
 * @param {String} monthName - Month name (e.g., "January")
 * @param {Number} year - Year (e.g., 2026)
 * @param {Buffer} pdfBuffer - Optional PDF buffer to attach as payslip
 */
const sendSalaryPaidEmail = async (employee, payroll, monthName, year, pdfBuffer = null) => {
  try {
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const mailOptions = {
      from: {
        name: 'HRMS Payroll System',
        address: process.env.SMTP_EMAIL || 'arzumehreen050@gmail.com'
      },
      to: employee.email,
      subject: `💰 Salary Credited - ${monthName} ${year}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">💰 Salary Credited!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Your salary for ${monthName} ${year} has been processed</p>
            </div>
            
            <!-- Content -->
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Greeting -->
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Dear <strong>${employee.firstName} ${employee.lastName}</strong>,
              </p>
              
              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                We are pleased to inform you that your salary for the month of <strong>${monthName} ${year}</strong> has been credited to your bank account.
              </p>
              
              <!-- Salary Details Card -->
              <div style="background: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #10b981;">
                <h3 style="margin: 0 0 15px; color: #333; font-size: 16px;">📋 Salary Summary</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Employee ID</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${employee.employeeId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Designation</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${employee.designation || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Department</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${employee.department || 'N/A'}</td>
                  </tr>
                  <tr style="border-top: 1px dashed #e2e8f0;">
                    <td style="padding: 12px 0 8px; color: #666; font-size: 14px;">Gross Salary</td>
                    <td style="padding: 12px 0 8px; color: #333; font-weight: 600; text-align: right;">₹${(payroll.salaryDetails?.grossSalary || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Total Deductions</td>
                    <td style="padding: 8px 0; color: #ef4444; font-weight: 600; text-align: right;">-₹${(payroll.salaryDetails?.totalDeductions || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style="border-top: 2px solid #e2e8f0;">
                    <td style="padding: 12px 0; color: #333; font-size: 16px; font-weight: bold;">Net Salary</td>
                    <td style="padding: 12px 0; color: #10b981; font-weight: bold; text-align: right; font-size: 18px;">₹${(payroll.salaryDetails?.netSalary || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Bank Details -->
              ${employee.bankName ? `
              <div style="background: #eff6ff; border-radius: 10px; padding: 15px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px; color: #1e40af; font-size: 14px;">🏦 Payment Details</h4>
                <p style="margin: 5px 0; color: #64748b; font-size: 13px;">Bank: <strong style="color: #333;">${employee.bankName}</strong></p>
                <p style="margin: 5px 0; color: #64748b; font-size: 13px;">Account: <strong style="color: #333;">****${employee.accountNumber?.slice(-4) || '****'}</strong></p>
              </div>
              ` : ''}
              
              <!-- Payment Date -->
              <div style="text-align: center; margin: 25px 0;">
                <span style="background: #dcfce7; color: #166534; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                  ✅ Payment Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              
              <!-- Attachment Note -->
              ${pdfBuffer ? `
              <div style="background: #fef3c7; border-radius: 10px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 13px;">
                  📎 <strong>Your salary receipt is attached to this email.</strong> You can download and save it for your records.
                </p>
              </div>
              ` : `
              <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 20px;">
                You can download your detailed payslip by logging into the HRMS portal and navigating to <strong>My Payslip</strong> section.
              </p>
              `}
              
              <!-- Footer -->
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  This is an automated email from HRMS Payroll System.<br>
                  Please do not reply to this email.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Attach PDF if provided
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `Salary_Receipt_${employeeName.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Salary paid email sent to ${employee.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending salary paid email:', error);
    return { success: false, error: error.message };
  }
};


/**
 * Send bulk salary paid notification emails
 * @param {Array} payrolls - Array of payroll records with populated employee data
 * @param {String} monthName - Month name
 * @param {Number} year - Year
 */
const sendBulkSalaryPaidEmails = async (payrolls, monthName, year) => {
  const results = [];

  for (const payroll of payrolls) {
    if (payroll.employee && payroll.employee.email) {
      const result = await sendSalaryPaidEmail(payroll.employee, payroll, monthName, year);
      results.push({
        employeeId: payroll.employee.employeeId,
        email: payroll.employee.email,
        ...result
      });
    }
  }

  return results;
};

/**
 * Send offer letter email to a hired candidate
 * @param {Object} letter - Populated OfferLetter document (candidateId populated)
 * @param {Object} company - Company settings object
 */
const sendOfferLetterEmail = async (letter, company = {}) => {
  try {
    const candidateName = `${letter.candidateId?.firstName || ''} ${letter.candidateId?.lastName || ''}`.trim();
    const email = letter.candidateId?.email;
    if (!email) throw new Error('Candidate email not found');

    const companyName = company.companyName || 'the Company';
    const companyWebsite = (company.website || 'yourcompany.com').replace(/^https?:\/\//, '');
    const hrEmail = `hr@${companyWebsite}`;
    const monthly = letter.salary ? Math.round(Number(letter.salary) / 12) : 0;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    const mailOptions = {
      from: { name: `${companyName} – HR Team`, address: process.env.SMTP_EMAIL || 'arzumehreen050@gmail.com' },
      to: email,
      subject: `🎉 Congratulations! Offer Letter – ${letter.position} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;">
          <div style="max-width:620px;margin:0 auto;padding:24px 16px;">

            <!-- Header Banner -->
            <div style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 60%,#7c3aed 100%);border-radius:14px 14px 0 0;padding:36px 32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:10px;">🎉</div>
              <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Congratulations, ${candidateName}!</h1>
              <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">You've been selected for <strong>${letter.position}</strong></p>
            </div>

            <!-- Main Content -->
            <div style="background:#fff;padding:32px;border-radius:0 0 14px 14px;box-shadow:0 4px 20px rgba(0,0,0,0.09);">

              <p style="font-size:15px;color:#334155;margin:0 0 20px;line-height:1.7;">
                Dear <strong>${candidateName}</strong>,<br><br>
                We are thrilled to extend this offer of employment at <strong>${companyName}</strong>. After a thorough review of your qualifications, we are confident you will be a valuable addition to our team.
              </p>

              <!-- Key Details Card -->
              <div style="background:#f8fafc;border-radius:10px;padding:22px;margin:20px 0;border-left:4px solid #6366f1;">
                <h3 style="margin:0 0 16px;color:#1e293b;font-size:15px;font-weight:700;">📋 Offer Summary</h3>
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;width:45%;">Position</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${letter.position}</td>
                  </tr>
                  ${letter.department ? `<tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Department</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${letter.department}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Employment Type</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${letter.employmentType || 'Full Time'}</td>
                  </tr>
                  <tr style="border-top:1px dashed #e2e8f0;">
                    <td style="padding:10px 0 8px;color:#64748b;font-size:13px;">Monthly CTC</td>
                    <td style="padding:10px 0 8px;color:#6366f1;font-weight:800;font-size:16px;">₹${monthly.toLocaleString('en-IN')}/month</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Date of Joining</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${fmtDate(letter.joiningDate)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Offer Valid Until</td>
                    <td style="padding:8px 0;color:#ef4444;font-weight:700;font-size:13px;">${fmtDate(letter.offerExpiry)}</td>
                  </tr>
                  ${letter.workLocation ? `<tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Work Location</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${letter.workLocation}</td>
                  </tr>` : ''}
                  ${letter.reportingTo ? `<tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Reporting To</td>
                    <td style="padding:8px 0;color:#1e293b;font-weight:700;font-size:13px;">${letter.reportingTo}</td>
                  </tr>` : ''}
                </table>
              </div>

              <!-- Expiry Warning -->
              <div style="background:#fef9c3;border-radius:10px;padding:14px 18px;margin:20px 0;border-left:4px solid #f59e0b;">
                <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">
                  ⏰ Please accept or decline this offer by <strong>${fmtDate(letter.offerExpiry)}</strong>.
                  After this date, the offer may be withdrawn.
                </p>
              </div>

              ${letter.notes ? `<div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;margin:20px 0;border-left:4px solid #10b981;">
                <p style="margin:0;color:#166534;font-size:13px;"><strong>📝 Note from HR:</strong> ${letter.notes}</p>
              </div>` : ''}

              <p style="font-size:14px;color:#475569;line-height:1.7;margin:20px 0;">
                To confirm your acceptance, please reply to this email or contact our HR team. The detailed offer letter will be shared with you on or before your joining date.
              </p>

              <!-- Contact -->
              <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-top:20px;text-align:center;">
                <p style="margin:0 0 6px;color:#1e293b;font-size:14px;font-weight:700;">Questions? Contact HR:</p>
                <p style="margin:0;color:#6366f1;font-size:13px;">📧 ${hrEmail}</p>
                ${letter.hrContact ? `<p style="margin:4px 0 0;color:#475569;font-size:13px;">📞 ${letter.hrContact}</p>` : ''}
                ${company.address ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">📍 ${company.address}</p>` : ''}
              </div>

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.7;">
                  This is an official communication from <strong>${companyName}</strong>.<br>
                  Please do not reply to this email unless you have questions — or reach us at ${hrEmail}.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Offer letter email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending offer letter email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP for password change to admin
 * @param {String} email - User email address
 * @param {String} otp - 6-digit OTP
 * @param {String} userName - User's full name
 */
const sendChangePasswordOtp = async (email, otp, userName = 'Admin') => {
  try {
    console.log('OTP Email Service - Sending OTP to:', email);
    console.log('OTP Email Service - Using Gmail:', process.env.OTP_SMTP_EMAIL);

    const mailOptions = {
      from: {
        name: 'HRMS Security',
        address: process.env.OTP_SMTP_EMAIL || 'bhoomitherealestate@gmail.com'
      },
      to: email,
      subject: '🔐 Password Change OTP - HRMS Admin',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center;">
          <div style="max-width: 500px; width: 100%; margin: 0 auto; padding: 20px;">

            <!-- Main Card -->
            <div style="background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); overflow: hidden;">

              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Password Change</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">Your OTP for account security</p>
              </div>

              <!-- Content -->
              <div style="padding: 40px 30px;">

                <!-- Greeting -->
                <p style="font-size: 16px; color: #333; margin: 0 0 25px; font-weight: 500;">
                  Hi ${userName},
                </p>

                <!-- Message -->
                <p style="font-size: 14px; color: #666; line-height: 1.8; margin: 0 0 20px;">
                  You have requested to change your password. To proceed, please use the OTP code below:
                </p>

                <!-- OTP Box -->
                <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your OTP Code</p>
                  <div style="font-size: 36px; font-weight: 700; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; word-spacing: 5px;">
                    ${otp}
                  </div>
                  <p style="color: #94a3b8; font-size: 12px; margin: 15px 0 0;">Valid for 10 minutes</p>
                </div>

                <!-- Important Notes -->
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 25px 0;">
                  <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 500;">
                    ⚠️ <strong>Important:</strong> Never share this OTP with anyone. HRMS staff will never ask for your OTP.
                  </p>
                </div>

                <!-- Steps -->
                <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="color: #333; font-size: 14px; font-weight: 600; margin: 0 0 15px;">📝 Next Steps:</p>
                  <ol style="color: #666; font-size: 13px; line-height: 1.8; padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">Enter the OTP code in the Settings page</li>
                    <li style="margin-bottom: 8px;">Create a strong new password</li>
                    <li>Confirm your new password</li>
                  </ol>
                </div>

                <!-- Security Info -->
                <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 20px 0 0;">
                  If you didn't request this OTP or need further assistance, please contact your administrator.
                </p>

              </div>

              <!-- Footer -->
              <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                  © 2026 HRMS System. This is an automated security email. Please do not reply.
                </p>
              </div>

            </div>

          </div>
        </body>
        </html>
      `
    };

    const info = await otpTransporter.sendMail(mailOptions);
    console.log(`✅ Password change OTP sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password change OTP:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  sendSalaryPaidEmail,
  sendBulkSalaryPaidEmails,
  sendOfferLetterEmail,
  sendChangePasswordOtp
};
