import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, Trash2, Edit2, Download, Plus, X, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './Templates.css';

function Templates() {
    const { user, hasPermission } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Check if user has permission for proposals module
    const hasAccess = hasPermission('proposals', 'read') || hasPermission('proposals', 'create');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'custom',
        content: '',
        file: null
    });

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/proposal-templates');
            setTemplates(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching templates:', error);
            if (error.response?.status === 403) {
                alert('Access denied. You do not have permission to view templates.');
            }
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasAccess) {
            fetchTemplates();
        }
    }, [fetchTemplates, hasAccess]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['text/html', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
            if (!allowedTypes.includes(file.type) && !file.name.match(/\.(html|htm|pdf|docx|txt)$/i)) {
                alert('Please upload HTML, PDF, DOCX, or TXT files only');
                return;
            }
            
            setFormData(prev => ({ ...prev, file }));

            // If HTML file, read and display content
            if (file.type === 'text/html' || file.name.endsWith('.html')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setFormData(prev => ({ ...prev, content: e.target.result }));
                };
                reader.readAsText(file);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('description', formData.description);
            submitData.append('type', formData.type);
            submitData.append('content', formData.content);
            
            if (formData.file) {
                submitData.append('template', formData.file);
            }

            if (selectedTemplate) {
                // Update existing template
                await api.put(`/proposal-templates/${selectedTemplate._id}`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(progress);
                    }
                });
                alert('Template updated successfully');
            } else {
                // Create new template
                await api.post('/proposal-templates', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(progress);
                    }
                });
                alert('Template created successfully');
            }

            resetForm();
            fetchTemplates();
            setViewMode('list');
            setUploadProgress(0);
        } catch (error) {
            console.error('Error saving template:', error);
            alert(error.response?.data?.message || 'Error saving template');
            setUploadProgress(0);
        }
    };

    const handleEdit = (template) => {
        setSelectedTemplate(template);
        setFormData({
            name: template.name,
            description: template.description || '',
            type: template.type || 'custom',
            content: template.content || '',
            file: null
        });
        setViewMode('create');
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            try {
                await api.delete(`/proposal-templates/${id}`);
                alert('Template deleted successfully');
                fetchTemplates();
            } catch (error) {
                console.error('Error deleting template:', error);
                alert('Error deleting template');
            }
        }
    };

    const handleConvert = async (template) => {
        try {
            await api.post(`/proposal-templates/${template._id}/convert`);
            fetchTemplates();
        } catch (error) {
            alert('Conversion failed: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDownload = async (template) => {
        if (template.filePath) {
            // Download file from server
            try {
                const response = await api.get(`/proposal-templates/${template._id}/download`, {
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', template.fileName || `${template.name}.html`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } catch (error) {
                console.error('Error downloading file:', error);
                alert('Error downloading template file');
            }
        } else if (template.content) {
            // Download content as text file
            const blob = new Blob([template.content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${template.name}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            type: 'custom',
            content: '',
            file: null
        });
        setSelectedTemplate(null);
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getTypeColor = (type) => {
        const colors = {
            standard: '#60a5fa',
            marketing: '#f472b6',
            software: '#a78bfa',
            custom: '#34d399'
        };
        return colors[type] || colors.custom;
    };

    const getTypeLabel = (type) => {
        const labels = {
            standard: 'Standard',
            marketing: 'Marketing',
            software: 'Software',
            custom: 'Custom'
        };
        return labels[type] || 'Custom';
    };

    if (!hasAccess) {
        return (
            <div className="templates-access-denied">
                <FileText size={48} color="#e11d48" />
                <h2 className="templates-access-title">Access Denied</h2>
                <p>Only Admin and HR roles can manage templates.</p>
            </div>
        );
    }

    return (
        <div className="templates-container">
            {viewMode === 'list' && (
                <>
                    <div className="templates-header">
                        <div className="templates-header-left">
                            <div className="templates-title-wrap">
                                <FileText size={18} color="#111827" />
                                <h1 className="templates-title">Templates</h1>
                            </div>
                            <p className="templates-subtitle">Manage multiple templates</p>
                        </div>
                        <button className="templates-btn-primary" onClick={() => { setViewMode('create'); resetForm(); }}>
                            <Plus size={16} />
                            New Template
                        </button>
                    </div>

                    <div className="templates-table-card">
                        <div className="templates-table-header">
                            <div className="templates-search-box">
                                <Search size={16} color="#9ca3af" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <span className="templates-count">{filteredTemplates.length} result{filteredTemplates.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="templates-table-wrapper">
                            {loading ? (
                                <div className="templates-loading">Loading templates...</div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="templates-empty">
                                    <FileText size={48} color="#d1d5db" />
                                    <p>No templates found</p>
                                </div>
                            ) : (
                                <table className="templates-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                            <th>Created By</th>
                                            <th>Created</th>
                                            <th>File</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTemplates.map(template => (
                                            <tr key={template._id}>
                                                <td>
                                                    <div className="templates-name">{template.name}</div>
                                                </td>
                                                <td>
                                                    <span className="templates-type-badge" style={{ background: `${getTypeColor(template.type)}20`, color: getTypeColor(template.type) }}>
                                                        {getTypeLabel(template.type)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="templates-desc">{template.description || '—'}</div>
                                                </td>
                                                <td className="templates-creator">
                                                    {template.createdBy?.firstName} {template.createdBy?.lastName}
                                                </td>
                                                <td className="templates-date">
                                                    {new Date(template.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td>
                                                    {template.fileName ? (
                                                        <span className="templates-file-badge">
                                                            <FileText size={12} />
                                                            {template.fileName.split('.').pop().toUpperCase()}
                                                        </span>
                                                    ) : (
                                                        <span className="templates-file-badge templates-file-text">TEXT</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="templates-actions">
                                                        <button className="templates-action-btn" onClick={() => handleEdit(template)} title="Edit">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        {(template.filePath || template.content) && (
                                                            <button className="templates-action-btn" onClick={() => handleDownload(template)} title="Download">
                                                                <Download size={14} />
                                                            </button>
                                                        )}
                                                        {template.filePath && !template.content && (
                                                            <button
                                                                className="templates-action-btn templates-action-convert"
                                                                onClick={() => handleConvert(template)}
                                                                title="Convert DOCX to HTML for letter generation"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="23 4 23 10 17 10"/>
                                                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button className="templates-action-btn templates-action-delete" onClick={() => handleDelete(template._id)} title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}

            {viewMode === 'create' && (
                <div className="templates-form-container">
                    <div className="templates-header">
                        <div className="templates-header-left">
                            <button className="templates-back-btn" onClick={() => { setViewMode('list'); resetForm(); }}>
                                <X size={16} />
                            </button>
                            <div>
                                <div className="templates-title-wrap">
                                    <FileText size={18} color="#111827" />
                                    <h1 className="templates-title">{selectedTemplate ? 'Edit Template' : 'Create Template'}</h1>
                                </div>
                                <p className="templates-subtitle">Upload or create a new template</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="templates-form-card">
                        <div className="templates-form-grid">
                            <div className="templates-form-field">
                                <label className="templates-form-label">
                                    Template Name <span className="templates-required">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    className="templates-input"
                                    placeholder="e.g. Software Proposal Template"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="templates-form-field">
                                <label className="templates-form-label">Type</label>
                                <select
                                    name="type"
                                    className="templates-input"
                                    value={formData.type}
                                    onChange={handleChange}
                                >
                                    <option value="standard">Standard</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="software">Software</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                        </div>

                        <div className="templates-form-field">
                            <label className="templates-form-label">Description</label>
                            <input
                                type="text"
                                name="description"
                                className="templates-input"
                                placeholder="Brief description of this template"
                                value={formData.description}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="templates-form-field">
                            <label className="templates-form-label">Upload Template File</label>
                            <div className="templates-upload-box">
                                <input
                                    type="file"
                                    id="template-file"
                                    accept=".html,.htm,.pdf,.docx,.txt"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="template-file" className="templates-upload-label">
                                    <Upload size={24} color="#3b775e" />
                                    <div>
                                        <div className="templates-upload-text">
                                            {formData.file ? formData.file.name : 'Click to upload or drag and drop'}
                                        </div>
                                        <div className="templates-upload-hint">HTML, PDF, DOCX, or TXT (Max 10MB)</div>
                                    </div>
                                </label>
                            </div>
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="templates-progress-bar">
                                    <div className="templates-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            )}
                        </div>

                        <div className="templates-form-field">
                            <label className="templates-form-label">
                                Template Content
                                <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '11px', marginLeft: '6px' }}>
                                    (or write directly)
                                </span>
                            </label>
                            <textarea
                                name="content"
                                className="templates-input templates-textarea"
                                rows="12"
                                placeholder="Enter template content here..."
                                value={formData.content}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="templates-form-actions">
                            <button type="button" className="templates-btn-ghost" onClick={() => { setViewMode('list'); resetForm(); }}>
                                Cancel
                            </button>
                            <button type="submit" className="templates-btn-primary" disabled={!formData.name || uploadProgress > 0}>
                                {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : selectedTemplate ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default Templates;
