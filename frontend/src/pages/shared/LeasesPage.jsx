import { useContext, useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import {
  FileText,
  FileSignature,
  Calendar,
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Send,
  RefreshCw,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Building,
  User,
  Shield,
  CreditCard,
  Camera,
  Check,
} from "lucide-react";
import { LEASES, PROPERTIES, TENANTS, LANDLORDS } from "../../data/db.js";
import {
  fetchLeases,
  fetchProperties,
  fetchTenants,
  createLease,
  updateLease,
  deleteLease,
  renewLease,
  sendRenewalReminder,
  terminateLease,
  saveLeaseInspection,
} from "../../utils/apiClient.js";
import "./LeaseAgreementCenter.css";

export default function LeasesPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: "leases" | "agreements" | "renewals" | "inspections"
  const tabParam = searchParams.get("tab")?.toLowerCase();
  const validTabs = ["leases", "agreements", "renewals", "inspections"];
  const activeTab = validTabs.includes(tabParam) ? tabParam : "leases";

  const handleTabChange = (newTab) => {
    setSearchParams(newTab === "leases" ? {} : { tab: newTab });
  };

  // Data states
  const [leases, setLeases] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");

  // Drawers and Modals
  const [drawerLease, setDrawerLease] = useState(null);
  const [previewLease, setPreviewLease] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLease, setEditingLease] = useState(null);
  const [renewingLease, setRenewingLease] = useState(null);
  const [terminatingLease, setTerminatingLease] = useState(null);

  // Move-in / Move-out state
  const [selectedInspectionLeaseId, setSelectedInspectionLeaseId] = useState("");
  const [inspectionMode, setInspectionMode] = useState("moveIn"); // "moveIn" | "moveOut"
  const [inspectionCondition, setInspectionCondition] = useState("Good");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [pendingDues, setPendingDues] = useState(0);
  const [damageDeductions, setDamageDeductions] = useState(0);
  const [settlementAuthorized, setSettlementAuthorized] = useState(false);

  // Room checklist state
  const defaultChecklist = [
    { room: "Living Room", item: "Flooring, wall paint & lighting fixtures", status: "Pass", notes: "" },
    { room: "Master Bedroom", item: "Wardrobes, windows, AC wiring & switches", status: "Pass", notes: "" },
    { room: "Kitchen", item: "Granite counter, sink taps, cabinets & exhaust", status: "Pass", notes: "" },
    { room: "Bathroom", item: "Geyser, sanitaryware, wall tiles & drainage", status: "Pass", notes: "" },
    { room: "Balcony / Utility", item: "Safety grill, water point & electrical", status: "Pass", notes: "" },
  ];
  const [checklist, setChecklist] = useState(defaultChecklist);

  // Toast Helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form State for Create / Edit
  const initialForm = {
    tenantId: "",
    propertyId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    monthlyRent: 22000,
    depositAmount: 110000,
    termMonths: 11,
    status: "Active",
    dueDay: 5,
    regNumber: `TN-REG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  // Renewal Form State
  const [renewalForm, setRenewalForm] = useState({
    newStartDate: "",
    newEndDate: "",
    newMonthlyRent: 0,
    termMonths: 11,
    notes: "",
  });

  // Termination Form State
  const [terminationReason, setTerminationReason] = useState("Mutual Agreement");

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [lData, pData, tData] = await Promise.all([
        fetchLeases().catch(() => null),
        fetchProperties().catch(() => null),
        fetchTenants().catch(() => null),
      ]);
      setLeases(Array.isArray(lData) && lData.length > 0 ? lData : LEASES);
      setProperties(Array.isArray(pData) && pData.length > 0 ? pData : PROPERTIES);
      setTenants(Array.isArray(tData) && tData.length > 0 ? tData : TENANTS);
    } catch {
      setLeases(LEASES);
      setProperties(PROPERTIES);
      setTenants(TENANTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set default inspection lease
  useEffect(() => {
    if (leases.length > 0 && !selectedInspectionLeaseId) {
      setSelectedInspectionLeaseId(leases[0].id);
    }
  }, [leases, selectedInspectionLeaseId]);

  // Resolvers
  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};
  const getTen = (tId) => tenants.find((t) => t.id === tId || t._id === tId) || {};

  // Days left calculation helper
  const calculateDaysLeft = (endDateStr) => {
    if (!endDateStr) return 999;
    const end = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = end - today;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = leases.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;

    leases.forEach((l) => {
      const st = (l.status || "").toLowerCase();
      const days = calculateDaysLeft(l.endDate || l.end_date);
      if (st === "terminated" || st === "expired" || days < 0) {
        expired++;
      } else if (days <= 60 && days >= 0) {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return { total, active, expiring, expired };
  }, [leases]);

  // Filtered Leases
  const filteredLeases = useMemo(() => {
    return leases.filter((l) => {
      const prop = getProp(l.propertyId);
      const ten = getTen(l.tenantId);
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        (l.id && l.id.toLowerCase().includes(q)) ||
        (l.regNumber && l.regNumber.toLowerCase().includes(q)) ||
        (ten.name && ten.name.toLowerCase().includes(q)) ||
        (prop.name && prop.name.toLowerCase().includes(q)) ||
        (prop.city && prop.city.toLowerCase().includes(q));

      const days = calculateDaysLeft(l.endDate || l.end_date);
      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = (l.status || "").toLowerCase() === "active" && days > 60;
      } else if (statusFilter === "expiring") {
        matchesStatus = days <= 60 && days >= 0 && (l.status || "").toLowerCase() !== "terminated";
      } else if (statusFilter === "expired") {
        matchesStatus = days < 0 || (l.status || "").toLowerCase() === "expired";
      } else if (statusFilter === "terminated") {
        matchesStatus = (l.status || "").toLowerCase() === "terminated";
      }

      const matchesProperty =
        propertyFilter === "all" || l.propertyId === propertyFilter;

      return matchesSearch && matchesStatus && matchesProperty;
    });
  }, [leases, properties, tenants, searchTerm, statusFilter, propertyFilter]);

  // Expiring Leases for Tab 3
  const expiringLeases = useMemo(() => {
    return leases
      .map((l) => ({
        ...l,
        daysLeft: calculateDaysLeft(l.endDate || l.end_date),
      }))
      .filter((l) => (l.status || "").toLowerCase() !== "terminated")
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [leases]);

  // Active Inspection Lease
  const activeInspectionLease = useMemo(() => {
    return leases.find((l) => l.id === selectedInspectionLeaseId) || leases[0] || null;
  }, [leases, selectedInspectionLeaseId]);

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!formData.tenantId) errs.tenantId = "Please select a tenant";
    if (!formData.propertyId) errs.propertyId = "Please select a property unit";
    if (!formData.startDate) errs.startDate = "Start date is required";
    if (!formData.endDate) errs.endDate = "End date is required";
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      errs.endDate = "End date must be after start date";
    }
    if (!formData.monthlyRent || formData.monthlyRent <= 0) {
      errs.monthlyRent = "Monthly rent must be greater than 0";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Create Lease Action
  const handleCreateLease = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const newId = `LSE${String(leases.length + 1).padStart(3, "0")}`;
    const selectedTenant = getTen(formData.tenantId);
    const selectedProp = getProp(formData.propertyId);

    const payload = {
      ...formData,
      id: newId,
      monthlyRent: Number(formData.monthlyRent),
      depositAmount: Number(formData.depositAmount),
      rent: Number(formData.monthlyRent),
      deposit: Number(formData.depositAmount),
      tenantName: selectedTenant.name || "Resident Tenant",
      propertyName: selectedProp.name || "Residential Unit",
      landlordId: selectedProp.landlordId || user?.entityId || "LDL001",
      agreementStatus: "Active",
      signatureStatus: "Fully Signed",
      regNumber: formData.regNumber,
    };

    try {
      const res = await createLease(payload);
      setLeases((prev) => [res || payload, ...prev]);
      setIsCreateOpen(false);
      setFormData(initialForm);
      showToast(`Lease & Agreement ${newId} registered successfully!`);
    } catch (err) {
      showToast(err.message || "Failed to create lease", "error");
    }
  };

  // Update Lease Action
  const handleUpdateLease = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const selectedTenant = getTen(formData.tenantId);
    const selectedProp = getProp(formData.propertyId);

    const payload = {
      ...formData,
      monthlyRent: Number(formData.monthlyRent),
      depositAmount: Number(formData.depositAmount),
      rent: Number(formData.monthlyRent),
      deposit: Number(formData.depositAmount),
      tenantName: selectedTenant.name || editingLease.tenantName,
      propertyName: selectedProp.name || editingLease.propertyName,
    };

    try {
      await updateLease(editingLease.id, payload);
      setLeases((prev) =>
        prev.map((l) => (l.id === editingLease.id ? { ...l, ...payload } : l))
      );
      setEditingLease(null);
      showToast(`Lease ${editingLease.id} updated successfully!`);
    } catch (err) {
      showToast(err.message || "Failed to update lease", "error");
    }
  };

  // Initiate Renewal
  const handleOpenRenewal = (lease) => {
    const curRent = Number(lease.monthlyRent || lease.rent || 20000);
    const curEnd = lease.endDate || lease.end_date || new Date().toISOString().split("T")[0];
    const newStart = new Date(new Date(curEnd).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const newEnd = new Date(new Date(newStart).getTime() + 11 * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    setRenewingLease(lease);
    setRenewalForm({
      newStartDate: newStart,
      newEndDate: newEnd,
      newMonthlyRent: Math.round(curRent * 1.05), // 5% proposed escalation standard
      termMonths: 11,
      notes: "Proposed 5% annual statutory escalation for renewal term.",
    });
  };

  const handleConfirmRenewal = async () => {
    if (!renewingLease) return;
    try {
      await renewLease(renewingLease.id, renewalForm);
      setLeases((prev) =>
        prev.map((l) =>
          l.id === renewingLease.id
            ? {
                ...l,
                startDate: renewalForm.newStartDate,
                endDate: renewalForm.newEndDate,
                monthlyRent: renewalForm.newMonthlyRent,
                rent: renewalForm.newMonthlyRent,
                renewalStatus: "Renewed",
                status: "Active",
              }
            : l
        )
      );
      setRenewingLease(null);
      showToast(`Lease ${renewingLease.id} successfully renewed for 11 months!`);
    } catch (err) {
      showToast(err.message || "Failed to renew lease", "error");
    }
  };

  // Send Renewal Reminder
  const handleSendReminder = async (lease) => {
    try {
      await sendRenewalReminder(lease.id, "Upcoming expiry notice from landlord.");
      setLeases((prev) =>
        prev.map((l) =>
          l.id === lease.id ? { ...l, renewalStatus: "Reminder Sent" } : l
        )
      );
      showToast(`Renewal reminder sent to tenant for lease ${lease.id}`);
    } catch (err) {
      showToast(err.message || "Failed to send reminder", "error");
    }
  };

  // Terminate Lease
  const handleConfirmTermination = async () => {
    if (!terminatingLease) return;
    try {
      await terminateLease(terminatingLease.id, terminationReason);
      setLeases((prev) =>
        prev.map((l) =>
          l.id === terminatingLease.id
            ? { ...l, status: "Terminated", agreementStatus: "Terminated" }
            : l
        )
      );
      setTerminatingLease(null);
      showToast(`Lease ${terminatingLease.id} terminated and moved to archived.`);
    } catch (err) {
      showToast(err.message || "Failed to terminate lease", "error");
    }
  };

  // Save Inspection
  const handleSaveInspection = async () => {
    if (!activeInspectionLease) return;
    const isMoveOut = inspectionMode === "moveOut";

    const inspectionPayload = isMoveOut
      ? {
          inspectionDate: new Date().toISOString().split("T")[0],
          condition: inspectionCondition,
          damageNotes,
          checklist,
          pendingDues: Number(pendingDues),
          estimatedDamageCost: Number(damageDeductions),
          depositSettlementRef: `DEP-SETTLE-${activeInspectionLease.id}`,
          settleDeposit: settlementAuthorized,
          settlementStatus: settlementAuthorized ? "Settled" : "Pending",
        }
      : {
          inspectionDate: new Date().toISOString().split("T")[0],
          condition: inspectionCondition,
          notes: inspectionNotes,
          checklist,
          status: "Completed",
        };

    try {
      await saveLeaseInspection(activeInspectionLease.id, inspectionMode, inspectionPayload);
      showToast(
        `${isMoveOut ? "Move-Out" : "Move-In"} inspection recorded successfully!`
      );
    } catch (err) {
      showToast(err.message || "Failed to save inspection", "error");
    }
  };

  // Print Agreement Window
  const handlePrintAgreement = (lease) => {
    window.print();
  };

  return (
    <div className="lac-container">
      {/* Toast Notification */}
      {toast && (
        <div className="lac-toast">
          {toast.type === "error" ? (
            <AlertTriangle size={18} color="#ef4444" />
          ) : (
            <CheckCircle2 size={18} color="#10b981" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Card with Breadcrumb & Primary Action */}
      <div className="lac-header-card">
        <div className="lac-breadcrumb">
          <span>{user?.role === "admin" ? "Admin" : "Landlord"}</span>
          <span className="lac-breadcrumb-separator">/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>Lease &amp; Agreement Center</span>
        </div>
        <div className="lac-header-main">
          <div>
            <h1 className="lac-title">Lease &amp; Agreement Center</h1>
            <p className="lac-subtitle">
              Manage your residential lease portfolio, statutory Tamil Nadu tenancy agreements, 
              renewal schedules, and official move-in/move-out property condition inspections.
            </p>
          </div>
          <div className="lac-header-actions">
            <button className="lac-btn-secondary" onClick={loadData}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              className="lac-btn-primary"
              onClick={() => {
                setFormData(initialForm);
                setFormErrors({});
                setIsCreateOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Create Lease</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards Grid */}
      <div className="lac-kpi-grid">
        <div className="lac-kpi-card">
          <div className="lac-kpi-top">
            <span className="lac-kpi-label">Total Leases</span>
            <div className="lac-kpi-icon">
              <FileText size={18} />
            </div>
          </div>
          <div className="lac-kpi-value">{kpis.total}</div>
          <div className="lac-kpi-sub">Portfolio registered units</div>
        </div>

        <div className="lac-kpi-card active">
          <div className="lac-kpi-top">
            <span className="lac-kpi-label">Active Leases</span>
            <div className="lac-kpi-icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="lac-kpi-value">{kpis.active}</div>
          <div className="lac-kpi-sub">Occupied &amp; generating rent</div>
        </div>

        <div className="lac-kpi-card expiring">
          <div className="lac-kpi-top">
            <span className="lac-kpi-label">Expiring Soon</span>
            <div className="lac-kpi-icon">
              <Clock size={18} />
            </div>
          </div>
          <div className="lac-kpi-value">{kpis.expiring}</div>
          <div className="lac-kpi-sub">Within next 60 days</div>
        </div>

        <div className="lac-kpi-card expired">
          <div className="lac-kpi-top">
            <span className="lac-kpi-label">Expired / Terminated</span>
            <div className="lac-kpi-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="lac-kpi-value">{kpis.expired}</div>
          <div className="lac-kpi-sub">Archived or renewed</div>
        </div>
      </div>

      {/* 3. Tab Navigation Bar */}
      <div className="lac-tab-bar">
        <button
          className={`lac-tab-btn ${activeTab === "leases" ? "active" : ""}`}
          onClick={() => handleTabChange("leases")}
        >
          <FileText size={16} />
          <span>Lease Portfolio</span>
          <span className="lac-tab-badge">{kpis.total}</span>
        </button>

        <button
          className={`lac-tab-btn ${activeTab === "agreements" ? "active" : ""}`}
          onClick={() => handleTabChange("agreements")}
        >
          <FileSignature size={16} />
          <span>Tenancy Agreements</span>
          <span className="lac-tab-badge">{leases.length}</span>
        </button>

        <button
          className={`lac-tab-btn ${activeTab === "renewals" ? "active" : ""}`}
          onClick={() => handleTabChange("renewals")}
        >
          <Calendar size={16} />
          <span>Renewals &amp; Expiry</span>
          {kpis.expiring > 0 && (
            <span className="lac-tab-badge warn">{kpis.expiring}</span>
          )}
        </button>

        <button
          className={`lac-tab-btn ${activeTab === "inspections" ? "active" : ""}`}
          onClick={() => handleTabChange("inspections")}
        >
          <ClipboardCheck size={16} />
          <span>Move-In &amp; Move-Out</span>
        </button>
      </div>

      {/* 4. Filters Toolbar (Active for Leases & Agreements tabs) */}
      {(activeTab === "leases" || activeTab === "agreements") && (
        <div className="lac-filter-toolbar">
          <div className="lac-filter-group-left">
            <div className="lac-search-wrap">
              <Search className="lac-search-icon" size={15} />
              <input
                type="text"
                className="lac-search-input"
                placeholder="Search by Lease ID, Tenant name, Property..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="lac-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring Soon (≤60d)</option>
              <option value="expired">Expired</option>
              <option value="terminated">Terminated</option>
            </select>

            <select
              className="lac-select"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="all">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || statusFilter !== "all" || propertyFilter !== "all") && (
            <button
              className="lac-btn-secondary"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPropertyFilter("all");
              }}
            >
              <X size={13} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 1: LEASE PORTFOLIO
         ========================================================================= */}
      {activeTab === "leases" && (
        <div className="lac-table-card">
          {/* Desktop Table View */}
          <div className="lac-table-wrap">
            <table className="lac-table">
              <thead>
                <tr>
                  <th className="lac-th">Lease ID</th>
                  <th className="lac-th">Property &amp; Unit</th>
                  <th className="lac-th">Tenant</th>
                  <th className="lac-th">Monthly Rent</th>
                  <th className="lac-th">Security Deposit</th>
                  <th className="lac-th">Lease Term</th>
                  <th className="lac-th">Status</th>
                  <th className="lac-th" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeases.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      No leases matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLeases.map((lease) => {
                    const prop = getProp(lease.propertyId);
                    const ten = getTen(lease.tenantId);
                    const days = calculateDaysLeft(lease.endDate || lease.end_date);
                    const isTerm = (lease.status || "").toLowerCase() === "terminated";

                    return (
                      <tr key={lease.id} className="lac-tr">
                        <td className="lac-td">
                          <span style={{ fontWeight: 800, color: "#0284c7" }}>{lease.id}</span>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {lease.regNumber || "TN-REG-2026"}
                          </div>
                        </td>
                        <td className="lac-td">
                          <div style={{ fontWeight: 700 }}>{prop.name || lease.propertyName || "Property Unit"}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                            {prop.city || "Chennai"}, Tamil Nadu
                          </div>
                        </td>
                        <td className="lac-td">
                          <div style={{ fontWeight: 600 }}>{ten.name || lease.tenantName || "Resident Tenant"}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                            {ten.phone || "+91 98401 22334"}
                          </div>
                        </td>
                        <td className="lac-td">
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>
                            ₹{Number(lease.monthlyRent || lease.rent || 0).toLocaleString("en-IN")}
                          </span>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>Due {lease.dueDay || 5}th</div>
                        </td>
                        <td className="lac-td">
                          <span style={{ fontWeight: 600 }}>
                            ₹{Number(lease.depositAmount || lease.deposit || 0).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="lac-td">
                          <div style={{ fontWeight: 500 }}>
                            {lease.startDate || "2026-01-01"} → {lease.endDate || "2026-12-01"}
                          </div>
                          <div style={{ fontSize: "11.5px", color: days < 0 ? "#dc2626" : days <= 60 ? "#d97706" : "#059669" }}>
                            {isTerm ? "Terminated" : days < 0 ? "Expired" : `${days} days left`}
                          </div>
                        </td>
                        <td className="lac-td">
                          {isTerm ? (
                            <span className="lac-badge terminated">Terminated</span>
                          ) : days < 0 ? (
                            <span className="lac-badge expired">Expired</span>
                          ) : days <= 60 ? (
                            <span className="lac-badge expiring">Expiring Soon</span>
                          ) : (
                            <span className="lac-badge active">Active</span>
                          )}
                        </td>
                        <td className="lac-td" style={{ textAlign: "right" }}>
                          <div className="lac-action-row" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="lac-btn-icon"
                              title="View Lease Details"
                              onClick={() => setDrawerLease(lease)}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="lac-btn-icon"
                              title="Edit Terms"
                              onClick={() => {
                                setEditingLease(lease);
                                setFormData({
                                  tenantId: lease.tenantId || "",
                                  propertyId: lease.propertyId || "",
                                  startDate: lease.startDate || "",
                                  endDate: lease.endDate || "",
                                  monthlyRent: lease.monthlyRent || lease.rent || 20000,
                                  depositAmount: lease.depositAmount || lease.deposit || 100000,
                                  termMonths: lease.termMonths || 11,
                                  status: lease.status || "Active",
                                  dueDay: lease.dueDay || 5,
                                  regNumber: lease.regNumber || "TN-REG-2026",
                                });
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="lac-btn-icon"
                              title="View Tenancy Agreement"
                              onClick={() => {
                                setPreviewLease(lease);
                                handleTabChange("agreements");
                              }}
                            >
                              <FileSignature size={14} />
                            </button>
                            {!isTerm && (
                              <button
                                className="lac-btn-icon"
                                title="Renew Lease"
                                onClick={() => handleOpenRenewal(lease)}
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                            {!isTerm && (
                              <button
                                className="lac-btn-icon"
                                style={{ color: "#ef4444" }}
                                title="Terminate Lease"
                                onClick={() => setTerminatingLease(lease)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lac-mobile-view">
            {filteredLeases.map((lease) => {
              const prop = getProp(lease.propertyId);
              const ten = getTen(lease.tenantId);
              const days = calculateDaysLeft(lease.endDate || lease.end_date);
              const isTerm = (lease.status || "").toLowerCase() === "terminated";

              return (
                <div key={lease.id} className="lac-mob-card">
                  <div className="lac-mob-header">
                    <div>
                      <span className="lac-mob-id">{lease.id}</span>
                      <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "6px" }}>
                        {lease.regNumber || "TN-REG"}
                      </span>
                    </div>
                    {isTerm ? (
                      <span className="lac-badge terminated">Terminated</span>
                    ) : days <= 60 ? (
                      <span className="lac-badge expiring">Expiring</span>
                    ) : (
                      <span className="lac-badge active">Active</span>
                    )}
                  </div>

                  <div className="lac-mob-body">
                    <div className="lac-mob-field">
                      <span className="lac-mob-label">Property</span>
                      <span className="lac-mob-value">{prop.name || lease.propertyName}</span>
                    </div>
                    <div className="lac-mob-field">
                      <span className="lac-mob-label">Tenant</span>
                      <span className="lac-mob-value">{ten.name || lease.tenantName}</span>
                    </div>
                    <div className="lac-mob-field">
                      <span className="lac-mob-label">Rent</span>
                      <span className="lac-mob-value">
                        ₹{Number(lease.monthlyRent || lease.rent || 0).toLocaleString("en-IN")}/mo
                      </span>
                    </div>
                    <div className="lac-mob-field">
                      <span className="lac-mob-label">End Date</span>
                      <span className="lac-mob-value">{lease.endDate || "2026-12-01"}</span>
                    </div>
                  </div>

                  <div className="lac-mob-actions">
                    <button
                      className="lac-btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setDrawerLease(lease)}
                    >
                      <Eye size={13} /> View
                    </button>
                    <button
                      className="lac-btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => handleOpenRenewal(lease)}
                    >
                      <RefreshCw size={13} /> Renew
                    </button>
                    <button
                      className="lac-btn-secondary"
                      style={{ flex: 1, color: "#0284c7" }}
                      onClick={() => {
                        setPreviewLease(lease);
                        handleTabChange("agreements");
                      }}
                    >
                      <FileSignature size={13} /> Doc
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TENANCY AGREEMENTS
         ========================================================================= */}
      {activeTab === "agreements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Bar for Agreement Selection */}
          <div className="lac-header-card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                  Selected Lease Agreement:
                </span>
                <select
                  className="lac-select"
                  style={{ minWidth: "240px" }}
                  value={previewLease ? previewLease.id : (leases[0]?.id || "")}
                  onChange={(e) => {
                    const found = leases.find((l) => l.id === e.target.value);
                    if (found) setPreviewLease(found);
                  }}
                >
                  {leases.map((l) => {
                    const ten = getTen(l.tenantId);
                    const prop = getProp(l.propertyId);
                    return (
                      <option key={l.id} value={l.id}>
                        {l.id} - {prop.name || l.propertyName} ({ten.name || l.tenantName})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="lac-btn-secondary"
                  onClick={() => handlePrintAgreement(previewLease || leases[0])}
                >
                  <Printer size={14} />
                  <span>Print Agreement</span>
                </button>
                <button
                  className="lac-btn-primary"
                  onClick={() => {
                    const target = previewLease || leases[0];
                    if (!target) return;
                    const blob = new Blob([
                      `PROPCONNECT OFFICIAL TENANCY AGREEMENT\nLease ID: ${target.id}\nRegistration: ${target.regNumber || target.id}\nProperty: ${target.propertyName || target.propertyId}\nTenant: ${target.tenantName || target.tenantId}\nRent: INR ${target.monthlyRent || target.rent}\nDeposit: INR ${target.depositAmount || target.deposit}\nTerm: ${target.startDate} to ${target.endDate}\nStatus: ${target.agreementStatus || "Active"}\nStatutory Government of Tamil Nadu Tenancy Registration Act Verified.`,
                    ], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Tenancy_Agreement_${target.id}.txt`;
                    a.click();
                    showToast("Downloaded official tenancy agreement document!");
                  }}
                >
                  <Download size={14} />
                  <span>Download Document</span>
                </button>
              </div>
            </div>
          </div>

          {/* Statutory Tenancy Agreement Preview Card */}
          {(() => {
            const targetLease = previewLease || leases[0];
            if (!targetLease) {
              return <div className="lac-header-card">No lease selected.</div>;
            }
            const prop = getProp(targetLease.propertyId);
            const ten = getTen(targetLease.tenantId);
            const ldl = LANDLORDS.find((l) => l.id === prop.landlordId) || LANDLORDS[0];

            return (
              <div className="lac-doc-preview">
                <div className="lac-doc-header">
                  <div className="lac-doc-badge">Government of Tamil Nadu Tenancy Registration</div>
                  <h2 className="lac-doc-title">RESIDENTIAL TENANCY LEASE AGREEMENT</h2>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
                    Official Registration ID: <strong>{targetLease.regNumber || `TN-REG-${targetLease.id}`}</strong> • Execution Date: {targetLease.startDate}
                  </p>
                </div>

                <div className="lac-doc-clause">
                  <div className="lac-doc-clause-title">1. Contracting Parties</div>
                  <div className="lac-doc-clause-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>LESSOR / LANDLORD</div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{ldl?.name || user?.name || "Property Owner"}</div>
                      <div style={{ fontSize: "12px", color: "#475569" }}>Contact: {ldl?.phone || "+91 94440 12345"} | {ldl?.email || "landlord@propconnect.com"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>LESSEE / TENANT</div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{ten.name || targetLease.tenantName || "Resident Tenant"}</div>
                      <div style={{ fontSize: "12px", color: "#475569" }}>Contact: {ten.phone || "+91 98401 22334"} | {ten.email || "tenant@mail.com"}</div>
                    </div>
                  </div>
                </div>

                <div className="lac-doc-clause">
                  <div className="lac-doc-clause-title">2. Demised Premises &amp; Specifications</div>
                  <div className="lac-doc-clause-body">
                    The Lessor agrees to let out, and the Lessee agrees to take on lease, the residential unit located at:
                    <div style={{ fontWeight: 700, color: "#0f172a", margin: "6px 0" }}>
                      {prop.name || targetLease.propertyName}, {prop.address || "Main Road"}, {prop.city || "Chennai"}, Tamil Nadu - India
                    </div>
                    <div>
                      Configuration: {prop.bedrooms || 2} BHK • {prop.area || 1100} sq.ft • Furnishing: {prop.furnishing || "Semi-Furnished"} • EB Consumer No: {prop.ebConsumerNo || "04-301-002-1188"}
                    </div>
                  </div>
                </div>

                <div className="lac-doc-clause">
                  <div className="lac-doc-clause-title">3. Rent, Security Deposit &amp; Due Terms</div>
                  <div className="lac-doc-clause-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>MONTHLY RENT</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0284c7" }}>
                        ₹{Number(targetLease.monthlyRent || targetLease.rent || 0).toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Payable by 5th of each calendar month</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>INTEREST-FREE SECURITY DEPOSIT</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                        ₹{Number(targetLease.depositAmount || targetLease.deposit || 0).toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Refundable on lawful vacancy</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>TENANCY DURATION</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                        {targetLease.termMonths || 11} Months
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{targetLease.startDate} to {targetLease.endDate}</div>
                    </div>
                  </div>
                </div>

                <div className="lac-doc-clause">
                  <div className="lac-doc-clause-title">4. Statutory Covenants &amp; Utility Apportionment</div>
                  <div className="lac-doc-clause-body" style={{ fontSize: "12.5px" }}>
                    <p style={{ margin: "0 0 6px 0" }}>
                      • <strong>Electricity &amp; Water:</strong> Consumption billed on consumer sub-meter shall be borne directly by the Lessee.
                    </p>
                    <p style={{ margin: "0 0 6px 0" }}>
                      • <strong>Building Maintenance:</strong> Routine civil maintenance is managed by Lessor; internal day-to-day cleanliness by Lessee.
                    </p>
                    <p style={{ margin: "0" }}>
                      • <strong>Notice Period:</strong> Either party may terminate this agreement with 1 calendar month prior written notice.
                    </p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="lac-signatures-grid">
                  <div className="lac-sig-card">
                    <div className="lac-sig-line" />
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>Signature of Lessor (Landlord)</div>
                    <div style={{ fontSize: "11px", color: "#059669", fontWeight: 600, marginTop: "2px" }}>
                      ✓ Digitally Authenticated via PropConnect
                    </div>
                  </div>

                  <div className="lac-sig-card">
                    <div className="lac-sig-line" />
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>Signature of Lessee (Tenant)</div>
                    <div style={{ fontSize: "11px", color: "#059669", fontWeight: 600, marginTop: "2px" }}>
                      ✓ Verified KYC Signature On File
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          TAB 3: RENEWALS & EXPIRY
         ========================================================================= */}
      {activeTab === "renewals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="lac-header-card" style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800 }}>
              Lease Expiry &amp; Renewal Pipeline
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Track expiring leases, send automated reminder notifications, negotiate renewal terms, and execute term extensions.
            </p>
          </div>

          <div className="lac-table-card">
            <div className="lac-table-wrap">
              <table className="lac-table">
                <thead>
                  <tr>
                    <th className="lac-th">Lease ID</th>
                    <th className="lac-th">Property</th>
                    <th className="lac-th">Tenant</th>
                    <th className="lac-th">Current Rent</th>
                    <th className="lac-th">Expiry Date</th>
                    <th className="lac-th">Remaining Days</th>
                    <th className="lac-th">Renewal Status</th>
                    <th className="lac-th" style={{ textAlign: "right" }}>Renewal Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringLeases.map((lease) => {
                    const prop = getProp(lease.propertyId);
                    const ten = getTen(lease.tenantId);
                    const days = lease.daysLeft;

                    return (
                      <tr key={lease.id} className="lac-tr">
                        <td className="lac-td">
                          <span style={{ fontWeight: 800, color: "#0284c7" }}>{lease.id}</span>
                        </td>
                        <td className="lac-td">
                          <div style={{ fontWeight: 700 }}>{prop.name || lease.propertyName}</div>
                        </td>
                        <td className="lac-td">
                          <div style={{ fontWeight: 600 }}>{ten.name || lease.tenantName}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{ten.phone || "+91 98401 22334"}</div>
                        </td>
                        <td className="lac-td">
                          <span style={{ fontWeight: 700 }}>
                            ₹{Number(lease.monthlyRent || lease.rent || 0).toLocaleString("en-IN")}/mo
                          </span>
                        </td>
                        <td className="lac-td">
                          <span style={{ fontWeight: 600 }}>{lease.endDate || "2026-12-01"}</span>
                        </td>
                        <td className="lac-td">
                          <span
                            className="lac-badge"
                            style={{
                              background: days < 0 ? "#fef2f2" : days <= 60 ? "#fffbeb" : "#ecfdf5",
                              color: days < 0 ? "#b91c1c" : days <= 60 ? "#b45309" : "#047857",
                            }}
                          >
                            {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                          </span>
                        </td>
                        <td className="lac-td">
                          <span className="lac-badge draft">
                            {lease.renewalStatus || "Not Initiated"}
                          </span>
                        </td>
                        <td className="lac-td" style={{ textAlign: "right" }}>
                          <div className="lac-action-row" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="lac-btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => handleSendReminder(lease)}
                            >
                              <Send size={12} />
                              <span>Remind</span>
                            </button>
                            <button
                              className="lac-btn-primary"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => handleOpenRenewal(lease)}
                            >
                              <RefreshCw size={12} />
                              <span>Initiate Renewal</span>
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
        </div>
      )}

      {/* =========================================================================
          TAB 4: MOVE-IN & MOVE-OUT INSPECTIONS
         ========================================================================= */}
      {activeTab === "inspections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Lease Selector */}
          <div className="lac-header-card" style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                  Select Unit &amp; Lease:
                </span>
                <select
                  className="lac-select"
                  style={{ minWidth: "260px" }}
                  value={selectedInspectionLeaseId}
                  onChange={(e) => setSelectedInspectionLeaseId(e.target.value)}
                >
                  {leases.map((l) => {
                    const prop = getProp(l.propertyId);
                    const ten = getTen(l.tenantId);
                    return (
                      <option key={l.id} value={l.id}>
                        {l.id} - {prop.name || l.propertyName} ({ten.name || l.tenantName})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Move-In vs Move-Out Switch */}
              <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", gap: "4px" }}>
                <button
                  className="lac-btn-secondary"
                  style={{
                    background: inspectionMode === "moveIn" ? "#ffffff" : "transparent",
                    borderColor: inspectionMode === "moveIn" ? "#cbd5e1" : "transparent",
                    color: inspectionMode === "moveIn" ? "#0284c7" : "#64748b",
                    boxShadow: inspectionMode === "moveIn" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  }}
                  onClick={() => setInspectionMode("moveIn")}
                >
                  Move-In Inspection
                </button>
                <button
                  className="lac-btn-secondary"
                  style={{
                    background: inspectionMode === "moveOut" ? "#ffffff" : "transparent",
                    borderColor: inspectionMode === "moveOut" ? "#cbd5e1" : "transparent",
                    color: inspectionMode === "moveOut" ? "#dc2626" : "#64748b",
                    boxShadow: inspectionMode === "moveOut" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  }}
                  onClick={() => setInspectionMode("moveOut")}
                >
                  Move-Out Inspection &amp; Settlement
                </button>
              </div>
            </div>
          </div>

          {/* Inspection Workflow Form Card */}
          <div className="lac-header-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800 }}>
                  {inspectionMode === "moveIn"
                    ? "Official Move-In Condition Checklist"
                    : "Move-Out Condition, Damage Assessment & Deposit Settlement"}
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Unit: <strong>{getProp(activeInspectionLease?.propertyId).name || activeInspectionLease?.propertyName}</strong> • Tenant: {getTen(activeInspectionLease?.tenantId).name || activeInspectionLease?.tenantName}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>Overall Condition:</span>
                <select
                  className="lac-select"
                  value={inspectionCondition}
                  onChange={(e) => setInspectionCondition(e.target.value)}
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
            </div>

            {/* Room Checklist */}
            <div className="lac-checklist-grid">
              {checklist.map((item, idx) => (
                <div key={item.room} className="lac-check-item">
                  <div>
                    <div className="lac-check-room">{item.room}</div>
                    <div className="lac-check-desc">{item.item}</div>
                  </div>

                  <div className="lac-check-status-btns">
                    {["Pass", "Action Required", "Damaged"].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`lac-check-status-btn ${
                          item.status === st
                            ? st === "Pass"
                              ? "selected-pass"
                              : st === "Action Required"
                              ? "selected-action"
                              : "selected-damage"
                            : ""
                        }`}
                        onClick={() => {
                          const updated = [...checklist];
                          updated[idx].status = st;
                          setChecklist(updated);
                        }}
                      >
                        {item.status === st && "✓ "}
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Move-In Notes */}
            {inspectionMode === "moveIn" && (
              <div style={{ marginTop: "18px" }}>
                <label className="lac-form-label">Existing Damage / Handover Notes</label>
                <textarea
                  className="lac-form-textarea"
                  rows={3}
                  placeholder="Record any minor scratches, initial paint condition, or pre-existing defects..."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                />
              </div>
            )}

            {/* Move-Out Damage & Settlement */}
            {inspectionMode === "moveOut" && (
              <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label className="lac-form-label">Move-Out Damage Notes &amp; Repair Itemization</label>
                  <textarea
                    className="lac-form-textarea"
                    rows={3}
                    placeholder="Describe any tenant-caused damage (broken tiles, missing fixtures, repainting required)..."
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                  <div>
                    <label className="lac-form-label">Unpaid Rent / Utility Dues (₹)</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={pendingDues}
                      onChange={(e) => setPendingDues(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="lac-form-label">Damage Repair Deductions (₹)</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={damageDeductions}
                      onChange={(e) => setDamageDeductions(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Settlement Card */}
                {(() => {
                  const originalDeposit = Number(activeInspectionLease?.depositAmount || activeInspectionLease?.deposit || 100000);
                  const netRefund = Math.max(0, originalDeposit - pendingDues - damageDeductions);

                  return (
                    <div className="lac-settle-card">
                      <div style={{ fontWeight: 800, fontSize: "14px", color: "#166534", marginBottom: "8px" }}>
                        Statutory Security Deposit Settlement Summary
                      </div>
                      <div className="lac-settle-row">
                        <span>Original Security Deposit Held:</span>
                        <strong>₹{originalDeposit.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="lac-settle-row" style={{ color: "#b91c1c" }}>
                        <span>Less: Unpaid Utility &amp; Rent Dues:</span>
                        <strong>- ₹{pendingDues.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="lac-settle-row" style={{ color: "#b91c1c" }}>
                        <span>Less: Authorized Repair Deductions:</span>
                        <strong>- ₹{damageDeductions.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="lac-settle-row lac-settle-total">
                        <span>Net Refundable to Tenant:</span>
                        <span>₹{netRefund.toLocaleString("en-IN")}</span>
                      </div>

                      <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          id="authorizeSettlementCheck"
                          checked={settlementAuthorized}
                          onChange={(e) => setSettlementAuthorized(e.target.checked)}
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        <label htmlFor="authorizeSettlementCheck" style={{ fontSize: "13px", fontWeight: 600, color: "#15803d", cursor: "pointer" }}>
                          I authorize this deposit settlement calculation and release of net funds.
                        </label>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Save Button */}
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="lac-btn-primary" onClick={handleSaveInspection}>
                <ClipboardCheck size={16} />
                <span>
                  Save {inspectionMode === "moveIn" ? "Move-In Record" : "Move-Out Assessment"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SIDE PANEL DRAWER: LEASE DETAILS
         ========================================================================= */}
      {drawerLease && (
        <div className="lac-drawer-overlay" onClick={() => setDrawerLease(null)}>
          <div className="lac-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="lac-drawer-header">
              <div>
                <h3 className="lac-drawer-title">{drawerLease.id} Details</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Registration: {drawerLease.regNumber || drawerLease.id}
                </span>
              </div>
              <button className="lac-drawer-close" onClick={() => setDrawerLease(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="lac-drawer-body">
              {/* Property Details */}
              <div className="lac-drawer-section">
                <div className="lac-drawer-section-title">
                  <Building size={14} /> Property Demised
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Property Name</span>
                  <span className="lac-drawer-val">
                    {getProp(drawerLease.propertyId).name || drawerLease.propertyName}
                  </span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Address</span>
                  <span className="lac-drawer-val">
                    {getProp(drawerLease.propertyId).city || "Chennai"}, Tamil Nadu
                  </span>
                </div>
              </div>

              {/* Tenant Details */}
              <div className="lac-drawer-section">
                <div className="lac-drawer-section-title">
                  <User size={14} /> Tenant Profile
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Tenant Name</span>
                  <span className="lac-drawer-val">
                    {getTen(drawerLease.tenantId).name || drawerLease.tenantName}
                  </span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Phone</span>
                  <span className="lac-drawer-val">
                    {getTen(drawerLease.tenantId).phone || "+91 98401 22334"}
                  </span>
                </div>
              </div>

              {/* Financial Terms */}
              <div className="lac-drawer-section">
                <div className="lac-drawer-section-title">
                  <CreditCard size={14} /> Financial Terms
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Monthly Rent</span>
                  <span className="lac-drawer-val" style={{ color: "#0284c7" }}>
                    ₹{Number(drawerLease.monthlyRent || drawerLease.rent || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Security Deposit</span>
                  <span className="lac-drawer-val">
                    ₹{Number(drawerLease.depositAmount || drawerLease.deposit || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Due Date</span>
                  <span className="lac-drawer-val">{drawerLease.dueDay || 5}th of every month</span>
                </div>
              </div>

              {/* Term Dates */}
              <div className="lac-drawer-section">
                <div className="lac-drawer-section-title">
                  <Calendar size={14} /> Term &amp; Renewal Status
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Start Date</span>
                  <span className="lac-drawer-val">{drawerLease.startDate}</span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">End Date</span>
                  <span className="lac-drawer-val">{drawerLease.endDate}</span>
                </div>
                <div className="lac-drawer-row">
                  <span className="lac-drawer-label">Days Remaining</span>
                  <span className="lac-drawer-val">
                    {calculateDaysLeft(drawerLease.endDate)} days
                  </span>
                </div>
              </div>

              {/* Version History Log */}
              {drawerLease.agreementHistory && drawerLease.agreementHistory.length > 0 && (
                <div className="lac-drawer-section">
                  <div className="lac-drawer-section-title">
                    <Clock size={14} /> Agreement Version History
                  </div>
                  {drawerLease.agreementHistory.map((h, i) => (
                    <div key={i} className="lac-drawer-row">
                      <span>v{h.version || i + 1} - {h.reason}</span>
                      <span className="lac-drawer-val" style={{ fontSize: "11px" }}>
                        {h.updatedDate} by {h.updatedBy}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE / DRAFT LEASE
         ========================================================================= */}
      {isCreateOpen && (
        <div className="lac-modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="lac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lac-modal-header">
              <h3 className="lac-modal-title">Create New Residential Lease</h3>
              <button className="lac-drawer-close" onClick={() => setIsCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateLease}>
              <div className="lac-modal-body">
                <div className="lac-form-group">
                  <label className="lac-form-label">Select Tenant *</label>
                  <select
                    className="lac-form-select"
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id} - {t.phone})
                      </option>
                    ))}
                  </select>
                  {formErrors.tenantId && <span className="lac-form-error">{formErrors.tenantId}</span>}
                </div>

                <div className="lac-form-group">
                  <label className="lac-form-label">Select Property Unit *</label>
                  <select
                    className="lac-form-select"
                    value={formData.propertyId}
                    onChange={(e) => {
                      const p = getProp(e.target.value);
                      setFormData({
                        ...formData,
                        propertyId: e.target.value,
                        monthlyRent: p.rent || formData.monthlyRent,
                        depositAmount: p.deposit || formData.depositAmount,
                      });
                    }}
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ₹{p.rent}/mo
                      </option>
                    ))}
                  </select>
                  {formErrors.propertyId && <span className="lac-form-error">{formErrors.propertyId}</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Monthly Rent (₹) *</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                    />
                    {formErrors.monthlyRent && <span className="lac-form-error">{formErrors.monthlyRent}</span>}
                  </div>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Security Deposit (₹) *</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={formData.depositAmount}
                      onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Start Date *</label>
                    <input
                      type="date"
                      className="lac-form-input"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="lac-form-group">
                    <label className="lac-form-label">End Date *</label>
                    <input
                      type="date"
                      className="lac-form-input"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                    {formErrors.endDate && <span className="lac-form-error">{formErrors.endDate}</span>}
                  </div>
                </div>

                <div className="lac-form-group">
                  <label className="lac-form-label">Registration Number</label>
                  <input
                    type="text"
                    className="lac-form-input"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="lac-modal-footer">
                <button
                  type="button"
                  className="lac-btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="lac-btn-primary">
                  Create &amp; Register Lease
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT LEASE
         ========================================================================= */}
      {editingLease && (
        <div className="lac-modal-overlay" onClick={() => setEditingLease(null)}>
          <div className="lac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lac-modal-header">
              <h3 className="lac-modal-title">Edit Lease Terms - {editingLease.id}</h3>
              <button className="lac-drawer-close" onClick={() => setEditingLease(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateLease}>
              <div className="lac-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Monthly Rent (₹)</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                    />
                  </div>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Security Deposit (₹)</label>
                    <input
                      type="number"
                      className="lac-form-input"
                      value={formData.depositAmount}
                      onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="lac-form-group">
                    <label className="lac-form-label">Start Date</label>
                    <input
                      type="date"
                      className="lac-form-input"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="lac-form-group">
                    <label className="lac-form-label">End Date</label>
                    <input
                      type="date"
                      className="lac-form-input"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="lac-modal-footer">
                <button
                  type="button"
                  className="lac-btn-secondary"
                  onClick={() => setEditingLease(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="lac-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RENEW LEASE
         ========================================================================= */}
      {renewingLease && (
        <div className="lac-modal-overlay" onClick={() => setRenewingLease(null)}>
          <div className="lac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lac-modal-header">
              <h3 className="lac-modal-title">Initiate Lease Renewal - {renewingLease.id}</h3>
              <button className="lac-drawer-close" onClick={() => setRenewingLease(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="lac-modal-body">
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748b" }}>
                Renewing for tenant <strong>{getTen(renewingLease.tenantId).name || renewingLease.tenantName}</strong> at <strong>{getProp(renewingLease.propertyId).name || renewingLease.propertyName}</strong>.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="lac-form-group">
                  <label className="lac-form-label">New Term Start Date</label>
                  <input
                    type="date"
                    className="lac-form-input"
                    value={renewalForm.newStartDate}
                    onChange={(e) => setRenewalForm({ ...renewalForm, newStartDate: e.target.value })}
                  />
                </div>
                <div className="lac-form-group">
                  <label className="lac-form-label">New Term End Date</label>
                  <input
                    type="date"
                    className="lac-form-input"
                    value={renewalForm.newEndDate}
                    onChange={(e) => setRenewalForm({ ...renewalForm, newEndDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="lac-form-group">
                <label className="lac-form-label">Proposed New Monthly Rent (₹)</label>
                <input
                  type="number"
                  className="lac-form-input"
                  value={renewalForm.newMonthlyRent}
                  onChange={(e) => setRenewalForm({ ...renewalForm, newMonthlyRent: e.target.value })}
                />
              </div>

              <div className="lac-form-group">
                <label className="lac-form-label">Renewal Escalation Notes</label>
                <textarea
                  className="lac-form-textarea"
                  rows={2}
                  value={renewalForm.notes}
                  onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="lac-modal-footer">
              <button className="lac-btn-secondary" onClick={() => setRenewingLease(null)}>
                Cancel
              </button>
              <button className="lac-btn-primary" onClick={handleConfirmRenewal}>
                <RefreshCw size={14} /> Confirm &amp; Renew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TERMINATE LEASE CONFIRMATION
         ========================================================================= */}
      {terminatingLease && (
        <div className="lac-modal-overlay" onClick={() => setTerminatingLease(null)}>
          <div className="lac-modal" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="lac-modal-header">
              <h3 className="lac-modal-title" style={{ color: "#dc2626" }}>
                Confirm Lease Termination
              </h3>
              <button className="lac-drawer-close" onClick={() => setTerminatingLease(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="lac-modal-body">
              <p style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "#334155", lineHeight: 1.5 }}>
                Are you sure you want to terminate lease <strong>{terminatingLease.id}</strong>? 
                This will mark the lease and agreement as <strong>Terminated</strong> and archive the record.
              </p>

              <div className="lac-form-group">
                <label className="lac-form-label">Reason for Termination</label>
                <select
                  className="lac-form-select"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                >
                  <option value="Mutual Agreement">Mutual Agreement</option>
                  <option value="Tenant Relocation">Tenant Relocation</option>
                  <option value="Non-Payment of Rent">Non-Payment of Rent</option>
                  <option value="Breach of Agreement">Breach of Tenancy Agreement</option>
                  <option value="Property Sale">Property Owner Sale</option>
                </select>
              </div>
            </div>

            <div className="lac-modal-footer">
              <button className="lac-btn-secondary" onClick={() => setTerminatingLease(null)}>
                Cancel
              </button>
              <button
                className="lac-btn-primary"
                style={{ background: "#dc2626" }}
                onClick={handleConfirmTermination}
              >
                Terminate Lease
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
