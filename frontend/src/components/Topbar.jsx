import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { SettingsContext } from "../context/SettingsContext.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import MongoConsoleModal from "./MongoConsoleModal.jsx";
import BillReminderBell from "./BillReminderBell.jsx";
import { fetchDbStatus } from "../utils/apiClient.js";

export default function Topbar({ roleLabel, onToggleNav, children }) {
  const { user, logout } = useContext(AuthContext);
  const { t, lang, setLang } = useContext(SettingsContext);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mongoModalOpen, setMongoModalOpen] = useState(false);
  const [dbInfo, setDbInfo] = useState({ status: "checking", engine: "MongoDB Compass" });
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchDbStatus().then((data) => {
      if (mounted && data) {
        setDbInfo({
          status: data.status === "connected" ? "online" : "offline",
          engine: data.engine || "MongoDB Compass",
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleLang = () => {
    setLang((prev) => (prev === "en" ? "ta" : "en"));
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
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={onToggleNav}
            aria-label="Toggle navigation menu"
          >
            ☰
          </button>
          <span className="role-chip">
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand-blue)" }} />
            {roleLabel} {t("portal")}
          </span>
          <button
            type="button"
            className="db-chip"
            title="Click to open MongoDB Compass Diagnostics & Live Query Explorer"
            onClick={() => setMongoModalOpen(true)}
          >
            <span
              className="db-dot"
              style={{
                background: dbInfo.status === "online" ? "#10b981" : "#ef4444",
                boxShadow: dbInfo.status === "online" ? "0 0 6px #10b981" : "none",
              }}
            />
            🍃 {dbInfo.engine} ({dbInfo.status === "online" ? t("connected") : t("standby")})
          </button>
        </div>

        <div className="topbar-right">
          {children}

          <button
            type="button"
            className="lang-chip"
            title="Switch Language (English / தமிழ்)"
            onClick={toggleLang}
          >
            🌐 {lang === "en" ? "தமிழ்" : "English"}
          </button>

          <BillReminderBell />

          <div className="user-profile-badge">
            <div className="user-avatar-circle" title={user?.email}>
              {initials}
            </div>
            <span className="user-name">{user?.name}</span>
          </div>

          <button
            type="button"
            className="icon-btn"
            title={t("settings")}
            onClick={() => navigate("settings")}
            aria-label={t("settings")}
          >
            ⚙️
          </button>

          <button type="button" className="btn-outline" onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <MongoConsoleModal isOpen={mongoModalOpen} onClose={() => setMongoModalOpen(false)} />
    </>
  );
}
