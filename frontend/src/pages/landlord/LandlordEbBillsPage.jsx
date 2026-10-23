import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchUtilityBills,
  fetchUtilityBillSummary,
  createUtilityBill,
  deleteUtilityBill,
  sendUtilityBillReminder,
  triggerAutomaticReminders,
  fetchProperties,
  fetchTenants,
  fetchLeases,
} from "../../utils/apiClient.js";

export default function LandlordEbBillsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    totalBills: 0,
    paidBills: 0,
    unpaidBills: 0,
    overdueBills: 0,
    totalCollected: 0,
    totalPending: 0,
  });
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProperty, setSelectedProperty] = useState("All");
  const [selectedTenant, setSelectedTenant] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all", "overdue", "unpaid", "paid"

  // Modals & UI states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingDocBill, setViewingDocBill] = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [isCheckingReminders, setIsCheckingReminders] = useState(false);
  const [toast, setToast] = useState(null);

  const landlordId = user?.entityId || user?.entity_id || (user?.email === "karthik.raja@mail.com" ? "LDL001" : null);

  // Create EB Bill Form State
  const initialForm = {
    propertyId: "",
    tenantId: "",
    billingMonth: "October 2026",
    previousReading: "",
    currentReading: "",
    unitsConsumed: "",
    amount: 2450,
    billDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    consumerNo: "01-102-004-3291",
    billReference: `TNEB-${Date.now().toString().slice(-5)}`,
    responsibility: "Tenant",
    tenantAmount: 2450,
    landlordAmount: 0,
    documentUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    notes: "TANGEDCO Domestic Tariff",
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [billsData, summaryData, propsData, tenantsData, leasesData] = await Promise.all([
        fetchUtilityBills({
          landlordId: landlordId || undefined,
          type: "Electricity",
        }),
        fetchUtilityBillSummary({
          landlordId: landlordId || undefined,
          type: "Electricity",
        }),
        fetchProperties(),
        fetchTenants(),
        fetchLeases(),
      ]);

      if (Array.isArray(billsData)) setBills(billsData);
      if (summaryData) setSummary(summaryData);
      if (Array.isArray(propsData)) {
        // Filter landlord's properties if landlord role
        const filteredProps = user?.role === "landlord" && landlordId
          ? propsData.filter((p) => p.landlordId === landlordId || p.landlord_id === landlordId)
          : propsData;
        setProperties(filteredProps);
      }
      if (Array.isArray(tenantsData)) setTenants(tenantsData);
      if (Array.isArray(leasesData)) setLeases(leasesData);
    } catch (err) {
      console.warn("Error loading landlord EB data:", err);
      showToast("Failed to load EB bills", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [landlordId]);

  // Handle Property selection in Create Form to auto-fill Tenant and Consumer No
  const handlePropertyChange = (propId) => {
    const prop = properties.find((p) => p.id === propId || p._id === propId);
    const activeLease = leases.find(
      (l) => (l.propertyId === propId || l.property_id === propId) && l.status === "Active"
    );

    let assignedTenantId = "";
    if (activeLease) {
      assignedTenantId = activeLease.tenantId || activeLease.tenant_id;
    } else if (prop && (prop.tenantId || prop.tenant_id)) {
      assignedTenantId = prop.tenantId || prop.tenant_id;
    }

    const defaultConsumerNo = prop?.ebConsumerNo || `01-102-004-${Math.floor(1000 + Math.random() * 9000)}`;

    setFormData((prev) => ({
      ...prev,
      propertyId: propId,
      tenantId: assignedTenantId || prev.tenantId,
      consumerNo: defaultConsumerNo,
    }));
  };

  // Auto calculate units if readings change
  const handleReadingChange = (field, val) => {
    const updated = { ...formData, [field]: val };
    const prev = Number(field === "previousReading" ? val : updated.previousReading);
    const curr = Number(field === "currentReading" ? val : updated.currentReading);

    if (curr > 0 && prev >= 0 && curr >= prev) {
      updated.unitsConsumed = curr - prev;
    }
    setFormData(updated);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.propertyId) errors.propertyId = "Property selection is required";
    if (!formData.amount || Number(formData.amount) <= 0) errors.amount = "Enter a valid bill amount";
    if (!formData.dueDate) errors.dueDate = "Payment due date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create EB Bill Submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        previousReading: formData.previousReading ? Number(formData.previousReading) : null,
        currentReading: formData.currentReading ? Number(formData.currentReading) : null,
        unitsConsumed: formData.unitsConsumed ? Number(formData.unitsConsumed) : null,
        tenantAmount:
          formData.responsibility === "Landlord"
            ? 0
            : formData.responsibility === "Shared"
            ? Number(formData.tenantAmount || Math.round(Number(formData.amount) / 2))
            : Number(formData.amount),
        landlordAmount:
          formData.responsibility === "Tenant"
            ? 0
            : formData.responsibility === "Shared"
            ? Number(formData.amount) - Number(formData.tenantAmount || Math.round(Number(formData.amount) / 2))
            : Number(formData.amount),
        type: "Electricity",
      };

      const res = await createUtilityBill(payload);
      showToast(`⚡ EB Bill ${res.id} issued successfully!`);
      setIsCreateOpen(false);
      setFormData(initialForm);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to create EB bill", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Manual Reminder
  const handleSendReminder = async (billId, tenantName) => {
    setSendingReminderId(billId);
    try {
      await sendUtilityBillReminder(billId);
      showToast(`🔔 Reminder notification sent to ${tenantName || "tenant"} successfully!`);
      // Update local bill state
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                lastReminderDate: new Date().toISOString().split("T")[0],
                reminderCount: (b.reminderCount || 0) + 1,
              }
            : b
        )
      );
    } catch (err) {
      showToast(err.message || "Could not send reminder", "error");
    } finally {
      setSendingReminderId(null);
    }
  };

  // Trigger Automatic Due Reminder Scan
  const handleTriggerAutomatedReminders = async () => {
    setIsCheckingReminders(true);
    try {
      const res = await triggerAutomaticReminders();
      if (res && res.success) {
        showToast(
          `🤖 Reminder check complete: ${res.remindersDispatched || 0} notices dispatched, ${res.overdueMarked || 0} bills marked Overdue.`
        );
        loadData();
      } else {
        showToast(res.error || "Automated check completed.", "info");
      }
    } catch (err) {
      showToast(err.message || "Failed to trigger reminder check", "error");
    } finally {
      setIsCheckingReminders(false);
    }
  };

  // Delete Bill
  const handleDeleteBill = async (billId) => {
    if (!window.confirm(`Are you sure you want to delete electricity bill ${billId}?`)) return;
    try {
      await deleteUtilityBill(billId);
      setBills((prev) => prev.filter((b) => b.id !== billId));
      showToast(`Bill ${billId} removed successfully`);
    } catch (err) {
      showToast(err.message || "Failed to delete bill", "error");
    }
  };

  // Filtering Logic
  const filteredBills = bills.filter((b) => {
    // Tab filter
    if (activeTab === "overdue" && b.status !== "Overdue") return false;
    if (activeTab === "unpaid" && b.status === "Paid") return false;
    if (activeTab === "paid" && b.status !== "Paid") return false;

    // Dropdown filters
    if (selectedProperty !== "All" && b.propertyId !== selectedProperty && b.property_id !== selectedProperty) {
      return false;
    }
    if (selectedTenant !== "All" && b.tenantId !== selectedTenant && b.tenant_id !== selectedTenant) {
      return false;
    }
    if (selectedMonth !== "All" && b.billingMonth !== selectedMonth && b.billing_month !== selectedMonth) {
      return false;
    }
    if (selectedStatus !== "All" && b.status.toLowerCase() !== selectedStatus.toLowerCase()) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.propertyName && b.propertyName.toLowerCase().includes(q)) ||
        (b.tenantName && b.tenantName.toLowerCase().includes(q)) ||
        (b.consumerNo && b.consumerNo.toLowerCase().includes(q)) ||
        (b.transactionId && b.transactionId.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "Paid":
        return <span className="badge badge-success">Paid</span>;
      case "Overdue":
        return <span className="badge badge-danger">Overdue</span>;
      case "Due Soon":
        return <span className="badge badge-warning">Due Soon</span>;
      case "Payment Pending":
        return <span className="badge badge-info">Payment Pending</span>;
      default:
        return <span className="badge badge-neutral">Unpaid</span>;
    }
  };

  return (
    <div className="landlord-eb-bills-page">
      <PageHero
        badge="Asset Operations &amp; Utilities"
        title="⚡ EB Bill Management &amp; Expense Tracking"
        subtitle="Generate monthly electricity bills for rental units, monitor meter consumption, send automated due reminders, and track tenant payments"
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
              + Create EB Bill
            </button>
            <button
              className="btn-outline"
              onClick={handleTriggerAutomatedReminders}
              disabled={isCheckingReminders}
              title="Runs the scheduled reminder job to dispatch 3-day, due-date, and overdue alerts"
            >
              {isCheckingReminders ? "Checking…" : "🤖 Check & Send Due Reminders"}
            </button>
            <button className="btn-outline" onClick={loadData}>
              🔄 Refresh
            </button>
          </div>
        }
      />

      {toast && (
        <div
          className={`toast animate-fade-in ${toast.type === "error" ? "toast-error" : "toast-success"}`}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            padding: "14px 22px",
            borderRadius: "8px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total EB Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⚡</span>
          </div>
          <div className="stat-value">{summary.totalBills || bills.length}</div>
          <div className="stat-footer neutral">Issued across portfolio</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Paid Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>✅</span>
          </div>
          <div className="stat-value" style={{ color: "#10b981" }}>
            {summary.paidBills || bills.filter((b) => b.status === "Paid").length}
          </div>
          <div className="stat-footer positive">Settled online or verified</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Unpaid Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⏳</span>
          </div>
          <div className="stat-value" style={{ color: "#ea580c" }}>
            {summary.unpaidBills || bills.filter((b) => b.status !== "Paid").length}
          </div>
          <div className="stat-footer neutral">Pending settlement</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Overdue Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⚠️</span>
          </div>
          <div className="stat-value" style={{ color: "#ef4444" }}>
            {summary.overdueBills || bills.filter((b) => b.status === "Overdue").length}
          </div>
          <div className="stat-footer" style={{ color: "#ef4444" }}>
            Action required
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Amount Collected</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>💰</span>
          </div>
          <div className="stat-value" style={{ color: "#10b981" }}>
            ₹{(summary.totalCollected || 0).toLocaleString("en-IN")}
          </div>
          <div className="stat-footer positive">Revenue remitted</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Amount Pending</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>📈</span>
          </div>
          <div className="stat-value" style={{ color: "#ea580c" }}>
            ₹{(summary.totalPending || 0).toLocaleString("en-IN")}
          </div>
          <div className="stat-footer neutral">Awaiting collection</div>
        </div>
      </div>

      {/* Overdue Alert Banner if any overdue bills exist */}
      {(summary.overdueBills > 0 || bills.some((b) => b.status === "Overdue")) && (
        <div
          className="card animate-fade-in"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <div>
              <strong style={{ color: "#991b1b", fontSize: "15px" }}>
                Overdue Electricity Bills Detected
              </strong>
              <div style={{ color: "#b91c1c", fontSize: "13px" }}>
                {bills.filter((b) => b.status === "Overdue").length} tenant bills have passed their payment due date without completion. You can review non-paying tenants and send targeted reminder notifications.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-outline"
            onClick={() => setActiveTab("overdue")}
            style={{
              borderColor: "#ef4444",
              color: "#b91c1c",
              background: "#ffffff",
              fontSize: "13px",
              padding: "7px 16px",
            }}
          >
            Show Overdue Records Only →
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          borderRadius: "12px",
          marginBottom: "20px",
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--card-bg)",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
            Search Bill / Tenant / Meter
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill ID, Consumer No, Tenant…"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ flex: "1 1 150px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
            Property Unit
          </label>
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          >
            <option value="All">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 140px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
            Billing Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          >
            <option value="All">All Months</option>
            <option value="October 2026">October 2026</option>
            <option value="September 2026">September 2026</option>
            <option value="August 2026">August 2026</option>
            <option value="July 2026">July 2026</option>
          </select>
        </div>

        <div style={{ flex: "1 1 130px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
            Payment Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Overdue">Overdue</option>
            <option value="Due Soon">Due Soon</option>
          </select>
        </div>

        {(selectedProperty !== "All" || selectedMonth !== "All" || selectedStatus !== "All" || searchQuery) && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSelectedProperty("All");
              setSelectedMonth("All");
              setSelectedStatus("All");
              setSearchQuery("");
            }}
            style={{ alignSelf: "flex-end", padding: "8px 14px", fontSize: "12px" }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "20px",
        }}
      >
        <button
          className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "all" ? "2px solid var(--brand-blue)" : "2px solid transparent",
            color: activeTab === "all" ? "var(--brand-blue)" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          All Bills ({bills.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "overdue" ? "active" : ""}`}
          onClick={() => setActiveTab("overdue")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "overdue" ? "2px solid #ef4444" : "2px solid transparent",
            color: activeTab === "overdue" ? "#ef4444" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⚠️ Overdue Bills ({bills.filter((b) => b.status === "Overdue").length})
        </button>

        <button
          className={`tab-btn ${activeTab === "unpaid" ? "active" : ""}`}
          onClick={() => setActiveTab("unpaid")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "unpaid" ? "2px solid #ea580c" : "2px solid transparent",
            color: activeTab === "unpaid" ? "#ea580c" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Unpaid ({bills.filter((b) => b.status !== "Paid").length})
        </button>

        <button
          className={`tab-btn ${activeTab === "paid" ? "active" : ""}`}
          onClick={() => setActiveTab("paid")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "paid" ? "2px solid #10b981" : "2px solid transparent",
            color: activeTab === "paid" ? "#10b981" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Paid ({bills.filter((b) => b.status === "Paid").length})
        </button>
      </div>

      {/* Main Table View */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="spinner" />
          <p style={{ marginTop: "16px", color: "var(--text-muted)" }}>
            Loading landlord electricity bills…
          </p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "60px 20px",
            borderRadius: "12px",
            background: "var(--card-bg)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "14px" }}>📋</div>
          <h3 style={{ margin: "0 0 8px 0" }}>No electricity bills match criteria</h3>
          <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 18px auto" }}>
            Click &quot;+ Create EB Bill&quot; to issue a new electricity bill for one of your rental units.
          </p>
          <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
            + Create EB Bill
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)", textAlign: "left" }}>
                  <th style={{ padding: "14px 16px" }}>Bill Ref &amp; Month</th>
                  <th style={{ padding: "14px 16px" }}>Property Unit</th>
                  <th style={{ padding: "14px 16px" }}>Tenant</th>
                  <th style={{ padding: "14px 16px" }}>Meter Readings</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Due Date</th>
                  <th style={{ padding: "14px 16px" }}>Responsibility</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => {
                  const isPaid = bill.status === "Paid";
                  const isOverdue = bill.status === "Overdue";

                  return (
                    <tr
                      key={bill.id}
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        background: isOverdue ? "rgba(239, 68, 68, 0.03)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--brand-blue)" }}>{bill.id}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{bill.billingMonth}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{bill.consumerNo}</div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{bill.propertyName}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>ID: {bill.propertyId}</div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{bill.tenantName || "Unassigned"}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{bill.tenantId || "—"}</div>
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "12.5px" }}>
                        <div>{bill.previousReading || 0} → {bill.currentReading || "—"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                          {bill.unitsConsumed ? `${bill.unitsConsumed} units` : "Manual Entry"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 800, fontSize: "15px", color: isPaid ? "#10b981" : isOverdue ? "#ef4444" : "var(--text-primary)" }}>
                          ₹{Number(bill.amount).toLocaleString("en-IN")}
                        </div>
                        {bill.responsibility === "Shared" && (
                          <div style={{ fontSize: "11px", color: "#6d28d9" }}>
                            Tenant: ₹{bill.tenantAmount} | LDL: ₹{bill.landlordAmount}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "13px" }}>
                        <div>{bill.dueDate}</div>
                        {isPaid && bill.paidDate && (
                          <div style={{ fontSize: "11.5px", color: "#10b981" }}>
                            Paid: {bill.paidDate}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              bill.responsibility === "Tenant"
                                ? "#e0f2fe"
                                : bill.responsibility === "Landlord"
                                ? "#fef3c7"
                                : "#ede9fe",
                            color:
                              bill.responsibility === "Tenant"
                                ? "#0369a1"
                                : bill.responsibility === "Landlord"
                                ? "#b45309"
                                : "#6d28d9",
                          }}
                        >
                          {bill.responsibility}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {getStatusBadge(bill.status)}
                        {bill.lastReminderDate && !isPaid && (
                          <div style={{ fontSize: "11px", color: "#ea580c", marginTop: "3px" }}>
                            Reminder #{bill.reminderCount} on {bill.lastReminderDate}
                          </div>
                        )}
                        {isPaid && bill.transactionId && (
                          <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                            Ref: {bill.transactionId}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {/* Send Reminder button */}
                          {!isPaid && bill.tenantId && (
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={() => handleSendReminder(bill.id, bill.tenantName)}
                              disabled={sendingReminderId === bill.id}
                              style={{
                                fontSize: "12px",
                                padding: "5px 10px",
                                borderColor: isOverdue ? "#ef4444" : "#f59e0b",
                                color: isOverdue ? "#b91c1c" : "#b45309",
                              }}
                              title="Send instant due date reminder to tenant"
                            >
                              {sendingReminderId === bill.id ? "Sending…" : "🔔 Remind"}
                            </button>
                          )}

                          {bill.documentUrl && (
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={() => setViewingDocBill(bill)}
                              style={{ fontSize: "12px", padding: "5px 10px" }}
                              title="View Document"
                            >
                              📄 Doc
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => handleDeleteBill(bill.id)}
                            style={{ fontSize: "12px", padding: "5px 10px", color: "#ef4444", borderColor: "#fecaca" }}
                            title="Delete Bill"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create EB Bill Modal */}
      {isCreateOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setIsCreateOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="modal-box animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "620px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                padding: "18px 24px",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>
                  ⚡ Create New Electricity (EB) Bill
                </h3>
                <div style={{ fontSize: "12.5px", opacity: 0.9 }}>
                  Enter electricity charges and meter readings for your rental property
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={{ background: "none", border: "none", color: "#ffffff", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: "24px" }}>
              {/* Row 1: Property & Tenant */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Rental Property *
                  </label>
                  <select
                    value={formData.propertyId}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: formErrors.propertyId ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Select Property Unit</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit || p.building || p.city})
                      </option>
                    ))}
                  </select>
                  {formErrors.propertyId && (
                    <span style={{ fontSize: "11px", color: "#ef4444" }}>{formErrors.propertyId}</span>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Assigned Tenant
                  </label>
                  <select
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Auto-detected from active lease</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Billing Month & Consumer Number */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Billing Month *
                  </label>
                  <input
                    type="text"
                    value={formData.billingMonth}
                    onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                    placeholder="e.g. October 2026"
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    TNEB Consumer / Service No
                  </label>
                  <input
                    type="text"
                    value={formData.consumerNo}
                    onChange={(e) => setFormData({ ...formData, consumerNo: e.target.value })}
                    placeholder="e.g. 01-102-004-3291"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Meter Readings (Optional) & Units */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "14px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0369a1", marginBottom: "8px", textTransform: "uppercase" }}>
                  Electricity Meter Readings (Optional)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", color: "#64748b", marginBottom: "3px" }}>
                      Previous Reading
                    </label>
                    <input
                      type="number"
                      value={formData.previousReading}
                      onChange={(e) => handleReadingChange("previousReading", e.target.value)}
                      placeholder="e.g. 1450"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", color: "#64748b", marginBottom: "3px" }}>
                      Current Reading
                    </label>
                    <input
                      type="number"
                      value={formData.currentReading}
                      onChange={(e) => handleReadingChange("currentReading", e.target.value)}
                      placeholder="e.g. 1780"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", color: "#64748b", marginBottom: "3px" }}>
                      Units Consumed
                    </label>
                    <input
                      type="number"
                      value={formData.unitsConsumed}
                      onChange={(e) => setFormData({ ...formData, unitsConsumed: e.target.value })}
                      placeholder="e.g. 330"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                  💡 Supports manual bill amount even without meter readings (for properties without smart meters).
                </div>
              </div>

              {/* Row 4: Bill Amount & Due Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    EB Bill Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 2450"
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: formErrors.amount ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: 700,
                      boxSizing: "border-box",
                    }}
                  />
                  {formErrors.amount && <span style={{ fontSize: "11px", color: "#ef4444" }}>{formErrors.amount}</span>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Payment Due Date *
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: formErrors.dueDate ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  {formErrors.dueDate && <span style={{ fontSize: "11px", color: "#ef4444" }}>{formErrors.dueDate}</span>}
                </div>
              </div>

              {/* Row 5: Payment Responsibility Rule */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                  Payment Responsibility Rule
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {["Tenant", "Landlord", "Shared"].map((resp) => (
                    <label
                      key={resp}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: formData.responsibility === resp ? "2px solid #0284c7" : "1px solid #cbd5e1",
                        background: formData.responsibility === resp ? "#f0f9ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="radio"
                        name="responsibility"
                        value={resp}
                        checked={formData.responsibility === resp}
                        onChange={(e) => setFormData({ ...formData, responsibility: e.target.value })}
                      />
                      <span>{resp}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "5px" }}>
                  {formData.responsibility === "Tenant" && "• The bill will appear on the tenant's portal for direct online payment."}
                  {formData.responsibility === "Landlord" && "• The bill will remain in landlord accounts and won't be charged to the tenant."}
                  {formData.responsibility === "Shared" && "• The bill will display the split amount for tenant and landlord."}
                </div>
              </div>

              {/* If Shared, show split inputs */}
              {formData.responsibility === "Shared" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    background: "#f5f3ff",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d28d9" }}>
                      Tenant Payable Share (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.tenantAmount}
                      onChange={(e) => setFormData({ ...formData, tenantAmount: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ddd6fe",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d28d9" }}>
                      Landlord Share (₹)
                    </label>
                    <input
                      type="number"
                      value={Number(formData.amount || 0) - Number(formData.tenantAmount || 0)}
                      readOnly
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ddd6fe",
                        background: "#ffffff",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Row 6: Document Attachment URL */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                  Bill Document / Meter Photo URL (Optional)
                </label>
                <input
                  type="text"
                  value={formData.documentUrl}
                  onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                  placeholder="https://... image or pdf url"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner" style={{ width: "16px", height: "16px" }} />
                      <span>Issuing Bill…</span>
                    </>
                  ) : (
                    <span>Issue Electricity Bill</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {viewingDocBill && (
        <div
          className="modal-backdrop"
          onClick={() => setViewingDocBill(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="modal-box animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "17px" }}>
                Bill Document: {viewingDocBill.id} ({viewingDocBill.propertyName})
              </h3>
              <button
                type="button"
                onClick={() => setViewingDocBill(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", textAlign: "center" }}>
              <img
                src={viewingDocBill.documentUrl}
                alt="EB Bill"
                style={{
                  maxWidth: "100%",
                  maxHeight: "380px",
                  borderRadius: "8px",
                  objectFit: "contain",
                  border: "1px solid #e2e8f0",
                }}
              />
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
                Consumer: {viewingDocBill.consumerNo} • Reference: {viewingDocBill.billReference}
              </div>
            </div>

            <div
              style={{
                padding: "14px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="btn-outline" onClick={() => setViewingDocBill(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
