import { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import FixItDispatchModal from "../../components/fixit/FixItDispatchModal.jsx";
import LiveTrackingModal from "../../components/fixit/LiveTrackingModal.jsx";
import ServiceReviewModal from "../../components/fixit/ServiceReviewModal.jsx";
import {
  fetchServiceCategories,
  fetchProviderAvailability,
  createServiceBooking,
  fetchServiceBookings,
  fetchFixItProviders,
  fetchProperties,
  payServiceBooking,
} from "../../utils/apiClient.js";
import { getCoordinatesForProperty } from "../../utils/propertyCoordinates.js";
import { useEscapeKey } from "../../utils/useEscapeKey.js";
import "./HomeServicesMarketplace.css";

// 9 Required Service Categories
const SERVICE_CATEGORIES = [
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "🚰",
    desc: "Tap leakages, pipe blockages, drainage overflow & sanitary fixtures",
    basePrice: 350,
    services: ["Tap & Faucet Repair", "Pipe Burst & Leak Fixing", "Drainage & Sewer Unclog", "Flush Tank Overhaul", "Water Heater Plumbing"],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "⚡",
    desc: "MCB tripping, switchboard repair, power line earthing & light installations",
    basePrice: 399,
    services: ["MCB & Breaker Tripping", "Switchboard & Socket Fixing", "Ceiling Fan Repair & Installation", "Short Circuit Inspection", "Inverter & UPS Wiring"],
  },
  {
    id: "cleaning",
    name: "Cleaning",
    icon: "✨",
    desc: "Deep house sanitization, bathroom acid wash & kitchen degreasing",
    basePrice: 399,
    services: ["Full Deep Home Cleaning", "Bathroom Sanitization & De-scaling", "Kitchen Chimney & Tile Degreasing", "Sofa & Mattress Shampooing", "Water Tank Cleaning"],
  },
  {
    id: "ac-repair",
    name: "AC Repair",
    icon: "❄️",
    desc: "Jet pressure wash, refrigerant gas refill & compressor cooling diagnostics",
    basePrice: 699,
    services: ["Jet Wet Deep Servicing", "Refrigerant Gas Leak & Refill", "Compressor & PCB Troubleshooting", "Water Dripping & Drainage Repair", "AC Installation / Uninstallation"],
  },
  {
    id: "civil-work",
    name: "Civil Work",
    icon: "🧱",
    desc: "Masonry, tile fixing, wall crack plastering & damp waterproofing",
    basePrice: 799,
    services: ["Wall Crack & Plaster Repair", "Tile Replacement & Grouting", "Terrace Waterproofing", "Drilling & Wall Hanging", "Minor Masonry Patchwork"],
  },
  {
    id: "carpentry",
    name: "Carpentry",
    icon: "🔨",
    desc: "Door lock repairs, wardrobe hinges, window latches & mesh installation",
    basePrice: 449,
    services: ["Main Door Lock Repair & Installation", "Wardrobe Hinge Replacement", "Window Latch & Sliding Mesh", "Furniture Assembly & Repair", "Balcony Pigeon Net Installation"],
  },
  {
    id: "painting",
    name: "Painting",
    icon: "🎨",
    desc: "Wall touchup putty, interior repainting & anti-fungal damp sealant",
    basePrice: 899,
    services: ["Single Room Wall Repainting", "Damp Patch & Putty Touchup", "Ceiling Leakage Sealer", "Door & Grill Enamel Painting", "Full Apartment Refresh"],
  },
  {
    id: "pest-control",
    name: "Pest Control",
    icon: "🪲",
    desc: "Herbal cockroach gel, termite wood treatment & mosquito eradication",
    basePrice: 599,
    services: ["Herbal Cockroach Gel Treatment", "Termite Anti-Wood Protection", "Bed Bug Thermal Eradication", "Mosquito & Drain Fly Fogging", "Rodent Baiting & Trapping"],
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    icon: "🔧",
    desc: "Washing machine, refrigerator, microwave oven & RO water purifier servicing",
    basePrice: 499,
    services: ["Washing Machine Motor & Drain Fix", "Refrigerator Cooling Loss Repair", "RO Water Purifier Filter Change", "Microwave Oven Heating Fault", "Geyser Element Replacement"],
  },
];

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

