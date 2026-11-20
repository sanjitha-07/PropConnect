import { useContext, useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import FindHomePreferenceFlow from "../../components/discovery/FindHomePreferenceFlow.jsx";
import PropertyMapView from "../../components/discovery/PropertyMapView.jsx";
import PropertyCompareTray from "../../components/discovery/PropertyCompareTray.jsx";
import PropertyCompareModal from "../../components/discovery/PropertyCompareModal.jsx";
import RecentlyViewedBar from "../../components/discovery/RecentlyViewedBar.jsx";
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
import { PROPERTIES as INITIAL_PROPERTIES, TENANTS as INITIAL_TENANTS, landlordById } from "../../data/db.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  Heart,
  Scale,
  Building,
  RotateCcw,
  Plus,
  Compass,
  Check,
  X,
  Map as MapIcon,
  Grid as GridIcon,
  ShieldCheck,
  Home,
} from "lucide-react";
import "./PropertiesDiscovery.css";

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

const PROPERTY_TYPES = [
  { id: "all", label: "All Types" },
  { id: "Apartment", label: "Apartment / Flat" },
  { id: "Villa", label: "Independent Villa" },
  { id: "Gated Community", label: "Gated Community" },
  { id: "Penthouse", label: "Penthouse" },
];

const FURNISHING_OPTIONS = [
  { id: "all", label: "All Furnishing" },
  { id: "Furnished", label: "Fully Furnished" },
  { id: "Semi-Furnished", label: "Semi-Furnished" },
  { id: "Unfurnished", label: "Unfurnished" },
];

const COMMON_AMENITIES = [
  "Covered Car Parking",
  "Elevator Lift",
  "24x7 Power Backup",
  "24x7 Water Supply",
  "CCTV Surveillance",
  "Gym/Clubhouse",
  "Swimming Pool",
  "Rainwater Harvesting",
];

