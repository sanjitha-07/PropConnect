import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import useEscapeKey from "../../utils/useEscapeKey.js";
import {
  fetchProviderBookings,
  fetchProviderStats,
  updateServiceBookingStatus,
} from "../../utils/apiClient.js";

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ProviderOverview() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const providerId = user?.entityId || user?.entity_id || "PROV_AC_01";
  const providerName = user?.name || "Verified Service Pro";

  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingCount: 0,
    confirmedCount: 0,
    assignedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    totalEarnings: 0,
    rating: 4.9,
    reviewCount: 32,
  });

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");

  // Availability state
  const [isActivePro, setIsActivePro] = useState(true);
  const [activeDays, setActiveDays] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const [activeSlots, setActiveSlots] = useState(TIME_SLOTS);

  // Status advance modal
  const [statusModalBooking, setStatusModalBooking] = useState(null);
  const [targetStatus, setTargetStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [technicianName, setTechnicianName] = useState(user?.name || "");
  const [technicianPhone, setTechnicianPhone] = useState("+91 98401 23456");
  const [updating, setUpdating] = useState(false);

  const [toast, setToast] = useState(null);

  useEscapeKey(() => setStatusModalBooking(null), Boolean(statusModalBooking));

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProviderData = async () => {
    setLoading(true);
    try {
      const [st, bkList] = await Promise.all([
        fetchProviderStats(providerId),
        fetchProviderBookings({ providerId }),
      ]);
      if (st) setStats(st);
      if (Array.isArray(bkList)) setBookings(bkList);
    } catch (err) {
      console.warn("Provider data load warning:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviderData();
  }, [providerId]);

  const handleOpenStatusModal = (booking, nextStatus) => {
    setStatusModalBooking(booking);
    setTargetStatus(nextStatus);
    setStatusNote("");
    setTechnicianName(booking.technicianName || user?.name || "");
    setTechnicianPhone(booking.technicianPhone || "+91 98401 23456");
  };

  const handleConfirmStatusChange = async (e) => {
    e.preventDefault();
    if (!statusModalBooking || !targetStatus) return;

    setUpdating(true);
    try {
      const bId = statusModalBooking.id || statusModalBooking._id || statusModalBooking.bookingId;
      await updateServiceBookingStatus(bId, {
        status: targetStatus,
        note: statusNote || `Status updated to ${targetStatus} by ${user?.name || "Service Provider"}`,
        technicianName,
        technicianPhone,
      });

      showToast(`✓ Booking #${statusModalBooking.bookingNumber || bId} advanced to "${targetStatus}"!`);
      setStatusModalBooking(null);
      await loadProviderData();
    } catch (err) {
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setUpdating(false);
    }
  };

  const toggleDay = (day) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
    showToast(`Working days updated (${day})`);
  };

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === "All") return true;
    return b.status === filterStatus;
  });

  return (
    <div className="provider-dashboard-page" style={{ paddingBottom: "40px" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            zIndex: 1100,
            fontSize: "13.5px",
            fontWeight: 600,
          }}
        >
          {toast.message}
        </div>
      )}

      <PageHero
        title={`Service Provider Portal: ${providerName}`}
        subtitle="Manage assigned work orders, advance job status (Pending → Completed), configure availability slots, and track earnings."
      />

      {/* Provider Status Bar */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: isActivePro
            ? "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)"
            : "#f8fafc",
          borderLeft: `5px solid ${isActivePro ? "#16a34a" : "#94a3b8"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: isActivePro ? "#dcfce7" : "#e2e8f0",
              color: isActivePro ? "#15803d" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 800,
            }}
          >
            {isActivePro ? "⚡" : "⏸️"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--ink-primary)" }}>
              {isActivePro ? "🟢 Active & Accepting New Service Orders" : "⚪ Currently Busy / On Leave"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
              Provider ID: {providerId} • Rating: ⭐ {stats.rating} ({stats.reviewCount} customer reviews)
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsActivePro(!isActivePro);
            showToast(isActivePro ? "Status set to Offline / Busy" : "Status set to Online & Ready for Dispatch");
          }}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid",
            borderColor: isActivePro ? "#16a34a" : "#cbd5e1",
            background: isActivePro ? "#16a34a" : "#ffffff",
            color: isActivePro ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: "pointer",
          }}
        >
          {isActivePro ? "Toggle Busy / Leave Mode" : "Go Active / Take Jobs"}
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "22px" }}>
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Total Assigned Jobs</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>{stats.totalBookings || bookings.length}</div>
          <div style={{ fontSize: "11px", color: "#0284c7" }}>Overall service tickets</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Pending Confirmation</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#d97706", margin: "4px 0" }}>
            {bookings.filter((b) => b.status === "Pending").length}
          </div>
          <div style={{ fontSize: "11px", color: "#b45309" }}>Requires your confirmation</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #6366f1" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Confirmed / Assigned</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#4f46e5", margin: "4px 0" }}>
            {bookings.filter((b) => b.status === "Confirmed" || b.status === "Assigned").length}
          </div>
          <div style={{ fontSize: "11px", color: "#4338ca" }}>Scheduled for dispatch</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #0284c7" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>In Progress</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0284c7", margin: "4px 0" }}>
            {bookings.filter((b) => b.status === "In Progress").length}
          </div>
          <div style={{ fontSize: "11px", color: "#0369a1" }}>Technician on site</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #16a34a" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Completed Jobs</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#16a34a", margin: "4px 0" }}>
            {bookings.filter((b) => b.status === "Completed").length}
          </div>
          <div style={{ fontSize: "11px", color: "#15803d" }}>Successfully delivered</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}>
          <div style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>Total Earnings</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#14532d", margin: "4px 0" }}>
            ₹{(stats.totalEarnings || bookings.filter(b => b.paymentStatus === "Paid").reduce((s, b) => s + (b.amount || 499), 0)).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "11px", color: "#15803d" }}>Collected from completed jobs</div>
        </div>
      </div>

      {/* Assigned Bookings Pipeline Table */}
      <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
              Job Orders &amp; Dispatch Pipeline
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
              Advance status: Pending → Confirmed → Assigned → In Progress → Completed.
            </p>
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["All", "Pending", "Confirmed", "Assigned", "In Progress", "Completed"].map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: filterStatus === st ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  background: filterStatus === st ? "#0284c7" : "#ffffff",
                  color: filterStatus === st ? "#ffffff" : "#475569",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📦</div>
            <div>No service jobs matching filter "{filterStatus}".</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Customer &amp; Location</th>
                  <th>Service Category</th>
                  <th>Scheduled Slot</th>
                  <th>Job Fee</th>
                  <th>Status</th>
                  <th>Customer Payment</th>
                  <th>Advance Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const isPending = b.status === "Pending";
                  const isConfirmed = b.status === "Confirmed";
                  const isAssigned = b.status === "Assigned";
                  const isInProgress = b.status === "In Progress";
                  const isCompleted = b.status === "Completed";
                  const isPaid = b.paymentStatus === "Paid";

                  return (
                    <tr key={b.id || b._id}>
                      <td style={{ fontWeight: 800, color: "#0284c7" }}>
                        #{b.bookingNumber || b.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{b.userName || "Resident Tenant"}</div>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          📍 {b.propertyName} ({b.unit})
                        </div>
                        {b.userPhone && (
                          <div style={{ fontSize: "11px", color: "#0284c7" }}>
                            📞 {b.userPhone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{b.serviceCategory}</span>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{b.serviceName}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>📅 {b.date}</div>
                        <div style={{ fontSize: "11.5px", color: "#0284c7" }}>⏰ {b.timeSlot}</div>
                      </td>
                      <td style={{ fontWeight: 800 }}>₹{b.amount || 499}</td>
                      <td>
                        <span
                          className={`pill ${
                            isCompleted
                              ? "paid"
                              : isInProgress
                              ? "active"
                              : isAssigned
                              ? "active"
                              : isConfirmed
                              ? "pending"
                              : "failed"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="pill paid">✓ Paid</span>
                        ) : isCompleted ? (
                          <span className="pill pending">Payment Pending</span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Pay on completion
                          </span>
                        )}
                        {b.rating ? (
                          <div style={{ fontSize: "11.5px", color: "#ca8a04", marginTop: "2px" }}>
                            ⭐ {b.rating}/5
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {isPending && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: "11px", padding: "4px 9px", background: "#2563eb" }}
                              onClick={() => handleOpenStatusModal(b, "Confirmed")}
                            >
                              ✓ Confirm Job
                            </button>
                          )}

                          {isConfirmed && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: "11px", padding: "4px 9px", background: "#4f46e5" }}
                              onClick={() => handleOpenStatusModal(b, "Assigned")}
                            >
                              👷 Assign Tech
                            </button>
                          )}

                          {(isConfirmed || isAssigned) && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: "11px", padding: "4px 9px", background: "#0284c7" }}
                              onClick={() => handleOpenStatusModal(b, "In Progress")}
                            >
                              ⚡ Start Work
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{
                                fontSize: "11.5px",
                                padding: "5px 11px",
                                background: "#16a34a",
                                borderColor: "#16a34a",
                                fontWeight: 700,
                              }}
                              onClick={() => handleOpenStatusModal(b, "Completed")}
                            >
                              ✅ Mark Completed
                            </button>
                          )}

                          {isCompleted && (
                            <span style={{ fontSize: "11.5px", color: "#16a34a", fontWeight: 700 }}>
                              ✓ Job Delivered
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
        )}
      </div>

      {/* Availability & Working Schedule Management Card */}
      <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>
          Availability &amp; Working Schedule Management
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#64748b" }}>
          Configure working days and active time slots when customers can book your services.
        </p>

        {/* Working Days */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
            Operational Days (Click to toggle):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {WEEK_DAYS.map((day) => {
              const isOn = activeDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: isOn ? "1px solid #16a34a" : "1px solid #cbd5e1",
                    background: isOn ? "#f0fdf4" : "#ffffff",
                    color: isOn ? "#15803d" : "#64748b",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isOn ? "✓ " : ""}{day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
            Active Daily Time Slots:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {TIME_SLOTS.map((slot) => (
              <span
                key={slot}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  color: "#0369a1",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                ⏰ {slot}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Status Advance Modal */}
      {statusModalBooking && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setStatusModalBooking(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                Advance Job #{statusModalBooking.bookingNumber || statusModalBooking.id} → {targetStatus}
              </h3>
              <button className="modal-close-btn" onClick={() => setStatusModalBooking(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmStatusChange} style={{ padding: "20px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                  Technician / Contact Person Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="e.g. Murugan K."
                  required
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                  Technician Mobile Number
                </label>
                <input
                  type="tel"
                  className="form-input"
                  value={technicianPhone}
                  onChange={(e) => setTechnicianPhone(e.target.value)}
                  placeholder="+91 98401 23456"
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                  Dispatch Notes / Progress Summary
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Technician on the way / Work completed with warranty"
                />
              </div>

              {targetStatus === "Completed" && (
                <div style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "12px", color: "#166534", marginBottom: "14px" }}>
                  ℹ️ Marking this job <strong>Completed</strong> will notify the customer and unlock payment collection (₹{statusModalBooking.amount || 499}).
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setStatusModalBooking(null)}>
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updating}
                  style={{
                    background: targetStatus === "Completed" ? "#16a34a" : "#0284c7",
                    borderColor: targetStatus === "Completed" ? "#16a34a" : "#0284c7",
                    fontWeight: 700,
                  }}
                >
                  {updating ? "Saving…" : `Confirm "${targetStatus}" →`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
