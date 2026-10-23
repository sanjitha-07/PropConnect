import { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { fetchRemindersSummary, sendAllReminders, remindRent } from "../utils/apiClient.js";

export default function BillReminderBell() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [remindedMap, setRemindedMap] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const containerRef = useRef(null);

  const role = (user?.role || "tenant").toLowerCase();
  const userId = user?.entityId || user?.entity_id || user?.id || (role === "landlord" ? "LDL001" : "TEN001");

  const loadReminders = async () => {
    try {
      setLoading(true);
      const res = await fetchRemindersSummary({
        role,
        userId,
        tenantId: role === "tenant" ? userId : undefined,
        landlordId: role === "landlord" ? userId : undefined,
      });
      if (res && res.success) {
        setSummaryData(res);
      }
    } catch (err) {
      console.warn("Could not load reminders summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
    // Refresh every 60 seconds
    const interval = setInterval(loadReminders, 60000);
    return () => clearInterval(interval);
  }, [role, userId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const summary = summaryData?.summary || {
    totalUrgentCount: 0,
    totalBillsCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    totalPendingAmount: 0,
  };

  const items = summaryData?.items || [];
  const urgentCount = summary.totalUrgentCount || 0;
  const isLandlord = role === "landlord" || role === "admin";

  const handleRemindAll = async () => {
    try {
      setSendingAll(true);
      const res = await sendAllReminders(userId);
      if (res && res.success) {
        setActionNotice(`✓ ${res.message || "Reminders dispatched to all tenants!"}`);
        // Mark all items as reminded
        const newMap = {};
        items.forEach((it) => {
          newMap[it.id] = true;
        });
        setRemindedMap(newMap);
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err) {
      setActionNotice("Failed to send reminders. Please try again.");
    } finally {
      setSendingAll(false);
    }
  };

  const handleRemindSingle = async (item) => {
    try {
      setRemindedMap((prev) => ({ ...prev, [item.id]: "sending" }));
      if (item.billType === "rent" && item.leaseId) {
        await remindRent(item.leaseId, `Friendly Reminder: Your monthly rent of ₹${item.amount.toLocaleString("en-IN")} is ${item.isOverdue ? `overdue by ${item.daysOverdue} days` : `due on ${item.dueDateFormatted}`}.`);
      } else if (item.remindEndpoint) {
        await fetch(`http://localhost:5000${item.remindEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
      setRemindedMap((prev) => ({ ...prev, [item.id]: "sent" }));
      setActionNotice(`✓ Reminder sent to ${item.tenantName || "tenant"}!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      setRemindedMap((prev) => ({ ...prev, [item.id]: "failed" }));
    }
  };

  return (
    <div className="bill-reminder-bell-wrapper" ref={containerRef} style={{ position: "relative" }}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className="icon-btn reminder-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadReminders();
        }}
        title={
          isLandlord
            ? `Tenant Reminders: ${urgentCount} pending/overdue bill(s)`
            : `Bill Reminders: ${urgentCount} urgent bill(s) due`
        }
        aria-label="Bill Reminders"
        style={{
          position: "relative",
          background: urgentCount > 0 ? "rgba(239, 68, 68, 0.08)" : "transparent",
          border: urgentCount > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "none",
          borderRadius: "8px",
          width: "38px",
          height: "38px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "17px",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <span>🔔</span>
        {urgentCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              minWidth: "18px",
              height: "18px",
              lineHeight: "18px",
              borderRadius: "9px",
              padding: "0 5px",
              textAlign: "center",
              boxShadow: "0 2px 5px rgba(239, 68, 68, 0.4)",
              animation: "pulse 2s infinite",
            }}
          >
            {urgentCount > 99 ? "99+" : urgentCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Modal */}
      {isOpen && (
        <div
          className="reminder-dropdown-panel animate-fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "390px",
            maxWidth: "92vw",
            maxHeight: "560px",
            background: "var(--bg-card, #ffffff)",
            borderRadius: "14px",
            border: "1px solid var(--border-subtle, #e2e8f0)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            color: "var(--ink-primary, #0f172a)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
              background: "var(--bg-subtle, #f8fafc)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🔔</span>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700" }}>
                  {isLandlord ? "Tenant Dues & Bill Reminders" : "Bill & Rent Reminders"}
                </h4>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--ink-muted, #64748b)" }}>
                {isLandlord
                  ? "Track pending rent cycles & EB bills across tenants"
                  : "Urgent dues, upcoming rent cycles & EB bills"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={loadReminders}
                title="Refresh Reminders"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "4px",
                  borderRadius: "4px",
                  opacity: loading ? 0.5 : 0.8,
                }}
              >
                🔄
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: "1",
                  color: "var(--ink-muted, #64748b)",
                  padding: "4px 8px",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Action notice banner */}
          {actionNotice && (
            <div
              style={{
                padding: "8px 16px",
                background: "#ecfdf5",
                color: "#065f46",
                fontSize: "12px",
                fontWeight: "600",
                borderBottom: "1px solid #a7f3d0",
              }}
            >
              {actionNotice}
            </div>
          )}

          {/* Summary Metric Strip */}
          <div
            style={{
              padding: "12px 18px",
              background: "var(--bg-subtle, #f8fafc)",
              borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "var(--ink-muted, #64748b)", textTransform: "uppercase", fontWeight: "600" }}>
                {isLandlord ? "Total Tenant Dues" : "Total Outstanding"}
              </div>
              <div style={{ fontSize: "17px", fontWeight: "800", color: "#dc2626" }}>
                ₹{Number(summary.totalPendingAmount || 0).toLocaleString("en-IN")}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {summary.overdueCount > 0 && (
                <span
                  style={{
                    background: "#fef2f2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  ⚠️ {summary.overdueCount} Overdue
                </span>
              )}
              {summary.dueSoonCount > 0 && (
                <span
                  style={{
                    background: "#fffbeb",
                    color: "#b45309",
                    border: "1px solid #fde68a",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  ⏰ {summary.dueSoonCount} Due Soon
                </span>
              )}
            </div>
          </div>

          {/* Landlord Quick Action: Remind All */}
          {isLandlord && items.length > 0 && (
            <div
              style={{
                padding: "8px 18px",
                background: "rgba(2, 132, 199, 0.05)",
                borderBottom: "1px solid var(--border-subtle, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--ink-secondary, #475569)" }}>
                {items.length} pending bill{items.length === 1 ? "" : "s"} across tenants
              </span>
              <button
                type="button"
                onClick={handleRemindAll}
                disabled={sendingAll}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: sendingAll ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {sendingAll ? "Dispatching..." : "🔔 Remind All Tenants"}
              </button>
            </div>
          )}

          {/* Scrollable Items List */}
          <div
            style={{
              padding: "12px 16px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {loading && items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--ink-muted)" }}>
                <span style={{ fontSize: "20px", display: "block", marginBottom: "6px" }}>⏳</span>
                Checking active bills and due dates...
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--ink-muted)" }}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>✨</span>
                <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--ink-primary)" }}>
                  {isLandlord ? "All Tenant Dues Settled!" : "All Caught Up!"}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                  {isLandlord
                    ? "There are currently no overdue or pending rent or EB bills for your properties."
                    : "You have no outstanding or overdue rent or utility bills at this time."}
                </p>
              </div>
            ) : (
              items.map((it) => {
                const isOverdue = it.isOverdue;
                const isDueSoon = it.isDueSoon;
                const isRent = it.billType === "rent";
                const remindStatus = remindedMap[it.id];

                return (
                  <div
                    key={it.id}
                    style={{
                      background: isOverdue ? "#fff5f5" : isDueSoon ? "#fffdf5" : "var(--bg-subtle, #f8fafc)",
                      border: isOverdue
                        ? "1px solid #fecaca"
                        : isDueSoon
                        ? "1px solid #fed7aa"
                        : "1px solid var(--border-subtle, #e2e8f0)",
                      borderLeft: isOverdue ? "4px solid #dc2626" : isDueSoon ? "4px solid #f59e0b" : "4px solid #0284c7",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    {/* Top Row: Title & Amount */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div>
                        <div style={{ fontSize: "13.5px", fontWeight: "700", color: "var(--ink-primary)" }}>
                          {isRent ? "🏠" : "⚡"} {it.title}
                        </div>
                        {isLandlord ? (
                          <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>
                            Tenant: <strong style={{ color: "var(--ink-primary)" }}>{it.tenantName || "Tenant"}</strong> · {it.propertyName}
                          </div>
                        ) : (
                          <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>
                            {it.subtitle || it.propertyName}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: isOverdue ? "#dc2626" : "#059669" }}>
                          ₹{Number(it.amount || 0).toLocaleString("en-IN")}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isOverdue ? "#fee2e2" : isDueSoon ? "#fef3c7" : "#e0f2fe",
                            color: isOverdue ? "#991b1b" : isDueSoon ? "#92400e" : "#0369a1",
                          }}
                        >
                          {isOverdue
                            ? `Overdue (${it.daysOverdue}d)`
                            : isDueSoon
                            ? `Due Soon (${it.daysUntilDue}d)`
                            : "Pending"}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Due Date details */}
                    <div
                      style={{
                        fontSize: "11px",
                        color: isOverdue ? "#991b1b" : "var(--ink-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>📅 Due: <strong>{it.dueDateFormatted || it.dueDate}</strong></span>
                      {it.periodLabel && <span>· Period: {it.periodLabel}</span>}
                    </div>

                    {/* Bottom Row: Action Button */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
                      {isLandlord ? (
                        <button
                          type="button"
                          onClick={() => handleRemindSingle(it)}
                          disabled={remindStatus === "sending" || remindStatus === "sent"}
                          style={{
                            background: remindStatus === "sent" ? "#10b981" : "#ffffff",
                            color: remindStatus === "sent" ? "#ffffff" : "#0284c7",
                            border: remindStatus === "sent" ? "1px solid #10b981" : "1px solid #0284c7",
                            padding: "4px 10px",
                            borderRadius: "5px",
                            fontSize: "11.5px",
                            fontWeight: "600",
                            cursor: remindStatus === "sent" ? "default" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {remindStatus === "sending"
                            ? "Sending..."
                            : remindStatus === "sent"
                            ? "✓ Reminded"
                            : "🔔 Remind Tenant"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            if (it.actionUrl) {
                              navigate(it.actionUrl);
                            } else if (isRent) {
                              navigate("/payments");
                            } else {
                              navigate("/utility-bills");
                            }
                          }}
                          style={{
                            background: isOverdue ? "#dc2626" : "#0284c7",
                            color: "#ffffff",
                            border: "none",
                            padding: "5px 12px",
                            borderRadius: "5px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isRent ? "💳 Pay Rent Now" : "⚡ Pay Bill Now"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All link */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border-subtle, #f1f5f9)",
              background: "var(--bg-subtle, #f8fafc)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "var(--ink-muted)" }}>
              {isLandlord ? "PropConnect Billing Guard" : "Automated Move-In Billing"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (isLandlord) {
                  navigate("/leases");
                } else {
                  navigate("/payments");
                }
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#0284c7",
                fontWeight: "600",
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              {isLandlord ? "View All Leases →" : "View Payment History →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
