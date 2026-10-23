import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchUtilityBills,
  createEbBillOrder,
  payUtilityBill,
} from "../../utils/apiClient.js";

export default function TenantEbBillsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all", "pending", "overdue", "history"
  const [selectedBill, setSelectedBill] = useState(null); // For view details / document modal
  const [payingBill, setPayingBill] = useState(null); // For payment modal
  const [receiptBill, setReceiptBill] = useState(null); // For official receipt modal
  const [toast, setToast] = useState(null);

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("resident.tneb@okhdfcbank");
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);

  const tenantId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await fetchUtilityBills({
        tenantId: tenantId || undefined,
        type: "Electricity",
      });
      if (Array.isArray(data)) {
        setBills(data);
      } else {
        setBills([]);
      }
    } catch (err) {
      console.warn("Failed to load tenant EB bills:", err);
      showToast(err.message || "Failed to load bills", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [tenantId]);

  // Derived metrics
  const totalBillsCount = bills.length;
  const unpaidBills = bills.filter((b) => b.status !== "Paid");
  const paidBills = bills.filter((b) => b.status === "Paid");
  const overdueBills = bills.filter((b) => b.status === "Overdue");
  const dueSoonBills = bills.filter((b) => b.status === "Due Soon");
  const totalPayable = unpaidBills.reduce((acc, b) => acc + (b.tenantAmount || b.amount || 0), 0);
  const totalSettled = paidBills.reduce((acc, b) => acc + (b.paidAmount || b.amount || 0), 0);

  // Tab filtering
  const displayedBills = bills.filter((b) => {
    if (activeTab === "pending") return b.status !== "Paid";
    if (activeTab === "overdue") return b.status === "Overdue";
    if (activeTab === "history") return b.status === "Paid";
    return true;
  });

  // Handle Pay Now click
  const handleInitiatePay = async (bill) => {
    setPayingBill(bill);
    setPaymentSuccessData(null);
  };

  // Submit Payment to Backend
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!payingBill) return;

    setIsProcessing(true);
    try {
      // 1. Create Order via backend
      let orderId = `ORD_EB_${Date.now()}`;
      try {
        const orderRes = await createEbBillOrder(payingBill.id);
        if (orderRes && orderRes.orderId) {
          orderId = orderRes.orderId;
        }
      } catch (err) {
        console.warn("Using simulated order token:", err.message);
      }

      // 2. Mock payment confirmation token / Razorpay signature
      const mockTxnId = `TXN_TNEB_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`;
      const amountToPay = payingBill.tenantAmount || payingBill.amount;

      // 3. Backend payment verification
      const verifyRes = await payUtilityBill(payingBill.id, {
        paymentMethod,
        transactionId: mockTxnId,
        orderId,
        paidAmount: amountToPay,
        signature: `sha256_${Date.now()}_propconnect_verified`,
      });

      if (verifyRes && verifyRes.success) {
        const updatedBill = verifyRes.bill || {
          ...payingBill,
          status: "Paid",
          paidDate: new Date().toISOString().split("T")[0],
          paidAmount: amountToPay,
          paymentMethod,
          transactionId: mockTxnId,
        };

        setPaymentSuccessData({
          billId: payingBill.id,
          amount: amountToPay,
          transactionId: mockTxnId,
          date: new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          propertyName: payingBill.propertyName,
          consumerNo: payingBill.consumerNo,
        });

        // Update local state
        setBills((prev) =>
          prev.map((b) => (b.id === payingBill.id ? updatedBill : b))
        );

        showToast(
          `⚡ Electricity bill of ₹${amountToPay.toLocaleString("en-IN")} paid and verified successfully!`
        );
      }
    } catch (err) {
      showToast(err.message || "Payment processing failed. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Official Receipt
  const handlePrintReceipt = (b) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>EB Payment Receipt - ${b.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 8px; }
          h1 { margin: 0 0 6px; font-size: 22px; color: #0f172a; }
          .meta-row { font-size: 13px; color: #64748b; margin-top: 4px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 13.5px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .box-title { font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; }
          .amount-banner { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
          .amount-val { font-size: 28px; font-weight: 800; color: #047857; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
          th { background: #f1f5f9; color: #475569; }
          .footer { margin-top: 35px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">OFFICIAL ELECTRICITY PAYMENT RECEIPT</div>
          <h1>PROPCONNECT PORTAL</h1>
          <p class="meta-row">TNEB / Electricity Board Utility Settlement</p>
          <p class="meta-row"><strong>Receipt Ref:</strong> ${b.transactionId || b.id} | <strong>Date:</strong> ${b.paidDate || new Date().toISOString().split("T")[0]}</p>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Consumer & Resident</div>
            <div><strong>${b.tenantName || user?.name || "Resident Tenant"}</strong></div>
            <div style="color: #64748b; margin-top: 3px;">Consumer No: <strong>${b.consumerNo || "N/A"}</strong></div>
            <div style="color: #64748b;">Billing Month: ${b.billingMonth || "Current"}</div>
          </div>
          <div class="box">
            <div class="box-title">Rental Premises</div>
            <div><strong>${b.propertyName || "Sai Kala Apartments"}</strong></div>
            <div style="color: #64748b; margin-top: 3px;">Bill ID: ${b.id}</div>
            <div style="color: #64748b;">Reference: ${b.billReference || "TNEB"}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Meter Reading</th>
              <th>Units (kWh)</th>
              <th>Status</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Electricity Charges (${b.billingMonth || "Monthly"})</td>
              <td>${b.previousReading || 0} → ${b.currentReading || "-"}</td>
              <td>${b.unitsConsumed ? `${b.unitsConsumed} units` : "Domestic Tariff"}</td>
              <td><strong style="color: #047857;">PAID &amp; VERIFIED</strong></td>
              <td style="text-align: right; font-weight: 700;">₹${Number(b.paidAmount || b.tenantAmount || b.amount).toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>

        <div class="amount-banner">
          <div style="font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase;">Total Settled Via ${b.paymentMethod || "UPI"}</div>
          <div class="amount-val">₹${Number(b.paidAmount || b.tenantAmount || b.amount).toLocaleString("en-IN")}</div>
          <div style="font-size: 12px; color: #047857; margin-top: 4px;">Gateway Transaction ID: <code>${b.transactionId || "TXN_VERIFIED"}</code></div>
        </div>

        <div class="footer">
          This is an authentic, system-verified electronic receipt generated by PropConnect Tenancy Management System.<br/>
          Tamil Nadu Generation and Distribution Corporation (TANGEDCO) Domestic Tariff Compliant.
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Paid":
        return "badge-success";
      case "Overdue":
        return "badge-danger";
      case "Due Soon":
        return "badge-warning";
      case "Payment Pending":
        return "badge-info";
      case "Failed":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  return (
    <div className="tenant-eb-bills-page">
      <PageHero
        badge="Resident Utility Services"
        title="⚡ Electricity & EB Bill Management"
        subtitle="Review meter readings, track monthly consumption, download board bills, and remit electricity dues securely"
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              onClick={() => {
                const nextUnpaid = bills.find((b) => b.status !== "Paid");
                if (nextUnpaid) {
                  handleInitiatePay(nextUnpaid);
                } else {
                  showToast("All electricity dues are currently settled!", "info");
                }
              }}
            >
              💳 {t("payNow")}
            </button>
            <button className="btn-outline" onClick={loadBills}>
              🔄 {t("refresh")}
            </button>
          </div>
        }
      />

      {toast && (
        <div
          className={`toast animate-fade-in ${toast.type === "error" ? "toast-error" : "toast-success"}`}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            padding: "14px 22px",
            borderRadius: "8px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⚡</span>
          </div>
          <div className="stat-value">{totalBillsCount}</div>
          <div className="stat-footer neutral">All allotted EB invoices</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pending Dues</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⏳</span>
          </div>
          <div className="stat-value" style={{ color: totalPayable > 0 ? "#ea580c" : "#10b981" }}>
            ₹{totalPayable.toLocaleString("en-IN")}
          </div>
          <div className="stat-footer neutral">
            {unpaidBills.length} unpaid bill{unpaidBills.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Overdue Bills</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>⚠️</span>
          </div>
          <div className="stat-value" style={{ color: overdueBills.length > 0 ? "#ef4444" : "#10b981" }}>
            {overdueBills.length}
          </div>
          <div className="stat-footer" style={{ color: overdueBills.length > 0 ? "#ef4444" : "#10b981" }}>
            {overdueBills.length > 0 ? "Immediate Action Required" : "No overdue charges"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Settled</span>
            <span className="stat-icon" style={{ fontSize: "20px" }}>✅</span>
          </div>
          <div className="stat-value" style={{ color: "#10b981" }}>
            ₹{totalSettled.toLocaleString("en-IN")}
          </div>
          <div className="stat-footer positive">{paidBills.length} completed payments</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "20px",
          overflowX: "auto",
        }}
      >
        <button
          className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "all" ? "2px solid var(--brand-blue)" : "2px solid transparent",
            color: activeTab === "all" ? "var(--brand-blue)" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          All EB Bills ({bills.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "pending" ? "2px solid var(--brand-blue)" : "2px solid transparent",
            color: activeTab === "pending" ? "var(--brand-blue)" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Unpaid &amp; Due Soon ({unpaidBills.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "overdue" ? "active" : ""}`}
          onClick={() => setActiveTab("overdue")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "overdue" ? "2px solid #ef4444" : "2px solid transparent",
            color: activeTab === "overdue" ? "#ef4444" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Overdue Bills ({overdueBills.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "history" ? "2px solid #10b981" : "2px solid transparent",
            color: activeTab === "history" ? "#10b981" : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Payment History ({paidBills.length})
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="spinner" />
          <p style={{ marginTop: "16px", color: "var(--text-muted)" }}>
            Loading your verified electricity bills…
          </p>
        </div>
      ) : displayedBills.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "60px 20px",
            borderRadius: "12px",
            background: "var(--card-bg)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "14px" }}>⚡</div>
          <h3 style={{ margin: "0 0 8px 0" }}>No electricity bills found</h3>
          <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto" }}>
            There are currently no electricity bills in this category. New bills generated by your landlord will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {displayedBills.map((bill) => {
            const isPaid = bill.status === "Paid";
            const isOverdue = bill.status === "Overdue";
            const isDueSoon = bill.status === "Due Soon";
            const payableAmt = bill.tenantAmount || bill.amount;

            return (
              <div
                key={bill.id}
                className="card animate-fade-in"
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  borderLeft: isPaid
                    ? "5px solid #10b981"
                    : isOverdue
                    ? "5px solid #ef4444"
                    : isDueSoon
                    ? "5px solid #f59e0b"
                    : "5px solid var(--brand-blue)",
                  background: "var(--card-bg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "17px", color: "var(--text-primary)" }}>
                        {bill.propertyName || "Rental Unit"}
                      </span>
                      <span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                        Bill #{bill.id}
                      </span>
                      <span className={`badge ${getStatusBadgeClass(bill.status)}`}>
                        {bill.status}
                      </span>
                      {bill.responsibility === "Shared" && (
                        <span className="badge" style={{ background: "#ede9fe", color: "#6d28d9" }}>
                          Shared Expense (Tenant Share: ₹{bill.tenantAmount})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                      TNEB Consumer No: <strong>{bill.consumerNo || "01-102-004-3291"}</strong> • Month: <strong>{bill.billingMonth || "Current"}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: isPaid ? "#10b981" : isOverdue ? "#ef4444" : "var(--brand-blue)" }}>
                      ₹{payableAmt.toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {isPaid ? `Settled on ${bill.paidDate}` : `Due by ${bill.dueDate}`}
                    </div>
                  </div>
                </div>

                {/* Meter Details Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "12px",
                    background: "rgba(0,0,0,0.02)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                      Previous Reading
                    </span>
                    <strong>{bill.previousReading !== null && bill.previousReading !== undefined ? `${bill.previousReading} kWh` : "—"}</strong>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                      Current Reading
                    </span>
                    <strong>{bill.currentReading !== null && bill.currentReading !== undefined ? `${bill.currentReading} kWh` : "—"}</strong>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                      Units Consumed
                    </span>
                    <strong>{bill.unitsConsumed ? `${bill.unitsConsumed} Units` : "Domestic Tier"}</strong>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                      Issue Date
                    </span>
                    <span>{bill.billDate || "2026-09-25"}</span>
                  </div>

                  {isPaid && (
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                        Transaction Ref
                      </span>
                      <code style={{ fontSize: "12px", color: "#047857" }}>{bill.transactionId || "TXN_PAID"}</code>
                    </div>
                  )}
                </div>

                {/* Overdue Warning Callout */}
                {isOverdue && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "#b91c1c",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>⚠️</span>
                    <span>
                      Your electricity bill of ₹{payableAmt} is overdue since <strong>{bill.dueDate}</strong>. Please settle your bill promptly to avoid disruption of power services.
                    </span>
                  </div>
                )}

                {/* Due Soon Callout */}
                {isDueSoon && (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "#b45309",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>⏰</span>
                    <span>
                      Payment is due soon on <strong>{bill.dueDate}</strong>. Pay now to avoid late payment surcharge.
                    </span>
                  </div>
                )}

                {/* Actions Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "10px",
                    paddingTop: "6px",
                    borderTop: "1px solid var(--border-color)",
                    flexWrap: "wrap",
                  }}
                >
                  {bill.documentUrl && (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setSelectedBill(bill)}
                      style={{ fontSize: "13px", padding: "6px 14px" }}
                    >
                      📄 View Bill Document
                    </button>
                  )}

                  {isPaid ? (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => handlePrintReceipt(bill)}
                      style={{ fontSize: "13px", padding: "6px 14px", color: "#047857", borderColor: "#10b981" }}
                    >
                      🖨️ Official Receipt
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleInitiatePay(bill)}
                      style={{
                        fontSize: "13.5px",
                        padding: "7px 18px",
                        background: isOverdue ? "#dc2626" : "var(--brand-blue)",
                      }}
                    >
                      💳 Pay Now (₹{payableAmt.toLocaleString("en-IN")})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay Now Modal */}
      {payingBill && (
        <div
          className="modal-backdrop"
          onClick={() => !isProcessing && setPayingBill(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="modal-box animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                padding: "20px 24px",
                color: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                    }}
                  >
                    SECURE PAYMENT GATEWAY
                  </span>
                  <h3 style={{ margin: "8px 0 2px 0", fontSize: "19px" }}>
                    Pay Electricity Bill
                  </h3>
                  <div style={{ fontSize: "13px", opacity: 0.9 }}>
                    {payingBill.propertyName} • {payingBill.billingMonth}
                  </div>
                </div>

                {!isProcessing && (
                  <button
                    type="button"
                    onClick={() => setPayingBill(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "22px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px" }}>
              {paymentSuccessData ? (
                /* Payment Success View */
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "#ecfdf5",
                      color: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      margin: "0 auto 16px auto",
                      border: "2px solid #10b981",
                    }}
                  >
                    ✓
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#065f46" }}>
                    Payment Confirmed!
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                    Your electricity bill has been successfully verified and marked as Paid.
                  </p>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "13.5px",
                      marginBottom: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Amount Paid:</span>
                      <strong>₹{paymentSuccessData.amount.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Transaction ID:</span>
                      <code style={{ color: "#0284c7" }}>{paymentSuccessData.transactionId}</code>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Bill Ref:</span>
                      <span>{paymentSuccessData.billId}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Date:</span>
                      <span>{paymentSuccessData.date}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => handlePrintReceipt({ ...payingBill, ...paymentSuccessData })}
                      style={{ flex: 1, padding: "10px" }}
                    >
                      🖨️ Print Receipt
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setPayingBill(null)}
                      style={{ flex: 1, padding: "10px" }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment Form View */
                <form onSubmit={handleConfirmPayment}>
                  {/* Bill Summary Banner */}
                  <div
                    style={{
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      marginBottom: "20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: "#0369a1", textTransform: "uppercase", fontWeight: 700 }}>
                        Payable Amount
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#0c4a6e" }}>
                        ₹{(payingBill.tenantAmount || payingBill.amount).toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                        Consumer No: {payingBill.consumerNo || "01-102-004-3291"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "12.5px", color: "#475569" }}>
                      <div>Units: <strong>{payingBill.unitsConsumed || "N/A"}</strong></div>
                      <div>Due: <strong>{payingBill.dueDate}</strong></div>
                    </div>
                  </div>

                  {/* Payment Mode Selection */}
                  <div style={{ marginBottom: "18px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: "#334155" }}>
                      Select Payment Mode
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      {["UPI", "Card", "NetBanking"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMethod(mode)}
                          style={{
                            padding: "10px",
                            borderRadius: "8px",
                            border: paymentMethod === mode ? "2px solid #0284c7" : "1px solid #cbd5e1",
                            background: paymentMethod === mode ? "#f0f9ff" : "#ffffff",
                            color: paymentMethod === mode ? "#0369a1" : "#475569",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          {mode === "UPI" ? "📱 UPI" : mode === "Card" ? "💳 Card" : "🏦 NetBanking"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  {paymentMethod === "UPI" && (
                    <div style={{ marginBottom: "18px" }}>
                      <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px", color: "#475569" }}>
                        Virtual Payment Address (VPA / UPI ID)
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okhdfcbank"
                        required
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                        Supports Google Pay, PhonePe, Paytm, and BHIM UPI
                      </span>
                    </div>
                  )}

                  {paymentMethod === "Card" && (
                    <div style={{ marginBottom: "18px" }}>
                      <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px", color: "#475569" }}>
                        Debit / Credit Card Number (Test Mode)
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4111 2222 3333 4444"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          marginBottom: "8px",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            boxSizing: "border-box",
                          }}
                        />
                        <input
                          type="password"
                          defaultValue="•••"
                          maxLength={3}
                          placeholder="CVV"
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === "NetBanking" && (
                    <div style={{ marginBottom: "18px" }}>
                      <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px", color: "#475569" }}>
                        Select Bank
                      </label>
                      <select
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      >
                        <option>State Bank of India (SBI)</option>
                        <option>HDFC Bank</option>
                        <option>ICICI Bank</option>
                        <option>Indian Overseas Bank (IOB)</option>
                        <option>Canara Bank</option>
                      </select>
                    </div>
                  )}

                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: "#64748b",
                      marginBottom: "20px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    🔒 256-Bit SSL Encrypted. Powered by Razorpay Test Sandbox. Real money is not charged in test mode.
                  </div>

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setPayingBill(null)}
                      disabled={isProcessing}
                      style={{ padding: "10px 18px" }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isProcessing}
                      style={{
                        padding: "10px 24px",
                        background: "#0284c7",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <span className="spinner" style={{ width: "16px", height: "16px" }} />
                          <span>Verifying &amp; Settling…</span>
                        </>
                      ) : (
                        <span>Pay ₹{(payingBill.tenantAmount || payingBill.amount).toLocaleString("en-IN")}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {selectedBill && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedBill(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="modal-box animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "17px" }}>
                Electricity Bill Document — {selectedBill.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedBill(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", textAlign: "center" }}>
              {selectedBill.documentUrl ? (
                <div>
                  <img
                    src={selectedBill.documentUrl}
                    alt="Electricity Bill Document"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "360px",
                      borderRadius: "8px",
                      objectFit: "contain",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
                    {selectedBill.documentName || "TANGEDCO Electronic Bill Copy"}
                  </div>
                </div>
              ) : (
                <p>No document attached to this bill.</p>
              )}
            </div>

            <div
              style={{
                padding: "14px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="btn-outline" onClick={() => setSelectedBill(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
