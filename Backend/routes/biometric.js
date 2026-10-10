const express = require("express");
const router = express.Router();

const {
    BiometricProvider,
    BiometricDevice,
    EmployeeBiometricMapping
} = require("../models/biometric");

const User = require("../models/User");

/* ================= PROVIDER ================= */

router.post("/provider", async (req, res) => {
    try {
        await BiometricProvider.create(req.body);
        res.json({ message: "Provider added" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* ================= DEVICE ================= */

// Get all devices
router.get("/devices", async (req, res) => {
    try {
        const devices = await BiometricDevice.find();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add device
router.post("/device", async (req, res) => {
    try {
        await BiometricDevice.create(req.body);
        res.json({ message: "Device added" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* ================= EMPLOYEE MAPPING ================= */

router.post("/map-employee", async (req, res) => {
    try {
        await EmployeeBiometricMapping.create(req.body);
        res.json({ message: "Employee mapped" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* ================= PUSH EMPLOYEES TO DEVICE ================= */

router.post("/push-employees", async (req, res) => {
    try {
        const { deviceId, employeeIds } = req.body;

        if (!deviceId || !employeeIds || !Array.isArray(employeeIds)) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        // Check if device exists
        const device = await BiometricDevice.findById(deviceId);
        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }

        // Create or update mappings for each employee
        const results = [];
        for (const employeeId of employeeIds) {
            const existing = await EmployeeBiometricMapping.findOne({
                employeeId,
                deviceId
            });

            if (existing) {
                existing.isActive = true;
                await existing.save();
                results.push({ employeeId, status: "updated" });
            } else {
                // Get employee to generate biometric user ID
                const employee = await User.findById(employeeId);
                if (employee) {
                    await EmployeeBiometricMapping.create({
                        employeeId,
                        deviceId,
                        biometricUserId: employee.employeeId || employeeId.toString(),
                        isActive: true
                    });
                    results.push({ employeeId, status: "created" });
                }
            }
        }

        res.json({
            message: "Employees pushed to device successfully",
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* ================= MANUAL SYNC ================= */

router.post("/sync", async (req, res) => {
    try {
        const { deviceId, from, to } = req.body;

        // Note: syncBiometric and processAttendance functions need to be implemented
        // For now, returning a placeholder response
        res.json({
            message: "Biometric sync initiated",
            records: 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* ================= GET ATTENDANCE LOGS ================= */

const { BiometricRawLog } = require("../models/biometric");
const Attendance = require("../models/Attendance");

// Get biometric attendance logs
router.get("/attendance-logs", async (req, res) => {
    try {
        const { startDate, endDate, employeeId, deviceId } = req.query;
        
        let query = {};
        
        if (startDate && endDate) {
            query.punchTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (deviceId) {
            query.deviceId = deviceId;
        }

        // If employeeId provided, first get the biometric user ID
        if (employeeId) {
            const mapping = await EmployeeBiometricMapping.findOne({ employeeId });
            if (mapping) {
                query.biometricUserId = mapping.biometricUserId;
            }
        }

        const logs = await BiometricRawLog.find(query)
            .populate({
                path: 'deviceId',
                select: 'deviceName location'
            })
            .sort({ punchTime: -1 })
            .limit(1000);

        // Enrich logs with employee information
        const enrichedLogs = await Promise.all(logs.map(async (log) => {
            const mapping = await EmployeeBiometricMapping.findOne({
                biometricUserId: log.biometricUserId
            }).populate({
                path: 'employeeId',
                select: 'firstName lastName employeeId email'
            });

            return {
                _id: log._id,
                biometricUserId: log.biometricUserId,
                punchTime: log.punchTime,
                punchType: log.punchType,
                device: log.deviceId,
                employee: mapping?.employeeId || null,
                createdAt: log.createdAt
            };
        }));

        res.json(enrichedLogs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get processed attendance from biometric data
router.get("/processed-attendance", async (req, res) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        
        let query = {};
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (employeeId) {
            query.employee = employeeId;
        }

        const attendance = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId email')
            .sort({ date: -1 });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get detailed employee attendance for modal view
router.get("/employee-details/:employeeId", async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate } = req.query;
        
        let query = { employee: employeeId };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Fetch employee details
        const employee = await User.findById(employeeId)
            .select('firstName lastName employeeId email department designation');

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Fetch daily attendance data
        const dailyData = await Attendance.find(query).sort({ date: 1 });

        // Calculate summary
        const summary = {
            present: dailyData.filter(d => d.status === 'present').length,
            absent: dailyData.filter(d => d.status === 'absent').length,
            halfDay: dailyData.filter(d => d.status === 'half-day').length,
            weekOff: 0, // Calculate based on your business logic
            leave: 0, // You might want to fetch from Leave model
            paidDays: dailyData.filter(d => d.status === 'present' || d.status === 'half-day').length,
            lateHours: 0, // Calculate based on expected start time
            totalWorkHours: dailyData.reduce((sum, d) => sum + (d.workingHours || 0), 0),
            overtime: 0 // Calculate if working hours > expected hours
        };

        // Calculate overtime (assuming 8 hours is standard)
        dailyData.forEach(day => {
            if (day.workingHours > 8) {
                summary.overtime += (day.workingHours - 8);
            }
        });

        res.json({
            employee: {
                firstName: employee.firstName,
                lastName: employee.lastName,
                employeeId: employee.employeeId,
                email: employee.email,
                department: employee.department || 'DEMO',
                designation: employee.designation || 'DEMO'
            },
            summary,
            dailyData: dailyData.map(d => ({
                date: d.date,
                loginTime: d.loginTime,
                logoutTime: d.logoutTime,
                workingHours: d.workingHours,
                status: d.status,
                overtime: d.workingHours > 8 ? d.workingHours - 8 : 0,
                shift: '001' // You can add shift logic here
            })),
            salary: 10000, // Fetch from salary structure
            payAmount: '9,500', // Calculate based on attendance
            remarks: ''
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
