import { downloadHtmlAsPdf } from '../utils/pdfDownloadHelper';
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './DocumentGenerator.css';

function DocumentGenerator() {
  const { user, hasPermission } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list', 'generate', 'preview'
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const hasAccess = hasPermission('documents', 'create') || hasPermission('documents', 'read');

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get('/document-generator/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/document-generator');
      setDocuments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchTemplates();
      fetchDocuments();
    }
  }, [fetchTemplates, fetchDocuments, hasAccess]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    const initialData = {};
    template.placeholders.forEach(placeholder => {
      initialData[placeholder.key] = placeholder.defaultValue || '';
    });
    setFormData(initialData);
    setViewMode('generate');
  };

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePreview = async () => {
    try {
      const response = await api.post('/document-generator/preview', {
        templateId: selectedTemplate._id,
        placeholderData: formData
      });
      setPreviewHtml(response.data.html);
      setViewMode('preview');
    } catch (error) {
      alert('Error generating preview');
      console.error(error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/document-generator/generate', {
        templateId: selectedTemplate._id,
        placeholderData: formData,
        title: `${selectedTemplate.name} - ${formData.candidate_name || formData.employee_name || 'Document'}`,
        metadata: {
          clientName: formData.candidate_name || formData.employee_name,
          position: formData.position || formData.designation,
          department: formData.department
        }
      });
      alert('Document generated successfully!');
      fetchDocuments();
      setViewMode('list');
      setSelectedTemplate(null);
      setFormData({});
      setGenerating(false);
    } catch (error) {
      alert('Error generating document: ' + (error.response?.data?.message || error.message));
      console.error(error);
      setGenerating(false);
    }
  };

  const handleDownload = async (docId) => {
    const doc = documents.find(d => d._id === docId);
    const rawFileName = doc?.title ? `${doc.title}.pdf` : `document-${docId}.pdf`;
    const cleanFileName = rawFileName.replace(/[/\\?%*:|"<>]/g, '_');

    try {
      let downloaded = false;
      try {
        const response = await api.get(`/document-generator/${docId}/download`, { responseType: 'blob' });
        if (response.data && response.data.type !== 'application/json' && response.data.size > 500) {
          const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = cleanFileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          downloaded = true;
        }
      } catch (serverErr) {
        console.warn('Server download failed, using client generator:', serverErr.message);
      }

      if (!downloaded) {
        if (doc?.finalHtml && doc.finalHtml.length > 50 && !doc.finalHtml.includes('Document generated in DOCX format.')) {
          await downloadHtmlAsPdf(doc.finalHtml, cleanFileName);
          downloaded = true;
        } else {
          throw new Error('Document content not available for PDF generation');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading document: ' + (error.message || 'File not available'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await api.delete(`/document-generator/${id}`);
        fetchDocuments();
      } catch (error) {
        alert('Error deleting document');
      }
    }
  };

  const filteredDocuments = documents.filter(d =>
    d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.metadata?.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasAccess) {
    return (
      <div className="docgen-container">
        <div className="docgen-access-denied">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="docgen-access-title">Access Denied</div>
          <p>You do not have permission to access the Document Generator.</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'preview') {
    return (
      <div className="docgen-container">
        <div className="docgen-header">
          <div className="docgen-header-left">
            <button onClick={() => setViewMode('generate')} className="docgen-back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div>
              <div className="docgen-title">Preview Document</div>
              <div className="docgen-subtitle">Review before generating PDF</div>
            </div>
          </div>
          <div className="docgen-header-actions">
            <button onClick={() => setViewMode('generate')} className="docgen-btn-ghost">Edit</button>
            <button onClick={handleGenerate} className="docgen-btn-primary" disabled={generating}>
              {generating ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        <div className="docgen-preview-container">
          <div className="docgen-preview-paper" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    );
  }

  if (viewMode === 'generate' && selectedTemplate) {
    return (
      <div className="docgen-container">
        <div className="docgen-header">
          <div className="docgen-header-left">
            <button onClick={() => { setViewMode('list'); setSelectedTemplate(null); }} className="docgen-back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div>
              <div className="docgen-title">Generate: {selectedTemplate.name}</div>
              <div className="docgen-subtitle">Fill in the required information</div>
            </div>
          </div>
        </div>

        <div className="docgen-form-container">
          <div className="docgen-form-card">
            <div className="docgen-form-grid">
              {selectedTemplate.placeholders.map((placeholder) => (
                <div key={placeholder.key} className="docgen-form-field">
                  <label className="docgen-form-label">
                    {placeholder.label}
                    {placeholder.required && <span className="docgen-required">*</span>}
                  </label>
                  
                  {placeholder.type === 'textarea' ? (
                    <textarea
                      className="docgen-input"
                      value={formData[placeholder.key] || ''}
                      onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                      rows="3"
                      required={placeholder.required}
                    />
                  ) : placeholder.type === 'select' ? (
                    <select
                      className="docgen-input"
                      value={formData[placeholder.key] || ''}
                      onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                      required={placeholder.required}
                    >
                      <option value="">Select...</option>
                      {placeholder.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={placeholder.type || 'text'}
                      className="docgen-input"
                      value={formData[placeholder.key] || ''}
                      onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                      required={placeholder.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="docgen-form-actions">
              <button onClick={() => { setViewMode('list'); setSelectedTemplate(null); }} className="docgen-btn-ghost">
                Cancel
              </button>
              <button onClick={handlePreview} className="docgen-btn-primary">
                Preview Document
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="docgen-container">
        <div className="docgen-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="docgen-container">
      <div className="docgen-header">
        <div className="docgen-header-left">
          <div>
            <div className="docgen-title">Document Generator</div>
            <div className="docgen-subtitle">Create professional HR documents with templates</div>
          </div>
        </div>
      </div>

      {/* Template Selection Cards */}
      <div className="docgen-section-title">Select a Template</div>
      <div className="docgen-template-grid">
        {templates.map((template) => (
          <div key={template._id} className="docgen-template-card" onClick={() => handleTemplateSelect(template)}>
            <div className="docgen-template-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div className="docgen-template-name">{template.name}</div>
            <div className="docgen-template-desc">{template.description}</div>
            <div className="docgen-template-type">{template.type.replace('_', ' ').toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Generated Documents List */}
      <div className="docgen-section-title">Generated Documents</div>
      <div className="docgen-table-card">
        <div className="docgen-table-header">
          <div className="docgen-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="docgen-count">{filteredDocuments.length} of {documents.length}</span>
        </div>

        <div className="docgen-table-wrapper">
          <table className="docgen-table">
            <thead>
              <tr>
                <th>Document #</th>
                <th>Title</th>
                <th>Type</th>
                <th>For</th>
                <th>Generated By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="docgen-empty">
                    No documents generated yet. Select a template above to get started.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc._id}>
                    <td className="docgen-doc-number">{doc.documentNumber}</td>
                    <td className="docgen-doc-title">{doc.title}</td>
                    <td>{doc.template?.type.replace('_', ' ')}</td>
                    <td>{doc.metadata?.clientName || '—'}</td>
                    <td>{doc.generatedBy?.name}</td>
                    <td>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <span className={`docgen-status docgen-status-${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      <div className="docgen-actions">
                        <button onClick={() => handleDownload(doc._id)} className="docgen-action-btn" title="Download">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(doc._id)} className="docgen-action-btn docgen-action-delete" title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DocumentGenerator;
