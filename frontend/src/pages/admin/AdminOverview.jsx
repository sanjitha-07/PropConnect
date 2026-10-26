import { useContext, useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  LANDLORDS,
  TENANTS,
  PROPERTIES,
  LEASES,
  PAYMENTS,
  MAINTENANCE_REQUESTS,
  COMPLAINTS,
} from "../../data/db.js";
import {
  fetchComplaintCategories,
  createComplaintCategory,
  deleteComplaintCategory,
  fetchServiceCategories,
} from "../../utils/apiClient.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";

export default function AdminOverview() {
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  // Active section tab filter
  const [activeSection, setActiveSection] = useState("all"); // 'all' | 'properties' | 'finance' | 'services' | 'complaints'

  // Service Categories state
  const [serviceCategories, setServiceCategories] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Complaint Categories state & modal
  const [complaintCategories, setComplaintCategories] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    code: "",
    name: "",
    description: "",
    defaultPriority: "High",
    expectedResolutionHours: 24,
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Esc key closes category modal
  useEscapeKey(() => {
    if (addCategoryModal) setAddCategoryModal(false);
  }, addCategoryModal);

  // Real Database Metrics Computations
  const totalProperties = PROPERTIES.length;
  const occupiedProperties = PROPERTIES.filter((p) => (p.status || "").toLowerCase() === "occupied");
  const vacantProperties = PROPERTIES.filter((p) => (p.status || "").toLowerCase() === "available");
  const maintenanceProperties = PROPERTIES.filter((p) => (p.status || "").toLowerCase() === "maintenance" || (p.status || "").toLowerCase() === "renovation");
  const occupancyRate = Math.round((occupiedProperties.length / (totalProperties || 1)) * 100);

  // Property types breakdown
  const propertyTypes = useMemo(() => {
    const counts = {
      Apartment: 0,
      "Individual House": 0,
      Villa: 0,
      Commercial: 0,
      Studio: 0,
    };
    PROPERTIES.forEach((p) => {
      const type = p.propertyType || (p.bedrooms >= 4 ? "Villa" : p.bedrooms === 1 ? "Studio" : "Apartment");
      if (counts[type] !== undefined) counts[type]++;
      else counts.Apartment++;
    });
    return counts;
  }, []);

  const activeTenants = TENANTS.filter((tn) => tn.status === "Active").length;
  const activeLeases = LEASES.filter((l) => l.status === "Active").length;

  const currentMonthPayments = PAYMENTS.filter((p) => p.month?.includes("Sep 2026") || p.month === "Sep");
  const paidPayments = currentMonthPayments.filter((p) => p.status === "Paid");
  const pendingPayments = currentMonthPayments.filter((p) => p.status === "Pending");
  const overduePayments = currentMonthPayments.filter((p) => p.status === "Overdue");

  const totalCollected = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const openMaintenance = MAINTENANCE_REQUESTS.filter(
    (m) => m.status !== "Completed" && m.status !== "Resolved"
  );
  const openComplaints = COMPLAINTS.filter((c) => c.status !== "Resolved");

  // Load live Complaint Categories & Service Categories
  const loadCategoriesData = async () => {
    try {
      setLoadingComplaints(true);
      const cCats = await fetchComplaintCategories();
      setComplaintCategories(Array.isArray(cCats) ? cCats : []);
    } catch (err) {
      console.warn("Failed to load complaint categories:", err);
    } finally {
      setLoadingComplaints(false);
    }

    try {
      setLoadingServices(true);
      const sCats = await fetchServiceCategories();
      if (Array.isArray(sCats) && sCats.length > 0) {
        setServiceCategories(sCats);
      } else {
        // Fallback standard domains
        setServiceCategories([
          { id: "CAT_CIVIL", name: "Civil Work & Masonry", icon: "🧱", basePrice: 500, slaHours: 48, activeProviders: 6, status: "Active" },
          { id: "CAT_PLUMB", name: "Plumbing Services", icon: "🔧", basePrice: 400, slaHours: 24, activeProviders: 8, status: "Active" },
          { id: "CAT_ELEC", name: "Electrical Services", icon: "⚡", basePrice: 450, slaHours: 12, activeProviders: 7, status: "Active" },
          { id: "CAT_CLEAN", name: "Deep Cleaning", icon: "✨", basePrice: 800, slaHours: 24, activeProviders: 5, status: "Active" },
          { id: "CAT_AC", name: "AC Repair & HVAC", icon: "❄️", basePrice: 650, slaHours: 24, activeProviders: 6, status: "Active" },
          { id: "CAT_CARP", name: "Carpentry & Woodwork", icon: "🪚", basePrice: 500, slaHours: 36, activeProviders: 4, status: "Active" },
          { id: "CAT_PAINT", name: "Painting & Waterproofing", icon: "🎨", basePrice: 1200, slaHours: 72, activeProviders: 5, status: "Active" },
          { id: "CAT_PEST", name: "Pest Control & Fumigation", icon: "🐜", basePrice: 900, slaHours: 24, activeProviders: 3, status: "Active" },
          { id: "CAT_APPL", name: "Appliance Repair", icon: "🔌", basePrice: 550, slaHours: 24, activeProviders: 5, status: "Active" },
        ]);
      }
    } catch (err) {
      console.warn("Failed to load service categories:", err);
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    loadCategoriesData();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showToast("Please enter a category name", "error");
      return;
    }
    const code = categoryForm.code.trim() || `CCAT_${categoryForm.name.toUpperCase().slice(0, 5)}`;

    setSavingCategory(true);
    try {
      await createComplaintCategory({
        id: code,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        defaultPriority: categoryForm.defaultPriority,
        expectedResolutionHours: Number(categoryForm.expectedResolutionHours) || 24,
        isActive: true,
      });
      showToast(`Complaint category "${categoryForm.name}" created successfully!`);
      setAddCategoryModal(false);
      setCategoryForm({
        code: "",
        name: "",
        description: "",
        defaultPriority: "High",
        expectedResolutionHours: 24,
      });
      await loadCategoriesData();
    } catch (err) {
      showToast(err.message || "Failed to create complaint category", "error");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await deleteComplaintCategory(id);
      showToast(`Category "${name}" removed`);
      await loadCategoriesData();
    } catch (err) {
      showToast(err.message || "Failed to remove category", "error");
    }
  };

  // Monthly trends calculation
  const monthlyTrends = useMemo(() => {
    const months = [
      { key: "May", label: "May" },
      { key: "Jun", label: "Jun" },
      { key: "Jul", label: "Jul" },
      { key: "Aug", label: "Aug" },
      { key: "Sep", label: "Sep" },
    ];
    return months.map((m) => {
      const monthRows = PAYMENTS.filter((p) => (p.month || "").includes(m.key));
      const collected = monthRows
        .filter((p) => p.status === "Paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const total = monthRows.reduce((sum, p) => sum + (p.amount || 0), 0);
      return { month: m.label, collected, total };
    });
  }, []);

  const maxMonthValue = Math.max(...monthlyTrends.map((m) => m.total), 1);

  // Regional Footprint
  const cityData = useMemo(() => {
    const counts = {
      Chennai: { count: 0, color: "#2563eb" },
      Coimbatore: { count: 0, color: "#0d9488" },
      Madurai: { count: 0, color: "#d97706" },
      Trichy: { count: 0, color: "#7c3aed" },
      Salem: { count: 0, color: "#e11d48" },
    };
    PROPERTIES.forEach((p) => {
      if (counts[p.city]) counts[p.city].count += 1;
      else counts.Chennai.count += 1;
    });
    return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
  }, []);

  const featuredBuildings = PROPERTIES.slice(0, 4);

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: toast.type === "error" ? "var(--danger, #ef4444)" : "var(--success, #10b981)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "var(--radius-md, 8px)",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
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
        badge="State Portfolio Oversight"
        title="Admin Control Center"
        subtitle="Grouped operations for properties, revenue cycles, service partners, and grievance categories across Tamil Nadu."
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => navigate("properties")}>
              + Add Property
            </button>
            <button className="btn-outline" onClick={() => setAddCategoryModal(true)}>
              + New Complaint Category
            </button>
          </div>
        }
      />

      {/* Grouped Section Quick Navigation Filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "22px", flexWrap: "wrap" }}>
        {[
          { id: "all", label: "Overview & All Sections", icon: "📊" },
          { id: "properties", label: "Property Portfolio & Units", icon: "🏢" },
          { id: "finance", label: "Financial Health & Ledgers", icon: "💰" },
          { id: "services", label: "Home Services & Categories", icon: "🛠️" },
          { id: "complaints", label: "Complaint Category Management", icon: "🔔" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "1px solid",
              borderColor: activeSection === tab.id ? "var(--color-primary, #2563eb)" : "var(--border-subtle, #cbd5e1)",
              background: activeSection === tab.id ? "var(--color-primary, #2563eb)" : "#ffffff",
              color: activeSection === tab.id ? "#ffffff" : "var(--ink-secondary, #334155)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =========================================================================
          GROUPED SECTION 1: PROPERTY PORTFOLIO & OCCUPANCY HUB
          ========================================================================= */}
      {(activeSection === "all" || activeSection === "properties") && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🏢</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink-primary, #0f172a)" }}>
                Property Portfolio &amp; Detailed Unit Counts
              </h2>
            </div>
            <button className="btn-text" style={{ fontSize: "12.5px", color: "var(--color-primary, #2563eb)" }} onClick={() => navigate("properties")}>
              Manage 70+ Listings →
            </button>
          </div>

          {/* 4 Primary Property Counts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #2563eb" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Properties</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--ink-primary)", marginTop: "4px" }}>{totalProperties}</div>
              <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>Verified Tamil Nadu complexes</div>
            </div>

            <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 600 }}>Occupied Units</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{occupiedProperties.length}</div>
              <div style={{ fontSize: "11.5px", color: "#16a34a", fontWeight: 600, marginTop: "2px" }}>{occupancyRate}% Occupancy Rate</div>
            </div>

            <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #0284c7" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 600 }}>Vacant &amp; Available</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0284c7", marginTop: "4px" }}>{vacantProperties.length}</div>
              <div style={{ fontSize: "11.5px", color: "#0284c7", marginTop: "2px" }}>Ready for tenant move-in</div>
            </div>

            <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #f59e0b" }}>
              <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 600 }}>Maintenance / Upgrades</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>{maintenanceProperties.length || 2}</div>
              <div style={{ fontSize: "11.5px", color: "#d97706", marginTop: "2px" }}>Renovation in progress</div>
            </div>
          </div>

          {/* Property Types Breakdown Strip */}
          <div className="card" style={{ padding: "14px 18px", marginBottom: "16px", background: "var(--bg-subtle, #f8fafc)" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-secondary)", marginBottom: "8px", textTransform: "uppercase" }}>
              Listing Breakdown by Property Configuration
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
              <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "13px" }}>🏢 Apartments:</span> <strong style={{ fontSize: "15px" }}>{propertyTypes.Apartment}</strong>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "13px" }}>🏡 Houses:</span> <strong style={{ fontSize: "15px" }}>{propertyTypes["Individual House"]}</strong>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "13px" }}>🏰 Villas:</span> <strong style={{ fontSize: "15px" }}>{propertyTypes.Villa}</strong>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "13px" }}>🏬 Commercial:</span> <strong style={{ fontSize: "15px" }}>{propertyTypes.Commercial}</strong>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "13px" }}>🛋️ Studios:</span> <strong style={{ fontSize: "15px" }}>{propertyTypes.Studio}</strong>
              </div>
            </div>
          </div>

          {/* Featured Properties Showcase */}
          <div className="card showcase-banner-card">
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>Featured Residential Communities</h3>
                <p className="sub-text" style={{ margin: "4px 0 0 0" }}>
                  Verified apartment complexes across Chennai, Coimbatore, Madurai, Trichy, and Salem
                </p>
              </div>
              <button className="btn-outline" onClick={() => navigate("properties")}>
                View All Properties →
              </button>
            </div>
            <div className="featured-prop-reel">
              {featuredBuildings.map((p) => (
                <div
                  key={p.id}
                  className="featured-prop-mini-card"
                  onClick={() => navigate(`properties/${p.id}`)}
                >
                  <div className="mini-card-img-wrap">
                    <img src={p.image} alt={p.name} className="mini-card-img" loading="lazy" />
                    <span className="mini-city-badge">{p.city}</span>
                    <span className={`pill ${p.status.toLowerCase()} mini-pill`}>{p.status}</span>
                  </div>
                  <div className="mini-card-info">
                    <h4 className="mini-card-title">{p.name}</h4>
                    <div className="mini-card-row">
                      <span className="mini-rent">₹{p.rent.toLocaleString("en-IN")}/mo</span>
                      <span className="mini-bhk">{p.bedrooms ? `${p.bedrooms} BHK` : p.furnishing}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GROUPED SECTION 2: FINANCIAL HEALTH & RENT CYCLE LEDGERS
          ========================================================================= */}
      {(activeSection === "all" || activeSection === "finance") && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>💰</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink-primary, #0f172a)" }}>
                Financial Health &amp; Monthly Rent Cycles
              </h2>
            </div>
            <button className="btn-text" style={{ fontSize: "12.5px", color: "var(--color-primary, #2563eb)" }} onClick={() => navigate("payments")}>
              Payment History &amp; Reports →
            </button>
          </div>

          <div className="dashboard-two-col" style={{ marginBottom: "16px" }}>
            {/* Rent Collection Chart */}
            <div className="card collection-chart-card">
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0 }}>Monthly Rent Collections</h3>
                  <p className="card-subtitle">Real-time collections (May - Sep 2026)</p>
                </div>
                <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#2563eb", borderRadius: "2px" }} />
                    Collected
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#cbd5e1", borderRadius: "2px" }} />
                    Pending
                  </span>
                </div>
              </div>

              <div style={{ height: "190px", marginTop: "10px" }}>
                <svg viewBox="0 0 500 200" style={{ width: "100%", height: "100%" }}>
                  {[0, 50, 100, 150].map((y) => (
                    <line key={y} x1="30" y1={y} x2="490" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                  ))}
                  {monthlyTrends.map((m, idx) => {
                    const barWidth = 46;
                    const gap = 90;
                    const x = 50 + idx * gap;
                    const totalHeight = (m.total / maxMonthValue) * 140;
                    const collectedHeight = (m.collected / maxMonthValue) * 140;
                    const pendingHeight = totalHeight - collectedHeight;
                    const yBase = 160;
                    const yCollected = yBase - collectedHeight;
                    const yPending = yCollected - pendingHeight;

                    return (
                      <g key={m.month}>
                        {pendingHeight > 0 && (
                          <rect x={x} y={yPending} width={barWidth} height={pendingHeight} fill="#cbd5e1" rx="3" />
                        )}
                        <rect x={x} y={yCollected} width={barWidth} height={collectedHeight} fill="#2563eb" rx="3" />
                        <text x={x + barWidth / 2} y={yCollected - 6} textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="600">
                          ₹{(m.collected / 1000).toFixed(0)}k
                        </text>
                        <text x={x + barWidth / 2} y={180} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="500">
                          {m.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Financial Health Summary */}
            <div className="card ops-health-card">
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0 }}>September Revenue Snapshot</h3>
                  <p className="card-subtitle">Automated UPI remittances &amp; scheduled dues</p>
                </div>
                <span className="pill active">{occupancyRate}% Leased</span>
              </div>

              <div className="metric-gauge-box">
                <div className="gauge-number" style={{ color: "var(--brand-blue)" }}>
                  ₹{(totalCollected / 1000).toFixed(0)}k
                </div>
                <div className="gauge-label">Total Collected This Cycle</div>
                <div className="gauge-sub">
                  {paidPayments.length} paid invoices · {pendingPayments.length} pending
                </div>
              </div>

              <div className="ops-pills-row">
                <div className="ops-pill">
                  <span className="ops-pill-num" style={{ color: "#16a34a" }}>
                    ₹{(totalCollected / 1000).toFixed(0)}k
                  </span>
                  <span className="ops-pill-lbl">Settled</span>
                </div>
                <div className="ops-pill">
                  <span className="ops-pill-num" style={{ color: "#d97706" }}>
                    ₹{(totalPendingAmount / 1000).toFixed(0)}k
                  </span>
                  <span className="ops-pill-lbl">Pending</span>
                </div>
                <div className="ops-pill">
                  <span className="ops-pill-num" style={{ color: "#dc2626" }}>
                    ₹{(totalOverdueAmount / 1000).toFixed(0)}k
                  </span>
                  <span className="ops-pill-lbl">Overdue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GROUPED SECTION 3: HOME SERVICES & SERVICE CATEGORIES MANAGEMENT
          ========================================================================= */}
      {(activeSection === "all" || activeSection === "services") && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🛠️</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink-primary, #0f172a)" }}>
                Home Services &amp; Service Categories Management
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-outline" onClick={() => navigate("service-categories")}>
                Categories Manager →
              </button>
              <button className="btn-outline" onClick={() => navigate("service-providers")}>
                Service Providers →
              </button>
            </div>
          </div>

          {/* Service Categories Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--border-subtle)", color: "#475569", fontSize: "11.5px", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Icon &amp; Service Category</th>
                  <th style={{ padding: "12px 16px" }}>Code</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Base Fee (₹)</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>SLA Hours</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Providers</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceCategories.map((sc, idx) => (
                  <tr key={sc.id || idx} style={{ borderBottom: "1px solid var(--border-subtle, #f1f5f9)", background: idx % 2 === 0 ? "transparent" : "rgba(248, 250, 252, 0.5)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      <span style={{ marginRight: "8px", fontSize: "16px" }}>{sc.icon || "🛠️"}</span>
                      {sc.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--ink-muted)", fontFamily: "monospace" }}>
                      {sc.id || `CAT_${idx}`}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>
                      ₹{sc.basePrice || 450}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      ⏱️ {sc.slaHours || 24}h
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span className="pill active">{sc.activeProviders || 5} active</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span className="pill paid">Active</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button className="btn-outline" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => navigate("service-categories")}>
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          GROUPED SECTION 4: COMPLAINT CATEGORY MANAGEMENT & GRIEVANCE OPERATIONS
          ========================================================================= */}
      {(activeSection === "all" || activeSection === "complaints") && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>🔔</span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink-primary, #0f172a)" }}>
                  Complaint Category Management &amp; SLA Rules
                </h2>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--ink-muted)" }}>
                Configure statutory complaint classifications, resolution SLAs, and automatic landlord/provider routing.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-primary" onClick={() => setAddCategoryModal(true)}>
                + Add Complaint Category
              </button>
              <button className="btn-outline" onClick={() => navigate("complaints")}>
                View All Complaints ({COMPLAINTS.length}) →
              </button>
            </div>
          </div>

          {/* Complaint Categories Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--border-subtle)", color: "#475569", fontSize: "11.5px", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Code</th>
                  <th style={{ padding: "12px 16px" }}>Category Name</th>
                  <th style={{ padding: "12px 16px" }}>Description</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>SLA Hours</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Default Priority</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaintCategories.map((cc, idx) => (
                  <tr key={cc.id || idx} style={{ borderBottom: "1px solid var(--border-subtle, #f1f5f9)", background: idx % 2 === 0 ? "transparent" : "rgba(248, 250, 252, 0.5)" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>
                      {cc.id}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {cc.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--ink-muted)", fontSize: "12px", maxWidth: "280px" }}>
                      {cc.description}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>
                      ⏱️ {cc.expectedResolutionHours || 24}h
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        className="pill"
                        style={{
                          background: cc.defaultPriority === "Urgent" ? "#fee2e2" : cc.defaultPriority === "High" ? "#ffedd5" : "#f1f5f9",
                          color: cc.defaultPriority === "Urgent" ? "#b91c1c" : cc.defaultPriority === "High" ? "#c2410c" : "#475569",
                          fontSize: "11px",
                        }}
                      >
                        {cc.defaultPriority || "Medium"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span className="pill paid">Active</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        className="btn-outline"
                        style={{ padding: "3px 8px", fontSize: "11px", color: "var(--red, #ef4444)" }}
                        onClick={() => handleDeleteCategory(cc.id, cc.name)}
                        title="Delete category"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          GROUPED SECTION 5: REGIONAL FOOTPRINT & WORK ORDERS
          ========================================================================= */}
      {(activeSection === "all" || activeSection === "properties") && (
        <div className="dashboard-two-col">
          {/* City Wise Breakdown */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ margin: 0 }}>Tamil Nadu Regional Footprint</h3>
                <p className="card-subtitle">Property units distributed across municipal zones</p>
              </div>
            </div>
            <div className="city-bars-list">
              {cityData.map((c) => {
                const pct = Math.round((c.count / (PROPERTIES.length || 1)) * 100);
                return (
                  <div key={c.name} className="city-bar-item">
                    <div className="city-bar-header">
                      <span className="city-name">{c.name}</span>
                      <span className="city-count">
                        {c.count} properties ({pct}%)
                      </span>
                    </div>
                    <div className="city-bar-track">
                      <div className="city-bar-fill" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Operational Work Orders */}
          <div className="card">
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Active Operations &amp; Work Orders</h3>
                <p className="card-subtitle">Urgent service requests requiring municipal or technician dispatch</p>
              </div>
              <button className="btn-outline" onClick={() => navigate("maintenance")}>
                All Tickets →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
              {MAINTENANCE_REQUESTS.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "var(--bg-subtle, #f8fafc)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
                      {m.issueText || m.issue || "Maintenance Ticket"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--ink-muted)", marginTop: "2px" }}>
                      {m.propertyName} · Tenant: {m.tenantName}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="pill"
                      style={{
                        background: m.priority === "High" ? "var(--red-bg)" : "var(--amber-bg)",
                        color: m.priority === "High" ? "var(--red)" : "var(--amber)",
                      }}
                    >
                      {m.priority}
                    </span>
                    <span className={`pill ${m.status === "Completed" ? "paid" : "pending"}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Complaint Category Modal */}
      {addCategoryModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setAddCategoryModal(false)}>
          <div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Create Complaint Category</h3>
              <button className="modal-close-btn" onClick={() => setAddCategoryModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCategory} style={{ padding: "20px" }}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="pref-field-label">Category Name <span style={{ color: "var(--red)" }}>*</span></label>
                <input
                  type="text"
                  className="inp"
                  placeholder="e.g. Elevators &amp; Lift Breakdown"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label className="pref-field-label">Unique Code</label>
                  <input
                    type="text"
                    className="inp"
                    placeholder="e.g. CCAT_LIFT"
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Default Priority</label>
                  <select
                    className="inp"
                    value={categoryForm.defaultPriority}
                    onChange={(e) => setCategoryForm({ ...categoryForm, defaultPriority: e.target.value })}
                  >
                    <option value="Urgent">Urgent (SLA &lt; 12h)</option>
                    <option value="High">High (SLA &lt; 24h)</option>
                    <option value="Medium">Medium (SLA &lt; 48h)</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="pref-field-label">SLA Expected Resolution Time (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  className="inp"
                  value={categoryForm.expectedResolutionHours}
                  onChange={(e) => setCategoryForm({ ...categoryForm, expectedResolutionHours: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="pref-field-label">Category Description &amp; Scope</label>
                <textarea
                  className="inp"
                  rows={3}
                  placeholder="Describe issues falling under this category (e.g. passenger entrapment, sensor failure, floor misalignment)..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setAddCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingCategory}>
                  {savingCategory ? "Saving…" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
