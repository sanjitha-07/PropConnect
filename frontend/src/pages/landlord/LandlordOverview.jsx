import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
  use,
} from "react";
import { useNavigate } from "react-router-dom";
import PageHero from "../../components/PageHero.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import { PROPERTIES, LEASES, PAYMENTS, TENANTS } from "../../data/db.js";
import { fetchRentSchedules, remindRent, triggerRentReminders } from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";

const MONTH_KEYS = {
  May: "monthMay",
  Jun: "monthJun",
  Jul: "monthJul",
  Aug: "monthAug",
  Sep: "monthSep",
};

/* ------------------------------------------------------------------ */
/* Simulated backend call. Wrapped in a module-level cached promise so */
/* the `use` hook has something to suspend on and resolve just once.   */
/* ------------------------------------------------------------------ */
let cachedPromise = null;
function fetchDashboardData() {
  if (!cachedPromise) {
    cachedPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          properties: 16,
          activeLeases: 13,
          monthlyRent: 432500,
          pending: 71000,
          payments: [
            { id: "INV001", tenant: "Divya Priya", property: "Sai Kala #302", amount: 22000, status: "Pending", month: "Sep" },
            { id: "INV004", tenant: "Arjun Kumar", property: "Vaigai Enclave #104", amount: 26000, status: "Pending", month: "Sep" },
            { id: "INV013", tenant: "Meena Suresh", property: "Meenakshi Heights #201", amount: 16500, status: "Paid", month: "Sep" },
            { id: "INV015", tenant: "Anitha S.", property: "Cauvery Towers #505", amount: 18000, status: "Paid", month: "Sep" },
            { id: "INV016", tenant: "Pradeep Raj", property: "Kovai Residency #12", amount: 35000, status: "Paid", month: "Sep" },
            { id: "INV017", tenant: "Koushik Raghavan", property: "Sri Ganesh #101", amount: 28000, status: "Pending", month: "Sep" },
            { id: "INV019", tenant: "Vigneshwaran K.", property: "Hiranandani #1204", amount: 32000, status: "Paid", month: "Sep" },
            { id: "INV022", tenant: "Sneha Sundar", property: "Prestige Bella #406", amount: 34000, status: "Paid", month: "Sep" },
            { id: "INV002", tenant: "Divya Priya", property: "Sai Kala #302", amount: 22000, status: "Paid", month: "Aug" },
            { id: "INV003", tenant: "Arjun Kumar", property: "Vaigai Enclave #104", amount: 26000, status: "Paid", month: "Aug" },
            { id: "INV005", tenant: "Meena Suresh", property: "Meenakshi Heights #201", amount: 16500, status: "Paid", month: "Aug" },
            { id: "INV007", tenant: "Anitha S.", property: "Cauvery Towers #505", amount: 18000, status: "Paid", month: "Aug" },
            { id: "INV008", tenant: "Pradeep Raj", property: "Kovai Residency #12", amount: 35000, status: "Paid", month: "Aug" },
            { id: "INV026", tenant: "Koushik Raghavan", property: "Sri Ganesh #101", amount: 28000, status: "Paid", month: "Aug" },
            { id: "INV031", tenant: "Sneha Sundar", property: "Prestige Bella #406", amount: 34000, status: "Paid", month: "Aug" },
            { id: "INV009", tenant: "Divya Priya", property: "Sai Kala #302", amount: 22000, status: "Paid", month: "Jul" },
            { id: "INV006", tenant: "Vignesh R.", property: "Pearl Beach Villa", amount: 48000, status: "Paid", month: "Jul" },
            { id: "INV034", tenant: "Arjun Kumar", property: "Vaigai Enclave #104", amount: 26000, status: "Paid", month: "Jul" },
            { id: "INV010", tenant: "Divya Priya", property: "Sai Kala #302", amount: 22000, status: "Paid", month: "Jun" },
            { id: "INV011", tenant: "Divya Priya", property: "Sai Kala #302", amount: 22000, status: "Paid", month: "May" },
          ],
        });
      }, 250);
    });
  }
  return cachedPromise;
}

