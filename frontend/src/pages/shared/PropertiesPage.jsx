import { useContext, useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import FindHomePreferenceFlow from "../../components/discovery/FindHomePreferenceFlow.jsx";
import PropertyChatModal from "../../components/chat/PropertyChatModal.jsx";
import ScheduleVisitModal from "../../components/chat/ScheduleVisitModal.jsx";
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  fetchTenants,
  fetchTenantPreferences,
  saveTenantPreferences,
  matchProperties,
  fetchFavorites,
  toggleFavoriteApi,
} from "../../utils/apiClient.js";
import { rankPropertiesClient } from "../../utils/clientMatchingEngine.js";
import { PROPERTIES as INITIAL_PROPERTIES, TENANTS as INITIAL_TENANTS } from "../../data/db.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";

const TN_CITIES = [
  { id: "all", label: "All Regions" },
  { id: "Chennai", label: "Chennai" },
  { id: "Coimbatore", label: "Coimbatore" },
  { id: "Madurai", label: "Madurai" },
  { id: "Trichy", label: "Trichy" },
  { id: "Salem", label: "Salem" },
  { id: "other", label: "Other Regions" },
];

const BHK_FILTERS = [
  { id: "all", label: "All BHK" },
  { id: "1", label: "1 BHK" },
  { id: "2", label: "2 BHK" },
  { id: "3", label: "3 BHK" },
  { id: "4+", label: "4+ BHK / Villa" },
];

