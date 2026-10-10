import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Login.css';

/* ── SVG Icon Components ─────────────────────────────────── */
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
  </svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconEyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const IconId = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

/* ── Inline keyframe styles ──────────────────────────────── */
const animStyles = `
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes shutterOpen {
    0%   { opacity: 0; transform: translateX(100%) scaleX(0.8); }
    60%  { opacity: 1; transform: translateX(-2%) scaleX(1.02); }
    100% { opacity: 1; transform: translateX(0) scaleX(1); }
  }
  @keyframes slideUpPanel {
    0%   { opacity: 0; transform: translateY(100%); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUpForm {
    0%   { transform: translateY(200px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInUpLarge {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dropFromTop {
    0%   { opacity: 0; transform: translateY(-100px) scale(0.9); }
    60%  { opacity: 1; transform: translateY(8px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes slideFromLeft {
    from { opacity: 0; transform: translateX(-80px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideFromBottom {
    from { opacity: 0; transform: translateY(60px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes expandPanel {
    0%   { flex: 0; width: 0; min-width: 0; transform: translateX(0); opacity: 0; }
    1%   { flex: 0; width: 0; min-width: 0; transform: translateX(0); opacity: 0; }
    100% { flex: 1; width: auto; min-width: 0; transform: translateX(0); opacity: 1; }
  }
  @keyframes shrinkLeftPanel {
    0%   { max-width: 100%; }
    100% { max-width: 50%; }
  }
  @keyframes shiftLeftPanel {
    0%   { transform: translateY(0) translateX(0); }
    100% { transform: translateY(0) translateX(0); }
  }
  @keyframes floatA {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-18px) rotate(4deg); }
  }
  @keyframes floatB {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-12px) rotate(-3deg); }
  }
  @keyframes floatC {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-24px); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(168,230,61,0.5); }
    70%  { box-shadow: 0 0 0 12px rgba(168,230,61,0); }
    100% { box-shadow: 0 0 0 0 rgba(168,230,61,0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(30px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes orbitA {
    from { transform: rotate(0deg)   translateX(70px); }
    to   { transform: rotate(360deg) translateX(70px); }
  }
  @keyframes orbitB {
    from { transform: rotate(120deg)  translateX(110px); }
    to   { transform: rotate(480deg)  translateX(110px); }
  }
  @keyframes orbitC {
    from { transform: rotate(240deg)  translateX(150px); }
    to   { transform: rotate(600deg)  translateX(150px); }
  }
  @keyframes watermarkSlide {
    0%   { transform: translateX(-20%) translateY(20%) rotate(-5deg); opacity: 0; }
    100% { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0.03; }
  }
  @keyframes slideInRightRoll {
    0%   { opacity: 0; transform: translateX(80px) rotate(12deg) scale(0.9); }
    60%  { opacity: 1; transform: translateX(-4px) rotate(-2deg) scale(1.02); }
    100% { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
  }
  @keyframes titleAppear {
    0%   { opacity: 0; transform: translateX(12px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes descAppear {
    0%   { opacity: 0; transform: translateX(20px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  .login-input:focus { border-color: #a8e63d !important; box-shadow: 0 0 0 3px rgba(168,230,61,0.15) !important; }
  .login-input.error { border-color: rgba(239,68,68,0.5) !important; }
  .login-input.error:focus { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important; }
  .login-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(168,230,61,0.35) !important; }
  .login-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .forgot-link:hover { color: #a8e63d !important; }
  .feature-card:hover { background: linear-gradient(135deg, rgba(168,230,61,0.12), rgba(168,230,61,0.08)) !important; border-color: rgba(168,230,61,0.3) !important; transform: translateX(4px) !important; box-shadow: 0 4px 16px rgba(168,230,61,0.2) !important; }
`;

