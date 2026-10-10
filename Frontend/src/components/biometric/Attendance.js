import { useEffect, useState } from 'react';
import api from '../../api/axios';
import './Attendance.css';

function BiometricAttendance() {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [processedAttendance, setProcessedAttendance] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'processed'
  
  // View Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

  useEffect(() => {
    fetchDevices();
    fetchAttendanceLogs();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await api.get('/biometric/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchAttendanceLogs = async () => {
    setLoading(true);
    try {
      let url = '/biometric/attendance-logs?';
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;
      if (selectedDevice) url += `deviceId=${selectedDevice}&`;

      const response = await api.get(url);
      setAttendanceLogs(response.data);
    } catch (error) {
      console.error('Error fetching attendance logs:', error);
      alert('Error fetching biometric attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedAttendance = async () => {
    setLoading(true);
    try {
      let url = '/biometric/processed-attendance?';
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;

      const response = await api.get(url);
      setProcessedAttendance(response.data);
    } catch (error) {
      console.error('Error fetching processed attendance:', error);
      alert('Error fetching processed attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setCurrentPage(1);
    if (activeTab === 'logs') {
      fetchAttendanceLogs();
    } else {
      fetchProcessedAttendance();
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab === 'logs') {
      fetchAttendanceLogs();
    } else {
      fetchProcessedAttendance();
    }
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      present: 'badge-success',
      absent: 'badge-danger',
      'half-day': 'badge-warning',
      null: 'badge-info',
      undefined: 'badge-info'
    };
    return badges[status] || 'badge-info';
  };

  const getPunchTypeBadge = (punchType) => {
    const types = {
      'IN': 'badge-success',
      'OUT': 'badge-danger',
      'BREAK_START': 'badge-warning',
      'BREAK_END': 'badge-info'
    };
    return types[punchType] || 'badge-secondary';
  };

  // Pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = activeTab === 'logs' 
    ? attendanceLogs.slice(indexOfFirstRecord, indexOfLastRecord)
    : processedAttendance.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil((activeTab === 'logs' ? attendanceLogs.length : processedAttendance.length) / recordsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleViewDetails = async (employeeId) => {
    setLoadingDetails(true);
    setShowDetailsModal(true);
    setDetailsData(null);

    try {
      const response = await api.get(`/payroll/employee-attendance/${employeeId}`, {
        params: { month: selectedMonth, year: selectedYear }
      });
      setDetailsData(response.data);
    } catch (error) {
      console.error('Error fetching employee details:', error);
      const errorMessage = error.response?.data?.message || 'Error loading attendance details. Please try again.';
      alert(errorMessage);
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="container biometric-attendance-container">
      <div className="page-header">
        <h1 className="page-title">Biometric Attendance</h1>
      </div>

      {/* Filters Card */}
      <div className="card filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {activeTab === 'logs' && (
            <div className="form-group">
              <label>Device</label>
              <select
                className="form-control"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                <option value="">All Devices</option>
                {devices.map(device => (
                  <option key={device._id} value={device._id}>
                    {device.deviceName} - {device.location}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleFilter}>
              <i className="fas fa-filter"></i> Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleTabChange('logs')}
        >
          <i className="fas fa-list"></i> Raw Logs
        </button>
        <button
          className={`tab-button ${activeTab === 'processed' ? 'active' : ''}`}
          onClick={() => handleTabChange('processed')}
        >
          <i className="fas fa-calendar-check"></i> Processed Attendance
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance data...</p>
        </div>
      )}

      {/* Raw Logs Tab */}
      {!loading && activeTab === 'logs' && (
        <div className="card">
          <div className="card-header">
            <h3>
              <i className="fas fa-fingerprint"></i> Biometric Punch Logs
            </h3>
            <span className="record-count">{attendanceLogs.length} records</span>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Punch Time</th>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Biometric User ID</th>
                  <th>Punch Type</th>
                  <th>Device</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      No biometric logs found. Please adjust your filters.
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((log) => (
                    <tr key={log._id}>
                      <td className="timestamp-cell">{formatDateTime(log.punchTime)}</td>
                      <td>
                        {log.employee ? (
                          <div className="employee-info">
                            <strong>{log.employee.firstName} {log.employee.lastName}</strong>
                            <small>{log.employee.email}</small>
                          </div>
                        ) : (
                          <span className="text-muted">Not Mapped</span>
                        )}
                      </td>
                      <td>{log.employee?.employeeId || 'N/A'}</td>
                      <td><code>{log.biometricUserId}</code></td>
                      <td>
                        <span className={`badge ${getPunchTypeBadge(log.punchType)}`}>
                          {log.punchType || 'UNKNOWN'}
                        </span>
                      </td>
                      <td>{log.device?.deviceName || 'N/A'}</td>
                      <td>{log.device?.location || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Processed Attendance Tab */}
      {!loading && activeTab === 'processed' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>9
                    <td colSpan="8" className="text-center">
                      No processed attendance found. Please adjust your filters.
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((record) => (
                    <tr key={record._id}>
                      <td>{new Date(record.date).toLocaleDateString('en-IN')}</td>
                      <td>
                        {record.employee ? (
                          <div className="employee-info">
                            <strong>{record.employee.firstName} {record.employee.lastName}</strong>
                            <small>{record.employee.email}</small>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>{record.employee?.employeeId || 'N/A'}</td>
                      <td className="time-cell">{formatTime(record.loginTime)}</td>
                      <td className="time-cell">{formatTime(record.logoutTime)}</td>
                      <td>
                        <span className="hours-badge">{record.workingHours?.toFixed(2) || '0.00'} hrs</span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(record.status)}`}>
                          {record.status ? record.status : 'Check-In'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleViewDetails(record.employee?._id)}
                          disabled={!record.employee?._id}
                        >
                          <i className="fas fa-eye"></i> View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && (activeTab === 'logs' ? attendanceLogs.length : processedAttendance.length) > recordsPerPage && (
        <div className="pagination-container">
          <button
            className="btn btn-secondary"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <i className="fas fa-chevron-left"></i> Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-calendar-alt"></i> Detailed Attendance Report
              </h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {loadingDetails ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading detailed attendance...</p>
              </div>
            ) : detailsData ? (
              <div className="modal-body">
                {/* Employee Info Header */}
                <div className="details-header">
                  <div className="detail-item">
                    <span className="detail-label">Employee ID:</span>
                    <span className="detail-value">{detailsData.employee?.employeeId || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{detailsData.employee?.department || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Designation:</span>
                    <span className="detail-value">{detailsData.employee?.designation || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Month/Year:</span>
                    <span className="detail-value">
                      {months.find(m => m.value === detailsData.month)?.label} {detailsData.year}
                    </span>
                  </div>
                </div>

                {/* Daily Attendance Table */}
                <div className="details-table-container">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <th key={day.day} className={day.status === 'Absent' ? 'absent-header' : day.status === 'Half-day' ? 'halfday-header' : ''}>
                            {day.day}
                          </th>
                        ))}
                        <th>Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Active Time Row */}
                      <tr>
                        <td className="row-label">Active Time</td>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <td key={`time-${day.day}`} className="time-cell">
                            {day.loginTime ? new Date(day.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                        ))}
                        <td className="summary-cell">{detailsData.summary?.totalDays || 0}</td>
                      </tr>

                      {/* Dept Time Row */}
                      <tr>
                        <td className="row-label">Dept Time</td>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <td key={`dept-${day.day}`} className="time-cell">
                            {day.logoutTime ? new Date(day.logoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                        ))}
                        <td className="summary-cell">{detailsData.summary?.presentDays || 0}</td>
                      </tr>

                      {/* Working Hrs Row */}
                      <tr>
                        <td className="row-label">Working Hrs</td>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <td key={`hrs-${day.day}`} className="hours-cell">
                            {day.workingHours > 0 ? day.workingHours.toFixed(1) : '-'}
                          </td>
                        ))}
                        <td className="summary-cell">{detailsData.summary?.halfDays || 0}</td>
                      </tr>

                      {/* On Time/Late Row */}
                      <tr>
                        <td className="row-label">On Time/Late</td>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <td key={`ontime-${day.day}`} className={day.isLate ? 'late-cell' : day.status === 'Present' ? 'ontime-cell' : ''}>
                            {day.status === 'Present' ? (day.isLate ? 'Late' : 'On Time') : '-'}
                          </td>
                        ))}
                        <td className="summary-cell">{detailsData.summary?.absentDays || 0}</td>
                      </tr>

                      {/* Shift Row */}
                      <tr>
                        <td className="row-label">Shift</td>
                        {detailsData.dailyBreakdown?.map((day) => (
                          <td key={`shift-${day.day}`} className={
                            day.status === 'Present' ? 'present-cell' : 
                            day.status === 'Absent' ? 'absent-cell' : 
                            'halfday-cell'
                          }>
                            {day.status === 'Present' ? 'P' : day.status === 'Half-day' ? 'H' : day.status === 'Absent' ? 'A' : 'OFF'}
                          </td>
                        ))}
                        <td className="summary-cell">Late: {detailsData.summary?.lateDays || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Payroll Summary */}
                {detailsData.payroll && (
                  <div className="payroll-summary">
                    <h3>Salary Calculation</h3>
                    <div className="salary-grid">
                      <div className="salary-section">
                        <div className="salary-row">
                          <span>Basic Salary:</span>
                          <span className="amount">{formatCurrency(detailsData.payroll.basicSalary)}</span>
                        </div>
                        <div className="salary-row">
                          <span>HRA:</span>
                          <span className="amount">{formatCurrency(detailsData.payroll.hra)}</span>
                        </div>
                        <div className="salary-row">
                          <span>Allowances:</span>
                          <span className="amount">{formatCurrency(detailsData.payroll.allowances)}</span>
                        </div>
                        <div className="salary-row total">
                          <span>Gross Salary:</span>
                          <span className="amount">{formatCurrency(detailsData.payroll.grossSalary)}</span>
                        </div>
                      </div>
                      <div className="salary-section">
                        <div className="salary-row deduction">
                          <span>Late Arrivals:</span>
                          <span className="amount">-{formatCurrency(detailsData.payroll.lateDeductions)}</span>
                        </div>
                        <div className="salary-row deduction">
                          <span>Goal Missed:</span>
                          <span className="amount">-{formatCurrency(detailsData.payroll.goalMissedDeductions)}</span>
                        </div>
                        <div className="salary-row deduction">
                          <span>Uninformed Leave:</span>
                          <span className="amount">-{formatCurrency(detailsData.payroll.uninformedLeaveDeductions)}</span>
                        </div>
                        <div className="salary-row total net">
                          <span>Net Salary:</span>
                          <span className="amount">{formatCurrency(detailsData.payroll.netSalary)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">No data available</div>
            )}
          </div>
        </div>
      )}
          <button
            className="btn btn-secondary"
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}

export default BiometricAttendance;
