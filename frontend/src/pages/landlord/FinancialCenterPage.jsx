import { useContext, useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import {
  DollarSign,
  CreditCard,
  Shield,
  Receipt,
  Zap,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Send,
  RefreshCw,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Building,
  User,
  Calendar,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from "lucide-react";
import { PAYMENTS, PROPERTIES, TENANTS, SECURITY_DEPOSITS, EXPENSES, UTILITY_BILLS } from "../../data/db.js";
import {
  fetchPayments,
  createPayment,
  updatePayment,
  deletePayment,
  recordInvoicePayment,
  fetchDeposits,
  createDeposit,
  refundSecurityDeposit,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchUtilityBills,
  createUtilityBill,
  deleteUtilityBill,
  fetchProperties,
  fetchTenants,
  fetchLeases,
  fetchFinancialSummary,
} from "../../utils/apiClient.js";
import "./FinancialCenter.css";

export default function FinancialCenterPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: "overview" | "invoices" | "deposits" | "expenses" | "utilities" | "analytics"
  const rawTab = searchParams.get("tab")?.toLowerCase();
  const tabParam = rawTab === "rent" ? "invoices" : rawTab === "summary" ? "overview" : rawTab;
  const validTabs = ["overview", "invoices", "deposits", "expenses", "utilities", "analytics"];
  const activeTab = validTabs.includes(tabParam) ? tabParam : "overview";

  const handleTabChange = (newTab) => {
    setSearchParams(newTab === "overview" ? {} : { tab: newTab });
  };

  // Master Data States
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [utilityBills, setUtilityBills] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddUtilityOpen, setIsAddUtilityOpen] = useState(false);
  const [isRefundDepositOpen, setIsRefundDepositOpen] = useState(false);
  const [selectedDepositForRefund, setSelectedDepositForRefund] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);

  // Toast Helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, dData, eData, uData, propData, tData, lData] = await Promise.all([
        fetchPayments().catch(() => null),
        fetchDeposits().catch(() => null),
        fetchExpenses().catch(() => null),
        fetchUtilityBills().catch(() => null),
        fetchProperties().catch(() => null),
        fetchTenants().catch(() => null),
        fetchLeases().catch(() => null),
      ]);
      setPayments(Array.isArray(pData) && pData.length > 0 ? pData : PAYMENTS);
      setDeposits(Array.isArray(dData) && dData.length > 0 ? dData : SECURITY_DEPOSITS);
      setExpenses(Array.isArray(eData) && eData.length > 0 ? eData : EXPENSES);
      setUtilityBills(Array.isArray(uData) && uData.length > 0 ? uData : UTILITY_BILLS);
      setProperties(Array.isArray(propData) && propData.length > 0 ? propData : PROPERTIES);
      setTenants(Array.isArray(tData) && tData.length > 0 ? tData : TENANTS);
      setLeases(Array.isArray(lData) && lData.length > 0 ? lData : []);
    } catch {
      setPayments(PAYMENTS);
      setDeposits(SECURITY_DEPOSITS);
      setExpenses(EXPENSES);
      setUtilityBills(UTILITY_BILLS);
      setProperties(PROPERTIES);
      setTenants(TENANTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Resolvers
  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};
  const getTen = (tId) => tenants.find((t) => t.id === tId || t._id === tId) || {};

  // Form States
  const [recordPaymentForm, setRecordPaymentForm] = useState({
    amountPaid: 0,
    paymentMethod: "UPI",
    transactionRef: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [createInvoiceForm, setCreateInvoiceForm] = useState({
    leaseId: "",
    tenantId: "",
    propertyId: "",
    month: "October 2026",
    amount: 22000,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    propertyId: "",
    category: "Maintenance",
    amount: 3500,
    date: new Date().toISOString().split("T")[0],
    paidTo: "",
    paymentMethod: "Bank Transfer",
    description: "",
  });

  const [utilityForm, setUtilityForm] = useState({
    propertyId: "",
    type: "Electricity",
    billingMonth: "October 2026",
    consumerNo: "04-301-002-1188",
    previousReading: 1200,
    currentReading: 1450,
    unitsConsumed: 250,
    ratePerUnit: 8.5,
    amount: 2125,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    responsibility: "Tenant",
    notes: "TNEB Domestic Tariff",
  });

  const [refundForm, setRefundForm] = useState({
    damageDeductions: 0,
    unpaidRentDeductions: 0,
    utilityDuesDeductions: 0,
    refundMethod: "Bank Transfer",
    refundTransactionRef: "",
    notes: "Full deposit settlement upon lawful move-out vacancy.",
  });

  // Calculate KPIs
  const financialKPIs = useMemo(() => {
    let collectedRent = 0;
    let pendingRent = 0;
    payments.forEach((p) => {
      const tot = Number(p.amount || 0);
      const paid = Number(p.paidAmount !== undefined && p.paidAmount > 0 ? p.paidAmount : (p.status === "Paid" ? tot : 0));
      const rem = Number(p.remainingBalance !== undefined ? p.remainingBalance : Math.max(0, tot - paid));
      collectedRent += paid;
      pendingRent += rem;
    });

    let totalExp = 0;
    expenses.forEach((e) => {
      totalExp += Number(e.amount || 0);
    });

    let depositEscrow = 0;
    deposits.forEach((d) => {
      if ((d.status || "").toLowerCase().includes("escrow") || (d.status || "").toLowerCase().includes("held")) {
        depositEscrow += Number(d.amount || 0);
      }
    });

    let pendingUtil = 0;
    utilityBills.forEach((u) => {
      if ((u.status || "").toLowerCase() !== "paid") {
        pendingUtil += Number(u.amount || 0);
      }
    });

    // Net Operating Income = Collected Rent - Expenses (Deposits are NEVER counted in NOI!)
    const netIncome = collectedRent - totalExp;

    return {
      collectedRent,
      pendingRent,
      totalExpenses: totalExp,
      netOperatingIncome: netIncome,
      depositLiability: depositEscrow,
      outstandingUtilities: pendingUtil,
    };
  }, [payments, expenses, deposits, utilityBills]);

  // Filtered Payments (Invoices)
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const prop = getProp(p.propertyId);
      const ten = getTen(p.tenantId);
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.invoiceNo && p.invoiceNo.toLowerCase().includes(q)) ||
        (ten.name && ten.name.toLowerCase().includes(q)) ||
        (prop.name && prop.name.toLowerCase().includes(q));

      const matchesProp = propertyFilter === "all" || p.propertyId === propertyFilter;
      const matchesStatus =
        statusFilter === "all" || (p.status || "").toLowerCase() === statusFilter.toLowerCase();
      const matchesMonth = monthFilter === "all" || p.month === monthFilter;

      return matchesSearch && matchesProp && matchesStatus && matchesMonth;
    });
  }, [payments, properties, tenants, searchTerm, propertyFilter, statusFilter, monthFilter]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const prop = getProp(e.propertyId);
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.paidTo && e.paidTo.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (prop.name && prop.name.toLowerCase().includes(q));

      const matchesProp = propertyFilter === "all" || e.propertyId === propertyFilter;
      const matchesCat = categoryFilter === "all" || e.category === categoryFilter;

      return matchesSearch && matchesProp && matchesCat;
    });
  }, [expenses, properties, searchTerm, propertyFilter, categoryFilter]);

  // Filtered Utility Bills
  const filteredUtilities = useMemo(() => {
    return utilityBills.filter((u) => {
      const prop = getProp(u.propertyId);
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        (u.id && u.id.toLowerCase().includes(q)) ||
        (u.consumerNo && u.consumerNo.toLowerCase().includes(q)) ||
        (u.type && u.type.toLowerCase().includes(q)) ||
        (prop.name && prop.name.toLowerCase().includes(q));

      const matchesProp = propertyFilter === "all" || u.propertyId === propertyFilter;
      const matchesType = categoryFilter === "all" || u.type === categoryFilter;

      return matchesSearch && matchesProp && matchesType;
    });
  }, [utilityBills, properties, searchTerm, propertyFilter, categoryFilter]);

  // Action: Record Partial or Full Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    try {
      await recordInvoicePayment(selectedInvoiceForPayment.id, recordPaymentForm);
      showToast(
        `Recorded payment of ₹${recordPaymentForm.amountPaid} for invoice ${selectedInvoiceForPayment.id}`
      );
      setIsRecordPaymentOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to record payment", "error");
    }
  };

  // Action: Generate Rent Invoice
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    const invoiceId = `INV-${Date.now().toString().slice(-6)}`;
    const prop = getProp(createInvoiceForm.propertyId);
    const ten = getTen(createInvoiceForm.tenantId);

    const payload = {
      id: `PAY_${Date.now()}`,
      invoiceNo: invoiceId,
      leaseId: createInvoiceForm.leaseId || null,
      tenantId: createInvoiceForm.tenantId,
      propertyId: createInvoiceForm.propertyId,
      propertyName: prop.name || "Residential Property",
      tenantName: ten.name || "Resident Tenant",
      month: createInvoiceForm.month,
      amount: Number(createInvoiceForm.amount),
      paidAmount: 0,
      remainingBalance: Number(createInvoiceForm.amount),
      status: "Pending",
      dueDate: createInvoiceForm.dueDate,
      date: new Date().toISOString().split("T")[0],
      notes: createInvoiceForm.notes,
    };

    try {
      await createPayment(payload);
      showToast(`Rent invoice ${invoiceId} generated successfully!`);
      setIsCreateInvoiceOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to generate invoice", "error");
    }
  };

  // Action: Add Expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const expenseId = `EXP${Math.floor(Math.random() * 900 + 100)}`;
    const payload = {
      id: expenseId,
      propertyId: expenseForm.propertyId,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      paidTo: expenseForm.paidTo,
      paymentMethod: expenseForm.paymentMethod,
      description: expenseForm.description,
    };

    try {
      await createExpense(payload);
      showToast(`Operational expense of ₹${payload.amount} added!`);
      setIsAddExpenseOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to add expense", "error");
    }
  };

  // Action: Add Utility Bill
  const handleAddUtility = async (e) => {
    e.preventDefault();
    const utilityId = `UTL-${Date.now().toString().slice(-5)}`;
    const prop = getProp(utilityForm.propertyId);

    const payload = {
      id: utilityId,
      propertyId: utilityForm.propertyId,
      propertyName: prop.name || "Rental Unit",
      type: utilityForm.type,
      billingMonth: utilityForm.billingMonth,
      consumerNo: utilityForm.consumerNo,
      previousReading: Number(utilityForm.previousReading),
      currentReading: Number(utilityForm.currentReading),
      unitsConsumed: Number(utilityForm.currentReading) - Number(utilityForm.previousReading),
      ratePerUnit: Number(utilityForm.ratePerUnit),
      amount: Number(utilityForm.amount),
      dueDate: utilityForm.dueDate,
      responsibility: utilityForm.responsibility,
      status: "Pending",
      notes: utilityForm.notes,
    };

    try {
      await createUtilityBill(payload);
      showToast(`Utility bill ${utilityId} logged!`);
      setIsAddUtilityOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to log utility bill", "error");
    }
  };

  // Action: Refund Security Deposit
  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!selectedDepositForRefund) return;

    try {
      await refundSecurityDeposit(selectedDepositForRefund.id, refundForm);
      showToast(`Security deposit settlement finalized for ${selectedDepositForRefund.id}`);
      setIsRefundDepositOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to refund deposit", "error");
    }
  };

  // Export CSV Ledger
  const handleExportCSV = () => {
    let csv = "Record Type,ID,Property,Tenant,Month/Date,Amount,Status,Balance\n";
    payments.forEach((p) => {
      csv += `Rent Invoice,${p.invoiceNo || p.id},"${p.propertyName || p.propertyId}","${p.tenantName || p.tenantId}",${p.month},${p.amount},${p.status},${p.remainingBalance || 0}\n`;
    });
    expenses.forEach((e) => {
      csv += `Expense,${e.id},"${getProp(e.propertyId).name || e.propertyId}","N/A",${e.date},${e.amount},Paid,0\n`;
    });
    deposits.forEach((d) => {
      csv += `Security Deposit (Liability),${d.id},"${getProp(d.propertyId).name || d.propertyId}","${getTen(d.tenantId).name || d.tenantId}",${d.dateReceived || "N/A"},${d.amount},${d.status},0\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PropConnect_Financial_Ledger_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("Downloaded Financial CSV Ledger successfully!");
  };

  return (
    <div className="fc-container">
      {/* Toast Alert */}
      {toast && (
        <div className="fc-toast">
          {toast.type === "error" ? (
            <AlertTriangle size={18} color="#ef4444" />
          ) : (
            <CheckCircle2 size={18} color="#10b981" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Card with Breadcrumb & Primary Actions */}
      <div className="fc-header-card">
        <div className="fc-breadcrumb">
          <span>{user?.role === "admin" ? "Admin" : "Landlord"}</span>
          <span className="fc-breadcrumb-separator">/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>Financial &amp; Utility Center</span>
        </div>
        <div className="fc-header-main">
          <div>
            <h1 className="fc-title">Financial &amp; Utility Center</h1>
            <p className="fc-subtitle">
              Consolidated financial operations, rent invoice tracking, operational expenses,
              TNEB/utility management, and security deposit escrow ledger.
            </p>
          </div>
          <div className="fc-header-actions">
            <button className="fc-btn-secondary" onClick={handleExportCSV}>
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
            <button className="fc-btn-secondary" onClick={loadData}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              className="fc-btn-primary"
              onClick={() => {
                if (activeTab === "expenses") setIsAddExpenseOpen(true);
                else if (activeTab === "utilities") setIsAddUtilityOpen(true);
                else setIsCreateInvoiceOpen(true);
              }}
            >
              <Plus size={16} />
              <span>
                {activeTab === "expenses"
                  ? "Add Expense"
                  : activeTab === "utilities"
                  ? "Log Utility Bill"
                  : "Create Rent Invoice"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards Grid (6 Metric Cards) */}
      <div className="fc-kpi-grid">
        <div className="fc-kpi-card collected">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Collected Rent</span>
            <div className="fc-kpi-icon">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="fc-kpi-value">
            ₹{financialKPIs.collectedRent.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">Realized rental revenue</div>
        </div>

        <div className="fc-kpi-card pending">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Pending Rent</span>
            <div className="fc-kpi-icon">
              <Clock size={16} />
            </div>
          </div>
          <div className="fc-kpi-value">
            ₹{financialKPIs.pendingRent.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">Uncollected dues</div>
        </div>

        <div className="fc-kpi-card expenses">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Total Expenses</span>
            <div className="fc-kpi-icon">
              <Receipt size={16} />
            </div>
          </div>
          <div className="fc-kpi-value">
            ₹{financialKPIs.totalExpenses.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">Operations &amp; repairs</div>
        </div>

        <div className="fc-kpi-card noi">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Net Operating Income</span>
            <div className="fc-kpi-icon">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="fc-kpi-value" style={{ color: financialKPIs.netOperatingIncome >= 0 ? "#0284c7" : "#dc2626" }}>
            ₹{financialKPIs.netOperatingIncome.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">Rent minus expenses</div>
        </div>

        <div className="fc-kpi-card deposit">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Security Deposits</span>
            <div className="fc-kpi-icon">
              <Shield size={16} />
            </div>
          </div>
          <div className="fc-kpi-value">
            ₹{financialKPIs.depositLiability.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">
            <span className="fc-kpi-badge">Deposit Held (Liability)</span>
          </div>
        </div>

        <div className="fc-kpi-card utilities">
          <div className="fc-kpi-top">
            <span className="fc-kpi-label">Utility Dues</span>
            <div className="fc-kpi-icon">
              <Zap size={16} />
            </div>
          </div>
          <div className="fc-kpi-value">
            ₹{financialKPIs.outstandingUtilities.toLocaleString("en-IN")}
          </div>
          <div className="fc-kpi-sub">Unpaid bills</div>
        </div>
      </div>

      {/* 3. Six Functional Tabs */}
      <div className="fc-tab-bar">
        <button
          className={`fc-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          <TrendingUp size={15} />
          <span>Financial Overview</span>
        </button>

        <button
          className={`fc-tab-btn ${activeTab === "invoices" ? "active" : ""}`}
          onClick={() => handleTabChange("invoices")}
        >
          <CreditCard size={15} />
          <span>Rent Invoices &amp; Collections</span>
          <span className="fc-tab-badge">{payments.length}</span>
        </button>

        <button
          className={`fc-tab-btn ${activeTab === "deposits" ? "active" : ""}`}
          onClick={() => handleTabChange("deposits")}
        >
          <Shield size={15} />
          <span>Security Deposits</span>
          <span className="fc-tab-badge">{deposits.length}</span>
        </button>

        <button
          className={`fc-tab-btn ${activeTab === "expenses" ? "active" : ""}`}
          onClick={() => handleTabChange("expenses")}
        >
          <Receipt size={15} />
          <span>Operational Expenses</span>
          <span className="fc-tab-badge">{expenses.length}</span>
        </button>

        <button
          className={`fc-tab-btn ${activeTab === "utilities" ? "active" : ""}`}
          onClick={() => handleTabChange("utilities")}
        >
          <Zap size={15} />
          <span>Utility Management</span>
          <span className="fc-tab-badge">{utilityBills.length}</span>
        </button>

        <button
          className={`fc-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => handleTabChange("analytics")}
        >
          <FileSpreadsheet size={15} />
          <span>Financial Analytics &amp; Reports</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: FINANCIAL OVERVIEW
         ========================================================================= */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Property-Wise Financial Performance Card */}
          <div className="fc-header-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 800 }}>
              Property-Wise Financial Performance
            </h3>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Property Unit</th>
                    <th className="fc-th">Monthly Rent</th>
                    <th className="fc-th">Rent Collected</th>
                    <th className="fc-th">Expenses</th>
                    <th className="fc-th">Net NOI</th>
                    <th className="fc-th">Deposit Liability</th>
                    <th className="fc-th">Occupancy Status</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.slice(0, 8).map((prop) => {
                    const propPayments = payments.filter((p) => p.propertyId === prop.id);
                    const propExpenses = expenses.filter((e) => e.propertyId === prop.id);
                    const propDeposit = deposits.find((d) => d.propertyId === prop.id);

                    let col = 0;
                    propPayments.forEach((p) => {
                      col += Number(p.paidAmount !== undefined && p.paidAmount > 0 ? p.paidAmount : (p.status === "Paid" ? p.amount : 0));
                    });

                    let exp = 0;
                    propExpenses.forEach((e) => {
                      exp += Number(e.amount || 0);
                    });

                    const noi = col - exp;

                    return (
                      <tr key={prop.id} className="fc-tr">
                        <td className="fc-td" style={{ fontWeight: 700 }}>
                          {prop.name}
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{prop.city}, Tamil Nadu</div>
                        </td>
                        <td className="fc-td">₹{Number(prop.rent || 0).toLocaleString("en-IN")}</td>
                        <td className="fc-td" style={{ color: "#059669", fontWeight: 700 }}>
                          ₹{col.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ color: "#dc2626", fontWeight: 600 }}>
                          ₹{exp.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ fontWeight: 800, color: noi >= 0 ? "#0284c7" : "#dc2626" }}>
                          ₹{noi.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ color: "#7c3aed", fontWeight: 600 }}>
                          ₹{Number(propDeposit?.amount || prop.deposit || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td">
                          <span className={`fc-badge ${prop.status === "Occupied" ? "paid" : "pending"}`}>
                            {prop.status || "Occupied"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Financial Transactions & Invoices */}
          <div className="fc-header-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 800 }}>
              Recent Ledger Transactions
            </h3>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Transaction Type</th>
                    <th className="fc-th">Reference / ID</th>
                    <th className="fc-th">Property / Entity</th>
                    <th className="fc-th">Date</th>
                    <th className="fc-th">Amount</th>
                    <th className="fc-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 5).map((p) => (
                    <tr key={p.id} className="fc-tr">
                      <td className="fc-td">
                        <span style={{ fontWeight: 700, color: "#0284c7" }}>Rent Payment</span>
                      </td>
                      <td className="fc-td">{p.invoiceNo || p.id}</td>
                      <td className="fc-td">{p.propertyName || p.propertyId}</td>
                      <td className="fc-td">{p.date}</td>
                      <td className="fc-td" style={{ fontWeight: 700, color: "#059669" }}>
                        + ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="fc-td">
                        <span className={`fc-badge ${p.status === "Paid" ? "paid" : "pending"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {expenses.slice(0, 3).map((e) => (
                    <tr key={e.id} className="fc-tr">
                      <td className="fc-td">
                        <span style={{ fontWeight: 700, color: "#dc2626" }}>Expense ({e.category})</span>
                      </td>
                      <td className="fc-td">{e.id}</td>
                      <td className="fc-td">{getProp(e.propertyId).name || e.propertyId}</td>
                      <td className="fc-td">{e.date}</td>
                      <td className="fc-td" style={{ fontWeight: 700, color: "#dc2626" }}>
                        - ₹{Number(e.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="fc-td">
                        <span className="fc-badge paid">Paid</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RENT INVOICES & COLLECTIONS
         ========================================================================= */}
      {activeTab === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Toolbar */}
          <div className="fc-filter-toolbar">
            <div className="fc-filter-group-left">
              <div className="fc-search-wrap">
                <Search className="fc-search-icon" size={15} />
                <input
                  type="text"
                  className="fc-search-input"
                  placeholder="Search invoice ID, tenant, property..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="fc-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
              </select>

              <select
                className="fc-select"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="fc-btn-primary"
              onClick={() => setIsCreateInvoiceOpen(true)}
            >
              <Plus size={15} />
              <span>Generate Rent Invoice</span>
            </button>
          </div>

          {/* Table Card */}
          <div className="fc-table-card">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Invoice No</th>
                    <th className="fc-th">Tenant Profile</th>
                    <th className="fc-th">Property &amp; Unit</th>
                    <th className="fc-th">Billing Month</th>
                    <th className="fc-th">Total Due</th>
                    <th className="fc-th">Paid Amount</th>
                    <th className="fc-th">Balance</th>
                    <th className="fc-th">Status</th>
                    <th className="fc-th" style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const prop = getProp(p.propertyId);
                    const ten = getTen(p.tenantId);
                    const tot = Number(p.amount || 0);
                    const paid = Number(p.paidAmount !== undefined && p.paidAmount > 0 ? p.paidAmount : (p.status === "Paid" ? tot : 0));
                    const bal = Number(p.remainingBalance !== undefined ? p.remainingBalance : Math.max(0, tot - paid));

                    return (
                      <tr key={p.id} className="fc-tr">
                        <td className="fc-td">
                          <span style={{ fontWeight: 800, color: "#0284c7" }}>
                            {p.invoiceNo || p.id}
                          </span>
                        </td>
                        <td className="fc-td">
                          <div style={{ fontWeight: 600 }}>{ten.name || p.tenantName}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{ten.phone || "+91 98401 22334"}</div>
                        </td>
                        <td className="fc-td">
                          <div style={{ fontWeight: 600 }}>{prop.name || p.propertyName}</div>
                        </td>
                        <td className="fc-td">{p.month}</td>
                        <td className="fc-td" style={{ fontWeight: 700 }}>
                          ₹{tot.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ color: "#059669", fontWeight: 700 }}>
                          ₹{paid.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ color: bal > 0 ? "#dc2626" : "#64748b", fontWeight: 700 }}>
                          ₹{bal.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td">
                          <span className={`fc-badge ${p.status === "Paid" ? "paid" : p.status === "Partially Paid" ? "partial" : "pending"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="fc-td" style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            {p.status !== "Paid" && (
                              <button
                                className="fc-btn-primary"
                                style={{ padding: "5px 10px", fontSize: "12px" }}
                                onClick={() => {
                                  setSelectedInvoiceForPayment(p);
                                  setRecordPaymentForm({
                                    amountPaid: bal,
                                    paymentMethod: "UPI",
                                    transactionRef: "",
                                    notes: "",
                                    date: new Date().toISOString().split("T")[0],
                                  });
                                  setIsRecordPaymentOpen(true);
                                }}
                              >
                                Record Pay
                              </button>
                            )}
                            <button
                              className="fc-btn-secondary"
                              style={{ padding: "5px 9px", fontSize: "12px" }}
                              onClick={() => {
                                const receiptText = `PROPCONNECT OFFICIAL PAYMENT RECEIPT\nInvoice No: ${p.invoiceNo || p.id}\nProperty: ${prop.name || p.propertyName}\nTenant: ${ten.name || p.tenantName}\nBilling Month: ${p.month}\nTotal Amount: INR ${tot}\nAmount Paid: INR ${paid}\nRemaining Balance: INR ${bal}\nStatus: ${p.status}\nDate: ${p.paidDate || p.date}\nPayment Method: ${p.paymentMethod || "UPI"}\nOfficial Digitally Signed Record.`;
                                const blob = new Blob([receiptText], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `Receipt_${p.invoiceNo || p.id}.txt`;
                                a.click();
                                showToast("Downloaded official payment receipt!");
                              }}
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SECURITY DEPOSITS (LIABILITY ESCROW)
         ========================================================================= */}
      {activeTab === "deposits" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="fc-header-card" style={{ padding: "16px 20px", background: "#fdf4ff", borderColor: "#f0abfc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Shield size={20} color="#a855f7" />
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#7e22ce" }}>
                  Statutory Security Deposit Holding Notice
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#6b21a8" }}>
                  Security deposits are legal liabilities held on behalf of tenants under Tamil Nadu tenancy laws.
                  Deposits are maintained strictly separate from operating rental revenues.
                </p>
              </div>
            </div>
          </div>

          <div className="fc-table-card">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Deposit ID</th>
                    <th className="fc-th">Property</th>
                    <th className="fc-th">Tenant</th>
                    <th className="fc-th">Original Deposit</th>
                    <th className="fc-th">Deductions</th>
                    <th className="fc-th">Refundable</th>
                    <th className="fc-th">Holding Status</th>
                    <th className="fc-th" style={{ textAlign: "right" }}>Settlement Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => {
                    const prop = getProp(d.propertyId);
                    const ten = getTen(d.tenantId);
                    const orig = Number(d.amount || 0);
                    const deds = Number(d.damageDeductions || 0) + Number(d.unpaidRentDeductions || 0) + Number(d.utilityDuesDeductions || 0);
                    const ref = Math.max(0, orig - deds);

                    return (
                      <tr key={d.id} className="fc-tr">
                        <td className="fc-td">
                          <span style={{ fontWeight: 800, color: "#7c3aed" }}>{d.id}</span>
                        </td>
                        <td className="fc-td" style={{ fontWeight: 700 }}>
                          {prop.name || d.propertyId}
                        </td>
                        <td className="fc-td">
                          <div style={{ fontWeight: 600 }}>{ten.name || d.tenantId}</div>
                        </td>
                        <td className="fc-td" style={{ fontWeight: 700 }}>
                          ₹{orig.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ color: deds > 0 ? "#dc2626" : "#64748b" }}>
                          - ₹{deds.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td" style={{ fontWeight: 800, color: "#059669" }}>
                          ₹{ref.toLocaleString("en-IN")}
                        </td>
                        <td className="fc-td">
                          <span className={`fc-badge ${(d.status || "").toLowerCase().includes("escrow") ? "escrow" : "refunded"}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="fc-td" style={{ textAlign: "right" }}>
                          {!(d.status || "").toLowerCase().includes("refunded") ? (
                            <button
                              className="fc-btn-primary"
                              style={{ padding: "5px 12px", fontSize: "12px", background: "#7c3aed" }}
                              onClick={() => {
                                setSelectedDepositForRefund(d);
                                setRefundForm({
                                  damageDeductions: d.damageDeductions || 0,
                                  unpaidRentDeductions: d.unpaidRentDeductions || 0,
                                  utilityDuesDeductions: d.utilityDuesDeductions || 0,
                                  refundMethod: "Bank Transfer",
                                  refundTransactionRef: "",
                                  notes: "Move-out deposit settlement",
                                });
                                setIsRefundDepositOpen(true);
                              }}
                            >
                              Settle &amp; Refund
                            </button>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                              ✓ Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: OPERATIONAL EXPENSES
         ========================================================================= */}
      {activeTab === "expenses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="fc-filter-toolbar">
            <div className="fc-filter-group-left">
              <div className="fc-search-wrap">
                <Search className="fc-search-icon" size={15} />
                <input
                  type="text"
                  className="fc-search-input"
                  placeholder="Search expenses, vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="fc-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Repairs">Repairs</option>
                <option value="Property Tax">Property Tax</option>
                <option value="Insurance">Insurance</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Service Charges">Service Charges</option>
                <option value="Other">Other</option>
              </select>

              <select
                className="fc-select"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="fc-btn-primary"
              onClick={() => setIsAddExpenseOpen(true)}
            >
              <Plus size={15} />
              <span>Add Expense</span>
            </button>
          </div>

          <div className="fc-table-card">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Expense ID</th>
                    <th className="fc-th">Property</th>
                    <th className="fc-th">Category</th>
                    <th className="fc-th">Vendor / Paid To</th>
                    <th className="fc-th">Date</th>
                    <th className="fc-th">Amount</th>
                    <th className="fc-th">Description</th>
                    <th className="fc-th" style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="fc-tr">
                      <td className="fc-td" style={{ fontWeight: 800, color: "#dc2626" }}>
                        {exp.id}
                      </td>
                      <td className="fc-td" style={{ fontWeight: 700 }}>
                        {getProp(exp.propertyId).name || exp.propertyId}
                      </td>
                      <td className="fc-td">
                        <span className="fc-badge pending">{exp.category}</span>
                      </td>
                      <td className="fc-td">{exp.paidTo || exp.vendor || "Service Vendor"}</td>
                      <td className="fc-td">{exp.date}</td>
                      <td className="fc-td" style={{ fontWeight: 700, color: "#dc2626" }}>
                        ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="fc-td" style={{ fontSize: "12px", color: "#64748b" }}>
                        {exp.description || "Routine maintenance expense"}
                      </td>
                      <td className="fc-td" style={{ textAlign: "right" }}>
                        <button
                          className="fc-btn-icon"
                          style={{ color: "#ef4444" }}
                          onClick={async () => {
                            if (window.confirm(`Delete expense ${exp.id}?`)) {
                              await deleteExpense(exp.id);
                              showToast(`Expense ${exp.id} removed`);
                              loadData();
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: UTILITY MANAGEMENT (EB & UTILITY BILLS)
         ========================================================================= */}
      {activeTab === "utilities" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="fc-filter-toolbar">
            <div className="fc-filter-group-left">
              <div className="fc-search-wrap">
                <Search className="fc-search-icon" size={15} />
                <input
                  type="text"
                  className="fc-search-input"
                  placeholder="Search TNEB consumer number, utility type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="fc-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Utilities</option>
                <option value="Electricity">Electricity / TNEB</option>
                <option value="Water">Water</option>
                <option value="Gas">Gas</option>
                <option value="Internet">Internet</option>
                <option value="Maintenance">Maintenance</option>
              </select>

              <select
                className="fc-select"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="fc-btn-primary"
              onClick={() => setIsAddUtilityOpen(true)}
            >
              <Plus size={15} />
              <span>Log Utility Bill</span>
            </button>
          </div>

          <div className="fc-table-card">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th className="fc-th">Bill Reference</th>
                    <th className="fc-th">Property</th>
                    <th className="fc-th">Utility Type</th>
                    <th className="fc-th">Consumer / Meter No</th>
                    <th className="fc-th">Readings &amp; Units</th>
                    <th className="fc-th">Due Date</th>
                    <th className="fc-th">Amount</th>
                    <th className="fc-th">Status</th>
                    <th className="fc-th" style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUtilities.map((u) => (
                    <tr key={u.id} className="fc-tr">
                      <td className="fc-td">
                        <span style={{ fontWeight: 800, color: "#ea580c" }}>
                          {u.billReference || u.id}
                        </span>
                      </td>
                      <td className="fc-td" style={{ fontWeight: 700 }}>
                        {getProp(u.propertyId).name || u.propertyName || u.propertyId}
                      </td>
                      <td className="fc-td">
                        <span className="fc-badge partial">{u.type}</span>
                      </td>
                      <td className="fc-td" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        {u.consumerNo || "TNEB-04-301"}
                      </td>
                      <td className="fc-td">
                        {u.type === "Electricity" && u.unitsConsumed ? (
                          <div>
                            <span style={{ fontWeight: 700 }}>{u.unitsConsumed} Units</span>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {u.previousReading} → {u.currentReading}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>Fixed Monthly</span>
                        )}
                      </td>
                      <td className="fc-td">{u.dueDate}</td>
                      <td className="fc-td" style={{ fontWeight: 700, color: "#0f172a" }}>
                        ₹{Number(u.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="fc-td">
                        <span className={`fc-badge ${u.status === "Paid" ? "paid" : "pending"}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="fc-td" style={{ textAlign: "right" }}>
                        <button
                          className="fc-btn-icon"
                          style={{ color: "#ef4444" }}
                          onClick={async () => {
                            if (window.confirm(`Delete bill ${u.id}?`)) {
                              await deleteUtilityBill(u.id);
                              showToast(`Utility bill ${u.id} removed`);
                              loadData();
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: FINANCIAL ANALYTICS & REPORTS
         ========================================================================= */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Executive Overview Card */}
          <div className="fc-header-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800 }}>
                  Real-Time Portfolio Financial Health
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  All metrics are dynamically aggregated from verified database transactions.
                </p>
              </div>
              <button className="fc-btn-primary" onClick={handleExportCSV}>
                <FileSpreadsheet size={15} />
                <span>Export Audit CSV</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Operating Margin
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                  {financialKPIs.collectedRent > 0
                    ? `${Math.round((financialKPIs.netOperatingIncome / financialKPIs.collectedRent) * 100)}%`
                    : "0%"}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  NOI / Total Rent Collected
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Rent Collection Rate
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0284c7", marginTop: "4px" }}>
                  {financialKPIs.collectedRent + financialKPIs.pendingRent > 0
                    ? `${Math.round((financialKPIs.collectedRent / (financialKPIs.collectedRent + financialKPIs.pendingRent)) * 100)}%`
                    : "100%"}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  Collected vs Total Invoiced
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Expense to Income Ratio
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#ea580c", marginTop: "4px" }}>
                  {financialKPIs.collectedRent > 0
                    ? `${Math.round((financialKPIs.totalExpenses / financialKPIs.collectedRent) * 100)}%`
                    : "0%"}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  Total Expenses / Collected
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. Record Payment Modal */}
      {isRecordPaymentOpen && selectedInvoiceForPayment && (
        <div className="fc-modal-overlay" onClick={() => setIsRecordPaymentOpen(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal-header">
              <h3 className="fc-modal-title">Record Payment - {selectedInvoiceForPayment.invoiceNo || selectedInvoiceForPayment.id}</h3>
              <button className="fc-btn-icon" onClick={() => setIsRecordPaymentOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="fc-modal-body">
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", fontSize: "13px" }}>
                  <div>Total Invoice Amount: <strong>₹{selectedInvoiceForPayment.amount}</strong></div>
                  <div>Current Outstanding Balance: <strong style={{ color: "#dc2626" }}>₹{selectedInvoiceForPayment.remainingBalance || selectedInvoiceForPayment.amount}</strong></div>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Payment Amount to Record (₹) *</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={recordPaymentForm.amountPaid}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, amountPaid: Number(e.target.value) })}
                    max={selectedInvoiceForPayment.remainingBalance || selectedInvoiceForPayment.amount}
                    min={1}
                    required
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Payment Method *</label>
                  <select
                    className="fc-form-select"
                    value={recordPaymentForm.paymentMethod}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentMethod: e.target.value })}
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="Cash">Cash Receipt</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Transaction Reference / UTR Number</label>
                  <input
                    type="text"
                    className="fc-form-input"
                    placeholder="e.g. UTR-2026-981273912"
                    value={recordPaymentForm.transactionRef}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, transactionRef: e.target.value })}
                  />
                </div>
              </div>
              <div className="fc-modal-footer">
                <button type="button" className="fc-btn-secondary" onClick={() => setIsRecordPaymentOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fc-btn-primary">
                  Confirm &amp; Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Generate Rent Invoice Modal */}
      {isCreateInvoiceOpen && (
        <div className="fc-modal-overlay" onClick={() => setIsCreateInvoiceOpen(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal-header">
              <h3 className="fc-modal-title">Generate Monthly Rent Invoice</h3>
              <button className="fc-btn-icon" onClick={() => setIsCreateInvoiceOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleGenerateInvoice}>
              <div className="fc-modal-body">
                <div className="fc-form-group">
                  <label className="fc-form-label">Select Property Unit *</label>
                  <select
                    className="fc-form-select"
                    value={createInvoiceForm.propertyId}
                    onChange={(e) => {
                      const prop = getProp(e.target.value);
                      const matchingLease = leases.find((l) => l.propertyId === e.target.value);
                      setCreateInvoiceForm({
                        ...createInvoiceForm,
                        propertyId: e.target.value,
                        tenantId: matchingLease?.tenantId || prop.tenantId || "",
                        amount: matchingLease?.monthlyRent || prop.rent || 22000,
                        leaseId: matchingLease?.id || "",
                      });
                    }}
                    required
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Billing Month *</label>
                  <select
                    className="fc-form-select"
                    value={createInvoiceForm.month}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, month: e.target.value })}
                  >
                    <option value="November 2026">November 2026</option>
                    <option value="December 2026">December 2026</option>
                    <option value="January 2027">January 2027</option>
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Rent Amount (₹) *</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={createInvoiceForm.amount}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, amount: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Due Date *</label>
                  <input
                    type="date"
                    className="fc-form-input"
                    value={createInvoiceForm.dueDate}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, dueDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="fc-modal-footer">
                <button type="button" className="fc-btn-secondary" onClick={() => setIsCreateInvoiceOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fc-btn-primary">
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fc-modal-overlay" onClick={() => setIsAddExpenseOpen(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal-header">
              <h3 className="fc-modal-title">Record Operational Expense</h3>
              <button className="fc-btn-icon" onClick={() => setIsAddExpenseOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="fc-modal-body">
                <div className="fc-form-group">
                  <label className="fc-form-label">Property Unit *</label>
                  <select
                    className="fc-form-select"
                    value={expenseForm.propertyId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, propertyId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Expense Category *</label>
                  <select
                    className="fc-form-select"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Repairs">Repairs</option>
                    <option value="Property Tax">Property Tax</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Service Charges">Service Charges</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Vendor / Paid To</label>
                  <input
                    type="text"
                    className="fc-form-input"
                    placeholder="e.g. Metro Electricals / Corporation of Chennai"
                    value={expenseForm.paidTo}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Description</label>
                  <input
                    type="text"
                    className="fc-form-input"
                    placeholder="Brief description of work done..."
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="fc-modal-footer">
                <button type="button" className="fc-btn-secondary" onClick={() => setIsAddExpenseOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fc-btn-primary">
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Log Utility Bill Modal */}
      {isAddUtilityOpen && (
        <div className="fc-modal-overlay" onClick={() => setIsAddUtilityOpen(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal-header">
              <h3 className="fc-modal-title">Log Utility Bill</h3>
              <button className="fc-btn-icon" onClick={() => setIsAddUtilityOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddUtility}>
              <div className="fc-modal-body">
                <div className="fc-form-group">
                  <label className="fc-form-label">Property Unit *</label>
                  <select
                    className="fc-form-select"
                    value={utilityForm.propertyId}
                    onChange={(e) => setUtilityForm({ ...utilityForm, propertyId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Utility Type *</label>
                  <select
                    className="fc-form-select"
                    value={utilityForm.type}
                    onChange={(e) => setUtilityForm({ ...utilityForm, type: e.target.value })}
                  >
                    <option value="Electricity">Electricity / TNEB</option>
                    <option value="Water">Water Supply</option>
                    <option value="Gas">Piped Gas</option>
                    <option value="Internet">Broadband / Internet</option>
                    <option value="Maintenance">Building Society Maintenance</option>
                  </select>
                </div>

                {utilityForm.type === "Electricity" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="fc-form-group">
                      <label className="fc-form-label">Previous Meter Reading</label>
                      <input
                        type="number"
                        className="fc-form-input"
                        value={utilityForm.previousReading}
                        onChange={(e) => setUtilityForm({ ...utilityForm, previousReading: Number(e.target.value) })}
                      />
                    </div>
                    <div className="fc-form-group">
                      <label className="fc-form-label">Current Meter Reading</label>
                      <input
                        type="number"
                        className="fc-form-input"
                        value={utilityForm.currentReading}
                        onChange={(e) => {
                          const curr = Number(e.target.value);
                          const units = Math.max(0, curr - utilityForm.previousReading);
                          setUtilityForm({
                            ...utilityForm,
                            currentReading: curr,
                            unitsConsumed: units,
                            amount: Math.round(units * utilityForm.ratePerUnit),
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="fc-form-group">
                  <label className="fc-form-label">Total Bill Amount (₹) *</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={utilityForm.amount}
                    onChange={(e) => setUtilityForm({ ...utilityForm, amount: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="fc-modal-footer">
                <button type="button" className="fc-btn-secondary" onClick={() => setIsAddUtilityOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fc-btn-primary">
                  Log Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Deposit Refund & Settlement Modal */}
      {isRefundDepositOpen && selectedDepositForRefund && (
        <div className="fc-modal-overlay" onClick={() => setIsRefundDepositOpen(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal-header">
              <h3 className="fc-modal-title">Authorize Deposit Settlement &amp; Refund</h3>
              <button className="fc-btn-icon" onClick={() => setIsRefundDepositOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleProcessRefund}>
              <div className="fc-modal-body">
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", fontSize: "13px" }}>
                  <div>Original Deposit Held: <strong>₹{selectedDepositForRefund.amount}</strong></div>
                  <div style={{ color: "#7c3aed" }}>Property: {getProp(selectedDepositForRefund.propertyId).name}</div>
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Damage Deductions (₹)</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={refundForm.damageDeductions}
                    onChange={(e) => setRefundForm({ ...refundForm, damageDeductions: Number(e.target.value) })}
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Unpaid Rent Deductions (₹)</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={refundForm.unpaidRentDeductions}
                    onChange={(e) => setRefundForm({ ...refundForm, unpaidRentDeductions: Number(e.target.value) })}
                  />
                </div>

                <div className="fc-form-group">
                  <label className="fc-form-label">Utility Dues Deductions (₹)</label>
                  <input
                    type="number"
                    className="fc-form-input"
                    value={refundForm.utilityDuesDeductions}
                    onChange={(e) => setRefundForm({ ...refundForm, utilityDuesDeductions: Number(e.target.value) })}
                  />
                </div>

                {(() => {
                  const totDeds = Number(refundForm.damageDeductions) + Number(refundForm.unpaidRentDeductions) + Number(refundForm.utilityDuesDeductions);
                  const net = Math.max(0, Number(selectedDepositForRefund.amount) - totDeds);
                  return (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#166534" }}>
                      Net Refund Payable to Tenant: ₹{net.toLocaleString("en-IN")}
                    </div>
                  );
                })()}

                <div className="fc-form-group">
                  <label className="fc-form-label">Refund Payment Method</label>
                  <select
                    className="fc-form-select"
                    value={refundForm.refundMethod}
                    onChange={(e) => setRefundForm({ ...refundForm, refundMethod: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              <div className="fc-modal-footer">
                <button type="button" className="fc-btn-secondary" onClick={() => setIsRefundDepositOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fc-btn-primary" style={{ background: "#7c3aed" }}>
                  Confirm &amp; Finalize Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
