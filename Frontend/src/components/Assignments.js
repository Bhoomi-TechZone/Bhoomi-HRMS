import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import api from "../api/axios";

// Load Inter & Poppins fonts for professional card typography
if (typeof document !== 'undefined' && !document.getElementById('hrms-pro-fonts')) {
  const link = document.createElement('link');
  link.id = 'hrms-pro-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

// SVG Icons Components - Minimal Modern Style
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="5" r="1" fill="currentColor" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// Project Details Modal Component
const ProjectDetailsModal = ({ project, onClose, downloadDocument, calculateProgress, isProjectOverdue, onRemarkAdded }) => {
  const auth = useAuth();
  const currentUser = auth?.user;
  const [activeTab, setActiveTab] = useState("overview");
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [isAddingRemark, setIsAddingRemark] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const isOverdue = isProjectOverdue(project);
  // Removed progress logic

  const members = Array.isArray(project.assignedEmployees) ? project.assignedEmployees : [];

  const memberImage = (member) => {
    if (!member) return "";
    return member.profileImage || member.avatar || member.image || member.photo || "";
  };

  const leadMember = members[0] || null;
  const currentMember = members[currentMemberIndex] || leadMember;

  const userRole = currentUser?.role?.name || "";
  const hasFullAccess = ["Admin", "HR Manager", "Manager", "Team Leader", "Sales"].includes(userRole);
  const isSelf = currentUser?._id === currentMember?._id || (currentUser?._id && currentMember?._id && currentUser?._id.toString() === currentMember?._id.toString());
  const canViewTasks = hasFullAccess || isSelf;

  const formatDate = (value) => new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const daysRemaining = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
  const statusLabel = project.status === "active" ? "Progress" : (project.status || "active").replace("-", " ");
  const statusTone = project.status === "completed"
    ? { bg: "#e8f3ff", color: "#2563eb", border: "#bfdbfe" }
    : project.status === "on-hold"
      ? { bg: "#fffbeb", color: "#d97706", border: "#fde68a" }
      : project.status === "review"
        ? { bg: "#fdf4ff", color: "#c026d3", border: "#f5d0fe" }
        : project.status === "canceled"
          ? { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" }
          : isOverdue
            ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
            : { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(17, 24, 39, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "10px"
      }}
    >
      <style>
        {`
          .project-details-scroll-shell {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .project-details-scroll-shell::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      <div
        className="project-details-scroll-shell"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "'Poppins', 'Inter', 'Segoe UI', sans-serif",
          width: "100%",
          maxWidth: "940px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "transparent",
          borderRadius: "20px",
          border: "none",
          boxShadow: "none",
          padding: "0"
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "stretch",
            flexWrap: "wrap"
          }}
        >
          <div
            style={{
              flex: "0 0 250px",
              minWidth: "220px",
              minHeight: "470px",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #e5e7eb",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "9px"
            }}
          >
            <div
              style={{
                position: "relative",
                height: "190px",
                borderRadius: "11px",
                overflow: "hidden",
                background: "linear-gradient(135deg, #d1d5db, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {memberImage(currentMember) ? (
                <img
                  src={memberImage(currentMember)}
                  alt={currentMember ? `${currentMember.firstName} ${currentMember.lastName}` : "Member"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "62px",
                    height: "62px",
                    borderRadius: "50%",
                    background: "#a8e63d",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}

              {members.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentMemberIndex((prev) => (prev === 0 ? members.length - 1 : prev - 1))}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.7)",
                      background: "rgba(17, 24, 39, 0.55)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentMemberIndex((prev) => (prev === members.length - 1 ? 0 : prev + 1))}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.7)",
                      background: "rgba(17, 24, 39, 0.55)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "10px",
                      transform: "translateX(-50%)",
                      fontSize: "9px",
                      fontWeight: 600,
                      color: "#fff",
                      background: "rgba(17, 24, 39, 0.58)",
                      borderRadius: "999px",
                      padding: "3px 8px"
                    }}
                  >
                    {currentMemberIndex + 1} / {members.length}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.15 }}>
                {currentMember ? `${currentMember.firstName} ${currentMember.lastName}` : project.name}
              </div>
              <div style={{
                width: "14px",
                height: "14px",
                marginLeft: "-2px",
                borderRadius: "50%",
                background: "#4caf50",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 7L10 17l-6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div>
              <div style={{
                display: "inline-block",
                background: "rgba(168, 230, 61, 0.15)",
                color: "#3b775e",
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 600,
                marginTop: "2px"
              }}>
                {currentMember?.role?.name || currentMember?.role || "Project Team Member"}
              </div>
            </div>

            <div style={{ display: "grid", gap: "6px", marginTop: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#6b7280" }}>Employee ID</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827" }}>{currentMember?.employeeId || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#6b7280" }}>Email</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827", textAlign: "right", wordBreak: "break-all" }}>{currentMember?.email || currentMember?.officialEmail || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#6b7280" }}>Designation</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827", textAlign: "right" }}>{currentMember?.designation || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#6b7280" }}>Department</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827", textAlign: "right" }}>{currentMember?.department || "-"}</span>
              </div>
            </div>

            {activeTab === "overview" ? (
              canViewTasks ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (isFlipped) {
                      setIsFlipped(false);
                      return;
                    }
                    setIsFlipped(true);
                    setLoadingTasks(true);
                    try {
                      const res = await api.get(`/goals?employee=${currentMember?._id}&projectId=${project._id}`);
                      setEmployeeTasks(res.data);
                    } catch (err) {
                      console.error("Error fetching tasks:", err);
                    } finally {
                      setLoadingTasks(false);
                    }
                  }}
                  style={{
                    marginTop: "auto",
                    border: "none",
                    borderRadius: "999px",
                    background: "linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)",
                    color: "#1f2937",
                    padding: "8px 10px",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Work Summary
                </button>
              ) : (
                <div style={{ marginTop: 'auto' }}></div>
              )
            ) : isAddingRemark ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Enter your remark..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '11px', resize: 'none', minHeight: '60px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsAddingRemark(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '999px', padding: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => {
                    if (!remarkText.trim()) return;
                    try {
                      const res = await api.post(`/projects/${project._id}/remarks`, { message: remarkText });
                      setIsAddingRemark(false);
                      setRemarkText("");
                      if (onRemarkAdded) onRemarkAdded(res.data);
                    } catch (err) {
                      alert("Error adding remark");
                    }
                  }} style={{ flex: 1, background: 'linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)', color: '#1f2937', border: 'none', borderRadius: '999px', padding: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Send</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingRemark(true)}
                style={{
                  marginTop: "auto",
                  border: "none",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)",
                  color: "#1f2937",
                  padding: "8px 10px",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Add Remark
              </button>
            )}
          </div>

          <div
            style={{
              flex: "1 1 360px",
              minWidth: "250px",
              minHeight: "450px",
              perspective: "1000px"
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                transition: "transform 0.6s",
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  backfaceVisibility: "hidden",
                  background: "#ffffff",
                  borderRadius: "18px",
                  border: "1px solid #e5e7eb",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827", lineHeight: 1.08 }}>
                        {project.name}
                      </div>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        color: statusTone.color,
                        background: statusTone.bg,
                        border: `1px solid ${statusTone.border}`,
                        borderRadius: "999px",
                        padding: "2px 8px",
                        textTransform: "capitalize"
                      }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                      Project details, timeline and team summary
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#6b7280",
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      fontSize: "15px",
                      cursor: "pointer"
                    }}
                  >
                    x
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    background: "#f3f4f6",
                    borderRadius: "999px",
                    padding: "3px",
                    marginBottom: "2px"
                  }}
                >
                  <button
                    onClick={() => setActiveTab("overview")}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: "999px",
                      background: activeTab === "overview" ? "#ffffff" : "transparent",
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#374151",
                      cursor: "pointer"
                    }}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("statistics")}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: "999px",
                      background: activeTab === "statistics" ? "#ffffff" : "transparent",
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#374151",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    Timeline
                  </button>
                </div>

                {activeTab === "overview" && (
                  <div className="project-details-scroll-shell" style={{ display: "flex", flexDirection: "column", marginTop: "10px", maxHeight: "350px", overflowY: "auto", paddingRight: "4px", gap: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                      <div style={{ background: "#f9fafb", border: "1px solid #eef2f7", borderRadius: "10px", padding: "9px" }}>
                        <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "3px" }}>Status</div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: statusTone.color, textTransform: "capitalize" }}>{statusLabel}</div>
                      </div>
                      <div style={{ background: "#f9fafb", border: "1px solid #eef2f7", borderRadius: "10px", padding: "9px" }}>
                        <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "3px" }}>Team</div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>{members.length} Member{members.length === 1 ? "" : "s"}</div>
                      </div>

                    </div>



                    {project.description && (
                      <div style={{ background: "#fbfbfc", border: "1px solid #eef2f7", borderRadius: "10px", padding: "10px 12px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#111827", marginBottom: "5px", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                          Description
                        </div>
                        <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.5 }}>
                          {project.description}
                        </div>
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ color: "#4b5563", fontSize: "12px" }}>Team Members</span>
                        <span style={{ fontWeight: 700, fontSize: "12px" }}>{members.length}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ color: "#4b5563", fontSize: "12px" }}>Start Date</span>
                        <span style={{ fontWeight: 700, fontSize: "12px" }}>{formatDate(project.startDate)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                        <span style={{ color: "#4b5563", fontSize: "12px" }}>Deadline</span>
                        <span style={{ fontWeight: 700, fontSize: "12px", color: isOverdue ? "#dc2626" : "#111827" }}>
                          {formatDate(project.deadline)}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: "2px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#111827", marginBottom: "6px", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                        Working Team
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                        {members.map((emp, index) => (
                          <div
                            key={emp._id}
                            onClick={() => setCurrentMemberIndex(index)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              border: currentMemberIndex === index ? "1px solid #a8e63d" : "1px solid #e5e7eb",
                              background: currentMemberIndex === index ? "rgba(168, 230, 61, 0.05)" : "#f9fafb",
                              borderRadius: "9px",
                              padding: "7px",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            {memberImage(emp) ? (
                              <img
                                src={memberImage(emp)}
                                alt={`${emp.firstName} ${emp.lastName}`}
                                style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  background: "#166534",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  boxShadow: "0 3px 8px rgba(22, 101, 52, 0.2)"
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                                </svg>
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "11px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {emp.firstName} {emp.lastName}
                              </div>
                              <div style={{ fontSize: "10px", color: "#6b7280" }}>ID: {emp.employeeId}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "statistics" && (
                  <div className="project-details-scroll-shell" style={{ display: "flex", flexDirection: "column", marginTop: "10px", maxHeight: "350px", overflowY: "auto", paddingRight: "4px" }}>
                    {(!project.activities || project.activities.length === 0) ? (
                      <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>No activities recorded yet.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {project.activities.map((activity, idx) => {
                          const isLast = idx === project.activities.length - 1;
                          const isStatusChange = activity.action === 'Status Changed';
                          const isAssigned = activity.action === 'Assigned';

                          let title = activity.action;
                          if (isAssigned && activity.targetUser) {
                            const targetId = activity.targetUser._id || activity.targetUser;
                            const hasPriorHistory = project.activities.slice(0, idx).some(a =>
                              (a.action === 'Assigned' || a.action === 'Unassigned') &&
                              a.targetUser &&
                              (a.targetUser._id === targetId || a.targetUser === targetId)
                            );
                            if (hasPriorHistory) {
                              title = `Reassigned to ${activity.targetUser.firstName} ${activity.targetUser.lastName}`;
                            } else {
                              title = `Assigned to ${activity.targetUser.firstName} ${activity.targetUser.lastName}`;
                            }
                          } else if (activity.action === 'Unassigned' && activity.targetUser) {
                            title = `Unassigned from ${activity.targetUser.firstName} ${activity.targetUser.lastName}`;
                          }

                          return (
                            <div key={idx} style={{ display: "flex", gap: "16px" }}>
                              {/* Timeline node & line */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{
                                  width: "12px", height: "12px", borderRadius: "50%",
                                  border: isAssigned ? "2px solid #10b981" : "2px solid #3b82f6",
                                  background: "#fff", zIndex: 2, marginTop: "4px"
                                }}></div>
                                {!isLast && <div style={{ width: "2px", flex: 1, background: "#e5e7eb", margin: "4px 0", minHeight: "30px" }}></div>}
                              </div>

                              {/* Timeline content */}
                              <div style={{ flex: 1, paddingBottom: isLast ? "0" : "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                                    {title}
                                    {isLast && (
                                      <span className="timeline-arrow-indicator" title="New Activity" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#a8e63d', color: '#111827', borderRadius: '50%', width: '14px', height: '14px', animation: 'bounce-horizontal 1.5s infinite' }}>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: "12px" }}>
                                    {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </div>
                                </div>

                                {activity.message && (
                                  <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "8px", marginTop: "8px", fontSize: "12px" }}>
                                    <div style={{ color: "#9ca3af" }}>Message</div>
                                    <div style={{ color: "#4b5563" }}>{activity.message}</div>
                                  </div>
                                )}

                                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d1d5db" }}></span>
                                  By {activity.performedBy?.firstName} {activity.performedBy?.lastName}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>

              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  backfaceVisibility: "hidden",
                  background: "#ffffff",
                  borderRadius: "18px",
                  border: "1px solid #e5e7eb",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transform: "rotateY(180deg)"
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Tasks Created For This Project</div>
                  <button onClick={() => setIsFlipped(false)} style={{ border: 'none', background: '#f3f4f6', borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                    Back
                  </button>
                </div>
                {loadingTasks ? (
                  <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>Loading tasks...</div>
                ) : employeeTasks.flatMap(doc => doc.goals || []).filter(g => g.projectId === project._id).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>No tasks found for this employee in this project.</div>
                ) : (
                  <div className="project-details-scroll-shell" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
                    {employeeTasks.flatMap(doc =>
                      (doc.goals || [])
                        .filter(g => g.projectId === project._id)
                        .map(g => ({ ...g, parentDoc: doc }))
                    ).map((task, index) => (
                      <div key={task._id || index} style={{ background: '#f9fafb', padding: '10px', borderRadius: '10px', border: '1px solid #eef2f7', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#ffffff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', wordBreak: 'break-word' }}>{task.name}</div>
                            <div style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 600, background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                              {formatDate(task.completedAt || task.parentDoc?.createdAt || new Date())}
                            </div>
                          </div>

                          <div style={{ fontSize: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            <span style={{ padding: "2px 6px", background: task.isCompleted ? "#ecfdf5" : "#fffbeb", color: task.isCompleted ? "#059669" : "#d97706", borderRadius: "4px", fontWeight: 600 }}>
                              Task: {task.isCompleted ? "Completed" : "Pending"}
                            </span>
                            {task.parentDoc?.reviewRequest?.status && (
                              <span style={{ padding: "2px 6px", background: task.parentDoc.reviewRequest.status === 'Approved' ? "#ecfdf5" : task.parentDoc.reviewRequest.status === 'Rejected' ? "#fef2f2" : "#eff6ff", color: task.parentDoc.reviewRequest.status === 'Approved' ? "#059669" : task.parentDoc.reviewRequest.status === 'Rejected' ? "#dc2626" : "#2563eb", borderRadius: "4px", fontWeight: 600 }}>
                                Review: {task.parentDoc.reviewRequest.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Assignments() {
  const auth = useAuth();
  const user = auth?.user;
  const location = useLocation();
  const hasPermission = auth?.hasPermission || (() => false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalProjectSearch, setModalProjectSearch] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [salesSearchTerm, setSalesSearchTerm] = useState("");
  const [developerSearchTerm, setDeveloperSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOldRecords, setShowOldRecords] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState('all'); // 'all', 'overdue', 'not-overdue'
  const [filterMonth, setFilterMonth] = useState('all'); // 'all' or specific month in format 'YYYY-MM'
  const [filterEmployee, setFilterEmployee] = useState('all'); // 'all' or employee ID
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'completed', 'on-hold', 'pending'
  const [statusDdOpen, setStatusDdOpen] = useState(false);
  const [empDdOpen, setEmpDdOpen] = useState(false);
  const [filterEmpSearch, setFilterEmpSearch] = useState('');
  const [activityViewMode, setActivityViewMode] = useState('year'); // 'year' or 'month'
  const [activitySelectedYear, setActivitySelectedYear] = useState(new Date().getFullYear());
  const [activitySelectedMonth, setActivitySelectedMonth] = useState(new Date().getMonth());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    assignedEmployees: [],
    startDate: "",
    deadline: "",
    status: "active",
    statusReason: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const isAdmin = user?.role?.name === 'Admin';
  const [showAnalytics, setShowAnalytics] = useState(false);
  const canCreate = hasPermission("assignments", "create");
  const canUpdate = hasPermission("assignments", "update");
  const canDelete = hasPermission("assignments", "delete");
  const isAdminOrManager = canCreate || canUpdate || canDelete;

  // Check if project is overdue
  const isProjectOverdue = (project) => {
    if (!project.deadline) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const deadline = new Date(project.deadline);
    return deadline < today && project.status === 'active';
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await fetchProjects();
      setLoading(false); // Stop loading quickly for better UX
      
      // Fetch in background for filters/creation
      const isHRorAdmin = ["Admin", "HR Manager", "HR"].includes(user?.role?.name);
      if (isHRorAdmin || isAdminOrManager || hasPermission("assignments", "read")) {
        fetchEmployees(); // No await needed, runs in background
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrManager, hasPermission("assignments", "read")]); // Re-fetch if admin status or read permission changes

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('projectId');
    
    if (projectId && projects.length > 0) {
      const proj = projects.find(p => p._id === projectId);
      if (proj) {
        setSelectedProject(proj);
        setShowDetailsModal(true);
        // Remove the projectId from URL so it doesn't reopen if projects refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [location.search, projects]);

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setStatusDdOpen(false);
      setEmpDdOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/projects");
      setProjects(response.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/employees");
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleProjectSelection = (projectId) => {
    setSelectedProjectForAssignment(projectId);
    setShowProjectDropdown(false); // Close dropdown after selection
    if (projectId) {
      const project = projects.find(p => p._id === projectId);
      if (project) {
        setFormData({
          name: project.name,
          description: project.description || "",
          assignedEmployees: [],
          startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
          deadline: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
          status: project.status || "active",
          statusReason: project.statusReason || "",
        });
      }
    } else {
      setFormData({
        name: "",
        description: "",
        assignedEmployees: [],
        startDate: "",
        deadline: "",
        status: "active",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProjectForAssignment) {
      alert("Please select a project first");
      return;
    }

    if (["on-hold", "review", "canceled", "active"].includes(formData.status) && !formData.statusReason.trim()) {
      alert("Please provide a reason for the selected status");
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);

      // When creating a new assignment, merge new selections with existing team members
      let finalEmployees = formData.assignedEmployees;
      if (!editingProject) {
        const existingProject = projects.find(p => p._id === selectedProjectForAssignment);
        const existingIds = existingProject?.assignedEmployees?.map(e => e._id || e) || [];
        const merged = [...new Set([...existingIds, ...formData.assignedEmployees])];
        finalEmployees = merged;
      }

      formDataToSend.append(
        "assignedEmployees",
        JSON.stringify(finalEmployees)
      );
      formDataToSend.append("startDate", formData.startDate);
      formDataToSend.append("deadline", formData.deadline);
      formDataToSend.append("status", formData.status);
      formDataToSend.append("statusReason", formData.statusReason);

      await api.put(`/projects/${selectedProjectForAssignment}`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowModal(false);
      setEditingProject(null);
      setSelectedProjectForAssignment("");
      setSelectedFiles([]);
      setFormData({
        name: "",
        description: "",
        assignedEmployees: [],
        startDate: "",
        deadline: "",
        status: "active",
        statusReason: "",
      });
      fetchProjects();
    } catch (error) {
      alert(error.response?.data?.message || "Error saving project");
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setSelectedProjectForAssignment(project._id);
    setShowProjectDropdown(false);
    setSelectedFiles([]);
    setFormData({
      name: project.name,
      description: project.description || "",
      assignedEmployees: project.assignedEmployees.map((e) => e._id),
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      deadline: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
      status: project.status,
      statusReason: project.statusReason || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await api.delete(`/projects/${id}`);
        fetchProjects();
      } catch (error) {
        alert("Error deleting project");
      }
    }
  };

  const handleEmployeeToggle = (employeeId) => {
    setFormData((prev) => ({
      ...prev,
      assignedEmployees: prev.assignedEmployees.includes(employeeId)
        ? prev.assignedEmployees.filter((id) => id !== employeeId)
        : [...prev.assignedEmployees, employeeId],
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter((file) => {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["pdf", "docx", "doc"].includes(ext)) {
        alert(
          `${file.name} is not a valid file type. Only PDF and DOCX files are allowed.`
        );
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        return false;
      }
      return true;
    });
    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadDocument = async (projectId, docId, filename) => {
    try {
      const response = await api.get(
        `/projects/${projectId}/documents/${docId}`,
        {
          responseType: "blob",
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Error downloading document");
    }
  };

  const deleteDocument = async (projectId, docId) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        await api.delete(`/projects/${projectId}/documents/${docId}`);
        fetchProjects();
      } catch (error) {
        alert("Error deleting document");
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#28a745";
      case "completed":
        return "#007bff";
      case "on-hold":
        return "#ffc107";
      default:
        return "#666";
    }
  };

  const handleViewDetails = (project) => {
    setSelectedProject(project);
    setShowDetailsModal(true);
  };

  const calculateProgress = (project) => {
    if (project.status === 'completed') return 100;
    if (project.status === 'on-hold') return 0;

    const startDate = new Date(project.startDate);
    const deadline = new Date(project.deadline);
    const today = new Date();

    const totalDuration = deadline - startDate;
    const elapsed = today - startDate;

    if (elapsed < 0) return 0;
    if (elapsed > totalDuration) return 100;

    return Math.round((elapsed / totalDuration) * 100);
  };

  const exportToExcel = () => {
    const data = filteredProjects.map(project => ({
      'Project Name': project.name || '-',
      'Description': project.description || '-',
      'Status': project.status.toUpperCase(),
      'Start Date': new Date(project.startDate).toLocaleDateString(),
      'Deadline': new Date(project.deadline).toLocaleDateString(),
      'Days Remaining': Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)),
      'Overdue': isProjectOverdue(project) ? 'Yes' : 'No',

      'Assigned Employees': project.assignedEmployees.map(e => `${e.firstName} ${e.lastName} (${e.employeeId})`).join('; '),
      'Employee Count': project.assignedEmployees?.length || 0,
      'Documents': project.documents?.length || 0,
      'Created By': project.createdBy ? `${project.createdBy.firstName} ${project.createdBy.lastName}` : '-',
      'Created Date': project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '-'
    }));

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => escapeCSV(row[header])).join(','))
    ];

    const csvContent = csvRows.join('\n');
    // Add UTF-8 BOM for proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `projects_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const projectsHTML = filteredProjects.map(project => `
      <div style="margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; border-radius: 0px;">
        <h3 style="color: #667eea; margin-bottom: 10px;">${project.name}</h3>
        <p><strong>Description:</strong> ${project.description || '-'}</p>
        <p><strong>Status:</strong> ${project.status.toUpperCase()}</p>
        <p><strong>Start Date:</strong> ${new Date(project.startDate).toLocaleDateString()}</p>
        <p><strong>Deadline:</strong> ${new Date(project.deadline).toLocaleDateString()}</p>

        <p><strong>Assigned Employees:</strong> ${project.assignedEmployees.map(e => `${e.firstName} ${e.lastName} (${e.employeeId})`).join(', ')}</p>
        <p><strong>Documents:</strong> ${project.documents?.length || 0}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Projects Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #667eea; text-align: center; }
            .meta { text-align: center; color: #666; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1>📋 Projects Report</h1>
          <div class="meta">Generated on ${new Date().toLocaleString()}</div>
          ${projectsHTML}
          <script>window.print(); window.onafterprint = () => window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setShowExportMenu(false);
  };

  const exportToWord = () => {
    const projectsHTML = filteredProjects.map(project => `
      <div style="margin-bottom: 30px; border: 1px solid #ddd; padding: 20px;">
        <h3>${project.name}</h3>
        <p><strong>Description:</strong> ${project.description || '-'}</p>
        <p><strong>Status:</strong> ${project.status.toUpperCase()}</p>
        <p><strong>Start Date:</strong> ${new Date(project.startDate).toLocaleDateString()}</p>
        <p><strong>Deadline:</strong> ${new Date(project.deadline).toLocaleDateString()}</p>

        <p><strong>Assigned Employees:</strong> ${project.assignedEmployees.map(e => `${e.firstName} ${e.lastName} (${e.employeeId})`).join(', ')}</p>
        <p><strong>Documents:</strong> ${project.documents?.length || 0}</p>
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>Projects Report</title></head>
        <body>
          <h1 style="text-align: center; color: #667eea;">📋 Projects Report</h1>
          <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleString()}</p>
          ${projectsHTML}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `projects_${new Date().toISOString().split('T')[0]}.doc`;
    link.click();
    setShowExportMenu(false);
  };

  const visibleProjects = React.useMemo(() => {
    const cutoffDate = new Date('2026-05-01T00:00:00');
    return projects.filter((p) => {
      const projDate = new Date(p.createdAt || p.startDate || 0);
      if (showOldRecords) {
        return projDate < cutoffDate;
      }
      return projDate >= cutoffDate;
    });
  }, [projects, showOldRecords]);

  // Filter projects based on search term, overdue status, month, and employee
  const filteredProjects = visibleProjects.filter(
    (project) => {
      // Role-based visibility handled by backend
      // Backend only returns projects the user is allowed to see

      // Search term filter
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        project.name.toLowerCase().includes(term) ||
        (project.description || '').toLowerCase().includes(term) ||
        project.assignedEmployees?.some(emp =>
          (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(term) ||
          emp.employeeId?.toLowerCase().includes(term)
        );

      // Overdue filter
      let matchesOverdue = true;
      if (filterOverdue === 'overdue') {
        matchesOverdue = isProjectOverdue(project);
      } else if (filterOverdue === 'not-overdue') {
        matchesOverdue = !isProjectOverdue(project);
      }

      // Month filter
      let matchesMonth = true;
      if (filterMonth !== 'all') {
        const projectDate = new Date(project.startDate);
        const projectMonth = `${projectDate.getFullYear()}-${String(projectDate.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = projectMonth === filterMonth;
      }

      // Employee filter
      let matchesEmployee = true;
      if (filterEmployee !== 'all') {
        matchesEmployee = project.assignedEmployees.some(emp => emp._id === filterEmployee);
      }

      // Status filter
      let matchesStatus = true;
      if (filterStatus !== 'all') {
        matchesStatus = project.status === filterStatus;
      }

      return matchesSearch && matchesOverdue && matchesMonth && matchesEmployee && matchesStatus;
    }
  );

  // Filter employees based on employee search term
  const filteredEmployees = employees.filter(
    (emp) =>
      (emp.firstName + " " + emp.lastName)
        .toLowerCase()
        .includes(employeeSearchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  // Filter Sales employees
  const salesEmployees = employees.filter(
    (emp) =>
      emp.role?.name?.toLowerCase().includes("sales") &&
      ((emp.firstName + " " + emp.lastName)
        .toLowerCase()
        .includes(salesSearchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(salesSearchTerm.toLowerCase()))
  );

  // Filter Developer employees
  const developerEmployees = employees.filter(
    (emp) =>
      (emp.role?.name?.toLowerCase().includes("developer") ||
        emp.role?.name?.toLowerCase().includes("engineer") ||
        emp.role?.name?.toLowerCase().includes("programmer")) &&
      ((emp.firstName + " " + emp.lastName)
        .toLowerCase()
        .includes(developerSearchTerm.toLowerCase()) ||
        emp.employeeId
          .includes(developerSearchTerm.toLowerCase()))
  );

  // Calculate metrics
  const totalProjects = visibleProjects.length;
  const overdueProjects = visibleProjects.filter(p => isProjectOverdue(p)).length;
  const activeProjects = visibleProjects.filter(p => p.status === 'active').length;
  const completedProjects = visibleProjects.filter(p => p.status === 'completed').length;
  const onHoldProjects = visibleProjects.filter(p => p.status === 'on-hold').length;

  // Calculate percentage changes (mock data - you can calculate actual based on previous period)
  const totalChange = "+5.2%";
  const activeChange = "+3.1%";
  const completedChange = "+12.5%";
  const overdueChange = overdueProjects > 0 ? "+8.3%" : "0%";

  // Generate chart data for projects timeline
  const generateTimelineData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      last6Months.push(months[monthIndex]);
    }

    // Count projects by month
    const data = last6Months.map(month => {
      const monthIndex = months.indexOf(month);
      const count = visibleProjects.filter(p => {
        const projectMonth = new Date(p.startDate).getMonth();
        return projectMonth === monthIndex;
      }).length;
      return { month, count };
    });

    return data;
  };

  // Generate status distribution data
  const generateStatusData = () => {
    return [
      { status: 'On Track', count: visibleProjects.filter(p => p.status === 'active' && !isProjectOverdue(p)).length, color: '#a8e63d' },
      { status: 'Completed', count: completedProjects, color: '#3b82f6' },
      { status: 'On Hold', count: onHoldProjects, color: '#f59e0b' },
      { status: 'Overdue', count: overdueProjects, color: '#ef4444' }
    ];
  };

  // Generate multi-line chart data for project activity (Full Year or Single Month)
  const generateActivityData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearToShow = activitySelectedYear;

    // If viewing by month, return weekly data for selected month
    if (activityViewMode === 'month') {
      const daysInMonth = new Date(yearToShow, activitySelectedMonth + 1, 0).getDate();
      const weeks = [];

      for (let day = 1; day <= daysInMonth; day += 7) {
        const weekEnd = Math.min(day + 6, daysInMonth);
        const weekLabel = day === 1 ? `Week 1` : `Week ${Math.ceil(day / 7)}`;

        // Count projects started in this week
        const started = visibleProjects.filter(p => {
          const date = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : null);
          return date &&
            date.getFullYear() === yearToShow &&
            date.getMonth() === activitySelectedMonth &&
            date.getDate() >= day &&
            date.getDate() <= weekEnd;
        }).length;

        // Count projects completed in this week
        const completed = visibleProjects.filter(p => {
          if (p.status === 'completed') {
            const date = p.deadline ? new Date(p.deadline) : (p.updatedAt ? new Date(p.updatedAt) : null);
            return date &&
              date.getFullYear() === yearToShow &&
              date.getMonth() === activitySelectedMonth &&
              date.getDate() >= day &&
              date.getDate() <= weekEnd;
          }
          return false;
        }).length;

        // Count active projects during this week
        const weekStart = new Date(yearToShow, activitySelectedMonth, day);
        const weekEndDate = new Date(yearToShow, activitySelectedMonth, weekEnd);

        const active = visibleProjects.filter(p => {
          const startDate = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : null);
          if (!startDate || startDate > weekEndDate) return false;

          if (p.status === 'active') return startDate <= weekEndDate;

          if (p.status === 'completed') {
            const completionDate = p.deadline ? new Date(p.deadline) : (p.updatedAt ? new Date(p.updatedAt) : null);
            return !completionDate || completionDate >= weekStart;
          }

          return false;
        }).length;

        weeks.push({
          month: weekLabel,
          started,
          completed,
          active
        });
      }

      return weeks;
    }

    // Otherwise return yearly data (all 12 months)
    return months.map((month, monthIndex) => {
      // Count projects started in this month (using startDate or createdAt)
      const started = visibleProjects.filter(p => {
        const date = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : null);
        return date && date.getFullYear() === yearToShow && date.getMonth() === monthIndex;
      }).length;

      // Count projects completed in this month (using deadline or updatedAt if status is completed)
      const completed = visibleProjects.filter(p => {
        if (p.status === 'completed') {
          const date = p.deadline ? new Date(p.deadline) : (p.updatedAt ? new Date(p.updatedAt) : null);
          return date && date.getFullYear() === yearToShow && date.getMonth() === monthIndex;
        }
        return false;
      }).length;

      // Count active projects during this month (started before or during this month and not yet completed or completed after)
      const active = visibleProjects.filter(p => {
        const startDate = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : null);
        if (!startDate) return false;

        // Check if project was started on or before the end of this month
        const monthEnd = new Date(yearToShow, monthIndex + 1, 0); // Last day of the month
        if (startDate > monthEnd) return false;

        // Check if project is either still active or was completed after this month starts
        const monthStart = new Date(yearToShow, monthIndex, 1);

        if (p.status === 'active') {
          return startDate <= monthEnd;
        }

        if (p.status === 'completed') {
          const completionDate = p.deadline ? new Date(p.deadline) : (p.updatedAt ? new Date(p.updatedAt) : null);
          return !completionDate || completionDate >= monthStart;
        }

        return false;
      }).length;

      return {
        month,
        started,
        completed,
        active
      };
    });
  };

  // Generate heatmap data for project activity by day and time
  const generateHeatmapData = () => {
    const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize activity map with zeros
    const activityMap = {};
    hours.forEach(hour => {
      activityMap[hour] = {};
      days.forEach(day => {
        activityMap[hour][day] = 0;
      });
    });

    // Count actual project activities based on createdAt and updatedAt timestamps
    visibleProjects.forEach(project => {
      // Count creation activity
      if (project.createdAt) {
        const date = new Date(project.createdAt);
        const dayIndex = date.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = date.getHours();

        // Map hour to our heatmap hours (9am-3pm)
        let hourSlot = null;
        if (hour >= 9 && hour < 10) hourSlot = '9am';
        else if (hour >= 10 && hour < 11) hourSlot = '10am';
        else if (hour >= 11 && hour < 12) hourSlot = '11am';
        else if (hour >= 12 && hour < 13) hourSlot = '12pm';
        else if (hour >= 13 && hour < 14) hourSlot = '1pm';
        else if (hour >= 14 && hour < 15) hourSlot = '2pm';
        else if (hour >= 15 && hour < 16) hourSlot = '3pm';

        if (hourSlot && activityMap[hourSlot]) {
          const dayName = days[dayIndex];
          activityMap[hourSlot][dayName]++;
        }
      }

      // Also count update activity (if different from creation)
      if (project.updatedAt && project.createdAt) {
        const createdTime = new Date(project.createdAt).getTime();
        const updatedTime = new Date(project.updatedAt).getTime();

        // Only count if updated more than 1 minute after creation
        if (updatedTime - createdTime > 60000) {
          const date = new Date(project.updatedAt);
          const dayIndex = date.getDay();
          const hour = date.getHours();

          let hourSlot = null;
          if (hour >= 9 && hour < 10) hourSlot = '9am';
          else if (hour >= 10 && hour < 11) hourSlot = '10am';
          else if (hour >= 11 && hour < 12) hourSlot = '11am';
          else if (hour >= 12 && hour < 13) hourSlot = '12pm';
          else if (hour >= 13 && hour < 14) hourSlot = '1pm';
          else if (hour >= 14 && hour < 15) hourSlot = '2pm';
          else if (hour >= 15 && hour < 16) hourSlot = '3pm';

          if (hourSlot && activityMap[hourSlot]) {
            const dayName = days[dayIndex];
            activityMap[hourSlot][dayName]++;
          }
        }
      }
    });

    // Find max value for normalization
    let maxValue = 1;
    Object.values(activityMap).forEach(hourData => {
      Object.values(hourData).forEach(count => {
        if (count > maxValue) maxValue = count;
      });
    });

    // Convert to array format and normalize to 0-100 scale
    return hours.map(hour => {
      return days.map(day => {
        const rawValue = activityMap[hour][day];
        const normalizedValue = maxValue > 0 ? Math.round((rawValue / maxValue) * 100) : 0;

        return {
          hour,
          day,
          value: normalizedValue,
          count: rawValue // Keep actual count for tooltip
        };
      });
    });
  };

  const timelineData = generateTimelineData();
  const statusData = generateStatusData();
  const activityData = generateActivityData();
  const heatmapData = generateHeatmapData();
  const maxTimelineValue = Math.max(...timelineData.map(d => d.count), 1);
  const maxActivityValue = Math.max(
    ...activityData.map(d => Math.max(d.started, d.completed, d.active)),
    10
  );
  const totalStatusCount = statusData.reduce((sum, d) => sum + d.count, 0);

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProjects.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOverdue, filterMonth, filterEmployee]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Helper function to create smooth curves using catmull-rom spline
  const createSmoothPath = (points, tension = 0.5) => {
    if (points.length < 2) return '';

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
      const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
      const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return path;
  };

  return (
    <div className="page-container" style={{ padding: "20px", background: "#f8fafc", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif", overflow: "hidden" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            box-sizing: border-box;
          }
          
          input::placeholder {
            color: #9ca3af;
            font-weight: 400;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 20px;
            width: 100%;
          }
          
          .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
            width: 100%;
          }
          
          @media (max-width: 1200px) {
            .metrics-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
            .charts-grid {
              grid-template-columns: 1fr !important;
            }
          }
          
          @media (max-width: 768px) {
            .metrics-grid {
              grid-template-columns: 1fr !important;
            }
          }
          
          svg path, svg circle, svg line {
            transition: all 0.3s ease;
          }
          
          svg circle:hover {
            r: 6;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          }
          
          svg path:hover {
            filter: brightness(1.1);
          }

          .project-liquid-btn {
            position: relative;
            overflow: hidden;
            isolation: isolate;
            background: var(--liquid-base, #3b775e);
            color: var(--liquid-text, #ffffff);
          }

          .project-liquid-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
            transform: translateX(-110%);
            transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
            z-index: 0;
          }

          .project-liquid-btn::after {
            content: '';
            position: absolute;
            top: -35%;
            left: -38%;
            width: 62%;
            height: 170%;
            background:
              radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
              radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
              radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
            border-radius: 44% 56% 58% 42%;
            transform: translateX(-145%) rotate(8deg);
            transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
            z-index: 0;
            opacity: 0.95;
            pointer-events: none;
          }

          .project-liquid-btn:hover {
            color: var(--liquid-hover-text, #1f2937) !important;
          }

          .project-liquid-btn:hover::before {
            transform: translateX(0%);
          }

          .project-liquid-btn:hover::after {
            transform: translateX(255%) rotate(8deg);
          }

          .project-liquid-btn > * {
            position: relative;
            z-index: 1;
          }

          /* Date and Export button hover effects */
          .projects-date-btn,
          .projects-export-btn {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            transition: color 0.35s ease, border-color 0.35s ease;
          }

          .projects-date-btn::before,
          .projects-export-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
            transform: translateX(-110%);
            transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
            z-index: 0;
            pointer-events: none;
          }

          .projects-date-btn::after,
          .projects-export-btn::after {
            content: '';
            position: absolute;
            top: -35%;
            left: -38%;
            width: 62%;
            height: 170%;
            background:
              radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
              radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
              radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
            border-radius: 44% 56% 58% 42%;
            transform: translateX(-145%) rotate(8deg);
            transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
            z-index: 0;
            opacity: 0.95;
            pointer-events: none;
          }

          .projects-date-btn:hover,
          .projects-export-btn:hover {
            color: #1f2937 !important;
            border-color: transparent !important;
          }

          .projects-date-btn:hover::before,
          .projects-export-btn:hover::before {
            transform: translateX(0%);
          }

          .projects-date-btn:hover::after,
          .projects-export-btn:hover::after {
            transform: translateX(255%) rotate(8deg);
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          /* Bubble float animations */
          @keyframes bubble-float-large {
            0%   { transform: translate(0px, 0px) scale(1); }
            30%  { transform: translate(-5px, -7px) scale(1.04); }
            60%  { transform: translate(4px, -4px) scale(0.97); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          @keyframes bubble-float-small {
            0%   { transform: translate(0px, 0px) scale(1); }
            35%  { transform: translate(6px, -9px) scale(1.06); }
            65%  { transform: translate(-4px, -3px) scale(0.95); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          .metrics-grid > div, .charts-grid > div {
            animation: fadeInUp 0.6s ease-out forwards;
            position: relative;
            overflow: hidden;
            isolation: isolate;
          }
          
          /* Floating bubble effects on metric cards */
          .metrics-grid > div::before {
            content: '';
            position: absolute;
            z-index: -1;
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.06;
            right: -26px;
            bottom: -26px;
            pointer-events: none;
            animation: bubble-float-large 5.5s ease-in-out infinite;
          }
          
          .metrics-grid > div::after {
            content: '';
            position: absolute;
            z-index: -1;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.04;
            right: 36px;
            bottom: -20px;
            pointer-events: none;
            animation: bubble-float-small 4.2s ease-in-out infinite;
          }
          
          /* Different bubble colors for each card */
          .metrics-grid > div:nth-child(1)::before,
          .metrics-grid > div:nth-child(1)::after {
            background: #667eea;
          }
          
          .metrics-grid > div:nth-child(2)::before,
          .metrics-grid > div:nth-child(2)::after {
            background: #a8e63d;
          }
          
          .metrics-grid > div:nth-child(3)::before,
          .metrics-grid > div:nth-child(3)::after {
            background: #3b82f6;
          }
          
          .metrics-grid > div:nth-child(4)::before,
          .metrics-grid > div:nth-child(4)::after {
            background: #ef4444;
          }
          
          .metrics-grid > div:nth-child(1) {
            animation-delay: 0.1s;
          }
          
          .metrics-grid > div:nth-child(2) {
            animation-delay: 0.2s;
          }
          
          .metrics-grid > div:nth-child(3) {
            animation-delay: 0.3s;
          }
          
          .metrics-grid > div:nth-child(4) {
            animation-delay: 0.4s;
          }
          
          /* Stagger bubble animations for visual variety */
          .metrics-grid > div:nth-child(2)::before {
            animation-delay: 0.8s;
          }
          
          .metrics-grid > div:nth-child(3)::before {
            animation-delay: 1.5s;
          }
          
          .metrics-grid > div:nth-child(4)::before {
            animation-delay: 2.2s;
          }
          
          .metrics-grid > div:nth-child(2)::after {
            animation-delay: 1.2s;
          }
          
          .metrics-grid > div:nth-child(3)::after {
            animation-delay: 0.5s;
          }
          
          .metrics-grid > div:nth-child(4)::after {
            animation-delay: 1.8s;
          }
        `}
      </style>

      {/* Top Header - Search and Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          gap: "12px"
        }}>
        {/* Search Bar with Keyboard Shortcut */}
        <div style={{ position: "relative", flex: "1", maxWidth: "420px" }}>
          <div style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 75px 8px 40px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              background: "#fafafa",
              outline: "none",
              transition: "all 0.2s",
              color: "#111827",
              fontWeight: "400"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#9ca3af";
              e.target.style.background = "white";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e7eb";
              e.target.style.background = "#fafafa";
            }}
          />
          {/* Keyboard Shortcut Indicator */}
          <div style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            pointerEvents: "none"
          }}>
            <span style={{
              fontSize: "11px",
              color: "#64748b",
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: "3px",
              padding: "2px 5px",
              fontWeight: "500",
              lineHeight: "1",
              display: "inline-flex",
              alignItems: "center",
              height: "20px",
              minWidth: "20px",
              justifyContent: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>⌘</span>
            <span style={{
              fontSize: "11px",
              color: "#64748b",
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: "3px",
              padding: "2px 5px",
              fontWeight: "500",
              lineHeight: "1",
              display: "inline-flex",
              alignItems: "center",
              height: "20px",
              minWidth: "20px",
              justifyContent: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>K</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {loading ? (
            <>
              {/* Skeleton for Date Button */}
              <div style={{
                height: "36px",
                width: "80px",
                background: "#e2e8f0",
                borderRadius: "8px"
              }}></div>

              {/* Skeleton for Export Button */}
              <div style={{
                height: "36px",
                width: "95px",
                background: "#e2e8f0",
                borderRadius: "8px"
              }}></div>
            </>
          ) : (
            <>
              <NotificationBell filterType="Project" />
              {/* Date Button */}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="projects-date-btn"
                style={{
                  padding: "8px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  background: showAnalytics ? "#a8e63d" : "white",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: showAnalytics ? "#1f2937" : "#374151",
                  fontWeight: "500"
                }}
              >
                <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <TrendUpIcon />
                  {showAnalytics ? "Hide Analytics" : "View Analytics"}
                </span>
              </button>
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="projects-date-btn"
                style={{
                  padding: "8px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  background: "white",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#374151",
                  fontWeight: "500"
                }}
              >
                <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <CalendarIcon />
                  Date
                </span>
              </button>

              {/* Export Button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="projects-export-btn"
                  style={{
                    padding: "8px 14px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "14px",
                    cursor: "pointer",
                    background: "white",
                    outline: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#374151",
                    fontWeight: "500"
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                    <DownloadIcon />
                    Export
                  </span>
                </button>

                {/* Export Dropdown */}
                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '6px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    minWidth: '180px',
                    overflow: 'hidden',
                    padding: '4px'
                  }}>
                    <button
                      onClick={() => { exportToPDF(); setShowExportMenu(false); }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                        fontWeight: '400'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      Export as PDF
                    </button>
                    <button
                      onClick={() => { exportToExcel(); setShowExportMenu(false); }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                        fontWeight: '400'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      Export as Excel
                    </button>
                    <button
                      onClick={() => { exportToWord(); setShowExportMenu(false); }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                        fontWeight: '400'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      Export as Word
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Date Filter Dropdown (conditionally shown) */}
      {showDateFilter && (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          {loading ? (
            <div style={{
              height: "40px",
              background: "#e2e8f0",
              borderRadius: "8px",
              width: "100%"
            }}></div>
          ) : (
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{
                width: '100%',
                padding: "10px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                background: "white",
                outline: "none"
              }}
            >
              <option value="all">All Time</option>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                return (
                  <option key={monthValue} value={monthValue}>
                    {monthLabel}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="metrics-grid">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                background: "white",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ height: "13px", background: "#e2e8f0", borderRadius: "4px", width: "45%" }}></div>
                  <div style={{ width: "20px", height: "20px", background: "#e2e8f0", borderRadius: "50%" }}></div>
                </div>
                <div style={{ height: "28px", background: "#e2e8f0", borderRadius: "6px", width: "35%", marginBottom: "6px" }}></div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ height: "12px", background: "#f1f5f9", borderRadius: "3px", width: "60%" }}></div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Total Projects */}
            <div style={{
              background: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              border: filterStatus === 'all' && filterOverdue === 'all' ? "2px solid #667eea" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.3s"
            }}
              onClick={() => { setFilterStatus('all'); setFilterOverdue('all'); }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                  Total Projects
                </div>
                <div style={{ color: "#667eea" }}>
                  <FolderIcon />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: "300", color: "#1e293b", marginBottom: "6px" }}>
                {totalProjects}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: "#a8e63d", display: "flex", alignItems: "center", gap: "2px" }}>
                  <TrendUpIcon />
                  <span style={{ fontSize: "12px", fontWeight: "600" }}>{totalChange}</span>
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
              </div>
            </div>

            {/* Active Projects */}
            <div style={{
              background: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              border: filterStatus === 'active' && filterOverdue === 'all' ? "2px solid #a8e63d" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.3s"
            }}
              onClick={() => { setFilterStatus('active'); setFilterOverdue('all'); }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                  In Progress
                </div>
                <div style={{ color: "#a8e63d" }}>
                  <CheckCircleIcon />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: "300", color: "#1e293b", marginBottom: "6px" }}>
                {activeProjects}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: "#a8e63d", display: "flex", alignItems: "center", gap: "2px" }}>
                  <TrendUpIcon />
                  <span style={{ fontSize: "12px", fontWeight: "600" }}>{activeChange}</span>
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
              </div>
            </div>

            {/* Completed Projects */}
            <div style={{
              background: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              border: filterStatus === 'completed' && filterOverdue === 'all' ? "2px solid #3b82f6" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.3s"
            }}
              onClick={() => { setFilterStatus('completed'); setFilterOverdue('all'); }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                  Completed
                </div>
                <div style={{ color: "#3b82f6" }}>
                  <CheckCircleIcon />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: "300", color: "#1e293b", marginBottom: "6px" }}>
                {completedProjects}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: "#a8e63d", display: "flex", alignItems: "center", gap: "2px" }}>
                  <TrendUpIcon />
                  <span style={{ fontSize: "12px", fontWeight: "600" }}>{completedChange}</span>
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
              </div>
            </div>

            {/* Overdue Projects */}
            <div style={{
              background: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              border: filterOverdue === 'overdue' ? "2px solid #ef4444" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.3s"
            }}
              onClick={() => { setFilterStatus('all'); setFilterOverdue('overdue'); }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                  Overdue
                </div>
                <div style={{ color: "#ef4444" }}>
                  <AlertCircleIcon />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: "300", color: "#1e293b", marginBottom: "6px" }}>
                {overdueProjects}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: overdueProjects > 0 ? "#ef4444" : "#a8e63d", display: "flex", alignItems: "center", gap: "2px" }}>
                  {overdueProjects > 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                  <span style={{ fontSize: "12px", fontWeight: "600" }}>{overdueChange}</span>
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
              </div>
            </div>
          </>
        )}
      </div>

      {showAnalytics && (
        <>
          {/* Charts Section */}
          <div className="charts-grid">
            {loading ? (
              <>
                {/* Heatmap Skeleton */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ height: "14px", background: "#e2e8f0", borderRadius: "4px", width: "120px", marginBottom: "4px" }}></div>
                      <div style={{ height: "11px", background: "#f1f5f9", borderRadius: "3px", width: "90px" }}></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "2px" }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                      <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
                        {[1, 2, 3, 4, 5, 6, 7].map((row) => (
                          <div key={row} style={{ height: "24px", background: "#e2e8f0", borderRadius: "4px" }}></div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Line Chart Skeleton */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ height: "14px", background: "#e2e8f0", borderRadius: "4px", width: "110px", marginBottom: "4px" }}></div>
                      <div style={{ height: "11px", background: "#f1f5f9", borderRadius: "3px", width: "140px" }}></div>
                    </div>
                  </div>
                  <div style={{ height: "180px", background: "#f8fafc", borderRadius: "8px", marginBottom: "10px" }}></div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <div style={{ height: "11px", background: "#e2e8f0", borderRadius: "3px", width: "70px" }}></div>
                    <div style={{ height: "11px", background: "#e2e8f0", borderRadius: "3px", width: "80px" }}></div>
                  </div>
                </div>

                {/* Donut Chart Skeleton */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ height: "14px", background: "#e2e8f0", borderRadius: "4px", width: "100px", marginBottom: "4px" }}></div>
                    <div style={{ height: "11px", background: "#f1f5f9", borderRadius: "3px", width: "120px" }}></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                    <div style={{ width: "140px", height: "140px", background: "#f8fafc", borderRadius: "50%", border: "20px solid #e2e8f0" }}></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "10px", height: "10px", background: "#e2e8f0", borderRadius: "2px" }}></div>
                          <div style={{ height: "11px", background: "#f1f5f9", borderRadius: "3px", width: "60px" }}></div>
                        </div>
                        <div style={{ height: "11px", background: "#e2e8f0", borderRadius: "3px", width: "40px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Heatmap - Projects by Time */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                        Projects by Time
                      </h3>
                      <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
                        Activity heatmap
                      </p>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ display: "inline-block", width: "10px", height: "10px", background: "rgba(168, 230, 61, 0.1)", borderRadius: "2px", border: "1px solid rgba(0,0,0,0.05)" }}></span>
                      <span style={{ fontSize: "10px", fontWeight: "500" }}>0</span>
                      <div style={{ width: "30px", height: "2px", background: "linear-gradient(to right, rgba(168, 230, 61, 0.1), rgba(168, 230, 61, 0.9))", margin: "0 2px" }}></div>
                      <span style={{ display: "inline-block", width: "10px", height: "10px", background: "rgba(168, 230, 61, 0.9)", borderRadius: "2px" }}></span>
                      <span style={{ fontSize: "10px", fontWeight: "500" }}>2500</span>
                    </div>
                  </div>

                  {/* Heatmap Grid */}
                  <div style={{ display: "flex", gap: "0" }}>
                    {/* Time labels */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginRight: "8px", paddingTop: "20px" }}>
                      {['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm'].map(hour => (
                        <div key={hour} style={{
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "10px",
                          color: "#64748b",
                          fontWeight: "500"
                        }}>
                          {hour}
                        </div>
                      ))}
                    </div>

                    {/* Heatmap cells */}
                    <div style={{ flex: 1 }}>
                      {/* Day labels */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "5px" }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} style={{
                            fontSize: "10px",
                            color: "#64748b",
                            textAlign: "center",
                            fontWeight: "500"
                          }}>
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Heat cells */}
                      {heatmapData.map((row, rowIndex) => (
                        <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
                          {row.map((cell, cellIndex) => {
                            const intensity = cell.value / 100;
                            // Use lower base opacity and more dramatic scaling
                            const opacity = intensity < 0.2 ? 0.08 : intensity < 0.4 ? 0.2 : intensity < 0.6 ? 0.4 : intensity < 0.8 ? 0.65 : 0.9;
                            const color = `rgba(168, 230, 61, ${opacity})`; // Using sidebar brand lime green
                            return (
                              <div
                                key={cellIndex}
                                title={`${cell.day} ${cell.hour}: ${cell.count || 0} activit${cell.count !== 1 ? 'ies' : 'y'}`}
                                style={{
                                  height: "24px",
                                  background: color,
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                  border: intensity > 0.3 ? "none" : "1px solid rgba(0,0,0,0.05)"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.08)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(168, 230, 61, 0.3)';
                                  e.currentTarget.style.zIndex = '10';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                  e.currentTarget.style.zIndex = '1';
                                }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Smooth Line Chart - Project Activity */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                        Project Activity
                      </h3>
                      <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
                        {activityViewMode === 'year' ? 'Year-round tracking trends' : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][activitySelectedMonth]} ${activitySelectedYear} weekly trends`}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {/* View Mode Toggle */}
                      <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                        <button
                          onClick={() => setActivityViewMode('year')}
                          style={{
                            padding: "4px 10px",
                            fontSize: "10px",
                            fontWeight: "500",
                            border: "none",
                            background: activityViewMode === 'year' ? '#a8e63d' : 'white',
                            color: activityViewMode === 'year' ? '#1e293b' : '#64748b',
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}>
                          Year
                        </button>
                        <button
                          onClick={() => setActivityViewMode('month')}
                          style={{
                            padding: "4px 10px",
                            fontSize: "10px",
                            fontWeight: "500",
                            border: "none",
                            borderLeft: "1px solid #e2e8f0",
                            background: activityViewMode === 'month' ? '#a8e63d' : 'white',
                            color: activityViewMode === 'month' ? '#1e293b' : '#64748b',
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}>
                          Month
                        </button>
                      </div>

                      {/* Year Selector */}
                      <select
                        value={activitySelectedYear}
                        onChange={(e) => setActivitySelectedYear(Number(e.target.value))}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          fontSize: "11px",
                          background: "white",
                          cursor: "pointer",
                          color: "#64748b",
                          outline: "none"
                        }}>
                        {[2024, 2025, 2026].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>

                      {/* Month Selector (only show when viewing by month) */}
                      {activityViewMode === 'month' && (
                        <select
                          value={activitySelectedMonth}
                          onChange={(e) => setActivitySelectedMonth(Number(e.target.value))}
                          style={{
                            padding: "4px 8px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "11px",
                            background: "white",
                            cursor: "pointer",
                            color: "#64748b",
                            outline: "none"
                          }}>
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                            <option key={idx} value={idx}>{month}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "10px", height: "2.5px", background: "#a8e63d", borderRadius: "2px" }}></div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Started</span>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#1e293b" }}>
                        {activityData.reduce((sum, d) => sum + d.started, 0)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "10px", height: "2.5px", background: "#7aad7a", borderRadius: "2px" }}></div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Completed</span>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#1e293b" }}>
                        {activityData.reduce((sum, d) => sum + d.completed, 0)}
                      </span>
                    </div>
                  </div>

                  {/* SVG Smooth Curves */}
                  <div style={{ position: "relative", height: "180px", marginTop: "10px" }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                      <defs>
                        <linearGradient id="gradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#a8e63d" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#a8e63d" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#7aad7a" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#7aad7a" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      {[20, 40, 60, 80].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          y1={y}
                          x2="100"
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="0.3"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}

                      {/* Smooth curve 1 - Started */}
                      <path
                        d={createSmoothPath(activityData.map((d, i) => ({
                          x: (i / (activityData.length - 1)) * 100,
                          y: 90 - (d.started / maxActivityValue) * 70
                        })))}
                        fill="none"
                        stroke="#a8e63d"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Area fill for curve 1 */}
                      <path
                        d={createSmoothPath(activityData.map((d, i) => ({
                          x: (i / (activityData.length - 1)) * 100,
                          y: 90 - (d.started / maxActivityValue) * 70
                        }))) + ` L 100 90 L 0 90 Z`}
                        fill="url(#gradient1)"
                      />

                      {/* Smooth curve 2 - Completed */}
                      <path
                        d={createSmoothPath(activityData.map((d, i) => ({
                          x: (i / (activityData.length - 1)) * 100,
                          y: 90 - (d.completed / maxActivityValue) * 70
                        })))}
                        fill="none"
                        stroke="#7aad7a"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data points with hover */}
                      {activityData.map((d, i) => {
                        const x = (i / (activityData.length - 1)) * 100;
                        const y = 90 - (d.started / maxActivityValue) * 70;
                        return (
                          <circle
                            key={`dot-${i}`}
                            cx={x}
                            cy={y}
                            r="0.8"
                            fill="#a8e63d"
                            stroke="white"
                            strokeWidth="0.5"
                            vectorEffect="non-scaling-stroke"
                            style={{ cursor: 'pointer' }}
                          >
                            <title>{`${d.month}: ${d.started} started, ${d.completed} completed`}</title>
                          </circle>
                        );
                      })}
                    </svg>

                    {/* X-axis labels below SVG */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "8px",
                      paddingTop: "4px",
                      borderTop: "1px solid #f1f5f9"
                    }}>
                      {activityData.map((d, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "10px",
                            color: "#94a3b8",
                            fontWeight: "500"
                          }}
                        >
                          {d.month}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Professional Status Distribution */}
                <div style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "16px" }}>
                    <h3 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                      Project Status
                    </h3>
                    <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
                      Current distribution
                    </p>
                  </div>

                  {/* Professional Donut Chart */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <defs>
                        {statusData.map((data, index) => (
                          <linearGradient key={`grad-${index}`} id={`donutGrad${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={data.color} stopOpacity="1" />
                            <stop offset="100%" stopColor={data.color} stopOpacity="0.8" />
                          </linearGradient>
                        ))}
                      </defs>

                      {/* Background ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="42"
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="14"
                      />

                      {/* Status arc segments */}
                      {(() => {
                        let currentAngle = -90;
                        const radius = 42;
                        const strokeWidth = 14;
                        const circumference = 2 * Math.PI * radius;

                        return statusData.map((data, index) => {
                          const percentage = totalStatusCount > 0 ? (data.count / totalStatusCount) : 0;
                          const angle = percentage * 360;
                          const arcLength = (percentage * circumference);
                          const startAngle = currentAngle;
                          currentAngle += angle;

                          // Calculate start position
                          const startRad = (startAngle * Math.PI) / 180;
                          const x = 60 + radius * Math.cos(startRad);
                          const y = 60 + radius * Math.sin(startRad);

                          return (
                            <circle
                              key={index}
                              cx="60"
                              cy="60"
                              r={radius}
                              fill="none"
                              stroke={`url(#donutGrad${index})`}
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${arcLength} ${circumference}`}
                              strokeDashoffset={circumference - (startAngle + 90) / 360 * circumference}
                              strokeLinecap="round"
                              style={{
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                transformOrigin: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                                e.currentTarget.setAttribute('stroke-width', '16');
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = 'brightness(1)';
                                e.currentTarget.setAttribute('stroke-width', '14');
                              }}
                            >
                              <title>{`${data.status}: ${data.count} (${(percentage * 100).toFixed(1)}%)`}</title>
                            </circle>
                          );
                        });
                      })()}

                      {/* Center white circle for donut effect */}
                      <circle
                        cx="60"
                        cy="60"
                        r="35"
                        fill="white"
                      />

                      {/* Center text */}
                      <text x="60" y="56" textAnchor="middle" fill="#1e293b" fontSize="22" fontWeight="700">
                        {totalStatusCount}
                      </text>
                      <text x="60" y="68" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="500">
                        Projects
                      </text>
                    </svg>
                  </div>

                  {/* Status List - Enhanced */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {statusData.map((data, index) => {
                      const percentage = totalStatusCount > 0 ? ((data.count / totalStatusCount) * 100).toFixed(1) : 0;
                      return (
                        <div key={index} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          transition: "background 0.2s"
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                            <div style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: data.color,
                              boxShadow: `0 0 0 3px ${data.color}15`
                            }}></div>
                            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500" }}>
                              {data.status}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                              {data.count}
                            </span>
                            <span style={{ fontSize: "11px", color: "#9ca3af", minWidth: "38px", textAlign: "right", fontWeight: "600" }}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Dropdown hover styles */}
      <style>{`
        .proj-filter-select {
          padding: 7px 32px 7px 12px;
          border: none;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2316a34a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 10px center;
          appearance: none;
          -webkit-appearance: none;
          outline: none;
          color: #1e293b;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
          transition: background 0.2s;
          box-shadow: none;
        }
        .proj-filter-select:hover { background-color: #f0fdf4; box-shadow: none; }
        .proj-filter-select:focus { background-color: #f0fdf4; box-shadow: none; }
        .proj-dd-option:hover { background: #f0fdf4 !important; color: #15803d !important; }
      `}</style>

      {/* Additional Filters and View Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>

          <button
            onClick={() => { setShowOldRecords(!showOldRecords); setCurrentPage(1); }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', border: showOldRecords ? '1px solid #3b775e' : '1px solid #e2e8f0', borderRadius: '999px', fontSize: '12px', color: showOldRecords ? '#3b775e' : '#1e293b', background: showOldRecords ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          >
            {showOldRecords ? 'See new records' : 'See old records'}
          </button>

          {/* Status Filter - custom dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setStatusDdOpen(o => !o); setEmpDdOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', border: 'none', borderRadius: '999px',
                fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                background: statusDdOpen ? '#f0fdf4' : '#ffffff',
                color: '#1e293b', outline: 'none',
                fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                transition: 'background 0.2s'
              }}
            >
              <span>
                {filterOverdue === 'overdue' ? 'Overdue' :
                  filterStatus === 'all' ? 'All Statuses' :
                    [{ value: 'active', label: 'Progress' }, { value: 'completed', label: 'Completed' }, { value: 'on-hold', label: 'On Hold' }, { value: 'review', label: 'Review' }, { value: 'canceled', label: 'Canceled' }].find(o => o.value === filterStatus)?.label || 'All Statuses'}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {statusDdOpen && (
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: '#ffffff', borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.10)', zIndex: 200,
                minWidth: '180px', padding: '6px', overflow: 'hidden'
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px 4px 12px' }}>
                  STATUS
                </div>
                {[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Progress', dot: '#0369a1' },
                  { value: 'review', label: 'Review', dot: '#c026d3' },
                  { value: 'completed', label: 'Completed', dot: '#2563eb' },
                  { value: 'on-hold', label: 'On Hold', dot: '#d97706' },
                  { value: 'canceled', label: 'Canceled', dot: '#b91c1c' },
                  { value: 'overdue', label: 'Overdue', dot: '#dc2626' }
                ].map(opt => {
                  const isSelected = (opt.value === 'all' && filterStatus === 'all' && filterOverdue === 'all') ||
                    (opt.value === 'overdue' && filterOverdue === 'overdue') ||
                    (opt.value !== 'all' && opt.value !== 'overdue' && filterStatus === opt.value);
                  return (
                    <div
                      key={opt.value}
                      className="proj-dd-option"
                      onClick={() => {
                        if (opt.value === 'all') { setFilterStatus('all'); setFilterOverdue('all'); }
                        else if (opt.value === 'overdue') { setFilterStatus('all'); setFilterOverdue('overdue'); }
                        else { setFilterStatus(opt.value); setFilterOverdue('all'); }
                        setStatusDdOpen(false);
                      }}
                      style={{
                        padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: isSelected ? '600' : '500',
                        cursor: 'pointer', color: isSelected ? '#16a34a' : '#475569',
                        background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                        fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                        transition: 'background 0.15s',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginTop: opt.value === 'all' ? '0' : '2px'
                      }}
                    >
                      {opt.dot && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.dot }} />
                      )}
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Employee Filter - custom wide grid dropdown */}
          {["Admin", "HR Manager", "HR"].includes(user?.role?.name) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEmpDdOpen(o => !o); setStatusDdOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', border: 'none', borderRadius: '999px',
                  fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                  background: empDdOpen ? '#f0fdf4' : '#ffffff',
                  color: '#1e293b', outline: 'none',
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  transition: 'background 0.2s'
                }}
              >
                <span>
                  {filterEmployee === 'all' ? 'All Employees' : (() => {
                    const e = employees.find(em => em._id === filterEmployee);
                    return e ? `${e.firstName} ${e.lastName}` : 'All Employees';
                  })()}
                </span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {empDdOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  background: '#ffffff', borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.10)', zIndex: 200,
                  width: '620px', padding: '10px', overflow: 'hidden'
                }}>
                  {/* Search Bar */}
                  <div style={{ padding: '4px 8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={filterEmpSearch}
                      onChange={(e) => setFilterEmpSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* All Employees option */}
                  <div
                    className="proj-dd-option"
                    onClick={() => { setFilterEmployee('all'); setEmpDdOpen(false); setFilterEmpSearch(''); }}
                    style={{
                      padding: '7px 12px', borderRadius: '8px', fontSize: '12px',
                      fontWeight: filterEmployee === 'all' ? '600' : '400',
                      cursor: 'pointer', color: filterEmployee === 'all' ? '#15803d' : '#1e293b',
                      background: filterEmployee === 'all' ? '#dcfce7' : 'transparent',
                      marginBottom: '6px',
                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                    }}
                  >All Employees</div>
                  {/* Grid of employees */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', maxHeight: '300px', overflowY: 'auto' }}>
                    {employees
                      .filter(emp => emp.isActive !== false)
                      .filter(emp => {
                        const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                        return name.includes(filterEmpSearch.toLowerCase());
                      })
                      .slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                      .map(emp => (
                        <div
                          key={emp._id}
                          className="proj-dd-option"
                          onClick={() => { setFilterEmployee(emp._id); setEmpDdOpen(false); }}
                          style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                            fontWeight: filterEmployee === emp._id ? '600' : '400',
                            cursor: 'pointer',
                            color: filterEmployee === emp._id ? '#15803d' : '#1e293b',
                            background: filterEmployee === emp._id ? '#dcfce7' : 'transparent',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                            transition: 'background 0.15s'
                          }}
                          title={`${emp.firstName} ${emp.lastName}`}
                        >{emp.firstName} {emp.lastName}</div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Toggle and Create Button */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {loading ? (
            <>
              {/* Skeleton for View Toggle */}
              <div style={{
                height: "32px",
                width: "120px",
                background: "#e2e8f0",
                borderRadius: "999px"
              }}></div>

              {/* Skeleton for Create Button (shown only if canCreate) */}
              {canCreate && (
                <div style={{
                  height: "32px",
                  width: "130px",
                  background: "#e2e8f0",
                  borderRadius: "6px"
                }}></div>
              )}
            </>
          ) : (
            <>
              <div style={{
                display: 'flex',
                background: '#ffffff',
                borderRadius: '999px',
                padding: '3px',
                gap: '2px',
                border: '1px solid #e2e8f0'
              }}>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: "6px 18px",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: viewMode === 'table' ? '#a8e63d' : 'transparent',
                    color: viewMode === 'table' ? '#1a4a00' : '#64748b',
                    outline: "none",
                    transition: "all 0.2s ease",
                    letterSpacing: "0.01em"
                  }}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  style={{
                    padding: "6px 18px",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: viewMode === 'card' ? '#a8e63d' : 'transparent',
                    color: viewMode === 'card' ? '#1a4a00' : '#64748b',
                    outline: "none",
                    transition: "all 0.2s ease",
                    letterSpacing: "0.01em"
                  }}
                >
                  Grid
                </button>
              </div>

              {canCreate && (
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setSelectedProjectForAssignment("");
                    setShowProjectDropdown(true);
                    setSelectedFiles([]);
                    setFormData({
                      name: "",
                      description: "",
                      assignedEmployees: [],
                      startDate: "",
                      deadline: "",
                      status: "active",
                    });
                    setShowModal(true);
                  }}
                  style={{
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: "#3b775e",
                    color: 'white',
                    outline: "none",
                    transition: "background 0.2s ease",
                    boxShadow: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    letterSpacing: "0.01em"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2f6350'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#3b775e'}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Assign Project
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Card/Grid View */}
      {
        viewMode === 'card' && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', width: '100%' }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={{
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '10px'
                  }}>
                    {/* Header skeleton */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '4px', width: '70%', marginBottom: '2px' }}></div>
                        <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '3px', width: '90%' }}></div>
                      </div>
                      <div style={{ width: '16px', height: '16px', background: '#e2e8f0', borderRadius: '3px' }}></div>
                    </div>

                    {/* Dates skeleton */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '3px', width: '50%', marginBottom: '2px' }}></div>
                        <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '3px', width: '60%' }}></div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '3px', width: '50%', marginBottom: '2px' }}></div>
                        <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '3px', width: '60%' }}></div>
                      </div>
                    </div>
                    {/* Team skeleton */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '3px', width: '40%', marginBottom: '3px' }}></div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '20px', height: '20px', background: '#e2e8f0', borderRadius: '50%' }}></div>
                        <div style={{ width: '20px', height: '20px', background: '#e2e8f0', borderRadius: '50%' }}></div>
                        <div style={{ width: '20px', height: '20px', background: '#e2e8f0', borderRadius: '50%' }}></div>
                      </div>
                    </div>
                    {/* Buttons skeleton */}
                    <div style={{ display: 'flex', gap: '4px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 1, height: '24px', background: '#e2e8f0', borderRadius: '5px' }}></div>
                      <div style={{ width: '45px', height: '24px', background: '#f1f5f9', borderRadius: '5px' }}></div>
                      <div style={{ width: '35px', height: '24px', background: '#f1f5f9', borderRadius: '5px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '12px' }}>
                <p style={{ color: "#64748b", fontSize: "14px" }}>
                  {searchTerm
                    ? `No projects found matching "${searchTerm}"`
                    : "No projects found"}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', width: '100%' }}>
                  {currentItems.map((project) => {
                    const isOverdue = isProjectOverdue(project);

                    return (
                      <div
                        key={project._id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '20px',
                          border: 'none',
                          boxShadow: isOverdue
                            ? '0 2px 16px rgba(239,68,68,0.10), 0 1px 4px rgba(0,0,0,0.04)'
                            : '0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
                          padding: '14px',
                          paddingTop: '22px',
                          transition: 'all 0.22s ease',
                          cursor: 'pointer',
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06)';
                          e.currentTarget.style.transform = 'translateY(-3px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = isOverdue
                            ? '0 2px 16px rgba(239,68,68,0.10), 0 1px 4px rgba(0,0,0,0.04)'
                            : '0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Hanging Tag Status Icon */}
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          zIndex: 10,
                          transform: 'rotate(90deg)',
                          transformOrigin: 'top center'
                        }}>
                          <svg
                            width="16" height="11"
                            viewBox="0 0 80 50"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0,0 L55,0 L80,25 L55,50 L0,50 Z"
                              fill={isOverdue ? '#ff8080' : project.status === 'completed' ? '#60a5fa' : '#86efac'}
                            />
                          </svg>
                        </div>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '700', color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '40px' }}>
                              {project.name}
                            </h3>
                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}>
                              {project.description || 'No description provided'}
                            </p>
                          </div>
                        </div>



                        {/* Dates */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '2px', fontWeight: '500', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start Date</div>
                            <div style={{ fontSize: '11px', color: project.startDate ? '#0f172a' : '#94a3b8', fontWeight: '600', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}>
                              {project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not set'}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '2px', fontWeight: '500', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deadline</div>
                            <div style={{ fontSize: '11px', color: project.deadline ? (isOverdue ? '#ef4444' : '#0f172a') : '#94a3b8', fontWeight: '600', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}>
                              {project.deadline ? new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not set'}
                            </div>
                          </div>
                        </div>

                        {/* Team Members */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px', fontWeight: '500', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team Members</div>
                          <div 
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(project);
                            }}
                          >
                            <div style={{ display: 'flex' }}>
                              {project.assignedEmployees.slice(0, 4).map((emp, idx) => (
                                <div
                                  key={emp._id}
                                  title={`${emp.firstName} ${emp.lastName}`}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#166534',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '8px',
                                    fontWeight: '600',
                                    border: '1.5px solid white',
                                    marginLeft: idx > 0 ? '-5px' : '0',
                                    cursor: 'pointer',
                                    zIndex: 4 - idx,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                                  }}
                                >
                                  {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                </div>
                              ))}
                              {project.assignedEmployees.length > 4 && (
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  fontWeight: '600',
                                  color: '#64748b',
                                  border: '1.5px solid white',
                                  marginLeft: '-5px'
                                }}>
                                  +{project.assignedEmployees.length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Documents Count */}
                        {project.documents && project.documents.length > 0 && (
                          <div style={{ marginBottom: '8px', padding: '3px 6px', background: '#f8fafc', borderRadius: '3px' }}>
                            <span style={{ fontSize: '9px', color: '#64748b' }}>
                              📎 {project.documents.length} {project.documents.length === 1 ? 'document' : 'documents'}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '4px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
                          <button
                            className="project-liquid-btn"
                            onClick={() => handleViewDetails(project)}
                            style={{
                              '--liquid-base': '#3b775e',
                              '--liquid-text': '#ffffff',
                              '--liquid-hover-text': '#1f2937',
                              flex: 1,
                              padding: '3px 5px',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'color 0.35s ease, transform 0.2s ease',
                              letterSpacing: '0.01em'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#1f2937';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'white';
                            }}
                          >
                            <span>Details</span>
                          </button>
                          {(canUpdate || canDelete) && (
                            <>
                              {canUpdate && <button
                                onClick={() => handleEdit(project)}
                                title="Edit Project"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  outline: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '0.6';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>}
                              {canDelete && <button
                                onClick={() => handleDelete(project._id)}
                                title="Delete Project"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  outline: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '0.6';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls for Card View */}
                {filteredProjects.length > itemsPerPage && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 14px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredProjects.length)} of {filteredProjects.length} projects
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                          padding: '5px 9px',
                          border: 'none',
                          borderRadius: '7px',
                          background: currentPage === 1 ? '#f0fdf4' : '#a3e635',
                          color: currentPage === 1 ? '#86efac' : '#365314',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                          opacity: currentPage === 1 ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.background = '#84cc16';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.background = '#a3e635';
                          }
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                          Prev
                        </span>
                      </button>

                      {/* Page Numbers */}
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              style={{
                                padding: '5px 9px',
                                border: currentPage === pageNum ? 'none' : '1px solid #d9f99d',
                                borderRadius: '7px',
                                background: currentPage === pageNum ? '#a3e635' : '#f0fdf4',
                                color: currentPage === pageNum ? '#365314' : '#4d7c0f',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                minWidth: '28px',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if (currentPage !== pageNum) {
                                  e.currentTarget.style.background = '#bef264';
                                } else {
                                  e.currentTarget.style.background = '#84cc16';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (currentPage !== pageNum) {
                                  e.currentTarget.style.background = '#f0fdf4';
                                } else {
                                  e.currentTarget.style.background = '#a3e635';
                                }
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '5px 9px',
                          border: 'none',
                          borderRadius: '7px',
                          background: currentPage === totalPages ? '#f0fdf4' : '#a3e635',
                          color: currentPage === totalPages ? '#86efac' : '#365314',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                          opacity: currentPage === totalPages ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.background = '#84cc16';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.background = '#a3e635';
                          }
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          Next
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      }

      {/* Details Modal */}
      {showDetailsModal && selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setShowDetailsModal(false)}
          downloadDocument={downloadDocument}
          getStatusColor={getStatusColor}
          isProjectOverdue={isProjectOverdue}
          onRemarkAdded={(updatedProject) => {
            setSelectedProject(updatedProject);
            fetchProjects();
          }}
        />
      )}

      {/* Table View */}
      {
        viewMode === 'table' && (
          <div style={{ background: "transparent", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {loading ? (
              <div style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <div key={row} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 1fr 120px', gap: '20px', padding: '16px 24px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', width: '65%' }}></div>
                    <div style={{ height: '22px', background: '#f1f5f9', borderRadius: '999px', width: '70%' }}></div>
                    <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', width: '60%' }}></div>
                    <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', width: '60%' }}></div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '999px', width: '80%' }}></div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 2, 3].map(i => <div key={i} style={{ width: '26px', height: '26px', background: '#f1f5f9', borderRadius: '50%' }}></div>)}
                    </div>
                    <div style={{ height: '32px', background: '#f1f5f9', borderRadius: '8px' }}></div>
                  </div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                  {searchTerm ? `No projects found matching "${searchTerm}"` : "No projects found"}
                </p>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: '20px', overflowY: 'auto', flex: 1, minHeight: 0, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 120px',
                  gap: '0',
                  padding: '0 24px',
                  borderBottom: '1.5px solid #f1f5f9',
                  background: '#fafafa',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  {[
                    { label: 'Project', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18" /><path d="M9 21V9" /></svg> },
                    { label: 'Status', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg> },
                    { label: 'Start Date', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
                    { label: 'Deadline', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
                    { label: 'Team', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
                    { label: 'Actions', icon: null }
                  ].map((col, i) => (
                    <div key={i} style={{
                      padding: '13px 0',
                      paddingRight: i < 5 ? '16px' : '0',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px', fontWeight: '600', color: '#94a3b8',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                      justifyContent: i === 5 ? 'flex-end' : 'flex-start'
                    }}>
                      {col.icon && <span style={{ color: '#b0bec5' }}>{col.icon}</span>}
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* Table Rows */}
                {currentItems.map((project, index) => {
                  const isOverdue = isProjectOverdue(project);

                  const statusConfig = isOverdue
                    ? { bg: '#fff1f2', color: '#e11d48', dot: '#e11d48', label: 'Overdue' }
                    : project.status === 'active'
                      ? { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e', label: 'Progress' }
                      : project.status === 'completed'
                        ? { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6', label: 'Completed' }
                        : project.status === 'review'
                          ? { bg: '#fdf4ff', color: '#c026d3', dot: '#d946ef', label: 'Review' }
                          : project.status === 'canceled'
                            ? { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444', label: 'Canceled' }
                            : { bg: '#fffbeb', color: '#d97706', dot: '#f59e0b', label: 'On Hold' };

                  return (
                    <div
                      key={project._id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 120px',
                        gap: '0',
                        padding: '0 24px',
                        borderBottom: index < currentItems.length - 1 ? '1px solid #f8fafc' : 'none',
                        alignItems: 'center',
                        transition: 'background 0.15s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafffe'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Project Name */}
                      <div style={{ padding: '16px 16px 16px 0' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", letterSpacing: '-0.01em', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.description || 'No description provided'}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div style={{ padding: '16px 16px 16px 0' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '5px 12px', borderRadius: '999px',
                          background: statusConfig.bg, color: statusConfig.color,
                          fontSize: '11px', fontWeight: '600',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          letterSpacing: '0.01em'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusConfig.dot, flexShrink: 0 }}></span>
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Start Date */}
                      <div style={{ padding: '16px 16px 16px 0' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: project.startDate ? '#475569' : '#94a3b8', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                          {project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </div>

                      {/* Deadline */}
                      <div style={{ padding: '16px 16px 16px 0' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: project.deadline ? (isOverdue ? '#e11d48' : '#475569') : '#94a3b8', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                          {project.deadline ? new Date(project.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </div>



                      {/* Team Avatars */}
                      <div style={{ padding: '16px 16px 16px 0' }}>
                        <div 
                          style={{ display: 'flex', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(project);
                          }}
                        >
                          {project.assignedEmployees.slice(0, 3).map((emp, idx) => {
                            const avatarColors = ['#166534', '#1e40af', '#7c3aed', '#b45309', '#0f766e'];
                            const bg = avatarColors[idx % avatarColors.length];
                            return (
                              <div
                                key={emp._id}
                                title={`${emp.firstName} ${emp.lastName}`}
                                style={{
                                  width: '28px', height: '28px', borderRadius: '50%',
                                  background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  border: '2px solid white', marginLeft: idx > 0 ? '-8px' : '0',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)', overflow: 'hidden', flexShrink: 0
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="12" cy="8" r="4" />
                                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                                </svg>
                              </div>
                            );
                          })}
                          {project.assignedEmployees.length > 3 && (
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: '700', color: '#64748b',
                              border: '2px solid white', marginLeft: '-8px',
                              fontFamily: "'Inter','Poppins','Segoe UI',sans-serif"
                            }}>+{project.assignedEmployees.length - 3}</div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', padding: '12px 0' }}>
                        <button
                          onClick={() => handleViewDetails(project)}
                          title="View Details"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {(canUpdate || canDelete) && (
                          <>
                            {canUpdate && <button
                              onClick={() => handleEdit(project)}
                              title="Edit"
                              style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>}
                            {canDelete && <button
                              onClick={() => handleDelete(project._id)}
                              title="Delete"
                              style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && filteredProjects.length > 0 && (
              <div style={{
                marginTop: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    background: currentPage === 1 ? '#f0fdf4' : '#a3e635',
                    border: 'none',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    opacity: currentPage === 1 ? 0.4 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = '#84cc16';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = '#a3e635';
                    }
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                {/* Page Numbers */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '7px',
                        background: currentPage === pageNum ? '#a3e635' : '#f0fdf4',
                        border: currentPage === pageNum ? 'none' : '1px solid #d9f99d',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: currentPage === pageNum ? '#365314' : '#4d7c0f',
                        fontFamily: "'Inter', -apple-system, sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.background = '#bef264';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.background = '#f0fdf4';
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Ellipsis if more pages */}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span style={{
                    padding: '0 4px',
                    color: '#84cc16',
                    fontSize: '12px',
                    fontWeight: '700',
                    fontFamily: "'Inter', -apple-system, sans-serif"
                  }}>...</span>
                )}

                {/* Last page if needed */}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: '#f0fdf4',
                      border: '1px solid #d9f99d',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#4d7c0f',
                      fontFamily: "'Inter', -apple-system, sans-serif"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#bef264'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
                  >
                    {totalPages}
                  </button>
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    background: currentPage === totalPages ? '#f0fdf4' : '#a3e635',
                    border: 'none',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    opacity: currentPage === totalPages ? 0.4 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = '#84cc16';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = '#a3e635';
                    }
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )
      }

      {
        showModal && (
          <div
            className="modal-overlay"
            onClick={() => {
              setShowModal(false);
              setEditingProject(null);
              setSelectedProjectForAssignment("");
              setShowProjectDropdown(true);
              setFormData({ name: "", description: "", startDate: "", deadline: "", status: "active", statusReason: "", assignedEmployees: [] });
              setSelectedFiles([]);
            }}
          >
            <>
              <style>{`
                @keyframes prjModalIn {
                  from { opacity: 0; transform: translateY(16px) scale(0.98); }
                  to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                .prj-modal {
                  background: #fff;
                  border-radius: 18px;
                  width: 100%;
                  max-width: 850px;
                  max-height: 88vh;
                  overflow-y: auto;
                  border: 1px solid #e8edf0;
                  box-shadow: 0 8px 40px rgba(0,0,0,0.13);
                  font-family: 'Inter', 'Segoe UI', sans-serif;
                  animation: prjModalIn 0.22s cubic-bezier(0.16,1,0.3,1);
                  scrollbar-width: none;
                }
                .prj-modal::-webkit-scrollbar { display: none; }
                .prj-modal-hd {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  padding: 18px 20px 16px;
                  border-bottom: 1px solid #f1f3f5;
                  background: #fafafa;
                  border-radius: 18px 18px 0 0;
                  position: sticky;
                  top: 0;
                  z-index: 1;
                }
                .prj-modal-hd-icon {
                  width: 36px;
                  height: 36px;
                  border-radius: 10px;
                  background: rgba(59,119,94,0.1);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                }
                .prj-modal-title {
                  font-size: 14px;
                  font-weight: 700;
                  color: #111827;
                  letter-spacing: -0.01em;
                  line-height: 1.3;
                }
                .prj-modal-sub {
                  font-size: 11.5px;
                  color: #9ca3af;
                  margin-top: 2px;
                  line-height: 1.3;
                  text-transform: capitalize;
                }
                .prj-close-btn {
                  margin-left: auto;
                  width: 28px;
                  height: 28px;
                  border-radius: 50%;
                  background: #f1f5f9;
                  border: none;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #6b7280;
                  flex-shrink: 0;
                  transition: background 0.15s, color 0.15s;
                }
                .prj-close-btn:hover { background: #e5e7eb; color: #111827; }
                .prj-modal-body { 
                  padding: 20px; 
                  max-height: calc(88vh - 80px);
                  overflow-y: auto;
                }
                .prj-form { display: flex; flex-direction: column; gap: 14px; }
                .prj-section-lbl {
                  font-size: 10.5px;
                  font-weight: 700;
                  color: #3b775e;
                  text-transform: uppercase;
                  letter-spacing: 0.07em;
                  padding-bottom: 6px;
                  border-bottom: 1.5px solid #e8f3ee;
                  margin-bottom: 2px;
                }
                .prj-field { display: flex; flex-direction: column; gap: 5px; }
                .prj-lbl {
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #374151;
                  letter-spacing: 0.02em;
                }
                .prj-req { color: #ef4444; margin-left: 2px; }
                .prj-optional { font-weight: 400; color: #c4c9d4; margin-left: 4px; font-size: 11px; }
                .prj-input {
                  width: 100%;
                  padding: 9px 12px;
                  border: 1.5px solid #e5e7eb;
                  border-radius: 9px;
                  font-size: 13px;
                  color: #111827;
                  background: #fff;
                  font-family: 'Inter', sans-serif;
                  box-sizing: border-box;
                  transition: border-color 0.15s, box-shadow 0.15s;
                  outline: none;
                }
                .prj-input:focus {
                  border-color: #3b775e;
                  box-shadow: 0 0 0 3px rgba(59,119,94,0.09);
                }
                .prj-input::placeholder { color: #c4c9d4; font-size: 12.5px; }
                .prj-textarea { resize: none; min-height: 72px; line-height: 1.55; }
                .prj-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .prj-seg-wrap {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  background: #f3f4f6;
                  border-radius: 10px;
                  padding: 3px;
                  gap: 2px;
                }
                .prj-seg-btn {
                  padding: 7px 4px;
                  border: none;
                  background: transparent;
                  border-radius: 8px;
                  font-size: 11.5px;
                  font-weight: 500;
                  color: #6b7280;
                  cursor: pointer;
                  font-family: 'Inter', sans-serif;
                  text-transform: capitalize;
                  transition: all 0.15s;
                }
                .prj-seg-btn:hover:not(.prj-seg-btn--on) { background: rgba(255,255,255,0.65); color: #374151; }
                .prj-seg-btn--on {
                  background: #fff;
                  color: #3b775e;
                  font-weight: 700;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.09);
                }
                .prj-emp-list {
                  max-height: 190px;
                  overflow-y: auto;
                  display: flex;
                  flex-direction: column;
                  gap: 5px;
                  scrollbar-width: thin;
                  scrollbar-color: #e5e7eb transparent;
                }
                .prj-emp-row {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  padding: 8px 10px;
                  border-radius: 9px;
                  border: 1.5px solid #e5e7eb;
                  background: #fff;
                  cursor: pointer;
                  transition: border-color 0.15s, background 0.15s;
                }
                .prj-emp-row:hover { background: #f7fdf9; border-color: #b7e4c7; }
                .prj-emp-row--on { border-color: #3b775e !important; background: #f0faf4 !important; }
                .prj-emp-avatar {
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%);
                  color: #fff;
                  font-size: 11px;
                  font-weight: 700;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                }
                .prj-emp-name { font-size: 12px; font-weight: 600; color: #111827; }
                .prj-emp-id { font-size: 10.5px; color: #9ca3af; }
                .prj-emp-check { margin-left: auto; color: #3b775e; flex-shrink: 0; }
                .prj-file-drop {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 5px;
                  padding: 18px;
                  border: 1.5px dashed #d1d5db;
                  border-radius: 10px;
                  cursor: pointer;
                  background: #fafafa;
                  transition: border-color 0.15s, background 0.15s;
                }
                .prj-file-drop:hover { border-color: #3b775e; background: #f0faf4; }
                .prj-file-drop-text { font-size: 12px; color: #6b7280; font-weight: 500; }
                .prj-file-drop-hint { font-size: 10.5px; color: #c4c9d4; }
                .prj-file-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
                .prj-file-chip {
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  background: #f0faf4;
                  border: 1px solid #b7e4c7;
                  border-radius: 999px;
                  padding: 4px 10px;
                  font-size: 11px;
                  color: #2e7d32;
                  font-weight: 500;
                }
                .prj-file-chip button {
                  background: none;
                  border: none;
                  color: #9ca3af;
                  cursor: pointer;
                  padding: 0;
                  font-size: 14px;
                  line-height: 1;
                  display: flex;
                  align-items: center;
                  transition: color 0.12s;
                }
                .prj-file-chip button:hover { color: #ef4444; }
                .prj-footer {
                  display: flex;
                  justify-content: flex-end;
                  gap: 8px;
                  padding-top: 16px;
                  border-top: 1px solid #f1f3f5;
                  margin-top: 4px;
                }
                .prj-btn-ghost {
                  padding: 9px 20px;
                  border: 1.5px solid #e5e7eb;
                  background: #fff;
                  border-radius: 9px;
                  font-size: 12.5px;
                  font-weight: 600;
                  color: #6b7280;
                  cursor: pointer;
                  font-family: 'Inter', sans-serif;
                  transition: border-color 0.15s, color 0.15s;
                }
                .prj-btn-ghost:hover { border-color: #9ca3af; color: #374151; }
                .prj-btn-primary {
                  padding: 9px 22px;
                  border: none;
                  background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%);
                  color: #fff;
                  border-radius: 9px;
                  font-size: 12.5px;
                  font-weight: 700;
                  cursor: pointer;
                  font-family: 'Inter', sans-serif;
                  transition: opacity 0.15s, transform 0.1s;
                }
                .prj-btn-primary:hover { opacity: 0.91; transform: translateY(-1px); }
              `}</style>
              <div className="prj-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="prj-modal-hd">
                  <div className="prj-modal-hd-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      {!editingProject && <circle cx="17" cy="17" r="5" fill="#3b775e" fillOpacity="0.15" />}
                      {!editingProject && <line x1="17" y1="14.5" x2="17" y2="19.5" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round" />}
                      {!editingProject && <line x1="14.5" y1="17" x2="19.5" y2="17" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round" />}
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="prj-modal-title">
                      Assign Project
                    </div>
                    <div className="prj-modal-sub">
                      Select a project and assign dates & team members
                    </div>
                  </div>
                  <button
                    className="prj-close-btn"
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProject(null);
                      setSelectedProjectForAssignment("");
                      setShowProjectDropdown(true);
                      setModalProjectSearch("");
                      setFormData({ name: "", description: "", startDate: "", deadline: "", status: "active", statusReason: "", assignedEmployees: [] });
                      setSelectedFiles([]);
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="prj-modal-body">
                  <form onSubmit={handleSubmit} className="prj-form">

                    {/* ── Select Project ── */}
                    {!editingProject && <div className="prj-section-lbl">Select Project</div>}

                    {!editingProject && selectedProjectForAssignment && !showProjectDropdown ? (
                      <div className="prj-field">
                        <div
                          className="prj-input"
                          onClick={() => setShowProjectDropdown(true)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#f8fafc',
                            color: '#0f172a',
                            fontWeight: '600'
                          }}
                        >
                          <span>{formData.name}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </div>
                    ) : !editingProject ? (
                      <>
                        <div className="prj-field">
                          <label className="prj-lbl">
                            Search Projects <span className="prj-req">*</span>
                          </label>
                          <input
                            className="prj-input"
                            type="text"
                            placeholder="Search by project name or client..."
                            value={modalProjectSearch}
                            onChange={(e) => setModalProjectSearch(e.target.value)}
                          />
                        </div>
                        <div className="prj-emp-list" style={{ marginBottom: '20px' }}>
                          {projects
                            .filter(proj =>
                              proj.name.toLowerCase().includes(modalProjectSearch.toLowerCase()) ||
                              (proj.clientName && proj.clientName.toLowerCase().includes(modalProjectSearch.toLowerCase()))
                            )
                            .map((proj) => (
                              <div
                                key={proj._id}
                                className={`prj-emp-row${selectedProjectForAssignment === proj._id ? " prj-emp-row--on" : ""}`}
                                onClick={() => handleProjectSelection(proj._id)}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className="prj-emp-avatar" style={{ background: '#3b775e', color: '#fff' }}>
                                  {proj.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="prj-emp-name">{proj.name}</div>
                                  <div className="prj-emp-id">{proj.clientName || 'No client'}</div>
                                </div>
                                {selectedProjectForAssignment === proj._id && (
                                  <div className="prj-emp-check">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                      <path d="M20 7L10 17l-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </>
                    ) : null}

                    {/* ── Project Details ── */}
                    <div className="prj-section-lbl">Project Details</div>
                    <div className="prj-field">
                      <label className="prj-lbl">Project Name</label>
                      <input
                        className="prj-input"
                        type="text"
                        value={formData.name}
                        disabled
                        style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                        placeholder="Select a project above"
                      />
                    </div>
                    <div className="prj-field">
                      <label className="prj-lbl">
                        Description
                      </label>
                      <textarea
                        className="prj-input prj-textarea"
                        value={formData.description}
                        disabled
                        style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                        placeholder="No description provided"
                        rows="3"
                      />
                    </div>

                    {/* ── Assignment Details ── */}
                    <div className="prj-section-lbl" style={{ marginTop: '20px' }}>Assignment Details</div>

                    {/* Timeline */}
                    <div className="prj-date-row">
                      <div className="prj-field">
                        <label className="prj-lbl">
                          Start Date <span className="prj-req">*</span>
                        </label>
                        <input
                          className="prj-input"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="prj-field">
                        <label className="prj-lbl">
                          Deadline <span className="prj-req">*</span>
                        </label>
                        <input
                          className="prj-input"
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="prj-field">
                      <label className="prj-lbl">Status</label>
                      <div className="prj-seg-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {[
                          { v: "active", l: "Progress" },
                          { v: "review", l: "Review" },
                          { v: "completed", l: "Completed" },
                          { v: "on-hold", l: "On Hold" },
                          { v: "canceled", l: "Canceled" }
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            className={`prj-seg-btn${formData.status === opt.v ? " prj-seg-btn--on" : ""}`}
                            onClick={() => setFormData({ ...formData, status: opt.v })}
                            style={{ flex: '1 1 auto', minWidth: '80px', textAlign: 'center' }}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status Reason (Conditional) */}
                    {["on-hold", "review", "canceled", "active"].includes(formData.status) && (
                      <div className="prj-field" style={{ marginTop: '12px' }}>
                        <label className="prj-lbl">
                          Enter Reason <span className="prj-req">*</span>
                        </label>
                        <textarea
                          className="prj-input prj-textarea"
                          value={formData.statusReason || ""}
                          onChange={(e) => setFormData({ ...formData, statusReason: e.target.value })}
                          placeholder={`Please provide a reason why this project is ${formData.status}...`}
                          required
                          rows="2"
                        />
                      </div>
                    )}

                    {/* Team Assignment */}
                    <div className="prj-field">
                      <label className="prj-lbl">
                        {editingProject ? 'Assigned Team Members' : 'Assign Team Members'}
                        {formData.assignedEmployees.length > 0 && (
                          <span style={{ marginLeft: 6, fontWeight: 400, color: "#6b7280", fontSize: "10px" }}>
                            ({formData.assignedEmployees.length} {editingProject ? 'assigned' : 'selected'})
                          </span>
                        )}
                      </label>

                      {/* Assigned employees — editable badges when editing */}
                      {editingProject ? (
                        <>
                          {formData.assignedEmployees.length === 0 ? (
                            <span style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '10px' }}>No team members assigned.</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                              {formData.assignedEmployees.map((empId) => {
                                const emp = employees.find(e => e._id === empId);
                                if (!emp) return null;
                                return (
                                  <div
                                    key={empId}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 10px',
                                      background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                                      color: '#fff',
                                      borderRadius: '999px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                                    }}
                                  >
                                    <span>{emp.firstName} {emp.lastName}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleEmployeeToggle(empId)}
                                      style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#fff',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        padding: 0,
                                        lineHeight: 1
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <input
                            className="prj-input"
                            type="text"
                            placeholder="Search by name or ID…"
                            value={employeeSearchTerm}
                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                            style={{ marginBottom: '10px' }}
                          />
                        </>
                      ) : (
                        <>
                          {/* Already-assigned (locked) badges */}
                          {(() => {
                            const existingProject = projects.find(p => p._id === selectedProjectForAssignment);
                            const existingIds = existingProject?.assignedEmployees?.map(e => e._id || e) || [];
                            if (existingIds.length === 0) return null;
                            return (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Already Assigned</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {existingIds.map((empId) => {
                                    const emp = employees.find(e => e._id === empId);
                                    if (!emp) return null;
                                    return (
                                      <div
                                        key={empId}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          padding: '4px 10px',
                                          background: '#e5e7eb',
                                          color: '#4b5563',
                                          borderRadius: '999px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                                          cursor: 'default'
                                        }}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                        {emp.firstName} {emp.lastName}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Newly selected badges */}
                          {formData.assignedEmployees.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Adding New</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {formData.assignedEmployees.map((empId) => {
                                  const emp = employees.find(e => e._id === empId);
                                  if (!emp) return null;
                                  return (
                                    <div
                                      key={empId}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '5px 10px',
                                        background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                                        color: '#fff',
                                        borderRadius: '999px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                                      }}
                                    >
                                      <span>{emp.firstName} {emp.lastName}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleEmployeeToggle(empId)}
                                        style={{
                                          background: 'rgba(255,255,255,0.2)',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '16px',
                                          height: '16px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          color: '#fff',
                                          fontSize: '12px',
                                          fontWeight: 'bold',
                                          padding: 0,
                                          lineHeight: 1
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <input
                            className="prj-input"
                            type="text"
                            placeholder="Search by name or ID…"
                            value={employeeSearchTerm}
                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                            style={{ marginBottom: '10px' }}
                          />
                        </>
                      )}
                    </div>
                    <div className="prj-emp-list">
                      {filteredEmployees.map((emp) => {
                        const existingIds = !editingProject
                          ? (projects.find(p => p._id === selectedProjectForAssignment)?.assignedEmployees?.map(e => e._id || e) || [])
                          : [];
                        const alreadyAssigned = existingIds.includes(emp._id);
                        return (
                          <div
                            key={emp._id}
                            className={`prj-emp-row${formData.assignedEmployees.includes(emp._id) ? " prj-emp-row--on" : ""}`}
                            onClick={() => !alreadyAssigned && handleEmployeeToggle(emp._id)}
                            style={alreadyAssigned ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : { cursor: 'pointer' }}
                          >
                            <div className="prj-emp-avatar">
                              {emp.firstName?.[0]}{emp.lastName?.[0]}
                            </div>
                            <div>
                              <div className="prj-emp-name">{emp.firstName} {emp.lastName}</div>
                              <div className="prj-emp-id">{emp.employeeId}{alreadyAssigned ? ' · already assigned' : ''}</div>
                            </div>
                            {formData.assignedEmployees.includes(emp._id) && (
                              <div className="prj-emp-check">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M20 7L10 17l-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Footer ── */}
                    <div className="prj-footer">
                      <button
                        type="button"
                        className="prj-btn-ghost"
                        onClick={() => {
                          setShowModal(false);
                          setEditingProject(null);
                          setSelectedProjectForAssignment("");
                          setShowProjectDropdown(true);
                          setModalProjectSearch("");
                          setFormData({ name: "", description: "", startDate: "", deadline: "", status: "active", statusReason: "", assignedEmployees: [] });
                          setSelectedFiles([]);
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="prj-btn-primary">
                        Assign Project
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            </>
          </div>
        )}
    </div>
  );
}

export default Assignments;
