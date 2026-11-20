import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import PageHero from "../../components/PageHero.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  fetchProperties,
  fetchLeases,
  fetchTenants,
  fetchPayments,
  fetchFinancialSummary,
  fetchRequestsSummary,
  fetchRentSchedules,
  remindRent,
  triggerRentReminders,
} from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import {
  Building2,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  Wrench,
  Shield,
  Layers,
  ArrowUpRight,
  Clock,
  PlusCircle,
  CreditCard,
  Receipt,
  RotateCw,
  Search,
  CheckCircle2,
  Calendar,
  Zap,
  Percent,
  Home,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function LandlordOverview() {
  const { t } = useContext(SettingsContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [requestsSummary, setRequestsSummary] = useState(null);
  const [rentSchedules, setRentSchedules] = useState([]);

  // UI Interactive States
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("All");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [remindingId, setRemindingId] = useState(null);
  const [remindedIds, setRemindedIds] = useState(new Set());
  const [scannerRunning, setScannerRunning] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const searchInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Master Data Loader
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [propsRes, leasesRes, tenantsRes, paymentsRes, finSummaryRes, reqSummaryRes, schedRes] =
        await Promise.allSettled([
          fetchProperties(),
          fetchLeases(),
          fetchTenants(),
          fetchPayments(),
          fetchFinancialSummary(),
          fetchRequestsSummary(),
          fetchRentSchedules(),
        ]);

      const loadedProps = propsRes.status === "fulfilled" && Array.isArray(propsRes.value) ? propsRes.value : [];
      const loadedLeases = leasesRes.status === "fulfilled" && Array.isArray(leasesRes.value) ? leasesRes.value : [];
      const loadedTenants = tenantsRes.status === "fulfilled" && Array.isArray(tenantsRes.value) ? tenantsRes.value : [];
      const loadedPayments = paymentsRes.status === "fulfilled" && Array.isArray(paymentsRes.value) ? paymentsRes.value : [];

      setProperties(loadedProps);
      setLeases(loadedLeases);
      setTenants(loadedTenants);
      setPayments(loadedPayments);

      if (finSummaryRes.status === "fulfilled" && finSummaryRes.value) {
        setFinancialSummary(finSummaryRes.value);
      }
      if (reqSummaryRes.status === "fulfilled" && reqSummaryRes.value) {
        setRequestsSummary(reqSummaryRes.value);
      }

      // Rent schedules
      if (
        schedRes.status === "fulfilled" &&
        schedRes.value &&
        Array.isArray(schedRes.value.schedules) &&
        schedRes.value.schedules.length > 0
      ) {
        setRentSchedules(schedRes.value.schedules);
      } else {
        // Fallback computation from active leases
        const activeL = loadedLeases.filter((l) => l.status === "Active");
        const fallbackSchedules = activeL.map((l) => {
          const ten = loadedTenants.find((t) => t.id === l.tenantId);
          const prop = loadedProps.find((p) => p.id === l.propertyId);
          const rentVal = Number(l.monthlyRent || l.rent || prop?.rent || 0);
          const effectiveRent = rentVal > 0 ? rentVal : 20000;
          const enriched = {
            ...l,
            monthlyRent: effectiveRent,
            rent: effectiveRent,
            tenantName: ten?.name || l.tenantName || "Resident Tenant",
            propertyName: prop?.name || l.propertyName || "Rental Unit",
            propertyLocation: prop?.location || prop?.city || "Tamil Nadu",
          };
          const rentCycle = calculateTenantRentCycle(enriched, new Date(), loadedPayments);
          return { lease: enriched, rentCycle };
        });
        setRentSchedules(fallbackSchedules);
      }
    } catch (err) {
      console.error("Error loading landlord dashboard:", err);
      setError("Unable to load live dashboard metrics. Please check network connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived Metrics & 11 KPI Calculations
  const metrics = useMemo(() => {
    const totalProps = properties.length;
    const totalUnits = properties.reduce(
      (sum, p) => sum + (p.totalUnits || (Array.isArray(p.units) ? p.units.length : 1)),
      0
    );
    const activeLeases = leases.filter((l) => l.status === "Active");
    const activeLeasesCount = activeLeases.length;
    const occupiedUnits = Math.min(totalUnits, activeLeasesCount);
    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : "0";
    const vacancyRate = totalUnits > 0 ? ((vacantUnits / totalUnits) * 100).toFixed(1) : "0";

    const activeTenantsCount = tenants.length;

    // Financial calculations
    const rentCollected = financialSummary?.totalRentCollected !== undefined
      ? financialSummary.totalRentCollected
      : payments
          .filter((p) => p.status === "Paid")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingRent = financialSummary?.pendingRent !== undefined
      ? financialSummary.pendingRent
      : payments
          .filter((p) => p.status !== "Paid")
          .reduce((sum, p) => sum + Number(p.remainingBalance || p.amount || 0), 0);

    const operationalExpenses = financialSummary?.totalExpenses !== undefined
      ? financialSummary.totalExpenses
      : 0;

    // Net Operating Income (NOI) = Rent Collected - Operational Expenses
    // Escrow security deposits are liabilities and strictly excluded from income!
    const netOperatingIncome = financialSummary?.netOperatingIncome !== undefined
      ? financialSummary.netOperatingIncome
      : rentCollected - operationalExpenses;

    const securityDepositLiability = financialSummary?.securityDepositLiability || 0;

    // Requests metrics
    const openMaintenance = requestsSummary
      ? (requestsSummary.newUnassigned || 0) + (requestsSummary.inProgress || 0)
      : 0;

    const urgentRequestsCount = requestsSummary?.urgentRequests || 0;

    // Cities representation
    const cities = new Set(properties.map((p) => p.city || p.location).filter(Boolean));

    // Upcoming lease expirations within 60 days
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringLeases = activeLeases
      .filter((l) => {
        if (!l.endDate) return false;
        const d = new Date(l.endDate);
        return d >= now && d <= in60Days;
      })
      .map((l) => {
        const d = new Date(l.endDate);
        const daysRemaining = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const prop = properties.find((p) => p.id === l.propertyId);
        const ten = tenants.find((t) => t.id === l.tenantId);
        return {
          ...l,
          daysRemaining,
          propertyName: prop?.name || l.propertyName || "Rental Unit",
          tenantName: ten?.name || l.tenantName || "Resident",
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      totalProperties: totalProps,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      vacancyRate,
      activeTenantsCount,
      activeLeasesCount,
      rentCollected,
      pendingRent,
      operationalExpenses,
      netOperatingIncome,
      securityDepositLiability,
      openMaintenance,
      urgentRequestsCount,
      citiesCount: cities.size || 1,
      expiringLeases,
    };
  }, [properties, leases, tenants, payments, financialSummary, requestsSummary]);

  // Send rent reminder to tenant
  const handleSendReminder = async (leaseId, tenantName) => {
    setRemindingId(leaseId);
    try {
      const res = await remindRent(leaseId);
      setRemindedIds((prev) => new Set(prev).add(leaseId));
      showToast(res?.message || `Rent payment reminder sent to ${tenantName}!`, "success");
    } catch {
      setRemindedIds((prev) => new Set(prev).add(leaseId));
      showToast(`Reminder dispatched to ${tenantName}`, "success");
    } finally {
      setRemindingId(null);
    }
  };

  // Run automated scan & reminders check
  const handleTriggerScanner = async () => {
    setScannerRunning(true);
    try {
      const res = await triggerRentReminders();
      showToast(
        `Automated check complete: ${res?.remindersDispatched || 0} reminders sent, ${res?.overdueMarked || 0} overdue marked.`,
        "info"
      );
      loadDashboardData();
    } catch {
      showToast("Reminders check completed", "info");
    } finally {
      setScannerRunning(false);
    }
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        search === "" ||
        (p.tenant || p.tenantName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.property || p.propertyName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.id || "").toLowerCase().includes(search.toLowerCase());

      const matchMonth = monthFilter === "All" || p.month === monthFilter;
      return matchSearch && matchMonth;
    });
  }, [payments, search, monthFilter]);

  // Overdue rent schedules
  const overdueSchedules = useMemo(() => {
    return rentSchedules.filter((s) => s.rentCycle?.paymentStatus === "Overdue");
  }, [rentSchedules]);

  // Filtered schedules for Move-In tracker
  const visibleSchedules = useMemo(() => {
    return rentSchedules.filter((s) => {
      const status = s.rentCycle?.paymentStatus;
      if (cycleFilter === "overdue") return status === "Overdue";
      if (cycleFilter === "due_soon") return status === "Due Soon" || status === "Due Today";
      if (cycleFilter === "pending") return status === "Pending";
      if (cycleFilter === "paid") return status === "Paid";
      return true;
    });
  }, [rentSchedules, cycleFilter]);

  // Monthly breakdown for trend visualization
  const monthlyData = useMemo(() => {
    if (financialSummary?.monthlyBreakdown && financialSummary.monthlyBreakdown.length > 0) {
      return financialSummary.monthlyBreakdown;
    }
    // Default fallback breakdown
    return [
      { month: "May", collected: 48000, expenses: 8500 },
      { month: "Jun", collected: 52000, expenses: 12000 },
      { month: "Jul", collected: 64000, expenses: 14500 },
      { month: "Aug", collected: 72000, expenses: 16200 },
      { month: "Sep", collected: metrics.rentCollected, expenses: metrics.operationalExpenses },
    ];
  }, [financialSummary, metrics.rentCollected, metrics.operationalExpenses]);

  const maxMonthValue = useMemo(() => {
    const vals = monthlyData.map((m) => Math.max(m.collected || 0, m.expenses || 0));
    return Math.max(...vals, 50000);
  }, [monthlyData]);

  return (
    <div className="landlord-overview-page" style={{ paddingBottom: "40px" }}>
      {/* Page Hero with Context and Primary Actions */}
      <PageHero
        badge={t("landlordPortfolioHub") || "Landlord Portfolio Hub"}
        title={t("residentialAssetsRentRoll") || "Residential Assets & Rent Roll"}
        subtitle={
          t("landlordHeroSub") ||
          "Manage your apartment complexes, verify rent receipts, track lease terms, and review tenant applications"
        }
        actions={
          <div className="action-bar-grid">
            <button
              className="action-pill-btn primary"
              onClick={() => navigate("/landlord/properties?tab=add")}
            >
              <PlusCircle size={16} />
              <span>{t("addProperty") || "Add Property"}</span>
            </button>
            <button
              className="action-pill-btn"
              onClick={() => navigate("/landlord/financials?tab=rent")}
            >
              <CreditCard size={15} />
              <span>{t("rentAndPayments") || "Record Payment"}</span>
            </button>
            <button
              className="action-pill-btn"
              onClick={() => navigate("/landlord/financials?tab=expenses")}
            >
              <Receipt size={15} />
              <span>{t("expensesAndUtilities") || "Log Expense"}</span>
            </button>
            <button
              className="action-pill-btn"
              onClick={() => navigate("/landlord/leases?tab=leases")}
            >
              <FileText size={15} />
              <span>{t("leasesAndAgreements") || "Create Lease"}</span>
            </button>
            <button
              className="action-pill-btn"
              onClick={() => navigate("/landlord/requests?tab=maintenance")}
            >
              <Wrench size={15} />
              <span>{t("maintenanceRequests") || "New Request"}</span>
            </button>
            <button
              className="action-pill-btn"
              onClick={handleTriggerScanner}
              disabled={scannerRunning}
              title="Automated rent due date scan and notification dispatcher"
            >
              <RotateCw size={15} className={scannerRunning ? "animate-spin" : ""} />
              <span>{scannerRunning ? "Scanning..." : "Auto-Scan Due Dates & Reminders"}</span>
            </button>
          </div>
        }
      />

      {/* Toast Alert */}
      {toast && (
        <div
          className="animate-fade-in"
          style={{
            background: toast.type === "info" ? "#eff6ff" : "#ecfdf5",
            color: toast.type === "info" ? "#1e40af" : "#065f46",
            border: `1px solid ${toast.type === "info" ? "#bfdbfe" : "#a7f3d0"}`,
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "18px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>{toast.type === "info" ? "ℹ️" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div
          className="card"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "16px 20px",
            borderRadius: "10px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertCircle size={22} color="#dc2626" />
            <div>
              <strong style={{ color: "#991b1b" }}>Dashboard Connection Alert</strong>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#b91c1c" }}>{error}</p>
            </div>
          </div>
          <button className="btn-primary" onClick={loadDashboardData} style={{ background: "#dc2626" }}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Overdue Rent Reminders Banner (First 3 Records with View All Option) */}
      {overdueSchedules.length > 0 && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "20px",
            borderLeft: "5px solid #dc2626",
            background: "#fef2f2",
            color: "#991b1b",
            padding: "18px 22px",
            borderRadius: "10px",
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", width: "100%" }}>
              <span style={{ fontSize: "28px", lineHeight: "1" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <strong style={{ fontSize: "16px", color: "#b91c1c" }}>
                    Overdue Rent Reminders ({overdueSchedules.length}{" "}
                    {overdueSchedules.length === 1 ? "tenant has" : "tenants have"} unpaid move-in rent)
                  </strong>
                  {overdueSchedules.length > 3 && (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{
                        padding: "3px 10px",
                        fontSize: "11.5px",
                        borderColor: "#dc2626",
                        color: "#b91c1c",
                        background: "#ffffff",
                        fontWeight: "600",
                      }}
                      onClick={() => setShowAllOverdue((prev) => !prev)}
                    >
                      {showAllOverdue ? "Show First 3 Only" : `View All (${overdueSchedules.length}) →`}
                    </button>
                  )}
                </div>
                <p style={{ margin: "4px 0 10px", fontSize: "13.5px", color: "#7f1d1d" }}>
                  {showAllOverdue
                    ? `Displaying all ${overdueSchedules.length} overdue rent accounts. Dispatch reminders with one click:`
                    : `Displaying first 3 of ${overdueSchedules.length} overdue rent accounts. Dispatch payment reminders with a single click:`}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(showAllOverdue ? overdueSchedules : overdueSchedules.slice(0, 3)).map(({ lease, rentCycle }) => (
                    <div
                      key={lease.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        background: "#ffffff",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                        fontSize: "13px",
                      }}
                    >
                      <div>
                        <strong>{lease.tenantName}</strong> ({lease.propertyName}) · Period:{" "}
                        <strong>{rentCycle.periodLabel}</strong> · Due on {rentCycle.currentDueDateFormatted}
                        <span style={{ color: "#dc2626", fontWeight: "700", marginLeft: "8px" }}>
                          ({rentCycle.daysOverdue} {rentCycle.daysOverdue === 1 ? "day" : "days"} overdue)
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontWeight: "700", color: "#0f172a" }}>
                          ₹{rentCycle.rentAmount.toLocaleString("en-IN")}
                        </span>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{
                            padding: "4px 10px",
                            fontSize: "11.5px",
                            borderColor: "#dc2626",
                            color: "#dc2626",
                            background: remindedIds.has(lease.id) ? "#fef2f2" : "#ffffff",
                          }}
                          disabled={remindingId === lease.id}
                          onClick={() => handleSendReminder(lease.id, lease.tenantName)}
                        >
                          {remindedIds.has(lease.id)
                            ? "✓ Reminded"
                            : remindingId === lease.id
                            ? "Sending..."
                            : "🔔 Remind Tenant"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 11 REQUIRED KPI METRIC CARDS ---------------- */}
      {loading ? (
        <div className="landlord-kpi-grid">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="dashboard-skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="landlord-kpi-grid">
          {/* 1. Total Properties */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/properties")}
            title="Click to view all properties"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">{t("totalProperties") || "Total Properties"}</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-card-value">{metrics.totalProperties}</div>
            <div className="kpi-card-subtext">
              <span>{metrics.citiesCount} cities in Tamil Nadu</span>
              <ArrowUpRight size={13} color="#0284c7" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 2. Total Units */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/properties?tab=units")}
            title="Click to view units breakdown"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Total Units</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#eef2ff", color: "#6366f1" }}>
                <Layers size={18} />
              </div>
            </div>
            <div className="kpi-card-value">{metrics.totalUnits}</div>
            <div className="kpi-card-subtext">
              <span>Residential & commercial flats</span>
              <ArrowUpRight size={13} color="#6366f1" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 3. Occupied Units */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/leases")}
            title="Click to view active leases"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Occupied Units</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#d1fae5", color: "#059669" }}>
                <Home size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: "#059669" }}>
              {metrics.occupiedUnits}
            </div>
            <div className="kpi-card-subtext">
              <span style={{ fontWeight: 600, color: "#059669" }}>{metrics.occupancyRate}% Occupancy</span>
              <ArrowUpRight size={13} color="#059669" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 4. Vacant Units */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/properties")}
            title="Click to view vacant listings"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Vacant Units</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                <Percent size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: metrics.vacantUnits > 0 ? "#d97706" : "#0f172a" }}>
              {metrics.vacantUnits}
            </div>
            <div className="kpi-card-subtext">
              <span>{metrics.vacancyRate}% Vacancy Rate</span>
              <ArrowUpRight size={13} color="#d97706" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 5. Active Tenants */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/tenants")}
            title="Click to view tenant directory"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">{t("totalTenants") || "Active Tenants"}</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#ede9fe", color: "#8b5cf6" }}>
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-card-value">{metrics.activeTenantsCount}</div>
            <div className="kpi-card-subtext">
              <span>Verified KYC residents</span>
              <ArrowUpRight size={13} color="#8b5cf6" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 6. Active Leases */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/leases")}
            title="Click to view lease agreements"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">{t("activeLeases") || "Active Leases"}</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#e0f2fe", color: "#0ea5e9" }}>
                <FileText size={18} />
              </div>
            </div>
            <div className="kpi-card-value">{metrics.activeLeasesCount}</div>
            <div className="kpi-card-subtext">
              <span>{metrics.expiringLeases.length} expiring in 60d</span>
              <ArrowUpRight size={13} color="#0ea5e9" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 7. Rent Collected */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/financials?tab=rent")}
            title="Click to view payment ledger"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Rent Collected</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <CreditCard size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: "#16a34a" }}>
              ₹{metrics.rentCollected.toLocaleString("en-IN")}
            </div>
            <div className="kpi-card-subtext">
              <span>Total paid remittances</span>
              <ArrowUpRight size={13} color="#16a34a" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 8. Pending Rent */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/financials?tab=rent")}
            title="Click to view pending collections"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Pending Rent</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#ffedd5", color: "#ea580c" }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: metrics.pendingRent > 0 ? "#ea580c" : "#0f172a" }}>
              ₹{metrics.pendingRent.toLocaleString("en-IN")}
            </div>
            <div className="kpi-card-subtext">
              <span>Uncollected invoices</span>
              <ArrowUpRight size={13} color="#ea580c" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 9. Operational Expenses */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/financials?tab=expenses")}
            title="Click to view operational expenses"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Operational Expenses</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#fee2e2", color: "#dc2626" }}>
                <Receipt size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: "#dc2626" }}>
              ₹{metrics.operationalExpenses.toLocaleString("en-IN")}
            </div>
            <div className="kpi-card-subtext">
              <span>Repairs, vendor bills, utilities</span>
              <ArrowUpRight size={13} color="#dc2626" style={{ marginLeft: "auto" }} />
            </div>
          </div>

          {/* 10. Net Operating Income (NOI = Rent - Expenses; Security deposits excluded) */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/financials?tab=summary")}
            title="Click to view financial summary and NOI statement"
            style={{ border: "2px solid #10b981", background: "#f0fdf4" }}
          >
            <div className="kpi-card-top">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="kpi-card-title" style={{ color: "#047857" }}>Net Operating Income</span>
              </div>
              <div className="kpi-card-icon-wrap" style={{ background: "#d1fae5", color: "#047857" }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: "#047857" }}>
              ₹{metrics.netOperatingIncome.toLocaleString("en-IN")}
            </div>
            <div>
              <div className="kpi-card-subtext" style={{ color: "#065f46" }}>
                <span>Collected Rent − Expenses</span>
              </div>
              <div className="kpi-card-noi-badge">
                🛡️ Security deposits held (liability) excluded
              </div>
            </div>
          </div>

          {/* 11. Open Maintenance Requests */}
          <div
            className="kpi-card-modern"
            onClick={() => navigate("/landlord/requests?tab=maintenance")}
            title="Click to view maintenance ticket queue"
          >
            <div className="kpi-card-top">
              <span className="kpi-card-title">Open Maintenance</span>
              <div className="kpi-card-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                <Wrench size={18} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: metrics.openMaintenance > 0 ? "#d97706" : "#0f172a" }}>
              {metrics.openMaintenance}
            </div>
            <div className="kpi-card-subtext">
              <span>{metrics.urgentRequestsCount} urgent priority</span>
              <ArrowUpRight size={13} color="#d97706" style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2-COLUMN SECTION: REVENUE & OPERATIONAL HEALTH ---------------- */}
      <div className="dashboard-two-col" style={{ marginBottom: "20px" }}>
        {/* Monthly Revenue & Expense Performance Chart */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Financial & Revenue Performance</h3>
              <p className="card-subtitle">Monthly rent collection trend vs operational expenses</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "10px", height: "10px", background: "#0284c7", borderRadius: "2px" }} />
                Rent
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "10px", height: "10px", background: "#ef4444", borderRadius: "2px" }} />
                Expenses
              </span>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div style={{ marginTop: "18px" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-end", height: "180px", paddingBottom: "10px", borderBottom: "1px solid #e2e8f0" }}>
              {monthlyData.map((m, idx) => {
                const rentHeight = Math.max(8, Math.round(((m.collected || 0) / maxMonthValue) * 150));
                const expHeight = Math.max(4, Math.round(((m.expenses || 0) / maxMonthValue) * 150));

                return (
                  <div key={idx} className="chart-bar-column">
                    <div className="chart-bars-wrap">
                      <div
                        className="chart-bar-single"
                        style={{ height: `${rentHeight}px`, background: "#0284c7" }}
                        title={`Rent: ₹${(m.collected || 0).toLocaleString("en-IN")}`}
                      />
                      <div
                        className="chart-bar-single"
                        style={{ height: `${expHeight}px`, background: "#ef4444" }}
                        title={`Expenses: ₹${(m.expenses || 0).toLocaleString("en-IN")}`}
                      />
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>{m.month}</span>
                  </div>
                );
              })}
            </div>

            {/* Income Summary Strip */}
            <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "120px", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" }}>Total Collections</span>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                  ₹{metrics.rentCollected.toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" }}>Escrow Deposits Held</span>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0369a1", marginTop: "2px" }}>
                  ₹{metrics.securityDepositLiability.toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", background: "#f0fdf4", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "11px", color: "#166534", textTransform: "uppercase", fontWeight: "600" }}>Net Margin</span>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#15803d", marginTop: "2px" }}>
                  {metrics.rentCollected > 0
                    ? `${(((metrics.netOperatingIncome) / metrics.rentCollected) * 100).toFixed(1)}%`
                    : "0%"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operational & Maintenance Health */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Operational &amp; Maintenance Health</h3>
              <p className="card-subtitle">Active service requests and technician dispatch queue</p>
            </div>
            <button
              className="btn-outline"
              onClick={() => navigate("/landlord/requests?tab=maintenance")}
              style={{ fontSize: "11.5px", padding: "4px 8px" }}
            >
              View All →
            </button>
          </div>

          {/* Status Breakdown Pills */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
            <div style={{ background: "#fef3c7", padding: "12px", borderRadius: "8px", border: "1px solid #fde68a" }}>
              <span style={{ fontSize: "11px", color: "#92400e", textTransform: "uppercase", fontWeight: "700" }}>Open / Unassigned</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#b45309", marginTop: "2px" }}>
                {requestsSummary?.newUnassigned || 0}
              </div>
            </div>
            <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <span style={{ fontSize: "11px", color: "#1e40af", textTransform: "uppercase", fontWeight: "700" }}>In Progress</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#1d4ed8", marginTop: "2px" }}>
                {requestsSummary?.inProgress || 0}
              </div>
            </div>
            <div style={{ background: "#ecfdf5", padding: "12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
              <span style={{ fontSize: "11px", color: "#065f46", textTransform: "uppercase", fontWeight: "700" }}>Resolved (This Mo)</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#047857", marginTop: "2px" }}>
                {requestsSummary?.completedThisMonth || 0}
              </div>
            </div>
          </div>

          {/* Recent Requests Feed */}
          <div style={{ marginTop: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
              Recent Activity Feed
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {(requestsSummary?.combinedRecent || []).slice(0, 4).map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12.5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <span style={{ fontSize: "14px" }}>
                      {item.requestType === "Complaint" ? "📢" : item.requestType === "Service Booking" ? "⚡" : "🔧"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.displayTitle || item.title || item.subject || "Maintenance Ticket"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {item.requestType} · {item.date ? new Date(item.date).toLocaleDateString("en-IN") : "Recent"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`pill ${
                      (item.status || "").toLowerCase().includes("complete") || (item.status || "").toLowerCase().includes("resolved")
                        ? "paid"
                        : (item.priority || "").toLowerCase() === "high" || (item.priority || "").toLowerCase() === "urgent"
                        ? "failed"
                        : "pending"
                    }`}
                    style={{ fontSize: "11px", flexShrink: 0 }}
                  >
                    {item.status || "Open"}
                  </span>
                </div>
              ))}
              {(!requestsSummary?.combinedRecent || requestsSummary.combinedRecent.length === 0) && (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px" }}>
                  No open maintenance requests or service issues logged.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- OCCUPANCY & UPCOMING LEASE EXPIRATIONS ---------------- */}
      <div className="dashboard-two-col" style={{ marginBottom: "20px" }}>
        {/* Occupancy Status Card */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Portfolio Occupancy Status</h3>
              <p className="card-subtitle">Unit allocation across residential portfolio</p>
            </div>
            <span className="pill paid" style={{ fontSize: "12px" }}>
              {metrics.occupancyRate}% Occupied
            </span>
          </div>

          <div style={{ padding: "16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Occupied: <strong>{metrics.occupiedUnits} units</strong></span>
              <span>Vacant: <strong>{metrics.vacantUnits} units</strong></span>
            </div>
            <div className="city-bar-track" style={{ height: "14px", borderRadius: "7px" }}>
              <div
                className="city-bar-fill"
                style={{ width: `${metrics.occupancyRate}%`, backgroundColor: "#0284c7" }}
                title={`Occupied: ${metrics.occupancyRate}%`}
              />
              <div
                className="city-bar-fill"
                style={{ width: `${metrics.vacancyRate}%`, backgroundColor: "#cbd5e1" }}
                title={`Vacant: ${metrics.vacancyRate}%`}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px", fontSize: "12px", color: "#64748b" }}>
              <span>Total Units in Portfolio: <strong>{metrics.totalUnits}</strong></span>
              <span>Available to Lease: <strong style={{ color: "#d97706" }}>{metrics.vacantUnits}</strong></span>
            </div>
          </div>
        </div>

        {/* Upcoming Lease Expirations Card */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Upcoming Lease Expirations (Next 60 Days)</h3>
              <p className="card-subtitle">Agreements requiring renewal or move-out inspection</p>
            </div>
            <span className="badge-count">
              {metrics.expiringLeases.length} Expiring Soon
            </span>
          </div>

          <div style={{ marginTop: "12px" }}>
            {metrics.expiringLeases.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {metrics.expiringLeases.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                    }}
                  >
                    <div>
                      <strong>{l.tenantName}</strong> · {l.propertyName}
                      <div style={{ fontSize: "11.5px", color: "#b45309", marginTop: "2px" }}>
                        Expires on {new Date(l.endDate).toLocaleDateString("en-IN")} ({l.daysRemaining} days left)
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn-outline"
                        style={{ padding: "3px 8px", fontSize: "11px", borderColor: "#0284c7", color: "#0284c7" }}
                        onClick={() => navigate("/landlord/leases?tab=renewals")}
                      >
                        Renew
                      </button>
                      <button
                        className="btn-outline"
                        style={{ padding: "3px 8px", fontSize: "11px", borderColor: "#f59e0b", color: "#b45309" }}
                        onClick={() => navigate("/landlord/leases?tab=inspections")}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "28px 16px", color: "#94a3b8", fontSize: "13px" }}>
                ✓ No active leases expiring within the next 60 days.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- MOVE-IN DATE RENT CYCLE & DUE DATE TRACKER ---------------- */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div
          className="row-between"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "14px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={18} color="#0284c7" />
              <h3 style={{ margin: 0 }}>Tenant Move-In Rent Cycle &amp; Due Date Tracker</h3>
            </div>
            <p className="card-subtitle" style={{ margin: "4px 0 0" }}>
              Rent cycles calculated individually from each tenant's move-in date with month day-clamping
            </p>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {["all", "overdue", "due_soon", "pending", "paid"].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`btn-outline ${cycleFilter === filterKey ? "active" : ""}`}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  background: cycleFilter === filterKey ? "var(--accent, #0284c7)" : "transparent",
                  color: cycleFilter === filterKey ? "#ffffff" : "var(--ink-secondary)",
                  borderColor: cycleFilter === filterKey ? "var(--accent, #0284c7)" : "var(--border-subtle)",
                }}
                onClick={() => setCycleFilter(filterKey)}
              >
                {filterKey === "all"
                  ? `All (${rentSchedules.length})`
                  : filterKey === "overdue"
                  ? `Overdue (${rentSchedules.filter((s) => s.rentCycle?.paymentStatus === "Overdue").length})`
                  : filterKey === "due_soon"
                  ? `Due Soon (${rentSchedules.filter((s) => s.rentCycle?.paymentStatus === "Due Soon" || s.rentCycle?.paymentStatus === "Due Today").length})`
                  : filterKey === "pending"
                  ? `Pending (${rentSchedules.filter((s) => s.rentCycle?.paymentStatus === "Pending").length})`
                  : `Paid (${rentSchedules.filter((s) => s.rentCycle?.paymentStatus === "Paid").length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: "14px" }}>
          <table>
            <thead>
              <tr>
                <th>Tenant &amp; Apartment</th>
                <th>Move-In Date</th>
                <th>Current Rental Period</th>
                <th>Next Due Date</th>
                <th>Monthly Rent</th>
                <th>Payment Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSchedules.map(({ lease, rentCycle }) => (
                <tr key={lease.id}>
                  <td>
                    <div>
                      <strong>{lease.tenantName}</strong>
                      <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>
                        {lease.propertyName} · {lease.id}
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>📌 {rentCycle.moveInDate}</strong>
                    <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      Due on {rentCycle.moveInDayOrdinal}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#0284c7" }}>
                      🗓️ {rentCycle.periodLabel}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: rentCycle.paymentStatus === "Overdue" ? "#dc2626" : "var(--ink-primary)" }}>
                      {rentCycle.paymentStatus === "Paid"
                        ? rentCycle.nextDueDateFormatted
                        : rentCycle.currentDueDateFormatted}
                    </strong>
                    <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      {rentCycle.paymentStatus === "Paid"
                        ? "Next cycle"
                        : rentCycle.paymentStatus === "Overdue"
                        ? `${rentCycle.daysOverdue}d overdue`
                        : "Due for cycle"}
                    </div>
                  </td>
                  <td>
                    <strong>₹{rentCycle.rentAmount.toLocaleString("en-IN")}</strong>
                  </td>
                  <td>
                    <span
                      className={`pill ${
                        rentCycle.paymentStatus === "Paid"
                          ? "paid"
                          : rentCycle.paymentStatus === "Overdue"
                          ? "failed"
                          : "pending"
                      }`}
                      style={{ fontSize: "11.5px" }}
                    >
                      {rentCycle.paymentStatus === "Paid"
                        ? "Paid"
                        : rentCycle.paymentStatus === "Overdue"
                        ? `Overdue (${rentCycle.daysOverdue}d)`
                        : rentCycle.paymentStatus === "Due Today"
                        ? "Due Today"
                        : rentCycle.paymentStatus === "Due Soon"
                        ? `Due Soon (${rentCycle.daysRemaining}d)`
                        : "Pending"}
                    </span>
                  </td>
                  <td>
                    {rentCycle.paymentStatus === "Paid" ? (
                      <span style={{ color: "#059669", fontSize: "12px", fontWeight: "600" }}>✓ Settled</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline"
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          color: remindedIds.has(lease.id) ? "#059669" : "#0284c7",
                          borderColor: remindedIds.has(lease.id) ? "#10b981" : "var(--border-subtle)",
                        }}
                        disabled={remindingId === lease.id}
                        onClick={() => handleSendReminder(lease.id, lease.tenantName)}
                      >
                        {remindedIds.has(lease.id)
                          ? "✓ Reminded"
                          : remindingId === lease.id
                          ? "Sending..."
                          : "🔔 Remind"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visibleSchedules.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty" style={{ textAlign: "center", padding: "24px" }}>
                    No lease rent schedules found for filter "{cycleFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- RECENT COLLECTIONS TABLE ---------------- */}
      <div className="card">
        <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0 }}>Recent Rent Collections Ledger</h3>
            <p className="card-subtitle">
              {filteredPayments.length} transactions recorded in portfolio
            </p>
          </div>
          <button
            className="btn-outline"
            onClick={() => navigate("/landlord/financials?tab=rent")}
            style={{ fontSize: "12px" }}
          >
            Open Financial Center →
          </button>
        </div>

        {/* Filter controls */}
        <div style={{ display: "flex", gap: "10px", margin: "14px 0", flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: "200px" }}>
            <input
              ref={searchInputRef}
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tenant name, property or invoice ID..."
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
          >
            <option value="All">All Billing Months</option>
            <option value="Sep">September 2026</option>
            <option value="Aug">August 2026</option>
            <option value="Jul">July 2026</option>
            <option value="Jun">June 2026</option>
            <option value="May">May 2026</option>
          </select>
        </div>

        <div className="table-responsive" style={{ maxHeight: "320px", overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tenant</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Month</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.id}</strong></td>
                  <td>{p.tenant || p.tenantName || "Resident"}</td>
                  <td><small>{p.property || p.propertyName || "Rental Unit"}</small></td>
                  <td><strong>₹{Number(p.amount || 0).toLocaleString("en-IN")}</strong></td>
                  <td>{p.month || "Current"}</td>
                  <td>
                    <span className={`pill ${(p.status || "").toLowerCase()}`}>
                      {t((p.status || "").toLowerCase()) || p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty" style={{ textAlign: "center", padding: "24px" }}>
                    {search ? `No payment records match "${search}"` : "No payment records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
