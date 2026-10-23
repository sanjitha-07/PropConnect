import { useState, useEffect } from "react";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceProviders,
  fetchProviderAvailabilityOverrides,
  setProviderAvailabilityOverride,
  removeProviderAvailabilityOverride,
  fetchProviderAvailability,
} from "../../utils/apiClient.js";
import "../../components/services/HomeServicesStyles.css";

const STANDARD_SLOTS = ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM", "6:00 PM"];

export default function AvailabilityManagementPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inspector state
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Slot states for the selected provider & date
  const [slotStatusMap, setSlotStatusMap] = useState({});
  const [inspectingSlots, setInspectingSlots] = useState(false);

  // Overrides list
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  // Add override form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    providerId: "",
    date: "",
    overrideType: "Leave",
    timeSlot: "10:00 AM",
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const provList = await fetchServiceProviders();
        setProviders(Array.isArray(provList) ? provList : []);
        if (provList?.length > 0) {
          setSelectedProviderId(provList[0].id || provList[0]._id);
        }
      } catch (err) {
        console.error("Failed to load providers:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const loadOverrides = async () => {
    setLoadingOverrides(true);
    try {
      const data = await fetchProviderAvailabilityOverrides(selectedProviderId, selectedDate);
      setOverrides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load overrides:", err);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const inspectProviderSlots = async () => {
    if (!selectedProviderId || !selectedDate) return;
    setInspectingSlots(true);
    try {
      const provider = providers.find((p) => p.id === selectedProviderId || p._id === selectedProviderId);
      if (!provider) return;

      const slotResults = {};
      const slotsToCheck = Array.isArray(provider.timeSlots) && provider.timeSlots.length > 0
        ? provider.timeSlots
        : STANDARD_SLOTS;

      await Promise.all(
        slotsToCheck.map(async (slot) => {
          try {
            const res = await fetchProviderAvailability(provider.category, selectedDate, slot);
            const provStatus = res?.providers?.find(
              (p) => p.id === selectedProviderId || p._id === selectedProviderId
            );
            slotResults[slot] = {
              status: provStatus ? provStatus.status : "Available",
              reason: provStatus ? provStatus.reason : "",
            };
          } catch (e) {
            slotResults[slot] = { status: "Available", reason: "" };
          }
        })
      );

      setSlotStatusMap(slotResults);
    } catch (err) {
      console.error("Error inspecting slots:", err);
    } finally {
      setInspectingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedProviderId && selectedDate) {
      loadOverrides();
      inspectProviderSlots();
    }
  }, [selectedProviderId, selectedDate]);

  const openAddModal = () => {
    setFormData({
      providerId: selectedProviderId || (providers[0]?.id || providers[0]?._id || ""),
      date: selectedDate,
      overrideType: "Leave",
      timeSlot: "10:00 AM",
      reason: "",
    });
    setModalOpen(true);
  };

  const handleCreateOverride = async (e) => {
    e.preventDefault();
    if (!formData.providerId || !formData.date) {
      showToast("Provider and date are required", "error");
      return;
    }

    setSaving(true);
    try {
      const selectedProv = providers.find((p) => p.id === formData.providerId || p._id === formData.providerId);
      await setProviderAvailabilityOverride({
        providerId: formData.providerId,
        providerName: selectedProv?.name || "Service Provider",
        date: formData.date,
        isAvailable: formData.overrideType === "Available",
        isLeave: formData.overrideType === "Leave",
        blockedSlots: formData.overrideType === "Blocked Slot" ? [formData.timeSlot] : [],
        reason: formData.reason || `${formData.overrideType} set by Admin`,
      });

      showToast("Availability override recorded successfully");
      setModalOpen(false);
      await loadOverrides();
      await inspectProviderSlots();
    } catch (err) {
      showToast(err.message || "Failed to set override", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (overrideId) => {
    try {
      await removeProviderAvailabilityOverride(overrideId);
      showToast("Override removed");
      await loadOverrides();
      await inspectProviderSlots();
    } catch (err) {
      showToast(err.message || "Failed to remove override", "error");
    }
  };

  const currentProvider = providers.find((p) => p.id === selectedProviderId || p._id === selectedProviderId);

  return (
    <div className="home-services-container">
      {toast && (
        <div className={`hs-toast show ${toast.type === "error" ? "hs-toast-error" : ""}`}>
          {toast.type === "error" ? "⚠️ " : "✓ "} {toast.message}
        </div>
      )}

      <PageHero
        title="Provider Availability &amp; Roster Management"
        subtitle="Schedule technician leaves, block unavailable maintenance time slots, and inspect real-time booking availability."
      />

      {/* Control Strip */}
      <div className="hs-card" style={{ padding: "18px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
              Select Service Provider:
            </label>
            <select
              className="hs-select"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              style={{ minWidth: 260 }}
            >
              {providers.map((p) => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.name} ({p.category}) — {p.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
              Inspection Date:
            </label>
            <input
              type="date"
              className="hs-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "8px 12px" }}
            />
          </div>
        </div>

        <button
          type="button"
          className="hs-primary-btn"
          onClick={openAddModal}
          style={{ padding: "9px 18px", fontSize: 13 }}
        >
          + Mark Leave / Block Slot
        </button>
      </div>

      {/* Selected Provider Overview & Slots Grid */}
      {currentProvider && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, marginBottom: 24 }}>
          {/* Provider Card */}
          <div className="hs-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                👨‍🔧
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  {currentProvider.name}
                </h3>
                <div style={{ fontSize: 12.5, color: "#0284c7", fontWeight: 600 }}>
                  {currentProvider.category} • ⭐ {currentProvider.rating || 4.8}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
              <div>📞 Phone: <strong>{currentProvider.phone}</strong></div>
              <div>📍 Location: <strong>{currentProvider.location || "Tamil Nadu"}</strong></div>
              <div>
                📅 Working Days:{" "}
                <strong>
                  {Array.isArray(currentProvider.workingDays)
                    ? currentProvider.workingDays.map((d) => d.slice(0, 3)).join(", ")
                    : "Mon-Sat"}
                </strong>
              </div>
              <div>
                ⚙️ Status:{" "}
                <span className={`hs-status-pill ${currentProvider.status === "Active" ? "hs-status-confirmed" : "hs-status-cancelled"}`}>
                  {currentProvider.status}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Slots Matrix for Selected Date */}
          <div className="hs-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Live Schedule Status on {selectedDate}
                </h4>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Atomic availability preview factoring confirmed bookings and administrative overrides.
                </div>
              </div>
              {inspectingSlots && <div className="hs-spinner" style={{ width: 18, height: 18 }} />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {(Array.isArray(currentProvider.timeSlots) && currentProvider.timeSlots.length > 0
                ? currentProvider.timeSlots
                : STANDARD_SLOTS
              ).map((slot) => {
                const info = slotStatusMap[slot] || { status: "Available", reason: "" };
                const isBooked = info.status === "Booked";
                const isLeave = info.status === "On Leave" || info.status === "Blocked";

                return (
                  <div
                    key={slot}
                    style={{
                      padding: "14px 12px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor: isBooked ? "#fca5a5" : isLeave ? "#fcd34d" : "#86efac",
                      background: isBooked ? "#fef2f2" : isLeave ? "#fffbeb" : "#f0fdf4",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                      {slot}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: isBooked ? "#fee2e2" : isLeave ? "#fef3c7" : "#dcfce7",
                        color: isBooked ? "#991b1b" : isLeave ? "#92400e" : "#166534",
                      }}
                    >
                      {isBooked ? "🔒 Booked" : isLeave ? "⛔ Blocked" : "✓ Available"}
                    </span>
                    {info.reason && (
                      <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {info.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Overrides Table */}
      <div className="hs-card" style={{ padding: 22 }}>
        <h4 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          Registered Overrides &amp; Leaves for Selected Provider
        </h4>

        {loadingOverrides ? (
          <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>Loading overrides…</div>
        ) : overrides.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 8 }}>
            No administrative leaves or slot blocks registered for this provider on {selectedDate}.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                <th style={{ padding: "10px 14px", borderRadius: "6px 0 0 6px" }}>Date</th>
                <th style={{ padding: "10px 14px" }}>Type</th>
                <th style={{ padding: "10px 14px" }}>Blocked Slots</th>
                <th style={{ padding: "10px 14px" }}>Reason</th>
                <th style={{ padding: "10px 14px", textAlign: "right", borderRadius: "0 6px 6px 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((ov) => (
                <tr key={ov._id || ov.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{ov.date}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className="hs-status-pill hs-status-cancelled">
                      {ov.isLeave ? "Full Day Leave" : "Blocked Slot"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {Array.isArray(ov.blockedSlots) && ov.blockedSlots.length > 0
                      ? ov.blockedSlots.join(", ")
                      : "Entire Day"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#475569" }}>{ov.reason || "Administrative block"}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <button
                      type="button"
                      className="hs-secondary-btn"
                      onClick={() => handleRemoveOverride(ov._id || ov.id)}
                      style={{ padding: "4px 10px", fontSize: 11.5, color: "#dc2626", borderColor: "#fca5a5" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Override Modal */}
      {modalOpen && (
        <div className="hs-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Set Provider Availability Override
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOverride}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Provider
                </label>
                <select
                  className="hs-select"
                  value={formData.providerId}
                  onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                  style={{ width: "100%" }}
                >
                  {providers.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Date
                </label>
                <input
                  type="date"
                  className="hs-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Override Type
                </label>
                <select
                  className="hs-select"
                  value={formData.overrideType}
                  onChange={(e) => setFormData({ ...formData, overrideType: e.target.value })}
                  style={{ width: "100%" }}
                >
                  <option value="Leave">Full Day Leave</option>
                  <option value="Blocked Slot">Block Specific Slot</option>
                </select>
              </div>

              {formData.overrideType === "Blocked Slot" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Specific Slot to Block
                  </label>
                  <select
                    className="hs-select"
                    value={formData.timeSlot}
                    onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    {STANDARD_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Reason (Leave notice / maintenance)
                </label>
                <input
                  type="text"
                  className="hs-input"
                  placeholder="e.g. Technician on medical leave, tool repair…"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hs-primary-btn"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
