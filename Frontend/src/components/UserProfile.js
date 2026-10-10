import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, BadgeCheck, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';

function UserProfile() {
  const { user: contextUser, updateUser } = useAuth();
  const [user, setUser] = useState(contextUser);
  const [loading, setLoading] = useState(false);
  const [shiftName, setShiftName] = useState('');
  
  // Toggle visibility states for sensitive fields
  const [showAadhar, setShowAadhar] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showPAN, setShowPAN] = useState(false);

  // Fetch shift configuration details
  const fetchShiftConfig = async (shiftType) => {
    try {
      const response = await api.get(`/shift-configs/${shiftType}`);
      setShiftName(response.data.name);
    } catch (error) {
      console.error('Error fetching shift config:', error);
      setShiftName('');
    }
  };

  // Fetch latest user data
  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/me');
      setUser(response.data);
      // Update the context with latest data
      updateUser(response.data);
      
      // Fetch shift config if shift type exists
      if (response.data.shiftType) {
        fetchShiftConfig(response.data.shiftType);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  // Update local state when context user changes
  useEffect(() => {
    if (contextUser) {
      setUser(contextUser);
      if (contextUser.shiftType) {
        fetchShiftConfig(contextUser.shiftType);
      }
    }
  }, [contextUser]);

  if (loading && !user) {
    return (
      <div className="container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  const FieldDisplay = ({ label, value }) => (
    <div className="form-group">
      <label style={{ 
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '6px',
        display: 'block'
      }}>
        {label}
      </label>
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: '500',
        color: '#1f2937'
      }}>
        {value || 'Not provided'}
      </div>
    </div>
  );

  const SensitiveFieldDisplay = ({ label, value, isVisible, onToggle }) => (
    <div className="form-group">
      <label style={{ 
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '6px',
        display: 'block'
      }}>
        {label}
      </label>
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: '500',
        color: '#1f2937',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{value || 'Not provided'}</span>
        {value && value !== 'Not provided' && (
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280'
            }}
            title={isVisible ? 'Hide' : 'Show'}
          >
            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="container">
      {/* Header Section */}
      <div style={{ marginBottom: '40px' }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            color: '#1a1b1eff',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            Employee Profile
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            margin: '0',
            fontWeight: '400'
          }}>
            View your personal information and employment details
          </p>
        </div>
      </div>
      
      {/* Profile Content */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '300px 1fr', 
        gap: '40px',
        alignItems: 'flex-start',
        maxHeight: 'calc(100vh - 180px)'
      }}>
        {/* Left Section - Profile Avatar (Fixed) */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'sticky',
          top: '20px'
        }}>
          <div style={{
            position: 'relative',
            display: 'inline-block',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: '#0596691F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '6px solid #f0f9f4'
            }}>
              <User size={70} color="#166534" strokeWidth={2} />
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <h2 style={{ 
              color: '#1f2937', 
              fontSize: '32px', 
              fontWeight: '700', 
              margin: '0',
              letterSpacing: '-0.5px',
              textAlign: 'center',
              fontFamily: "'Caveat', cursive"
            }}>
              {user?.firstName} {user?.lastName}
            </h2>
            <BadgeCheck size={28} color="#ffffff" fill="#059669" strokeWidth={2.5} />
          </div>
        </div>

        {/* Right Section - Profile Information (Scrollable) */}
        <div style={{
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 180px)',
          paddingRight: '10px'
        }}>

          {/* Personal Information Section */}
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Personal Information
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <FieldDisplay label="First Name" value={user?.firstName} />
              <FieldDisplay label="Last Name" value={user?.lastName} />
              <FieldDisplay label="Employee ID" value={user?.employeeId} />
              <FieldDisplay label="Gender" value={user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : ''} />
              <FieldDisplay label="Date of Birth" value={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-GB') : ''} />
              <FieldDisplay label="Father's Name" value={user?.fatherName} />
              <FieldDisplay label="Highest Qualification" value={user?.highestQualification} />
              <SensitiveFieldDisplay 
                label="Aadhar Number" 
                value={user?.aadharNumber ? (showAadhar ? user.aadharNumber : `••••••••${user.aadharNumber.slice(-4)}`) : ''} 
                isVisible={showAadhar}
                onToggle={() => setShowAadhar(!showAadhar)}
              />
            </div>
          </div>

          {/* Contact Information Section */}
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Contact Information
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <FieldDisplay label="Personal Email" value={user?.email} />
              <FieldDisplay label="Official Email" value={user?.officialEmail} />
              <FieldDisplay label="Phone Number" value={user?.phone} />
              <FieldDisplay label="Alternate Phone" value={user?.alternatePhone} />
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                  display: 'block'
                }}>
                  Current Address
                </label>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#1f2937'
                }}>
                  {user?.currentAddress || 'Not provided'}
                </div>
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                  display: 'block'
                }}>
                  Permanent Address
                </label>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#1f2937'
                }}>
                  {user?.permanentAddress || 'Not provided'}
                </div>
              </div>
            </div>
          </div>


          {/* Employment Details Section */}
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Employment Details
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <FieldDisplay label="Department" value={user?.department} />
              <FieldDisplay label="Designation" value={user?.designation} />
              <FieldDisplay label="Role" value={user?.role?.name} />
              <FieldDisplay label="Date of Joining" value={user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-GB') : ''} />
              
              <div className="form-group">
                <label style={{ 
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                  display: 'block'
                }}>
                  Employment Status
                </label>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: user?.isActive ? '#22c55e' : '#ef4444',
                    borderRadius: '50%'
                  }}></div>
                  {user?.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <FieldDisplay label="Assigned Manager" value={user?.assignedManager?.firstName ? `${user.assignedManager.firstName} ${user.assignedManager.lastName}` : ''} />
              <FieldDisplay label="Shift Type" value={shiftName} />
              <FieldDisplay 
                label="Shift Timing" 
                value={user?.shiftStartTime && user?.shiftEndTime ? `${user.shiftStartTime} - ${user.shiftEndTime}` : ''} 
              />
            </div>
          </div>

          {/* Banking Details Section */}
          <div>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Banking & Financial Details
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <FieldDisplay label="Bank Name" value={user?.bankName} />
              <SensitiveFieldDisplay 
                label="Account Number" 
                value={user?.accountNumber ? (showAccount ? user.accountNumber : `••••••••${user.accountNumber.slice(-4)}`) : ''} 
                isVisible={showAccount}
                onToggle={() => setShowAccount(!showAccount)}
              />
              <FieldDisplay label="IFSC Code" value={user?.ifscCode} />
              <FieldDisplay label="Account Holder Name" value={user?.accountHolderName} />
              <SensitiveFieldDisplay 
                label="PAN Number" 
                value={user?.panNumber ? (showPAN ? user.panNumber : `••••••${user.panNumber.slice(-4)}`) : ''} 
                isVisible={showPAN}
                onToggle={() => setShowPAN(!showPAN)}
              />
              <FieldDisplay label="UPI ID" value={user?.upiId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
