import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import './LeadSubmissions.css';

function LeadSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await axios.get('/lead-submissions');
      setSubmissions(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this lead submission?')) {
      try {
        await axios.delete(`/lead-submissions/${id}`);
        setSubmissions(submissions.filter(sub => sub._id !== id));
        alert('Submission deleted successfully!');
      } catch (error) {
        console.error('Delete error:', error);
        alert(error.response?.data?.message || 'Error deleting submission');
      }
    }
  };

  const startEdit = (submission) => {
    setEditingId(submission._id);
    setEditFormData({
      status: submission.status,
      updates: submission.updates,
      contactedCount: submission.contactedCount
    });
  };

  const saveEdit = async (id) => {
    try {
      const response = await axios.put(`/lead-submissions/${id}`, editFormData);
      setSubmissions(submissions.map(sub => sub._id === id ? response.data : sub));
      setEditingId(null);
      alert('Submission updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      alert(error.response?.data?.message || 'Error updating submission');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: name === 'contactedCount' ? parseInt(value) || 0 : value
    });
  };

  if (loading) {
    return <div className="loading">Loading submissions...</div>;
  }

  return (
    <div className="submissions-container">
      <div className="submissions-header">
        <h3>📋 Lead Submissions</h3>
        <p>Employees' submitted leads and their current status</p>
      </div>

      {submissions.length === 0 ? (
        <div className="no-submissions">
          <p>📭 No lead submissions yet</p>
          <p className="subtitle">Employees will submit their leads here</p>
        </div>
      ) : (
        <div className="submissions-table-wrapper">
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Lead Name</th>
                <th>Contact</th>
                <th>Submitted By</th>
                <th>Status</th>
                <th>Contacted</th>
                <th>Updates</th>
                <th>Submitted Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission._id} className={`submission-row status-${submission.status.toLowerCase().replace(/\s/g, '-')}`}>
                  <td className="lead-name">{submission.leadName}</td>
                  <td>{submission.contactNumber}</td>
                  <td>
                    <span className="employee-badge">
                      {submission.submittedBy?.firstName} {submission.submittedBy?.lastName}
                    </span>
                  </td>
                  <td>
                    {editingId === submission._id ? (
                      <select 
                        name="status"
                        value={editFormData.status}
                        onChange={handleEditChange}
                        className="edit-select"
                      >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Interested">Interested</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Converted">Converted</option>
                      </select>
                    ) : (
                      <span className={`status-badge status-${submission.status.toLowerCase().replace(/\s/g, '-')}`}>
                        {submission.status}
                      </span>
                    )}
                  </td>
                  <td className="contacted-count">
                    {editingId === submission._id ? (
                      <input 
                        type="number"
                        name="contactedCount"
                        value={editFormData.contactedCount}
                        onChange={handleEditChange}
                        className="edit-input"
                        min="0"
                      />
                    ) : (
                      submission.contactedCount
                    )}
                  </td>
                  <td className="updates-cell">
                    {editingId === submission._id ? (
                      <textarea 
                        name="updates"
                        value={editFormData.updates}
                        onChange={handleEditChange}
                        className="edit-textarea"
                        rows="2"
                      />
                    ) : (
                      <span className="updates-text">{submission.updates || '—'}</span>
                    )}
                  </td>
                  <td className="date-cell">
                    {new Date(submission.createdAt).toLocaleDateString()}
                  </td>
                  <td className="actions-cell">
                    {editingId === submission._id ? (
                      <div className="edit-actions">
                        <button 
                          className="btn-save"
                          onClick={() => saveEdit(submission._id)}
                        >
                          ✓ Save
                        </button>
                        <button 
                          className="btn-cancel"
                          onClick={cancelEdit}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button 
                          className="btn-edit"
                          onClick={() => startEdit(submission)}
                          title="Edit submission"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDelete(submission._id)}
                          title="Delete submission"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LeadSubmissions;
