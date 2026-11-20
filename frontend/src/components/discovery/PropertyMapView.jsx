import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCoordinatesForProperty } from "../../utils/propertyCoordinates.js";

// Fix standard Leaflet default icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createCustomPin(priceText, isAvailable) {
  const bg = isAvailable ? "#2563eb" : "#475569";
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="
        background: ${bg};
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 2px solid #ffffff;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 3px;
        transform: translate(-50%, -100%);
      ">
        <span>📍</span>
        <span>${priceText}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -28],
  });
}

export default function PropertyMapView({
  properties = [],
  selectedProperty = null,
  onSelectProperty,
  onNavigateDetails,
  formatCurrency = (v) => `₹${Number(v).toLocaleString("en-IN")}`,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered at Tamil Nadu (Chennai default: 13.0418, 80.2341)
      const map = L.map(mapContainerRef.current, {
        center: [13.0418, 80.2341],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers();

    if (properties.length === 0) return;

    const bounds = L.latLngBounds();

    properties.forEach((p) => {
      const coords = getCoordinatesForProperty(p);
      const isAvailable = (p.status || "").toLowerCase() === "available";
      const priceText = formatCurrency ? formatCurrency(p.rent) : `₹${p.rent}`;

      const icon = createCustomPin(priceText, isAvailable);
      const marker = L.marker([coords.lat, coords.lng], { icon });

      // Build popup content
      const popupHtml = `
        <div style="font-family: inherit; width: 220px; padding: 2px;">
          <div style="width: 100%; height: 110px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #e2e8f0;">
            <img src="${p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400"}" 
                 style="width: 100%; height: 100%; object-fit: cover;" alt="${p.name}" />
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${p.name}
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-bottom: 6px;">
            📍 ${p.locality || p.location || p.city}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 14px; font-weight: 800; color: #2563eb;">${priceText}<span style="font-size: 11px; font-weight: 500; color: #64748b;">/mo</span></span>
            <span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${p.bedrooms || 2} BHK</span>
          </div>
          <button id="map-btn-${p.id}" style="
            width: 100%;
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">View Details →</button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on("popupopen", () => {
        const btn = document.getElementById(`map-btn-${p.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onNavigateDetails) onNavigateDetails(p.id);
          };
        }
        if (onSelectProperty) onSelectProperty(p);
      });

      marker.addTo(markersLayer);
      bounds.extend([coords.lat, coords.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [properties, onSelectProperty, onNavigateDetails, formatCurrency]);

  return (
    <div style={{ position: "relative", width: "100%", height: "550px", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
      <div style={{
        position: "absolute",
        bottom: "16px",
        left: "16px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(4px)",
        padding: "8px 14px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }}></span>
          <span>Available ({properties.filter(p => (p.status || "").toLowerCase() === "available").length})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#475569", display: "inline-block" }}></span>
          <span>Occupied</span>
        </div>
      </div>
    </div>
  );
}
