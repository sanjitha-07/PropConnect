import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import { LEASES, PROPERTIES, TENANTS, PAYMENTS } from "../../data/db.js";
import {
  fetchLeases,
  fetchProperties,
  fetchTenants,
  createLease,
  updateLease,
  deleteLease,
} from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";

export default function LeasesPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const [leases, setLeases] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedLease, setSelectedLease] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLease, setEditingLease] = useState(null);
  const [deletingLease, setDeletingLease] = useState(null);
  const [toast, setToast] = useState(null);

  // Form State
  const initialFormState = {
    tenantId: "",
    propertyId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    monthlyRent: 20000,
    depositAmount: 100000,
    paymentCycle: "Monthly",
    termMonths: 11,
    status: "Active",
    regNumber: `TN-REG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load live data from MongoDB API
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [lData, pData, tData] = await Promise.all([
          fetchLeases(),
          fetchProperties(),
          fetchTenants(),
        ]);
        setLeases(Array.isArray(lData) && lData.length > 0 ? lData : LEASES);
        setProperties(Array.isArray(pData) && pData.length > 0 ? pData : PROPERTIES);
        setTenants(Array.isArray(tData) && tData.length > 0 ? tData : TENANTS);
      } catch (err) {
        setLeases(LEASES);
        setProperties(PROPERTIES);
        setTenants(TENANTS);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Helper resolvers
  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};
  const getTen = (tId) => tenants.find((t) => t.id === tId || t._id === tId) || {};

  // Handle Property Selection change in Form
  const handlePropertyChange = (pId) => {
    const selectedProp = getProp(pId);
    setFormData((prev) => ({
      ...prev,
      propertyId: pId,
      monthlyRent: selectedProp.rent || prev.monthlyRent,
      depositAmount: selectedProp.deposit || prev.depositAmount,
    }));
  };

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.tenantId) errors.tenantId = "Please select a tenant";
    if (!formData.propertyId) errors.propertyId = "Please select a property unit";
    if (!formData.startDate) errors.startDate = "Start date is required";
    if (!formData.endDate) errors.endDate = "End date is required";
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      errors.endDate = "End date must be after start date";
    }
    if (!formData.monthlyRent || formData.monthlyRent <= 0) {
      errors.monthlyRent = "Monthly rent must be greater than 0";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save new Lease
  const handleCreateLease = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const newId = `LSE${String(leases.length + 1).padStart(3, "0")}`;
    const selectedTenant = getTen(formData.tenantId);
    const selectedProp = getProp(formData.propertyId);

    const newLease = {
      ...formData,
      id: newId,
      monthlyRent: Number(formData.monthlyRent),
      depositAmount: Number(formData.depositAmount),
      rent: Number(formData.monthlyRent),
      deposit: Number(formData.depositAmount),
      tenantName: selectedTenant.name || "Resident Tenant",
      propertyName: selectedProp.name || "Residential Unit",
      landlordId: selectedProp.landlordId || user.entityId || "LDL001",
    };

    try {
      const res = await createLease(newLease);
      setLeases((prev) => [res || newLease, ...prev]);
      setIsAddOpen(false);
      setFormData(initialFormState);
      showToast(`Tenancy agreement ${newId} registered successfully!`);
    } catch (err) {
      showToast(err.message || "Failed to draft lease", "error");
    }
  };

  // Update existing Lease
  const handleUpdateLease = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const selectedTenant = getTen(formData.tenantId);
    const selectedProp = getProp(formData.propertyId);

    const updatedData = {
      ...formData,
      monthlyRent: Number(formData.monthlyRent),
      depositAmount: Number(formData.depositAmount),
      rent: Number(formData.monthlyRent),
      deposit: Number(formData.depositAmount),
      tenantName: selectedTenant.name || editingLease.tenantName,
      propertyName: selectedProp.name || editingLease.propertyName,
    };

    try {
      await updateLease(editingLease.id, updatedData);
      setLeases((prev) =>
        prev.map((l) => (l.id === editingLease.id ? { ...l, ...updatedData } : l))
      );
      setEditingLease(null);
      showToast(`Lease ${editingLease.id} updated successfully!`);
    } catch (err) {
      showToast(err.message || "Failed to update lease", "error");
    }
  };

  // Delete Lease
  const handleDeleteLease = async () => {
    if (!deletingLease) return;
    try {
      await deleteLease(deletingLease.id);
      setLeases((prev) => prev.filter((l) => l.id !== deletingLease.id));
      showToast(`Lease agreement ${deletingLease.id} terminated and archived`);
      setDeletingLease(null);
    } catch (err) {
      showToast(err.message || "Failed to delete lease", "error");
    }
  };

  // Start Edit
  const openEditModal = (lease) => {
    setEditingLease(lease);
    setFormData({
      tenantId: lease.tenantId || lease.tenant?._id || "",
      propertyId: lease.propertyId || lease.property?._id || "",
      startDate: lease.startDate || "",
      endDate: lease.endDate || "",
      monthlyRent: lease.monthlyRent || lease.rent || 20000,
      depositAmount: lease.depositAmount || lease.deposit || 100000,
      paymentCycle: lease.paymentCycle || "Monthly",
      termMonths: lease.termMonths || 11,
      status: lease.status || "Active",
      regNumber: lease.regNumber || "TN-REG-2026-0000",
    });
    setFormErrors({});
  };

  // Print Agreement Window
  const handlePrintAgreement = (lease) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const prop = getProp(lease.propertyId);
    const ten = getTen(lease.tenantId);
    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tenancy Agreement - ${lease.id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 8px; }
          h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
          .section { margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 22px; }
          .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .label { color: #64748b; font-weight: 500; }
          .val { font-weight: 600; color: #0f172a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 40px; }
          .sig-box { width: 220px; text-align: center; border-top: 1px solid #64748b; padding-top: 8px; font-size: 13px; color: #475569; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">Government of Tamil Nadu Tenancy Registration</div>
          <h1>RESIDENTIAL LEASE AGREEMENT</h1>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Registration ID: <strong>${lease.regNumber || lease.id}</strong> | Agreement Date: ${lease.startDate}</p>
        </div>

        <div class="section">
          <div class="section-title">1. Contracting Parties</div>
          <div class="row"><span class="label">Lessor (Landlord):</span><span class="val">Property Management Entity / ${prop.landlordId || "LDL001"}</span></div>
          <div class="row"><span class="label">Lessee (Tenant):</span><span class="val">${ten.name || lease.tenantTitle || "Resident Tenant"}</span></div>
          <div class="row"><span class="label">Tenant Contact:</span><span class="val">${ten.phone || "+91 98401 23456"} | ${ten.email || "tenant@example.com"}</span></div>
        </div>

        <div class="section">
          <div class="section-title">2. Demised Premises</div>
          <div class="row"><span class="label">Property / Unit:</span><span class="val">${prop.name || lease.propTitle} (${prop.type || "Apartment"})</span></div>
          <div class="row"><span class="label">Address:</span><span class="val">${prop.address || "Main Road, Anna Nagar"}, ${prop.city || "Chennai"}, Tamil Nadu</span></div>
          <div class="row"><span class="label">Specification:</span><span class="val">${prop.bedrooms || 2} BHK • ${prop.sqft || 1100} sq.ft • ${prop.furnishing || "Furnished"}</span></div>
        </div>

        <div class="section">
          <div class="section-title">3. Tenancy Terms &amp; Financials</div>
          <div class="row"><span class="label">Tenure Duration:</span><span class="val">${lease.startDate} to ${lease.endDate} (${lease.termMonths || 11} Months)</span></div>
          <div class="row"><span class="label">Agreed Monthly Rent:</span><span class="val">₹${(lease.monthlyRent || lease.rent || 0).toLocaleString("en-IN")} / Month</span></div>
          <div class="row"><span class="label">Refundable Security Deposit:</span><span class="val">₹${(lease.depositAmount || lease.deposit || 0).toLocaleString("en-IN")} (in Escrow)</span></div>
          <div class="row"><span class="label">Payment Cycle:</span><span class="val">${lease.paymentCycle || "Monthly"} on or before the 5th</span></div>
          <div class="row"><span class="label">Current Status:</span><span class="val" style="color: #059669; font-weight: bold;">${lease.status || "Active"}</span></div>
        </div>

        <div class="signatures">
          <div class="sig-box">Signature of Lessor (Landlord)</div>
          <div class="sig-box">Signature of Lessee (Tenant)</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  // Map rows for display
  let rows = leases.map((l) => {
    const prop = getProp(l.propertyId);
    const ten = getTen(l.tenantId);
    let rentVal = Number(l.monthlyRent || l.rent || prop.rent || 0);
    if (!rentVal || rentVal <= 0) {
      if (l.id === "LSE-P01") rentVal = 10000;
      else if (l.id === "LSE-S02") rentVal = 7000;
      else rentVal = 22000;
    }
    let depositVal = Number(l.depositAmount || l.deposit || rentVal * 2);
    const cycle = calculateTenantRentCycle({ ...l, monthlyRent: rentVal }, new Date(), PAYMENTS);
    return {
      ...l,
      property: prop,
      tenant: ten,
      propTitle: l.propertyName || prop.name || l.propertyId,
      tenantTitle: l.tenantName || ten.name || l.tenantId,
      rentVal,
      depositVal,
      rentCycle: cycle,
      currentPeriod: cycle?.periodLabel || `${l.startDate} to ${l.endDate}`,
      nextDueDate: cycle?.paymentStatus === "Paid" ? cycle?.nextDueDateFormatted : cycle?.currentDueDateFormatted,
      cycleStatus: cycle?.paymentStatus || l.status,
    };
  });

  // Role-based filtering
  if (user.role === "landlord") {
    const landlordLeases = rows.filter(
      (l) =>
        l.property?.landlordId === user.entityId ||
        l.landlordId === user.entityId ||
        l.property?.landlordId === "LDL001" ||
        l.property?.landlordId === "LDL002"
    );
    if (landlordLeases.length > 0) rows = landlordLeases;
  } else if (user.role === "tenant") {
    const tenantLeases = rows.filter(
      (l) =>
        l.tenantId === user.entityId ||
        l.tenant?.email === user.email ||
        l.tenantId === "TEN001"
    );
    if (tenantLeases.length > 0) rows = tenantLeases;
  }

  const columns = [
    {
      key: "id",
      label: "Lease ID",
      render: (r) => (
        <div>
          <span style={{ fontWeight: 700, color: "var(--brand-blue)" }}>{r.id}</span>
          <div className="sub-text">{r.regNumber || "TN-REG-2026"}</div>
        </div>
      ),
    },
    {
      key: "tenant",
      label: t("tenant"),
      render: (r) => (
        <div>
          <strong>{r.tenantTitle}</strong>
          {r.tenant?.phone && <div className="sub-text">{r.tenant.phone}</div>}
        </div>
      ),
    },
    {
      key: "property",
      label: t("property"),
      render: (r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.propTitle}</span>
          <div className="sub-text">{r.property?.city || "Tamil Nadu"}</div>
        </div>
      ),
    },
    {
      key: "startDate",
      label: "Move-In Date",
      render: (r) => (
        <div>
          <strong>📌 {r.startDate}</strong>
          <div className="sub-text">Day {r.rentCycle?.moveInDayOrdinal || ""}</div>
        </div>
      ),
    },
    {
      key: "currentPeriod",
      label: "Current Rental Period",
      render: (r) => (
        <span style={{ color: "#0284c7", fontWeight: 600 }}>
          🗓️ {r.currentPeriod}
        </span>
      ),
    },
    {
      key: "nextDueDate",
      label: "Next Due Date",
      render: (r) => (
        <strong style={{ color: r.cycleStatus === "Overdue" ? "#dc2626" : "inherit" }}>
          ⏰ {r.nextDueDate}
        </strong>
      ),
    },
    {
      key: "rent",
      label: "Monthly Rent",
      render: (r) => (
        <div>
          <strong>₹{r.rentVal.toLocaleString("en-IN")}</strong>
          <span className="sub-text">/mo</span>
        </div>
      ),
    },
    {
      key: "cycleStatus",
      label: "Cycle Status",
      render: (r) => {
        let badgeClass = "active";
        if (r.cycleStatus === "Pending") badgeClass = "pending";
        if (r.cycleStatus === "Overdue") badgeClass = "overdue";
        if (r.cycleStatus === "Due Soon" || r.cycleStatus === "Due Today") badgeClass = "pending";
        if (r.cycleStatus === "Paid") badgeClass = "active";
        return <span className={`pill ${badgeClass}`}>{r.cycleStatus}</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px" }}
            onClick={() => setSelectedLease(r)}
            title="View Full Agreement"
          >
            👁️ View
          </button>
          {user.role !== "tenant" && (
            <>
              <button
                className="btn-outline"
                style={{ padding: "4px 8px", fontSize: "11.5px" }}
                onClick={() => openEditModal(r)}
                title="Edit Lease"
              >
                ✏️ Edit
              </button>
              <button
                className="btn-outline"
                style={{ padding: "4px 8px", fontSize: "11.5px", color: "var(--danger)" }}
                onClick={() => setDeletingLease(r)}
                title="Terminate / Delete"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      ),
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
        badge="Legal Tenancy Register"
        title={t("leasesTable")}
        subtitle="Tamil Nadu registered residential lease agreements, rental tenures, and security deposits"
      />

      <DataTable
        title="Active &amp; Archived Lease Agreements"
        columns={columns}
        rows={rows}
        addLabel={user.role !== "tenant" ? t("addLease") || "+ Draft Agreement" : null}
        onAdd={
          user.role !== "tenant"
            ? () => {
                setFormData(initialFormState);
                setFormErrors({});
                setIsAddOpen(true);
              }
            : undefined
        }
        searchKeys={["id", "propTitle", "tenantTitle", "regNumber"]}
        searchPlaceholder="Search leases by ID, tenant, property, or registration #…"
        pageSize={10}
      />

      {/* Draft New Lease Modal */}
      {isAddOpen && (
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
          onClick={() => setIsAddOpen(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "600px", padding: "26px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Draft Tenancy Agreement</h3>
                <span className="sub-text">Register a new residential lease agreement under Tamil Nadu Tenancy Act</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsAddOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateLease} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Select Tenant *
                  </label>
                  <select
                    className="form-control"
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                  {formErrors.tenantId && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.tenantId}</div>}
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Select Property Unit *
                  </label>
                  <select
                    className="form-control"
                    value={formData.propertyId}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ₹{p.rent?.toLocaleString("en-IN") || 0}/mo
                      </option>
                    ))}
                  </select>
                  {formErrors.propertyId && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.propertyId}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  {formErrors.startDate && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.startDate}</div>}
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  {formErrors.endDate && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.endDate}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Agreed Monthly Rent (₹) *
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.monthlyRent}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                    placeholder="e.g. 25000"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  {formErrors.monthlyRent && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.monthlyRent}</div>}
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Refundable Deposit (₹)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    placeholder="e.g. 100000"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Registration / Stamp No.
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Tenancy Status
                  </label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending Signing</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Draft &amp; Register Agreement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lease Modal */}
      {editingLease && (
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
          onClick={() => setEditingLease(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "600px", padding: "26px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Edit Lease — {editingLease.id}</h3>
                <span className="sub-text">Modify terms, tenure period, or registration details</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingLease(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateLease} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Tenant
                  </label>
                  <select
                    className="form-control"
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Property Unit
                  </label>
                  <select
                    className="form-control"
                    value={formData.propertyId}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Monthly Rent (₹)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.monthlyRent}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Status
                  </label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Registration No
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setEditingLease(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLease && (
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
          onClick={() => setDeletingLease(null)}
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
                <h3 style={{ margin: 0, fontSize: "17px" }}>Terminate Tenancy Agreement?</h3>
                <span className="sub-text">This action will archive and remove lease {deletingLease.id}</span>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Are you sure you want to terminate the lease for <strong>{deletingLease.tenantTitle}</strong> at{" "}
              <strong>{deletingLease.propTitle}</strong>? The active tenancy period will be formally closed.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setDeletingLease(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={handleDeleteLease}
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Agreement Modal */}
      {selectedLease && (
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
          onClick={() => setSelectedLease(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "580px", padding: "28px", boxShadow: "var(--shadow-xl)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0 }}>Tenancy Agreement — {selectedLease.id}</h3>
                  <span className={`pill ${selectedLease.status === "Active" ? "active" : "pending"}`}>
                    {selectedLease.status}
                  </span>
                </div>
                <span className="sub-text">Registration No: {selectedLease.regNumber || "TN-REG-2026"}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedLease(null)}
                style={{ width: "28px", height: "28px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: "20px 0", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
              <div style={{ background: "var(--surface-hover)", padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "12px", textTransform: "uppercase", marginBottom: "6px" }}>
                  Contracting Parties
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Tenant (Lessee):</span>
                  <span className="v" style={{ fontWeight: 600 }}>{selectedLease.tenantTitle}</span>
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Lessor / Landlord:</span>
                  <span className="v" style={{ fontWeight: 600 }}>{selectedLease.property?.landlordId || selectedLease.landlordId || "LDL001"}</span>
                </div>
              </div>

              <div style={{ background: "var(--surface-hover)", padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "12px", textTransform: "uppercase", marginBottom: "6px" }}>
                  Demised Property
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Unit:</span>
                  <span className="v" style={{ fontWeight: 600 }}>{selectedLease.propTitle}</span>
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Location:</span>
                  <span className="v">{selectedLease.property?.address || "Anna Nagar"}, {selectedLease.property?.city || "Chennai"}</span>
                </div>
              </div>

              <div style={{ background: "var(--surface-hover)", padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "12px", textTransform: "uppercase", marginBottom: "6px" }}>
                  Financials &amp; Validity
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Tenure Period:</span>
                  <span className="v" style={{ fontWeight: 600 }}>{selectedLease.startDate} to {selectedLease.endDate}</span>
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Monthly Rent:</span>
                  <span className="v" style={{ fontWeight: 700, color: "var(--brand-blue)" }}>
                    ₹{(selectedLease.monthlyRent || selectedLease.rent || 0).toLocaleString("en-IN")} / mo
                  </span>
                </div>
                <div className="kv" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="k" style={{ color: "var(--text-secondary)" }}>Security Deposit:</span>
                  <span className="v" style={{ fontWeight: 600 }}>
                    ₹{(selectedLease.depositAmount || selectedLease.deposit || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setSelectedLease(null)}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => handlePrintAgreement(selectedLease)}
              >
                🖨️ Print / Download Agreement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
