import { useContext, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SettingsContext } from "../context/SettingsContext.jsx";
import {
  LayoutDashboard,
  Search,
  Building2,
  FileText,
  FileSignature,
  CreditCard,
  Zap,
  Wrench,
  LifeBuoy,
  Sparkles,
  CalendarCheck,
  FolderArchive,
  Bell,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Users,
  Shield,
  Receipt,
  Layers,
  CircleDollarSign,
  AlertCircle,
  Briefcase
} from "lucide-react";

/**
 * Tenant Sidebar Collapsible Groups Configuration:
 * 1. Dashboard (Standalone at top, outside all groups)
 * 2. Rental Management (Properties, My Lease, Tenancy Agreement)
 * 3. Payments & Utilities (My Payment History, EB Bills, Utility Bills)
 * 4. Maintenance & Services (6 distinct items preserved)
 * 5. Account & Documents (My Documents, My Profile, Settings, Analytics & Reports)
 */
const TENANT_GROUPS = [
  {
    id: "rental",
    title: "Rental Management",
    labelKey: "rentalManagement",
    items: [
      { to: "properties", labelKey: "properties", icon: Building2 },
      { to: "lease", labelKey: "navMyLease", icon: FileText },
      { to: "agreement", labelKey: "navTenancyAgreement", icon: FileSignature },
    ],
  },
  {
    id: "payments",
    title: "Payments & Utilities",
    labelKey: "paymentsAndUtilities",
    items: [
      { to: "payments", labelKey: "myPaymentHistory", icon: CreditCard },
      { to: "eb-bills", labelKey: "ebBills", icon: Zap },
      { to: "utility-bills", labelKey: "utilityBillsTable", icon: Receipt },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance & Services",
    labelKey: "maintenanceAndServices",
    items: [
      { to: "maintenance", labelKey: "myMaintenanceRequests", icon: Wrench },
      { to: "complaints", labelKey: "myComplaints", icon: AlertCircle },
      { to: "services-complaints", labelKey: "servicesAndComplaints", icon: LifeBuoy },
      { to: "home-services", labelKey: "homeServices", icon: Sparkles },
      { to: "services", labelKey: "fixitLocalServices", icon: Briefcase },
      { to: "my-bookings", labelKey: "myBookings", icon: CalendarCheck },
    ],
  },
  {
    id: "account",
    title: "Account & Documents",
    labelKey: "accountAndDocuments",
    items: [
      { to: "documents", labelKey: "myDocuments", icon: FolderArchive },
      { to: "profile", labelKey: "myProfile", icon: User },
      { to: "settings", labelKey: "settings", icon: Settings },
      { to: "analytics", labelKey: "analytics", icon: TrendingUp },
    ],
  },
];

/**
 * Navigation Groups for other roles (Admin, Landlord, Provider)
 * Kept completely untouched as instructed.
 */
const OTHER_ROLES_NAV_GROUPS = {
  landlord: [
    {
      groupKey: "navOverview",
      items: [
        { to: "", labelKey: "dashboard", icon: LayoutDashboard, end: true },
        { to: "analytics", labelKey: "analytics", icon: TrendingUp },
        { to: "properties", labelKey: "properties", icon: Building2 },
      ],
    },
    {
      groupKey: "navMyRental",
      items: [
        { to: "tenants", labelKey: "tenantsTable", icon: Users },
        { to: "leases", labelKey: "leasesTable", icon: FileText },
        { to: "agreement", labelKey: "rentalAgreement", icon: FileSignature },
        { to: "payments", labelKey: "paymentsInvoices", icon: CreditCard },
        { to: "eb-bills", labelKey: "ebBillManagement", icon: Zap },
        { to: "utility-bills", labelKey: "utilityBillsTable", icon: Receipt },
        { to: "deposits", labelKey: "depositsTable", icon: Shield },
        { to: "expenses", labelKey: "expensesTable", icon: CircleDollarSign },
      ],
    },
    {
      groupKey: "navRequestsAndServices",
      items: [
        { to: "maintenance", labelKey: "maintenanceTable", icon: Wrench },
        { to: "services-complaints", labelKey: "servicesAndComplaints", icon: LifeBuoy },
        { to: "home-services", labelKey: "homeServices", icon: Sparkles },
        { to: "bookings", labelKey: "bookings", icon: CalendarCheck },
        { to: "services", labelKey: "fixitServices", icon: Briefcase },
      ],
    },
    {
      groupKey: "navMyAccount",
      items: [
        { to: "documents", labelKey: "documentsTable", icon: FolderArchive },
        { to: "complaints", labelKey: "complaintsTable", icon: AlertCircle },
        { to: "profile", labelKey: "myProfile", icon: User },
        { to: "settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],

  admin: [
    {
      groupKey: "navOverview",
      items: [
        { to: "", labelKey: "dashboard", icon: LayoutDashboard, end: true },
        { to: "analytics", labelKey: "analytics", icon: TrendingUp },
        { to: "properties", labelKey: "properties", icon: Building2 },
        { to: "landlords", labelKey: "landlordsTable", icon: Briefcase },
        { to: "tenants", labelKey: "tenantsTable", icon: Users },
      ],
    },
    {
      groupKey: "navMyRental",
      items: [
        { to: "leases", labelKey: "leasesTable", icon: FileText },
        { to: "agreement", labelKey: "rentalAgreement", icon: FileSignature },
        { to: "payments", labelKey: "paymentsInvoices", icon: CreditCard },
        { to: "eb-bills", labelKey: "ebBillManagement", icon: Zap },
        { to: "utility-bills", labelKey: "utilityBillsTable", icon: Receipt },
        { to: "deposits", labelKey: "depositsTable", icon: Shield },
        { to: "expenses", labelKey: "expensesTable", icon: CircleDollarSign },
      ],
    },
    {
      groupKey: "navRequestsAndServices",
      items: [
        { to: "maintenance", labelKey: "maintenanceTable", icon: Wrench },
        { to: "home-services", labelKey: "homeServices", icon: Sparkles },
        { to: "service-categories", labelKey: "serviceCategories", icon: Layers },
        { to: "service-providers", labelKey: "serviceProviders", icon: Users },
        { to: "service-bookings", labelKey: "serviceBookings", icon: CalendarCheck },
        { to: "availability-management", labelKey: "availabilityManagement", icon: CalendarCheck },
        { to: "services", labelKey: "fixitServices", icon: Briefcase },
        { to: "services-complaints", labelKey: "servicesAndComplaints", icon: LifeBuoy },
      ],
    },
    {
      groupKey: "navMyAccount",
      items: [
        { to: "documents", labelKey: "documentsTable", icon: FolderArchive },
        { to: "complaints", labelKey: "complaintsTable", icon: AlertCircle },
        { to: "profile", labelKey: "myProfile", icon: User },
        { to: "settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],

  provider: [
    {
      groupKey: "navOverview",
      items: [
        { to: "", labelKey: "dashboard", icon: LayoutDashboard, end: true },
        { to: "bookings", labelKey: "bookings", icon: CalendarCheck },
        { to: "services", labelKey: "fixitServices", icon: Briefcase },
      ],
    },
    {
      groupKey: "navMyAccount",
      items: [
        { to: "profile", labelKey: "myProfile", icon: User },
        { to: "settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],
};

export default function Sidebar({
  role = "tenant",
  mobileOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { t, appName } = useContext(SettingsContext);
  const location = useLocation();

  // Collapsible groups state for Tenant
  const [expandedGroups, setExpandedGroups] = useState({
    rental: true,
    payments: true,
    maintenance: true,
    account: true,
  });

  // Automatically expand the group containing the active route
  useEffect(() => {
    if (role !== "tenant") return;
    const segments = location.pathname.split("/").filter(Boolean);
    // segments[0] is "tenant", segments[1] is active sub-route (e.g. "payments")
    const currentSub = segments[1] || "";
    if (!currentSub) return; // Dashboard is standalone

    TENANT_GROUPS.forEach((group) => {
      const containsActive = group.items.some(
        (item) => item.to === currentSub || currentSub.startsWith(item.to)
      );
      if (containsActive) {
        setExpandedGroups((prev) => {
          if (!prev[group.id]) {
            return { ...prev, [group.id]: true };
          }
          return prev;
        });
      }
    });
  }, [location.pathname, role]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isTenant = role === "tenant";

  return (
    <aside
      className={`sidebar ${mobileOpen ? "mobile-open" : ""} ${
        isCollapsed ? "collapsed" : ""
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className="sidebar-brand">
        <span className="brand-mark">PC</span>
        {!isCollapsed && (
          <div className="brand-name">
            <span
              style={{
                fontSize: "14px",
                lineHeight: "1.3",
                display: "block",
                fontWeight: 700,
                letterSpacing: "-0.2px",
              }}
            >
              {t("appName") || "PropConnect"}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav-scroll">
        {isTenant ? (
          <>
            {/* 1. Dashboard (Standalone menu item outside all groups) */}
            <div className="sidebar-top-standalone">
              <NavLink
                to=""
                end
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
                onClick={onClose}
                title={isCollapsed ? (t("dashboard") || "Dashboard") : undefined}
              >
                <span className="sidebar-icon">
                  <LayoutDashboard size={18} strokeWidth={2.1} />
                </span>
                {!isCollapsed && (
                  <span className="sidebar-label">
                    {t("dashboard") || "Dashboard"}
                  </span>
                )}
              </NavLink>
            </div>

            {/* 2-5. Collapsible Groups */}
            {TENANT_GROUPS.map((group) => {
              const isGroupExpanded = !isCollapsed && !!expandedGroups[group.id];

              return (
                <div key={group.id} className="sidebar-collapsible-section">
                  {/* Collapsible Group Header with Chevron */}
                  {!isCollapsed ? (
                    <button
                      type="button"
                      className="sidebar-collapsible-heading"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isGroupExpanded}
                      title={
                        isGroupExpanded ? "Collapse section" : "Expand section"
                      }
                    >
                      <span className="sidebar-group-title">
                        {t(group.labelKey) || group.title}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`sidebar-chevron-icon ${
                          isGroupExpanded ? "expanded" : "collapsed"
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="sidebar-section-divider" />
                  )}

                  {/* Group Menu Items */}
                  <div
                    className={`sidebar-group-items ${
                      isCollapsed || isGroupExpanded ? "open" : "closed"
                    }`}
                  >
                    {group.items.map((item) => {
                      const IconComponent = item.icon || LayoutDashboard;
                      const label = t(item.labelKey) || item.labelKey;

                      return (
                        <NavLink
                          key={item.labelKey + item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            `sidebar-link ${isActive ? "active" : ""}`
                          }
                          onClick={onClose}
                          title={isCollapsed ? label : undefined}
                        >
                          <span className="sidebar-icon">
                            <IconComponent size={18} strokeWidth={2.1} />
                          </span>
                          {!isCollapsed && (
                            <span className="sidebar-label">{label}</span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* Other roles (Admin, Landlord, Provider) untouched */
          (OTHER_ROLES_NAV_GROUPS[role] || OTHER_ROLES_NAV_GROUPS.landlord).map(
            (group) => (
              <div key={group.groupKey} className="sidebar-nav-group">
                {!isCollapsed && (
                  <div className="sidebar-section-title">
                    {t(group.groupKey) || group.groupKey}
                  </div>
                )}
                {isCollapsed && <div className="sidebar-section-divider" />}

                {group.items.map((item) => {
                  const IconComponent = item.icon || LayoutDashboard;
                  const label = t(item.labelKey) || item.labelKey;

                  return (
                    <NavLink
                      key={item.labelKey + item.to}
                      to={item.to === "" ? "" : item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? "active" : ""}`
                      }
                      onClick={onClose}
                      title={isCollapsed ? label : undefined}
                    >
                      <span className="sidebar-icon">
                        <IconComponent size={18} strokeWidth={2.1} />
                      </span>
                      {!isCollapsed && (
                        <span className="sidebar-label">{label}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            )
          )
        )}
      </nav>

      {/* Footer & Collapse Toggle */}
      <div className="sidebar-footer">
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed && (
              <span style={{ fontSize: "12px" }}>Collapse Menu</span>
            )}
          </button>
        )}

        {!isCollapsed && (
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              paddingLeft: "4px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
              }}
            />
            <span>PropConnect SaaS v2.4</span>
          </div>
        )}
      </div>
    </aside>
  );
}
