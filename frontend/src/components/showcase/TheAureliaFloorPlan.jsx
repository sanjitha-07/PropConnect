import { useState, useRef } from "react";

/**
 * TheAureliaFloorPlan Component
 * Architectural 2D top-down floor plan for The Aurelia – Premium 2BHK Apartment.
 * Rendered using a scalable vector graphic with interactive zoom, fullscreen modal,
 * room highlighting, and instant SVG download.
 */
export default function TheAureliaFloorPlan({ onSelectRoom = null }) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const svgRef = useRef(null);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoom(1);

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "The_Aurelia_2BHK_Floor_Plan.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  const renderSVG = () => (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 680"
      width="100%"
      height="100%"
      style={{
        display: "block",
        transform: `scale(${zoom})`,
        transformOrigin: "center center",
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Subtle architectural hatching pattern */}
        <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#44403c" strokeWidth="2" />
        </pattern>
        <pattern id="balconyDeck" width="12" height="12" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="12" y2="0" stroke="#d6c7b2" strokeWidth="2" />
        </pattern>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#292524" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Blueprint Sheet Background */}
      <rect width="1000" height="680" fill="#fcfbfa" />

      {/* Grid Guide Marks */}
      <g stroke="#f0ebe1" strokeWidth="1" strokeDasharray="4 8">
        <line x1="60" y1="60" x2="940" y2="60" />
        <line x1="60" y1="200" x2="940" y2="200" />
        <line x1="60" y1="360" x2="940" y2="360" />
        <line x1="60" y1="520" x2="940" y2="520" />
        <line x1="60" y1="620" x2="940" y2="620" />
        <line x1="60" y1="60" x2="60" y2="620" />
        <line x1="220" y1="60" x2="220" y2="620" />
        <line x1="460" y1="60" x2="460" y2="620" />
        <line x1="640" y1="60" x2="640" y2="620" />
        <line x1="940" y1="60" x2="940" y2="620" />
      </g>

      {/* ================================================================= */}
      {/* ROOM ZONES & FLOOR FILLS                                          */}
      {/* ================================================================= */}

      {/* 1. Main Entrance & Foyer (Top-Left) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("foyer")}
        onMouseEnter={() => setHoveredRoom("foyer")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="70"
          y="70"
          width="150"
          height="140"
          fill={hoveredRoom === "foyer" ? "#fbf0df" : "#f7f2ea"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        <text x="145" y="130" textAnchor="middle" fill="#78716c" fontSize="12" fontWeight="700">
          MAIN ENTRANCE
        </text>
        <text x="145" y="148" textAnchor="middle" fill="#a8a29e" fontSize="11" fontWeight="500">
          6&apos;0&quot; × 5&apos;0&quot;
        </text>
        {/* Entry Console / Bench */}
        <rect x="80" y="80" width="30" height="60" rx="3" fill="#e7dfd5" stroke="#d6c7b2" strokeWidth="1" />
      </g>

      {/* 2. Living Hall (Top-Center) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("living")}
        onMouseEnter={() => setHoveredRoom("living")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="220"
          y="70"
          width="420"
          height="290"
          fill={hoveredRoom === "living" ? "#fbf5ea" : "#faf6f0"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        {/* Living Room Furniture: L-Sofa */}
        <path
          d="M 260 120 L 440 120 A 10 10 0 0 1 450 130 L 450 220 A 10 10 0 0 1 440 230 L 400 230 A 10 10 0 0 1 390 220 L 390 170 L 260 170 Z"
          fill="#e9e0d2"
          stroke="#cbb9a3"
          strokeWidth="1.5"
          filter="url(#softShadow)"
        />
        {/* Coffee Table */}
        <rect x="290" y="190" width="80" height="45" rx="6" fill="#dfd0bc" stroke="#bda88e" strokeWidth="1.5" />
        {/* TV Unit Console */}
        <rect x="520" y="80" width="100" height="18" rx="2" fill="#d6c7b2" stroke="#a89a85" strokeWidth="1" />
        <line x1="535" y1="89" x2="605" y2="89" stroke="#78716c" strokeWidth="2" />

        <text x="430" y="275" textAnchor="middle" fill="#292524" fontSize="16" fontWeight="800">
          LIVING ROOM
        </text>
        <text x="430" y="296" textAnchor="middle" fill="#78716c" fontSize="12" fontWeight="600">
          18&apos;0&quot; × 13&apos;6&quot; (243 sq ft)
        </text>
      </g>

      {/* 3. Dining Area (Center-Bottom) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("dining")}
        onMouseEnter={() => setHoveredRoom("dining")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="220"
          y="360"
          width="240"
          height="250"
          fill={hoveredRoom === "dining" ? "#fbf3e6" : "#f7f1e7"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        {/* Dining Table & 6 Chairs */}
        <rect x="270" y="420" width="130" height="75" rx="6" fill="#e2d6c3" stroke="#bda88e" strokeWidth="1.5" />
        {/* Top 3 chairs */}
        <rect x="285" y="402" width="25" height="14" rx="2" fill="#d0beaa" />
        <rect x="322" y="402" width="25" height="14" rx="2" fill="#d0beaa" />
        <rect x="360" y="402" width="25" height="14" rx="2" fill="#d0beaa" />
        {/* Bottom 3 chairs */}
        <rect x="285" y="499" width="25" height="14" rx="2" fill="#d0beaa" />
        <rect x="322" y="499" width="25" height="14" rx="2" fill="#d0beaa" />
        <rect x="360" y="499" width="25" height="14" rx="2" fill="#d0beaa" />

        <text x="340" y="550" textAnchor="middle" fill="#292524" fontSize="14" fontWeight="800">
          DINING AREA
        </text>
        <text x="340" y="568" textAnchor="middle" fill="#78716c" fontSize="11" fontWeight="600">
          12&apos;0&quot; × 9&apos;6&quot; (114 sq ft)
        </text>
      </g>

      {/* 4. Private Balcony (Left of Living) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("balcony")}
        onMouseEnter={() => setHoveredRoom("balcony")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="70"
          y="210"
          width="150"
          height="270"
          fill="url(#balconyDeck)"
          stroke="#d6c7b2"
          strokeWidth="1.5"
        />
        {/* Balcony Furniture: 2 Armchairs + Small Table */}
        <circle cx="120" cy="270" r="16" fill="#d6c7b2" stroke="#a89a85" strokeWidth="1" />
        <circle cx="170" cy="270" r="16" fill="#d6c7b2" stroke="#a89a85" strokeWidth="1" />
        <circle cx="145" cy="270" r="9" fill="#e7dfd5" stroke="#a89a85" strokeWidth="1" />

        {/* Potted Plant Symbols */}
        <circle cx="95" cy="445" r="11" fill="#c3d9b9" stroke="#89a97d" strokeWidth="1" />
        <circle cx="95" cy="445" r="5" fill="#78996b" />
        <circle cx="195" cy="445" r="11" fill="#c3d9b9" stroke="#89a97d" strokeWidth="1" />
        <circle cx="195" cy="445" r="5" fill="#78996b" />

        <text x="145" y="340" textAnchor="middle" fill="#292524" fontSize="13" fontWeight="800">
          BALCONY
        </text>
        <text x="145" y="358" textAnchor="middle" fill="#78716c" fontSize="10.5" fontWeight="600">
          12&apos;0&quot; × 4&apos;6&quot; (54 sq ft)
        </text>
      </g>

      {/* 5. Modular Kitchen & Utility (Bottom-Left) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("kitchen")}
        onMouseEnter={() => setHoveredRoom("kitchen")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="70"
          y="480"
          width="150"
          height="130"
          fill={hoveredRoom === "kitchen" ? "#faf3e8" : "#f4eee4"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        {/* L-Countertop */}
        <path d="M 70 480 L 160 480 L 160 520 L 110 520 L 110 610 L 70 610 Z" fill="#e2d6c3" stroke="#bda88e" strokeWidth="1" />
        {/* Double Sink */}
        <rect x="76" y="535" width="28" height="40" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        {/* Stove with 3 burners */}
        <rect x="118" y="486" width="36" height="24" rx="2" fill="#334155" />
        <circle cx="127" cy="498" r="4" fill="#64748b" />
        <circle cx="145" cy="498" r="4" fill="#64748b" />

        <text x="145" y="565" textAnchor="middle" fill="#292524" fontSize="13" fontWeight="800">
          KITCHEN
        </text>
        <text x="145" y="582" textAnchor="middle" fill="#78716c" fontSize="10.5" fontWeight="600">
          11&apos;6&quot; × 8&apos;0&quot; (92 sq ft)
        </text>
      </g>

      {/* 6. Master Bedroom (Top-Right) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("master-bed")}
        onMouseEnter={() => setHoveredRoom("master-bed")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="640"
          y="70"
          width="290"
          height="280"
          fill={hoveredRoom === "master-bed" ? "#fdf8ee" : "#fdfbf7"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        {/* King Bed */}
        <rect x="700" y="110" width="140" height="160" rx="6" fill="#e9e0d2" stroke="#cbb9a3" strokeWidth="1.5" />
        {/* Pillows */}
        <rect x="710" y="118" width="55" height="30" rx="4" fill="#f8fafc" stroke="#d6c7b2" strokeWidth="1" />
        <rect x="775" y="118" width="55" height="30" rx="4" fill="#f8fafc" stroke="#d6c7b2" strokeWidth="1" />
        {/* Nightstands */}
        <rect x="668" y="115" width="26" height="30" rx="3" fill="#dfd0bc" stroke="#bda88e" strokeWidth="1" />
        <rect x="846" y="115" width="26" height="30" rx="3" fill="#dfd0bc" stroke="#bda88e" strokeWidth="1" />
        {/* Full-width Wardrobe on Right Wall */}
        <rect x="900" y="90" width="26" height="220" rx="2" fill="#d6c7b2" stroke="#a89a85" strokeWidth="1" />

        <text x="770" y="305" textAnchor="middle" fill="#292524" fontSize="15" fontWeight="800">
          MASTER BEDROOM
        </text>
        <text x="770" y="324" textAnchor="middle" fill="#78716c" fontSize="11" fontWeight="600">
          14&apos;6&quot; × 12&apos;0&quot; (174 sq ft)
        </text>
      </g>

      {/* 7. Master Attached Bathroom (Right-Center) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("bathroom")}
        onMouseEnter={() => setHoveredRoom("master-bath")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="740"
          y="350"
          width="190"
          height="130"
          fill={hoveredRoom === "master-bath" ? "#eef5fb" : "#f1f6fa"}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {/* Walk-in Shower Cubicle with Glass Line */}
        <rect x="850" y="355" width="75" height="70" fill="#e0f2fe" stroke="#38bdf8" strokeDasharray="3 3" strokeWidth="1" />
        <circle cx="887" cy="390" r="8" fill="#38bdf8" opacity="0.4" />
        {/* WC Commode */}
        <path d="M 780 355 L 810 355 L 810 380 Q 795 395 780 380 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
        {/* Vanity Sink */}
        <rect x="748" y="420" width="50" height="25" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <ellipse cx="773" cy="432" rx="14" ry="7" fill="#ffffff" stroke="#64748b" strokeWidth="1" />

        <text x="815" y="465" textAnchor="middle" fill="#334155" fontSize="11.5" fontWeight="700">
          ATTACHED BATH (8&apos;6&quot; × 5&apos;6&quot;)
        </text>
      </g>

      {/* 8. Second Bedroom (Bottom-Right) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("bed-2")}
        onMouseEnter={() => setHoveredRoom("bed-2")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="460"
          y="360"
          width="280"
          height="250"
          fill={hoveredRoom === "bed-2" ? "#fbf5ec" : "#faf6f0"}
          stroke="#e7dfd5"
          strokeWidth="1"
        />
        {/* Queen Bed */}
        <rect x="520" y="440" width="120" height="145" rx="5" fill="#e9e0d2" stroke="#cbb9a3" strokeWidth="1.5" />
        <rect x="530" y="448" width="45" height="25" rx="3" fill="#f8fafc" stroke="#d6c7b2" strokeWidth="1" />
        <rect x="585" y="448" width="45" height="25" rx="3" fill="#f8fafc" stroke="#d6c7b2" strokeWidth="1" />
        {/* Study Desk with Laptop */}
        <rect x="660" y="375" width="65" height="35" rx="2" fill="#dfd0bc" stroke="#bda88e" strokeWidth="1" />
        {/* Wardrobe */}
        <rect x="470" y="375" width="40" height="90" rx="2" fill="#d6c7b2" stroke="#a89a85" strokeWidth="1" />

        <text x="600" y="415" textAnchor="middle" fill="#292524" fontSize="14" fontWeight="800">
          SECOND BEDROOM
        </text>
        <text x="600" y="433" textAnchor="middle" fill="#78716c" fontSize="11" fontWeight="600">
          12&apos;0&quot; × 11&apos;0&quot; (132 sq ft)
        </text>
      </g>

      {/* 9. Common Bathroom (Bottom-Center) */}
      <g
        className="fp-room-group"
        onClick={() => onSelectRoom && onSelectRoom("bathroom")}
        onMouseEnter={() => setHoveredRoom("common-bath")}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="740"
          y="480"
          width="190"
          height="130"
          fill={hoveredRoom === "common-bath" ? "#eef5fb" : "#f1f6fa"}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <rect x="850" y="535" width="75" height="70" fill="#e0f2fe" stroke="#38bdf8" strokeDasharray="3 3" strokeWidth="1" />
        <path d="M 780 575 L 810 575 L 810 550 Q 795 535 780 550 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
        <rect x="748" y="490" width="50" height="25" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <ellipse cx="773" cy="502" rx="14" ry="7" fill="#ffffff" stroke="#64748b" strokeWidth="1" />

        <text x="835" y="525" textAnchor="middle" fill="#334155" fontSize="11.5" fontWeight="700">
          COMMON BATH (8&apos;0&quot; × 5&apos;0&quot;)
        </text>
      </g>

      {/* ================================================================= */}
      {/* THICK STRUCTURAL WALLS & DOORWAYS (ARCHITECTURAL BLACK)           */}
      {/* ================================================================= */}
      <g stroke="#292524" strokeWidth="8" strokeLinecap="square" fill="none">
        {/* Exterior Boundary Walls */}
        <polyline points="70,60 930,60 930,610 70,610 70,60" />

        {/* Interior Dividing Walls */}
        <line x1="220" y1="60" x2="220" y2="210" />
        <line x1="220" y1="210" x2="70" y2="210" />
        <line x1="220" y1="480" x2="70" y2="480" />
        <line x1="640" y1="60" x2="640" y2="350" />
        <line x1="640" y1="350" x2="930" y2="350" />
        <line x1="460" y1="360" x2="460" y2="610" />
        <line x1="740" y1="350" x2="740" y2="610" />
        <line x1="740" y1="480" x2="930" y2="480" />
        <line x1="220" y1="360" x2="460" y2="360" />
      </g>

      {/* Window Symbols (Blue Glass Layer) */}
      <g stroke="#38bdf8" strokeWidth="4" strokeLinecap="round">
        {/* Living Room Large Double Window */}
        <line x1="460" y1="60" x2="580" y2="60" />
        {/* Master Bedroom Window */}
        <line x1="740" y1="60" x2="860" y2="60" />
        {/* Balcony Railing Window Access */}
        <line x1="70" y1="250" x2="70" y2="410" stroke="#0284c7" strokeWidth="3" strokeDasharray="6 4" />
        {/* Second Bedroom Window */}
        <line x1="560" y1="610" x2="680" y2="610" />
        {/* Kitchen Window */}
        <line x1="70" y1="520" x2="70" y2="580" />
      </g>

      {/* Door Swing Arcs (Thin dashed lines indicating architectural swing) */}
      <g stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="3 3" fill="none">
        {/* Main Entrance Door Arc */}
        <path d="M 120 60 A 50 50 0 0 1 170 110" />
        <line x1="120" y1="60" x2="170" y2="60" stroke="#292524" strokeWidth="2.5" />

        {/* Master Bedroom Door Arc */}
        <path d="M 640 280 A 45 45 0 0 1 685 325" />
        <line x1="640" y1="280" x2="640" y2="325" stroke="#292524" strokeWidth="2.5" />

        {/* Master Bath Door Arc */}
        <path d="M 740 370 A 35 35 0 0 1 775 405" />

        {/* Second Bedroom Door Arc */}
        <path d="M 460 380 A 40 40 0 0 1 500 420" />

        {/* Common Bath Door Arc */}
        <path d="M 740 500 A 35 35 0 0 1 775 535" />

        {/* Balcony Sliding Doors (Double parallel lines) */}
        <line x1="220" y1="230" x2="220" y2="310" stroke="#0284c7" strokeWidth="3" />
      </g>

      {/* ================================================================= */}
      {/* ARCHITECTURAL COMPASS ROSE (NORTH ARROW)                          */}
      {/* ================================================================= */}
      <g transform="translate(900, 110)">
        <circle cx="0" cy="0" r="24" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* North Pointer */}
        <polygon points="0,-20 6,0 0,-4 -6,0" fill="#dc2626" />
        <polygon points="0,20 6,0 0,4 -6,0" fill="#475569" />
        <text x="0" y="-23" textAnchor="middle" fill="#dc2626" fontSize="11" fontWeight="800">
          N
        </text>
      </g>

      {/* ================================================================= */}
      {/* TITLE BLOCK & SCALE BANNER (MANDATORY DEMO DISCLAIMER)             */}
      {/* ================================================================= */}
      <g transform="translate(60, 625)">
        <rect x="0" y="0" width="880" height="40" rx="6" fill="#f5f0e8" stroke="#e7dfd5" strokeWidth="1" />
        <text x="20" y="24" fill="#292524" fontSize="13" fontWeight="800" letterSpacing="0.02em">
          THE AURELIA – PREMIUM 2BHK RESIDENCE
        </text>
        <text x="350" y="24" fill="#78716c" fontSize="12" fontWeight="600">
          1,350 SQFT SUPER BUILT-UP | 1,050 SQFT CARPET
        </text>
        {/* Mandatory Label from user requirements */}
        <text x="860" y="24" textAnchor="end" fill="#b45309" fontSize="11" fontWeight="700">
          ⚠️ ILLUSTRATIVE DEMO FLOOR PLAN – NOT TO SCALE
        </text>
      </g>
    </svg>
  );

  return (
    <div className="showcase-fp-card">
      <div
        className="showcase-fp-viewport"
        style={{ cursor: "zoom-in", background: "#fcfbfa", position: "relative" }}
        onClick={() => setIsFullscreen(true)}
        title="Click to expand fullscreen floor plan"
      >
        {renderSVG()}

        {/* Interactive Floating Action Controls */}
        <div
          className="showcase-fp-controls"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            display: "flex",
            gap: 6,
            background: "rgba(255, 255, 255, 0.95)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid #e7dfd5",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            className="showcase-fp-ctrl-btn"
            onClick={handleZoomIn}
            title="Zoom In (+)"
          >
            🔍+
          </button>
          <button
            type="button"
            className="showcase-fp-ctrl-btn"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
          >
            🔍-
          </button>
          <button
            type="button"
            className="showcase-fp-ctrl-btn"
            onClick={handleResetZoom}
            title="Reset Zoom (100%)"
          >
            ↺
          </button>
          <button
            type="button"
            className="showcase-fp-ctrl-btn"
            onClick={handleDownloadSVG}
            title="Download Floor Plan (SVG)"
            style={{ color: "#0284c7" }}
          >
            ⬇️ Download
          </button>
          <button
            type="button"
            className="showcase-fp-ctrl-btn"
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen Modal View"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Room Dimensions & Architectural Specification Breakdown */}
      <div className="showcase-fp-specs-table">
        <div className="showcase-fp-spec-item">
          <span>Living Hall</span>
          <strong>18&apos;0&quot; × 13&apos;6&quot; (243 sqft)</strong>
        </div>
        <div className="showcase-fp-spec-item">
          <span>Master Suite</span>
          <strong>14&apos;6&quot; × 12&apos;0&quot; (174 sqft)</strong>
        </div>
        <div className="showcase-fp-spec-item">
          <span>Second Bedroom</span>
          <strong>12&apos;0&quot; × 11&apos;0&quot; (132 sqft)</strong>
        </div>
        <div className="showcase-fp-spec-item">
          <span>Kitchen &amp; Utility</span>
          <strong>11&apos;6&quot; × 8&apos;0&quot; (92 sqft)</strong>
        </div>
        <div className="showcase-fp-spec-item">
          <span>Dining &amp; Balcony</span>
          <strong>168 sqft Combined</strong>
        </div>
        <div className="showcase-fp-spec-item">
          <span>Carpet Efficiency</span>
          <strong>78% (1,050 sqft Usable)</strong>
        </div>
      </div>

      {/* Fullscreen Interactive Modal */}
      {isFullscreen && (
        <div
          className="showcase-lightbox-backdrop"
          onClick={() => setIsFullscreen(false)}
          style={{ zIndex: 999999 }}
        >
          <div
            className="showcase-lightbox-header"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#292524", color: "#fdfbf7" }}
          >
            <div>
              <span style={{ fontWeight: 800, fontSize: 16 }}>
                📐 The Aurelia 2BHK Architectural Floor Plan
              </span>
              <span style={{ fontSize: 12, marginLeft: 12, color: "#fde68a" }}>
                (Illustrative Demo Blueprint – Not to Scale)
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="showcase-action-btn"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={handleDownloadSVG}
              >
                ⬇️ Download SVG
              </button>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => setIsFullscreen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="showcase-lightbox-stage"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fcfbfa", padding: 20 }}
          >
            <div style={{ maxWidth: "90vw", maxHeight: "82vh", width: "100%", height: "100%" }}>
              {renderSVG()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
