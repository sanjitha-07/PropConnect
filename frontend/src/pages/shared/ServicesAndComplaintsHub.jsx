import { useState, useEffect, useContext } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import TamilVoiceTextInput from "../../components/TamilVoiceTextInput.jsx";
import useEscapeKey from "../../utils/useEscapeKey.js";
import {
  fetchServiceCategories,
  fetchProviderAvailability,
  createServiceBooking,
  fetchServiceBookings,
  payServiceBooking,
  submitServiceFeedback,
  fetchComplaints,
  createComplaint,
  fetchProperties,
} from "../../utils/apiClient.js";
import "../../components/services/HomeServicesStyles.css";

const CATEGORY_ITEMS = [
  { id: "civil-work", name: "Civil Work", icon: "🧱", desc: "Masonry, tile repairs, wall plastering, crack filling & waterproofing", basePrice: 799 },
  { id: "plumbing", name: "Plumbing", icon: "🚰", desc: "Tap leaks, pipe burst, drainage unclog, flush tank overhaul", basePrice: 350 },
  { id: "electrical", name: "Electrical", icon: "⚡", desc: "MCB tripping, switchboards, short circuits, fan/light wiring", basePrice: 399 },
  { id: "cleaning", name: "Cleaning", icon: "✨", desc: "Deep home cleaning, bathroom acid scrub, kitchen degreasing", basePrice: 399 },
  { id: "ac-repair", name: "AC Repair", icon: "❄️", desc: "Jet wet wash, refrigerant gas refill, compressor & cooling fix", basePrice: 699 },
  { id: "carpentry", name: "Carpentry", icon: "🔨", desc: "Door lock repairs, wardrobe hinges, wooden latch, mesh installation", basePrice: 449 },
  { id: "painting", name: "Painting", icon: "🎨", desc: "Wall touchup putty, interior repainting, damp seepage sealant", basePrice: 899 },
  { id: "pest-control", name: "Pest Control", icon: "🪲", desc: "Herbal cockroach gel, termite wood treatment, mosquito fogging", basePrice: 599 },
  { id: "appliance", name: "Appliance Repair", icon: "🔧", desc: "Washing machine, refrigerator, microwave, RO water purifier", basePrice: 499 },
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

export default function ServicesAndComplaintsHub() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Tab: "hub" | "complaints" | "bookings"
  const defaultTab = searchParams.get("tab") || "hub";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Category Selection
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ITEMS[0]);
  
  // Action Choice: "book_service" | "raise_complaint"
  const [actionChoice, setActionChoice] = useState("book_service");

  // Common context
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("TN101");
  const [selectedUnit, setSelectedUnit] = useState("Flat B-204");

  // Booking Form State
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split("T")[0];
  });
  const [bookingTimeSlot, setBookingTimeSlot] = useState("10:00 AM");
  const [bookingNotes, setBookingNotes] = useState("");
  const [availableProviders, setAvailableProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Complaint Form State
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintIssue, setComplaintIssue] = useState("");
  const [complaintPriority, setComplaintPriority] = useState("High");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);

  // Data lists
  const [complaintsList, setComplaintsList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modals
  const [activePayBooking, setActivePayBooking] = useState(null);
  const [payMethod, setPayMethod] = useState("UPI");
  const [paying, setPaying] = useState(false);

  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [toast, setToast] = useState(null);

  // Close modals on Escape key
  useEscapeKey(() => {
    setActivePayBooking(null);
    setActiveReviewBooking(null);
  }, Boolean(activePayBooking || activeReviewBooking));

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync tab with URL
  useEffect(() => {
    if (searchParams.get("tab") && searchParams.get("tab") !== activeTab) {
      setActiveTab(searchParams.get("tab"));
    }
  }, [searchParams]);

  // Load properties, complaints, bookings
  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [props, compData, bookData] = await Promise.all([
        fetchProperties(),
        fetchComplaints(),
        fetchServiceBookings(),
      ]);
      if (Array.isArray(props) && props.length > 0) setProperties(props);
      if (Array.isArray(compData)) setComplaintsList(compData);
      if (Array.isArray(bookData)) setBookingsList(bookData);
    } catch (err) {
      console.warn("Data load warning:", err.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch Providers whenever category, date, or slot changes
  useEffect(() => {
    if (!selectedCategory || !bookingDate || !bookingTimeSlot) return;

    let isMounted = true;
    async function checkProAvailability() {
      setLoadingAvailability(true);
      try {
        const res = await fetchProviderAvailability(
          selectedCategory.name,
          bookingDate,
          bookingTimeSlot
        );
        if (isMounted) {
          const provs = res?.providers || [];
          setAvailableProviders(provs);
          if (provs.length > 0) {
            setSelectedProvider(provs[0]);
          } else {
            setSelectedProvider(null);
          }
        }
      } catch (err) {
        console.warn("Availability check error:", err.message);
      } finally {
        if (isMounted) setLoadingAvailability(false);
      }
    }

    checkProAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, bookingDate, bookingTimeSlot]);

  // Handle Home Service Booking submission
  const handleBookService = async (e) => {
    e.preventDefault();
    if (!selectedProvider) {
      showToast("Please choose an available service provider", "error");
      return;
    }

    setBookingSubmitting(true);
    const prop = properties.find((p) => p.id === selectedPropertyId) || {};

    const bookingPayload = {
      propertyId: selectedPropertyId,
      propertyName: prop.name || "Sai Kala Apartments",
      unit: selectedUnit || "Flat B-204",
      address: prop.location || "12, Usman Road, T. Nagar, Chennai",
      serviceCategory: selectedCategory.name,
      serviceName: `${selectedCategory.name} Standard Service`,
      serviceDescription: bookingNotes || `Residential ${selectedCategory.name} booking`,
      providerId: selectedProvider.id,
      providerName: selectedProvider.name,
      technicianName: selectedProvider.technicianName || selectedProvider.name,
      technicianPhone: selectedProvider.phone || "+91 98765 00001",
      date: bookingDate,
      timeSlot: bookingTimeSlot,
      amount: selectedCategory.basePrice || 499,
      notes: bookingNotes,
      status: "Pending",
      paymentStatus: "Pending", // Payment unlocked ONLY after completion!
    };

    try {
      const created = await createServiceBooking(bookingPayload);
      setBookingSubmitting(false);
      showToast(`✓ Booking placed successfully! Status: Pending confirmation. (Payment will be requested upon completion)`);
      setBookingNotes("");
      await loadAllData();
      setActiveTab("bookings");
    } catch (err) {
      setBookingSubmitting(false);
      showToast(err.message || "Failed to book home service", "error");
    }
  };

  // Handle Complaint Submission with Tamil Voice/Text
  const handleRaiseComplaint = async (e) => {
    e.preventDefault();
    if (!complaintSubject.trim() || !complaintIssue.trim()) {
      showToast("Please provide both subject and issue description", "error");
      return;
    }

    setComplaintSubmitting(true);
    const prop = properties.find((p) => p.id === selectedPropertyId) || {};

    const complaintPayload = {
      propertyId: selectedPropertyId,
      propertyName: prop.name || "Sai Kala Apartments",
      unit: selectedUnit || "Flat B-204",
      category: selectedCategory.name,
      subject: complaintSubject.trim(),
      issue: complaintIssue.trim(),
      priority: complaintPriority,
      status: "Open",
      tamilTranscript: complaintIssue.trim(),
    };

    try {
      await createComplaint(complaintPayload);
      setComplaintSubmitting(false);
      showToast(`✓ Complaint raised to landlord for ${selectedCategory.name}! Priority: ${complaintPriority}`);
      setComplaintSubject("");
      setComplaintIssue("");
      await loadAllData();
      setActiveTab("complaints");
    } catch (err) {
      setComplaintSubmitting(false);
      showToast(err.message || "Failed to register complaint", "error");
    }
  };

  // Process Payment after Completion
  const handlePayAfterCompletion = async (e) => {
    e.preventDefault();
    if (!activePayBooking) return;

    setPaying(true);
    try {
      const bId = activePayBooking.id || activePayBooking._id || activePayBooking.bookingId;
      await payServiceBooking(bId, {
        paymentMethod: payMethod,
        transactionId: `TXN_${Date.now().toString().slice(-6)}`,
      });
      showToast(`✓ Payment of ₹${activePayBooking.amount} successful via ${payMethod}!`);
      
      const finishedBooking = activePayBooking;
      setActivePayBooking(null);
      await loadAllData();

      // Open Customer Feedback modal right after paying
      setActiveReviewBooking(finishedBooking);
    } catch (err) {
      showToast(err.message || "Payment processing failed", "error");
    } finally {
      setPaying(false);
    }
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!activeReviewBooking) return;

    setSubmittingReview(true);
    try {
      const bId = activeReviewBooking.id || activeReviewBooking._id || activeReviewBooking.bookingId;
      await submitServiceFeedback(bId, {
        rating: reviewRating,
        reviewText: reviewComment.trim(),
      });
      showToast("✓ Thank you! Your star rating & review have been submitted.");
      setActiveReviewBooking(null);
      setReviewComment("");
      await loadAllData();
    } catch (err) {
      showToast(err.message || "Failed to submit feedback", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="home-services-page" style={{ paddingBottom: "40px" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            zIndex: 1100,
            fontSize: "13.5px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <PageHero
        title="Services &amp; Complaints Hub"
        subtitle="Book verified home maintenance pros (civil work, plumbing, electrical, cleaning) or raise tickets directly to your landlord."
      />

      {/* Main Tab Navigation */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle, #cbd5e1)", paddingBottom: "8px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("hub")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "hub" ? "var(--color-primary, #0284c7)" : "#ffffff",
            color: activeTab === "hub" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
            boxShadow: activeTab === "hub" ? "0 2px 4px rgba(2, 132, 199, 0.2)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          ✨ New Request (Book Service / Raise Complaint)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("complaints")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "complaints" ? "var(--color-primary, #0284c7)" : "#ffffff",
            color: activeTab === "complaints" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
        >
          <span>📢 My Complaints</span>
          <span style={{ background: activeTab === "complaints" ? "rgba(255, 255, 255, 0.25)" : "#e2e8f0", padding: "2px 7px", borderRadius: "10px", fontSize: "11px" }}>
            {complaintsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "bookings" ? "var(--color-primary, #0284c7)" : "#ffffff",
            color: activeTab === "bookings" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
        >
          <span>🛠️ My Service Bookings</span>
          <span style={{ background: activeTab === "bookings" ? "rgba(255, 255, 255, 0.25)" : "#e2e8f0", padding: "2px 7px", borderRadius: "10px", fontSize: "11px" }}>
            {bookingsList.length}
          </span>
        </button>
      </div>

      {/* ---------------- TAB 1: HUB (COMBINED CATEGORY SELECTOR + OPTIONS) ---------------- */}
      {activeTab === "hub" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* 1. Category Selection Row */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)" }}>
                  Step 1: Select Home Service or Complaint Category
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                  Choose a service domain to book a technician or report a maintenance issue to your landlord.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Rented Property:</span>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle, #cbd5e1)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid of Categories */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
              {CATEGORY_ITEMS.map((cat) => {
                const isSelected = selectedCategory.id === cat.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "14px 10px",
                      borderRadius: "10px",
                      border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
                      background: isSelected ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 12px rgba(2, 132, 199, 0.15)" : "none",
                      transform: isSelected ? "translateY(-2px)" : "none",
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "6px" }}>{cat.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: isSelected ? "#0369a1" : "#1e293b" }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                      From ₹{cat.basePrice}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Action Choice Buttons: Book Pro vs Raise Complaint */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div
              onClick={() => setActionChoice("book_service")}
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                border: actionChoice === "book_service" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                background: actionChoice === "book_service" ? "#f0f9ff" : "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "32px", padding: "10px", borderRadius: "10px", background: "#e0f2fe" }}>
                🛠️
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#0369a1" }}>
                  Option A: Book a Home Service (FixIt Pro)
                </div>
                <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                  Direct technician dispatch. Transparent pricing, pay <strong>only after service completion</strong>.
                </div>
              </div>
            </div>

            <div
              onClick={() => setActionChoice("raise_complaint")}
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                border: actionChoice === "raise_complaint" ? "2px solid #ea580c" : "1px solid #cbd5e1",
                background: actionChoice === "raise_complaint" ? "#fff7ed" : "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "32px", padding: "10px", borderRadius: "10px", background: "#ffedd5" }}>
                📢
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#c2410c" }}>
                  Option B: Raise Complaint to Landlord
                </div>
                <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                  Send formal complaint with <strong>Tamil voice-to-text / typing</strong> and priority tracking.
                </div>
              </div>
            </div>
          </div>

          {/* 3. Action Form: Book Pro Form OR Raise Complaint Form */}
          {actionChoice === "book_service" ? (
            <div className="card" style={{ padding: "24px", borderTop: "4px solid #0284c7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "22px" }}>{selectedCategory.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                    Book {selectedCategory.name} Pro
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                    {selectedCategory.desc} • Base Fee: ₹{selectedCategory.basePrice}
                  </p>
                </div>
              </div>

              <form onSubmit={handleBookService}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                      Service Date (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                      Preferred Time Slot
                    </label>
                    <select
                      className="form-input"
                      value={bookingTimeSlot}
                      onChange={(e) => setBookingTimeSlot(e.target.value)}
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                      Flat / Unit Number
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      placeholder="e.g. Flat B-204"
                      required
                    />
                  </div>
                </div>

                {/* Available Verified Providers Selection */}
                <div style={{ marginBottom: "16px" }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px", display: "flex", justifyContent: "space-between" }}>
                    <span>Choose Service Provider &amp; Technician</span>
                    {loadingAvailability && <span style={{ color: "#0284c7" }}>Checking real-time schedule…</span>}
                  </label>

                  {availableProviders.length === 0 && !loadingAvailability ? (
                    <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", fontSize: "13px", color: "#64748b" }}>
                      No providers available for this exact slot. A verified Pro will be automatically assigned.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                      {availableProviders.map((prov) => {
                        const isChosen = selectedProvider?.id === prov.id;
                        return (
                          <div
                            key={prov.id}
                            onClick={() => setSelectedProvider(prov)}
                            style={{
                              padding: "12px",
                              borderRadius: "8px",
                              border: isChosen ? "2px solid #0284c7" : "1px solid #e2e8f0",
                              background: isChosen ? "#f0f9ff" : "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0369a1" }}>
                              {prov.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {prov.name}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                                ⭐ {prov.rating || "4.9"} ({prov.reviewCount || "28"} reviews) • ₹{prov.price || selectedCategory.basePrice}
                              </div>
                            </div>
                            {isChosen && <span style={{ color: "#0284c7", fontWeight: 800 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                    Service Notes / Specific Instructions
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="e.g. Please bring civil tile adhesive / check master bathroom pipe leak"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "12px 16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Estimated Total Amount:</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      ₹{selectedProvider?.price || selectedCategory.basePrice}
                    </div>
                    <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>
                      🔒 Zero Upfront Payment — Pay only AFTER job is marked Completed!
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={bookingSubmitting}
                    style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 700 }}
                  >
                    {bookingSubmitting ? "Placing Booking…" : "Confirm Booking →"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card" style={{ padding: "24px", borderTop: "4px solid #ea580c" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "22px" }}>📢</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#9a3412" }}>
                    Raise Complaint for {selectedCategory.name}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                    Notify landlord with full legal record under TN Tenancy norms. Supports Tamil speech &amp; typing.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRaiseComplaint}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                      Complaint Subject / தலைப்பு <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={complaintSubject}
                      onChange={(e) => setComplaintSubject(e.target.value)}
                      placeholder={`e.g. ${selectedCategory.name} issue in kitchen / bathroom`}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                      Urgency / Priority
                    </label>
                    <select
                      className="form-input"
                      value={complaintPriority}
                      onChange={(e) => setComplaintPriority(e.target.value)}
                    >
                      <option value="Low">Low (Within 48h)</option>
                      <option value="Medium">Medium (Within 24h)</option>
                      <option value="High">High (Immediate inspection)</option>
                      <option value="Urgent">Urgent (Emergency)</option>
                    </select>
                  </div>
                </div>

                {/* Tamil Voice-to-Text & Quick Phrases Input Component */}
                <TamilVoiceTextInput
                  label="Detailed Complaint Description / புகார் விவரம் (Tamil & English Voice/Text)"
                  value={complaintIssue}
                  onChange={setComplaintIssue}
                  placeholder="Explain the complaint in detail. You can click 🎙️ Voice to Text to speak in Tamil or click Tamil keys/phrases."
                  rows={4}
                  required
                />

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={complaintSubmitting}
                    style={{
                      background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                      borderColor: "#c2410c",
                      padding: "10px 24px",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {complaintSubmitting ? "Dispatching Complaint…" : "Dispatch Complaint to Landlord →"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: MY COMPLAINTS TABLE ---------------- */}
      {activeTab === "complaints" && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                My Filed Complaints &amp; Issues ({complaintsList.length})
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                Track landlord response times, maintenance tickets, and resolutions.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ fontSize: "12.5px", padding: "6px 14px" }}
              onClick={() => {
                setActiveTab("hub");
                setActionChoice("raise_complaint");
              }}
            >
              + Raise New Complaint
            </button>
          </div>

          {complaintsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>📋</div>
              <div>No complaints recorded. Everything is in order!</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Subject &amp; Description</th>
                    <th>Property / Unit</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {complaintsList.map((c) => (
                    <tr key={c.id || c._id}>
                      <td style={{ fontWeight: 700, color: "#0284c7" }}>#{c.id}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#334155" }}>
                          {c.category === "Civil Work" && "🧱 "}
                          {c.category === "Plumbing" && "🚰 "}
                          {c.category === "Electrical" && "⚡ "}
                          {c.category === "Cleaning" && "✨ "}
                          {c.category || "General"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.subject}</div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", maxWidth: "300px" }}>
                          {c.issue}
                        </div>
                        {c.tamilTranscript && (
                          <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "2px" }}>
                            தமிழ்: {c.tamilTranscript}
                          </div>
                        )}
                      </td>
                      <td>{c.propertyName || "Sai Kala Apartments"} ({c.unit || "Flat B-204"})</td>
                      <td>
                        <span className={`pill ${c.priority?.toLowerCase() === "urgent" ? "failed" : c.priority?.toLowerCase() === "high" ? "pending" : "active"}`}>
                          {c.priority || "Medium"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${c.status === "Resolved" || c.status === "Completed" ? "paid" : c.status === "In Progress" ? "active" : "pending"}`}>
                          {c.status || "Open"}
                        </span>
                      </td>
                      <td style={{ color: "#64748b", fontSize: "12px" }}>{c.date || "Recent"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 3: MY SERVICE BOOKINGS TABLE ---------------- */}
      {activeTab === "bookings" && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                My Service Bookings Table ({bookingsList.length})
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--ink-muted)" }}>
                Lifecycle tracking: Pending → Confirmed → Assigned → In Progress → Completed. (Payment enabled only after completion).
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ fontSize: "12.5px", padding: "6px 14px" }}
              onClick={() => {
                setActiveTab("hub");
                setActionChoice("book_service");
              }}
            >
              + Book New Home Service
            </button>
          </div>

          {bookingsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>🛠️</div>
              <div>No service bookings placed yet. Book a technician today!</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Category &amp; Service</th>
                    <th>Scheduled Slot</th>
                    <th>Provider / Technician</th>
                    <th>Fee</th>
                    <th>Job Status</th>
                    <th>Payment Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsList.map((b) => {
                    const isCompleted = b.status === "Completed";
                    const isPaid = b.paymentStatus === "Paid";
                    const hasFeedback = Boolean(b.rating && b.rating > 0);

                    return (
                      <tr key={b.id || b._id}>
                        <td style={{ fontWeight: 800, color: "#0284c7" }}>
                          #{b.bookingNumber || b.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.serviceCategory}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>{b.serviceName || b.serviceDescription}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>📅 {b.date}</div>
                          <div style={{ fontSize: "11.5px", color: "#0284c7" }}>⏰ {b.timeSlot}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.providerName}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                            {b.technicianName || "Pro assigned"} {b.technicianPhone ? `(${b.technicianPhone})` : ""}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>₹{b.amount || 499}</td>
                        <td>
                          <span
                            className={`pill ${
                              b.status === "Completed"
                                ? "paid"
                                : b.status === "In Progress"
                                ? "active"
                                : b.status === "Assigned"
                                ? "active"
                                : b.status === "Cancelled"
                                ? "failed"
                                : "pending"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td>
                          {isPaid ? (
                            <span className="pill paid">✓ Paid</span>
                          ) : isCompleted ? (
                            <span className="pill failed">Pending Payment</span>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#64748b", fontStyle: "italic" }}>
                              Locked until completion
                            </span>
                          )}
                        </td>
                        <td>
                          {/* Payment Button: Allowed ONLY After Service Completion */}
                          {isCompleted && !isPaid && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{
                                fontSize: "11.5px",
                                padding: "4px 10px",
                                background: "#16a34a",
                                borderColor: "#16a34a",
                                fontWeight: 700,
                              }}
                              onClick={() => setActivePayBooking(b)}
                            >
                              💳 Pay ₹{b.amount || 499}
                            </button>
                          )}

                          {isCompleted && isPaid && !hasFeedback && (
                            <button
                              type="button"
                              className="btn-outline"
                              style={{ fontSize: "11px", padding: "4px 8px", borderColor: "#eab308", color: "#ca8a04", fontWeight: 700 }}
                              onClick={() => setActiveReviewBooking(b)}
                            >
                              ⭐ Leave Review
                            </button>
                          )}

                          {isCompleted && isPaid && hasFeedback && (
                            <div style={{ fontSize: "11.5px", color: "#16a34a", fontWeight: 600 }}>
                              ⭐ Rated {b.rating}/5
                            </div>
                          )}

                          {!isCompleted && (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------- PAY AFTER COMPLETION MODAL ---------------- */}
      {activePayBooking && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setActivePayBooking(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                💳 Complete Payment for Service #{activePayBooking.bookingNumber || activePayBooking.id}
              </h3>
              <button className="modal-close-btn" onClick={() => setActivePayBooking(null)}>✕</button>
            </div>

            <form onSubmit={handlePayAfterCompletion} style={{ padding: "20px" }}>
              <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>
                  Service verified and marked Completed by {activePayBooking.providerName}!
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#14532d", marginTop: "4px" }}>
                  Amount Payable: ₹{activePayBooking.amount || 499}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                  Select Payment Method
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
                  {["UPI (GPay/PhonePe)", "Debit/Credit Card", "Net Banking", "Cash to Technician"].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPayMethod(m)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "6px",
                        border: payMethod === m ? "2px solid #16a34a" : "1px solid #cbd5e1",
                        background: payMethod === m ? "#f0fdf4" : "#ffffff",
                        fontWeight: 600,
                        fontSize: "12px",
                        color: payMethod === m ? "#15803d" : "#334155",
                        cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setActivePayBooking(null)}>
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={paying}
                  style={{ background: "#16a34a", borderColor: "#16a34a", padding: "8px 18px", fontWeight: 700 }}
                >
                  {paying ? "Processing…" : `Confirm Payment of ₹${activePayBooking.amount || 499} →`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- CUSTOMER FEEDBACK & REVIEW MODAL ---------------- */}
      {activeReviewBooking && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setActiveReviewBooking(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                ⭐ Customer Feedback &amp; Review
              </h3>
              <button className="modal-close-btn" onClick={() => setActiveReviewBooking(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitFeedback} style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#475569" }}>
                How was the service provided by <strong>{activeReviewBooking.providerName}</strong> ({activeReviewBooking.serviceCategory})?
              </p>

              {/* Star Rating Selector */}
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "30px",
                        cursor: "pointer",
                        color: star <= reviewRating ? "#f59e0b" : "#cbd5e1",
                        transition: "transform 0.1s",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  {reviewRating === 5
                    ? "⭐⭐⭐⭐⭐ Outstanding / Excellent"
                    : reviewRating === 4
                    ? "⭐⭐⭐⭐ Very Good"
                    : reviewRating === 3
                    ? "⭐⭐⭐ Satisfactory"
                    : "Needs Improvement"}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                  Comments / அனுபவ கருத்து
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience (e.g., prompt, skilled technician, clean work)"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-outline" onClick={() => setActiveReviewBooking(null)}>
                  Skip (Esc)
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingReview}
                  style={{ padding: "8px 18px", fontWeight: 700 }}
                >
                  {submittingReview ? "Submitting…" : "Submit Review →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
