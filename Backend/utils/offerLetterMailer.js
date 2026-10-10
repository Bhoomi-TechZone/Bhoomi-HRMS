const nodemailer = require('nodemailer');

// ── Gmail transporter – used only for offer letter emails ──
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Gmail App Password (16-char)
  },
});

mailer.verify((err) => {
  if (err) {
    console.log('[MailService] Offer Letters  : Offline/Auth Failed (' + (err.code || 'Auth Error') + ')');
  } else {
    console.log('[MailService] Offer Letters  : Ready');
  }
});

/**
 * Send offer letter email to a hired candidate
 * @param {Object} letter  – Populated OfferLetter document
 * @param {Object} company – Company settings object
 */
const sendOfferLetterEmail = async (letter, company = {}) => {
  try {
    const candidateName = `${letter.candidateId?.firstName || ''} ${letter.candidateId?.lastName || ''}`.trim();
    const toEmail = letter.candidateId?.email;
    if (!toEmail) throw new Error('Candidate email not found');

    const companyName    = company.companyName || 'the Company';
    const companyWebsite = (company.website || 'yourcompany.com').replace(/^https?:\/\//, '');
    const hrEmail        = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const monthly        = letter.salary ? Math.round(Number(letter.salary) / 12) : 0;
    const fmtDate        = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    const mail = {
      from: `"${companyName} – HR Team" <${hrEmail}>`,
      to:   toEmail,
      subject: `🎉 Congratulations! Offer Letter – ${letter.position} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
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

              ${letter.notes ? `
              <div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;margin:20px 0;border-left:4px solid #10b981;">
                <p style="margin:0;color:#166534;font-size:13px;"><strong>📝 Note from HR:</strong> ${letter.notes}</p>
              </div>` : ''}

              <p style="font-size:14px;color:#475569;line-height:1.7;margin:20px 0;">
                To confirm your acceptance, please reply to this email or contact our HR team. The detailed offer letter document will be shared with you on or before your joining date.
              </p>

              <!-- HR Contact -->
              <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-top:20px;text-align:center;">
                <p style="margin:0 0 6px;color:#1e293b;font-size:14px;font-weight:700;">Questions? Contact HR:</p>
                <p style="margin:0;color:#6366f1;font-size:13px;">📧 ${hrEmail}</p>
                ${letter.hrContact ? `<p style="margin:4px 0 0;color:#475569;font-size:13px;">📞 ${letter.hrContact}</p>` : ''}
                ${company.address ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">📍 ${company.address}</p>` : ''}
              </div>

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.7;">
                  This is an official communication from <strong>${companyName}</strong>.<br>
                  For any queries, reach us at ${hrEmail}.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await mailer.sendMail(mail);
    console.log(`[MailService] Offer letter sent to ${toEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[MailService] Offer letter email error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOfferLetterEmail };
