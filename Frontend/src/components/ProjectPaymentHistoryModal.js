import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import './Pipeline.css';

const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function ProjectPaymentHistoryModal({
  isOpen,
  onClose,
  project, // Project object (from ClientPayments or Projects)
  onPaymentUpdated, // Callback to refresh parent list
  currentUser
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add payment form state
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [notes, setNotes] = useState('');

  const projId = project?._id || project?.id;
  const projectName = project?.projectName || project?.name || 'Project';
  const clientName = project?.clientName || project?.clientCompany || project?.client?.name || 'Client';
  const clientEmail = project?.clientEmail || project?.email || project?.client?.email || '';

  // Calculate project values (base amount only, without GST)
  const totalAmount = parseAmount(project?.baseAmount || project?.projectValue || project?.budget || project?.totalAmount || 0);
  const baseValue = totalAmount;
  
  // Calculate paid & pending from records dynamically (or fallback to project.paidAmount)
  const paidFromRecords = records
    .filter(r => (r.paymentStatus || 'Paid').toLowerCase() === 'paid')
    .reduce((sum, r) => sum + parseAmount(r.paidAmount), 0);

  const effectivePaid = records.length > 0 ? paidFromRecords : parseAmount(project?.paidAmount || 0);
  const effectiveDue = Math.max(0, totalAmount - effectivePaid);
  const isFullyPaid = totalAmount > 0 && effectiveDue <= 0;

  const fetchRecords = useCallback(async () => {
    if (!projId) return;
    setLoading(true);
    try {
      const res = await api.get(`/payment-records?projectId=${projId}`);
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Fetch payment records error:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [projId]);

  useEffect(() => {
    if (isOpen && projId) {
      fetchRecords();
      setShowAddForm(false);
      setAmount('');
      setNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Bank Transfer');
      setPaymentStatus('Paid');
    }
  }, [isOpen, projId, fetchRecords]);

  if (!isOpen || !project) return null;

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const numAmount = parseAmount(amount);
    if (numAmount <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (effectiveDue > 0 && numAmount > effectiveDue) {
      const confirmOverpay = window.confirm(
        `Note: The amount entered (₹${numAmount.toLocaleString('en-IN')}) exceeds the remaining pending balance of ₹${effectiveDue.toLocaleString('en-IN')}.\n\nDo you want to proceed with recording this payment?`
      );
      if (!confirmOverpay) return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

      const formattedPaidDate = paymentDate
        ? new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
        : defaultRecordedDate;

      const payload = {
        projectId: projId,
        clientName: clientName,
        clientEmail: clientEmail,
        projectName: projectName,
        paidAmount: `₹ ${numAmount.toLocaleString('en-IN')}`,
        paymentMode: paymentMode || 'Bank Transfer',
        paymentStatus: paymentStatus || 'Paid',
        paymentDate: formattedPaidDate,
        recordedOnDate: defaultRecordedDate,
        recordedOnTime: defaultRecordedTime,
        recordedOn: `${defaultRecordedDate}, ${defaultRecordedTime}`,
        notes: notes || ''
      };

      await api.post('/payment-records', payload);

      // Reset form
      setAmount('');
      setNotes('');
      setShowAddForm(false);

      // Refresh records and parent list
      await fetchRecords();
      if (onPaymentUpdated) {
        onPaymentUpdated();
      }
      alert('Payment record added successfully!');
    } catch (err) {
      console.error('Error saving payment record:', err);
      alert('Failed to save payment record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recId) => {
    if (!window.confirm('Are you sure you want to delete this payment record? The total received amount will be adjusted.')) {
      return;
    }
    try {
      await api.delete(`/payment-records/${recId}`);
      await fetchRecords();
      if (onPaymentUpdated) {
        onPaymentUpdated();
      }
    } catch (err) {
      console.error('Error deleting payment record:', err);
      alert('Failed to delete payment record.');
    }
  };

  const handleUpdateRecordStatus = async (recId, newStatus) => {
    try {
      setLoading(true);
      await api.put(`/payment-records/${recId}`, { paymentStatus: newStatus });
      await fetchRecords();
      if (onPaymentUpdated) {
        onPaymentUpdated();
      }
    } catch (err) {
      console.error('Error updating payment record status:', err);
      alert('Failed to update payment record status.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFullPaid = async () => {
    if (effectiveDue <= 0) return;
    if (!window.confirm(`Mark remaining balance of ₹${effectiveDue.toLocaleString('en-IN')} as fully Paid for this project?`)) return;
    try {
      setSubmitting(true);
      const now = new Date();
      const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

      await api.post('/payment-records', {
        projectId: projId,
        clientName,
        clientEmail,
        projectName,
        paidAmount: `₹ ${effectiveDue.toLocaleString('en-IN')}`,
        paymentMode: 'Bank Transfer',
        paymentStatus: 'Paid',
        paymentDate: defaultRecordedDate,
        recordedOnDate: defaultRecordedDate,
        recordedOnTime: defaultRecordedTime,
        recordedOn: `${defaultRecordedDate}, ${defaultRecordedTime}`,
        notes: `Marked as full payment by ${currentUser?.firstName || currentUser?.name || 'Admin'}`
      });

      await fetchRecords();
      if (onPaymentUpdated) {
        onPaymentUpdated();
      }
      alert('Full remaining payment marked as Paid successfully!');
    } catch (err) {
      console.error('Error recording full payment:', err);
      alert('Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="pipeline-milestone-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pipeline-milestone-modal-card" style={{ maxWidth: '980px' }}>
        {/* Header */}
        <div className="pipeline-milestone-modal-header">
          <div className="pipeline-milestone-modal-header-left">
            <div className="pipeline-milestone-modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="pipeline-milestone-modal-title">Payment History & Records</h2>
              <p className="pipeline-milestone-modal-subtitle">
                Project: <strong>{projectName}</strong> • Client: {clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pipeline-milestone-modal-close-btn"
            onClick={onClose}
            title="Close"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Summary Tiles */}
        <div className="pipeline-milestone-modal-summary-row">
          <div className="pipeline-milestone-summary-tile">
            <div className="pipeline-milestone-summary-tile-label">Total Amount</div>
            <div className="pipeline-milestone-summary-tile-val blue">
              ₹{totalAmount.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Base Project Value
            </div>
          </div>

          <div className="pipeline-milestone-summary-tile">
            <div className="pipeline-milestone-summary-tile-label">Total Received</div>
            <div className="pipeline-milestone-summary-tile-val green">
              ₹{effectivePaid.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
              {totalAmount > 0 ? `${Math.round((effectivePaid / totalAmount) * 100)}% Collected` : '0%'}
            </div>
          </div>

          <div className="pipeline-milestone-summary-tile">
            <div className="pipeline-milestone-summary-tile-label">Pending Due</div>
            <div className="pipeline-milestone-summary-tile-val orange" style={{ color: effectiveDue > 0 ? '#ea580c' : '#16a34a' }}>
              ₹{effectiveDue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '10px', color: effectiveDue > 0 ? '#ea580c' : '#16a34a', marginTop: '2px', fontWeight: 600 }}>
              {effectiveDue <= 0 ? '✓ Fully Settled' : 'Payment Awaited'}
            </div>
          </div>

          <div className="pipeline-milestone-summary-tile">
            <div className="pipeline-milestone-summary-tile-label">Payment Entries</div>
            <div className="pipeline-milestone-summary-tile-val">
              {records.length}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Received Installments
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="pipeline-milestone-modal-body">
          {/* Toolbar */}
          <div className="pipeline-milestone-modal-toolbar">
            <span className="pipeline-milestone-modal-toolbar-title">
              Received Payment Installments ({records.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isFullyPaid ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Fully Paid
                </span>
              ) : (
                <>
                  {effectiveDue > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkFullPaid}
                      disabled={submitting}
                      title="Mark full remaining due as Paid"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      Mark Full Paid
                    </button>
                  )}
                  <button
                    type="button"
                    className="pipeline-add-payment-btn"
                    onClick={() => setShowAddForm(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: showAddForm ? '#f1f5f9' : '#16a34a',
                      color: showAddForm ? '#334155' : '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {showAddForm ? (
                        <>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </>
                      ) : (
                        <>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </>
                      )}
                    </svg>
                    {showAddForm ? 'Cancel Entry' : 'Add Payment'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Add Payment Form (collapsible) */}
          {showAddForm && (
            <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
                  Record New Payment Installment
                </div>
                {effectiveDue > 0 && (
                  <span style={{ fontSize: '11px', color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    Remaining Due: ₹{effectiveDue.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <form onSubmit={handleSavePayment}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Amount Received (₹) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      placeholder={`e.g. ${effectiveDue > 0 ? effectiveDue : 5000}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Payment Date <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ width: '100%', padding: '7.5px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Payment Mode <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: '#fff' }}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI / Wallet">UPI / QR Code</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Status
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: '#fff' }}
                    >
                      <option value="Paid">Paid / Received</option>
                      <option value="Partial">Partial</option>
                      <option value="Pending">Pending Verification</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Notes / Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR / Transaction ID #123456, cheque number, or bank details"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                  >
                    {submitting ? 'Saving...' : 'Save Payment Record'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records Table */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Loading payment history records...
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '30px', marginBottom: '6px' }}>💳</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>No payment records found for this project</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '360px', margin: '4px auto 14px' }}>
                You can record payments in installments until the total project amount is fully received.
              </div>
              {!isFullyPaid && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  style={{ padding: '7px 16px', borderRadius: '8px', background: '#16a34a', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add First Payment
                </button>
              )}
            </div>
          ) : (
            <div className="pipeline-milestone-table-wrap" style={{ maxHeight: '360px' }}>
              <table className="pipeline-milestone-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Payment Date</th>
                    <th>Amount Paid</th>
                    <th>Payment Mode</th>
                    <th>Status</th>
                    <th>Notes / Ref</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'center', width: '50px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => (
                    <tr key={rec._id || idx}>
                      <td style={{ fontWeight: 700, color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {rec.paymentDate || rec.recordedOnDate || '—'}
                      </td>
                      <td style={{ fontWeight: 700, color: '#16a34a', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        {rec.paidAmount?.startsWith('₹') ? rec.paidAmount : `₹ ${parseAmount(rec.paidAmount).toLocaleString('en-IN')}`}
                      </td>
                      <td>
                        <span className="pipeline-milestone-mode-pill">
                          {rec.paymentMode || 'Bank Transfer'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const isPaid = (rec.paymentStatus || 'Paid').toLowerCase() === 'paid';
                          const bg = isPaid ? '#dcfce7' : '#fef3c7';
                          const color = isPaid ? '#15803d' : '#b45309';
                          const border = isPaid ? '#86efac' : '#fcd34d';
                          const chevron = isPaid ? '%2315803d' : '%23b45309';

                          return (
                            <select
                              value={isPaid ? 'Paid' : 'Pending'}
                              onChange={(e) => handleUpdateRecordStatus(rec._id, e.target.value)}
                              title="Update Payment Record Status"
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                background: `${bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${chevron}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 8px center`,
                                color: color,
                                border: `1.5px solid ${border}`,
                                borderRadius: '50px',
                                padding: '3px 22px 3px 9px',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              <option value="Paid" style={{ background: '#fff', color: '#15803d' }}>PAID</option>
                              <option value="Pending" style={{ background: '#fff', color: '#b45309' }}>PENDING</option>
                            </select>
                          );
                        })()}
                      </td>
                      <td style={{ color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.notes || '—'}
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {rec.createdBy ? `${rec.createdBy.firstName || ''} ${rec.createdBy.lastName || ''}`.trim() : (rec.recordedOnTime || 'Admin')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec._id)}
                          title="Delete payment record"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 26px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fafbfc' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
