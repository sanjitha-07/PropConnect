import { X, ArrowRight } from "lucide-react";

export default function PropertyCompareTray({
  compareProperties = [],
  onOpenCompare,
  onRemove,
  onClearAll,
}) {
  if (compareProperties.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0f172a",
        color: "#ffffff",
        padding: "10px 18px",
        borderRadius: "14px",
        boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        zIndex: 900,
        maxWidth: "92vw",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
          Compare ({compareProperties.length}/3):
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {compareProperties.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.1)",
                padding: "3px 8px 3px 4px",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              <img
                src={p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=100"}
                alt={p.name}
                style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "cover" }}
              />
              <span style={{ maxWidth: "100px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name.split("-")[0].trim()}
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "2px",
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={onOpenCompare}
          disabled={compareProperties.length < 2}
          style={{
            background: compareProperties.length >= 2 ? "#2563eb" : "#475569",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "7px 14px",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: compareProperties.length >= 2 ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
          title={compareProperties.length < 2 ? "Select at least 2 properties to compare" : "Open comparison"}
        >
          <span>Compare Now</span>
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: "transparent",
            border: "none",
            color: "#cbd5e1",
            fontSize: "12px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
