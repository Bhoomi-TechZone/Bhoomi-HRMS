const { logoBase64, stripeBase64, watermarkBase64, signBase64 } = require('./btplAssets');

function generateOfferLetterHTML(data = {}) {
  const {
    name = '',
    designation = '',
    department = '',
    dateOfJoining = '',
    employmentType = 'Full-Time',
    officeLocation = '2nd Floor A-43, Sector 63 Noida 201301',
    annualCTC = '',
    monthlySalary = '',
    monthlyTarget = '',
    workingDays = '06 Days',
    workingHours = '09 Hours',
    officeTiming = '11:00 Am – 08:00Pm Daily',
    observationPeriod = '01 Day (Unpaid)',
    probationPeriod = '03 months',
    noticePeriod = '45 Days',
    reportingManager = 'Mr. Aman Dwivedi (Managing Director)',
    coreResponsibilities = '',
    performanceExpectations = '',
  } = data;

  const headerHtml = `
    <div class="lh-header">
      <div class="lh-logo-wrap">
        <img src="${logoBase64}" class="lh-logo" alt="Bhoomi Techzone" />
      </div>
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
      </div>
    </div>
    <div class="lh-stripe">
      <img src="${stripeBase64}" class="lh-stripe-img" alt="separator" />
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Offer Letter - ${name || 'Candidate'}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    line-height: 1.42;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    padding: 10mm 16mm 10mm 16mm;
    margin: 0 auto;
    position: relative;
    page-break-after: always;
    box-sizing: border-box;
    overflow: hidden;
    background: #fff;
  }
  .page:last-child {
    page-break-after: auto;
  }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 145mm;
    opacity: 0.085;
    pointer-events: none;
    z-index: 0;
  }
  .page-inner {
    position: relative;
    z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .lh-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .lh-logo-wrap {
    flex: 0 0 auto;
  }
  .lh-logo {
    height: 40px;
    width: auto;
    display: block;
    object-fit: contain;
  }
  .lh-company-wrap {
    text-align: right;
    flex: 1;
    padding-left: 15px;
  }
  .lh-company-name {
    font-size: 10pt;
    font-weight: bold;
    color: #000;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .lh-info {
    font-size: 7.5pt;
    color: #222;
    line-height: 1.35;
  }
  .lh-stripe {
    width: 100%;
    height: 8px;
    margin-top: 4px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .lh-stripe-img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  /* Title */
  .doc-title {
    text-align: center;
    font-size: 15pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    margin: 4px 0 10px 0;
    color: #000;
  }

  /* To block */
  .to-block {
    margin-bottom: 8px;
    font-size: 9.5pt;
    line-height: 1.45;
  }
  .to-block strong {
    font-weight: bold;
  }

  /* Table */
  .details-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 8.5pt;
  }
  .details-table th {
    border: 1px solid #000;
    padding: 4px 8px;
    background: #fff;
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
    letter-spacing: 0.5px;
  }
  .details-table td {
    border: 1px solid #000;
    padding: 3.2px 8px;
    vertical-align: middle;
  }
  .details-table td:first-child {
    font-weight: bold;
    width: 36%;
    color: #000;
  }
  .details-table td:last-child {
    width: 64%;
    color: #000;
  }

  /* Section styles */
  .sec-heading {
    font-size: 9.5pt;
    font-weight: bold;
    margin: 7px 0 3px 0;
    color: #000;
  }
  .subsec-heading {
    font-size: 9pt;
    font-weight: bold;
    margin: 5px 0 2px 0;
    color: #000;
  }
  p {
    margin: 4px 0;
    text-align: justify;
    line-height: 1.42;
    font-size: 9.5pt;
  }
  .bullet-list {
    margin-left: 12px;
    margin-top: 3px;
    margin-bottom: 5px;
  }
  .bullet-item {
    position: relative;
    padding-left: 14px;
    margin: 2px 0;
    font-size: 9pt;
    line-height: 1.38;
    text-align: justify;
  }
  .bullet-item::before {
    content: "•";
    position: absolute;
    left: 2px;
    font-size: 9pt;
  }

  /* Signature & Acceptance block */
  .signature-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 15px;
    margin-bottom: 12px;
  }
  .sig-col {
    width: 48%;
  }
  .sig-img {
    height: 48px;
    object-fit: contain;
    display: block;
    margin: 4px 0;
  }

  .acceptance-card {
    border: 1px solid #000;
    padding: 10px 14px;
    margin-top: 8px;
    background: #fafafa;
  }
  .acceptance-title {
    text-align: center;
    font-weight: bold;
    font-size: 10pt;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

  <!-- ================= PAGE 1 ================= -->
  <div class="page">
    <img src="${watermarkBase64}" class="watermark" alt="watermark" />
    <div class="page-inner">
      ${headerHtml}

      <div class="doc-title">OFFER LETTER</div>

      <div class="to-block">
        <div><strong>To</strong></div>
        <div style="margin-top: 2px;">Dear <strong>${name || '___________________'}</strong>,</div>
        <div style="margin-top: 4px; text-align: justify;">
          We are pleased to offer you full-time employment with <strong>Bhoomi Techzone Pvt. Ltd.</strong> for the position of <strong>${designation || '___________________'}</strong>, subject to the terms and conditions mentioned in this letter.
        </div>
      </div>

      <table class="details-table">
        <thead>
          <tr>
            <th colspan="2">JOINING DETAILS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name</td>
            <td><strong>${name || ''}</strong></td>
          </tr>
          <tr>
            <td>Designation</td>
            <td>${designation || ''}</td>
          </tr>
          <tr>
            <td>Department</td>
            <td>${department || ''}</td>
          </tr>
          <tr>
            <td>Date Of Joining</td>
            <td>${dateOfJoining || ''}</td>
          </tr>
          <tr>
            <td>Employment Type</td>
            <td>${employmentType || 'Full-Time'}</td>
          </tr>
          <tr>
            <td>Office Location</td>
            <td>${officeLocation || '2nd Floor A-43, Sector 63 Noida 201301'}</td>
          </tr>
          <tr>
            <td>Monthly Salary</td>
            <td>${monthlySalary ? (monthlySalary.toLowerCase().includes('month') ? monthlySalary : `${monthlySalary} Per Month`) : ''}</td>
          </tr>
          ${monthlyTarget ? `<tr><td>Monthly Target</td><td>${monthlyTarget}</td></tr>` : ''}
          <tr>
            <td>Working Days</td>
            <td>${workingDays || '06 Days'}</td>
          </tr>
          <tr>
            <td>Working Hours</td>
            <td>${workingHours || '09 Hours'}</td>
          </tr>
          <tr>
            <td>Office Timing</td>
            <td>${officeTiming || '11:00 Am – 08:00Pm Daily'}</td>
          </tr>
          <tr>
            <td>Observation Period</td>
            <td>${observationPeriod || '01 Day (Unpaid)'}</td>
          </tr>
          <tr>
            <td>Notice Period</td>
            <td>${noticePeriod || '45 Days'}</td>
          </tr>
          <tr>
            <td>Reporting Manager</td>
            <td>${reportingManager || 'Mr. Aman Dwivedi (Managing Director)'}</td>
          </tr>
        </tbody>
      </table>

      <div class="sec-heading">1. Position and Joining:</div>
      <p>
        You will be appointed as <strong>${designation || '___________________'}</strong> with effect from <strong>${dateOfJoining || '___________________'}</strong>. You will report to <strong>${reportingManager || 'Mr. Aman Dwivedi (Managing Director)'}</strong> and will be based on <strong>${officeLocation || '2nd Floor A-43, Sector 63 Noida 201301'}</strong>.
      </p>
      <p>
        Your employment will be on a full-time basis, and you are expected to devote your professional time, attention, and skills to the Company's business and assigned responsibilities.
      </p>

      <div class="sec-heading">2. Role &amp; Responsibilities:</div>
      <p>
        As <strong>${designation || '___________________'}</strong> your primary responsibilities will include, but will not be limited to:
      </p>
      
      <div class="subsec-heading">A. Core Responsibilities</div>
      <div class="bullet-list">
        ${coreResponsibilities ? coreResponsibilities.split('\n').filter(Boolean).map(l => `<div class="bullet-item">${l.trim()}</div>`).join('') : `
        <div class="bullet-item">Perform all duties and responsibilities associated with the position of <strong>${designation || 'the assigned role'}</strong>.</div>
        <div class="bullet-item">Understand and follow the Company's business processes, policies, standards, and procedures.</div>
        <div class="bullet-item">Complete assigned tasks within agreed timelines and quality standards.</div>
        <div class="bullet-item">Maintain professional communication with management, colleagues, clients, customers, vendors, and other stakeholders.</div>
        <div class="bullet-item">Maintain accurate records, reports, documentation, and other work-related information.</div>
        <div class="bullet-item">Identify issues, delays, risks, or operational challenges and report them to the appropriate manager.</div>
        <div class="bullet-item">Work collaboratively with internal teams to achieve departmental and organizational objectives.</div>
        `}
      </div>

      <div class="subsec-heading">B. Performance Expectations</div>
      <div class="bullet-list">
        ${performanceExpectations ? performanceExpectations.split('\n').filter(Boolean).map(l => `<div class="bullet-item">${l.trim()}</div>`).join('') : `
        <div class="bullet-item">Meet the performance objectives and Key Performance Indicators (KPIs) applicable to your role.</div>
        <div class="bullet-item">Maintain professional standards of conduct and communication.</div>
        <div class="bullet-item">Complete assigned work accurately and within the required timelines.</div>
        <div class="bullet-item">Protect Company and client information.</div>
        <div class="bullet-item">Follow information-security and data-protection requirements.</div>
        <div class="bullet-item">Cooperate with performance reviews and feedback processes.</div>
        <div class="bullet-item">Continuously develop the skills and knowledge required for your position.</div>
        `}
      </div>
    </div>
  </div>

  <!-- ================= PAGE 2 ================= -->
  <div class="page">
    <img src="${watermarkBase64}" class="watermark" alt="watermark" />
    <div class="page-inner">
      ${headerHtml}

      <p style="margin-top: 6px;">
        Regular and result-oriented work is mandatory. "Zero business" may result in deduction or disciplinary action. The employee must justify the offered salary through performance, especially during the first month. In case of failure to achieve assigned targets, management reserves the right to take appropriate action as per company policy.
      </p>

      <div class="sec-heading">C. Reporting and Accountability</div>
      <p>
        You will report to <strong>${reportingManager || 'Mr. Aman Dwivedi (Managing Director)'}</strong>
      </p>
      <p>Your performance will be evaluated based on factors including where applicable:</p>
      <div class="bullet-list">
        <div class="bullet-item">Quality of work</div>
        <div class="bullet-item">Timely completion of assigned responsibilities</div>
        <div class="bullet-item">Productivity and efficiency</div>
        <div class="bullet-item">Professional conduct</div>
        <div class="bullet-item">Teamwork and communication</div>
        <div class="bullet-item">Customer/client satisfaction</div>
        <div class="bullet-item">Achievement of agreed KPIs and targets</div>
        <div class="bullet-item">Compliance with Company policies and procedures</div>
      </div>
      <p>
        The Company may reasonably modify your duties, responsibilities, reporting structure, or KPIs based on business requirements and your position.
      </p>

      <div class="sec-heading">3. Compensation</div>
      <p>
        Your annual Cost to Company (CTC) will be <strong>${annualCTC || '___________________'}</strong> payable according to the Company's payroll policies and subject to applicable statutory deductions.
      </p>
      <p>A detailed salary structure may be provided separately.</p>

      <div class="sec-heading">4. Probation</div>
      <p>
        You will be on probation for <strong>${probationPeriod || '03 months'}</strong> from your date of joining.
      </p>
      <p>
        Your confirmation will be subject to satisfactory performance, conduct, and completion of the probation requirements.
      </p>

      <div class="sec-heading">5. Working Hours and Attendance</div>
      <p>
        Your normal working hours will be <strong>${workingHours || '09 Hours'}</strong>, from <strong>${workingDays || '06 Days'}</strong>, subject to the Company's requirements and applicable law.
      </p>
      <p>
        You are expected to maintain regular attendance and comply with the Company's leave and attendance policies.
      </p>

      <div class="sec-heading">6. Confidentiality and Non-Disclosure Agreement</div>
      <p>
        During your employment, you may have access to confidential information belonging to the Company, its customers, employees, vendors, or business partners.
      </p>
      <p>You agree that you will:</p>
      <div class="bullet-list">
        <div class="bullet-item">Keep all confidential and proprietary information strictly confidential.</div>
        <div class="bullet-item">Use such information only for legitimate Company purposes.</div>
        <div class="bullet-item">Not disclose confidential information to any unauthorized person or third party.</div>
        <div class="bullet-item">Not copy, transfer, publish, sell, misuse, or distribute confidential information without authorization.</div>
        <div class="bullet-item">Protect Company documents, systems, credentials, databases, and other information from unauthorized access.</div>
      </div>
      <p style="font-size: 8.5pt; color: #333; margin-top: 4px;">
        This includes but is not limited to: Mobile devices • ID/access cards • Documents and files • Storage devices • Company credentials • Customer information • Software and other Company materials
      </p>
    </div>
  </div>

  <!-- ================= PAGE 3 ================= -->
  <div class="page">
    <img src="${watermarkBase64}" class="watermark" alt="watermark" />
    <div class="page-inner">
      ${headerHtml}

      <p style="margin-top: 6px;">
        You must not retain confidential information on personal devices, email accounts, cloud storage, or other unauthorized systems.
      </p>
      <p>
        Immediately report any suspected security incident, data loss, or unauthorized disclosure. Confidential information may include business plans, financial information, customer information, pricing, source code, software, databases, technical information, product plans, designs, trade secrets, passwords, credentials, internal communications, documents, and other non-public information.
      </p>
      <p>
        These confidentiality obligations will continue after your employment ends to the extent permitted by applicable law.
      </p>

      <div class="sec-heading">7. Intellectual Property</div>
      <p>
        Any work product created by you in the course of your employment, including documents, designs, software, source code, processes, reports, materials, inventions, developments, or other intellectual property relating to the Company's business, will be handled in accordance with applicable law and Company policies.
      </p>
      <p>
        You agree to reasonably cooperate with the Company in documenting or protecting its rights in such work product.
      </p>

      <div class="sec-heading">8. Company Property and Data</div>
      <p>
        All Company property provided to you must be used responsibly and only for authorized purposes.
      </p>
      <p>
        Upon resignation, termination, or whenever requested by the Company, you must return all Company property, including: Laptop/computer and accessories • Mobile devices • ID/access cards • Documents and files • Storage devices • Company credentials • Software access • Customer information • Software and other Company materials.
      </p>
      <p>
        The Employee shall maintain strict confidentiality of all Company information and shall not copy, disclose, transfer, misuse, reproduce, or share any Company data or confidential information with any unauthorized person or third party, during or after employment.
      </p>
      <p>
        In the event of any unauthorized disclosure, misuse, theft, copying, transfer, loss, or breach of Company data or confidential information attributable to the Employee, the Company may impose a contractual penalty of <strong>₹5,00,000 (Rupees Five Lakh only)</strong>, subject to applicable law, in addition to its right to seek recovery of any actual losses, damages, costs, or expenses and to take appropriate legal action.
      </p>

      <div class="sec-heading">9. Conflict of Interest</div>
      <p>
        You must disclose any actual or potential conflict of interest that may affect your responsibilities to the Company. Any outside employment, consultancy, freelancing, or business activity must comply with applicable law and Company policy and must not interfere with your duties.
      </p>

      <div class="sec-heading">10. Company Policies</div>
      <p>You agree to comply with all applicable Company policies, including:</p>
      <div class="bullet-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px;">
        <div class="bullet-item">Code of Conduct</div>
        <div class="bullet-item">Confidentiality and NDA Policy</div>
        <div class="bullet-item">Information Security Policy</div>
        <div class="bullet-item">Data Protection and Privacy Policy</div>
        <div class="bullet-item">Anti-Harassment Policy</div>
        <div class="bullet-item">Leave and Attendance Policy</div>
        <div class="bullet-item">IT and Acceptable Use Policy</div>
        <div class="bullet-item">Intellectual Property Policy</div>
        <div class="bullet-item">Workplace Conduct Policy</div>
      </div>

      <div class="subsec-heading" style="margin-top: 8px;">Company Assets, Confidentiality and Data Protection</div>
      <p style="font-size: 8.8pt;">
        The Employee acknowledges that all company assets, equipment, documents, records, software, devices, access credentials, confidential information, business data, customer data, intellectual property, and other materials provided to or accessed by the Employee during employment shall remain the sole property of the Company. If the Employee voluntarily resigns or leaves employment for any reason, the Employee shall, on or before the last working day or immediately upon the Company's request, hand over all Company assets and property in his/her possession or control. The Employee shall not retain any physical or electronic copy of Company data, documents, files, credentials, or confidential information after separation.
      </p>
    </div>
  </div>

  <!-- ================= PAGE 4 ================= -->
  <div class="page">
    <img src="${watermarkBase64}" class="watermark" alt="watermark" />
    <div class="page-inner">
      ${headerHtml}

      <p style="margin-top: 4px; font-size: 9pt;">
        Failure to return Company assets or to comply with the above obligations may result in the Company seeking recovery of the applicable costs/losses, imposing contractual remedies to the extent permitted by applicable law, and initiating appropriate civil or criminal legal proceedings where warranted.
      </p>
      <p style="font-size: 9pt;">
        These obligations relating to confidentiality, Company property, data protection, and unauthorized use or disclosure shall survive the termination or cessation of employment to the extent permitted by applicable law.
      </p>

      <div class="sec-heading" style="color: #2C7946; border-bottom: 1px solid #2C7946; padding-bottom: 2px;">
        RESIGNATION &amp; NOTICE PERIOD
      </div>
      <p>
        A mandatory <strong>${noticePeriod || '45 Days'} notice period</strong> is required before resignation. Failure to serve it may result in the withholding of your pending salary, incentives, or benefits.
      </p>

      <div class="sec-heading" style="color: #2C7946; border-bottom: 1px solid #2C7946; padding-bottom: 2px; margin-top: 8px;">
        Leave Policy for All Employees
      </div>
      <p style="font-size: 8.8pt;">
        Please be informed that the following leave policy will be applicable to all employees, including both junior and senior staff members:
      </p>
      <div class="bullet-list">
        <div class="bullet-item"><strong>Saturday or Monday Leave:</strong> If an employee takes uninformed or sudden leave on Saturday or Monday (the beginning or end of the week), Sunday will also be considered unpaid. In such cases, a total of 2 days will be unpaid.</div>
        <div class="bullet-item"><strong>Leave on Both Saturday and Monday:</strong> If an employee remains absent on both Saturday and Monday without prior information or approval, Sunday will also be included, resulting in 3 days of unpaid leave.</div>
        <div class="bullet-item"><strong>Emergency or Genuine Reasons:</strong> In case of a medical emergency, health issue, or any other urgent and unavoidable situation, the HR team will review the matter based on valid supporting documents and verification. If the reason is found to be genuine and approved by HR, the additional unpaid deduction for Saturday or Monday will not apply; however, Sunday will remain unpaid as per the applicable policy.</div>
      </div>
      <p style="font-size: 8.8pt;">
        This policy is applicable equally to all junior and senior employees. Everyone is requested to inform HR in advance and obtain leave approval wherever possible. Any exception will be considered only after proper verification and approval by the HR team.
      </p>

      <div class="subsec-heading">1. During the Probation Period</div>
      <p style="font-size: 8.8pt;">
        During the probation period, employees will not be entitled to any paid leave. Any leave taken during this period will be treated as unpaid leave, subject to the company's applicable attendance and leave policies.
      </p>

      <div class="subsec-heading">2. Leave Policy After Completion of Probation</div>
      <p style="font-size: 8.8pt;">
        After successfully completing the probation period, employees will be eligible for <strong>01 paid leave per month</strong>, as offered by the company. These leaves may be used for medical reasons, emergencies, or personal/casual requirements, subject to company policy and the applicable approval process.
      </p>

      <div class="subsec-heading">3. Monthly Leave Validity</div>
      <p style="font-size: 8.8pt;">
        The paid leaves offered by the company must be utilized within the same calendar month. Any unused leaves will not be carried forward to the following month and will expire at the end of the respective months.
      </p>

      <div class="subsec-heading">4. Leave Approval</div>
      <p style="font-size: 8.8pt;">
        Employees must inform the HR team in advance and obtain approval wherever possible. In case of medical emergencies or unavoidable circumstances, employees must notify HR as soon as possible and provide supporting documents when required.
      </p>
    </div>
  </div>

  <!-- ================= PAGE 5 ================= -->
  <div class="page">
    <img src="${watermarkBase64}" class="watermark" alt="watermark" />
    <div class="page-inner">
      ${headerHtml}

      <div class="sec-heading" style="color: #2C7946; border-bottom: 1px solid #2C7946; padding-bottom: 2px;">
        SALARY &amp; PAYMENT TERMS
      </div>
      <p style="font-size: 9pt;">
        <strong>a)</strong> Salary should be disbursed on or before the 10th - 15th day of every month.<br/>
        <strong>b)</strong> Salary structure and incentives shall be governed as per company policy.<br/>
        <strong>c)</strong> If you do leave the job due to any reasons in starting 15 days or after 15 days in that case company will not provide any FNF, there will not be any generate salary. Total 15 days will be unpaid completely.
      </p>

      <div class="subsec-heading" style="margin-top: 8px;">FULL &amp; FINAL SETTLEMENT</div>
      <p style="font-size: 9pt;">
        <strong>Timeline:</strong> Within 45 days from the last working day.<br/>
        <strong>Conditions:</strong> All handover formalities and clearances must be completed.
      </p>

      <div class="sec-heading">11. Background Verification</div>
      <p style="font-size: 9pt;">
        This offer is subject to satisfactory verification of the information and documents provided by you, including identity, educational qualifications, employment history, and other relevant information.
      </p>

      <div class="sec-heading">12. Notice Period and Termination</div>
      <p style="font-size: 9pt;">
        Either party may terminate the employment by providing <strong>${noticePeriod || '45 Days'} written notice</strong> or salary in lieu of notice, subject to applicable law and Company policy.
      </p>
      <p style="font-size: 9pt;">
        The Company may take appropriate disciplinary action, including termination where legally permissible, in cases involving serious misconduct, fraud, unauthorized disclosure of confidential information, or significant violation of Company policies.
      </p>

      <div class="sec-heading">13. Governing Law</div>
      <p style="font-size: 9pt;">
        This offer and your employment will be governed by applicable laws and regulations.
      </p>

      <div class="sec-heading">14. Acceptance of Offer</div>
      <p style="font-size: 9pt;">
        Please sign and return a copy of this letter as confirmation of your acceptance of the employment terms.
      </p>
      <p style="font-size: 9pt;">
        We are pleased to welcome you to <strong>Bhoomi Techzone Pvt. Ltd.</strong> and look forward to your contribution to the organization.
      </p>

      <div class="signature-row">
        <div class="sig-col">
          <div style="font-weight: bold; font-size: 9.5pt;">Sincerely,</div>
          <div style="font-weight: bold; font-size: 9.5pt; color: #2C7946; margin-top: 2px;">For Bhoomi Techzone Private Limited</div>
          <img src="${signBase64}" class="sig-img" alt="HR Signature" />
          <div style="font-weight: bold; font-size: 9.5pt;">Name: Nipur Vishnoi</div>
          <div style="font-size: 9pt; color: #333;">Designation: Sr. HR Admin</div>
        </div>
        <div class="sig-col" style="display: flex; flex-direction: column; align-items: flex-end;">
          <div style="width: 235px;">
            <div style="font-weight: bold; font-size: 9.5pt; margin-bottom: 25px; text-align: left;">Candidate Acceptance Signature</div>
            <div style="font-size: 9pt; text-align: left; margin-bottom: 8px;">
              <span style="display: inline-block; width: 72px;">Signature:</span><span>_______________________</span>
            </div>
            <div style="font-size: 9pt; text-align: left;">
              <span style="display: inline-block; width: 72px;">Date:</span><span>_______________________</span>
            </div>
          </div>
        </div>
      </div>

      <div class="acceptance-card">
        <div class="acceptance-title">EMPLOYEE ACCEPTANCE</div>
        <p style="font-size: 8.8pt; line-height: 1.45; text-align: justify; margin-bottom: 10px;">
          I, <strong>${name || '___________________________'}</strong>, confirm that I have read, understood, and accepted the terms and conditions contained in this offer letter, including the confidentiality, NDA, intellectual-property, and Company policy requirements.
        </p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin-top: 8px;">
          <div>Employee Name: <span style="font-weight: normal;">${name || '___________________'}</span></div>
          <div>Signature: <span style="font-weight: normal;">___________________</span></div>
          <div>Date: <span style="font-weight: normal;">___________________</span></div>
        </div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { generateOfferLetterHTML };
