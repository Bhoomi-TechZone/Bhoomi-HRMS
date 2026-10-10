import PizZip from 'pizzip';

/**
 * Master NDA Template Generator
 * Formatted precisely according to D:\BhoomiHrms\Frontend\public\NDA Formate.docx
 * Populates all employee details and dynamic fields filled in by HR / User.
 */

export const generateNDADocx = async (ndaForm = {}) => {
  let response;
  try {
    response = await fetch('/NDA.docx');
    if (!response.ok) throw new Error('File not found');
  } catch {
    try {
      response = await fetch(encodeURI('/NDA.docx'));
      if (!response.ok) throw new Error('File not found');
    } catch {
      try {
        response = await fetch(encodeURI('/NDA Formate.docx'));
        if (!response.ok) throw new Error('File not found');
      } catch {
        response = await fetch('/NDA_Formate.docx');
      }
    }
  }
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const fmt = (d) => {
    if (!d) return '___________';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const joiningDateFmt = fmt(ndaForm.joiningDate);
  const employeeName = (ndaForm.employeeName || ndaForm.candidateName || ndaForm.name || ndaForm.clientName || '').trim();
  const sal = (ndaForm.salutation || 'Mr.').trim();
  const fullName = (sal && !employeeName.startsWith(sal)) ? `${sal} ${employeeName}`.trim() : employeeName;
  const fathersName = (ndaForm.fathersName || ndaForm.fatherName || '').trim();
  const fullAddress = (ndaForm.fullAddress || ndaForm.address || ndaForm.currentAddress || ndaForm.permanentAddress || '').trim();
  const designation = (ndaForm.designation || ndaForm.position || '').trim();
  const mobileNo = (ndaForm.mobileNo || ndaForm.phone || ndaForm.mobile || ndaForm.contactNo || '').trim();
  const emailId = (ndaForm.emailId || ndaForm.email || ndaForm.mailId || '').trim();
  const relation = (sal === 'Ms.' || sal === 'Mrs.' || sal === 'Miss') ? 'daughter of' : 'son of';

  const escapeXml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Build regexes that match across potential Word XML tags
  const xmlTag = '(?:<[^>]+>)*';
  const makeRegex = (words) => {
    const pattern = words
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(`${xmlTag}\\s*${xmlTag}`);
    return new RegExp(`(?:\\(|\\{|\\[)${xmlTag}\\s*${pattern}\\s*${xmlTag}(?:\\)|\\}|\\])`, 'gi');
  };

  const regexMap = [
    { regex: makeRegex(['Joining', 'date']), val: joiningDateFmt },
    { regex: makeRegex(['DOJ']), val: joiningDateFmt },
    { regex: makeRegex(['Date', 'of', 'Joining']), val: joiningDateFmt },
    { regex: makeRegex(['SAL']), val: sal },
    { regex: makeRegex(['Salutation']), val: sal },
    { regex: makeRegex(['Employee', 'Name']), val: fullName || employeeName },
    { regex: makeRegex(['Candidate', 'Name']), val: fullName || employeeName },
    { regex: makeRegex(['Father’s', 'Name']), val: fathersName },
    { regex: makeRegex(['Father\'s', 'Name']), val: fathersName },
    { regex: makeRegex(['Fathers', 'Name']), val: fathersName },
    { regex: makeRegex(['Father', 'Name']), val: fathersName },
    { regex: makeRegex(['Full', 'Address']), val: fullAddress },
    { regex: makeRegex(['Address']), val: fullAddress },
    { regex: makeRegex(['Designation']), val: designation },
    { regex: makeRegex(['Position']), val: designation },
    { regex: makeRegex(['Mobile', 'No.']), val: mobileNo },
    { regex: makeRegex(['Mobile', 'No']), val: mobileNo },
    { regex: makeRegex(['Mobile', 'Number']), val: mobileNo },
    { regex: makeRegex(['Contact', 'No']), val: mobileNo },
    { regex: makeRegex(['Phone', 'No']), val: mobileNo },
    { regex: makeRegex(['Mail', 'id']), val: emailId },
    { regex: makeRegex(['Email', 'id']), val: emailId },
    { regex: makeRegex(['Email', 'ID']), val: emailId },
    { regex: makeRegex(['Email']), val: emailId },
    { regex: makeRegex(['son/daughter', 'of']), val: relation },
  ];

  // Apply to all xml files in zip (document, headers, footers)
  const xmlFiles = Object.keys(zip.files).filter(k => k.startsWith('word/') && k.endsWith('.xml'));
  for (const file of xmlFiles) {
    let content = zip.file(file).asText();

    // 1. Bracketed placeholders
    for (const { regex, val } of regexMap) {
      content = content.replace(regex, escapeXml(val));
    }

    // 2. Direct string replacements for clean templates
    content = content
      .replace(/\(Joining date\)/gi, escapeXml(joiningDateFmt))
      .replace(/\(DOJ\)/gi, escapeXml(joiningDateFmt))
      .replace(/\(SAL\)/gi, escapeXml(sal))
      .replace(/\(Employee Name\)/gi, escapeXml(fullName || employeeName))
      .replace(/\(Father’s Name\)/gi, escapeXml(fathersName))
      .replace(/\(Father's Name\)/gi, escapeXml(fathersName))
      .replace(/\(Full Address\)/gi, escapeXml(fullAddress))
      .replace(/\(Designation\)/gi, escapeXml(designation))
      .replace(/\(Mobile No\.\)/gi, escapeXml(mobileNo))
      .replace(/\(Mobile No\)/gi, escapeXml(mobileNo))
      .replace(/\(Mail id\)/gi, escapeXml(emailId))
      .replace(/{{employee_name}}/gi, escapeXml(fullName || employeeName))
      .replace(/{{joining_date}}/gi, escapeXml(joiningDateFmt))
      .replace(/{{designation}}/gi, escapeXml(designation))
      .replace(/{{full_address}}/gi, escapeXml(fullAddress))
      .replace(/{{mobile_no}}/gi, escapeXml(mobileNo))
      .replace(/{{email_id}}/gi, escapeXml(emailId))
      .replace(/{{fathers_name}}/gi, escapeXml(fathersName));

    // 3. Safely update text inside <w:t> tags for signature block labels
    content = content.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/gi, (m, openTag, text, closeTag) => {
      let t = text;
      // "Name of Employee:" (or "Name of Employee: ")
      if (/Name\s+of\s+Employee\s*:\s*$/i.test(t)) {
        t = t.replace(/Name\s+of\s+Employee\s*:\s*$/i, `Name of Employee: ${escapeXml(fullName || employeeName)}`);
      }
      // "Designation:"
      if (/Designation\s*:\s*$/i.test(t)) {
        t = t.replace(/Designation\s*:\s*$/i, `Designation: ${escapeXml(designation)}`);
      }
      // "Contact No:" or "Contact No.:"
      if (/Contact\s+No\.?\s*:\s*$/i.test(t)) {
        t = t.replace(/Contact\s+No\.?\s*:\s*$/i, `Contact No: ${escapeXml(mobileNo)}`);
      }
      // "Date & Place:"
      if (/Date\s*&\s*Place\s*:\s*$/i.test(t)) {
        t = t.replace(/Date\s*&\s*Place\s*:\s*$/i, `Date & Place: ${escapeXml(joiningDateFmt)}, Noida`);
      }
      return `${openTag}${t}${closeTag}`;
    });

    zip.file(file, content);
  }

  const generatedBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return generatedBlob;
};

export const generateNDAHtml = ({ ndaForm = {}, logoSrc = '', bgSrc = '', signSrc = '', hrName = 'Nicki Verma' }) => {
  const fmt = (d) => {
    if (!d) return '___________';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const joiningDateFmt = fmt(ndaForm.joiningDate);
  const effectiveDateFmt = fmt(ndaForm.joiningDate || new Date());
  const sal = ndaForm.salutation || 'Mr.';
  const employeeName = (ndaForm.employeeName || '___________').trim();
  const fullName = `${sal} ${employeeName}`.trim();
  const fathersName = ndaForm.fathersName || '___________';
  const fullAddress = ndaForm.fullAddress || '___________';
  const designation = ndaForm.designation || '___________';
  const mobileNo = ndaForm.mobileNo || '___________';
  const emailId = ndaForm.emailId || '___________';
  const relation = (sal === 'Ms.' || sal === 'Mrs.' || sal === 'Miss') ? 'daughter of' : 'son of';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Employee Non-Disclosure &amp; Non-Compete Agreement – ${fullName}</title>
<style>
  @page {
    size: A4;
    margin: 4mm 14mm 10mm 14mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    line-height: 1.5;
    color: #111827;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .document-container {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    position: relative;
    background: #ffffff;
  }
  
  /* Background Watermark if provided */
  .bg-watermark {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.10;
    background-image: url('${bgSrc}');
    background-repeat: no-repeat;
    background-position: top center;
    background-size: 100% auto;
  }

  .content-layer {
    position: relative;
    z-index: 1;
    padding: 2px 10px 20px 10px;
  }

  /* Header Section */
  .header-section {
    margin-top: 0;
    margin-bottom: 10px;
    padding-top: 0;
    padding-bottom: 6px;
    border-bottom: 2px solid #000000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .logo-img {
    height: 48px;
    max-width: 175px;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
    margin: 0;
  }
  .company-header-text {
    flex: 1;
    text-align: center;
  }
  .company-title {
    font-size: 11pt;
    font-weight: bold;
    color: #000000;
    margin-bottom: 2px;
    letter-spacing: 0.2px;
  }
  .company-sub {
    font-size: 8.5pt;
    font-weight: bold;
    color: #333333;
    line-height: 1.35;
  }

  /* Centered Underlined Title */
  .agreement-title {
    font-size: 11.5pt;
    font-weight: bold;
    text-align: center;
    text-decoration: underline;
    margin: 10px 0 10px 0;
    letter-spacing: 0.3px;
    color: #000000;
    text-transform: uppercase;
  }

  /* Paragraphs */
  p {
    margin-bottom: 9px;
    text-align: justify;
    font-size: 9.5pt;
    line-height: 1.55;
    color: #1f2937;
  }
  p strong {
    color: #000000;
  }

  /* Headings */
  .clause-heading {
    font-size: 10pt;
    color: #000000;
    font-weight: bold;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
    break-after: avoid;
  }

  .subclause-heading {
    font-size: 9.5pt;
    color: #000000;
    font-weight: bold;
    margin-top: 10px;
    margin-bottom: 4px;
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Highlight filled data */
  .field-val {
    font-weight: bold;
    color: #000000;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Definition list / Bullet items */
  .def-list {
    margin: 6px 0 10px 18px;
    list-style-type: disc;
  }
  .def-list li {
    margin-bottom: 6px;
    font-size: 9.5pt;
    line-height: 1.5;
    text-align: justify;
    color: #1f2937;
  }
  .def-term {
    font-weight: bold;
    font-style: italic;
    color: #000000;
  }

  .sub-item {
    margin-left: 18px;
    margin-bottom: 5px;
    text-align: justify;
    font-size: 9.5pt;
    line-height: 1.5;
  }

  .sub-sub-item {
    margin-left: 36px;
    margin-bottom: 4px;
    text-align: justify;
    font-size: 9.5pt;
    line-height: 1.5;
  }

  /* Notices Grid */
  .notices-grid {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin: 12px 0 16px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .notice-box {
    width: 48%;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 10px 14px;
    background: #f9fafb;
    font-size: 9pt;
    line-height: 1.5;
  }
  .notice-box-title {
    font-weight: bold;
    color: #000000;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }

  /* Signatures matching Exact Corporate Layout */
  .sig-container {
    margin-top: 28px;
    padding-top: 14px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .sig-grid {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 30px;
  }
  .sig-col-left {
    flex: 1;
    max-width: 48%;
  }
  .sig-col-right {
    flex: 1;
    max-width: 48%;
  }
  .sig-heading {
    font-size: 9.5pt;
    font-weight: bold;
    color: #000000;
    margin-bottom: 8px;
  }
  .sig-company-logo {
    height: 40px;
    max-width: 155px;
    object-fit: contain;
    display: block;
    margin: 4px 0 6px 0;
  }
  .sig-sign-img {
    height: 42px;
    object-fit: contain;
    display: block;
    margin: 4px 0 6px 0;
  }
  .sig-person-name {
    font-size: 9.5pt;
    font-weight: bold;
    color: #000000;
    margin-bottom: 1px;
  }
  .sig-person-desig {
    font-size: 8.5pt;
    color: #374151;
    margin-bottom: 1px;
  }
  .sig-person-company {
    font-size: 8.5pt;
    font-weight: bold;
    color: #000000;
    margin-bottom: 1px;
  }
  .sig-person-contact {
    font-size: 8pt;
    color: #4b5563;
  }

  /* Right column details */
  .emp-sig-row {
    display: flex;
    align-items: flex-end;
    font-size: 9pt;
    margin-bottom: 5px;
    line-height: 1.4;
  }
  .emp-sig-lbl {
    font-weight: bold;
    color: #000000;
    width: 115px;
    flex-shrink: 0;
  }
  .emp-sig-val {
    color: #000000;
    font-weight: 600;
  }
  .emp-sig-line {
    flex: 1;
    border-bottom: 1px solid #000000;
    height: 18px;
    margin-left: 4px;
    min-width: 130px;
  }

  .sig-note {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    font-size: 8pt;
    color: #4b5563;
    font-style: italic;
  }
  .sig-footer-bar {
    margin-top: 12px;
  }
  .sig-footer-line {
    border-top: 1px solid #166534;
    margin-bottom: 4px;
  }
  .sig-footer-row {
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    font-weight: bold;
    color: #000000;
    padding-bottom: 4px;
  }
  .sig-bottom-strip {
    height: 5px;
    background: #166534;
    width: 100%;
  }
</style>
</head>
<body>
<div class="document-container">
  ${bgSrc ? `<div class="bg-watermark"></div>` : ''}
  
  <div class="content-layer">
    <!-- Header Section matching NDA_Formate.docx -->
    <div class="header-section">
      ${logoSrc ? `<img class="logo-img" src="${logoSrc}" alt="Bhoomi Techzone" />` : ''}
      <div class="company-header-text">
        <div class="company-title">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="company-sub">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
        <div class="company-sub">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
      </div>
    </div>

    <!-- Agreement Title -->
    <div class="agreement-title">EMPLOYEE NON-DISCLOSURE &amp; NON-COMPETE AGREEMENT</div>

    <!-- Preamble -->
    <p>
      This Employee Non-disclosure &amp; Non-compete Agreement is made &amp; executed at NOIDA on dated <span class="field-val">${joiningDateFmt}</span> BETWEEN <strong>BHOOMI TECHZONE PVT. LTD.</strong> A private limited company incorporated under THE COMPANIES ACT, 2013 vide CIN Number and having its registered office at Noida, India (hereinafter referred to as the “company”, which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to mean and include its successors and assigns)
    </p>

    <p style="text-align:center;font-weight:bold;margin:8px 0;">AND</p>

    <p>
      <span class="field-val">${fullName}</span>, ${relation} <span class="field-val">${fathersName}</span>, residing at <span class="field-val">${fullAddress}</span>, herein after referred to as the “employee”, which expression shall include her heirs, executors, administrators, successors and permitted assigns) of the second part. Each of the company and the employee shall hereinafter be referred to individually as a “party” and jointly as the “parties”, as the context may so require.
    </p>

    <p><strong>Whereas</strong></p>

    <p><strong>A.</strong> The company is engaged in the business of software development (“business”);</p>
    <p><strong>B.</strong> Employee has represented to the company that he/she is highly skilled in the field of <span class="field-val">${designation}</span>;</p>
    <p><strong>C.</strong> The company desires to offer employment to the employee and the employee desires to accept such offer of employment, on the terms and conditions set forth in this agreement;</p>

    <p>
      Now therefore, in consideration of the foregoing and other good and valuable consideration, the receipt and adequacy of which are hereby expressly acknowledged, the parties, intending to be legally bound, hereby agree as follows:
    </p>

    <!-- Clause 1 -->
    <div class="clause-heading">1. DEFINITIONS AND INTERPRETATION</div>
    <div class="subclause-heading">1.1 DEFINITIONS</div>
    <ul class="def-list">
      <li><span class="def-term">“Act”</span> shall mean the COMPANIES ACT, 2013.</li>
      <li><span class="def-term">“Affiliates”</span> shall mean, with respect to any person, any company, corporation, association or other person, which, directly or indirectly, controls, is controlled by or is under common control with the first named person. If such person is an individual, the term “affiliate” shall include a relative of such individual;</li>
      <li><span class="def-term">“Agreement” or “Employment Agreement”</span> shall mean this employment agreement, together with the schedules, as may be amended, modified or supplemented from time to time, in accordance with the terms of the agreement;</li>
      <li><span class="def-term">“Appointment letter” or “letter”</span> shall mean the separate letter of appointment detailing the compensation to be paid to employee.</li>
      <li><span class="def-term">“Business”</span> shall have meaning ascribed to it in recital a hereto;</li>
      <li><span class="def-term">“Business day”</span> shall mean a day (other than a saturday or a sunday) on which scheduled commercial banks are generally open for business in Delhi NCR, India;</li>
      <li><span class="def-term">“Cause”</span> shall, with respect to the employee, mean any of the following:</li>
    </ul>

    <div class="sub-item">i. The employee committing serious or gross negligence in the exercise of her functions, roles and/or responsibilities;</div>
    <div class="sub-item">ii. The employee engaging in gross misconduct, fraud or unlawful conduct or use of company’s information or property or misappropriation of assets of the company for personal gain;</div>
    <div class="sub-item">iii. The employee failing to comply with company’s policies; the charter documents of the company or any obligation imposed under applicable law in relation to her appointment in the company;</div>
    <div class="sub-item">iv. Failure by the employee to perform her duties as entrusted by company from time to time;</div>
    <div class="sub-item">v. Any breach by the employee of any of the terms of the agreement;</div>
    <div class="sub-item">vi. If the employee is found to be indulging in any criminal offense or serious misconduct in accordance with any law, activities amounting to moral or financial turpitude, activities which are against the interest of the company;</div>
    <div class="sub-item">vii. If any information furnished by the employee in the application for employment, during the interviews or at the time of joining, is found to be incorrect, or any relevant information has been withheld or any facts come to the notice of the company, which have been either concealed or suppressed by the employee;</div>
    <div class="sub-item">viii. Any act of employee adversely affecting the company’s reputation;</div>
    <div class="sub-item">ix. Sexual harassment or any other misconduct under the posh act or posh policy of the company; or</div>
    <div class="sub-item">x. The conviction of employee by a judgment of a competent court for a crime by employee, which conviction sentences him to imprisonment of any term.</div>

    <ul class="def-list" style="margin-top: 8px;">
      <li><span class="def-term">“Charter Documents”</span> shall, with respect to a person, mean the articles of association and memorandum of association, certificate of incorporation or similar organizational or incorporation documents, of such person</li>
      <li><span class="def-term">“Company Group”</span> the company, and, together with all of its direct or indirect subsidiaries, collectively;</li>
      <li><span class="def-term">“Confidential Information”</span> shall mean any oral or written information (in whatever media or form, whether tangible or otherwise) disclosed to the employee and includes trade secrets, technical information, past, present and future business strategies, business facilities, resources, operations, requirements, methods, customer information, supplier information, know-how, inventions, discoveries, and improvements, financial information and projections, security arrangements, personnel information, domain names, pricing information and strategy pertaining to products of the company; information concerning research, experimental work, development, design details and specifications, engineering, procurement requirements, purchasing, manufacturing, investors, employees, business and contractual relationships, business forecasts, sales and merchandising, marketing plans and information, all works, programs, papers, records, data, notes, drawings, files, documents, samples, devices, products, equipment, and other materials, including copies in whatever form and translations into any other language and all intellectual property rights of the company, work product, administrative and/or organizational matters which is known to the employee by virtue of her employment with the company, including other information, which is confidential or proprietary to the company, the affiliates of the company, customers or sub-contractors of the company, and materials that are customarily treated as confidential or proprietary, whether or not specifically identified as confidential or proprietary and includes any other information which, by its nature or circumstance surrounding its disclosure, may be reasonably construed to be confidential or proprietary;</li>
      <li><span class="def-term">“Contract”</span> shall mean all contracts, sub-contracts, agreements, undertakings, promises, understandings, engagements, leases, financial instruments, purchase orders, commitments and other contractual arrangements, in each case which are binding and enforceable in accordance with applicable law;</li>
      <li><span class="def-term">“control”</span> (including the terms “controlling”, “controlled by” and “under common control with”) means, in relation to a body corporate, the right to exercise, or control the exercise of, whether directly or indirectly, acting alone or together with another person, more than 50% of the total voting rights at a general meeting of that body corporate, or the right or power to direct, whether directly or indirectly, acting alone or together with another person, the policy decisions or management of that body corporate, including the composition of any board of directors of that body corporate, and, in relation to an individual, includes any relative of that person, and in relation to any person which is not a body corporate or an individual, the right or power to direct, whether directly or indirectly, acting alone or together with another person, the policy decisions or management of that person;</li>
      <li><span class="def-term">“Effective date”</span> shall mean the date of execution of this agreement;</li>
      <li><span class="def-term">“Governmental approvals”</span> shall mean any permission, approval, consent, license, permit, order, authorization, registration, filing, notification, exemption or ruling to, from or with any governmental authority;</li>
      <li><span class="def-term">“Governmental authority”</span> shall mean any governmental or statutory authority, government department, agency, commission, board, tribunal or court or other entity in India authorized to make laws, rules or regulations or pass directions, or any state or other subdivision thereof or any municipality, district or other subdivision thereof having jurisdiction pursuant to applicable laws;</li>
      <li><span class="def-term">“Incapacitated”</span> shall, in respect of the employee, mean any disability of nature whatsoever, physical, mental or otherwise, which prevents or materially handicaps the employee from performing the obligations required under the agreement for a period of ninety (90) consecutive days, or otherwise for a total of one hundred twenty (120) days, during any period of twelve (12) months;</li>
      <li><span class="def-term">“Intellectual Property”</span> Includes existing and future Intellectual Property in the nature of unregistered or registered rights to any and all patents, copyrights, trademarks and other confidential and/or proprietary information limited to that forming part of the subject matter of the agreement, and inclusive of all intellectual property that is the subject of ownership by Company and/or its subsidiaries, venture partners and predecessors in interest, business and/or title, arising out of the performance of this agreement and/or other business arrangements, inclusive of but not limited to any oral arrangement which Company may have entered into with the Party or other party.</li>
      <li><span class="def-term">“Law”</span> shall mean (i) all applicable provisions of all constitutions, treaties, statutes, laws (including common law), codes, rules, regulations, ordinances, bye-laws or orders of, or any similar form of decision, interpretation or policy of, or determination by, any governmental authority, (ii) governmental approvals, and (iii) orders, decision, injunctions, judgments, awards and decrees of or agreements with any governmental authority;</li>
      <li><span class="def-term">“Person”</span> shall mean any natural person, limited or unlimited liability company, company, corporation, partnership (whether limited or unlimited), proprietorship, Hindu undivided family, trust, union, association, government or any agency or political subdivision thereof or any other entity that may be treated as a person under applicable laws;</li>
      <li><span class="def-term">“Relative(s)”</span> of a natural person means anyone who is related to such person in any of the ways set forth in section 2(77) of the act; and</li>
      <li><span class="def-term">“work product”</span> means intellectual property rights or parts thereof, conceived, developed, or otherwise made by the employee, alone or jointly with others (a) in any way relating to the company group’s business; (b) during the course of employee’s employment with the company group; (c) using tools, resources or materials belonging to the company group; (d) or based on material or information belonging to the company group; whether or not made during the employee’s regular working hours or whether or not made on the company group’s premises.</li>
    </ul>

    <div class="subclause-heading">1.2 INTERPRETATION</div>
    <div class="sub-item">i. Unless the context of the agreement otherwise requires:</div>
    <div class="sub-sub-item">(a) Words using the singular or plural number also include the plural or singular number, respectively;</div>
    <div class="sub-sub-item">(b) Words of any gender are deemed to include the other gender; and</div>
    <div class="sub-sub-item">(c) Reference to the word “include” shall be construed without limitation;</div>
    <div class="sub-item">ii. The terms “hereof”, “herein”, “hereby”, “hereto” and derivative or similar words refer to the entire agreement or specified clauses or schedules of this agreement, as the case may be;</div>
    <div class="sub-item">iii. The terms “clause” and “schedule” refers to the specified clause or schedule of this agreement;</div>
    <div class="sub-item">iv. Reference to any legislation or law or to any provision thereof shall include references to any such legislation or law as it may, after the date hereof, from time to time, be amended, supplemented or re-enacted, and any reference to a statutory provision shall include any subordinate legislation made from time to time under that provision;</div>
    <div class="sub-item">v. The schedules, annexures and recitals shall constitute an integral part of this agreement;</div>
    <div class="sub-item">vi. The index, bold typeface, headings and titles herein are used for convenience of reference only and shall not affect the construction of the agreement;</div>
    <div class="sub-item">vii. Any word or phrase defined in the body of the agreement as opposed to being defined in clause 1.1 above shall have the meaning assigned to it in such definition throughout the agreement, unless the contrary is expressly stated or the contrary clearly appears from the context;</div>
    <div class="sub-item">viii. When any number of days is prescribed in any document, the same shall be reckoned exclusively of the first and inclusively of the last day unless the last day does not fall on a business day, in which case the last day</div>
    <div class="sub-item">ix. shall be the next succeeding day that is a business day;</div>
    <div class="sub-item">x. Reference to any document includes an amendment or supplement to, or replacement or novation of, that document, but disregarding any amendment, supplement, replacement or novation made in breach of the agreement;</div>
    <div class="sub-item">xi. Reference to an “amendment” includes a supplement, modification, novation, replacement or re-enactment and the term “amended” is to be construed accordingly; and</div>
    <div class="sub-item">xii. No provision of this agreement shall be interpreted in favour of, or against, any party by reason of the extent to which such party or its counsel participated in the drafting hereof.</div>

    <!-- Clause 2 -->
    <div class="clause-heading">2. AGREEMENT TO EMPLOY</div>
    <p>
      On and subject to the terms and conditions of this agreement, the company agrees to appoint the employee as <span class="field-val">${designation}</span> with effect from the effective date (<span class="field-val">${joiningDateFmt}</span>), and the employee agrees to be employed as, and discharge the duties and functions of <span class="field-val">${designation}</span> in accordance with the terms of the agreement.
    </p>

    <!-- Clause 3 -->
    <div class="clause-heading">3. TERMS OF EMPLOYMENT</div>
    <div class="subclause-heading">3.1 REMUNERATION</div>
    <div class="sub-item">i. In consideration of the services rendered by the employee, and other covenants of the employee under the agreement, the employee shall be entitled to receive remuneration, statutory dues and other benefits from the company as set forth in letter of appointment, which shall be (a) subject to revisions as may be determined by the company from time to time in accordance with the company’s policies, and (b) any limits that may be prescribed under applicable law.</div>
    <div class="sub-item">ii. The monthly salary for each month shall be payable on or prior to the 10th day of the immediately succeeding month to a bank account designated by the employee in writing. A pro-rata payment will be made where a full calendar month’s period of employment has not been completed.</div>
    <div class="sub-item">iii. Employee is bound to not share compensation, benefit and other remuneration details with co-workers. Sharing of such information shall be grounds for immediate termination without any notice.</div>
    <div class="sub-item">iv. The employee's compensation will be reviewed periodically by the company and any increase will be discretionary and subject to and on basis of effective performance and company’s results during the period.</div>
    <div class="sub-item">v. The employee agrees and acknowledges that the company may, subject to applicable laws, at any time during the term of employment or cessation thereof, deduct from the employee's salary, or final settlement, any amounts owed by the employee, including but not limited to, any outstanding loans, advances, overpayments or costs incurred by the company due to any damage or loss to company property, etc. Caused by the employee.</div>

    <div class="subclause-heading">3.2 LOCATION</div>
    <p>
      The employee’s principal place of employment during the term of her employment shall be at the company’s Noida headquarters, however, she/he may be transferred to any other branch, parent company or subsidiary or associate company of the company at any place at the sole discretion of the company and she shall report to such place within the specified time frame as may be specified by the company. Transfer is necessary incidence of appointment. The employee shall not raise any objections in that behalf. Employee, as part of her duties, may be required to travel (within India or outside India). The company shall endeavour to provide reasonable prior notice of such travel requirements, wherever possible, to the employee. The employee hereby expressly agrees to such travel, in order to carry out her obligations under the agreement in accordance with the provisions contained herein and the company’s travel policy including any modifications and amendments thereto.
    </p>

    <div class="subclause-heading">3.3 TAXATION</div>
    <div class="sub-item">i. Any tax liability arising in respect of payments made pursuant to the agreement or income earned by the employee while the agreement is in effect shall be borne solely by the employee. The payments made to the employee by the company for the services rendered to the company by the employee, shall be subject to the withholding of taxes as applicable under the applicable laws.</div>
    <div class="sub-item">ii. The employee shall file required tax returns in accordance with applicable law.</div>

    <!-- Clause 4 -->
    <div class="clause-heading">4. SCOPE OF WORK AND DUTIES/OBLIGATIONS OF THE EMPLOYEE</div>
    <p><strong>4.1</strong> Employee shall have the normal duties, responsibilities and authority of an individual holding a similar position in a company of comparable size and nature to that of the company including, but not limiting to, the duties provided by the organization separately or specified by the company from time to time.</p>
    <p><strong>4.2</strong> The employee shall report to the persons as communicated by the company from time to time.</p>
    <p><strong>4.3</strong> The shift working hours &amp; weekly off, leave entitlements, medical benefits, shall be applicable as per the company policy.</p>
    <p><strong>4.4</strong> The employee shall, in addition to the terms and conditions of employment specifically stated herein, also be governed by the rules, regulations, policies, practices, systems and procedures framed by the company, as amended, modified or omitted by the company from time to time. At its sole discretion and without assigning any reason therefore, the company reserves the right to amend, modify, alter, withdraw, substitute any or all terms, conditions and policies, whether specified in the letter of employment or otherwise. The employee shall also be governed by applicable laws.</p>
    <p><strong>4.5</strong> The employee shall provide such information, written records and/or explanations as the company may, from time to time, require.</p>
    <p><strong>4.6</strong> The employee undertakes that he shall maintain good relationship with the customers, suppliers, business associates and all other persons dealing with the company and undertakes that he shall not cause any breach of any obligations of the company, which could afford to any person the right to accelerate any indebtedness or terminate any right of the company.</p>
    <p><strong>4.7</strong> Employee shall, during the term, devote all of her professional and business time, attention, knowledge, expertise, best efforts, skills and abilities and energies towards performing her duties. Employee shall, during the term, not hold any other professional, executive, managerial or directorial positions or any other position or responsibilities in or in relation to any entity other than the company.</p>
    <p><strong>4.8</strong> The employee agrees that she shall not participate in any activity that constitutes an actual or potential conflict of interest with her employment with the company.</p>
    <p><strong>4.9</strong> The employee acknowledges that the company reserves the right to modify any power and/or duty delegated to the employee under the agreement.</p>
    <p><strong>4.10</strong> Nothing in the agreement shall be construed to limit, condition, or otherwise encumber the right of the company to amend, discontinue, substitute, or maintain any benefit plan, program, or perquisite.</p>
    <p><strong>4.11</strong> The employee shall intimate the company in advance and shall take prior consent of the company for all transactions entered into between the company and any third party who is in any way related to the employee, her family or any entity in which the employee or her relative has any interest.</p>
    <p><strong>4.12</strong> Employee expressly agrees not to either directly or indirectly commit or cause to commit any cyber-crime such as: (i) gain unauthorized access to the computer system or computer network of the company; or (ii) download, copy or extract any information or data from such system; or (iii) introduce any harmful code in such system; or (iv) cause any damage or non-functioning or malfunctioning of such system or network; or (v) cause denial of access to any authorized person to such system or network; or (vi) contravene any provision of the (Indian) information technology act, 2000 and the rules and regulation made there under; or (vii) alter or delete any information residing in a computer resource or diminishes the value or the utility of the function of such computer system or network through any means; or (viii) do anything which has the effect of adversely affecting the performance of a computer network or services of the company.</p>
    <p><strong>4.13</strong> The employee’s performance will reviewed as per company policy. The employee shall promptly take any such action as may be required in a performance improvement plan “pip”. Failure to fulfill the obligations of a pip shall be considered cause for purposes of termination of employment.</p>

    <!-- Clause 5 -->
    <div class="clause-heading">5. TERM</div>
    <p>
      <strong>5.1</strong> This agreement shall be valid from the effective date and until earlier termination of the agreement in accordance with the terms hereof, whichever is earlier (the “term”). The company and the employee agree that the agreement is at-will and not for any definite term of employment. Either employee or the company can, and shall have the right to, terminate the employment at any time in accordance with the terms of the agreement. Nothing contained in the or any other agreement or any other statements or representations shall alter the at-will relationship.
    </p>

    <!-- Clause 6 -->
    <div class="clause-heading">6. INTELLECTUAL PROPERTY RIGHTS</div>
    <p><strong>6.1</strong> The employee hereby confirms and acknowledges that the company has sole and absolute rights over any and all intellectual property rights used by the company whether as an owner or as a licensee and the same will exclusively belong to the company and/or its affiliates (as applicable) and the employee shall have no rights in respect of such intellectual property rights and he shall make no claims in respect thereto. Further, the employee acknowledges that work product is created during the course of employee’s employment with the company and the work product shall be the sole and absolute property of the company from date of creation there of. To the extent that the work product or any portion thereof needs to be assigned to the company to ensure that the company is sole and absolute owner thereof, the employee hereby assigns and agrees to assign in the future to company all rights, title, and interest in and to any and all of the portion of the work product.</p>
    <p><strong>6.2</strong> The employee hereby confirms and agrees that he shall execute all such documents and take all such actions as may be required by the company for the purposes of giving effect to the assignment contemplated above, if required, by the company, at no additional cost to the company or its affiliates. The employee shall not, at any time, do or cause to be done, any act or thing, directly or indirectly in any way impairing the company’s or its affiliates’ right, title or interest in the work product/intellectual property rights.</p>
    <p><strong>6.3</strong> In the event the foregoing assignment to the company is ineffective for any reason, each member of the company group is hereby granted and shall have a royalty-free, sub licensable transferable, irrevocable, perpetual, worldwide license to make, have made, modify, use, sell and otherwise exploit such intellectual property rights/work product as part of or in connection with any product, process, service or machine.</p>
    <p><strong>6.4</strong> The employee hereby forever irrevocably and unconditionally waives and agrees never to assert any and all rights including but not limited to moral rights or any rights of similar nature under any applicable law in any jurisdiction in and to any and all intellectual property/work product created by the employee in relation to the services rendered by him to the company even after termination of her employment with the company. The employee’s legal heirs shall not retain any moral rights in the work product. “moral rights” means any rights to claim authorship of a work, to object to or prevent the modification or destruction of a work, to withdraw from circulation or control the publication or distribution of a work, and any similar right, regardless of whether or not such right is denominated or generally referred to as a “moral right.”</p>
    <p><strong>6.5</strong> All rights, title and interest in intellectual property rights/work product, including the right to amend, alter, copy or commercially exploit the same, shall belong solely to, and be for the benefit of the company.</p>
    <p><strong>6.6</strong> The employee shall not, without prior written consent of the company, use or copy any intellectual property rights for any purposes whatsoever other than as may be required for the purposes or in connection with discharge of her functions in ordinary course.</p>
    <p><strong>6.7</strong> The employee represents and warrants and undertakes that he will not use or integrate in the work product any third party materials or data that are not validly licensed to the company. The employee represents and warrants that employee has not violated the intellectual property rights of any third party and covenants that he shall not violate the intellectual property rights of any third party in the course of her employment with the company.</p>
    <p><strong>6.8</strong> The employee agrees that all written records of all intellectual property rights/work product during the term of her employment with the company, in the form of notes, sketches, drawings, and any other format, shall be available to and remain the sole property of the company at all times.</p>
    <p><strong>6.9</strong> Employee agrees to assist the company in every proper way to secure, obtain and enforce for the company all intellectual property rights/work product worldwide. He shall execute and deliver any documents that the company may reasonably request from him in connection with providing such assistance. Her obligations under the clause 6 will continue beyond the termination of my employment with the company. The employee irrevocably appoints the company to be her attorney in her name and on her behalf to complete any instrument or do any such thing and to use her name for the purpose of giving to the company or its nominee the full benefit of the provisions of the clause 6. The employee agrees that the company has an interest in such authority/agency and that the same cannot be terminated to the prejudice of the company.</p>
    <p><strong>6.10</strong> The employee agrees and acknowledge that the compensation paid to him by the company under the agreement includes consideration for assignment of all intellectual property developed by him in accordance with the clause 6.</p>
    <p><strong>6.11</strong> The rights and obligations under the clause 6 shall continue to apply after termination of the agreement for any reason and each such obligation is enforceable independently of the others and its validity shall not be affected if any of the others is held to be partly or wholly unenforceable.</p>

    <!-- Clause 7 -->
    <div class="clause-heading">7. NON-COMPETE AND NON-SOLICIT UNDERTAKING</div>
    <p>
      <strong>7.1</strong> Without prejudice to anything anywhere contained the agreement, in view of the employment contemplated by the terms of the agreement, during the term of the agreement and for a period of one (1) year thereafter (“restricted period”), the employee shall not through an agent, firm, partnership, limited liability partnership, company or otherwise in any other manner, directly or indirectly and shall cause her affiliates (and their respective successors and assigns) to not, directly or indirectly:
    </p>
    <div class="sub-item">i. engage in any business anywhere in India where the company is at the time of such termination of the agreement doing business or actively contemplating to do business that competes, directly or indirectly, with the business;</div>
    <div class="sub-item">ii. own an interest in, manage, operate, join, control, lend money or render financial or other assistance to or participate in or be connected with, as a partner, stockholder, co-venturer, consultant or otherwise, any person that is engaged or planning to become engaged in any business that competes with the business;</div>
    <div class="sub-item">iii. solicit any employee of the company or any affiliate of the company to leave her or her employment, or induce or attempt to induce any employee of the company or any affiliate of the company to terminate or breach her or her employment agreement, or solicit any employee who was in the employment of the company or any of its affiliates at any time in the preceding 12 (twelve) months, or hire or engage in any other manner any employee of the company or any affiliate of the company;</div>
    <div class="sub-item">iv. Solicit, cause in any part or knowingly encourage any past or then existing clients or suppliers of the company or any affiliate of the company to cease doing business in whole or in part with the company or any affiliate of the company.</div>

    <p style="margin-top:8px;"><strong>7.2</strong> The employee acknowledges that:</p>
    <div class="sub-item">i. The duration and scope of the undertakings in the clause 7 are reasonable under the circumstances in which they have been given;</div>
    <div class="sub-item">ii. Such undertakings are material for the willingness of the company to employ the employee, and the employee stands to benefit from such employment; and</div>
    <div class="sub-item">iii. He has various other skill sets which, if deployed, would not result in a breach of her undertakings in the clause 7.</div>

    <p style="margin-top:8px;">
      <strong>7.3</strong> The employee expressly waives any right to assert inadequacy of consideration as a defense to enforcement of the covenants set forth in the clause 7. The parties agree that in the event that any provision of the clause 7 shall be determined by any court of competent jurisdiction to be unenforceable by reason of it being extended over too great a time, too large a geographic area or too great a range of activities, such provision shall be deemed to be modified to permit its enforcement to the maximum extent permitted by applicable law.
    </p>

    <!-- Clause 8 -->
    <div class="clause-heading">8. CONFIDENTIAL INFORMATION</div>
    <p><strong>8.1</strong> The employee expressly acknowledges and agrees that:</p>
    <div class="sub-item">i. The provisions of the clause 8 shall apply during and after the period of employment, regardless of the reason for termination of her employment with the company;</div>
    <div class="sub-item">ii. In the course of her employment with the company, there may be some variations or improvements upon the confidential information and the employee agrees and confirms that all such variations and improvements upon the confidential information shall form part of the confidential information and shall be the property of the company.;</div>
    <div class="sub-item">iii. The employee may develop confidential information for company; and</div>
    <div class="sub-item">iv. The employee may learn of confidential information during the course of her employment.</div>

    <p style="margin-top:8px;"><strong>8.2</strong> The employee shall maintain confidentiality of the confidential information and shall not, without the prior written consent of the company, either directly or indirectly, divulge, disclose, or communicate the confidential information to any person, or use the confidential information for her own benefit or for the benefit of any other person and shall use her best efforts to prevent the unauthorized use or disclosure of any such confidential information.</p>
    <p><strong>8.3</strong> Employee shall not decompile, disassemble or reverse engineer the confidential information or any part of it thereof.</p>
    <p><strong>8.4</strong> The employee agrees to indemnify and keep indemnified the company, as the case may be, against all losses, damages, claims, interests, costs, expenses, liabilities, proceedings and demands which the company may suffer or incur or which may be made against the company as a result of any unauthorized disclosure or use of the confidential information by the employee or any person related to the employee that may have access to such confidential information through the employee or due to any breach of the terms of the agreement.</p>
    <p><strong>8.5</strong> Employee agrees that her obligations under the clause 8 will survive the termination of the employment to bind the parties in perpetuity and will be enforceable at any time at law or in equity and will continue for the benefit of and be enforceable by the company.</p>

    <!-- Clause 9 -->
    <div class="clause-heading">9. DATA PROTECTION AND INDEMNITY</div>
    <p><strong>9.1</strong> Employee shall comply with any request made or direction given by the company in connection with the data protection policies of the company in force from time to time.</p>
    <p><strong>9.2</strong> The company shall be permitted to use personal data provided by the employee, as well as personal data acquired from other sources, in order to carry out background checks and credit and money laundering checks. Checks may also be made to ensure that there are no potential conflicts of interest arising out of the employee providing her services to the company. Employee hereby represents warrants and undertakes he has given her lawful specific consent to such processing and usage.</p>
    <p><strong>9.3</strong> Employee hereby authorizes the company to use, reuse, and to grant others the right to use and reuse, her name, photograph, likeness (including caricature), voice, and biographical information, and any reproduction or simulation thereof, in any form of media or technology now known or hereafter developed, both during and after her employment, for any purposes related to the company’s business, such as marketing, advertising, credits, and presentations. Employee consents to the company collecting, processing and handling data, including personal and sensitive personal data, relating to him for legal, personnel, administrative, management and for any other purpose related to the company’s business purposes.</p>
    <p><strong>9.4</strong> Employee shall indemnify and hold harmless on demand promptly the company, its directors, employees, shareholders, representatives, affiliates (collectively ‘indemnified parties’) from and against any and all actions, claims, suits, loss, liability, expenses, charges and liabilities, judgments, settlements, awards and costs (including solicitor and client costs on an indemnity basis) fines and penalties due to, arising from or in connection with:</p>
    <div class="sub-item">i. Any third party allegation or claim related to employee’s failure to comply with any obligations under data protection policies of the company; or</div>
    <div class="sub-item">ii. Any misrepresentation, breach of warranty or covenant, or default or non fulfilment of its obligations by the employee under the agreement or any third party liability that the indemnified parties may incur.</div>

    <!-- Clause 10 -->
    <div class="clause-heading">10. REPRESENTATIONS AND WARRANTIES OF THE EMPLOYEE</div>
    <p><strong>THE EMPLOYEE REPRESENTS AND WARRANTS TO THE COMPANY THAT:</strong></p>
    <div class="sub-item">i. The execution, delivery and performance by the employee of the agreement will not violate, conflict with, result in a breach of the terms, conditions or provisions of, result in the creation of any encumbrances or constitute a default (or an event that, with the giving of notice or lapse of time or both, would constitute a default) or an event creating rights of acceleration, modification, termination, cancellation or a loss of rights under any of the following:</div>
    <div class="sub-sub-item">(a) Any contract to which the employee is a party;</div>
    <div class="sub-sub-item">(b) Any approval, order, judgment, decree or award to which the employee is a party or by which he is bound; or</div>
    <div class="sub-sub-item">(c) Any law applicable to the employee;</div>
    <div class="sub-item">ii. The agreement has been duly and validly executed by the employee and upon execution and delivery, the agreement will constitute, legal, valid and binding obligations of the employee, enforceable against him in accordance with its terms;</div>
    <div class="sub-item">iii. The employee is not a party to, nor bound by, any contract of employment with any person other than the company;</div>
    <div class="sub-item">iv. The employee has executed and delivered the agreement as her free and voluntary act, after having determined that the provisions contained herein are of benefit to him, and that the duties and obligations imposed on him hereunder are fair and reasonable and will not prevent him from earning a comparable livelihood following the termination of her employment with the company;</div>
    <div class="sub-item">v. The employee has read and fully understood the terms and conditions set forth herein, has had time to reflect on and consider the benefits and consequences of entering into the agreement, and has obtained independent legal advice in connection with the execution of the agreement;</div>
    <div class="sub-item">vi. No litigation is pending or threatened against the employee; and</div>
    <div class="sub-item">vii. The employee represents that her performance of all the terms of the agreement and her duties as an employee of the company will not breach any intellectual property rights, proprietary information, confidentiality, non-competition, or other agreement with any former employer or other person; and</div>
    <div class="sub-item">viii. Employee represents that he has not brought with him or will use or disclose in the performance of her duties for the company any proprietary information, documents, trade secrets, confidential information, or other personal property of a prior employer or third party that are not generally available for use by the public or have not been legally transferred to the company.</div>

    <!-- Clause 11 -->
    <div class="clause-heading">11. INJUNCTIVE RELIEF AND OTHER REMEDIES</div>
    <p><strong>11.1</strong> The employee acknowledges that:</p>
    <div class="sub-item">i. He is in a position of responsibility and is expected to abide by the terms and conditions of the agreement and any other regulations governing her employment, including instructions, policies, service rules, regulations (including conduct, discipline and administrative orders) and any such other rules or orders of the company that may come into force from time to time;</div>
    <div class="sub-item">ii. The company will suffer immediate, material, immeasurable, continuing and irreparable damage and will not have an adequate remedy at law in the event of a breach by the employee of any of her obligations, covenants, representations and warranties or agreements contained/recorded in the agreement. The employee hereby waives the claim or defense that an adequate remedy at law is available. The parties acknowledge that the company will be entitled to institute and prosecute proceedings in any court of competent jurisdiction to enjoin the employee from violating any contractual or legal obligations or to compel performance of the employee’s obligations hereunder. Injunctive relief shall be in addition to any remedy to which the company may be entitled, at law or in equity (including, but not limited to, an action and judgment for damages). Without prejudice to anything else contained in the agreement, the provisions of clauses 6, 7, 8, and 9 hereto (collectively, the “protective covenants”) are in addition to, and not in lieu or limitation of, any legal obligations relating to non-competition, non-solicitation, confidentiality, that the employee may have to the company. The employees acknowledge that the company would not proceed with the agreement, but for the protective covenants contained herein, to ensure the protection of the value created by company. The employee acknowledges that taking into account the nature of the activities of the company, and the quantum and nature of competing businesses in the field, he stands in a special position with respect to the company in particular, and also the business generally. The employee further acknowledges that by virtue of her association with the company and by using her expertise and confidential information belonging to the company, he is capable of offering competition to the business, which could cause irreparable harm to the company and its affiliates. In light of the above, the employee acknowledges that (a) the type and periods of restriction imposed by the protective covenants are fair and reasonable and are reasonably required in order to protect and maintain the legitimate business interests and the goodwill associated with the business and the company; and (b) the time, scope and other provisions of the protective covenants have been specifically negotiated by sophisticated commercial parties. If any provision contained in protective covenants shall for any reason be held invalid, illegal or unenforceable in any respect, such invalidity, illegality or unenforceability shall not affect any other provisions of the protective covenants. It is the intention of the parties that if any of the restrictions or covenants contained herein is held to cover a geographic area or to be for a length of time which is not permitted by applicable law, or in any way construed to be too broad or to any extent invalid, illegal or unenforceable, such provision shall not be construed to be null, void and of no effect, but to the extent such provision would be valid, legal or enforceable under applicable law, a court of competent jurisdiction shall construe and interpret or reform protective covenants to provide for a covenant having the maximum enforceable geographic area, time period and other provisions as shall be valid, legal and enforceable under applicable law. Each of the restraints and agreements contained in the protective covenants is separate, distinct, and severable. The existence of any claim, demand, action or cause of action of either of the parties, against the other party, whether predicated in the agreement or otherwise, shall not constitute a defence against the enforcement by such party of each protective covenant. The employee acknowledges that the duration and scope of the undertakings under protective covenants are reasonable under the circumstances in which they have been given; and such undertakings are material for the willingness of the company to, and for the company to enter into the agreement;</div>
    <div class="sub-item">iii. In the event of a breach or threatened breach by the employee of the agreement, the company shall be entitled to interim, equitable and/or injunctive relief restraining the employee from breaching or otherwise violating any provision of the agreement.</div>

    <p style="margin-top:8px;">
      <strong>11.2</strong> Nothing contained in clause 11.1 shall be construed as prohibiting the company from pursuing any other remedies available to it for breach or threatened breach, by the employee. The company shall also be entitled to any other legal or equitable remedies available to it for any breach by the employee of the agreement.
    </p>

    <!-- Clause 12 -->
    <div class="clause-heading">12. TERMINATION</div>
    <div class="subclause-heading">12.1 INCAPACITY</div>
    <p>
      If the employee becomes incapacitated, both the company and the employee may terminate the agreement by giving prior written notice of at least 15 days.
    </p>

    <div class="subclause-heading">12.2 ABSCONDING</div>
    <p>
      If employee is found absconding without communication for more than two days, the company will send a warning. If no communication or response is received by the date specified in the letter, the employee may be terminated for abscondment.
    </p>

    <div class="subclause-heading">12.3 TERMINATION WITHOUT CAUSE</div>
    <p>
      The company shall be entitled to terminate the agreement without cause or assigning any reason therefor, by giving at least 15 days’ prior written notice to the employee. The company may make a payment to the employee in lieu of notice under the clause 12.2 equivalent to 15 days’ salary (less any appropriate tax and other applicable deductions).
    </p>

    <div class="subclause-heading">12.4 TERMINATION FOR CAUSE</div>
    <p>
      Notwithstanding anything contained herein, this agreement may be terminated forthwith by the company for cause, without any notice or payment in lieu thereof.
    </p>

    <div class="subclause-heading">12.5 DEATH</div>
    <p>
      This agreement will automatically terminate (and the employment of the employee hereunder will automatically stand terminated) immediately in the event of the death of the employee during the term; provided however, that the company shall pay to the employee’s heirs or legal representatives or such other person so nominated by the employee as her nominee, any payments due to the employee under the agreement.
    </p>

    <div class="subclause-heading">12.6 TERMINATION BY EMPLOYEE</div>
    <p>
      The employee shall be entitled to terminate the agreement without cause or assigning any reason therefore, by giving at least 1 (One) months’ prior written notice to the company.
    </p>

    <div class="subclause-heading">12.7 EFFECT OF TERMINATION</div>
    <div class="sub-item">i. Upon termination of the agreement, the obligations of the company under the agreement shall terminate, except for the obligation to pay to the employee any salary earned and accrued through the date of termination, to the extent unpaid as on the date of termination, and any payments under employee benefit plans required to be provided by the company to the employee pursuant to applicable law. The employee shall not be entitled to any other salary, compensation, benefit or severance payments from the company thereafter, and the company shall be entitled to set-off or deduct any amounts due from the employee to the company prior to making such payments in accordance with applicable law.</div>
    <div class="sub-item">ii. All property of, or relating to, the company as may be in the possession of the employee, including data, information, files, books, magazines, reports, documents, manuals, audio and video tapes, floppies and discs and any other knowledge databases of the company records and all documents containing confidential information or other proprietary information of the company and any letter of authority or power of attorney issued to the employee, shall be surrendered by him to a person duly authorized by the company upon the termination of her employment.</div>
    <div class="sub-item">iii. The employee shall be deemed to have resigned from all office then held with the company. The employee shall submit a letter of resignation to the company (as applicable) offering to resign from all such offices effective as of the date of termination of her employment.</div>
    <div class="sub-item">iv. The employee shall sign the release letter upon termination of her employment, and simultaneous to the signing of the release letter, the company shall pay, in full and final settlement, all amounts due to the employee in terms of the agreement.</div>
    <div class="sub-item">v. The termination of the agreement shall not relieve any party of any obligation or liability accrued prior to the date of termination.</div>
    <div class="sub-item">vi. Employee shall render full cooperation to the company in handing over charge to her successor or other person nominated by the company in the regard.</div>
    <div class="sub-item">vii. All powers of attorney and authorizations (including for the operation of the bank accounts, if any) issued in favor of employee shall stand revoked forthwith.</div>
    <div class="sub-item">viii. Clauses 1 (definitions and interpretation), 6 (intellectual property rights), 7 (non-compete undertaking and non-solicit undertaking), 8 (confidential information), 11 (injunctive relief and other remedies), 12.7 (effect of termination), 14 (notices), and any other clause which ought to survive by its nature, as are applicable or relevant thereto, shall survive termination of the agreement.</div>

    <!-- Clause 13 -->
    <div class="clause-heading">13. UNAUTHORISED PAYMENTS</div>
    <p>
      The employee shall not at any time offer, promise, authorize or make, directly or indirectly, (i) any unlawful payments or (ii) payments or other inducements to any government official, including any official of an entity owned or controlled by a government authority, with the intent or purpose of influencing any act or decision of such official in her official capacity; inducing such official to do or omit to do any act in violation of the lawful duty of such official; or inducing such official to use her influence with a government authority to affect or influence any act or decision of such government authority. Further, no such payments of other inducements will be provided to government officials or public servants in violation of any law against improper payments or inaccurate record keeping.
    </p>

    <!-- Clause 14 -->
    <div class="clause-heading">14. NOTICES</div>
    <div class="subclause-heading">14.1 SERVICE OF NOTICE</div>
    <p>
      Except as may be otherwise provided herein, all notices and other communications (“notices”) between the parties must be in writing. Notices must be given by (i) personal delivery with acknowledgement of delivery, (ii) a nationally-recognized courier service, (iii) first-class registered or certified mail, postage prepaid, or (iv) electronic mail to the party’s address specified in the agreement unless the sender receives an automated message stating that email is undelivered, or to the address that a party has notified to be that party’s address for the purposes of the clause 14.1. A notice given in accordance with the agreement shall be effective upon receipt by the party to which it is given or, if mailed, upon the earlier of receipt and the third business day following mailing.
    </p>

    <div class="notices-grid">
      <div class="notice-box">
        <div class="notice-box-title">To the Company:</div>
        <div><strong>Bhoomi Techzone Pvt Ltd</strong></div>
        <div><strong>Attention:</strong> Yes</div>
        <div><strong>Address:</strong> Noida Sector 63 A43 2nd Floor</div>
        <div><strong>Telephone:</strong> +91 120 4145519</div>
        <div><strong>Email:</strong> info@bhoomitechzone.com</div>
        <div><strong>Email for grievances:</strong> hr@bhoomitechzone.in</div>
      </div>

      <div class="notice-box">
        <div class="notice-box-title">To the Employee:</div>
        <div><strong>Name:</strong> <span class="field-val">${fullName}</span></div>
        <div><strong>Attention:</strong> Yes</div>
        <div><strong>Address:</strong> <span class="field-val">${fullAddress}</span></div>
        <div><strong>Mobile No.:</strong> <span class="field-val">${mobileNo}</span></div>
        <div><strong>Email:</strong> <span class="field-val">${emailId}</span></div>
      </div>
    </div>

    <!-- Clause 15 -->
    <div class="clause-heading">15. MISCELLANEOUS</div>
    <div class="subclause-heading">15.1 AMENDMENTS AND WAIVERS</div>
    <p>
      The agreement may be modified, amended or supplemented only by the mutual written agreement of the parties. A waiver or any failure or delay by a party to require the enforcement of the obligations, agreements, undertakings or covenants in the agreement shall not be construed as a waiver by such party of any of its rights, unless made in writing, referring specifically to the relevant provisions of the agreement. Any such waiver shall not affect in any way the validity of the agreement or the right to enforce such obligation, agreement, undertaking or covenant at any other time. All rights and remedies existing under the agreement, except as otherwise provided herein are cumulative to, and not exclusive of any rights or remedies otherwise available.
    </p>

    <div class="subclause-heading">15.2 COSTS AND EXPENSES</div>
    <p>
      Each party shall bear the respective costs and expenses incurred in connection with the preparation, negotiation and execution of the agreement. In addition, all costs and expenses in relation to payment of any stamp duty and registration duty on the agreement under applicable laws shall be borne by the company.
    </p>

    <div class="subclause-heading">15.3 CO-OPERATION</div>
    <p>
      Employee agrees that at any time and from time to time, upon the request of the company, to do, execute, acknowledge and deliver, or cause to be done, executed, acknowledged and delivered, all such further acts, documents and instruments as may be reasonably required to effect any of the transactions contemplated by the agreement.
    </p>

    <!-- Execution and Signature Block -->
    <div class="sig-container">
      <div class="sig-grid">
        <!-- Left: Company Signature -->
        <div class="sig-col-left">
          <div class="sig-heading">For BHOOMI TECHZONE PRIVATE LIMITED</div>
          ${logoSrc ? `<img class="sig-company-logo" src="${logoSrc}" alt="Bhoomi Techzone" />` : ''}
          ${signSrc ? `<img class="sig-sign-img" src="${signSrc}" alt="Authorised Signatory" />` : '<div style="height:35px;"></div>'}
          <div class="sig-person-name">${hrName}</div>
          <div class="sig-person-desig">Authorised Signatory / HR Dept</div>
          <div class="sig-person-company">BHOOMI TECHZONE PRIVATE LIMITED</div>
          <div class="sig-person-contact">Contact: +91 9821724181 | hr@bhoomitechzone.in</div>
        </div>

        <!-- Right: Employee Acceptance -->
        <div class="sig-col-right">
          <div class="sig-heading">Acknowledged &amp; Agreed By Employee:</div>
          <div class="emp-sig-row" style="margin-bottom: 10px;">
            <span class="emp-sig-lbl">Signature:</span>
            <span class="emp-sig-line"></span>
          </div>
          <div class="emp-sig-row">
            <span class="emp-sig-lbl">Full Name:</span>
            <span class="emp-sig-val">${fullName}</span>
          </div>
          <div class="emp-sig-row">
            <span class="emp-sig-lbl">Father's Name:</span>
            <span class="emp-sig-val">${fathersName}</span>
          </div>
          <div class="emp-sig-row">
            <span class="emp-sig-lbl">Designation:</span>
            <span class="emp-sig-val">${designation}</span>
          </div>
          <div class="emp-sig-row">
            <span class="emp-sig-lbl">Contact No:</span>
            <span class="emp-sig-val">${mobileNo}</span>
          </div>
          <div class="emp-sig-row">
            <span class="emp-sig-lbl">Date &amp; Place:</span>
            <span class="emp-sig-val">${effectiveDateFmt}, Noida</span>
          </div>
        </div>
      </div>

      <!-- Note -->
      <div class="sig-note">
        <strong>Note:</strong> This Non-Disclosure Agreement is legally binding upon signing by the employee and the authorised signatory of Bhoomi Techzone Private Limited.
      </div>

      <!-- Footer -->
      <div class="sig-footer-bar">
        <div class="sig-footer-line"></div>
        <div class="sig-footer-row">
          <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh – 201301</span>
          <span>hr@bhoomitechzone.in | www.bhoomitechzone.in</span>
        </div>
        <div class="sig-bottom-strip"></div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
};
