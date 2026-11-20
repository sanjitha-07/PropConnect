import { useContext, useState, useEffect } from "react";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchDbStatus,
  changePassword,
  fetchLandlordSettings,
  saveLandlordSettings,
} from "../../utils/apiClient.js";
import { isValidHex, normalizeHex } from "../../utils/themeGenerator.js";

export default function SettingsPage() {
  const {
    theme,
    setTheme,
    primaryColor,
    setPrimaryColor,
    palette,
    accent,
    setAccent,
    themePresets,
    fontFamily,
    setFontFamily,
    globalFonts,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    currency,
    setCurrency,
    dateFormat,
    setDateFormat,
    appName,
    setAppName,
    emailNotifications,
    setEmailNotifications,
    paymentReminders,
    setPaymentReminders,
    maintenanceAlerts,
    setMaintenanceAlerts,
    leaseExpiryAlerts,
    setLeaseExpiryAlerts,
    isSyncingDb,
    lastSyncedAt,
    syncSettingsToDatabase,
    t,
  } = useContext(SettingsContext);

  const { user, logout } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const isLandlord = user?.role === "landlord" || isAdmin;

  const [activeTab, setActiveTab] = useState("appearance");
  const [dbStatus, setDbStatus] = useState(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [saveToast, setSaveToast] = useState("");

  // Landlord Notification & Reminder Preferences (Persisted in MongoDB)
  const [rentPaymentsNotif, setRentPaymentsNotif] = useState(true);
  const [maintenanceNotif, setMaintenanceNotif] = useState(true);
  const [complaintNotif, setComplaintNotif] = useState(true);
  const [bookingNotif, setBookingNotif] = useState(true);
  const [leaseExpiryNotif, setLeaseExpiryNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [smsAlertsNotif, setSmsAlertsNotif] = useState(false);

  // Payment & Rent Reminders Preferences
  const [autoRentReminders, setAutoRentReminders] = useState(true);
  const [reminderLeadDays, setReminderLeadDays] = useState(3);
  const [gracePeriodDays, setGracePeriodDays] = useState(5);
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState(250);

  // Fetch Landlord Settings from Database on Mount
  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      if (!isLandlord) return;
      try {
        const remote = await fetchLandlordSettings();
        if (remote && mounted) {
          if (remote.notificationPreferences) {
            const np = remote.notificationPreferences;
            if (np.rentPayments !== undefined) setRentPaymentsNotif(np.rentPayments);
            if (np.maintenanceUpdates !== undefined) setMaintenanceNotif(np.maintenanceUpdates);
            if (np.complaintAlerts !== undefined) setComplaintNotif(np.complaintAlerts);
            if (np.bookingAlerts !== undefined) setBookingNotif(np.bookingAlerts);
            if (np.leaseExpiryAlerts !== undefined) setLeaseExpiryNotif(np.leaseExpiryAlerts);
            if (np.emailNotifications !== undefined) setEmailNotif(np.emailNotifications);
            if (np.inAppNotifications !== undefined) setInAppNotif(np.inAppNotifications);
            if (np.smsAlerts !== undefined) setSmsAlertsNotif(np.smsAlerts);
          }
          if (remote.paymentPreferences) {
            const pp = remote.paymentPreferences;
            if (pp.autoRentReminders !== undefined) setAutoRentReminders(pp.autoRentReminders);
            if (pp.reminderLeadDays !== undefined) setReminderLeadDays(pp.reminderLeadDays);
            if (pp.gracePeriodDays !== undefined) setGracePeriodDays(pp.gracePeriodDays);
            if (pp.lateFeeEnabled !== undefined) setLateFeeEnabled(pp.lateFeeEnabled);
            if (pp.lateFeeAmount !== undefined) setLateFeeAmount(pp.lateFeeAmount);
          }
        }
      } catch (err) {
        console.warn("Could not load landlord settings from database:", err.message);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, [isLandlord]);

  // Custom Hex Input State
  const [customHexInput, setCustomHexInput] = useState(primaryColor);
  const [hexError, setHexError] = useState("");

  // Sync customHexInput when primaryColor changes from presets or remote
  useEffect(() => {
    setCustomHexInput(primaryColor);
    setHexError("");
  }, [primaryColor]);

  // Account password change form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ text: "", isError: false });

  // Privacy preferences (for tenants and users)
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [activityAuditLogging, setActivityAuditLogging] = useState(true);
  const [dataCommunications, setDataCommunications] = useState(true);

  const handleExportDataArchive = () => {
    const data = {
      tenantId: user?.entityId || user?.entity_id || "TEN001",
      name: user?.name,
      email: user?.email,
      role: user?.role,
      exportDate: new Date().toISOString(),
      platform: "PropConnect Tenant Portal",
      complianceNotice: "Exported in accordance with DPDP Act 2023 regulations.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propconnect-data-export-${user?.entityId || "tenant"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast(language === "ta" ? "✓ தனிப்பட்ட தரவு காப்பகம் பதிவிறக்கப்பட்டது" : "✓ Personal data archive exported successfully!");
  };

  const loadDbInfo = async () => {
    if (!isAdmin) return;
    setIsTestingDb(true);
    const data = await fetchDbStatus();
    setDbStatus(data);
    setIsTestingDb(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadDbInfo();
    } else if (activeTab === "system") {
      setActiveTab("appearance");
    }
  }, [isAdmin, activeTab]);

  const triggerToast = (msg) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(""), 3500);
  };

  const handleCustomHexChange = (val) => {
    setCustomHexInput(val);
    const trimmed = (val || "").trim();
    if (!trimmed) {
      setHexError("");
      return;
    }
    const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (isValidHex(candidate)) {
      setHexError("");
      setPrimaryColor(candidate);
    } else {
      setHexError(t("invalidCredentials", "Invalid hex format"));
    }
  };

  const handleApplyCustomHex = () => {
    const candidate = customHexInput.startsWith("#") ? customHexInput : `#${customHexInput}`;
    if (isValidHex(candidate)) {
      setPrimaryColor(candidate);
      setHexError("");
      triggerToast(`${t("saveChanges")}: ${normalizeHex(candidate)}`);
    } else {
      setHexError("Please enter a valid 3 or 6-digit hex color.");
    }
  };

  const handleSaveToDatabase = async () => {
    try {
      const res = await syncSettingsToDatabase();
      if (isLandlord) {
        await saveLandlordSettings({
          notificationPreferences: {
            rentPayments: rentPaymentsNotif,
            maintenanceUpdates: maintenanceNotif,
            complaintAlerts: complaintNotif,
            bookingAlerts: bookingNotif,
            leaseExpiryAlerts: leaseExpiryNotif,
            emailNotifications: emailNotif,
            inAppNotifications: inAppNotif,
            smsAlerts: smsAlertsNotif,
          },
          paymentPreferences: {
            autoRentReminders,
            reminderLeadDays: Number(reminderLeadDays),
            gracePeriodDays: Number(gracePeriodDays),
            lateFeeEnabled,
            lateFeeAmount: Number(lateFeeAmount),
          },
          appearance: {
            theme,
            primaryColor,
            language,
          },
        });
      }
      triggerToast(language === "ta" ? "✓ விருப்பங்கள் MongoDB Compass-ல் வெற்றிகரமாகச் சேமிக்கப்பட்டன!" : "✓ Preferences synchronized and saved to MongoDB Compass!");
    } catch (err) {
      triggerToast(`⚠️ ${err.message || "Failed to persist to database"}`);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      setPasswordMsg({ text: "Please enter your current password.", isError: true });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: t("atLeast6Chars", "New password must be at least 6 characters long."), isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: language === "ta" ? "புதிய கடவுச்சொற்கள் பொருந்தவில்லை." : "New password and confirmation do not match.", isError: true });
      return;
    }

    try {
      const res = await changePassword({
        email: user?.email,
        currentPassword: oldPassword,
        newPassword,
      });

      if (res && res.success === false) {
        setPasswordMsg({ text: `⚠️ ${res.message || "Current password does not match"}`, isError: true });
      } else {
        setPasswordMsg({ text: language === "ta" ? "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!" : "Password updated successfully!", isError: false });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        triggerToast(t("saveChanges", "Security credentials updated"));
      }
    } catch (err) {
      setPasswordMsg({ text: `⚠️ ${err.message || "Failed to update password"}`, isError: true });
    }
  };

  // Helper for preset translated label
  const getPresetLabel = (preset) => {
    const key = `preset${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}`;
    return t(key, preset.name);
  };

  return (
    <div className="settings-container">
      <PageHero
        badge={t("settingsBadge")}
        title={t("settingsTitle")}
        subtitle={t("settingsSubtitle")}
      />

      {saveToast && (
        <div className="app-toast-container">
          <div className="app-toast success">
            <span>✓</span> {saveToast}
          </div>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="settings-nav-tabs">
        <button
          className={`settings-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
          onClick={() => setActiveTab("appearance")}
        >
          🎨 {t("appearanceThemes")}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          🌐 {t("generalRegion")}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          🔔 {t("notificationsTab")}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          👤 {t("accountSecurity")}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
          onClick={() => setActiveTab("privacy")}
        >
          🛡️ {t("privacyTab", "Privacy")}
        </button>
        {isAdmin && (
          <button
            className={`settings-tab-btn ${activeTab === "system" ? "active" : ""}`}
            onClick={() => setActiveTab("system")}
          >
            ⚡ {t("systemDatabase")}
          </button>
        )}
      </div>

      {/* ----------------- TAB: APPEARANCE ----------------- */}
      {activeTab === "appearance" && (
        <>
          {/* Theme Mode */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("colorMode")}</h3>
              <p>{t("colorModeDesc")}</p>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">{t("appTheme")}</div>
                <div className="settings-row-desc">
                  {t("currentlyActive")}: {theme === "dark" ? t("darkModeActive") : t("lightModeActive")}
                </div>
              </div>
              <div className="size-toggle-group">
                <button
                  type="button"
                  className={`size-toggle-btn ${theme === "light" ? "active" : ""}`}
                  onClick={() => {
                    setTheme("light");
                    triggerToast(t("lightModeActive"));
                  }}
                >
                  ☀️ {t("lightMode")}
                </button>
                <button
                  type="button"
                  className={`size-toggle-btn ${theme === "dark" ? "active" : ""}`}
                  onClick={() => {
                    setTheme("dark");
                    triggerToast(t("darkModeActive"));
                  }}
                >
                  🌙 {t("darkMode")}
                </button>
              </div>
            </div>
          </div>

          {/* Curated Brand Presets */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("brandPaletteTitle")}</h3>
              <p>{t("brandPaletteDesc")}</p>
            </div>

            <div className="accent-palette-grid">
              {(themePresets || []).map((item) => {
                const isActive = primaryColor.toUpperCase() === item.hex.toUpperCase();
                const localizedName = getPresetLabel(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`accent-palette-btn ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setAccent(item.id);
                      triggerToast(`${localizedName} (${item.hex})`);
                    }}
                  >
                    <span
                      className="palette-swatch-circle"
                      style={{
                        background: item.hex,
                        boxShadow: isActive ? `0 0 0 2px #ffffff, 0 0 0 4px ${item.hex}` : "none",
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                      <span className="palette-swatch-name">{localizedName}</span>
                      <span style={{ fontSize: "10.5px", color: "var(--ink-muted)", fontFamily: "monospace" }}>
                        {item.hex}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Picker & WCAG AA Contrast Evaluation */}
            <div className="custom-color-box">
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "10px", color: "var(--ink-primary)" }}>
                {t("customHexTitle")}
              </div>
              <div className="custom-color-controls">
                <div
                  className="native-color-picker-wrapper"
                  title="Click to open system color picker"
                  style={{ background: primaryColor }}
                >
                  <input
                    type="color"
                    className="native-color-picker-input"
                    value={primaryColor}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    aria-label="Pick custom color"
                  />
                </div>

                <div className="hex-input-group">
                  <span className="hex-prefix">#</span>
                  <input
                    type="text"
                    className="hex-text-input"
                    value={customHexInput.replace(/^#/, "")}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    placeholder="1976D2"
                    maxLength={6}
                  />
                </div>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleApplyCustomHex}
                  style={{ fontSize: "12px", padding: "8px 14px" }}
                >
                  {t("applyHex")}
                </button>

                {/* WCAG Accessibility Contrast Pill */}
                <div className="contrast-pill">
                  <div
                    className="contrast-sample-swatch"
                    style={{
                      background: primaryColor,
                      color: palette?.primaryContrast || "#ffffff",
                    }}
                  >
                    Aa
                  </div>
                  <div>
                    <span style={{ color: "var(--ink-primary)" }}>{t("contrastCompliant")}</span>:{" "}
                    <span style={{ color: "var(--ink-muted)" }}>
                      Text {palette?.primaryContrast} on {primaryColor} (WCAG AA 4.5:1+)
                    </span>
                  </div>
                </div>
              </div>

              {hexError && (
                <div style={{ color: "var(--red)", fontSize: "12px", marginTop: "8px", fontWeight: 500 }}>
                  ⚠️ {hexError}
                </div>
              )}
            </div>

            {/* Interactive Live Component Preview */}
            <div className="theme-preview-box">
              <div className="theme-preview-title">{t("uiPreviewTitle")}</div>
              <div className="theme-preview-items">
                <button type="button" className="preview-btn-primary">
                  {t("addPropertyBtn")}
                </button>
                <button type="button" className="preview-btn-outline">
                  {t("downloadAgreement")}
                </button>
                <div className="preview-badge">
                  <span>✓</span> {t("activeLeaseFlat")}
                </div>
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: `1.5px solid ${palette?.primaryBorder || "#bbdefb"}`,
                    background: palette?.primaryLight || "#f0f7ff",
                    color: primaryColor,
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {t("selectedAccentIndicator")}
                </div>
              </div>
            </div>
          </div>

          {/* Typography Family */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("typographyTitle")}</h3>
              <p>{t("typographyDesc")}</p>
            </div>
            <div className="font-choice-grid">
              {(globalFonts || []).map((font) => {
                const isActive = fontFamily.toLowerCase() === font.id.toLowerCase();
                return (
                  <div
                    key={font.id}
                    className={`font-choice-card ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setFontFamily(font.id);
                      triggerToast(`${font.name}`);
                    }}
                  >
                    <div className="font-choice-card-header">
                      <div className="font-choice-title">{font.name}</div>
                      <span className="font-category-tag">{font.category}</span>
                    </div>
                    <div className="font-choice-preview">{font.description}</div>
                    <div
                      className="font-sample-display"
                      style={{ fontFamily: font.fontFamily }}
                    >
                      {t("fontSampleText")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Font Scaling */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("fontScalingTitle")}</h3>
              <p>{t("fontScalingDesc")}</p>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">{t("fontSize")}</div>
                <div className="settings-row-desc">{t("fontSizeScaleDesc")}</div>
              </div>
              <div className="size-toggle-group">
                {[
                  { id: "small", label: t("fontSmall") },
                  { id: "medium", label: t("fontMedium") },
                  { id: "large", label: t("fontLarge") },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`size-toggle-btn ${fontSize === s.id ? "active" : ""}`}
                    onClick={() => {
                      setFontSize(s.id);
                      triggerToast(s.label);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MongoDB Persistence Banner */}
          <div className="settings-sync-footer">
            <div className="sync-status-indicator">
              <span className="sync-pulse-dot" />
              <div>
                <div className="sync-info-title">{t("mongoPersistenceTitle")}</div>
                <div className="sync-info-subtitle">
                  {lastSyncedAt
                    ? `${t("lastSyncedWithDb")} ${lastSyncedAt.toLocaleTimeString()}`
                    : t("cachedLocally")}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveToDatabase}
              disabled={isSyncingDb}
              style={{
                background: primaryColor,
                color: palette?.primaryContrast || "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isSyncingDb ? t("savingToMongo") : t("saveToMongo")}
            </button>
          </div>
        </>
      )}

      {/* ----------------- TAB: GENERAL ----------------- */}
      {activeTab === "general" && (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>{t("generalPrefTitle")}</h3>
            <p>{t("generalPrefDesc")}</p>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("appNameLabel")}</div>
              <div className="settings-row-desc">{t("appNameDesc")}</div>
            </div>
            <div style={{ width: "320px" }}>
              <input
                className="form-input"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="PropConnect Management System"
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("languageLabel")}</div>
              <div className="settings-row-desc">{t("languageDesc")}</div>
            </div>
            <div className="size-toggle-group">
              <button
                type="button"
                className={`size-toggle-btn ${language === "en" ? "active" : ""}`}
                onClick={() => {
                  setLanguage("en");
                  triggerToast("Language set to English");
                }}
              >
                English
              </button>
              <button
                type="button"
                className={`size-toggle-btn ${language === "ta" ? "active" : ""}`}
                onClick={() => {
                  setLanguage("ta");
                  triggerToast("மொழி: தமிழ் தேர்ந்தெடுக்கப்பட்டது");
                }}
              >
                தமிழ் (Tamil)
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("currencySymbolLabel")}</div>
              <div className="settings-row-desc">{t("currencySymbolDesc")}</div>
            </div>
            <div style={{ width: "220px" }}>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  triggerToast(`${t("currencySymbolLabel")}: ${e.target.value}`);
                }}
              >
                <option value="INR">₹ INR ({language === "ta" ? "இந்திய ரூபாய்" : "Indian Rupee"})</option>
                <option value="USD">$ USD ({language === "ta" ? "அமெரிக்க டாலர்" : "US Dollar"})</option>
                <option value="EUR">€ EUR ({language === "ta" ? "யூரோ" : "Euro"})</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("dateFormatLabel")}</div>
              <div className="settings-row-desc">{t("dateFormatDesc")}</div>
            </div>
            <div style={{ width: "220px" }}>
              <select
                className="form-select"
                value={dateFormat}
                onChange={(e) => {
                  setDateFormat(e.target.value);
                  triggerToast(`${t("dateFormatLabel")}: ${e.target.value}`);
                }}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 24/09/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("timeZoneLabel")}</div>
              <div className="settings-row-desc">{t("timeZoneDesc")}</div>
            </div>
            <div style={{ width: "220px" }}>
              <select className="form-select" defaultValue="Asia/Kolkata">
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveToDatabase}
              disabled={isSyncingDb}
              style={{ background: primaryColor, color: palette?.primaryContrast || "#ffffff" }}
            >
              {isSyncingDb ? t("savingToMongo") : t("saveChangesToDb")}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TAB: NOTIFICATIONS & REMINDERS ----------------- */}
      {activeTab === "notifications" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card 1: Operational Activity Alerts */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Operational Activity Alerts</h3>
              <p>Choose which property events trigger notifications for your landlord account</p>
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Rent Payment Alerts</div>
                <div className="settings-row-desc">Receive instant notifications when tenants submit rent payments or utility settlements</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={rentPaymentsNotif}
                onChange={(e) => {
                  setRentPaymentsNotif(e.target.checked);
                  triggerToast(e.target.checked ? "Rent payment alerts enabled" : "Rent payment alerts disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Maintenance Tickets &amp; Updates</div>
                <div className="settings-row-desc">Alerts when maintenance tickets are logged, reviewed, or assigned to specialists</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={maintenanceNotif}
                onChange={(e) => {
                  setMaintenanceNotif(e.target.checked);
                  triggerToast(e.target.checked ? "Maintenance alerts enabled" : "Maintenance alerts disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Tenant Complaint Alerts</div>
                <div className="settings-row-desc">Real-time alerts when tenants raise noise, water supply, or building complaints</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={complaintNotif}
                onChange={(e) => {
                  setComplaintNotif(e.target.checked);
                  triggerToast(e.target.checked ? "Complaint alerts enabled" : "Complaint alerts disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Home Services &amp; Provider Bookings</div>
                <div className="settings-row-desc">Updates when local service specialists schedule or complete home repairs</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={bookingNotif}
                onChange={(e) => {
                  setBookingNotif(e.target.checked);
                  triggerToast(e.target.checked ? "Booking alerts enabled" : "Booking alerts disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Lease Expiry Reminders</div>
                <div className="settings-row-desc">Automatic warnings 60, 30, and 15 days before registered tenancy agreements expire</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={leaseExpiryNotif}
                onChange={(e) => {
                  setLeaseExpiryNotif(e.target.checked);
                  triggerToast(e.target.checked ? "Lease expiry alerts enabled" : "Lease expiry alerts disabled");
                }}
              />
            </div>
          </div>

          {/* Card 2: Delivery Channels */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Notification Delivery Channels</h3>
              <p>Configure how alerts are delivered to you and your maintenance team</p>
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Email Notifications</div>
                <div className="settings-row-desc">Send official activity notices and monthly financial statements to {user?.email}</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={emailNotif}
                onChange={(e) => {
                  setEmailNotif(e.target.checked);
                  setEmailNotifications(e.target.checked);
                  triggerToast(e.target.checked ? "Email delivery enabled" : "Email delivery disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">In-App Dashboard Alerts</div>
                <div className="settings-row-desc">Surface badge counters and notification drawer banners within PropConnect</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={inAppNotif}
                onChange={(e) => {
                  setInAppNotif(e.target.checked);
                  triggerToast(e.target.checked ? "In-app alerts enabled" : "In-app alerts disabled");
                }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">SMS &amp; WhatsApp Notifications</div>
                <div className="settings-row-desc">Urgent emergency alerts and instant rent payment confirmations via mobile SMS</div>
              </div>
              <input
                type="checkbox"
                style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                checked={smsAlertsNotif}
                onChange={(e) => {
                  setSmsAlertsNotif(e.target.checked);
                  triggerToast(e.target.checked ? "SMS alerts enabled" : "SMS alerts disabled");
                }}
              />
            </div>
          </div>

          {/* Card 3: Payment & Rent Reminders (Landlord Automation) */}
          {isLandlord && (
            <div className="settings-card">
              <div className="settings-card-header">
                <h3>Payment &amp; Rent Reminder Automation</h3>
                <p>Configure automated tenant reminders, grace periods, and late fee policies</p>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-title">Automated Tenant Rent Reminders</div>
                  <div className="settings-row-desc">Automatically dispatch courteous rent payment reminders to tenants prior to due dates</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                  checked={autoRentReminders}
                  onChange={(e) => {
                    setAutoRentReminders(e.target.checked);
                    setPaymentReminders(e.target.checked);
                    triggerToast(e.target.checked ? "Auto rent reminders enabled" : "Auto rent reminders disabled");
                  }}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-title">Reminder Dispatch Lead Days</div>
                  <div className="settings-row-desc">Number of days before rent due date (1st of month) to send reminder notice</div>
                </div>
                <div style={{ width: "160px" }}>
                  <select
                    className="form-select"
                    value={reminderLeadDays}
                    onChange={(e) => setReminderLeadDays(Number(e.target.value))}
                  >
                    <option value={1}>1 day before</option>
                    <option value={3}>3 days before</option>
                    <option value={5}>5 days before</option>
                    <option value={7}>7 days before</option>
                  </select>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-title">Grace Period Duration</div>
                  <div className="settings-row-desc">Number of calendar days after due date before rent invoice is marked Overdue</div>
                </div>
                <div style={{ width: "160px" }}>
                  <select
                    className="form-select"
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                  >
                    <option value={3}>3 calendar days</option>
                    <option value={5}>5 calendar days</option>
                    <option value={7}>7 calendar days</option>
                    <option value={10}>10 calendar days</option>
                  </select>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-title">Automated Late Fee Calculation</div>
                  <div className="settings-row-desc">Automatically calculate statutory late penalty on invoices unpaid after grace period</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: "20px", height: "20px", accentColor: primaryColor }}
                  checked={lateFeeEnabled}
                  onChange={(e) => setLateFeeEnabled(e.target.checked)}
                />
              </div>

              {lateFeeEnabled && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <div className="settings-row-title">Late Fee Fixed Penalty (₹)</div>
                    <div className="settings-row-desc">Fixed statutory penalty applied per overdue monthly rental billing cycle</div>
                  </div>
                  <div style={{ width: "160px" }}>
                    <input
                      type="number"
                      className="form-input"
                      value={lateFeeAmount}
                      onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                      placeholder="250"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveToDatabase}
              disabled={isSyncingDb}
              style={{ background: primaryColor, color: palette?.primaryContrast || "#ffffff" }}
            >
              {isSyncingDb ? t("savingToMongo") : "Save All Preferences to MongoDB"}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TAB: ACCOUNT & SECURITY ----------------- */}
      {activeTab === "account" && (
        <>
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("activeProfileTitle")}</h3>
              <p>{t("activeProfileDesc")}</p>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">{t("fullName")}</div>
                <div className="settings-row-desc">{user?.name || "User"}</div>
              </div>
              <span className="pill active">{t(user?.role || "user")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">{t("email")}</div>
                <div className="settings-row-desc">{user?.email || "user@mail.com"}</div>
              </div>
              <span className="pill verified">{t("verifiedPill")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">{t("entityIdLabel")}</div>
                <div className="settings-row-desc">{user?.entityId || user?.entity_id || "N/A"}</div>
              </div>
            </div>

            <div className="settings-row" style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
              <div className="settings-row-info">
                <div className="settings-row-title">Active Session &amp; Sign Out</div>
                <div className="settings-row-desc">Signed in as {user?.email} ({user?.role || "landlord"})</div>
              </div>
              <button
                type="button"
                className="btn-outline"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={() => {
                  if (logout) logout();
                  else window.location.href = "/login";
                }}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-header">
              <h3>{t("changePasswordTitle")}</h3>
              <p>{t("changePasswordDesc")}</p>
            </div>
            <form onSubmit={handlePasswordSubmit} style={{ maxWidth: "480px" }}>
              {passwordMsg.text && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    fontWeight: 500,
                    background: passwordMsg.isError ? "var(--red-bg)" : "var(--green-bg)",
                    color: passwordMsg.isError ? "var(--red)" : "var(--green)",
                    border: `1px solid ${passwordMsg.isError ? "var(--red-border)" : "var(--green-border)"}`,
                  }}
                >
                  {passwordMsg.text}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{t("currentPasswordLabel")}</label>
                <input
                  type="password"
                  className="form-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t("enterCurrentPwd")}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("newPasswordLabel")}</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("atLeast6Chars")}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("confirmPasswordLabel")}</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("repeatNewPwd")}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{
                  marginTop: "10px",
                  background: primaryColor,
                  color: palette?.primaryContrast || "#ffffff",
                }}
              >
                {t("updatePasswordBtn")}
              </button>
            </form>
          </div>
        </>
      )}

      {/* ----------------- TAB: PRIVACY ----------------- */}
      {activeTab === "privacy" && (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>{language === "ta" ? "தனியுரிமை மற்றும் தரவுப் பாதுகாப்பு" : "Privacy & Data Protection"}</h3>
            <p>
              {language === "ta"
                ? "உங்கள் தனிப்பட்ட தகவல் தெரிவுநிலை, தகவல் தொடர்பு விருப்பங்கள் மற்றும் தரவு பகிர்வை நிர்வகிக்கவும்"
                : "Manage your personal visibility, communication consents, and data rights."}
            </p>
          </div>

          {/* Setting 1: Profile Visibility */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">
                {language === "ta" ? "சுயவிவர தெரிவுநிலை கட்டுப்பாடு" : "Restricted Profile Visibility"}
              </div>
              <div className="settings-row-desc">
                {language === "ta"
                  ? "சரிபார்க்கப்பட்ட சொத்து மேலாளர்கள் மற்றும் அங்கீகரிக்கப்பட்ட சேவை தொழில்நுட்ப வல்லுநர்களுக்கு மட்டுமே தொடர்பு விவரங்கள் தெரியும்"
                  : "Only verified property managers and authorized service dispatchers can view your contact information."}
              </div>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={profileVisibility}
                onChange={(e) => {
                  setProfileVisibility(e.target.checked);
                  triggerToast(language === "ta" ? "✓ விருப்பம் புதுப்பிக்கப்பட்டது" : "✓ Profile visibility updated");
                }}
              />
              <span className="settings-slider" />
            </label>
          </div>

          {/* Setting 2: Activity Logging */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">
                {language === "ta" ? "பாதுகாப்பான செயல்பாடு தணிக்கை பதிவு" : "Audit Trail & Activity Logging"}
              </div>
              <div className="settings-row-desc">
                {language === "ta"
                  ? "வாடகை கொடுப்பனவுகள் மற்றும் சேவை முன்பதிவுகளுக்கான பாதுகாப்பு தணிக்கை பதிவுகளைப் பராமரிக்கவும்"
                  : "Keep an encrypted audit trail of maintenance requests, payment verifications, and lease interactions."}
              </div>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={activityAuditLogging}
                onChange={(e) => {
                  setActivityAuditLogging(e.target.checked);
                  triggerToast(language === "ta" ? "✓ விருப்பம் புதுப்பிக்கப்பட்டது" : "✓ Audit trail preferences updated");
                }}
              />
              <span className="settings-slider" />
            </label>
          </div>

          {/* Setting 3: Important Notices & Communications */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">
                {language === "ta" ? "அத்தியாவசிய அறிவிப்பு சம்மதம்" : "Service Communications & Notices"}
              </div>
              <div className="settings-row-desc">
                {language === "ta"
                  ? "வாடகை ரசீதுகள் மற்றும் கட்டண நினைவூட்டல்களுக்கான மின்னஞ்சல் & எஸ்எம்எஸ் பெறவும்"
                  : "Receive digital rent receipts, utility statements, and building maintenance notices."}
              </div>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={dataCommunications}
                onChange={(e) => {
                  setDataCommunications(e.target.checked);
                  triggerToast(language === "ta" ? "✓ விருப்பம் புதுப்பிக்கப்பட்டது" : "✓ Communication preferences updated");
                }}
              />
              <span className="settings-slider" />
            </label>
          </div>

          {/* Setting 4: Data Export */}
          <div className="settings-row" style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "16px", paddingTop: "16px" }}>
            <div className="settings-row-info">
              <div className="settings-row-title">
                {language === "ta" ? "தனிப்பட்ட தரவு காப்பகம் பதிவிறக்கம்" : "Personal Data Portability"}
              </div>
              <div className="settings-row-desc">
                {language === "ta"
                  ? "உங்கள் முழுமையான சுயவிவரம், வாடகை மற்றும் ஆவணங்களின் நகலை JSON வடிவத்தில் பதிவிறக்கவும்"
                  : "Export a complete copy of your profile, verified records, and preferences in JSON format."}
              </div>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={handleExportDataArchive}
              style={{ fontSize: "12.5px", padding: "6px 14px", fontWeight: 600 }}
            >
              📥 {language === "ta" ? "தரவை பதிவிறக்கு" : "Export Archive"}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TAB: SYSTEM & DATABASE (Admin only) ----------------- */}
      {isAdmin && activeTab === "system" && (
        <div className="settings-card">
          <div
            className="settings-card-header"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <h3>{t("systemDbTitle")}</h3>
              <p>{t("systemDbDesc")}</p>
            </div>
            <button
              className="btn-outline"
              onClick={loadDbInfo}
              disabled={isTestingDb}
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              {isTestingDb ? t("pingingStatus") : t("refreshStatusBtn")}
            </button>
          </div>

          <div
            style={{
              padding: "16px 20px",
              borderRadius: "10px",
              background: dbStatus?.status === "connected" ? "var(--green-bg)" : "var(--amber-bg)",
              border: `1px solid ${dbStatus?.status === "connected" ? "var(--green-border)" : "var(--amber-border)"}`,
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <span style={{ fontSize: "28px" }}>{dbStatus?.status === "connected" ? "🍃" : "⚠️"}</span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  color: dbStatus?.status === "connected" ? "var(--green)" : "var(--amber)",
                  fontSize: "15px",
                }}
              >
                {dbStatus?.status === "connected" ? t("mongoOperational") : t("mongoStandby")}
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-secondary)", marginTop: "2px" }}>
                {dbStatus?.status === "connected"
                  ? `${t("mongoConnectedDesc")} "${dbStatus?.database || "propconnect_db"}" at ${dbStatus?.host || "127.0.0.1"}`
                  : t("mongoDisconnectedDesc")}
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("compassUriLabel")}</div>
              <div className="settings-row-desc">{dbStatus?.compassUri || "mongodb://127.0.0.1:27017"}</div>
            </div>
            <button
              className="btn-outline"
              style={{ fontSize: "11px", padding: "5px 10px" }}
              onClick={() => {
                navigator.clipboard?.writeText(dbStatus?.compassUri || "mongodb://127.0.0.1:27017");
                triggerToast(t("copied"));
              }}
            >
              {t("copyCompassUriBtn")}
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">{t("dbNameLabel")}</div>
              <div className="settings-row-desc">{dbStatus?.database || "propconnect_db"}</div>
            </div>
            <span className="pill completed">{t("activeSchemaPill")}</span>
          </div>

          {dbStatus?.collections && (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "13px",
                  marginBottom: "10px",
                  color: "var(--ink-primary)",
                }}
              >
                {t("collectionCountsTitle")}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                  gap: "10px",
                }}
              >
                {Object.entries(dbStatus.collections).map(([name, count]) => (
                  <div
                    key={name}
                    style={{
                      background: "var(--bg-subtle)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        textTransform: "capitalize",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {name.replace(/_/g, " ")}
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: primaryColor,
                        marginTop: "2px",
                      }}
                    >
                      {count} {t("recordsCount")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
