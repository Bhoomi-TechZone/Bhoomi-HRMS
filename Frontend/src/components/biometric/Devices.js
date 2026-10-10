import { useEffect, useState } from "react";
import api from "../../api/axios";
import "./Devices.css";

function Devices() {
    const [devices, setDevices] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
    const [showPushEmployeesModal, setShowPushEmployeesModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [deviceFormData, setDeviceFormData] = useState({
        deviceName: "",
        serialNumber: "",
        deviceIP: "",
        lastOnline: "",
        status: "active"
    });

    useEffect(() => {
        fetchDevices();
        fetchEmployees();
    }, []);

    const fetchDevices = async () => {
        try {
            const response = await api.get("/biometric/devices");
            setDevices(response.data || []);
        } catch (error) {
            console.error("Error fetching devices:", error);
            // Mock data for demonstration
            setDevices([
                {
                    _id: "1",
                    deviceName: "Main Entrance",
                    serialNumber: "BIO-001",
                    deviceIP: "192.168.1.100",
                    lastOnline: new Date().toISOString(),
                    status: "active"
                }
            ]);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await api.get("/employees");
            setEmployees(response.data || []);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const handleAddDevice = async (e) => {
        e.preventDefault();
        try {
            await api.post("/biometric/device", deviceFormData);
            setShowAddDeviceModal(false);
            setDeviceFormData({
                deviceName: "",
                serialNumber: "",
                deviceIP: "",
                lastOnline: "",
                status: "active"
            });
            fetchDevices();
            alert("Device added successfully!");
        } catch (error) {
            alert(error.response?.data?.message || "Error adding device");
        }
    };

    const handlePushEmployees = () => {
        setShowPushEmployeesModal(true);
    };

    const handleToggleEmployee = (employeeId) => {
        setSelectedEmployees(prev => {
            if (prev.includes(employeeId)) {
                return prev.filter(id => id !== employeeId);
            } else {
                return [...prev, employeeId];
            }
        });
    };

    const handleSelectAllEmployees = () => {
        if (selectedEmployees.length === employees.length) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(employees.map(emp => emp._id));
        }
    };

    const handleConfirmPush = async () => {
        try {
            await api.post("/biometric/push-employees", {
                deviceId: selectedDevice,
                employeeIds: selectedEmployees
            });
            setShowPushEmployeesModal(false);
            setSelectedEmployees([]);
            alert("Employees pushed to device successfully!");
        } catch (error) {
            alert(error.response?.data?.message || "Error pushing employees to device");
        }
    };

    const handleRefresh = () => {
        fetchDevices();
        alert("Devices refreshed!");
    };

    const filteredDevices = devices.filter(device =>
        device.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.deviceIP?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="devices-container">
            {/* Header */}
            <div className="devices-header">
                <div className="breadcrumb">
                    <span className="breadcrumb-item">Home</span>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-item active">Devices</span>
                </div>
            </div>

            {/* Search and Actions Bar */}
            <div className="devices-actions-bar">
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Start typing to search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="action-buttons">
                    <button
                        className="btn-device btn-add"
                        onClick={() => setShowAddDeviceModal(true)}
                    >
                        <span className="btn-icon">➕</span>
                        Add Biometric Device
                    </button>
                    <button
                        className="btn-device btn-push"
                        onClick={handlePushEmployees}
                    >
                        <span className="btn-icon">👥</span>
                        Push Employees To Device
                    </button>
                </div>
            </div>

            {/* Configuration Guide Banner */}
            <div className="config-banner">
                <span className="config-icon">📋</span>
                <span className="config-text">Device Configuration Guide</span>
                <button className="config-link">Click to Expand</button>
                <button className="config-close">✕</button>
            </div>

            {/* Devices Table */}
            <div className="devices-table-container">
                <div className="devices-table-header">
                    <button className="btn-refresh" onClick={handleRefresh}>
                        <span className="refresh-icon">🔄</span>
                        Refresh
                    </button>
                </div>
                <table className="devices-table">
                    <thead>
                        <tr>
                            <th>Device Name</th>
                            <th>Serial Number</th>
                            <th>Device IP</th>
                            <th>Last Online</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDevices.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="no-records">
                                    <div className="no-records-content">
                                        <span className="no-records-icon">📭</span>
                                        <p>No records found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredDevices.map((device) => (
                                <tr key={device._id}>
                                    <td>{device.deviceName}</td>
                                    <td>{device.serialNumber}</td>
                                    <td>{device.deviceIP}</td>
                                    <td>
                                        {device.lastOnline
                                            ? new Date(device.lastOnline).toLocaleString()
                                            : "Never"}
                                    </td>
                                    <td>
                                        <span className={`status-badge status-${device.status}`}>
                                            {device.status === "active" ? "● Active" : "● Inactive"}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons-cell">
                                            <button
                                                className="btn-action btn-edit"
                                                title="Edit"
                                                onClick={() => {
                                                    setSelectedDevice(device._id);
                                                    alert("Edit functionality coming soon!");
                                                }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-action btn-delete"
                                                title="Delete"
                                                onClick={() => {
                                                    if (window.confirm("Are you sure you want to delete this device?")) {
                                                        alert("Delete functionality coming soon!");
                                                    }
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Device Modal */}
            {showAddDeviceModal && (
                <div className="modal-overlay" onClick={() => setShowAddDeviceModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Biometric Device</h2>
                            <button
                                className="close-btn"
                                onClick={() => setShowAddDeviceModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleAddDevice}>
                            <div className="form-group">
                                <label>Device Name *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={deviceFormData.deviceName}
                                    onChange={(e) =>
                                        setDeviceFormData({ ...deviceFormData, deviceName: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Serial Number *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={deviceFormData.serialNumber}
                                    onChange={(e) =>
                                        setDeviceFormData({ ...deviceFormData, serialNumber: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Device IP *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={deviceFormData.deviceIP}
                                    onChange={(e) =>
                                        setDeviceFormData({ ...deviceFormData, deviceIP: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    className="form-control"
                                    value={deviceFormData.status}
                                    onChange={(e) =>
                                        setDeviceFormData({ ...deviceFormData, status: e.target.value })
                                    }
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowAddDeviceModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Add Device
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Push Employees Modal */}
            {showPushEmployeesModal && (
                <div className="modal-overlay" onClick={() => setShowPushEmployeesModal(false)}>
                    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-section">
                                <span className="modal-icon">👥</span>
                                <h2 className="modal-title">Sync All Employees</h2>
                            </div>
                            <button
                                className="close-btn"
                                onClick={() => setShowPushEmployeesModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Info Banner */}
                        <div className="info-banner">
                            <span className="info-icon">ℹ️</span>
                            <span className="info-text">
                                The following employees will be synchronized with all active biometric devices.
                            </span>
                        </div>

                        {/* Warning Banner */}
                        <div className="warning-banner">
                            <span className="warning-icon">⚠️</span>
                            <span className="warning-text">
                                Warning: If any employee ID already exists on the device, it will be overwritten with this data.
                            </span>
                        </div>

                        {/* Employees Table */}
                        <div className="employees-sync-table-container">
                            <table className="employees-sync-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployees.length === employees.length}
                                                onChange={handleSelectAllEmployees}
                                            />
                                        </th>
                                        <th>Employee</th>
                                        <th>Employee ID</th>
                                        <th>Biometric User ID</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((employee) => (
                                        <tr key={employee._id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmployees.includes(employee._id)}
                                                    onChange={() => handleToggleEmployee(employee._id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="employee-info">
                                                    <div className="employee-avatar">
                                                        <img
                                                            src={`https://ui-avatars.com/api/?name=${employee.firstName}+${employee.lastName}&background=667eea&color=fff`}
                                                            alt={`${employee.firstName} ${employee.lastName}`}
                                                        />
                                                    </div>
                                                    <div className="employee-details">
                                                        <div className="employee-name">
                                                            {employee.firstName} {employee.lastName}
                                                        </div>
                                                        <div className="employee-email">{employee.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="employee-id">{employee.employeeId}</td>
                                            <td className="biometric-id">--</td>
                                            <td>
                                                <span className="status-badge-sync status-not-configured">
                                                    ⚠️ Not Configured
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={() => setShowPushEmployeesModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-confirm"
                                onClick={handleConfirmPush}
                                disabled={selectedEmployees.length === 0}
                            >
                                ✓ Confirm Push Employees To Devices
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Devices;