export default function PropertiesPage() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();

  const isTenant = user?.role === "tenant";

  // Data states
  const [propertiesList, setPropertiesList] = useState([]);
  const [tenantsList, setTenantsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tenant Preference & Discovery states
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewSavedOnly, setViewSavedOnly] = useState(() => searchParams.get("view") === "saved");
  const [tenantPreferences, setTenantPreferences] = useState(null);
  const [showPreferenceFlow, setShowPreferenceFlow] = useState(false);
  const [matchedProperties, setMatchedProperties] = useState([]);
  const [browseAllMode, setBrowseAllMode] = useState(false);
  const [sortBy, setSortBy] = useState("bestMatch"); // 'bestMatch' | 'lowestRent' | 'highestRent' | 'newest' | 'location'
  const [savedFavorites, setSavedFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("propconnect_saved_favorites") || "[]");
    } catch {
      return [];
    }
  });

  // Sync viewSavedOnly if search params change
  useEffect(() => {
    if (searchParams.get("view") === "saved") {
      setViewSavedOnly(true);
    }
  }, [searchParams]);

  // Property Chat and Visit Modals
  const [activeChatProperty, setActiveChatProperty] = useState(null);
  const [activeVisitProperty, setActiveVisitProperty] = useState(null);

  // Admin / Landlord View controls
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedBhk, setSelectedBhk] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // CRUD Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [deletingProp, setDeletingProp] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Esc key closes modals
  useEscapeKey(() => {
    if (showAddModal) setShowAddModal(false);
    if (editingProp) setEditingProp(null);
    if (deletingProp) setDeletingProp(null);
    if (activeChatProperty) setActiveChatProperty(null);
    if (activeVisitProperty) setActiveVisitProperty(null);
  }, showAddModal || !!editingProp || !!deletingProp || !!activeChatProperty || !!activeVisitProperty);

  const [newProp, setNewProp] = useState({
    name: "",
    propertyType: "Apartment",
    facingDirection: "East",
    carParking: "1 Covered Car Bay",
    balconies: 1,
    floor: "2nd Floor",
    furnishing: "Semi-Furnished",
    maintenanceCharges: 2500,
    city: "Chennai",
    locality: "",
    location: "",
    builder: "",
    bedrooms: 2,
    bathrooms: 2,
    rent: 25000,
    deposit: 90000,
    area: 1250,
    sqft: 1250,
    status: "Available",
    tenantId: "",
    waterSupply: "24/7 Metro Water + Borewell",
    preferredTenants: "Family / Working Professionals",
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 3500);
  };

  // 1. Initial Load of Properties, Favorites & Tenant Preferences
  const loadData = async () => {
    setLoading(true);
    try {
      const userId = user?.id || user?.entityId || "TEN001";
      const [props, tenants, favData] = await Promise.all([
        fetchProperties(),
        fetchTenants(),
        fetchFavorites(userId),
      ]);
      const validProps = props && props.length > 0 ? props : INITIAL_PROPERTIES;
      setPropertiesList(validProps);
      setTenantsList(tenants && tenants.length > 0 ? tenants : INITIAL_TENANTS);

      if (favData && Array.isArray(favData.propertyIds)) {
        setSavedFavorites(favData.propertyIds);
      }

      // Check tenant preferences
      if (isTenant) {
        const savedPref = await fetchTenantPreferences(userId);
        if (savedPref && savedPref.city) {
          setTenantPreferences(savedPref);
          // Run matching
          const ranked = rankPropertiesClient(validProps, savedPref);
          setMatchedProperties(ranked);
          setShowPreferenceFlow(false);
        } else {
          // No saved preferences yet: open "Find Your Home" flow first!
          setShowPreferenceFlow(true);
        }
      }
    } catch {
      setPropertiesList(INITIAL_PROPERTIES);
      setTenantsList(INITIAL_TENANTS);
      if (isTenant) {
        setShowPreferenceFlow(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Preference Submission from Flow
  const handlePreferenceSubmit = async (newPrefs) => {
    setTenantPreferences(newPrefs);
    setShowPreferenceFlow(false);
    setBrowseAllMode(false);

    try {
      await saveTenantPreferences({
        ...newPrefs,
        userId: user?.id || user?.entityId || "TEN001",
      });

      // Try API matching first
      const serverRanked = await matchProperties(newPrefs);
      if (serverRanked && serverRanked.length > 0) {
        setMatchedProperties(serverRanked);
      } else {
        const clientRanked = rankPropertiesClient(propertiesList, newPrefs);
        setMatchedProperties(clientRanked);
      }
      showToast(`Found ${propertiesList.length} properties matching your preferences!`);
    } catch {
      const clientRanked = rankPropertiesClient(propertiesList, newPrefs);
      setMatchedProperties(clientRanked);
    }
  };

  // Toggle favorite / saved property (Database-backed via MongoDB)
  const toggleFavorite = async (propId) => {
    const userId = user?.id || user?.entityId || "TEN001";
    const wasFav = savedFavorites.includes(propId);

    // Optimistic UI state update
    setSavedFavorites((prev) => {
      const updated = wasFav ? prev.filter((id) => id !== propId) : [...prev, propId];
      try {
        localStorage.setItem("propconnect_saved_favorites", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const res = await toggleFavoriteApi(userId, propId);
      if (res && res.propertyIds) {
        setSavedFavorites(res.propertyIds);
      }
      showToast(wasFav ? "Property removed from saved" : "Property saved to your favourites!");
    } catch (err) {
      console.warn("Favorite API sync error:", err);
    }
  };

  // Filter based on landlord ownership
  let baseRows = propertiesList;
  if (user?.role === "landlord") {
    const landlordId = user.entityId || "LDL001";
    const landlordProps = propertiesList.filter(
      (p) =>
        p.landlordId === landlordId ||
        p.landlord_id === landlordId ||
        p.landlordId === "LDL001" ||
        p.landlordId === "LDL002"
    );
    baseRows = landlordProps.length > 0 ? landlordProps : propertiesList;
  }

  // Active items for display: saved properties, matched properties, or all properties
  const sourceProperties = useMemo(() => {
    if (viewSavedOnly) {
      return baseRows.filter((p) => savedFavorites.includes(p.id));
    }
    if (isTenant && !browseAllMode && matchedProperties.length > 0) {
      return matchedProperties;
    }
    return baseRows;
  }, [viewSavedOnly, isTenant, browseAllMode, matchedProperties, baseRows, savedFavorites]);

  // Apply Search, Filters, and Sorting
  const filteredAndSortedProperties = useMemo(() => {
    let result = sourceProperties.filter((p) => {
      // City filter
      if (selectedCity !== "all") {
        if (selectedCity === "other") {
          const major = ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem"];
          if (major.includes(p.city)) return false;
        } else if (p.city !== selectedCity) {
          return false;
        }
      }

      // BHK filter
      if (selectedBhk !== "all") {
        if (selectedBhk === "4+") {
          if ((p.bedrooms || 0) < 4) return false;
        } else if (String(p.bedrooms || 0) !== selectedBhk) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && (p.status || "").toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.name || "").toLowerCase().includes(q);
        const matchBuilding = (p.building || "").toLowerCase().includes(q);
        const matchLoc = (p.location || p.locality || "").toLowerCase().includes(q);
        const matchCity = (p.city || "").toLowerCase().includes(q);
        const matchBuilder = (p.builder || "").toLowerCase().includes(q);
        const matchId = (p.id || "").toLowerCase().includes(q);
        if (!matchName && !matchBuilding && !matchLoc && !matchCity && !matchBuilder && !matchId) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    return result.sort((a, b) => {
      if (sortBy === "bestMatch") {
        const scoreA = a.matchScore || 70;
        const scoreB = b.matchScore || 70;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (a.status === "Available" && b.status !== "Available") return -1;
        if (b.status === "Available" && a.status !== "Available") return 1;
        return a.rent - b.rent;
      }
      if (sortBy === "lowestRent") return a.rent - b.rent;
      if (sortBy === "highestRent") return b.rent - a.rent;
      if (sortBy === "newest") return (b.yearBuilt || 2022) - (a.yearBuilt || 2022);
      if (sortBy === "location") return (a.city || "").localeCompare(b.city || "");
      return 0;
    });
  }, [sourceProperties, selectedCity, selectedBhk, statusFilter, searchQuery, sortBy]);

  // Handle Add Property Submit
  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newProp.name || !newProp.location) {
      showToast("Please enter property name and address.", "error");
      return;
    }

    try {
      const payload = {
        ...newProp,
        id: `TN_${Date.now()}`,
        landlordId: user.entityId || "LDL001",
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
        amenities: ["Covered Car Parking", "24x7 Power Backup", "Elevator Lift", "Water Connection"],
      };

      const created = await createProperty(payload);
      setPropertiesList((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewProp({
        name: "",
        city: "Chennai",
        locality: "",
        location: "",
        builder: "",
        bedrooms: 2,
        bathrooms: 2,
        rent: 25000,
        deposit: 90000,
        area: 1250,
        status: "Available",
        tenantId: "",
      });
      showToast(`Property "${created.name}" registered successfully!`);
    } catch (err) {
      showToast(`Failed to add property: ${err.message}`, "error");
    }
  };

  // Handle Edit Property Submit
  const handleEditProperty = async (e) => {
    e.preventDefault();
    if (!editingProp) return;

    try {
      const updated = await updateProperty(editingProp.id, editingProp);
      setPropertiesList((prev) => prev.map((p) => (p.id === editingProp.id ? updated : p)));
      setEditingProp(null);
      showToast(`Property "${updated.name}" updated successfully!`);
    } catch (err) {
      showToast(`Update failed: ${err.message}`, "error");
    }
  };

  // Handle Delete Property
  const handleDeleteConfirm = async () => {
    if (!deletingProp) return;
    try {
      await deleteProperty(deletingProp.id);
      setPropertiesList((prev) => prev.filter((p) => p.id !== deletingProp.id));
      showToast(`Property "${deletingProp.name}" removed successfully.`);
      setDeletingProp(null);
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, "error");
    }
  };

  // Table columns for Admin / Landlord view
  const tableColumns = [
    {
      key: "name",
      label: t("propertyName"),
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={r.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"}
            alt={r.name}
            style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover" }}
          />
          <div>
            <strong style={{ color: "var(--brand-blue)", cursor: "pointer" }} onClick={() => navigate(`${r.id}`)}>
              {r.name}
            </strong>
            <div className="sub-text">{r.locality || r.location || r.city}</div>
          </div>
        </div>
      ),
    },
    { key: "city", label: "City" },
    {
      key: "type",
      label: "Config",
      render: (r) => <span>{r.bedrooms ? `${r.bedrooms} BHK` : "Special Unit"}</span>,
    },
    {
      key: "rent",
      label: t("rent"),
      render: (r) => <strong>{formatCurrency(r.rent)}/mo</strong>,
    },
    {
      key: "status",
      label: t("status"),
      render: (r) => {
        const cls = (r.status || "").toLowerCase() === "occupied" ? "paid" : "active";
        return <span className={`pill ${cls}`}>{r.status}</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-outline" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => navigate(`${r.id}`)}>
            View
          </button>
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11px", color: "var(--brand-blue)" }}
            onClick={() => setActiveChatProperty(r)}
            title="Ask About This Property"
          >
            💬 Chat
          </button>
          {!isTenant && (
            <>
              <button className="btn-outline" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => setEditingProp(r)}>
                ✏️
              </button>
              <button
                className="btn-outline"
                style={{ padding: "4px 8px", fontSize: "11px", color: "var(--red)" }}
                onClick={() => setDeletingProp(r)}
              >
                🗑️
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // If Tenant enters and needs to fill preferences flow:
  if (isTenant && showPreferenceFlow) {
    return (
      <div>
        <FindHomePreferenceFlow
          initialPreferences={tenantPreferences}
          onSubmit={handlePreferenceSubmit}
          onSkip={() => {
            setShowPreferenceFlow(false);
            setBrowseAllMode(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="properties-page-container">
      {/* Page Hero */}
      <PageHero
        badge={isTenant ? (viewSavedOnly ? "Saved Homes" : "Property Discovery") : "Asset Registry"}
        title={
          viewSavedOnly
            ? "My Saved Properties"
            : isTenant && !browseAllMode
            ? "Properties Matching Your Preferences"
            : "Residential & Commercial Properties"
        }
        subtitle={
          viewSavedOnly
            ? `You have ${savedFavorites.length} saved residence${savedFavorites.length === 1 ? "" : "s"} in your personal favorites list.`
            : isTenant && !browseAllMode
            ? `Top home recommendations based on your preferences in ${tenantPreferences?.city || "Tamil Nadu"}. Ranked by real database matching.`
            : "Explore vetted residential apartments, independent villas, and complexes across Tamil Nadu."
        }
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {isTenant ? (
              <>
                <button
                  type="button"
                  className={viewSavedOnly ? "btn-primary" : "btn-outline"}
                  onClick={() => {
                    setViewSavedOnly((v) => !v);
                    if (browseAllMode) setBrowseAllMode(false);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span>{viewSavedOnly ? "❤️ Showing Saved" : "♡ My Saved"}</span>
                  <span className="badge-pill-count">{savedFavorites.length}</span>
                </button>
                <button
                  type="button"
                  className={!viewSavedOnly && browseAllMode ? "btn-primary" : "btn-outline"}
                  onClick={() => {
                    setViewSavedOnly(false);
                    setBrowseAllMode((v) => !v);
                  }}
                >
                  {!viewSavedOnly && browseAllMode ? "✓ Showing All Properties" : "🌐 View All Properties"}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowPreferenceFlow(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  ⚙️ Update Preferences
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-outline"
                  onClick={() => setShowPreferenceFlow(true)}
                  title="Test Tenant Discovery Preference Flow"
                >
                  🔍 Tenant Discovery Preview
                </button>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                  + Register Property
                </button>
              </>
            )}
          </div>
        }
      />

      {toast.message && (
        <div className="app-toast-container">
          <div className={`app-toast ${toast.type}`}>
            <span>{toast.type === "success" ? "✓" : "⚠️"}</span> {toast.message}
          </div>
        </div>
      )}

      {/* Tenant Active Preferences Banner */}
      {isTenant && tenantPreferences && !browseAllMode && (
        <div className="card pref-active-banner">
          <div className="pref-banner-left">
            <span className="pref-badge">🎯 Matching Filter Active</span>
            <div className="pref-tag-list">
              <span className="pref-tag">📍 {tenantPreferences.city}</span>
              {tenantPreferences.locality && (
                <span className="pref-tag">📌 {tenantPreferences.locality}</span>
              )}
              <span className="pref-tag">🛏️ {tenantPreferences.bhk} BHK</span>
              <span className="pref-tag">💰 {tenantPreferences.budgetRange}</span>
              {tenantPreferences.furnishing && tenantPreferences.furnishing !== "No preference" && (
                <span className="pref-tag">🛋️ {tenantPreferences.furnishing}</span>
              )}
              {tenantPreferences.amenities?.length > 0 && (
                <span className="pref-tag">✨ {tenantPreferences.amenities.slice(0, 2).join(", ")}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-text edit-pref-link"
            onClick={() => setShowPreferenceFlow(true)}
          >
            Modify Preferences ✏️
          </button>
        </div>
      )}

      {/* Filter and Controls Toolbar */}
      <div className="card property-controls-card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
        <div className="controls-row">
          <div className="search-wrap">
            <input
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search properties by name, locality, city, or builder…"
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>

          <div className="status-filter-group">
            <label>Sort By:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="bestMatch">Best Match (Score %)</option>
              <option value="lowestRent">Lowest Rent</option>
              <option value="highestRent">Highest Rent</option>
              <option value="newest">Newest Listed</option>
              <option value="location">Location (A-Z)</option>
            </select>
          </div>

          <div className="status-filter-group">
            <label>City:</label>
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
              {TN_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="status-filter-group">
            <label>BHK:</label>
            <select value={selectedBhk} onChange={(e) => setSelectedBhk(e.target.value)}>
              {BHK_FILTERS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="status-filter-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
            </select>
          </div>

          {!isTenant && (
            <div className="view-mode-toggle">
              <button
                type="button"
                className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                ⊞ Grid
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                ☰ Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "table" && !isTenant ? (
        <DataTable
          title="Properties Directory"
          columns={tableColumns}
          rows={filteredAndSortedProperties}
          searchKeys={["name", "city", "locality", "location", "builder"]}
          searchPlaceholder="Search properties…"
          pageSize={10}
        />
      ) : (
        /* Grid Mode: Premium Cards with Match % and Why it Matches */
        <div className="property-results-grid">
          {filteredAndSortedProperties.map((p) => {
            const isFav = savedFavorites.includes(p.id);
            const isAvailable = (p.status || "").toLowerCase() === "available";

            return (
              <div key={p.id} className="prop-match-card card">
                {/* Image Wrap with Badges & Save Action */}
                <div className="prop-card-media" onClick={() => navigate(`${p.id}`)}>
                  <img
                    src={p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"}
                    alt={p.name}
                    className="prop-card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />

                  {/* Top Floating Badges */}
                  <div className="prop-media-badges">
                    {/* Match Score Badge */}
                    {p.matchScore ? (
                      <span className={`match-score-badge ${p.matchScore >= 90 ? "high" : "medium"}`}>
                        ⭐ {p.matchScore}% Match
                      </span>
                    ) : (
                      <span className="mini-city-badge">{p.city}</span>
                    )}

                    <span className={`pill ${isAvailable ? "active" : "paid"} mini-pill`}>
                      {isAvailable ? "Available" : "Occupied"}
                    </span>
                  </div>

                  {/* Save / Favorite Heart Button */}
                  <button
                    type="button"
                    className={`prop-fav-btn ${isFav ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(p.id);
                    }}
                    title={isFav ? "Remove from saved" : "Save this property"}
                  >
                    {isFav ? "❤️" : "🤍"}
                  </button>
                </div>

                {/* Content Details */}
                <div className="prop-card-body">
                  <div className="prop-price-row">
                    <div>
                      <span className="prop-rent-val">{formatCurrency(p.rent)}</span>
                      <span className="prop-rent-period">/mo</span>
                    </div>
                    <span className="prop-config-badge">
                      {p.bedrooms ? `${p.bedrooms} BHK` : "Special Unit"}
                    </span>
                  </div>

                  <h3 className="prop-name" onClick={() => navigate(`${p.id}`)}>
                    {p.name}
                  </h3>

                  <p className="prop-location">
                    <span>📍</span> {p.locality || p.location || p.city}
                  </p>

                  <div className="prop-specs-pills" style={{ flexWrap: "wrap", gap: "6px" }}>
                    <span>📐 {p.sqft || p.area || 800} sqft</span>
                    <span>🛁 {p.bathrooms || 1} Bath</span>
                    <span>🧭 {p.facingDirection || "East Facing"}</span>
                    <span>🚗 {p.carParking || "Covered Parking"}</span>
                    {p.propertyType && <span style={{ background: "rgba(37,99,235,0.08)", color: "#1d4ed8" }}>🏢 {p.propertyType}</span>}
                    {p.maintenanceCharges > 0 && <span style={{ background: "#f0fdf4", color: "#15803d" }}>+₹{p.maintenanceCharges} Maint</span>}
                  </div>

                  {/* "Why This Property Matches" Section */}
                  {p.reasons && p.reasons.length > 0 && (
                    <div className="prop-why-matches-box">
                      <div className="why-matches-header">Why this property matches:</div>
                      <ul className="why-matches-list">
                        {p.reasons.slice(0, 4).map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="prop-card-footer-actions">
                    <button
                      type="button"
                      className="btn-outline prop-action-btn"
                      onClick={() => navigate(`${p.id}`)}
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      className="btn-primary prop-action-btn chat-highlight-btn"
                      onClick={() => setActiveChatProperty(p)}
                      title="Ask questions about this property in English or Tamil"
                    >
                      💬 Property Chat
                    </button>

                    {!isTenant && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "6px 10px" }}
                          onClick={() => setEditingProp(p)}
                          title="Edit Property"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "6px 10px", color: "var(--red)" }}
                          onClick={() => setDeletingProp(p)}
                          title="Delete Property"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAndSortedProperties.length === 0 && (
            <div className="card empty-results-card">
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>
                {viewSavedOnly ? "❤️" : "🔍"}
              </div>
              <h3>
                {viewSavedOnly
                  ? "No saved properties yet"
                  : "No properties match the selected criteria"}
              </h3>
              <p style={{ color: "var(--ink-muted)", marginBottom: "20px" }}>
                {viewSavedOnly
                  ? "Browse through our verified Tamil Nadu properties and click the heart icon (♡) on any card or details page to add it to your favourites list."
                  : "Try adjusting your budget range, selected city, or BHK requirement to discover available homes."}
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setViewSavedOnly(false);
                    setSelectedCity("all");
                    setSelectedBhk("all");
                    setStatusFilter("all");
                    setSearchQuery("");
                    setBrowseAllMode(true);
                  }}
                >
                  {viewSavedOnly ? "Browse All Properties →" : "Reset Filters & View All"}
                </button>
                {isTenant && !viewSavedOnly && (
                  <button className="btn-outline" onClick={() => setShowPreferenceFlow(true)}>
                    Modify Preferences
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Property-Aware Chat Modal (Feature 2) */}
      {activeChatProperty && (
        <PropertyChatModal
          property={activeChatProperty}
          onClose={() => setActiveChatProperty(null)}
        />
      )}

      {/* Schedule Visit Modal */}
      {activeVisitProperty && (
        <ScheduleVisitModal
          property={activeVisitProperty}
          onClose={() => setActiveVisitProperty(null)}
        />
      )}

      {/* Admin / Landlord Add Property Modal */}
      {showAddModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Property</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProperty} style={{ padding: "20px" }}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="pref-field-label">Property Name</label>
                <input
                  type="text"
                  className="inp"
                  value={newProp.name}
                  onChange={(e) => setNewProp({ ...newProp, name: e.target.value })}
                  placeholder="e.g. Sreevatsa Gardens - Flat 401"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label className="pref-field-label">City</label>
                  <select
                    className="inp"
                    value={newProp.city}
                    onChange={(e) => setNewProp({ ...newProp, city: e.target.value })}
                  >
                    <option value="Chennai">Chennai</option>
                    <option value="Coimbatore">Coimbatore</option>
                    <option value="Madurai">Madurai</option>
                    <option value="Trichy">Trichy</option>
                    <option value="Salem">Salem</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Locality / Area</label>
                  <input
                    type="text"
                    className="inp"
                    value={newProp.locality}
                    onChange={(e) => setNewProp({ ...newProp, locality: e.target.value })}
                    placeholder="e.g. OMR, Velachery, Peelamedu"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="pref-field-label">Complete Street Address</label>
                <input
                  type="text"
                  className="inp"
                  value={newProp.location}
                  onChange={(e) => setNewProp({ ...newProp, location: e.target.value })}
                  placeholder="Door No, Street Name, Landmark"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label className="pref-field-label">Bedrooms (BHK)</label>
                  <input
                    type="number"
                    className="inp"
                    value={newProp.bedrooms}
                    onChange={(e) => setNewProp({ ...newProp, bedrooms: Number(e.target.value) })}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Bathrooms</label>
                  <input
                    type="number"
                    className="inp"
                    value={newProp.bathrooms}
                    onChange={(e) => setNewProp({ ...newProp, bathrooms: Number(e.target.value) })}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Super Built-up (sqft)</label>
                  <input
                    type="number"
                    className="inp"
                    value={newProp.area}
                    onChange={(e) => setNewProp({ ...newProp, area: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div className="form-group">
                  <label className="pref-field-label">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    className="inp"
                    value={newProp.rent}
                    onChange={(e) => setNewProp({ ...newProp, rent: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Security Deposit (₹)</label>
                  <input
                    type="number"
                    className="inp"
                    value={newProp.deposit}
                    onChange={(e) => setNewProp({ ...newProp, deposit: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save &amp; Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin / Landlord Edit Property Modal */}
      {editingProp && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setEditingProp(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Property: {editingProp.name}</h3>
              <button className="modal-close-btn" onClick={() => setEditingProp(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleEditProperty} style={{ padding: "20px" }}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="pref-field-label">Property Name</label>
                <input
                  type="text"
                  className="inp"
                  value={editingProp.name}
                  onChange={(e) => setEditingProp({ ...editingProp, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label className="pref-field-label">City</label>
                  <input
                    type="text"
                    className="inp"
                    value={editingProp.city}
                    onChange={(e) => setEditingProp({ ...editingProp, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Status</label>
                  <select
                    className="inp"
                    value={editingProp.status}
                    onChange={(e) => setEditingProp({ ...editingProp, status: e.target.value })}
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div className="form-group">
                  <label className="pref-field-label">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    className="inp"
                    value={editingProp.rent}
                    onChange={(e) => setEditingProp({ ...editingProp, rent: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="pref-field-label">Security Deposit (₹)</label>
                  <input
                    type="number"
                    className="inp"
                    value={editingProp.deposit}
                    onChange={(e) => setEditingProp({ ...editingProp, deposit: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setEditingProp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProp && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setDeletingProp(null)}>
          <div className="modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: "var(--red)" }}>Confirm Removal</h3>
              <button className="modal-close-btn" onClick={() => setDeletingProp(null)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 20px 0", lineHeight: "1.5" }}>
                Are you sure you want to remove <strong>{deletingProp.name}</strong> from the database? This cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setDeletingProp(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: "var(--red)", borderColor: "var(--red)" }}
                  onClick={handleDeleteConfirm}
                >
                  Delete Property
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
