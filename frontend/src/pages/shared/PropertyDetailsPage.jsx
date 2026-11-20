import { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PropertyChatModal from "../../components/chat/PropertyChatModal.jsx";
import ScheduleVisitModal from "../../components/chat/ScheduleVisitModal.jsx";
import PropertyLocationMap from "../../components/discovery/PropertyLocationMap.jsx";
import {
  fetchPropertyById,
  fetchFavorites,
  toggleFavoriteApi,
  fetchTenantPreferences,
} from "../../utils/apiClient.js";
import { generateGalleryForProperty } from "../../data/propertyGalleries.js";
import { rankPropertiesClient } from "../../utils/clientMatchingEngine.js";
import {
  propertyById,
  landlordById,
  TENANTS,
  LEASES,
  UTILITY_BILLS,
  MAINTENANCE_REQUESTS,
  PROPERTIES,
} from "../../data/db.js";
import PropertyMaintenanceHistoryCard from "../../components/fixit/PropertyMaintenanceHistoryCard.jsx";
import PreferredProvidersCard from "../../components/fixit/PreferredProvidersCard.jsx";
import FixItDispatchModal from "../../components/fixit/FixItDispatchModal.jsx";
import LiveTrackingModal from "../../components/fixit/LiveTrackingModal.jsx";
import ServiceReviewModal from "../../components/fixit/ServiceReviewModal.jsx";
import TheAureliaFloorPlan from "../../components/showcase/TheAureliaFloorPlan.jsx";
import VirtualTourViewer from "../../components/showcase/VirtualTourViewer.jsx";
import "./PropertyShowcase.css";

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();

  // Active secondary tab (for Specs, Utilities, Maintenance)
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'utilities' | 'maintenance'
  const [property, setProperty] = useState(() => propertyById(id));
  const [loading, setLoading] = useState(!property);

  // Gallery & Lightbox states
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryCategory, setGalleryCategory] = useState("all");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [touchStartX, setTouchStartX] = useState(null);

  // Room modal viewer for "Explore Every Corner"
  const [selectedRoomModal, setSelectedRoomModal] = useState(null);
  const [roomModalImgIdx, setRoomModalImgIdx] = useState(0);

  // Floor plan interactive state (for non-Aurelia fallback)
  const [fpZoom, setFpZoom] = useState(1);
  const [isFpFullscreen, setIsFpFullscreen] = useState(false);

  // AI Matching state
  const [matchResult, setMatchResult] = useState(null);
  const [aiMatchExpanded, setAiMatchExpanded] = useState(false);

  // Favorites state (Database-backed)
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Modals & Feedback
  const [showChatModal, setShowChatModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [dispatchTicket, setDispatchTicket] = useState(null);
  const [trackingBooking, setTrackingBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [toast, setToast] = useState(null);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Record property in Recently Viewed (localStorage)
  useEffect(() => {
    if (!id) return;
    try {
      const stored = JSON.parse(localStorage.getItem("propconnect_recently_viewed") || "[]");
      const filtered = stored.filter((item) => item !== id);
      const updated = [id, ...filtered].slice(0, 8);
      localStorage.setItem("propconnect_recently_viewed", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not record recently viewed:", e);
    }
  }, [id]);

  // Load property from database / API
  useEffect(() => {
    let isMounted = true;
    async function loadProp() {
      try {
        const fetched = await fetchPropertyById(id);
        if (isMounted && fetched) {
          setProperty(fetched);
        } else if (isMounted && !property) {
          setProperty(propertyById(id));
        }
      } catch {
        if (isMounted && !property) {
          setProperty(propertyById(id));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProp();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Load favorite status
  useEffect(() => {
    let isMounted = true;
    async function checkFavorite() {
      try {
        const userId = user?.id || user?.entityId || "TEN001";
        const favData = await fetchFavorites(userId);
        if (isMounted && favData && favData.propertyIds) {
          setIsFavorite(favData.propertyIds.includes(id));
        }
      } catch (err) {
        console.warn("Could not fetch favorites status:", err);
      }
    }
    checkFavorite();
    return () => {
      isMounted = false;
    };
  }, [id, user]);

  // Load AI matching score and explanations for resident
  useEffect(() => {
    if (!property) return;
    let isMounted = true;
    async function loadMatching() {
      try {
        const userId = user?.id || user?.entityId || "TEN001";
        const prefs = await fetchTenantPreferences(userId);
        if (isMounted && prefs && prefs.city) {
          const ranked = rankPropertiesClient([property], prefs);
          if (ranked && ranked[0]) {
            setMatchResult(ranked[0]);
          }
        }
      } catch (err) {
        console.warn("Could not load matching for property details:", err);
      }
    }
    loadMatching();
    return () => {
      isMounted = false;
    };
  }, [property, user]);

  // Complete property gallery images
  const allGalleryImages = useMemo(() => {
    if (!property) return [];
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
      return property.images;
    }
    return generateGalleryForProperty(property);
  }, [property]);

  // Gallery categories supported for filtering (Exact 10 categories requested)
  const STANDARD_CATEGORIES = useMemo(
    () => [
      { key: "all", label: "All Photos" },
      { key: "Exterior", label: "Exterior" },
      { key: "Living Room", label: "Living Room" },
      { key: "Dining Area", label: "Dining Area" },
      { key: "Master Bedroom", label: "Master Bedroom" },
      { key: "Second Bedroom", label: "Second Bedroom" },
      { key: "Kitchen", label: "Kitchen" },
      { key: "Bathrooms", label: "Bathrooms" },
      { key: "Balcony", label: "Balcony" },
      { key: "Amenities", label: "Amenities" },
      { key: "Floor Plan", label: "Floor Plan" },
    ],
    []
  );

  // Filter available categories to only those with images present
  const availableCategories = useMemo(() => {
    const presentCats = new Set();
    allGalleryImages.forEach((img) => {
      const c = (img.category || "").toLowerCase();
      if (c.includes("exterior")) presentCats.add("Exterior");
      else if (c.includes("living")) presentCats.add("Living Room");
      else if (c.includes("dining")) presentCats.add("Dining Area");
      else if (c.includes("master") && c.includes("bed")) presentCats.add("Master Bedroom");
      else if (c.includes("second") || c.includes("bed 2") || (c.includes("bed") && !c.includes("master"))) {
        presentCats.add("Second Bedroom");
      } else if (c.includes("kitchen")) presentCats.add("Kitchen");
      else if (c.includes("bath")) presentCats.add("Bathrooms");
      else if (c.includes("balcony") || c.includes("sit-out")) presentCats.add("Balcony");
      else if (
        c.includes("amenit") ||
        c.includes("pool") ||
        c.includes("gym") ||
        c.includes("garden") ||
        c.includes("parking") ||
        c.includes("common")
      ) {
        presentCats.add("Amenities");
      } else if (c.includes("floor") || c.includes("plan")) {
        presentCats.add("Floor Plan");
      } else if (img.category) {
        presentCats.add(img.category);
      }
    });

    return STANDARD_CATEGORIES.filter(
      (sc) => sc.key === "all" || presentCats.has(sc.key) || presentCats.has(sc.label)
    );
  }, [allGalleryImages, STANDARD_CATEGORIES]);

  // Filtered gallery photos based on active category
  const filteredGalleryImages = useMemo(() => {
    if (galleryCategory === "all") return allGalleryImages;
    const catLow = galleryCategory.toLowerCase();
    return allGalleryImages.filter((img) => {
      const c = (img.category || "").toLowerCase();
      if (catLow === "exterior") return c.includes("exterior");
      if (catLow === "living room") return c.includes("living");
      if (catLow === "dining area") return c.includes("dining");
      if (catLow === "master bedroom") return c.includes("master") && c.includes("bed");
      if (catLow === "second bedroom") {
        return c.includes("second") || c.includes("bed 2") || (c.includes("bed") && !c.includes("master"));
      }
      if (catLow === "kitchen") return c.includes("kitchen");
      if (catLow === "bathrooms" || catLow === "bathroom") return c.includes("bath");
      if (catLow === "balcony") return c.includes("balcony") || c.includes("sit-out");
      if (catLow === "amenities") {
        return (
          c.includes("amenit") ||
          c.includes("pool") ||
          c.includes("gym") ||
          c.includes("garden") ||
          c.includes("parking") ||
          c.includes("common")
        );
      }
      if (catLow === "floor plan") return c.includes("floor") || c.includes("plan");
      return c === catLow || c.includes(catLow);
    });
  }, [allGalleryImages, galleryCategory]);

  // Reset selected image index when category changes
  useEffect(() => {
    setSelectedImageIndex(0);
    setZoomLevel(1);
  }, [galleryCategory]);

  const activeImage = filteredGalleryImages[selectedImageIndex] || allGalleryImages[0];

  // Gallery Navigation Handlers
  const handlePrevImage = useCallback(() => {
    setZoomLevel(1);
    setSelectedImageIndex((prev) =>
      prev === 0 ? filteredGalleryImages.length - 1 : prev - 1
    );
  }, [filteredGalleryImages.length]);

  const handleNextImage = useCallback(() => {
    setZoomLevel(1);
    setSelectedImageIndex((prev) =>
      prev === filteredGalleryImages.length - 1 ? 0 : prev + 1
    );
  }, [filteredGalleryImages.length]);

  // Open Lightbox directly at an image index or category
  const handleOpenLightbox = (indexOrCategory = 0) => {
    if (typeof indexOrCategory === "string") {
      setGalleryCategory(indexOrCategory);
      setSelectedImageIndex(0);
    } else {
      setSelectedImageIndex(indexOrCategory);
    }
    setZoomLevel(1);
    setIsLightboxOpen(true);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      else if (e.key === "ArrowLeft") handlePrevImage();
      else if (e.key === "ArrowRight") handleNextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, handlePrevImage, handleNextImage]);

  // Mobile touch swipe handlers
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      handleNextImage();
    } else if (diff < -50) {
      handlePrevImage();
    }
    setTouchStartX(null);
  };

  // Toggle favorite property (persists to MongoDB)
  const handleToggleFavorite = async () => {
    if (favLoading) return;
    setFavLoading(true);
    const userId = user?.id || user?.entityId || "TEN001";
    try {
      const res = await toggleFavoriteApi(userId, id);
      if (res && res.success) {
        setIsFavorite(res.isFavorite);
        showToastMsg(
          res.message || (res.isFavorite ? "Saved to favourites!" : "Removed from favourites.")
        );
      } else {
        setIsFavorite((prev) => !prev);
      }
    } catch {
      setIsFavorite((prev) => !prev);
    } finally {
      setFavLoading(false);
    }
  };

  // Share Property Link
  const handleShareProperty = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.name,
          text: `Explore ${property.name} on PropConnect – Warm Modern Luxury Residence!`,
          url,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      showToastMsg("Property link copied to clipboard!");
    } catch {
      showToastMsg("URL copied: " + url);
    }
  };

  // --------------------------------------------------------------------------
  // ROOM-BY-ROOM EXPLORATION: "Explore Every Corner" (Section 5)
  // --------------------------------------------------------------------------
  const exploreRooms = useMemo(() => {
    if (!allGalleryImages || allGalleryImages.length === 0) return [];

    const roomDefs = [
      {
        id: "living",
        title: "Living Room",
        icon: "🛋️",
        categoryKey: "Living Room",
        match: (c) => c.includes("living"),
        shortDesc: "Sun-drenched living hall featuring warm oak wall paneling, cream linen sofa, and floor-to-ceiling balcony access.",
      },
      {
        id: "dining",
        title: "Dining Area",
        icon: "🍽️",
        categoryKey: "Dining Area",
        match: (c) => c.includes("dining"),
        shortDesc: "Dedicated family dining space with a 6-seater natural white oak table and contemporary sculptural pendant fixture.",
      },
      {
        id: "master-bed",
        title: "Master Bedroom",
        icon: "🛏️",
        categoryKey: "Master Bedroom",
        match: (c) => c.includes("master") && c.includes("bed"),
        shortDesc: "Serene master bedroom suite with bespoke oak headboard, organic beige linens, and attached honed travertine bath.",
      },
      {
        id: "second-bed",
        title: "Second Bedroom",
        icon: "🛏️",
        categoryKey: "Second Bedroom",
        match: (c) =>
          c.includes("second") ||
          c.includes("bed 2") ||
          c.includes("guest") ||
          (c.includes("bed") && !c.includes("master")),
        shortDesc: "Airy guest bedroom or executive study with fitted oak desk, built-in wardrobes, and expansive morning light.",
      },
      {
        id: "kitchen",
        title: "Kitchen",
        icon: "🍳",
        categoryKey: "Kitchen",
        match: (c) => c.includes("kitchen"),
        shortDesc: "Italian-designed modular kitchen with sand quartz countertops, undermount sink, induction hob, and concealed storage.",
      },
      {
        id: "bathroom",
        title: "Bathroom",
        icon: "🚿",
        categoryKey: "Bathrooms",
        match: (c) => c.includes("bath"),
        shortDesc: "Spa-grade travertine bathrooms with floating oak double vanities, matte champagne brass fittings, and walk-in rain showers.",
      },
      {
        id: "balcony",
        title: "Balcony",
        icon: "🌅",
        categoryKey: "Balcony",
        match: (c) => c.includes("balcony") || c.includes("sit-out"),
        shortDesc: "Private outdoor sit-out balcony with teakwood deck tiles, woven armchairs, and sunset views over tree-lined avenues.",
      },
    ];

    // Filter only rooms with actual photographs for this property
    return roomDefs
      .map((r) => {
        const photos = allGalleryImages.filter((img) => r.match((img.category || "").toLowerCase()));
        return { ...r, photos };
      })
      .filter((r) => r.photos.length > 0);
  }, [allGalleryImages]);

  // Open Room Modal Viewer
  const handleOpenRoomModal = (room) => {
    setSelectedRoomModal(room);
    setRoomModalImgIdx(0);
  };

  // --------------------------------------------------------------------------
  // AMENITIES SECTION WITH IMAGE CARDS (Section 8)
  // --------------------------------------------------------------------------
  const amenityCards = useMemo(() => [
    {
      id: "pool",
      title: "Swimming Pool",
      photo: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80",
      description: "25-meter temperature-controlled rooftop infinity lap pool with natural timber decking and private cabana loungers.",
      tag: "Sample Feature (Demo)",
    },
    {
      id: "gym",
      title: "Gym & Fitness Studio",
      photo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
      description: "Wellness fitness suite equipped with Technogym cardio machines, free weight training zones, and mirrored yoga studio.",
      tag: "Sample Feature (Demo)",
    },
    {
      id: "garden",
      title: "Landscaped Zen Garden",
      photo: "https://images.unsplash.com/photo-1584738766473-61c083514bf4?auto=format&fit=crop&w=1200&q=80",
      description: "Lush landscaped courtyard garden with reflexology walking paths, meditation bamboo gazebo, and peaceful water cascade.",
      tag: "Sample Feature (Demo)",
    },
    {
      id: "parking",
      title: "Car Parking & EV Bay",
      photo: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
      description: "Covered stilt car parking bay with designated EV charging point (Slot CP-14) and 24x7 security boom barrier.",
      tag: "Sample Feature (Demo)",
    },
  ], []);

  // Floor plan image for non-Aurelia fallback
  const floorPlanImage = useMemo(() => {
    if (property?.floorPlan) return property.floorPlan;
    const fpItem = allGalleryImages.find(
      (img) =>
        (img.category || "").toLowerCase().includes("floor") ||
        (img.category || "").toLowerCase().includes("plan")
    );
    return fpItem ? fpItem.url : null;
  }, [property, allGalleryImages]);

  // Similar properties (Section 11)
  const similarProperties = useMemo(() => {
    if (!property) return [];
    return PROPERTIES.filter(
      (p) =>
        p.id !== property.id &&
        (p.city === property.city || p.bedrooms === property.bedrooms || Math.abs(p.rent - property.rent) < 12000)
    ).slice(0, 4);
  }, [property]);

  if (loading) {
    return (
      <div className="showcase-container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div className="hs-spinner" style={{ margin: "0 auto 16px auto" }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: "#78716c" }}>
          Loading The Aurelia property specifications…
        </p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="showcase-container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <h3>Property not found</h3>
        <p style={{ color: "#78716c" }}>Could not locate specifications for property ID &quot;{id}&quot;.</p>
        <button className="showcase-back-btn" onClick={() => navigate("../properties")}>
          ← Back to Properties
        </button>
      </div>
    );
  }

  const landlord = property.landlord || landlordById(property.landlordId);
  const utilityBills = UTILITY_BILLS.filter((b) => b.propertyId === property.id);
  const maintenanceTickets = MAINTENANCE_REQUESTS.filter((m) => m.propertyId === property.id);
  const isAvailable = (property.status || "").toLowerCase() === "available";
  const isAurelia = property.id === "TN-AURELIA" || (property.name || "").includes("Aurelia");

  // Main 5 photos for the Warm Modern Luxury showcase grid
  const heroImage = allGalleryImages[0] || { url: property.image, caption: property.name };
  const subImages = allGalleryImages.slice(1, 5);

  return (
    <div className="showcase-container animate-fade-in" style={{ background: "#fcfbfa" }}>
      {/* Toast Feedback */}
      {toast && (
        <div className="app-toast-container" style={{ zIndex: 999999 }}>
          <div className="app-toast success">
            <span>✓</span> {toast}
          </div>
        </div>
      )}

      {/* Top Banner: Quick Switcher to The Aurelia Showcase if viewing other properties */}
      {!isAurelia && (
        <div
          style={{
            background: "linear-gradient(135deg, #fbf7ee 0%, #f4ece1 100%)",
            border: "1px solid #e7dfd5",
            borderRadius: 12,
            padding: "10px 18px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <div>
              <strong style={{ color: "#292524", fontSize: 13.5 }}>Experience Featured Showcase:</strong>{" "}
              <span style={{ color: "#78716c", fontSize: 13 }}>The Aurelia – Premium 2BHK Apartment (Warm Modern Luxury)</span>
            </div>
          </div>
          <button
            type="button"
            className="showcase-action-btn"
            style={{ background: "#b48448", color: "#ffffff", borderColor: "#b48448", fontWeight: 700 }}
            onClick={() => {
              navigate("/properties/TN-AURELIA");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Explore The Aurelia →
          </button>
        </div>
      )}

      {/* Top Navigation & Social Controls */}
      <div className="showcase-nav-bar">
        <button className="showcase-back-btn" onClick={() => navigate(-1)}>
          ← {t("backToProperties") || "Back to Properties"}
        </button>

        <div className="showcase-top-actions">
          <button type="button" className="showcase-action-btn" onClick={handleShareProperty}>
            🔗 Share Property
          </button>
          <button
            type="button"
            className={`showcase-action-btn ${isFavorite ? "fav-active" : ""}`}
            onClick={handleToggleFavorite}
            disabled={favLoading}
          >
            {isFavorite ? "❤️ Saved in Favourites" : "♡ Save Property"}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 4: PROPERTY OVERVIEW HEADER                                   */}
      {/* ===================================================================== */}
      <div className="showcase-header">
        <div className="showcase-title-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h1 className="showcase-prop-title" style={{ color: "#292524" }}>{property.name}</h1>
              {property.isSampleListing && (
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid #fde68a",
                    letterSpacing: "0.02em",
                  }}
                >
                  SAMPLE LISTING (DEMO)
                </span>
              )}
            </div>

            <div className="showcase-address-row">
              <span>📍 {property.address || property.location}</span>
              <span>•</span>
              <span className="city-pill">🏙️ {property.city}</span>
              <span>•</span>
              <span className={`showcase-status-badge ${isAvailable ? "available" : "occupied"}`}>
                {isAvailable ? "● Available for Move-in" : "● Currently Occupied"}
              </span>
              <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#8c6239" }}>
                🔑 Ready for Immediate Move-in
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 3: MAIN PROPERTY PHOTO GALLERY (10 CATEGORIES, 19 PHOTOS)     */}
      {/* ===================================================================== */}
      <div className="showcase-gallery-wrap" style={{ background: "#292524", borderColor: "#e7dfd5" }}>
        {/* Category Filter Chips Bar */}
        <div className="showcase-cat-bar" style={{ background: "#ffffff", borderTopColor: "#f5f0e8" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#78716c", textTransform: "uppercase", marginRight: 4 }}>
            Gallery:
          </span>
          {availableCategories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              className={`showcase-cat-chip ${galleryCategory === cat.key ? "active" : ""}`}
              onClick={() => {
                setGalleryCategory(cat.key);
                if (cat.key !== "all") {
                  handleOpenLightbox(cat.key);
                }
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 5-Photo Warm Modern Luxury Showcase Grid */}
        <div className="showcase-photo-grid">
          {/* Main Hero Photo (Left) */}
          <div
            className="showcase-hero-img-box"
            onClick={() => handleOpenLightbox(0)}
            title="Click to expand fullscreen gallery"
          >
            <img
              src={heroImage.url}
              alt={heroImage.caption || property.name}
              className="showcase-grid-img"
            />
            <div className="showcase-item-overlay">
              <span style={{ color: "#fef3c7" }}>🏷️ {heroImage.category || "Exterior"}</span>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#e7dfd5" }}>Click to view full photo set</span>
            </div>
          </div>

          {/* 4 Preview Photos (Right: 2x2 grid) */}
          <div className="showcase-sub-grid">
            {subImages.length > 0 ? (
              subImages.map((img, idx) => (
                <div
                  key={img.id || idx}
                  className="showcase-grid-item"
                  onClick={() => handleOpenLightbox(idx + 1)}
                  title={`View ${img.category || "photo"}`}
                >
                  <img
                    src={img.url}
                    alt={img.caption || `Property view ${idx + 2}`}
                    className="showcase-grid-img"
                  />
                  <div className="showcase-item-overlay">
                    <span>{img.category || `Photo ${idx + 2}`}</span>
                  </div>
                </div>
              ))
            ) : (
              <div
                className="showcase-grid-item"
                style={{
                  gridColumn: "span 2",
                  gridRow: "span 2",
                  background: "#1c1917",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a8a29e",
                  fontSize: "13px",
                }}
              >
                Full photo set available in gallery
              </div>
            )}
          </div>
        </div>

        {/* Floating View All Photos Button */}
        <button
          type="button"
          className="showcase-view-all-btn"
          style={{ background: "#ffffff", color: "#292524", borderColor: "#e7dfd5" }}
          onClick={() => handleOpenLightbox(0)}
        >
          📷 View all {allGalleryImages.length} photos
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TWO-COLUMN WARM MODERN LUXURY SAAS LAYOUT                             */}
      {/* ===================================================================== */}
      <div className="showcase-layout-grid">
        {/* =================================================================== */}
        {/* LEFT COLUMN: ROOMS, FLOOR PLAN, VIRTUAL TOUR, AMENITIES, LOCATION   */}
        {/* =================================================================== */}
        <div className="showcase-main-content">
          {/* Section 4 Overview Specification Badges */}
          <div>
            <div className="showcase-specs-pills">
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🛏️ <strong>{property.bedrooms ? `${property.bedrooms} BHK` : "2 BHK"}</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🚿 <strong>{property.bathrooms || 2} Bathrooms</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                📐 <strong>{property.sqft || property.area || 1350} sqft (Super Built-up)</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🛋️ <strong>{property.furnishing || "Fully Furnished"}</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🧭 <strong>{property.facing || "East (Vastu Compliant)"}</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🏢 <strong>{property.floor || "4th of 8 Floors"}</strong>
              </div>
              <div className="showcase-spec-pill" style={{ background: "#fdfbf7", borderColor: "#e7dfd5" }}>
                🚗 <strong>{property.parking || "1 Covered Stilt Bay (EV Ready)"}</strong>
              </div>
            </div>

            {/* Property Narrative Description */}
            {property.description && (
              <div
                style={{
                  lineHeight: 1.75,
                  color: "#44403c",
                  fontSize: "14.5px",
                  background: "#ffffff",
                  padding: "18px 22px",
                  borderRadius: 12,
                  border: "1px solid #e7dfd5",
                  marginBottom: 16,
                }}
              >
                {property.description}
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 5: "EXPLORE EVERY CORNER" (ROOM-BY-ROOM WALKTHROUGH)      */}
          {/* ================================================================= */}
          {exploreRooms.length > 0 && (
            <div>
              <div className="showcase-section-header">
                <div>
                  <h3 style={{ color: "#292524" }}>✨ Explore Every Corner</h3>
                  <div className="showcase-section-subtitle">
                    Click any room to open dedicated photo inspection, architectural notes, and daylight observations.
                  </div>
                </div>
              </div>

              <div className="showcase-room-grid">
                {exploreRooms.map((room) => {
                  const leadPhoto = room.photos[0];
                  return (
                    <div
                      key={room.id}
                      className="showcase-room-card"
                      style={{ borderColor: "#e7dfd5", background: "#ffffff" }}
                    >
                      <div
                        className="showcase-room-photo-box"
                        onClick={() => handleOpenRoomModal(room)}
                        title={`Explore ${room.title}`}
                      >
                        <img
                          src={leadPhoto.url}
                          alt={leadPhoto.caption || room.title}
                          className="showcase-room-img"
                        />
                        <div className="showcase-room-tag" style={{ background: "rgba(41,37,36,0.85)" }}>
                          {room.icon} {room.title}
                        </div>
                        <div className="showcase-room-count">
                          📷 {room.photos.length} Photo{room.photos.length > 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="showcase-room-body">
                        <h4 className="showcase-room-title" style={{ color: "#292524" }}>
                          <span>{room.icon}</span> {room.title}
                        </h4>
                        <p className="showcase-room-desc" style={{ color: "#57534e" }}>
                          {room.shortDesc || leadPhoto.caption}
                        </p>

                        <button
                          type="button"
                          className="showcase-room-action-btn"
                          style={{ color: "#8c6239", borderColor: "#dfd5c7" }}
                          onClick={() => handleOpenRoomModal(room)}
                        >
                          Explore Room Photos ({room.photos.length}) →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 6: CUSTOM 2BHK ARCHITECTURAL FLOOR PLAN                   */}
          {/* ================================================================= */}
          <div>
            <div className="showcase-section-header">
              <div>
                <h3 style={{ color: "#292524" }}>📐 2BHK Architectural Floor Plan</h3>
                <div className="showcase-section-subtitle">
                  Original illustrative top-down layout showing spatial flow, room dimensions, and door/window clearances.
                </div>
              </div>
            </div>

            {isAurelia ? (
              <TheAureliaFloorPlan
                onSelectRoom={(roomId) => {
                  const matched = exploreRooms.find((r) => r.id === roomId || r.categoryKey.toLowerCase().includes(roomId));
                  if (matched) handleOpenRoomModal(matched);
                }}
              />
            ) : floorPlanImage ? (
              <div className="showcase-fp-card" style={{ borderColor: "#e7dfd5" }}>
                <div
                  className="showcase-fp-viewport"
                  onClick={() => setIsFpFullscreen(true)}
                  title="Click to view fullscreen floor plan"
                >
                  <img
                    src={floorPlanImage}
                    alt={`Floor plan for ${property.name}`}
                    className="showcase-fp-img"
                    style={{ transform: `scale(${fpZoom})` }}
                  />

                  {/* Zoom Controls */}
                  <div className="showcase-fp-controls" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="showcase-fp-ctrl-btn" onClick={() => setFpZoom((z) => Math.min(2.5, z + 0.25))}>🔍+</button>
                    <button type="button" className="showcase-fp-ctrl-btn" onClick={() => setFpZoom((z) => Math.max(0.75, z - 0.25))}>🔍-</button>
                    <button type="button" className="showcase-fp-ctrl-btn" onClick={() => setFpZoom(1)}>↺</button>
                    <button type="button" className="showcase-fp-ctrl-btn" onClick={() => setIsFpFullscreen(true)}>⛶</button>
                  </div>
                </div>

                <div className="showcase-fp-specs-table">
                  <div className="showcase-fp-spec-item">
                    <span>Super Built-up Area</span>
                    <strong>{property.sqft || property.area || 800} sqft</strong>
                  </div>
                  <div className="showcase-fp-spec-item">
                    <span>Configuration</span>
                    <strong>{property.bedrooms ? `${property.bedrooms} BHK` : "Flat"} + {property.bathrooms || 1} Bath</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="showcase-tour-empty" style={{ borderColor: "#dfd5c7", background: "#fcfbfa" }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>📐</div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#292524" }}>
                  Floor Plan Not Uploaded Yet
                </h4>
                <p style={{ margin: "0 auto", maxWidth: 440, fontSize: 13, color: "#78716c" }}>
                  An architectural 2D blueprint has not been uploaded for this unit yet. Refer to the room specifications above.
                </p>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 7: VIRTUAL TOUR & GUIDED WALKTHROUGH                      */}
          {/* ================================================================= */}
          <div>
            <div className="showcase-section-header">
              <div>
                <h3 style={{ color: "#292524" }}>🌐 Experience the Home – Virtual Tour</h3>
                <div className="showcase-section-subtitle">
                  Interactive 360° panoramic navigation with drag-to-look and guided step-by-step room walkthrough.
                </div>
              </div>
            </div>

            <VirtualTourViewer />
          </div>

          {/* ================================================================= */}
          {/* SECTION 8: AMENITIES IMAGE CARDS                                  */}
          {/* ================================================================= */}
          <div>
            <div className="showcase-section-header">
              <div>
                <h3 style={{ color: "#292524" }}>✨ Residential Amenities &amp; Lifestyle</h3>
                <div className="showcase-section-subtitle">
                  Curated lifestyle features and community facilities (Sample features for preview).
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              {amenityCards.map((amn) => (
                <div
                  key={amn.id}
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#ffffff",
                    border: "1px solid #e7dfd5",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
                    <img
                      src={amn.photo}
                      alt={amn.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        background: "rgba(41,37,36,0.85)",
                        backdropFilter: "blur(6px)",
                        color: "#fde68a",
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {amn.tag}
                    </span>
                  </div>
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h5 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#292524" }}>
                      {amn.title}
                    </h5>
                    <p style={{ margin: 0, fontSize: 12.5, color: "#57534e", lineHeight: 1.5 }}>
                      {amn.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION 9: LOCATION & INTERACTIVE MAP                             */}
          {/* ================================================================= */}
          <div>
            <div className="showcase-section-header">
              <div>
                <h3 style={{ color: "#292524" }}>📍 Location &amp; Neighborhood Connectivity</h3>
                <div className="showcase-section-subtitle">
                  {property.address || property.location || property.city}
                </div>
              </div>
            </div>

            <div className="showcase-location-card" style={{ borderColor: "#e7dfd5" }}>
              <PropertyLocationMap property={property} />

              {property.nearbyFacilities && property.nearbyFacilities.length > 0 && (
                <div className="showcase-nearby-grid">
                  {property.nearbyFacilities.map((facility, fIdx) => (
                    <div key={fIdx} className="showcase-nearby-item" style={{ borderColor: "#e7dfd5", background: "#fcfbfa" }}>
                      <span>📍</span>
                      <span>{facility}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECONDARY FUNCTIONAL TABS (Utility Meters, Maintenance Ledger)    */}
          {/* ================================================================= */}
          <div style={{ marginTop: 12 }}>
            <div className="tabs" style={{ marginBottom: "16px" }}>
              <button
                className={activeTab === "overview" ? "active" : ""}
                onClick={() => setActiveTab("overview")}
              >
                Building Specs &amp; Engineering
              </button>
              <button
                className={activeTab === "utilities" ? "active" : ""}
                onClick={() => setActiveTab("utilities")}
              >
                Utility Meters &amp; Bills ({utilityBills.length})
              </button>
              <button
                className={activeTab === "maintenance" ? "active" : ""}
                onClick={() => setActiveTab("maintenance")}
              >
                Service &amp; Maintenance ({maintenanceTickets.length})
              </button>
            </div>

            {activeTab === "overview" && (
              <div className="card specs-card" style={{ padding: 20, borderColor: "#e7dfd5" }}>
                <h4 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#292524" }}>Engineering &amp; Utility Inclusions</h4>
                <div className="specs-grid">
                  <div className="spec-item">
                    <span className="spec-icon">⚡</span>
                    <div>
                      <span className="spec-name">TNEB Consumer Number</span>
                      <span className="spec-data">{property.ebConsumerNo || "01-105-008-8821"}</span>
                    </div>
                  </div>
                  <div className="spec-item">
                    <span className="spec-icon">💧</span>
                    <div>
                      <span className="spec-name">Water Connection</span>
                      <span className="spec-data">{property.waterConnection || "24x7 CMWSSB Treated Water + Hydro-pneumatic"}</span>
                    </div>
                  </div>
                  <div className="spec-item">
                    <span className="spec-icon">🏗️</span>
                    <div>
                      <span className="spec-name">Builder / Developer</span>
                      <span className="spec-data">{property.builder || "Aurelia Luxury Residences"}</span>
                    </div>
                  </div>
                  <div className="spec-item">
                    <span className="spec-icon">🗓️</span>
                    <div>
                      <span className="spec-name">Year Built</span>
                      <span className="spec-data">{property.yearBuilt || 2024}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "utilities" && (
              <div className="card" style={{ borderColor: "#e7dfd5" }}>
                <div className="card-header">
                  <div>
                    <h3>Utility Meters &amp; Recurring Bills</h3>
                    <p className="card-subtitle">EB power and CMWSSB water connections for {property.name}</p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill ID</th>
                        <th>Service Type</th>
                        <th>Consumer No</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilityBills.map((b) => (
                        <tr key={b.id}>
                          <td><strong>{b.id}</strong></td>
                          <td>{b.type}</td>
                          <td><small>{b.consumerNo}</small></td>
                          <td><strong>{formatCurrency(b.amount)}</strong></td>
                          <td>{b.dueDate}</td>
                          <td>
                            <span className={`pill ${b.status.toLowerCase()}`}>{b.status}</span>
                          </td>
                        </tr>
                      ))}
                      {utilityBills.length === 0 && (
                        <tr>
                          <td colSpan={6} className="empty">
                            No pending utility bills logged for this unit.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "maintenance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <PreferredProvidersCard propertyId={property.id} unit={property.unit || "Residence 402"} />
                <PropertyMaintenanceHistoryCard propertyId={property.id} propertyName={property.name} unit={property.unit || "Residence 402"} />
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: STICKY RENTAL SUMMARY & LANDLORD CONTACT PANEL        */}
        {/* =================================================================== */}
        <div className="showcase-sticky-sidebar">
          {/* SECTION 10: COMPACT STICKY RENTAL CARD */}
          <div className="showcase-pricing-card" style={{ borderColor: "#e7dfd5", background: "#ffffff" }}>
            <div className="showcase-rent-header">
              <span className="showcase-rent-val" style={{ color: "#292524" }}>{formatCurrency(property.rent)}</span>
              <span className="showcase-rent-period">/ month rent</span>
            </div>

            <div className="showcase-deposit-tag">
              <span>🔒 Security Deposit: <strong>{formatCurrency(property.deposit)}</strong></span>
            </div>

            <table className="showcase-breakdown-table">
              <tbody>
                <tr>
                  <td className="label">Monthly Rent</td>
                  <td className="value">{formatCurrency(property.rent)}</td>
                </tr>
                <tr>
                  <td className="label">Security Deposit</td>
                  <td className="value">{formatCurrency(property.deposit)}</td>
                </tr>
                <tr>
                  <td className="label">Maintenance Charges</td>
                  <td className="value">
                    {property.maintenanceCharges ? `${formatCurrency(property.maintenanceCharges)}/mo` : "Included in Rent"}
                  </td>
                </tr>
                <tr>
                  <td className="label">Furnishing Status</td>
                  <td className="value">{property.furnishing || "Fully Furnished"}</td>
                </tr>
                <tr>
                  <td className="label">Lease Agreement Term</td>
                  <td className="value">11 Months (Renewable)</td>
                </tr>
                <tr>
                  <td className="label">Move-in Availability</td>
                  <td className="value" style={{ color: "#16a34a" }}>
                    {isAvailable ? "Immediate / Ready" : "Occupied"}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Action CTAs */}
            <button
              type="button"
              className="showcase-primary-cta"
              style={{ background: "linear-gradient(135deg, #b48448 0%, #8c6239 100%)", boxShadow: "0 4px 14px rgba(140, 98, 57, 0.35)" }}
              onClick={() => setShowVisitModal(true)}
            >
              📅 Schedule a Physical Visit
            </button>

            <button
              type="button"
              className="showcase-secondary-cta"
              style={{ borderColor: "#dfd5c7", color: "#292524" }}
              onClick={() => setShowChatModal(true)}
            >
              💬 Chat with Landlord / Enquire
            </button>
          </div>

          {/* AI MATCHING CARD */}
          {matchResult && matchResult.matchScore && (
            <div className="showcase-ai-match-card" style={{ borderColor: "#e7dfd5", borderLeftColor: "#b48448" }}>
              <div
                className="showcase-ai-header"
                onClick={() => setAiMatchExpanded((prev) => !prev)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🎯</span>
                  <div>
                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#292524" }}>
                      AI Preference Match
                    </h5>
                    <span style={{ fontSize: 11.5, color: "#78716c" }}>
                      Based on your housing search criteria
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="showcase-ai-score-pill" style={{ background: "#fef3c7", color: "#92400e" }}>
                    {matchResult.matchScore}%
                  </span>
                  <span style={{ fontSize: 12, color: "#a8a29e" }}>
                    {aiMatchExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {aiMatchExpanded && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f5f0e8" }}>
                  {matchResult.reasons && matchResult.reasons.length > 0 && (
                    <ul style={{ margin: "0 0 10px 0", paddingLeft: 18, fontSize: 12.5, color: "#44403c" }}>
                      {matchResult.reasons.map((r, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LANDLORD PROFILE CARD */}
          {landlord && (
            <div className="showcase-landlord-card" style={{ borderColor: "#e7dfd5" }}>
              <div className="showcase-landlord-header">
                <div className="showcase-landlord-avatar" style={{ background: "#f5efe6", color: "#8c6239", borderColor: "#dfd5c7" }}>
                  {landlord.name ? landlord.name.charAt(0) : "🏠"}
                </div>
                <div className="showcase-landlord-meta">
                  <h4 style={{ color: "#292524" }}>{landlord.name}</h4>
                  <div className="showcase-verified-badge" style={{ color: "#15803d" }}>
                    ✓ Verified Property Owner
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "12.5px", color: "#57534e", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                <div>📞 <strong>Phone:</strong> {landlord.phone || "+91 98840 55432"}</div>
                <div>✉️ <strong>Email:</strong> {landlord.email || "senthil.murugan@mail.com"}</div>
                {landlord.location && (
                  <div>📍 <strong>Office:</strong> {landlord.location}</div>
                )}
              </div>

              <button
                type="button"
                className="showcase-action-btn"
                style={{ width: "100%", justifyContent: "center", borderColor: "#dfd5c7" }}
                onClick={() => setShowChatModal(true)}
              >
                💬 Send Direct Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 11: SIMILAR PROPERTIES (UP TO 4 RELEVANT APARTMENTS)          */}
      {/* ===================================================================== */}
      {similarProperties.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <div className="showcase-section-header">
            <div>
              <h3 style={{ color: "#292524" }}>🏡 Similar Properties You Might Like</h3>
              <div className="showcase-section-subtitle">
                Alternative verified rentals in {property.city} matching your budget and space requirements.
              </div>
            </div>
          </div>

          <div className="showcase-similar-grid">
            {similarProperties.map((simProp) => (
              <div
                key={simProp.id}
                className="showcase-similar-card"
                style={{ borderColor: "#e7dfd5" }}
                onClick={() => {
                  navigate(`/properties/${simProp.id}`);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <img
                  src={simProp.image}
                  alt={simProp.name}
                  className="showcase-similar-img"
                  loading="lazy"
                />
                <div className="showcase-similar-body">
                  <div className="showcase-similar-price" style={{ color: "#292524" }}>
                    {formatCurrency(simProp.rent)}
                    <span style={{ fontSize: "12px", color: "#78716c", fontWeight: 500 }}>/mo</span>
                  </div>
                  <h5 className="showcase-similar-name">{simProp.name}</h5>
                  <div className="showcase-similar-loc">📍 {simProp.location || simProp.city}</div>
                  <div className="showcase-similar-specs">
                    <span>🛏️ {simProp.bedrooms ? `${simProp.bedrooms} BHK` : "Flat"}</span>
                    <span>•</span>
                    <span>📐 {simProp.area || simProp.sqft || 800} sqft</span>
                    <span>•</span>
                    <span>🛋️ {simProp.furnishing || "Standard"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 5: ROOM EXPLORATION MODAL                                     */}
      {/* ===================================================================== */}
      {selectedRoomModal && (
        <div
          className="showcase-lightbox-backdrop"
          onClick={() => setSelectedRoomModal(null)}
          style={{ zIndex: 999999 }}
        >
          <div className="showcase-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>{selectedRoomModal.icon}</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedRoomModal.title}</h4>
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                  Photo {roomModalImgIdx + 1} of {selectedRoomModal.photos.length}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setSelectedRoomModal(null)}
            >
              ✕
            </button>
          </div>

          <div
            className="showcase-lightbox-stage"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedRoomModal.photos.length > 1 && (
              <button
                type="button"
                className="showcase-lightbox-arrow prev"
                onClick={() => setRoomModalImgIdx((prev) => (prev === 0 ? selectedRoomModal.photos.length - 1 : prev - 1))}
              >
                ‹
              </button>
            )}

            <img
              src={selectedRoomModal.photos[roomModalImgIdx]?.url}
              alt={selectedRoomModal.photos[roomModalImgIdx]?.caption || selectedRoomModal.title}
              className="showcase-lightbox-img"
            />

            {selectedRoomModal.photos.length > 1 && (
              <button
                type="button"
                className="showcase-lightbox-arrow next"
                onClick={() => setRoomModalImgIdx((prev) => (prev === selectedRoomModal.photos.length - 1 ? 0 : prev + 1))}
              >
                ›
              </button>
            )}
          </div>

          <div className="showcase-lightbox-footer" onClick={(e) => e.stopPropagation()}>
            <div className="showcase-lightbox-caption">
              {selectedRoomModal.photos[roomModalImgIdx]?.caption || selectedRoomModal.shortDesc}
            </div>
            {selectedRoomModal.photos.length > 1 && (
              <div className="showcase-lightbox-thumbs">
                {selectedRoomModal.photos.map((p, idx) => (
                  <img
                    key={p.id || idx}
                    src={p.url}
                    alt=""
                    className={`showcase-mini-thumb ${roomModalImgIdx === idx ? "active" : ""}`}
                    onClick={() => setRoomModalImgIdx(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULLSCREEN LIGHTBOX / GALLERY MODAL (ALL 19 PHOTOS)                   */}
      {/* ===================================================================== */}
      {isLightboxOpen && (
        <div
          className="showcase-lightbox-backdrop"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="showcase-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{property.name}</span>
              <span style={{ fontSize: 13, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 9999 }}>
                🏷️ {activeImage?.category || "Photo"}
              </span>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                {selectedImageIndex + 1} of {filteredGalleryImages.length}
              </span>
            </div>

            {/* Zoom Controls & Close */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                className="showcase-action-btn"
                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.3).toFixed(2)))}
                title="Zoom In"
              >
                🔍+
              </button>
              <button
                type="button"
                className="showcase-action-btn"
                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                onClick={() => setZoomLevel((z) => Math.max(1, +(z - 0.3).toFixed(2)))}
                title="Zoom Out"
              >
                🔍-
              </button>
              <button
                type="button"
                className="showcase-action-btn"
                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
              >
                ↺ Reset
              </button>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => setIsLightboxOpen(false)}
                title="Close Lightbox (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="showcase-lightbox-stage"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {filteredGalleryImages.length > 1 && (
              <button
                type="button"
                className="showcase-lightbox-arrow prev"
                onClick={handlePrevImage}
                title="Previous (ArrowLeft)"
              >
                ‹
              </button>
            )}

            <img
              src={activeImage?.url}
              alt={activeImage?.caption || property.name}
              className="showcase-lightbox-img"
              style={{ transform: `scale(${zoomLevel})` }}
            />

            {filteredGalleryImages.length > 1 && (
              <button
                type="button"
                className="showcase-lightbox-arrow next"
                onClick={handleNextImage}
                title="Next (ArrowRight)"
              >
                ›
              </button>
            )}
          </div>

          <div className="showcase-lightbox-footer" onClick={(e) => e.stopPropagation()}>
            <div className="showcase-lightbox-caption">
              <strong>{activeImage?.category}:</strong> {activeImage?.caption || `High-definition photo of ${property.name}.`}
            </div>

            <div className="showcase-lightbox-thumbs">
              {filteredGalleryImages.map((img, idx) => (
                <img
                  key={img.id || idx}
                  src={img.url}
                  alt=""
                  className={`showcase-mini-thumb ${selectedImageIndex === idx ? "active" : ""}`}
                  onClick={() => {
                    setZoomLevel(1);
                    setSelectedImageIndex(idx);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULLSCREEN FLOOR PLAN MODAL (FOR FALLBACK PLANS)                      */}
      {/* ===================================================================== */}
      {isFpFullscreen && floorPlanImage && (
        <div
          className="showcase-lightbox-backdrop"
          onClick={() => setIsFpFullscreen(false)}
        >
          <div className="showcase-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>📐 Floor Plan – {property.name}</span>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setIsFpFullscreen(false)}
            >
              ✕
            </button>
          </div>

          <div className="showcase-lightbox-stage" onClick={(e) => e.stopPropagation()}>
            <img
              src={floorPlanImage}
              alt="Floor plan"
              style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", transform: `scale(${fpZoom})` }}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MOBILE STICKY BOTTOM ACTIONS BAR                                      */}
      {/* ===================================================================== */}
      <div className="showcase-mobile-bar" style={{ background: "#ffffff", borderColor: "#e7dfd5" }}>
        <div className="showcase-mobile-price">
          <strong style={{ color: "#292524" }}>{formatCurrency(property.rent)}</strong>
          <span>per month rent</span>
        </div>

        <div className="showcase-mobile-actions">
          <button
            type="button"
            className="showcase-action-btn"
            style={{ padding: "8px 12px", fontSize: "12px", borderColor: "#dfd5c7" }}
            onClick={() => setShowChatModal(true)}
          >
            💬 Chat
          </button>
          <button
            type="button"
            className="showcase-action-btn"
            style={{ padding: "8px 14px", fontSize: "12px", background: "#b48448", color: "#fff", borderColor: "#b48448", fontWeight: 700 }}
            onClick={() => setShowVisitModal(true)}
          >
            📅 Schedule Visit
          </button>
        </div>
      </div>

      {/* Modals */}
      {showChatModal && (
        <PropertyChatModal
          property={property}
          onClose={() => setShowChatModal(false)}
        />
      )}

      {showVisitModal && (
        <ScheduleVisitModal
          property={property}
          onClose={() => setShowVisitModal(false)}
          onSuccess={() => {
            showToastMsg(`Visit request for ${property.name} submitted successfully!`);
          }}
        />
      )}

      {dispatchTicket && (
        <FixItDispatchModal
          complaint={dispatchTicket}
          onClose={() => setDispatchTicket(null)}
          onSuccess={(newBooking) => {
            setDispatchTicket(null);
            showToastMsg(`🎉 Technician Dispatched! ${newBooking.technicianName || "Kumar S."} is on the way.`);
            setTrackingBooking(newBooking);
          }}
        />
      )}

      {trackingBooking && (
        <LiveTrackingModal
          booking={trackingBooking}
          onClose={() => setTrackingBooking(null)}
          onServiceCompleted={(completedBooking) => {
            setTrackingBooking(null);
            setReviewBooking(completedBooking);
          }}
        />
      )}

      {reviewBooking && (
        <ServiceReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => {
            showToastMsg("⭐ Review saved! Recorded into Property Maintenance History Ledger.");
          }}
        />
      )}
    </div>
  );
}
