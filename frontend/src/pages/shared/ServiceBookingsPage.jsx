import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceBookings,
  updateServiceBookingStatus,
  cancelServiceBooking,
} from "../../utils/apiClient.js";
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

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Admin status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [techName, setTechName] = useState("");
  const [techPhone, setTechPhone] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

      {/* Bookings Grid */}
      {!loading && !error && filteredBookings.length > 0 && (
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

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
    </div>
  );
}
