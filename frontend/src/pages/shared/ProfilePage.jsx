import { useContext, useState, useEffect, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { landlordById, tenantById, propertyById } from "../../data/db.js";
import {
  fetchProfile,
  updateProfile,
  updateBankingInfo,
  changePassword,
} from "../../utils/apiClient.js";
import "../tenant/TenantAccountDocs.css";

export default function ProfilePage() {
  const { user, login } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const isTenant = user?.role === "tenant";
  const isLandlord = user?.role === "landlord" || user?.role === "admin";
  const entityId = user?.entityId || user?.entity_id || (isTenant ? "TEN001" : "LDL001");

  // Initial lookup fallback
  const initialEntity =
    user?.role === "landlord"
      ? landlordById(entityId)
      : tenantById(entityId);

  // Profile Fields
  const [fullName, setFullName] = useState(initialEntity?.name || user?.name || "Karthik Raja");
  const [email, setEmail] = useState(initialEntity?.email || user?.email || "landlord@propconnect.in");
  const [phone, setPhone] = useState(initialEntity?.phone || "+91 98401 23456");
  const [location, setLocation] = useState(initialEntity?.location || "Chennai, Tamil Nadu");
  const [address, setAddress] = useState(
    initialEntity?.address || "No. 18, 4th Main Road, Anna Nagar West, Chennai - 600040, Tamil Nadu"
  );
  const [avatar, setAvatar] = useState(initialEntity?.avatar || "");
  const [memberSince, setMemberSince] = useState("2024-03-15");
  const [verificationStatus, setVerificationStatus] = useState("Verified");
  const [propertiesCount, setPropertiesCount] = useState(initialEntity?.propertiesCount || 12);
  const [emergencyContact, setEmergencyContact] = useState(initialEntity?.emergencyContact || "");
  const [emergencyPhone, setEmergencyPhone] = useState(initialEntity?.emergencyPhone || "");

  // Banking Fields (Landlord Specific)
  const [accountHolderName, setAccountHolderName] = useState(initialEntity?.name || "Karthik Raja");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [accountNumber, setAccountNumber] = useState("••••••••7890");
  const [isEditingAccountNo, setIsEditingAccountNo] = useState(false);
  const [newAccountNo, setNewAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("HDFC0001234");
  const [branch, setBranch] = useState("Anna Nagar West Branch");
  const [ifscError, setIfscError] = useState("");

  // Associated property (for tenants)
  const activeProperty = initialEntity?.propertyId ? propertyById(initialEntity.propertyId) : null;

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordToast, setPasswordToast] = useState({ text: "", type: "info" });

  // Save states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingBanking, setIsSavingBanking] = useState(false);
  const [profileToast, setProfileToast] = useState({ text: "", type: "info" });
  const [bankingToast, setBankingToast] = useState({ text: "", type: "info" });

  // Load Profile from Backend API
  const loadProfileData = useCallback(async () => {
    try {
      const data = await fetchProfile();
      if (data) {
        if (data.name) setFullName(data.name);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.location) setLocation(data.location);
        if (data.address) setAddress(data.address);
        if (data.avatar) setAvatar(data.avatar);
        if (data.createdAt) setMemberSince(data.createdAt.split("T")[0]);
        if (data.status || data.verificationStatus) {
          setVerificationStatus(data.verificationStatus || data.status);
        }
        if (data.propertiesCount !== undefined) setPropertiesCount(data.propertiesCount);
        if (data.emergencyContact) setEmergencyContact(data.emergencyContact);
        if (data.emergencyPhone) setEmergencyPhone(data.emergencyPhone);

        // Banking data
        if (data.banking) {
          if (data.banking.accountHolderName) setAccountHolderName(data.banking.accountHolderName);
          if (data.banking.bankName) setBankName(data.banking.bankName);
          if (data.banking.accountNumber) setAccountNumber(data.banking.accountNumber);
          if (data.banking.ifscCode) setIfscCode(data.banking.ifscCode);
          if (data.banking.branch) setBranch(data.banking.branch);
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote profile, using offline defaults:", err.message);
    }
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Handle Avatar Upload
  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileToast({ text: "⚠️ Image size exceeds 5MB limit", type: "error" });
      setTimeout(() => setProfileToast({ text: "", type: "info" }), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
      setProfileToast({ text: "✓ Photo selected. Click 'Save Profile' to apply.", type: "info" });
      setTimeout(() => setProfileToast({ text: "", type: "info" }), 4000);
    };
    reader.readAsDataURL(file);
  };

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const payload = {
        name: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        address: address.trim(),
        avatar,
        ...(isTenant ? { emergencyContact, emergencyPhone } : {}),
      };

      await updateProfile(payload);
      setProfileToast({ text: "✓ Profile information updated and saved to MongoDB!", type: "success" });
      setTimeout(() => setProfileToast({ text: "", type: "info" }), 4500);
      loadProfileData();
    } catch (err) {
      setProfileToast({ text: `⚠️ ${err.message || "Failed to update profile"}`, type: "error" });
      setTimeout(() => setProfileToast({ text: "", type: "info" }), 4500);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Banking Update
  const handleBankingSubmit = async (e) => {
    e.preventDefault();

    // Validate IFSC code: 4 letters, 0, 6 alphanumeric
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const upperIfsc = ifscCode.trim().toUpperCase();
    if (!ifscRegex.test(upperIfsc)) {
      setIfscError("Invalid IFSC format. Must be 11 characters (e.g. HDFC0001234).");
      return;
    }
    setIfscError("");

    setIsSavingBanking(true);
    try {
      const payload = {
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        ifscCode: upperIfsc,
        branch: branch.trim(),
      };

      if (isEditingAccountNo && newAccountNo.trim()) {
        payload.accountNumber = newAccountNo.trim();
      }

      const res = await updateBankingInfo(payload);
      setBankingToast({ text: "✓ Verified banking details saved securely to database!", type: "success" });
      setIsEditingAccountNo(false);
      setNewAccountNo("");
      if (res?.banking?.accountNumber) {
        setAccountNumber(res.banking.accountNumber);
      }
      setTimeout(() => setBankingToast({ text: "", type: "info" }), 4500);
      loadProfileData();
    } catch (err) {
      setBankingToast({ text: `⚠️ ${err.message || "Failed to update banking details"}`, type: "error" });
      setTimeout(() => setBankingToast({ text: "", type: "info" }), 4500);
    } finally {
      setIsSavingBanking(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordToast({ text: "Please enter your current password.", type: "error" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordToast({ text: "New password must be at least 6 characters long.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordToast({ text: "New password and confirmation do not match.", type: "error" });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        email: email || user.email,
        currentPassword,
        newPassword,
      });

      if (res && res.success === false) {
        setPasswordToast({ text: `⚠️ ${res.message || "Password change failed"}`, type: "error" });
      } else {
        setPasswordToast({ text: "✓ Password updated successfully!", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
      setTimeout(() => setPasswordToast({ text: "", type: "info" }), 4500);
    } catch (err) {
      setPasswordToast({ text: `⚠️ ${err.message || "Failed to update password"}`, type: "error" });
      setTimeout(() => setPasswordToast({ text: "", type: "info" }), 4500);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "PC";

  return (
    <div className="tad-container">
      <PageHero
        badge="Account &amp; Security"
        title="My Profile &amp; Credentials"
        subtitle="Manage your certified profile, banking information for rent settlements, and account security"
      />

      {/* Two-Column Responsive Layout */}
      <div className="profile-two-column">
        {/* Left Column: Sidebar Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="profile-sidebar-card">
            <div style={{ position: "relative", width: "88px", margin: "0 auto 14px" }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt={fullName}
                  style={{
                    width: "88px",
                    height: "88px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                    border: "3px solid #ffffff",
                  }}
                />
              ) : (
                <div className="profile-avatar-large">{initials}</div>
              )}
              <label
                htmlFor="avatar-upload-input"
                style={{
                  position: "absolute",
                  bottom: "0",
                  right: "0",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#0284c7",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "13px",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                  border: "2px solid #ffffff",
                }}
                title="Upload Profile Picture"
              >
                📷
              </label>
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
              />
            </div>

            <h3 style={{ margin: "0 0 4px", fontSize: "18px", color: "#0f172a" }}>{fullName}</h3>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "13px" }}>{email}</p>

            <div style={{ display: "inline-flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap", justifyContent: "center" }}>
              <span className="tad-status-pill verified">
                ✓ {user.role === "landlord" ? "Verified Landlord" : `${user.role.toUpperCase()} Account`}
              </span>
              <span className="tad-status-pill verified" style={{ background: "#f0fdf4", color: "#166534" }}>
                ID: {entityId}
              </span>
            </div>

            <div
              style={{
                textAlign: "left",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "12.5px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>Registered Phone:</span>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{phone || "Not configured"}</div>
              </div>

              <div>
                <span style={{ color: "#64748b" }}>Location:</span>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{location}</div>
              </div>

              {isLandlord && (
                <div>
                  <span style={{ color: "#64748b" }}>Managed Properties:</span>
                  <div style={{ fontWeight: 600, color: "#0284c7" }}>
                    {propertiesCount} Residential Units Across Tamil Nadu
                  </div>
                </div>
              )}

              {activeProperty && (
                <div>
                  <span style={{ color: "#64748b" }}>Active Leased Property:</span>
                  <div style={{ fontWeight: 600, color: "#0284c7" }}>
                    {activeProperty.name} ({activeProperty.unit || "Unit A-1"})
                  </div>
                </div>
              )}

              <div>
                <span style={{ color: "#64748b" }}>Member Since:</span>
                <div style={{ fontWeight: 600, color: "#334155" }}>{memberSince}</div>
              </div>

              <div>
                <span style={{ color: "#64748b" }}>KYC Status:</span>
                <div style={{ fontWeight: 700, color: "#059669" }}>
                  ● {verificationStatus} (Statutory KYC Tier-1)
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="profile-sidebar-card" style={{ textAlign: "left" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🛡️</span> Security &amp; Compliance
            </h4>
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
              Your bank and identity records are encrypted under 256-bit AES standards. Sensitive bank account numbers are masked in all regular listings.
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Section 1: Personal Information */}
          <form className="profile-form-card" onSubmit={handleProfileSubmit}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Personal Information</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  Update your contact details, residential address, and profile credentials
                </p>
              </div>
              <span style={{ fontSize: "22px" }}>👤</span>
            </div>

            {profileToast.text && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: profileToast.type === "error" ? "#fee2e2" : "#ecfdf5",
                  color: profileToast.type === "error" ? "#b91c1c" : "#047857",
                  border: `1px solid ${profileToast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
                }}
              >
                {profileToast.text}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  Full Name *
                </label>
                <input
                  className="inp"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  Registered Email (Fixed)
                </label>
                <input
                  className="inp"
                  type="email"
                  value={email}
                  disabled
                  style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  Phone Number *
                </label>
                <input
                  className="inp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98400 00000"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  City &amp; State Location
                </label>
                <input
                  className="inp"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Chennai, Tamil Nadu"
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                Permanent Residential / Office Address
              </label>
              <textarea
                className="inp"
                rows="2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, building, locality, pincode"
                style={{ resize: "vertical" }}
              />
            </div>

            {isTenant && (
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "#0f172a" }}>
                  Emergency Contact Details
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "12.5px", marginBottom: "4px" }}>
                      Contact Person &amp; Relation
                    </label>
                    <input
                      className="inp"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="e.g. Suresh Kumar (Brother)"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "12.5px", marginBottom: "4px" }}>
                      Emergency Phone
                    </label>
                    <input
                      className="inp"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+91 94440 00000"
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
              <button type="submit" className="btn-primary" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving to Database..." : "Save Profile Details"}
              </button>
            </div>
          </form>

          {/* Section 2: Banking Information (Landlord / Admin) */}
          {isLandlord && (
            <form className="profile-form-card" onSubmit={handleBankingSubmit}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Banking &amp; Settlement Account</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                    Configure the verified bank account used for rent receipts and tenant security deposit deposits
                  </p>
                </div>
                <span style={{ fontSize: "22px" }}>🏦</span>
              </div>

              {bankingToast.text && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: bankingToast.type === "error" ? "#fee2e2" : "#ecfdf5",
                    color: bankingToast.type === "error" ? "#b91c1c" : "#047857",
                    border: `1px solid ${bankingToast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
                  }}
                >
                  {bankingToast.text}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    Account Holder Name *
                  </label>
                  <input
                    className="inp"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Exact name as in bank passbook"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    Bank Name *
                  </label>
                  <input
                    className="inp"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI, ICICI"
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    Account Number *
                  </label>
                  {!isEditingAccountNo ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        className="inp"
                        value={accountNumber}
                        disabled
                        style={{ background: "#f8fafc", color: "#0f172a", letterSpacing: "1px", fontWeight: 600 }}
                      />
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                        onClick={() => setIsEditingAccountNo(true)}
                      >
                        ✏️ Change
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        className="inp"
                        type="password"
                        value={newAccountNo}
                        onChange={(e) => setNewAccountNo(e.target.value)}
                        placeholder="Enter full new account number"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={() => {
                          setIsEditingAccountNo(false);
                          setNewAccountNo("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    IFSC Code *
                  </label>
                  <input
                    className="inp"
                    value={ifscCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setIfscCode(val);
                      if (val && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val)) {
                        setIfscError("Format: 4 letters, 0, 6 alphanumeric (e.g. HDFC0001234)");
                      } else {
                        setIfscError("");
                      }
                    }}
                    placeholder="e.g. HDFC0001234"
                    maxLength={11}
                    required
                  />
                  {ifscError && (
                    <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "3px" }}>
                      {ifscError}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  Bank Branch Name &amp; Locality
                </label>
                <input
                  className="inp"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Anna Nagar West, Chennai"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                <button type="submit" className="btn-primary" disabled={isSavingBanking}>
                  {isSavingBanking ? "Saving Bank Details..." : "Save Banking Information"}
                </button>
              </div>
            </form>
          )}

          {/* Section 3: Change Password */}
          <form className="profile-form-card" onSubmit={handlePasswordSubmit}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Account Security &amp; Password</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  Protect your landlord portal access with an authenticated password change
                </p>
              </div>
              <span style={{ fontSize: "22px" }}>🔒</span>
            </div>

            {passwordToast.text && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: passwordToast.type === "error" ? "#fee2e2" : "#ecfdf5",
                  color: passwordToast.type === "error" ? "#b91c1c" : "#047857",
                  border: `1px solid ${passwordToast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
                }}
              >
                {passwordToast.text}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                Current Password *
              </label>
              <input
                type="password"
                className="inp"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  New Password *
                </label>
                <input
                  type="password"
                  className="inp"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  className="inp"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
              <button type="submit" className="btn-primary" disabled={isChangingPassword}>
                {isChangingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}