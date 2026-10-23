import { useState, useEffect } from "react";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
} from "../../utils/apiClient.js";
import "../../components/services/HomeServicesStyles.css";

export default function ServiceCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState("All");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "🛠️",
    description: "",
    basePrice: 500,
    subServices: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load service categories:", err);
      showToast("Failed to fetch service categories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      icon: "🛠️",
      description: "",
      basePrice: 500,
      subServices: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      icon: cat.icon || "🛠️",
      description: cat.description || "",
      basePrice: cat.basePrice || 500,
      subServices: Array.isArray(cat.subServices) ? cat.subServices.join(", ") : "",
      isActive: cat.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Category name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const subServicesArray = formData.subServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: formData.name.trim(),
        icon: formData.icon.trim() || "🛠️",
        description: formData.description.trim(),
        basePrice: Number(formData.basePrice) || 0,
        subServices: subServicesArray,
        isActive: formData.isActive,
      };

      if (editingCategory) {
        const idToUpdate = editingCategory.id || editingCategory._id;
        await updateServiceCategory(idToUpdate, payload);
        showToast(`Category "${payload.name}" updated successfully`);
      } else {
        await createServiceCategory(payload);
        showToast(`Category "${payload.name}" created successfully`);
      }

      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      showToast(err.message || "Failed to save category", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      const idToUpdate = cat.id || cat._id;
      const updatedStatus = !cat.isActive;
      await updateServiceCategory(idToUpdate, { isActive: updatedStatus });
      showToast(`Category "${cat.name}" is now ${updatedStatus ? "Active" : "Disabled"}`);
      await loadCategories();
    } catch (err) {
      showToast(err.message || "Failed to update category status", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      const idToDelete = deletingCategory.id || deletingCategory._id;
      await deleteServiceCategory(idToDelete);
      showToast(`Category "${deletingCategory.name}" removed successfully`);
      setDeletingCategory(null);
      await loadCategories();
    } catch (err) {
      showToast(err.message || "Failed to delete category", "error");
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (filterActive === "Active" && !c.isActive) return false;
    if (filterActive === "Inactive" && c.isActive) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (Array.isArray(c.subServices) && c.subServices.some((s) => s.toLowerCase().includes(q)))
      );
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
        title="Service Categories Master Catalog"
        subtitle="Configure the 8 primary property maintenance verticals, baseline inspection rates, and sub-service packages."
      />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Verticals</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{categories.length}</div>
          <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Supported maintenance domains</div>
        </div>

        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Active on Portal</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0284c7", marginTop: 4 }}>
            {categories.filter((c) => c.isActive !== false).length}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Selectable by tenants & landlords</div>
        </div>

        <div className="hs-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Sub-Services</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>
            {categories.reduce((acc, c) => acc + (c.subServices?.length || 0), 0)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Granular service offerings</div>
        </div>
      </div>

      {/* Action Strip */}
      <div className="hs-card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="hs-input"
            placeholder="Search category name or sub-service…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <div style={{ display: "flex", gap: 6 }}>
            {["All", "Active", "Inactive"].map((f) => (
              <button
                key={f}
                type="button"
                className={`hs-filter-btn ${filterActive === f ? "active" : ""}`}
                onClick={() => setFilterActive(f)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: filterActive === f ? "#0284c7" : "#cbd5e1",
                  background: filterActive === f ? "#0284c7" : "#ffffff",
                  color: filterActive === f ? "#ffffff" : "#475569",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="hs-primary-btn"
          onClick={openAddModal}
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          + Add New Category
        </button>
      </div>

      {/* Grid of Categories */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="hs-spinner" style={{ margin: "0 auto 16px auto" }} />
          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Loading categories…</div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="hs-card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>No categories match your filter</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
          {filteredCategories.map((cat) => (
            <div
              key={cat._id || cat.id}
              className="hs-card"
              style={{
                padding: 22,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: cat.isActive === false ? 0.7 : 1,
                borderTop: `4px solid ${cat.isActive === false ? "#cbd5e1" : "#0284c7"}`,
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 32 }}>{cat.icon || "🛠️"}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                        {cat.name}
                      </h3>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Base fee starts at ₹{cat.basePrice || 0}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`hs-status-pill ${cat.isActive !== false ? "hs-status-confirmed" : "hs-status-cancelled"}`}
                    style={{ fontSize: 11 }}
                  >
                    {cat.isActive !== false ? "Active" : "Disabled"}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 14px 0" }}>
                  {cat.description || "General maintenance and repair services."}
                </p>

                {/* Sub-services tags */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                    Supported Sub-Services ({cat.subServices?.length || 0})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.isArray(cat.subServices) &&
                      cat.subServices.map((sub, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "#f1f5f9",
                            color: "#334155",
                            fontSize: 11.5,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: 500,
                          }}
                        >
                          {sub}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(cat)}
                  style={{
                    border: "none",
                    background: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    color: cat.isActive !== false ? "#dc2626" : "#16a34a",
                    cursor: "pointer",
                  }}
                >
                  {cat.isActive !== false ? "Disable Category" : "Enable Category"}
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="hs-secondary-btn"
                    onClick={() => openEditModal(cat)}
                    style={{ padding: "5px 12px", fontSize: 12 }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="hs-secondary-btn"
                    onClick={() => setDeletingCategory(cat)}
                    style={{ padding: "5px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <div className="hs-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingCategory ? "Edit Service Category" : "Add New Service Category"}
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
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Icon Emoji
                  </label>
                  <input
                    type="text"
                    className="hs-input"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    style={{ textAlign: "center", fontSize: 20 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Category Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="hs-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Solar & Renewable Power"
                    required
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Base Inspection / Service Price (₹)
                </label>
                <input
                  type="number"
                  className="hs-input"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  min="0"
                  step="50"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Description
                </label>
                <textarea
                  className="hs-input"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of services offered in this domain…"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Sub-Services (comma separated)
                </label>
                <textarea
                  className="hs-input"
                  rows={2}
                  value={formData.subServices}
                  onChange={(e) => setFormData({ ...formData, subServices: e.target.value })}
                  placeholder="e.g. Inverter Repair, Solar Panel Cleaning, Battery Health Check"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="isActiveToggle" style={{ fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                  Active &amp; Published in Portal
                </label>
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
                  {saving ? "Saving…" : editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="hs-modal-overlay" onClick={() => setDeletingCategory(null)}>
          <div className="hs-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>
              Delete Category: {deletingCategory.name}
            </h3>
            <p style={{ fontSize: 13.5, color: "#475569", marginBottom: 18 }}>
              Are you sure you want to delete this category? Service providers linked to this category may need to be updated.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="hs-secondary-btn"
                onClick={() => setDeletingCategory(null)}
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
