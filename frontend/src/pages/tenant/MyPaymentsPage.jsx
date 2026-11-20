import { useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { PAYMENTS, LEASES } from "../../data/db.js";
import { fetchPayments, updatePayment, fetchRentSchedules, generateRentInvoice, fetchLeases } from "../../utils/apiClient.js";
import { calculateTenantRentCycle } from "../../utils/rentCycleEngine.js";
import { exportPaymentLedgerToCSV, exportPaymentLedgerToPDF } from "../../utils/paymentReportExport.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import "./TenantLeasePayments.css";

const MONTH_KEYS = { May: "monthMay", Jun: "monthJun", Jul: "monthJul", Aug: "monthAug", Sep: "Sep 2026" };

export default function MyPaymentsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  const [toast, setToast] = useState({ text: "", type: "info" });
  const [paymentsList, setPaymentsList] = useState([]);
  const [allLeases, setAllLeases] = useState([]);
  const [rentCycle, setRentCycle] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tabs: 'upcoming', 'overdue', 'paid', 'all'
  const [activeTab, setActiveTab] = useState("all");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Payment Settlement Modal
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [upiId, setUpiId] = useState("resident@okhdfcbank");
  const [isProcessing, setIsProcessing] = useState(false);

  // Receipt Modal
  const [viewingReceipt, setViewingReceipt] = useState(null);

  // Esc key closes modals
  useEscapeKey(() => {
    if (payingInvoice) setPayingInvoice(null);
    if (viewingReceipt) setViewingReceipt(null);
  }, !!payingInvoice || !!viewingReceipt);

  const entityId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : "TEN001");

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "info" }), 4500);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [payData, leaseData, schedData] = await Promise.all([
          fetchPayments(entityId).catch(() => null),
          fetchLeases().catch(() => null),
          fetchRentSchedules({ tenantId: entityId }).catch(() => null),
        ]);

        if (!isMounted) return;

        // Set Leases
        if (Array.isArray(leaseData) && leaseData.length > 0) {
          setAllLeases(leaseData);
        } else {
          setAllLeases(LEASES);
        }

        // Set Payments
        let list = [];
        if (Array.isArray(payData) && payData.length > 0) {
          list = payData.filter((p) => p.tenantId === entityId || p.tenant_id === entityId);
        } else {
          list = PAYMENTS.filter((p) => p.tenantId === entityId || p.tenant_id === entityId);
        }
        setPaymentsList(list);

        // Rent Cycle
        if (schedData && Array.isArray(schedData.schedules) && schedData.schedules.length > 0) {
          const primarySchedule =
            schedData.schedules.find(
              (s) =>
                (s.lease?.id === "LSE001" || (s.lease?.status || "").toLowerCase() === "active") &&
                !s.lease?.id?.includes("-P") &&
                !s.lease?.id?.includes("-S")
            ) ||
            schedData.schedules.find((s) => (s.lease?.status || "").toLowerCase() === "active") ||
            schedData.schedules[0];

          setRentCycle(primarySchedule.rentCycle);
        } else {
          const foundLease =
            (leaseData || LEASES).find((l) => (l.tenantId === entityId || l.tenant_id === entityId) && l.status === "Active" && !l.id?.includes("-P") && !l.id?.includes("-S")) ||
            (leaseData || LEASES).find((l) => (l.tenantId === entityId || l.tenant_id === entityId) && l.status === "Active") ||
            (leaseData || LEASES).find((l) => l.tenantId === entityId);

          if (foundLease) {
            const cycle = calculateTenantRentCycle(foundLease, new Date(), list);
            setRentCycle(cycle);
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
    loadData();
    return () => {
      isMounted = false;
    };
  }, [entityId]);

  // Active Lease is the Single Source of Truth for Current Rent Amount
  const activeLease = useMemo(() => {
    const userLeases = allLeases.filter((l) => l.tenantId === entityId || l.tenant_id === entityId);
    return (
      userLeases.find((l) => (l.status || "").toLowerCase() === "active" && !l.id?.includes("-P") && !l.id?.includes("-S")) ||
      userLeases.find((l) => (l.status || "").toLowerCase() === "active") ||
      userLeases[0] ||
      LEASES[0]
    );
  }, [allLeases, entityId]);

  const currentRentAmount = useMemo(() => {
    if (!activeLease) return 0;
    return Number(activeLease.monthlyRent || activeLease.rent || 0);
  }, [activeLease]);

  // Financial Calculations
  const todayStr = new Date().toISOString().split("T")[0];

  const totalPaid = useMemo(() => {
    return paymentsList
      .filter((p) => (p.status || "").toLowerCase() === "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [paymentsList]);

  // Outstanding Balance: Strictly valid unpaid invoices only (status !== "Paid")
  const outstandingBalance = useMemo(() => {
    return paymentsList
      .filter((p) => (p.status || "").toLowerCase() !== "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [paymentsList]);

  // Next Due Date: Earliest unpaid invoice due date, or rent cycle next due date
  const nextDueDate = useMemo(() => {
    const unpaidInvoices = paymentsList.filter(
      (p) => (p.status || "").toLowerCase() !== "paid" && p.dueDate
    );
    if (unpaidInvoices.length > 0) {
      unpaidInvoices.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      return unpaidInvoices[0].dueDate;
    }
    return rentCycle?.nextDueDateFormatted || rentCycle?.currentDueDateFormatted || "10th of Next Month";
  }, [paymentsList, rentCycle]);

  // Categorize Invoices
  const isOverdue = (p) => {
    const st = (p.status || "").toLowerCase();
    if (st === "paid") return false;
    if (st === "overdue") return true;
    return p.dueDate && p.dueDate < todayStr;
  };

  const isUpcoming = (p) => {
    const st = (p.status || "").toLowerCase();
    if (st === "paid") return false;
    return !isOverdue(p);
  };

  const categorizedCounts = useMemo(() => {
    const upcoming = paymentsList.filter(isUpcoming).length;
    const overdue = paymentsList.filter(isOverdue).length;
    const paid = paymentsList.filter((p) => (p.status || "").toLowerCase() === "paid").length;
    return { upcoming, overdue, paid, all: paymentsList.length };
  }, [paymentsList]);

  // Filtered Payments for current activeTab and search/date filters
  const filteredPayments = useMemo(() => {
    let result = paymentsList;

    // 1. Tab Filtering
    if (activeTab === "upcoming") {
      result = result.filter(isUpcoming);
    } else if (activeTab === "overdue") {
      result = result.filter(isOverdue);
    } else if (activeTab === "paid") {
      result = result.filter((p) => (p.status || "").toLowerCase() === "paid");
    }

    // 2. Secondary Status Filter (if used)
    if (statusFilter !== "all") {
      result = result.filter((p) => (p.status || "").toLowerCase() === statusFilter.toLowerCase());
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.id && p.id.toLowerCase().includes(q)) ||
          (p.invoiceNo && p.invoiceNo.toLowerCase().includes(q)) ||
          (p.month && p.month.toLowerCase().includes(q)) ||
          (p.propertyName && p.propertyName.toLowerCase().includes(q)) ||
          (p.method && p.method.toLowerCase().includes(q)) ||
          (p.status && p.status.toLowerCase().includes(q))
      );
    }

    // 4. Date Preset Filter
    if (datePreset !== "all") {
      const now = new Date();
      if (datePreset === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        result = result.filter((p) => {
          const d = new Date(p.paidDate || p.dueDate || p.date || now);
          return d >= start && d <= now;
        });
      } else if (datePreset === "last30") {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        result = result.filter((p) => {
          const d = new Date(p.paidDate || p.dueDate || p.date || now);
          return d >= past30;
        });
      } else if (datePreset === "last90") {
        const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        result = result.filter((p) => {
          const d = new Date(p.paidDate || p.dueDate || p.date || now);
          return d >= past90;
        });
      } else if (datePreset === "custom") {
        if (startDate) {
          const s = new Date(startDate);
          result = result.filter((p) => new Date(p.paidDate || p.dueDate || p.date || now) >= s);
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          result = result.filter((p) => new Date(p.paidDate || p.dueDate || p.date || now) <= e);
        }
      }
    }

    return result;
  }, [paymentsList, activeTab, statusFilter, searchQuery, datePreset, startDate, endDate]);

  // Generate Current Cycle Invoice
  const handleGenerateInvoice = async () => {
    if (!activeLease) return;
    try {
      const res = await generateRentInvoice(activeLease.id);
      if (res && res.invoice) {
        setPaymentsList((prev) => {
          const exists = prev.some(
            (p) =>
              p.id === res.invoice.id ||
              p.invoiceNo === res.invoice.invoiceNo ||
              (p.leaseId === activeLease.id &&
                (p.month === res.invoice.month || p.periodStart === res.invoice.periodStart))
          );
          return exists ? prev : [res.invoice, ...prev];
        });
        showToast(res.message || "Rent invoice generated successfully!");
      }
    } catch (err) {
      showToast("Unable to generate invoice. Please try again.", "error");
    }
  };

  // Payment Settlement with Strict Backend Verification
  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if ((payingInvoice.status || "").toLowerCase() === "paid") {
      showToast("This rent invoice has already been settled!", "info");
      setPayingInvoice(null);
      return;
    }

    setIsProcessing(true);
    const today = new Date().toISOString().split("T")[0];
    const updatePayload = {
      status: "Paid",
      paidDate: today,
      paid_date: today,
      method: paymentMode,
      paymentMethod: paymentMode,
      transactionId: `TXN_${paymentMode}_${Date.now()}`,
    };

    try {
      const result = await updatePayment(payingInvoice.id, updatePayload);
      if (!result || result.error) {
        throw new Error(result?.error || "Backend payment update failed");
      }

      // Only update local state if backend API returned successful result
      setPaymentsList((prev) =>
        prev.map((p) => (p.id === payingInvoice.id ? { ...p, ...updatePayload, ...result } : p))
      );
      showToast(`Rent payment of ₹${Number(payingInvoice.amount || 0).toLocaleString("en-IN")} settled successfully via ${paymentMode}!`);
      setPayingInvoice(null);
    } catch (err) {
      console.error("Payment settlement error:", err);
      showToast(`Payment settlement could not be verified by backend: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Official Rent Receipt
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
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 680px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 18px; margin-bottom: 25px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 14px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 8px; }
          h1 { margin: 0 0 4px; font-size: 22px; color: #0f172a; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 13px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .box-title { font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; }
          .amount-banner { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; }
          .amount-val { font-size: 30px; font-weight: 800; color: #047857; }
          .stamp { text-align: right; margin-top: 35px; padding-top: 20px; font-size: 12px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">OFFICIAL RENT RECEIPT</div>
          <h1>PROPCONNECT RESIDENTIAL PORTAL</h1>
          <p style="margin: 0; color: #64748b; font-size: 13px;">
            Invoice No: <strong>${inv.invoiceNo || inv.id}</strong> | Receipt Date: ${inv.paidDate || inv.dueDate || todayStr}
          </p>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Resident Tenant</div>
            <div style="font-weight: 800; font-size: 15px;">${inv.tenantName || user?.name || "Divya Priya"}</div>
            <div style="color: #64748b;">ID: ${inv.tenantId || entityId}</div>
          </div>
          <div class="box">
            <div class="box-title">Leased Premises</div>
            <div style="font-weight: 800; font-size: 15px;">${inv.propertyName || "Sai Kala Apartments #302"}</div>
            <div style="color: #64748b;">Lease Ref: ${inv.leaseId || activeLease?.id || "LSE001"}</div>
          </div>
        </div>

        <div class="amount-banner">
          <div style="font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase;">Amount Paid</div>
          <div class="amount-val">₹${(Number(inv.amount) || 0).toLocaleString("en-IN")}</div>
          <div style="font-size: 13px; color: #047857; margin-top: 4px;">
            Period: <strong>${inv.month || inv.periodStart + " to " + inv.periodEnd}</strong> • Mode: <strong>${inv.method || "UPI"}</strong>
          </div>
        </div>

        <div class="box" style="margin-bottom: 20px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Status:</span>
            <span style="font-weight: 800; color: #059669;">Settled (Paid)</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Payment Date:</span>
            <span style="font-weight: 600;">${inv.paidDate || "Settled"}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Transaction Reference:</span>
            <span style="font-family: monospace; font-weight: 700;">${inv.transactionId || inv.invoiceNo || "TXN_" + inv.id}</span>
          </div>
        </div>

        <div class="stamp">
          <div>Verified &amp; digitally sealed by</div>
          <div style="font-weight: 800; color: #0f172a; margin-top: 4px;">PropConnect Payment Gateway</div>
          <div style="font-size: 11px;">Tamil Nadu Residential Tenancy Authority</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  return (
    <div className="tlp-container">
      <PageHero
        title={t("myPayments") || "Payments & Invoices"}
        subtitle="Manage monthly rent payments, track verified invoices, view financial obligations, and download payment receipts."
      />

      {/* Toast Notification */}
      {toast.text && (
        <div
          style={{
            background: toast.type === "error" ? "#fee2e2" : "#ecfdf5",
            color: toast.type === "error" ? "#b91c1c" : "#047857",
            border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
            padding: "12px 18px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 SUMMARY FINANCIAL CARDS */}
      {/* ========================================================================= */}
      <div className="tlp-kpi-grid">
        {/* Current Rent Amount */}
        <div className="tlp-kpi-card">
          <div className="tlp-kpi-top">
            <span className="tlp-kpi-title">Current Rent Amount</span>
            <span className="tlp-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🏠</span>
          </div>
          <div className="tlp-kpi-value" style={{ color: "#0284c7" }}>
            ₹{currentRentAmount.toLocaleString("en-IN")}<span style={{ fontSize: "14px", fontWeight: 500 }}>/mo</span>
          </div>
          <div className="tlp-kpi-desc">
            Active Lease: <strong>{activeLease?.id || "LSE001"}</strong>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="tlp-kpi-card">
          <div className="tlp-kpi-top">
            <span className="tlp-kpi-title">Outstanding Balance</span>
            <span className="tlp-kpi-icon" style={{ background: outstandingBalance > 0 ? "#fef2f2" : "#ecfdf5", color: outstandingBalance > 0 ? "#dc2626" : "#059669" }}>
              {outstandingBalance > 0 ? "⚠️" : "✓"}
            </span>
          </div>
          <div className="tlp-kpi-value" style={{ color: outstandingBalance > 0 ? "#dc2626" : "#059669" }}>
            ₹{outstandingBalance.toLocaleString("en-IN")}
          </div>
          <div className="tlp-kpi-desc">
            {outstandingBalance > 0 ? `${categorizedCounts.upcoming + categorizedCounts.overdue} unpaid invoices` : "All rent invoices clear"}
          </div>
        </div>

        {/* Total Rent Paid */}
        <div className="tlp-kpi-card">
          <div className="tlp-kpi-top">
            <span className="tlp-kpi-title">Total Paid</span>
            <span className="tlp-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💳</span>
          </div>
          <div className="tlp-kpi-value" style={{ color: "#059669" }}>
            ₹{totalPaid.toLocaleString("en-IN")}
          </div>
          <div className="tlp-kpi-desc">
            Across {categorizedCounts.paid} verified settlements
          </div>
        </div>

        {/* Next Due Date */}
        <div className="tlp-kpi-card">
          <div className="tlp-kpi-top">
            <span className="tlp-kpi-title">Next Due Date</span>
            <span className="tlp-kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>⏰</span>
          </div>
          <div className="tlp-kpi-value" style={{ fontSize: "20px" }}>
            {nextDueDate}
          </div>
          <div className="tlp-kpi-desc">
            Due on {rentCycle?.dueDayOrdinal || "10th"} of month
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MONTHLY PAYMENT SUMMARY & RENT CYCLE */}
      {/* ========================================================================= */}
      {rentCycle && (
        <div
          className="card"
          style={{
            padding: "18px 22px",
            background: "linear-gradient(135deg, #ffffff 0%, rgba(2, 132, 199, 0.04) 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🗓️</span>
              <div>
                <strong style={{ fontSize: "16px", color: "var(--ink-primary)" }}>
                  Monthly Rent Cycle: {rentCycle.periodLabel}
                </strong>
                <div style={{ fontSize: "12.5px", color: "var(--ink-muted)", marginTop: "2px" }}>
                  {rentCycle.cycleRuleDescription}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span
                className={`pill ${
                  rentCycle.paymentStatus === "Paid"
                    ? "paid"
                    : rentCycle.paymentStatus === "Overdue"
                    ? "failed"
                    : "pending"
                }`}
              >
                {rentCycle.paymentStatus === "Paid"
                  ? "✓ Cycle Settled"
                  : rentCycle.paymentStatus === "Overdue"
                  ? `⚠️ Overdue (${rentCycle.daysOverdue}d)`
                  : "⏳ Payment Due"}
              </span>

              {rentCycle.paymentStatus !== "Paid" && (
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                  onClick={handleGenerateInvoice}
                >
                  📄 Ensure Invoice Ready
                </button>
              )}

              <button
                type="button"
                className="btn-outline"
                style={{ padding: "6px 14px", fontSize: "12px" }}
                onClick={() => exportPaymentLedgerToPDF(paymentsList, { summaryStats: { totalPaid, outstandingBalance } })}
              >
                📥 Export Ledger (PDF)
              </button>

              <button
                type="button"
                className="btn-outline"
                style={{ padding: "6px 14px", fontSize: "12px" }}
                onClick={() => exportPaymentLedgerToCSV(paymentsList)}
              >
                📊 Export CSV
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Active Property</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                {activeLease?.propertyName || "Sai Kala Apartments #302"}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Move-In Date</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                📌 {rentCycle.moveInDate}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Billing Due Date</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: rentCycle.paymentStatus === "Overdue" ? "#dc2626" : "#0284c7", marginTop: "2px" }}>
                ⏰ {rentCycle.paymentStatus === "Paid" ? rentCycle.nextDueDateFormatted : rentCycle.currentDueDateFormatted}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Monthly Obligation</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                ₹{currentRentAmount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 SEPARATE TABS: UPCOMING, OVERDUE, PAID, ALL TRANSACTIONS */}
      {/* ========================================================================= */}
      <div className="tlp-nav-bar">
        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <span>📜</span>
          <span>All Transactions</span>
          <span className="tlp-tab-badge">{categorizedCounts.all}</span>
        </button>

        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          <span>⏳</span>
          <span>Upcoming</span>
          <span className="tlp-tab-badge">{categorizedCounts.upcoming}</span>
        </button>

        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "overdue" ? "active" : ""}`}
          onClick={() => setActiveTab("overdue")}
        >
          <span>⚠️</span>
          <span>Overdue</span>
          <span className={`tlp-tab-badge ${categorizedCounts.overdue > 0 ? "overdue" : ""}`}>
            {categorizedCounts.overdue}
          </span>
        </button>

        <button
          type="button"
          className={`tlp-tab-btn ${activeTab === "paid" ? "active" : ""}`}
          onClick={() => setActiveTab("paid")}
        >
          <span>✓</span>
          <span>Paid</span>
          <span className="tlp-tab-badge">{categorizedCounts.paid}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH AND FILTERS BAR */}
      {/* ========================================================================= */}
      <div className="tlp-filter-bar">
        {/* Search */}
        <div className="tlp-search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search invoice #, period, property, method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Date Presets */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              background: "#ffffff",
            }}
          >
            <option value="all">All Dates</option>
            <option value="thisMonth">This Month</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
            <option value="custom">Custom Range...</option>
          </select>

          {datePreset === "custom" && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
              />
            </div>
          )}

          {activeTab === "all" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                background: "#ffffff",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending Only</option>
              <option value="overdue">Overdue Only</option>
            </select>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div style={{ fontSize: "12.5px", color: "#64748b", margin: "-6px 0 6px" }}>
        Showing <strong>{filteredPayments.length}</strong> {activeTab} payment record{filteredPayments.length !== 1 ? "s" : ""}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP RESPONSIVE TABLE */}
      {/* ========================================================================= */}
      <div className="tlp-desktop-table card" style={{ padding: "0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Invoice ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Property</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Rental Period / Month</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Amount</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Due / Paid Date</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Payment Method</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>No invoices found</div>
                  <div style={{ fontSize: "12.5px", marginTop: "4px" }}>
                    No payment records match the selected tab or search criteria.
                  </div>
                </td>
              </tr>
            ) : (
              filteredPayments.map((p, idx) => {
                const isPaidStatus = (p.status || "").toLowerCase() === "paid";
                const isOverdueStatus = isOverdue(p);

                return (
                  <tr
                    key={p.id || idx}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: idx % 2 === 0 ? "#ffffff" : "#fcfdfe",
                      transition: "background 0.1s ease",
                    }}
                  >
                    {/* Invoice ID */}
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ color: "#0f172a" }}>{p.id}</strong>
                      {p.invoiceNo && p.invoiceNo !== p.id && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{p.invoiceNo}</div>
                      )}
                    </td>

                    {/* Property */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{p.propertyName || "Sai Kala Apartments #302"}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Unit #{p.propertyId || "PRP001"}</div>
                    </td>

                    {/* Rental Period */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#0284c7" }}>
                        {p.periodStart && p.periodEnd
                          ? `${p.periodStart} to ${p.periodEnd}`
                          : MONTH_KEYS[p.month]
                          ? t(MONTH_KEYS[p.month])
                          : p.month || "Current Cycle"}
                      </div>
                      {p.periodStart && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>Move-In Cycle</div>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                        ₹{(Number(p.amount) || 0).toLocaleString("en-IN")}
                      </strong>
                    </td>

                    {/* Due / Paid Date */}
                    <td style={{ padding: "12px 16px" }}>
                      {isPaidStatus ? (
                        <div>
                          <span style={{ color: "#059669", fontWeight: 600 }}>✓ Settled</span>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{p.paidDate || p.date || "Completed"}</div>
                        </div>
                      ) : (
                        <div>
                          <span style={{ color: isOverdueStatus ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                            ⏰ {p.dueDate || "Due Soon"}
                          </span>
                          {isOverdueStatus && (
                            <div style={{ fontSize: "10.5px", color: "#dc2626", fontWeight: 700 }}>Overdue</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Payment Method */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "4px", fontSize: "11.5px", fontWeight: 600 }}>
                        {p.method || p.paymentMethod || "UPI"}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className={`pill ${
                          isPaidStatus
                            ? "paid"
                            : isOverdueStatus
                            ? "failed"
                            : "pending"
                        }`}
                      >
                        {isPaidStatus ? "Paid" : isOverdueStatus ? "Overdue" : "Pending"}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {isPaidStatus ? (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "5px 12px", fontSize: "12px" }}
                          onClick={() => handlePrintReceipt(p)}
                        >
                          📥 Receipt
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: "5px 14px", fontSize: "12px" }}
                          onClick={() => setPayingInvoice(p)}
                        >
                          💳 Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE RESPONSIVE TRANSACTION CARDS */}
      {/* ========================================================================= */}
      <div className="tlp-tx-card-list">
        {filteredPayments.length === 0 ? (
          <div className="card" style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📭</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>No invoices found</div>
            <div style={{ fontSize: "12px" }}>No payment records match your filters.</div>
          </div>
        ) : (
          filteredPayments.map((p, idx) => {
            const isPaidStatus = (p.status || "").toLowerCase() === "paid";
            const isOverdueStatus = isOverdue(p);

            return (
              <div key={p.id || idx} className="tlp-tx-card">
                <div className="tlp-tx-header">
                  <div>
                    <div className="tlp-tx-id">{p.id}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "1px" }}>
                      {p.propertyName || "Sai Kala Apartments #302"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tlp-tx-amount">₹{(Number(p.amount) || 0).toLocaleString("en-IN")}</div>
                    <span
                      className={`pill ${
                        isPaidStatus
                          ? "paid"
                          : isOverdueStatus
                          ? "failed"
                          : "pending"
                      }`}
                      style={{ fontSize: "11px", padding: "2px 8px", marginTop: "4px" }}
                    >
                      {isPaidStatus ? "Paid" : isOverdueStatus ? "Overdue" : "Pending"}
                    </span>
                  </div>
                </div>

                <div className="tlp-tx-meta">
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Period</span>
                    <strong style={{ color: "#0284c7" }}>
                      {p.periodStart && p.periodEnd ? `${p.periodStart} to ${p.periodEnd}` : p.month || "Cycle"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>
                      {isPaidStatus ? "Settlement Date" : "Due Date"}
                    </span>
                    <strong>{isPaidStatus ? p.paidDate || p.date || "Settled" : p.dueDate || "Due Soon"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Method</span>
                    <span>{p.method || "UPI"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Invoice Ref</span>
                    <span>{p.invoiceNo || p.id}</span>
                  </div>
                </div>

                <div className="tlp-tx-actions">
                  {isPaidStatus ? (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ width: "100%", padding: "8px", fontSize: "13px" }}
                      onClick={() => handlePrintReceipt(p)}
                    >
                      📥 Download Receipt
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: "100%", padding: "8px", fontSize: "13px" }}
                      onClick={() => setPayingInvoice(p)}
                    >
                      💳 Pay Rent (₹{(Number(p.amount) || 0).toLocaleString("en-IN")})
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* PAY RENT MODAL */}
      {/* ========================================================================= */}
      {payingInvoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Rent Settlement Gateway</h3>
                <span className="sub-text">Invoice #{payingInvoice.id} • {payingInvoice.month}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPayingInvoice(null)}>✕</button>
            </div>

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", marginBottom: "16px", textAlign: "center", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Payable Rent</div>
              <div style={{ fontSize: "30px", fontWeight: 800, color: "#0284c7", margin: "4px 0" }}>
                ₹{(Number(payingInvoice.amount) || 0).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                Due Date: <strong>{payingInvoice.dueDate || "05th of Month"}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmPay} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
                  Choose Verified Payment Mode
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {["UPI", "NetBanking", "Debit Card", "Credit Card"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={paymentMode === m ? "btn-primary" : "btn-outline"}
                      style={{ padding: "9px", fontSize: "12.5px", textAlign: "center" }}
                      onClick={() => setPaymentMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "UPI" && (
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Supports: Google Pay, PhonePe, BHIM, Paytm, Cred
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <button type="button" className="btn-outline" onClick={() => setPayingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isProcessing}>
                  {isProcessing ? "Verifying with Gateway..." : `Confirm & Pay ₹${(Number(payingInvoice.amount) || 0).toLocaleString("en-IN")}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
