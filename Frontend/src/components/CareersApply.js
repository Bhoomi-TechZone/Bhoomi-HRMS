import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
    Briefcase, User, Phone, MapPin,
    Shield, CheckCircle2, AlertCircle, Building2,
    Sparkles, Check, RefreshCw, Send, FileText,
    Info, ArrowRight, ArrowLeft, Edit3, Mail, CheckCircle,
    ChevronDown, Search, X, GraduationCap, Award, BookOpen,
    Clock, IndianRupee, UploadCloud, Upload, Trash2, Paperclip
} from 'lucide-react';
import api from '../api/axios';

const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi (NCR)', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'
];
const NATIONALITIES = [
    'Indian',
    'American',
    'Australian',
    'Bangladeshi',
    'Bhutanese',
    'British',
    'Canadian',
    'Chinese',
    'Emirati',
    'Filipino',
    'French',
    'German',
    'Indonesian',
    'Italian',
    'Japanese',
    'Malaysian',
    'Mauritian',
    'Nepalese',
    'New Zealander',
    'Nigerian',
    'Pakistani',
    'Russian',
    'Saudi Arabian',
    'Singaporean',
    'South African',
    'South Korean',
    'Sri Lankan',
    'Thai',
    'Other'
];
const RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Zoroastrianism', 'Other', 'Prefer not to say'];
const CASTES = ['General / Unreserved (UR)', 'Other Backward Class (OBC)', 'Scheduled Caste (SC)', 'Scheduled Tribe (ST)', 'Economically Weaker Section (EWS)', 'Prefer not to disclose'];
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Late'];
const RELATIONS = ['Father', 'Mother', 'Legal Guardian', 'Spouse'];

const BOARDS_LIST = [
    'CBSE',
    'ICSE / ISC',
    'Uttar Pradesh State Board (UPMSP)',
    'Delhi State Board',
    'Maharashtra State Board (MSBSHSE)',
    'Bihar School Examination Board (BSEB)',
    'Rajasthan Board of Secondary Education (RBSE)',
    'Madhya Pradesh Board (MPBSE)',
    'Karnataka State Board',
    'Tamil Nadu State Board',
    'West Bengal State Board',
    'National Institute of Open Schooling (NIOS)',
    'Other State Board / Board'
];
const TWELFTH_STREAMS = ['Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Humanities', 'Vocational'];
const DIPLOMA_STREAMS = [
    'Diploma in Computer Science & Engineering (CSE)',
    'Diploma in Information Technology (IT)',
    'Diploma in Electronics & Communication Engineering (ECE)',
    'Diploma in Electrical Engineering (EE)',
    'Diploma in Mechanical Engineering (ME)',
    'Diploma in Civil Engineering (CE)',
    'Diploma in Automobile Engineering',
    'Diploma in Computer Applications (DCA)',
    'Diploma in Web Design & Software Development',
    'Diploma in Graphic & UI/UX Design',
    'Diploma in Digital Marketing & Business',
    'Diploma in Hardware & Networking',
    'Diploma in Architecture Assistantship',
    'Other Polytechnic / Technical Diploma'
];
const GRAD_DEGREES = [
    // Engineering & Technology
    'B.Tech / B.E. (Computer Science & Engineering)',
    'B.Tech / B.E. (Information Technology)',
    'B.Tech / B.E. (Artificial Intelligence & Machine Learning)',
    'B.Tech / B.E. (Data Science / AI & DS)',
    'B.Tech / B.E. (Electronics & Communication Engineering)',
    'B.Tech / B.E. (Electrical & Electronics Engineering)',
    'B.Tech / B.E. (Mechanical Engineering)',
    'B.Tech / B.E. (Civil Engineering)',
    'B.Tech / B.E. (Chemical / Biotechnology)',
    'B.Tech / B.E. (Automobile / Aerospace)',
    'B.Tech / B.E. (Other Specialization)',

    // Computer Applications & IT
    'BCA (Bachelor of Computer Applications)',
    'B.Sc (Computer Science)',
    'B.Sc (Information Technology / IT)',
    'B.Sc (Data Science / AI / Cyber Security)',

    // Science Degrees
    'B.Sc (Mathematics / Statistics)',
    'B.Sc (Physics / Chemistry / Electronics)',
    'B.Sc (Biotechnology / Microbiology / Biochemistry)',
    'B.Sc (General Science / Applied Science)',
    'B.Sc (Nursing / Agriculture / Other)',

    // Commerce & Banking
    'B.Com (General)',
    'B.Com (Honours)',
    'B.Com (Computer Applications / E-Commerce)',
    'B.Com (Banking, Financial Services & Insurance)',
    'B.Com (Accounting & Finance / Taxation)',

    // Management & Business Administration
    'BBA (Bachelor of Business Administration)',
    'BMS (Bachelor of Management Studies)',
    'BBM (Bachelor of Business Management)',
    'BBA (Information Technology / Analytics)',
    'BBA (Marketing / Finance / HR)',

    // Arts, Humanities & Social Sciences
    'B.A. (Arts / Humanities - General)',
    'B.A. (Economics / Econometrics)',
    'B.A. (English / Literature)',
    'B.A. (Psychology / Sociology / Philosophy)',
    'B.A. (Journalism & Mass Communication - BJMC)',
    'B.A. (Political Science / History)',

    // Design, Architecture & Fine Arts
    'B.Des (Bachelor of Design - UI/UX / Graphic / Product)',
    'B.Arch (Bachelor of Architecture)',
    'BFA (Bachelor of Fine Arts)',
    'B.Voc (Bachelor of Vocation - Software / Media / Design)',

    // Law, Pharmacy & Others
    'LLB (Bachelor of Law)',
    'B.A. LLB / BBA LLB (Integrated Law)',
    'B.Pharm (Bachelor of Pharmacy)',
    'B.Ed (Bachelor of Education)',
    'BHM / BHMCT (Hotel Management & Catering)',
    'Other Bachelor Degree / Course'
];
const PG_DEGREES = [
    // Computer Applications & IT
    'MCA (Master of Computer Applications)',
    'M.Sc (Computer Science)',
    'M.Sc (Information Technology / IT)',
    'M.Sc (Data Science & Analytics)',
    'M.Sc (Artificial Intelligence & Machine Learning)',
    'M.Sc (Cyber Security & Information Security)',

    // Engineering & Technology (M.Tech / M.E.)
    'M.Tech / M.E. (Computer Science & Engineering)',
    'M.Tech / M.E. (Information Technology)',
    'M.Tech / M.E. (Artificial Intelligence / Machine Learning)',
    'M.Tech / M.E. (Electronics & Communication Engineering)',
    'M.Tech / M.E. (Electrical & Power Systems)',
    'M.Tech / M.E. (Mechanical / Thermal / Design)',
    'M.Tech / M.E. (Civil / Structural Engineering)',
    'M.Tech / M.E. (Other Specialization)',

    // Management (MBA / PGDM)
    'MBA (Information Technology & Systems)',
    'MBA (Business Analytics / Big Data)',
    'MBA (Human Resource Management / HR)',
    'MBA (Marketing & Sales Management)',
    'MBA (Finance & Banking)',
    'MBA (Operations & Supply Chain Management)',
    'MBA (International Business)',
    'MBA (General Management)',
    'PGDM (Post Graduate Diploma in Management)',
    'Executive MBA (EMBA)',

    // Commerce & Finance (M.Com)
    'M.Com (Master of Commerce - General / Honours)',
    'M.Com (Finance, Banking & Taxation)',

    // Science Degrees (M.Sc)
    'M.Sc (Mathematics / Applied Mathematics)',
    'M.Sc (Statistics / Operations Research)',
    'M.Sc (Physics / Applied Physics)',
    'M.Sc (Chemistry / Organic / Analytical)',
    'M.Sc (Biotechnology / Microbiology / Life Sciences)',
    'M.Sc (General / Other Specialization)',

    // Arts & Humanities (M.A.)
    'M.A. (Economics)',
    'M.A. (English / Literature)',
    'M.A. (Journalism & Mass Communication - MJMC)',
    'M.A. (Psychology / Applied Psychology)',
    'M.A. (Public Administration / Sociology)',
    'M.A. (Arts / Humanities - General)',

    // Professional & Law / Pharmacy / Design
    'M.Des (Master of Design)',
    'M.Arch (Master of Architecture)',
    'M.Pharm (Master of Pharmacy)',
    'LLM (Master of Law)',
    'M.Ed (Master of Education)',
    'PG Diploma (Post Graduate Diploma)',
    'Other Master Degree / Post Graduate Course'
];
const GRADE_TYPES = ['Percentage', 'CGPA', 'Marks'];
const PASSING_YEARS = Array.from({ length: 35 }, (_, i) => String(new Date().getFullYear() + 4 - i));

const EXP_YEARS_OPTIONS = [
    '0 Years (Fresher)',
    '1 Year',
    '2 Years',
    '3 Years',
    '4 Years',
    '5 Years',
    '6 Years',
    '7 Years',
    '8 Years',
    '9 Years',
    '10 Years',
    '12 Years',
    '15+ Years'
];
const EXP_MONTHS_OPTIONS = [
    '0 Months',
    '1 Month',
    '2 Months',
    '3 Months',
    '4 Months',
    '5 Months',
    '6 Months',
    '7 Months',
    '8 Months',
    '9 Months',
    '10 Months',
    '11 Months'
];
const NOTICE_PERIODS = [
    'Immediate Joiner (0–7 Days)',
    '15 Days',
    '30 Days (1 Month)',
    '45 Days',
    '60 Days (2 Months)',
    '90 Days (3 Months)',
    'Serving Notice Period',
    'Negotiable'
];

const DRAFT_KEY = 'bhoomi_careers_apply_draft';

const INIT = {
    jobId: '', jobTitle: '',
    firstName: '', middleName: '', lastName: '',
    guardianSalutation: '', guardianRelation: '', guardianName: '',
    dob: '', gender: '', maritalStatus: '',
    nationality: '', religion: '', caste: '',
    phone: '', altPhone: '', email: '',
    currentStreet: '', currentCity: '', currentState: '', currentCountry: 'India', currentZip: '',
    isAddressSame: true,
    permanentStreet: '', permanentCity: '', permanentState: '', permanentCountry: 'India', permanentZip: '',

    // ── Qualification Fields ──
    // 10th Standard
    tenthSchool: '',
    tenthBoard: '',
    tenthYear: '',
    tenthGradeType: '',
    tenthScore: '',
    tenthMarks: '',

    // 12th Standard
    hasTwelfth: true,
    twelfthSchool: '',
    twelfthBoard: '',
    twelfthStream: '',
    twelfthYear: '',
    twelfthGradeType: '',
    twelfthScore: '',
    twelfthMarks: '',

    // Diploma
    hasDiploma: false,
    diplomaCollege: '',
    diplomaStream: '',
    diplomaYear: '',
    diplomaGradeType: '',
    diplomaScore: '',
    diplomaMarks: '',

    // Graduation
    hasGraduation: true,
    gradDegree: '',
    gradCollege: '',
    gradYear: '',
    gradGradeType: '',
    gradScore: '',
    gradMarks: '',
    gradStatus: '',

    // Post Graduation
    hasPostGraduation: false,
    pgDegree: '',
    pgCollege: '',
    pgYear: '',
    pgGradeType: '',
    pgScore: '',
    pgMarks: '',
    pgStatus: '',

    // ── Experience Fields ──
    candidateType: 'Fresher', // 'Fresher' | 'Experienced'
    currentCompany: '',
    currentRole: '',
    totalExpYears: '',
    totalExpMonths: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    keySkills: '',

    // ── Resume Upload ──
    resumeUrl: '',
    resumeFileName: '',
    resumeFileSize: '',
};

const STEPS = [
    { id: 1, label: 'Personal Information', sub: 'Identity & demographics' },
    { id: 2, label: 'Contact Details', sub: 'Phone, email & address' },
    { id: 3, label: 'Qualification', sub: 'Academic & educational history' },
    { id: 4, label: 'Work Experience', sub: 'Company, role & compensation' },
    { id: 5, label: 'Review & Submit', sub: 'Verify and submit' },
];

