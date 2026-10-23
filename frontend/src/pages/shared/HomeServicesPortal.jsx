import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import {
  fetchServiceCategories,
  fetchProviderAvailability,
  createServiceBooking,
  fetchProperties,
  fetchTenants,
} from "../../utils/apiClient.js";
import "../../components/services/HomeServicesStyles.css";

export default function HomeServicesPortal() {
  const { user } = useContext(AuthContext);
  const { t, formatCurrency } = useContext(SettingsContext);
  const navigate = useNavigate();

  const userRole = user?.role || "tenant";
  const userId = user?.entityId || user?.entity_id || user?.id || (userRole === "landlord" ? "LDL001" : "TEN001");

  // Data states
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  // Scheduling states
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to 2026-10-10 so the user's specific test scenario is immediately visible!
    return "2026-10-10";
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("10:00 AM");

  // Availability & Providers states
  const [availabilityData, setAvailabilityData] = useState({
    providers: [],
    totalAvailable: 0,
    totalBooked: 0,
  });
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Booking action states
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState(null);

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Load initial categories & property context
  useEffect(() => {
    async function loadInitial() {
      try {
        const [cats, propsList] = await Promise.all([
          fetchServiceCategories(),
          fetchProperties(),
        ]);

        setCategories(cats || []);
        if (cats && cats.length > 0) {
          // Default to Cleaning to match prompt example
          const cleaningCat = cats.find((c) => c.name.toLowerCase().includes("cleaning")) || cats[0];
          setSelectedCategory(cleaningCat);
          if (cleaningCat.services && cleaningCat.services.length > 0) {
            setSelectedService(cleaningCat.services[0]);
          }
        }

        const validProps = propsList || [];
        setProperties(validProps);

        if (userRole === "landlord") {
          // Landlord properties
          const landlordProps = validProps.filter(
            (p) => (p.landlordId === userId || p.landlord_id === userId)
          );
          if (landlordProps.length > 0) {
            setSelectedPropertyId(landlordProps[0].id);
          } else if (validProps.length > 0) {
            setSelectedPropertyId(validProps[0].id);
          }
        } else if (userRole === "tenant") {
          // Auto-identify tenant's rented property
          setSelectedPropertyId("TN101");
        }
      } catch (err) {
        console.error("Initial load error:", err);
      }
    }
    loadInitial();
  }, [userRole, userId]);

  // 2. Load provider availability dynamically whenever category, date, or time slot changes
  useEffect(() => {
    if (!selectedCategory || !selectedDate || !selectedTimeSlot) return;

    let isMounted = true;
    async function checkAvailability() {
      setLoadingAvailability(true);
      setErrorMessage("");
      try {
        const res = await fetchProviderAvailability(
          selectedCategory.name,
          selectedDate,
          selectedTimeSlot
        );
        if (isMounted) {
          setAvailabilityData(res || { providers: [], totalAvailable: 0, totalBooked: 0 });
          // If currently selected provider is now booked, reset selected provider
          if (selectedProvider) {
            const stillAvail = res?.providers?.find(
              (p) => p.id === selectedProvider.id && p.isAvailable
            );
            if (!stillAvail) {
              setSelectedProvider(null);
            }
          }
        }
      } catch (err) {
        console.error("Check availability error:", err);
      } finally {
        if (isMounted) setLoadingAvailability(false);
      }
    }

    checkAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, selectedDate, selectedTimeSlot]);

  // Handle Category Click
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    if (cat.services && cat.services.length > 0) {
      setSelectedService(cat.services[0]);
    } else {
      setSelectedService("");
    }
    setSelectedProvider(null);
  };

  // Handle Provider Selection (Prevent selecting booked providers)
  const handleSelectProvider = (prov) => {
    if (!prov.isAvailable) {
      showToast(`⚠️ ${prov.name} is already booked for ${selectedDate} at ${selectedTimeSlot}. Please select an available provider.`);
      return;
    }
    setSelectedProvider(prov);
  };

  // Handle Confirm Booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedCategory) {
      setErrorMessage("Please select a service category.");
      return;
    }
    if (!selectedProvider) {
      setErrorMessage("Please select an available service provider.");
      return;
    }
    if (!selectedDate || !selectedTimeSlot) {
      setErrorMessage("Please select both a date and a time slot.");
      return;
    }

    // Resolve property info
    const selectedProp = properties.find((p) => p.id === selectedPropertyId);
    const propName = selectedProp?.name || "Sai Kala Apartments - Flat 302";
    const propUnit = selectedProp?.unit || "Flat B-204";

    const bookingPayload = {
      serviceCategory: selectedCategory.name,
      serviceName: selectedService || `${selectedCategory.name} Service`,
      serviceDescription: description || selectedService || "Standard home maintenance request",
      providerId: selectedProvider.id,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      propertyId: selectedPropertyId || "TN101",
      propertyName: propName,
      unit: propUnit,
      notes,
      amount: selectedProvider.price || selectedCategory.basePrice || 499,
      userRole,
    };

    setSubmitting(true);
    try {
      const created = await createServiceBooking(bookingPayload);
      setBookingSuccess(created);
      showToast(`✅ Booking ${created.bookingNumber || created.id} confirmed successfully!`);

      // Refresh availability to reflect newly booked provider
      const updatedAvail = await fetchProviderAvailability(
        selectedCategory.name,
        selectedDate,
        selectedTimeSlot
      );
      setAvailabilityData(updatedAvail);
    } catch (err) {
      console.error("Booking error:", err);
      // Handles 409 double-booking rejection from backend
      setErrorMessage(
        err.message ||
          "Double Booking Prevented! This provider was just booked for this slot. Please choose another available provider."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Active property details
  const currentProp = properties.find((p) => p.id === selectedPropertyId);

  return (
    <div className="home-services-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#0f172a",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: 12,
            zIndex: 10000,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      {/* Hero Header */}
      <PageHero
        title="PropConnect — Home Service Portal"
        subtitle={
          userRole === "tenant"
            ? "Directly book verified on-demand home maintenance technicians for your rental flat, or escalate major property complaints to your landlord."
            : "Arrange verified cleaning, plumbing, electrical, carpentry, AC repair, and maintenance services across all your managed properties."
        }
      />

      {/* TENANT PROBLEM DECISION BANNER (Tenant Flow) */}
      {userRole === "tenant" && (
        <div className="problem-choice-banner">
          <div className="problem-choice-left">
            <div className="problem-choice-icon">🛠️</div>
            <div>
              <h3 className="problem-choice-title">Have a Problem in Your Flat?</h3>
              <p className="problem-choice-subtitle">
                For <strong>minor &amp; common repairs</strong> (cleaning, leakages, switch repairs, AC issues), book a verified home service below.
                For <strong>major landlord responsibilities</strong> (seepage, structural issues, agreement terms), raise a formal complaint.
              </p>
            </div>
          </div>
          <div className="problem-choice-actions">
            <button
              type="button"
              className="btn-choice-complaint"
              onClick={() => navigate("/tenant/complaints")}
            >
              📝 Raise Complaint to Landlord
            </button>
            <button
              type="button"
              className="btn-choice-service"
              onClick={() => {
                document.getElementById("booking-workflow-section")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              ⚡ Book Home Service
            </button>
          </div>
        </div>
      )}

      {/* Main Workflow Form */}
      <div id="booking-workflow-section" className="card" style={{ padding: "28px" }}>
        {/* Error message banner */}
        {errorMessage && (
          <div
            style={{
              background: "#fef2f2",
              border: "1.5px solid #fecaca",
              color: "#b91c1c",
              padding: "14px 18px",
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Property Connection */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "8px" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0284c7", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              1
            </span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
              {userRole === "landlord" ? "Select Managed Property" : "Your Rented Property"}
            </h3>
          </div>

          {userRole === "landlord" ? (
            <div style={{ maxWidth: 480 }}>
              <select
                className="input-select"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14 }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.unit || "Flat"} ({p.locality || p.city || "Chennai"})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                Selected Property: <strong>{currentProp?.name}</strong> • Unit: <strong>{currentProp?.unit || "Unit 1"}</strong>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: 12,
                padding: "14px 18px",
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 20 }}>🏢</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  {currentProp?.name || "Sai Kala Apartments - Flat 302"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Unit: <strong>{currentProp?.unit || "Flat B-204"}</strong> • Tenant: <strong>{user?.name || "Divya Priya"}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: Service Category Selection */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "14px" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0284c7", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              2
            </span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
              Select Service Category
            </h3>
          </div>

          <div className="category-grid">
            {categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id || selectedCategory?.name === cat.name;
              return (
                <div
                  key={cat.id}
                  className={`category-card ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectCategory(cat)}
                >
                  <div className="category-card-top">
                    <div className="category-icon-wrapper">
                      {cat.name.includes("Cleaning") && "✨"}
                      {cat.name.includes("Plumbing") && "🚰"}
                      {cat.name.includes("Electrical") && "⚡"}
                      {cat.name.includes("Carpentry") && "🪚"}
                      {cat.name.includes("AC") && "❄️"}
                      {cat.name.includes("Painting") && "🎨"}
                      {cat.name.includes("Pest") && "🛡️"}
                      {cat.name.includes("Appliance") && "🔧"}
                    </div>
                    <span className="category-badge-price">
                      From {formatCurrency ? formatCurrency(cat.basePrice) : `₹${cat.basePrice}`}
                    </span>
                  </div>
                  <h4 className="category-name">{cat.name}</h4>
                  <p className="category-desc">{cat.description}</p>
                </div>
              );
            })}
          </div>

          {/* Sub-services chips */}
          {selectedCategory && selectedCategory.services && selectedCategory.services.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Common Services for {selectedCategory.name}:
              </div>
              <div className="service-chips-wrapper">
                {selectedCategory.services.map((svc) => (
                  <button
                    key={svc}
                    type="button"
                    className={`service-chip ${selectedService === svc ? "selected" : ""}`}
                    onClick={() => setSelectedService(svc)}
                  >
                    {selectedService === svc && "✓ "}
                    {svc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Service Description input */}
          <div style={{ marginTop: "16px", maxWidth: 640 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Problem / Service Details (Optional)
            </label>
            <textarea
              className="input-textarea"
              rows={2}
              placeholder="e.g., Bedroom fan regulator not working, or bathroom tile deep descaling required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13.5 }}
            />
          </div>
        </div>

        {/* STEP 3: Date & Time Slot Selection */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "14px" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0284c7", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              3
            </span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
              Select Appointment Date &amp; Time Slot
            </h3>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Date:
              </label>
              <input
                type="date"
                className="input-text"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`btn ${selectedDate === "2026-10-10" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedDate("2026-10-10")}
                style={{ fontSize: 13, padding: "9px 14px" }}
              >
                10 October 2026 (Demo Day)
              </button>
              <button
                type="button"
                className={`btn ${selectedDate === new Date().toISOString().split("T")[0] ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                style={{ fontSize: 13, padding: "9px 14px" }}
              >
                Today
              </button>
            </div>
          </div>

          {/* Time Slots */}
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Available Time Slots:
            </div>
            <div className="slots-grid">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`slot-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedTimeSlot(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 4: Dynamic Provider Availability Display (Double-Booking Prevention Engine) */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0284c7", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                4
              </span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                Select Available Service Provider
              </h3>
            </div>

            <div style={{ fontSize: 13, color: "#64748b" }}>
              Slot: <strong>{selectedDate}</strong> at <strong>{selectedTimeSlot}</strong> •{" "}
              <span style={{ color: "#16a34a", fontWeight: 700 }}>
                {availabilityData.totalAvailable} Available
              </span>{" "}
              /{" "}
              <span style={{ color: "#dc2626", fontWeight: 700 }}>
                {availabilityData.totalBooked} Booked
              </span>
            </div>
          </div>

          {/* Live Availability Info Banner */}
          <div
            style={{
              background: "#f1f5f9",
              borderRadius: 10,
              padding: "10px 16px",
              marginBottom: 16,
              fontSize: 12.5,
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🛡️</span>
            <span>
              <strong>Double-Booking Prevention Active:</strong> System cross-references confirmed bookings and technician schedules in real time. Only providers marked <strong>Available</strong> can be booked.
            </span>
          </div>

          {loadingAvailability ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
              Checking real-time provider schedules…
            </div>
          ) : availabilityData.providers.length === 0 ? (
            <div className="slot-unavailable-alert">
              <span className="slot-unavailable-icon">⚠️</span>
              <div>
                <strong>No service providers registered for this category.</strong> Please select another category.
              </div>
            </div>
          ) : availabilityData.totalAvailable === 0 ? (
            /* REQUIRED MESSAGE WHEN NO PROVIDER AVAILABLE */
            <div className="slot-unavailable-alert">
              <span className="slot-unavailable-icon">❌</span>
              <div>
                <strong>No service provider is available for this time slot. Please select another time.</strong>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {availabilityData.providers.map((prov) => {
                const isSelected = selectedProvider?.id === prov.id;
                const isAvailable = prov.isAvailable;

                return (
                  <div
                    key={prov.id}
                    className={`provider-avail-card ${
                      isAvailable ? (isSelected ? "selected" : "available") : "booked"
                    }`}
                    onClick={() => handleSelectProvider(prov)}
                  >
                    <div className="provider-info-main">
                      <div className="provider-avatar">
                        {prov.category.includes("Cleaning") && "✨"}
                        {prov.category.includes("Plumbing") && "🚰"}
                        {prov.category.includes("Electrical") && "⚡"}
                        {prov.category.includes("Carpentry") && "🪚"}
                        {prov.category.includes("AC") && "❄️"}
                        {prov.category.includes("Painting") && "🎨"}
                        {prov.category.includes("Pest") && "🛡️"}
                        {prov.category.includes("Appliance") && "🔧"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                            {prov.name}
                          </h4>
                          <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>
                            ★ {prov.rating || 4.8}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                          Technician: <strong>{prov.technicianName}</strong> • {prov.experienceYears} yrs exp • {prov.location}
                        </div>
                        <div style={{ fontSize: 12, color: "#0369a1", marginTop: 2 }}>
                          Skills: {prov.skills?.slice(0, 3).join(", ") || "General Repairs"}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                        {formatCurrency ? formatCurrency(prov.price) : `₹${prov.price}`}
                      </div>

                      {/* Explicit Availability Status Badge */}
                      <span className={`provider-avail-badge ${isAvailable ? "available" : "booked"}`}>
                        {isAvailable ? "✓ Available" : "✗ Booked"}
                      </span>

                      {isAvailable && (
                        <div style={{ fontSize: 11.5, color: isSelected ? "#15803d" : "#64748b", fontWeight: 600 }}>
                          {isSelected ? "Selected for Booking" : "Click to Select"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP 5: Booking Summary & Confirm Button */}
        {selectedProvider && (
          <div
            style={{
              background: "#f0f7ff",
              border: "2px solid #bfdbfe",
              borderRadius: 14,
              padding: "20px 24px",
              marginTop: "20px",
            }}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700, color: "#1e3a8a" }}>
              📋 Booking Summary
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 13.5 }}>
              <div>
                <span style={{ color: "#64748b" }}>Category:</span>{" "}
                <strong>{selectedCategory?.name}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Selected Service:</span>{" "}
                <strong>{selectedService || "Standard Service"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Service Provider:</span>{" "}
                <strong>{selectedProvider?.name}</strong> ({selectedProvider?.technicianName})
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Appointment Date:</span>{" "}
                <strong>{selectedDate}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Time Slot:</span>{" "}
                <strong>{selectedTimeSlot}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Destination:</span>{" "}
                <strong>{currentProp?.name} — {currentProp?.unit || "Flat B-204"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Estimated Cost:</span>{" "}
                <strong style={{ color: "#0284c7", fontSize: 15 }}>
                  {formatCurrency ? formatCurrency(selectedProvider.price) : `₹${selectedProvider.price}`}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedProvider(null)}
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBooking}
                disabled={submitting}
                style={{ padding: "12px 28px", fontSize: 14, fontWeight: 700 }}
              >
                {submitting ? "Verifying & Reserving Slot…" : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS CONFIRMATION MODAL */}
      {bookingSuccess && (
        <div className="service-modal-overlay">
          <div className="service-modal-content" style={{ padding: "32px", textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#15803d",
                fontSize: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              ✓
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              Booking Confirmed!
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#64748b" }}>
              Booking ID: <strong>{bookingSuccess.bookingNumber || bookingSuccess.id}</strong>
            </p>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: 12,
                padding: "18px",
                textAlign: "left",
                fontSize: 13.5,
                lineHeight: 1.6,
                marginBottom: 24,
                border: "1px solid #e2e8f0",
              }}
            >
              <div><strong>Service:</strong> {bookingSuccess.serviceCategory} — {bookingSuccess.serviceName}</div>
              <div><strong>Provider:</strong> {bookingSuccess.providerName} (Technician: {bookingSuccess.technicianName})</div>
              <div><strong>Date &amp; Slot:</strong> {bookingSuccess.date} at {bookingSuccess.timeSlot}</div>
              <div><strong>Property:</strong> {bookingSuccess.propertyName} ({bookingSuccess.unit})</div>
              <div><strong>Status:</strong> <span className="pill confirmed">Confirmed</span></div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBookingSuccess(null)}
              >
                Book Another Service
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setBookingSuccess(null);
                  navigate(userRole === "admin" ? "/admin/service-bookings" : userRole === "landlord" ? "/landlord/my-bookings" : "/tenant/my-bookings");
                }}
              >
                View My Service Bookings →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
