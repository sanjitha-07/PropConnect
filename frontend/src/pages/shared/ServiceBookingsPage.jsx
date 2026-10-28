import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceBookings,
  updateServiceBookingStatus,
  cancelServiceBooking,
  payServiceBooking,
  submitServiceFeedback,
  createBookingComplaint,
} from "../../utils/apiClient.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import "../../components/services/HomeServicesStyles.css";

const STATUS_PIPELINE = ["Pending", "Confirmed", "Assigned", "In Progress", "Completed"];

export default function ServiceBookingsPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // View mode: default 'table'
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'cards'

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Pay after completion modal
  const [payBookingModal, setPayBookingModal] = useState(null);
  const [payingService, setPayingService] = useState(false);
  const [servicePaymentMethod, setServicePaymentMethod] = useState("UPI");

  // Customer Feedback modal
  const [feedbackBookingModal, setFeedbackBookingModal] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Admin status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [techName, setTechName] = useState("");
  const [techPhone, setTechPhone] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Raise Complaint against Provider modal state
  const [complaintModalBooking, setComplaintModalBooking] = useState(null);
  const [selectedComplaintView, setSelectedComplaintView] = useState(null);
  const [complaintType, setComplaintType] = useState("Service Quality");
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintAttachment, setComplaintAttachment] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintFormErrors, setComplaintFormErrors] = useState({});

  // Global ESC key to close any popup
  useEscapeKey(() => {
    if (cancelModalOpen) setCancelModalOpen(false);
    if (statusModalOpen) setStatusModalOpen(false);
    if (payBookingModal) setPayBookingModal(null);
    if (feedbackBookingModal) setFeedbackBookingModal(null);
    if (complaintModalBooking && !submittingComplaint) setComplaintModalBooking(null);
    if (selectedComplaintView) setSelectedComplaintView(null);
    if (selectedBooking && !cancelModalOpen && !statusModalOpen && !complaintModalBooking) setSelectedBooking(null);
  }, cancelModalOpen || statusModalOpen || !!payBookingModal || !!feedbackBookingModal || !!complaintModalBooking || !!selectedComplaintView || !!selectedBooking);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load service bookings:", err);
      setError("Unable to retrieve service bookings. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Prevent background scrolling while any modal is open
  useEffect(() => {
    const isAnyModalOpen =
      cancelModalOpen ||
      statusModalOpen ||
      !!payBookingModal ||
      !!feedbackBookingModal ||
      !!complaintModalBooking ||
      !!selectedComplaintView ||
      !!selectedBooking;

    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [cancelModalOpen, statusModalOpen, payBookingModal, feedbackBookingModal, complaintModalBooking, selectedComplaintView, selectedBooking]);

  // Filtered list
  const filteredBookings = bookings.filter((b) => {
    if (selectedStatus !== "All" && b.status !== selectedStatus) return false;
    if (dateFilter && b.date !== dateFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchText = `${b.bookingId || ""} ${b.categoryName || ""} ${b.subService || ""} ${b.providerName || ""} ${b.propertyName || ""} ${b.unit || ""} ${b.bookedByName || ""}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  // Calculate summary counts
  const counts = {
    All: bookings.length,
    Pending: bookings.filter((b) => b.status === "Pending").length,
    Confirmed: bookings.filter((b) => b.status === "Confirmed").length,
    Assigned: bookings.filter((b) => b.status === "Assigned").length,
    "In Progress": bookings.filter((b) => b.status === "In Progress").length,
    Completed: bookings.filter((b) => b.status === "Completed").length,
    Cancelled: bookings.filter((b) => b.status === "Cancelled").length,
  };

  const handleOpenPay = (booking) => {
    if (booking.status !== "Completed") {
      showToast("Payment is only allowed after service is Completed by technician.", "error");
      return;
    }
    setPayBookingModal(booking);
  };

  const handleConfirmServicePayment = async (e) => {
    e.preventDefault();
    if (!payBookingModal) return;
    setPayingService(true);
    try {
      const bId = payBookingModal.bookingId || payBookingModal._id || payBookingModal.id;
      await payServiceBooking(bId, { paymentMethod: servicePaymentMethod });
      showToast(`Payment of ₹${payBookingModal.estimatedCost || 450} processed successfully!`);
      const paidItem = payBookingModal;
      setPayBookingModal(null);
      setFeedbackBookingModal(paidItem);
      await loadBookings();
    } catch (err) {
      showToast(err.message || "Payment failed", "error");
    } finally {
      setPayingService(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackBookingModal) return;
    setSubmittingFeedback(true);
    try {
      const bId = feedbackBookingModal.bookingId || feedbackBookingModal._id || feedbackBookingModal.id;
      await submitServiceFeedback(bId, { rating: feedbackRating, reviewText: feedbackText });
      showToast("Thank you! Your rating & review have been submitted.");
      setFeedbackBookingModal(null);
      setFeedbackText("");
      setFeedbackRating(5);
      await loadBookings();
    } catch (err) {
      showToast(err.message || "Feedback submission failed", "error");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleOpenCancel = (booking) => {
    setSelectedBooking(booking);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    if (!cancelReason.trim()) {
      showToast("Please provide a reason for cancellation", "error");
      return;
    }

    setCancelling(true);
    try {
      const bookingIdToCancel = selectedBooking.bookingId || selectedBooking._id;
      await cancelServiceBooking(bookingIdToCancel, cancelReason);
      showToast(`Booking #${bookingIdToCancel} has been cancelled successfully`);
      setCancelModalOpen(false);
      setSelectedBooking(null);
      await loadBookings();
    } catch (err) {
      showToast(err.message || "Failed to cancel booking", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenStatusModal = (booking) => {
    setSelectedBooking(booking);
    setNewStatus(booking.status);
    setStatusNote("");
    setTechName(booking.technicianName || booking.providerName || "");
    setTechPhone(booking.technicianPhone || booking.providerPhone || "");
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setUpdatingStatus(true);
    try {
      const bId = selectedBooking.bookingId || selectedBooking._id;
      await updateServiceBookingStatus(bId, {
        status: newStatus,
        note: statusNote,
        technicianName: techName,
        technicianPhone: techPhone,
      });
      showToast(`Booking #${bId} status updated to ${newStatus}`);
      setStatusModalOpen(false);
      setSelectedBooking(null);
      await loadBookings();
    } catch (err) {
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getComplaintStatusBadge = (status) => {
    const norm = (status || "").toLowerCase();
    if (norm.includes("review")) {
      return { label: "Under Review", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
    }
    if (norm.includes("progress")) {
      return { label: "In Progress", bg: "#e0e7ff", color: "#4338ca", border: "#c7d2fe" };
    }
    if (norm.includes("resolv") || norm.includes("complet")) {
      return { label: "Resolved", bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" };
    }
    if (norm.includes("reject")) {
      return { label: "Rejected", bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" };
    }
    return { label: "Submitted", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };
  };

  const formatBookingDate = (dateStr) => {
    if (!dateStr) return "Scheduled";
    try {
      const parts = String(dateStr).split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      }
    } catch {}
    return dateStr;
  };

  const getJobStatusBadge = (status) => {
    const norm = (status || "").toLowerCase();
    if (norm === "completed") {
      return { label: "Completed", bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", icon: "✓" };
    }
    if (norm === "cancelled") {
      return { label: "Cancelled", bg: "#fee2e2", color: "#b91c1c", border: "#fecaca", icon: "✕" };
    }
    if (norm === "assigned" || norm === "confirmed") {
      return { label: status === "Assigned" ? "Assigned" : "Confirmed", bg: "#e0f2fe", color: "#0284c7", border: "#bae6fd", icon: "●" };
    }
    if (norm === "in progress") {
      return { label: "In Progress", bg: "#e0e7ff", color: "#4338ca", border: "#c7d2fe", icon: "⚡" };
    }
    return { label: status || "Pending", bg: "#fef3c7", color: "#b45309", border: "#fde68a", icon: "⏳" };
  };

  const handleOpenComplaintModal = (booking) => {
    if (booking.complaint) {
      setSelectedComplaintView(booking.complaint);
      return;
    }
    setComplaintModalBooking(booking);
    setComplaintType("Poor Service Quality");
    setComplaintSubject("");
    setComplaintDescription("");
    setComplaintAttachment("");
    setComplaintFormErrors({});
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintModalBooking) return;

    const errors = {};
    if (!complaintSubject.trim()) {
      errors.subject = "Complaint subject is required";
    }
    if (!complaintDescription.trim()) {
      errors.description = "Complaint description is required";
    }

    if (Object.keys(errors).length > 0) {
      setComplaintFormErrors(errors);
      return;
    }

    setSubmittingComplaint(true);
    setComplaintFormErrors({});
    try {
      const bId = complaintModalBooking.bookingId || complaintModalBooking.id || complaintModalBooking._id;
      const res = await createBookingComplaint(bId, {
        complaintType,
        subject: complaintSubject.trim(),
        description: complaintDescription.trim(),
        attachment: complaintAttachment,
      });

      showToast(
        `Complaint submitted successfully against ${complaintModalBooking.providerName || "provider"}. ID: #${res.complaint?.id || "Registered"}`,
        "success"
      );
      setComplaintModalBooking(null);
      await loadBookings();
    } catch (err) {
      setComplaintFormErrors({ api: err.message || "Failed to submit complaint. Please try again." });
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const getStepStatus = (step, currentStatus) => {
    if (currentStatus === "Cancelled") return "cancelled";
    const currentIdx = STATUS_PIPELINE.indexOf(currentStatus);
    const stepIdx = STATUS_PIPELINE.indexOf(step);
    if (currentIdx === -1) return "upcoming";
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "upcoming";
  };

  const portalRoute = user?.role === "tenant" ? "/tenant/home-services" : user?.role === "landlord" ? "/landlord/home-services" : "/admin/service-providers";

  return (
    <div className="home-services-container">
      {/* Toast Feedback */}
      {toast && (
        <div className={`hs-toast show ${toast.type === "error" ? "hs-toast-error" : ""}`}>
          {toast.type === "error" ? "⚠️ " : "✓ "} {toast.message}
        </div>
      )}

      {/* Hero Header */}
      <PageHero
        title={user?.role === "tenant" ? "My Home Service Bookings" : user?.role === "landlord" ? "Property Service Bookings Ledger" : "Global Home Service Bookings Master"}
        subtitle="Real-time dispatch status tracking, verified service technician communication, and automated maintenance records."
      />

      {/* Top Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Quick Filter:</span>
          {["All", "Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              className={`hs-filter-btn ${selectedStatus === st ? "active" : ""}`}
              onClick={() => setSelectedStatus(st)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 600,
                border: "1px solid",
                borderColor: selectedStatus === st ? "#0284c7" : "#cbd5e1",
                background: selectedStatus === st ? "#0284c7" : "#ffffff",
                color: selectedStatus === st ? "#ffffff" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {st} ({counts[st] || 0})
            </button>
          ))}
        </div>

        {user?.role !== "admin" && (
          <button
            type="button"
            className="hs-primary-btn"
            onClick={() => navigate(portalRoute)}
            style={{ padding: "8px 18px", fontSize: 13 }}
          >
            + Book New Service
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="hs-card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <input
            type="text"
            className="hs-input"
            placeholder="Search by ID, Category, Technician, Property, Resident…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", paddingLeft: 34 }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
            🔍
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Filter Date:</label>
          <input
            type="date"
            className="hs-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 13 }}
          />
          {dateFilter && (
            <button
              type="button"
              className="hs-secondary-btn"
              onClick={() => setDateFilter("")}
              style={{ padding: "6px 10px", fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>

        <button
          type="button"
          className="hs-secondary-btn"
          onClick={loadBookings}
          style={{ padding: "8px 14px", fontSize: 12.5 }}
          title="Reload bookings list"
        >
          🔄 Refresh
        </button>

        {/* View Mode Switcher: Table vs Cards */}
        <div style={{ marginLeft: "auto", display: "flex", background: "var(--bg-subtle, #f1f5f9)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-subtle, #e2e8f0)" }}>
          <button
            type="button"
            className={`hs-secondary-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 600,
              background: viewMode === "table" ? "var(--color-primary, #2563eb)" : "transparent",
              color: viewMode === "table" ? "#ffffff" : "var(--ink-secondary, #475569)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ☰ Table View
          </button>
          <button
            type="button"
            className={`hs-secondary-btn ${viewMode === "cards" ? "active" : ""}`}
            onClick={() => setViewMode("cards")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 600,
              background: viewMode === "cards" ? "var(--color-primary, #2563eb)" : "transparent",
              color: viewMode === "cards" ? "#ffffff" : "var(--ink-secondary, #475569)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ⊞ Card View
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="hs-spinner" style={{ margin: "0 auto 16px auto" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>Loading service bookings…</div>
        </div>
      )}

      {error && !loading && (
        <div className="hs-card" style={{ padding: 24, textAlign: "center", borderColor: "#fecaca", background: "#fef2f2" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>{error}</div>
          <button type="button" className="hs-secondary-btn" onClick={loadBookings}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredBookings.length === 0 && (
        <div className="hs-card" style={{ padding: "50px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛠️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
            No Service Bookings Found
          </h3>
          <p style={{ fontSize: 13.5, color: "#64748b", maxWidth: 440, margin: "0 auto 18px auto" }}>
            {selectedStatus !== "All"
              ? `There are no bookings currently with status "${selectedStatus}".`
              : "No home maintenance or service bookings have been placed yet."}
          </p>
          {user?.role !== "admin" && (
            <button
              type="button"
              className="hs-primary-btn"
              onClick={() => navigate(portalRoute)}
            >
              Book Home Service Now
            </button>
          )}
        </div>
      )}

      {/* Bookings Data: Table vs Cards */}
      {!loading && !error && filteredBookings.length > 0 && (
        viewMode === "table" ? (
          <div className="card" style={{ padding: "0", overflowX: "auto", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: "24px", background: "#ffffff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "14px 16px", fontWeight: 700, width: "120px" }}>Booking ID</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, minWidth: "180px" }}>Service &amp; Task</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, minWidth: "180px" }}>Property / Unit</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, minWidth: "160px" }}>Provider</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, minWidth: "150px" }}>Date &amp; Time Slot</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "right", width: "100px" }}>Cost (₹)</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", width: "130px" }}>Job Status</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", width: "150px" }}>Payment Status</th>
                  <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", minWidth: "180px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b, idx) => {
                  const isCompleted = b.status === "Completed";
                  const isPaid = b.paymentStatus === "Paid";
                  const canCancel = b.status === "Confirmed" || b.status === "Assigned";
                  const jobBadge = getJobStatusBadge(b.status);

                  return (
                    <tr
                      key={b._id || b.bookingId || idx}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: idx % 2 === 0 ? "#ffffff" : "rgba(248, 250, 252, 0.6)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* 1. Booking ID */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "13px", letterSpacing: "0.02em" }}>
                          #{b.bookingId || b.id || b.bookingNumber}
                        </span>
                      </td>

                      {/* 2. Service & Task */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px" }}>
                          {b.categoryName || b.serviceCategory || "Home Service"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", lineHeight: 1.3 }}>
                          {b.subService || b.serviceName || b.issueDescription || "Standard Service"}
                        </div>
                      </td>

                      {/* 3. Property / Unit */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                          {b.propertyName || "Sai Kala Apartments - Flat 302"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {b.unit ? `Unit: ${b.unit}` : (b.bookedByName ? `Resident: ${b.bookedByName}` : "Unit: Flat B-204")}
                        </div>
                      </td>

                      {/* 4. Provider */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "13px" }}>
                          {b.providerName || "Raj Plumbing & Sanitary"}
                        </div>
                        {b.assignedTechnician?.name ? (
                          <div style={{ fontSize: "11.5px", color: "#059669", marginTop: "2px" }}>
                            🔧 Tech: {b.assignedTechnician.name}
                          </div>
                        ) : b.technicianName && b.technicianName !== b.providerName ? (
                          <div style={{ fontSize: "11.5px", color: "#059669", marginTop: "2px" }}>
                            🔧 Tech: {b.technicianName}
                          </div>
                        ) : null}
                      </td>

                      {/* 5. Date & Time Slot */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                          📅 {formatBookingDate(b.date)}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                          ⏰ {b.timeSlot || "03:00 PM"}
                        </div>
                      </td>

                      {/* 6. Cost (₹) */}
                      <td style={{ padding: "14px 16px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "14px" }}>
                          ₹{(b.estimatedCost || b.amount || 450).toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* 7. Job Status */}
                      <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "9999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            background: jobBadge.bg,
                            color: jobBadge.color,
                            border: `1px solid ${jobBadge.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span>{jobBadge.icon}</span> {jobBadge.label}
                        </span>
                      </td>

                      {/* 8. Payment Status */}
                      <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                        {isPaid ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#15803d",
                              background: "#dcfce7",
                              border: "1px solid #bbf7d0",
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ Paid
                          </span>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              padding: "5px 12px",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              borderRadius: "6px",
                              background: "#0284c7",
                              color: "#ffffff",
                              border: "none",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                            onClick={() => handleOpenPay(b)}
                          >
                            💳 Pay ₹{(b.estimatedCost || b.amount || 450).toLocaleString("en-IN")}
                          </button>
                        ) : b.paymentStatus === "Payment Submitted" || b.paymentStatus === "Pending Verification" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color: "#b45309",
                              background: "#fef3c7",
                              border: "1px solid #fde68a",
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ⏳ {b.paymentStatus}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11.5px",
                              color: "#64748b",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🔒 On Service
                          </span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                          {/* Confirmed / Assigned: Cancel Booking */}
                          {canCancel && (
                            <button
                              type="button"
                              className="btn-outline"
                              style={{
                                padding: "5px 10px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                color: "#dc2626",
                                borderColor: "#fca5a5",
                                background: "#ffffff",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onClick={() => handleOpenCancel(b)}
                            >
                              ✕ Cancel Booking
                            </button>
                          )}

                          {/* Completed: Raise Complaint & Review */}
                          {isCompleted && (
                            <>
                              {b.complaint ? (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    color: getComplaintStatusBadge(b.complaint.status).color,
                                    borderColor: getComplaintStatusBadge(b.complaint.status).border,
                                    background: getComplaintStatusBadge(b.complaint.status).bg,
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  onClick={() => setSelectedComplaintView(b.complaint)}
                                  title="View complaint details"
                                >
                                  ⚠️ {getComplaintStatusBadge(b.complaint.status).label}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    color: "#dc2626",
                                    borderColor: "#fca5a5",
                                    background: "#fef2f2",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  onClick={() => handleOpenComplaintModal(b)}
                                  title={`Raise complaint against ${b.providerName || "provider"}`}
                                >
                                  ⚠️ Raise Complaint
                                </button>
                              )}

                              {isPaid && (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    color: "#d97706",
                                    borderColor: "#fde68a",
                                    background: "#fffbeb",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  onClick={() => {
                                    setFeedbackBookingModal(b);
                                    setFeedbackRating(b.customerRating || 5);
                                    setFeedbackText(b.customerFeedback || "");
                                  }}
                                >
                                  ⭐ {b.customerRating ? `${b.customerRating}★` : "Leave Review"}
                                </button>
                              )}
                            </>
                          )}

                          {/* Admin status button */}
                          {user?.role === "admin" && (
                            <button
                              type="button"
                              className="btn-outline"
                              style={{
                                padding: "5px 10px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                color: "#475569",
                                borderColor: "#cbd5e1",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onClick={() => handleOpenStatusModal(b)}
                            >
                              ⚙️ Status
                            </button>
                          )}

                          {/* Cancelled / No Actions */}
                          {!canCancel && !isCompleted && user?.role !== "admin" && (
                            <span style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic" }}>
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredBookings.map((b) => {
            const isCancelled = b.status === "Cancelled";
            const isCompleted = b.status === "Completed";
            const canCancel = !isCancelled && !isCompleted;

            return (
              <div
                key={b._id || b.bookingId}
                className="hs-card"
                style={{
                  padding: "20px 24px",
                  borderLeft: `5px solid ${
                    isCancelled
                      ? "#ef4444"
                      : isCompleted
                      ? "#10b981"
                      : b.status === "In Progress"
                      ? "#0284c7"
                      : b.status === "Assigned"
                      ? "#6366f1"
                      : "#f59e0b"
                  }`,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#0284c7", background: "#f0f9ff", padding: "3px 8px", borderRadius: 6 }}>
                        #{b.bookingId}
                      </span>
                      <span className={`hs-status-pill hs-status-${(b.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                        {b.status}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Placed on {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : b.date}
                      </span>
                    </div>

                    <h3 style={{ margin: "4px 0", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                      {b.categoryName} — <span style={{ color: "#0284c7" }}>{b.subService}</span>
                    </h3>

                    <div style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                      <span>🏢 <strong>{b.propertyName || "Property"}</strong> ({b.unit || "Flat"})</span>
                      <span>📅 <strong>{b.date}</strong> at <strong>{b.timeSlot}</strong></span>
                      <span>👤 Booked by: <strong>{b.bookedByName}</strong> ({b.bookedByRole})</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Fee</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                      ₹{b.totalAmount || b.pricing?.finalTotal || 0}
                    </div>
                    <div style={{ fontSize: 11.5, color: b.paymentStatus === "Paid" ? "#16a34a" : "#f59e0b", fontWeight: 700 }}>
                      ● {b.paymentStatus || "Pay on Service"}
                    </div>
                  </div>
                </div>

                {/* Inline Complaint Status Banner */}
                {b.complaint && (
                  <div
                    style={{
                      margin: "12px 0 16px 0",
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: getComplaintStatusBadge(b.complaint.status).bg,
                      border: `1px solid ${getComplaintStatusBadge(b.complaint.status).border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: getComplaintStatusBadge(b.complaint.status).color,
                            background: "#fff",
                            padding: "2px 8px",
                            borderRadius: 6,
                            border: `1px solid ${getComplaintStatusBadge(b.complaint.status).border}`,
                          }}
                        >
                          Complaint #{b.complaint.id}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: getComplaintStatusBadge(b.complaint.status).color,
                            color: "#fff",
                          }}
                        >
                          {getComplaintStatusBadge(b.complaint.status).label}
                        </span>
                        <span style={{ fontSize: 11.5, color: "#64748b" }}>
                          Submitted on {b.complaint.date || "Recent"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        <span style={{ color: getComplaintStatusBadge(b.complaint.status).color }}>
                          [{b.complaint.complaintType}]
                        </span>{" "}
                        {b.complaint.subject}
                      </div>
                      {b.complaint.description && (
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2, fontStyle: "italic" }}>
                          "{b.complaint.description.length > 100 ? b.complaint.description.slice(0, 100) + "…" : b.complaint.description}"
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        background: "#ffffff",
                        borderColor: getComplaintStatusBadge(b.complaint.status).border,
                        color: getComplaintStatusBadge(b.complaint.status).color,
                        fontWeight: 700,
                      }}
                      onClick={() => setSelectedComplaintView(b.complaint)}
                    >
                      View Complaint Details
                    </button>
                  </div>
                )}

                {/* Progress Pipeline Stepper (If not cancelled) */}
                {!isCancelled ? (
                  <div style={{ margin: "18px 0 20px 0", background: "#f8fafc", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                      {STATUS_PIPELINE.map((step, idx) => {
                        const stepState = getStepStatus(step, b.status);
                        return (
                          <div
                            key={step}
                            style={{
                              flex: 1,
                              textAlign: "center",
                              position: "relative",
                              zIndex: 2,
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                margin: "0 auto 6px auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                background:
                                  stepState === "completed"
                                    ? "#10b981"
                                    : stepState === "active"
                                    ? "#0284c7"
                                    : "#e2e8f0",
                                color: stepState === "upcoming" ? "#64748b" : "#ffffff",
                                boxShadow: stepState === "active" ? "0 0 0 4px rgba(2, 132, 199, 0.2)" : "none",
                                transition: "all 0.3s ease",
                              }}
                            >
                              {stepState === "completed" ? "✓" : idx + 1}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: stepState === "active" ? 700 : 500,
                                color: stepState === "active" ? "#0284c7" : stepState === "completed" ? "#0f172a" : "#94a3b8",
                              }}
                            >
                              {step}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ margin: "14px 0", padding: "12px 16px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca", fontSize: 13, color: "#991b1b" }}>
                    <strong>Cancelled:</strong> {b.cancellationReason || "Booking cancelled by user."}
                  </div>
                )}

                {/* Provider & Action footer row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      🛠️
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        {b.providerName}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        📞 {b.providerPhone || "+91 98765 43210"} {b.technicianName && `• Tech: ${b.technicianName}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Complaint Action Button in Card */}
                    {b.complaint ? (
                      <button
                        type="button"
                        className="hs-secondary-btn"
                        style={{
                          padding: "6px 14px",
                          fontSize: 12.5,
                          color: getComplaintStatusBadge(b.complaint.status).color,
                          borderColor: getComplaintStatusBadge(b.complaint.status).border,
                          background: getComplaintStatusBadge(b.complaint.status).bg,
                          fontWeight: 700,
                        }}
                        onClick={() => setSelectedComplaintView(b.complaint)}
                      >
                        ⚠️ Complaint: {getComplaintStatusBadge(b.complaint.status).label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="hs-secondary-btn"
                        style={{ padding: "6px 14px", fontSize: 12.5, color: "#dc2626", borderColor: "#fca5a5", fontWeight: 600 }}
                        onClick={() => handleOpenComplaintModal(b)}
                      >
                        ⚠️ Raise Complaint
                      </button>
                    )}

                    <button
                      type="button"
                      className="hs-secondary-btn"
                      onClick={() => setSelectedBooking(b)}
                      style={{ padding: "6px 14px", fontSize: 12.5 }}
                    >
                      View Receipt &amp; Details
                    </button>

                    {/* Admin Status Lifecycle advancement button */}
                    {user?.role === "admin" && !isCancelled && (
                      <button
                        type="button"
                        className="hs-primary-btn"
                        onClick={() => handleOpenStatusModal(b)}
                        style={{ padding: "6px 14px", fontSize: 12.5 }}
                      >
                        ⚙️ Update Status
                      </button>
                    )}

                    {/* Cancel button if active */}
                    {canCancel && (
                      <button
                        type="button"
                        className="hs-secondary-btn"
                        onClick={() => handleOpenCancel(b)}
                        style={{ padding: "6px 14px", fontSize: 12.5, color: "#ef4444", borderColor: "#fca5a5" }}
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )
    )}

      {/* Details & Receipt Modal */}
      {selectedBooking && !cancelModalOpen && !statusModalOpen && (
        <div className="hs-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0284c7" }}>#{selectedBooking.bookingId}</span>
                <h3 style={{ margin: "2px 0 0 0", fontSize: 18, fontWeight: 700 }}>Service Booking Summary</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                  Service Information
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  {selectedBooking.categoryName} — {selectedBooking.subService}
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                  Scheduled Date: <strong>{selectedBooking.date}</strong> at <strong>{selectedBooking.timeSlot}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 8 }}>
                  <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>ASSIGNED PROVIDER</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13.5, marginTop: 2 }}>{selectedBooking.providerName}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>📞 {selectedBooking.providerPhone || "Verified"}</div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 8 }}>
                  <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>PROPERTY & UNIT</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13.5, marginTop: 2 }}>{selectedBooking.propertyName}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{selectedBooking.unit}</div>
                </div>
              </div>

              {selectedBooking.instructions && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Special Instructions:</div>
                  <div style={{ fontSize: 13, color: "#334155", background: "#f1f5f9", padding: "10px 14px", borderRadius: 8 }}>
                    "{selectedBooking.instructions}"
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 14 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                  Invoice Breakdown
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  <span>Base Service Charge:</span>
                  <span>₹{selectedBooking.pricing?.basePrice || selectedBooking.totalAmount || 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  <span>Taxes &amp; Platform GST (18%):</span>
                  <span>₹{selectedBooking.pricing?.taxes || 0}</span>
                </div>
                {selectedBooking.pricing?.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a", marginBottom: 4 }}>
                    <span>Promo Discount:</span>
                    <span>-₹{selectedBooking.pricing.discount}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                  <span>Total Payable:</span>
                  <span>₹{selectedBooking.totalAmount || selectedBooking.pricing?.finalTotal || 0}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setSelectedBooking(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && selectedBooking && (
        <div className="hs-modal-overlay" onClick={() => setCancelModalOpen(false)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>
              Cancel Booking #{selectedBooking.bookingId}
            </h3>
            <p style={{ fontSize: 13.5, color: "#475569", marginBottom: 16 }}>
              Are you sure you want to cancel the booking for <strong>{selectedBooking.categoryName}</strong> on <strong>{selectedBooking.date}</strong> at <strong>{selectedBooking.timeSlot}</strong>?
            </p>

            <form onSubmit={handleConfirmCancel}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Reason for Cancellation <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  className="hs-input"
                  rows={3}
                  placeholder="e.g., Issue resolved internally, rescheduling, provider unavailable…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling}
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  className="hs-primary-btn"
                  style={{ background: "#dc2626" }}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Update Status Modal */}
      {statusModalOpen && selectedBooking && (
        <div className="hs-modal-overlay" onClick={() => setStatusModalOpen(false)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
              Update Booking Status &amp; Dispatch
            </h3>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Booking #{selectedBooking.bookingId} • {selectedBooking.categoryName} ({selectedBooking.propertyName})
            </div>

            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Lifecycle Status Transition:
                </label>
                <select
                  className="hs-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {STATUS_PIPELINE.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Technician Assigned Name:
                </label>
                <input
                  type="text"
                  className="hs-input"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="Technician full name"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Technician Contact Phone:
                </label>
                <input
                  type="text"
                  className="hs-input"
                  value={techPhone}
                  onChange={(e) => setTechPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Status / Service Update Note:
                </label>
                <textarea
                  className="hs-input"
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional log update for resident and landlord"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setStatusModalOpen(false)}
                  disabled={updatingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hs-primary-btn"
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RAISE COMPLAINT POPUP / FLOATING CARD OVERLAY */}
      {complaintModalBooking && (
        <div
          className="hs-modal-overlay"
          onClick={() => !submittingComplaint && setComplaintModalBooking(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
          }}
        >
          <div
            className="hs-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
              padding: "24px 28px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                  Raise a Complaint
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Tell us about the issue with your service booking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submittingComplaint && setComplaintModalBooking(null)}
                style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#64748b", lineHeight: 1, padding: "2px 6px" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Read-Only Booking Details Box */}
            <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 12.5 }}>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    Booking ID
                  </span>
                  <strong style={{ color: "#0284c7", fontSize: 13 }}>
                    #{complaintModalBooking.bookingId || complaintModalBooking.id || complaintModalBooking.bookingNumber}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    Service Name
                  </span>
                  <strong style={{ color: "#0f172a", fontSize: 13 }}>
                    {complaintModalBooking.categoryName || complaintModalBooking.serviceCategory} — {complaintModalBooking.subService || complaintModalBooking.serviceName}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    Provider
                  </span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>
                    {complaintModalBooking.providerName || "Assigned Partner"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    Property / Unit
                  </span>
                  <span style={{ color: "#334155" }}>
                    {complaintModalBooking.propertyName} ({complaintModalBooking.unit || "Unit"})
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message Alert */}
            {complaintFormErrors.api && (
              <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {complaintFormErrors.api}
              </div>
            )}

            {/* Complaint Form */}
            <form onSubmit={handleSubmitComplaint}>
              {/* Complaint Category Dropdown */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Complaint Category <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="hs-select"
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", fontSize: "13.5px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  disabled={submittingComplaint}
                >
                  <option value="Poor Service Quality">Poor Service Quality</option>
                  <option value="Provider Did Not Arrive">Provider Did Not Arrive</option>
                  <option value="Incomplete Work">Incomplete Work</option>
                  <option value="Property Damage">Property Damage</option>
                  <option value="Overcharging / Payment Issue">Overcharging / Payment Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Subject Field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Subject <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="hs-input"
                  value={complaintSubject}
                  onChange={(e) => {
                    setComplaintSubject(e.target.value);
                    if (complaintFormErrors.subject) {
                      setComplaintFormErrors({ ...complaintFormErrors, subject: null });
                    }
                  }}
                  placeholder="e.g., Tap still leaking after technician repair"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "13.5px",
                    borderRadius: "8px",
                    border: `1px solid ${complaintFormErrors.subject ? "#ef4444" : "#cbd5e1"}`,
                  }}
                  disabled={submittingComplaint}
                />
                {complaintFormErrors.subject && (
                  <div style={{ color: "#ef4444", fontSize: "12px", marginTop: 4 }}>
                    ⚠️ {complaintFormErrors.subject}
                  </div>
                )}
              </div>

              {/* Detailed Complaint Textarea */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Detailed Complaint <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  className="hs-input"
                  rows={4}
                  value={complaintDescription}
                  onChange={(e) => {
                    setComplaintDescription(e.target.value);
                    if (complaintFormErrors.description) {
                      setComplaintFormErrors({ ...complaintFormErrors, description: null });
                    }
                  }}
                  placeholder="Please describe the issue in detail, including what was done or missed..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "13.5px",
                    borderRadius: "8px",
                    border: `1px solid ${complaintFormErrors.description ? "#ef4444" : "#cbd5e1"}`,
                    lineHeight: 1.5,
                  }}
                  disabled={submittingComplaint}
                />
                {complaintFormErrors.description && (
                  <div style={{ color: "#ef4444", fontSize: "12px", marginTop: 4 }}>
                    ⚠️ {complaintFormErrors.description}
                  </div>
                )}
              </div>

              {/* Optional Attachment Upload */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Attachment (Optional Photos or Supporting Evidence)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={submittingComplaint}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 25 * 1024 * 1024) {
                      showToast("Selected image is too large. Please pick a file under 25MB.", "error");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        try {
                          const canvas = document.createElement("canvas");
                          const MAX_DIM = 1280;
                          let width = img.width;
                          let height = img.height;
                          if (width > MAX_DIM || height > MAX_DIM) {
                            if (width > height) {
                              height = Math.round((height * MAX_DIM) / width);
                              width = MAX_DIM;
                            } else {
                              width = Math.round((width * MAX_DIM) / height);
                              height = MAX_DIM;
                            }
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext("2d");
                          ctx.drawImage(img, 0, 0, width, height);
                          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
                          setComplaintAttachment(compressedBase64);
                        } catch {
                          setComplaintAttachment(event.target.result);
                        }
                      };
                      img.onerror = () => {
                        setComplaintAttachment(event.target.result);
                      };
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                  style={{ fontSize: "12.5px", width: "100%" }}
                />
                {complaintAttachment && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <img
                      src={complaintAttachment}
                      alt="Complaint Attachment Preview"
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    />
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "4px 10px", fontSize: "11.5px", color: "#ef4444", borderColor: "#fca5a5" }}
                      onClick={() => setComplaintAttachment("")}
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setComplaintModalBooking(null)}
                  disabled={submittingComplaint}
                  style={{ padding: "8px 18px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hs-primary-btn"
                  style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff", padding: "8px 20px", fontSize: "13px", fontWeight: 700 }}
                  disabled={submittingComplaint}
                >
                  {submittingComplaint ? "Submitting…" : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. VIEW COMPLAINT DETAILS MODAL */}
      {selectedComplaintView && (
        <div
          className="hs-modal-overlay"
          onClick={() => setSelectedComplaintView(null)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="hs-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: "100%" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#be123c", background: "#ffe4e6", padding: "2px 8px", borderRadius: 4 }}>
                  Complaint #{selectedComplaintView.id || selectedComplaintView.complaintId}
                </span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  Provider Complaint Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComplaintView(null)}
                style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#64748b", lineHeight: 1 }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Status
                  </span>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: getComplaintStatusBadge(selectedComplaintView.status).bg,
                        color: getComplaintStatusBadge(selectedComplaintView.status).color,
                        border: `1px solid ${getComplaintStatusBadge(selectedComplaintView.status).border}`,
                        marginTop: 4,
                      }}
                    >
                      {getComplaintStatusBadge(selectedComplaintView.status).label}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Date Submitted
                  </span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
                    📅 {selectedComplaintView.date || "Recent"}
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
                  Provider &amp; Complaint Category
                </div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>
                  {selectedComplaintView.providerName || "Assigned Provider"}
                </div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
                  Type: <strong>{selectedComplaintView.complaintType || "Service Quality"}</strong>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                  Subject
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", background: "#fff", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: 6 }}>
                  {selectedComplaintView.subject}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                  Description
                </div>
                <div style={{ color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", borderRadius: 6, whiteSpace: "pre-wrap" }}>
                  {selectedComplaintView.description || selectedComplaintView.issue || "No description provided."}
                </div>
              </div>

              {selectedComplaintView.attachment && (
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                    Attached Photo Proof
                  </div>
                  <img
                    src={selectedComplaintView.attachment}
                    alt="Complaint Attachment"
                    style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid #cbd5e1", objectFit: "cover" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setSelectedComplaintView(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
