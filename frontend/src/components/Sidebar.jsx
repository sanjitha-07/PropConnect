import { useContext } from "react";
import { NavLink } from "react-router-dom";
import { SettingsContext } from "../context/SettingsContext.jsx";

// Professional inline SVGs for SaaS navigation
const NavIcon = ({ type }) => {
  const props = {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (type) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <path d="M3 20h18" />
        </svg>
      );
    case "landlords":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );
    case "tenants":
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "properties":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "leases":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "payments":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M6 15h2" />
          <path d="M10 15h4" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "services":
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "deposits":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "utilities":
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "expenses":
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "documents":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "complaints":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "profile":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "homeServices":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case "bookings":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      );
    case "categories":
      return (
        <svg {...props}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "providers":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 11v6" />
          <path d="M22 14h-6" />
        </svg>
      );
    case "availability":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
};

/* Navigation items config mapped cleanly to roles */
const NAV_ITEMS = [
  { to: "", labelKey: "dashboard", iconType: "dashboard", roles: ["admin", "landlord", "tenant"], end: true },
  { to: "analytics", labelKey: "analytics", iconType: "analytics", roles: ["admin", "landlord", "tenant"] },
  { to: "properties", labelKey: "properties", iconType: "properties", roles: ["admin", "landlord", "tenant"] },
  { to: "landlords", labelKey: "landlordsTable", iconType: "landlords", roles: ["admin"] },
  { to: "tenants", labelKey: "tenantsTable", iconType: "tenants", roles: ["admin", "landlord"] },
  { to: "lease", labelKey: "myLease", iconType: "leases", roles: ["tenant"] },
  { to: "leases", labelKey: "leasesTable", iconType: "leases", roles: ["admin", "landlord"] },
  { to: "payments", labelKey: "myPayments", iconType: "payments", roles: ["tenant"] },
  { to: "payments", labelKey: "paymentsInvoices", iconType: "payments", roles: ["admin", "landlord"] },
  { to: "eb-bills", labelKey: "ebBills", iconType: "utilities", roles: ["tenant"] },
  { to: "eb-bills", labelKey: "ebBillManagement", iconType: "utilities", roles: ["landlord", "admin"] },
  { to: "maintenance", labelKey: "myMaintenance", iconType: "maintenance", roles: ["tenant"] },
  { to: "maintenance", labelKey: "maintenanceTable", iconType: "maintenance", roles: ["admin", "landlord"] },

  // Home Service Portal & Bookings
  { to: "home-services", labelKey: "homeServices", iconType: "homeServices", roles: ["tenant", "landlord"] },
  { to: "my-bookings", labelKey: "myBookings", iconType: "bookings", roles: ["tenant"] },
  { to: "bookings", labelKey: "bookings", iconType: "bookings", roles: ["landlord"] },

  // Admin Home Services Management
  { to: "service-categories", labelKey: "serviceCategories", iconType: "categories", roles: ["admin"] },
  { to: "service-providers", labelKey: "serviceProviders", iconType: "providers", roles: ["admin"] },
  { to: "service-bookings", labelKey: "serviceBookings", iconType: "bookings", roles: ["admin"] },
  { to: "availability-management", labelKey: "availabilityManagement", iconType: "availability", roles: ["admin"] },

  { to: "services", labelKey: "fixitServices", iconType: "services", roles: ["admin", "landlord", "tenant"] },
  { to: "deposits", labelKey: "depositsTable", iconType: "deposits", roles: ["admin", "landlord"] },
  { to: "utility-bills", labelKey: "utilityBillsTable", iconType: "utilities", roles: ["admin", "landlord"] },
  { to: "expenses", labelKey: "expensesTable", iconType: "expenses", roles: ["admin", "landlord"] },
  { to: "documents", labelKey: "myDocuments", iconType: "documents", roles: ["tenant"] },
  { to: "documents", labelKey: "documentsTable", iconType: "documents", roles: ["admin", "landlord"] },
  { to: "complaints", labelKey: "myComplaints", iconType: "complaints", roles: ["tenant"] },
  { to: "complaints", labelKey: "complaintsTable", iconType: "complaints", roles: ["admin", "landlord"] },
  { to: "profile", labelKey: "myProfile", iconType: "profile", roles: ["admin", "landlord", "tenant"] },
  { to: "settings", labelKey: "settings", iconType: "settings", roles: ["admin", "landlord", "tenant"] },
];

export default function Sidebar({ role, mobileOpen, onClose }) {
  const { t, appName } = useContext(SettingsContext);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">TL</span>
        <div className="brand-name">
          <span style={{ fontSize: "13px", lineHeight: "1.3", display: "block", fontWeight: 700 }}>
            {t("appName")}
          </span>
        </div>
      </div>

      <nav>
        <div className="sidebar-section-title">{t("navigation")}</div>
        {items.map((item) => (
          <NavLink
            key={item.labelKey + item.to}
            to={item.to === "" ? "" : item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            onClick={onClose}
          >
            <span className="sidebar-icon">
              <NavIcon type={item.iconType} />
            </span>
            <span className="sidebar-label">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: "11.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
          <span>SaaS Portal Operational</span>
        </div>
      </div>
    </aside>
  );
}
