import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { SettingsContext } from "../context/SettingsContext.jsx";

const ROLE_DEMO = {
  admin: { email: "admin@propconnect.com", password: "admin123" },
  landlord: { email: "karthik.raja@mail.com", password: "land123" },
  tenant: { email: "divya.priya@mail.com", password: "tenant123" },
  provider: { email: "provider@propconnect.com", password: "provider123" },
};

const GOOGLE_ACCOUNTS = [
  {
    name: "Sanjitha Raja",
    email: "sanjitha.raja@gmail.com",
    role: "landlord",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sanjitha",
    location: "Chennai, Tamil Nadu",
  },
  {
    name: "Karthik Raja",
    email: "karthik.raja@gmail.com",
    role: "landlord",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Karthik",
    location: "Coimbatore, Tamil Nadu",
  },
  {
    name: "Divya Priya",
    email: "divyapriya.tn@gmail.com",
    role: "tenant",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Divya",
    location: "T. Nagar, Chennai",
  },
  {
    name: "Admin User",
    email: "admin.tn@propconnect.com",
    role: "admin",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
    location: "State Administrator",
  },
  {
    name: "Kumar Services (Pro)",
    email: "provider@propconnect.com",
    role: "provider",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kumar",
    location: "Chennai, Tamil Nadu",
  },
];

const CAPABILITIES = [
  { label: "Landlords & Tenants Roster", icon: "👥" },
  { label: "Properties & Multi-unit Portfolios", icon: "🏢" },
  { label: "Lease Agreements & Term Tracking", icon: "📜" },
  { label: "Rent Invoices & Payment Ledgers", icon: "💳" },
  { label: "Maintenance Tickets & Work Orders", icon: "🛠️" },
  { label: "Utility Meter Bills & Municipal Dues", icon: "⚡" },
  { label: "Operational Expenses & Outflow", icon: "📊" },
  { label: "Tenant Complaints & Resolution", icon: "🔔" },
  { label: "Security Deposits in Escrow", icon: "🛡️" },
  { label: "KYC & Tenancy Document Vault", icon: "📁" },
];

