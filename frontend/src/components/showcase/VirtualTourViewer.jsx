import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Genuine 360-degree Equirectangular Panoramic Assets for The Aurelia
 * Real 2:1 ratio spherical panorama photographs representing warm luxury residential interiors.
 */
const AURELIA_360_ROOMS = [
  {
    id: "living",
    name: "Living Room (360°)",
    icon: "🛋️",
    // Authentic equirectangular 360 interior panorama
    panoUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=80",
    initialYaw: 30,
    hotspots: [
      { id: "to-kitchen", label: "🍳 Kitchen", targetRoom: 2, yaw: 110, pitch: 0 },
      { id: "to-balcony", label: "🌅 Balcony", targetRoom: 3, yaw: 210, pitch: -5 },
      { id: "to-master", label: "🛏️ Master Suite", targetRoom: 1, yaw: 310, pitch: 0 },
    ],
    description: "Sun-drenched living hall with warm oak paneling, linen lounge seating, and sliding glass balcony doors.",
  },
  {
    id: "master",
    name: "Master Bedroom (360°)",
    icon: "🛏️",
    panoUrl: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=2400&q=80",
    initialYaw: 0,
    hotspots: [
      { id: "to-living", label: "🛋️ Living Hall", targetRoom: 0, yaw: 180, pitch: 0 },
    ],
    description: "Peaceful master bedroom with bespoke oak headboard, organic beige linens, and East-facing sunrise light.",
  },
  {
    id: "kitchen",
    name: "Kitchen (360°)",
    icon: "🍳",
    panoUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=2400&q=80",
    initialYaw: 45,
    hotspots: [
      { id: "to-living", label: "🛋️ Living Hall", targetRoom: 0, yaw: 270, pitch: 0 },
    ],
    description: "Italian modular kitchen with quartz countertops, undermount sink, induction hob, and fluted oak cabinetry.",
  },
  {
    id: "balcony",
    name: "Balcony (360°)",
    icon: "🌅",
    panoUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=2400&q=80",
    initialYaw: 180,
    hotspots: [
      { id: "to-living", label: "🛋️ Living Hall", targetRoom: 0, yaw: 0, pitch: 0 },
    ],
    description: "Open-air teakwood sit-out balcony with wicker armchairs overlooking Anna Nagar tree-lined avenues.",
  },
];

/**
 * Guided Walkthrough Steps (Photo Walkthrough – Demo)
 */
const WALKTHROUGH_STEPS = [
  {
    step: 1,
    title: "Main Entrance & Welcome Foyer",
    category: "Foyer",
    photo: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    note: "Solid teak main door with digital smart lock opening into an elegant, uncluttered entrance foyer with built-in shoe console and warm indirect lighting.",
  },
  {
    step: 2,
    title: "Sunlit Living Hall & Lounge",
    category: "Living Room",
    photo: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80",
    note: "Spacious 18-foot living room featuring vitrified tile flooring, warm cream linen sofa, bespoke white oak media console, and floor-to-ceiling glass doors.",
  },
  {
    step: 3,
    title: "Family Dining Area",
    category: "Dining Area",
    photo: "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&q=80",
    note: "Adjacent dining zone with 6-seater solid oak table and Scandinavian chairs, perfectly positioned between the living hall and kitchen entrance.",
  },
  {
    step: 4,
    title: "Italian Modular Kitchen & Island",
    category: "Kitchen",
    photo: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=80",
    note: "Premium modular kitchen with sand quartz countertops, Franke double sink, induction cooktop, and adjoining enclosed utility space with washing machine provisions.",
  },
  {
    step: 5,
    title: "Master Suite with Attached Travertine Bath",
    category: "Master Bedroom",
    photo: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=80",
    note: "Serene 174 sqft master bedroom suite with king-size bed, warm oak laminate flooring, floor-to-ceiling wardrobes, and attached honed travertine rain shower bath.",
  },
  {
    step: 6,
    title: "Second Bedroom & Study Workspace",
    category: "Second Bedroom",
    photo: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1600&q=80",
    note: "Versatile 132 sqft second bedroom tailored for family members, guests, or a distraction-free executive home office with fitted desk and double wardrobes.",
  },
  {
    step: 7,
    title: "Private Teakwood Sit-out Balcony",
    category: "Balcony",
    photo: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80",
    note: "Open-air 54 sqft balcony with natural teak deck tiles, weather-resistant armchairs, and golden hour sunset vistas across Anna Nagar West.",
  },
];

