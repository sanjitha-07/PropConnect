import { useState, useEffect, useMemo, useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  PROPERTIES as INITIAL_PROPERTIES,
  TENANTS as INITIAL_TENANTS,
  LANDLORDS as INITIAL_LANDLORDS,
  LEASES as INITIAL_LEASES,
  PAYMENTS as INITIAL_PAYMENTS,
  MAINTENANCE_REQUESTS as INITIAL_MAINTENANCE,
  COMPLAINTS as INITIAL_COMPLAINTS,
  SECURITY_DEPOSITS as INITIAL_DEPOSITS,
  UTILITY_BILLS as INITIAL_UTILITIES,
  EXPENSES as INITIAL_EXPENSES,
} from "../../data/db.js";
import {
  fetchProperties,
  fetchTenants,
  fetchLandlords,
  fetchLeases,
  fetchPayments,
  fetchMaintenance,
  fetchComplaints,
  fetchDeposits,
  fetchUtilityBills,
  fetchExpenses,
} from "../../utils/apiClient.js";

export default function AnalyticsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const role = user?.role || "admin";
  const isLandlord = role === "landlord";
  const isTenant = role === "tenant";
  const userEntityId = user?.entityId || user?.entity_id;

  // Master State
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [utilityBills, setUtilityBills] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState("financial"); // 'financial' | 'occupancy' | 'leases' | 'operations' | 'simulator'
  const [timeframe, setTimeframe] = useState("all"); // 'all' | 'sep26' | 'q3_2026' | 'ytd_2026'
  const [selectedCity, setSelectedCity] = useState("all");
  const [landlordScope, setLandlordScope] = useState(isLandlord ? "mine" : "all"); // 'mine' | 'all'
  const [toastMessage, setToastMessage] = useState(null);

  // Simulator Sliders State
  const [simOccupancy, setSimOccupancy] = useState(95);
  const [simRentHike, setSimRentHike] = useState(6);
  const [simExpenseCut, setSimExpenseCut] = useState(10);

  // Chart Hover State
  const [hoveredBar, setHoveredBar] = useState(null);

  // Load Real Data with Fallbacks
  useEffect(() => {
    let isMounted = true;
    async function loadAllData() {
      setLoading(true);
      try {
        const [
          propsData,
          tenantsData,
          landlordsData,
          leasesData,
          paymentsData,
          maintData,
          compData,
          depData,
          utilData,
          expData,
        ] = await Promise.all([
          fetchProperties().catch(() => null),
          fetchTenants().catch(() => null),
          fetchLandlords().catch(() => null),
          fetchLeases().catch(() => null),
          fetchPayments().catch(() => null),
          fetchMaintenance().catch(() => null),
          fetchComplaints().catch(() => null),
          fetchDeposits().catch(() => null),
          fetchUtilityBills().catch(() => null),
          fetchExpenses().catch(() => null),
        ]);

        if (isMounted) {
          setProperties(Array.isArray(propsData) && propsData.length > 0 ? propsData : INITIAL_PROPERTIES);
          setTenants(Array.isArray(tenantsData) && tenantsData.length > 0 ? tenantsData : INITIAL_TENANTS);
          setLandlords(Array.isArray(landlordsData) && landlordsData.length > 0 ? landlordsData : INITIAL_LANDLORDS);
          setLeases(Array.isArray(leasesData) && leasesData.length > 0 ? leasesData : INITIAL_LEASES);
          setPayments(Array.isArray(paymentsData) && paymentsData.length > 0 ? paymentsData : INITIAL_PAYMENTS);
          setMaintenance(Array.isArray(maintData) && maintData.length > 0 ? maintData : INITIAL_MAINTENANCE);
          setComplaints(Array.isArray(compData) && compData.length > 0 ? compData : INITIAL_COMPLAINTS);
          setDeposits(Array.isArray(depData) && depData.length > 0 ? depData : INITIAL_DEPOSITS);
          setUtilityBills(Array.isArray(utilData) && utilData.length > 0 ? utilData : INITIAL_UTILITIES);
          setExpenses(Array.isArray(expData) && expData.length > 0 ? expData : INITIAL_EXPENSES);
        }
      } catch (err) {
        console.warn("Analytics loadData error, using initial db:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAllData();
    return () => {
      isMounted = false;
    };
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // Data Filtering (by Role, Landlord Scope, City, Timeframe)
  // -------------------------------------------------------------
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (isLandlord && landlordScope === "mine" && userEntityId) {
        if (p.landlordId !== userEntityId) return false;
      }
      if (isTenant && userEntityId) {
        if (p.tenantId !== userEntityId && p.id !== user?.propertyId) return false;
      }
      if (selectedCity !== "all" && p.city !== selectedCity) return false;
      return true;
    });
  }, [properties, isLandlord, isTenant, landlordScope, userEntityId, user?.propertyId, selectedCity]);

  const propertyIdSet = useMemo(() => {
    return new Set(filteredProperties.map((p) => p.id));
  }, [filteredProperties]);

  const filteredPayments = useMemo(() => {
    return payments.filter((pm) => {
      if (filteredProperties.length > 0 && !propertyIdSet.has(pm.propertyId)) {
        // If property filtering is active, only include payments for matching properties
        if (selectedCity !== "all" || (isLandlord && landlordScope === "mine") || isTenant) {
          return false;
        }
      }
      if (timeframe === "sep26") {
        return (pm.month || "").includes("Sep 2026") || pm.month === "Sep";
      }
      if (timeframe === "q3_2026") {
        const m = pm.month || "";
        return m.includes("Jul") || m.includes("Aug") || m.includes("Sep");
      }
      return true;
    });
  }, [payments, propertyIdSet, filteredProperties, selectedCity, isLandlord, landlordScope, isTenant, timeframe]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filteredProperties.length > 0 && e.propertyId && !propertyIdSet.has(e.propertyId)) {
        if (selectedCity !== "all" || (isLandlord && landlordScope === "mine") || isTenant) {
          return false;
        }
      }
      if (timeframe === "sep26") {
        return (e.date || "").includes("Sep 2026");
      }
      if (timeframe === "q3_2026") {
        const d = e.date || "";
        return d.includes("Jul") || d.includes("Aug") || d.includes("Sep");
      }
      return true;
    });
  }, [expenses, propertyIdSet, filteredProperties, selectedCity, isLandlord, landlordScope, isTenant, timeframe]);

  const filteredMaintenance = useMemo(() => {
    return maintenance.filter((m) => {
      if (filteredProperties.length > 0 && !propertyIdSet.has(m.propertyId)) {
        if (selectedCity !== "all" || (isLandlord && landlordScope === "mine") || isTenant) {
          return false;
        }
      }
      return true;
    });
  }, [maintenance, propertyIdSet, filteredProperties, selectedCity, isLandlord, landlordScope, isTenant]);

  const filteredLeases = useMemo(() => {
    return leases.filter((l) => {
      if (filteredProperties.length > 0 && !propertyIdSet.has(l.propertyId)) {
        if (selectedCity !== "all" || (isLandlord && landlordScope === "mine") || isTenant) {
          return false;
        }
      }
      return true;
    });
  }, [leases, propertyIdSet, filteredProperties, selectedCity, isLandlord, landlordScope, isTenant]);

  // -------------------------------------------------------------
  // Executive KPI Computations
  // -------------------------------------------------------------
  const totalUnits = filteredProperties.length;
  const occupiedUnits = filteredProperties.filter((p) => p.status === "Occupied").length;
  const vacantUnits = totalUnits - occupiedUnits;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Payments / Revenue
  const totalInvoiced = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalCollected = filteredPayments
    .filter((p) => p.status === "Paid")
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalPending = filteredPayments
    .filter((p) => p.status === "Pending")
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalOverdue = filteredPayments
    .filter((p) => p.status === "Overdue")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  // Expenses & Net Operating Income (NOI)
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netOperatingIncome = totalCollected - totalExpenses;
  const profitMargin = totalCollected > 0 ? Math.round((netOperatingIncome / totalCollected) * 100) : 0;

  // Rental Yield (Annualized rent vs typical property valuation approx 200x monthly rent in TN)
  const totalMonthlyAssetRent = filteredProperties.reduce((acc, p) => acc + (p.rent || 0), 0);
  const estimatedPortfolioValue = totalMonthlyAssetRent * 220; // Standard TN residential cap rate multiple
  const annualizedGrossRent = totalMonthlyAssetRent * 12;
  const rentalYield = estimatedPortfolioValue > 0 ? ((annualizedGrossRent / estimatedPortfolioValue) * 100).toFixed(2) : "6.5";

  // Maintenance & SLA Resolution
  const totalTickets = filteredMaintenance.length;
  const resolvedTickets = filteredMaintenance.filter(
    (m) => m.status === "Completed" || m.status === "Resolved"
  ).length;
  const ticketResolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;

  // -------------------------------------------------------------
  // Chart 1: Monthly Cashflow Trend (May - Sep 2026)
  // -------------------------------------------------------------
  const monthlyCashflowData = useMemo(() => {
    const months = [
      { key: "May", label: "May 2026" },
      { key: "Jun", label: "Jun 2026" },
      { key: "Jul", label: "Jul 2026" },
      { key: "Aug", label: "Aug 2026" },
      { key: "Sep", label: "Sep 2026" },
    ];

    return months.map((m) => {
      const monthPayments = filteredPayments.filter((p) => (p.month || "").includes(m.key));
      const collected = monthPayments
        .filter((p) => p.status === "Paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const pending = monthPayments
        .filter((p) => p.status !== "Paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const invoiced = collected + pending;

      const monthExpenses = filteredExpenses
        .filter((e) => (e.date || "").includes(m.key))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const netIncome = collected - monthExpenses;

      return {
        key: m.key,
        label: m.label,
        collected,
        pending,
        invoiced,
        expenses: monthExpenses,
        netIncome,
      };
    });
  }, [filteredPayments, filteredExpenses]);

  const maxChartValue = useMemo(() => {
    const values = monthlyCashflowData.map((d) => Math.max(d.invoiced, d.expenses));
    return Math.max(...values, 80000);
  }, [monthlyCashflowData]);

  // -------------------------------------------------------------
  // Chart 2: Operating Expense Category Breakdown
  // -------------------------------------------------------------
  const expenseCategories = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((exp) => {
      const cat = exp.category || "General Maintenance";
      map[cat] = (map[cat] || 0) + (exp.amount || 0);
    });

    const entries = Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
    }));
    entries.sort((a, b) => b.amount - a.amount);
    return entries;
  }, [filteredExpenses]);

  // -------------------------------------------------------------
  // City-wise Performance Matrix (Tamil Nadu Districts)
  // -------------------------------------------------------------
  const cityMatrix = useMemo(() => {
    const cities = ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem", "Tiruppur"];
    return cities.map((cityName) => {
      const cityProps = properties.filter((p) => p.city === cityName);
      const cTotal = cityProps.length;
      const cOccupied = cityProps.filter((p) => p.status === "Occupied").length;
      const cRate = cTotal > 0 ? Math.round((cOccupied / cTotal) * 100) : 0;
      const avgRent = cTotal > 0 ? Math.round(cityProps.reduce((s, p) => s + (p.rent || 0), 0) / cTotal) : 0;
      const totalRev = cityProps.reduce((s, p) => s + (p.rent || 0), 0);
      return {
        city: cityName,
        totalUnits: cTotal,
        occupied: cOccupied,
        rate: cRate,
        avgRent,
        totalRev,
      };
    }).filter((c) => c.totalUnits > 0);
  }, [properties]);

  // -------------------------------------------------------------
  // BHK Unit Configuration Analysis
  // -------------------------------------------------------------
  const bhkMatrix = useMemo(() => {
    const configs = [
      { label: "1 BHK", bedrooms: 1 },
      { label: "2 BHK", bedrooms: 2 },
      { label: "3 BHK", bedrooms: 3 },
      { label: "4 BHK Villa", bedrooms: 4 },
      { label: "Commercial / Parking", bedrooms: 0 },
    ];

    return configs.map((cfg) => {
      const matched = properties.filter((p) => p.bedrooms === cfg.bedrooms);
      const count = matched.length;
      const occ = matched.filter((p) => p.status === "Occupied").length;
      const avgRent = count > 0 ? Math.round(matched.reduce((s, p) => s + (p.rent || 0), 0) / count) : 0;
      const avgArea = count > 0 ? Math.round(matched.reduce((s, p) => s + (p.area || 0), 0) / count) : 0;
      const occPct = count > 0 ? Math.round((occ / count) * 100) : 0;

      return {
        ...cfg,
        count,
        occupied: occ,
        avgRent,
        avgArea,
        occPct,
      };
    }).filter((cfg) => cfg.count > 0);
  }, [properties]);

  // -------------------------------------------------------------
  // Lease Expiry Pipeline (30, 60, 90 days radar)
  // -------------------------------------------------------------
  const leasePipeline = useMemo(() => {
    // Current reference date: Sep 2026
    const refDate = new Date("2026-09-05");
    return filteredLeases.map((l) => {
      let daysRemaining = 180;
      if (l.endDate) {
        const end = new Date(l.endDate);
        if (!isNaN(end.getTime())) {
          const diffMs = end.getTime() - refDate.getTime();
          daysRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }
      }
      let urgency = "safe";
      if (daysRemaining <= 30) urgency = "critical";
      else if (daysRemaining <= 60) urgency = "warning";
      else if (daysRemaining <= 90) urgency = "moderate";

      return {
        ...l,
        daysRemaining,
        urgency,
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [filteredLeases]);

  // -------------------------------------------------------------
  // Tenant Payment Reliability Scorecard
  // -------------------------------------------------------------
  const tenantScorecard = useMemo(() => {
    const map = {};
    payments.forEach((pm) => {
      if (!map[pm.tenantId]) {
        map[pm.tenantId] = {
          tenantId: pm.tenantId,
          tenantName: pm.tenantName,
          propertyName: pm.propertyName,
          totalInvoices: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          totalPaidAmt: 0,
        };
      }
      map[pm.tenantId].totalInvoices += 1;
      if (pm.status === "Paid") {
        map[pm.tenantId].paidCount += 1;
        map[pm.tenantId].totalPaidAmt += (pm.amount || 0);
      } else if (pm.status === "Pending") {
        map[pm.tenantId].pendingCount += 1;
      } else if (pm.status === "Overdue") {
        map[pm.tenantId].overdueCount += 1;
      }
    });

    return Object.values(map).map((tItem) => {
      const score = Math.round((tItem.paidCount / Math.max(1, tItem.totalInvoices)) * 100);
      let tier = "Tier 1 - Prompt";
      let tierColor = "#16a34a";
      if (tItem.overdueCount > 0) {
        tier = "Tier 3 - Overdue Alert";
        tierColor = "#dc2626";
      } else if (tItem.pendingCount > 0 || score < 90) {
        tier = "Tier 2 - Grace Period";
        tierColor = "#d97706";
      }
      return {
        ...tItem,
        score,
        tier,
        tierColor,
      };
    });
  }, [payments]);

  // -------------------------------------------------------------
  // Maintenance Category & SLA Stats
  // -------------------------------------------------------------
  const maintenanceStats = useMemo(() => {
    const cats = {};
    filteredMaintenance.forEach((m) => {
      let c = "Plumbing";
      const issue = (m.issueText || m.issueKey || "").toLowerCase();
      if (issue.includes("ac") || issue.includes("cooling")) c = "HVAC / Air Conditioning";
      else if (issue.includes("light") || issue.includes("spark") || issue.includes("switch") || issue.includes("electric")) c = "Electrical";
      else if (issue.includes("lock") || issue.includes("door") || issue.includes("roller")) c = "Carpentry & Locks";
      else if (issue.includes("paint") || issue.includes("grill")) c = "Civil & Painting";
      else if (issue.includes("water") || issue.includes("leak") || issue.includes("sink") || issue.includes("plumb")) c = "Plumbing";
      else if (issue.includes("intercom") || issue.includes("sensor") || issue.includes("rfid") || issue.includes("gate")) c = "Security & Access";

      if (!cats[c]) cats[c] = { category: c, total: 0, resolved: 0 };
      cats[c].total += 1;
      if (m.status === "Completed" || m.status === "Resolved") cats[c].resolved += 1;
    });

    return Object.values(cats);
  }, [filteredMaintenance]);

  // -------------------------------------------------------------
  // Dynamic Simulator Forecast Computations
  // -------------------------------------------------------------
  const simResults = useMemo(() => {
    const baseAnnualRent = annualizedGrossRent || 4500000;
    const baseExpenses = (totalExpenses || 45000) * 12;

    // Projected adjusted occupancy factor
    const occFactor = simOccupancy / 100;
    // Projected rent escalation factor
    const rentFactor = 1 + simRentHike / 100;
    // Projected expense cut factor
    const expFactor = 1 - simExpenseCut / 100;

    const projectedGross = Math.round(baseAnnualRent * rentFactor * (occFactor / (occupancyRate / 100 || 0.92)));
    const projectedExp = Math.round(baseExpenses * expFactor);
    const projectedNOI = projectedGross - projectedExp;
    const currentNOI = Math.max(0, baseAnnualRent * (occupancyRate / 100 || 0.92) - baseExpenses);
    const deltaNOI = projectedNOI - currentNOI;
    const monthlyCashflowBoost = Math.round(deltaNOI / 12);
    const projectedCapVal = Math.round(projectedNOI * 16.5); // 16.5x NOI standard cap valuation

    return {
      projectedGross,
      projectedExp,
      projectedNOI,
      deltaNOI,
      monthlyCashflowBoost,
      projectedCapVal,
    };
  }, [annualizedGrossRent, totalExpenses, simOccupancy, simRentHike, simExpenseCut, occupancyRate]);

  // -------------------------------------------------------------
  // CSV Export Action
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    const headers = [
      "Property ID",
      "Property Name",
      "City",
      "Builder",
      "Monthly Rent (INR)",
      "Status",
      "BHK",
      "Area (Sq Ft)",
      "Occupancy Status",
      "Security Deposit (INR)",
    ];

    const rows = filteredProperties.map((p) => [
      `"${p.id}"`,
      `"${p.name || ""}"`,
      `"${p.city || ""}"`,
      `"${p.builder || ""}"`,
      p.rent || 0,
      `"${p.status || ""}"`,
      p.bedrooms || 0,
      p.area || 0,
      p.status === "Occupied" ? "Occupied" : "Vacant",
      p.deposit || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PropConnect_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast(t("Analytics CSV report exported successfully!"));
  };

  const handlePrintSummary = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // Tenant Specific View
  // -------------------------------------------------------------
  if (isTenant) {
    const tenantLeases = leases.filter((l) => l.tenantId === userEntityId || l.tenant_id === userEntityId);
    const tenantLease =
      tenantLeases.find((l) => (l.status || "").toLowerCase() === "active" && !l.id?.includes("-P") && !l.id?.includes("-S")) ||
      tenantLeases.find((l) => (l.status || "").toLowerCase() === "active") ||
      tenantLeases[0] ||
      null;

    const tenantProperty =
      properties.find((p) => p.id === tenantLease?.propertyId || p.id === tenantLease?.property_id) ||
      properties.find((p) => p.id === user?.propertyId || p.tenantId === userEntityId) ||
      properties[0];

    const tenantMonthlyObligation = Number(
      tenantLease?.monthlyRent || tenantLease?.monthly_rent || tenantLease?.rent || tenantProperty?.rent || 22000
    );

    const tenantPmts = payments.filter((p) => p.tenantId === userEntityId || p.propertyId === tenantProperty?.id);
    const tenantTotalPaid = tenantPmts.filter((p) => (p.status || "").toLowerCase() === "paid").reduce((s, p) => s + (p.amount || 0), 0);
    const tenantMaintTickets = maintenance.filter((m) => m.tenantId === userEntityId || m.propertyId === tenantProperty?.id);
    const tenantDeposit = deposits.find((d) => d.tenantId === userEntityId || d.propertyId === tenantProperty?.id);

    return (
      <div className="analytics-page">
        <PageHero
          badge="Resident Tenancy Analytics"
          title="My Residence Financial & Utility Insights"
          subtitle="Real-time track of your monthly rent payments, security deposit escrow status, and municipal maintenance SLA"
          actions={
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn-secondary" onClick={handlePrintSummary}>
                🖨️ {t("Print Summary")}
              </button>
            </div>
          }
        />

        {toastMessage && (
          <div className="toast-banner" style={{ background: "#10b981", color: "#ffffff", padding: "10px 18px", borderRadius: "8px", marginBottom: "16px", fontWeight: 600 }}>
            {toastMessage}
          </div>
        )}

        {/* Tenant KPI Cards */}
        <div className="stat-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="stat">
            <div className="stat-header">
              <span className="lbl">{t("Total Rent Paid")}</span>
              <span className="stat-icon-wrap">💰</span>
            </div>
            <div className="val">₹{tenantTotalPaid.toLocaleString("en-IN")}</div>
            <div className="stat-footer">
              <span className="trend-badge positive">100% Verified</span>
              <span>{tenantPmts.length} invoices on record</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-header">
              <span className="lbl">{t("Monthly Obligation")}</span>
              <span className="stat-icon-wrap">🏠</span>
            </div>
            <div className="val">₹{tenantMonthlyObligation.toLocaleString("en-IN")}</div>
            <div className="stat-footer">
              <span className="trend-badge neutral">Due 5th of Month</span>
              <span>{tenantProperty?.name || "Apartment"}</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-header">
              <span className="lbl">{t("Security Deposit Held")}</span>
              <span className="stat-icon-wrap">🛡️</span>
            </div>
            <div className="val">₹{(tenantDeposit?.amount || tenantProperty?.deposit || 80000).toLocaleString("en-IN")}</div>
            <div className="stat-footer">
              <span className="trend-badge positive">Secured Escrow</span>
              <span>Ref: {tenantDeposit?.receiptNo || "RCT-DEP-001"}</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-header">
              <span className="lbl">{t("Maintenance Tickets")}</span>
              <span className="stat-icon-wrap">⚙️</span>
            </div>
            <div className="val">{tenantMaintTickets.length} Raised</div>
            <div className="stat-footer">
              <span className="trend-badge positive">
                {tenantMaintTickets.filter((m) => m.status === "Completed" || m.status === "Resolved").length} Resolved
              </span>
              <span>Avg SLA &lt; 24h</span>
            </div>
          </div>
        </div>

        {/* Payment History & Lease Health */}
        <div className="dashboard-two-col" style={{ gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
          <div className="card">
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{t("Recent Tenancy Payment Records")}</h3>
                <p className="card-subtitle">{t("Official receipts and transaction references")}</p>
              </div>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>{t("Invoice")}</th>
                    <th>{t("Month")}</th>
                    <th>{t("Amount")}</th>
                    <th>{t("Due Date")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Method")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantPmts.map((p) => (
                    <tr key={p.id}>
                      <td><strong style={{ color: "var(--accent-primary)" }}>{p.id}</strong></td>
                      <td>{p.month}</td>
                      <td>₹{(p.amount || 0).toLocaleString("en-IN")}</td>
                      <td>{p.dueDate}</td>
                      <td>
                        <span className={`status-chip ${p.status === "Paid" ? "active" : p.status === "Pending" ? "pending" : "overdue"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{p.method || "UPI"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: 0 }}>{t("Lease Agreement Overview")}</h3>
            <p className="card-subtitle">{t("Terms registered under Tamil Nadu Tenancy Act")}</p>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "6px" }}>
                <span style={{ color: "var(--ink-muted)" }}>Registered Tenancy ID</span>
                <strong>{tenantLease?.regNumber || "TN-CH-REG-2026-8891"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "6px" }}>
                <span style={{ color: "var(--ink-muted)" }}>Start Date</span>
                <strong>{tenantLease?.startDate || "01 Jan 2026"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "6px" }}>
                <span style={{ color: "var(--ink-muted)" }}>End Date</span>
                <strong>{tenantLease?.endDate || "31 Dec 2026"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "6px" }}>
                <span style={{ color: "var(--ink-muted)" }}>Notice Period</span>
                <strong>60 Days Prior Notice</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "6px" }}>
                <span style={{ color: "var(--ink-muted)" }}>Annual Escalation</span>
                <strong>5.0% on Renewal</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Admin & Landlord View
  // -------------------------------------------------------------
  return (
    <div className="analytics-page">
      {/* Page Hero with Executive Filters & Action Bar */}
      <PageHero
        badge={role === "admin" ? "Tamil Nadu Master Intelligence" : "Landlord Portfolio Analytics"}
        title={t("Analytics & Executive Insights")}
        subtitle={t("Real-time portfolio yields, occupancy intelligence, revenue cash flow, and operational SLA tracking")}
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="analytics-select"
              aria-label="Filter by City"
            >
              <option value="all">📍 {t("All Regions (TN)")}</option>
              <option value="Chennai">Chennai</option>
              <option value="Coimbatore">Coimbatore</option>
              <option value="Madurai">Madurai</option>
              <option value="Trichy">Trichy</option>
              <option value="Salem">Salem</option>
              <option value="Tiruppur">Tiruppur</option>
            </select>

            {/* Timeframe Filter */}
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="analytics-select"
              aria-label="Select Timeframe"
            >
              <option value="all">📅 {t("All Time (2026)")}</option>
              <option value="sep26">Current Month (Sep 2026)</option>
              <option value="q3_2026">Q3 2026 (Jul - Sep)</option>
            </select>

            {/* Landlord Portfolio Scope Toggle (if Landlord) */}
            {isLandlord && (
              <button
                className={`btn-secondary ${landlordScope === "mine" ? "active-pill" : ""}`}
                onClick={() => setLandlordScope((prev) => (prev === "mine" ? "all" : "mine"))}
                title="Toggle between personal units and Tamil Nadu market benchmarks"
              >
                {landlordScope === "mine" ? "👤 My Properties" : "🌐 TN Benchmark"}
              </button>
            )}

            {/* Export CSV Button */}
            <button className="btn-secondary" onClick={handleExportCSV} title="Export CSV Report">
              📥 {t("Export CSV")}
            </button>

            {/* Print Summary */}
            <button className="btn-secondary" onClick={handlePrintSummary} title="Print Report">
              🖨️ {t("Print")}
            </button>
          </div>
        }
      />

      {toastMessage && (
        <div className="toast-banner" style={{ background: "#10b981", color: "#ffffff", padding: "10px 18px", borderRadius: "8px", marginBottom: "16px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✓ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px" }}>✕</button>
        </div>
      )}

      {/* 6 Executive KPI Stat Cards */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: "24px" }}>
        {/* KPI 1: Gross Revenue Collected */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Gross Collected")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}>💰</span>
          </div>
          <div className="val">₹{totalCollected.toLocaleString("en-IN")}</div>
          <div className="stat-footer">
            <span className="trend-badge positive">+{collectionRate}% efficiency</span>
            <span>₹{(totalInvoiced / 1000).toFixed(0)}k billed</span>
          </div>
          {/* Progress bar */}
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, collectionRate)}%`, height: "100%", background: "#2563eb", borderRadius: "2px" }} />
          </div>
        </div>

        {/* KPI 2: Net Operating Income (NOI) */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Net Operating Income")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(22, 163, 74, 0.1)", color: "#16a34a" }}>📈</span>
          </div>
          <div className="val">₹{netOperatingIncome.toLocaleString("en-IN")}</div>
          <div className="stat-footer">
            <span className="trend-badge positive">{profitMargin}% margin</span>
            <span>less ₹{(totalExpenses / 1000).toFixed(0)}k ops</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%`, height: "100%", background: "#16a34a", borderRadius: "2px" }} />
          </div>
        </div>

        {/* KPI 3: Occupancy Rate */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Occupancy Rate")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}>🔑</span>
          </div>
          <div className="val">{occupancyRate}%</div>
          <div className="stat-footer">
            <span className="trend-badge positive">{occupiedUnits}/{totalUnits} units</span>
            <span>{vacantUnits} vacant</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${occupancyRate}%`, height: "100%", background: "#7c3aed", borderRadius: "2px" }} />
          </div>
        </div>

        {/* KPI 4: Pending & Overdue Receivables */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Pending Receivables")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(217, 119, 6, 0.1)", color: "#d97706" }}>⏳</span>
          </div>
          <div className="val">₹{totalPending.toLocaleString("en-IN")}</div>
          <div className="stat-footer">
            <span className="trend-badge negative">₹{(totalOverdue / 1000).toFixed(0)}k overdue</span>
            <span>{filteredPayments.filter((p) => p.status !== "Paid").length} invoices</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.round((totalPending / Math.max(1, totalInvoiced)) * 100))}%`, height: "100%", background: "#d97706", borderRadius: "2px" }} />
          </div>
        </div>

        {/* KPI 5: Annualized Rental Yield */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Gross Rental Yield")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(8, 145, 178, 0.1)", color: "#0891b2" }}>🏛️</span>
          </div>
          <div className="val">{rentalYield}%</div>
          <div className="stat-footer">
            <span className="trend-badge positive">+1.8% vs Bank FD</span>
            <span>TN Metro benchmark</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.round((Number(rentalYield) / 10) * 100))}%`, height: "100%", background: "#0891b2", borderRadius: "2px" }} />
          </div>
        </div>

        {/* KPI 6: Maintenance & SLA Resolution */}
        <div className="stat">
          <div className="stat-header">
            <span className="lbl">{t("Maintenance SLA")}</span>
            <span className="stat-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>⚙️</span>
          </div>
          <div className="val">{ticketResolutionRate}%</div>
          <div className="stat-footer">
            <span className="trend-badge positive">{resolvedTickets}/{totalTickets} closed</span>
            <span>Turnaround &lt; 24h</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
            <div style={{ width: `${ticketResolutionRate}%`, height: "100%", background: "#10b981", borderRadius: "2px" }} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Deep Dive Analytics */}
      <div className="analytics-tabs-header" style={{ display: "flex", gap: "8px", borderBottom: "2px solid var(--border-subtle)", marginBottom: "24px", overflowX: "auto", paddingBottom: "2px" }}>
        {[
          { key: "financial", label: "💰 Financial & Cash Flow" },
          { key: "occupancy", label: "🏢 Occupancy & Yield Leaderboard" },
          { key: "leases", label: "📜 Tenant Health & Expirations" },
          { key: "operations", label: "🛠️ Maintenance & SLA" },
          { key: "simulator", label: "🧮 What-If Yield Forecast" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`analytics-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            style={{
              padding: "10px 18px",
              border: "none",
              background: activeTab === tab.key ? "var(--accent-subtle)" : "transparent",
              color: activeTab === tab.key ? "var(--accent-primary)" : "var(--ink-secondary)",
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: "13.5px",
              borderRadius: "8px 8px 0 0",
              borderBottom: activeTab === tab.key ? "3px solid var(--accent-primary)" : "3px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FINANCIAL & CASH FLOW INTELLIGENCE                 */}
      {/* ========================================================= */}
      {activeTab === "financial" && (
        <div className="tab-pane-fade-in">
          {/* Main Financial Trend SVG Chart */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{t("Monthly Revenue, Expenses & Net Cashflow Matrix")}</h3>
                <p className="card-subtitle">{t("Real payments collected, pending balances, and verified operating expenses (May - Sep 2026)")}</p>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#2563eb" }} /> Collected Rent
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#cbd5e1" }} /> Pending
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#dc2626" }} /> Operating Expenses
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#16a34a" }} /> Net Cashflow
                </span>
              </div>
            </div>

            {/* SVG Interactive Multi-Bar & Line Chart */}
            <div style={{ width: "100%", height: "290px", marginTop: "16px", position: "relative" }}>
              <svg viewBox="0 0 650 240" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                {/* Horizontal reference grid lines */}
                {[0, 40, 80, 120, 160].map((yVal) => (
                  <g key={yVal}>
                    <line x1="40" y1={yVal + 30} x2="620" y2={yVal + 30} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="32" y={yVal + 34} textAnchor="end" fontSize="10" fill="#94a3b8">
                      ₹{Math.round(((160 - yVal) / 160) * (maxChartValue / 1000))}k
                    </text>
                  </g>
                ))}

                {/* Bars & Points */}
                {monthlyCashflowData.map((m, idx) => {
                  const xGroup = 65 + idx * 115;
                  const barW = 28;

                  const colH = (m.collected / maxChartValue) * 160;
                  const penH = (m.pending / maxChartValue) * 160;
                  const expH = (m.expenses / maxChartValue) * 160;

                  const yBase = 190;
                  const yCol = yBase - colH;
                  const yPen = yCol - penH;
                  const yExp = yBase - expH;

                  const isHovered = hoveredBar === m.key;

                  return (
                    <g
                      key={m.key}
                      onMouseEnter={() => setHoveredBar(m.key)}
                      onMouseLeave={() => setHoveredBar(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Hover highlight background */}
                      {isHovered && (
                        <rect x={xGroup - 14} y="20" width={barW * 2 + 30} height="180" fill="rgba(37, 99, 235, 0.05)" rx="6" />
                      )}

                      {/* Revenue Stack (Collected + Pending) */}
                      {penH > 0 && (
                        <rect x={xGroup} y={yPen} width={barW} height={penH} fill="#cbd5e1" rx="2" />
                      )}
                      <rect x={xGroup} y={yCol} width={barW} height={colH} fill="#2563eb" rx="2" />

                      {/* Expense Bar */}
                      <rect x={xGroup + barW + 4} y={yExp} width={barW - 6} height={expH} fill="#f87171" rx="2" />

                      {/* Values */}
                      <text x={xGroup + barW / 2} y={yCol - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#0f172a">
                        ₹{(m.collected / 1000).toFixed(0)}k
                      </text>

                      {/* Month Label */}
                      <text x={xGroup + barW} y="210" textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">
                        {m.label}
                      </text>
                    </g>
                  );
                })}

                {/* Net Income Trendline connecting the points */}
                <path
                  d={monthlyCashflowData.map((m, idx) => {
                    const x = 65 + idx * 115 + 28;
                    const netVal = Math.max(0, m.netIncome);
                    const y = 190 - (netVal / maxChartValue) * 160;
                    return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Net Income dots */}
                {monthlyCashflowData.map((m, idx) => {
                  const x = 65 + idx * 115 + 28;
                  const netVal = Math.max(0, m.netIncome);
                  const y = 190 - (netVal / maxChartValue) * 160;
                  return (
                    <circle key={`dot-${m.key}`} cx={x} cy={y} r="4.5" fill="#ffffff" stroke="#16a34a" strokeWidth="2.5" />
                  );
                })}
              </svg>

              {/* Dynamic Hover Tooltip */}
              {hoveredBar && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "24px",
                    background: "#0f172a",
                    color: "#ffffff",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                    pointerEvents: "none",
                  }}
                >
                  {(() => {
                    const item = monthlyCashflowData.find((d) => d.key === hoveredBar);
                    if (!item) return null;
                    return (
                      <div>
                        <div style={{ fontWeight: 700, borderBottom: "1px solid #334155", paddingBottom: "4px", marginBottom: "6px" }}>
                          {item.label} Breakdown
                        </div>
                        <div>Collected: <strong>₹{item.collected.toLocaleString("en-IN")}</strong></div>
                        <div>Pending: <strong>₹{item.pending.toLocaleString("en-IN")}</strong></div>
                        <div>Operating Expenses: <strong>₹{item.expenses.toLocaleString("en-IN")}</strong></div>
                        <div style={{ color: "#4ade80", marginTop: "4px" }}>
                          Net Cashflow: <strong>₹{item.netIncome.toLocaleString("en-IN")}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Two-Column: Expense Breakdown + Payment Methods & Escrow */}
          <div className="dashboard-two-col" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
            {/* Operating Expense Distribution */}
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Operating Expenses by Category")}</h3>
              <p className="card-subtitle">{t("Maintenance, Lift AMC, Security Agency, and Municipal Taxes")}</p>
              <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {expenseCategories.slice(0, 6).map((cat) => {
                  const pct = totalExpenses > 0 ? Math.round((cat.amount / totalExpenses) * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600 }}>{cat.category}</span>
                        <span style={{ color: "var(--ink-muted)" }}>
                          ₹{cat.amount.toLocaleString("en-IN")} ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "var(--bg-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #f87171, #ef4444)",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Collection Channels & Payment Modes")}</h3>
              <p className="card-subtitle">{t("Direct digital bank transfers vs UPI transactions")}</p>
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { name: "UPI (Google Pay / PhonePe / Paytm)", share: "58%", count: "18 transactions", color: "#16a34a" },
                  { name: "NEFT / RTGS NetBanking Transfer", share: "30%", count: "9 transactions", color: "#2563eb" },
                  { name: "Credit Card / Razorpay Gateway", share: "8%", count: "3 transactions", color: "#7c3aed" },
                  { name: "Cheque / Cash Counter", share: "4%", count: "1 transaction", color: "#d97706" },
                ].map((channel) => (
                  <div
                    key={channel.name}
                    style={{
                      padding: "12px 14px",
                      background: "var(--bg-subtle)",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{channel.name}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>{channel.count}</div>
                    </div>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: "#ffffff",
                        fontWeight: 700,
                        fontSize: "13px",
                        color: channel.color,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      {channel.share}
                    </span>
                  </div>
                ))}

                <div style={{ marginTop: "8px", padding: "12px", background: "rgba(37, 99, 235, 0.05)", border: "1px solid rgba(37, 99, 235, 0.15)", borderRadius: "8px", fontSize: "12px", color: "#1e40af" }}>
                  🛡️ <strong>Escrow & Security Reserves:</strong> ₹{deposits.reduce((acc, d) => acc + (d.amount || 0), 0).toLocaleString("en-IN")} held securely across registered rental deposit escrow accounts.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: OCCUPANCY & ASSET YIELD LEADERBOARD                */}
      {/* ========================================================= */}
      {activeTab === "occupancy" && (
        <div className="tab-pane-fade-in">
          {/* City Matrix Table */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{t("Tamil Nadu District & City Performance Matrix")}</h3>
                <p className="card-subtitle">{t("Cross-city comparison of occupancy rates, average rental values, and revenue contribution")}</p>
              </div>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>District / City</th>
                    <th>Total Inventory</th>
                    <th>Occupied</th>
                    <th>Occupancy %</th>
                    <th>Avg Monthly Rent</th>
                    <th>Monthly Revenue Run-Rate</th>
                    <th>Market Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {cityMatrix.map((item) => (
                    <tr key={item.city}>
                      <td>
                        <strong>{item.city}</strong>
                      </td>
                      <td>{item.totalUnits} units</td>
                      <td>{item.occupied}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 600 }}>{item.rate}%</span>
                          <div style={{ width: "60px", height: "6px", background: "#e2e8f0", borderRadius: "3px" }}>
                            <div style={{ width: `${item.rate}%`, height: "100%", background: item.rate >= 90 ? "#16a34a" : "#2563eb", borderRadius: "3px" }} />
                          </div>
                        </div>
                      </td>
                      <td>₹{item.avgRent.toLocaleString("en-IN")}</td>
                      <td><strong>₹{item.totalRev.toLocaleString("en-IN")}</strong></td>
                      <td>
                        <span className="status-chip active" style={{ fontSize: "11px" }}>
                          {item.rate >= 90 ? "🔥 High Demand" : "✨ Stable"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BHK Unit Configuration Breakdown */}
          <div className="dashboard-two-col" style={{ gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Unit Configuration Performance (BHK Analysis)")}</h3>
              <p className="card-subtitle">{t("Performance metrics across apartment sizes")}</p>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {bhkMatrix.map((bhk) => (
                  <div
                    key={bhk.label}
                    style={{
                      padding: "12px 14px",
                      background: "var(--bg-subtle)",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{bhk.label}</div>
                      <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                        {bhk.count} units • Avg Area: {bhk.avgArea} sq.ft
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: "var(--accent-primary)", fontSize: "14px" }}>
                        ₹{bhk.avgRent.toLocaleString("en-IN")} <span style={{ fontSize: "11px", fontWeight: 400 }}>/mo</span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: bhk.occPct >= 85 ? "#16a34a" : "#64748b" }}>
                        {bhk.occPct}% Occupied
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset Yield Leaderboard */}
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Top Yielding Properties Leaderboard")}</h3>
              <p className="card-subtitle">{t("Highest gross rental yield & zero-default track record")}</p>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredProperties.slice(0, 5).map((p, idx) => {
                  const estYield = ((p.rent * 12) / (p.rent * 210) * 100).toFixed(1);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: "10px 14px",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: idx === 0 ? "#fef08a" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#854d0e" }}>
                          #{idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
                          <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>{p.city} • {p.bedrooms} BHK</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "#16a34a", fontSize: "13px" }}>{estYield}% Yield</div>
                        <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>₹{(p.rent || 0).toLocaleString("en-IN")}/mo</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: TENANT LIFECYCLE & LEASE HEALTH                   */}
      {/* ========================================================= */}
      {activeTab === "leases" && (
        <div className="tab-pane-fade-in">
          {/* Lease Expiration Pipeline */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{t("Lease Expiration Radar & Renewal Pipeline")}</h3>
                <p className="card-subtitle">{t("Upcoming lease terminations requiring renewals or tenant vacating notices")}</p>
              </div>
              <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                <span className="trend-badge negative">&lt; 30 Days: Critical</span>
                <span className="trend-badge positive">&gt; 90 Days: Stable</span>
              </div>
            </div>

            <div className="table-responsive" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Lease ID</th>
                    <th>Property Name</th>
                    <th>Tenant</th>
                    <th>Expiry Date</th>
                    <th>Days Remaining</th>
                    <th>Monthly Rent</th>
                    <th>Renewal Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leasePipeline.slice(0, 8).map((l) => (
                    <tr key={l.id}>
                      <td><strong style={{ color: "var(--accent-primary)" }}>{l.id}</strong></td>
                      <td>{l.propertyName}</td>
                      <td>{l.tenantName}</td>
                      <td>{l.endDate}</td>
                      <td>
                        <span
                          className={`trend-badge ${
                            l.urgency === "critical"
                              ? "negative"
                              : l.urgency === "warning"
                              ? "negative"
                              : "positive"
                          }`}
                        >
                          {l.daysRemaining} days left
                        </span>
                      </td>
                      <td>₹{(l.rent || 0).toLocaleString("en-IN")}</td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "11.5px" }}
                          onClick={() => triggerToast(`Renewal contract drafting opened for ${l.tenantName}`)}
                        >
                          ✍️ Initiate Renewal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tenant Payment Reliability Scorecard */}
          <div className="card">
            <h3 style={{ margin: 0 }}>{t("Tenant On-Time Payment Scorecard")}</h3>
            <p className="card-subtitle">{t("Reliability tier classification based on invoice settlement timeliness")}</p>
            <div className="table-responsive" style={{ marginTop: "14px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Tenant Name</th>
                    <th>Rented Property</th>
                    <th>Total Invoices</th>
                    <th>Paid On-Time</th>
                    <th>Pending / Overdue</th>
                    <th>Score</th>
                    <th>Reliability Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantScorecard.slice(0, 8).map((tSc) => (
                    <tr key={tSc.tenantId}>
                      <td><strong>{tSc.tenantName}</strong></td>
                      <td>{tSc.propertyName}</td>
                      <td>{tSc.totalInvoices}</td>
                      <td>{tSc.paidCount}</td>
                      <td>
                        {tSc.overdueCount > 0 ? (
                          <span style={{ color: "#dc2626", fontWeight: 600 }}>{tSc.overdueCount} Overdue</span>
                        ) : tSc.pendingCount > 0 ? (
                          <span style={{ color: "#d97706" }}>{tSc.pendingCount} Pending</span>
                        ) : (
                          <span style={{ color: "#16a34a" }}>0</span>
                        )}
                      </td>
                      <td><strong>{tSc.score}%</strong></td>
                      <td>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            background: "var(--bg-subtle)",
                            color: tSc.tierColor,
                            border: `1px solid ${tSc.tierColor}33`,
                          }}
                        >
                          {tSc.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: OPERATIONS & MAINTENANCE SLA                      */}
      {/* ========================================================= */}
      {activeTab === "operations" && (
        <div className="tab-pane-fade-in">
          <div className="dashboard-two-col" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "24px", marginBottom: "24px" }}>
            {/* Maintenance Category SLA Breakdown */}
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Maintenance Work Orders & SLA Turnaround")}</h3>
              <p className="card-subtitle">{t("Ticket volume and completion rate by maintenance discipline")}</p>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {maintenanceStats.map((item) => {
                  const resPct = Math.round((item.resolved / Math.max(1, item.total)) * 100);
                  return (
                    <div key={item.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600 }}>{item.category}</span>
                        <span style={{ color: "var(--ink-muted)" }}>
                          {item.resolved}/{item.total} closed ({resPct}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "var(--bg-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${resPct}%`,
                            height: "100%",
                            background: resPct === 100 ? "#16a34a" : "#2563eb",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complaints & Resident Satisfaction Index */}
            <div className="card">
              <h3 style={{ margin: 0 }}>{t("Resident Complaints & SLA Compliance")}</h3>
              <p className="card-subtitle">{t("Escalation tracking and municipal compliance status")}</p>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "14px", background: "var(--bg-subtle)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Average First Response</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a" }}>&lt; 3.5 Hours</div>
                  </div>
                  <span style={{ fontSize: "24px" }}>⚡</span>
                </div>

                <div style={{ padding: "14px", background: "var(--bg-subtle)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Complaint Resolution Rate</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#2563eb" }}>
                      {Math.round((complaints.filter((c) => c.status === "Resolved").length / Math.max(1, complaints.length)) * 100)}%
                    </div>
                  </div>
                  <span style={{ fontSize: "24px" }}>✅</span>
                </div>

                <div style={{ padding: "14px", background: "var(--bg-subtle)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Active Open Grievances</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#d97706" }}>
                      {complaints.filter((c) => c.status !== "Resolved").length} Open Tickets
                    </div>
                  </div>
                  <span style={{ fontSize: "24px" }}>🔔</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Maintenance Work Orders Table */}
          <div className="card">
            <h3 style={{ margin: 0 }}>{t("Recent Maintenance Operations Log")}</h3>
            <p className="card-subtitle">{t("Contractor assignments, priority levels, and resolution status")}</p>
            <div className="table-responsive" style={{ marginTop: "14px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Property</th>
                    <th>Issue Description</th>
                    <th>Priority</th>
                    <th>Assigned Vendor</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenance.slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td><strong style={{ color: "var(--accent-primary)" }}>{m.id}</strong></td>
                      <td>{m.propertyName}</td>
                      <td>{m.issueText || m.issueKey || "Maintenance Task"}</td>
                      <td>
                        <span
                          className={`trend-badge ${
                            m.priority === "High" || m.priority === "Urgent" ? "negative" : "neutral"
                          }`}
                        >
                          {m.priority}
                        </span>
                      </td>
                      <td>{m.vendor || "Empaneled Agency"}</td>
                      <td>
                        <span
                          className={`status-chip ${
                            m.status === "Completed" || m.status === "Resolved"
                              ? "active"
                              : m.status === "In Progress"
                              ? "pending"
                              : "neutral"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td>{m.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: WHAT-IF YIELD FORECAST SIMULATOR                  */}
      {/* ========================================================= */}
      {activeTab === "simulator" && (
        <div className="tab-pane-fade-in">
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{t("Interactive Yield & Cash Flow Simulator")}</h3>
                <p className="card-subtitle">{t("Simulate the impact of occupancy optimization, annual rent escalations, and operating expense reductions")}</p>
              </div>
              <span className="trend-badge positive" style={{ fontSize: "12px", padding: "4px 10px" }}>
                ✨ Live Dynamic Modeling
              </span>
            </div>

            {/* Slider Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginTop: "24px", padding: "20px", background: "var(--bg-subtle)", borderRadius: "12px" }}>
              {/* Slider 1: Occupancy */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontWeight: 600, fontSize: "13px" }}>Target Occupancy Rate</label>
                  <strong style={{ color: "var(--accent-primary)" }}>{simOccupancy}%</strong>
                </div>
                <input
                  type="range"
                  min="70"
                  max="100"
                  value={simOccupancy}
                  onChange={(e) => setSimOccupancy(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-primary)", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  <span>70%</span>
                  <span>Current: {occupancyRate}%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Slider 2: Rent Hike */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontWeight: 600, fontSize: "13px" }}>Annual Rent Escalation</label>
                  <strong style={{ color: "#16a34a" }}>+{simRentHike}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={simRentHike}
                  onChange={(e) => setSimRentHike(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#16a34a", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  <span>0%</span>
                  <span>Standard: 5%</span>
                  <span>15%</span>
                </div>
              </div>

              {/* Slider 3: Expense Optimization */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontWeight: 600, fontSize: "13px" }}>Operating Expense Cut</label>
                  <strong style={{ color: "#7c3aed" }}>-{simExpenseCut}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={simExpenseCut}
                  onChange={(e) => setSimExpenseCut(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#7c3aed", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  <span>0%</span>
                  <span>Moderate: 10%</span>
                  <span>25%</span>
                </div>
              </div>
            </div>

            {/* Projected Simulation Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginTop: "24px" }}>
              <div style={{ padding: "18px", border: "1px solid var(--border-subtle)", borderRadius: "10px", background: "#ffffff" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", fontWeight: 600 }}>PROJECTED ANNUAL GROSS</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#2563eb", marginTop: "4px" }}>
                  ₹{simResults.projectedGross.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "4px" }}>
                  +₹{Math.max(0, simResults.projectedGross - annualizedGrossRent).toLocaleString("en-IN")} gross delta
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--border-subtle)", borderRadius: "10px", background: "#ffffff" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", fontWeight: 600 }}>PROJECTED ANNUAL NOI</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#16a34a", marginTop: "4px" }}>
                  ₹{simResults.projectedNOI.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "4px" }}>
                  +₹{Math.max(0, simResults.deltaNOI).toLocaleString("en-IN")} net delta
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--border-subtle)", borderRadius: "10px", background: "#ffffff" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", fontWeight: 600 }}>MONTHLY CASHFLOW BOOST</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#7c3aed", marginTop: "4px" }}>
                  +₹{simResults.monthlyCashflowBoost.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  Direct recurring net cash addition
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--border-subtle)", borderRadius: "10px", background: "#ffffff" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", fontWeight: 600 }}>ESTIMATED ASSET CAP VALUE</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
                  ₹{(simResults.projectedCapVal / 10000000).toFixed(2)} Cr
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  At standard 6.0% capital cap rate
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
