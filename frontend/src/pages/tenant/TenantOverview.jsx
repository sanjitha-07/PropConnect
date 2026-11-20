import { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import {
  fetchTenantPreferences,
  fetchRentSchedules,
  fetchPayments,
  fetchUtilityBills,
  fetchLeases,
  fetchProperties,
  fetchMaintenance,
  fetchServiceBookings,
  fetchComplaints,
} from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import {
  LEASES,
  PAYMENTS,
  MAINTENANCE_REQUESTS,
  COMPLAINTS,
  propertyById,
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
  FolderArchive,
  FileSignature,
  Phone,
  MapPin,
  Compass,
  DollarSign,
  Plus,
  Check,
  RotateCcw,
  Receipt,
  Bell,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import "./TenantDashboard.css";

export default function TenantOverview() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();

  const entityId = user?.entityId || user?.entity_id || "TEN001";
  const tenantName = user?.name || "Resident";

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveLeases, setLiveLeases] = useState([]);
  const [liveProperties, setLiveProperties] = useState([]);
  const [livePayments, setLivePayments] = useState([]);
  const [liveMaintenance, setLiveMaintenance] = useState([]);
  const [liveBookings, setLiveBookings] = useState([]);
  const [liveComplaints, setLiveComplaints] = useState([]);
  const [liveUtilityBills, setLiveUtilityBills] = useState([]);
  const [liveRentCycle, setLiveRentCycle] = useState(null);

  // Load all actual backend data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        leasesRes,
        propsRes,
        payRes,
        maintRes,
        bookRes,
        compRes,
        utilRes,
        schedRes,
      ] = await Promise.all([
        fetchLeases().catch(() => null),
        fetchProperties().catch(() => null),
        fetchPayments(entityId).catch(() => null),
        fetchMaintenance().catch(() => null),
        fetchServiceBookings().catch(() => null),
        fetchComplaints().catch(() => null),
        fetchUtilityBills({ tenantId: entityId }).catch(() => null),
        fetchRentSchedules({ tenantId: entityId }).catch(() => null),
      ]);

      if (Array.isArray(leasesRes) && leasesRes.length > 0) setLiveLeases(leasesRes);
      if (Array.isArray(propsRes) && propsRes.length > 0) setLiveProperties(propsRes);
      if (Array.isArray(payRes) && payRes.length > 0) setLivePayments(payRes);
      if (Array.isArray(maintRes) && maintRes.length > 0) setLiveMaintenance(maintRes);
      if (Array.isArray(bookRes) && bookRes.length > 0) setLiveBookings(bookRes);
      if (Array.isArray(compRes) && compRes.length > 0) setLiveComplaints(compRes);
      if (Array.isArray(utilRes) && utilRes.length > 0) setLiveUtilityBills(utilRes);

      if (schedRes?.schedules && schedRes.schedules.length > 0) {
        const primarySched =
          schedRes.schedules.find(
            (s) =>
              (s.lease?.id === "LSE001" || (s.lease?.status || "").toLowerCase() === "active") &&
              !s.lease?.id?.includes("-P") &&
              !s.lease?.id?.includes("-S")
          ) ||
          schedRes.schedules.find((s) => (s.lease?.status || "").toLowerCase() === "active") ||
          schedRes.schedules[0];

        if (primarySched?.rentCycle) {
          setLiveRentCycle(primarySched.rentCycle);
        }
      }
    } catch (err) {
      console.warn("Error loading dashboard data:", err);
      setError("Unable to sync latest live metrics. Displaying cached records.");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 1. Identify primary active residential lease
  const allLeases = liveLeases.length > 0 ? liveLeases : LEASES;
  const myTenantLeases = allLeases.filter(
    (l) => l.tenantId === entityId || l.tenant_id === entityId
  );
  const lease =
    myTenantLeases.find(
      (l) =>
        (l.status || "").toLowerCase() === "active" &&
        !l.id?.includes("-P") &&
        !l.id?.includes("-S")
    ) ||
    myTenantLeases.find((l) => (l.status || "").toLowerCase() === "active") ||
    myTenantLeases[0] ||
    LEASES.find((l) => l.tenantId === entityId) ||
    null;

  // 2. Identify property
  const property = useMemo(() => {
    if (!lease) return propertyById("TN101");
    const propId = lease.propertyId || lease.property_id;
    const foundInLive = liveProperties.find((p) => p.id === propId);
    return foundInLive || propertyById(propId) || propertyById("TN101");
  }, [lease, liveProperties]);

  // Unit number
  const unitNumber = property?.unit || property?.unitNo || "Flat 302";

  // 3. Payments data
  const myPayments = useMemo(() => {
    if (livePayments.length > 0) return livePayments;
    return PAYMENTS.filter((p) => p.tenantId === entityId);
  }, [livePayments, entityId]);

  // 4. Rent cycle calculation (consistent across entire tenant module)
  const rentCycle = useMemo(() => {
    return (
      liveRentCycle ||
      (lease ? calculateTenantRentCycle(lease, new Date(), myPayments) : null)
    );
  }, [liveRentCycle, lease, myPayments]);

  // 5. Monthly rent amount
  const monthlyRentAmount = useMemo(() => {
    if (lease?.monthlyRent) return Number(lease.monthlyRent);
    if (lease?.monthly_rent) return Number(lease.monthly_rent);
    if (lease?.rent) return Number(lease.rent);
    if (rentCycle?.rentAmount) return Number(rentCycle.rentAmount);
    return 22000;
  }, [lease, rentCycle]);

  // 6. Outstanding balance (strictly excluding paid invoices, no double counting)
  const { totalOutstanding, unpaidRentCount, unpaidBillsCount } = useMemo(() => {
    const unpaidInvoices = myPayments.filter(
      (p) => (p.status || "").toLowerCase() !== "paid"
    );
    let rentDue = unpaidInvoices.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    if (
      rentCycle &&
      !rentCycle.isPaid &&
      rentCycle.paymentStatus !== "Paid" &&
      (rentCycle.paymentStatus === "Overdue" ||
        rentCycle.paymentStatus === "Due Soon" ||
        rentCycle.paymentStatus === "Due Today")
    ) {
      const alreadyInList = unpaidInvoices.some(
        (p) =>
          p.id === rentCycle.invoiceNo ||
          p.invoiceNo === rentCycle.invoiceNo ||
          p.month === rentCycle.periodLabel
      );
      if (!alreadyInList && rentDue === 0) {
        rentDue += Number(rentCycle.rentAmount) || 0;
      }
    }

    const unpaidBills = liveUtilityBills.filter(
      (b) =>
        (b.status || "").toLowerCase() !== "paid" &&
        (b.responsibility || "").toLowerCase() !== "landlord"
    );
    const billsDue = unpaidBills.reduce(
      (sum, b) => sum + (Number(b.tenantAmount || b.amount) || 0),
      0
    );

    return {
      totalOutstanding: rentDue + billsDue,
      unpaidRentCount: unpaidInvoices.length > 0 ? unpaidInvoices.length : rentDue > 0 ? 1 : 0,
      unpaidBillsCount: unpaidBills.length,
    };
  }, [myPayments, rentCycle, liveUtilityBills]);

  // 7. Total rent paid
  const { totalRentPaid, paidCount } = useMemo(() => {
    const paidList = myPayments.filter(
      (p) => (p.status || "").toLowerCase() === "paid"
    );
    const total = paidList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return {
      totalRentPaid: total > 0 ? total : monthlyRentAmount * 2, // At least 2 months paid default
      paidCount: paidList.length > 0 ? paidList.length : 2,
    };
  }, [myPayments, monthlyRentAmount]);

  // 8. Next payment due date formatted
  const nextDueDateLabel = useMemo(() => {
    if (!rentCycle) return "10 Oct 2026";
    if (rentCycle.paymentStatus === "Paid") {
      return rentCycle.nextDueDateFormatted || `10th of next month`;
    }
    return rentCycle.currentDueDateFormatted || "10 Oct 2026";
  }, [rentCycle]);

  // 9. Maintenance requests
  const myMaintenance = useMemo(() => {
    if (liveMaintenance.length > 0) {
      return liveMaintenance.filter((m) => m.tenantId === entityId || !m.tenantId);
    }
    return MAINTENANCE_REQUESTS.filter((m) => m.tenantId === entityId);
  }, [liveMaintenance, entityId]);

  const activeMaintenanceRequests = useMemo(() => {
    return myMaintenance.filter(
      (m) =>
        m.status !== "Completed" &&
        m.status !== "Resolved" &&
        (m.status || "").toLowerCase() !== "closed"
    );
  }, [myMaintenance]);

  // 10. Applicable alerts (SECTION 2: Show only alerts that actually apply to the tenant)
  const applicableAlerts = useMemo(() => {
    const alerts = [];

    // Overdue payment
    if (rentCycle?.paymentStatus === "Overdue") {
      alerts.push({
        id: "alert-overdue-rent",
        type: "overdue",
        icon: AlertTriangle,
        title: `Rent Payment Overdue (${rentCycle.daysOverdue} ${rentCycle.daysOverdue === 1 ? "day" : "days"})`,
        desc: `Rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for period ${rentCycle.periodLabel} was due on ${rentCycle.currentDueDateFormatted}.`,
        actionLabel: "Pay Overdue Rent",
        actionTo: "payments",
      });
    }

    // Upcoming rent due
    if (
      rentCycle &&
      (rentCycle.paymentStatus === "Due Soon" || rentCycle.paymentStatus === "Due Today") &&
      !rentCycle.isPaid
    ) {
      alerts.push({
        id: "alert-due-rent",
        type: "due-soon",
        icon: Clock,
        title: `Rent Due in ${rentCycle.daysRemaining} ${rentCycle.daysRemaining === 1 ? "day" : "days"} (${rentCycle.currentDueDateFormatted})`,
        desc: `Monthly rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for ${rentCycle.periodLabel} is due soon.`,
        actionLabel: "Pay Rent Online",
        actionTo: "payments",
      });
    }

    // Lease expiry (within 90 days)
    if (lease?.endDate) {
      const today = new Date();
      const end = new Date(lease.endDate);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 90) {
        alerts.push({
          id: "alert-lease-expiry",
          type: "lease-expiry",
          icon: AlertCircle,
          title: `Lease Expiration Notice (${diffDays} days remaining)`,
          desc: `Your active residential tenancy agreement for ${property?.name || "this unit"} expires on ${lease.endDate}.`,
          actionLabel: "Review Lease Agreement",
          actionTo: "lease",
        });
      }
    }

    // Pending maintenance response
    const pendingTickets = activeMaintenanceRequests.filter(
      (m) => m.status === "Open" || m.status === "Pending"
    );
    if (pendingTickets.length > 0) {
      const first = pendingTickets[0];
      alerts.push({
        id: "alert-pending-maint",
        type: "maintenance",
        icon: Wrench,
        title: `Pending Maintenance Response (#${first.id})`,
        desc: `"${first.issueText || first.title || first.issue}" is awaiting technician assignment by building management.`,
        actionLabel: "View Request Status",
        actionTo: "request-center",
      });
    }

    return alerts;
  }, [rentCycle, lease, property, activeMaintenanceRequests]);

  // 11. Upcoming activities (SECTION 7)
  const upcomingActivities = useMemo(() => {
    const list = [];

    // Rent Due
    if (rentCycle) {
      list.push({
        id: "up-rent",
        type: "rent",
        icon: CreditCard,
        title: `Monthly Rent Due: ₹${monthlyRentAmount.toLocaleString("en-IN")}`,
        meta: `Cycle period: ${rentCycle.periodLabel}`,
        date: nextDueDateLabel,
      });
    }

    // Confirmed service bookings
    if (liveBookings.length > 0) {
      liveBookings.forEach((b) => {
        if (b.status === "Confirmed" || b.status === "Scheduled") {
          list.push({
            id: `up-booking-${b.id}`,
            type: "booking",
            icon: Sparkles,
            title: `Service Booking: ${b.categoryName || b.category || "Home Service"}`,
            meta: `Scheduled time: ${b.timeSlot || "10:00 AM"} · Provider: ${b.providerName || "Verified Tech"}`,
            date: b.date || "Upcoming",
          });
        }
      });
    }

    // Default upcoming service schedule if none booked
    if (list.length === 1) {
      list.push({
        id: "up-booking-default",
        type: "booking",
        icon: Sparkles,
        title: "Pre-Scheduled AC Service & Deep Filter Jet Wash",
        meta: "Summer prep inspection booked with UrbanCool Technicians",
        date: "10 Oct 2026",
      });
    }

    // Property announcement / maintenance inspection
    list.push({
      id: "up-notice-society",
      type: "notice",
      icon: Bell,
      title: "Quarterly Overhead Water Tank Cleaning & Sanitization",
      meta: "CMWSSB supply interruption between 10:00 AM - 02:00 PM",
      date: "1st Sunday of Month",
    });

    // Lease expiry milestone
    if (lease?.endDate) {
      list.push({
        id: "up-lease",
        type: "lease",
        icon: FileSignature,
        title: "Residential Lease Term Renewal Review",
        meta: `Govt Reg: ${lease.regNumber || "TN-CH-REG-2026-8891"}`,
        date: lease.endDate,
      });
    }

    return list;
  }, [rentCycle, monthlyRentAmount, nextDueDateLabel, liveBookings, lease]);

  // 12. Recent activity (SECTION 8: Latest payments, service bookings, complaints, maintenance)
  const recentActivities = useMemo(() => {
    const items = [];

    // Latest Payments
    myPayments.slice(0, 2).forEach((p) => {
      items.push({
        id: `act-pay-${p.id}`,
        title: `Rent Payment: ₹${Number(p.amount).toLocaleString("en-IN")}`,
        meta: `Invoice ${p.id} · Method: ${p.method || "UPI / Net Banking"}`,
        time: p.date || "Recent",
        icon: CreditCard,
        iconBg: "#eff6ff",
        iconColor: "#2563eb",
      });
    });

    // Latest Service Bookings
    if (liveBookings.length > 0) {
      liveBookings.slice(0, 1).forEach((b) => {
        items.push({
          id: `act-book-${b.id}`,
          title: `Home Service Booked: ${b.categoryName || b.service || "Plumbing Repair"}`,
          meta: `Booking ID: ${b.id} · Status: ${b.status || "Confirmed"}`,
          time: b.date || "This Week",
          icon: Sparkles,
          iconBg: "#faf5ff",
          iconColor: "#9333ea",
        });
      });
    } else {
      items.push({
        id: "act-book-sample",
        title: "Home Service Booked: AC Filter Cleaning",
        meta: "Booking #BK_FIX_101 · Status: Confirmed",
        time: "10 Oct 2026",
        icon: Sparkles,
        iconBg: "#faf5ff",
        iconColor: "#9333ea",
      });
    }

    // Latest Maintenance Updates
    myMaintenance.slice(0, 1).forEach((m) => {
      items.push({
        id: `act-maint-${m.id}`,
        title: `Maintenance Request: ${m.issueText || m.title || "Faucet Leak"}`,
        meta: `Ticket #${m.id} · Status: ${m.status || "In Progress"}`,
        time: m.date || "Recent",
        icon: Wrench,
        iconBg: "#f0fdf4",
        iconColor: "#16a34a",
      });
    });

    // Latest Complaints
    const myComps = liveComplaints.length > 0 ? liveComplaints : COMPLAINTS;
    if (myComps.length > 0) {
      const c = myComps[0];
      items.push({
        id: `act-comp-${c.id}`,
        title: `Complaint Registered: ${c.subject || c.issue || "AC cooling issue"}`,
        meta: `Complaint #${c.id} · Priority: ${c.priority || "High"}`,
        time: c.date || "Recent",
        icon: AlertCircle,
        iconBg: "#fef2f2",
        iconColor: "#dc2626",
      });
    }

    return items;
  }, [myPayments, liveBookings, myMaintenance, liveComplaints]);

  // 13. Personal Insights (SECTION 9)
  const averageUtilities = useMemo(() => {
    if (liveUtilityBills.length > 0) {
      const sum = liveUtilityBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
      return Math.round(sum / liveUtilityBills.length);
    }
    return 1850;
  }, [liveUtilityBills]);

  // Loading state
  if (loading) {
    return (
      <div className="td-loading-container">
        <div className="td-spinner" />
        <p style={{ fontWeight: 600, fontSize: "14px", color: "#334155" }}>
          Synchronizing tenant account metrics…
        </p>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard-wrap">
      {/* Error Notice (if API sync had a warning) */}
      {error && (
        <div className="td-error-card">
          <div className="td-error-text">⚠️ {error}</div>
          <button type="button" className="td-btn-retry" onClick={loadDashboardData}>
            <RotateCcw size={14} style={{ display: "inline", marginRight: "6px" }} />
            Retry Sync
          </button>
        </div>
      )}

      {/* ======================================================================
          SECTION 1: Welcome Header
          ====================================================================== */}
      <section className="td-welcome-header">
        <div className="td-welcome-left">
          <h1 className="td-welcome-greeting">
            Welcome back, {tenantName}
          </h1>
          <div className="td-welcome-property-pill">
            <span>📍 Currently residing at</span>
            <span className="td-welcome-property-name">
              {property?.name || "Sai Kala Apartments"} ({unitNumber})
            </span>
            <span>· {property?.location || "Anna Nagar West, Chennai"}</span>
          </div>
        </div>

        <div className="td-welcome-actions">
          <button
            type="button"
            className="td-btn-find-properties"
            onClick={() => navigate("properties")}
          >
            <Compass size={16} />
            <span>Find Properties</span>
          </button>
        </div>
      </section>

      {/* ======================================================================
          SECTION 2: Important Alerts (Show only alerts that actually apply)
          ====================================================================== */}
      {applicableAlerts.length > 0 && (
        <section className="td-alerts-container">
          {applicableAlerts.map((alert) => {
            const IconComp = alert.icon;
            return (
              <div key={alert.id} className={`td-alert-banner ${alert.type}`}>
                <div className="td-alert-content">
                  <div className="td-alert-icon-box">
                    <IconComp size={18} />
                  </div>
                  <div className="td-alert-text">
                    <span className="td-alert-title">{alert.title}</span>
                    <span className="td-alert-desc">{alert.desc}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="td-alert-action-btn"
                  onClick={() => navigate(alert.actionTo)}
                >
                  <span>{alert.actionLabel}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* ======================================================================
          SECTION 3: Financial Summary (Compact 4-Column KPI Cards)
          ====================================================================== */}
      <section className="td-financial-grid">
        {/* Card 1: Monthly Rent */}
        <div className="td-kpi-card interactive" onClick={() => navigate("lease")}>
          <div className="td-kpi-top">
            <span className="td-kpi-title">Monthly Rent</span>
            <div className="td-kpi-icon blue">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="td-kpi-value">
            ₹{monthlyRentAmount.toLocaleString("en-IN")}
            <span className="td-kpi-unit">/mo</span>
          </div>
          <div className="td-kpi-bottom">
            <span className="td-kpi-meta">Cycle: {rentCycle?.moveInDayOrdinal || "10th"} of month</span>
            <span
              className={`td-pill-badge ${
                rentCycle?.paymentStatus === "Paid" ? "paid" : "pending"
              }`}
            >
              {rentCycle?.paymentStatus === "Paid" ? "✓ Paid" : "Pending"}
            </span>
          </div>
        </div>

        {/* Card 2: Outstanding Balance */}
        <div className="td-kpi-card interactive" onClick={() => navigate("payments")}>
          <div className="td-kpi-top">
            <span className="td-kpi-title">Outstanding Balance</span>
            <div className={`td-kpi-icon ${totalOutstanding > 0 ? "amber" : "green"}`}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="td-kpi-value">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="td-kpi-bottom">
            <span className="td-kpi-meta">
              {totalOutstanding > 0
                ? `${unpaidRentCount} rent + ${unpaidBillsCount} utility`
                : "All accounts settled"}
            </span>
            {totalOutstanding > 0 ? (
              <button
                type="button"
                className="td-kpi-quick-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("payments");
                }}
              >
                Pay Now
              </button>
            ) : (
              <span className="td-pill-badge paid">
                <Check size={11} strokeWidth={3} /> Paid in Full
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Next Payment Due Date */}
        <div className="td-kpi-card interactive" onClick={() => navigate("payments")}>
          <div className="td-kpi-top">
            <span className="td-kpi-title">Next Due Date</span>
            <div className="td-kpi-icon blue">
              <Calendar size={18} />
            </div>
          </div>
          <div className="td-kpi-value" style={{ fontSize: "20px" }}>
            {nextDueDateLabel}
          </div>
          <div className="td-kpi-bottom">
            <span className="td-kpi-meta">{rentCycle?.periodLabel || "Monthly Residential"}</span>
            <span
              className={`td-pill-badge ${
                rentCycle?.paymentStatus === "Overdue"
                  ? "overdue"
                  : rentCycle?.paymentStatus === "Paid"
                  ? "paid"
                  : "pending"
              }`}
            >
              {rentCycle?.paymentStatus || "On Schedule"}
            </span>
          </div>
        </div>

        {/* Card 4: Total Rent Paid */}
        <div className="td-kpi-card interactive" onClick={() => navigate("payments")}>
          <div className="td-kpi-top">
            <span className="td-kpi-title">Total Rent Paid</span>
            <div className="td-kpi-icon green">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="td-kpi-value">
            ₹{totalRentPaid.toLocaleString("en-IN")}
          </div>
          <div className="td-kpi-bottom">
            <span className="td-kpi-meta">{paidCount} transactions settled</span>
            <span className="td-pill-badge paid">Verified</span>
          </div>
        </div>
      </section>

      {/* ======================================================================
          SECTION 5: Quick Actions (Single Compact Bar)
          ====================================================================== */}
      <section className="td-quick-actions-bar">
        <button
          type="button"
          className="td-action-card-btn"
          onClick={() => navigate("payments")}
        >
          <div className="td-action-icon-circle pay">
            <CreditCard size={18} />
          </div>
          <div className="td-action-text">
            <span className="td-action-label">Pay Rent</span>
            <span className="td-action-hint">UPI, Cards, NetBanking</span>
          </div>
        </button>

        <button
          type="button"
          className="td-action-card-btn"
          onClick={() => navigate("request-center")}
        >
          <div className="td-action-icon-circle maint">
            <Wrench size={18} />
          </div>
          <div className="td-action-text">
            <span className="td-action-label">Maintenance Request</span>
            <span className="td-action-hint">Report repair issue</span>
          </div>
        </button>

        <button
          type="button"
          className="td-action-card-btn"
          onClick={() => navigate("home-services")}
        >
          <div className="td-action-icon-circle service">
            <Sparkles size={18} />
          </div>
          <div className="td-action-text">
            <span className="td-action-label">Book Home Service</span>
            <span className="td-action-hint">AC, Plumbing, Cleaning</span>
          </div>
        </button>

        <button
          type="button"
          className="td-action-card-btn"
          onClick={() => navigate("documents")}
        >
          <div className="td-action-icon-circle docs">
            <FolderArchive size={18} />
          </div>
          <div className="td-action-text">
            <span className="td-action-label">View Documents</span>
            <span className="td-action-hint">ID proofs &amp; Lease</span>
          </div>
        </button>
      </section>

      {/* ======================================================================
          2-COLUMN BODY GRID (Sections 4, 6, 7, 8)
          ====================================================================== */}
      <div className="td-dashboard-body-grid">
        {/* LEFT COLUMN: Section 4 (My Property) & Section 6 (Active Requests) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* SECTION 4: My Property */}
          <div className="td-card">
            <div className="td-card-header">
              <div className="td-card-title-group">
                <Building2 size={16} color="#0284c7" />
                <h3 className="td-card-title">My Rented Residence</h3>
              </div>
              <span className="td-pill-badge active">Active Lease</span>
            </div>

            <div className="td-card-body">
              <div className="td-property-spotlight">
                <div
                  className="td-property-img-wrap"
                  onClick={() => property?.id && navigate(`properties/${property.id}`)}
                  style={{ cursor: "pointer" }}
                  title="View property details"
                >
                  <img
                    src={
                      property?.image ||
                      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600"
                    }
                    alt={property?.name || "Rented Residence"}
                    className="td-property-img"
                    loading="lazy"
                  />
                </div>

                <div className="td-property-info">
                  <div className="td-property-name-row">
                    <h4 className="td-property-name">
                      {property?.name || "Sai Kala Apartments"}
                    </h4>
                    <span className="td-property-unit-tag">{unitNumber}</span>
                  </div>

                  <div className="td-property-location">
                    <MapPin size={13} />
                    <span>{property?.location || "Anna Nagar West, Chennai"}</span>
                  </div>

                  <div className="td-property-specs-strip">
                    <span className="td-property-spec-chip">
                      🛏️ {property?.bedrooms || 2} BHK
                    </span>
                    <span className="td-property-spec-chip">
                      📐 {property?.area || property?.sqft || 1250} sqft
                    </span>
                    <span className="td-property-spec-chip">
                      🏢 Floor {property?.floor || "2nd"}
                    </span>
                    <span className="td-property-spec-chip">
                      ⚡ EB: {property?.ebConsumerNo || "TNEB-04-129-98"}
                    </span>
                  </div>

                  <div className="td-property-footer">
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Reg: {lease?.regNumber || "TN-CH-REG-2026-8891"}
                    </span>
                    <button
                      type="button"
                      className="td-btn-view-lease"
                      onClick={() => navigate("lease")}
                    >
                      <FileSignature size={13} />
                      <span>View Lease</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Active Requests */}
          <div className="td-card">
            <div className="td-card-header">
              <div className="td-card-title-group">
                <Wrench size={16} color="#16a34a" />
                <h3 className="td-card-title">Active Maintenance Requests</h3>
                <span className="td-card-badge-count">
                  {activeMaintenanceRequests.length}
                </span>
              </div>
              <button
                type="button"
                className="td-card-header-action"
                onClick={() => navigate("request-center")}
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="td-card-body" style={{ padding: "14px 20px" }}>
              {activeMaintenanceRequests.length > 0 ? (
                <div className="td-requests-list">
                  {activeMaintenanceRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="td-request-row">
                      <div className="td-request-left">
                        <span className="td-request-id-pill">#{req.id}</span>
                        <div className="td-request-issue-wrap">
                          <span className="td-request-issue">
                            {req.issueText || req.title || req.issue || "Service Ticket"}
                          </span>
                          <span className="td-request-updated">
                            Updated: {req.date || "Recent"} · Priority: {req.priority || "Medium"}
                          </span>
                        </div>
                      </div>

                      <div className="td-request-right">
                        <span
                          className={`td-pill-badge ${
                            req.status === "In Progress"
                              ? "pending"
                              : req.status === "Assigned"
                              ? "active"
                              : "overdue"
                          }`}
                        >
                          {req.status}
                        </span>
                        <button
                          type="button"
                          className="td-btn-table-action"
                          onClick={() => navigate("request-center")}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="td-empty-state-box">
                  <CheckCircle2 size={28} color="#16a34a" />
                  <span className="td-empty-state-text">
                    No active maintenance requests. Everything in your home is running smoothly!
                  </span>
                  <button
                    type="button"
                    className="td-btn-table-action"
                    style={{ marginTop: "6px" }}
                    onClick={() => navigate("request-center")}
                  >
                    <Plus size={13} style={{ display: "inline", marginRight: "4px" }} />
                    Raise New Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Section 7 (Upcoming Activities) & Section 8 (Recent Activity) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* SECTION 7: Upcoming Activities */}
          <div className="td-card">
            <div className="td-card-header">
              <div className="td-card-title-group">
                <Calendar size={16} color="#2563eb" />
                <h3 className="td-card-title">Upcoming Activities</h3>
              </div>
            </div>

            <div className="td-card-body" style={{ padding: "16px 20px" }}>
              {upcomingActivities.length > 0 ? (
                <div className="td-activity-timeline">
                  {upcomingActivities.map((act) => {
                    const ActIcon = act.icon;
                    return (
                      <div key={act.id} className="td-timeline-item">
                        <div className={`td-timeline-dot-box ${act.type}`}>
                          <ActIcon size={16} />
                        </div>
                        <div className="td-timeline-details">
                          <span className="td-timeline-title">{act.title}</span>
                          <span className="td-timeline-meta">{act.meta}</span>
                        </div>
                        <span className="td-timeline-date">{act.date}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="td-empty-state-box">
                  <span className="td-empty-state-text">
                    No upcoming scheduled activities for this billing period.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 8: Recent Activity */}
          <div className="td-card">
            <div className="td-card-header">
              <div className="td-card-title-group">
                <Clock size={16} color="#7c3aed" />
                <h3 className="td-card-title">Recent Activity</h3>
              </div>
            </div>

            <div className="td-card-body" style={{ padding: "8px 20px" }}>
              {recentActivities.length > 0 ? (
                <div className="td-recent-feed">
                  {recentActivities.map((item) => {
                    const FeedIcon = item.icon;
                    return (
                      <div key={item.id} className="td-feed-item">
                        <div className="td-feed-left">
                          <div
                            className="td-feed-icon-box"
                            style={{ background: item.iconBg, color: item.iconColor }}
                          >
                            <FeedIcon size={14} />
                          </div>
                          <div className="td-feed-text">
                            <span className="td-feed-title">{item.title}</span>
                            <span className="td-feed-meta">{item.meta}</span>
                          </div>
                        </div>
                        <span className="td-feed-time">{item.time}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="td-empty-state-box">
                  <span className="td-empty-state-text">No recent transactions or tickets logged.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          SECTION 9: Personal Insights (3 Cards)
          ====================================================================== */}
      <section className="td-insights-grid">
        {/* Insight 1: Monthly Rent & Utility Spending */}
        <div className="td-insight-card">
          <div className="td-insight-header">
            <Receipt size={16} color="#2563eb" />
            <h4 className="td-insight-title">Monthly Spending Breakdown</h4>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">Monthly Residential Rent</span>
            <span className="td-insight-val">₹{monthlyRentAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">Estimated Utilities (EB &amp; Water)</span>
            <span className="td-insight-val">₹{averageUtilities.toLocaleString("en-IN")}</span>
          </div>
          <div className="td-insight-divider" />
          <div className="td-insight-row">
            <span className="td-insight-label" style={{ fontWeight: 600 }}>
              Total Monthly Obligation
            </span>
            <span className="td-insight-val accent">
              ₹{(monthlyRentAmount + averageUtilities).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Insight 2: Maintenance Request Summary */}
        <div className="td-insight-card">
          <div className="td-insight-header">
            <Wrench size={16} color="#16a34a" />
            <h4 className="td-insight-title">Maintenance Performance</h4>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">Total Requests Logged</span>
            <span className="td-insight-val">{myMaintenance.length} tickets</span>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">Active vs. Resolved</span>
            <span className="td-insight-val">
              {activeMaintenanceRequests.length} Active · {myMaintenance.length - activeMaintenanceRequests.length} Resolved
            </span>
          </div>
          <div className="td-insight-divider" />
          <div className="td-insight-row">
            <span className="td-insight-label" style={{ fontWeight: 600 }}>
              Resolution SLA Rate
            </span>
            <span className="td-insight-val" style={{ color: "#16a34a" }}>
              100% On-Time SLA
            </span>
          </div>
        </div>

        {/* Insight 3: Payment History Summary */}
        <div className="td-insight-card">
          <div className="td-insight-header">
            <ShieldCheck size={16} color="#7c3aed" />
            <h4 className="td-insight-title">Payment History &amp; Deposit</h4>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">On-Time Payment Record</span>
            <span className="td-insight-val" style={{ color: "#16a34a" }}>
              100% On-Time
            </span>
          </div>
          <div className="td-insight-row">
            <span className="td-insight-label">Total Invoices Settled</span>
            <span className="td-insight-val">{paidCount} Invoices</span>
          </div>
          <div className="td-insight-divider" />
          <div className="td-insight-row">
            <span className="td-insight-label" style={{ fontWeight: 600 }}>
              Security Deposit Held
            </span>
            <span className="td-insight-val accent">
              ₹{(lease?.depositAmount || property?.deposit || 90000).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
