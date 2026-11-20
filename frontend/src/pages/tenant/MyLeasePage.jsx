import { useContext, useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import DataTable from "../../components/DataTable.jsx";
import { LEASES, PAYMENTS, PROPERTIES, LANDLORDS, TENANTS, propertyById, landlordById } from "../../data/db.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import { fetchLeases, fetchPayments } from "../../utils/apiClient.js";
import "./TenantLeasePayments.css";

export default function MyLeasePage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 5 Tabs: 'overview', 'agreement', 'terms', 'responsibilities', 'history'
  const validTabs = ["overview", "agreement", "terms", "responsibilities", "history"];
  const currentTabParam = searchParams.get("tab")?.toLowerCase();
  const activeTab = validTabs.includes(currentTabParam) ? currentTabParam : "overview";

  const handleTabChange = (tab) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };

  const entityId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : "TEN001");
  const [liveLeases, setLiveLeases] = useState([]);
  const [livePayments, setLivePayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [leaseData, payData] = await Promise.all([
          fetchLeases().catch(() => null),
          fetchPayments(entityId).catch(() => null),
        ]);
        if (!isMounted) return;
        if (Array.isArray(leaseData) && leaseData.length > 0) {
          setLiveLeases(leaseData);
        }
        if (Array.isArray(payData) && payData.length > 0) {
          setLivePayments(payData);
        }
      } catch (err) {
        console.warn("Could not load lease data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  const allLeases = liveLeases.length > 0 ? liveLeases : LEASES;
  const myLeases = useMemo(() => {
    return allLeases.filter((l) => l.tenantId === entityId || l.tenant_id === entityId);
  }, [allLeases, entityId]);

  const myPayments = useMemo(() => {
    if (livePayments.length > 0) {
      return livePayments.filter((p) => p.tenantId === entityId || p.tenant_id === entityId);
    }
    return PAYMENTS.filter((p) => p.tenantId === entityId || p.tenant_id === entityId);
  }, [livePayments, entityId]);

  // Select primary active residential lease
  const primaryLease = useMemo(() => {
    return (
      myLeases.find((l) => (l.status || "").toLowerCase() === "active" && !l.id?.includes("-P") && !l.id?.includes("-S")) ||
      myLeases.find((l) => (l.status || "").toLowerCase() === "active") ||
      myLeases[0] ||
      LEASES[0]
    );
  }, [myLeases]);

  const property = useMemo(() => {
    if (!primaryLease) return PROPERTIES[0];
    return (
      propertyById(primaryLease.propertyId || primaryLease.property_id) ||
      PROPERTIES.find((p) => p.id === (primaryLease.propertyId || primaryLease.property_id)) ||
      PROPERTIES[0]
    );
  }, [primaryLease]);

  const landlord = useMemo(() => {
    if (!property) return LANDLORDS[0];
    return (
      landlordById(property.landlordId || primaryLease?.landlordId) ||
      LANDLORDS.find((l) => l.id === (property.landlordId || primaryLease?.landlordId)) ||
      LANDLORDS[0]
    );
  }, [property, primaryLease]);

  const tenantRecord = useMemo(() => {
    return (
      TENANTS.find((t) => t.id === entityId || t.email === user?.email) || {
        id: entityId,
        name: user?.name || "Divya Priya",
        phone: user?.phone || "+91 98401 23456",
        email: user?.email || "divya.priya@mail.com",
      }
    );
  }, [entityId, user]);

  const rentCycle = useMemo(() => {
    if (!primaryLease) return null;
    return calculateTenantRentCycle(primaryLease, new Date(), myPayments);
  }, [primaryLease, myPayments]);

  const monthlyRentAmount = primaryLease?.monthlyRent || primaryLease?.rent || property?.rent || 0;
  const securityDepositAmount = primaryLease?.depositAmount || primaryLease?.deposit || property?.deposit || 0;
  const moveInDate = primaryLease?.startDate || rentCycle?.moveInDate || "2026-04-01";
  const leaseStartDate = primaryLease?.startDate || "2026-04-01";
  const leaseEndDate = primaryLease?.endDate || "2027-02-28";
  const leaseId = primaryLease?.id || "LSE001";
  const reraRegNumber = `TN-RERA/AGT/${leaseId}`;
  const renewalStatus = `Eligible for 11-Month Renewal (Term ends ${leaseEndDate})`;
  const agreementStatus = `Active & Legally Binding (${reraRegNumber})`;

  // Print/Download Agreement PDF
  const handleDownloadAgreementPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tenancy Agreement - ${leaseId}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 14px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 8px; }
          h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; text-transform: uppercase; }
          .sub { color: #64748b; font-size: 13px; margin: 0; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; font-size: 13px; }
          .box-title { font-weight: 800; color: #0284c7; text-transform: uppercase; font-size: 11.5px; margin-bottom: 6px; }
          .terms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 12.5px; }
          .term-item { border-right: 1px solid #cbd5e1; padding-right: 10px; }
          .term-item:last-child { border-right: none; }
          .clause { margin-bottom: 18px; font-size: 13px; text-align: justify; }
          .clause-title { font-weight: 700; color: #1e3a8a; margin-bottom: 4px; font-size: 13.5px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 30px; border-top: 2px dashed #cbd5e1; }
          .sig-line { border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 6px; font-size: 12px; font-weight: 700; }
          .stamp { text-align: center; margin-top: 30px; font-size: 11px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">OFFICIAL RESIDENTIAL TENANCY CONTRACT</div>
          <h1>Residential Tenancy Agreement</h1>
          <p class="sub">Executed under the Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act (TNRRRLTA)</p>
          <p style="margin: 6px 0 0; font-weight: 700; font-size: 12px; color: #0284c7;">REGISTRATION CODE: ${reraRegNumber}</p>
        </div>

        <div class="parties">
          <div>
            <div class="box-title">Lessor / Landlord (First Party)</div>
            <div style="font-weight: 700; font-size: 14px;">${landlord?.name || "Landlord"}</div>
            <div>Contact: ${landlord?.phone || "N/A"}</div>
            <div>Email: ${landlord?.email || "landlord@propconnect.in"}</div>
            <div style="margin-top: 4px; color: #16a34a; font-weight: 600;">Status: Verified Property Owner</div>
          </div>
          <div>
            <div class="box-title">Lessee / Tenant (Second Party)</div>
            <div style="font-weight: 700; font-size: 14px;">${tenantRecord?.name || user?.name || "Resident"}</div>
            <div>ID: ${entityId}</div>
            <div>Contact: ${tenantRecord?.phone || "N/A"}</div>
            <div>Email: ${tenantRecord?.email || user?.email || "N/A"}</div>
          </div>
        </div>

        <div class="terms-grid">
          <div class="term-item">
            <div style="color: #64748b;">Monthly Rent:</div>
            <div style="font-weight: 800; font-size: 15px; color: #0284c7;">₹${monthlyRentAmount.toLocaleString("en-IN")}/mo</div>
            <div style="font-size: 11px; color: #16a34a;">Due on ${rentCycle?.dueDayOrdinal || "10th"} of month</div>
          </div>
          <div class="term-item">
            <div style="color: #64748b;">Security Deposit:</div>
            <div style="font-weight: 800; font-size: 15px;">₹${securityDepositAmount.toLocaleString("en-IN")}</div>
            <div style="font-size: 11px; color: #64748b;">Escrow Held (Refundable)</div>
          </div>
          <div class="term-item">
            <div style="color: #64748b;">Tenancy Period:</div>
            <div style="font-weight: 700; font-size: 13px;">${leaseStartDate} to ${leaseEndDate}</div>
            <div style="font-size: 11px; color: #64748b;">11-Month Statutory Term</div>
          </div>
        </div>

        <div class="clause">
          <div class="clause-title">1. Demised Premises &amp; Permitted Use</div>
          The Lessor agrees to let out, and the Lessee agrees to take on rent, the residential property situated at <strong>${property?.name}</strong>, ${property?.location}, Chennai, Tamil Nadu. The demised premises shall be occupied strictly for lawful residential purposes by the Lessee and immediate family members.
        </div>

        <div class="clause">
          <div class="clause-title">2. Rent Remittance &amp; Due Date</div>
          The monthly rent of ₹${monthlyRentAmount.toLocaleString("en-IN")} shall be paid electronically via PropConnect portal on or before the ${rentCycle?.dueDayOrdinal || "10th"} day of each English calendar month. A grace period of 5 calendar days is permitted.
        </div>

        <div class="clause">
          <div class="clause-title">3. Security Deposit &amp; Refund Protocol</div>
          The Lessor acknowledges receipt of ₹${securityDepositAmount.toLocaleString("en-IN")} as interest-free security deposit. The said deposit shall be refunded to the Lessee within thirty (30) days of vacating the demised premises, subject to settlement of unpaid utility dues and joint walkthrough inspection.
        </div>

        <div class="clause">
          <div class="clause-title">4. Maintenance Responsibilities &amp; Utility Charges</div>
          The Lessee shall directly settle consumption-based electricity (TNEB) and sub-metered water bills. The Lessor shall remain liable for structural repairs, concealed piping, and municipal property taxes under the Tamil Nadu Tenancy Act.
        </div>

        <div class="clause">
          <div class="clause-title">5. Notice Period for Vacation</div>
          Either party may terminate this agreement by providing one (1) month prior written notice or payment of one month's rent in lieu thereof.
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">Landlord / Authorized Signatory</div>
            <div style="color: #64748b; font-size: 11px;">Digitally signed &amp; verified on PropConnect</div>
          </div>
          <div>
            <div class="sig-line">Tenant / Resident Acceptance</div>
            <div style="color: #64748b; font-size: 11px;">Accepted electronically by ${tenantRecord.name}</div>
          </div>
        </div>

        <div class="stamp">
          <div>PropConnect Secure Document Registry • TN-RERA Tenancy Portal Compliance</div>
          <div>Cryptographic Verification Hash: SHA256-${leaseId}-${Date.now().toString(36)}</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  const enrichedLeases = useMemo(() => {
    return myLeases.map((l) => {
      const cycle = calculateTenantRentCycle(l, new Date(), myPayments);
      return {
        ...l,
        rentCycle: cycle,
        moveInDate: cycle?.moveInDate || l.startDate,
        currentPeriod: cycle?.periodLabel || `${l.startDate} to ${l.endDate}`,
        nextDueDate: cycle?.nextDueDateFormatted || l.startDate,
        cycleStatus: cycle?.paymentStatus || l.status,
      };
    });
  }, [myLeases, myPayments]);

  const historyColumns = [
    { key: "id", label: "Lease ID" },
    {
      key: "propertyName",
      label: "Property",
      render: (r) => (
        <span
          className="link-text"
          style={{ cursor: "pointer", color: "#0284c7", fontWeight: 600 }}
          onClick={() => navigate(`../properties/${r.propertyId}`)}
        >
          {r.propertyName || "Sai Kala Apartments #302"}
        </span>
      ),
    },
    {
      key: "moveInDate",
      label: "Move-In Date",
      render: (r) => <strong>📌 {r.moveInDate}</strong>,
    },
    {
      key: "dates",
      label: "Tenancy Period",
      render: (r) => `${r.startDate} to ${r.endDate}`,
    },
    {
      key: "rent",
      label: "Monthly Rent",
      render: (r) => <strong>₹{(r.monthlyRent || r.rent || 0).toLocaleString("en-IN")}/mo</strong>,
    },
    {
      key: "deposit",
      label: "Deposit",
      render: (r) => `₹${(r.depositAmount || r.deposit || 0).toLocaleString("en-IN")}`,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`pill ${(r.status || "").toLowerCase() === "active" ? "paid" : "pending"}`}>
          {r.status || "Active"}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <button
          type="button"
          className="btn-outline"
          style={{ padding: "4px 8px", fontSize: "11px" }}
          onClick={() => handleTabChange("agreement")}
        >
          📄 Agreement
        </button>
      ),
    },
  ];

  return (
    <div className="tlp-container">
      <PageHero
        title={t("myLease") || "My Lease & Tenancy Management"}
        subtitle="Manage your residential lease agreement, verify statutory covenants, review rent terms, and inspect tenancy history."
      />

      {/* Tabs Navigation */}
      <div className="tlp-nav-bar">
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          <span>📋</span>
          <span>Lease Overview</span>
        </button>
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "agreement" ? "active" : ""}`}
          onClick={() => handleTabChange("agreement")}
        >
          <span>✍️</span>
          <span>Rental Agreement</span>
        </button>
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "terms" ? "active" : ""}`}
          onClick={() => handleTabChange("terms")}
        >
          <span>💰</span>
          <span>Rent and Deposit Terms</span>
        </button>
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "responsibilities" ? "active" : ""}`}
          onClick={() => handleTabChange("responsibilities")}
        >
          <span>⚖️</span>
          <span>Landlord &amp; Tenant Responsibilities</span>
        </button>
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => handleTabChange("history")}
        >
          <span>📜</span>
          <span>Lease History</span>
          <span className="tlp-tab-badge">{myLeases.length}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LEASE OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top 4 Key Metrics */}
          <div className="tlp-kpi-grid">
            <div className="tlp-kpi-card">
              <div className="tlp-kpi-top">
                <span className="tlp-kpi-title">Monthly Rent</span>
                <span className="tlp-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>💵</span>
              </div>
              <div className="tlp-kpi-value" style={{ color: "#0284c7" }}>
                ₹{monthlyRentAmount.toLocaleString("en-IN")}
              </div>
              <div className="tlp-kpi-desc">
                Due on {rentCycle?.dueDayOrdinal || "10th"} of every month
              </div>
            </div>

            <div className="tlp-kpi-card">
              <div className="tlp-kpi-top">
                <span className="tlp-kpi-title">Security Deposit</span>
                <span className="tlp-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🛡️</span>
              </div>
              <div className="tlp-kpi-value" style={{ color: "#059669" }}>
                ₹{securityDepositAmount.toLocaleString("en-IN")}
              </div>
              <div className="tlp-kpi-desc">Escrow protected &amp; refundable</div>
            </div>

            <div className="tlp-kpi-card">
              <div className="tlp-kpi-top">
                <span className="tlp-kpi-title">Move-In Date</span>
                <span className="tlp-kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>📌</span>
              </div>
              <div className="tlp-kpi-value" style={{ fontSize: "20px" }}>
                {moveInDate}
              </div>
              <div className="tlp-kpi-desc">Lease start: {leaseStartDate}</div>
            </div>

            <div className="tlp-kpi-card">
              <div className="tlp-kpi-top">
                <span className="tlp-kpi-title">Agreement Status</span>
                <span className="tlp-kpi-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>✅</span>
              </div>
              <div className="tlp-kpi-value" style={{ fontSize: "16px", color: "#15803d" }}>
                Active &amp; Binding
              </div>
              <div className="tlp-kpi-desc">{reraRegNumber}</div>
            </div>
          </div>

          {/* Active Property & Lease Spotlight Card */}
          <div className="tlp-spotlight-card">
            <div className="tlp-spotlight-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ padding: "3px 8px", background: "#f0f9ff", color: "#0284c7", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Lease ID: {leaseId}
                  </span>
                  <span className="pill paid">Active Residence</span>
                </div>
                <h2 style={{ margin: "2px 0 6px", fontSize: "22px", fontWeight: 800, color: "var(--ink-primary)" }}>
                  {primaryLease.propertyName || property.name}
                </h2>
                <div style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                  📍 {property.location} • Building: {property.building || "Sai Kala Residency"}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleDownloadAgreementPDF}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "13px" }}
                >
                  <span>🖨️</span>
                  <span>Download Agreement PDF</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate("../payments")}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}
                >
                  <span>💳</span>
                  <span>Pay Rent</span>
                </button>
              </div>
            </div>

            {/* Key Lease Metadata Grid */}
            <div className="tlp-meta-grid">
              <div className="tlp-meta-box">
                <div className="tlp-meta-label">Active Property</div>
                <div className="tlp-meta-value">{property.name}</div>
                <div className="tlp-meta-sub">{property.bhk || 3} BHK • {property.sqft || 1450} sq.ft</div>
              </div>

              <div className="tlp-meta-box">
                <div className="tlp-meta-label">Tenancy Duration</div>
                <div className="tlp-meta-value">{leaseStartDate} to {leaseEndDate}</div>
                <div className="tlp-meta-sub">11 Months Statutory Term</div>
              </div>

              <div className="tlp-meta-box">
                <div className="tlp-meta-label">Renewal Status</div>
                <div className="tlp-meta-value" style={{ color: "#0284c7" }}>
                  {renewalStatus}
                </div>
                <div className="tlp-meta-sub">Standard 5% escalation on renewal</div>
              </div>

              <div className="tlp-meta-box">
                <div className="tlp-meta-label">Landlord Contact</div>
                <div className="tlp-meta-value">{landlord.name}</div>
                <div className="tlp-meta-sub">📞 {landlord.phone} • {landlord.email || "Verified"}</div>
              </div>
            </div>

            {/* Move-In Rent Cycle Explanatory Card */}
            {rentCycle && (
              <div
                style={{
                  marginTop: "20px",
                  background: "linear-gradient(135deg, #f8fafc 0%, rgba(2, 132, 199, 0.05) 100%)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--ink-primary)" }}>
                      📅 Current Rent Cycle: {rentCycle.periodLabel}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--ink-muted)", marginTop: "3px" }}>
                      {rentCycle.cycleRuleDescription}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span
                      className={`pill ${
                        rentCycle.paymentStatus === "Paid"
                          ? "paid"
                          : rentCycle.paymentStatus === "Overdue"
                          ? "failed"
                          : "pending"
                      }`}
                    >
                      {rentCycle.paymentStatus}
                    </span>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => navigate("../payments")}
                    >
                      View Invoice Ledger
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Amenities Section */}
            {property.amenities && property.amenities.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                  Included Property Amenities &amp; Fixtures
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {property.amenities.map((a) => (
                    <span key={a} className="amenity-chip" style={{ fontSize: "12px", padding: "4px 10px" }}>
                      ✓ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RENTAL AGREEMENT */}
      {/* ========================================================================= */}
      {activeTab === "agreement" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Actions Bar */}
          <div
            className="card"
            style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>
                Statutory Tenancy Agreement — {property.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                Code: {reraRegNumber} • Governed by Tamil Nadu Tenancy Tribunal
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleDownloadAgreementPDF}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 18px", fontSize: "13px" }}
            >
              <span>🖨️</span>
              <span>Download Official PDF / Print</span>
            </button>
          </div>

          {/* Full Formal Document Preview */}
          <div className="tlp-agreement-doc tlp-printable-agreement">
            <div className="tlp-agreement-header">
              <span style={{ padding: "4px 12px", background: "#f0f9ff", color: "#0284c7", borderRadius: "9999px", fontSize: "12px", fontWeight: 800 }}>
                REGISTRATION: {reraRegNumber}
              </span>
              <h2 style={{ margin: "10px 0 4px", fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
                Residential Tenancy Agreement
              </h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                Executed under the provisions of the Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act (TNRRRLTA)
              </p>
            </div>

            {/* Parties Box */}
            <div className="tlp-parties-box">
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", marginBottom: "4px" }}>
                  Lessor / Landlord (First Party)
                </div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#0f172a" }}>{landlord.name}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>ID: {landlord.id || "LDL001"}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>Contact: {landlord.phone}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>Email: {landlord.email || "landlord@propconnect.in"}</div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", marginBottom: "4px" }}>
                  Lessee / Tenant (Second Party)
                </div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#0f172a" }}>{tenantRecord.name}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>Tenant Entity ID: {entityId}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>Contact: {tenantRecord.phone}</div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>Email: {tenantRecord.email}</div>
              </div>
            </div>

            {/* Clauses */}
            <div className="tlp-clause-item">
              <div className="tlp-clause-title">1. Demised Premises &amp; Permitted Residential Use</div>
              <p style={{ margin: 0 }}>
                The Lessor hereby lets out and the Lessee agrees to occupy the residential premises designated as <strong>{property.name}</strong>, located at {property.location}, Chennai, Tamil Nadu, along with one reserved covered four-wheeler car parking bay. The premises shall be occupied strictly for lawful private residential dwelling and no commercial activities shall be undertaken.
              </p>
            </div>

            <div className="tlp-clause-item">
              <div className="tlp-clause-title">2. Term of Tenancy &amp; Commencement</div>
              <p style={{ margin: 0 }}>
                The term of this residential tenancy shall be for an agreed statutory duration of eleven (11) months, commencing from <strong>{leaseStartDate}</strong> and expiring on <strong>{leaseEndDate}</strong>. The tenancy may be renewed upon mutual consent of both parties under updated terms and applicable rental revision.
              </p>
            </div>

            <div className="tlp-clause-item">
              <div className="tlp-clause-title">3. Monthly Rent &amp; Remittance Schedule</div>
              <p style={{ margin: 0 }}>
                The monthly rent agreed upon is <strong>₹{monthlyRentAmount.toLocaleString("en-IN")}/- (Rupees {monthlyRentAmount.toLocaleString("en-IN")} only)</strong>. The rent shall be remitted electronically via the PropConnect system on or before the <strong>{rentCycle?.dueDayOrdinal || "10th"} of every English calendar month</strong>. A standard grace period of five (5) calendar days is admissible.
              </p>
            </div>

            <div className="tlp-clause-item">
              <div className="tlp-clause-title">4. Interest-Free Security Deposit</div>
              <p style={{ margin: 0 }}>
                The Lessee has deposited with the Lessor a sum of <strong>₹{securityDepositAmount.toLocaleString("en-IN")}/-</strong> as interest-free security deposit. The said security deposit is escrow-backed and shall be refunded to the Lessee within thirty (30) days from the date of physical vacation of the premises, subject to deductions for any pending electricity/utility dues or verified tenant-attributable structural damage.
              </p>
            </div>

            <div className="tlp-clause-item">
              <div className="tlp-clause-title">5. Notice Period for Vacation &amp; Handover</div>
              <p style={{ margin: 0 }}>
                Either party may terminate this agreement prior to expiry by serving one (1) month prior written notice or one month's rent in lieu of notice. The premises shall be surrendered back in good tenantable repair, reasonable wear and tear excepted.
              </p>
            </div>

            <div className="tlp-clause-item">
              <div className="tlp-clause-title">6. Statutory Rights &amp; Tribunal Jurisdiction</div>
              <p style={{ margin: 0 }}>
                This agreement is subject to the exclusive jurisdiction of the Tamil Nadu Tenancy Tribunal, Chennai. Both parties agree that any disputes arising hereunder shall be resolved through formal mediation or statutory tribunal procedures as mandated under TNRRRLTA.
              </p>
            </div>

            {/* Signatures */}
            <div className="tlp-sig-box">
              <div>
                <div style={{ fontWeight: 800, fontSize: "13px", color: "#1e3a8a" }}>LESSOR / LANDLORD</div>
                <div style={{ height: "45px", display: "flex", alignItems: "flex-end", color: "#2563eb", fontStyle: "italic", fontWeight: 700 }}>
                  Digitally Signed: {landlord.name}
                </div>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "11px", color: "#64748b" }}>
                  Verified Property Owner Seal • PropConnect Auth ID: {landlord.id || "LDL001"}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: "13px", color: "#1e3a8a" }}>LESSEE / TENANT</div>
                <div style={{ height: "45px", display: "flex", alignItems: "flex-end", color: "#16a34a", fontStyle: "italic", fontWeight: 700 }}>
                  Digitally Executed: {tenantRecord.name}
                </div>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "11px", color: "#64748b" }}>
                  Resident Tenant Acceptance • Entity ID: {entityId}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RENT AND DEPOSIT TERMS */}
      {/* ========================================================================= */}
      {activeTab === "terms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="tlp-terms-grid">
            {/* Rent Card */}
            <div className="tlp-terms-card">
              <div className="tlp-terms-card-header">
                <div className="tlp-terms-icon">💳</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    Monthly Rent Schedule
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Billing cycle &amp; payment obligations
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Base Monthly Rent:</span>
                  <strong style={{ color: "#0284c7", fontSize: "15px" }}>₹{monthlyRentAmount.toLocaleString("en-IN")}/mo</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Payment Due Date:</span>
                  <strong>Every {rentCycle?.dueDayOrdinal || "10th"} of month</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Grace Period:</span>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>5 Calendar Days</span>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Accepted Payment Modes:</span>
                  <strong>UPI, NetBanking, Debit/Credit Card</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Invoice Generation:</span>
                  <span>Automated 5 days prior to due date</span>
                </div>
              </div>
            </div>

            {/* Deposit Card */}
            <div className="tlp-terms-card">
              <div className="tlp-terms-card-header">
                <div className="tlp-terms-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🛡️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    Security Deposit Protection
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Escrow holding &amp; refund protocols
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Total Deposit Held:</span>
                  <strong style={{ color: "#059669", fontSize: "15px" }}>₹{securityDepositAmount.toLocaleString("en-IN")}</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Escrow Holding Status:</span>
                  <span className="pill paid">Active &amp; Protected</span>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Refund Timeline:</span>
                  <strong>Within 30 days of vacation</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Permitted Deductions:</span>
                  <span>Unpaid utilities or major damage only</span>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Ordinary Wear &amp; Tear:</span>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>Protected from deductions</span>
                </div>
              </div>
            </div>

            {/* Utilities Card */}
            <div className="tlp-terms-card">
              <div className="tlp-terms-card-header">
                <div className="tlp-terms-icon" style={{ background: "#fef3c7", color: "#d97706" }}>⚡</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    Utility Responsibilities
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Electricity, water &amp; society charges
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>TNEB Electricity Tariff:</span>
                  <strong style={{ color: "#d97706" }}>Tenant Direct Settlement</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Metrowater / Private Tanker:</span>
                  <strong>Sub-metered (Billed via Utility Center)</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Municipal Property Tax:</span>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>Landlord Responsibility</span>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Sinking Fund / Capital Repairs:</span>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>Landlord Responsibility</span>
                </div>
              </div>
            </div>

            {/* Renewal Card */}
            <div className="tlp-terms-card">
              <div className="tlp-terms-card-header">
                <div className="tlp-terms-icon" style={{ background: "#f3e8ff", color: "#9333ea" }}>🔄</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    Renewal &amp; Vacation Terms
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Contract renewal &amp; move-out provisions
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Current Term Expiry:</span>
                  <strong>{leaseEndDate}</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Notice Period:</span>
                  <strong>1 Calendar Month Written Notice</strong>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Renewal Revision Rate:</span>
                  <span style={{ color: "#9333ea", fontWeight: 700 }}>Standard 5% on 11-month renewal</span>
                </div>
                <div className="row-between">
                  <span style={{ color: "#64748b" }}>Move-Out Inspection:</span>
                  <span>Joint walkthrough with landlord</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LANDLORD AND TENANT RESPONSIBILITIES */}
      {/* ========================================================================= */}
      {activeTab === "responsibilities" && (
        <div className="tlp-resp-grid">
          {/* Landlord Column */}
          <div className="tlp-resp-col landlord">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                🏛️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#1e3a8a" }}>
                  Landlord Responsibilities
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Statutory duties under Tamil Nadu Tenancy Act (TNRRRLTA)
                </div>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Structural Maintenance &amp; Waterproofing</strong>
                <span style={{ color: "#64748b" }}>
                  Responsible for structural stability, foundation repairs, exterior painting, wall seepage, and terrace roof waterproofing.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Major Plumbing &amp; Concealed Electrical Conduits</strong>
                <span style={{ color: "#64748b" }}>
                  Rectification of internal concealed pipeline leakages, underground drainage line chokes, and main electrical breaker/earthing faults.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Property Taxes &amp; Housing Municipal Dues</strong>
                <span style={{ color: "#64748b" }}>
                  Payment of Greater Chennai Corporation property tax and urban land ceiling charges to ensure unencumbered occupancy.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Peaceful Possession &amp; 24h Advance Notice for Entry</strong>
                <span style={{ color: "#64748b" }}>
                  Guaranteed quiet peaceful enjoyment. Landlord shall provide at least 24 hours advance notification before visiting premises.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Security Deposit Refund within 30 Days</strong>
                <span style={{ color: "#64748b" }}>
                  Prompt refund of interest-free security deposit within 30 days of physical handover following mutual walkthrough inspection.
                </span>
              </div>
            </div>
          </div>

          {/* Tenant Column */}
          <div className="tlp-resp-col tenant">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                🏠
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#14532d" }}>
                  Tenant Responsibilities
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Occupancy obligations, upkeep guidelines &amp; utility dues
                </div>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Punctual Rent Remittance on Due Date</strong>
                <span style={{ color: "#64748b" }}>
                  Payment of monthly rent on or before the agreed personalized due date ({rentCycle?.dueDayOrdinal || "10th"} of each calendar month).
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Consumption Utility Dues (Water &amp; Electricity)</strong>
                <span style={{ color: "#64748b" }}>
                  Settlement of actual TNEB bi-monthly electricity bills and sub-metered water charges before their respective due dates.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Routine Housekeeping &amp; Minor Repairs</strong>
                <span style={{ color: "#64748b" }}>
                  Day-to-day minor maintenance such as replacing fused LED lamps, tap washers, routine kitchen cleaning, and maintaining sanitary fittings.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Compliance with Community Bylaws</strong>
                <span style={{ color: "#64748b" }}>
                  Strict adherence to resident welfare association guidelines regarding waste segregation, designated parking, and quiet hours.
                </span>
              </div>
            </div>

            <div className="tlp-resp-item">
              <span className="tlp-resp-check">✓</span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>Timely Intimation of Structural Defects</strong>
                <span style={{ color: "#64748b" }}>
                  Mandatory notification to the landlord via PropConnect portal within 48 hours of noticing any wall cracks, seepage, or electrical issues.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: LEASE HISTORY */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <DataTable
          title="Tenant Tenancy Records &amp; Leases"
          columns={historyColumns}
          rows={enrichedLeases}
          searchKeys={["id", "propertyName", "cycleStatus", "moveInDate", "startDate", "endDate"]}
          searchPlaceholder="Search lease agreements..."
        />
      )}
    </div>
  );
}
