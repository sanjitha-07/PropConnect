import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import { UTILITY_BILLS, PROPERTIES } from "../../data/db.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import {
  fetchUtilityBills,
  fetchProperties,
  createUtilityBill,
  updateUtilityBill,
  deleteUtilityBill,
} from "../../utils/apiClient.js";

export default function UtilityBillsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const [bills, setBills] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState("all"); // "all", "water", "housing", "electricity"

  // Modals & form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deletingBill, setDeletingBill] = useState(null);
  const [toast, setToast] = useState(null);

  // Esc key closes modals
  useEscapeKey(() => {
    if (isAddOpen) setIsAddOpen(false);
    if (editingBill) setEditingBill(null);
    if (deletingBill) setDeletingBill(null);
  }, isAddOpen || !!editingBill || !!deletingBill);

  const initialForm = {
    propertyId: "",
    type: "Water Charges (CMWSSB)",
    responsibility: "tenant", // "tenant", "landlord", "shared"
    consumerNo: "WTR-CMWSSB-2026-90",
    amount: 850,
    billDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "Pending",
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [billData, propData] = await Promise.all([
          fetchUtilityBills(),
          fetchProperties(),
        ]);
        setBills(Array.isArray(billData) && billData.length > 0 ? billData : UTILITY_BILLS);
        setProperties(Array.isArray(propData) && propData.length > 0 ? propData : PROPERTIES);
      } catch (err) {
        setBills(UTILITY_BILLS);
        setProperties(PROPERTIES);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};

  const validateForm = () => {
    const errors = {};
    if (!formData.propertyId) errors.propertyId = "Please select a property unit";
    if (!formData.amount || formData.amount <= 0) errors.amount = "Enter a valid amount";
    if (!formData.dueDate) errors.dueDate = "Due date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const newId = `UTL${String(bills.length + 1).padStart(3, "0")}`;
    const selectedProp = getProp(formData.propertyId);

    const newBill = {
      ...formData,
      id: newId,
      amount: Number(formData.amount),
      billingMonth: formData.billingMonth || "October 2026",
      propertyName: selectedProp.name || "Apartment Unit",
    };

    try {
      const res = await createUtilityBill(newBill);
      setBills((prev) => [res || newBill, ...prev]);
      setIsAddOpen(false);
      setFormData(initialForm);
      showToast(`Utility bill ${newId} recorded successfully!`);
    } catch (err) {
      showToast(err.message || "Failed to create utility bill", "error");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const updated = {
      ...formData,
      amount: Number(formData.amount),
    };

    try {
      await updateUtilityBill(editingBill.id, updated);
      setBills((prev) =>
        prev.map((b) => (b.id === editingBill.id ? { ...b, ...updated } : b))
      );
      setEditingBill(null);
      showToast(`Utility bill ${editingBill.id} updated!`);
    } catch (err) {
      showToast(err.message || "Failed to update bill", "error");
    }
  };

  const handleQuickPay = async (bill) => {
    try {
      await updateUtilityBill(bill.id, { status: "Paid" });
      setBills((prev) =>
        prev.map((b) => (b.id === bill.id ? { ...b, status: "Paid" } : b))
      );
      showToast(`Bill ${bill.id} marked as Paid!`);
    } catch (err) {
      showToast("Updated locally");
      setBills((prev) =>
        prev.map((b) => (b.id === bill.id ? { ...b, status: "Paid" } : b))
      );
    }
  };

  const handleDelete = async () => {
    if (!deletingBill) return;
    try {
      await deleteUtilityBill(deletingBill.id);
      setBills((prev) => prev.filter((b) => b.id !== deletingBill.id));
      showToast(`Utility bill ${deletingBill.id} removed`);
      setDeletingBill(null);
    } catch (err) {
      showToast(err.message || "Failed to delete bill", "error");
    }
  };

  const openEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      propertyId: bill.propertyId || "",
      type: bill.type || "Electricity (TANGEDCO)",
      consumerNo: bill.consumerNo || "",
      amount: bill.amount || 0,
      billDate: bill.billDate || new Date().toISOString().split("T")[0],
      dueDate: bill.dueDate || "",
      status: bill.status || "Pending",
    });
    setFormErrors({});
  };

  const allRows = bills
    .map((b) => {
      const prop = getProp(b.propertyId);
      const typeStr = String(b.type || "").toLowerCase();
      let category = "electricity";
      if (typeStr.includes("water") || typeStr.includes("cmwssb") || typeStr.includes("tanker")) {
        category = "water";
      } else if (typeStr.includes("tax") || typeStr.includes("housing") || typeStr.includes("corporation") || typeStr.includes("property")) {
        category = "housing";
      }

      let resp = b.responsibility;
      if (!resp) {
        if (category === "housing") resp = "landlord";
        else if (category === "water") resp = "tenant";
        else resp = "tenant";
      }

      return {
        ...b,
        category,
        responsibility: resp,
        property: prop,
        propTitle: b.propertyName || prop.name || b.propertyId,
      };
    })
    .filter(
      (b) =>
        user.role !== "landlord" ||
        b.property?.landlordId === user.entityId ||
        b.property?.landlordId === "LDL001" ||
        b.property?.landlordId === "LDL002"
    );

  const rows = categoryTab === "all" ? allRows : allRows.filter((r) => r.category === categoryTab);

  const pendingAmount = rows.filter((r) => r.status === "Pending").reduce((s, r) => s + (r.amount || 0), 0);
  const paidAmount = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + (r.amount || 0), 0);

  const columns = [
    {
      key: "id",
      label: t("billId") || "Bill ID",
      render: (r) => <span style={{ fontWeight: 700, color: "var(--brand-blue)" }}>{r.id}</span>,
    },
    {
      key: "property",
      label: t("property"),
      render: (r) => (
        <div>
          <strong>{r.propTitle}</strong>
          {r.consumerNo && <div className="sub-text">Ref / Consumer: {r.consumerNo}</div>}
        </div>
      ),
    },
    {
      key: "type",
      label: t("billType") || "Utility & Tax Domain",
      render: (r) => (
        <div>
          <span className="city-tag">{r.type}</span>
          <div style={{ marginTop: "3px" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                background:
                  r.responsibility === "landlord"
                    ? "#eff6ff"
                    : r.responsibility === "shared"
                    ? "#f3e8ff"
                    : "#f0fdf4",
                color:
                  r.responsibility === "landlord"
                    ? "#1d4ed8"
                    : r.responsibility === "shared"
                    ? "#7e22ce"
                    : "#15803d",
              }}
            >
              {r.responsibility === "landlord"
                ? "🏠 Landlord Liability"
                : r.responsibility === "shared"
                ? "🤝 Shared Society Due"
                : "👤 Tenant Consumption"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      label: t("amount"),
      render: (r) => <strong>₹{(r.amount || 0).toLocaleString("en-IN")}</strong>,
    },
    { key: "dueDate", label: t("dueDate") || "Due Date" },
    {
      key: "status",
      label: t("status"),
      render: (r) => {
        const cls = r.status === "Paid" ? "active" : r.status === "Overdue" ? "overdue" : "pending";
        return <span className={`pill ${cls}`}>{r.status}</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: "6px" }}>
          {r.status !== "Paid" && (
            <button
              className="btn-primary"
              style={{ padding: "4px 8px", fontSize: "11px" }}
              onClick={() => handleQuickPay(r)}
              title="Mark as Paid"
            >
              ✓ Pay
            </button>
          )}
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px" }}
            onClick={() => openEdit(r)}
            title="Edit Bill"
          >
            ✏️
          </button>
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px", color: "var(--danger)" }}
            onClick={() => setDeletingBill(r)}
            title="Delete Bill"
          >
            🗑️
          </button>
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
        badge="Utilities &amp; Statutory Bills"
        title={t("utilityBillsTable") || "Utility Bills &amp; EB Tracking"}
        subtitle="Tamil Nadu Electricity Board (TANGEDCO), CMWSSB Water Supply, Piped Gas, and building maintenance bills"
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
              + Record Utility Bill
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const target = user?.role === "tenant" ? "/tenant/eb-bills" : "/landlord/eb-bills";
                window.location.href = target;
              }}
            >
              ⚡ EB Bills Dashboard
            </button>
          </div>
        }
      />

      {/* Statutory Responsibility Guidelines */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          marginBottom: "16px",
          background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "16px" }}>⚖️</span>
          <strong style={{ fontSize: "13px", color: "#1e3a8a" }}>
            Tamil Nadu Tenancy Statutory Utility &amp; Tax Allocation (TNRRRLTA)
          </strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", fontSize: "12px", color: "#334155" }}>
          <div>
            <strong>💧 Water Charges (CMWSSB / Tanker):</strong> Domestic water consumption is billed to the <em>Tenant</em>. Structural connections &amp; meter installations are the <em>Landlord&apos;s</em> responsibility.
          </div>
          <div>
            <strong>🏛️ Housing &amp; Property Tax (Corporation Assessment):</strong> Statutory property taxes to Greater Chennai Corporation or Municipal Corporation are the sole legal liability of the <em>Landlord</em>.
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { id: "all", label: "All Utilities & Taxes", icon: "📑", count: allRows.length },
          { id: "water", label: "Water Charges (CMWSSB / Tanker)", icon: "💧", count: allRows.filter((r) => r.category === "water").length },
          { id: "housing", label: "Housing & Property Tax", icon: "🏛️", count: allRows.filter((r) => r.category === "housing").length },
          { id: "electricity", label: "Electricity (TNEB)", icon: "⚡", count: allRows.filter((r) => r.category === "electricity").length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategoryTab(tab.id)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "1px solid",
              borderColor: categoryTab === tab.id ? "var(--color-primary, #2563eb)" : "var(--border-subtle, #cbd5e1)",
              background: categoryTab === tab.id ? "var(--color-primary, #2563eb)" : "#ffffff",
              color: categoryTab === tab.id ? "#ffffff" : "var(--ink-secondary, #334155)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              style={{
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "9999px",
                background: categoryTab === tab.id ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                color: categoryTab === tab.id ? "#ffffff" : "#64748b",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* KPI Banner */}
      <div className="tn-properties-banner" style={{ marginBottom: "20px" }}>
        <div className="banner-stat">
          <span className="stat-num">{rows.length}</span>
          <span className="stat-label">Total Bills</span>
        </div>
        <div className="banner-stat">
          <span className="stat-num" style={{ color: "var(--amber)" }}>
            ₹{(pendingAmount / 1000).toFixed(1)}k
          </span>
          <span className="stat-label">Pending Dues</span>
        </div>
        <div className="banner-stat">
          <span className="stat-num" style={{ color: "var(--green)" }}>
            ₹{(paidAmount / 1000).toFixed(1)}k
          </span>
          <span className="stat-label">Settled Bills</span>
        </div>
      </div>

      <DataTable
        title={t("utilityBillsTable") || "Utility Bills"}
        columns={columns}
        rows={rows}
        addLabel={t("addBill") || "+ Record Utility Bill"}
        onAdd={() => {
          setFormData(initialForm);
          setFormErrors({});
          setIsAddOpen(true);
        }}
        searchKeys={["id", "type", "propTitle", "consumerNo"]}
        searchPlaceholder="Search utility bills by type, consumer #, or apartment…"
        pageSize={10}
      />

      {/* Add Utility Bill Modal */}
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
            style={{ width: "100%", maxWidth: "520px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Record Utility Bill</h3>
                <span className="sub-text">Add TANGEDCO EB, CMWSSB Water, or Gas invoice</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsAddOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                  Property Unit *
                </label>
                <select
                  className="form-control"
                  value={formData.propertyId}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                >
                  <option value="">-- Choose Property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {formErrors.propertyId && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.propertyId}</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Utility Type
                  </label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="Electricity (TANGEDCO)">Electricity (TANGEDCO)</option>
                    <option value="Water & Sewerage (CMWSSB)">Water &amp; Sewerage (CMWSSB)</option>
                    <option value="Piped Gas">Piped Gas (IGL)</option>
                    <option value="High-Speed Internet">Internet / Broadband</option>
                    <option value="Estate Maintenance">Building Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Consumer / EB Meter #
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.consumerNo}
                    onChange={(e) => setFormData({ ...formData, consumerNo: e.target.value })}
                    placeholder="e.g. 01-140-023-88"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="2400"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  {formErrors.amount && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.amount}</div>}
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Due Date *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  {formErrors.dueDate && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>{formErrors.dueDate}</div>}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                  Bill Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                >
                  <option value="Pending">Pending Payment</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editingBill && (
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
          onClick={() => setEditingBill(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "520px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Edit Bill — {editingBill.id}</h3>
                <span className="sub-text">Modify amount, due date, or settlement status</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingBill(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>

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
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Consumer #
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.consumerNo}
                    onChange={(e) => setFormData({ ...formData, consumerNo: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setEditingBill(null)}>
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

      {/* Delete Bill Modal */}
      {deletingBill && (
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
          onClick={() => setDeletingBill(null)}
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
                <h3 style={{ margin: 0, fontSize: "17px" }}>Delete Utility Bill?</h3>
                <span className="sub-text">Bill ID: {deletingBill.id}</span>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Are you sure you want to remove the {deletingBill.type} bill of ₹{(deletingBill.amount || 0).toLocaleString("en-IN")} for{" "}
              <strong>{deletingBill.propTitle}</strong>?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setDeletingBill(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={handleDelete}
              >
                Delete Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
