import { useState, useEffect } from "react";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceProviders,
  fetchServiceCategories,
  createServiceProvider,
  updateServiceProvider,
  updateServiceProviderStatus,
  deleteServiceProvider,
} from "../../utils/apiClient.js";
import "../../components/services/HomeServicesStyles.css";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STANDARD_SLOTS = ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM", "6:00 PM"];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    category: "Cleaning",
    rating: 4.8,
    experience: "5 years",
    pricingType: "hourly",
    basePrice: 400,
    location: "Chennai",
    skills: "",
    bio: "",
    status: "Active",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    timeSlots: STANDARD_SLOTS,
    maxBookingsPerSlot: 1,
  });
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deletingProvider, setDeletingProvider] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [provs, cats] = await Promise.all([
        fetchServiceProviders(),
        fetchServiceCategories(),
      ]);
      setProviders(Array.isArray(provs) ? provs : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error("Failed to load providers:", err);
      showToast("Failed to load providers list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProvider(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      category: categories[0]?.name || "Cleaning",
      rating: 4.8,
      experience: "5 years",
      pricingType: "hourly",
      basePrice: 400,
      location: "Chennai",
      skills: "",
      bio: "",
      status: "Active",
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      timeSlots: STANDARD_SLOTS,
      maxBookingsPerSlot: 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (prov) => {
    setEditingProvider(prov);
    setFormData({
      name: prov.name,
      phone: prov.phone || "",
      email: prov.email || "",
      category: prov.category || "Cleaning",
      rating: prov.rating || 4.8,
      experience: prov.experience || "5 years",
      pricingType: prov.pricing?.type || "hourly",
      basePrice: prov.pricing?.basePrice || 400,
      location: prov.location || "Chennai",
      skills: Array.isArray(prov.skills) ? prov.skills.join(", ") : "",
      bio: prov.bio || "",
      status: prov.status || "Active",
      workingDays: Array.isArray(prov.workingDays) && prov.workingDays.length > 0 ? prov.workingDays : ALL_DAYS.slice(0, 6),
      timeSlots: Array.isArray(prov.timeSlots) && prov.timeSlots.length > 0 ? prov.timeSlots : STANDARD_SLOTS,
      maxBookingsPerSlot: prov.maxBookingsPerSlot || 1,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      showToast("Provider name and phone are required", "error");
      return;
    }

    setSaving(true);
    try {
      const skillsArray = formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        category: formData.category,
        rating: Number(formData.rating) || 4.8,
        experience: formData.experience,
        pricing: {
          type: formData.pricingType,
          basePrice: Number(formData.basePrice) || 400,
        },
        location: formData.location,
        skills: skillsArray,
        bio: formData.bio.trim(),
        status: formData.status,
        workingDays: formData.workingDays,
        timeSlots: formData.timeSlots,
        maxBookingsPerSlot: Number(formData.maxBookingsPerSlot) || 1,
      };

      if (editingProvider) {
        const idToUpdate = editingProvider.id || editingProvider._id;
        await updateServiceProvider(idToUpdate, payload);
        showToast(`Provider "${payload.name}" updated successfully`);
      } else {
        await createServiceProvider(payload);
        showToast(`Provider "${payload.name}" registered successfully`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to save provider", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusToggle = async (prov, newStatus) => {
    try {
      const id = prov.id || prov._id;
      await updateServiceProviderStatus(id, newStatus);
      showToast(`Provider status set to ${newStatus}`);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to change status", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProvider) return;
    try {
      const id = deletingProvider.id || deletingProvider._id;
      await deleteServiceProvider(id);
      showToast(`Provider "${deletingProvider.name}" removed successfully`);
      setDeletingProvider(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to delete provider", "error");
    }
  };

  const toggleDay = (day) => {
    setFormData((prev) => {
      const exists = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: exists ? prev.workingDays.filter((d) => d !== day) : [...prev.workingDays, day],
      };
    });
  };

  const toggleSlot = (slot) => {
    setFormData((prev) => {
      const exists = prev.timeSlots.includes(slot);
      return {
        ...prev,
        timeSlots: exists ? prev.timeSlots.filter((s) => s !== slot) : [...prev.timeSlots, slot],
      };
    });
  };

  // Filtered providers
  const filteredProviders = providers.filter((p) => {
    if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
    if (selectedStatus !== "All" && p.status !== selectedStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchText = `${p.name} ${p.category} ${p.phone} ${p.email} ${p.location} ${Array.isArray(p.skills) ? p.skills.join(" ") : ""}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="home-services-container">
      {toast && (
        <div className={`hs-toast show ${toast.type === "error" ? "hs-toast-error" : ""}`}>
          {toast.type === "error" ? "⚠️ " : "✓ "} {toast.message}
        </div>
      )}

      <PageHero
        title="Service Providers Master Directory"
        subtitle="Manage verified technicians, trade specializations, hourly tariffs, working rosters, and booking slot limits."
      />

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Providers</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{providers.length}</div>
          <div style={{ fontSize: 12, color: "#0284c7", marginTop: 2 }}>Across all verticals</div>
        </div>

        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Active Technicians</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
            {providers.filter((p) => p.status === "Active").length}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Ready for real-time dispatch</div>
        </div>

        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Average Rating</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f59e0b", marginTop: 4 }}>
            ⭐ {(providers.reduce((acc, p) => acc + (p.rating || 4.5), 0) / (providers.length || 1)).toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Customer satisfaction SLA</div>
        </div>

        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Inactive / Suspended</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#ef4444", marginTop: 4 }}>
            {providers.filter((p) => p.status !== "Active").length}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Paused or off-duty</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hs-card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="hs-input"
            placeholder="Search provider name, skill, phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <select
            className="hs-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.icon || "🛠️"} {c.name}
              </option>
            ))}
          </select>

          <select
            className="hs-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        <button
          type="button"
          className="hs-primary-btn"
          onClick={openAddModal}
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          + Add New Provider
        </button>
      </div>

      {/* Providers Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="hs-spinner" style={{ margin: "0 auto 16px auto" }} />
          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Loading providers…</div>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="hs-card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>No providers matched your filter</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
          {filteredProviders.map((prov) => {
            const isSuspended = prov.status === "Suspended";
            const isInactive = prov.status === "Inactive";

            return (
              <div
                key={prov._id || prov.id}
                className="hs-card"
                style={{
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  opacity: isInactive || isSuspended ? 0.75 : 1,
                  borderLeft: `5px solid ${isSuspended ? "#ef4444" : isInactive ? "#94a3b8" : "#10b981"}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#0284c7", background: "#f0f9ff", padding: "2px 6px", borderRadius: 4 }}>
                          {prov.id || "PROV"}
                        </span>
                        <span
                          className={`hs-status-pill ${
                            prov.status === "Active"
                              ? "hs-status-confirmed"
                              : prov.status === "Suspended"
                              ? "hs-status-cancelled"
                              : "hs-status-pending"
                          }`}
                          style={{ fontSize: 11 }}
                        >
                          {prov.status || "Active"}
                        </span>
                      </div>

                      <h3 style={{ margin: "2px 0", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                        {prov.name}
                      </h3>

                      <div style={{ fontSize: 12.5, color: "#0284c7", fontWeight: 600 }}>
                        {prov.category} • {prov.experience || "5+ yrs exp"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>
                        ⭐ {prov.rating || 4.8}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                        ₹{prov.pricing?.basePrice || 400}
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                          /{prov.pricing?.type === "fixed" ? "visit" : "hr"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Location info */}
                  <div style={{ fontSize: 12.5, color: "#475569", display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                    <div>📞 {prov.phone || "No phone"} {prov.email && `• ✉️ ${prov.email}`}</div>
                    <div>📍 Location: <strong>{prov.location || "Tamil Nadu"}</strong></div>
                  </div>

                  {/* Skills tags */}
                  {Array.isArray(prov.skills) && prov.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                      {prov.skills.map((sk, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "#f1f5f9",
                            color: "#334155",
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Schedule stats */}
                  <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "#475569", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span>Roster Days:</span>
                      <strong>{Array.isArray(prov.workingDays) ? prov.workingDays.length : 6} days/wk</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Time Slots:</span>
                      <strong>{Array.isArray(prov.timeSlots) ? prov.timeSlots.length : 5} slots daily</strong>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {prov.status !== "Active" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusToggle(prov, "Active")}
                        style={{ border: "none", background: "none", fontSize: 11.5, color: "#16a34a", fontWeight: 700, cursor: "pointer" }}
                      >
                        Activate
                      </button>
                    )}
                    {prov.status === "Active" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusToggle(prov, "Inactive")}
                        style={{ border: "none", background: "none", fontSize: 11.5, color: "#f59e0b", fontWeight: 700, cursor: "pointer" }}
                      >
                        Deactivate
                      </button>
                    )}
                    {prov.status !== "Suspended" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusToggle(prov, "Suspended")}
                        style={{ border: "none", background: "none", fontSize: 11.5, color: "#dc2626", fontWeight: 700, cursor: "pointer" }}
                      >
                        Suspend
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="hs-secondary-btn"
                      onClick={() => openEditModal(prov)}
                      style={{ padding: "5px 12px", fontSize: 12 }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="hs-secondary-btn"
                      onClick={() => setDeletingProvider(prov)}
                      style={{ padding: "5px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="hs-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingProvider ? `Edit Provider: ${editingProvider.name}` : "Register New Service Provider"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Provider Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="hs-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Primary Category <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    className="hs-select"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.icon || "🛠️"} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Contact Phone <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="hs-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="hs-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Tariff Rate (₹)
                  </label>
                  <input
                    type="number"
                    className="hs-input"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    min="0"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Tariff Model
                  </label>
                  <select
                    className="hs-select"
                    value={formData.pricingType}
                    onChange={(e) => setFormData({ ...formData, pricingType: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    <option value="hourly">Hourly Rate</option>
                    <option value="fixed">Fixed Visit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Experience
                  </label>
                  <input
                    type="text"
                    className="hs-input"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    placeholder="e.g. 6 years"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Skills / Sub-specializations (comma separated)
                </label>
                <input
                  type="text"
                  className="hs-input"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="e.g. Deep Cleaning, Kitchen Cleaning, Sofa Shampoo"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Working Days */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Weekly Working Days
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_DAYS.map((day) => {
                    const isSelected = formData.workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "1px solid",
                          borderColor: isSelected ? "#0284c7" : "#cbd5e1",
                          background: isSelected ? "#e0f2fe" : "#ffffff",
                          color: isSelected ? "#0369a1" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {isSelected ? "✓ " : ""}{day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily Time Slots */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Daily Time Slots
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {STANDARD_SLOTS.map((slot) => {
                    const isSelected = formData.timeSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "1px solid",
                          borderColor: isSelected ? "#0284c7" : "#cbd5e1",
                          background: isSelected ? "#0284c7" : "#ffffff",
                          color: isSelected ? "#ffffff" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status & Max Bookings */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Operational Status
                  </label>
                  <select
                    className="hs-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Max Concurrent Bookings / Slot
                  </label>
                  <input
                    type="number"
                    className="hs-input"
                    value={formData.maxBookingsPerSlot}
                    onChange={(e) => setFormData({ ...formData, maxBookingsPerSlot: e.target.value })}
                    min="1"
                    max="5"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="hs-secondary-btn"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hs-primary-btn"
                  disabled={saving}
                >
                  {saving ? "Saving…" : editingProvider ? "Update Provider" : "Register Provider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProvider && (
        <div className="hs-modal-overlay" onClick={() => setDeletingProvider(null)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>
              Delete Provider: {deletingProvider.name}
            </h3>
            <p style={{ fontSize: 13.5, color: "#475569", marginBottom: 18 }}>
              Are you sure you want to remove this service provider? Their historical bookings will remain preserved.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="hs-secondary-btn"
                onClick={() => setDeletingProvider(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hs-primary-btn"
                style={{ background: "#dc2626" }}
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
