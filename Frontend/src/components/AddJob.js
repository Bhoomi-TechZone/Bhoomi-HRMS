import React, { useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import './RecruitmentDashboard.css';

const AddJob = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        department: '',
        description: '',
        requirements: '',
        eligibilityCriteria: '',
        type: 'Full-time',
        location: 'On-site',
        minSalary: '',
        maxSalary: '',
        salaryCurrency: 'INR',
        salaryPeriod: 'per month',
        minExperience: '',
        minExpUnit: 'years',
        maxExperience: '',
        maxExpUnit: 'years'
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/recruitment/jobs', formData);
            alert('Job posted successfully!');
            navigate('/recruitment/add-job'); // Navigate back to the Jobs List
        } catch (error) {
            console.error('Error posting job', error);
            alert('Failed to post job');
        }
    };

    return (
        <div className="recruitment-container">
            <div className="recruitment-header">
                <div>
                    <h2>Add New Job Opening</h2>
                    <div className="breadcrumb"><span className="bc-parent">Recruit</span><span className="bc-sep"> • </span><span className="bc-current">Add Job</span></div>
                </div>
                {/* Optional: Add a 'Back' button if desired, similar to other pages */}
            </div>

            <div className="dark-card" style={{ maxWidth: '800px', margin: '0 auto', background: 'white' }}>
                {/* Card Header matching project styles */}
                <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: '#16a34a' }}>
                    Job Details
                </h3>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Job Title <span style={{ color: 'red' }}>*</span></label>
                        <input name="title" required value={formData.title} onChange={handleChange} placeholder="e.g. Senior Software Engineer" />
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Department <span style={{ color: 'red' }}>*</span></label>
                            <input name="department" required value={formData.department} onChange={handleChange} placeholder="e.g. Development" />
                        </div>

                        <div className="form-group">
                            <label>Job Type</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                                <option value="Internship">Internship</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Location</label>
                        <input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Noida / On-site" />
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Min Salary {formData.salaryPeriod === 'per annum' ? '(LPA / ₹)' : '(INR ₹)'}</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                name="minSalary"
                                value={formData.minSalary || ''}
                                onChange={handleChange}
                                placeholder={formData.salaryPeriod === 'per annum' ? "e.g. 3.5 or 350000" : "e.g. 25000"}
                            />
                        </div>

                        <div className="form-group">
                            <label>Max Salary {formData.salaryPeriod === 'per annum' ? '(LPA / ₹)' : '(INR ₹)'}</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                name="maxSalary"
                                value={formData.maxSalary || ''}
                                onChange={handleChange}
                                placeholder={formData.salaryPeriod === 'per annum' ? "e.g. 6 or 600000" : "e.g. 50000"}
                            />
                        </div>

                        <div className="form-group">
                            <label>Pay Period</label>
                            <select name="salaryPeriod" value={formData.salaryPeriod || 'per month'} onChange={handleChange}>
                                <option value="per month">Per Month</option>
                                <option value="per annum">Per Annum (CTC)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Minimum Experience</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="number" min="0" step="0.5" name="minExperience" value={formData.minExperience || ''} onChange={handleChange} placeholder="e.g. 1" style={{ flex: 1 }} />
                                <select name="minExpUnit" value={formData.minExpUnit || 'years'} onChange={handleChange} style={{ width: '110px' }}>
                                    <option value="years">Years</option>
                                    <option value="months">Months</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Maximum Experience</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="number" min="0" step="0.5" name="maxExperience" value={formData.maxExperience || ''} onChange={handleChange} placeholder="e.g. 3" style={{ flex: 1 }} />
                                <select name="maxExpUnit" value={formData.maxExpUnit || 'years'} onChange={handleChange} style={{ width: '110px' }}>
                                    <option value="years">Years</option>
                                    <option value="months">Months</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Job Description <span style={{ color: 'red' }}>*</span></label>
                        <textarea name="description" required rows="6" value={formData.description} onChange={handleChange} placeholder="Enter detailed job description..."></textarea>
                    </div>

                    <div className="form-group">
                        <label>Requirements</label>
                        <textarea name="requirements" rows="4" value={formData.requirements} onChange={handleChange} placeholder="List key skills and qualifications..."></textarea>
                    </div>

                    <div className="form-group">
                        <label>Eligibility Criteria</label>
                        <textarea name="eligibilityCriteria" rows="4" value={formData.eligibilityCriteria} onChange={handleChange} placeholder="List eligibility criteria, educational qualifications, age limit, certifications (exact formatting & line breaks are preserved)..." style={{ whiteSpace: 'pre-wrap' }}></textarea>
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn-view" onClick={() => navigate('/recruitment/add-job')}>Cancel</button>
                        <button type="submit" className="btn-submit" style={{ width: 'auto', minWidth: '120px' }}>Post Job</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddJob;