function Login() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotData, setForgotData] = useState({
    email: '',
    employeeId: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Handle email change with validation
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value.trim() === '') {
      setEmailError('');
    } else if (!validateEmail(value)) {
      setEmailError('invalid');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      console.log('Attempting login with email:', email);
      const result = await login(email, password);
      
      if (result.success) {
        console.log('Login successful!');
        navigate('/');
      } else {
        console.log('Login failed:', result.message);
        setError(result.message || 'Login failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please check your connection.');
      setLoading(false);
    }
  };

  const handleVerifyUser = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate email format
    if (!validateEmail(forgotData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-user', {
        email: forgotData.email,
        employeeId: forgotData.employeeId,
        oldPassword: forgotData.oldPassword
      });

      if (response.data.success) {
        setVerifiedUser(response.data.userName);
        setForgotStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (forgotData.newPassword !== forgotData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (forgotData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', forgotData);

      if (response.data.success) {
        setSuccess('Password changed successfully! You can now login.');
        setShowForgotPassword(false);
        setForgotStep(1);
        setForgotData({ email: '', employeeId: '', oldPassword: '', newPassword: '', confirmPassword: '' });
        setVerifiedUser('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotStep(1);
    setForgotData({ email: '', employeeId: '', oldPassword: '', newPassword: '', confirmPassword: '' });
    setVerifiedUser('');
    setError('');
  };

  /* ── Shared input style ── */
  const inputStyle = {
    width: '100%',
    padding: '10px 12px 10px 38px',
    border: '1.5px solid rgba(168,230,61,0.3)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#162a16',
    marginBottom: '5px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };
  const iconWrap = {
    position: 'absolute', left: '11px', top: '50%',
    transform: 'translateY(-50%) scale(0.85)', color: '#6b7280',
    display: 'flex', alignItems: 'center', pointerEvents: 'none',
  };
  const eyeBtn = {
    position: 'absolute', right: '10px', top: '50%',
    transform: 'translateY(-50%) scale(0.85)', background: 'none', border: 'none',
    cursor: 'pointer', color: '#6b7280', padding: '3px',
    display: 'flex', alignItems: 'center',
  };

  return (
    <div className="login-shell" style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: '#f8fafc',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ── Keyframe injection ── */}
      <style>{animStyles}</style>

      {/* ══ LEFT — Login Form ══════════════════════════════════════ */}
      <div className="login-form-panel" style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        background: '#ffffff',
        animation: 'slideUpPanel 0.7s cubic-bezier(0.16,1,0.3,1) both',
        minWidth: 0,
        overflow: 'hidden',
        willChange: 'transform',
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '380px',
          margin: '0 auto',
        }}>

          {/* Brand */}
          <div style={{ marginBottom: '24px', animation: 'dropFromTop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}>
            <div style={{
              width: '44px', height: '44px',
              background: 'linear-gradient(135deg, #a8e63d 0%, #7bc42a 100%)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
              animation: 'pulse-ring 2.5s infinite',
              boxShadow: '0 4px 20px rgba(168,230,61,0.3)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#162a16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2 style={{
              fontSize: '22px', fontWeight: '700', color: '#0f172a',
              margin: '0 0 6px 0', letterSpacing: '-0.02em',
            }}>
              Welcome Back
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
              Sign in to your HRMS dashboard
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5',
              padding: '9px 11px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '8px',
              animation: 'fadeInUp 0.3s ease',
            }}>
              <span style={{ color: '#f87171', flexShrink: 0, transform: 'scale(0.85)' }}><IconAlert /></span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={{
              background: 'rgba(168,230,61,0.1)',
              border: '1px solid rgba(168,230,61,0.35)',
              color: '#a8e63d',
              padding: '9px 11px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '8px',
              animation: 'fadeInUp 0.3s ease',
            }}>
              <span style={{ flexShrink: 0, transform: 'scale(0.85)' }}><IconCheck /></span>
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '14px', animation: 'slideFromLeft 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
              <label style={labelStyle}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  ...iconWrap, 
                  color: emailError ? '#f87171' : '#6b7280' 
                }}>
                  <IconMail />
                </span>
                <input
                  className={`login-input ${emailError ? 'error' : ''}`}
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  placeholder="you@company.com"
                  style={{
                    ...inputStyle,
                    borderColor: emailError ? 'rgba(239,68,68,0.5)' : 'rgba(168,230,61,0.3)',
                  }}
                />
              </div>
              {emailError && (
                <div style={{
                  fontSize: '11px',
                  color: '#ef4444',
                  marginTop: '5px',
                  paddingLeft: '2px',
                  fontWeight: '500',
                  letterSpacing: '0.01em',
                }}>
                  ⚠ Please enter a valid email address
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '8px', animation: 'slideFromLeft 0.6s cubic-bezier(0.16,1,0.3,1) 0.65s both' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <span style={iconWrap}><IconLock /></span>
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{ ...inputStyle, paddingRight: '36px' }}
                />
                <button type="button" style={eyeBtn} onClick={() => setShowPassword(p => !p)}>
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Forgot - Hidden */}
            {/* <div style={{ textAlign: 'right', marginBottom: '18px', animation: 'slideFromLeft 0.6s cubic-bezier(0.16,1,0.3,1) 0.8s both' }}>
              <button
                type="button"
                className="forgot-link"
                onClick={() => { setShowForgotPassword(true); setError(''); }}
                style={{
                  background: 'none', border: 'none',
                  color: '#64748b', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '500', padding: 0,
                  transition: 'color 0.2s',
                }}
              >
                Forgot password?
              </button>
            </div> */}

            {/* Submit */}
            <div style={{ animation: 'slideFromBottom 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.95s both' }}>
              <button
                type="submit"
                disabled={loading}
                className="login-btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  border: 'none',
                  borderRadius: '8px',
                  background: loading
                    ? 'rgba(168,230,61,0.5)'
                    : 'linear-gradient(135deg, #a8e63d 0%, #7bc42a 100%)',
                  color: '#162a16',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 14px rgba(168,230,61,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  letterSpacing: '0.02em',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px',
                      border: '2px solid #162a16',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign In <IconArrow /></>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center', marginTop: '18px',
            fontSize: '11px', color: '#6b7280',
            animation: 'fadeInUp 0.5s 0.5s both',
          }}>
            Need help? Contact your HR Administrator
          </p>
        </div>
      </div>

      {/* ══ RIGHT — Branding Panel ════════════════════════════════ */}
      <div className="login-brand-panel" style={{
        flex: '1',
        background: 'linear-gradient(135deg, #0d1f0d 0%, #162a16 50%, #1a3a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 4vw, 50px) clamp(12px, 3vw, 40px)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'expandPanel 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.8s both',
        willChange: 'transform, opacity',
      }}>
        {/* Subtle background pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.03,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(168,230,61,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(168,230,61,0.1) 0%, transparent 50%)
          `,
        }} />

        {/* Minimal decorative elements */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(168,230,61,0.06)',
          top: '-200px', right: '-200px',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(168,230,61,0.04)',
          bottom: '-150px', left: '-150px',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ 
          maxWidth: 'min(640px, 100%)',
          width: '100%',
          position: 'relative', 
          zIndex: 1,
          animation: 'fadeInUp 0.6s ease-out 1.1s both',
          willChange: 'transform, opacity',
        }}>
          {/* Heading */}
          <div style={{ animation: 'fadeInUp 0.6s 1.2s both', willChange: 'transform, opacity' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'linear-gradient(135deg, rgba(168,230,61,0.12), rgba(168,230,61,0.08))',
              border: '1px solid rgba(168,230,61,0.2)',
              borderRadius: '16px',
              padding: '4px 10px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(168,230,61,0.1)',
            }}>
              <span style={{ 
                width: '5px', height: '5px', borderRadius: '50%', 
                background: '#a8e63d', display: 'inline-block',
                boxShadow: '0 0 8px rgba(168,230,61,0.5)',
              }} />
              <span style={{ 
                fontSize: '8.5px', fontWeight: '700', color: '#a8e63d', 
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Bhoomi Techzone HRMS
              </span>
            </div>
            <h1 style={{
              fontSize: 'clamp(26px, 5.8vw, 44px)', fontWeight: '800', color: '#ffffff',
              margin: '0 0 clamp(10px, 2vw, 16px) 0', lineHeight: '1.15', letterSpacing: '-0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}>
              Empowering Your<br />
              <span style={{ 
                background: 'linear-gradient(135deg, #a8e63d 0%, #7bc42a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Workforce</span> with<br />
              Modern Solutions
            </h1>
            <p style={{ 
              fontSize: 'clamp(12px, 2.2vw, 16.5px)', color: '#94a3b8', lineHeight: '1.5', 
              margin: '0 0 clamp(16px, 3vw, 32px) 0', fontWeight: '400',
            }}>
              Streamline operations with our comprehensive platform — from attendance 
              tracking to seamless team collaboration.
            </p>
          </div>

          {/* Feature cards */}
          {[
            { icon: <IconUsers />, title: 'Employee Dashboard', desc: 'Access your profile & tasks' },
            { icon: <IconChart />, title: 'Attendance & Leaves', desc: 'Track time and request leaves' },
            { icon: <IconBriefcase />, title: 'Projects & Tasks', desc: 'Collaborate with your team' },
            { icon: <IconShield />, title: 'Secure Access', desc: 'Enterprise-grade security' },
          ].map((f, i) => (
            <div
              key={i}
              className="feature-card feature-card-mobile"
              style={{
                display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2vw, 16px)',
                padding: 'clamp(10px, 2vw, 16px) clamp(12px, 2.4vw, 20px)',
                borderRadius: '14px',
                border: '1px solid rgba(168,230,61,0.15)',
                background: 'linear-gradient(135deg, rgba(168,230,61,0.06), rgba(168,230,61,0.03))',
                marginBottom: '6px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default',
                animation: `slideInRightRoll 0.6s cubic-bezier(0.34, 1.5, 0.64, 1) ${1.6 + i * 0.12}s both`,
                willChange: 'transform, opacity',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div className="feature-card-icon" style={{
                width: 'clamp(34px, 6vw, 50px)', height: 'clamp(34px, 6vw, 50px)', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(168,230,61,0.2), rgba(168,230,61,0.15))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a8e63d', flexShrink: 0,
                boxShadow: '0 2px 8px rgba(168,230,61,0.2)',
              }}>
                {f.icon}
              </div>
              <div className="feature-card-text" style={{ flex: 1, minWidth: 0 }}>
                <div className="feature-card-title" style={{ 
                  fontSize: 'clamp(13px, 2vw, 16px)', 
                  fontWeight: '700', 
                  color: '#f1f5f9', 
                  marginBottom: '2px',
                  animation: `titleAppear 0.4s ease-out ${1.75 + i * 0.12}s both`,
                  letterSpacing: '-0.01em',
                }}>
                  {f.title}
                </div>
                <div className="feature-card-desc" style={{ 
                  fontSize: 'clamp(10px, 1.8vw, 14px)', 
                  color: '#94a3b8',
                  animation: `descAppear 0.4s ease-out ${1.9 + i * 0.12}s both`,
                  lineHeight: '1.35',
                }}>
                  {f.desc}
                </div>
              </div>
              <div className="feature-card-arrow" style={{ 
                color: 'rgba(168,230,61,0.4)', 
                transform: 'scale(0.85)',
                animation: `fadeInUp 0.3s ease-out ${2.0 + i * 0.12}s both`,
              }}>
                <IconArrow />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Forgot Password Modal ══════════════════════════════════ */}
      {showForgotPassword && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
          onClick={closeForgotPassword}
        >
          <div
            className="login-forgot-modal"
            style={{
              background: '#1a3a1a',
              border: '1px solid rgba(168,230,61,0.15)',
              borderRadius: '16px',
              width: '100%', maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
              animation: 'modalSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #162a16 0%, #1a3a1a 100%)',
              borderBottom: '1px solid rgba(168,230,61,0.15)',
              padding: '18px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '9px',
                  background: 'rgba(168,230,61,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a8e63d', transform: 'scale(0.9)',
                }}>
                  <IconLock />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f0fdf0' }}>
                    Reset Password
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>
                    {forgotStep === 1 ? 'Step 1 of 2 — Verify identity' : 'Step 2 of 2 — Set new password'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeForgotPassword}
                style={{
                  width: '30px', height: '30px', borderRadius: '7px',
                  border: '1px solid rgba(168,230,61,0.15)',
                  background: 'rgba(168,230,61,0.06)',
                  color: '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168,230,61,0.15)'; e.currentTarget.style.color = '#a8e63d'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168,230,61,0.06)'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <IconClose />
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: '3px', background: 'rgba(168,230,61,0.1)', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: forgotStep === 1 ? '50%' : '100%',
                background: 'linear-gradient(90deg, #a8e63d, #7bc42a)',
                transition: 'width 0.4s ease',
                borderRadius: '0 2px 2px 0',
              }} />
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  padding: '9px 11px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ color: '#f87171', flexShrink: 0, transform: 'scale(0.85)' }}><IconAlert /></span>
                  <span>{error}</span>
                </div>
              )}

              {forgotStep === 1 ? (
                <form onSubmit={handleVerifyUser}>
                  {/* Email */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <span style={iconWrap}><IconMail /></span>
                      <input
                        className="login-input"
                        type="email"
                        value={forgotData.email}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForgotData({ ...forgotData, email: value });
                          // Clear error when user starts typing
                          if (error && error.includes('email')) setError('');
                        }}
                        placeholder="your@email.com"
                        required
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Employee ID */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Employee ID</label>
                    <div style={{ position: 'relative' }}>
                      <span style={iconWrap}><IconId /></span>
                      <input
                        className="login-input"
                        type="text"
                        value={forgotData.employeeId}
                        onChange={(e) => setForgotData({ ...forgotData, employeeId: e.target.value })}
                        placeholder="e.g. EMP-0042"
                        required
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Current Password */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={labelStyle}>Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={iconWrap}><IconLock /></span>
                      <input
                        className="login-input"
                        type="password"
                        value={forgotData.oldPassword}
                        onChange={(e) => setForgotData({ ...forgotData, oldPassword: e.target.value })}
                        placeholder="Your current password"
                        required
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="login-btn-primary"
                    style={{
                      width: '100%', padding: '11px',
                      border: 'none', borderRadius: '8px',
                      background: loading ? 'rgba(168,230,61,0.4)' : 'linear-gradient(135deg, #a8e63d 0%, #7bc42a 100%)',
                      color: '#162a16', fontSize: '13px', fontWeight: '700',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      boxShadow: '0 4px 14px rgba(168,230,61,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                  >
                    {loading ? (
                      <><span style={{ width:'14px',height:'14px',border:'2px solid #162a16',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block' }} /> Verifying…</>
                    ) : (
                      <>Verify & Continue <IconArrow /></>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword}>
                  {/* Verified banner */}
                  <div style={{
                    background: 'rgba(168,230,61,0.08)',
                    border: '1px solid rgba(168,230,61,0.25)',
                    borderRadius: '8px', padding: '11px',
                    marginBottom: '16px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'rgba(168,230,61,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#a8e63d', flexShrink: 0, transform: 'scale(0.9)',
                    }}>
                      <IconCheck />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', color: '#a8e63d', fontWeight: '600', fontSize: '13px' }}>
                        Hello, {verifiedUser}!
                      </p>
                      <p style={{ margin: 0, color: '#6b7280', fontSize: '11px' }}>
                        Identity verified. Create your new password below.
                      </p>
                    </div>
                  </div>

                  {/* New Password */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={iconWrap}><IconLock /></span>
                      <input
                        className="login-input"
                        type={showNewPassword ? 'text' : 'password'}
                        value={forgotData.newPassword}
                        onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                        placeholder="Min. 6 characters"
                        required
                        minLength={6}
                        style={{ ...inputStyle, paddingRight: '36px' }}
                      />
                      <button type="button" style={eyeBtn} onClick={() => setShowNewPassword(p => !p)}>
                        {showNewPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={labelStyle}>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={iconWrap}><IconLock /></span>
                      <input
                        className="login-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={forgotData.confirmPassword}
                        onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                        placeholder="Repeat new password"
                        required
                        style={{ ...inputStyle, paddingRight: '36px' }}
                      />
                      <button type="button" style={eyeBtn} onClick={() => setShowConfirmPassword(p => !p)}>
                        {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      style={{
                        flex: 1, padding: '11px',
                        border: '1.5px solid rgba(168,230,61,0.2)',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: '#6b7280', fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(168,230,61,0.4)'; e.currentTarget.style.color = '#a8e63d'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(168,230,61,0.2)'; e.currentTarget.style.color = '#6b7280'; }}
                    >
                      <IconBack /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="login-btn-primary"
                      style={{
                        flex: 2, padding: '11px',
                        border: 'none', borderRadius: '8px',
                        background: loading ? 'rgba(168,230,61,0.4)' : 'linear-gradient(135deg, #a8e63d 0%, #7bc42a 100%)',
                        color: '#162a16', fontSize: '13px', fontWeight: '700',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 14px rgba(168,230,61,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      {loading ? (
                        <><span style={{ width:'14px',height:'14px',border:'2px solid #162a16',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block' }} /> Resetting…</>
                      ) : (
                        <><IconCheck /> Reset Password</>
                      )}
                    </button>
                  </div>
                </form>
              )}

              <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '11px', color: '#4b5563' }}>
                Contact HR if you need further assistance
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
