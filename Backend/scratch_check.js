const t = require('./utils/offerLetterTemplate');
const fs = require('fs');
const html = t.generateOfferLetterHTML({
  name: 'Test User',
  designation: 'Developer',
  department: 'IT',
  dateOfJoining: '01 Jan 2025',
  annualCTC: '5 LPA',
  monthlySalary: '40000'
});
const pages = (html.match(/class="page"/g) || []).length;
const footers = (html.match(/class="lh-footer"/g) || []).length;
console.log('Pages:', pages);
console.log('Footer divs:', footers);
fs.writeFileSync('scratch_output.html', html);
console.log('Written to scratch_output.html');
