import { Clock, ArrowRight } from "lucide-react";

export default function RecentlyViewedBar({
  recentlyViewed = [],
  onNavigateDetails,
  formatCurrency = (v) => `₹${Number(v).toLocaleString("en-IN")}`,
}) {
  if (!recentlyViewed || recentlyViewed.length === 0) return null;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "14px 18px",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
          <Clock size={15} color="#2563eb" />
          <span>Recently Viewed Homes ({recentlyViewed.length})</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        {recentlyViewed.slice(0, 4).map((p) => (
          <div
            key={p.id}
            onClick={() => onNavigateDetails(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            className="recent-item-hover"
          >
            <img
              src={p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=120"}
              alt={p.name}
              style={{ width: "44px", height: "44px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", margin: "1px 0" }}>
                {p.city} · {p.bedrooms ? `${p.bedrooms} BHK` : "Flat"}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                {formatCurrency(p.rent)}/mo
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