export default function PropertiesPage() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isTenant = user?.role === "tenant";

  // Data states
  const [propertiesList, setPropertiesList] = useState([]);
  const [tenantsList, setTenantsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tenant Preferences & AI Matching
  const [tenantPreferences, setTenantPreferences] = useState(null);
  const [showPreferenceFlow, setShowPreferenceFlow] = useState(false);
  const [matchedProperties, setMatchedProperties] = useState([]);
  const [savedFavorites, setSavedFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("propconnect_saved_favorites") || "[]");
    } catch {
      return [];
    }
  });

  // Recently Viewed Properties
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("propconnect_recently_viewed") || "[]");
    } catch {
      return [];
    }
  });

  // Compare Properties (up to 3)
  const [compareList, setCompareList] = useState([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // View Mode: 'grid' | 'map'
  const [discoveryViewMode, setDiscoveryViewMode] = useState("grid");
  const [viewSavedOnly, setViewSavedOnly] = useState(
    () => searchParams.get("view") === "saved" || searchParams.get("tab") === "saved"
  );

  // Sync viewSavedOnly, add modal, or table view if query params change
  useEffect(() => {
    const isSaved = searchParams.get("view") === "saved" || searchParams.get("tab") === "saved";
    setViewSavedOnly(isSaved);

    if (searchParams.get("tab") === "add" || searchParams.get("action") === "add") {
      setShowAddModal(true);
    }
    if (searchParams.get("tab") === "units") {
      setAdminViewMode("table");
    }
  }, [searchParams]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedBhk, setSelectedBhk] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'available' | 'occupied'
  const [selectedPropertyType, setSelectedPropertyType] = useState("all");
  const [selectedFurnishing, setSelectedFurnishing] = useState("all");
  const [minRentInput, setMinRentInput] = useState("");
  const [maxRentInput, setMaxRentInput] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  // Sorting: 'bestMatch' | 'lowestRent' | 'highestRent' | 'newest'
  const [sortBy, setSortBy] = useState("bestMatch");

  // Admin / Landlord View controls
  const [adminViewMode, setAdminViewMode] = useState("grid"); // 'grid' | 'table'
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [deletingProp, setDeletingProp] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEscapeKey(() => {
    if (showAddModal) setShowAddModal(false);
    if (editingProp) setEditingProp(null);
    if (deletingProp) setDeletingProp(null);
    if (isCompareModalOpen) setIsCompareModalOpen(false);
  }, showAddModal || !!editingProp || !!deletingProp || isCompareModalOpen);

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
    status: "Available",
    tenantId: "",
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 3500);
  };

  // 1. Initial Load of Properties, Favorites, Preferences & Recently Viewed
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = user?.id || user?.entityId || "TEN001";
      const [props, tenants, favData] = await Promise.all([
        fetchProperties().catch(() => null),
        fetchTenants().catch(() => null),
        fetchFavorites(userId).catch(() => null),
      ]);

      const validProps = Array.isArray(props) && props.length > 0 ? props : INITIAL_PROPERTIES;
      setPropertiesList(validProps);
      setTenantsList(Array.isArray(tenants) && tenants.length > 0 ? tenants : INITIAL_TENANTS);

      if (favData && Array.isArray(favData.propertyIds)) {
        setSavedFavorites(favData.propertyIds);
      }

      // Check tenant preferences
      if (isTenant) {
        const savedPref = await fetchTenantPreferences(userId).catch(() => null);
        if (savedPref && savedPref.city) {
          setTenantPreferences(savedPref);
          const ranked = rankPropertiesClient(validProps, savedPref);
          setMatchedProperties(ranked);
        }
      }
    } catch (err) {
      console.warn("Error loading property data:", err);
      setPropertiesList(INITIAL_PROPERTIES);
      setTenantsList(INITIAL_TENANTS);
    } finally {
      setLoading(false);
    }
  }, [user, isTenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh recently viewed from localStorage periodically
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("propconnect_recently_viewed") || "[]");
      setRecentlyViewedIds(stored);
    } catch {}
  }, []);

  // Handle Preference Submission from Flow
  const handlePreferenceSubmit = async (newPrefs) => {
    setTenantPreferences(newPrefs);
    setShowPreferenceFlow(false);

    try {
      await saveTenantPreferences({
        ...newPrefs,
        userId: user?.id || user?.entityId || "TEN001",
      });

      const serverRanked = await matchProperties(newPrefs).catch(() => null);
      if (Array.isArray(serverRanked) && serverRanked.length > 0) {
        setMatchedProperties(serverRanked);
      } else {
        const clientRanked = rankPropertiesClient(propertiesList, newPrefs);
        setMatchedProperties(clientRanked);
      }
      showToast("Updated your home matching preferences!");
    } catch {
      const clientRanked = rankPropertiesClient(propertiesList, newPrefs);
      setMatchedProperties(clientRanked);
    }
  };

  // Toggle favorite property (persists to MongoDB & localStorage)
  const toggleFavorite = async (propId) => {
    const userId = user?.id || user?.entityId || "TEN001";
    const wasFav = savedFavorites.includes(propId);

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
      showToast(wasFav ? "Removed from saved properties" : "Saved to your favourites!");
    } catch (err) {
      console.warn("Favorite API sync error:", err);
    }
  };

  // Compare selection toggle (up to 3)
  const toggleCompare = (property) => {
    setCompareList((prev) => {
      const exists = prev.some((p) => p.id === property.id);
      if (exists) {
        return prev.filter((p) => p.id !== property.id);
      }
      if (prev.length >= 3) {
        showToast("You can compare up to 3 properties at a time.", "error");
        return prev;
      }
      return [...prev, property];
    });
  };

  const removeCompareItem = (propId) => {
    setCompareList((prev) => prev.filter((p) => p.id !== propId));
  };

  const clearAllCompare = () => {
    setCompareList([]);
    setIsCompareModalOpen(false);
  };

  // Toggle amenity filter
  const toggleAmenityFilter = (amenity) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedCity("all");
    setSelectedBhk("all");
    setStatusFilter("all");
    setSelectedPropertyType("all");
    setSelectedFurnishing("all");
    setMinRentInput("");
    setMaxRentInput("");
    setSelectedAmenities([]);
    setSearchQuery("");
    setSortBy("bestMatch");
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCity !== "all") count++;
    if (selectedBhk !== "all") count++;
    if (statusFilter !== "all") count++;
    if (selectedPropertyType !== "all") count++;
    if (selectedFurnishing !== "all") count++;
    if (minRentInput !== "") count++;
    if (maxRentInput !== "") count++;
    count += selectedAmenities.length;
    return count;
  }, [
    selectedCity,
    selectedBhk,
    statusFilter,
    selectedPropertyType,
    selectedFurnishing,
    minRentInput,
    maxRentInput,
    selectedAmenities,
  ]);

  // Base rows based on landlord role scope
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
    if (isTenant && matchedProperties.length > 0) {
      return matchedProperties;
    }
    return baseRows;
  }, [viewSavedOnly, isTenant, matchedProperties, baseRows, savedFavorites]);

  // Apply Search, Filters, and Sorting
  const filteredAndSortedProperties = useMemo(() => {
    let result = sourceProperties.filter((p) => {
      // 1. City / Location Filter
      if (selectedCity !== "all") {
        if (selectedCity === "other") {
          const major = ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem"];
          if (major.includes(p.city)) return false;
        } else if (p.city !== selectedCity) {
          return false;
        }
      }

      // 2. BHK Filter
      if (selectedBhk !== "all") {
        if (selectedBhk === "4+") {
          if ((p.bedrooms || 0) < 4) return false;
        } else if (String(p.bedrooms || 0) !== selectedBhk) {
          return false;
        }
      }

      // 3. Availability Filter
      if (statusFilter !== "all") {
        if (statusFilter === "available" && (p.status || "").toLowerCase() !== "available") return false;
        if (statusFilter === "occupied" && (p.status || "").toLowerCase() !== "occupied") return false;
      }

      // 4. Property Type Filter
      if (selectedPropertyType !== "all") {
        const pType = (p.propertyType || p.type || "Apartment").toLowerCase();
        if (!pType.includes(selectedPropertyType.toLowerCase())) return false;
      }

      // 5. Furnishing Filter
      if (selectedFurnishing !== "all") {
        const pFurnish = (p.furnishing || "Unfurnished").toLowerCase();
        if (!pFurnish.includes(selectedFurnishing.toLowerCase())) return false;
      }

      // 6. Min and Max Rent Filter
      const rent = Number(p.rent || 0);
      if (minRentInput !== "" && rent < Number(minRentInput)) return false;
      if (maxRentInput !== "" && rent > Number(maxRentInput)) return false;

      // 7. Amenities Filter (Must match all selected amenities)
      if (selectedAmenities.length > 0) {
        const pAmenities = Array.isArray(p.amenities) ? p.amenities : [];
        const hasAll = selectedAmenities.every((req) =>
          pAmenities.some((item) => item.toLowerCase().includes(req.toLowerCase()))
        );
        if (!hasAll) return false;
      }

      // 8. Keyword Search (Location and Property keywords)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${p.name || ""} ${p.building || ""} ${p.locality || ""} ${p.location || ""} ${p.city || ""} ${p.builder || ""} ${(p.amenities || []).join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });

    // Apply Sorting: Best Match, Rent (Low/High), Recently Added
    return result.sort((a, b) => {
      if (sortBy === "bestMatch") {
        const scoreA = a.matchScore || (a.status === "Available" ? 85 : 70);
        const scoreB = b.matchScore || (b.status === "Available" ? 85 : 70);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.rent || 0) - (b.rent || 0);
      }
      if (sortBy === "lowestRent") return (a.rent || 0) - (b.rent || 0);
      if (sortBy === "highestRent") return (b.rent || 0) - (a.rent || 0);
      if (sortBy === "newest") return (b.yearBuilt || 2022) - (a.yearBuilt || 2022);
      return 0;
    });
  }, [
    sourceProperties,
    selectedCity,
    selectedBhk,
    statusFilter,
    selectedPropertyType,
    selectedFurnishing,
    minRentInput,
    maxRentInput,
    selectedAmenities,
    searchQuery,
    sortBy,
  ]);

  // Recently Viewed Properties Objects
  const recentlyViewedProperties = useMemo(() => {
    return recentlyViewedIds
      .map((id) => propertiesList.find((p) => p.id === id))
      .filter(Boolean);
  }, [recentlyViewedIds, propertiesList]);

  // Handle Add Property Submit (Landlord/Admin)
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
      showToast(`Property "${created.name}" registered successfully!`);
    } catch (err) {
      showToast(`Failed to add property: ${err.message}`, "error");
    }
  };

  // Handle Edit Property Submit (Landlord/Admin)
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

  // Handle Delete Property (Landlord/Admin)
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

  // Admin Table Columns
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
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{r.city}</div>
          </div>
        </div>
      ),
    },
    { key: "city", label: t("city") },
    {
      key: "rent",
      label: t("rent"),
      render: (r) => `${formatCurrency(r.rent)}/mo`,
    },
    {
      key: "bedrooms",
      label: "BHK",
      render: (r) => `${r.bedrooms || 2} BHK`,
    },
    {
      key: "status",
      label: t("status"),
      render: (r) => (
        <span className={`pill ${(r.status || "").toLowerCase() === "available" ? "active" : "paid"}`}>
          {r.status || "Available"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-outline" style={{ padding: "4px 8px" }} onClick={() => navigate(`${r.id}`)}>
            View
          </button>
          <button className="btn-outline" style={{ padding: "4px 8px" }} onClick={() => setEditingProp(r)}>
            Edit
          </button>
        </div>
      ),
    },
  ];

  if (showPreferenceFlow && isTenant) {
    return (
      <div style={{ maxWidth: "860px", margin: "20px auto", padding: "0 16px" }}>
        <FindHomePreferenceFlow
          initialPreferences={tenantPreferences}
          onSubmit={handlePreferenceSubmit}
          onSkip={() => setShowPreferenceFlow(false)}
        />
      </div>
    );
  }

  return (
    <div className="properties-discovery-container">
      {/* Toast Notification */}
      {toast.message && (
        <div className="app-toast-container">
          <div className={`app-toast ${toast.type}`}>
            <span>{toast.type === "success" ? "✓" : "⚠️"}</span> {toast.message}
          </div>
        </div>
      )}

      {/* ======================================================================
          1. COMPACT PAGE HEADER
          ====================================================================== */}
      <header className="pd-compact-header">
        <div className="pd-header-titles">
          <h1>
            <Home size={20} color="#2563eb" />
            <span>
              {viewSavedOnly
                ? "Saved Properties"
                : isTenant
                ? "Property Discovery"
                : "Property Asset Directory"}
            </span>
          </h1>
          <p>
            {viewSavedOnly
              ? `${savedFavorites.length} saved residence${savedFavorites.length === 1 ? "" : "s"} in your personal collection.`
              : `${filteredAndSortedProperties.length} verified residences across Tamil Nadu matching your search.`}
          </p>
        </div>

        <div className="pd-header-actions">
          {/* Grid / Map View Switcher */}
          <div className="pd-view-toggle-group">
            <button
              type="button"
              className={`pd-view-btn ${discoveryViewMode === "grid" ? "active" : ""}`}
              onClick={() => setDiscoveryViewMode("grid")}
            >
              <GridIcon size={14} />
              <span>Grid View</span>
            </button>
            <button
              type="button"
              className={`pd-view-btn ${discoveryViewMode === "map" ? "active" : ""}`}
              onClick={() => setDiscoveryViewMode("map")}
            >
              <MapIcon size={14} />
              <span>Map View</span>
            </button>
          </div>

          {/* Saved Properties Pill */}
          <button
            type="button"
            className={`pd-pill-btn ${viewSavedOnly ? "active" : ""}`}
            onClick={() => {
              const next = !viewSavedOnly;
              setViewSavedOnly(next);
              setSearchParams(next ? { tab: "saved" } : {});
            }}
          >
            <Heart size={14} fill={viewSavedOnly ? "#2563eb" : "none"} color={viewSavedOnly ? "#2563eb" : "#475569"} />
            <span>Saved</span>
            <span className="pd-pill-badge">{savedFavorites.length}</span>
          </button>

          {/* Compare Button if items are selected */}
          {compareList.length > 0 && (
            <button
              type="button"
              className="pd-pill-btn active"
              onClick={() => setIsCompareModalOpen(true)}
            >
              <Scale size={14} />
              <span>Compare</span>
              <span className="pd-pill-badge">{compareList.length}/3</span>
            </button>
          )}

          {/* Tenant Matching Preference Button */}
          {isTenant ? (
            <button
              type="button"
              className="pd-pill-btn"
              onClick={() => setShowPreferenceFlow(true)}
              title="Update your residential matching criteria"
            >
              <Compass size={14} />
              <span>Preferences</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ padding: "7px 14px", fontSize: "12.5px" }}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} /> Register Property
            </button>
          )}
        </div>
      </header>

      {/* ======================================================================
          RECENTLY VIEWED PROPERTIES STRIP
          ====================================================================== */}
      {!viewSavedOnly && recentlyViewedProperties.length > 0 && (
        <RecentlyViewedBar
          recentlyViewed={recentlyViewedProperties}
          onNavigateDetails={(id) => navigate(`${id}`)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* ======================================================================
          2. SEARCH BAR & EXPANDABLE FILTER TOOLBAR
          ====================================================================== */}
      <section className="pd-search-filter-card">
        {/* Main Search Row */}
        <div className="pd-search-main-row">
          {/* Keyword and Location Search */}
          <div className="pd-search-input-box">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              className="pd-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by property name, locality (e.g. T. Nagar, Peelamedu), city, or builder…"
            />
            {searchQuery && (
              <button
                type="button"
                className="pd-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            className={`pd-filter-toggle-btn ${activeFiltersCount > 0 ? "has-active" : ""}`}
            onClick={() => setFiltersExpanded((prev) => !prev)}
          >
            <Filter size={14} />
            <span>
              Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
            </span>
            {filtersExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Sort By Dropdown */}
          <div className="pd-sort-dropdown-wrap">
            <label htmlFor="pd-sort-select">Sort By:</label>
            <select
              id="pd-sort-select"
              className="pd-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="bestMatch">Best Match (AI Score)</option>
              <option value="lowestRent">Rent: Low to High</option>
              <option value="highestRent">Rent: High to Low</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>
        </div>

        {/* 3. Expandable Filters Panel */}
        {filtersExpanded && (
          <div className="pd-expandable-filters-panel">
            {/* Col 1: Location */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">Location / City</span>
              <select
                className="pd-select"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {TN_CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Col 2: BHK Configuration */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">BHK</span>
              <select
                className="pd-select"
                value={selectedBhk}
                onChange={(e) => setSelectedBhk(e.target.value)}
              >
                {BHK_FILTERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Col 3: Furnishing */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">Furnishing</span>
              <select
                className="pd-select"
                value={selectedFurnishing}
                onChange={(e) => setSelectedFurnishing(e.target.value)}
              >
                {FURNISHING_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Col 4: Property Type */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">Property Type</span>
              <select
                className="pd-select"
                value={selectedPropertyType}
                onChange={(e) => setSelectedPropertyType(e.target.value)}
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Col 5: Rent Range */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">Min &amp; Max Monthly Rent</span>
              <div className="pd-rent-range-inputs">
                <input
                  type="number"
                  className="pd-rent-input"
                  placeholder="Min ₹"
                  value={minRentInput}
                  onChange={(e) => setMinRentInput(e.target.value)}
                />
                <span style={{ color: "#94a3b8" }}>–</span>
                <input
                  type="number"
                  className="pd-rent-input"
                  placeholder="Max ₹"
                  value={maxRentInput}
                  onChange={(e) => setMaxRentInput(e.target.value)}
                />
              </div>
            </div>

            {/* Col 6: Availability Status */}
            <div className="pd-filter-col">
              <span className="pd-filter-label">Availability</span>
              <select
                className="pd-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Units</option>
                <option value="available">Available Only</option>
                <option value="occupied">Occupied</option>
              </select>
            </div>

            {/* Amenities Checkboxes Strip */}
            <div className="pd-amenities-tags-grid">
              <span className="pd-filter-label" style={{ width: "100%", marginBottom: "2px" }}>
                Key Amenities:
              </span>
              {COMMON_AMENITIES.map((amenity) => {
                const isSelected = selectedAmenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    className={`pd-amenity-pill-toggle ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleAmenityFilter(amenity)}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{amenity}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer with Reset Action */}
            <div className="pd-filters-footer">
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Showing {filteredAndSortedProperties.length} matching properties
              </span>
              <button
                type="button"
                className="pd-btn-reset-filters"
                onClick={resetFilters}
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ======================================================================
          MAIN VIEW: MAP VIEW vs. GRID VIEW
          ====================================================================== */}
      {discoveryViewMode === "map" ? (
        <PropertyMapView
          properties={filteredAndSortedProperties}
          onNavigateDetails={(id) => navigate(`${id}`)}
          formatCurrency={formatCurrency}
        />
      ) : (
        /* GRID VIEW: Responsive Property Cards */
        <div className="pd-properties-grid">
          {filteredAndSortedProperties.map((p) => {
            const isFav = savedFavorites.includes(p.id);
            const isComparing = compareList.some((item) => item.id === p.id);
            const isAvailable = (p.status || "").toLowerCase() === "available";
            const landlord = landlordById(p.landlordId);
            const isVerified = landlord?.status === "Verified" || Boolean(p.isVerified);

            return (
              <div key={p.id} className="pd-property-card">
                {/* 4a. Consistent Image Dimensions Media Box */}
                <div
                  className="pd-card-media-wrap"
                  onClick={() => navigate(`${p.id}`)}
                  title="Click to view full property specifications"
                >
                  <img
                    src={
                      p.image ||
                      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"
                    }
                    alt={p.name}
                    className="pd-card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src =
                        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />

                  {/* Top Floating Badges */}
                  <div className="pd-card-top-badges">
                    {/* 8. AI Match Score Badge */}
                    {p.matchScore && (
                      <span className="pd-badge-match">
                        ⭐ {p.matchScore}% Match
                      </span>
                    )}

                    {/* 7. Verified Status (Rendered ONLY when verified exists) */}
                    {isVerified && (
                      <span className="pd-badge-verified">
                        <ShieldCheck size={12} /> Verified
                      </span>
                    )}

                    {/* 6. Availability Status */}
                    <span
                      className={`pd-badge-availability ${
                        isAvailable ? "available" : "occupied"
                      }`}
                    >
                      {isAvailable ? "Available" : "Occupied"}
                    </span>
                  </div>

                  {/* 9. Favourite Heart Action */}
                  <button
                    type="button"
                    className={`pd-card-fav-btn ${isFav ? "favorited" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(p.id);
                    }}
                    title={isFav ? "Remove from saved properties" : "Save this property"}
                  >
                    <Heart
                      size={15}
                      fill={isFav ? "#dc2626" : "none"}
                      color={isFav ? "#dc2626" : "#475569"}
                    />
                  </button>
                </div>

                {/* 4b. Card Content Body */}
                <div className="pd-card-body">
                  {/* 5. Rent & BHK Row */}
                  <div className="pd-card-price-row">
                    <div>
                      <span className="pd-card-rent">
                        {formatCurrency(p.rent)}
                      </span>
                      <span className="pd-card-rent-period">/mo</span>
                    </div>
                    <span className="pd-card-bhk-tag">
                      {p.bedrooms ? `${p.bedrooms} BHK` : "Special Unit"}
                    </span>
                  </div>

                  {/* Property Name */}
                  <h3
                    className="pd-card-title"
                    onClick={() => navigate(`${p.id}`)}
                    title={p.name}
                  >
                    {p.name}
                  </h3>

                  {/* Location with Pin */}
                  <div className="pd-card-location">
                    <MapPin size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>{p.locality || p.location || p.city}</span>
                  </div>

                  {/* Area and Specs */}
                  <div className="pd-card-specs-row">
                    <span className="pd-spec-item">
                      📐 {p.area || p.sqft || 1200} sqft
                    </span>
                    <span className="pd-spec-item">
                      🛋️ {p.furnishing || "Semi-Furnished"}
                    </span>
                    {p.floor && (
                      <span className="pd-spec-item">🏢 {p.floor}</span>
                    )}
                  </div>

                  {/* 8. Meaningful Single-line AI Match Explanation */}
                  {p.reasons && p.reasons.length > 0 && (
                    <div className="pd-card-match-reason" title={p.reasons[0]}>
                      ✓ {p.reasons[0]}
                    </div>
                  )}

                  {/* 4c. Card Footer: View Details & Compare Action */}
                  <div className="pd-card-footer">
                    {/* 10. View Details Action */}
                    <button
                      type="button"
                      className="pd-btn-view-details"
                      onClick={() => navigate(`${p.id}`)}
                    >
                      View Details
                    </button>

                    {/* 11. Compare Action */}
                    <button
                      type="button"
                      className={`pd-btn-compare-check ${isComparing ? "selected" : ""}`}
                      onClick={() => toggleCompare(p)}
                      title={
                        isComparing
                          ? "Remove from comparison"
                          : "Add to side-by-side comparison"
                      }
                    >
                      <Scale size={13} />
                      <span>{isComparing ? "Comparing" : "Compare"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredAndSortedProperties.length === 0 && (
        <div className="pd-empty-card">
          <div style={{ fontSize: "40px" }}>{viewSavedOnly ? "❤️" : "🔍"}</div>
          <h3>
            {viewSavedOnly ? "No saved properties found" : "No matching properties found"}
          </h3>
          <p>
            {viewSavedOnly
              ? "You haven't saved any properties yet. Click the heart icon (♡) on any card to save residences to your personal list."
              : "Try broadening your filters, expanding your budget range, or clearing your keyword search query."}
          </p>
          <button type="button" className="btn-primary" onClick={resetFilters}>
            {viewSavedOnly ? "Browse All Properties →" : "Reset All Filters"}
          </button>
        </div>
      )}

      {/* ======================================================================
          COMPARE TRAY & MODAL (Compare up to 3 properties)
          ====================================================================== */}
      <PropertyCompareTray
        compareProperties={compareList}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onRemove={removeCompareItem}
        onClearAll={clearAllCompare}
      />

      {isCompareModalOpen && (
        <PropertyCompareModal
          compareProperties={compareList}
          onRemove={removeCompareItem}
          onClearAll={clearAllCompare}
          onClose={() => setIsCompareModalOpen(false)}
          onViewDetails={(id) => {
            setIsCompareModalOpen(false);
            navigate(`${id}`);
          }}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}
