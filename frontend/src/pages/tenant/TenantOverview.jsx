import { useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import {
  fetchTenantPreferences,
  fetchRentSchedules,
  fetchPayments,
  fetchUtilityBills,
} from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import {
  LEASES,
  PAYMENTS,
  MAINTENANCE_REQUESTS,
  propertyById,
  landlordById,
} from "../../data/db.js";
import {
  CreditCard,
  Building2,
  Wrench,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Zap,
  Sparkles,
  FileSignature,
  LifeBuoy,
  Phone,
  MapPin,
  Compass,
  DollarSign,
  Plus,
  ExternalLink,
  Receipt,
  FileText,
  ShieldCheck,
  Check
} from "lucide-react";

export default function TenantOverview() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();

  const entityId = user?.entityId || user?.entity_id || "TEN001";
  const [savedPref, setSavedPref] = useState(null);
  const [liveRentCycle, setLiveRentCycle] = useState(null);
  const [livePayments, setLivePayments] = useState([]);
  const [liveUtilityBills, setLiveUtilityBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [pref, schedData, payData, utilData] = await Promise.all([
          fetchTenantPreferences(entityId).catch(() => null),
          fetchRentSchedules({ tenantId: entityId }).catch(() => null),
          fetchPayments(entityId).catch(() => null),
          fetchUtilityBills({ tenantId: entityId }).catch(() => null),
        ]);
        if (!isMounted) return;
        if (pref) setSavedPref(pref);
        if (Array.isArray(payData) && payData.length > 0) {
          setLivePayments(payData);
        }
        if (Array.isArray(utilData) && utilData.length > 0) {
          setLiveUtilityBills(utilData);
        }
        if (
          schedData &&
          Array.isArray(schedData.schedules) &&
          schedData.schedules.length > 0
        ) {
          setLiveRentCycle(schedData.schedules[0].rentCycle);
        }
      } catch (err) {
        console.warn("Could not load tenant overview data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  // Lookup tenant active lease, property, landlord
  const lease =
    LEASES.find((l) => l.tenantId === entityId && l.status === "Active") ||
    LEASES.find((l) => l.tenantId === entityId);
  const property = lease
    ? propertyById(lease.propertyId)
    : user?.isNewTenant
    ? null
    : propertyById("TN101");
  const landlord = property ? landlordById(property.landlordId) : null;

  // Payments & Maintenance
  const myPayments =
    livePayments.length > 0
      ? livePayments
      : PAYMENTS.filter((p) => p.tenantId === entityId);
  const pendingPayments = myPayments.filter((p) => p.status !== "Paid");
  const myMaintenance = MAINTENANCE_REQUESTS.filter(
    (m) => m.tenantId === entityId
  );
  const openMaintenance = myMaintenance.filter(
    (m) => m.status !== "Completed" && m.status !== "Resolved"
  );

  // Rent cycle calculation (backend schedule or local engine fallback)
  const rentCycle = useMemo(() => {
    return (
      liveRentCycle ||
      (lease ? calculateTenantRentCycle(lease, new Date(), myPayments) : null)
    );
  }, [liveRentCycle, lease, myPayments]);

  // Monthly Rent amount
  const monthlyRentAmount = useMemo(() => {
    if (rentCycle?.rentAmount) return rentCycle.rentAmount;
    if (lease?.monthlyRent) return lease.monthlyRent;
    if (lease?.rent) return lease.rent;
    if (lease?.id === "LSE-P01") return 10000;
    if (lease?.id === "LSE-S02") return 7000;
    return 22000;
  }, [rentCycle, lease]);

  // Outstanding Balance calculation without double counting
  const { totalOutstanding, unpaidRentCount, unpaidBillsCount } = useMemo(() => {
    // 1. Unpaid rent from invoices
    const unpaidInvoices = pendingPayments;
    let rentDue = unpaidInvoices.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    // If rentCycle is Overdue or Due Soon and not yet in invoices, add it once
    if (
      rentCycle &&
      (rentCycle.paymentStatus === "Overdue" ||
        rentCycle.paymentStatus === "Due Soon" ||
        rentCycle.paymentStatus === "Due Today")
    ) {
      const alreadyInList = unpaidInvoices.some(
        (p) =>
          p.id === rentCycle.invoiceNo || p.invoiceNo === rentCycle.invoiceNo
      );
      if (!alreadyInList && rentDue === 0) {
        rentDue += Number(rentCycle.rentAmount) || 0;
      }
    }

    // 2. Unpaid EB & Utility bills
    const unpaidBills = liveUtilityBills.filter(
      (b) => b.status === "Pending" || b.status === "Overdue"
    );
    const billsDue = unpaidBills.reduce(
      (sum, b) => sum + (Number(b.amount) || 0),
      0
    );

    return {
      totalOutstanding: rentDue + billsDue,
      unpaidRentCount: unpaidInvoices.length > 0 ? unpaidInvoices.length : (rentDue > 0 ? 1 : 0),
      unpaidBillsCount: unpaidBills.length,
    };
  }, [pendingPayments, rentCycle, liveUtilityBills]);

  // Rent Cycle Next Due Date String
  const nextDueDateLabel = useMemo(() => {
    if (!rentCycle) return "Next Cycle";
    if (rentCycle.paymentStatus === "Paid") {
      return rentCycle.nextDueDateFormatted || `Next: ${rentCycle.moveInDayOrdinal} of next month`;
    }
    return rentCycle.currentDueDateFormatted || `Due ${rentCycle.moveInDayOrdinal}`;
  }, [rentCycle]);

  const tenantName = user?.name || "Resident";

  return (
    <div className="tenant-dashboard-container">
      {/* 1. Compact Welcome Section */}
      <section className="tenant-welcome-row">
        <div className="welcome-text-group">
          <h1 className="welcome-heading">
            {t("Welcome back")}, {tenantName}
          </h1>
          <p className="welcome-subheading">
            {t(
              "Manage your home, rent payments, and maintenance requests in one place."
            )}
          </p>
        </div>

        <div className="welcome-action-group">
          <button
            type="button"
            className="welcome-btn-primary"
            onClick={() => navigate("properties")}
          >
            <Compass size={16} />
            <span>{t("navFindProperties") || "Find a Property"}</span>
          </button>
        </div>
      </section>

      {/* 2. Overdue / Due Soon Alert Banner (High Priority, only when relevant) */}
      {rentCycle && rentCycle.paymentStatus === "Overdue" && (
        <div className="tenant-alert-card overdue">
          <div className="alert-content-left">
            <div className="alert-icon-wrap overdue">
              <AlertTriangle size={22} />
            </div>
            <div className="alert-text-wrap">
              <div className="alert-title overdue">
                Rent Overdue ({rentCycle.daysOverdue}{" "}
                {rentCycle.daysOverdue === 1 ? "day" : "days"} overdue)
              </div>
              <div className="alert-desc overdue">
                Monthly rent of <strong>₹{rentCycle.rentAmount.toLocaleString("en-IN")}</strong> for period{" "}
                <strong>{rentCycle.periodLabel}</strong> was due on{" "}
                <strong>{rentCycle.currentDueDateFormatted}</strong>. Please complete payment immediately to avoid late penalties.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="alert-action-btn overdue"
            onClick={() => navigate("payments")}
          >
            <CreditCard size={16} />
            <span>Pay Overdue Rent Now</span>
          </button>
        </div>
      )}

      {rentCycle && rentCycle.paymentStatus === "Due Soon" && (
        <div className="tenant-alert-card due-soon">
          <div className="alert-content-left">
            <div className="alert-icon-wrap due-soon">
              <Clock size={22} />
            </div>
            <div className="alert-text-wrap">
              <div className="alert-title due-soon">
                Upcoming Rent Due in {rentCycle.daysRemaining}{" "}
                {rentCycle.daysRemaining === 1 ? "day" : "days"} ({rentCycle.currentDueDateFormatted})
              </div>
              <div className="alert-desc due-soon">
                Rental period: <strong>{rentCycle.periodLabel}</strong> · Amount due:{" "}
                <strong>₹{rentCycle.rentAmount.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="alert-action-btn due-soon"
            onClick={() => navigate("payments")}
          >
            <CreditCard size={16} />
            <span>Pay Rent Online</span>
          </button>
        </div>
      )}

      {/* 3. Four Responsive Summary Cards (Single Row on Desktop) */}
      <section className="summary-cards-grid">
        {/* Card 1: Monthly Rent */}
        <div className="summary-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">{t("Monthly Rent")}</span>
            <div className="kpi-icon-badge blue">
              <DollarSign size={18} />
            </div>
          </div>

          <div className="kpi-card-value">
            ₹{monthlyRentAmount.toLocaleString("en-IN")}
            <span className="kpi-card-unit">/mo</span>
          </div>

          <div className="kpi-card-footer">
            <span className="kpi-secondary-info">
              {nextDueDateLabel}
            </span>
            <span
              className={`kpi-status-badge ${
                rentCycle?.paymentStatus === "Paid"
                  ? "paid"
                  : rentCycle?.paymentStatus === "Overdue"
                  ? "overdue"
                  : "due"
              }`}
            >
              {rentCycle?.paymentStatus === "Paid"
                ? "Paid"
                : rentCycle?.paymentStatus === "Overdue"
                ? "Overdue"
                : "Due Soon"}
            </span>
          </div>
        </div>

        {/* Card 2: Outstanding Balance */}
        <div className="summary-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">{t("Outstanding Balance")}</span>
            <div
              className={`kpi-icon-badge ${
                totalOutstanding > 0 ? "amber" : "green"
              }`}
            >
              <CreditCard size={18} />
            </div>
          </div>

          <div className="kpi-card-value">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>

          <div className="kpi-card-footer">
            <span className="kpi-secondary-info">
              {totalOutstanding > 0
                ? `${unpaidRentCount} rent + ${unpaidBillsCount} bill(s)`
                : "All accounts settled"}
            </span>

            {totalOutstanding > 0 ? (
              <button
                type="button"
                className="kpi-quick-pay-btn"
                onClick={() => navigate("payments")}
              >
                Pay Now
              </button>
            ) : (
              <span className="kpi-status-badge paid">
                <Check size={12} strokeWidth={3} /> Paid in Full
              </span>
            )}
          </div>
        </div>

        {/* Card 3: My Property */}
        <div
          className="summary-kpi-card clickable"
          onClick={() => {
            if (property?.id) navigate(`properties/${property.id}`);
            else navigate("properties");
          }}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">{t("My Property")}</span>
            <div className="kpi-icon-badge purple">
              <Building2 size={18} />
            </div>
          </div>

          <div className="kpi-card-value text-ellipsis">
            {property ? property.name : "Discovery Mode"}
          </div>

          <div className="kpi-card-footer">
            <span className="kpi-secondary-info text-ellipsis">
              {property ? `${property.bedrooms} BHK · ${property.city}` : "Browse Available Homes"}
            </span>
            <span className="kpi-status-badge active">
              {property ? "Active Tenancy" : "Searching"}
            </span>
          </div>
        </div>

        {/* Card 4: Maintenance & Service Requests */}
        <div
          className="summary-kpi-card clickable"
          onClick={() => navigate("maintenance")}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">{t("Maintenance Requests")}</span>
            <div className="kpi-icon-badge teal">
              <Wrench size={18} />
            </div>
          </div>

          <div className="kpi-card-value">
            {openMaintenance.length}{" "}
            <span className="kpi-card-unit">
              {openMaintenance.length === 1 ? "Active" : "Active"}
            </span>
          </div>

          <div className="kpi-card-footer">
            <span className="kpi-secondary-info">
              {myMaintenance.length} total logged
            </span>
            <button
              type="button"
              className="kpi-raise-ticket-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("maintenance");
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Raise Ticket</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Move-In Based Rental Cycle & Billing Schedule */}
      {rentCycle && (
        <section className="cycle-schedule-card">
          <div className="cycle-header-row">
            <div className="cycle-title-wrap">
              <div className="cycle-title-icon">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="cycle-title">
                  Move-In Based Rental Cycle &amp; Billing Schedule
                </h3>
                <p className="cycle-subtitle">
                  {rentCycle.cycleRuleDescription}
                </p>
              </div>
            </div>

            <div className="cycle-header-badges">
              <span
                className={`cycle-status-pill ${
                  rentCycle.paymentStatus === "Paid"
                    ? "paid"
                    : rentCycle.paymentStatus === "Overdue"
                    ? "overdue"
                    : "pending"
                }`}
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
          </div>

          <div className="cycle-grid">
            <div className="cycle-grid-item">
              <span className="cycle-item-label">Move-In Date</span>
              <span className="cycle-item-value">{rentCycle.moveInDate}</span>
              <span className="cycle-item-hint">
                Renews on the {rentCycle.moveInDayOrdinal} of every month
              </span>
            </div>

            <div className="cycle-grid-item">
              <span className="cycle-item-label">Current Rental Period</span>
              <span className="cycle-item-value accent">
                {rentCycle.periodLabel}
              </span>
              <span className="cycle-item-hint">
                Monthly residential tenancy
              </span>
            </div>

            <div className="cycle-grid-item">
              <span className="cycle-item-label">
                {rentCycle.paymentStatus === "Paid"
                  ? "Next Rent Due Date"
                  : "Rent Due Date"}
              </span>
              <span
                className={`cycle-item-value ${
                  rentCycle.paymentStatus === "Overdue" ? "danger" : ""
                }`}
              >
                {rentCycle.paymentStatus === "Paid"
                  ? rentCycle.nextDueDateFormatted
                  : rentCycle.currentDueDateFormatted}
              </span>
              <span className="cycle-item-hint">
                {rentCycle.paymentStatus === "Paid"
                  ? "Upcoming cycle anchor"
                  : "Due for current period"}
              </span>
            </div>

            <div className="cycle-grid-item">
              <span className="cycle-item-label">Monthly Rent Amount</span>
              <span className="cycle-item-value success">
                ₹{rentCycle.rentAmount.toLocaleString("en-IN")}
              </span>
              <span className="cycle-item-hint">
                Invoice: {rentCycle.invoiceNo}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 5. Leased Property Spotlight Card */}
      {property && (
        <section className="apartment-spotlight-card">
          <div className="spotlight-badge-row">
            <div className="spotlight-tags-left">
              <span className="spotlight-city-tag">{property.city}</span>
              <span className="spotlight-active-tag">Active Lease Agreement</span>
              {lease && (
                <span className="spotlight-reg-tag">
                  Govt Reg: {lease.regNumber || "TN-CH-REG-2026-8891"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="spotlight-link-btn"
              onClick={() => navigate(`properties/${property.id}`)}
            >
              <span>View Property Specs</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="spotlight-main-body">
            <div
              className="spotlight-image-box"
              onClick={() => navigate(`properties/${property.id}`)}
              title="Click to view full property gallery and amenities"
            >
              <img
                src={property.image}
                alt={property.name}
                className="spotlight-img"
                loading="lazy"
              />
            </div>

            <div className="spotlight-info-col">
              <h2
                className="spotlight-unit-title"
                onClick={() => navigate(`properties/${property.id}`)}
              >
                {property.name}
              </h2>
              <div className="spotlight-unit-loc">
                <MapPin size={15} />
                <span>{property.location}</span>
              </div>

              <div className="spotlight-specs-row">
                <span className="spec-item-badge">📐 {property.area} sqft</span>
                <span className="spec-item-badge">🛏 {property.bedrooms} BHK</span>
                <span className="spec-item-badge">🏢 Floor {property.floor}</span>
                <span className="spec-item-badge">🧭 {property.facing} Facing</span>
                <span className="spec-item-badge highlight">
                  ⚡ TNEB EB: {property.ebConsumerNo}
                </span>
              </div>

              {landlord && (
                <div className="spotlight-landlord-strip">
                  <div className="landlord-info-group">
                    <span className="landlord-label">Landlord:</span>
                    <strong className="landlord-name">{landlord.name}</strong>
                    <span className="landlord-phone">({landlord.phone})</span>
                    <span className="landlord-loc">· {landlord.location}</span>
                  </div>
                </div>
              )}

              <div className="spotlight-actions-bar">
                <button
                  type="button"
                  className="spotlight-primary-btn"
                  onClick={() => navigate("payments")}
                >
                  <CreditCard size={15} />
                  <span>{t("Pay Rent Online")}</span>
                </button>
                <button
                  type="button"
                  className="spotlight-secondary-btn"
                  onClick={() => navigate("maintenance")}
                >
                  <Wrench size={15} />
                  <span>{t("Raise Service Ticket")}</span>
                </button>
                <button
                  type="button"
                  className="spotlight-secondary-btn"
                  onClick={() => navigate("agreement")}
                >
                  <FileSignature size={15} />
                  <span>{t("Tenancy Agreement")}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. Two-Column Grid: Recent Invoices & Active Maintenance Requests */}
      <section className="dashboard-two-col-grid">
        {/* Left Column: Recent Rent Invoices */}
        <div className="dashboard-col-card">
          <div className="col-card-header">
            <div>
              <h3 className="col-card-title">{t("My Rent Invoices")}</h3>
              <p className="col-card-subtitle">
                {t("Recent payment history and upcoming rental charges")}
              </p>
            </div>
            <button
              type="button"
              className="col-header-action-btn"
              onClick={() => navigate("payments")}
            >
              <span>{t("All Invoices")}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="modern-table-wrap">
            <table className="modern-dashboard-table">
              <thead>
                <tr>
                  <th>{t("Invoice")}</th>
                  <th>{t("Month / Period")}</th>
                  <th>{t("Amount")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {myPayments.slice(0, 4).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong className="table-invoice-id">{p.id}</strong>
                    </td>
                    <td>
                      <span className="table-invoice-date">
                        {p.month || p.date || "Monthly Rent"}
                      </span>
                    </td>
                    <td>
                      <strong className="table-invoice-amount">
                        ₹{(Number(p.amount) || 0).toLocaleString("en-IN")}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`modern-pill ${
                          p.status === "Paid"
                            ? "paid"
                            : p.status === "Overdue"
                            ? "failed"
                            : "pending"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {myPayments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty-row">
                      No rent invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Maintenance & Service Requests */}
        <div className="dashboard-col-card">
          <div className="col-card-header">
            <div>
              <h3 className="col-card-title">{t("My Service Requests")}</h3>
              <p className="col-card-subtitle">
                {t("Technician and plumbing dispatches for this flat")}
              </p>
            </div>
            <div className="col-header-btns">
              <button
                type="button"
                className="col-header-action-btn"
                onClick={() => navigate("maintenance")}
              >
                <span>{t("View All")}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="tickets-list-wrap">
            {myMaintenance.slice(0, 4).map((m) => (
              <div key={m.id} className="ticket-item-row">
                <div className="ticket-item-left">
                  <div className="ticket-title">
                    {m.issueText || m.issue || "Maintenance Ticket"}
                  </div>
                  <div className="ticket-meta">
                    <span>Logged: {m.date || "Recent"}</span>
                    <span>·</span>
                    <span>Vendor: {m.vendor || "Assigned"}</span>
                  </div>
                </div>

                <div className="ticket-item-right">
                  <span
                    className={`modern-pill ${
                      m.status === "Completed" || m.status === "Resolved"
                        ? "paid"
                        : "pending"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </div>
            ))}

            {myMaintenance.length === 0 && (
              <div className="empty-tickets-notice">
                <CheckCircle2 size={28} className="empty-icon" />
                <p>No maintenance tickets logged. Everything is in working order!</p>
                <button
                  type="button"
                  className="welcome-btn-primary"
                  style={{ marginTop: "10px", fontSize: "12px", padding: "6px 14px" }}
                  onClick={() => navigate("maintenance")}
                >
                  <Plus size={14} /> Raise Ticket
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Quick Services & Utilities Hub */}
      <section className="quick-services-hub">
        <div className="services-hub-header">
          <h3 className="services-hub-title">Resident Services &amp; Quick Utilities</h3>
          <p className="services-hub-subtitle">
            One-click access to EB billing, on-demand home repairs, and tenancy legal compliance.
          </p>
        </div>

        <div className="services-hub-grid">
          {/* Tile 1: EB Electricity Bills */}
          <div
            className="service-hub-tile"
            onClick={() => navigate("eb-bills")}
          >
            <div className="tile-icon-box yellow">
              <Zap size={22} />
            </div>
            <div className="tile-content">
              <h4 className="tile-title">EB Bills &amp; Utilities</h4>
              <p className="tile-desc">
                Review TNEB bi-monthly power consumption, meter readings, and pay online.
              </p>
            </div>
            <div className="tile-footer-arrow">
              <span>Pay EB Bill</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Tile 2: Home Services */}
          <div
            className="service-hub-tile"
            onClick={() => navigate("home-services")}
          >
            <div className="tile-icon-box blue">
              <Sparkles size={22} />
            </div>
            <div className="tile-content">
              <h4 className="tile-title">Home Services</h4>
              <p className="tile-desc">
                Book verified professionals for deep cleaning, AC service, plumbing, and electrical work.
              </p>
            </div>
            <div className="tile-footer-arrow">
              <span>Book Service</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Tile 3: Tenancy Agreement */}
          <div
            className="service-hub-tile"
            onClick={() => navigate("agreement")}
          >
            <div className="tile-icon-box green">
              <FileSignature size={22} />
            </div>
            <div className="tile-content">
              <h4 className="tile-title">Tenancy Agreement</h4>
              <p className="tile-desc">
                Inspect registered Tamil Nadu Model Tenancy terms, clauses, and security deposit terms.
              </p>
            </div>
            <div className="tile-footer-arrow">
              <span>View Agreement</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Tile 4: Services & Complaints Hub */}
          <div
            className="service-hub-tile"
            onClick={() => navigate("services-complaints")}
          >
            <div className="tile-icon-box purple">
              <LifeBuoy size={22} />
            </div>
            <div className="tile-content">
              <h4 className="tile-title">Services &amp; Complaints</h4>
              <p className="tile-desc">
                Log building grievances, follow resolution SLAs, and request assistance from property managers.
              </p>
            </div>
            <div className="tile-footer-arrow">
              <span>Open Hub</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </section>

      {/* 8. Compact Saved Search & Property Discovery Preference (Clean Strip) */}
      {savedPref && savedPref.city && (
        <section className="saved-pref-compact-strip">
          <div className="pref-strip-left">
            <span className="pref-strip-badge">Saved Home Search</span>
            <span className="pref-param-item">
              <strong>Location:</strong> {savedPref.city} {savedPref.locality ? `(${savedPref.locality})` : ""}
            </span>
            <span className="pref-param-item">
              <strong>BHK:</strong> {savedPref.bhk} BHK
            </span>
            <span className="pref-param-item">
              <strong>Budget:</strong> {savedPref.budgetRange}
            </span>
          </div>

          <button
            type="button"
            className="pref-strip-btn"
            onClick={() => navigate("properties")}
          >
            <span>Explore Properties</span>
            <ArrowRight size={14} />
          </button>
        </section>
      )}
    </div>
  );
}