export default function Login() {
  const { login, loginWithGoogle, registerTenant, registerProvider } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();

  // Mode: "login" or "register"
  const [authMode, setAuthMode] = useState("login");

  // Login states
  const [role, setRole] = useState("landlord");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration states
  const [regRole, setRegRole] = useState("tenant"); // "tenant" or "provider"
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regCity, setRegCity] = useState("Chennai");
  const [regLocality, setRegLocality] = useState("");
  const [regFamilyMembers, setRegFamilyMembers] = useState(2);
  const [regCategory, setRegCategory] = useState("CAT_CIVIL");
  const [regHourlyRate, setRegHourlyRate] = useState(450);
  const [regBio, setRegBio] = useState("");
  const [regExperienceYears, setRegExperienceYears] = useState(3);

  // Google Sign-In Modal states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState(null);
  const [googlePasswordStep, setGooglePasswordStep] = useState(false);
  const [googlePassword, setGooglePassword] = useState("");
  const [signingInAccount, setSigningInAccount] = useState(null);

  const handleRoleSelect = (r) => {
    setRole(r);
    setError("");
  };

  const handleUseDemoAccount = (r) => {
    setRole(r);
    setEmail(ROLE_DEMO[r].email);
    setPassword(ROLE_DEMO[r].password);
    setError("");
  };

  const handleOpenGoogleModal = () => {
    setError("");
    setSelectedGoogleAccount(null);
    setGooglePasswordStep(false);
    setGooglePassword("");
    setSigningInAccount(null);
    setShowGoogleModal(true);
  };

  const handleSelectGoogleAccount = (acc) => {
    setSelectedGoogleAccount(acc);
    setGooglePasswordStep(true);
  };

  const handleGooglePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!googlePassword) return;
    setSigningInAccount(selectedGoogleAccount);
    const result = await loginWithGoogle(selectedGoogleAccount);
    setTimeout(() => {
      if (result.success) {
        setShowGoogleModal(false);
        navigate(`/${result.role}`);
      }
    }, 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("invalidCredentials") || "Please enter your email and password");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(t("invalidCredentials") || "Invalid credentials. Please verify your email and password.");
        setIsSubmitting(false);
        return;
      }
      navigate(`/${result.role}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!regName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!regEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError("Please enter a valid email address (e.g., name@example.com).");
      return;
    }
    if (!regPhone.trim()) {
      setError("Please enter your mobile number.");
      return;
    }
    const cleanPhone = regPhone.replace(/[\s\-\(\)]/g, "");
    if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number (e.g., 98412 34567).");
      return;
    }
    if (!regPassword) {
      setError("Please create a password.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match. Please re-enter identical passwords.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerTenant({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
        preferredCity: regCity,
        preferredLocality: regLocality.trim(),
        familyMembers: Number(regFamilyMembers) || 2,
      });

      if (!res.success) {
        setError(res.message || "Failed to create account. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg("Account created successfully! Welcome to PropConnect. Logging you in…");
      setTimeout(() => {
        navigate("/tenant");
      }, 800);
    } catch (err) {
      setError("An unexpected error occurred during account creation. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-split-container">
        {/* Left Side: Product Branding & Capabilities Overview */}
        <div className="login-brand-panel">
          <div className="login-brand-header">
            <span className="brand-mark large">TL</span>
            <div className="login-brand-title">
              <div>Tenant &amp; Landlord</div>
              <small style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8, display: "block" }}>
                Management System
              </small>
            </div>
            <span className="brand-badge">SaaS</span>
          </div>

          <div className="login-brand-content">
            <h1 className="login-hero-heading" style={{ fontSize: "24px", lineHeight: "1.3", margin: "14px 0 10px" }}>
              Comprehensive Property, Lease &amp; Rental Management
            </h1>
            <p className="login-hero-text" style={{ fontSize: "13.5px", lineHeight: "1.5", margin: "0 0 20px" }}>
              An intuitive, unified cloud platform designed for modern landlords, property managers, and resident tenants across Tamil Nadu.
            </p>

            {/* Feature Matrix */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.04)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: "20px",
              }}
            >
              {CAPABILITIES.map((cap) => (
                <div
                  key={cap.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#cbd5e1",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{cap.icon}</span>
                  <span>{cap.label}</span>
                </div>
              ))}
            </div>

            {/* Constrained Architecture Visual Card */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff" }}>
                  Centralized Ledger &amp; KYC
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  Automated UPI invoices, tenancy agreements &amp; service logs
                </div>
              </div>
              <span className="pill verified" style={{ fontSize: "11px", whiteSpace: "nowrap" }}>
                ✓ Live &amp; Verified
              </span>
            </div>
          </div>

          <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "20px" }}>
            © 2026 Tenant &amp; Landlord Management System. All rights reserved.
          </div>
        </div>

        {/* Right Side: Clean Authentication Panel */}
        <div className="login-form-panel">
          <div className="login-form-box" style={{ maxWidth: "440px", width: "100%" }}>
            
            {/* Top Switcher: Existing User Login vs New Tenant Registration */}
            <div className="auth-mode-switch" style={{ marginBottom: "20px" }}>
              <button
                type="button"
                className={`auth-mode-btn ${authMode === "login" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                  setSuccessMsg("");
                }}
              >
                Existing User? Login
              </button>
              <button
                type="button"
                className={`auth-mode-btn ${authMode === "register" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                  setSuccessMsg("");
                }}
              >
                New Tenant? Create Account
              </button>
            </div>

            {/* Error & Success Notification Banners */}
            {error && (
              <div
                className="error-msg"
                style={{
                  background: "var(--red-bg)",
                  color: "var(--red)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  marginBottom: "14px",
                  border: "1px solid var(--red-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div
                className="success-msg"
                style={{
                  background: "var(--green-bg)",
                  color: "var(--green)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  marginBottom: "14px",
                  border: "1px solid var(--green-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✓</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* ----------------- MODE A: EXISTING USER LOGIN ----------------- */}
            {authMode === "login" ? (
              <>
                <h2 className="login-title" style={{ fontSize: "22px", marginBottom: "4px" }}>
                  {t("welcomeBack") || "Welcome Back"}
                </h2>
                <p className="login-subtitle" style={{ fontSize: "13px", marginBottom: "18px" }}>
                  Sign in with your role to access your management dashboard.
                </p>

                {/* Role Switcher Tabs */}
                <div className="role-tab-switcher" style={{ marginBottom: "16px" }}>
                  {["admin", "landlord", "tenant", "provider"].map((r) => (
                    <button
                      type="button"
                      key={r}
                      className={`role-tab ${role === r ? "active" : ""}`}
                      onClick={() => handleRoleSelect(r)}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Google Sign-In Button */}
                <button
                  type="button"
                  className="btn-outline"
                  style={{
                    width: "100%",
                    padding: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                  }}
                  onClick={handleOpenGoogleModal}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2.0 10.05.0 12s.47 3.8 1.29 5.42l3.99-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span style={{ fontWeight: 500 }}>Sign in with Google</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0", color: "var(--ink-muted)", fontSize: "11.5px" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                  <span>OR EMAIL SIGN IN</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                </div>

                <form onSubmit={handleSubmit} autoComplete="off">
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label className="form-label">{t("email") || "Email Address"}</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "16px" }}>
                    <label className="form-label">{t("password") || "Password"}</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                    style={{ width: "100%", padding: "10px", fontSize: "13.5px" }}
                  >
                    {isSubmitting ? "Signing in…" : `${t("loginButton") || "Sign In"} →`}
                  </button>
                </form>

                {/* Quick Demo Autofill Helper */}
                <div className="quick-demo-helpers" style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="demo-title" style={{ fontSize: "11.5px", color: "var(--ink-muted)", marginBottom: "8px", fontWeight: 600 }}>
                    Demo Accounts (Click to test):
                  </div>
                  <div className="demo-chips-row" style={{ display: "flex", gap: "8px" }}>
                    {[
                      { id: "admin", label: "Admin", icon: "👑" },
                      { id: "landlord", label: "Landlord", icon: "🏠" },
                      { id: "tenant", label: "Tenant", icon: "👤" },
                      { id: "provider", label: "Provider (Pro)", icon: "🛠️" },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="btn-demo-chip"
                        onClick={() => handleUseDemoAccount(item.id)}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* New Tenant Callout Card */}
                <div className="new-tenant-callout-card" style={{ marginTop: "18px", padding: "12px 14px", background: "rgba(37, 99, 235, 0.05)", border: "1px dashed rgba(37, 99, 235, 0.3)", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "4px" }}>
                    New to PropConnect?
                  </div>
                  <p style={{ fontSize: "11.5px", color: "var(--ink-muted)", margin: "0 0 10px 0" }}>
                    Looking for verified homes in Tamil Nadu? Set up a free tenant account.
                  </p>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ width: "100%", padding: "7px", fontSize: "12.5px", fontWeight: 600, color: "var(--brand-blue)" }}
                    onClick={() => {
                      setAuthMode("register");
                      setError("");
                      setSuccessMsg("");
                    }}
                  >
                    ✨ Create Tenant Account →
                  </button>
                </div>
              </>
            ) : (
              /* ----------------- MODE B: REGISTRATION (TENANT OR PROVIDER) ----------------- */
              <>
                <h2 className="login-title" style={{ fontSize: "22px", marginBottom: "4px" }}>
                  {regRole === "provider" ? "Register as Service Provider" : "Create Tenant Account"}
                </h2>
                <p className="login-subtitle" style={{ fontSize: "13px", marginBottom: "14px" }}>
                  {regRole === "provider"
                    ? "Offer civil, plumbing, electrical, cleaning & home maintenance services."
                    : "Join PropConnect to discover verified rental homes and connect with Tamil Nadu landlords."}
                </p>

                {/* Account Type Selector */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "var(--bg-subtle, #f1f5f9)", padding: "4px", borderRadius: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setRegRole("tenant")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      background: regRole === "tenant" ? "var(--color-primary, #2563eb)" : "transparent",
                      color: regRole === "tenant" ? "#ffffff" : "var(--ink-secondary, #475569)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    👤 Tenant Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("provider")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      background: regRole === "provider" ? "var(--color-primary, #2563eb)" : "transparent",
                      color: regRole === "provider" ? "#ffffff" : "var(--ink-secondary, #475569)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    🛠️ Service Provider (Pro)
                  </button>
                </div>

                <form onSubmit={handleRegisterSubmit} autoComplete="off">
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label className="form-label">Full Name <span style={{ color: "var(--red)" }}>*</span></label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Ananya Sundaram"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div className="form-group">
                      <label className="form-label">Email Address <span style={{ color: "var(--red)" }}>*</span></label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="name@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mobile Number <span style={{ color: "var(--red)" }}>*</span></label>
                      <input
                        className="form-input"
                        type="tel"
                        placeholder="+91 98412 34567"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div className="form-group">
                      <label className="form-label">Password <span style={{ color: "var(--red)" }}>*</span></label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Min 6 characters"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm Password <span style={{ color: "var(--red)" }}>*</span></label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Re-enter password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div className="form-group">
                      <label className="form-label">Preferred City (TN)</label>
                      <select
                        className="form-input"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                      >
                        <option value="Chennai">Chennai</option>
                        <option value="Coimbatore">Coimbatore</option>
                        <option value="Madurai">Madurai</option>
                        <option value="Trichy">Trichy</option>
                        <option value="Salem">Salem</option>
                        <option value="Tiruppur">Tiruppur</option>
                        <option value="Vellore">Vellore</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Preferred Locality</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="e.g. OMR, Velachery, T. Nagar"
                        value={regLocality}
                        onChange={(e) => setRegLocality(e.target.value)}
                      />
                    </div>
                  </div>

                  {regRole === "tenant" ? (
                    <div className="form-group" style={{ marginBottom: "18px" }}>
                      <label className="form-label">Number of Family Members</label>
                      <select
                        className="form-input"
                        value={regFamilyMembers}
                        onChange={(e) => setRegFamilyMembers(Number(e.target.value))}
                      >
                        <option value={1}>1 Person (Individual)</option>
                        <option value={2}>2 Persons (Couple / Small Family)</option>
                        <option value={3}>3 Persons</option>
                        <option value={4}>4 Persons (Family)</option>
                        <option value={5}>5+ Persons (Large Family)</option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="form-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                        <div className="form-group">
                          <label className="form-label">Primary Service Domain <span style={{ color: "var(--red)" }}>*</span></label>
                          <select
                            className="form-input"
                            value={regCategory}
                            onChange={(e) => setRegCategory(e.target.value)}
                            required
                          >
                            <option value="CAT_CIVIL">Civil Work (Masonry & Tile)</option>
                            <option value="CAT_PLUMB">Plumbing Services</option>
                            <option value="CAT_ELEC">Electrical Services</option>
                            <option value="CAT_CLEAN">Deep Cleaning Services</option>
                            <option value="CAT_AC">Air Conditioning (HVAC)</option>
                            <option value="CAT_CARP">Carpentry & Woodwork</option>
                            <option value="CAT_PAINT">Painting & Waterproofing</option>
                            <option value="CAT_PEST">Pest Control & Fumigation</option>
                            <option value="CAT_APPL">Appliance Repair</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Standard Visiting Rate (₹) <span style={{ color: "var(--red)" }}>*</span></label>
                          <input
                            className="form-input"
                            type="number"
                            min="100"
                            step="50"
                            placeholder="e.g. 450"
                            value={regHourlyRate}
                            onChange={(e) => setRegHourlyRate(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                        <div className="form-group">
                          <label className="form-label">Experience (Years)</label>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            max="50"
                            value={regExperienceYears}
                            onChange={(e) => setRegExperienceYears(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Service Specialization</label>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. Masonry, Bathroom waterproofing"
                            value={regBio}
                            onChange={(e) => setRegBio(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                    style={{ width: "100%", padding: "11px", fontSize: "14px", fontWeight: 600 }}
                  >
                    {isSubmitting ? "Submitting Registration…" : regRole === "provider" ? "Register as Service Provider →" : "Create Tenant Account →"}
                  </button>
                </form>

                <div style={{ marginTop: "16px", textAlign: "center", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="btn-text"
                    style={{ fontWeight: 600, color: "var(--brand-blue)", padding: 0 }}
                    onClick={() => {
                      setAuthMode("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                  >
                    Login here
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Google Sign-in Selector Modal */}
      {showGoogleModal && (
        <div className="modal-backdrop" onClick={() => setShowGoogleModal(false)}>
          <div className="modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2.0 10.05.0 12s.47 3.8 1.29 5.42l3.99-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <h3 className="modal-title" style={{ fontSize: "15px" }}>
                  {googlePasswordStep ? "Verify Account" : "Sign in with Google"}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowGoogleModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {!googlePasswordStep ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                    Select an account to continue to Tenant &amp; Landlord Management System:
                  </p>
                  {GOOGLE_ACCOUNTS.map((acc) => (
                    <div
                      key={acc.email}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onClick={() => handleSelectGoogleAccount(acc)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <img src={acc.avatar} alt={acc.name} style={{ width: "36px", height: "36px", borderRadius: "50%" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{acc.name}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>{acc.email}</div>
                      </div>
                      <span className="pill active">{acc.role}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleGooglePasswordSubmit}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: "8px" }}>
                    <img src={selectedGoogleAccount.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{selectedGoogleAccount.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>{selectedGoogleAccount.email}</div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter account password"
                      value={googlePassword}
                      onChange={(e) => setGooglePassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: "100%", padding: "10px", marginTop: "10px" }}
                  >
                    {signingInAccount ? "Authenticating…" : "Continue →"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
