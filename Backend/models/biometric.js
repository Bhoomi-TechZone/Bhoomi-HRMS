const mongoose = require("mongoose");

/* ================= PROVIDER ================= */

const biometricProviderSchema = new mongoose.Schema({
    providerName: String,
    baseUrl: String,
    apiKey: String,
    apiSecret: String,
    companyId: String,
    status: { type: String, default: "inactive" }
}, { timestamps: true });

/* ================= DEVICE ================= */

const biometricDeviceSchema = new mongoose.Schema({
    deviceName: String,
    deviceSerialNo: String,
    deviceType: String,
    ipAddress: String,
    port: Number,
    location: String,
    status: { type: String, default: "active" },
    lastSyncTime: Date
}, { timestamps: true });

/* ================= EMPLOYEE MAPPING ================= */

const employeeBiometricMappingSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    biometricUserId: String,
    biometricCode: String,
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BiometricDevice"
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

/* ================= RAW LOGS ================= */

const biometricRawLogSchema = new mongoose.Schema({
    biometricUserId: String,
    punchTime: Date,
    punchType: String,
    deviceId: mongoose.Schema.Types.ObjectId,
    rawPayload: Object
}, { timestamps: true });

module.exports = {
    BiometricProvider: mongoose.model("BiometricProvider", biometricProviderSchema),
    BiometricDevice: mongoose.model("BiometricDevice", biometricDeviceSchema),
    EmployeeBiometricMapping: mongoose.model("EmployeeBiometricMapping", employeeBiometricMappingSchema),
    BiometricRawLog: mongoose.model("BiometricRawLog", biometricRawLogSchema)
};
