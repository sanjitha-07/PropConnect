import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCoordinatesForProperty } from "../../utils/propertyCoordinates.js";

export default function PropertyLocationMap({ property }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || !property) return;

    const coords = getCoordinatesForProperty(property);

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom Pin Marker
      const customPin = L.divIcon({
        className: "prop-details-pin",
        html: `
          <div style="
            background: #2563eb;
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 18px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
            transform: translate(-50%, -100%);
          ">
            <span>📍</span>
            <span>${property.name?.split("-")[0].trim() || "Property Location"}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([coords.lat, coords.lng], { icon: customPin })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px;">
            <strong>${property.name}</strong><br/>
            📍 ${property.location || property.locality || property.city}
          </div>
        `);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([coords.lat, coords.lng], 14);
    }
  }, [property]);

  if (!property) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "300px", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(4px)",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#0f172a",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          zIndex: 400,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>📍 Authentic Geo Coordinates:</span>
        <span style={{ color: "#2563eb", fontFamily: "monospace" }}>
          {getCoordinatesForProperty(property).lat.toFixed(4)}° N, {getCoordinatesForProperty(property).lng.toFixed(4)}° E
        </span>
      </div>
    </div>
  );
}