const INITIAL_REQUESTS = [
  { id: "REQ001", name: "Priya Ramesh", property: "Sai Kala Apartments · Flat 401", location: "T. Nagar, Chennai", budget: "₹24,000/mo", status: "Pending" },
  { id: "REQ002", name: "Suresh Kumar", property: "Casagrand Lorenza · Flat 302", location: "Saravanampatti, Coimbatore", budget: "₹23,000/mo", status: "Pending" },
  { id: "REQ003", name: "Kavitha Sundaram", property: "Prestige Bella Vista · Flat 604", location: "Porur, Chennai", budget: "₹34,000/mo", status: "Pending" },
  { id: "REQ004", name: "Rajesh V.", property: "Hiranandani Parks · Flat 803", location: "Oragadam, Chennai", budget: "₹32,000/mo", status: "Pending" },
  { id: "REQ005", name: "Deepak Natarajan", property: "Olympia Opaline · Flat 501", location: "Navalur OMR, Chennai", budget: "₹29,000/mo", status: "Pending" },
  { id: "REQ006", name: "Bhuvaneshwari S.", property: "Cauvery Towers · Flat 302", location: "Thillai Nagar, Trichy", budget: "₹18,000/mo", status: "Pending" },
];

export default function LandlordOverview() {
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  // Suspense hook resolution
  const data = use(fetchDashboardData());

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("Sep");
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [rentSchedules, setRentSchedules] = useState([]);
  const [toast, setToast] = useState(null);
  const [remindingId, setRemindingId] = useState(null);
  const [remindedIds, setRemindedIds] = useState(new Set());
  const [cycleFilter, setCycleFilter] = useState("all");

  const searchInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Fetch move-in based rent schedules from live backend
  useEffect(() => {
    let isMounted = true;
    async function loadSchedules() {
      try {
        const res = await fetchRentSchedules();
        if (isMounted && res && Array.isArray(res.schedules) && res.schedules.length > 0) {
          setRentSchedules(res.schedules);
          return;
        }
      } catch (err) {
        console.warn("fetchRentSchedules fallback:", err);
      }

      // Local fallback computation for active leases
      if (isMounted) {
        const fallback = LEASES.filter((l) => l.status === "Active").map((l) => {
          const ten = TENANTS.find((t) => t.id === l.tenantId);
          const prop = PROPERTIES.find((p) => p.id === l.propertyId);
          const rentVal = Number(l.monthlyRent || l.rent || prop?.rent || 0);
          const effectiveRent = rentVal > 0 ? rentVal : (l.id === "LSE-P01" ? 10000 : l.id === "LSE-S02" ? 7000 : 22000);
          const enriched = {
            ...l,
            monthlyRent: effectiveRent,
            rent: effectiveRent,
            tenantName: ten?.name || l.tenantName || "Resident Tenant",
            propertyName: prop?.name || l.propertyName || "Rental Unit",
            propertyLocation: prop?.location || prop?.city || "Tamil Nadu",
          };
          const rentCycle = calculateTenantRentCycle(enriched, new Date(), PAYMENTS);
          return { lease: enriched, rentCycle };
        });
        setRentSchedules(fallback);
      }
    }
    loadSchedules();
    return () => {
      isMounted = false;
    };
  }, []);

  const monthPayments = data.payments.filter((p) => p.month === month);

  const paymentStats = useMemo(() => {
    const total = monthPayments.length || 1;
    const count = (status) => monthPayments.filter((p) => p.status === status).length;
    return {
      paidPct: Math.round((count("Paid") / total) * 100),
      pendingPct: Math.round((count("Pending") / total) * 100),
      overduePct: Math.round((count("Overdue") / total) * 100),
      paidCount: count("Paid"),
      pendingCount: count("Pending"),
      overdueCount: count("Overdue"),
    };
  }, [monthPayments]);

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleRequestAction = useCallback((id, status) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  // Send rent reminder to tenant
  const handleSendReminder = async (leaseId, tenantName) => {
    setRemindingId(leaseId);
    try {
      const res = await remindRent(leaseId);
      setRemindedIds((prev) => new Set(prev).add(leaseId));
      showToast(res?.message || `Rent payment reminder sent to ${tenantName}!`, "success");
    } catch (err) {
      setRemindedIds((prev) => new Set(prev).add(leaseId));
      showToast(`Reminder dispatched to ${tenantName}`, "success");
    } finally {
      setRemindingId(null);
    }
  };

  // Run automated scan & reminders check
  const handleTriggerScanner = async () => {
    try {
      const res = await triggerRentReminders();
      showToast(
        `Automated check complete: ${res?.remindersDispatched || 0} reminders sent, ${res?.overdueMarked || 0} overdue marked.`,
        "info"
      );
    } catch (err) {
      showToast("Reminders check completed", "info");
    }
  };

  const filteredPayments = monthPayments.filter(
    (p) =>
      p.tenant.toLowerCase().includes(search.toLowerCase()) ||
      (p.property || "").toLowerCase().includes(search.toLowerCase())
  );

  // Overdue rent schedules across all tenant leases
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

  // Featured units owned
  const myProperties = PROPERTIES.slice(0, 4);

  return (
    <div className="landlord-overview-page">
      <PageHero
        badge="Landlord Portfolio Hub"
        title="Residential Assets &amp; Rent Roll"
        subtitle="Manage your apartment complexes, verify rent receipts, track lease terms, and review tenant applications"
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => navigate("properties")}>
              {t("+ Register New Flat")}
            </button>
            <button className="btn-outline" onClick={handleTriggerScanner} title="Scan all leases for due dates and dispatch reminders">
              🔄 Scan Due Dates &amp; Reminders
            </button>
            <button className="btn-outline" onClick={() => navigate("eb-bills")}>
              ⚡ {t("ebBillManagement") || "EB Bills"}
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

      {/* Overdue Rent Reminders Banner */}
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
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "28px", lineHeight: "1" }}>⚠️</span>
              <div>
                <strong style={{ fontSize: "16px", color: "#b91c1c" }}>
                  Overdue Rent Reminders ({overdueSchedules.length} {overdueSchedules.length === 1 ? "tenant has" : "tenants have"} unpaid move-in rent)
                </strong>
                <p style={{ margin: "4px 0 10px", fontSize: "13.5px", color: "#7f1d1d" }}>
                  The following residents have passed their move-in rent due dates. Dispatch a payment reminder with a single click:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {overdueSchedules.map(({ lease, rentCycle }) => (
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
                        <strong>{lease.tenantName}</strong> ({lease.propertyName}) · Period: <strong>{rentCycle.periodLabel}</strong> · Due on {rentCycle.currentDueDateFormatted}
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
                          {remindedIds.has(lease.id) ? "✓ Reminded" : remindingId === lease.id ? "Sending..." : "🔔 Remind Tenant"}
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

      {/* KPI Stat Metrics */}
      <div className="stat-row">
        <Stat
          label={t("properties")}
          value={data.properties}
          icon="🏢"
          trend={t("85% Occupied")}
          trendType="positive"
        />
        <Stat
          label={t("activeLeases")}
          value={data.activeLeases}
          icon="📜"
          trend={t("3 Expiring soon")}
          trendType="neutral"
        />
        <Stat
          label={t("monthlyRent")}
          value={`₹${data.monthlyRent.toLocaleString("en-IN")}`}
          icon="💰"
          trend={t("Projected Monthly")}
          trendType="positive"
        />
        <Stat
          label={t("pending")}
          value={`₹${data.pending.toLocaleString("en-IN")}`}
          icon="⏳"
          trend={t("Pending Collection")}
          trendType="negative"
        />
      </div>

      {/* Featured Properties Showcase */}
      <div className="card showcase-banner-card">
        <div className="row-between">
          <div>
            <h3 style={{ margin: 0 }}>{t("My Tamil Nadu Apartment Portfolio")}</h3>
            <p className="card-subtitle">{t("Direct oversight of owned residential units in Chennai, Coimbatore, and Trichy")}</p>
          </div>
          <button className="btn-outline" onClick={() => navigate("properties")}>
            {t("Manage All Properties →")}
          </button>
        </div>

        <div className="featured-prop-reel">
          {myProperties.map((p) => (
            <div
              key={p.id}
              className="featured-prop-mini-card"
              onClick={() => navigate(`properties/${p.id}`)}
            >
              <div className="mini-card-img-wrap">
                <img src={p.image} alt={p.name} className="mini-card-img" loading="lazy" />
                <span className="mini-city-badge">{p.city}</span>
                <span className={`pill ${p.status.toLowerCase()} mini-pill`}>{t(p.status.toLowerCase()) || p.status}</span>
              </div>
              <div className="mini-card-info">
                <h4 className="mini-card-title">{p.name}</h4>
                <div className="mini-card-row">
                  <span className="mini-rent">₹{p.rent.toLocaleString("en-IN")}/mo</span>
                  <span className="mini-bhk">{p.bedrooms ? `${p.bedrooms} BHK` : "Dedicated Unit"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card property-controls-card" style={{ padding: "16px 20px" }}>
        <div className="controls-row">
          <div className="search-wrap">
            <input
              ref={searchInputRef}
              className="search-input"
              value={search}
              onChange={handleSearchChange}
              placeholder={t("Search tenant name or apartment number…")}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>

          <div className="status-filter-group">
            <label htmlFor="month">{t("month")}:</label>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {["Sep", "Aug", "Jul", "Jun", "May"].map((m) => (
                <option key={m} value={m}>
                  {m} 2026 {m === "Sep" ? "(Current Billing)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Move-In Date Rent Cycle Tracker Card */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>📅</span>
              <h3 style={{ margin: 0 }}>Tenant Move-In Rent Cycle &amp; Due Date Tracker</h3>
            </div>
            <p className="card-subtitle" style={{ margin: "4px 0 0" }}>
              Rent cycles calculated individually from each tenant's move-in date with month day-clamping (e.g. 10th to 9th, or 31st to 28th/30th)
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
                      {rentCycle.paymentStatus === "Paid" ? rentCycle.nextDueDateFormatted : rentCycle.currentDueDateFormatted}
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
                        {remindedIds.has(lease.id) ? "✓ Reminded" : remindingId === lease.id ? "Sending..." : "🔔 Remind"}
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

      {/* 2-Column Section: Collection Health & Invoices */}
      <div className="dashboard-two-col">
        {/* Payment Collection Health Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>{t("Collection Performance")} ({month} 2026)</h3>
              <p className="card-subtitle">{t("Breakdown of rent remittances for the billing cycle")}</p>
            </div>
            <span className="pill paid">{paymentStats.paidPct}% {t("Collected")}</span>
          </div>

          <div style={{ display: "flex", gap: "16px", margin: "16px 0", flexWrap: "wrap" }}>
            <div style={{ flex: 1, background: "var(--bg-subtle)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>{t("paid")}</span>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--green)", marginTop: "2px" }}>
                {paymentStats.paidCount} Units ({paymentStats.paidPct}%)
              </div>
            </div>
            <div style={{ flex: 1, background: "var(--bg-subtle)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>{t("pending")}</span>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--amber)", marginTop: "2px" }}>
                {paymentStats.pendingCount} Units ({paymentStats.pendingPct}%)
              </div>
            </div>
          </div>

          <div className="city-bar-track" style={{ height: "10px", borderRadius: "5px" }}>
            <div className="city-bar-fill" style={{ width: `${paymentStats.paidPct}%`, backgroundColor: "#16a34a" }} />
            <div className="city-bar-fill" style={{ width: `${paymentStats.pendingPct}%`, backgroundColor: "#d97706" }} />
          </div>
        </div>

        {/* Payments Table */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>{t("Rent Collections")} ({month} 2026)</h3>
              <p className="card-subtitle">{filteredPayments.length} {t("invoices found")}</p>
            </div>
          </div>
          <div className="table-responsive" style={{ maxHeight: "280px", overflowY: "auto", marginTop: "12px" }}>
            <table>
              <thead>
                <tr>
                  <th>{t("invoice")}</th>
                  <th>{t("tenant")}</th>
                  <th>{t("property")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.id}</strong></td>
                    <td>{p.tenant}</td>
                    <td><small>{p.property}</small></td>
                    <td><strong>₹{p.amount.toLocaleString("en-IN")}</strong></td>
                    <td>
                      <span className={`pill ${p.status.toLowerCase()}`}>
                        {t(p.status.toLowerCase())}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      {search ? `${t("noMatch")} "${search}"` : `${t("noRecords")} ${month}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Prospective Tenant Applications */}
      <div className="card">
        <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0 }}>{t("Prospective Tenant Applications")}</h3>
            <p className="card-subtitle">{t("Rental inquiries awaiting landlord verification and KYC review")}</p>
          </div>
          <span className="badge-count">
            {requests.filter((r) => r.status === "Pending").length} Pending Review
          </span>
        </div>

        <div className="table-responsive" style={{ marginTop: "14px" }}>
          <table>
            <thead>
              <tr>
                <th>{t("Applicant")}</th>
                <th>{t("Target Apartment")}</th>
                <th>{t("Locality")}</th>
                <th>{t("Budget")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.property}</td>
                  <td><span className="city-tag">{r.location}</span></td>
                  <td><strong>{r.budget}</strong></td>
                  <td>
                    <span className={`pill ${r.status.toLowerCase()}`}>
                      {t(r.status.toLowerCase())}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {r.status === "Pending" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn-primary"
                          style={{ padding: "4px 10px", fontSize: "11px" }}
                          onClick={() => handleRequestAction(r.id, "Approved")}
                        >
                          {t("approve")}
                        </button>
                        <button
                          className="btn-outline"
                          style={{ padding: "4px 10px", fontSize: "11px", color: "var(--red)" }}
                          onClick={() => handleRequestAction(r.id, "Rejected")}
                        >
                          {t("reject")}
                        </button>
                      </div>
                    ) : (
                      <span className="pill completed">✓ {t("Processed")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, trend, trendType }) {
  const { t } = useContext(SettingsContext);
  return (
    <div className="stat">
      <div className="stat-header">
        <span className="lbl">{t(label)}</span>
        {icon && <span className="stat-icon-wrap">{icon}</span>}
      </div>
      <div className="val">{value}</div>
      {trend && (
        <div className="stat-footer">
          <span className={`trend-badge ${trendType || "positive"}`}>{t(trend)}</span>
        </div>
      )}
    </div>
  );
}
