const mongoose = require("mongoose");

const MonitoringSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "CONNECTING", "ACTIVE", "STOPPING", "STOPPED", "FAILED"],
      default: "REQUESTED",
    },
    errorReason: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonitoringSession", MonitoringSessionSchema);