export default function VirtualTourViewer() {
  const [tourMode, setTourMode] = useState("360"); // '360' | 'walkthrough'
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  // 360 Camera Navigation State
  const [yaw, setYaw] = useState(30);
  const [pitch, setPitch] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPano, setIsLoadingPano] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imageCacheRef = useRef({});

  const currentRoom = AURELIA_360_ROOMS[activeRoomIdx] || AURELIA_360_ROOMS[0];

  // Draw 360 Panorama on Canvas
  const drawPanorama = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageCacheRef.current[currentRoom.panoUrl];
    if (!img || !img.complete) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Continuous 360 horizontal yaw wrapping (0 to 360)
    const normYaw = ((yaw % 360) + 360) % 360;
    const srcX = (normYaw / 360) * img.width;

    // Zoom adjusts field of view (FOV)
    const fovWidthRatio = 0.55 / zoom;
    const srcW = img.width * fovWidthRatio;

    // Pitch adjusts vertical slice
    const clampedPitch = Math.max(-35, Math.min(35, pitch));
    const pitchOffset = (clampedPitch / 90) * (img.height * 0.2);
    const srcY = Math.max(0, Math.min(img.height * 0.35, img.height * 0.15 + pitchOffset));
    const srcH = img.height * 0.7;

    // Draw main slice
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);

    // Wrap around horizontally if slice exceeds image width
    if (srcX + srcW > img.width) {
      const overflow = srcX + srcW - img.width;
      const ratio = overflow / srcW;
      ctx.drawImage(img, 0, srcY, overflow, srcH, w * (1 - ratio), 0, w * ratio, h);
    }

    // Vignette & Ambient Light Overlay
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(15,23,42,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, [currentRoom, yaw, pitch, zoom]);

  // Load and cache panorama image
  useEffect(() => {
    setIsLoadingPano(true);
    const url = currentRoom.panoUrl;
    if (imageCacheRef.current[url]) {
      setIsLoadingPano(false);
      setYaw(currentRoom.initialYaw || 0);
      setPitch(0);
      drawPanorama();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      imageCacheRef.current[url] = img;
      setIsLoadingPano(false);
      setYaw(currentRoom.initialYaw || 0);
      setPitch(0);
      drawPanorama();
    };
    img.onerror = () => {
      setIsLoadingPano(false);
    };
  }, [currentRoom, drawPanorama]);

  // Redraw when camera angles or zoom change
  useEffect(() => {
    if (!isLoadingPano) {
      drawPanorama();
    }
  }, [yaw, pitch, zoom, isLoadingPano, drawPanorama]);

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    setYaw((prev) => prev - dx * 0.35);
    setPitch((prev) => Math.max(-35, Math.min(35, prev + dy * 0.25)));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    setYaw((prev) => prev - dx * 0.4);
    setPitch((prev) => Math.max(-35, Math.min(35, prev + dy * 0.3)));
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Compass heading text
  const getCompassHeading = (y) => {
    const norm = ((y % 360) + 360) % 360;
    if (norm >= 337.5 || norm < 22.5) return "N";
    if (norm >= 22.5 && norm < 67.5) return "NE";
    if (norm >= 67.5 && norm < 112.5) return "E";
    if (norm >= 112.5 && norm < 157.5) return "SE";
    if (norm >= 157.5 && norm < 202.5) return "S";
    if (norm >= 202.5 && norm < 247.5) return "SW";
    if (norm >= 247.5 && norm < 292.5) return "W";
    return "NW";
  };

  // Toggle HTML5 Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Guided Walkthrough navigation
  const currentStepData = WALKTHROUGH_STEPS[walkthroughStep] || WALKTHROUGH_STEPS[0];
  const handleNextStep = () => {
    setWalkthroughStep((prev) => (prev < WALKTHROUGH_STEPS.length - 1 ? prev + 1 : 0));
  };
  const handlePrevStep = () => {
    setWalkthroughStep((prev) => (prev > 0 ? prev - 1 : WALKTHROUGH_STEPS.length - 1));
  };

  return (
    <div className="showcase-tour-box" ref={containerRef}>
      {/* Tour Header & Mode Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e7dfd5",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h4 style={{ margin: "0 0 2px 0", fontSize: 16, fontWeight: 800, color: "#292524" }}>
            Experience the Home – Virtual Tour
          </h4>
          <span style={{ fontSize: 12, color: "#78716c" }}>
            {tourMode === "360"
              ? "Drag around the view in 360° to inspect every angle of The Aurelia"
              : "Guided room-by-room architectural photo walkthrough"}
          </span>
        </div>

        {/* Mode Switcher Toggle */}
        <div style={{ display: "flex", background: "#f5f0e8", padding: 3, borderRadius: 8, border: "1px solid #e7dfd5" }}>
          <button
            type="button"
            onClick={() => setTourMode("360")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: tourMode === "360" ? "#b48448" : "transparent",
              color: tourMode === "360" ? "#ffffff" : "#57534e",
              transition: "all 0.15s ease",
            }}
          >
            🌐 360° Panorama Viewer
          </button>
          <button
            type="button"
            onClick={() => setTourMode("walkthrough")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: tourMode === "walkthrough" ? "#b48448" : "transparent",
              color: tourMode === "walkthrough" ? "#ffffff" : "#57534e",
              transition: "all 0.15s ease",
            }}
          >
            🚶 Photo Walkthrough – Demo
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MODE 1: INTERACTIVE 360° PANORAMA VIEWER                          */}
      {/* ------------------------------------------------------------------ */}
      {tourMode === "360" && (
        <div>
          <div
            className="showcase-tour-canvas-wrap"
            style={{
              position: "relative",
              height: isFullscreen ? "100vh" : 440,
              background: "#1c1917",
              cursor: isDragging ? "grabbing" : "grab",
              overflow: "hidden",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Loading Indicator */}
            {isLoadingPano && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(28,25,23,0.8)",
                  zIndex: 20,
                  color: "#fdfbf7",
                }}
              >
                <div className="hs-spinner" style={{ marginBottom: 12 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Loading 360° Panorama…</span>
              </div>
            )}

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={960}
              height={440}
              style={{ width: "100%", height: "100%", display: "block" }}
            />

            {/* Top Tour Control Bar */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                right: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              {/* Compass Heading Indicator */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 20,
                  background: "rgba(28, 25, 23, 0.85)",
                  backdropFilter: "blur(6px)",
                  color: "#fdfbf7",
                  fontSize: 12,
                  fontWeight: 800,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <span>🧭</span>
                <span>Facing: {getCompassHeading(yaw)} ({Math.round(((yaw % 360) + 360) % 360)}°)</span>
              </div>

              {/* Zoom & Fullscreen Controls */}
              <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
                <button
                  type="button"
                  className="showcase-tour-btn"
                  onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))}
                  title="Zoom In"
                >
                  🔍+
                </button>
                <button
                  type="button"
                  className="showcase-tour-btn"
                  onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.2).toFixed(2)))}
                  title="Zoom Out"
                >
                  🔍-
                </button>
                <button
                  type="button"
                  className="showcase-tour-btn"
                  onClick={() => setZoom(1)}
                  title="Reset Zoom"
                >
                  ↺ 100%
                </button>
                <button
                  type="button"
                  className="showcase-tour-btn"
                  onClick={handleToggleFullscreen}
                  title="Toggle Fullscreen"
                >
                  ⛶ Fullscreen
                </button>
              </div>
            </div>

            {/* Interactive Room Navigation Hotspots (Floating Pins) */}
            <div
              style={{
                position: "absolute",
                top: "45%",
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 14,
                pointerEvents: "none",
                zIndex: 8,
              }}
            >
              {currentRoom.hotspots.map((hs) => (
                <button
                  key={hs.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveRoomIdx(hs.targetRoom);
                  }}
                  style={{
                    pointerEvents: "auto",
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: "rgba(180, 132, 72, 0.95)",
                    backdropFilter: "blur(6px)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.35)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                    transition: "all 0.2s ease",
                  }}
                  title={`Step into ${hs.label}`}
                >
                  {hs.label} →
                </button>
              ))}
            </div>

            {/* Bottom Room Selector Pills */}
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                zIndex: 10,
              }}
            >
              {AURELIA_360_ROOMS.map((room, idx) => (
                <button
                  key={room.id}
                  type="button"
                  className={`showcase-tour-room-btn ${activeRoomIdx === idx ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveRoomIdx(idx);
                  }}
                >
                  <span>{room.icon}</span> {room.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description & Navigation Guide */}
          <div
            style={{
              padding: "12px 18px",
              fontSize: 13,
              color: "#57534e",
              background: "#fbf9f5",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <strong>{currentRoom.name}:</strong> {currentRoom.description}
            </div>
            <span style={{ fontSize: 11.5, color: "#8c6239", fontWeight: 700 }}>
              💡 Drag to rotate 360° | Use buttons or hotspots to switch rooms
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODE 2: GUIDED PHOTO WALKTHROUGH – DEMO                           */}
      {/* ------------------------------------------------------------------ */}
      {tourMode === "walkthrough" && (
        <div style={{ background: "#ffffff", padding: "20px" }}>
          {/* Room Walkthrough Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  background: "#b48448",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  textTransform: "uppercase",
                }}
              >
                Step {walkthroughStep + 1} of {WALKTHROUGH_STEPS.length}
              </span>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#292524" }}>
                {currentStepData.title}
              </h4>
            </div>

            {/* Step Arrows */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="showcase-action-btn"
                onClick={handlePrevStep}
                title="Previous Room"
              >
                ‹ Previous Room
              </button>
              <button
                type="button"
                className="showcase-action-btn"
                style={{ background: "#b48448", color: "#fff", borderColor: "#b48448" }}
                onClick={handleNextStep}
                title="Next Room"
              >
                Next Room ›
              </button>
            </div>
          </div>

          {/* Large Room Walkthrough Photo Box */}
          <div
            style={{
              position: "relative",
              height: 380,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 14,
              background: "#1c1917",
            }}
          >
            <img
              src={currentStepData.photo}
              alt={currentStepData.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "24px 20px 14px 20px",
                background: "linear-gradient(to top, rgba(28,25,23,0.85) 0%, transparent 100%)",
                color: "#fdfbf7",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#fde68a" }}>
                Architectural Highlights:
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 13.5, lineHeight: 1.5, color: "#f5f0e8" }}>
                {currentStepData.note}
              </p>
            </div>
          </div>

          {/* Fast Step Carousel Strip */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {WALKTHROUGH_STEPS.map((st, idx) => (
              <div
                key={st.step}
                onClick={() => setWalkthroughStep(idx)}
                style={{
                  flex: "0 0 100px",
                  height: 65,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: `2px solid ${walkthroughStep === idx ? "#b48448" : "transparent"}`,
                  opacity: walkthroughStep === idx ? 1 : 0.6,
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                <img src={st.photo} alt={st.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    left: 2,
                    right: 2,
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    fontSize: 9.5,
                    fontWeight: 700,
                    textAlign: "center",
                    borderRadius: 4,
                  }}
                >
                  {st.category}
                </span>
              </div>
            ))}
          </div>

          {/* Mandatory Demo Label */}
          <div style={{ marginTop: 12, textAlign: "right", fontSize: 11.5, color: "#8c6239", fontWeight: 700 }}>
            📌 Guided Photo Walkthrough – Demo (Authentic Warm Modern Luxury Photography)
          </div>
        </div>
      )}
    </div>
  );
}
