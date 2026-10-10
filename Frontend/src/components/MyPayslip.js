import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Payroll.css';

function MyPayslip() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('bank');
    const [employeePayslip, setEmployeePayslip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [salaryRules, setSalaryRules] = useState([]);

    // Bank Details State
    const [bankDetails, setBankDetails] = useState(null);
    const [bankFormData, setBankFormData] = useState({
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        accountHolderName: '',
        panNumber: '',
        upiId: ''
    });
    const [qrCodeFile, setQrCodeFile] = useState(null);
    const [qrCodePreview, setQrCodePreview] = useState(null);
    const [savingBank, setSavingBank] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [showDownloadRestrictionModal, setShowDownloadRestrictionModal] = useState(false);
    const [showAccountNum, setShowAccountNum] = useState(false);
    const [showPanNum, setShowPanNum] = useState(false);
    const [showAadharNum, setShowAadharNum] = useState(false);

    // Attendance Breakdown Modal State
    const [showDetailedAttendanceModal, setShowDetailedAttendanceModal] = useState(false);
    const [detailedAttendanceData, setDetailedAttendanceData] = useState(null);
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    // Fetch detailed attendance for employee
    const handleViewAttendance = async () => {
        const empId = employeePayslip?.employee?._id || employeePayslip?.employee || user?._id;
        if (!empId) {
            alert('Employee information not available');
            return;
        }
        setLoadingAttendance(true);
        setShowDetailedAttendanceModal(true);
        try {
            const response = await api.get(`/payroll/employee-attendance/${empId}`, {
                params: { month: selectedMonth, year: selectedYear, _t: Date.now() }
            });
            setDetailedAttendanceData(response.data);
        } catch (error) {
            console.error('Error fetching detailed attendance:', error);
            alert(error.response?.data?.message || 'Error loading attendance details. Please try again.');
            setShowDetailedAttendanceModal(false);
        } finally {
            setLoadingAttendance(false);
        }
    };

    // Fetch salary rules dynamically
    const fetchRules = useCallback(async () => {
        try {
            const response = await api.get('/salary-rules');
            if (response.data) {
                setSalaryRules(response.data);
            }
        } catch (error) {
            console.error('Error fetching rules:', error);
        }
    }, []);

    // Fetch employee's bank details
    const fetchBankDetails = useCallback(async () => {
        try {
            const response = await api.get('/users/my-bank-details');
            if (response.data) {
                setBankDetails(response.data);
                setBankFormData({
                    bankName: response.data.bankName || '',
                    accountNumber: response.data.accountNumber || '',
                    ifscCode: response.data.ifscCode || '',
                    accountHolderName: response.data.accountHolderName || '',
                    panNumber: response.data.panNumber || '',
                    upiId: response.data.upiId || ''
                });
            }
        } catch (error) {
            console.error('Error fetching bank details:', error);
        }
    }, []);

    // Save bank details
    const validateBankForm = () => {
        const errors = {};

        if (!bankFormData.bankName.trim()) {
            errors.bankName = 'Bank name is required';
        }

        if (!bankFormData.accountNumber.trim()) {
            errors.accountNumber = 'Account number is required';
        } else if (!/^\d{9,18}$/.test(bankFormData.accountNumber.trim())) {
            errors.accountNumber = 'Account number must be 9-18 digits';
        }

        if (!bankFormData.ifscCode.trim()) {
            errors.ifscCode = 'IFSC code is required';
        } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankFormData.ifscCode.trim())) {
            errors.ifscCode = 'Invalid IFSC code format (e.g., SBIN0001234)';
        }

        if (!bankFormData.accountHolderName.trim()) {
            errors.accountHolderName = 'Account holder name is required';
        } else if (bankFormData.accountHolderName.trim().length < 3) {
            errors.accountHolderName = 'Name must be at least 3 characters';
        }

        if (bankFormData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(bankFormData.panNumber.trim())) {
            errors.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';
        }

        if (bankFormData.upiId && !/^[\w.-]+@[\w]+$/.test(bankFormData.upiId.trim())) {
            errors.upiId = 'Invalid UPI ID format (e.g., name@upi)';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveBankDetails = async () => {
        if (!validateBankForm()) {
            return;
        }

        setSavingBank(true);
        try {
            // First save bank details
            await api.put('/users/my-bank-details', bankFormData);

            // Then upload QR code if a new file was selected
            if (qrCodeFile) {
                const formData = new FormData();
                formData.append('qrCode', qrCodeFile);
                await api.post('/users/upload-qr-code', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            alert('✅ Bank details and QR code submitted for HR verification!');
            setShowBankModal(false);
            setQrCodeFile(null);
            setQrCodePreview(null);
            fetchBankDetails();
        } catch (error) {
            console.error('Error saving bank details:', error);
            alert('Error saving bank details. Please try again.');
        } finally {
            setSavingBank(false);
        }
    };

    const openBankModal = () => {
        setFormErrors({});
        setQrCodeFile(null);
        setQrCodePreview(null);
        setShowBankModal(true);
    };

    // Handle QR Code Selection (store in state, don't upload yet)
    const handleQRCodeSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload an image file (JPEG, PNG, GIF, or WebP)');
            e.target.value = '';
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            e.target.value = '';
            return;
        }

        // Store file in state
        setQrCodeFile(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setQrCodePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Remove selected QR code from state
    const handleRemoveQRCodeSelection = () => {
        setQrCodeFile(null);
        setQrCodePreview(null);
    };

    // Upload QR Code Immediately (for Bank Details tab view, not modal)
    const handleQRCodeUploadImmediate = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload an image file (JPEG, PNG, GIF, or WebP)');
            e.target.value = '';
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('qrCode', file);

        try {
            setSavingBank(true);
            await api.post('/users/upload-qr-code', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('✅ Payment QR code uploaded successfully!');
            fetchBankDetails();
        } catch (error) {
            console.error('Error uploading QR code:', error);
            alert('Error uploading QR code. Please try again.');
        } finally {
            setSavingBank(false);
        }
    };

    // Delete QR Code
    const handleDeleteQRCode = async () => {
        if (!window.confirm('Are you sure you want to delete your payment QR code?')) return;

        try {
            await api.delete('/users/delete-qr-code');
            alert('QR code deleted successfully!');
            fetchBankDetails();
        } catch (error) {
            console.error('Error deleting QR code:', error);
            alert('Error deleting QR code. Please try again.');
        }
    };

    // Fetch employee's own payslip (with smooth background sync support)
    const fetchEmployeePayslip = useCallback(async (isBackground = false) => {
        if (!isBackground) {
            setLoading(true);
        }
        try {
            const response = await api.get('/payroll/my-payslip', {
                params: {
                    month: selectedMonth,
                    year: selectedYear
                }
            });

            if (response.data) {
                setEmployeePayslip(response.data);
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setEmployeePayslip(null);
            } else if (!isBackground) {
                console.error('Error fetching payslip:', error);
                setEmployeePayslip(null);
            }
        } finally {
            if (!isBackground) {
                setLoading(false);
            }
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchRules();
        fetchEmployeePayslip();
        fetchBankDetails();

        // 1. Instant sync when tab gains focus
        const handleFocus = () => {
            fetchEmployeePayslip(true);
            fetchBankDetails();
        };
        window.addEventListener('focus', handleFocus);

        // 2. Real-time background poll (every 6 seconds) to immediately reflect status changes (e.g. DRAFT -> PAID)
        const pollInterval = setInterval(() => {
            fetchEmployeePayslip(true);
        }, 6000);

        return () => {
            window.removeEventListener('focus', handleFocus);
            clearInterval(pollInterval);
        };
    }, [fetchRules, fetchEmployeePayslip, fetchBankDetails]);

    const Sparkline = ({ data = [0, 0, 0, 0, 0, 0], color = '#6366f1' }) => {
        const w = 84, h = 32;
        const safeData = (data && data.length > 0) ? data : [0, 0, 0, 0, 0, 0];
        const allZero = safeData.every(v => v === 0);
        
        // If all zeros, render a clean straight flat baseline with an endpoint dot (just like Rejected Leaves in Leave metrics)
        if (allZero) {
            const y = 22;
            return (
                <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                    <line x1="0" y1={y} x2={w - 4} y2={y} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx={w - 4} cy={y} r="2.5" fill={color} />
                </svg>
            );
        }

        const max = Math.max(...safeData, 1);
        const min = Math.min(...safeData);
        const range = (max - min) || 1;
        const pts = safeData.map((v, i) => {
            const x = (i / (safeData.length - 1)) * (w - 6);
            const y = h - 6 - ((v - min) / range) * (h - 14);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const fillPts = `0,${h} ${pts} ${w - 6},${h}`;
        const gradId = `spk-${color.replace('#', '')}`;

        return (
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={fillPts} fill={`url(#${gradId})`} />
                <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                {safeData.map((v, i) => {
                    const x = (i / (safeData.length - 1)) * (w - 6);
                    const y = h - 6 - ((v - min) / range) * (h - 14);
                    return i === safeData.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
                })}
            </svg>
        );
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    // Helper for PDF: simple formatting without special symbols
    const formatCurrencyForPDF = (amount) => {
        return (amount || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    };

    const months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    // Download payslip using backend template
    const handleDownloadPayslip = async () => {
        const isPaid = (employeePayslip?.status || '').toLowerCase() === 'paid';
        if (!employeePayslip || !isPaid) {
            setShowDownloadRestrictionModal(true);
            return;
        }

        try {
            const response = await api.get(`/payroll/${employeePayslip._id}/payslip-pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';
            const empName = `${employeePayslip.employee?.firstName || 'Employee'}_${employeePayslip.employee?.lastName || ''}`;
            link.download = `Payslip_${empName}_${monthName}_${selectedYear}.pdf`;
            link.click();
            return;
        } catch (backendError) {
            console.error('Error fetching payslip from backend:', backendError);
        }

        try {
            const doc = new jsPDF();
            const monthName = months.find(m => m.value === selectedMonth)?.label;
            const pw = doc.internal.pageSize.getWidth();
            const mg = 14; // margin
            const cw = pw - mg * 2;
            const GREEN = [67, 160, 71];
            const GREEN_LIGHT = [232, 245, 233];
            const GREEN_DARK = [46, 125, 50];
            const YELLOW = [255, 249, 196];
            const BORDER_CLR = [165, 214, 167];
            const tableGap = 5; // gap between left and right tables

            const employee = employeePayslip.employee || {};
            const sd = employeePayslip.salaryDetails || {};
            const deductions = sd.deductions || {};
            const empName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();

            const fmtAmt = (v) => (Number(v) || 0).toLocaleString('en-IN');

            const numToWords = (num) => {
                if (!num) return 'Zero Rupees Only';
                const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
                const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
                const cvt = (n) => {
                    if (n < 20) return ones[n];
                    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
                    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + cvt(n % 100) : '');
                    if (n < 100000) return cvt(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + cvt(n % 1000) : '');
                    if (n < 10000000) return cvt(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + cvt(n % 100000) : '');
                    return cvt(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + cvt(n % 10000000) : '');
                };
                return cvt(Math.floor(num)) + ' Rupees Only';
            };

            const cell = (x, cy, w, h, text, opts = {}) => {
                if (opts.fill) { doc.setFillColor(...opts.fill); doc.rect(x, cy, w, h, 'F'); }
                doc.setDrawColor(...BORDER_CLR);
                doc.setLineWidth(0.2);
                doc.rect(x, cy, w, h, 'S');
                if (text !== undefined && text !== null) {
                    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
                    doc.setFontSize(opts.fs || 7);
                    doc.setTextColor(...(opts.tc || [0, 0, 0]));
                    const tx = opts.align === 'right' ? x + w - 3 : opts.align === 'center' ? x + w / 2 : x + 3;
                    doc.text(String(text), tx, cy + h / 2 + 1, { align: opts.align || 'left', maxWidth: w - 6 });
                }
            };

            let y = mg;

            // ═══════════ HEADER ═══════════
            doc.setFillColor(...GREEN_LIGHT);
            doc.setDrawColor(...GREEN);
            doc.setLineWidth(0.5);
            doc.rect(mg, y, cw, 30, 'FD');

            try {
                const logoData = await new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => resolve(null);
                    img.src = '/logo.png';
                });
                if (logoData) doc.addImage(logoData, 'PNG', mg + 2, y + 4, 45, 22);
            } catch (e) { /* skip */ }

            // Company info right-aligned
            const rightEdge = mg + cw - 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text('BHOOMI TECHZONE PRIVATE LIMITED', rightEdge, y + 8, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(85, 85, 85);
            doc.text('www.bhoomitechzone.in | hr@bhoomitechzone.in', rightEdge, y + 13, { align: 'right' });
            doc.text('GSTIN: 09AAMCB0572D1ZS | CIN: U55499UP2023PTC191784', rightEdge, y + 17.5, { align: 'right' });
            doc.text('A-43, Sector 63, Noida (201301), Uttar Pradesh', rightEdge, y + 22, { align: 'right' });
            y += 36;

            // ═══════════ TITLE ═══════════
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text(`PAYSLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${selectedYear}`, pw / 2, y + 5, { align: 'center' });
            y += 14;

            // ═══════════ EMPLOYEE DETAILS ═══════════
            doc.setFillColor(...GREEN);
            doc.rect(mg, y, cw, 9, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(255, 255, 255);
            doc.text('EMPLOYEE DETAILS', mg + 5, y + 6);
            y += 9;

            const rh = 9;
            const hw = cw / 2;
            const lbl = hw * 0.40;
            const val = hw * 0.60;

            const joiningDate = employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

            const empRows = [
                ['Employee Code :', employee.employeeId || 'N/A', 'Department :', employee.department || 'N/A'],
                ['Employee Name :', empName, 'Designation :', employee.designation || 'N/A'],
                ["Father's Name :", employee.fatherName || 'N/A', 'Date of Joining :', joiningDate],
                ['Pay Period :', `${monthName} ${selectedYear}`, 'Pay Date :', `${lastDay} ${monthName} ${selectedYear}`],
            ];
            empRows.forEach(r => {
                cell(mg, y, lbl, rh, r[0], { fill: GREEN_LIGHT, bold: true, fs: 6 });
                cell(mg + lbl, y, val, rh, r[1], { bold: true, fs: 6.5 });
                cell(mg + hw, y, lbl, rh, r[2], { fill: GREEN_LIGHT, bold: true, fs: 6 });
                cell(mg + hw + lbl, y, val, rh, r[3], { bold: true, fs: 6.5 });
                y += rh;
            });
            y += 6;

            // ═══════════ ATTENDANCE (left) + SALARY (right) WITH GAP ═══════════
            const leftW = (cw - tableGap) * 0.40;
            const rightW = (cw - tableGap) * 0.60;
            const rightX = mg + leftW + tableGap;
            const secY = y;
            const trh = 10;

            // LEFT HEADER
            doc.setFillColor(...GREEN);
            doc.rect(mg, y, leftW, 9, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text('ATTENDANCE DETAILS', mg + 4, y + 6);

            // RIGHT HEADER
            doc.setFillColor(...GREEN);
            doc.rect(rightX, y, rightW, 9, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text('SALARY DETAILS', rightX + 4, y + 6);
            y += 9;

            // LEFT: attendance rows
            const attLbl = leftW * 0.65;
            const attVal = leftW * 0.35;

            const presentDays = employeePayslip.workingDays?.present || 0;
            const absentDays = employeePayslip.workingDays?.absent || 0;
            const totalDays = employeePayslip.workingDays?.total || 30;
            const weekOff = Math.max(totalDays - presentDays - absentDays, 0);
            const payDays = presentDays + weekOff;

            const attData = [
                ['Present Days', String(presentDays)],
                ['Absent Days', String(absentDays)],
                ['Week Off', String(weekOff)],
                ['Holidays', '0'],
                ['Pay Days', `${payDays} Days`],
            ];
            let attY = y;
            attData.forEach(r => {
                cell(mg, attY, attLbl, trh, r[0], { fs: 7 });
                cell(mg + attLbl, attY, attVal, trh, r[1], { bold: true, fs: 8, align: 'center' });
                attY += trh;
            });
            cell(mg, attY, attLbl, trh, 'Unpaid Days', { fill: YELLOW, fs: 7 });
            cell(mg + attLbl, attY, attVal, trh, absentDays > 0 ? String(absentDays) : '\u2014', { fill: YELLOW, bold: true, fs: 8, align: 'center' });
            attY += trh;

            // RIGHT: salary sub-header + rows
            const salLbl = rightW * 0.65;
            const salVal = rightW * 0.35;

            cell(rightX, y, salLbl, trh, 'Earnings', { fill: GREEN_LIGHT, bold: true, fs: 6.5, tc: GREEN_DARK });
            cell(rightX + salLbl, y, salVal, trh, 'Amount (\u20B9)', { fill: GREEN_LIGHT, bold: true, fs: 6.5, align: 'right', tc: GREEN_DARK });

            const attendanceBonus = sd.bonus || 0;
            const performanceBonus = sd.gratuity || 0;
            const otherDed = (deductions.pf || 0) + (deductions.esi || 0) + (deductions.tax || 0) +
                (deductions.loan || 0) + (deductions.advance || 0) + (deductions.other || 0) +
                (deductions.lossOfPay || 0) + (deductions.lateDeduction || 0) + (deductions.goalDeduction || 0);

            const salData = [
                ['Basic Salary', fmtAmt(sd.basicSalary), false],
                ['Attendance Bonus', fmtAmt(attendanceBonus), false],
                ['Performance Bonus', fmtAmt(performanceBonus), false],
                ['Other Deductions', otherDed > 0 ? fmtAmt(otherDed) : 'NIL', true],
            ];

            let salCY = y + trh;
            salData.forEach(r => {
                cell(rightX, salCY, salLbl, trh, r[0], { fs: 7 });
                cell(rightX + salLbl, salCY, salVal, trh, r[1], {
                    bold: true, fs: 8, align: 'right',
                    tc: r[2] ? (otherDed > 0 ? [220, 38, 38] : GREEN) : [0, 0, 0]
                });
                salCY += trh;
            });
            cell(rightX, salCY, salLbl, trh, 'Net Salary', { fill: GREEN_LIGHT, bold: true, fs: 8, tc: GREEN_DARK });
            cell(rightX + salLbl, salCY, salVal, trh, fmtAmt(sd.netSalary), { fill: GREEN_LIGHT, bold: true, fs: 9, align: 'right', tc: GREEN_DARK });
            salCY += trh;

            y = Math.max(attY, salCY) + 6;

            // ═══════════ NET SALARY IN WORDS ═══════════
            doc.setFillColor(...YELLOW);
            doc.setDrawColor(...BORDER_CLR);
            doc.setLineWidth(0.2);
            doc.rect(mg, y, cw, 10, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(0, 0, 0);
            doc.text('Net Salary (in words): ', mg + 4, y + 6.5);
            doc.setTextColor(198, 40, 40);
            doc.text(numToWords(sd.netSalary || 0), mg + 40, y + 6.5);
            y += 14;

            // ═══════════ NET PAY FOOTER ═══════════
            doc.setFillColor(...GREEN);
            doc.rect(mg, y, cw, 13, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`NET PAY:  \u20B9 ${fmtAmt(sd.netSalary || 0)}/-`, pw - mg - 4, y + 9, { align: 'right' });
            y += 18;

            // ═══════════ FOOTER ═══════════
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(mg, y, pw - mg, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(150, 150, 150);
            doc.text('This is a computer-generated payslip and does not require a signature.', pw / 2, y + 5, { align: 'center' });
            doc.text('For queries, contact HR Department | hr@bhoomitechzone.in', pw / 2, y + 10, { align: 'center' });

            doc.save(`Payslip_${empName.replace(/\s+/g, '_')}_${monthName}_${selectedYear}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating salary receipt. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="payroll-container">
                    <div className="payroll-loading">
                        <p>Loading your payslip...</p>
                    </div>
                </div>
            </div>
        );
    }



    return (
        <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', padding: '20px 24px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Finance Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="5 6 12 3 19 6"></polyline><line x1="4" y1="10" x2="4" y2="21"></line><line x1="20" y1="10" x2="20" y2="21"></line><line x1="8" y1="14" x2="8" y2="17"></line><line x1="12" y1="14" x2="12" y2="17"></line><line x1="16" y1="14" x2="16" y2="17"></line></svg>
                            Finance & Banking
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                            View monthly salary slips, earnings breakdown, and bank account details
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {activeTab === 'payslip' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: '#fff',
                                        fontSize: '12.5px',
                                        fontWeight: 500,
                                        color: '#334155',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: '#fff',
                                        fontSize: '12.5px',
                                        fontWeight: 500,
                                        color: '#334155',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payroll-style Tabs */}
                <div className="payroll-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'bank' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bank')}
                    >
                        Bank Details
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'payslip' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payslip')}
                    >
                        Salary Slip
                    </button>
                </div>

                {/* Bank Details Tab (Read-Only) */}
                {activeTab === 'bank' && (
                    <div>
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Bank Account &amp; Identity Information</h2>
                                <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12.5px' }}>
                                    Your verified banking and identification records on company file
                                </p>
                            </div>

                            {/* Bank Details Card View */}
                            {bankDetails?.bankName ? (
                                (() => {
                                    const rawAcc = bankDetails?.accountNumber || '';
                                    const maskedAcc = rawAcc ? (showAccountNum ? rawAcc : (rawAcc.length > 4 ? `•••• •••• ${rawAcc.slice(-4)}` : rawAcc)) : '-';

                                    const rawPan = bankDetails?.panNumber || user?.panNumber || '';
                                    const maskedPan = rawPan ? (showPanNum ? rawPan : (rawPan.length > 4 ? `••••••${rawPan.slice(-4)}` : rawPan)) : '-';

                                    const rawAadhar = bankDetails?.aadharNumber || user?.aadharNumber || '';
                                    const maskedAadhar = rawAadhar ? (showAadharNum ? rawAadhar : (rawAadhar.length > 4 ? `•••• •••• ${rawAadhar.slice(-4)}` : rawAadhar)) : '-';

                                    const eyeOpenIcon = (
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                    );

                                    const eyeSlashIcon = (
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    );

                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                                            {/* Bank Name */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>Bank Name</div>
                                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{bankDetails.bankName || '-'}</strong>
                                            </div>

                                            {/* Account Holder */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>Account Holder</div>
                                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                                                    {bankDetails.accountHolderName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || '-'}
                                                </strong>
                                            </div>

                                            {/* Account Number with Eye Toggle */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>Account Number</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <strong style={{ color: '#0f172a', fontSize: '13px', letterSpacing: showAccountNum ? '0' : '0.04em' }}>
                                                        {maskedAcc}
                                                    </strong>
                                                    {rawAcc && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAccountNum(!showAccountNum)}
                                                            title={showAccountNum ? "Hide Account Number" : "Show Full Account Number"}
                                                            style={{
                                                                background: '#ffffff',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                padding: '4px 7px',
                                                                cursor: 'pointer',
                                                                color: '#64748b',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                                        >
                                                            {showAccountNum ? eyeSlashIcon : eyeOpenIcon}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* IFSC Code */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>IFSC Code</div>
                                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{bankDetails.ifscCode || '-'}</strong>
                                            </div>

                                            {/* PAN Card with Eye Toggle */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>PAN Card Number</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <strong style={{ color: '#0f172a', fontSize: '13px', letterSpacing: showPanNum ? '0' : '0.04em' }}>
                                                        {maskedPan}
                                                    </strong>
                                                    {rawPan && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPanNum(!showPanNum)}
                                                            title={showPanNum ? "Hide PAN Number" : "Show Full PAN Number"}
                                                            style={{
                                                                background: '#ffffff',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                padding: '4px 7px',
                                                                cursor: 'pointer',
                                                                color: '#64748b',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                                        >
                                                            {showPanNum ? eyeSlashIcon : eyeOpenIcon}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Aadhar Card with Eye Toggle */}
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>Aadhar Card Number</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <strong style={{ color: '#0f172a', fontSize: '13px', letterSpacing: showAadharNum ? '0' : '0.04em' }}>
                                                        {maskedAadhar}
                                                    </strong>
                                                    {rawAadhar && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAadharNum(!showAadharNum)}
                                                            title={showAadharNum ? "Hide Aadhar Number" : "Show Full Aadhar Number"}
                                                            style={{
                                                                background: '#ffffff',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                padding: '4px 7px',
                                                                cursor: 'pointer',
                                                                color: '#64748b',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                                        >
                                                            {showAadharNum ? eyeSlashIcon : eyeOpenIcon}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* UPI ID */}
                                            {bankDetails.upiId && (
                                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginBottom: '4px' }}>UPI ID</div>
                                                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>{bankDetails.upiId}</strong>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="3" y1="21" x2="21" y2="21"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="5 6 12 3 19 6"></polyline><line x1="4" y1="10" x2="4" y2="21"></line><line x1="20" y1="10" x2="20" y2="21"></line></svg>
                                    </div>
                                    <h3 style={{ color: '#1e293b', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>No Bank Details on Record</h3>
                                    <p style={{ color: '#64748b', margin: 0, fontSize: '12.5px' }}>
                                        Please contact HR to update your bank account information.
                                    </p>
                                </div>
                            )}

                            <div style={{ marginTop: '16px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#64748b' }}>
                                <strong style={{ color: '#334155' }}>Note:</strong> Bank and identity details are managed by HR/Accounts for direct salary disbursements.
                            </div>
                        </div>
                    </div>
                )}

                {/* Salary Slip Tab */}
                {activeTab === 'payslip' && !employeePayslip && (
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '48px 20px', textAlign: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <h3 style={{ fontSize: '14px', color: '#0f172a', marginBottom: '4px', fontWeight: 600 }}>No Salary Slip Found</h3>
                        <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Salary slip has not been generated for {months.find(m => m.value === selectedMonth)?.label} {selectedYear} yet.</p>
                    </div>
                )}

                {activeTab === 'payslip' && employeePayslip && (
                    <>
                        {/* Top Metric Cards — Exact Visual Structure with Sparklines */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {/* 1. Gross Salary Card */}
                            <div
                                style={{
                                    background: 'white',
                                    padding: '14px 16px 10px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    transition: 'all 0.3s',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                {/* Soft background watermark circle */}
                                <div style={{
                                    position: 'absolute',
                                    right: '-15px',
                                    bottom: '-15px',
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                                    pointerEvents: 'none'
                                }} />

                                {/* Label row + trend badge */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Gross Salary</div>
                                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
                                        ▲ +0%
                                    </span>
                                </div>

                                {/* Value */}
                                <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                                    {formatCurrency(employeePayslip.salaryDetails?.grossSalary || 0)}
                                </div>

                                {/* Bottom: vs last month + sparkline */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', lineHeight: 1.2 }}>+0%</span>
                                        <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                                    </div>
                                    <Sparkline data={[20, 35, 25, 45, 40, 60]} color="#4f46e5" />
                                </div>
                            </div>

                            {/* 2. Total Deductions Card */}
                            <div
                                style={{
                                    background: 'white',
                                    padding: '14px 16px 10px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    transition: 'all 0.3s',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                {/* Soft background watermark circle */}
                                <div style={{
                                    position: 'absolute',
                                    right: '-15px',
                                    bottom: '-15px',
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
                                    pointerEvents: 'none'
                                }} />

                                {/* Label row + trend badge */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Total Deductions</div>
                                    <span style={{
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '20px',
                                        background: (employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
                                        color: (employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '#dc2626' : '#64748b',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {(employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '▼ -100.0%' : '▼ -0%'}
                                    </span>
                                </div>

                                {/* Value */}
                                <div style={{ fontSize: '26px', fontWeight: 300, color: (employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '#dc2626' : '#1e293b', lineHeight: 1, marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                                    {(employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? `-${formatCurrency(employeePayslip.salaryDetails?.totalDeductions)}` : '₹0.00'}
                                </div>

                                {/* Bottom: vs last month + sparkline */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: (employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '#dc2626' : '#94a3b8', lineHeight: 1.2 }}>
                                            {(employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '-100.0%' : '-0%'}
                                        </span>
                                        <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                                    </div>
                                    <Sparkline data={(employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? [5, 10, 8, 15, 12, 20] : [0, 0, 0, 0, 0, 0]} color="#ef4444" />
                                </div>
                            </div>

                            {/* 3. Net In-Hand Salary Card */}
                            <div
                                style={{
                                    background: 'white',
                                    padding: '14px 16px 10px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    transition: 'all 0.3s',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                {/* Soft background watermark circle */}
                                <div style={{
                                    position: 'absolute',
                                    right: '-15px',
                                    bottom: '-15px',
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)',
                                    pointerEvents: 'none'
                                }} />

                                {/* Label row + trend badge */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Net In-Hand Salary</div>
                                    <span style={{
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '20px',
                                        background: employeePayslip.status === 'paid' ? 'rgba(168,230,61,0.18)' : employeePayslip.status === 'processed' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                                        color: employeePayslip.status === 'paid' ? '#3d7c00' : employeePayslip.status === 'processed' ? '#1d4ed8' : '#b45309',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        ▲ {employeePayslip.status === 'paid' ? 'PAID' : (employeePayslip.status || 'DRAFT').toUpperCase()}
                                    </span>
                                </div>

                                {/* Value */}
                                <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                                    {formatCurrency(employeePayslip.salaryDetails?.netSalary || 0)}
                                </div>

                                {/* Bottom: vs last month + sparkline */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', lineHeight: 1.2 }}>+0%</span>
                                        <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                                    </div>
                                    <Sparkline data={[20, 30, 28, 48, 42, 65]} color="#10b981" />
                                </div>
                            </div>
                        </div>

                        {/* Itemized Salary Slip Breakdown Card */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            {/* Card Header */}
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                        Salary Slip Breakdown — {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                    </h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>Itemized summary of monthly earnings, penalties, and deductions</p>
                                </div>
                                {(() => {
                                    const isPaid = (employeePayslip?.status || '').toLowerCase() === 'paid';
                                    return (
                                        <button
                                            onClick={handleDownloadPayslip}
                                            title={isPaid ? "Download Salary Slip PDF" : "You cannot download the salary slip unless the payroll is generated"}
                                            style={{
                                                padding: '7px 14px',
                                                borderRadius: '8px',
                                                border: isPaid ? 'none' : '1px solid #e2e8f0',
                                                background: isPaid ? 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)' : '#f1f5f9',
                                                color: isPaid ? '#fff' : '#94a3b8',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                cursor: isPaid ? 'pointer' : 'not-allowed',
                                                fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: isPaid ? '0 2px 4px rgba(59,119,94,0.18)' : 'none',
                                                transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => {
                                                if (isPaid) {
                                                    e.currentTarget.style.opacity = '0.92';
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (isPaid) {
                                                    e.currentTarget.style.opacity = '1';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }
                                            }}
                                        >
                                            {isPaid ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            ) : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            )}
                                            <span>Download Salary Slip</span>
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Side-by-side Minimal Tables */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', borderBottom: '1px solid #f1f5f9' }}>
                                {/* Earnings Column */}
                                <div style={{ borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Earnings Description</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</span>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>Basic Salary</span>
                                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(employeePayslip.salaryDetails?.basicSalary || 0)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>House Rent Allowance (HRA)</span>
                                            <span style={{ fontWeight: 600, color: (employeePayslip.salaryDetails?.allowances?.hra > 0) ? '#16a34a' : '#64748b' }}>
                                                {formatCurrency(employeePayslip.salaryDetails?.allowances?.hra || 0)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>Conveyance Allowance</span>
                                            <span style={{ fontWeight: 600, color: (employeePayslip.salaryDetails?.allowances?.conveyance > 0 || employeePayslip.salaryDetails?.allowances?.transport > 0) ? '#16a34a' : '#64748b' }}>
                                                {formatCurrency(employeePayslip.salaryDetails?.allowances?.conveyance || employeePayslip.salaryDetails?.allowances?.transport || 0)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>Food Allowance</span>
                                            <span style={{ fontWeight: 600, color: (employeePayslip.salaryDetails?.allowances?.food > 0) ? '#16a34a' : '#64748b' }}>
                                                {formatCurrency(employeePayslip.salaryDetails?.allowances?.food || 0)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>Additional Bonus</span>
                                            <span style={{ fontWeight: 600, color: (employeePayslip.salaryDetails?.bonus > 0) ? '#16a34a' : '#64748b' }}>
                                                {(employeePayslip.salaryDetails?.bonus > 0) ? `+${formatCurrency(employeePayslip.salaryDetails.bonus)}` : '₹0.00'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Total Gross Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', background: '#f8fafc', fontSize: '12.5px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
                                        <span>Total Gross Earnings</span>
                                        <span>{formatCurrency(employeePayslip.salaryDetails?.grossSalary || 0)}</span>
                                    </div>
                                </div>

                                {/* Deductions Column */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deductions Description</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</span>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        {(() => {
                                            const manualPen = employeePayslip.salaryDetails?.deductions?.penalty || 0;
                                            const latePen = employeePayslip.salaryDetails?.deductions?.lateDeduction || 0;
                                            const halfDayPen = employeePayslip.salaryDetails?.deductions?.halfDayDeduction || 0;
                                            const goalPen = employeePayslip.salaryDetails?.deductions?.goalDeduction || 0;
                                            const totalPen = manualPen + latePen + halfDayPen + goalPen;
                                            return (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                                    <span>Penalty</span>
                                                    <span style={{ fontWeight: 600, color: totalPen > 0 ? '#dc2626' : '#64748b' }}>
                                                        {totalPen > 0 ? `-${formatCurrency(totalPen)}` : '₹0.00'}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: '12.5px', color: '#334155', borderBottom: '1px solid #f8fafc' }}>
                                            <span>Loss of Pay (LOP)</span>
                                            <span style={{ fontWeight: 600, color: (employeePayslip.salaryDetails?.deductions?.lossOfPay > 0) ? '#dc2626' : '#64748b' }}>
                                                {(employeePayslip.salaryDetails?.deductions?.lossOfPay > 0) ? `-${formatCurrency(employeePayslip.salaryDetails.deductions.lossOfPay)}` : '₹0.00'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Total Deductions Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', background: '#f8fafc', fontSize: '12.5px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
                                        <span>Total Deductions</span>
                                        <span style={{ color: (employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? '#dc2626' : '#64748b' }}>
                                            {(employeePayslip.salaryDetails?.totalDeductions || 0) > 0 ? `-${formatCurrency(employeePayslip.salaryDetails?.totalDeductions)}` : '₹0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Summary Bar */}
                            <div style={{ padding: '12px 20px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#166534' }}>Net In-Hand Salary:</span>
                                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#15803d' }}>{formatCurrency(employeePayslip.salaryDetails?.netSalary || 0)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#166534' }}>
                                    {employeePayslip.paidAt && (
                                        <span><strong>Disbursed On:</strong> {new Date(employeePayslip.paidAt).toLocaleDateString('en-IN')}</span>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 600, color: '#166534' }}>Status:</span>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '2px 10px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            background: employeePayslip.status === 'paid' ? '#dcfce7' : employeePayslip.status === 'processed' ? '#dbeafe' : '#fef3c7',
                                            color: employeePayslip.status === 'paid' ? '#15803d' : employeePayslip.status === 'processed' ? '#1d4ed8' : '#b45309',
                                            border: `1px solid ${employeePayslip.status === 'paid' ? '#bbf7d0' : employeePayslip.status === 'processed' ? '#bfdbfe' : '#fde68a'}`
                                        }}>
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: employeePayslip.status === 'paid' ? '#16a34a' : employeePayslip.status === 'processed' ? '#2563eb' : '#d97706'
                                            }} />
                                            {(employeePayslip.status || 'Draft').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Summary Card with 6 Detailed Metrics */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>Attendance Summary</h4>
                                </div>
                                <button
                                    onClick={handleViewAttendance}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 12px',
                                        borderRadius: '999px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: '#f0fdf4',
                                        color: '#15803d',
                                        border: '1px solid #bbf7d0',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    title="View Detailed Monthly Attendance Breakdown"
                                >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span>View Attendance</span>
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '12.5px' }}>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Present Days</div>
                                    <strong style={{ fontSize: '15px', color: '#16a34a' }}>{employeePayslip.workingDays?.present ?? employeePayslip.attendance?.present ?? 0} Days</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Absent Days</div>
                                    <strong style={{ fontSize: '15px', color: (employeePayslip.workingDays?.absent > 0) ? '#dc2626' : '#0f172a' }}>{employeePayslip.workingDays?.absent || 0} Days</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Leaves</div>
                                    <strong style={{ fontSize: '15px', color: '#0369a1' }}>{employeePayslip.workingDays?.leave ?? employeePayslip.workingDays?.leaves ?? employeePayslip.attendance?.leaveDays ?? 0} Days</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Holidays</div>
                                    <strong style={{ fontSize: '15px', color: '#9d174d' }}>{employeePayslip.workingDays?.holiday ?? employeePayslip.workingDays?.holidays ?? employeePayslip.attendance?.holidayDays ?? 0} Days</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Half Days</div>
                                    <strong style={{ fontSize: '15px', color: (employeePayslip.workingDays?.halfDay > 0 || employeePayslip.attendance?.halfDays > 0) ? '#d97706' : '#0f172a' }}>
                                        {employeePayslip.workingDays?.halfDay ?? employeePayslip.workingDays?.halfDays ?? employeePayslip.attendance?.halfDays ?? 0} Days
                                    </strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>Total Working Days</div>
                                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>{employeePayslip.workingDays?.total ?? employeePayslip.attendance?.total ?? 0} Days</strong>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Detailed Attendance Modal — Matching Monthly Payroll View */}
            {showDetailedAttendanceModal && (
                <div
                    className="modal-overlay"
                    style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    onClick={() => setShowDetailedAttendanceModal(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 32px 64px rgba(0,0,0,0.18)', width: '95vw', maxWidth: '1300px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '16px 16px 0 0' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    {detailedAttendanceData ? `${detailedAttendanceData.employee?.name || user?.firstName} — Attendance Details` : 'Loading Attendance...'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailedAttendanceModal(false)}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >×</button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                            {loadingAttendance ? (
                                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>
                                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.4s linear infinite', marginBottom: '12px' }}>
                                        <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                    </svg>
                                    <div>Loading attendance details...</div>
                                </div>
                            ) : detailedAttendanceData ? (
                                <>
                                    {/* Employee & Shift Info Bar */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                                        {[
                                            { label: 'Employee ID', value: detailedAttendanceData.employee?.employeeId || user?.employeeId || 'N/A' },
                                            { label: 'Department', value: detailedAttendanceData.employee?.department || user?.department || 'N/A' },
                                            { label: 'Designation', value: detailedAttendanceData.employee?.designation || user?.designation || 'N/A' },
                                            { label: 'Shift Type', value: detailedAttendanceData.employee?.shift?.name || 'Standard Shift' },
                                            { label: 'Shift Timing', value: detailedAttendanceData.employee?.shift ? `${detailedAttendanceData.employee.shift.startTime} - ${detailedAttendanceData.employee.shift.endTime}` : '09:00 AM - 06:00 PM' },
                                            { label: 'Month / Year', value: `${months.find(m => m.value === (detailedAttendanceData.month || selectedMonth))?.label} ${detailedAttendanceData.year || selectedYear}` },
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{item.label}</div>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Salary & Deductions Breakdown Card */}
                                    {detailedAttendanceData.salaryBreakdown && (
                                        <div style={{ background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div>
                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', display: 'block' }}>Per Day Rate</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#581c87' }}>₹{detailedAttendanceData.salaryBreakdown.perDaySalary?.toLocaleString('en-IN') || 0}/day</span>
                                                </div>
                                                <div style={{ width: '1px', height: '24px', background: '#e9d5ff' }} />
                                                <div>
                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Paid Days Earned</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>+₹{detailedAttendanceData.salaryBreakdown.presentEarnings?.toLocaleString('en-IN') || 0}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {detailedAttendanceData.salaryBreakdown.halfDayDeduction > 0 && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, border: '1px solid #fde68a' }}>
                                                        Half-day Deducted: -₹{detailedAttendanceData.salaryBreakdown.halfDayDeduction.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                                {detailedAttendanceData.salaryBreakdown.absentLossOfPay > 0 && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: 700, border: '1px solid #fecaca' }}>
                                                        Absent Loss of Pay: -₹{detailedAttendanceData.salaryBreakdown.absentLossOfPay.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                                {detailedAttendanceData.salaryBreakdown.lateDeduction > 0 && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#ede9fe', color: '#5b21b6', fontSize: '11px', fontWeight: 700, border: '1px solid #ddd6fe' }}>
                                                        Late Penalty: -₹{detailedAttendanceData.salaryBreakdown.lateDeduction.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary Chips */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                        {[
                                            { label: 'Present', value: detailedAttendanceData.summary?.presentDays || 0, bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
                                            { label: 'Absent', value: detailedAttendanceData.summary?.absentDays || 0, bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
                                            { label: 'Half-day', value: detailedAttendanceData.summary?.halfDays || 0, bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
                                            { label: 'Leave', value: detailedAttendanceData.summary?.leaveDays || 0, bg: '#e0f2fe', color: '#0369a1', dot: '#0284c7' },
                                            { label: 'Holiday', value: detailedAttendanceData.summary?.holidayDays || 0, bg: '#fce7f3', color: '#9d174d', dot: '#ec4899' },
                                            { label: 'Week Off', value: detailedAttendanceData.summary?.weekOffDays || 0, bg: '#e0e7ff', color: '#3730a3', dot: '#6366f1' },
                                            { label: 'Working Days', value: detailedAttendanceData.summary?.totalDays || 0, bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8' },
                                        ].map((chip, i) => (
                                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '999px', background: chip.bg, color: chip.color, fontSize: '10.5px', fontWeight: 700, border: `1px solid ${chip.dot}30` }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chip.dot, display: 'inline-block' }} />
                                                {chip.label}: {chip.value}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Daily Attendance Table */}
                                    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: "'Inter','Poppins',sans-serif" }}>
                                            <thead>
                                                {/* Day Name Row */}
                                                <tr>
                                                    <th style={{ padding: '6px 12px', background: '#0f172a', color: '#94a3b8', fontWeight: 700, fontSize: '9.5px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 5, minWidth: '110px' }}>Day</th>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => {
                                                        const d = new Date(detailedAttendanceData.year || selectedYear, (detailedAttendanceData.month || selectedMonth) - 1, day.day);
                                                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                                                        return (
                                                            <th key={`dn-${day.day}`} style={{ padding: '5px 4px', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '9.5px', textAlign: 'center', minWidth: '40px', border: '1px solid #e5e7eb', textTransform: 'uppercase' }}>
                                                                {dayName}
                                                            </th>
                                                        );
                                                    })}
                                                    <th style={{ padding: '6px 10px', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '9.5px', textAlign: 'center', minWidth: '80px', border: '1px solid #e5e7eb' }}>Total</th>
                                                </tr>

                                                {/* Date Number Row */}
                                                <tr>
                                                    <th style={{ padding: '8px 12px', background: '#1e3a5f', color: '#fff', fontWeight: 700, fontSize: '10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 5, minWidth: '110px' }}>Date</th>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => (
                                                        <th key={day.day} style={{ padding: '6px 4px', background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: '10px', textAlign: 'center', minWidth: '40px', border: '1px solid #e5e7eb' }}>
                                                            {day.day}
                                                        </th>
                                                    ))}
                                                    <th style={{ padding: '8px 10px', background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: '10px', textAlign: 'center', minWidth: '80px', border: '1px solid #e5e7eb' }}>Summary</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Arrived Time */}
                                                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Arrived Time</td>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => (
                                                        <td key={`at-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', color: '#475569', border: '1px solid #f3f4f6', fontSize: '10px', background: day.loginTime ? '#f0fdf4' : 'white' }}>
                                                            {day.loginTime ? new Date(day.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#166534', background: '#f0fdf4', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary?.presentDays || 0} P</td>
                                                </tr>
                                                {/* Dept Time */}
                                                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Dept Time</td>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => (
                                                        <td key={`dt-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', color: '#475569', border: '1px solid #f3f4f6', fontSize: '10px', background: day.logoutTime ? '#f0fdf4' : 'white' }}>
                                                            {day.logoutTime ? new Date(day.logoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary?.absentDays || 0} A</td>
                                                </tr>
                                                {/* Working Hrs */}
                                                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Working Hrs</td>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => (
                                                        <td key={`wh-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', fontWeight: 600, color: day.workingHours > 0 ? '#059669' : '#94a3b8', border: '1px solid #f3f4f6', fontSize: '10px' }}>
                                                            {day.workingHours > 0 ? `${String(Math.floor(day.workingHours)).padStart(2, '0')}:${String(Math.round((day.workingHours % 1) * 60)).padStart(2, '0')}` : '00:00'}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary?.totalWorkingHours || 0}h</td>
                                                </tr>

                                                {/* Status Row */}
                                                <tr>
                                                    <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Status</td>
                                                    {detailedAttendanceData.dailyBreakdown?.map(day => {
                                                        const isLeave = day.status === 'Leave' || day.leaveInfo;
                                                        const isHoliday = day.status === 'Holiday' || day.isHoliday;
                                                        const isWeekoff = day.status === 'Week Off' || day.isWeekend;
                                                        const cfg = day.status === 'Present'
                                                            ? { bg: '#dcfce7', color: '#166534', label: 'P' }
                                                            : day.status === 'Half-day'
                                                                ? { bg: '#fef3c7', color: '#92400e', label: 'H' }
                                                                : isLeave
                                                                    ? { bg: '#e0f2fe', color: '#0369a1', label: 'L' }
                                                                    : isHoliday
                                                                        ? { bg: '#fce7f3', color: '#9d174d', label: 'HOL' }
                                                                        : isWeekoff
                                                                            ? { bg: '#e0e7ff', color: '#3730a3', label: 'WO' }
                                                                            : day.status === 'Absent'
                                                                                ? { bg: '#fee2e2', color: '#991b1b', label: 'A' }
                                                                                : { bg: '#f1f5f9', color: '#64748b', label: '—' };
                                                        return (
                                                            <td key={`st-${day.day}`} title={day.holidayName || (day.leaveInfo ? `${day.leaveInfo.leaveType} (${day.leaveInfo.reason})` : '')} style={{ padding: '7px 4px', textAlign: 'center', background: cfg.bg, color: cfg.color, fontWeight: 700, border: '1px solid #e5e7eb', fontSize: '10.5px' }}>
                                                                {cfg.label}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#f59e0b', background: '#fef3c7', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary?.halfDays || 0} H</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>No attendance data available</div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fafafa', borderRadius: '0 0 16px 16px' }}>
                            <button
                                onClick={() => setShowDetailedAttendanceModal(false)}
                                style={{ padding: '9px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins',sans-serif", boxShadow: '0 4px 12px rgba(59,119,94,0.25)', transition: 'opacity 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Professional Download Restriction Modal */}
            {showDownloadRestrictionModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowDownloadRestrictionModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '20px'
                    }}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            maxWidth: '460px',
                            width: '100%',
                            padding: '28px 24px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            textAlign: 'center',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowDownloadRestrictionModal(false)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '20px',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                lineHeight: 1
                            }}
                        >
                            ×
                        </button>

                        {/* Icon badge */}
                        <div style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '50%',
                            background: '#fef3c7',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.15)'
                        }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                            Salary Slip Unavailable
                        </h3>

                        {/* Description */}
                        <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                            You cannot download the salary slip unless the payroll is generated.
                        </p>

                        {/* Status indicator pill */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '999px',
                            background: '#f1f5f9',
                            fontSize: '12px',
                            color: '#475569',
                            fontWeight: 600,
                            marginBottom: '22px'
                        }}>
                            <span>Current Status:</span>
                            <span style={{
                                color: (employeePayslip?.status || '').toLowerCase() === 'processed' ? '#1d4ed8' : '#b45309',
                                textTransform: 'uppercase'
                            }}>
                                {employeePayslip?.status || 'Draft / Unpaid'}
                            </span>
                        </div>

                        {/* Action button */}
                        <div>
                            <button
                                onClick={() => setShowDownloadRestrictionModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                                    color: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(59, 119, 94, 0.25)',
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.92'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyPayslip;
