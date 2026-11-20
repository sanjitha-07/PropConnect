import { useContext, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
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
  Briefcase,
  Bookmark,
  LogOut,
} from "lucide-react";

/**
 * Tenant Navigation Structure (Untouched):
 */
const TENANT_GROUPS = [
  {
    id: "property",
    title: "Property",
    labelKey: "propertyGroup",
    items: [
      { to: "properties", labelKey: "navFindProperties", defaultLabel: "Find Properties", icon: Search },
      { to: "properties?tab=saved", labelKey: "savedProperties", defaultLabel: "Saved Properties", icon: Bookmark },
      { to: "lease", labelKey: "navMyLease", defaultLabel: "My Lease", icon: FileText },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    labelKey: "paymentsGroup",
    items: [
      { to: "payments", labelKey: "paymentsInvoices", defaultLabel: "Payments & Invoices", icon: CreditCard },
      { to: "utility-center", labelKey: "utilityCenter", defaultLabel: "Utility Center", icon: Zap },
    ],
  },
  {
    id: "services",
    title: "Services",
    labelKey: "servicesGroup",
    items: [
      { to: "request-center", labelKey: "requestCenter", defaultLabel: "Request Center", icon: Wrench },
      { to: "home-services", labelKey: "navHomeServices", defaultLabel: "Home Services", icon: Sparkles },
      { to: "my-bookings", labelKey: "navMyBookings", defaultLabel: "My Bookings", icon: CalendarCheck },
    ],
  },
  {
    id: "account",
    title: "Account",
    labelKey: "accountGroup",
    items: [
      { to: "documents", labelKey: "myDocuments", defaultLabel: "My Documents", icon: FolderArchive },
      { to: "profile", labelKey: "myProfile", defaultLabel: "My Profile", icon: User },
      { to: "settings", labelKey: "settings", defaultLabel: "Settings", icon: Settings },
    ],
  },
];

/**
 * Landlord Navigation Structure:
 * - Redundant subheadings for features belonging to the same page are removed.
 * - Same-page features (tabs, buttons, modals) remain directly inside their page components.
 * - Only genuine separate independent pages and routes are retained in the sidebar.
 *
 * 1. Overview: Dashboard (/landlord) - Standalone
 * 2. Property Management (/landlord/properties) - Standalone (All Properties, Add Property modal, Units view inside page)
 * 3. Tenants & Leases (Expandable accordion with genuine independent routes):
 *    - Tenants (/landlord/tenants)
 *    - Leases & Agreements (/landlord/leases)
 * 4. Finance (/landlord/financials) - Standalone (Rent, Deposits, Expenses, Utilities, Analytics inside page)
 * 5. Maintenance (/landlord/requests) - Standalone (Maintenance, Complaints, Bookings, Marketplace inside page)
 * 6. Documents (/landlord/documents) - Standalone (Property, Tenant, Lease categories inside page)
 * 7. Account: My Profile (/landlord/profile) - Standalone
 * 8. Settings (/landlord/settings) - Standalone
 */
const LANDLORD_NAV_ITEMS = [
  // 1. Overview: Dashboard
  {
    id: "overview",
    to: "",
    end: true,
    labelKey: "dashboard",
    defaultLabel: "Dashboard",
    icon: LayoutDashboard,
  },
  // 2. Property Management
  {
    id: "properties",
    to: "properties",
    labelKey: "propertyManagement",
    defaultLabel: "Property Management",
    icon: Building2,
  },
  // 3. Tenants & Leases (Expandable parent with independent child pages)
  {
    id: "tenants-leases",
    title: "Tenants & Leases",
    labelKey: "tenantsAndLeases",
    defaultLabel: "Tenants & Leases",
    icon: Users,
    isExpandable: true,
    items: [
      { to: "tenants", labelKey: "tenantsTable", defaultLabel: "Tenants", icon: Users },
      { to: "leases", labelKey: "leasesAndAgreements", defaultLabel: "Leases & Agreements", icon: FileText },
    ],
  },
  // 4. Financial Management
  {
    id: "finance",
    to: "financials",
    labelKey: "financialManagement",
    defaultLabel: "Financial Management",
    icon: CircleDollarSign,
  },
  // 5. Maintenance & Services
  {
    id: "maintenance",
    to: "requests",
    labelKey: "maintenanceAndServices",
    defaultLabel: "Maintenance & Services",
    icon: Wrench,
  },
  // 6. Documents & KYC
  {
    id: "documents",
    to: "documents",
    labelKey: "documentsAndKyc",
    defaultLabel: "Documents & KYC",
    icon: FolderArchive,
  },
  // 7. Account: My Profile
  {
    id: "profile",
    to: "profile",
    labelKey: "myProfile",
    defaultLabel: "My Profile",
    icon: User,
  },
  // 8. Settings
  {
    id: "settings",
    to: "settings",
    labelKey: "settings",
    defaultLabel: "Settings",
    icon: Settings,
  },
];

/**
 * Navigation Groups for other roles (Admin & Provider kept untouched)
 */
const OTHER_ROLES_NAV_GROUPS = {
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
  const { t } = useContext(SettingsContext);
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  // Collapsible groups state for Tenant
  const [expandedGroups, setExpandedGroups] = useState({
    property: true,
    payments: true,
    services: true,
    account: true,
  });

  // Accordion state for Landlord: Only ONE expandable parent open at a time (or null)
  // On initial load, expand only if current route belongs to an expandable parent
  const [openParentId, setOpenParentId] = useState(() => {
    if (role !== "landlord") return null;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const currentSub = segments[1] || "";
    if (["tenants", "leases", "agreement"].includes(currentSub)) {
      return "tenants-leases";
    }
    return null;
  });

  // Automatically expand the group containing the active route for Tenant
  useEffect(() => {
    if (role !== "tenant") return;
    const segments = location.pathname.split("/").filter(Boolean);
    const currentSub = segments[1] || "";
    if (!currentSub) return;

    const subRouteToGroup = {
      properties: "property",
      lease: "property",
      agreement: "property",
      payments: "payments",
      "utility-center": "payments",
      "eb-bills": "payments",
      "utility-bills": "payments",
      "request-center": "services",
      maintenance: "services",
      complaints: "services",
      "services-complaints": "services",
      "home-services": "services",
      services: "services",
      "my-bookings": "services",
      documents: "account",
      profile: "account",
      settings: "account",
      analytics: "account",
    };

    const targetGroupId = subRouteToGroup[currentSub];
    if (targetGroupId) {
      setExpandedGroups((prev) => {
        if (!prev[targetGroupId]) {
          return { ...prev, [targetGroupId]: true };
        }
        return prev;
      });
    }
  }, [location.pathname, role]);

  // Keep landlord accordion state synchronized on route navigation
  useEffect(() => {
    if (role !== "landlord") return;
    const segments = location.pathname.split("/").filter(Boolean);
    const currentSub = segments[1] || "";

    if (["tenants", "leases", "agreement"].includes(currentSub)) {
      setOpenParentId("tenants-leases");
    } else {
      // Navigating to any other primary page closes the accordion
      setOpenParentId(null);
    }
  }, [location.pathname, role]);

  const toggleTenantGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Exclusive accordion toggle: clicking open parent closes it; clicking closed parent opens it and closes others
  const toggleLandlordParent = (parentId) => {
    setOpenParentId((prev) => (prev === parentId ? null : parentId));
  };

  const isTenantItemActive = (item) => {
    const segments = location.pathname.split("/").filter(Boolean);
    const currentSub = segments[1] || "";
    const isSavedTab = location.search.includes("tab=saved") || location.search.includes("view=saved");

    if (item.to === "properties?tab=saved") {
      return currentSub === "properties" && isSavedTab;
    }
    if (item.to === "properties") {
      return currentSub === "properties" && !isSavedTab;
    }
    if (item.to === "lease") {
      return currentSub === "lease" || currentSub === "agreement";
    }
    if (item.to === "utility-center") {
      return currentSub === "utility-center" || currentSub === "eb-bills" || currentSub === "utility-bills";
    }
    if (item.to === "request-center") {
      return (
        currentSub === "request-center" ||
        currentSub === "maintenance" ||
        currentSub === "complaints" ||
        currentSub === "services-complaints"
      );
    }
    if (item.to === "home-services") {
      return currentSub === "home-services" || currentSub === "services";
    }

    const cleanTo = item.to.split("?")[0];
    return currentSub === cleanTo;
  };

  const isTenant = role === "tenant";
  const isLandlord = role === "landlord";

  // Check current landlord sub-route for subtle parent highlight
  const segments = location.pathname.split("/").filter(Boolean);
  const currentLandlordSub = segments[1] || "";
  const isTenantsOrLeasesActive = ["tenants", "leases", "agreement"].includes(currentLandlordSub);

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
        {/* ---------------- TENANT PORTAL (UNTOUCHED) ---------------- */}
        {isTenant ? (
          <>
            {/* 1. Dashboard (Standalone menu item) */}
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

            {/* Collapsible Groups */}
            {TENANT_GROUPS.map((group) => {
              const isGroupExpanded = !isCollapsed && !!expandedGroups[group.id];

              return (
                <div key={group.id} className="sidebar-collapsible-section">
                  {!isCollapsed ? (
                    <button
                      type="button"
                      className="sidebar-collapsible-heading"
                      onClick={() => toggleTenantGroup(group.id)}
                      aria-expanded={isGroupExpanded}
                      title={isGroupExpanded ? "Collapse section" : "Expand section"}
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

                  <div
                    className={`sidebar-group-items ${
                      isCollapsed || isGroupExpanded ? "open" : "closed"
                    }`}
                  >
                    {group.items.map((item) => {
                      const IconComponent = item.icon || LayoutDashboard;
                      const label = t(item.labelKey) || item.defaultLabel || item.labelKey;

                      return (
                        <NavLink
                          key={item.labelKey + item.to}
                          to={item.to}
                          end={item.end}
                          className={() =>
                            `sidebar-link ${isTenantItemActive(item) ? "active" : ""}`
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
        ) : isLandlord ? (
          /* ---------------- CORRECTED LANDLORD PORTAL NAVIGATION ---------------- */
          <>
            {LANDLORD_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon || LayoutDashboard;
              const itemLabel = t(item.labelKey) || item.defaultLabel || item.title;

              // Expandable Parent Menu (Tenants & Leases)
              if (item.isExpandable) {
                const isOpen = !isCollapsed && openParentId === item.id;
                const hasActiveChild = isTenantsOrLeasesActive;

                return (
                  <div key={item.id} className="sidebar-collapsible-section">
                    {/* Collapsed Mode: Click navigates to tenants */}
                    {isCollapsed ? (
                      <NavLink
                        to="tenants"
                        className={() =>
                          `sidebar-link ${hasActiveChild ? "active" : ""}`
                        }
                        onClick={onClose}
                        title={itemLabel}
                      >
                        <span className="sidebar-icon">
                          <IconComponent size={18} strokeWidth={2.1} />
                        </span>
                      </NavLink>
                    ) : (
                      /* Expanded Mode: Accordion Toggle Header */
                      <button
                        type="button"
                        className={`sidebar-collapsible-heading ${hasActiveChild ? "has-active-child" : ""}`}
                        onClick={() => toggleLandlordParent(item.id)}
                        aria-expanded={isOpen}
                        title={isOpen ? `Collapse ${itemLabel}` : `Expand ${itemLabel}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <IconComponent size={16} strokeWidth={2.1} />
                          <span className="sidebar-group-title">{itemLabel}</span>
                        </div>
                        <ChevronDown
                          size={14}
                          className={`sidebar-chevron-icon ${isOpen ? "expanded" : "collapsed"}`}
                        />
                      </button>
                    )}

                    {/* Submenu: Render only independent child pages */}
                    <div className={`sidebar-group-items ${isOpen ? "open" : "closed"}`}>
                      {isOpen &&
                        item.items.map((subItem) => {
                          const SubIcon = subItem.icon || IconComponent;
                          const subLabel = t(subItem.labelKey) || subItem.defaultLabel;

                          return (
                            <NavLink
                              key={subItem.to}
                              to={subItem.to}
                              className={({ isActive }) =>
                                `sidebar-link sidebar-sub-item ${isActive ? "active" : ""}`
                              }
                              onClick={onClose}
                            >
                              <span className="sidebar-icon" style={{ width: "15px", height: "15px" }}>
                                <SubIcon size={15} strokeWidth={2} />
                              </span>
                              <span className="sidebar-label">{subLabel}</span>
                            </NavLink>
                          );
                        })}
                    </div>
                  </div>
                );
              }

              // Standalone Menu Items (Dashboard, Properties, Finance, Maintenance, Documents, Profile, Settings)
              return (
                <div key={item.id} className="sidebar-standalone-section" style={{ marginBottom: "2px" }}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""}`
                    }
                    onClick={() => {
                      setOpenParentId(null);
                      if (onClose) onClose();
                    }}
                    title={isCollapsed ? itemLabel : undefined}
                  >
                    <span className="sidebar-icon">
                      <IconComponent size={18} strokeWidth={2.1} />
                    </span>
                    {!isCollapsed && (
                      <span className="sidebar-label">{itemLabel}</span>
                    )}
                  </NavLink>
                </div>
              );
            })}

            {/* Bottom Landlord Account Card & Logout */}
            <div className="sidebar-landlord-account">
              <div className="sidebar-user-card">
                <div className="sidebar-user-avatar">
                  {user?.name
                    ? user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "LL"}
                </div>
                {!isCollapsed && (
                  <div className="sidebar-user-info">
                    <span className="sidebar-user-name" title={user?.name || "Karthik Raja"}>
                      {user?.name || "Karthik Raja"}
                    </span>
                    <span className="sidebar-user-role" title={user?.email || "Landlord"}>
                      {user?.email || "Landlord"}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="sidebar-logout-btn"
                onClick={() => {
                  if (logout) logout();
                  if (onClose) onClose();
                }}
                title={t("logout") || "Logout"}
              >
                <LogOut size={15} />
                {!isCollapsed && <span>{t("logout") || "Logout"}</span>}
              </button>
            </div>
          </>
        ) : (
          /* ---------------- ADMIN & PROVIDER ROLES (UNTOUCHED) ---------------- */
          (OTHER_ROLES_NAV_GROUPS[role] || OTHER_ROLES_NAV_GROUPS.admin).map(
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
