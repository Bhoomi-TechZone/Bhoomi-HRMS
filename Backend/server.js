require("dotenv").config({ override: true });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

/* ================= GLOBAL ERROR HANDLING ================= */

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  const msg = (error && error.message) ? String(error.message) : '';
  const textCode = error && error.textCode ? String(error.textCode) : '';
  const code = error && error.code ? String(error.code) : '';
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    msg.includes("ECONNRESET") ||
    textCode === "AUTHENTICATIONFAILED" ||
    error?.source === "authentication" ||
    error?.type === "no"
  ) {
    console.log("Ignoring socket or auth error, server continues to run...");
    return;
  }
  console.warn("Recovered from uncaughtException without crashing:", msg || textCode || code);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const path = require("path");

const app = express();

const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set("socketio", io);

const jwt = require("jsonwebtoken");
const User = require("./models/User");

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('role');
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: User not found or inactive'));
    }
    socket.user = user;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  const employeeId = socket.user.employeeId;
  const userId = socket.user._id.toString();
  
  socket.join(`user:${userId}`);
  socket.join(`employee:${employeeId}`);
  
  console.log(`[Socket.IO] Socket Connected for employee: ${employeeId} (${socket.id})`);

  // Check if this is the employee's first socket connection
  const room = io.sockets.adapter.rooms.get(`employee:${employeeId}`);
  const isFirstConnection = room ? room.size === 1 : true;

  if (isFirstConnection) {
    console.log(`[Socket.IO] First connection. Broadcasting employee-connected for: ${employeeId}`);
    io.emit('employee-connected', {
      employeeId,
      employeeName: `${socket.user.firstName} ${socket.user.lastName}`.trim(),
      status: 'tracking'
    });
    // Update AgentStatus to online
    const AgentStatus = require("./models/AgentStatus");
    AgentStatus.findOneAndUpdate(
      { employeeId },
      { isOnline: true, lastSeen: new Date() },
      { upsert: true }
    ).catch(err => console.error('[Socket.IO] AgentStatus online update error:', err.message));
  }

  // Listen for real-time application focus changes from desktop client
  socket.on('app-focus-changed', (data) => {
    console.log(`[Socket.IO] App focus changed for ${employeeId}: ${data?.appName}`);
    io.emit('employee-app-changed', {
      employeeId,
      appName: data?.appName,
      startTime: data?.startTime
    });
  });

  // --- WebRTC / Monitoring Signaling ---
  const MonitoringSession = require('./models/MonitoringSession');

  // In-memory session cache: sessionId -> { adminId, employeeId }
  // Avoids a DB query per ICE candidate (can be 20-50 per connection)
  const sessionCache = new Map();

  async function getSession(sessionId) {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId);
    const session = await MonitoringSession.findOne({ sessionId });
    if (session) {
      sessionCache.set(sessionId, { adminId: session.adminId.toString(), employeeId: session.employeeId });
      return sessionCache.get(sessionId);
    }
    return null;
  }

  socket.on('webrtc:offer', async (data) => {
    const session = await getSession(data.sessionId);
    if (session) io.to(`user:${session.adminId}`).emit('webrtc:offer', data);
  });

  socket.on('webrtc:answer', async (data) => {
    const session = await getSession(data.sessionId);
    if (session) io.to(`employee:${session.employeeId}`).emit('webrtc:answer', data);
  });

  socket.on('webrtc:ice-candidate', async (data) => {
    const session = await getSession(data.sessionId);
    if (session) {
      if (socket.user.employeeId === session.employeeId) {
         io.to(`user:${session.adminId}`).emit('webrtc:ice-candidate', data);
      } else {
         io.to(`employee:${session.employeeId}`).emit('webrtc:ice-candidate', data);
      }
    }
  });

  socket.on('monitoring:stop', async (data) => {
    sessionCache.delete(data.sessionId);
    const session = await MonitoringSession.findOneAndUpdate({ sessionId: data.sessionId }, { status: 'STOPPING' });
    if (session) io.to(`employee:${session.employeeId}`).emit('monitoring:stopped', { sessionId: data.sessionId, reason: 'admin' });
  });

  const agentEvents = ['monitoring:reject', 'monitoring:accepted', 'monitoring:started', 'monitoring:error', 'monitoring:stopped'];
  agentEvents.forEach(event => {
      socket.on(event, async (data) => {
          const session = await MonitoringSession.findOne({ sessionId: data.sessionId });
          if (session) {
              if (event === 'monitoring:started') session.status = 'ACTIVE';
              if (event === 'monitoring:stopped') { session.status = 'STOPPED'; session.endedAt = new Date(); sessionCache.delete(data.sessionId); }
              if (event === 'monitoring:reject' || event === 'monitoring:error') { session.status = 'FAILED'; session.errorReason = data.reason || data.message; session.endedAt = new Date(); sessionCache.delete(data.sessionId); }
              await session.save();
              io.to(`user:${session.adminId.toString()}`).emit(event, data);
          }
      });
  });
  
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Socket Disconnected for employee: ${employeeId} (${socket.id})`);
    
    // Check if this was the last active connection for the employee
    const room = io.sockets.adapter.rooms.get(`employee:${employeeId}`);
    const hasRemainingSockets = room && room.size > 0;

    if (!hasRemainingSockets) {
      console.log(`[Socket.IO] Last connection closed. Broadcasting employee-disconnected for: ${employeeId}`);
      io.emit('employee-disconnected', { employeeId });
      // Update AgentStatus to offline
      const AgentStatus = require("./models/AgentStatus");
      AgentStatus.findOneAndUpdate(
        { employeeId },
        { isOnline: false }
      ).catch(err => console.error('[Socket.IO] AgentStatus offline update error:', err.message));
    }
  });
});

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/TechHRMS")
  .then(() => {
    /* ================= CRON WORKERS ================= */
    try {
      require("./utils/attendanceCron")();
    } catch (err) {
      console.error("[Worker] Attendance cron error:", err.message);
    }

    try {
      require("./cron/metaSyncWorker")();
    } catch (err) {
      console.error("[Worker] Meta sync error:", err.message);
    }

    try {
      require("./cron/gmailSyncWorker")();
    } catch (err) {
      console.error("[Worker] Gmail sync error:", err.message);
    }

    /* ================= LISTEN ================= */
    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`BHOOMI HRMS BACKEND SERVER INITIALIZED`);
      console.log(`  - Port       : ${PORT}`);
      console.log(`  - Database   : ${mongoose.connection.db.databaseName} (Connected)`);
      console.log(`  - Schedulers : Attendance (5 guards), MetaSync, GmailSync`);
      console.log(`======================================================\n`);
    });
  })
  .catch((err) => {
    console.error("[Database] MongoDB Connection Error:", err.message);
    process.exit(1);
  });

/* ================= ROUTES ================= */

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/roles", require("./routes/roles"));
app.use("/api/broadcasts", require("./routes/broadcasts"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/goals", require("./routes/goals"));
app.use("/api/task-requests", require("./routes/task-requests"));
app.use("/api/assets", require("./routes/assets"));
app.use("/api/vendors", require("./routes/vendors"));
app.use("/api/leaves", require("./routes/leaves"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/shift-configs", require("./routes/shift-configs"));
app.use("/api/attendance-configs", require("./routes/attendance-configs"));
app.use("/api/nda", require("./routes/nda"));
app.use("/api/deals", require("./routes/deals"));
app.use("/api/payment-records", require("./routes/payment-records"));
app.use("/api/pipeline-contacts", require("./routes/pipeline-contacts"));
app.use("/api/pipeline-companies", require("./routes/pipeline-companies"));
app.use("/api/pipeline-tasks", require("./routes/pipeline-tasks"));
app.use("/api/pipeline-configs", require("./routes/pipeline-configs"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/marketing-leads", require("./routes/marketing-leads"));
app.use("/api/activity", require("./routes/activity"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/lead-documents", require("./routes/lead-documents"));
app.use("/api/lead-submissions", require("./routes/lead-submissions"));
app.use("/api/lead-assignments", require("./routes/lead-assignments"));
app.use("/api/activities", require("./routes/activities"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/payroll", require("./routes/payroll"));
app.use("/api/salary-structure", require("./routes/salary-structure"));
app.use("/api/salary-rules", require("./routes/salary-rules"));
app.use("/api/proposals", require("./routes/proposals"));
app.use("/api/proposal-templates", require("./routes/proposalTemplates"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/client-documents", require("./routes/client-documents"));
app.use("/api/document-generator", require("./routes/document-generator"));
app.use("/api/webhooks", require("./routes/webhooks"));
app.use("/api/webhook", require("./routes/webhooks")); // Alias for singular
app.use("/api/meta-leads", require("./routes/meta-leads"));
app.use("/api/website-leads", require("./routes/website-leads"));
app.use("/api/recruitment", require("./routes/recruitment"));
app.use("/api/agent", require("./routes/agent"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/monitoring", require("./routes/monitoring"));
app.use("/api/access-policies", require("./routes/access-policies"));

/* ================= GMAIL OAUTH CALLBACK (top-level) ======== */
const gmailService = require("./services/gmailService");
app.get("/auth", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing authorization code");
    await gmailService.handleAuthCallback(code);
    res.send(`
      <!DOCTYPE html><html><head><title>Gmail Connected</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;">
        <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
          <h2 style="margin:0 0 8px;color:#1e293b;">Gmail Connected!</h2>
          <p style="color:#64748b;margin:0;">You can close this tab and return to the CRM.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error("Gmail auth callback error:", err);
    res.status(500).send(`
      <!DOCTYPE html><html><head><title>Auth Error</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2;">
        <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <div style="font-size:48px;margin-bottom:16px;">&#x274C;</div>
          <h2 style="margin:0 0 8px;color:#991b1b;">Auth Failed</h2>
          <p style="color:#64748b;margin:0;">${err.message}</p>
        </div>
      </body></html>
    `);
  }
});

/* ================= BIOMETRIC MODULE ================= */

app.use("/api/biometric", require("./routes/biometric"));
app.use("/api/events", require("./routes/events"));
app.use("/api/holidays", require("./routes/holidays"));
app.use("/api/settings", require("./routes/settings"));

/* ================= ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});



