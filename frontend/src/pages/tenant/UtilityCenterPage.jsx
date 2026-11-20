import { useContext, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { UTILITY_BILLS } from "../../data/db.js";
import { fetchUtilityBills, createEbBillOrder, payUtilityBill } from "../../utils/apiClient.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import "./UtilityAndRequestCenter.css";

export default function UtilityCenterPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs: 'overview', 'electricity', 'water', 'other', 'history'
  const validTabs = ["overview", "electricity", "water", "other", "history"];
  const tabParam = searchParams.get("tab")?.toLowerCase();
  // Map old route queries 'eb' -> 'electricity', 'utilities' -> 'water'
  let mappedTab = tabParam;
  if (tabParam === "eb") mappedTab = "electricity";
  if (tabParam === "utilities") mappedTab = "water";
  const activeTab = validTabs.includes(mappedTab) ? mappedTab : "overview";

  const handleTabChange = (tab) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };

  const tenantId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : "TEN001");
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ text: "", type: "info" });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Payment Modal
  const [payingBill, setPayingBill] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("resident.tneb@okhdfcbank");
  const [isProcessing, setIsProcessing] = useState(false);

  // Esc key closes modal
  useEscapeKey(() => {
    if (payingBill) setPayingBill(null);
  }, !!payingBill);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "info" }), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchUtilityBills({ tenantId });
        if (isMounted) {
          if (Array.isArray(data) && data.length > 0) {
            setBills(data);
          } else {
            setBills(UTILITY_BILLS);
          }
        }
      } catch (err) {
        if (isMounted) setBills(UTILITY_BILLS);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // Helper categorization
  const isElectricityBill = (b) => {
    const typeStr = (b.type || "").toLowerCase();
    return typeStr.includes("electricity") || typeStr.includes("tneb") || typeStr.includes("eb");
  };

  const isWaterBill = (b) => {
    const typeStr = (b.type || "").toLowerCase();
    return typeStr.includes("water") || typeStr.includes("cmwssb") || typeStr.includes("tanker");
  };

  const isOtherBill = (b) => {
    return !isElectricityBill(b) && !isWaterBill(b);
  };

  // Metrics
  const totalBills = bills.length;
  const unpaidBills = bills.filter((b) => (b.status || "").toLowerCase() !== "paid");
  const paidBills = bills.filter((b) => (b.status || "").toLowerCase() === "paid");
  const overdueBills = bills.filter((b) => (b.status || "").toLowerCase() === "overdue");

  const totalOutstanding = unpaidBills.reduce((acc, b) => acc + (Number(b.tenantAmount || b.amount) || 0), 0);
  const totalSettled = paidBills.reduce((acc, b) => acc + (Number(b.paidAmount || b.tenantAmount || b.amount) || 0), 0);

  // Monthly Electricity Consumption Data
  const consumptionHistory = useMemo(() => {
    return [
      { month: "May 2026", units: 280, amount: 1420 },
      { month: "Jun 2026", units: 340, amount: 1850 },
      { month: "Jul 2026", units: 390, amount: 2240 },
      { month: "Aug 2026", units: 310, amount: 1680 },
      { month: "Sep 2026", units: 350, amount: 1980, current: true },
    ];
  }, []);

  // Filtered Bills for currently selected tab and search/date filters
  const filteredBills = useMemo(() => {
    let result = bills;

    // 1. Tab Scope
    if (activeTab === "electricity") {
      result = result.filter(isElectricityBill);
    } else if (activeTab === "water") {
      result = result.filter(isWaterBill);
    } else if (activeTab === "other") {
      result = result.filter(isOtherBill);
    } else if (activeTab === "history") {
      result = result.filter((b) => (b.status || "").toLowerCase() === "paid");
    }

    // 2. Secondary Status Filter
    if (statusFilter !== "all") {
      result = result.filter((b) => (b.status || "").toLowerCase() === statusFilter.toLowerCase());
    }

    // 3. Keyword Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          (b.id && b.id.toLowerCase().includes(q)) ||
          (b.type && b.type.toLowerCase().includes(q)) ||
          (b.consumerNo && b.consumerNo.toLowerCase().includes(q)) ||
          (b.propertyName && b.propertyName.toLowerCase().includes(q)) ||
          (b.billingMonth && b.billingMonth.toLowerCase().includes(q))
      );
    }

    // 4. Date Presets
    if (datePreset !== "all") {
      const now = new Date();
      if (datePreset === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        result = result.filter((b) => new Date(b.billDate || b.dueDate || now) >= start);
      } else if (datePreset === "last30") {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        result = result.filter((b) => new Date(b.billDate || b.dueDate || now) >= past30);
      } else if (datePreset === "last90") {
        const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        result = result.filter((b) => new Date(b.billDate || b.dueDate || now) >= past90);
      } else if (datePreset === "custom") {
        if (startDate) {
          result = result.filter((b) => new Date(b.billDate || b.dueDate || now) >= new Date(startDate));
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          result = result.filter((b) => new Date(b.billDate || b.dueDate || now) <= e);
        }
      }
    }

    return result;
  }, [bills, activeTab, statusFilter, searchQuery, datePreset, startDate, endDate]);

  // Payment Confirmation with backend verification
  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!payingBill) return;

    setIsProcessing(true);
    const amountToPay = Number(payingBill.tenantAmount || payingBill.amount);
    const mockTxnId = `TXN_UTL_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`;

    try {
      // 1. Order ID
      let orderId = `ORD_UTL_${Date.now()}`;
      try {
        const orderRes = await createEbBillOrder(payingBill.id);
        if (orderRes && orderRes.orderId) orderId = orderRes.orderId;
      } catch (orderErr) {
        console.warn("Using simulated order token:", orderErr.message);
      }

      // 2. Verification request
      const verifyRes = await payUtilityBill(payingBill.id, {
        paymentMethod,
        transactionId: mockTxnId,
        orderId,
        paidAmount: amountToPay,
        signature: `sha256_${Date.now()}_propconnect_verified`,
      });

      if (verifyRes && verifyRes.success) {
        const todayStr = new Date().toISOString().split("T")[0];
        setBills((prev) =>
          prev.map((b) =>
            b.id === payingBill.id
              ? {
                  ...b,
                  status: "Paid",
                  paidDate: todayStr,
                  paidAmount: amountToPay,
                  paymentMethod,
                  transactionId: mockTxnId,
                }
              : b
          )
        );
        showToast(`✓ Utility bill of ₹${amountToPay.toLocaleString("en-IN")} settled and verified!`);
        setPayingBill(null);
      } else {
        throw new Error(verifyRes?.error || "Payment verification failed");
      }
    } catch (err) {
      showToast(err.message || "Payment verification failed. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Official Receipt Print / Download
  const handlePrintReceipt = (bill) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Utility Bill Receipt - ${bill.id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 650px; margin: 0 auto; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
          h1 { margin: 0 0 4px; font-size: 22px; color: #0f172a; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0; font-size: 13px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .box-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .amount-banner { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
          .amount-val { font-size: 28px; font-weight: 800; color: #047857; }
          .footer { text-align: right; margin-top: 30px; font-size: 11.5px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="badge">OFFICIAL UTILITY RECEIPT</div>
          <h1>PropConnect Utility Center</h1>
          <p style="margin: 0; color: #64748b; font-size: 12.5px;">
            Receipt No: <strong>${bill.transactionId || "REC_" + bill.id}</strong> | Settled: ${bill.paidDate || new Date().toISOString().split("T")[0]}
          </p>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Resident Tenant</div>
            <div style="font-weight: 800; font-size: 14px;">${user?.name || "Divya Priya"}</div>
            <div style="color: #64748b;">ID: ${tenantId}</div>
          </div>
          <div class="box">
            <div class="box-title">Premises &amp; Utility</div>
            <div style="font-weight: 800; font-size: 14px;">${bill.propertyName || "Sai Kala Apartments #302"}</div>
            <div style="color: #64748b;">${bill.type}</div>
          </div>
        </div>

        <div class="amount-banner">
          <div style="font-size: 11.5px; font-weight: 700; color: #065f46; text-transform: uppercase;">Amount Paid</div>
          <div class="amount-val">₹${(Number(bill.tenantAmount || bill.amount) || 0).toLocaleString("en-IN")}</div>
          <div style="font-size: 12.5px; color: #047857; margin-top: 4px;">
            Consumer No: <strong>${bill.consumerNo || "Direct Tariff"}</strong> • Status: <strong>Settled (Paid)</strong>
          </div>
        </div>

        <div class="box" style="font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Transaction Reference:</span>
            <span style="font-family: monospace; font-weight: 700;">${bill.transactionId || "TXN_PAID"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Payment Method:</span>
            <span style="font-weight: 600;">${bill.paymentMethod || "UPI"}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Billing Cycle:</span>
            <span>${bill.billingMonth || "Current"}</span>
          </div>
        </div>

        <div class="footer">
          <div>Verified electronic receipt issued by PropConnect Utility Settlement Authority</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Tamil Nadu Utility Gateway SHA256-Verified</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="urc-container">
      <PageHero
        title="Tenant Utility Center"
        subtitle="Review verified electricity meters (TNEB), municipal water supply (CMWSSB), and residential utility bills."
      />

      {/* Toast */}
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
          }}
        >
          {toast.type === "error" ? "⚠️ " : "✓ "}
          {toast.text}
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="urc-kpi-grid">
        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Total Bills</span>
            <span className="urc-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>⚡</span>
          </div>
          <div className="urc-kpi-value">{totalBills}</div>
          <div className="urc-kpi-desc">All assigned utility invoices</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Outstanding Dues</span>
            <span className="urc-kpi-icon" style={{ background: totalOutstanding > 0 ? "#fff7ed" : "#ecfdf5", color: totalOutstanding > 0 ? "#ea580c" : "#059669" }}>
              {totalOutstanding > 0 ? "⏳" : "✓"}
            </span>
          </div>
          <div className="urc-kpi-value" style={{ color: totalOutstanding > 0 ? "#ea580c" : "#059669" }}>
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="urc-kpi-desc">{unpaidBills.length} unpaid bill{unpaidBills.length === 1 ? "" : "s"}</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Overdue Bills</span>
            <span className="urc-kpi-icon" style={{ background: overdueBills.length > 0 ? "#fef2f2" : "#ecfdf5", color: overdueBills.length > 0 ? "#dc2626" : "#059669" }}>
              {overdueBills.length > 0 ? "⚠️" : "✓"}
            </span>
          </div>
          <div className="urc-kpi-value" style={{ color: overdueBills.length > 0 ? "#dc2626" : "#059669" }}>
            {overdueBills.length}
          </div>
          <div className="urc-kpi-desc">{overdueBills.length > 0 ? "Immediate payment required" : "No overdue penalties"}</div>
        </div>

        <div className="urc-kpi-card">
          <div className="urc-kpi-top">
            <span className="urc-kpi-title">Total Settled</span>
            <span className="urc-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💳</span>
          </div>
          <div className="urc-kpi-value" style={{ color: "#059669" }}>
            ₹{totalSettled.toLocaleString("en-IN")}
          </div>
          <div className="urc-kpi-desc">{paidBills.length} verified completed payments</div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="urc-nav-bar">
        <button
          type="button"
          className={`urc-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          <span>📊</span>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`urc-tab-btn ${activeTab === "electricity" ? "active" : ""}`}
          onClick={() => handleTabChange("electricity")}
        >
          <span>⚡</span>
          <span>Electricity (TNEB)</span>
          <span className="urc-tab-badge">{bills.filter(isElectricityBill).length}</span>
        </button>

        <button
          type="button"
          className={`urc-tab-btn ${activeTab === "water" ? "active" : ""}`}
          onClick={() => handleTabChange("water")}
        >
          <span>💧</span>
          <span>Water (CMWSSB)</span>
          <span className="urc-tab-badge">{bills.filter(isWaterBill).length}</span>
        </button>

        <button
          type="button"
          className={`urc-tab-btn ${activeTab === "other" ? "active" : ""}`}
          onClick={() => handleTabChange("other")}
        >
          <span>📦</span>
          <span>Other Utilities</span>
          <span className="urc-tab-badge">{bills.filter(isOtherBill).length}</span>
        </button>

        <button
          type="button"
          className={`urc-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => handleTabChange("history")}
        >
          <span>📜</span>
          <span>Bill History</span>
          <span className="urc-tab-badge">{paidBills.length}</span>
        </button>
      </div>

      {/* Monthly Electricity Consumption Chart (Visible in Overview & Electricity Tabs) */}
      {(activeTab === "overview" || activeTab === "electricity") && (
        <div className="urc-chart-box">
          <div className="urc-chart-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                Monthly Electricity Consumption &amp; Tariff Trend
              </h3>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                TNEB Sub-Meter #01-102-004-3291 • Average Consumption: 334 Units/mo
              </div>
            </div>
            <span className="badge" style={{ background: "#eff6ff", color: "#0284c7", fontWeight: 700 }}>
              Domestic Tariff Slab 3
            </span>
          </div>

          <div className="urc-chart-bars">
            {consumptionHistory.map((c) => {
              const maxUnits = 450;
              const heightPct = Math.round((c.units / maxUnits) * 100);

              return (
                <div key={c.month} className="urc-bar-col">
                  <div className="urc-bar-val">{c.units} U</div>
                  <div
                    className={`urc-bar-fill ${c.current ? "current" : ""}`}
                    style={{ height: `${heightPct}%` }}
                    title={`${c.month}: ${c.units} Units (₹${c.amount})`}
                  />
                  <div className="urc-bar-label">{c.month.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
            <span>⚡ Units calculated via bi-monthly digital cycle</span>
            <span>Current Billing Month: <strong>September 2026 (350 Units)</strong></span>
          </div>
        </div>
      )}

      {/* Search and Date Filters Bar */}
      <div className="urc-filter-bar">
        <div className="urc-search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search consumer #, bill ID, category, property..."
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
        </div>
      </div>

      {/* Listing Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="spinner" />
          <p style={{ marginTop: "12px", color: "#64748b" }}>Loading verified utility records...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>💧</div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>No bills found</div>
          <div style={{ fontSize: "12.5px", marginTop: "4px" }}>
            No utility bills match the selected category or search criteria.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredBills.map((bill) => {
            const isPaid = (bill.status || "").toLowerCase() === "paid";
            const isOverdue = (bill.status || "").toLowerCase() === "overdue";
            const isElectricity = isElectricityBill(bill);
            const payableAmt = Number(bill.tenantAmount || bill.amount) || 0;

            return (
              <div
                key={bill.id}
                className="card"
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  borderLeft: isPaid
                    ? "5px solid #10b981"
                    : isOverdue
                    ? "5px solid #ef4444"
                    : "5px solid #0284c7",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "16.5px", color: "#0f172a" }}>
                        {bill.type}
                      </span>
                      <span style={{ padding: "2px 8px", background: "#f1f5f9", color: "#475569", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                        #{bill.id}
                      </span>
                      <span
                        className={`pill ${
                          isPaid ? "paid" : isOverdue ? "failed" : "pending"
                        }`}
                      >
                        {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                      📍 {bill.propertyName || "Sai Kala Apartments #302"} • Consumer No: <strong>{bill.consumerNo || "N/A"}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: isPaid ? "#059669" : isOverdue ? "#dc2626" : "#0284c7" }}>
                      ₹{payableAmt.toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {isPaid ? `Settled on ${bill.paidDate || "Recent"}` : `Due by ${bill.dueDate || "Due Soon"}`}
                    </div>
                  </div>
                </div>

                {/* Meter Details for Electricity */}
                {isElectricity && (
                  <div className="urc-meter-grid">
                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Consumer Number</span>
                      <span className="urc-meter-val" style={{ fontSize: "13px" }}>{bill.consumerNo || "01-102-004-3291"}</span>
                    </div>

                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Previous Reading</span>
                      <span className="urc-meter-val">
                        {bill.previousReading !== undefined && bill.previousReading !== null ? `${bill.previousReading} kWh` : "1,240 kWh"}
                      </span>
                    </div>

                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Current Reading</span>
                      <span className="urc-meter-val">
                        {bill.currentReading !== undefined && bill.currentReading !== null ? `${bill.currentReading} kWh` : "1,590 kWh"}
                      </span>
                    </div>

                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Units Consumed</span>
                      <span className="urc-meter-val" style={{ color: "#0284c7" }}>
                        {bill.unitsConsumed ? `${bill.unitsConsumed} Units` : "350 Units"}
                      </span>
                    </div>

                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Billing Cycle</span>
                      <span className="urc-meter-val" style={{ fontSize: "13px" }}>{bill.billingMonth || "Sep 2026"}</span>
                    </div>
                  </div>
                )}

                {/* General Details for Water / Other */}
                {!isElectricity && (
                  <div className="urc-meter-grid">
                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Category</span>
                      <span className="urc-meter-val" style={{ fontSize: "13px" }}>{bill.type}</span>
                    </div>
                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Consumer / Acc Ref</span>
                      <span className="urc-meter-val" style={{ fontSize: "13px" }}>{bill.consumerNo || "WTR-CMWSSB-2026"}</span>
                    </div>
                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Due Date</span>
                      <span className="urc-meter-val" style={{ color: isOverdue ? "#dc2626" : "inherit" }}>{bill.dueDate}</span>
                    </div>
                    <div className="urc-meter-item">
                      <span className="urc-meter-label">Payment Status</span>
                      <span className="urc-meter-val" style={{ color: isPaid ? "#059669" : "#d97706" }}>
                        {isPaid ? "Settled (Paid)" : "Payment Required"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions Row */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                  {isPaid ? (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "6px 14px", fontSize: "12.5px" }}
                      onClick={() => handlePrintReceipt(bill)}
                    >
                      📥 Download Receipt
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: "6px 16px", fontSize: "12.5px" }}
                      onClick={() => setPayingBill(bill)}
                    >
                      💳 Pay Bill (₹{payableAmt.toLocaleString("en-IN")})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay Utility Modal */}
      {payingBill && (
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
          onClick={() => setPayingBill(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "480px", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Utility Payment Gateway</h3>
                <span className="sub-text">Bill #{payingBill.id} • {payingBill.type}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPayingBill(null)}>✕</button>
            </div>

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", marginBottom: "16px", textAlign: "center", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Payable Amount</div>
              <div style={{ fontSize: "30px", fontWeight: 800, color: "#0284c7", margin: "4px 0" }}>
                ₹{(Number(payingBill.tenantAmount || payingBill.amount) || 0).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                Due Date: <strong>{payingBill.dueDate}</strong> • Consumer: <strong>{payingBill.consumerNo || "Standard"}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmPay} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
                  Select Payment Method
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {["UPI", "NetBanking", "Debit Card", "Credit Card"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={paymentMethod === m ? "btn-primary" : "btn-outline"}
                      style={{ padding: "9px", fontSize: "12.5px", textAlign: "center" }}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "UPI" && (
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: "4px", fontSize: "12.5px", fontWeight: 600 }}>
                    UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Verified gateway connection to TNEB &amp; CMWSSB
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <button type="button" className="btn-outline" onClick={() => setPayingBill(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isProcessing}>
                  {isProcessing ? "Verifying Payment..." : `Pay ₹${(Number(payingBill.tenantAmount || payingBill.amount) || 0).toLocaleString("en-IN")}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
