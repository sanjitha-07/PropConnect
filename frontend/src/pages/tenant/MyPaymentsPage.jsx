import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import { PAYMENTS, LEASES } from "../../data/db.js";
import { fetchPayments, updatePayment, fetchRentSchedules, generateRentInvoice } from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";

const MONTH_KEYS = { May: "monthMay", Jun: "monthJun", Jul: "monthJul", Aug: "monthAug", Sep: "Sep 2026" };

export default function MyPaymentsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [paymentsList, setPaymentsList] = useState([]);
  const [rentCycle, setRentCycle] = useState(null);
  const [activeLease, setActiveLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [upiId, setUpiId] = useState("resident@okhdfcbank");
  const [isProcessing, setIsProcessing] = useState(false);

  // Strictly use logged-in tenant entityId (only demo user divya.priya has TEN001)
  const entityId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadPayments() {
      setLoading(true);
      try {
        if (!entityId) {
          if (isMounted) {
            setPaymentsList([]);
            setLoading(false);
          }
          return;
        }

        const [payData, schedData] = await Promise.all([
          fetchPayments(entityId).catch(() => null),
          fetchRentSchedules({ tenantId: entityId }).catch(() => null),
        ]);

        let list = [];
        if (Array.isArray(payData)) {
          list = payData.filter(
            (p) => p.tenantId === entityId || p.tenant_id === entityId
          );
        } else {
          list = PAYMENTS.filter((p) => p.tenantId === entityId);
        }

        if (isMounted) {
          setPaymentsList(list);

          if (schedData && Array.isArray(schedData.schedules) && schedData.schedules.length > 0) {
            setRentCycle(schedData.schedules[0].rentCycle);
            setActiveLease(schedData.schedules[0].lease);
          } else {
            // Local fallback calculation
            const foundLease = LEASES.find((l) => l.tenantId === entityId && l.status === "Active") || LEASES.find((l) => l.tenantId === entityId);
            if (foundLease) {
              setActiveLease(foundLease);
              const cycle = calculateTenantRentCycle(foundLease, new Date(), list);
              setRentCycle(cycle);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load tenant payments:", err);
        if (isMounted) {
          setPaymentsList(PAYMENTS.filter((p) => p.tenantId === entityId));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPayments();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  const handleGenerateInvoice = async () => {
    if (!activeLease) return;
    try {
      const res = await generateRentInvoice(activeLease.id);
      if (res && res.invoice) {
        setPaymentsList((prev) => {
          const exists = prev.some((p) => p.id === res.invoice.id || p.invoiceNo === res.invoice.invoiceNo);
          return exists ? prev : [res.invoice, ...prev];
        });
        showToast(res.message || "Rent invoice ready for payment!");
      }
    } catch (err) {
      showToast("Invoice generated locally");
    }
  };

  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if (payingInvoice.status === "Paid") {
      showToast("This rent invoice is already paid!");
      setPayingInvoice(null);
      return;
    }
    setIsProcessing(true);

    const today = new Date().toISOString().split("T")[0];
    const updated = {
      status: "Paid",
      paidDate: today,
      method: paymentMode,
    };

    try {
      await updatePayment(payingInvoice.id, updated);
      setPaymentsList((prev) =>
        prev.map((p) => (p.id === payingInvoice.id ? { ...p, ...updated } : p))
      );
      showToast(`Rent payment of ₹${payingInvoice.amount.toLocaleString("en-IN")} settled successfully via ${paymentMode}!`);
      setPayingInvoice(null);
    } catch (err) {
      showToast("Payment recorded locally");
      setPaymentsList((prev) =>
        prev.map((p) => (p.id === payingInvoice.id ? { ...p, ...updated } : p))
      );
      setPayingInvoice(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Receipt Window
  const handlePrintReceipt = (inv) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rent Receipt - ${inv.id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 18px; margin-bottom: 25px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 8px; }
          h1 { margin: 0 0 4px; font-size: 22px; color: #0f172a; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; font-size: 13.5px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .box-title { font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
          .amount-banner { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
          .amount-val { font-size: 28px; font-weight: 800; color: #047857; }
          .stamp { text-align: right; margin-top: 35px; padding-top: 20px; font-size: 13px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">OFFICIAL RENT RECEIPT</div>
          <h1>TENANT &amp; LANDLORD MANAGEMENT SYSTEM</h1>
          <p style="margin: 0; color: #64748b; font-size: 13px;">Invoice No: <strong>${inv.invoiceNo || inv.id}</strong> | Date: ${inv.paidDate || inv.dueDate}</p>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Tenant (Resident)</div>
            <div style="font-weight: 700; font-size: 15px;">${inv.tenantName || user.name || "Resident Tenant"}</div>
            <div style="color: #64748b;">ID: ${inv.tenantId || entityId}</div>
          </div>
          <div class="box">
            <div class="box-title">Premises</div>
            <div style="font-weight: 700; font-size: 15px;">${inv.propertyName || "Sai Kala Apartments #302"}</div>
            <div style="color: #64748b;">Chennai, Tamil Nadu</div>
          </div>
        </div>

        <div class="amount-banner">
          <div style="font-size: 13px; font-weight: 600; color: #065f46; text-transform: uppercase;">Amount Paid</div>
          <div class="amount-val">₹${(inv.amount || 0).toLocaleString("en-IN")}</div>
          <div style="font-size: 13px; color: #047857; margin-top: 4px;">Billing Period: <strong>${inv.month}</strong> • Mode: <strong>${inv.method || "UPI"}</strong></div>
        </div>

        <div class="box" style="margin-bottom: 20px; font-size: 13.5px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Payment Status:</span>
            <span style="font-weight: 700; color: #059669;">${inv.status}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Settlement Date:</span>
            <span style="font-weight: 600;">${inv.paidDate || "Settled"}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Transaction Reference:</span>
            <span style="font-family: monospace; font-weight: 600;">${inv.invoiceNo || "UPI/TN/" + inv.id}</span>
          </div>
        </div>

        <div class="stamp">
          <div>Verified &amp; digitally signed by</div>
          <div style="font-weight: 700; color: #0f172a; margin-top: 4px;">Tenant &amp; Landlord Portal</div>
          <div style="font-size: 11px;">Tamil Nadu, India</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  const columns = [
    {
      key: "id",
      label: t("invoice"),
      render: (r) => (
        <div>
          <strong>{r.id}</strong>
          {r.invoiceNo && r.invoiceNo !== r.id && (
            <div style={{ fontSize: "10.5px", color: "var(--ink-muted)" }}>{r.invoiceNo}</div>
          )}
        </div>
      ),
    },
    { key: "propertyName", label: t("property"), render: (r) => r.propertyName || "Sai Kala Apartments #302" },
    {
      key: "month",
      label: "Rental Period / Month",
      render: (r) => (
        <div>
          <strong style={{ color: "#0284c7" }}>
            {r.periodStart && r.periodEnd
              ? `🗓️ ${r.periodStart} to ${r.periodEnd}`
              : MONTH_KEYS[r.month]
              ? t(MONTH_KEYS[r.month])
              : r.month}
          </strong>
          {r.periodStart && (
            <div style={{ fontSize: "10.5px", color: "var(--ink-muted)" }}>Move-In Cycle</div>
          )}
        </div>
      ),
    },
    { key: "amount", label: t("amount"), render: (r) => `₹${(r.amount || 0).toLocaleString("en-IN")}` },
    {
      key: "dueDate",
      label: t("dueDate") || "Due Date",
      render: (r) => (
        <span style={{ fontWeight: 600 }}>
          ⏰ {r.dueDate || "Due Date"}
        </span>
      ),
    },
    {
      key: "status",
      label: t("status"),
      render: (r) => (
        <span className={`pill ${r.status?.toLowerCase()}`}>{t(r.status?.toLowerCase()) || r.status}</span>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (r) =>
        r.status === "Paid" ? (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11px" }}
            onClick={() => handlePrintReceipt(r)}
          >
            📥 Receipt
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            style={{ padding: "4px 10px", fontSize: "11px" }}
            onClick={() => setPayingInvoice(r)}
          >
            💳 Pay Now
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHero title={t("myPayments")} subtitle={t("tenantHeroSubtitle")} />

      {toast && (
        <div style={{ background: "var(--accent-light, #e8f5e9)", color: "var(--green, #2e7d32)", padding: "10px 16px", borderRadius: "8px", marginBottom: "14px", fontWeight: "600" }}>
          ✓ {toast}
        </div>
      )}

      {/* Move-In Rent Cycle Summary Card */}
      {rentCycle && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "20px",
            background: "linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(2, 132, 199, 0.05) 100%)",
            border: "1px solid var(--border-subtle, #e2e8f0)",
            borderRadius: "10px",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border-subtle, #e2e8f0)", paddingBottom: "12px", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>📅</span>
                <strong style={{ fontSize: "15.5px", color: "var(--ink-primary)" }}>
                  Active Move-In Rent Cycle: {rentCycle.periodLabel}
                </strong>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                {rentCycle.cycleRuleDescription}
              </p>
            </div>
            <span
              className={`pill ${
                rentCycle.paymentStatus === "Paid"
                  ? "paid"
                  : rentCycle.paymentStatus === "Overdue"
                  ? "failed"
                  : "pending"
              }`}
              style={{ fontSize: "12px", fontWeight: "700" }}
            >
              {rentCycle.paymentStatus === "Paid"
                ? "✓ Cycle Paid"
                : rentCycle.paymentStatus === "Overdue"
                ? `⚠️ Overdue (${rentCycle.daysOverdue}d)`
                : rentCycle.paymentStatus === "Due Today"
                ? "⚡ Due Today"
                : "⏳ Payment Pending"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: "6px" }}>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Move-In Date</div>
              <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "2px" }}>📌 {rentCycle.moveInDate}</div>
            </div>
            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: "6px" }}>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Rental Period</div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#0284c7", marginTop: "2px" }}>🗓️ {rentCycle.periodLabel}</div>
            </div>
            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: "6px" }}>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                {rentCycle.paymentStatus === "Paid" ? "Next Due Date" : "Rent Due Date"}
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: rentCycle.paymentStatus === "Overdue" ? "#dc2626" : "inherit", marginTop: "2px" }}>
                ⏰ {rentCycle.paymentStatus === "Paid" ? rentCycle.nextDueDateFormatted : rentCycle.currentDueDateFormatted}
              </div>
            </div>
            <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: "6px" }}>
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", textTransform: "uppercase" }}>Monthly Rent</div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#059669", marginTop: "2px" }}>
                ₹{rentCycle.rentAmount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {rentCycle.paymentStatus !== "Paid" && (
            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "6px 14px", fontSize: "12px" }}
                onClick={handleGenerateInvoice}
              >
                📄 Ensure Invoice Generated
              </button>
            </div>
          )}
        </div>
      )}

      <DataTable
        title={t("myPayments")}
        columns={columns}
        rows={paymentsList}
        searchKeys={["id", "month", "propertyName", "status", "periodStart"]}
        searchPlaceholder={t("search")}
      />

      {/* Pay Rent Modal */}
      {payingInvoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setPayingInvoice(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "480px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Rent Settlement Gateway</h3>
                <span className="sub-text">Invoice #{payingInvoice.id} • {payingInvoice.month}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPayingInvoice(null)}>✕</button>
            </div>

            <div style={{ background: "var(--surface-hover)", padding: "14px", borderRadius: "8px", marginBottom: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Payable Rent</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--brand-blue)", margin: "4px 0" }}>
                ₹{(payingInvoice.amount || 0).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Due by: {payingInvoice.dueDate || "05th of Month"}</div>
            </div>

            <form onSubmit={handleConfirmPay} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                  Choose Payment Method
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {["UPI", "NetBanking", "Debit Card", "Credit Card"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={paymentMode === m ? "btn-primary" : "btn-outline"}
                      style={{ padding: "8px", fontSize: "12px", textAlign: "center" }}
                      onClick={() => setPaymentMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "UPI" && (
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                  />
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Supported: Google Pay, PhonePe, Paytm, BHIM, Cred
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="btn-outline" onClick={() => setPayingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isProcessing}>
                  {isProcessing ? "Processing..." : `Pay ₹${(payingInvoice.amount || 0).toLocaleString("en-IN")}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
