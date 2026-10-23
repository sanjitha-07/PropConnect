import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import DataTable from "../../components/DataTable.jsx";
import { LEASES, PAYMENTS, propertyById, landlordById } from "../../data/db.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";

export default function MyLeasePage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  const entityId = user?.entityId || user?.entity_id || "TEN001";
  const myLeases = LEASES.filter((l) => l.tenantId === entityId);
  const primaryLease = myLeases.find((l) => l.id === "LSE001" || l.status === "Active") || myLeases[0];
  const property = primaryLease ? propertyById(primaryLease.propertyId) : null;
  const landlord = property ? landlordById(property.landlordId) : null;

  const primaryRentCycle = useMemo(() => {
    if (!primaryLease) return null;
    return calculateTenantRentCycle(primaryLease, new Date(), PAYMENTS);
  }, [primaryLease]);

  const enrichedLeases = useMemo(() => {
    return myLeases.map((l) => {
      const cycle = calculateTenantRentCycle(l, new Date(), PAYMENTS);
      return {
        ...l,
        rentCycle: cycle,
        moveInDate: cycle?.moveInDate || l.startDate,
        currentPeriod: cycle?.periodLabel || `${l.startDate} to ${l.endDate}`,
        nextDueDate: cycle?.nextDueDateFormatted || l.startDate,
        cycleStatus: cycle?.paymentStatus || l.status,
      };
    });
  }, [myLeases]);

  const columns = [
    { key: "id", label: t("leaseId") },
    {
      key: "propertyName",
      label: t("property"),
      render: (r) => (
        <span
          className="link-text"
          onClick={() => navigate(`../properties/${r.propertyId}`)}
        >
          {r.propertyName}
        </span>
      ),
    },
    {
      key: "moveInDate",
      label: "Move-In Date",
      render: (r) => <strong>📌 {r.moveInDate}</strong>,
    },
    {
      key: "currentPeriod",
      label: "Current Rental Period",
      render: (r) => <span style={{ color: "#0284c7", fontWeight: 600 }}>🗓️ {r.currentPeriod}</span>,
    },
    {
      key: "nextDueDate",
      label: "Next Rent Due",
      render: (r) => (
        <strong style={{ color: r.cycleStatus === "Overdue" ? "#dc2626" : "inherit" }}>
          ⏰ {r.nextDueDate}
        </strong>
      ),
    },
    {
      key: "rent",
      label: t("rent"),
      render: (r) => `₹${(r.monthlyRent || r.rent || 0).toLocaleString("en-IN")}/mo`,
    },
    {
      key: "cycleStatus",
      label: "Cycle Status",
      render: (r) => (
        <span
          className={`pill ${
            r.cycleStatus === "Paid"
              ? "paid"
              : r.cycleStatus === "Overdue"
              ? "failed"
              : "pending"
          }`}
        >
          {r.cycleStatus}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHero title={t("myLease")} subtitle={t("tenantHeroSubtitle")} />

      {primaryLease && property && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0 }}>{primaryLease.propertyName}</h3>
              <p style={{ color: "var(--muted)", margin: "4px 0 12px", fontSize: "13px" }}>
                📍 {property.location}
              </p>
            </div>
            <span className={`pill ${primaryLease.status.toLowerCase()}`}>
              {t(primaryLease.status.toLowerCase())}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "12px" }}>
            <div className="kv"><span className="k">{t("leaseId")}</span><span className="v">{primaryLease.id}</span></div>
            <div className="kv"><span className="k">{t("rent")}</span><span className="v">₹{(primaryLease.monthlyRent || primaryLease.rent || 0).toLocaleString("en-IN")}/mo</span></div>
            <div className="kv"><span className="k">{t("deposit")}</span><span className="v">₹{(primaryLease.depositAmount || property.deposit || 0).toLocaleString("en-IN")}</span></div>
            <div className="kv"><span className="k">Move-In (Start Date)</span><span className="v">📌 {primaryLease.startDate}</span></div>
            <div className="kv"><span className="k">{t("endDate")}</span><span className="v">{primaryLease.endDate}</span></div>
            {landlord && (
              <div className="kv"><span className="k">{t("landlord")}</span><span className="v">{landlord.name} ({landlord.phone})</span></div>
            )}
          </div>

          {/* Move-In Rent Cycle Explanatory Card */}
          {primaryRentCycle && (
            <div
              style={{
                marginTop: "16px",
                background: "linear-gradient(135deg, var(--bg-subtle, #f8fafc) 0%, rgba(2, 132, 199, 0.05) 100%)",
                border: "1px solid var(--border-subtle, #e2e8f0)",
                borderRadius: "8px",
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink-primary)" }}>
                    📅 Move-In Date Rent Cycle: {primaryRentCycle.periodLabel}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "2px" }}>
                    {primaryRentCycle.cycleRuleDescription}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span
                    className={`pill ${
                      primaryRentCycle.paymentStatus === "Paid"
                        ? "paid"
                        : primaryRentCycle.paymentStatus === "Overdue"
                        ? "failed"
                        : "pending"
                    }`}
                  >
                    {primaryRentCycle.paymentStatus}
                  </span>
                  <button className="btn-primary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => navigate("../payments")}>
                    💳 View Invoices
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>
              {t("amenitiesLabel")}
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {property.amenities.map((a) => (
                <span className="amenity-chip" key={a}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <DataTable
        title={t("leasesTable")}
        columns={columns}
        rows={enrichedLeases}
        searchKeys={["id", "propertyName", "cycleStatus", "moveInDate"]}
        searchPlaceholder={t("search")}
      />
    </div>
  );
}
