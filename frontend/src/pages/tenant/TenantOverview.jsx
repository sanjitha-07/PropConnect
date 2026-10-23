import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import StatRow from "../../components/StatRow.jsx";
import { fetchTenantPreferences, fetchRentSchedules, fetchPayments } from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import { LEASES, PAYMENTS, MAINTENANCE_REQUESTS, propertyById, landlordById } from "../../data/db.js";

export default function TenantOverview() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  const entityId = user?.entityId || user?.entity_id || "TEN001";
  const [savedPref, setSavedPref] = useState(null);
  const [liveRentCycle, setLiveRentCycle] = useState(null);
  const [livePayments, setLivePayments] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [pref, schedData, payData] = await Promise.all([
          fetchTenantPreferences(entityId).catch(() => null),
          fetchRentSchedules({ tenantId: entityId }).catch(() => null),
          fetchPayments(entityId).catch(() => null),
        ]);
        if (!isMounted) return;
        if (pref) setSavedPref(pref);

        if (Array.isArray(payData) && payData.length > 0) {
          setLivePayments(payData);
        }

        if (schedData && Array.isArray(schedData.schedules) && schedData.schedules.length > 0) {
          setLiveRentCycle(schedData.schedules[0].rentCycle);
        }
      } catch (err) {
        console.warn("Could not load tenant overview data:", err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  const lease =
    LEASES.find((l) => l.tenantId === entityId && l.status === "Active") ||
    LEASES.find((l) => l.tenantId === entityId);
  const property = lease ? propertyById(lease.propertyId) : (user?.isNewTenant ? null : propertyById("TN101"));
  const landlord = property ? landlordById(property.landlordId) : null;
  const myPayments = livePayments.length > 0 ? livePayments : PAYMENTS.filter((p) => p.tenantId === entityId);
  const pendingPayments = myPayments.filter((p) => p.status !== "Paid");
  const myMaintenance = MAINTENANCE_REQUESTS.filter((m) => m.tenantId === entityId);
  const openMaintenance = myMaintenance.filter((m) => m.status !== "Completed");

  // Fallback calculation if backend schedule not yet loaded
  const rentCycle = liveRentCycle || (lease ? calculateTenantRentCycle(lease, new Date(), myPayments) : null);

  const stats = [
    {
      label: "Allotted Apartment",
      value: property?.id || "Discovery Mode",
      icon: "🏢",
      trend: property?.city || savedPref?.city || "Tamil Nadu",
      trendType: "neutral",
    },
    {
      label: "Agreed Rent",
      value: rentCycle
        ? `₹${rentCycle.rentAmount.toLocaleString("en-IN")}/mo`
        : (lease
            ? `₹${(lease.monthlyRent || lease.rent || (lease.id === "LSE-P01" ? 10000 : lease.id === "LSE-S02" ? 7000 : 22000)).toLocaleString("en-IN")}/mo`
            : (savedPref?.budgetRange || "₹20,000–₹30,000")),
      icon: "💰",
      trend: rentCycle ? `Due on ${rentCycle.moveInDayOrdinal} (Move-in)` : "Move-in Cycle",
      trendType: "positive",
    },
    {
      label: "Rent Billing Status",
      value: rentCycle ? rentCycle.paymentStatus : (pendingPayments.length > 0 ? `${pendingPayments.length} Due` : "Settled"),
      icon: "💳",
      trend: rentCycle?.paymentStatus === "Paid" ? "All Settled" : (rentCycle?.paymentStatus === "Overdue" ? `Overdue by ${rentCycle.daysOverdue}d` : "Action Required"),
      trendType: rentCycle?.paymentStatus === "Paid" ? "positive" : (rentCycle?.paymentStatus === "Overdue" ? "negative" : "neutral"),
    },
    {
      label: "Service Requests",
      value: `${openMaintenance.length} Active`,
      icon: "⚙️",
      trend: `${myMaintenance.length} total tickets`,
      trendType: "neutral",
    },
  ];

  return (
    <div className="tenant-overview-page">
      <PageHero
        badge="Resident Living Portal"
        title="Tenant Residence & Billing Center"
        subtitle="Review your active tenancy lease, remit monthly rent online, inspect utility meters, and search verified properties"
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => navigate("properties")}>
              🔍 {t("Find My Home")}
            </button>
            <button className="btn-outline" onClick={() => navigate("payments")}>
              {t("Pay Rent Online")}
            </button>
            <button className="btn-outline" onClick={() => navigate("eb-bills")}>
              ⚡ {t("ebBills") || "EB Bills"}
            </button>
          </div>
        }
      />

      {/* Overdue / Due Soon Rent Alert Banner */}
      {rentCycle && rentCycle.paymentStatus === "Overdue" && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "20px",
            borderLeft: "5px solid #dc2626",
            background: "#fef2f2",
            color: "#991b1b",
            padding: "16px 20px",
            borderRadius: "10px",
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.12)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "28px" }}>⚠️</span>
              <div>
                <strong style={{ fontSize: "16px", color: "#b91c1c" }}>
                  Rent Overdue Reminder ({rentCycle.daysOverdue} {rentCycle.daysOverdue === 1 ? "day" : "days"} overdue)
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#7f1d1d" }}>
                  Your rent of <strong>₹{rentCycle.rentAmount.toLocaleString("en-IN")}</strong> for rental period <strong>{rentCycle.periodLabel}</strong> was due on <strong>{rentCycle.currentDueDateFormatted}</strong>. Please complete payment immediately.
                </p>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ background: "#dc2626", borderColor: "#dc2626", padding: "8px 18px", fontWeight: "600" }}
              onClick={() => navigate("payments")}
            >
              💳 Pay Overdue Rent Now
            </button>
          </div>
        </div>
      )}

      {rentCycle && rentCycle.paymentStatus === "Due Soon" && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "20px",
            borderLeft: "5px solid #f59e0b",
            background: "#fffbeb",
            color: "#92400e",
            padding: "16px 20px",
            borderRadius: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>⏰</span>
              <div>
                <strong style={{ fontSize: "15px", color: "#b45309" }}>
                  Upcoming Rent Due in {rentCycle.daysRemaining} {rentCycle.daysRemaining === 1 ? "day" : "days"} ({rentCycle.currentDueDateFormatted})
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#78350f" }}>
                  Rental period: <strong>{rentCycle.periodLabel}</strong> · Amount: <strong>₹{rentCycle.rentAmount.toLocaleString("en-IN")}</strong>
                </p>
              </div>
            </div>
            <button className="btn-primary" onClick={() => navigate("payments")}>
              Pay Rent Online
            </button>
          </div>
        </div>
      )}

      {/* Move-In Rent Cycle Spotlight Widget */}
      {rentCycle && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "20px",
            background: "linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(2, 132, 199, 0.04) 100%)",
            border: "1px solid var(--border-subtle, #e2e8f0)",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border-subtle, #e2e8f0)", paddingBottom: "14px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📅</span>
                <h3 style={{ margin: 0, fontSize: "17px", color: "var(--ink-primary)" }}>
                  Move-In Based Rent Cycle &amp; Billing Schedule
                </h3>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ink-muted)" }}>
                {rentCycle.cycleRuleDescription}
              </p>
            </div>
            <span
              className={`pill ${
                rentCycle.paymentStatus === "Paid"
                  ? "paid"
                  : rentCycle.paymentStatus === "Overdue"
                  ? "failed"
                  : "pending"
              }`}
              style={{ fontSize: "12px", fontWeight: "700", padding: "6px 14px" }}
            >
              {rentCycle.paymentStatus === "Paid"
                ? "✓ Rent Paid"
                : rentCycle.paymentStatus === "Overdue"
                ? `⚠️ Overdue (${rentCycle.daysOverdue}d)`
                : rentCycle.paymentStatus === "Due Today"
                ? "⚡ Due Today"
                : "⏳ Payment Pending"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "14px",
            }}
          >
            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: "600" }}>
                Move-In Date
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink-primary)", marginTop: "4px" }}>
                📌 {rentCycle.moveInDate}
              </div>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                Billing cycle starts on the {rentCycle.moveInDayOrdinal}
              </div>
            </div>

            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: "600" }}>
                Current Rental Period
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#0284c7", marginTop: "4px" }}>
                🗓️ {rentCycle.periodLabel}
              </div>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                Monthly tenancy cycle
              </div>
            </div>

            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: "600" }}>
                {rentCycle.paymentStatus === "Paid" ? "Next Rent Due Date" : "Rent Due Date"}
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: rentCycle.paymentStatus === "Overdue" ? "#dc2626" : "var(--ink-primary)",
                  marginTop: "4px",
                }}
              >
                ⏰ {rentCycle.paymentStatus === "Paid" ? rentCycle.nextDueDateFormatted : rentCycle.currentDueDateFormatted}
              </div>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                {rentCycle.paymentStatus === "Paid" ? "Upcoming cycle start" : "Due for current period"}
              </div>
            </div>

            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: "600" }}>
                Monthly Rent Amount
              </div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
                ₹{rentCycle.rentAmount.toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                Invoice: {rentCycle.invoiceNo}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcoming Property-Discovery Experience Card */}
      <div className="card new-tenant-welcome-banner animate-fade-in" style={{ marginBottom: "20px" }}>
        <div className="welcome-banner-content">
          <div className="welcome-banner-top-badge">✨ {t("Smart Property Discovery")}</div>
          <h2 className="welcome-banner-heading">
            {t("Welcome to PropConnect")}, {user?.name || t("Resident")}!
          </h2>
          <p className="welcome-banner-sub">
            {t("Let's find a home that fits your needs. Discover vetted residential apartments, independent villas, and gated communities across Chennai, Coimbatore, Madurai, Trichy, and Salem.")}
          </p>

          {savedPref && savedPref.city && (
            <div className="welcome-saved-pref-strip">
              <span className="pref-strip-label">{t("Your Saved Search:")}</span>
              <span className="pref-strip-tag">📍 {savedPref.city} {savedPref.locality ? `· ${savedPref.locality}` : ""}</span>
              <span className="pref-strip-tag">🛏️ {savedPref.bhk} BHK</span>
              <span className="pref-strip-tag">💰 {savedPref.budgetRange}</span>
              {savedPref.furnishing && savedPref.furnishing !== "No preference" && (
                <span className="pref-strip-tag">🛋️ {savedPref.furnishing}</span>
              )}
            </div>
          )}

          <div className="welcome-banner-actions">
            <button
              type="button"
              className="btn-primary welcome-btn"
              onClick={() => navigate("properties")}
            >
              🔍 {t("Find My Home")} →
            </button>
            <button
              type="button"
              className="btn-outline welcome-btn"
              onClick={() => navigate("properties?view=saved")}
            >
              ❤️ {t("My Saved Properties")}
            </button>
            <button
              type="button"
              className="btn-outline welcome-btn"
              onClick={() => navigate("properties")}
            >
              ⚙️ {t("View & Edit Preferences")}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <StatRow stats={stats} />

      {/* Leased Apartment Spotlight Card */}
      {property && (
        <div className="card my-apartment-spotlight">
          <div className="spotlight-badge-row">
            <span className="badge-city">{property.city}</span>
            <span className="pill active">{t("Active Lease Agreement")}</span>
            {lease && <span className="lease-reg-badge">{t("Govt Reg")}: {lease.regNumber || "TN-CH-REG-2026-8891"}</span>}
          </div>

          <div className="spotlight-content">
            <div className="spotlight-img-wrap" onClick={() => navigate(`properties/${property.id}`)}>
              <img src={property.image} alt={property.name} className="spotlight-img" loading="lazy" />
            </div>

            <div className="spotlight-details">
              <h3 className="spotlight-title" onClick={() => navigate(`properties/${property.id}`)}>
                {property.name}
              </h3>
              <p className="spotlight-loc">
                <span>📍</span> {property.location}
              </p>

              <div className="spotlight-specs">
                <span className="spec-pill">📐 {property.area} sqft</span>
                <span className="spec-pill">🛏 {property.bedrooms} BHK</span>
                <span className="spec-pill">🏢 {property.floor}</span>
                <span className="spec-pill">🧭 {property.facing}</span>
                <span className="spec-pill">⚡ EB: {property.ebConsumerNo}</span>
              </div>

              {landlord && (
                <div className="spotlight-landlord-hint">
                  <strong>{t("landlordDetails")}:</strong> {landlord.name} ({landlord.phone}) · {landlord.location}
                </div>
              )}

              <div className="spotlight-actions">
                <button className="btn-primary" onClick={() => navigate("payments")}>
                  {t("Pay Rent Online")}
                </button>
                <button className="btn-outline" onClick={() => navigate("maintenance")}>
                  {t("Raise Service Ticket")}
                </button>
                <button className="btn-outline" onClick={() => navigate(`properties/${property.id}`)}>
                  {t("View Unit Details →")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column: Recent Rent Invoices & Active Maintenance Requests */}
      <div className="dashboard-two-col">
        {/* Recent Rent Invoices */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>{t("My Rent Invoices")}</h3>
              <p className="card-subtitle">{t("Recent payment history and upcoming rental charges")}</p>
            </div>
            <button className="btn-outline" onClick={() => navigate("payments")}>
              {t("All Invoices →")}
            </button>
          </div>

          <div className="table-responsive" style={{ marginTop: "12px" }}>
            <table>
              <thead>
                <tr>
                  <th>{t("invoice")}</th>
                  <th>{t("month")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {myPayments.slice(0, 4).map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.id}</strong></td>
                    <td>{p.month}</td>
                    <td><strong>₹{p.amount.toLocaleString("en-IN")}</strong></td>
                    <td>
                      <span className={`pill ${p.status.toLowerCase()}`}>
                        {t(p.status.toLowerCase()) || p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Service Requests */}
        <div className="card">
          <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>{t("My Service Requests")}</h3>
              <p className="card-subtitle">{t("Technician and plumbing dispatches for this flat")}</p>
            </div>
            <button className="btn-outline" onClick={() => navigate("maintenance")}>
              {t("View All →")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
            {myMaintenance.slice(0, 4).map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--bg-subtle)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
                    {m.issueText || m.issue || "Maintenance Ticket"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                    Logged on {m.date} · Vendor: {m.vendor || "Assigned"}
                  </div>
                </div>
                <span className={`pill ${m.status === "Completed" ? "paid" : "pending"}`}>
                  {t(m.status.toLowerCase()) || m.status}
                </span>
              </div>
            ))}
            {myMaintenance.length === 0 && (
              <div className="empty" style={{ textAlign: "center", padding: "20px", color: "var(--ink-muted)" }}>
                {t("No maintenance tickets logged. Everything is in working order!")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
