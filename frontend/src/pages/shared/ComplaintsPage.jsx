import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import { COMPLAINTS, PROPERTIES, TENANTS } from "../../data/db.js";
import {
  fetchComplaints,
  fetchProperties,
  fetchTenants,
  createComplaint,
  updateComplaint,
  deleteComplaint,
} from "../../utils/apiClient.js";
import FixItDispatchModal from "../../components/fixit/FixItDispatchModal.jsx";
import LiveTrackingModal from "../../components/fixit/LiveTrackingModal.jsx";
import ServiceReviewModal from "../../components/fixit/ServiceReviewModal.jsx";

export default function ComplaintsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const [complaintList, setComplaintList] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [deletingComplaint, setDeletingComplaint] = useState(null);
  const [toast, setToast] = useState(null);

  // FixIt Local Modals
  const [dispatchComplaint, setDispatchComplaint] = useState(null);
  const [trackingBooking, setTrackingBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);

  const initialComplaint = {
    subject: "",
    propertyId: "",
    tenantId: "",
    priority: "Medium",
    details: "",
  };
  const [newComplaint, setNewComplaint] = useState(initialComplaint);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cData, pData, tData] = await Promise.all([
          fetchComplaints(),
          fetchProperties(),
          fetchTenants(),
        ]);
        setComplaintList(Array.isArray(cData) && cData.length > 0 ? cData : COMPLAINTS);
        setProperties(Array.isArray(pData) && pData.length > 0 ? pData : PROPERTIES);
        setTenants(Array.isArray(tData) && tData.length > 0 ? tData : TENANTS);
      } catch (err) {
        setComplaintList(COMPLAINTS);
        setProperties(PROPERTIES);
        setTenants(TENANTS);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};
  const getTen = (tId) => tenants.find((t) => t.id === tId || t._id === tId) || {};

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    if (!newComplaint.subject) return;

    const newId = `CMP${String(complaintList.length + 1).padStart(3, "0")}`;
    const selectedProp = getProp(newComplaint.propertyId || properties[0]?.id);
    const selectedTen = getTen(newComplaint.tenantId || tenants[0]?.id);

    const created = {
      id: newId,
      tenantId: selectedTen.id || user?.entityId || "TEN001",
      tenantName: selectedTen.name || user?.name || "Resident",
      propertyId: selectedProp.id || "PROP001",
      propertyName: selectedProp.name || "Sai Kala Apartments #302",
      subject: newComplaint.subject,
      priority: newComplaint.priority,
      status: "Open",
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    };

    try {
      const res = await createComplaint(created);
      setComplaintList([res || created, ...complaintList]);
      setShowModal(false);
      setNewComplaint(initialComplaint);
      showToast(`Complaint ${newId} registered and assigned for review!`);
    } catch (err) {
      showToast(err.message || "Failed to lodge complaint", "error");
    }
  };

  const handleResolve = async (id) => {
    try {
      await updateComplaint(id, { status: "Resolved" });
      setComplaintList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "Resolved" } : c))
      );
      showToast(`Complaint ${id} marked as Resolved!`);
    } catch (err) {
      setComplaintList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "Resolved" } : c))
      );
      showToast(`Complaint ${id} updated locally`);
    }
  };

  const handleDelete = async () => {
    if (!deletingComplaint) return;
    try {
      await deleteComplaint(deletingComplaint.id);
      setComplaintList((prev) => prev.filter((c) => c.id !== deletingComplaint.id));
      showToast(`Complaint ${deletingComplaint.id} removed`);
      setDeletingComplaint(null);
    } catch (err) {
      showToast(err.message || "Failed to delete complaint", "error");
    }
  };

  const rows = complaintList
    .map((c) => {
      const prop = getProp(c.propertyId);
      const ten = getTen(c.tenantId);
      return {
        ...c,
        property: prop,
        tenant: ten,
        tenantName: ten.name || c.tenantName || "Resident",
        propName: c.propertyName || prop.name || c.propertyId,
      };
    })
    .filter(
      (c) =>
        user.role !== "landlord" ||
        c.property?.landlordId === user.entityId ||
        c.property?.landlordId === "LDL001" ||
        c.property?.landlordId === "LDL002"
    );

  const openCount = rows.filter((r) => r.status === "Open" || r.status === "In Review").length;
  const resolvedCount = rows.filter((r) => r.status === "Resolved" || r.status === "Closed").length;

  const columns = [
    {
      key: "id",
      label: "Complaint ID",
      render: (r) => <span style={{ fontWeight: 700, color: "var(--brand-blue)" }}>{r.id}</span>,
    },
    { key: "tenant", label: t("tenant"), render: (r) => <strong>{r.tenantName}</strong> },
    {
      key: "property",
      label: "Property & Unit",
      render: (r) => (
        <div>
          <span>{r.propName}</span>
          <div className="sub-text">{r.property?.city || "Tamil Nadu"}</div>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Grievance Subject",
      render: (r) => <strong>{r.subject}</strong>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => {
        const p = r.priority || "Medium";
        let cls = "active";
        if (p === "High" || p === "Urgent") cls = "overdue";
        else if (p === "Medium") cls = "pending";
        return <span className={`pill ${cls}`}>{p}</span>;
      },
    },
    { key: "date", label: "Date Lodged", render: (r) => r.date || "Recent" },
    {
      key: "status",
      label: t("status"),
      render: (r) => {
        const cls = r.status === "Resolved" || r.status === "Closed" ? "active" : "pending";
        return <span className={`pill ${cls}`}>{r.status}</span>;
      },
    },
    {
      key: "actions",
      label: "FixIt Dispatch & Actions",
      render: (r) => {
        const isOpen = r.status === "Open" || r.status === "In Review";
        const isDispatched = r.status === "FixIt Dispatched" || r.status === "In Progress";
        const isResolved = r.status === "Resolved" || r.status === "Closed";

        return (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {isOpen && (
              <button
                className="btn-primary"
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                  fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(2, 132, 199, 0.3)",
                }}
                onClick={() => setDispatchComplaint(r)}
                title="Search nearby technicians, compare ratings & book"
              >
                ⚡ FixIt Dispatch (Compare &amp; Book)
              </button>
            )}

            {isDispatched && (
              <button
                className="btn-primary"
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  background: "#0284c7",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onClick={() =>
                  setTrackingBooking({
                    id: r.bookingId || `BK_FIX_${r.id}`,
                    unit: r.unit || "Flat B-204",
                    propertyName: r.propName || "Sai Kala Apartments",
                    serviceTitle: r.subject || "AC Repair & Service",
                    providerName: "Kumar AC Services",
                    technicianName: "Kumar S.",
                    technicianPhone: "+91 98765 00001",
                    status: "On The Way",
                    amount: 800,
                  })
                }
              >
                📍 Track Live GPS
              </button>
            )}

            {!isResolved ? (
              <button
                className="btn-outline"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => handleResolve(r.id)}
              >
                ✓ Resolve
              </button>
            ) : (
              <span className="pill active" style={{ fontSize: "11px" }}>Resolved</span>
            )}

            <a
              href={`/${user?.role === "admin" ? "admin" : "landlord"}/home-services?propertyId=${r.propertyId || ""}&unit=${encodeURIComponent(r.unit || "")}`}
              className="btn-outline"
              style={{ padding: "4px 8px", fontSize: "11px", color: "#0284c7", borderColor: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
              title="Book Home Service directly for this property"
            >
              🛠️ Book Service
            </a>

            <button
              className="btn-outline"
              style={{ padding: "4px 8px", fontSize: "11px", color: "var(--danger)" }}
              onClick={() => setDeletingComplaint(r)}
              title="Delete Complaint"
            >
              🗑️
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: toast.type === "error" ? "var(--danger)" : "var(--success)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 500,
          }}
        >
          <span>{toast.type === "error" ? "⚠️" : "✅"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <PageHero
        badge="Resident Grievance Redressal"
        title="Complaints &amp; Disputes"
        subtitle="Tamil Nadu tenancy disputes, noise complaints, common area upkeep, and prompt grievance resolution"
        actions={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Lodge Grievance
          </button>
        }
      />

      {/* KPI Banner */}
      <div className="tn-properties-banner" style={{ marginBottom: "20px" }}>
        <div className="banner-stat">
          <span className="stat-num">{rows.length}</span>
          <span className="stat-label">Total Grievances</span>
        </div>
        <div className="banner-stat">
          <span className="stat-num" style={{ color: "var(--amber)" }}>
            {openCount}
          </span>
          <span className="stat-label">Pending Resolution</span>
        </div>
        <div className="banner-stat">
          <span className="stat-num" style={{ color: "var(--green)" }}>
            {resolvedCount}
          </span>
          <span className="stat-label">Resolved &amp; Closed</span>
        </div>
      </div>

      <DataTable
        title="Grievances Ledger"
        columns={columns}
        rows={rows}
        searchKeys={["id", "subject", "propName", "tenantName"]}
        searchPlaceholder="Search complaints by ID, subject, property, or tenant…"
        pageSize={10}
      />

      {/* Lodge Complaint Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "520px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Lodge Resident Grievance</h3>
                <span className="sub-text">Submit an official complaint for immediate review</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateComplaint} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Property Unit
                  </label>
                  <select
                    className="form-control"
                    value={newComplaint.propertyId}
                    onChange={(e) => setNewComplaint({ ...newComplaint, propertyId: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="">-- Select Unit --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Priority Level
                  </label>
                  <select
                    className="form-control"
                    value={newComplaint.priority}
                    onChange={(e) => setNewComplaint({ ...newComplaint, priority: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent / Immediate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                  Grievance Subject *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={newComplaint.subject}
                  onChange={(e) => setNewComplaint({ ...newComplaint, subject: e.target.value })}
                  placeholder="e.g. Excessive noise from upper floor after 11 PM"
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                  Detailed Grievance Note
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={newComplaint.details}
                  onChange={(e) => setNewComplaint({ ...newComplaint, details: e.target.value })}
                  placeholder="Provide any additional context or dates…"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Grievance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Complaint Modal */}
      {deletingComplaint && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setDeletingComplaint(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "460px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px" }}>Delete Grievance?</h3>
                <span className="sub-text">Complaint ID: {deletingComplaint.id}</span>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Are you sure you want to remove the grievance entry: <strong>"{deletingComplaint.subject}"</strong>?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setDeletingComplaint(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FixIt Local Dispatch Modal */}
      {dispatchComplaint && (
        <FixItDispatchModal
          complaint={dispatchComplaint}
          onClose={() => setDispatchComplaint(null)}
          onSuccess={(newBooking) => {
            setDispatchComplaint(null);
            showToast(`🎉 Technician Dispatched! ${newBooking.technicianName || "Kumar S."} is on the way.`);
            setComplaintList((prev) =>
              prev.map((c) =>
                c.id === dispatchComplaint.id
                  ? { ...c, status: "FixIt Dispatched", bookingId: newBooking.id }
                  : c
              )
            );
            setTrackingBooking(newBooking);
          }}
        />
      )}

      {/* Live GPS Tracking Modal */}
      {trackingBooking && (
        <LiveTrackingModal
          booking={trackingBooking}
          onClose={() => setTrackingBooking(null)}
          onServiceCompleted={(completedBooking) => {
            setTrackingBooking(null);
            setComplaintList((prev) =>
              prev.map((c) =>
                c.bookingId === completedBooking.id || c.id === completedBooking.complaintId
                  ? { ...c, status: "Resolved" }
                  : c
              )
            );
            setReviewBooking(completedBooking);
          }}
        />
      )}

      {/* Service Review Modal */}
      {reviewBooking && (
        <ServiceReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => {
            setReviewBooking(null);
            showToast("⭐ Service review recorded into Property Maintenance History!");
          }}
        />
      )}
    </div>
  );
}

