import { useContext, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import Chatbot from "./Chatbot.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { SettingsContext } from "../context/SettingsContext.jsx";

export default function DashboardLayout() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tlms-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tlms-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className={`layout ${isCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        role={user?.role || "tenant"}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="layout-main">
        <Topbar
          roleLabel={t(user?.role || "tenant")}
          onToggleNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
      <Chatbot />
    </div>
  );
}
