import { X, Check, ArrowRight } from "lucide-react";

export default function PropertyCompareModal({
  compareProperties = [],
  onRemove,
  onClearAll,
  onClose,
  onViewDetails,
  formatCurrency = (v) => `₹${Number(v).toLocaleString("en-IN")}`,
}) {
  if (compareProperties.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "1050px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              Compare Properties ({compareProperties.length} of 3)
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
              Side-by-side comparison of specs, pricing, and amenities
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClearAll}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "none",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Comparison Content Table */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `180px repeat(${compareProperties.length}, 1fr)`,
              gap: "14px",
              minWidth: "650px",
            }}
          >
            {/* Top Row: Property Cards & Remove Action */}
            <div style={{ fontWeight: 700, color: "#475569", fontSize: "13px", alignSelf: "end", paddingBottom: "12px" }}>
              Property Overview
            </div>
            {compareProperties.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "rgba(0,0,0,0.5)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "50%",
                    width: "22px",
                    height: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 2,
                  }}
                  title="Remove from compare"
                >
                  <X size={12} />
                </button>
                <div style={{ height: "110px", borderRadius: "8px", overflow: "hidden", background: "#cbd5e1" }}>
                  <img
                    src={p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400"}
                    alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                  📍 {p.city} · {p.locality || p.location}
                </div>
                <button
                  type="button"
                  onClick={() => onViewDetails(p.id)}
                  style={{
                    marginTop: "4px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <span>View Details</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}

            {/* Comparison Attribute Rows */}
            {[
              {
                label: "Monthly Rent",
                render: (p) => (
                  <span style={{ fontWeight: 800, color: "#2563eb", fontSize: "15px" }}>
                    {formatCurrency(p.rent)}/mo
                  </span>
                ),
              },
              {
                label: "Security Deposit",
                render: (p) => formatCurrency(p.deposit || p.rent * 4),
              },
              {
                label: "Configuration",
                render: (p) => `${p.bedrooms || 2} BHK (${p.bathrooms || 2} Baths)`,
              },
              {
                label: "Super Built-up Area",
                render: (p) => `${p.area || p.sqft || 1200} sqft`,
              },
              {
                label: "Furnishing Status",
                render: (p) => p.furnishing || "Semi-Furnished",
              },
              {
                label: "Availability Status",
                render: (p) => (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      background: (p.status || "").toLowerCase() === "available" ? "#dcfce7" : "#f1f5f9",
                      color: (p.status || "").toLowerCase() === "available" ? "#15803d" : "#475569",
                    }}
                  >
                    {p.status || "Available"}
                  </span>
                ),
              },
              {
                label: "Floor Level",
                render: (p) => p.floor || "1st Floor",
              },
              {
                label: "Facing (Vastu)",
                render: (p) => p.facing || p.facingDirection || "East Facing",
              },
              {
                label: "Vehicle Parking",
                render: (p) => p.parking || p.carParking || "Covered Car Parking",
              },
              {
                label: "Water Supply",
                render: (p) => p.waterConnection || "Metro Water + Borewell",
              },
              {
                label: "EB Connection",
                render: (p) => p.ebConsumerNo || "TNEB Consumer Meter",
              },
              {
                label: "Amenities",
                render: (p) => (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(p.amenities || []).slice(0, 5).map((a, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "10.5px",
                          color: "#334155",
                        }}
                      >
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                ),
              },
            ].map((row, idx) => (
              <div key={idx} style={{ display: "contents" }}>
                <div
                  style={{
                    padding: "10px 8px",
                    fontWeight: 600,
                    fontSize: "12.5px",
                    color: "#475569",
                    borderTop: "1px solid #f1f5f9",
                    background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                  }}
                >
                  {row.label}
                </div>
                {compareProperties.map((p) => (
                  <div
                    key={p.id + idx}
                    style={{
                      padding: "10px 12px",
                      fontSize: "12.5px",
                      color: "#1e293b",
                      borderTop: "1px solid #f1f5f9",
                      background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                    }}
                  >
                    {row.render(p)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
