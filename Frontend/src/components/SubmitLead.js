import React, { useState } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './SubmitLead.css';

function SubmitLead() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    leadName: '',
    contactNumber: '',
    status: 'New',
    updates: '',
    contactedCount: 0
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'contactedCount' ? parseInt(value) || 0 : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.leadName.trim()) {
      alert('Lead name is required');
      return;
    }
    
    if (!formData.contactNumber.trim()) {
      alert('Contact number is required');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/lead-submissions', formData);
      setSuccessMessage('Lead submitted successfully! ✅');
      
      // Reset form
      setFormData({
        leadName: '',
        contactNumber: '',
        status: 'New',
        updates: '',
        contactedCount: 0
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Submit error:', error);
      alert(error.response?.data?.message || 'Error submitting lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="submit-lead-container">
      <div className="submit-lead-header">
        <h3>📝 Submit Lead Information</h3>
        <p>Share details about leads you've contacted or discovered</p>
      </div>

      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      <form onSubmit={handleSubmit} className="submit-lead-form">
        <div className="form-group">
          <label>Lead Name *</label>
          <input
            type="text"
            name="leadName"
            value={formData.leadName}
            onChange={handleInputChange}
            placeholder="Enter lead name or company name"
            required
          />
        </div>

        <div className="form-group">
          <label>Contact Number *</label>
          <input
            type="tel"
            name="contactNumber"
            value={formData.contactNumber}
            onChange={handleInputChange}
            placeholder="Enter phone number"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Status</label>
            <select 
              name="status" 
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Converted">Converted</option>
              <option value="Invalid">Invalid</option>
              <option value="International">International</option>
            </select>
          </div>

          <div className="form-group">
            <label>Times Contacted</label>
            <input
              type="number"
              name="contactedCount"
              value={formData.contactedCount}
              onChange={handleInputChange}
              min="0"
              placeholder="0"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Updates / Notes</label>
          <textarea
            name="updates"
            value={formData.updates}
            onChange={handleInputChange}
            placeholder="Add any updates or notes about this lead..."
            rows="4"
          />
        </div>

        <button type="submit" className="btn-submit-lead" disabled={loading}>
          {loading ? '⏳ Submitting...' : '📤 Submit Lead'}
        </button>
      </form>
    </div>
  );
}

export default SubmitLead;
