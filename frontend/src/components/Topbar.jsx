import { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { SettingsContext } from "../context/SettingsContext.jsx";
import BillReminderBell from "./BillReminderBell.jsx";
import { Globe, Settings as SettingsIcon, LogOut, Menu, ChevronRight } from "lucide-react";

export default function Topbar({ roleLabel, onToggleNav, children }) {
  const { user, logout } = useContext(AuthContext);
  const { t, lang, setLang } = useContext(SettingsContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleLang = () => {
    setLang((prev) => (prev === "en" ? "ta" : "en"));
  };

  // Compute active page title for the breadcrumb
  const getPageTitle = () => {
    const segments = location.pathname.split("/").filter(Boolean);
    const subRoute = segments[1] || "";

    const titleMap = {
      "": t("dashboard") || "Dashboard",
      properties: t("navFindProperties") || "Find Properties",
      lease: t("navMyLease") || "My Lease",
      agreement: t("navTenancyAgreement") || "Tenancy Agreement",
      payments: t("navRentPayments") || "Rent Payments",
      "eb-bills": t("navEbAndUtilityBills") || "EB Bills & Utility Bills",
      maintenance: t("navMaintenanceRequests") || "Maintenance Requests",
      "services-complaints": t("navServicesAndComplaints") || "Services & Complaints",
      "home-services": t("navHomeServices") || "Home Services",
      "my-bookings": t("navMyBookings") || "My Bookings",
      documents: t("navMyDocuments") || "My Documents",
      profile: t("myProfile") || "Profile",
      settings: t("settings") || "Settings",
      analytics: t("analytics") || "Analytics",
    };

    return titleMap[subRoute] || (segments[1] ? segments[1].replace("-", " ") : t("dashboard") || "Dashboard");
  };

  // Get user initials
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "PC";

  return (
    <header className="topbar">
      {/* Left: Mobile Nav Toggle + Breadcrumb */}
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleNav}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
          <span className="breadcrumb-portal">{roleLabel} {t("portal")}</span>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <span className="breadcrumb-current">{getPageTitle()}</span>
        </nav>

        {/* Tenant Portal Indicator */}
        <span className="tenant-portal-indicator" title="PropConnect Resident Portal Active">
          <span className="portal-status-dot" />
          <span>{roleLabel} {t("portal")}</span>
        </span>
      </div>

      {/* Right: Actions, Language Switcher, Reminders, User Profile, Settings, Logout */}
      <div className="topbar-right">
        {children}

        {/* Language Switcher */}
        <button
          type="button"
          className="topbar-lang-btn"
          title={lang === "en" ? "தமிழ் மொழிக்கு மாற்றவும்" : "Switch to English"}
          onClick={toggleLang}
          aria-label="Switch Language"
        >
          <Globe size={15} />
          <span className="lang-text">{lang === "en" ? "தமிழ்" : "English"}</span>
        </button>

        {/* Notification Bell with unread count */}
        <BillReminderBell />

        {/* User Profile Avatar & Name */}
        <div
          className="topbar-user-profile"
          onClick={() => navigate("profile")}
          title={`Signed in as ${user?.name} (${user?.email || "Tenant"})`}
          role="button"
          tabIndex={0}
        >
          <div className="user-avatar-circle">
            {initials}
          </div>
          <div className="user-info-text">
            <span className="user-name">{user?.name || "Resident"}</span>
            <span className="user-role-label">{roleLabel}</span>
          </div>
        </div>

        {/* Settings Control */}
        <button
          type="button"
          className="topbar-icon-action"
          title={t("settings")}
          onClick={() => navigate("settings")}
          aria-label={t("settings")}
        >
          <SettingsIcon size={18} />
        </button>

        {/* Logout Control */}
        <button
          type="button"
          className="topbar-logout-btn"
          onClick={handleLogout}
          title={t("logout")}
          aria-label={t("logout")}
        >
          <LogOut size={16} />
          <span className="logout-text">{t("logout")}</span>
        </button>
      </div>
    </header>
  );
}