// ── Module-level Custom Select Dropdown Card Component ─────────────────────────────
const CustomSelect = ({
    id,
    name,
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    searchable = false,
    searchPlaceholder = 'Search...',
    error = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearch('');
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const formattedOptions = useMemo(() => {
        return (options || []).map(opt => {
            if (typeof opt === 'object' && opt !== null) {
                return { value: opt.value ?? opt.label, label: opt.label ?? opt.value };
            }
            return { value: opt, label: opt };
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!search) return formattedOptions;
        const q = search.toLowerCase();
        return formattedOptions.filter(o =>
            String(o.label).toLowerCase().includes(q) ||
            String(o.value).toLowerCase().includes(q)
        );
    }, [formattedOptions, search]);

    const selectedOption = formattedOptions.find(o => o.value === value);
    const displayLabel = selectedOption ? selectedOption.label : (value || placeholder);

    const handleSelect = (val) => {
        if (onChange) {
            onChange({ target: { name, value: val } });
        }
        setIsOpen(false);
        setSearch('');
    };

    const isSearchNeeded = searchable || formattedOptions.length > 7;

    return (
        <div ref={dropdownRef} className="cp-custom-dd-wrap" style={{ position: 'relative', width: '100%' }}>
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                className={`cp-custom-dd-trigger ${error ? 'err' : ''} ${isOpen ? 'active' : ''}`}
                style={{
                    width: '100%',
                    padding: '9.5px 12px',
                    border: `1px solid ${error ? '#fca5a5' : (isOpen ? '#16a34a' : '#e2e8f0')}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: value ? '#0f172a' : '#94a3b8',
                    backgroundColor: disabled ? '#f8fafc' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    boxShadow: isOpen ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    outline: 'none',
                    userSelect: 'none'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayLabel}
                </span>
                <ChevronDown
                    size={14}
                    style={{
                        color: '#94a3b8',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease'
                    }}
                />
            </button>

            {isOpen && (
                <div
                    className="cp-custom-dd-card"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0',
                        zIndex: 1000,
                        minWidth: '150px',
                        padding: '6px',
                        animation: 'cpDdFadeIn 0.15s ease'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {isSearchNeeded && (
                        <div style={{ padding: '2px 4px 6px 4px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '6px', padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                                <Search size={13} color="#94a3b8" style={{ marginRight: '6px', flexShrink: 0 }} />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={searchPlaceholder}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '12px',
                                        color: '#0f172a',
                                        width: '100%',
                                        fontFamily: 'inherit'
                                    }}
                                />
                                {search && (
                                    <X size={12} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />
                                )}
                            </div>
                        </div>
                    )}
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="cp-custom-dd-scroll">
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '8px 10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = value === opt.value;
                                return (
                                    <div
                                        key={opt.value}
                                        className={`cp-custom-dd-item ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleSelect(opt.value)}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            padding: '7px 10px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: isSelected ? '600' : '500',
                                            color: isSelected ? '#0f172a' : '#475569',
                                            backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {isSelected && <Check size={13} color="#16a34a" strokeWidth={2.5} />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Module-level Field component (prevents remounting and losing focus while typing) ──
const Field = ({ id, label, required, hint, error, children }) => (
    <div className="cp-field">
        {label && (
            <label className="cp-label" htmlFor={id}>
                {label}{required && <span className="cp-req">*</span>}
            </label>
        )}
        {children}
        {hint && !error && <div className="cp-hint">{hint}</div>}
        {error && <div className="cp-err"><AlertCircle size={12} /> {error}</div>}
    </div>
);

const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;overflow:hidden;}
:root{
  --ink:#0f172a;--ink2:#334155;--muted:#64748b;--subtle:#94a3b8;
  --border:#e2e8f0;--border2:#f1f5f9;
  --accent:#15803d;--accent-light:#f0fdf4;--accent-mid:#16a34a;--accent-dark:#14532d;
  --surface:#ffffff;--bg:#ffffff;
  --glass:rgba(255,255,255,0.85);
  --radius:8px;--font:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --shadow-xs:0 1px 2px rgba(0,0,0,.04);
  --shadow-sm:0 1px 3px rgba(0,0,0,.08);
}
/* ── ROOT ── */
.cp-root{height:100vh;overflow:hidden;display:flex;flex-direction:column;background:#ffffff;font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased;}
/* ── NAV ── */
.cp-nav{flex-shrink:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:var(--glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border);z-index:50;}
.cp-nav-brand{display:flex;align-items:center;gap:10px;min-width:0;}
.cp-nav-logo{width:30px;height:30px;border-radius:6px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}
.cp-nav-logo img{width:100%;height:100%;object-fit:contain;}
.cp-nav-brand-text{min-width:0;}
.cp-nav-name{font-size:13.5px;font-weight:700;color:var(--ink);letter-spacing:-0.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cp-nav-sub{font-size:10px;color:var(--muted);margin-top:1px;white-space:nowrap;}
.cp-nav-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.cp-nav-browse-btn{background:#16a34a;color:#ffffff;border:none;padding:7px 16px;border-radius:9999px;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.18s ease;box-shadow:none !important;white-space:nowrap;flex-shrink:0;}
.cp-nav-browse-btn:hover{background:#15803d;box-shadow:none !important;}
.cp-nav-btn-text-short{display:none;}
.cp-nav-badge{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;letter-spacing:.02em;white-space:nowrap;flex-shrink:0;box-shadow:none !important;}
.cp-nav-badge-short{display:none;}
.cp-guardian-row{display:grid;grid-template-columns:95px 125px 1fr;gap:8px;}
/* ── SHELL ── */
.cp-shell{flex:1;overflow:hidden;display:grid;grid-template-columns:256px 1fr;}
@media(max-width:820px){.cp-shell{grid-template-columns:1fr;}.cp-sidebar{display:none;}}
/* ── SIDEBAR ── */
.cp-sidebar{overflow-y:auto;background:#fafafa;border-right:1px solid var(--border);}
.cp-sidebar::-webkit-scrollbar{width:3px;}.cp-sidebar::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
.cp-sidebar-brand{padding:20px 20px 16px;border-bottom:1px solid var(--border);}
.cp-sidebar-brand-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--subtle);margin-bottom:12px;}
.cp-step{padding:12px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border2);transition:all .15s;}
.cp-step:last-child{border-bottom:none;}
.cp-step.clickable:hover{background:#f4f4f5;}
.cp-step-num{width:26px;height:26px;border-radius:50%;background:#fff;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;color:var(--muted);flex-shrink:0;transition:all .2s;}
.cp-step.active .cp-step-num{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.2);}
.cp-step.done .cp-step-num{background:#16a34a;border-color:#16a34a;color:#fff;}
.cp-step-label{font-size:12px;font-weight:600;color:var(--muted);line-height:1.3;}
.cp-step.active .cp-step-label{color:#15803d;font-weight:700;}
.cp-step.done .cp-step-label{color:var(--ink2);}
.cp-step-sub{font-size:10px;color:var(--subtle);margin-top:1px;}
.cp-sidebar-section{padding:16px 20px 10px;}
.cp-sidebar-section-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--subtle);margin-bottom:10px;}
.cp-job-card{border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fff;transition:all .15s;cursor:pointer;margin-bottom:6px;}
.cp-job-card:hover{border-color:#86efac;background:var(--accent-light);}
.cp-job-card.sel{border-color:var(--accent-mid);background:var(--accent-light);box-shadow:0 0 0 2px rgba(22,163,74,.12);}
.cp-job-card-title{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:3px;}
.cp-job-card-meta{font-size:10.5px;color:var(--muted);display:flex;gap:5px;}
/* ── Skeleton Shimmer Effect ── */
@keyframes cpShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.cp-skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%);
  background-size: 400% 100%;
  animation: cpShimmer 1.4s ease infinite;
  border-radius: 4px;
}
.cp-skeleton-pill {
  border-radius: 9999px;
}
/* ── MAIN SCROLL AREA ── */
.cp-main{overflow-y:auto;padding:24px 28px 48px;background:#ffffff;}
.cp-main::-webkit-scrollbar{width:5px;}.cp-main::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
@media(max-width:640px){
  .cp-main{padding:14px 12px 40px;}
  .cp-nav{padding:0 12px;height:52px;}
  .cp-nav-brand{gap:8px;max-width:52%;}
  .cp-nav-logo{width:26px;height:26px;}
  .cp-nav-name{font-size:12px;}
  .cp-nav-sub{display:none;}
  .cp-nav-actions{gap:6px;}
  .cp-nav-browse-btn{padding:5px 10px;font-size:11px;gap:4px;}
  .cp-nav-btn-text{display:none;}
  .cp-nav-btn-text-short{display:inline;}
  .cp-nav-badge{padding:3px 8px;font-size:10.5px;}
  .cp-nav-badge-full{display:none;}
  .cp-nav-badge-short{display:inline;}
  .cp-guardian-row{grid-template-columns:1fr 1fr;}
  .cp-guardian-row > :last-child{grid-column:span 2;}
  .cp-page-heading{font-size:20px;}
  .cp-page-sub{font-size:12px;line-height:1.45;}
  .cp-page-hd{margin-bottom:18px;padding-bottom:14px;gap:10px;}
  .cp-submit-bar{display:flex;flex-direction:column;align-items:flex-end;gap:12px;padding-top:18px;margin-top:20px;}
  .cp-submit-privacy{width:100%;font-size:10.5px;line-height:1.45;}
  .cp-submit-bar .cp-btn-primary{align-self:flex-end;margin-left:auto;padding:10px 22px;font-size:13px;box-shadow:none !important;}
  .cp-pills{gap:8px;width:100%;}
  .cp-pill{flex:1 1 auto;justify-content:center;padding:9px 12px;font-size:12px;}
  .cp-addr-box{padding:14px 12px;}
}
@media(max-width:380px){
  .cp-nav{padding:0 8px;}
  .cp-nav-name{font-size:11px;max-width:105px;}
  .cp-nav-browse-btn{padding:4px 8px;font-size:10.5px;}
  .cp-nav-badge{padding:2px 6px;font-size:10px;}
}
/* ── FORM CONTAINER ── */
.cp-form-container{width:100%;max-width:1080px;margin:0 auto;}
/* Header */
.cp-page-hd{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
.cp-role-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:var(--accent-light);color:var(--accent);font-size:11.5px;font-weight:700;border:1px solid #bbf7d0;margin-bottom:8px;}
.cp-page-heading{font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-0.03em;line-height:1.2;margin-bottom:4px;}
.cp-page-sub{font-size:13px;color:var(--muted);}
.cp-top-back-btn{background:#16a34a;color:#ffffff;border:none;padding:8px 18px;border-radius:var(--radius);font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;}
.cp-top-back-btn:hover{background:#15803d;}
/* ── SECTIONS ── */
.cp-section{margin-bottom:32px;}
.cp-section-hd{display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border);}
.cp-section-icon{width:30px;height:30px;border-radius:7px;background:var(--accent-light);border:1px solid #bbf7d0;color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.cp-section-label{font-size:13.5px;font-weight:700;color:var(--ink);letter-spacing:-.01em;}
.cp-section-sub{font-size:11.5px;color:var(--muted);margin-top:1px;}
.cp-section-num{margin-left:auto;font-size:9.5px;font-weight:700;color:var(--accent);background:var(--accent-light);border:1px solid #bbf7d0;padding:2px 10px;border-radius:20px;letter-spacing:.04em;}
/* Grid */
.cp-row{display:grid;gap:14px;margin-bottom:14px;}
.cp-row-3{grid-template-columns:repeat(3,1fr);}
.cp-row-2{grid-template-columns:repeat(2,1fr);}
.cp-row-auto{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));}
@media(max-width:640px){.cp-row-3,.cp-row-2{grid-template-columns:1fr;}}
/* Field */
.cp-field{display:flex;flex-direction:column;gap:5px;}
.cp-label{font-size:11px;font-weight:600;color:var(--ink2);display:flex;align-items:center;gap:3px;}
.cp-req{color:#ef4444;}
.cp-hint{font-size:10px;color:var(--subtle);margin-top:1px;}
.cp-err{font-size:10.5px;color:#dc2626;display:flex;align-items:center;gap:4px;font-weight:600;margin-top:2px;}
/* Inputs */
.cp-input,.cp-select{width:100%;padding:9.5px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;color:var(--ink);background:#ffffff;font-family:var(--font);outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none;}
.cp-input::placeholder{color:#94a3b8;font-size:12.5px;}
.cp-input:focus,.cp-select:focus{border-color:var(--accent-mid);box-shadow:0 0 0 3px rgba(22,163,74,.12);}
.cp-input.err,.cp-select.err{border-color:#fca5a5;background:#fff8f8;}
.cp-input:disabled,.cp-select:disabled{background:#f8fafc;color:var(--subtle);cursor:not-allowed;border-color:var(--border);}
.cp-phone-wrap{display:flex;gap:6px;}
.cp-phone-cc{padding:9px 11px;background:#f8fafc;border:1px solid var(--border);border-radius:var(--radius);font-size:12.5px;font-weight:600;color:var(--muted);white-space:nowrap;display:flex;align-items:center;}
/* Pills */
.cp-pills{display:flex;gap:6px;flex-wrap:wrap;}
.cp-pill{padding:7px 16px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;user-select:none;box-shadow:var(--shadow-xs);}
.cp-pill:hover{border-color:#86efac;background:var(--accent-light);color:var(--accent);}
.cp-pill.on{border-color:var(--accent-mid);background:var(--accent-light);color:var(--accent);box-shadow:0 0 0 2px rgba(22,163,74,.12);}
/* Address */
.cp-addr-box{background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:14px;}
.cp-addr-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.cp-addr-title{font-size:12px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:7px;}
.cp-addr-sync{font-size:10px;font-weight:700;color:#15803d;background:#dcfce7;padding:1px 8px;border-radius:6px;}
/* Age */
.cp-age-badge{background:var(--accent-light);color:var(--accent);border:1px solid #bbf7d0;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;display:inline-flex;align-items:center;white-space:nowrap;}
/* Divider */
.cp-divider{display:flex;align-items:center;gap:8px;font-size:9.5px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.08em;margin:22px 0 14px;}
.cp-divider::before,.cp-divider::after{content:'';flex:1;height:1px;background:var(--border);}
/* Note */
.cp-note{background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 13px;font-size:11px;color:var(--muted);display:flex;gap:8px;align-items:flex-start;margin-top:4px;}
/* ── SUBMIT & NAVIGATION BAR ── */
.cp-submit-bar{display:flex;align-items:center;justify-content:space-between;padding:22px 0 0;border-top:1px solid var(--border);gap:12px;flex-wrap:wrap;margin-top:28px;}
.cp-submit-privacy{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;}
.cp-btn-primary{background:#16a34a;color:#ffffff;border:none;padding:11px 26px;border-radius:var(--radius);font-size:13.5px;font-weight:700;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:9px;font-family:var(--font);box-shadow:none !important;}
.cp-btn-primary:hover{background:#15803d;transform:none;box-shadow:none !important;}
.cp-btn-primary:disabled{opacity:.55;cursor:not-allowed;transform:none;}
.cp-btn-secondary{background:#ffffff;color:var(--ink);border:1px solid var(--border);padding:10.5px 20px;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:7px;font-family:var(--font);}
.cp-btn-secondary:hover{background:#f8fafc;border-color:#cbd5e1;}
/* ── REVIEW STEP ── */
.cp-review-box{background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px;}
.cp-review-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);}
.cp-review-title{font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px;}
.cp-review-edit{background:none;border:none;color:var(--accent);font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;}
.cp-review-edit:hover{background:var(--accent-light);}
.cp-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 18px;}
.cp-review-item{display:flex;flex-direction:column;gap:2px;}
.cp-review-key{font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
.cp-review-val{font-size:13px;font-weight:600;color:var(--ink);}
/* Qualification Cards */
.cp-qual-card{background:#ffffff;border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:18px;box-shadow:var(--shadow-xs);transition:all .18s ease;}
.cp-qual-card:hover{border-color:#cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,.04);}
.cp-qual-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border2);flex-wrap:wrap;gap:10px;}
.cp-qual-title-wrap{display:flex;align-items:center;gap:9px;}
.cp-qual-title{font-size:13.5px;font-weight:700;color:var(--ink);letter-spacing:-.01em;display:flex;align-items:center;gap:7px;}
.cp-qual-badge-req{font-size:9.5px;font-weight:700;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;}
.cp-qual-badge-opt{font-size:9.5px;font-weight:700;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;}
.cp-qual-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;user-select:none;}
.cp-review-qual-row{background:#ffffff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;display:flex;gap:16px;align-items:flex-start;}
@media(max-width:640px){.cp-review-qual-row{flex-direction:column;gap:10px;}}
.cp-review-qual-badge{font-size:11px;font-weight:700;background:var(--accent-light);color:var(--accent);border:1px solid #bbf7d0;padding:4px 10px;border-radius:6px;white-space:nowrap;}

/* Submitting Loader Overlay */
.cp-submitting-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  animation: cpFadeIn .2s ease;
  padding: 16px;
}
.cp-submitting-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 38px 32px;
  max-width: 440px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cp-submitting-spinner-ring {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
}
.cp-submitting-spinner {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid #dcfce7;
  border-top-color: #16a34a;
  border-radius: 50%;
  animation: cp-spin 0.85s linear infinite;
}
.cp-submitting-icon {
  color: #16a34a;
}
.cp-submitting-title {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
  letter-spacing: -0.025em;
}
.cp-submitting-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.55;
  margin-bottom: 22px;
}
.cp-submitting-progress-bar {
  width: 100%;
  height: 5px;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 14px;
  position: relative;
}
.cp-submitting-progress-fill {
  height: 100%;
  width: 45%;
  background: linear-gradient(90deg, #16a34a, #22c55e, #16a34a);
  border-radius: 9999px;
  animation: cpProgressIndeterminate 1.4s ease-in-out infinite;
}
.cp-submitting-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
}
.cp-submitting-step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16a34a;
  animation: cPulseGreen 1.5s infinite;
}

/* ── High-End Enterprise Success Page ── */
.cp-success-viewport {
  width: 100%;
  flex: 1;
  background: #f4f6f9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 12px;
  box-sizing: border-box;
  overflow-y: auto;
}
.cp-success-container {
  width: 100%;
  max-width: 720px;
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-sizing: border-box;
  gap: 0;
}
.cp-success-enterprise {
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  padding: 0;
}
.cp-success-check-icon {
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cp-check-circle {
  animation: cpCheckCircleIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.cp-check-path {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: cpCheckDraw 0.4s ease-out 0.35s both;
}
.cp-success-hero-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
  line-height: 1.25;
}
.cp-success-hero-sub {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  max-width: 460px;
  margin: 0 auto 24px;
}
/* Ref Card */
.cp-ref-card {
  width: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 12px;
  box-shadow: 0 2px 10px rgba(15,23,42,0.05);
  text-align: left;
  box-sizing: border-box;
}
.cp-ref-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 8px;
}
.cp-ref-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 3px 9px;
  border-radius: 6px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.cp-ref-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 3px 10px;
  border-radius: 9999px;
}
.cp-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
}
.cp-ref-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px dashed #e2e8f0;
}
.cp-ref-code-text {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.02em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}
.cp-ref-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 12px;
  border-radius: 9999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: none !important;
}
.cp-ref-copy-btn:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}
.cp-ref-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.cp-ref-meta-item {
  font-size: 12px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cp-ref-meta-label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cp-ref-meta-val {
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
}
/* Unified card extras */
.cp-card-divider {
  width: 100%;
  height: 1px;
  background: #f1f5f9;
  margin: 16px 0;
}
.cp-card-email-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.cp-card-email-icon {
  width: 34px;
  height: 34px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.cp-card-email-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cp-card-email-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}
.cp-card-email-val {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  word-break: break-all;
  margin-bottom: 6px;
}
.cp-card-email-msg {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.55;
}
/* Actions */
.cp-success-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  margin-bottom: 16px;
}
.cp-success-help-text {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.5;
  padding: 0 4px;
}


@media (max-width: 640px) {
  /* Viewport & container */
  .cp-success-viewport { padding: 20px 12px 40px; }
  .cp-success-container { max-width: 100%; }

  /* Icon */
  .cp-success-check-icon { margin-bottom: 16px; }
  .cp-success-check-icon svg { width: 52px; height: 52px; }

  /* Title & sub */
  .cp-success-hero-title { font-size: 16.5px; margin-bottom: 6px; }
  .cp-success-hero-sub { font-size: 12px; line-height: 1.55; margin-bottom: 16px; max-width: 100%; }

  /* Unified card */
  .cp-ref-card { padding: 16px 14px; margin-bottom: 20px; }
  .cp-ref-card-top { margin-bottom: 12px; }

  /* ID row — let it wrap naturally */
  .cp-ref-code-row { flex-wrap: wrap; gap: 6px; margin-bottom: 12px; padding-bottom: 12px; }
  .cp-ref-code-text { font-size: 12.5px; }
  .cp-ref-copy-btn { font-size: 10px; padding: 3px 10px; }

  /* Meta: single column */
  .cp-ref-meta-grid { grid-template-columns: 1fr; gap: 10px; }
  .cp-ref-meta-label { font-size: 9.5px; }
  .cp-ref-meta-val { font-size: 12px; }

  /* Divider */
  .cp-card-divider { margin: 14px 0; }

  /* Email row */
  .cp-card-email-row { gap: 10px; align-items: flex-start; }
  .cp-card-email-content { gap: 4px; }
  .cp-card-email-label { font-size: 10.5px !important; color: #94a3b8 !important; line-height: 1.4; }
  .cp-card-email-val { font-size: 12.5px !important; color: #0f172a !important; margin-bottom: 5px; }
  .cp-card-email-msg { font-size: 11px !important; color: #64748b !important; line-height: 1.5; }

  /* Action button */
  .cp-success-actions { margin-bottom: 12px; }
  .cp-success-actions button { width: 100%; justify-content: center; padding: 12px 20px !important; font-size: 13px !important; }

  /* Help text */
  .cp-success-help-text { font-size: 10.5px; }
}
@keyframes cpProgressIndeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
@keyframes cpCheckCircleIn {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
@keyframes cpCheckDraw {
  to { stroke-dashoffset: 0; }
}
@keyframes cpSuccessPulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.18); opacity: 0.3; }
  100% { transform: scale(0.95); opacity: 0.8; }
}
@keyframes cpFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.cp-footer{text-align:center;font-size:11px;color:var(--subtle);padding:32px 0 10px;}
@keyframes cp-spin{to{transform:rotate(360deg);}}
.cp-spin{animation:cp-spin .9s linear infinite;}
@keyframes cpDdFadeIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.cp-custom-dd-scroll::-webkit-scrollbar{width:4px;}
.cp-custom-dd-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
.cp-custom-dd-scroll::-webkit-scrollbar-track{background:transparent;}

/* ── PERMANENT ADDRESS MODAL ── */
.cp-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(5px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: cpFadeIn 0.18s ease-out;
}
.cp-modal-card {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  animation: cpModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes cpModalPop {
  0% { opacity: 0; transform: scale(0.95) translateY(8px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.cp-modal-hd {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cp-modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-modal-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #dcfce7;
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cp-modal-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #0f172a;
}
.cp-modal-sub {
  font-size: 11.5px;
  color: #64748b;
  margin-top: 1px;
}
.cp-modal-close-btn {
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.cp-modal-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.cp-modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cp-modal-body::-webkit-scrollbar { width: 4px; }
.cp-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.cp-modal-ft {
  padding: 14px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cp-addr-summary-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
`;

const generateApplicationId = (data) => {
    const prefix = '#AP';
    let dobStr = '01012000';
    if (data?.dob) {
        const parts = String(data.dob).split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            dobStr = `${day}${month}${year}`;
        }
    }
    const firstInitial = (data?.firstName || 'A').trim().charAt(0).toUpperCase() || 'A';
    const lastInitial = (data?.lastName || 'Z').trim().charAt(0).toUpperCase() || 'Z';
    const initials = `${firstInitial}${lastInitial}`;
    const phoneDigits = (data?.phone || '0000').replace(/\D/g, '');
    const phoneLast4 = (phoneDigits.slice(-4) || '0000').padStart(4, '0');
    const serial = '01';
    return `${prefix}${dobStr}${initials}${phoneLast4}${serial}`;
};

const CareersApply = () => {
    const navigate = useNavigate();
    const { id: routeJobId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const ref = searchParams.get('ref') || 'portal';
    const paramJobId = searchParams.get('jobId') || routeJobId || '';
    const paramSlug = searchParams.get('job') || '';

    const [jobs, setJobs] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [draftMeta] = useState(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.formData) {
                        return {
                            formData: { ...INIT, ...parsed.formData },
                            currentStep: Number(parsed.currentStep) || 1,
                            maxStep: Number(parsed.maxStep) || Number(parsed.currentStep) || 1
                        };
                    }
                    return {
                        formData: { ...INIT, ...parsed },
                        currentStep: Number(parsed._savedStep) || 1,
                        maxStep: Number(parsed._savedMaxStep) || Number(parsed._savedStep) || 1
                    };
                }
            }
        } catch (e) {
            console.error('Draft load error', e);
        }
        return { formData: INIT, currentStep: 1, maxStep: 1 };
    });

    const [currentStep, setCurrentStep] = useState(draftMeta.currentStep);
    const [maxStep, setMaxStep] = useState(draftMeta.maxStep);
    const [formData, setFormData] = useState(draftMeta.formData);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [refCode, setRefCode] = useState('');
    const [copiedRef, setCopiedRef] = useState(false);
    const [errors, setErrors] = useState({});
    const [showPermAddressModal, setShowPermAddressModal] = useState(false);

    const displayRefCode = refCode && refCode.startsWith('#AP') ? refCode : generateApplicationId(formData);

    const handleCopyRef = () => {
        const codeToCopy = displayRefCode;
        if (codeToCopy) {
            navigator.clipboard.writeText(codeToCopy);
            setCopiedRef(true);
            setTimeout(() => setCopiedRef(false), 2000);
        }
    };

    // Persist form draft and stage reached on every change
    useEffect(() => {
        if (!submitted) {
            try {
                const draft = {
                    formData,
                    currentStep,
                    maxStep: Math.max(maxStep, currentStep)
                };
                localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            } catch (e) {
                console.error('Draft save error', e);
            }
        }
    }, [formData, currentStep, maxStep, submitted]);

    useEffect(() => {
        const cur = Object.fromEntries(searchParams.entries());
        const next = { ...cur };
        let dirty = false;
        if (!cur.ref) { next.ref = 'portal'; dirty = true; }
        if (!cur.mode) { next.mode = 'apply'; dirty = true; }
        if (!cur.source) { next.source = cur.ref === 'qr' ? 'qr_poster' : 'career_board'; dirty = true; }
        if (dirty) setSearchParams(next, { replace: true });
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/recruitment/jobs');
                const open = (res.data || []).filter(j => j.status === 'Open' || !j.status);
                setJobs(open);
                let match = null;
                if (paramJobId) match = open.find(j => j._id === paramJobId);
                if (!match && paramSlug) match = open.find(j =>
                    j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === paramSlug.toLowerCase()
                );
                const selected = match || (open.length > 0 ? open[0] : null);
                if (selected) {
                    setFormData(p => ({
                        ...p,
                        jobId: p.jobId || selected._id,
                        jobTitle: p.jobTitle || selected.title
                    }));
                }
            } catch (e) {
                console.error('Failed to load jobs', e);
            } finally {
                setLoadingJobs(false);
            }
        };
        load();
    }, []);

    const maxDobStr = useMemo(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 18);
        return d.toISOString().split('T')[0];
    }, []);

    const minDobStr = useMemo(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 100);
        return d.toISOString().split('T')[0];
    }, []);

    const calculateAge = (dob) => {
        if (!dob) return null;
        const b = new Date(dob), t = new Date();
        if (isNaN(b.getTime())) return null;
        let a = t.getFullYear() - b.getFullYear();
        if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
        return a >= 0 && a < 120 ? a : null;
    };

    const age = useMemo(() => calculateAge(formData.dob), [formData.dob]);

    const formatScoreReview = (score, gradeType, fallback) => {
        const val = (score !== undefined && score !== null && String(score).trim() !== '') ? score : fallback;
        if (!val) return '—';
        if (gradeType === 'Percentage') return `${val}%`;
        if (gradeType === 'CGPA') return `${val} CGPA`;
        if (gradeType === 'Marks') return `${val} Marks`;
        if (gradeType) return `${val} (${gradeType})`;
        return String(val);
    };

    const formatSalaryReview = (val) => {
        if (val === undefined || val === null || String(val).trim() === '') return '—';
        const str = String(val).trim();
        if (str.toLowerCase().includes('fresher') || str.toLowerCase().includes('n/a')) return str;
        const numOnly = str.replace(/,/g, '').replace(/₹/g, '').trim();
        const num = Number(numOnly);
        if (!isNaN(num) && num > 0) {
            return `₹ ${num.toLocaleString('en-IN')}`;
        }
        return str.startsWith('₹') ? str : `₹ ${str}`;
    };

    useEffect(() => {
        if (!formData.isAddressSame) return;
        setFormData(p => ({
            ...p,
            permanentStreet: p.currentStreet, permanentCity: p.currentCity,
            permanentState: p.currentState, permanentCountry: p.currentCountry,
            permanentZip: p.currentZip,
        }));
    }, [formData.isAddressSame, formData.currentStreet, formData.currentCity,
    formData.currentState, formData.currentCountry, formData.currentZip]);

    const scrollToTop = () => {
        document.querySelector('.cp-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const [resumeUploadError, setResumeUploadError] = useState('');
    const [isUploadingResume, setIsUploadingResume] = useState(false);
    const resumeInputRef = useRef(null);

    const handleResumeChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setResumeUploadError('');
        setErrors(prev => {
            const next = { ...prev };
            delete next.resumeUrl;
            return next;
        });

        // Validate formats: PDF and JPEG/JPG only
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.pdf', '.jpeg', '.jpg'];
        const isExtValid = validExtensions.some(ext => fileName.endsWith(ext));
        const isMimeValid = file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/jpg';

        if (!isExtValid && !isMimeValid) {
            setResumeUploadError('Invalid file format. Please upload your resume in PDF or JPEG format only.');
            if (e.target) e.target.value = '';
            return;
        }

        // Validate max size 5 MB (5 * 1024 * 1024 bytes)
        const maxBytes = 5 * 1024 * 1024;
        if (file.size > maxBytes) {
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
            setResumeUploadError(`File size exceeds maximum limit of 5 MB (${sizeInMb} MB). Please upload a smaller file.`);
            if (e.target) e.target.value = '';
            return;
        }

        const sizeFormatted = file.size >= 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.round(file.size / 1024)} KB`;

        setIsUploadingResume(true);
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const base64Data = loadEvent.target.result;
            setFormData(prev => ({
                ...prev,
                resumeUrl: base64Data,
                resumeFileName: file.name,
                resumeFileSize: sizeFormatted
            }));
            setIsUploadingResume(false);
        };
        reader.onerror = () => {
            setResumeUploadError('Failed to read resume file. Please try again.');
            setIsUploadingResume(false);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveResume = () => {
        setFormData(prev => ({
            ...prev,
            resumeUrl: '',
            resumeFileName: '',
            resumeFileSize: ''
        }));
        setResumeUploadError('');
        if (resumeInputRef.current) {
            resumeInputRef.current.value = '';
        }
    };

    // ── REAL TIME VALIDATION LOGIC ───────────────────────────────────────
    const validateField = (name, value, allData = formData) => {
        switch (name) {
            case 'firstName':
                if (!value.trim()) return 'First name is required.';
                if (value.trim().length < 2) return 'First name must be at least 2 characters.';
                return '';
            case 'lastName':
                return '';
            case 'guardianName':
                if (!value.trim()) return `${allData.guardianRelation || 'Guardian'}'s name is required.`;
                return '';
            case 'dob': {
                if (!value) return 'Date of birth is required.';
                const calcAge = calculateAge(value);
                const birthDate = new Date(value);
                const today = new Date();
                if (birthDate > today) return 'Date of birth cannot be in the future.';
                if (calcAge === null || calcAge < 18) {
                    return `Candidate must be at least 18 years old to apply${calcAge !== null ? ` (Currently ${calcAge} yrs)` : ''}.`;
                }
                return '';
            }
            case 'maritalStatus':
                if (!value) return 'Marital status is required.';
                return '';
            case 'gender':
                if (!value) return 'Gender is required.';
                return '';
            case 'nationality':
                if (!value) return 'Nationality is required.';
                return '';
            case 'phone': {
                const digits = value.replace(/\D/g, '');
                if (!digits) return 'Mobile number is required.';
                if (!/^[6-9]/.test(digits)) return 'Mobile number must start with 6, 7, 8, or 9.';
                if (digits.length !== 10) return 'Please enter a valid 10-digit mobile number.';
                return '';
            }
            case 'altPhone': {
                if (!value) return '';
                const digits = value.replace(/\D/g, '');
                if (digits.length > 0) {
                    if (!/^[6-9]/.test(digits)) return 'Alternate number must start with 6, 7, 8, or 9.';
                    if (digits.length !== 10) return 'Must be a 10-digit phone number.';
                }
                return '';
            }
            case 'email':
                if (!value.trim()) return 'Email address is required.';
                if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim())) {
                    return 'Please enter a valid email address (e.g. name@example.com).';
                }
                return '';
            case 'currentStreet':
                if (!value.trim()) return 'Street address is required.';
                return '';
            case 'currentCity':
                if (!value.trim()) return 'City is required.';
                return '';
            case 'currentZip': {
                const digits = value.replace(/\D/g, '');
                if (!digits) return 'PIN code is required.';
                if (digits.length !== 6) return 'PIN code must be exactly 6 digits.';
                return '';
            }
            case 'permanentStreet':
                if (!allData.isAddressSame && !value.trim()) return 'Permanent street address is required.';
                return '';
            case 'permanentCity':
                if (!allData.isAddressSame && !value.trim()) return 'Permanent city is required.';
                return '';
            case 'permanentZip': {
                if (!allData.isAddressSame) {
                    const digits = value.replace(/\D/g, '');
                    if (!digits) return 'Permanent PIN code is required.';
                    if (digits.length !== 6) return 'Permanent PIN code must be 6 digits.';
                }
                return '';
            }

            // ── 10th Validation ──
            case 'tenthSchool':
                if (!value || !value.trim()) return 'School / Institution name is required.';
                return '';
            case 'tenthYear':
                if (!value || !String(value).trim()) return 'Year of completion is required.';
                return '';
            case 'tenthGradeType':
                if (!value || !String(value).trim()) return 'Grade type is required.';
                return '';
            case 'tenthScore':
            case 'tenthMarks':
                if (!value || !String(value).trim()) return 'Score is required.';
                return '';

            // ── 12th Validation ──
            case 'twelfthSchool':
                if (allData.hasTwelfth && (!value || !value.trim())) return 'School / Junior college name is required.';
                return '';
            case 'twelfthYear':
                if (allData.hasTwelfth && (!value || !String(value).trim())) return 'Year of completion is required.';
                return '';
            case 'twelfthGradeType':
                if (allData.hasTwelfth && (!value || !String(value).trim())) return 'Grade type is required.';
                return '';
            case 'twelfthScore':
            case 'twelfthMarks':
                if (allData.hasTwelfth && (!value || !String(value).trim())) return 'Score is required.';
                return '';

            // ── Diploma Validation ──
            case 'diplomaCollege':
                if (allData.hasDiploma && (!value || !value.trim())) return 'Institute / Polytechnic name is required.';
                return '';
            case 'diplomaStream':
                if (allData.hasDiploma && (!value || !value.trim())) return 'Branch / Stream is required.';
                return '';
            case 'diplomaYear':
                if (allData.hasDiploma && (!value || !String(value).trim())) return 'Year of completion is required.';
                return '';
            case 'diplomaGradeType':
                if (allData.hasDiploma && (!value || !String(value).trim())) return 'Grade type is required.';
                return '';
            case 'diplomaScore':
            case 'diplomaMarks':
                if (allData.hasDiploma && (!value || !String(value).trim())) return 'Score is required.';
                return '';

            // ── Graduation Validation ──
            case 'gradDegree':
                if (allData.hasGraduation && (!value || !value.trim())) return 'Degree / Course is required.';
                return '';
            case 'gradCollege':
                if (allData.hasGraduation && (!value || !value.trim())) return 'College / University name is required.';
                return '';
            case 'gradStatus':
                if (allData.hasGraduation && (!value || !value.trim())) return 'Degree status is required.';
                return '';
            case 'gradYear':
                if (allData.hasGraduation && (!value || !String(value).trim())) return 'Year of completion is required.';
                return '';
            case 'gradGradeType':
                if (allData.hasGraduation && (!value || !String(value).trim())) return 'Grade type is required.';
                return '';
            case 'gradScore':
            case 'gradMarks':
                if (allData.hasGraduation && (!value || !String(value).trim())) return 'Score is required.';
                return '';

            // ── Post Graduation Validation ──
            case 'pgDegree':
                if (allData.hasPostGraduation && (!value || !value.trim())) return 'Master degree / course is required.';
                return '';
            case 'pgCollege':
                if (allData.hasPostGraduation && (!value || !value.trim())) return 'College / University name is required.';
                return '';
            case 'pgStatus':
                if (allData.hasPostGraduation && (!value || !value.trim())) return 'Post graduation status is required.';
                return '';
            case 'pgYear':
                if (allData.hasPostGraduation && (!value || !String(value).trim())) return 'Year of completion is required.';
                return '';
            case 'pgGradeType':
                if (allData.hasPostGraduation && (!value || !String(value).trim())) return 'Grade type is required.';
                return '';
            case 'pgScore':
            case 'pgMarks':
                if (allData.hasPostGraduation && (!value || !String(value).trim())) return 'Score is required.';
                return '';

            // ── Work Experience Validation ──
            case 'currentCompany':
                if (allData.candidateType === 'Experienced' && (!value || !value.trim())) return 'Current / previous company name is required.';
                return '';
            case 'currentRole':
                if (allData.candidateType === 'Experienced' && (!value || !value.trim())) return 'Designation / job role is required.';
                return '';
            case 'currentSalary':
                if (allData.candidateType === 'Experienced' && (!value || !value.trim())) return 'Current in-hand salary is required.';
                return '';
            case 'expectedSalary':
                if (!value || !value.trim()) return 'Expected salary is required.';
                return '';
            case 'noticePeriod':
                if (!value || !value.trim()) return 'Notice period is required.';
                return '';

            default:
                return '';
        }
    };

    const setField = (name, value) => {
        const next = { ...formData, [name]: value };
        if (name === 'tenthScore') next.tenthMarks = value;
        if (name === 'twelfthScore') next.twelfthMarks = value;
        if (name === 'diplomaScore') next.diplomaMarks = value;
        if (name === 'gradScore') next.gradMarks = value;
        if (name === 'pgScore') next.pgMarks = value;
        setFormData(next);
        const err = validateField(name, value, next);
        setErrors(p => ({ ...p, [name]: err }));
    };

    const handleChange = e => {
        const { name, value, type, checked } = e.target;
        let v = type === 'checkbox' ? checked : value;

        // Auto clean phone & zip numbers
        if (name === 'phone' || name === 'altPhone') {
            v = v.replace(/\D/g, '').slice(0, 10);
        } else if (name === 'currentZip' || name === 'permanentZip') {
            v = v.replace(/\D/g, '').slice(0, 6);
        }

        if (name === 'jobId') {
            const sel = jobs.find(j => j._id === value);
            setFormData(p => ({ ...p, jobId: value, jobTitle: sel ? sel.title : '' }));
            const next = Object.fromEntries(searchParams.entries());
            if (value) { next.jobId = value; if (sel) next.job = sel.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
            else { delete next.jobId; delete next.job; }
            setSearchParams(next, { replace: true });
            return;
        }

        const next = { ...formData, [name]: v };
        if (name === 'tenthScore') next.tenthMarks = v;
        if (name === 'twelfthScore') next.twelfthMarks = v;
        if (name === 'diplomaScore') next.diplomaMarks = v;
        if (name === 'gradScore') next.gradMarks = v;
        if (name === 'pgScore') next.pgMarks = v;
        setFormData(next);

        // Real-time validation
        const err = validateField(name, v, next);
        setErrors(p => ({ ...p, [name]: err }));
    };

    const handleCandidateTypeChange = (type) => {
        setFormData(prev => {
            if (type === 'Fresher') {
                return {
                    ...prev,
                    candidateType: 'Fresher',
                    totalExpYears: '0 Years (Fresher)',
                    totalExpMonths: '0 Months',
                    currentCompany: '',
                    currentRole: '',
                    currentSalary: 'Fresher (N/A)',
                    noticePeriod: prev.noticePeriod || 'Immediate Joiner (0–7 Days)'
                };
            } else {
                return {
                    ...prev,
                    candidateType: 'Experienced',
                    totalExpYears: (prev.totalExpYears === '0 Years (Fresher)' || !prev.totalExpYears) ? '1 Year' : prev.totalExpYears,
                    totalExpMonths: prev.totalExpMonths || '0 Months',
                    currentSalary: (prev.currentSalary === 'Fresher (N/A)' || prev.currentSalary === 'Fresher / Not Applicable') ? '' : prev.currentSalary,
                    noticePeriod: (prev.noticePeriod === 'Immediate Joiner (0–7 Days)' || !prev.noticePeriod) ? '30 Days (1 Month)' : prev.noticePeriod
                };
            }
        });
        setErrors(prev => {
            const copy = { ...prev };
            if (type === 'Fresher') {
                delete copy.currentCompany;
                delete copy.currentRole;
                delete copy.currentSalary;
            }
            return copy;
        });
    };

    const validateStep = (step) => {
        const errs = {};
        if (step === 1) {
            ['firstName', 'guardianName', 'dob', 'maritalStatus', 'gender', 'nationality'].forEach(f => {
                const err = validateField(f, formData[f], formData);
                if (err) errs[f] = err;
            });
        } else if (step === 2) {
            ['phone', 'email', 'currentStreet', 'currentCity', 'currentZip'].forEach(f => {
                const err = validateField(f, formData[f], formData);
                if (err) errs[f] = err;
            });
            if (formData.altPhone) {
                const err = validateField('altPhone', formData.altPhone, formData);
                if (err) errs.altPhone = err;
            }
            if (!formData.isAddressSame) {
                ['permanentStreet', 'permanentCity', 'permanentZip'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
            }
        } else if (step === 3) {
            ['tenthSchool', 'tenthYear', 'tenthGradeType'].forEach(f => {
                const err = validateField(f, formData[f], formData);
                if (err) errs[f] = err;
            });
            const tScore = formData.tenthScore || formData.tenthMarks;
            if (!tScore || !String(tScore).trim()) {
                errs.tenthScore = 'Score is required.';
            }

            // 12th is always required
            ['twelfthSchool', 'twelfthYear', 'twelfthGradeType'].forEach(f => {
                const err = validateField(f, formData[f], formData);
                if (err) errs[f] = err;
            });
            const twScore = formData.twelfthScore || formData.twelfthMarks;
            if (formData.hasTwelfth && (!twScore || !String(twScore).trim())) {
                errs.twelfthScore = 'Score is required.';
            }

            if (formData.hasDiploma) {
                ['diplomaCollege', 'diplomaStream', 'diplomaYear', 'diplomaGradeType'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
                const dScore = formData.diplomaScore || formData.diplomaMarks;
                if (!dScore || !String(dScore).trim()) {
                    errs.diplomaScore = 'Score is required.';
                }
            }
            if (formData.hasGraduation) {
                ['gradDegree', 'gradCollege', 'gradStatus', 'gradYear', 'gradGradeType'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
                const gScore = formData.gradScore || formData.gradMarks;
                if (!gScore || !String(gScore).trim()) {
                    errs.gradScore = 'Score is required.';
                }
            }
            if (formData.hasPostGraduation) {
                ['pgDegree', 'pgCollege', 'pgStatus', 'pgYear', 'pgGradeType'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
                const pScore = formData.pgScore || formData.pgMarks;
                if (!pScore || !String(pScore).trim()) {
                    errs.pgScore = 'Score is required.';
                }
            }
        } else if (step === 4) {
            if (formData.candidateType === 'Experienced') {
                ['currentCompany', 'currentRole', 'currentSalary', 'expectedSalary', 'noticePeriod'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
            } else {
                ['expectedSalary', 'noticePeriod'].forEach(f => {
                    const err = validateField(f, formData[f], formData);
                    if (err) errs[f] = err;
                });
            }
            if (!formData.resumeUrl) {
                errs.resumeUrl = 'Please upload updated resume (PDF or JPEG format, max 5MB).';
                setResumeUploadError('Please upload updated resume (PDF or JPEG format, max 5MB).');
            }
        }
        setErrors(prev => ({ ...prev, ...errs }));
        return Object.keys(errs).length === 0;
    };

    const handleContinueStep1 = (e) => {
        if (e) e.preventDefault();
        if (validateStep(1)) {
            setCurrentStep(2);
            setMaxStep(prev => Math.max(prev, 2));
            scrollToTop();
        }
    };

    const handleContinueStep2 = (e) => {
        if (e) e.preventDefault();
        if (validateStep(2)) {
            setCurrentStep(3);
            setMaxStep(prev => Math.max(prev, 3));
            scrollToTop();
        } else {
            if (!formData.isAddressSame && (!formData.permanentStreet || !formData.permanentCity || !formData.permanentZip)) {
                setShowPermAddressModal(true);
            }
        }
    };

    const handleContinueStep3 = (e) => {
        if (e) e.preventDefault();
        if (validateStep(3)) {
            setCurrentStep(4);
            setMaxStep(prev => Math.max(prev, 4));
            scrollToTop();
        }
    };

    const handleContinueStep4 = (e) => {
        if (e) e.preventDefault();
        if (validateStep(4)) {
            setCurrentStep(5);
            setMaxStep(prev => Math.max(prev, 5));
            scrollToTop();
        }
    };

    const [submitError, setSubmitError] = useState('');

    const handleSubmit = async e => {
        e.preventDefault();
        setSubmitError('');
        if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
            if (!validateStep(1)) setCurrentStep(1);
            else if (!validateStep(2)) setCurrentStep(2);
            else if (!validateStep(3)) setCurrentStep(3);
            else setCurrentStep(4);
            scrollToTop();
            return;
        }

        setSubmitting(true);

        const clientAppId = generateApplicationId(formData);
        const payload = {
            jobId: formData.jobId,
            jobTitle: formData.jobTitle,
            applicationId: clientAppId,
            source: searchParams.get('source') || (searchParams.get('ref') === 'qr' ? 'qr_poster' : 'career_board'),
            firstName: formData.firstName.trim(),
            middleName: (formData.middleName || '').trim(),
            lastName: (formData.lastName || '').trim(),
            email: formData.email.trim().toLowerCase(),
            phone: (formData.phone || '').trim(),
            altPhone: (formData.altPhone || '').trim(),
            resumeUrl: formData.resumeUrl || '',
            resumeFileName: formData.resumeFileName || '',
            resumeFileSize: formData.resumeFileSize || '',
            personalDetails: {
                middleName: (formData.middleName || '').trim(),
                guardianSalutation: formData.guardianSalutation,
                guardianRelation: formData.guardianRelation,
                guardianName: (formData.guardianName || '').trim(),
                dob: formData.dob,
                gender: formData.gender,
                maritalStatus: formData.maritalStatus,
                nationality: formData.nationality || 'Indian',
                religion: formData.religion,
                caste: formData.caste,
                altPhone: (formData.altPhone || '').trim(),
                isAddressSame: formData.isAddressSame,
                currentAddress: {
                    street: formData.currentStreet,
                    city: formData.currentCity,
                    state: formData.currentState,
                    country: formData.currentCountry,
                    zip: formData.currentZip
                },
                permanentAddress: {
                    street: formData.permanentStreet,
                    city: formData.permanentCity,
                    state: formData.permanentState,
                    country: formData.permanentCountry,
                    zip: formData.permanentZip
                }
            },
            qualifications: {
                tenth: {
                    school: formData.tenthSchool,
                    board: formData.tenthBoard,
                    year: formData.tenthYear,
                    gradeType: formData.tenthGradeType || 'Percentage',
                    score: formData.tenthScore,
                    marks: formData.tenthMarks || formData.tenthScore
                },
                twelfth: formData.hasTwelfth ? {
                    hasTwelfth: true,
                    school: formData.twelfthSchool,
                    board: formData.twelfthBoard,
                    stream: formData.twelfthStream,
                    year: formData.twelfthYear,
                    gradeType: formData.twelfthGradeType || 'Percentage',
                    score: formData.twelfthScore,
                    marks: formData.twelfthMarks || formData.twelfthScore
                } : { hasTwelfth: false },
                diploma: formData.hasDiploma ? {
                    hasDiploma: true,
                    college: formData.diplomaCollege,
                    stream: formData.diplomaStream,
                    year: formData.diplomaYear,
                    gradeType: formData.diplomaGradeType || 'Percentage',
                    score: formData.diplomaScore,
                    marks: formData.diplomaMarks || formData.diplomaScore
                } : { hasDiploma: false },
                graduation: formData.hasGraduation ? {
                    hasGraduation: true,
                    degree: formData.gradDegree,
                    college: formData.gradCollege,
                    year: formData.gradYear,
                    gradeType: formData.gradGradeType || 'Percentage',
                    score: formData.gradScore,
                    marks: formData.gradMarks || formData.gradScore,
                    status: formData.gradStatus
                } : { hasGraduation: false },
                postGraduation: formData.hasPostGraduation ? {
                    hasPostGraduation: true,
                    degree: formData.pgDegree,
                    college: formData.pgCollege,
                    year: formData.pgYear,
                    gradeType: formData.pgGradeType || 'Percentage',
                    score: formData.pgScore,
                    marks: formData.pgMarks || formData.pgScore,
                    status: formData.pgStatus
                } : { hasPostGraduation: false }
            },
            experience: {
                candidateType: formData.candidateType,
                currentCompany: formData.candidateType === 'Experienced' ? formData.currentCompany : '',
                currentRole: formData.candidateType === 'Experienced' ? formData.currentRole : '',
                totalExpYears: formData.candidateType === 'Experienced' ? formData.totalExpYears : '0',
                totalExpMonths: formData.candidateType === 'Experienced' ? formData.totalExpMonths : '0',
                currentSalary: formData.candidateType === 'Experienced' ? formData.currentSalary : '',
                expectedSalary: formData.expectedSalary,
                noticePeriod: formData.noticePeriod,
                keySkills: formData.keySkills
            }
        };

        try {
            let res;
            try {
                res = await api.post('/recruitment/public/apply', payload);
            } catch (firstErr) {
                if (firstErr.response && firstErr.response.status === 404) {
                    res = await api.post('/recruitment/candidates', payload);
                } else {
                    throw firstErr;
                }
            }

            const assignedAppId = res?.data?.applicationId || res?.data?.candidate?.applicationId || clientAppId;
            setRefCode(assignedAppId);
            setSubmitting(false);
            setSubmitted(true);

            try {
                localStorage.removeItem(DRAFT_KEY);
                sessionStorage.removeItem(DRAFT_KEY);
            } catch (err) {
                console.error(err);
            }
            scrollToTop();
        } catch (err) {
            console.error('Application submission error:', err);
            const msg = err.response?.data?.message || 'Failed to submit your application. Please verify all details and try again.';
            setSubmitError(msg);
            setSubmitting(false);
            scrollToTop();
        }
    };

    const reset = () => {
        try {
            localStorage.removeItem(DRAFT_KEY);
            sessionStorage.removeItem(DRAFT_KEY);
        } catch (e) {
            console.error(e);
        }
        setFormData(INIT);
        setCurrentStep(1);
        setMaxStep(1);
        setSubmitted(false);
        setErrors({});
        setRefCode('');
    };

    // ── Input helper functions ──────────────────────────────────────────────

    const inp = (name, props = {}) => (
        <input
            id={name} name={name} value={formData[name]}
            onChange={handleChange}
            className={'cp-input' + (errors[name] ? ' err' : '')}
            {...props}
        />
    );

    const selEl = (name, opts, props = {}) => (
        <CustomSelect
            id={name}
            name={name}
            value={formData[name]}
            onChange={handleChange}
            options={opts}
            error={!!errors[name]}
            {...props}
        />
    );

    const pill = (field, options) => (
        <div className="cp-pills">
            {options.map(o => (
                <button key={o} type="button"
                    className={'cp-pill' + (formData[field] === o ? ' on' : '')}
                    onClick={() => {
                        setField(field, o);
                        if (errors[field]) {
                            setErrors(prev => ({ ...prev, [field]: '' }));
                        }
                    }}>
                    {formData[field] === o && <Check size={13} />} {o}
                </button>
            ))}
        </div>
    );

    const selectedJob = jobs.find(j => j._id === formData.jobId);

    return (
        <div className="cp-root">
            <style>{PORTAL_CSS}</style>

            {/* ── PROFESSIONAL ENTERPRISE SUBMITTING OVERLAY ── */}
            {submitting && (
                <div className="cp-submitting-overlay">
                    <div className="cp-submitting-card">
                        <div className="cp-submitting-spinner-ring">
                            <div className="cp-submitting-spinner" />
                            <Shield size={24} className="cp-submitting-icon" />
                        </div>
                        <h3 className="cp-submitting-title">Submitting Application</h3>
                        <p className="cp-submitting-desc">
                            Securely encrypting and transmitting your profile to Bhoomi Techzone Talent Acquisition...
                        </p>
                        <div className="cp-submitting-progress-bar">
                            <div className="cp-submitting-progress-fill" />
                        </div>
                        <div className="cp-submitting-steps">
                            <span className="cp-submitting-step-dot" /> Validating credentials &amp; generating reference ID
                        </div>
                    </div>
                </div>
            )}

            {/* ── NAV (Hidden on Submit) ── */}
            {!submitted && (
                <nav className="cp-nav">
                    <div className="cp-nav-brand">
                        <div className="cp-nav-logo">
                            <img src="/favicon.webp" alt="Bhoomi Techzone" />
                        </div>
                        <div className="cp-nav-brand-text">
                            <div className="cp-nav-name">Bhoomi Techzone Pvt Ltd</div>
                            <div className="cp-nav-sub">Careers &amp; Talent Portal</div>
                        </div>
                    </div>
                    <div className="cp-nav-actions">
                        <button
                            type="button"
                            className="cp-nav-browse-btn"
                            onClick={() => navigate('/careers')}
                        >
                            <span className="cp-nav-btn-text">Browse Openings</span>
                            <span className="cp-nav-btn-text-short">Openings</span>
                            <ArrowRight size={13} />
                        </button>
                        <span className="cp-nav-badge">
                            <span className="cp-nav-badge-full">Step 0{currentStep} / 05</span>
                            <span className="cp-nav-badge-short">0{currentStep}/05</span>
                        </span>
                    </div>
                </nav>
            )}

            {/* ── MAIN VIEW: SUCCESS CONFIRMATION vs APPLICATION FORM ── */}
            {submitted ? (
                <div className="cp-success-viewport">
                    <div className="cp-success-container">
                        <div className="cp-success-enterprise">
                            {/* Animated professional check icon */}
                            <div className="cp-success-check-icon">
                                <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <filter id="chk-shadow" x="-25%" y="-25%" width="150%" height="150%">
                                            <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#16a34a" floodOpacity="0.25" />
                                        </filter>
                                        <linearGradient id="chk-grad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" />
                                            <stop offset="100%" stopColor="#15803d" />
                                        </linearGradient>
                                    </defs>
                                    {/* Soft outer ring */}
                                    <circle cx="32" cy="32" r="31" fill="#dcfce7" opacity="0.5" className="cp-check-circle" />
                                    {/* Main filled circle */}
                                    <circle cx="32" cy="32" r="26" fill="url(#chk-grad)" filter="url(#chk-shadow)" className="cp-check-circle" />
                                    {/* Inner gloss ring */}
                                    <circle cx="32" cy="32" r="25.2" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
                                    {/* Animated checkmark path */}
                                    <path
                                        className="cp-check-path"
                                        d="M19 32L27.5 40.5L45 22"
                                        stroke="#ffffff"
                                        strokeWidth="3.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>

                            {/* Header Titles */}
                            <h2 className="cp-success-hero-title">Application Submitted Successfully</h2>
                            <p className="cp-success-hero-sub">
                                Thank you, <strong>{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName || ''}</strong>. Your official application for <strong style={{ color: '#090d16' }}>{selectedJob?.title || formData.jobTitle || 'the position'}</strong> has been registered with Bhoomi Techzone Talent Acquisition.
                            </p>

                            {/* ── Single Unified Card ── */}
                            <div className="cp-ref-card">

                                {/* Row 1: Tags */}
                                <div className="cp-ref-card-top">
                                    <div className="cp-ref-tag">
                                        <Shield size={12} />APPLICATION ID
                                    </div>
                                    <div className="cp-ref-status">
                                        <span className="cp-status-dot" /> Under Review
                                    </div>
                                </div>

                                {/* Row 2: ID + Copy */}
                                <div className="cp-ref-code-row">
                                    <span className="cp-ref-code-text">{displayRefCode}</span>
                                    <button
                                        type="button"
                                        onClick={handleCopyRef}
                                        className="cp-ref-copy-btn"
                                        title="Copy Application ID"
                                    >
                                        {copiedRef ? (
                                            <><Check size={13} color="#16a34a" /> Copied!</>
                                        ) : (
                                            <><FileText size={13} /> Copy ID</>
                                        )}
                                    </button>
                                </div>

                                {/* Row 3: Meta grid */}
                                <div className="cp-ref-meta-grid">
                                    <div className="cp-ref-meta-item">
                                        <span className="cp-ref-meta-label">Position</span>
                                        <span className="cp-ref-meta-val">{selectedJob?.title || formData.jobTitle || 'General Position'}</span>
                                    </div>
                                    <div className="cp-ref-meta-item">
                                        <span className="cp-ref-meta-label">Submitted On</span>
                                        <span className="cp-ref-meta-val">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="cp-card-divider" />

                                {/* Row 4: Email section */}
                                <div className="cp-card-email-row">
                                    <div className="cp-card-email-content">
                                        <span className="cp-card-email-label">All status updates, interview invitations &amp; further communications will be sent to</span>
                                        <span className="cp-card-email-val">{formData.email || 'your registered email'}</span>
                                        <span className="cp-card-email-msg">Our talent acquisition team is actively reviewing your qualifications. We process every application diligently and will get back to you as soon as possible.</span>
                                    </div>
                                    {/* Icon — top right */}
                                    <div className="cp-card-email-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#16a34a" strokeWidth="1.6" fill="none" />
                                            <path d="M2 7.5L12 13.5L22 7.5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                </div>

                            </div>

                            {/* Action Button */}
                            <div className="cp-success-actions" style={{ justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/careers')}
                                    className="cp-btn-primary"
                                    style={{ padding: '10px 22px', fontSize: '13px' }}
                                >
                                    <ArrowLeft size={14} /> Browse All Openings
                                </button>
                            </div>

                            <div className="cp-success-help-text">
                                Save this Reference ID ({displayRefCode}) for future communications with Bhoomi Techzone HR.
                            </div>
                        </div>

                        {/* Centered Footer */}
                        <div className="cp-footer" style={{ marginTop: '24px', textAlign: 'center', lineHeight: 1.6 }}>
                            <div>© {new Date().getFullYear()} Bhoomi Techzone Pvt. Ltd. · All Rights Reserved</div>
                            <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
                                <a href="mailto:hr@bhoomitechzone.in" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Mail size={12} color="#16a34a" /> hr@bhoomitechzone.in
                                </a>
                                <span style={{ color: '#cbd5e1' }}>·</span>
                                <a href="tel:+919821724181" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Phone size={12} color="#16a34a" /> +91 98217 24181
                                </a>
                                <span style={{ color: '#cbd5e1' }}>·</span>
                                <a href="tel:+919211947852" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Phone size={12} color="#16a34a" /> +91 92119 47852
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="cp-shell">
                    {/* ── SIDEBAR ── */}
                    <aside className="cp-sidebar">
                        <div className="cp-sidebar-brand">
                            <div className="cp-sidebar-brand-label">Application Steps</div>
                            {STEPS.map((s) => {
                                const isCompleted = s.id < currentStep;
                                const isUnlocked = s.id <= maxStep;
                                const isActive = currentStep === s.id;
                                const isClickable = isUnlocked && s.id !== currentStep;

                                return (
                                    <div
                                        key={s.id}
                                        className={'cp-step' + (isActive ? ' active' : '') + (isCompleted ? ' done' : '') + (isClickable ? ' clickable' : '')}
                                        onClick={() => {
                                            if (isClickable) {
                                                setCurrentStep(s.id);
                                                scrollToTop();
                                            }
                                        }}
                                    >
                                        <div className="cp-step-num">
                                            {isCompleted ? <Check size={13} strokeWidth={3} /> : s.id}
                                        </div>
                                        <div>
                                            <div className="cp-step-label">{s.label}</div>
                                            <div className="cp-step-sub">
                                                {isCompleted ? 'Completed ✓' : (isActive ? 'Current Step' : (isUnlocked ? 'Visited' : s.sub))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="cp-sidebar-section">
                            <div className="cp-sidebar-section-label">Open Positions</div>
                            {loadingJobs ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                                            <div className="cp-skeleton" style={{ width: '75%', height: 12, marginBottom: 6 }} />
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                <div className="cp-skeleton" style={{ width: '40%', height: 9 }} />
                                                <div className="cp-skeleton" style={{ width: '30%', height: 9 }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : jobs.length === 0 ? (
                                <div style={{ fontSize: '11.5px', color: '#a1a1aa', padding: '8px 0' }}>No open positions.</div>
                            ) : (
                                <div>
                                    {jobs.map(j => (
                                        <div key={j._id}
                                            className={'cp-job-card' + (formData.jobId === j._id ? ' sel' : '')}
                                            onClick={() => handleChange({ target: { name: 'jobId', value: j._id } })}>
                                            <div className="cp-job-card-title">{j.title}</div>
                                            <div className="cp-job-card-meta">
                                                <span>{j.department || 'General'}</span>
                                                <span>·</span>
                                                <span>{j.location || 'On-site'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ── MAIN SCROLL PANEL ── */}
                    <div className="cp-main">
                        <div className="cp-form-container">
                            {/* Direct Minimal Professional Header */}
                            <div className="cp-page-hd">
                                <div>
                                    <div className="cp-role-chip">
                                        <Briefcase size={12} />
                                        <span>{selectedJob ? (selectedJob.department || 'Open Position') : 'Talent Pool'}</span>
                                        {selectedJob?.location && (
                                            <>
                                                <span style={{ opacity: 0.5 }}>·</span>
                                                <span>{selectedJob.location}</span>
                                            </>
                                        )}
                                    </div>
                                    <h1 className="cp-page-heading">
                                        {selectedJob ? selectedJob.title : 'General Application'}
                                    </h1>
                                    <p className="cp-page-sub">
                                        Please fill in accurate details as per your academic certificates and official records.
                                    </p>
                                </div>
                                {currentStep > 1 && (
                                    <button
                                        type="button"
                                        className="cp-top-back-btn"
                                        onClick={() => {
                                            setCurrentStep(p => Math.max(1, p - 1));
                                            scrollToTop();
                                        }}
                                    >
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                )}
                            </div>

                            {/* ── STEP FORM ── */}
                            <form onSubmit={handleSubmit}>

                                {/* ── STEP 1: PERSONAL INFORMATION ── */}
                                {currentStep === 1 && (
                                    <div className="cp-section">
                                        <div className="cp-section-hd">
                                            <div className="cp-section-icon"><User size={16} /></div>
                                            <div>
                                                <div className="cp-section-label">Personal Information</div>
                                                <div className="cp-section-sub">Identity, family &amp; demographic background</div>
                                            </div>
                                        </div>

                                        <div className="cp-row cp-row-3">
                                            <Field id="firstName" label="First Name" required error={errors.firstName}>
                                                {inp('firstName', { placeholder: 'Enter first name' })}
                                            </Field>
                                            <Field id="middleName" label="Middle Name">
                                                {inp('middleName', { placeholder: 'Enter middle name' })}
                                            </Field>
                                            <Field id="lastName" label="Last Name" error={errors.lastName}>
                                                {inp('lastName', { placeholder: 'Enter last name' })}
                                            </Field>
                                        </div>

                                        <Field id="guardianName" label="Father's / Mother's / Guardian's Name" required error={errors.guardianName}>
                                            <div className="cp-guardian-row">
                                                {selEl('guardianSalutation', SALUTATIONS, { placeholder: 'Title' })}
                                                {selEl('guardianRelation', RELATIONS, { placeholder: 'Relation' })}
                                                {inp('guardianName', { placeholder: 'Enter guardian name' })}
                                            </div>
                                        </Field>

                                        <div className="cp-row cp-row-2" style={{ marginTop: 14 }}>
                                            <Field id="dob" label="Date of Birth" required error={errors.dob}>
                                                {inp('dob', { type: 'date', max: maxDobStr, min: minDobStr })}
                                            </Field>
                                            <Field id="maritalStatus" label="Marital Status" required error={errors.maritalStatus}>
                                                {pill('maritalStatus', ['Single', 'Married', 'Other'])}
                                            </Field>
                                        </div>

                                        <Field id="gender" label="Gender" required error={errors.gender}>
                                            {pill('gender', ['Male', 'Female', 'Other', 'Prefer not to say'])}
                                        </Field>

                                        <div className="cp-divider">Social &amp; Demographic</div>
                                        <div className="cp-row cp-row-3">
                                            <Field id="nationality" label="Nationality" required error={errors.nationality}>
                                                {selEl('nationality', NATIONALITIES, { placeholder: 'Select nationality', searchable: true, searchPlaceholder: 'Search nationality...' })}
                                            </Field>
                                            <Field id="religion" label="Religion">
                                                {selEl('religion', RELIGIONS, { placeholder: 'Select religion', searchable: true, searchPlaceholder: 'Search religion...' })}
                                            </Field>
                                            <Field id="caste" label="Category / Caste">
                                                {selEl('caste', CASTES, { placeholder: 'Select category / caste' })}
                                            </Field>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 2: CONTACT & ADDRESS ── */}
                                {currentStep === 2 && (
                                    <div className="cp-section">
                                        <div className="cp-section-hd">
                                            <div className="cp-section-icon"><Phone size={16} /></div>
                                            <div>
                                                <div className="cp-section-label">Contact Details &amp; Address</div>
                                                <div className="cp-section-sub">Phone, email &amp; residential address</div>
                                            </div>
                                        </div>

                                        <div className="cp-row cp-row-3">
                                            <Field id="phone" label="Mobile Number" required error={errors.phone}>
                                                <div className="cp-phone-wrap">
                                                    <span className="cp-phone-cc">+91</span>
                                                    {inp('phone', { type: 'tel', placeholder: 'Enter mobile number' })}
                                                </div>
                                            </Field>
                                            <Field id="altPhone" label="Alternate Phone" error={errors.altPhone}>
                                                <div className="cp-phone-wrap">
                                                    <span className="cp-phone-cc">+91</span>
                                                    {inp('altPhone', { type: 'tel', placeholder: 'Enter alternate phone number' })}
                                                </div>
                                            </Field>
                                            <Field id="email" label="Email Address" required error={errors.email}>
                                                {inp('email', { type: 'email', placeholder: 'Enter email address' })}
                                            </Field>
                                        </div>

                                        <div className="cp-divider">Address Information</div>

                                        <div className="cp-addr-box">
                                            <div className="cp-addr-hd">
                                                <div className="cp-addr-title"><MapPin size={13} color="#71717a" /> Current Address</div>
                                            </div>
                                            <Field id="currentStreet" label="Street / House / Landmark" required error={errors.currentStreet}>
                                                {inp('currentStreet', { placeholder: 'Enter street address / landmark' })}
                                            </Field>
                                            <div className="cp-row cp-row-auto" style={{ marginTop: 10 }}>
                                                <Field id="currentCity" label="City" required error={errors.currentCity}>{inp('currentCity', { placeholder: 'Enter city' })}</Field>
                                                <Field id="currentState" label="State" required>{selEl('currentState', INDIAN_STATES, { placeholder: 'Select state', searchable: true, searchPlaceholder: 'Search state...' })}</Field>
                                                <Field id="currentCountry" label="Country" required>{inp('currentCountry', { placeholder: 'Enter country' })}</Field>
                                                <Field id="currentZip" label="PIN Code" required error={errors.currentZip}>{inp('currentZip', { placeholder: 'Enter PIN code', maxLength: 6 })}</Field>
                                            </div>
                                        </div>

                                        <div style={{ margin: '14px 0 16px' }}>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                                                <input
                                                    type="checkbox"
                                                    name="isAddressSame"
                                                    checked={formData.isAddressSame}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setField('isAddressSame', checked);
                                                        if (!checked) {
                                                            setShowPermAddressModal(true);
                                                        } else {
                                                            setShowPermAddressModal(false);
                                                        }
                                                    }}
                                                    style={{ width: 17, height: 17, accentColor: '#16a34a', cursor: 'pointer' }}
                                                />
                                                <span>Permanent address is same as current address</span>
                                            </label>
                                        </div>

                                        {!formData.isAddressSame && (
                                            <div className="cp-addr-summary-card">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '12.5px', fontWeight: 700, color: '#166534' }}>
                                                        <Building2 size={15} color="#16a34a" /> Permanent Address (Separate)
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPermAddressModal(true)}
                                                        className="cp-btn-secondary"
                                                        style={{ padding: '4px 12px', fontSize: '11.5px', height: 'auto', background: '#ffffff', borderColor: '#86efac', color: '#166534' }}
                                                    >
                                                        <Edit3 size={12} /> Edit Address
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: '#1e293b', lineHeight: 1.5 }}>
                                                    {formData.permanentStreet || formData.permanentCity ? (
                                                        <>
                                                            <div style={{ fontWeight: 600 }}>{formData.permanentStreet || '—'}</div>
                                                            <div style={{ color: '#475569', marginTop: 2 }}>
                                                                {[formData.permanentCity, formData.permanentState, formData.permanentCountry || 'India', formData.permanentZip].filter(Boolean).join(', ')}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', fontStyle: 'italic' }}>
                                                            <AlertCircle size={13} /> Permanent address details not filled yet. Click "Edit Address" to enter.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── PERMANENT ADDRESS MODAL ── */}
                                        {showPermAddressModal && (
                                            <div className="cp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowPermAddressModal(false); }}>
                                                <div className="cp-modal-card" role="dialog" aria-modal="true">
                                                    <div className="cp-modal-hd">
                                                        <div className="cp-modal-title-wrap">
                                                            <div className="cp-modal-icon">
                                                                <Building2 size={18} />
                                                            </div>
                                                            <div>
                                                                <div className="cp-modal-title">Permanent Residential Address</div>
                                                                <div className="cp-modal-sub">Specify permanent address for background verification</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPermAddressModal(false)}
                                                            className="cp-modal-close-btn"
                                                            title="Close"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="cp-modal-body">
                                                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.isAddressSame}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        setField('isAddressSame', checked);
                                                                        if (checked) {
                                                                            setShowPermAddressModal(false);
                                                                        }
                                                                    }}
                                                                    style={{ width: 15, height: 15, accentColor: '#16a34a', cursor: 'pointer' }}
                                                                />
                                                                <span>Permanent address is same as current address</span>
                                                            </label>
                                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Check to close modal &amp; sync</span>
                                                        </div>

                                                        <Field id="permanentStreet" label="Street / House / Landmark" required error={errors.permanentStreet}>
                                                            {inp('permanentStreet', { placeholder: 'Enter permanent street address / landmark' })}
                                                        </Field>

                                                        <div className="cp-row cp-row-2">
                                                            <Field id="permanentCity" label="City" required error={errors.permanentCity}>
                                                                {inp('permanentCity', { placeholder: 'Enter city' })}
                                                            </Field>
                                                            <Field id="permanentState" label="State" required error={errors.permanentState}>
                                                                {selEl('permanentState', INDIAN_STATES, { placeholder: 'Select state', searchable: true, searchPlaceholder: 'Search state...' })}
                                                            </Field>
                                                        </div>

                                                        <div className="cp-row cp-row-2">
                                                            <Field id="permanentCountry" label="Country" required>
                                                                {inp('permanentCountry', { placeholder: 'Enter country' })}
                                                            </Field>
                                                            <Field id="permanentZip" label="PIN Code" required error={errors.permanentZip}>
                                                                {inp('permanentZip', { placeholder: 'Enter 6-digit PIN code', maxLength: 6 })}
                                                            </Field>
                                                        </div>
                                                    </div>

                                                    <div className="cp-modal-ft">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setField('isAddressSame', true);
                                                                setShowPermAddressModal(false);
                                                            }}
                                                            className="cp-btn-secondary"
                                                            style={{ fontSize: '12.5px', padding: '8px 16px' }}
                                                        >
                                                            Same as Current
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const pStreetErr = validateField('permanentStreet', formData.permanentStreet, formData);
                                                                const pCityErr = validateField('permanentCity', formData.permanentCity, formData);
                                                                const pZipErr = validateField('permanentZip', formData.permanentZip, formData);
                                                                if (pStreetErr || pCityErr || pZipErr) {
                                                                    setErrors(p => ({ ...p, permanentStreet: pStreetErr, permanentCity: pCityErr, permanentZip: pZipErr }));
                                                                }
                                                                setShowPermAddressModal(false);
                                                            }}
                                                            className="cp-btn-primary"
                                                            style={{ fontSize: '12.5px', padding: '8px 18px', boxShadow: 'none' }}
                                                        >
                                                            <Check size={14} /> Save &amp; Confirm Address
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="cp-note">
                                            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            <span>All contact and address information is kept strictly confidential.</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 3: QUALIFICATION ── */}
                                {currentStep === 3 && (
                                    <div className="cp-section">
                                        <div className="cp-section-hd">
                                            <div className="cp-section-icon"><GraduationCap size={16} /></div>
                                            <div>
                                                <div className="cp-section-label">Educational Qualification</div>
                                                <div className="cp-section-sub">10th, 12th, Diploma, Graduation &amp; Post Graduation details</div>
                                            </div>
                                        </div>

                                        {/* 1. 10th Standard (Required) */}
                                        <div className="cp-qual-card">
                                            <div className="cp-qual-hd">
                                                <div className="cp-qual-title-wrap">
                                                    <div className="cp-qual-title">
                                                        <BookOpen size={15} color="#16a34a" /> 10th Standard (Secondary / SSC)
                                                    </div>
                                                    <span className="cp-qual-badge-req">Required</span>
                                                </div>
                                            </div>
                                            <div className="cp-row cp-row-2">
                                                <Field id="tenthSchool" label="School / Institution Name" required error={errors.tenthSchool}>
                                                    {inp('tenthSchool', { placeholder: 'Enter school or institution name' })}
                                                </Field>
                                                <Field id="tenthBoard" label="Board of Examination" required>
                                                    {selEl('tenthBoard', BOARDS_LIST, { placeholder: 'Select board of examination', searchable: true, searchPlaceholder: 'Search board...' })}
                                                </Field>
                                            </div>
                                            <div className="cp-row cp-row-3" style={{ marginTop: 10 }}>
                                                <Field id="tenthYear" label="Year of Completion" required error={errors.tenthYear}>
                                                    {selEl('tenthYear', PASSING_YEARS, { placeholder: 'Select year of passing', searchable: true, searchPlaceholder: 'Search year...' })}
                                                </Field>
                                                <Field id="tenthGradeType" label="Grade Type" required error={errors.tenthGradeType}>
                                                    {selEl('tenthGradeType', GRADE_TYPES, { placeholder: 'Select grade type' })}
                                                </Field>
                                                <Field id="tenthScore" label="Score" required error={errors.tenthScore} hint={formData.tenthGradeType === 'CGPA' ? 'Enter CGPA score' : (formData.tenthGradeType === 'Marks' ? 'Enter total marks obtained' : 'Enter percentage score')}>
                                                    {inp('tenthScore', { type: 'number', step: 'any', placeholder: formData.tenthGradeType === 'CGPA' ? 'Enter CGPA' : (formData.tenthGradeType === 'Marks' ? 'Enter marks' : 'Enter percentage') })}
                                                </Field>
                                            </div>
                                        </div>

                                        {/* 2. 12th Standard (Higher Secondary / HSC) — REQUIRED */}
                                        <div className="cp-qual-card">
                                            <div className="cp-qual-hd">
                                                <div className="cp-qual-title-wrap">
                                                    <div className="cp-qual-title">
                                                        <Award size={15} color="#2563eb" /> 12th Standard (Higher Secondary / Intermediate)
                                                    </div>
                                                    <span className="cp-qual-badge-req">Required</span>
                                                </div>
                                            </div>
                                            <div className="cp-row cp-row-3">
                                                <Field id="twelfthSchool" label="School / Junior College Name" required error={errors.twelfthSchool}>
                                                    {inp('twelfthSchool', { placeholder: 'Enter school or junior college name' })}
                                                </Field>
                                                <Field id="twelfthBoard" label="Board" required>
                                                    {selEl('twelfthBoard', BOARDS_LIST, { placeholder: 'Select board of examination', searchable: true, searchPlaceholder: 'Search board...' })}
                                                </Field>
                                                <Field id="twelfthStream" label="Stream" required>
                                                    {selEl('twelfthStream', TWELFTH_STREAMS, { placeholder: 'Select stream' })}
                                                </Field>
                                            </div>
                                            <div className="cp-row cp-row-3" style={{ marginTop: 10 }}>
                                                <Field id="twelfthYear" label="Year of Completion" required error={errors.twelfthYear}>
                                                    {selEl('twelfthYear', PASSING_YEARS, { placeholder: 'Select year of passing', searchable: true, searchPlaceholder: 'Search year...' })}
                                                </Field>
                                                <Field id="twelfthGradeType" label="Grade Type" required error={errors.twelfthGradeType}>
                                                    {selEl('twelfthGradeType', GRADE_TYPES, { placeholder: 'Select grade type' })}
                                                </Field>
                                                <Field id="twelfthScore" label="Score" required error={errors.twelfthScore} hint={formData.twelfthGradeType === 'CGPA' ? 'Enter CGPA score' : (formData.twelfthGradeType === 'Marks' ? 'Enter total marks obtained' : 'Enter percentage score')}>
                                                    {inp('twelfthScore', { type: 'number', step: 'any', placeholder: formData.twelfthGradeType === 'CGPA' ? 'Enter CGPA' : (formData.twelfthGradeType === 'Marks' ? 'Enter marks' : 'Enter percentage') })}
                                                </Field>
                                            </div>
                                        </div>

                                        {/* 3. Diploma (Optional) */}
                                        <div className="cp-qual-card">
                                            <div className="cp-qual-hd">
                                                <div className="cp-qual-title-wrap">
                                                    <div className="cp-qual-title">
                                                        <Award size={15} color="#d97706" /> Diploma (Polytechnic / Technical)
                                                    </div>
                                                    <span className="cp-qual-badge-opt">Optional</span>
                                                </div>
                                                <label className="cp-qual-toggle">
                                                    <input
                                                        type="checkbox"
                                                        name="hasDiploma"
                                                        checked={formData.hasDiploma}
                                                        onChange={(e) => setField('hasDiploma', e.target.checked)}
                                                        style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }}
                                                    />
                                                    <span>Have Diploma</span>
                                                </label>
                                            </div>
                                            {formData.hasDiploma && (
                                                <>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="diplomaCollege" label="Polytechnic / Institute Name" required error={errors.diplomaCollege}>
                                                            {inp('diplomaCollege', { placeholder: 'Enter polytechnic or institute name' })}
                                                        </Field>
                                                        <Field id="diplomaStream" label="Branch / Specialization" required error={errors.diplomaStream}>
                                                            {selEl('diplomaStream', DIPLOMA_STREAMS, { placeholder: 'Select branch or stream', searchable: true, searchPlaceholder: 'Search stream...' })}
                                                        </Field>
                                                    </div>
                                                    <div className="cp-row cp-row-3" style={{ marginTop: 10 }}>
                                                        <Field id="diplomaYear" label="Year of Completion" required error={errors.diplomaYear}>
                                                            {selEl('diplomaYear', PASSING_YEARS, { placeholder: 'Select year of passing', searchable: true, searchPlaceholder: 'Search year...' })}
                                                        </Field>
                                                        <Field id="diplomaGradeType" label="Grade Type" required error={errors.diplomaGradeType}>
                                                            {selEl('diplomaGradeType', GRADE_TYPES, { placeholder: 'Select grade type' })}
                                                        </Field>
                                                        <Field id="diplomaScore" label="Score" required error={errors.diplomaScore} hint={formData.diplomaGradeType === 'CGPA' ? 'Enter CGPA score' : (formData.diplomaGradeType === 'Marks' ? 'Enter total marks obtained' : 'Enter percentage score')}>
                                                            {inp('diplomaScore', { type: 'number', step: 'any', placeholder: formData.diplomaGradeType === 'CGPA' ? 'Enter CGPA' : (formData.diplomaGradeType === 'Marks' ? 'Enter marks' : 'Enter percentage') })}
                                                        </Field>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* 4. Graduation (Bachelor's Degree) */}
                                        <div className="cp-qual-card">
                                            <div className="cp-qual-hd">
                                                <div className="cp-qual-title-wrap">
                                                    <div className="cp-qual-title">
                                                        <GraduationCap size={16} color="#16a34a" /> Graduation (Bachelor's Degree)
                                                    </div>
                                                </div>
                                                <label className="cp-qual-toggle">
                                                    <input
                                                        type="checkbox"
                                                        name="hasGraduation"
                                                        checked={formData.hasGraduation}
                                                        onChange={(e) => setField('hasGraduation', e.target.checked)}
                                                        style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }}
                                                    />
                                                    <span>Completed / Pursuing Graduation</span>
                                                </label>
                                            </div>
                                            {formData.hasGraduation && (
                                                <>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="gradDegree" label="Degree / Course" required error={errors.gradDegree}>
                                                            {selEl('gradDegree', GRAD_DEGREES, { placeholder: 'Select degree or course', searchable: true, searchPlaceholder: 'Search degree / course...' })}
                                                        </Field>
                                                        <Field id="gradCollege" label="College / University Name" required error={errors.gradCollege}>
                                                            {inp('gradCollege', { placeholder: 'Enter college or university name' })}
                                                        </Field>
                                                    </div>
                                                    <div className="cp-row cp-row-auto" style={{ marginTop: 10 }}>
                                                        <Field id="gradStatus" label="Degree Status" required error={errors.gradStatus}>
                                                            {pill('gradStatus', ['Completed', 'Pursuing'])}
                                                        </Field>
                                                        <Field id="gradYear" label="Year of Completion" required error={errors.gradYear}>
                                                            {selEl('gradYear', PASSING_YEARS, { placeholder: 'Select year of passing', searchable: true, searchPlaceholder: 'Search year...' })}
                                                        </Field>
                                                        <Field id="gradGradeType" label="Grade Type" required error={errors.gradGradeType}>
                                                            {selEl('gradGradeType', GRADE_TYPES, { placeholder: 'Select grade type' })}
                                                        </Field>
                                                        <Field id="gradScore" label="Score" required error={errors.gradScore} hint={formData.gradGradeType === 'CGPA' ? 'Enter CGPA score' : (formData.gradGradeType === 'Marks' ? 'Enter total marks obtained' : 'Enter percentage score')}>
                                                            {inp('gradScore', { type: 'number', step: 'any', placeholder: formData.gradGradeType === 'CGPA' ? 'Enter CGPA' : (formData.gradGradeType === 'Marks' ? 'Enter marks' : 'Enter percentage') })}
                                                        </Field>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* 5. Post Graduation (Master's Degree) */}
                                        <div className="cp-qual-card">
                                            <div className="cp-qual-hd">
                                                <div className="cp-qual-title-wrap">
                                                    <div className="cp-qual-title">
                                                        <GraduationCap size={16} color="#7c3aed" /> Post Graduation (Master's Degree)
                                                    </div>
                                                    <span className="cp-qual-badge-opt">Optional</span>
                                                </div>
                                                <label className="cp-qual-toggle">
                                                    <input
                                                        type="checkbox"
                                                        name="hasPostGraduation"
                                                        checked={formData.hasPostGraduation}
                                                        onChange={(e) => setField('hasPostGraduation', e.target.checked)}
                                                        style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }}
                                                    />
                                                    <span>Completed / Pursuing Post Graduation</span>
                                                </label>
                                            </div>
                                            {formData.hasPostGraduation && (
                                                <>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="pgDegree" label="Master's Degree / Course" required error={errors.pgDegree}>
                                                            {selEl('pgDegree', PG_DEGREES, { placeholder: 'Select master degree or course', searchable: true, searchPlaceholder: 'Search PG degree / course...' })}
                                                        </Field>
                                                        <Field id="pgCollege" label="College / University Name" required error={errors.pgCollege}>
                                                            {inp('pgCollege', { placeholder: 'Enter college or university name' })}
                                                        </Field>
                                                    </div>
                                                    <div className="cp-row cp-row-auto" style={{ marginTop: 10 }}>
                                                        <Field id="pgStatus" label="Status" required error={errors.pgStatus}>
                                                            {pill('pgStatus', ['Completed', 'Pursuing'])}
                                                        </Field>
                                                        <Field id="pgYear" label="Year of Completion" required error={errors.pgYear}>
                                                            {selEl('pgYear', PASSING_YEARS, { placeholder: 'Select year of passing', searchable: true, searchPlaceholder: 'Search year...' })}
                                                        </Field>
                                                        <Field id="pgGradeType" label="Grade Type" required error={errors.pgGradeType}>
                                                            {selEl('pgGradeType', GRADE_TYPES, { placeholder: 'Select grade type' })}
                                                        </Field>
                                                        <Field id="pgScore" label="Score" required error={errors.pgScore} hint={formData.pgGradeType === 'CGPA' ? 'Enter CGPA score' : (formData.pgGradeType === 'Marks' ? 'Enter total marks obtained' : 'Enter percentage score')}>
                                                            {inp('pgScore', { type: 'number', step: 'any', placeholder: formData.pgGradeType === 'CGPA' ? 'Enter CGPA' : (formData.pgGradeType === 'Marks' ? 'Enter marks' : 'Enter percentage') })}
                                                        </Field>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="cp-note">
                                            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            <span>Please ensure academic marks and years match your final mark sheets &amp; degree certificates.</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 4: WORK EXPERIENCE ── */}
                                {currentStep === 4 && (
                                    <div className="cp-section">
                                        <div className="cp-section-hd">
                                            <div className="cp-section-icon"><Briefcase size={16} /></div>
                                            <div>
                                                <div className="cp-section-label">Professional Experience &amp; Compensation</div>
                                                <div className="cp-section-sub">Company details, total tenure, salary expectations &amp; notice period</div>
                                            </div>
                                        </div>

                                        {/* Experience Type Toggle */}
                                        <div style={{ marginBottom: 20 }}>
                                            <Field label="Candidate Type" required>
                                                <div className="cp-pills">
                                                    <button
                                                        type="button"
                                                        className={'cp-pill' + (formData.candidateType === 'Fresher' ? ' on' : '')}
                                                        onClick={() => handleCandidateTypeChange('Fresher')}
                                                    >
                                                        {formData.candidateType === 'Fresher' && <Check size={13} />}
                                                        Fresher / Entry Level
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={'cp-pill' + (formData.candidateType === 'Experienced' ? ' on' : '')}
                                                        onClick={() => handleCandidateTypeChange('Experienced')}
                                                    >
                                                        {formData.candidateType === 'Experienced' && <Check size={13} />}
                                                        Experienced Professional
                                                    </button>
                                                </div>
                                            </Field>
                                        </div>

                                        {/* Dynamic Form as per Candidate Type */}
                                        {formData.candidateType === 'Experienced' ? (
                                            <>
                                                {/* Current Employment */}
                                                <div className="cp-addr-box" style={{ background: '#ffffff', marginBottom: 18 }}>
                                                    <div className="cp-addr-hd">
                                                        <div className="cp-addr-title">
                                                            <Building2 size={14} color="#16a34a" /> Current / Most Recent Employment
                                                        </div>
                                                    </div>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="currentCompany" label="Company / Employer Name" required error={errors.currentCompany}>
                                                            {inp('currentCompany', { placeholder: 'Enter company name' })}
                                                        </Field>
                                                        <Field id="currentRole" label="Designation / Job Role / Position" required error={errors.currentRole}>
                                                            {inp('currentRole', { placeholder: 'Enter designation / job role' })}
                                                        </Field>
                                                    </div>
                                                </div>

                                                {/* Total Work Experience */}
                                                <div className="cp-addr-box" style={{ background: '#ffffff', marginBottom: 18 }}>
                                                    <div className="cp-addr-hd">
                                                        <div className="cp-addr-title">
                                                            <Clock size={14} color="#16a34a" /> Total Work Experience
                                                        </div>
                                                    </div>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="totalExpYears" label="Total Experience (Years)" required>
                                                            {selEl('totalExpYears', EXP_YEARS_OPTIONS.filter(opt => opt !== '0 Years (Fresher)'), { placeholder: 'Select experience years' })}
                                                        </Field>
                                                        <Field id="totalExpMonths" label="Total Experience (Months)" required>
                                                            {selEl('totalExpMonths', EXP_MONTHS_OPTIONS, { placeholder: 'Select experience months' })}
                                                        </Field>
                                                    </div>
                                                </div>

                                                {/* Compensation & Availability */}
                                                <div className="cp-addr-box" style={{ background: '#ffffff', marginBottom: 18 }}>
                                                    <div className="cp-addr-hd">
                                                        <div className="cp-addr-title">
                                                            <IndianRupee size={14} color="#16a34a" /> Compensation &amp; Availability
                                                        </div>
                                                    </div>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="currentSalary" label="Current In-Hand Salary (₹ / Month)" required error={errors.currentSalary} hint="Enter monthly in-hand salary amount">
                                                            <div className="cp-phone-wrap">
                                                                <span className="cp-phone-cc">₹</span>
                                                                {inp('currentSalary', { placeholder: 'Enter current monthly salary' })}
                                                            </div>
                                                        </Field>
                                                        <Field id="expectedSalary" label="Expected Salary (₹ / Month)" required error={errors.expectedSalary} hint="Enter expected monthly salary amount">
                                                            <div className="cp-phone-wrap">
                                                                <span className="cp-phone-cc">₹</span>
                                                                {inp('expectedSalary', { placeholder: 'Enter expected monthly salary' })}
                                                            </div>
                                                        </Field>
                                                    </div>

                                                    <div className="cp-row cp-row-2" style={{ marginTop: 12 }}>
                                                        <Field id="noticePeriod" label="Notice Period" required error={errors.noticePeriod}>
                                                            {selEl('noticePeriod', NOTICE_PERIODS, { placeholder: 'Select notice period' })}
                                                        </Field>
                                                        <Field id="keySkills" label="Key Skills / Core Competencies" hint="Enter skills separated by commas">
                                                            {inp('keySkills', { placeholder: 'Enter skills separated by commas' })}
                                                        </Field>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {/* Compensation & Availability for Freshers */}
                                                <div className="cp-addr-box" style={{ background: '#ffffff', marginBottom: 18 }}>
                                                    <div className="cp-addr-hd">
                                                        <div className="cp-addr-title">
                                                            <IndianRupee size={14} color="#16a34a" /> Compensation &amp; Availability
                                                        </div>
                                                    </div>
                                                    <div className="cp-row cp-row-2">
                                                        <Field id="expectedSalary" label="Expected Salary (₹ / Month)" required error={errors.expectedSalary} hint="Enter expected monthly salary amount">
                                                            <div className="cp-phone-wrap">
                                                                <span className="cp-phone-cc">₹</span>
                                                                {inp('expectedSalary', { placeholder: 'Enter expected monthly salary' })}
                                                            </div>
                                                        </Field>
                                                        <Field id="noticePeriod" label="Availability / Joining Timeline" required error={errors.noticePeriod}>
                                                            {selEl('noticePeriod', NOTICE_PERIODS, { placeholder: 'Select availability / notice period' })}
                                                        </Field>
                                                    </div>

                                                    <div className="cp-row" style={{ marginTop: 12 }}>
                                                        <Field id="keySkills" label="Key Skills / Core Competencies" hint="Enter skills separated by commas">
                                                            {inp('keySkills', { placeholder: 'Enter skills separated by commas' })}
                                                        </Field>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Resume / CV Upload Section (Required) */}
                                        <div className="cp-addr-box" style={{ background: '#ffffff', marginBottom: 18, border: (errors.resumeUrl || resumeUploadError) ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}>
                                            <div className="cp-addr-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="cp-addr-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <UploadCloud size={16} color="#16a34a" />
                                                    <span>Upload Resume / Curriculum Vitae</span>
                                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>PDF, JPEG</span>
                                                    <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#166534', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>Max 5MB</span>
                                                </div>
                                            </div>

                                            <div style={{ padding: '4px 0' }}>
                                                <p style={{ fontSize: '13px', color: '#334155', fontWeight: 600, margin: '0 0 10px' }}>
                                                    Please upload updated resume
                                                </p>

                                                {formData.resumeUrl ? (
                                                    <div style={{
                                                        background: '#f0fdf4',
                                                        border: '1.5px solid #86efac',
                                                        borderRadius: '12px',
                                                        padding: '16px 20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '14px',
                                                        transition: 'all 0.2s ease'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: '44px',
                                                                height: '44px',
                                                                borderRadius: '10px',
                                                                background: '#dcfce7',
                                                                color: '#166534',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                <FileText size={22} />
                                                            </div>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{
                                                                    fontSize: '14px',
                                                                    fontWeight: 700,
                                                                    color: '#0f172a',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}>
                                                                    {formData.resumeFileName || 'Uploaded Resume'}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>{formData.resumeFileSize || 'Ready'}</span>
                                                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }}></span>
                                                                    <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <CheckCircle2 size={12} /> Uploaded Successfully
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => resumeInputRef.current?.click()}
                                                                style={{
                                                                    border: '1px solid #cbd5e1',
                                                                    background: '#fff',
                                                                    color: '#334155',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px'
                                                                }}
                                                            >
                                                                <RefreshCw size={12} /> Replace
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleRemoveResume}
                                                                style={{
                                                                    border: '1px solid #fecdd3',
                                                                    background: '#fff1f2',
                                                                    color: '#e11d48',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px'
                                                                }}
                                                                title="Remove resume"
                                                            >
                                                                <Trash2 size={13} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => resumeInputRef.current?.click()}
                                                        style={{
                                                            border: (errors.resumeUrl || resumeUploadError) ? '2px dashed #ef4444' : '2px dashed #94a3b8',
                                                            borderRadius: '12px',
                                                            padding: '28px 20px',
                                                            textAlign: 'center',
                                                            background: (errors.resumeUrl || resumeUploadError) ? '#fef2f2' : '#fafafa',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!errors.resumeUrl && !resumeUploadError) {
                                                                e.currentTarget.style.borderColor = '#16a34a';
                                                                e.currentTarget.style.background = '#f0fdf4';
                                                            }
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!errors.resumeUrl && !resumeUploadError) {
                                                                e.currentTarget.style.borderColor = '#94a3b8';
                                                                e.currentTarget.style.background = '#fafafa';
                                                            }
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '48px',
                                                            height: '48px',
                                                            borderRadius: '50%',
                                                            background: '#ecfdf5',
                                                            color: '#16a34a',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            marginBottom: '10px'
                                                        }}>
                                                            <UploadCloud size={24} />
                                                        </div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                                                            Click to browse or drag &amp; drop your resume here
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                            Accepted formats: <strong style={{ color: '#0f172a' }}>PDF (.pdf)</strong> or <strong style={{ color: '#0f172a' }}>JPEG (.jpeg, .jpg)</strong> · Maximum size: <strong style={{ color: '#0f172a' }}>5 MB</strong>
                                                        </div>
                                                    </div>
                                                )}

                                                <input
                                                    ref={resumeInputRef}
                                                    type="file"
                                                    accept=".pdf,.jpeg,.jpg,application/pdf,image/jpeg"
                                                    style={{ display: 'none' }}
                                                    onChange={handleResumeChange}
                                                />

                                                {(resumeUploadError || errors.resumeUrl) && (
                                                    <div style={{
                                                        marginTop: '10px',
                                                        fontSize: '12px',
                                                        color: '#dc2626',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontWeight: 600
                                                    }}>
                                                        <AlertCircle size={14} />
                                                        <span>{resumeUploadError || errors.resumeUrl}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="cp-note">
                                            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            <span>Please provide accurate compensation and notice period details for prompt interview scheduling.</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 5: REVIEW & SUBMIT ── */}
                                {currentStep === 5 && (
                                    <div className="cp-section">
                                        <div className="cp-section-hd">
                                            <div className="cp-section-icon"><FileText size={16} /></div>
                                            <div>
                                                <div className="cp-section-label">Review Application Details</div>
                                                <div className="cp-section-sub">Please review your complete profile before final submission</div>
                                            </div>
                                        </div>

                                        {submitError && (
                                            <div style={{
                                                background: '#fef2f2',
                                                border: '1px solid #fecaca',
                                                borderRadius: '12px',
                                                padding: '14px 18px',
                                                color: '#b91c1c',
                                                fontSize: '13.5px',
                                                fontWeight: 600,
                                                marginBottom: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}>
                                                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                                                <span>{submitError}</span>
                                            </div>
                                        )}

                                        {/* 1. Personal Info Review */}
                                        <div className="cp-review-box">
                                            <div className="cp-review-hd">
                                                <div className="cp-review-title"><User size={14} color="#7c3aed" /> 1. Personal Information</div>
                                                <button type="button" className="cp-review-edit" onClick={() => { setCurrentStep(1); scrollToTop(); }}>
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                            </div>
                                            <div className="cp-review-grid">
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Full Name</span>
                                                    <span className="cp-review-val">{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">{formData.guardianRelation || 'Guardian'}'s Name</span>
                                                    <span className="cp-review-val">{formData.guardianSalutation} {formData.guardianName || '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Date of Birth</span>
                                                    <span className="cp-review-val">{formData.dob || '—'} {age !== null ? `(${age} yrs)` : ''}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Gender</span>
                                                    <span className="cp-review-val">{formData.gender || '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Marital Status</span>
                                                    <span className="cp-review-val">{formData.maritalStatus || '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Nationality</span>
                                                    <span className="cp-review-val">{formData.nationality || '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Religion</span>
                                                    <span className="cp-review-val">{formData.religion || '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Category / Caste</span>
                                                    <span className="cp-review-val">{formData.caste || '—'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Contact & Address Review */}
                                        <div className="cp-review-box">
                                            <div className="cp-review-hd">
                                                <div className="cp-review-title"><MapPin size={14} color="#7c3aed" /> 2. Contact &amp; Address Details</div>
                                                <button type="button" className="cp-review-edit" onClick={() => { setCurrentStep(2); scrollToTop(); }}>
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                            </div>
                                            <div className="cp-review-grid">
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Mobile Number</span>
                                                    <span className="cp-review-val">+91 {formData.phone}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Alternate Phone</span>
                                                    <span className="cp-review-val">{formData.altPhone ? `+91 ${formData.altPhone}` : '—'}</span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Email Address</span>
                                                    <span className="cp-review-val">{formData.email}</span>
                                                </div>
                                                <div className="cp-review-item" style={{ gridColumn: 'span 2' }}>
                                                    <span className="cp-review-key">Current Address</span>
                                                    <span className="cp-review-val">{formData.currentStreet}, {formData.currentCity}, {formData.currentState} - {formData.currentZip}, {formData.currentCountry}</span>
                                                </div>
                                                <div className="cp-review-item" style={{ gridColumn: 'span 2' }}>
                                                    <span className="cp-review-key">Permanent Address</span>
                                                    <span className="cp-review-val">
                                                        {formData.isAddressSame
                                                            ? 'Same as Current Address'
                                                            : `${formData.permanentStreet}, ${formData.permanentCity}, ${formData.permanentState} - ${formData.permanentZip}, ${formData.permanentCountry}`
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. Educational Qualifications Review */}
                                        <div className="cp-review-box">
                                            <div className="cp-review-hd">
                                                <div className="cp-review-title"><GraduationCap size={14} color="#7c3aed" /> 3. Educational Qualifications</div>
                                                <button type="button" className="cp-review-edit" onClick={() => { setCurrentStep(3); scrollToTop(); }}>
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {/* 10th */}
                                                <div className="cp-review-qual-row">
                                                    <div className="cp-review-qual-badge">10th Standard</div>
                                                    <div className="cp-review-grid" style={{ flex: 1 }}>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">School</span>
                                                            <span className="cp-review-val">{formData.tenthSchool || '—'}</span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Board</span>
                                                            <span className="cp-review-val">{formData.tenthBoard || '—'}</span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Passing Year</span>
                                                            <span className="cp-review-val">{formData.tenthYear || '—'}</span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Grade &amp; Score</span>
                                                            <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                                {formatScoreReview(formData.tenthScore, formData.tenthGradeType, formData.tenthMarks)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 12th */}
                                                {formData.hasTwelfth && (
                                                    <div className="cp-review-qual-row">
                                                        <div className="cp-review-qual-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>12th Standard</div>
                                                        <div className="cp-review-grid" style={{ flex: 1 }}>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">School / Jr College</span>
                                                                <span className="cp-review-val">{formData.twelfthSchool || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Board &amp; Stream</span>
                                                                <span className="cp-review-val">{formData.twelfthBoard} ({formData.twelfthStream})</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Passing Year</span>
                                                                <span className="cp-review-val">{formData.twelfthYear || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Grade &amp; Score</span>
                                                                <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                                    {formatScoreReview(formData.twelfthScore, formData.twelfthGradeType, formData.twelfthMarks)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Diploma */}
                                                {formData.hasDiploma && (
                                                    <div className="cp-review-qual-row">
                                                        <div className="cp-review-qual-badge" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>Diploma</div>
                                                        <div className="cp-review-grid" style={{ flex: 1 }}>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Institute</span>
                                                                <span className="cp-review-val">{formData.diplomaCollege || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Stream</span>
                                                                <span className="cp-review-val">{formData.diplomaStream || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Passing Year</span>
                                                                <span className="cp-review-val">{formData.diplomaYear || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Grade &amp; Score</span>
                                                                <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                                    {formatScoreReview(formData.diplomaScore, formData.diplomaGradeType, formData.diplomaMarks)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Graduation */}
                                                {formData.hasGraduation && (
                                                    <div className="cp-review-qual-row">
                                                        <div className="cp-review-qual-badge" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>Graduation</div>
                                                        <div className="cp-review-grid" style={{ flex: 1 }}>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Degree &amp; Status</span>
                                                                <span className="cp-review-val">{formData.gradDegree} ({formData.gradStatus})</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">University / College</span>
                                                                <span className="cp-review-val">{formData.gradCollege || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Completion Year</span>
                                                                <span className="cp-review-val">{formData.gradYear || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Grade &amp; Score</span>
                                                                <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                                    {formatScoreReview(formData.gradScore, formData.gradGradeType, formData.gradMarks)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Post Graduation */}
                                                {formData.hasPostGraduation && (
                                                    <div className="cp-review-qual-row">
                                                        <div className="cp-review-qual-badge" style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}>Post Graduation</div>
                                                        <div className="cp-review-grid" style={{ flex: 1 }}>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Degree &amp; Status</span>
                                                                <span className="cp-review-val">{formData.pgDegree} ({formData.pgStatus})</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">University / College</span>
                                                                <span className="cp-review-val">{formData.pgCollege || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Completion Year</span>
                                                                <span className="cp-review-val">{formData.pgYear || '—'}</span>
                                                            </div>
                                                            <div className="cp-review-item">
                                                                <span className="cp-review-key">Grade &amp; Score</span>
                                                                <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                                    {formatScoreReview(formData.pgScore, formData.pgGradeType, formData.pgMarks)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 4. Work Experience Review */}
                                        <div className="cp-review-box">
                                            <div className="cp-review-hd">
                                                <div className="cp-review-title"><Briefcase size={14} color="#7c3aed" /> 4. Professional Experience &amp; Compensation</div>
                                                <button type="button" className="cp-review-edit" onClick={() => { setCurrentStep(4); scrollToTop(); }}>
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                            </div>
                                            <div className="cp-review-grid">
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Candidate Type</span>
                                                    <span className="cp-review-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            background: formData.candidateType === 'Experienced' ? '#dcfce7' : '#e0f2fe',
                                                            color: formData.candidateType === 'Experienced' ? '#15803d' : '#0369a1',
                                                            border: `1px solid ${formData.candidateType === 'Experienced' ? '#bbf7d0' : '#bae6fd'}`
                                                        }}>
                                                            {formData.candidateType === 'Experienced' ? 'Experienced Professional' : 'Fresher / Entry Level'}
                                                        </span>
                                                    </span>
                                                </div>
                                                {formData.candidateType === 'Experienced' ? (
                                                    <>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Current / Last Company</span>
                                                            <span className="cp-review-val">{formData.currentCompany || '—'}</span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Role / Position</span>
                                                            <span className="cp-review-val">{formData.currentRole || '—'}</span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Total Experience</span>
                                                            <span className="cp-review-val">
                                                                {formData.totalExpYears} {formData.totalExpMonths && formData.totalExpMonths !== '0 Months' ? `, ${formData.totalExpMonths}` : ''}
                                                            </span>
                                                        </div>
                                                        <div className="cp-review-item">
                                                            <span className="cp-review-key">Current In-Hand Salary</span>
                                                            <span className="cp-review-val" style={{ color: '#0f172a' }}>
                                                                {formatSalaryReview(formData.currentSalary)}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="cp-review-item">
                                                        <span className="cp-review-key">Total Experience</span>
                                                        <span className="cp-review-val">0 Years</span>
                                                    </div>
                                                )}
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">Expected Salary</span>
                                                    <span className="cp-review-val" style={{ color: '#16a34a', fontWeight: 700 }}>
                                                        {formatSalaryReview(formData.expectedSalary)}
                                                    </span>
                                                </div>
                                                <div className="cp-review-item">
                                                    <span className="cp-review-key">{formData.candidateType === 'Fresher' ? 'Availability' : 'Notice Period'}</span>
                                                    <span className="cp-review-val">{formData.noticePeriod || '—'}</span>
                                                </div>
                                                {formData.keySkills && (
                                                    <div className="cp-review-item" style={{ gridColumn: 'span 2' }}>
                                                        <span className="cp-review-key" style={{ marginBottom: 6 }}>Key Skills &amp; Competencies</span>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {formData.keySkills.split(',').map(s => s.trim()).filter(Boolean).map((skill, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        fontSize: '12px',
                                                                        fontWeight: 600,
                                                                        padding: '4px 12px',
                                                                        borderRadius: '9999px',
                                                                        backgroundColor: '#f0fdf4',
                                                                        color: '#15803d',
                                                                        border: '1px solid #bbf7d0',
                                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                                    }}
                                                                >
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="cp-review-item" style={{ gridColumn: 'span 2' }}>
                                                    <span className="cp-review-key">Uploaded Resume</span>
                                                    <span className="cp-review-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <FileText size={15} color="#16a34a" />
                                                        <strong style={{ color: '#0f172a' }}>{formData.resumeFileName || 'Resume Attached'}</strong>
                                                        {formData.resumeFileSize && <span style={{ fontSize: '11.5px', color: '#64748b' }}>({formData.resumeFileSize})</span>}
                                                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, border: '1px solid #bbf7d0' }}>Attached</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cp-note">
                                            <CheckCircle size={13} style={{ flexShrink: 0, marginTop: 1, color: '#16a34a' }} />
                                            <span>By clicking Submit Application below, you confirm that all information provided is accurate and authentic.</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── MULTI-STEP NAVIGATION & SUBMIT BAR ── */}
                                <div className="cp-submit-bar">
                                    {currentStep === 1 && (
                                        <>
                                            <div className="cp-submit-privacy">
                                                <Shield size={13} color="#71717a" />
                                                Encrypted &amp; confidential application.
                                            </div>
                                            <button type="button" onClick={handleContinueStep1} className="cp-btn-primary">
                                                Continue <ArrowRight size={15} />
                                            </button>
                                        </>
                                    )}

                                    {currentStep === 2 && (
                                        <>
                                            <div className="cp-submit-privacy">
                                                <Shield size={13} color="#71717a" />
                                                All contact details are kept strictly confidential.
                                            </div>
                                            <button type="button" onClick={handleContinueStep2} className="cp-btn-primary">
                                                Continue <ArrowRight size={15} />
                                            </button>
                                        </>
                                    )}

                                    {currentStep === 3 && (
                                        <>
                                            <div className="cp-submit-privacy">
                                                <GraduationCap size={13} color="#16a34a" />
                                                Academic records verified.
                                            </div>
                                            <button type="button" onClick={handleContinueStep3} className="cp-btn-primary">
                                                Continue <ArrowRight size={15} />
                                            </button>
                                        </>
                                    )}

                                    {currentStep === 4 && (
                                        <>
                                            <div className="cp-submit-privacy">
                                                <Briefcase size={13} color="#16a34a" />
                                                Professional experience &amp; compensation verified.
                                            </div>
                                            <button type="button" onClick={handleContinueStep4} className="cp-btn-primary">
                                                Continue <ArrowRight size={15} />
                                            </button>
                                        </>
                                    )}

                                    {currentStep === 5 && (
                                        <>
                                            <div className="cp-submit-privacy">
                                                <CheckCircle2 size={13} color="#16a34a" />
                                                Ready for submission to talent acquisition team.
                                            </div>
                                            <button type="submit" disabled={submitting} className="cp-btn-primary">
                                                {submitting ? <><RefreshCw size={14} className="cp-spin" /> Submitting Application…</> : <>Submit Application <Send size={14} /></>}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </form>
                        </div>{/* /cp-form-container */}

                        <div className="cp-footer" style={{ lineHeight: 1.6 }}>
                            <div>© {new Date().getFullYear()} Bhoomi Techzone Pvt. Ltd. · All Rights Reserved</div>
                            <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
                                <a href="mailto:hr@bhoomitechzone.in" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Mail size={12} color="#16a34a" /> hr@bhoomitechzone.in
                                </a>
                                <span style={{ color: '#cbd5e1' }}>·</span>
                                <a href="tel:+919821724181" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Phone size={12} color="#16a34a" /> +91 98217 24181
                                </a>
                                <span style={{ color: '#cbd5e1' }}>·</span>
                                <a href="tel:+919211947852" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <Phone size={12} color="#16a34a" /> +91 92119 47852
                                </a>
                            </div>
                        </div>
                    </div>{/* /cp-main */}

                </div>
            )}
        </div>
    );
};

export default CareersApply;
