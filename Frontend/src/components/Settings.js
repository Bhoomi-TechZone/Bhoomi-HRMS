import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Settings.css';
import { Building2, UserCircle, Save, CheckCircle2, AlertCircle, Clock, Shield, ShieldAlert, Coffee, Utensils, Info } from 'lucide-react';
import AccessPolicies from './AccessPolicies';
import PolicyViolations from './PolicyViolations';
import { useContextualQueryState } from '../utils/routeUtils';

function Settings() {
    const { user } = useAuth();
    const [{ tab: activeTab }, setQueryState] = useContextualQueryState({ tab: 'company' });
    const setActiveTab = (tab) => setQueryState({ tab });

    // Verify Admin Access
    if (!user || user.role.name !== 'Admin') {
        return (
            <div className="settings-container">
                <div className="access-denied">
                    <h2>Access Denied</h2>
                    <p>You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'company':
                return <CompanySettings />;
            case 'profile':
                return <ProfileSettings user={user} />;
            case 'interval':
                return <IntervalSettings />;
            case 'access-policies':
                return <AccessPolicies />;
            case 'policy-violations':
                return <PolicyViolations />;
            default:
                return <CompanySettings />;
        }
    };

    return (
        <div className="settings-container">
            {/* Top Navigation Bar */}
            <div className="settings-top-nav">
                <div className="settings-nav-header">
                    <h2>Settings & Policy Management</h2>
                </div>
                
                <nav className="settings-nav-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'company' ? 'active' : ''}`}
                        onClick={() => setActiveTab('company')}
                    >
                        <Building2 size={18} />
                        <span>Company Settings</span>
                    </button>

                    <button
                        className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <UserCircle size={18} />
                        <span>Profile Settings</span>
                    </button>

                    <button
                        className={`settings-tab ${activeTab === 'interval' ? 'active' : ''}`}
                        onClick={() => setActiveTab('interval')}
                    >
                        <Clock size={18} />
                        <span>Interval Configuration</span>
                    </button>

                    <button
                        className={`settings-tab ${activeTab === 'access-policies' ? 'active' : ''}`}
                        onClick={() => setActiveTab('access-policies')}
                    >
                        <Shield size={18} />
                        <span>Access Policies</span>
                    </button>

                    <button
                        className={`settings-tab ${activeTab === 'policy-violations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('policy-violations')}
                    >
                        <ShieldAlert size={18} />
                        <span>Policy Violations</span>
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="settings-content-wrapper">
                {renderContent()}
            </div>
        </div>
    );
}

// Sub-components for each section (Placeholder Content)
const CompanySettings = () => {
    const [settings, setSettings] = useState({
        companyName: '',
        brandColor: '#2563eb',
        logo: '',
        website: '',
        address: ''
    });
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setDataLoading(true);
            const res = await api.get('/settings/company');
            if (res.data) {
                setSettings({
                    companyName: res.data.companyName || '',
                    brandColor: res.data.brandColor || '#2563eb',
                    logo: res.data.logo || '',
                    website: res.data.website || '',
                    address: res.data.address || ''
                });
            }
        } catch (error) {
            console.error('Error fetching settings', error);
        } finally {
            setDataLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        try {
            setLoading(true);
            await api.put('/settings/company', settings);
            setMessage({ text: 'Settings updated successfully!', type: 'success' });
        } catch (error) {
            setMessage({ text: 'Error updating settings', type: 'error' });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (dataLoading) {
        return (
            <div className="settings-skeleton">
                <div className="skeleton-row">
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                </div>
                <div className="skeleton-row">
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                </div>
                <div className="skeleton-field-full">
                    <div className="skeleton-label"></div>
                    <div className="skeleton-textarea"></div>
                </div>
                <div className="skeleton-button"></div>
            </div>
        );
    }

    return (
        <div>
            {message.text && (
                <div className={`settings-alert ${message.type === 'error' ? 'error' : 'success'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{message.text}</span>
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="settings-form">
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">
                            Company Name
                            <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            name="companyName"
                            className="form-control"
                            value={settings.companyName}
                            onChange={handleChange}
                            placeholder="Enter company name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Logo URL</label>
                        <input
                            type="text"
                            name="logo"
                            className="form-control"
                            value={settings.logo}
                            onChange={handleChange}
                            placeholder="/logo.png or https://..."
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Website</label>
                        <input
                            type="url"
                            name="website"
                            className="form-control"
                            value={settings.website}
                            onChange={handleChange}
                            placeholder="https://example.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Brand Color</label>
                        <div className="color-picker-wrapper">
                            <input
                                type="color"
                                name="brandColor"
                                className="color-input"
                                value={settings.brandColor}
                                onChange={handleChange}
                            />
                            <span className="color-value">{settings.brandColor}</span>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea
                        name="address"
                        className="form-control"
                        rows="4"
                        value={settings.address}
                        onChange={handleChange}
                        placeholder="Enter company address"
                    ></textarea>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="spinner"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};



const ProfileSettings = ({ user }) => {
    const { refreshUser } = useAuth();
    const [profileData, setProfileData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phone: user?.phone || '',
        email: user?.email || '',
    });
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

    // Sync profile data when user changes
    React.useEffect(() => {
        if (user) {
            setProfileData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: user.phone || '',
                email: user.email || '',
            });
        }
    }, [user]);

    // Password Change State - OTP Flow
    const [passwordStep, setPasswordStep] = useState('idle'); // idle -> send-otp -> verify-otp -> reset-password -> success
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
    const [otpExpiry, setOtpExpiry] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [otpAttempts, setOtpAttempts] = useState(0);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Timer for OTP expiry
    React.useEffect(() => {
        if (passwordStep === 'verify-otp' && otpExpiry) {
            const interval = setInterval(() => {
                const now = new Date();
                const time = Math.max(0, Math.floor((new Date(otpExpiry) - now) / 1000));
                setTimeLeft(time);

                if (time <= 0) {
                    clearInterval(interval);
                    setPasswordMsg({ text: 'OTP has expired. Please request a new one.', type: 'error' });
                    setPasswordStep('idle');
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [passwordStep, otpExpiry]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileMsg({ text: '', type: '' });
        try {
            setProfileLoading(true);
            await api.put('/users/me', {
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                phone: profileData.phone,
                email: profileData.email,
            });
            await refreshUser();
            setProfileMsg({ text: 'Profile updated successfully!', type: 'success' });
        } catch (error) {
            setProfileMsg({ text: error.response?.data?.message || 'Error updating profile', type: 'error' });
        } finally {
            setProfileLoading(false);
        }
    };

    // Step 1: Send OTP
    const handleSendOtp = async () => {
        setPasswordMsg({ text: '', type: '' });
        setPasswordLoading(true);
        try {
            const response = await api.post('/auth/send-change-password-otp');
            if (response.data.success) {
                setPasswordMsg({ text: 'OTP sent to your email', type: 'success' });
                setOtpExpiry(response.data.otpExpiry);
                setOtp(['', '', '', '', '', '']);
                setOtpAttempts(0);
                setTimeout(() => {
                    setPasswordStep('verify-otp');
                    setPasswordMsg({ text: '', type: '' });
                }, 1000);
            }
        } catch (error) {
            setPasswordMsg({ text: error.response?.data?.message || 'Failed to send OTP', type: 'error' });
        } finally {
            setPasswordLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleOtpChange = (index, value) => {
        // Strip any non-numeric characters
        const digitsOnly = value.replace(/\D/g, '');

        if (!digitsOnly) {
            const newOtp = [...otp];
            newOtp[index] = '';
            setOtp(newOtp);
            return;
        }

        // If user typed/pasted multiple digits
        if (digitsOnly.length > 1) {
            const newOtp = [...otp];
            const pastedDigits = digitsOnly.slice(0, 6).split('');
            pastedDigits.forEach((digit, i) => {
                if (index + i < 6) {
                    newOtp[index + i] = digit;
                }
            });
            setOtp(newOtp);
            const nextFocusIndex = Math.min(index + pastedDigits.length, 5);
            const nextInput = document.getElementById(`otp-${nextFocusIndex}`);
            if (nextInput) nextInput.focus();
            return;
        }

        // Single digit entry
        const newOtp = [...otp];
        newOtp[index] = digitsOnly;
        setOtp(newOtp);

        if (index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasteData) {
            const newOtp = ['', '', '', '', '', ''];
            pasteData.split('').forEach((char, i) => {
                newOtp[i] = char;
            });
            setOtp(newOtp);
            const focusIndex = Math.min(pasteData.length - 1, 5);
            const targetInput = document.getElementById(`otp-${focusIndex}`);
            if (targetInput) targetInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (!otp[index] && index > 0) {
                const newOtp = [...otp];
                newOtp[index - 1] = '';
                setOtp(newOtp);
                const prevInput = document.getElementById(`otp-${index - 1}`);
                if (prevInput) prevInput.focus();
            } else {
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleVerifyOtp = async () => {
        setPasswordMsg({ text: '', type: '' });
        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setPasswordMsg({ text: 'Please enter all 6 digits', type: 'error' });
            return;
        }

        setPasswordLoading(true);
        try {
            const response = await api.post('/auth/verify-change-password-otp', { otp: otpCode });
            if (response.data.success) {
                setPasswordMsg({ text: 'OTP verified! Enter your new password.', type: 'success' });
                setTimeout(() => {
                    setPasswordStep('reset-password');
                    setPasswordMsg({ text: '', type: '' });
                }, 1000);
            }
        } catch (error) {
            const remaining = error.response?.data?.attemptsRemaining;
            const message = error.response?.data?.message || 'Failed to verify OTP';
            setPasswordMsg({ 
                text: remaining ? `${message} (${remaining} attempts remaining)` : message, 
                type: 'error' 
            });
            setOtpAttempts(otpAttempts + 1);
        } finally {
            setPasswordLoading(false);
        }
    };

    // Step 3: Reset Password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setPasswordMsg({ text: '', type: '' });

        if (!newPassword || !confirmPassword) {
            setPasswordMsg({ text: 'Please enter both passwords', type: 'error' });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordMsg({ text: 'Password must be at least 6 characters', type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ text: 'Passwords do not match', type: 'error' });
            return;
        }

        setPasswordLoading(true);
        try {
            const response = await api.post('/auth/confirm-password-change', {
                newPassword,
                confirmPassword
            });
            if (response.data.success) {
                setPasswordMsg({ text: 'Password changed successfully!', type: 'success' });
                setTimeout(() => {
                    setPasswordStep('idle');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordMsg({ text: '', type: '' });
                }, 2000);
            }
        } catch (error) {
            setPasswordMsg({ text: error.response?.data?.message || 'Failed to change password', type: 'error' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setPasswordMsg({ text: '', type: '' });
        setPasswordLoading(true);
        try {
            const response = await api.post('/auth/send-change-password-otp');
            if (response.data.success) {
                setPasswordMsg({ text: 'New OTP sent to your email', type: 'success' });
                setOtpExpiry(response.data.otpExpiry);
                setOtp(['', '', '', '', '', '']);
                setOtpAttempts(0);
            }
        } catch (error) {
            setPasswordMsg({ text: 'Failed to resend OTP', type: 'error' });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div>
            {/* Profile Info Section */}
            {profileMsg.text && (
                <div className={`settings-alert ${profileMsg.type === 'error' ? 'error' : 'success'}`}>
                    {profileMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{profileMsg.text}</span>
                </div>
            )}
            <form onSubmit={handleProfileSubmit} className="settings-form">
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input
                            type="text"
                            name="firstName"
                            className="form-control"
                            value={profileData.firstName}
                            onChange={handleProfileChange}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input
                            type="text"
                            name="lastName"
                            className="form-control"
                            value={profileData.lastName}
                            onChange={handleProfileChange}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            className="form-control"
                            value={profileData.email}
                            onChange={handleProfileChange}
                            placeholder="Enter email address"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                            type="text"
                            name="phone"
                            className="form-control"
                            value={profileData.phone}
                            onChange={handleProfileChange}
                            placeholder="Enter phone number"
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={profileLoading}>
                        {profileLoading ? (
                            <>
                                <div className="spinner"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                <span>Update Profile</span>
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Change Password Section - OTP Based */}
            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Change Password</h3>

            {passwordMsg.text && (
                <div className={`settings-alert ${passwordMsg.type === 'error' ? 'error' : 'success'}`}>
                    {passwordMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{passwordMsg.text}</span>
                </div>
            )}

            {/* Step 1: Send OTP */}
            {passwordStep === 'idle' && (
                <div className="settings-form">
                    <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '14px' }}>
                        Click the button below to receive an OTP on your registered email address.
                    </p>
                    <div className="form-actions">
                        <button 
                            type="button" 
                            onClick={handleSendOtp}
                            className="btn-primary" 
                            disabled={passwordLoading}
                        >
                            {passwordLoading ? (
                                <>
                                    <div className="spinner"></div>
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Change Password</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Verify OTP */}
            {passwordStep === 'verify-otp' && (
                <div className="settings-form">
                    <div className="form-group">
                        <label className="form-label">Enter OTP from Email</label>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0' }}>
                            OTP sent to: <strong>{user?.email}</strong>
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }} onPaste={handleOtpPaste}>
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`otp-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="one-time-code"
                                    maxLength="6"
                                    value={digit}
                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                    disabled={passwordLoading}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        textAlign: 'center',
                                        fontSize: '18px',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        backgroundColor: '#ffffff',
                                        border: digit ? '2px solid #3b775e' : '2px solid #cbd5e1',
                                        borderRadius: '8px',
                                        outline: 'none',
                                        transition: 'all 0.15s ease',
                                        boxSizing: 'border-box',
                                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b775e'}
                                    onBlur={(e) => e.target.style.borderColor = digit ? '#3b775e' : '#cbd5e1'}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>
                        {timeLeft > 0 && (
                            <p style={{ color: '#4299e1', fontSize: '12px', textAlign: 'center', marginBottom: '16px' }}>
                                OTP expires in: <strong>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</strong>
                            </p>
                        )}
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button"
                            onClick={handleVerifyOtp}
                            className="btn-primary"
                            disabled={passwordLoading || otp.join('').length !== 6}
                        >
                            {passwordLoading ? (
                                <>
                                    <div className="spinner"></div>
                                    <span>Verifying...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Verify OTP</span>
                                </>
                            )}
                        </button>
                        <button 
                            type="button"
                            onClick={handleResendOtp}
                            disabled={passwordLoading}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#667eea',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                textDecoration: 'underline',
                                padding: '8px 0'
                            }}
                        >
                            Didn't receive OTP? Resend
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                setPasswordStep('idle');
                                setPasswordMsg({ text: '', type: '' });
                            }}
                            disabled={passwordLoading}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                textDecoration: 'underline',
                                padding: '8px 0'
                            }}
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Reset Password */}
            {passwordStep === 'reset-password' && (
                <form onSubmit={handleResetPassword} className="settings-form">
                    <div className="form-group">
                        <label className="form-label">New Password <span className="required">*</span></label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                className="form-control"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8'
                                }}
                            >
                                {showNewPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm New Password <span className="required">*</span></label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                className="form-control"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8'
                                }}
                            >
                                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>
                    <p className="form-hint">Password must be at least 6 characters long</p>

                    <div className="form-actions">
                        <button 
                            type="submit" 
                            className="btn-primary" 
                            disabled={passwordLoading}
                        >
                            {passwordLoading ? (
                                <>
                                    <div className="spinner"></div>
                                    <span>Resetting...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Confirm Password Change</span>
                                </>
                            )}
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                setPasswordStep('verify-otp');
                                setPasswordMsg({ text: '', type: '' });
                            }}
                            disabled={passwordLoading}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                textDecoration: 'underline',
                                padding: '8px 0'
                            }}
                        >
                            Back to OTP
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

// Helper to convert 12-hour time string ("01:00 PM") to 24-hour ("13:00") for input[type="time"]
const to24Hour = (timeStr12) => {
    if (!timeStr12) return '';
    const match = String(timeStr12).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return '';
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3] ? match[3].toUpperCase() : null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
};

// Helper to convert 24-hour time ("13:00") to 12-hour time string ("01:00 PM")
const to12Hour = (timeStr24) => {
    if (!timeStr24) return '';
    const parts = timeStr24.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
};

const IntervalSettings = () => {
    const [config, setConfig] = useState({ totalBreakLimit: 60 });
    const [shiftConfigs, setShiftConfigs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const [attendanceRes, shiftRes] = await Promise.all([
                api.get('/attendance-configs'),
                api.get('/shift-configs')
            ]);

            if (attendanceRes.data) {
                setConfig({
                    totalBreakLimit: attendanceRes.data.totalBreakLimit ?? 60,
                });
            }

            if (Array.isArray(shiftRes.data)) {
                setShiftConfigs(shiftRes.data);
            }
        } catch (error) {
            console.error('Error fetching interval & shift configurations', error);
        } finally {
            setDataLoading(false);
        }
    };

    const handleLimitChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    };

    const parseToMins = (timeStr12) => {
        if (!timeStr12) return 0;
        const match = String(timeStr12).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3] ? match[3].toUpperCase() : null;
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const addMinsTo12Hour = (timeStr12, minsToAdd) => {
        if (!timeStr12) return '';
        const total = (parseToMins(timeStr12) + minsToAdd + 1440) % 1440;
        let hours = Math.floor(total / 60);
        const mins = total % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    };

    const handleShiftBreakChange = (index, field, value) => {
        setShiftConfigs(prev => {
            const updated = [...prev];
            const currentItem = { ...updated[index], [field]: value };

            if (field === 'lunchStartTime') {
                const sMins = parseToMins(value);
                const eMins = parseToMins(currentItem.lunchEndTime);
                if (currentItem.lunchEndTime && eMins <= sMins) {
                    currentItem.lunchEndTime = addMinsTo12Hour(value, 60);
                }
            } else if (field === 'refreshment1StartTime') {
                const sMins = parseToMins(value);
                const eMins = parseToMins(currentItem.refreshment1EndTime);
                if (currentItem.refreshment1EndTime && eMins <= sMins) {
                    currentItem.refreshment1EndTime = addMinsTo12Hour(value, 30);
                }
            } else if (field === 'refreshment2StartTime') {
                const sMins = parseToMins(value);
                const eMins = parseToMins(currentItem.refreshment2EndTime);
                if (currentItem.refreshment2EndTime && eMins <= sMins) {
                    currentItem.refreshment2EndTime = addMinsTo12Hour(value, 30);
                }
            }

            updated[index] = currentItem;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        try {
            setLoading(true);
            // 1. Update Attendance Config (Total Break Limit)
            const existing = await api.get('/attendance-configs');
            const current = existing.data || {};
            await api.put('/attendance-configs', {
                markLateAfter:    current.markLateAfter    ?? 0.25,
                markHalfdayAfter: current.markHalfdayAfter ?? 2,
                markAbsentAfter:  current.markAbsentAfter  ?? 4,
                totalBreakLimit:  Number(config.totalBreakLimit),
            });

            // 2. Update Shift Break Intervals (Bulk)
            if (shiftConfigs.length > 0) {
                await api.put('/shift-configs/bulk', { configs: shiftConfigs });
            }

            setMessage({ text: 'Interval and shift break configurations updated successfully!', type: 'success' });
        } catch (error) {
            setMessage({ text: error.response?.data?.message || 'Error updating interval configuration', type: 'error' });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (dataLoading) {
        return (
            <div className="settings-skeleton">
                <div className="skeleton-row">
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                    <div className="skeleton-field">
                        <div className="skeleton-label"></div>
                        <div className="skeleton-input"></div>
                    </div>
                </div>
                <div className="skeleton-field-full">
                    <div className="skeleton-label"></div>
                    <div className="skeleton-textarea"></div>
                </div>
                <div className="skeleton-button"></div>
            </div>
        );
    }

    return (
        <div>
            {message.text && (
                <div className={`settings-alert ${message.type === 'error' ? 'error' : 'success'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="settings-form">
                {/* Section 1: Global Break Limit */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} color="#3b775e" />
                        Global Break Limit
                    </h3>
                    <p style={{ fontSize: '13.5px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: '1.6' }}>
                        Configure the global break limit. Lunch and Tea breaks are fully excluded from Working Hours.
                        Employees are allowed a combined total break time up to this limit per day. Max 1 Lunch Break and 2 Refreshment Breaks. "Other" breaks remain included in working time.
                    </p>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">
                                Total Break Limit <span className="required">*</span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    name="totalBreakLimit"
                                    className="form-control"
                                    value={config.totalBreakLimit}
                                    onChange={handleLimitChange}
                                    min={0}
                                    max={240}
                                    placeholder="e.g. 60"
                                    required
                                    style={{ maxWidth: '160px' }}
                                />
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>minutes</span>
                            </div>
                            <p className="form-hint">Total combined time allowed for Lunch and Tea/Refreshment breaks.</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '8px', padding: '14px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                        <p style={{ fontSize: '13px', color: '#166534', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Info size={16} style={{ flexShrink: 0 }} />
                            <span><strong>Example:</strong> Total limit = {config.totalBreakLimit} min. If an employee works a 9-hour shift and takes a 45 min Lunch break and 15 min Tea break, their Working Hours will be calculated as exactly 8 hours.</span>
                        </p>
                    </div>
                </div>

                {/* Section 2: Shift-Wise Break Timelines Table */}
                <div className="shift-breaks-section">
                    <div className="shift-breaks-header">
                        <h3>
                            <Utensils size={18} color="#3b775e" />
                            Shift Break Schedule & Timelines
                        </h3>
                        <p>
                            Define start and end times for Lunch and Refreshment breaks for each shift. Employees will only be allowed to take breaks during their assigned shift's permitted timeline.
                        </p>
                    </div>

                    <div className="shift-breaks-table-wrapper">
                        <table className="shift-breaks-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '22%' }}>Shift & Hours</th>
                                    <th style={{ width: '26%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Utensils size={14} color="#0284c7" />
                                            Lunch Break Window
                                        </div>
                                    </th>
                                    <th style={{ width: '26%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Coffee size={14} color="#d97706" />
                                            1st Refreshment Break
                                        </div>
                                    </th>
                                    <th style={{ width: '26%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Coffee size={14} color="#d97706" />
                                            2nd Refreshment Break
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {shiftConfigs.map((shift, idx) => (
                                    <tr key={shift.type || idx}>
                                        <td>
                                            <div className="shift-info-cell">
                                                <span className="shift-name-title">{shift.name}</span>
                                                <span className="shift-time-subtitle">
                                                    <Clock size={12} />
                                                    {shift.startTime || ''} – {shift.endTime || ''}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Lunch Break Window: Start & End */}
                                        <td>
                                            <div className="time-range-group" style={{ opacity: shift.allowLunchAnytime ? 0.5 : 1 }}>
                                                <div className="time-input-box" title="Lunch Break Start Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowLunchAnytime)}
                                                        value={to24Hour(shift.lunchStartTime || shift.lunchTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'lunchStartTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                                <span className="time-range-separator">to</span>
                                                <div className="time-input-box" title="Lunch Break End Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowLunchAnytime)}
                                                        value={to24Hour(shift.lunchEndTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'lunchEndTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(shift.allowLunchAnytime)}
                                                    onChange={(e) => handleShiftBreakChange(idx, 'allowLunchAnytime', e.target.checked)}
                                                    style={{ accentColor: '#3b775e', width: '14px', height: '14px', cursor: 'pointer' }}
                                                />
                                                <span>Allow anytime</span>
                                            </label>
                                        </td>

                                        {/* 1st Refreshment Break Window: Start & End */}
                                        <td>
                                            <div className="time-range-group" style={{ opacity: shift.allowRefreshment1Anytime ? 0.5 : 1 }}>
                                                <div className="time-input-box" title="1st Refreshment Break Start Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowRefreshment1Anytime)}
                                                        value={to24Hour(shift.refreshment1StartTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'refreshment1StartTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                                <span className="time-range-separator">to</span>
                                                <div className="time-input-box" title="1st Refreshment Break End Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowRefreshment1Anytime)}
                                                        value={to24Hour(shift.refreshment1EndTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'refreshment1EndTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(shift.allowRefreshment1Anytime)}
                                                    onChange={(e) => handleShiftBreakChange(idx, 'allowRefreshment1Anytime', e.target.checked)}
                                                    style={{ accentColor: '#3b775e', width: '14px', height: '14px', cursor: 'pointer' }}
                                                />
                                                <span>Allow anytime</span>
                                            </label>
                                        </td>

                                        {/* 2nd Refreshment Break Window: Start & End */}
                                        <td>
                                            <div className="time-range-group" style={{ opacity: shift.allowRefreshment2Anytime ? 0.5 : 1 }}>
                                                <div className="time-input-box" title="2nd Refreshment Break Start Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowRefreshment2Anytime)}
                                                        value={to24Hour(shift.refreshment2StartTime || shift.teaTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'refreshment2StartTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                                <span className="time-range-separator">to</span>
                                                <div className="time-input-box" title="2nd Refreshment Break End Time">
                                                    <input
                                                        type="time"
                                                        className="time-input-field"
                                                        disabled={Boolean(shift.allowRefreshment2Anytime)}
                                                        value={to24Hour(shift.refreshment2EndTime || '')}
                                                        onChange={(e) => handleShiftBreakChange(idx, 'refreshment2EndTime', to12Hour(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(shift.allowRefreshment2Anytime)}
                                                    onChange={(e) => handleShiftBreakChange(idx, 'allowRefreshment2Anytime', e.target.checked)}
                                                    style={{ accentColor: '#3b775e', width: '14px', height: '14px', cursor: 'pointer' }}
                                                />
                                                <span>Allow anytime</span>
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="form-actions" style={{ marginTop: '32px' }}>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? (
                            <><div className="spinner"></div><span>Saving Settings...</span></>
                        ) : (
                            <><Save size={16} /><span>Save Interval & Shift Configuration</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;
