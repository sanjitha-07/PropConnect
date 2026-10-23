import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import FixItDispatchModal from "../../components/fixit/FixItDispatchModal.jsx";
import LiveTrackingModal from "../../components/fixit/LiveTrackingModal.jsx";
import ServiceReviewModal from "../../components/fixit/ServiceReviewModal.jsx";
import { COMPLAINTS } from "../../data/db.js";
import { createComplaint } from "../../utils/apiClient.js";

export default function MyComplaintsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const entityId = user?.entityId || user?.entity_id || "TEN001";

  const [complaints, setComplaints] = useState([
    {
      id: "CMP101",
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      subject: "AC not cooling properly in Master Bedroom",
      issue: "AC cooling problem - fan running but no cool air",
      category: "AC Repair",
      priority: "High",
      status: "In Progress",
      bookingId: "BK_FIX_101",
    },
    ...COMPLAINTS.filter((c) => c.tenantId === entityId),
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [subjectInput, setSubjectInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("AC Repair");
  const [priorityInput, setPriorityInput] = useState("High");

  // FixIt Local Modals
  const [activeDispatchComplaint, setActiveDispatchComplaint] = useState(null);
  const [activeTrackingBooking, setActiveTrackingBooking] = useState(null);
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectInput.trim()) return;
    const nextId = `CMP${Math.floor(Math.random() * 900 + 100)}`;
    const newComplaint = {
      id: nextId,
      tenantName: user?.name || "Divya Priya",
      tenant_name: user?.name || "Divya Priya",
      propertyName: "Sai Kala Apartments - Flat 302",
      property: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      subject: subjectInput.trim(),
      issue: subjectInput.trim(),
      category: categoryInput,
      priority: priorityInput,
      status: "Open",
    };

    setComplaints((prev) => [newComplaint, ...prev]);

    // Persist to backend
    await createComplaint(newComplaint);

    setSubjectInput("");
    setModalOpen(false);

    showToast(`✓ Complaint ${nextId} submitted! Landlord notified and FixIt Local technician matching enabled.`);
  };

  const handleOpenTrackingForComplaint = (complaint) => {
    setActiveTrackingBooking({
      id: complaint.bookingId || `BK_FIX_${complaint.id}`,
      complaintId: complaint.id,
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: complaint.unit || "Flat B-204",
      serviceTitle: `${complaint.category || "AC Repair"} Service & Jet Clean`,
      providerName: "Kumar AC Services",
      technicianName: "Kumar S.",
      technicianPhone: "+91 98765 00001",
      vehicle: "TVS Apache - TN 01 AB 4321",
      status: "On The Way",
      amount: 800,
    });
  };

  const columns = [
    { key: "id", label: t("complaintId") || "Complaint ID" },
    { key: "propertyName", label: t("property") || "Property", render: (r) => `${r.propertyName || "Sai Kala Apartments #302"} (${r.unit || "Flat B-204"})` },
    { key: "category", label: "Category", render: (r) => (
      <span style={{ fontWeight: 600, color: "#0284c7" }}>
        {r.category === "AC Repair" && "❄️ "}
        {r.category === "Plumbing" && "🚰 "}
        {r.category === "Electrical" && "⚡ "}
        {r.category === "Cleaning" && "✨ "}
        {r.category || "General"}
      </span>
    ) },
    { key: "subject", label: t("subject") || "Subject", render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.subject}</div>
        <div style={{ fontSize: 11.5, color: "#64748b" }}>{r.issue || r.subject}</div>
      </div>
    ) },
    { key: "status", label: t("status") || "Status", render: (r) => (
      <span className={`pill ${r.status?.toLowerCase().replace(/\s+/g, "-")}`}>
        {r.status}
      </span>
    ) },
    {
      key: "actions",
      label: "FixIt Local Dispatch",
      render: (r) => {
        const isOpen = r.status === "Open";
        const isDispatched = r.status === "FixIt Dispatched" || r.status === "In Progress";
        const isCompleted = r.status === "Completed" || r.status === "Resolved";

        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {isOpen && (
              <button
                type="button"
                className="btn-outline"
                style={{ fontSize: 11.5, padding: "4px 10px", borderColor: "#0284c7", color: "#0284c7", fontWeight: 700 }}
                onClick={() => setActiveDispatchComplaint(r)}
              >
                ⚡ Match &amp; Dispatch Pro
              </button>
            )}

            {isDispatched && (
              <button
                type="button"
                className="btn-primary"
                style={{
                  fontSize: 11.5,
                  padding: "5px 12px",
                  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
                  animation: "fixitPulse 2s infinite",
                }}
                onClick={() => handleOpenTrackingForComplaint(r)}
              >
                📍 Track Live GPS
              </button>
            )}

            {isCompleted && (
              <button
                type="button"
                className="btn-outline"
                style={{ fontSize: 11.5, padding: "4px 10px", color: "#16a34a", borderColor: "#86efac", fontWeight: 700 }}
                onClick={() => {
                  setActiveReviewBooking({
                    id: r.bookingId || "BK_FIX_101",
                    unit: r.unit || "Flat B-204",
                    providerName: "Kumar AC Services",
                    technicianName: "Kumar S.",
                    amount: 800,
                  });
                }}
              >
                ⭐ Rate Service
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#0f172a",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: 12,
            zIndex: 10000,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      <PageHero
        title={t("myComplaints") || "My Complaints & Service Requests"}
        subtitle="Report maintenance issues, get Landlord approval, and track FixIt Local verified technicians in real-time."
      />

      {/* Dual Choice Gateway Banner for Flat Issues */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Option A: Book Home Service */}
        <div
          className="hs-card"
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)",
            border: "1.5px solid #38bdf8",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>🛠️</span>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.05em" }}>
                  Option A • Immediate Resolution
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  Book Home Service
                </h3>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#334155", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              For minor repairs or personal maintenance (Cleaning, Plumbing, Electrical, AC Repair, Pest Control, Appliances). Select verified technicians with atomic slot booking!
            </p>
          </div>
          <a
            href="/tenant/home-services"
            className="hs-primary-btn"
            style={{ textAlign: "center", textDecoration: "none", display: "block", padding: "10px 16px", fontWeight: 700 }}
          >
            ⚡ Explore Home Services &amp; Book Pro →
          </a>
        </div>

        {/* Option B: Raise Complaint to Landlord */}
        <div
          className="hs-card"
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #fff7ed 0%, #fef2f2 100%)",
            border: "1.5px solid #fb923c",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>📢</span>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#c2410c", letterSpacing: "0.05em" }}>
                  Option B • Landlord Responsibility
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  Raise Complaint to Landlord
                </h3>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#334155", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              For major structural issues, heavy water seepage, main electrical wiring failures, or lease violations requiring official landlord approval &amp; expense coverage.
            </p>
          </div>
          <button
            type="button"
            className="hs-secondary-btn"
            onClick={() => setModalOpen(true)}
            style={{ padding: "10px 16px", fontWeight: 700, borderColor: "#ea580c", color: "#c2410c", background: "#ffffff" }}
          >
            + Lodge Formal Complaint to Landlord
          </button>
        </div>
      </div>

      <DataTable
        title={t("myComplaints") || "Complaints & FixIt Service Tickets"}
        columns={columns}
        rows={complaints}
        addLabel={t("newComplaint") || "New Complaint"}
        onAdd={() => setModalOpen(true)}
      />

      {/* New Complaint Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ maxWidth: 540 }}>
            <div className="settings-header">
              <h3>Raise New Maintenance Complaint</h3>
              <button type="button" className="icon-btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="field">
              <label>Service Category</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 4 }}>
                {[
                  { id: "AC Repair", label: "❄️ AC Repair & Cooling" },
                  { id: "Plumbing", label: "🚰 Plumbing & Water Leak" },
                  { id: "Electrical", label: "⚡ Electrical & Wiring" },
                  { id: "Cleaning", label: "✨ Deep Cleaning & Maid" },
                ].map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`toggle-btn ${categoryInput === c.id ? "active" : ""}`}
                    onClick={() => setCategoryInput(c.id)}
                    style={{ textAlign: "left", padding: "8px 12px", fontSize: 12.5 }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Problem Description</label>
              <input
                className="inp"
                autoFocus
                placeholder="e.g. AC cooling problem in Flat B-204 master bedroom"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Priority Level</label>
              <div className="toggle-row">
                {["High", "Medium", "Low"].map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`toggle-btn ${priorityInput === p ? "active" : ""}`}
                    onClick={() => setPriorityInput(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#64748b" }}>
              💡 <strong>Workflow Note:</strong> Once submitted, your landlord receives an instant alert to approve. You or your landlord can then select verified FixIt Local technicians, compare ratings/price, and track the technician live on GPS!
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>
                {t("cancel") || "Cancel"}
              </button>
              <button type="submit" className="btn-primary" style={{ padding: "8px 22px" }}>
                Submit Complaint
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FixIt Local Dispatch Modal */}
      {activeDispatchComplaint && (
        <FixItDispatchModal
          complaint={activeDispatchComplaint}
          onClose={() => setActiveDispatchComplaint(null)}
          onSuccess={(newBooking) => {
            setActiveDispatchComplaint(null);
            showToast(`🎉 Technician Dispatched! ${newBooking.technicianName || "Kumar S."} is on the way.`);
            // Update complaint row
            setComplaints((prev) =>
              prev.map((c) =>
                c.id === activeDispatchComplaint.id
                  ? { ...c, status: "In Progress", bookingId: newBooking.id }
                  : c
              )
            );
            setActiveTrackingBooking(newBooking);
          }}
        />
      )}

      {/* Live GPS Tracking Modal */}
      {activeTrackingBooking && (
        <LiveTrackingModal
          booking={activeTrackingBooking}
          onClose={() => setActiveTrackingBooking(null)}
          onServiceCompleted={(completedBooking) => {
            setActiveTrackingBooking(null);
            setComplaints((prev) =>
              prev.map((c) =>
                c.bookingId === completedBooking.id || c.id === completedBooking.complaintId
                  ? { ...c, status: "Completed" }
                  : c
              )
            );
            setActiveReviewBooking(completedBooking);
          }}
        />
      )}

      {/* Service Review Modal */}
      {activeReviewBooking && (
        <ServiceReviewModal
          booking={activeReviewBooking}
          onClose={() => setActiveReviewBooking(null)}
          onSubmitted={() => {
            setActiveReviewBooking(null);
            showToast("⭐ Service completed! Expense recorded in Property Maintenance History.");
          }}
        />
      )}
    </div>
  );
}
