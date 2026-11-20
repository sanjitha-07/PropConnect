import { useContext, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { MAINTENANCE_REQUESTS, COMPLAINTS } from "../../data/db.js";
import {
  fetchMaintenance,
  createMaintenanceRequest,
  updateMaintenanceRequest,
  fetchComplaints,
  createComplaint,
  updateComplaint,
} from "../../utils/apiClient.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import TamilVoiceTextInput from "../../components/TamilVoiceTextInput.jsx";
import "./UtilityAndRequestCenter.css";

export default function RequestCenterPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs: 'all', 'maintenance', 'complaints', 'resolved'
  const validTabs = ["all", "maintenance", "complaints", "resolved"];
  const tabParam = searchParams.get("tab")?.toLowerCase();
  const activeTab = validTabs.includes(tabParam) ? tabParam : "all";

  const handleTabChange = (tab) => {
    setSearchParams(tab === "all" ? {} : { tab });
  };

  const entityId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : "TEN001");

  const [maintenanceList, setMaintenanceList] = useState([]);
  const [complaintsList, setComplaintsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ text: "", type: "info" });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modals
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Raise Request Form State
  const initialForm = {
    requestType: "maintenance", // 'maintenance' or 'complaint'
    category: "Plumbing",
    subject: "",
    description: "",
    priority: "Medium",
    propertyName: "Sai Kala Apartments - Flat 302",
    unit: "Flat 302",
    photos: [],
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Esc key closes modals
  useEscapeKey(() => {
    if (isRaiseModalOpen) setIsRaiseModalOpen(false);
    if (viewingRequest) {
      setViewingRequest(null);
      setIsReopening(false);
    }
  }, isRaiseModalOpen || !!viewingRequest);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "info" }), 4500);
  };

  // Load Maintenance & Complaints from separated backend APIs
  useEffect(() => {
    let isMounted = true;
    async function loadRequests() {
      setLoading(true);
      try {
        const [mntData, cmpData] = await Promise.all([
          fetchMaintenance().catch(() => null),
          fetchComplaints().catch(() => null),
        ]);

        if (!isMounted) return;

        // 1. Maintenance records (separate backend model)
        if (Array.isArray(mntData) && mntData.length > 0) {
          const userMnt = mntData.filter((m) => m.tenantId === entityId || m.tenant_id === entityId);
          setMaintenanceList(userMnt.length > 0 ? userMnt : mntData.slice(0, 5));
        } else {
          setMaintenanceList(MAINTENANCE_REQUESTS.filter((m) => m.tenantId === entityId || !m.tenantId));
        }

        // 2. Complaints records (separate backend model)
        if (Array.isArray(cmpData) && cmpData.length > 0) {
          const userCmp = cmpData.filter((c) => c.tenantId === entityId || c.tenant_id === entityId);
          setComplaintsList(userCmp.length > 0 ? userCmp : cmpData.slice(0, 5));
        } else {
          setComplaintsList(COMPLAINTS.filter((c) => c.tenantId === entityId || !c.tenantId));
        }
      } catch (err) {
        if (isMounted) {
          setMaintenanceList(MAINTENANCE_REQUESTS.filter((m) => m.tenantId === entityId));
          setComplaintsList(COMPLAINTS.filter((c) => c.tenantId === entityId));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadRequests();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  // Normalize into common request listing UI items
  const normalizedRequests = useMemo(() => {
    const mntItems = maintenanceList.map((m) => ({
      raw: m,
      id: m.id,
      requestType: "Maintenance",
      category: m.category || (m.issueText?.includes("Leak") || m.issueText?.includes("Pipe") ? "Plumbing" : m.issueText?.includes("Light") || m.issueText?.includes("Power") ? "Electrical" : "General Maintenance"),
      subject: m.title || m.issueText || m.subject || "Maintenance Issue",
      description: m.description || m.issueText || "Maintenance repair requested by resident.",
      priority: m.priority || "Medium",
      submissionDate: m.date || m.createdAt || "2026-09-24",
      lastUpdate: m.updatedAt || m.date || "2026-09-25",
      status: m.status || "Open",
      propertyName: m.propertyName || "Sai Kala Apartments #302",
      unit: m.unit || "Flat 302",
      landlordResponse: m.landlordResponse || m.landlordNote || "Work order approved. Electrician/Plumber will attend shortly.",
      resolutionDetails: m.resolutionDetails || (m.status === "Resolved" || m.status === "Completed" ? "Repair successfully inspected and verified." : null),
      photos: m.photos || (m.id === "MNT001" ? ["/api/uploads/pipe_leak.jpg"] : []),
    }));

    const cmpItems = complaintsList.map((c) => ({
      raw: c,
      id: c.id,
      requestType: "Complaint",
      category: c.category || "Resident Grievance",
      subject: c.subject || c.issue || "Resident Complaint",
      description: c.description || c.issue || "Grievance lodged regarding apartment premises or fixtures.",
      priority: c.priority || "High",
      submissionDate: c.date || c.createdAt || "2026-09-22",
      lastUpdate: c.updatedAt || c.date || "2026-09-23",
      status: c.status || "Open",
      propertyName: c.propertyName || "Sai Kala Apartments #302",
      unit: c.unit || "Flat B-204",
      landlordResponse: c.landlordResponse || "Landlord acknowledged grievance. Service partner assigned.",
      resolutionDetails: c.resolutionDetails || (c.status === "Resolved" || c.status === "Completed" ? "Complaint resolved with resident confirmation." : null),
      photos: c.photos || [],
    }));

    // Combined and sorted by submission date / ID desc
    return [...mntItems, ...cmpItems].sort((a, b) => b.id.localeCompare(a.id));
  }, [maintenanceList, complaintsList]);

  // Tab Counts
  const counts = useMemo(() => {
    return {
      all: normalizedRequests.length,
      maintenance: normalizedRequests.filter((r) => r.requestType === "Maintenance").length,
      complaints: normalizedRequests.filter((r) => r.requestType === "Complaint").length,
      resolved: normalizedRequests.filter((r) => r.status === "Resolved" || r.status === "Completed").length,
    };
  }, [normalizedRequests]);

  // Filtered Items for activeTab, search, priority
  const filteredRequests = useMemo(() => {
    let result = normalizedRequests;

    if (activeTab === "maintenance") {
      result = result.filter((r) => r.requestType === "Maintenance");
    } else if (activeTab === "complaints") {
      result = result.filter((r) => r.requestType === "Complaint");
    } else if (activeTab === "resolved") {
      result = result.filter((r) => r.status === "Resolved" || r.status === "Completed");
    }

    if (priorityFilter !== "all") {
      result = result.filter((r) => (r.priority || "").toLowerCase() === priorityFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.propertyName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [normalizedRequests, activeTab, priorityFilter, searchQuery]);

  // Handle Photo Upload in Raise Form
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, uploadEvt.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit New Request (Preserving separate backend models)
  const handleRaiseSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      showToast("Please provide a subject / summary for your request.", "error");
      return;
    }

    setIsSubmitting(true);
    const dateStr = new Date().toISOString().split("T")[0];

    try {
      if (formData.requestType === "maintenance") {
        // MAINTENANCE API
        const newId = `MNT${Math.floor(Math.random() * 900 + 100)}`;
        const payload = {
          id: newId,
          tenantId: entityId,
          propertyName: formData.propertyName,
          unit: formData.unit,
          category: formData.category,
          title: formData.subject,
          issueText: formData.subject,
          description: formData.description,
          priority: formData.priority,
          status: "Open",
          date: dateStr,
          photos: formData.photos,
        };

        const res = await createMaintenanceRequest(payload);
        setMaintenanceList((prev) => [res || payload, ...prev]);
        showToast(`✓ Maintenance request #${newId} raised successfully! Landlord notified.`);
      } else {
        // COMPLAINTS API
        const newId = `CMP${Math.floor(Math.random() * 900 + 100)}`;
        const payload = {
          id: newId,
          tenantId: entityId,
          tenantName: user?.name || "Divya Priya",
          propertyName: formData.propertyName,
          unit: formData.unit,
          category: formData.category,
          subject: formData.subject,
          issue: formData.description || formData.subject,
          description: formData.description,
          priority: formData.priority,
          status: "Open",
          date: dateStr,
          photos: formData.photos,
        };

        const res = await createComplaint(payload);
        setComplaintsList((prev) => [res || payload, ...prev]);
        showToast(`✓ Resident complaint #${newId} submitted. Support team alerted.`);
      }

      setIsRaiseModalOpen(false);
      setFormData(initialForm);
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reopen Request (Strictly updates appropriate backend model)
  const handleReopenRequest = async () => {
    if (!viewingRequest) return;
    if (!reopenReason.trim()) {
      showToast("Please enter a reason for reopening this request.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const updatePayload = {
      status: "In Progress",
      reopenReason: reopenReason.trim(),
      updatedAt: todayStr,
      landlordResponse: `Reopened by resident: "${reopenReason.trim()}". Re-investigating.`,
    };

    try {
      if (viewingRequest.requestType === "Maintenance") {
        await updateMaintenanceRequest(viewingRequest.id, updatePayload);
        setMaintenanceList((prev) =>
          prev.map((m) => (m.id === viewingRequest.id ? { ...m, ...updatePayload } : m))
        );
      } else {
        await updateComplaint(viewingRequest.id, updatePayload);
        setComplaintsList((prev) =>
          prev.map((c) => (c.id === viewingRequest.id ? { ...c, ...updatePayload } : c))
        );
      }

      showToast(`✓ Request #${viewingRequest.id} has been reopened.`);
      setViewingRequest((prev) => (prev ? { ...prev, ...updatePayload } : null));
      setIsReopening(false);
      setReopenReason("");
    } catch (err) {
      showToast(`Could not reopen request: ${err.message}`, "error");
    }
  };

  return (
    <div className="urc-container">
      <PageHero
        title="Tenant Request Center"
        subtitle="Submit maintenance repairs, lodge resident grievances, track service technician timelines, and monitor resolution details."
      />

      {/* Toast */}
      {toast.text && (
        <div
          style={{
            background: toast.type === "error" ? "#fee2e2" : "#ecfdf5",
            color: toast.type === "error" ? "#b91c1c" : "#047857",
            border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
            padding: "12px 18px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "13.5px",
          }}
        >
          {toast.type === "error" ? "⚠️ " : "✓ "}
          {toast.text}
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="urc-kpi-grid">
        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Total Requests</span>
            <span className="urc-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>📋</span>
          </div>
          <div className="urc-kpi-value">{counts.all}</div>
          <div className="urc-kpi-desc">All submitted tickets &amp; grievances</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Maintenance</span>
            <span className="urc-kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>🛠️</span>
          </div>
          <div className="urc-kpi-value" style={{ color: "#d97706" }}>{counts.maintenance}</div>
          <div className="urc-kpi-desc">Plumbing, electrical &amp; repairs</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Complaints</span>
            <span className="urc-kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>📢</span>
          </div>
          <div className="urc-kpi-value" style={{ color: "#dc2626" }}>{counts.complaints}</div>
          <div className="urc-kpi-desc">Premises issues &amp; grievances</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Resolved</span>
            <span className="urc-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✅</span>
          </div>
          <div className="urc-kpi-value" style={{ color: "#059669" }}>{counts.resolved}</div>
          <div className="urc-kpi-desc">Successfully completed &amp; closed</div>
        </div>
      </div>

      {/* Action Header & Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        {/* Tabs Bar */}
        <div className="urc-nav-bar" style={{ margin: 0, border: "none" }}>
          <button
            type="button"
            className={`urc-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            <span>📑</span>
            <span>All Requests</span>
            <span className="urc-tab-badge">{counts.all}</span>
          </button>

          <button
            type="button"
            className={`urc-tab-btn ${activeTab === "maintenance" ? "active" : ""}`}
            onClick={() => handleTabChange("maintenance")}
          >
            <span>🛠️</span>
            <span>Maintenance</span>
            <span className="urc-tab-badge">{counts.maintenance}</span>
          </button>

          <button
            type="button"
            className={`urc-tab-btn ${activeTab === "complaints" ? "active" : ""}`}
            onClick={() => handleTabChange("complaints")}
          >
            <span>📢</span>
            <span>Complaints</span>
            <span className="urc-tab-badge">{counts.complaints}</span>
          </button>

          <button
            type="button"
            className={`urc-tab-btn ${activeTab === "resolved" ? "active" : ""}`}
            onClick={() => handleTabChange("resolved")}
          >
            <span>✓</span>
            <span>Resolved</span>
            <span className="urc-tab-badge">{counts.resolved}</span>
          </button>
        </div>

        {/* Raise New Request Button */}
        <button
          type="button"
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontSize: "13.5px" }}
          onClick={() => setIsRaiseModalOpen(true)}
        >
          <span>➕</span>
          <span>Raise New Request</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="urc-filter-bar">
        <div className="urc-search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search request ID, subject, category, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            padding: "7px 14px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            background: "#ffffff",
          }}
        >
          <option value="all">All Priorities</option>
          <option value="high">High &amp; Urgent</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Common Request Listing UI */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="spinner" />
          <p style={{ marginTop: "12px", color: "#64748b" }}>Loading your requests and complaints...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>No requests found</div>
          <div style={{ fontSize: "13px", marginTop: "4px" }}>
            No tickets match your selected tab or search criteria. Click "Raise New Request" to create one.
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Responsive Table */}
          <div className="urc-desktop-table card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Request ID</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Category</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Subject</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Priority</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Submission Date</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Current Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Last Update</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req, idx) => {
                  const isResolved = req.status === "Resolved" || req.status === "Completed";
                  const isHigh = req.priority === "High" || req.priority === "Urgent";

                  return (
                    <tr
                      key={req.id || idx}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: idx % 2 === 0 ? "#ffffff" : "#fcfdfe",
                      }}
                    >
                      {/* Request ID & Type */}
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ color: "#0f172a" }}>{req.id}</strong>
                        <div style={{ fontSize: "11px", color: req.requestType === "Maintenance" ? "#d97706" : "#2563eb", fontWeight: 600 }}>
                          {req.requestType}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 600, color: "#0284c7" }}>
                          {req.category}
                        </span>
                      </td>

                      {/* Subject */}
                      <td style={{ padding: "12px 16px", maxWidth: "260px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{req.subject}</div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {req.description}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: isHigh ? "#fee2e2" : "#f1f5f9",
                            color: isHigh ? "#dc2626" : "#475569",
                          }}
                        >
                          {req.priority}
                        </span>
                      </td>

                      {/* Submission Date */}
                      <td style={{ padding: "12px 16px", color: "#475569" }}>
                        {req.submissionDate}
                      </td>

                      {/* Current Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          className={`pill ${
                            isResolved
                              ? "paid"
                              : req.status === "In Progress" || req.status === "FixIt Dispatched"
                              ? "pending"
                              : "failed"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>

                      {/* Last Update */}
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "12px" }}>
                        {req.lastUpdate}
                      </td>

                      {/* View Details Action */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "5px 12px", fontSize: "12px" }}
                          onClick={() => setViewingRequest(req)}
                        >
                          👁️ View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="urc-mobile-cards">
            {filteredRequests.map((req, idx) => {
              const isResolved = req.status === "Resolved" || req.status === "Completed";
              const isHigh = req.priority === "High" || req.priority === "Urgent";

              return (
                <div key={req.id || idx} className="card" style={{ padding: "16px", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#0f172a" }}>{req.id}</strong>
                      <span style={{ fontSize: "11px", marginLeft: "6px", color: req.requestType === "Maintenance" ? "#d97706" : "#2563eb", fontWeight: 700 }}>
                        • {req.requestType}
                      </span>
                    </div>
                    <span className={`pill ${isResolved ? "paid" : "pending"}`}>
                      {req.status}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>
                    {req.subject}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "10px" }}>
                    {req.description}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", fontSize: "12px", color: "#475569" }}>
                    <div>Category: <strong>{req.category}</strong></div>
                    <div>Priority: <strong style={{ color: isHigh ? "#dc2626" : "inherit" }}>{req.priority}</strong></div>
                    <div>Submitted: {req.submissionDate}</div>
                    <div>Updated: {req.lastUpdate}</div>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ width: "100%", padding: "7px", fontSize: "13px" }}
                      onClick={() => setViewingRequest(req)}
                    >
                      👁️ View Details &amp; Timeline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* RAISE NEW REQUEST MODAL */}
      {/* ========================================================================= */}
      {isRaiseModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setIsRaiseModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "560px", padding: "26px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Raise New Request</h3>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Submit maintenance repairs or lodge premises grievances</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsRaiseModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleRaiseSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Request Type Toggle */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Request Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    className={formData.requestType === "maintenance" ? "btn-primary" : "btn-outline"}
                    style={{ padding: "9px", fontSize: "13px" }}
                    onClick={() => setFormData({ ...formData, requestType: "maintenance", category: "Plumbing" })}
                  >
                    🛠️ Maintenance Repair
                  </button>
                  <button
                    type="button"
                    className={formData.requestType === "complaint" ? "btn-primary" : "btn-outline"}
                    style={{ padding: "9px", fontSize: "13px" }}
                    onClick={() => setFormData({ ...formData, requestType: "complaint", category: "AC Repair" })}
                  >
                    📢 Complaint / Grievance
                  </button>
                </div>
              </div>

              {/* Property & Unit Selection */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Rented Property
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.propertyName}
                    readOnly
                    style={{ background: "#f8fafc", width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Unit / Flat Number
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Category & Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="Plumbing">Plumbing &amp; Sanitary</option>
                    <option value="Electrical">Electrical &amp; Power</option>
                    <option value="AC Repair">AC &amp; HVAC</option>
                    <option value="Civil Work">Civil Work &amp; Seepage</option>
                    <option value="Carpentry">Carpentry &amp; Locks</option>
                    <option value="Cleaning">Cleaning &amp; Waste</option>
                    <option value="Security">Security &amp; Parking</option>
                    <option value="General">General Issue</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="Low">Low (General)</option>
                    <option value="Medium">Medium (Standard)</option>
                    <option value="High">High (Needs Attention)</option>
                    <option value="Urgent">Urgent (Emergency)</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                  Subject / Summary *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen tap water leakage or AC not blowing cold air"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              {/* Description with Tamil Voice-to-Text & Quick Phrases */}
              <div>
                <TamilVoiceTextInput
                  label="Detailed Description / விவரம் (Tamil & English Voice/Text)"
                  value={formData.description}
                  onChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
                  placeholder="Describe when the issue began, exact location, or click 🎙️ Voice to Text to speak in Tamil..."
                  rows={3}
                />
              </div>

              {/* Photo Upload with Live Previews */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                  Upload Issue Photos
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  style={{ fontSize: "12.5px" }}
                />

                {formData.photos.length > 0 && (
                  <div className="urc-photos-grid">
                    {formData.photos.map((src, i) => (
                      <img key={i} src={src} alt={`Preview ${i}`} className="urc-photo-thumb" />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="btn-outline" onClick={() => setIsRaiseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW DETAILS & TIMELINE MODAL */}
      {/* ========================================================================= */}
      {viewingRequest && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setViewingRequest(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "620px", padding: "26px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="row-between" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{viewingRequest.id}</h3>
                  <span style={{ fontSize: "11px", padding: "2px 8px", background: "#f1f5f9", borderRadius: "4px", fontWeight: 700 }}>
                    {viewingRequest.requestType}
                  </span>
                  <span className={`pill ${viewingRequest.status === "Resolved" || viewingRequest.status === "Completed" ? "paid" : "pending"}`}>
                    {viewingRequest.status}
                  </span>
                </div>
                <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "2px" }}>
                  {viewingRequest.propertyName} • {viewingRequest.unit}
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewingRequest(null)}>✕</button>
            </div>

            {/* Subject & Description */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                {viewingRequest.subject}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                {viewingRequest.description}
              </p>
            </div>

            {/* Photos */}
            {viewingRequest.photos && viewingRequest.photos.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                  Attached Issue Photos
                </div>
                <div className="urc-photos-grid">
                  {viewingRequest.photos.map((src, i) => (
                    <img key={i} src={src} alt={`Photo ${i}`} className="urc-photo-thumb" />
                  ))}
                </div>
              </div>
            )}

            {/* Landlord Response */}
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
                🏛️ Landlord Response &amp; Official Notes
              </div>
              <div style={{ fontSize: "13px", color: "#0369a1", marginTop: "4px" }}>
                {viewingRequest.landlordResponse || "The landlord has acknowledged the issue and assigned maintenance."}
              </div>
            </div>

            {/* Resolution Details (if completed) */}
            {viewingRequest.resolutionDetails && (
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>
                  ✅ Resolution Details
                </div>
                <div style={{ fontSize: "13px", color: "#047857", marginTop: "4px" }}>
                  {viewingRequest.resolutionDetails}
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
                Status Timeline
              </div>
              <div className="urc-timeline">
                <div className="urc-timeline-step completed">
                  <div className="urc-timeline-dot" />
                  <div className="urc-timeline-title">1. Request Submitted by Tenant</div>
                  <div className="urc-timeline-time">{viewingRequest.submissionDate}</div>
                  <div className="urc-timeline-desc">Ticket registered and notified to property owner.</div>
                </div>

                <div className={`urc-timeline-step ${viewingRequest.status !== "Open" ? "completed" : "active"}`}>
                  <div className="urc-timeline-dot" />
                  <div className="urc-timeline-title">2. Landlord Reviewed &amp; Approved</div>
                  <div className="urc-timeline-time">{viewingRequest.lastUpdate}</div>
                  <div className="urc-timeline-desc">Assigned category: {viewingRequest.category} ({viewingRequest.priority} Priority).</div>
                </div>

                <div className={`urc-timeline-step ${viewingRequest.status === "In Progress" || viewingRequest.status === "FixIt Dispatched" ? "active" : viewingRequest.status === "Resolved" || viewingRequest.status === "Completed" ? "completed" : ""}`}>
                  <div className="urc-timeline-dot" />
                  <div className="urc-timeline-title">3. Technician Assigned &amp; In Progress</div>
                  <div className="urc-timeline-time">{viewingRequest.status === "Resolved" ? "Completed" : "Active dispatch"}</div>
                  <div className="urc-timeline-desc">Qualified technician dispatched to {viewingRequest.unit}.</div>
                </div>

                <div className={`urc-timeline-step ${viewingRequest.status === "Resolved" || viewingRequest.status === "Completed" ? "completed" : ""}`}>
                  <div className="urc-timeline-dot" />
                  <div className="urc-timeline-title">4. Resolution Completed</div>
                  <div className="urc-timeline-time">{viewingRequest.status === "Resolved" ? "Resolved" : "Pending final signoff"}</div>
                  <div className="urc-timeline-desc">Work verified and marked resolved.</div>
                </div>
              </div>
            </div>

            {/* Reopen Request Action (when Resolved/Completed) */}
            {(viewingRequest.status === "Resolved" || viewingRequest.status === "Completed") && (
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "14px" }}>
                {!isReopening ? (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ color: "#d97706", borderColor: "#fde68a", padding: "7px 14px", fontSize: "12.5px" }}
                    onClick={() => setIsReopening(true)}
                  >
                    🔄 Reopen Request (If issue persists)
                  </button>
                ) : (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "4px" }}>
                      Reason for Reopening Request:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Tap still dripping, problem not completely fixed"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", marginBottom: "8px" }}
                    />
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "5px 12px", fontSize: "12px" }}
                        onClick={() => setIsReopening(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: "5px 14px", fontSize: "12px", background: "#d97706" }}
                        onClick={handleReopenRequest}
                      >
                        Confirm Reopen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