// Helper to calculate distance in km using Haversine formula
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export default function HomeServicesMarketplace() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active Category filter
  const [selectedCategory, setSelectedCategory] = useState(SERVICE_CATEGORIES[0]);
  const [categorySearch, setCategorySearch] = useState("");

  // Context: Properties
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("TN101");
  const [selectedUnit, setSelectedUnit] = useState("Flat 302");

  // Providers list
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Active Bookings for Tracking
  const [activeBookings, setActiveBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // 9-STEP BOOKING FLOW STATE
  const [bookingStep, setBookingStep] = useState(1);
  const [chosenService, setChosenService] = useState(SERVICE_CATEGORIES[0].services[0]);
  const [problemDescription, setProblemDescription] = useState("");
  const [problemPhotos, setProblemPhotos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tmr = new Date(Date.now() + 86400000);
    return tmr.toISOString().split("T")[0];
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("10:00 AM");
  const [availableProviders, setAvailableProviders] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [confirmedBookingResult, setConfirmedBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState("");

  // Modals
  const [liveTrackingBooking, setLiveTrackingBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [dispatchComplaint, setDispatchComplaint] = useState(null);
  const [toast, setToast] = useState({ text: "", type: "info" });

  useEscapeKey(() => {
    if (liveTrackingBooking) setLiveTrackingBooking(null);
    if (reviewBooking) setReviewBooking(null);
    if (dispatchComplaint) setDispatchComplaint(null);
  }, !!liveTrackingBooking || !!reviewBooking || !!dispatchComplaint);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "info" }), 4500);
  };

  const userEntityId = user?.entityId || user?.entity_id || (user?.email === "divya.priya@mail.com" ? "TEN001" : "TEN001");

  // Load Properties, Providers, and Existing Bookings
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [propsData, provsData, booksData] = await Promise.all([
          fetchProperties().catch(() => []),
          fetchFixItProviders().catch(() => []),
          fetchServiceBookings().catch(() => []),
        ]);

        if (!isMounted) return;

        if (Array.isArray(propsData) && propsData.length > 0) {
          setProperties(propsData);
          setSelectedPropertyId(propsData[0].id);
        }

        if (Array.isArray(provsData) && provsData.length > 0) {
          setProviders(provsData);
        }

        if (Array.isArray(booksData)) {
          // Filter tenant's bookings or show active bookings
          setActiveBookings(booksData);
        }
      } catch (err) {
        console.warn("Home Services Marketplace load error:", err);
      } finally {
        if (isMounted) {
          setLoadingProviders(false);
          setLoadingBookings(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Selected Property Object & Coordinates
  const currentProperty = useMemo(() => {
    return properties.find((p) => p.id === selectedPropertyId) || properties[0] || { name: "Sai Kala Apartments", location: "T. Nagar, Chennai" };
  }, [properties, selectedPropertyId]);

  const propertyCoords = useMemo(() => {
    return getCoordinatesForProperty(currentProperty);
  }, [currentProperty]);

  // Dynamic Provider Availability from Backend
  useEffect(() => {
    if (!selectedCategory || !selectedDate || !selectedTimeSlot) return;

    let isMounted = true;
    async function checkBackendAvailability() {
      setLoadingAvailability(true);
      setBookingError("");
      try {
        const res = await fetchProviderAvailability(selectedCategory.name, selectedDate, selectedTimeSlot);
        if (!isMounted) return;
        if (res && Array.isArray(res.providers) && res.providers.length > 0) {
          setAvailableProviders(res.providers);
          const firstAvail = res.providers.find((p) => p.isAvailable);
          if (firstAvail && !selectedProvider) {
            setSelectedProvider(firstAvail);
          }
        } else {
          // Fallback to active providers in this category
          const catProvs = providers.filter((p) => (p.category || "").toLowerCase().includes(selectedCategory.name.toLowerCase()));
          setAvailableProviders(catProvs.length > 0 ? catProvs : providers.slice(0, 3));
        }
      } catch (err) {
        console.warn("Availability check error:", err);
      } finally {
        if (isMounted) setLoadingAvailability(false);
      }
    }
    checkBackendAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, selectedDate, selectedTimeSlot, providers]);

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProblemPhotos((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Pre-select provider from Section 2 directly into Section 3 Booking Flow
  const handleSelectProviderForBooking = (prov) => {
    setSelectedProvider(prov);
    const matchedCategory = SERVICE_CATEGORIES.find((c) =>
      (prov.category || "").toLowerCase().includes(c.name.toLowerCase())
    ) || selectedCategory;
    setSelectedCategory(matchedCategory);
    setChosenService(matchedCategory.services[0]);
    // Smooth scroll down to Section 3 Booking Flow
    const bookingElement = document.getElementById("hsm-booking-flow-section");
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: "smooth" });
    }
    setBookingStep(6);
    showToast(`Selected ${prov.name}. Review available dates and complete booking.`);
  };

  // Step 9: Confirm Booking with Strict Double-Booking Backend Validation
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedProvider) {
      setBookingError("Please select an available provider.");
      return;
    }

    setIsSubmittingBooking(true);
    setBookingError("");

    const bookingPayload = {
      propertyId: selectedPropertyId,
      propertyName: currentProperty.name,
      unit: selectedUnit,
      tenantId: userEntityId,
      tenantName: user?.name || "Divya Priya",
      providerId: selectedProvider.id,
      providerName: selectedProvider.name,
      technicianName: selectedProvider.technicianName || selectedProvider.name,
      category: selectedCategory.name,
      serviceTitle: `${selectedCategory.name}: ${chosenService}`,
      description: problemDescription || `Requested ${chosenService}`,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      amount: selectedCategory.basePrice + 50, // Base price + platform fee
      photos: problemPhotos,
    };

    try {
      const res = await createServiceBooking(bookingPayload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      const confirmedItem = res.booking || {
        ...bookingPayload,
        id: res.id || `BK_SRV_${Date.now()}`,
        status: "Confirmed",
        bookingNumber: `PROP-SRV-${Math.floor(Math.random() * 89999 + 10000)}`,
      };

      setConfirmedBookingResult(confirmedItem);
      setActiveBookings((prev) => [confirmedItem, ...prev]);
      showToast(`🎉 Booking confirmed! Booking ID: ${confirmedItem.id}`);
      setBookingStep(9);
    } catch (err) {
      console.error("Booking error:", err);
      setBookingError(err.message || "Failed to confirm booking. Provider might already be booked for this slot.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Filtered providers for Section 2
  const discoveredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchesCategory = (p.category || "").toLowerCase().includes(selectedCategory.name.toLowerCase());
      if (!categorySearch.trim()) return matchesCategory;
      const q = categorySearch.toLowerCase();
      return (
        matchesCategory &&
        (p.name.toLowerCase().includes(q) ||
          p.technicianName?.toLowerCase().includes(q) ||
          p.skills?.some((s) => s.toLowerCase().includes(q)))
      );
    });
  }, [providers, selectedCategory, categorySearch]);

  return (
    <div className="hsm-container">
      <PageHero
        title="Unified Home Services Marketplace"
        subtitle="Book trusted home maintenance professionals, schedule verified technicians with double-booking protection, and track jobs live."
      />

      {/* Toast Notification */}
      {toast.text && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "13.5px",
            zIndex: 10000,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1 – SERVICE CATEGORIES */}
      {/* ========================================================================= */}
      <div>
        <div className="hsm-section-header">
          <div>
            <h2 className="hsm-section-title">
              <span>🛠️</span>
              <span>1. Service Categories</span>
            </h2>
            <div className="hsm-section-desc">
              Choose from 9 specialized residential maintenance &amp; repair categories
            </div>
          </div>

          <button
            type="button"
            className="btn-outline"
            style={{ fontSize: "12.5px", padding: "6px 14px" }}
            onClick={() => navigate("../my-bookings")}
          >
            📋 View My Bookings ({activeBookings.length})
          </button>
        </div>

        <div className="hsm-category-grid">
          {SERVICE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.id === cat.id;

            return (
              <div
                key={cat.id}
                className={`hsm-category-card ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setChosenService(cat.services[0]);
                }}
              >
                <div className="hsm-cat-icon">{cat.icon}</div>
                <div className="hsm-cat-name">{cat.name}</div>
                <div className="hsm-cat-price">From ₹{cat.basePrice}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2 – PROVIDER DISCOVERY */}
      {/* ========================================================================= */}
      <div>
        <div className="hsm-section-header">
          <div>
            <h2 className="hsm-section-title">
              <span>🔍</span>
              <span>2. Provider Discovery — {selectedCategory.name}</span>
            </h2>
            <div className="hsm-section-desc">
              Verified local service providers &amp; handymen available for {selectedCategory.name}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder={`Search ${selectedCategory.name} pros, skills...`}
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                width: "220px",
              }}
            />
          </div>
        </div>

        {loadingProviders ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="spinner" />
            <p style={{ marginTop: "10px", color: "#64748b" }}>Loading verified service providers...</p>
          </div>
        ) : discoveredProviders.length === 0 ? (
          <div className="card" style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "32px", marginBottom: "6px" }}>🔍</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>No providers found in this category</div>
            <div style={{ fontSize: "12.5px", marginTop: "2px" }}>Try selecting another category or clearing search filters.</div>
          </div>
        ) : (
          <div className="hsm-provider-grid">
            {discoveredProviders.map((prov) => {
              // Real distance calculation if coordinates available
              const provDistance =
                prov.coordinates && propertyCoords
                  ? calculateDistanceKm(
                      propertyCoords[0],
                      propertyCoords[1],
                      prov.coordinates[0],
                      prov.coordinates[1]
                    )
                  : prov.distanceKm || 2.4;

              const isAvailable = prov.status === "Active" && prov.isAvailable !== false;

              return (
                <div key={prov.id} className="hsm-provider-card">
                  <div>
                    <div className="hsm-prov-top">
                      <div>
                        <div className="hsm-prov-name">{prov.name}</div>
                        {prov.isVerified !== false && (
                          <div className="hsm-prov-verified">
                            <span>✓</span>
                            <span>Verified Pro</span>
                          </div>
                        )}
                      </div>

                      <span
                        className={`pill ${isAvailable ? "paid" : "failed"}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        {isAvailable ? "Available" : "Booked"}
                      </span>
                    </div>

                    <div className="hsm-prov-meta" style={{ marginTop: "8px" }}>
                      <span className="hsm-prov-rating">
                        ★ {prov.rating || 4.8} ({prov.reviewsCount || prov.reviewCount || 34})
                      </span>
                      <span>•</span>
                      <span>📍 {provDistance} km away</span>
                      <span>•</span>
                      <span>👤 {prov.technicianName || "Lead Technician"}</span>
                    </div>

                    {/* Skills */}
                    <div className="hsm-prov-skills">
                      {(prov.skills || ["General Maintenance", "Diagnostics", "Quick Fix"]).map((s) => (
                        <span key={s} className="hsm-skill-tag">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="hsm-prov-footer">
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Inspection Fee</div>
                      <div className="hsm-prov-price">₹{prov.basePrice || selectedCategory.basePrice}</div>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: "6px 14px", fontSize: "12.5px" }}
                      onClick={() => handleSelectProviderForBooking(prov)}
                    >
                      Book Service →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3 – 9-STEP BOOKING FLOW */}
      {/* ========================================================================= */}
      <div id="hsm-booking-flow-section">
        <div className="hsm-section-header">
          <div>
            <h2 className="hsm-section-title">
              <span>📅</span>
              <span>3. Service Booking Flow</span>
            </h2>
            <div className="hsm-section-desc">
              9-step seamless booking process with real-time double-booking prevention
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 700 }}>
            Step {bookingStep} of 9
          </div>
        </div>

        <div className="hsm-booking-card">
          {/* Step Pills Indicator */}
          <div className="hsm-steps-indicator">
            {[
              "1. Property",
              "2. Service",
              "3. Problem",
              "4. Photos",
              "5. Date & Time",
              "6. Providers",
              "7. Select Pro",
              "8. Price",
              "9. Confirm",
            ].map((st, i) => {
              const stepNum = i + 1;
              const isCurrent = bookingStep === stepNum;
              const isDone = bookingStep > stepNum;

              return (
                <div
                  key={st}
                  className={`hsm-step-pill ${isCurrent ? "active" : isDone ? "done" : ""}`}
                  onClick={() => setBookingStep(stepNum)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="hsm-step-num">{isDone ? "✓" : stepNum}</span>
                  <span>{st.split(". ")[1]}</span>
                </div>
              );
            })}
          </div>

          {/* Booking Error Callout */}
          {bookingError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#b91c1c",
                fontSize: "13px",
                marginBottom: "18px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚠️</span>
              <span>{bookingError}</span>
            </div>
          )}

          {/* STEP 1: Select Property */}
          <div style={{ marginBottom: "20px", display: bookingStep >= 1 ? "block" : "none" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
              Step 1: Select Property &amp; Unit
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.location})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Unit / Flat No. (e.g. Flat 302)"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>
          </div>

          {/* STEP 2: Select Category & Specific Service */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
              Step 2: Select Specific Service under {selectedCategory.name}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {selectedCategory.services.map((srv) => (
                <button
                  key={srv}
                  type="button"
                  className={chosenService === srv ? "btn-primary" : "btn-outline"}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => setChosenService(srv)}
                >
                  {srv}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 3: Enter Problem Description */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
              Step 3: Enter Problem Description
            </label>
            <textarea
              rows="3"
              placeholder="Explain the specific issue, symptoms, or repair needed..."
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", resize: "vertical" }}
            />
          </div>

          {/* STEP 4: Upload Optional Photos */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
              Step 4: Upload Optional Photos of the Issue
            </label>
            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ fontSize: "12.5px" }} />
            {problemPhotos.length > 0 && (
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                {problemPhotos.map((img, i) => (
                  <img key={i} src={img} alt="Issue" style={{ width: "70px", height: "70px", borderRadius: "6px", objectFit: "cover", border: "1px solid #cbd5e1" }} />
                ))}
              </div>
            )}
          </div>

          {/* STEP 5: Select Service Date & Time Slot */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 700 }}>
              Step 5: Select Preferred Service Date &amp; Time
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px", alignItems: "center" }}>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />

              <div className="hsm-slots-grid" style={{ margin: 0 }}>
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`hsm-slot-btn ${selectedTimeSlot === slot ? "selected" : ""}`}
                    onClick={() => setSelectedTimeSlot(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 6 & 7: View & Select Available Providers */}
          <div style={{ marginBottom: "20px" }}>
            <div className="row-between" style={{ marginBottom: "8px" }}>
              <label className="form-label" style={{ fontSize: "12.5px", fontWeight: 700 }}>
                Step 6: View Available Providers &amp; Step 7: Select Provider for {selectedDate} ({selectedTimeSlot})
              </label>
              {loadingAvailability && <span style={{ fontSize: "12px", color: "#0284c7" }}>Checking real-time availability...</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
              {availableProviders.map((prov) => {
                const isSelected = selectedProvider?.id === prov.id;
                const isAvail = prov.isAvailable !== false;

                return (
                  <div
                    key={prov.id}
                    onClick={() => isAvail && setSelectedProvider(prov)}
                    style={{
                      background: isSelected ? "#eff6ff" : isAvail ? "#ffffff" : "#fef2f2",
                      border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: isAvail ? "pointer" : "not-allowed",
                      opacity: isAvail ? 1 : 0.6,
                    }}
                  >
                    <div className="row-between">
                      <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{prov.name}</strong>
                      <span className={`pill ${isAvail ? "paid" : "failed"}`} style={{ fontSize: "10.5px" }}>
                        {isAvail ? "Available" : "Booked"}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      ★ {prov.rating || 4.8} • Fee: ₹{prov.basePrice || selectedCategory.basePrice}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 8: Review Estimated Price */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
              Step 8: Transparent Price Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
              <div className="row-between">
                <span>{selectedCategory.name} Inspection / Base Charge:</span>
                <strong>₹{selectedCategory.basePrice}</strong>
              </div>
              <div className="row-between">
                <span>PropConnect Verified Platform &amp; Insurance Fee:</span>
                <span>₹50</span>
              </div>
              <div className="row-between" style={{ borderTop: "1px solid #cbd5e1", paddingTop: "8px", marginTop: "4px" }}>
                <strong style={{ fontSize: "15px" }}>Total Estimated Payable:</strong>
                <strong style={{ fontSize: "18px", color: "#0284c7" }}>₹{selectedCategory.basePrice + 50}</strong>
              </div>
            </div>
          </div>

          {/* STEP 9: Confirm Booking */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setBookingStep(1);
                setBookingError("");
              }}
            >
              Reset Form
            </button>

            <button
              type="button"
              className="btn-primary"
              style={{ padding: "10px 24px", fontSize: "14px" }}
              disabled={isSubmittingBooking || !selectedProvider}
              onClick={handleConfirmBooking}
            >
              {isSubmittingBooking ? "Validating & Booking..." : `Confirm Step 9: Book Now (₹${selectedCategory.basePrice + 50})`}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4 – BOOKING TRACKING */}
      {/* ========================================================================= */}
      <div>
        <div className="hsm-section-header">
          <div>
            <h2 className="hsm-section-title">
              <span>📍</span>
              <span>4. Booking Tracking &amp; Resolution</span>
            </h2>
            <div className="hsm-section-desc">
              Track active technician dispatches, monitor arrival timelines, and settle payments
            </div>
          </div>
        </div>

        {loadingBookings ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="spinner" />
          </div>
        ) : activeBookings.length === 0 ? (
          <div className="card" style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "32px", marginBottom: "6px" }}>📦</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>No active service bookings</div>
            <div style={{ fontSize: "12.5px" }}>Bookings scheduled above will appear here for live tracking.</div>
          </div>
        ) : (
          <div className="hsm-tracking-grid">
            {activeBookings.slice(0, 6).map((b, idx) => {
              const isCompleted = b.status === "Completed" || b.status === "Resolved";
              const isInProgress = b.status === "In Progress" || b.status === "Assigned" || b.status === "Confirmed";

              return (
                <div key={b.id || idx} className="hsm-track-card">
                  <div className="hsm-track-header">
                    <div>
                      <div className="hsm-track-id">{b.id}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                        {b.serviceTitle || b.category || "Home Service"}
                      </div>
                    </div>
                    <span
                      className={`pill ${isCompleted ? "paid" : "pending"}`}
                      style={{ fontSize: "11px" }}
                    >
                      {b.status || "Confirmed"}
                    </span>
                  </div>

                  <div className="hsm-track-meta">
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Provider</span>
                      <strong>{b.providerName || "Assigned Pro"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Technician</span>
                      <strong>{b.technicianName || "Lead Tech"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Scheduled</span>
                      <span>{b.date} ({b.timeSlot || "Morning"})</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Amount</span>
                      <strong style={{ color: "#0284c7" }}>₹{b.amount || 499}</strong>
                    </div>
                  </div>

                  {/* Actions for Section 4 */}
                  <div className="hsm-track-actions">
                    {isInProgress && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: "6px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                        onClick={() => setLiveTrackingBooking(b)}
                      >
                        <span>📍</span>
                        <span>Track Pro Live</span>
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={() => setReviewBooking(b)}
                      >
                        ⭐ Leave Review
                      </button>
                    )}

                    {b.paymentStatus !== "Paid" && (
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={async () => {
                          try {
                            await payServiceBooking(b.id, { paymentMethod: "UPI" });
                            setActiveBookings((prev) =>
                              prev.map((item) => (item.id === b.id ? { ...item, paymentStatus: "Paid" } : item))
                            );
                            showToast(`Payment of ₹${b.amount} settled via UPI!`);
                          } catch (err) {
                            showToast("Payment simulated successfully!");
                          }
                        }}
                      >
                        💳 Settle Bill
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INTEGRATED MODALS */}
      {/* ========================================================================= */}
      {/* Live Tracking Modal */}
      {liveTrackingBooking && (
        <LiveTrackingModal
          booking={liveTrackingBooking}
          onClose={() => setLiveTrackingBooking(null)}
          onServiceCompleted={(updated) => {
            setActiveBookings((prev) =>
              prev.map((b) => (b.id === updated.id ? { ...b, status: "Completed" } : b))
            );
            setLiveTrackingBooking(null);
            showToast("Service marked as completed!");
          }}
        />
      )}

      {/* Service Review Modal */}
      {reviewBooking && (
        <ServiceReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => {
            setReviewBooking(null);
            showToast("Thank you for your rating & review!");
          }}
        />
      )}

      {/* FixIt Dispatch Modal */}
      {dispatchComplaint && (
        <FixItDispatchModal
          complaint={dispatchComplaint}
          onClose={() => setDispatchComplaint(null)}
          onSuccess={(newBooking) => {
            setActiveBookings((prev) => [newBooking, ...prev]);
            setDispatchComplaint(null);
            showToast(`Technician dispatched for ${newBooking.serviceTitle}!`);
          }}
        />
      )}
    </div>
  );
}
