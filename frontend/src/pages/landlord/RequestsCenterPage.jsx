import { useState, useEffect, useContext, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import {
  fetchMaintenance,
  createMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
  fetchComplaints,
  updateComplaint,
  fetchServiceBookings,
  createServiceBooking,
  updateServiceBookingStatus,
  cancelServiceBooking,
  fetchServiceProviders,
  fetchProperties,
  fetchTenants,
  fetchRequestsSummary,
  linkComplaintToMaintenance,
} from "../../utils/apiClient.js";
import {
  Wrench,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  User,
  Building2,
  ChevronRight,
  Plus,
  Sparkles,
  ShieldAlert,
  FileText,
  DollarSign,
  Phone,
  Eye,
  X,
  Send,
  UserCheck,
  CalendarCheck,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Check,
  Layers,
  MapPin,
  Star,
  ExternalLink,
} from "lucide-react";
import "./RequestsCenter.css";

const SERVICE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "AC Repair",
  "Cleaning",
  "Civil Work",
  "Carpentry",
  "Painting",
  "Pest Control",
  "Appliance Repair",
];

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

export default function RequestsCenterPage() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const validTabs = ["overview", "maintenance", "complaints", "marketplace", "bookings"];
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(validTabs.includes(initialTab) ? initialTab : "overview");

  // Keep query param synchronized
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [complaintList, setComplaintList] = useState([]);
  const [bookingList, setBookingList] = useState([]);
  const [providerList, setProviderList] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modals & Drawers
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [assignProviderModal, setAssignProviderModal] = useState(null);
  const [rejectModalTicket, setRejectModalTicket] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionModalComplaint, setResolutionModalComplaint] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState("Resolved");

  const [linkMaintenanceComplaint, setLinkMaintenanceComplaint] = useState(null);
  const [linkMode, setLinkMode] = useState("create_new");
  const [existingTicketIdToLink, setExistingTicketIdToLink] = useState("");

  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const [selectedMarketplaceProvider, setSelectedMarketplaceProvider] = useState(null);
  const [cancelBookingModal, setCancelBookingModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [viewPhotosModal, setViewPhotosModal] = useState(null);

  // Form State for New Ticket
  const [newTicketData, setNewTicketData] = useState({
    propertyId: "",
    tenantId: "",
    title: "",
    category: "Plumbing",
    priority: "Medium",
    description: "",
    estimatedCost: 0,
  });

  // Form State for New Booking
  const [newBookingData, setNewBookingData] = useState({
    propertyId: "",
    serviceCategory: "Plumbing",
    providerId: "",
    providerName: "",
    date: new Date().toISOString().split("T")[0],
    timeSlot: "10:00 AM",
    amount: 499,
    notes: "",
  });

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, mntRes, cmpRes, bkgRes, prvRes, prpRes, tenRes] = await Promise.all([
        fetchRequestsSummary().catch(() => null),
        fetchMaintenance().catch(() => []),
        fetchComplaints().catch(() => []),
        fetchServiceBookings().catch(() => []),
        fetchServiceProviders().catch(() => []),
        fetchProperties().catch(() => []),
        fetchTenants().catch(() => []),
      ]);

      if (sumRes?.success) setSummary(sumRes);
      if (Array.isArray(mntRes)) setMaintenanceList(mntRes);
      if (Array.isArray(cmpRes)) setComplaintList(cmpRes);
      if (Array.isArray(bkgRes)) setBookingList(bkgRes);
      if (Array.isArray(prvRes)) setProviderList(prvRes);
      if (Array.isArray(prpRes)) setProperties(prpRes);
      if (Array.isArray(tenRes)) setTenants(tenRes);
    } catch (err) {
      console.error("Error loading requests center data:", err);
      showToast("Failed to load requests data. Please refresh.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered maintenance list
  const filteredMaintenance = useMemo(() => {
    return maintenanceList.filter((m) => {
      const matchSearch =
        !searchTerm ||
        (m.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.tenantName || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchProp = propertyFilter === "All" || m.propertyId === propertyFilter;
      const matchPrio = priorityFilter === "All" || m.priority === priorityFilter;
      const matchStatus = statusFilter === "All" || m.status === statusFilter;
      const matchCat = categoryFilter === "All" || m.category === categoryFilter;
      return matchSearch && matchProp && matchPrio && matchStatus && matchCat;
    });
  }, [maintenanceList, searchTerm, propertyFilter, priorityFilter, statusFilter, categoryFilter]);

  // Filtered complaints list
  const filteredComplaints = useMemo(() => {
    return complaintList.filter((c) => {
      const matchSearch =
        !searchTerm ||
        (c.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.tenantName || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchProp = propertyFilter === "All" || c.propertyId === propertyFilter;
      const matchPrio = priorityFilter === "All" || c.priority === priorityFilter;
      const matchStatus = statusFilter === "All" || c.status === statusFilter;
      const matchCat = categoryFilter === "All" || c.category === categoryFilter;
      return matchSearch && matchProp && matchPrio && matchStatus && matchCat;
    });
  }, [complaintList, searchTerm, propertyFilter, priorityFilter, statusFilter, categoryFilter]);

  // Filtered marketplace providers
  const filteredProviders = useMemo(() => {
    return providerList.filter((p) => {
      const matchSearch =
        !searchTerm ||
        (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.location || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === "All" || p.category === categoryFilter;
      const matchAvail =
        statusFilter === "All" ||
        (statusFilter === "Available" ? p.isAvailable : !p.isAvailable);
      return matchSearch && matchCat && matchAvail;
    });
  }, [providerList, searchTerm, categoryFilter, statusFilter]);

  // Filtered bookings list
  const filteredBookings = useMemo(() => {
    return bookingList.filter((b) => {
      const matchSearch =
        !searchTerm ||
        (b.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.bookingNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.providerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.serviceCategory || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchProp = propertyFilter === "All" || b.propertyId === propertyFilter;
      const matchStatus = statusFilter === "All" || b.status === statusFilter;
      const matchCat = categoryFilter === "All" || b.serviceCategory === categoryFilter;
      return matchSearch && matchProp && matchStatus && matchCat;
    });
  }, [bookingList, searchTerm, propertyFilter, statusFilter, categoryFilter]);

  // Handler: Create Maintenance Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketData.propertyId) {
      showToast("Please select a property.", "error");
      return;
    }
    try {
      const created = await createMaintenanceRequest(newTicketData);
      showToast(`Maintenance Ticket ${created.id} created successfully!`);
      setShowCreateTicketModal(false);
      setNewTicketData({
        propertyId: "",
        tenantId: "",
        title: "",
        category: "Plumbing",
        priority: "Medium",
        description: "",
        estimatedCost: 0,
      });
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to create ticket", "error");
    }
  };

  // Handler: Advance Maintenance Status
  const handleUpdateMaintenanceStatus = async (ticketId, nextStatus, extraPayload = {}) => {
    try {
      const updated = await updateMaintenanceRequest(ticketId, {
        status: nextStatus,
        ...extraPayload,
      });
      showToast(`Ticket ${ticketId} updated to ${nextStatus}`);
      setSelectedTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updated } : prev));
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to update status", "error");
    }
  };

  // Handler: Assign Provider to Ticket
  const handleAssignProvider = async (e) => {
    e.preventDefault();
    if (!assignProviderModal) return;
    const { ticket, providerId, date, timeSlot, notes } = assignProviderModal;
    const providerObj = providerList.find((p) => p.id === providerId);
    if (!providerObj) {
      showToast("Please choose a valid service provider.", "error");
      return;
    }
    try {
      await updateMaintenanceRequest(ticket.id, {
        status: "Assigned",
        assignedTo: providerObj.name,
        providerId: providerObj.id,
        providerName: providerObj.name,
        technicianName: providerObj.technicianName || providerObj.name,
        technicianPhone: providerObj.phone,
        scheduledDate: date || new Date().toISOString().split("T")[0],
        scheduledTimeSlot: timeSlot || "10:00 AM",
        landlordNotes: notes || `Assigned to ${providerObj.name}`,
      });
      showToast(`Provider ${providerObj.name} assigned to ticket ${ticket.id}`);
      setAssignProviderModal(null);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to assign provider", "error");
    }
  };

  // Handler: Reject Maintenance Ticket
  const handleRejectTicket = async (e) => {
    e.preventDefault();
    if (!rejectModalTicket) return;
    if (!rejectionReason.trim()) {
      showToast("Please state a clear rejection reason.", "error");
      return;
    }
    try {
      await updateMaintenanceRequest(rejectModalTicket.id, {
        status: "Rejected",
        rejectionReason,
        landlordNotes: `Rejected: ${rejectionReason}`,
      });
      showToast(`Ticket ${rejectModalTicket.id} marked as Rejected.`);
      setRejectModalTicket(null);
      setRejectionReason("");
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to reject ticket", "error");
    }
  };

  // Handler: Resolve Complaint
  const handleResolveComplaint = async (e) => {
    e.preventDefault();
    if (!resolutionModalComplaint) return;
    if (!resolutionNotes.trim()) {
      showToast("Resolution notes are required before closing or resolving a complaint.", "error");
      return;
    }
    try {
      await updateComplaint(resolutionModalComplaint.id, {
        status: resolutionStatus,
        resolutionDetails: resolutionNotes,
        landlordNotes: resolutionNotes,
      });
      showToast(`Complaint ${resolutionModalComplaint.id} marked as ${resolutionStatus}`);
      setResolutionModalComplaint(null);
      setResolutionNotes("");
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to resolve complaint", "error");
    }
  };

  // Handler: Link Complaint to Maintenance
  const handleLinkComplaint = async (e) => {
    e.preventDefault();
    if (!linkMaintenanceComplaint) return;
    try {
      const payload = linkMode === "existing" ? { maintenanceRequestId: existingTicketIdToLink } : {};
      const res = await linkComplaintToMaintenance(linkMaintenanceComplaint.id, payload);
      showToast(res.message || "Complaint successfully linked to maintenance ticket!");
      setLinkMaintenanceComplaint(null);
      setExistingTicketIdToLink("");
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to link complaint", "error");
    }
  };

  // Handler: Create Booking from Marketplace
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!newBookingData.propertyId) {
      showToast("Please choose a property.", "error");
      return;
    }
    try {
      const selectedProp = properties.find((p) => p.id === newBookingData.propertyId);
      const created = await createServiceBooking({
        ...newBookingData,
        propertyName: selectedProp?.name || "Property",
        unit: selectedProp?.unit || "",
        address: selectedProp?.location || selectedProp?.address || "",
        landlordId: selectedProp?.landlordId || "LDL001",
      });
      showToast(`Service booking ${created.bookingNumber || created.id} confirmed!`);
      setShowCreateBookingModal(false);
      setSelectedMarketplaceProvider(null);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to create booking", "error");
    }
  };

  // Handler: Update Booking Status
  const handleUpdateBookingStatus = async (bookingId, nextStatus, note = "") => {
    try {
      await updateServiceBookingStatus(bookingId, nextStatus, note);
      showToast(`Booking ${bookingId} status updated to ${nextStatus}`);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to update booking status", "error");
    }
  };

  // Handler: Cancel Booking
  const handleCancelBooking = async (e) => {
    e.preventDefault();
    if (!cancelBookingModal) return;
    if (!cancelReason.trim()) {
      showToast("Please provide a reason for cancellation.", "error");
      return;
    }
    try {
      await cancelServiceBooking(cancelBookingModal.id, cancelReason);
      showToast(`Booking ${cancelBookingModal.bookingNumber || cancelBookingModal.id} cancelled.`);
      setCancelBookingModal(null);
      setCancelReason("");
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to cancel booking", "error");
    }
  };

  // Computed metrics
  const metrics = summary?.metrics || {
    totalRequests: maintenanceList.length + complaintList.length + bookingList.length,
    newUnassigned: maintenanceList.filter((m) => ["Open", "Submitted"].includes(m.status) && !m.assignedTo).length,
    inProgress: maintenanceList.filter((m) => ["Assigned", "In Progress"].includes(m.status)).length,
    urgentRequests: maintenanceList.filter((m) => ["High", "Urgent"].includes(m.priority) && !["Completed", "Closed"].includes(m.status)).length,
    completedThisMonth: maintenanceList.filter((m) => ["Completed", "Closed"].includes(m.status)).length,
  };

  return (
    <div className="rc-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "0.875rem 1.25rem",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: "600",
            fontSize: "0.875rem",
          }}
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="rc-header">
        <div>
          <div className="rc-breadcrumb">
            <Link to="/landlord" className="rc-breadcrumb-link">
              Dashboard
            </Link>
            <ChevronRight size={14} />
            <span>Requests & Home Services</span>
          </div>
          <h1 className="rc-title">Requests & Home Services</h1>
          <p className="rc-subtitle">
            Centralized hub for tenant maintenance requests, complaints, verified home service providers, and dispatch bookings.
          </p>
        </div>

        <div className="rc-header-actions">
          <button
            className="rc-btn-primary"
            onClick={() => {
              if (activeTab === "bookings" || activeTab === "marketplace") {
                setShowCreateBookingModal(true);
              } else {
                setShowCreateTicketModal(true);
              }
            }}
          >
            <Plus size={16} />
            <span>{activeTab === "bookings" || activeTab === "marketplace" ? "Book Home Service" : "New Maintenance Ticket"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="rc-kpi-grid">
        <div className="rc-kpi-card">
          <div className="rc-kpi-icon rc-kpi-blue">
            <Layers size={22} />
          </div>
          <div className="rc-kpi-content">
            <div className="rc-kpi-label">Total Requests</div>
            <div className="rc-kpi-value">{metrics.totalRequests}</div>
            <div className="rc-kpi-subtext">Across all active leases</div>
          </div>
        </div>

        <div className="rc-kpi-card">
          <div className="rc-kpi-icon rc-kpi-amber">
            <Clock size={22} />
          </div>
          <div className="rc-kpi-content">
            <div className="rc-kpi-label">New / Unassigned</div>
            <div className="rc-kpi-value">{metrics.newUnassigned}</div>
            <div className="rc-kpi-subtext">Needs technician assignment</div>
          </div>
        </div>

        <div className="rc-kpi-card">
          <div className="rc-kpi-icon rc-kpi-indigo">
            <Wrench size={22} />
          </div>
          <div className="rc-kpi-content">
            <div className="rc-kpi-label">In Progress</div>
            <div className="rc-kpi-value">{metrics.inProgress}</div>
            <div className="rc-kpi-subtext">Active repairs underway</div>
          </div>
        </div>

        <div className="rc-kpi-card">
          <div className="rc-kpi-icon rc-kpi-rose">
            <AlertTriangle size={22} />
          </div>
          <div className="rc-kpi-content">
            <div className="rc-kpi-label">Urgent Requests</div>
            <div className="rc-kpi-value" style={{ color: metrics.urgentRequests > 0 ? "#dc2626" : undefined }}>
              {metrics.urgentRequests}
            </div>
            <div className="rc-kpi-subtext">High priority & emergencies</div>
          </div>
        </div>

        <div className="rc-kpi-card">
          <div className="rc-kpi-icon rc-kpi-emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="rc-kpi-content">
            <div className="rc-kpi-label">Completed This Month</div>
            <div className="rc-kpi-value">{metrics.completedThisMonth}</div>
            <div className="rc-kpi-subtext">Resolved & archived</div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="rc-tabs-bar">
        <button
          className={`rc-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          <Layers size={16} />
          <span>Request Overview</span>
        </button>

        <button
          className={`rc-tab-btn ${activeTab === "maintenance" ? "active" : ""}`}
          onClick={() => handleTabChange("maintenance")}
        >
          <Wrench size={16} />
          <span>Maintenance Requests</span>
          <span className="rc-tab-badge">{maintenanceList.length}</span>
        </button>

        <button
          className={`rc-tab-btn ${activeTab === "complaints" ? "active" : ""}`}
          onClick={() => handleTabChange("complaints")}
        >
          <AlertCircle size={16} />
          <span>Complaints</span>
          <span className={`rc-tab-badge ${complaintList.some((c) => c.priority === "Urgent") ? "urgent" : ""}`}>
            {complaintList.length}
          </span>
        </button>

        <button
          className={`rc-tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
          onClick={() => handleTabChange("marketplace")}
        >
          <Sparkles size={16} />
          <span>Home Services Marketplace</span>
          <span className="rc-tab-badge">{providerList.length}</span>
        </button>

        <button
          className={`rc-tab-btn ${activeTab === "bookings" ? "active" : ""}`}
          onClick={() => handleTabChange("bookings")}
        >
          <CalendarCheck size={16} />
          <span>Service Bookings</span>
          <span className="rc-tab-badge">{bookingList.length}</span>
        </button>
      </div>

      {/* Toolbar: Search & Filters (Rendered when in data tabs) */}
      {activeTab !== "overview" && (
        <div className="rc-filter-bar">
          <div className="rc-search-wrapper">
            <Search className="rc-search-icon" size={16} />
            <input
              type="text"
              className="rc-search-input"
              placeholder={
                activeTab === "maintenance"
                  ? "Search by ticket ID, title, description or tenant..."
                  : activeTab === "complaints"
                  ? "Search complaints by subject or tenant..."
                  : activeTab === "marketplace"
                  ? "Search providers by name, skill, or location..."
                  : "Search bookings by provider, category or ID..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="rc-filter-group">
            {activeTab !== "marketplace" && (
              <select className="rc-select" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
                <option value="All">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "maintenance" || activeTab === "complaints" ? (
              <select className="rc-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            ) : null}

            <select className="rc-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select className="rc-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {activeTab === "maintenance" ? (
                <>
                  <option value="Open">Open</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                  <option value="Rejected">Rejected</option>
                </>
              ) : activeTab === "complaints" ? (
                <>
                  <option value="Open">Open</option>
                  <option value="Under Review">Under Review</option>
                  <option value="In Investigation">In Investigation</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </>
              ) : activeTab === "marketplace" ? (
                <>
                  <option value="Available">Available Today</option>
                  <option value="Busy">Busy / Booked</option>
                </>
              ) : (
                <>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </>
              )}
            </select>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: REQUEST OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <div className="rc-overview-grid">
          {/* Left Column: Alerts & Recent Activity */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Urgent Alerts Banner */}
            {summary?.urgentAlerts && summary.urgentAlerts.length > 0 && (
              <div className="rc-alert-banner">
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1 }}>
                  <div className="rc-alert-title">
                    {summary.urgentAlerts.length} Urgent Maintenance & Safety Alerts Require Immediate Action
                  </div>
                  <div className="rc-alert-desc">
                    {summary.urgentAlerts.map((alert) => (
                      <div key={alert.id} style={{ marginTop: "0.25rem" }}>
                        <strong>[{alert.id}]</strong> {alert.displayTitle} — Priority: <strong>{alert.priority}</strong>
                        {" | "}Property: {alert.propertyName || alert.propertyId}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pending Provider Assignments */}
            <div className="rc-widget">
              <div className="rc-widget-header">
                <h3 className="rc-widget-title">
                  <Clock size={18} style={{ color: "#d97706" }} />
                  <span>Pending Provider Assignments</span>
                </h3>
                <span className="rc-tab-badge">
                  {summary?.pendingAssignments ? summary.pendingAssignments.length : 0} waiting
                </span>
              </div>

              {summary?.pendingAssignments && summary.pendingAssignments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {summary.pendingAssignments.map((ticket) => (
                    <div
                      key={ticket.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>
                          [{ticket.id}] {ticket.title || ticket.description}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                          Category: <strong>{ticket.category}</strong> | Property: {ticket.propertyName || ticket.propertyId}
                        </div>
                      </div>
                      <button
                        className="rc-btn-primary rc-btn-sm"
                        onClick={() =>
                          setAssignProviderModal({
                            ticket,
                            providerId: "",
                            date: new Date().toISOString().split("T")[0],
                            timeSlot: "10:00 AM",
                            notes: "",
                          })
                        }
                      >
                        <UserCheck size={14} />
                        <span>Assign Provider</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.875rem", color: "#64748b", padding: "1rem 0" }}>
                  All maintenance requests currently have assigned providers.
                </div>
              )}
            </div>

            {/* Recent Requests Feed */}
            <div className="rc-widget">
              <div className="rc-widget-header">
                <h3 className="rc-widget-title">
                  <Layers size={18} style={{ color: "#0284c7" }} />
                  <span>Recent Requests & Activity Feed</span>
                </h3>
                <button className="rc-btn-secondary rc-btn-sm" onClick={() => handleTabChange("maintenance")}>
                  <span>View All Maintenance</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {summary?.recentRequests && summary.recentRequests.length > 0 ? (
                <div className="rc-table-container">
                  <table className="rc-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Subject / Service</th>
                        <th>Property</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recentRequests.map((reqItem) => (
                        <tr key={reqItem.id}>
                          <td style={{ fontWeight: 600, color: "#0284c7" }}>{reqItem.id}</td>
                          <td>
                            <span className="rc-tab-badge">{reqItem.requestType}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{reqItem.displayTitle}</td>
                          <td>{reqItem.propertyName || reqItem.propertyId || "General"}</td>
                          <td>
                            <span className={`rc-badge rc-badge-${(reqItem.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                              {reqItem.status}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.8125rem", color: "#64748b" }}>{reqItem.date || "Recent"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rc-empty-state">
                  <CheckCircle2 className="rc-empty-icon" />
                  <p className="rc-empty-title">No pending requests</p>
                  <p className="rc-empty-subtext">All tenant maintenance tickets and service bookings are resolved.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Status Distribution & Upcoming Bookings */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Status Distribution */}
            <div className="rc-widget">
              <div className="rc-widget-header">
                <h3 className="rc-widget-title">
                  <Layers size={18} style={{ color: "#4f46e5" }} />
                  <span>Status Distribution</span>
                </h3>
              </div>

              <div className="rc-dist-bar-wrapper">
                {Object.entries(summary?.statusDistribution || { Open: 3, Assigned: 2, "In Progress": 4, Completed: 5 }).map(
                  ([st, count]) => {
                    const total = metrics.totalRequests || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={st}>
                        <div className="rc-dist-row">
                          <span style={{ fontWeight: 600, color: "#334155" }}>{st}</span>
                          <span style={{ color: "#64748b" }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="rc-dist-track">
                          <div
                            className="rc-dist-fill"
                            style={{
                              width: `${pct}%`,
                              background:
                                st === "Completed"
                                  ? "#10b981"
                                  : st === "In Progress"
                                  ? "#0284c7"
                                  : st === "Assigned"
                                  ? "#d97706"
                                  : "#64748b",
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Upcoming Service Bookings */}
            <div className="rc-widget">
              <div className="rc-widget-header">
                <h3 className="rc-widget-title">
                  <Calendar size={18} style={{ color: "#059669" }} />
                  <span>Upcoming Home Services</span>
                </h3>
                <button className="rc-btn-secondary rc-btn-sm" onClick={() => handleTabChange("bookings")}>
                  <span>Bookings</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {summary?.upcomingBookings && summary.upcomingBookings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {summary.upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0f172a" }}>
                          {b.serviceCategory}: {b.providerName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {b.date} at {b.timeSlot} | {b.propertyName || b.propertyId}
                        </div>
                      </div>
                      <span className={`rc-badge rc-badge-${(b.status || "confirmed").toLowerCase().replace(/\s+/g, "-")}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>No upcoming scheduled service visits.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MAINTENANCE REQUESTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "maintenance" && (
        <div className="rc-content-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Maintenance Tickets & Technician Workflow
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Review tenant reported faults, assign local repair specialists, track status pipeline, and record final job costs.
              </p>
            </div>
            <button className="rc-btn-primary rc-btn-sm" onClick={() => setShowCreateTicketModal(true)}>
              <Plus size={14} />
              <span>New Ticket</span>
            </button>
          </div>

          <div className="rc-table-container">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Tenant</th>
                  <th>Property & Unit</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Submitted</th>
                  <th>Assigned Specialist</th>
                  <th>Cost Est. / Act.</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenance.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ fontWeight: 700, color: "#0284c7" }}>{ticket.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ticket.tenantName || ticket.tenantId || "Tenant"}</div>
                      {ticket.tenantPhone && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{ticket.tenantPhone}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ticket.propertyName || ticket.propertyId}</div>
                      {ticket.unit && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Unit: {ticket.unit}</div>}
                    </td>
                    <td>
                      <span className="rc-tab-badge">{ticket.category}</span>
                    </td>
                    <td style={{ maxWidth: "240px" }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ticket.title || ticket.description}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ticket.description}
                      </div>
                      {ticket.photos && ticket.photos.length > 0 && (
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0284c7",
                            padding: 0,
                            fontSize: "0.6875rem",
                            cursor: "pointer",
                            textDecoration: "underline",
                            marginTop: "2px",
                          }}
                          onClick={() => setViewPhotosModal(ticket.photos)}
                        >
                          View {ticket.photos.length} Photo{ticket.photos.length > 1 ? "s" : ""}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`rc-badge rc-priority-${(ticket.priority || "medium").toLowerCase()}`}>
                        {ticket.priority || "Medium"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "#64748b" }}>{ticket.date || "Recent"}</td>
                    <td>
                      {ticket.assignedTo || ticket.providerName ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                            {ticket.technicianName || ticket.providerName || ticket.assignedTo}
                          </div>
                          {ticket.scheduledDate && (
                            <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                              {ticket.scheduledDate} {ticket.scheduledTimeSlot}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          className="rc-btn-secondary rc-btn-sm"
                          onClick={() =>
                            setAssignProviderModal({
                              ticket,
                              providerId: "",
                              date: new Date().toISOString().split("T")[0],
                              timeSlot: "10:00 AM",
                              notes: "",
                            })
                          }
                        >
                          <UserCheck size={12} />
                          <span>Assign</span>
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: "0.8125rem" }}>
                        {formatCurrency(ticket.actualCost || ticket.estimatedCost || 0)}
                      </div>
                      {ticket.expenseId && (
                        <span style={{ fontSize: "0.6875rem", color: "#059669", fontWeight: 600 }}>
                          ✓ Logged to Expenses
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`rc-badge rc-badge-${(ticket.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          className="rc-btn-secondary rc-btn-sm"
                          title="View Details"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Eye size={14} />
                        </button>

                        {ticket.status === "Submitted" && (
                          <button
                            className="rc-btn-primary rc-btn-sm"
                            title="Mark Reviewed"
                            onClick={() => handleUpdateMaintenanceStatus(ticket.id, "Reviewed")}
                          >
                            Review
                          </button>
                        )}

                        {ticket.status === "In Progress" && (
                          <button
                            className="rc-btn-success rc-btn-sm"
                            title="Mark Completed"
                            onClick={() => {
                              const cost = prompt("Enter final actual repair cost (₹):", ticket.actualCost || ticket.estimatedCost || "500");
                              if (cost !== null) {
                                handleUpdateMaintenanceStatus(ticket.id, "Completed", {
                                  actualCost: Number(cost) || 0,
                                  createExpense: true,
                                });
                              }
                            }}
                          >
                            Complete
                          </button>
                        )}

                        {["Open", "Submitted"].includes(ticket.status) && (
                          <button
                            className="rc-btn-danger rc-btn-sm"
                            title="Reject"
                            onClick={() => setRejectModalTicket(ticket)}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredMaintenance.length === 0 && (
            <div className="rc-empty-state">
              <Wrench className="rc-empty-icon" />
              <p className="rc-empty-title">No maintenance requests match filters</p>
              <p className="rc-empty-subtext">Try clearing filters or create a new ticket for your properties.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: COMPLAINTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "complaints" && (
        <div className="rc-content-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Tenant Complaints & Dispute Resolution
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Manage grievances, investigate service issues, convert to maintenance repairs, and record audited resolutions.
              </p>
            </div>
          </div>

          <div className="rc-table-container">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Complaint ID</th>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Category</th>
                  <th>Subject & Details</th>
                  <th>Priority</th>
                  <th>Submitted</th>
                  <th>Assigned Staff</th>
                  <th>Linked Maintenance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td style={{ fontWeight: 700, color: "#0284c7" }}>{complaint.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{complaint.tenantName || complaint.tenantId}</div>
                    </td>
                    <td>{complaint.propertyName || complaint.propertyId}</td>
                    <td>
                      <span className="rc-tab-badge">{complaint.category || "General"}</span>
                    </td>
                    <td style={{ maxWidth: "260px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{complaint.subject || complaint.issue}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {complaint.description || complaint.investigationNotes}
                      </div>
                      {complaint.resolutionDetails && (
                        <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "2px" }}>
                          ✓ Resolution: {complaint.resolutionDetails}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`rc-badge rc-priority-${(complaint.priority || "medium").toLowerCase()}`}>
                        {complaint.priority || "Medium"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "#64748b" }}>{complaint.date || "Recent"}</td>
                    <td>{complaint.assignedStaff || complaint.technicianName || "Unassigned"}</td>
                    <td>
                      {complaint.maintenanceRequestId ? (
                        <span style={{ fontWeight: 600, color: "#0284c7" }}>
                          ✓ {complaint.maintenanceRequestId}
                        </span>
                      ) : (
                        <button
                          className="rc-btn-secondary rc-btn-sm"
                          onClick={() => setLinkMaintenanceComplaint(complaint)}
                        >
                          <Wrench size={12} />
                          <span>Link Ticket</span>
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`rc-badge rc-badge-${(complaint.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                        {complaint.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          className="rc-btn-secondary rc-btn-sm"
                          title="Review"
                          onClick={() => setSelectedComplaint(complaint)}
                        >
                          <Eye size={14} />
                        </button>

                        {complaint.status !== "Resolved" && complaint.status !== "Closed" && (
                          <button
                            className="rc-btn-success rc-btn-sm"
                            title="Resolve"
                            onClick={() => {
                              setResolutionModalComplaint(complaint);
                              setResolutionStatus("Resolved");
                              setResolutionNotes(complaint.resolutionDetails || "");
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredComplaints.length === 0 && (
            <div className="rc-empty-state">
              <CheckCircle2 className="rc-empty-icon" />
              <p className="rc-empty-title">No tenant complaints found</p>
              <p className="rc-empty-subtext">Tenant satisfaction is healthy across your rental portfolio.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: HOME SERVICES MARKETPLACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "marketplace" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Verified Home Service Specialists & Technicians
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Browse vetted local electricians, plumbers, AC technicians and facility crews in Chennai & Tamil Nadu.
              </p>
            </div>
          </div>

          <div className="rc-providers-grid">
            {filteredProviders.map((provider) => (
              <div key={provider.id} className="rc-provider-card">
                <div className="rc-provider-top">
                  <div className="rc-provider-avatar">
                    {provider.category === "Electrical"
                      ? "⚡"
                      : provider.category === "Plumbing"
                      ? "🚰"
                      : provider.category === "AC Repair"
                      ? "❄️"
                      : provider.category === "Cleaning"
                      ? "✨"
                      : provider.category === "Painting"
                      ? "🎨"
                      : provider.category === "Carpentry"
                      ? "🔨"
                      : provider.category === "Pest Control"
                      ? "🪲"
                      : "🔧"}
                  </div>
                  <div className="rc-provider-info">
                    <h4 className="rc-provider-name">{provider.name}</h4>
                    <div className="rc-provider-category">{provider.category}</div>
                    <div className="rc-provider-rating">
                      <Star size={13} fill="#d97706" color="#d97706" />
                      <span>{provider.rating || 4.8}</span>
                      <span style={{ color: "#94a3b8", fontWeight: 400 }}>({provider.reviewCount || 12} reviews)</span>
                    </div>
                  </div>
                  <span className={`rc-badge ${provider.isAvailable ? "rc-badge-completed" : "rc-badge-closed"}`}>
                    {provider.isAvailable ? "Available" : "Busy"}
                  </span>
                </div>

                <div className="rc-provider-meta">
                  <div className="rc-provider-meta-row">
                    <MapPin size={13} />
                    <span>{provider.location || "Chennai, Tamil Nadu"}</span>
                  </div>
                  <div className="rc-provider-meta-row">
                    <Phone size={13} />
                    <span>{provider.phone}</span>
                  </div>
                  <div className="rc-provider-meta-row" style={{ marginTop: "0.25rem" }}>
                    <span>Inspection Price:</span>
                    <span className="rc-provider-price">{formatCurrency(provider.price || 499)}</span>
                  </div>
                </div>

                <div className="rc-provider-actions">
                  <button
                    className="rc-btn-primary rc-btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSelectedMarketplaceProvider(provider);
                      setNewBookingData((prev) => ({
                        ...prev,
                        serviceCategory: provider.category,
                        providerId: provider.id,
                        providerName: provider.name,
                        amount: provider.price || 499,
                      }));
                      setShowCreateBookingModal(true);
                    }}
                  >
                    <CalendarCheck size={14} />
                    <span>Book Service</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredProviders.length === 0 && (
            <div className="rc-empty-state">
              <Sparkles className="rc-empty-icon" />
              <p className="rc-empty-title">No providers match category filter</p>
              <p className="rc-empty-subtext">Try changing the category or search criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: SERVICE BOOKINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "bookings" && (
        <div className="rc-content-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Service Bookings & Job Dispatch Management
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Track scheduled contractor visits, work orders, payment statuses, and automatic operational expense records.
              </p>
            </div>
            <button className="rc-btn-primary rc-btn-sm" onClick={() => setShowCreateBookingModal(true)}>
              <Plus size={14} />
              <span>Book Service</span>
            </button>
          </div>

          <div className="rc-table-container">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Booking No.</th>
                  <th>Service Category</th>
                  <th>Property & Unit</th>
                  <th>Provider / Technician</th>
                  <th>Date & Slot</th>
                  <th>Cost</th>
                  <th>Booking Status</th>
                  <th>Payment</th>
                  <th>Expense Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700, color: "#0284c7" }}>{b.bookingNumber || b.id}</td>
                    <td>
                      <span className="rc-tab-badge">{b.serviceCategory}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.propertyName || b.propertyId}</div>
                      {b.unit && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Unit: {b.unit}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.providerName}</div>
                      {b.technicianName && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Tech: {b.technicianName}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{b.date}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{b.timeSlot}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(b.actualCost || b.amount || 499)}</td>
                    <td>
                      <span className={`rc-badge rc-badge-${(b.status || "confirmed").toLowerCase().replace(/\s+/g, "-")}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <span className={`rc-badge rc-badge-${(b.paymentStatus || "pending").toLowerCase()}`}>
                        {b.paymentStatus || "Pending"}
                      </span>
                    </td>
                    <td>
                      {b.expenseId ? (
                        <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>✓ Logged</span>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        {b.status === "Confirmed" && (
                          <button
                            className="rc-btn-primary rc-btn-sm"
                            title="Start Work"
                            onClick={() => handleUpdateBookingStatus(b.id, "In Progress", "Technician on site")}
                          >
                            Start
                          </button>
                        )}

                        {b.status === "In Progress" && (
                          <button
                            className="rc-btn-success rc-btn-sm"
                            title="Complete Service"
                            onClick={() => handleUpdateBookingStatus(b.id, "Completed", "Job finished satisfactorily")}
                          >
                            Complete
                          </button>
                        )}

                        {["Pending", "Confirmed"].includes(b.status) && (
                          <button
                            className="rc-btn-danger rc-btn-sm"
                            title="Cancel Booking"
                            onClick={() => setCancelBookingModal(b)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 && (
            <div className="rc-empty-state">
              <CalendarCheck className="rc-empty-icon" />
              <p className="rc-empty-title">No service bookings found</p>
              <p className="rc-empty-subtext">Schedule a verified technician from the Home Services Marketplace.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE MAINTENANCE TICKET */}
      {/* ------------------------------------------------------------- */}
      {showCreateTicketModal && (
        <div className="rc-modal-backdrop" onClick={() => setShowCreateTicketModal(false)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">Create Maintenance Ticket</h3>
              <button className="rc-modal-close" onClick={() => setShowCreateTicketModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div className="rc-modal-body">
                <div className="rc-form-group">
                  <label className="rc-form-label">Property *</label>
                  <select
                    className="rc-form-select"
                    required
                    value={newTicketData.propertyId}
                    onChange={(e) => setNewTicketData({ ...newTicketData, propertyId: e.target.value })}
                  >
                    <option value="">Select Property...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Tenant (Optional)</label>
                  <select
                    className="rc-form-select"
                    value={newTicketData.tenantId}
                    onChange={(e) => setNewTicketData({ ...newTicketData, tenantId: e.target.value })}
                  >
                    <option value="">Select Tenant...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Issue Category *</label>
                  <select
                    className="rc-form-select"
                    value={newTicketData.category}
                    onChange={(e) => setNewTicketData({ ...newTicketData, category: e.target.value })}
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Priority</label>
                  <select
                    className="rc-form-select"
                    value={newTicketData.priority}
                    onChange={(e) => setNewTicketData({ ...newTicketData, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Title / Short Summary *</label>
                  <input
                    type="text"
                    className="rc-form-input"
                    required
                    placeholder="e.g. Master bathroom tap dripping constantly"
                    value={newTicketData.title}
                    onChange={(e) => setNewTicketData({ ...newTicketData, title: e.target.value })}
                  />
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Detailed Description</label>
                  <textarea
                    className="rc-form-textarea"
                    placeholder="Describe specific symptoms, location, and severity..."
                    value={newTicketData.description}
                    onChange={(e) => setNewTicketData({ ...newTicketData, description: e.target.value })}
                  />
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Estimated Repair Cost (₹)</label>
                  <input
                    type="number"
                    className="rc-form-input"
                    min="0"
                    value={newTicketData.estimatedCost}
                    onChange={(e) => setNewTicketData({ ...newTicketData, estimatedCost: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setShowCreateTicketModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-primary">
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ASSIGN PROVIDER */}
      {/* ------------------------------------------------------------- */}
      {assignProviderModal && (
        <div className="rc-modal-backdrop" onClick={() => setAssignProviderModal(null)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">
                Assign Specialist to Ticket {assignProviderModal.ticket.id}
              </h3>
              <button className="rc-modal-close" onClick={() => setAssignProviderModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignProvider}>
              <div className="rc-modal-body">
                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", fontSize: "0.8125rem" }}>
                  <strong>Ticket:</strong> {assignProviderModal.ticket.title || assignProviderModal.ticket.description}
                  <br />
                  <strong>Property:</strong> {assignProviderModal.ticket.propertyName || assignProviderModal.ticket.propertyId}
                  <br />
                  <strong>Category:</strong> {assignProviderModal.ticket.category}
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Select Service Provider *</label>
                  <select
                    className="rc-form-select"
                    required
                    value={assignProviderModal.providerId}
                    onChange={(e) => setAssignProviderModal({ ...assignProviderModal, providerId: e.target.value })}
                  >
                    <option value="">Choose Provider...</option>
                    {providerList
                      .filter(
                        (p) =>
                          p.category.toLowerCase() === assignProviderModal.ticket.category.toLowerCase() ||
                          p.category === "General"
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category}) — ₹{p.price} | Rating {p.rating}★
                        </option>
                      ))}
                    {/* Fallback to any provider if category filter yields none */}
                    {providerList.length > 0 &&
                      !providerList.some(
                        (p) => p.category.toLowerCase() === assignProviderModal.ticket.category.toLowerCase()
                      ) &&
                      providerList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category}) — ₹{p.price}
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="rc-form-group">
                    <label className="rc-form-label">Appointment Date *</label>
                    <input
                      type="date"
                      className="rc-form-input"
                      required
                      value={assignProviderModal.date}
                      onChange={(e) => setAssignProviderModal({ ...assignProviderModal, date: e.target.value })}
                    />
                  </div>

                  <div className="rc-form-group">
                    <label className="rc-form-label">Time Slot *</label>
                    <select
                      className="rc-form-select"
                      required
                      value={assignProviderModal.timeSlot}
                      onChange={(e) => setAssignProviderModal({ ...assignProviderModal, timeSlot: e.target.value })}
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Instructions / Notes</label>
                  <textarea
                    className="rc-form-textarea"
                    placeholder="Provide gate entry code, contact preference or repair notes..."
                    value={assignProviderModal.notes}
                    onChange={(e) => setAssignProviderModal({ ...assignProviderModal, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setAssignProviderModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: REJECT TICKET */}
      {/* ------------------------------------------------------------- */}
      {rejectModalTicket && (
        <div className="rc-modal-backdrop" onClick={() => setRejectModalTicket(null)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">Reject Maintenance Ticket {rejectModalTicket.id}</h3>
              <button className="rc-modal-close" onClick={() => setRejectModalTicket(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRejectTicket}>
              <div className="rc-modal-body">
                <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
                  Please specify the reason for rejecting this maintenance request. The tenant will receive an automatic notification.
                </p>
                <div className="rc-form-group">
                  <label className="rc-form-label">Rejection Reason *</label>
                  <textarea
                    className="rc-form-textarea"
                    required
                    placeholder="e.g. Issue falls under tenant lease responsibility or duplicate report..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setRejectModalTicket(null)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-danger">
                  Reject Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RESOLVE COMPLAINT */}
      {/* ------------------------------------------------------------- */}
      {resolutionModalComplaint && (
        <div className="rc-modal-backdrop" onClick={() => setResolutionModalComplaint(null)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">Resolve Complaint {resolutionModalComplaint.id}</h3>
              <button className="rc-modal-close" onClick={() => setResolutionModalComplaint(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResolveComplaint}>
              <div className="rc-modal-body">
                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", fontSize: "0.8125rem" }}>
                  <strong>Subject:</strong> {resolutionModalComplaint.subject || resolutionModalComplaint.issue}
                  <br />
                  <strong>Tenant:</strong> {resolutionModalComplaint.tenantName} | <strong>Property:</strong>{" "}
                  {resolutionModalComplaint.propertyName}
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Resolution Status</label>
                  <select
                    className="rc-form-select"
                    value={resolutionStatus}
                    onChange={(e) => setResolutionStatus(e.target.value)}
                  >
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Audited Resolution Details *</label>
                  <textarea
                    className="rc-form-textarea"
                    required
                    placeholder="Detail the actions taken to address the tenant's complaint..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setResolutionModalComplaint(null)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-success">
                  Complete Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: LINK COMPLAINT TO MAINTENANCE */}
      {/* ------------------------------------------------------------- */}
      {linkMaintenanceComplaint && (
        <div className="rc-modal-backdrop" onClick={() => setLinkMaintenanceComplaint(null)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">
                Link Complaint {linkMaintenanceComplaint.id} to Maintenance
              </h3>
              <button className="rc-modal-close" onClick={() => setLinkMaintenanceComplaint(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleLinkComplaint}>
              <div className="rc-modal-body">
                <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
                  Avoid duplicate records by linking this complaint directly to a maintenance work order.
                </p>

                <div className="rc-form-group">
                  <label className="rc-form-label">Action</label>
                  <select
                    className="rc-form-select"
                    value={linkMode}
                    onChange={(e) => setLinkMode(e.target.value)}
                  >
                    <option value="create_new">Create New Maintenance Ticket from Complaint</option>
                    <option value="existing">Link to Existing Maintenance Ticket</option>
                  </select>
                </div>

                {linkMode === "existing" && (
                  <div className="rc-form-group">
                    <label className="rc-form-label">Select Maintenance Ticket</label>
                    <select
                      className="rc-form-select"
                      required
                      value={existingTicketIdToLink}
                      onChange={(e) => setExistingTicketIdToLink(e.target.value)}
                    >
                      <option value="">Choose Ticket...</option>
                      {maintenanceList.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.id}] {m.title} ({m.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setLinkMaintenanceComplaint(null)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-primary">
                  Confirm Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE SERVICE BOOKING */}
      {/* ------------------------------------------------------------- */}
      {showCreateBookingModal && (
        <div className="rc-modal-backdrop" onClick={() => setShowCreateBookingModal(false)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">Book Verified Home Service</h3>
              <button className="rc-modal-close" onClick={() => setShowCreateBookingModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBooking}>
              <div className="rc-modal-body">
                <div className="rc-form-group">
                  <label className="rc-form-label">Property *</label>
                  <select
                    className="rc-form-select"
                    required
                    value={newBookingData.propertyId}
                    onChange={(e) => setNewBookingData({ ...newBookingData, propertyId: e.target.value })}
                  >
                    <option value="">Select Property...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Service Category</label>
                  <select
                    className="rc-form-select"
                    value={newBookingData.serviceCategory}
                    onChange={(e) => setNewBookingData({ ...newBookingData, serviceCategory: e.target.value })}
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Service Provider *</label>
                  <select
                    className="rc-form-select"
                    required
                    value={newBookingData.providerId}
                    onChange={(e) => {
                      const p = providerList.find((prov) => prov.id === e.target.value);
                      setNewBookingData({
                        ...newBookingData,
                        providerId: e.target.value,
                        providerName: p?.name || "",
                        amount: p?.price || 499,
                      });
                    }}
                  >
                    <option value="">Select Provider...</option>
                    {providerList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) — ₹{p.price}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="rc-form-group">
                    <label className="rc-form-label">Scheduled Date *</label>
                    <input
                      type="date"
                      className="rc-form-input"
                      required
                      value={newBookingData.date}
                      onChange={(e) => setNewBookingData({ ...newBookingData, date: e.target.value })}
                    />
                  </div>

                  <div className="rc-form-group">
                    <label className="rc-form-label">Time Slot *</label>
                    <select
                      className="rc-form-select"
                      value={newBookingData.timeSlot}
                      onChange={(e) => setNewBookingData({ ...newBookingData, timeSlot: e.target.value })}
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Service Cost (₹)</label>
                  <input
                    type="number"
                    className="rc-form-input"
                    value={newBookingData.amount}
                    onChange={(e) => setNewBookingData({ ...newBookingData, amount: Number(e.target.value) })}
                  />
                </div>

                <div className="rc-form-group">
                  <label className="rc-form-label">Job Notes / Instructions</label>
                  <textarea
                    className="rc-form-textarea"
                    placeholder="Enter instructions for the specialist..."
                    value={newBookingData.notes}
                    onChange={(e) => setNewBookingData({ ...newBookingData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setShowCreateBookingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="rc-btn-primary">
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CANCEL BOOKING */}
      {/* ------------------------------------------------------------- */}
      {cancelBookingModal && (
        <div className="rc-modal-backdrop" onClick={() => setCancelBookingModal(null)}>
          <div className="rc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">
                Cancel Booking {cancelBookingModal.bookingNumber || cancelBookingModal.id}
              </h3>
              <button className="rc-modal-close" onClick={() => setCancelBookingModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCancelBooking}>
              <div className="rc-modal-body">
                <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
                  Please state a reason for cancelling this booking. Both tenant and provider will be notified.
                </p>
                <div className="rc-form-group">
                  <label className="rc-form-label">Cancellation Reason *</label>
                  <textarea
                    className="rc-form-textarea"
                    required
                    placeholder="e.g. Tenant rescheduled or repair already resolved..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="rc-modal-footer">
                <button type="button" className="rc-btn-secondary" onClick={() => setCancelBookingModal(null)}>
                  Keep Booking
                </button>
                <button type="submit" className="rc-btn-danger">
                  Cancel Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PHOTO GALLERY LIGHTBOX */}
      {/* ------------------------------------------------------------- */}
      {viewPhotosModal && (
        <div className="rc-modal-backdrop" onClick={() => setViewPhotosModal(null)}>
          <div className="rc-modal-card" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <h3 className="rc-modal-title">Attached Photos ({viewPhotosModal.length})</h3>
              <button className="rc-modal-close" onClick={() => setViewPhotosModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="rc-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                {viewPhotosModal.map((url, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      style={{ width: "100%", height: "180px", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rc-modal-footer">
              <button className="rc-btn-secondary" onClick={() => setViewPhotosModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIDE DRAWER: TICKET DETAILS */}
      {/* ------------------------------------------------------------- */}
      {selectedTicket && (
        <div className="rc-modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div
            className="rc-modal-card"
            style={{ maxWidth: "620px", height: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rc-modal-header">
              <div>
                <h3 className="rc-modal-title">Ticket {selectedTicket.id}</h3>
                <span className={`rc-badge rc-badge-${(selectedTicket.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                  {selectedTicket.status}
                </span>
              </div>
              <button className="rc-modal-close" onClick={() => setSelectedTicket(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rc-modal-body">
              <div>
                <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700 }}>
                  {selectedTicket.title}
                </h4>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569" }}>{selectedTicket.description}</p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  background: "#f8fafc",
                  padding: "0.875rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                }}
              >
                <div>
                  <strong>Property:</strong> {selectedTicket.propertyName || selectedTicket.propertyId}
                  {selectedTicket.unit && ` (Unit ${selectedTicket.unit})`}
                </div>
                <div>
                  <strong>Tenant:</strong> {selectedTicket.tenantName || selectedTicket.tenantId}
                </div>
                <div>
                  <strong>Category:</strong> {selectedTicket.category}
                </div>
                <div>
                  <strong>Priority:</strong> {selectedTicket.priority}
                </div>
                <div>
                  <strong>Est. Cost:</strong> {formatCurrency(selectedTicket.estimatedCost || 0)}
                </div>
                <div>
                  <strong>Actual Cost:</strong> {formatCurrency(selectedTicket.actualCost || 0)}
                </div>
                {selectedTicket.expenseId && (
                  <div style={{ gridColumn: "span 2", color: "#059669", fontWeight: 700 }}>
                    ✓ Linked Expense ID: {selectedTicket.expenseId}
                  </div>
                )}
              </div>

              {selectedTicket.assignedTo && (
                <div style={{ background: "#e0f2fe", padding: "0.875rem", borderRadius: "8px" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0369a1" }}>
                    Assigned Specialist
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#0f172a", marginTop: "2px" }}>
                    {selectedTicket.technicianName || selectedTicket.assignedTo} ({selectedTicket.technicianPhone || "Phone on file"})
                  </div>
                  {selectedTicket.scheduledDate && (
                    <div style={{ fontSize: "0.75rem", color: "#0369a1", marginTop: "2px" }}>
                      Scheduled: {selectedTicket.scheduledDate} at {selectedTicket.scheduledTimeSlot}
                    </div>
                  )}
                </div>
              )}

              {selectedTicket.rejectionReason && (
                <div style={{ background: "#fee2e2", padding: "0.875rem", borderRadius: "8px", color: "#991b1b" }}>
                  <strong>Rejection Reason:</strong> {selectedTicket.rejectionReason}
                </div>
              )}

              {/* Status Change History Timeline */}
              {selectedTicket.statusHistory && selectedTicket.statusHistory.length > 0 && (
                <div>
                  <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 700 }}>
                    Status Timeline
                  </h5>
                  <div className="rc-timeline">
                    {selectedTicket.statusHistory.map((item, idx) => (
                      <div key={idx} className="rc-timeline-item">
                        <div className="rc-timeline-dot" />
                        <div className="rc-timeline-title">{item.status}</div>
                        <div className="rc-timeline-meta">
                          {item.date} by {item.updatedBy}
                        </div>
                        {item.notes && <div className="rc-timeline-note">{item.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rc-modal-footer">
              <button className="rc-btn-secondary" onClick={() => setSelectedTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIDE DRAWER: COMPLAINT DETAILS */}
      {/* ------------------------------------------------------------- */}
      {selectedComplaint && (
        <div className="rc-modal-backdrop" onClick={() => setSelectedComplaint(null)}>
          <div
            className="rc-modal-card"
            style={{ maxWidth: "620px", height: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rc-modal-header">
              <div>
                <h3 className="rc-modal-title">Complaint {selectedComplaint.id}</h3>
                <span className={`rc-badge rc-badge-${(selectedComplaint.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                  {selectedComplaint.status}
                </span>
              </div>
              <button className="rc-modal-close" onClick={() => setSelectedComplaint(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rc-modal-body">
              <div>
                <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700 }}>
                  {selectedComplaint.subject || selectedComplaint.issue}
                </h4>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569" }}>
                  {selectedComplaint.description || "No detailed description provided."}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  background: "#f8fafc",
                  padding: "0.875rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                }}
              >
                <div>
                  <strong>Tenant:</strong> {selectedComplaint.tenantName}
                </div>
                <div>
                  <strong>Property:</strong> {selectedComplaint.propertyName}
                </div>
                <div>
                  <strong>Category:</strong> {selectedComplaint.category || "General"}
                </div>
                <div>
                  <strong>Priority:</strong> {selectedComplaint.priority}
                </div>
                <div>
                  <strong>Date:</strong> {selectedComplaint.date || "Recent"}
                </div>
                <div>
                  <strong>Linked Ticket:</strong> {selectedComplaint.maintenanceRequestId || "None"}
                </div>
              </div>

              {selectedComplaint.resolutionDetails && (
                <div style={{ background: "#ecfdf5", padding: "0.875rem", borderRadius: "8px", color: "#065f46" }}>
                  <strong>Resolution Details:</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem" }}>
                    {selectedComplaint.resolutionDetails}
                  </p>
                </div>
              )}

              {/* Status Timeline */}
              {selectedComplaint.statusHistory && selectedComplaint.statusHistory.length > 0 && (
                <div>
                  <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 700 }}>
                    Complaint Audit History
                  </h5>
                  <div className="rc-timeline">
                    {selectedComplaint.statusHistory.map((item, idx) => (
                      <div key={idx} className="rc-timeline-item">
                        <div className="rc-timeline-dot" />
                        <div className="rc-timeline-title">{item.status}</div>
                        <div className="rc-timeline-meta">
                          {item.date} by {item.updatedBy}
                        </div>
                        {item.notes && <div className="rc-timeline-note">{item.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rc-modal-footer">
              <button className="rc-btn-secondary" onClick={() => setSelectedComplaint(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
