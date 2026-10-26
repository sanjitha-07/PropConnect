import { useContext, useState, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { LEASES, PROPERTIES, TENANTS, LANDLORDS } from "../../data/db.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";

export default function AgreementPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const role = user?.role || "tenant";
  const entityId = user?.entityId || user?.entity_id || "TEN001";

  // Select active lease
  const relevantLeases = useMemo(() => {
    if (role === "tenant") {
      return LEASES.filter((l) => l.tenantId === entityId || l.tenant_id === entityId);
    } else if (role === "landlord") {
      return LEASES.filter((l) => l.landlordId === entityId || l.landlord_id === entityId);
    }
    return LEASES;
  }, [role, entityId]);

  const [selectedLeaseId, setSelectedLeaseId] = useState(() => {
    return relevantLeases[0]?.id || "LSE001";
  });

  const activeLease = useMemo(() => {
    return relevantLeases.find((l) => l.id === selectedLeaseId) || relevantLeases[0] || LEASES[0];
  }, [relevantLeases, selectedLeaseId]);

  const property = PROPERTIES.find((p) => p.id === activeLease?.propertyId) || PROPERTIES[0];
  const landlord = LANDLORDS.find((l) => l.id === activeLease?.landlordId) || LANDLORDS[0];
  const tenant = TENANTS.find((t) => t.id === activeLease?.tenantId) || TENANTS[0];

  const rentCycle = useMemo(() => {
    if (!activeLease) return null;
    return calculateTenantRentCycle(activeLease, new Date(), []);
  }, [activeLease]);

  const handlePrintAgreement = () => {
    window.print();
  };

  return (
    <div className="agreement-page" style={{ paddingBottom: "40px" }}>
      <PageHero
        title="Tenancy Agreement &amp; Responsibilities"
        subtitle="Statutory lease terms, personalized rent due dates, and detailed landlord vs. tenant responsibilities under Tamil Nadu tenancy laws."
      />

      {/* Top Controls: Lease Selector + Print/Download */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-secondary)" }}>
            Select Lease Agreement:
          </span>
          <select
            value={selectedLeaseId}
            onChange={(e) => setSelectedLeaseId(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #cbd5e1)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {relevantLeases.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} — {l.propertyName} ({l.startDate} to {l.endDate})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-outline"
            onClick={handlePrintAgreement}
            style={{ padding: "7px 16px", fontSize: "13px", fontWeight: 600 }}
          >
            🖨️ Print Agreement / PDF
          </button>
        </div>
      </div>

      {/* Official Tenancy Certificate Banner */}
      <div
        className="card"
        style={{
          padding: "24px",
          marginBottom: "20px",
          borderTop: "5px solid var(--color-primary, #0284c7)",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ padding: "4px 8px", background: "#f0f9ff", color: "#0284c7", borderRadius: "6px", fontSize: "12px", fontWeight: 800 }}>
                REG: TN-RERA/AGT/{activeLease?.id || "LSE001"}
              </span>
              <span className="pill paid">Legally Binding Agreement</span>
            </div>
            <h2 style={{ margin: "4px 0", fontSize: "20px", fontWeight: 800, color: "var(--ink-primary)" }}>
              Residential Tenancy Agreement — {property.name}
            </h2>
            <div style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
              📍 {property.location} • Building: {property.building || "Residential Complex"}
            </div>
          </div>

          <div style={{ textAlign: "right", minWidth: "160px" }}>
            <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Personalized Monthly Rent:</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-primary, #0284c7)" }}>
              ₹{(activeLease?.monthlyRent || property.rent || 22000).toLocaleString("en-IN")}/mo
            </div>
            <div style={{ fontSize: "11.5px", color: "#16a34a", fontWeight: 600 }}>
              ⏰ Rent Due on {rentCycle?.dueDayOrdinal || "10th"} of each month
            </div>
          </div>
        </div>

        {/* Key Tenancy Terms Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            padding: "16px",
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Landlord / Owner:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{landlord.name}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>📞 {landlord.phone}</div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Tenant / Resident:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{tenant.name}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>📞 {tenant.phone}</div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Security Deposit Held:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
              ₹{(activeLease?.depositAmount || property.deposit || 80000).toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: "11px", color: "#16a34a" }}>Escrow Protected</div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Tenancy Period:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
              {activeLease?.startDate} to {activeLease?.endDate}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>11 Months Renewal Term</div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Personalized Due Date:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0284c7" }}>
              Every {rentCycle?.dueDayOrdinal || "10th"} of month
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Reminders 5 days prior</div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>Notice Period for Vacation:</div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
              1 Month Written Notice
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Deposit refund in 30 days</div>
          </div>
        </div>
      </div>

      {/* Two Column Detailed Responsibilities Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        {/* Landlord Responsibilities Column */}
        <div
          className="card"
          style={{
            padding: "24px",
            borderTop: "4px solid #2563eb",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
              🏛️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e3a8a" }}>
                Landlord Responsibilities
              </h3>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Statutory duties under Tamil Nadu Tenancy Act (TNRRRLTA)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Structural Maintenance &amp; Waterproofing
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Responsible for structural stability, major wall plastering, foundation repairs, exterior painting, and terrace/roof waterproofing.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Major Plumbing &amp; Electrical Conduits
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Rectification of internal concealed pipeline leakages, underground drainage line chokes, and main electrical breaker/earthing faults.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Property Taxes &amp; Housing Municipal Dues
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Payment of Greater Chennai Corporation / Municipal Property Tax and Urban Land Ceiling fees to keep tenancy unencumbered.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Peaceful Possession &amp; Advance Notice for Entry
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Guaranteed uninterrupted peaceful possession. Landlord shall give at least 24 hours advance written or app notification prior to entering premises.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Security Deposit Refund Within 30 Days
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Prompt refund of interest-free security deposit within thirty (30) days of tenant vacating the premises, subject to mutual walkthrough audit.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Responsibilities Column */}
        <div
          className="card"
          style={{
            padding: "24px",
            borderTop: "4px solid #16a34a",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
              🏠
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#14532d" }}>
                Tenant Responsibilities
              </h3>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Occupancy obligations, utility dues &amp; upkeep guidelines
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Punctual Rent Remittance on Due Date
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Payment of monthly rent on or before the agreed personalized due date ({rentCycle?.dueDayOrdinal || "10th"} of each English calendar month).
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Consumption Utility Dues (Water &amp; Electricity)
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Settlement of actual TNEB bi-monthly electricity bills and sub-metered CMWSSB Metrowater / private water tanker consumption charges.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Routine Housekeeping &amp; Minor Repairs
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Day-to-day maintenance such as replacing fused LED lamps, tap washer washers, routine kitchen cleaning, and maintaining sanitary fittings.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Compliance with Community Bylaws
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Strict adherence to society association rules regarding waste segregation, designated car parking bay CP-08, and quiet residential hours.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  Timely Intimation of Structural Defects
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                  Mandatory notification to the landlord via PropConnect portal within 48 hours of noticing any wall cracks, seepage, or electrical issues.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
