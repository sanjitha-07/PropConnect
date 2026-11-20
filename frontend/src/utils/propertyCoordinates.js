// frontend/src/utils/propertyCoordinates.js
// Authentic geographic coordinates for Tamil Nadu cities and micro-markets

export const TN_LOCALITY_COORDINATES = {
  // Chennai micro-markets
  "t. nagar": { lat: 13.0418, lng: 80.2341, name: "T. Nagar, Chennai" },
  "usman road": { lat: 13.0418, lng: 80.2341, name: "Usman Road, T. Nagar, Chennai" },
  "anna nagar": { lat: 13.0850, lng: 80.2101, name: "Anna Nagar, Chennai" },
  "mylapore": { lat: 13.0368, lng: 80.2676, name: "Mylapore, Chennai" },
  "velachery": { lat: 12.9759, lng: 80.2212, name: "Velachery, Chennai" },
  "injambakkam": { lat: 12.9238, lng: 80.2520, name: "Injambakkam, ECR, Chennai" },
  "ecr": { lat: 12.9238, lng: 80.2520, name: "East Coast Road (ECR), Chennai" },
  "navalur": { lat: 12.8459, lng: 80.2265, name: "Navalur, OMR, Chennai" },
  "omr": { lat: 12.8459, lng: 80.2265, name: "Old Mahabalipuram Road (OMR), Chennai" },
  "oragadam": { lat: 12.8333, lng: 79.9500, name: "Oragadam, Sriperumbudur, Chennai" },
  "adyar": { lat: 13.0012, lng: 80.2565, name: "Adyar, Chennai" },
  "alwarpet": { lat: 13.0334, lng: 80.2530, name: "Alwarpet, Chennai" },
  "guindy": { lat: 13.0067, lng: 80.2020, name: "Guindy, Chennai" },
  "nungambakkam": { lat: 13.0569, lng: 80.2425, name: "Nungambakkam, Chennai" },

  // Coimbatore micro-markets
  "peelamedu": { lat: 11.0267, lng: 77.0143, name: "Peelamedu, Coimbatore" },
  "avinashi road": { lat: 11.0267, lng: 77.0143, name: "Avinashi Road, Coimbatore" },
  "race course": { lat: 11.0086, lng: 76.9747, name: "Race Course, Coimbatore" },
  "rs puram": { lat: 11.0090, lng: 76.9514, name: "RS Puram, Coimbatore" },
  "saravanampatti": { lat: 11.0797, lng: 76.9997, name: "Saravanampatti, Coimbatore" },
  "gandhipuram": { lat: 11.0183, lng: 76.9644, name: "Gandhipuram, Coimbatore" },

  // Madurai micro-markets
  "kk nagar": { lat: 9.9252, lng: 78.1478, name: "KK Nagar, Madurai" },
  "mattuthavani": { lat: 9.9525, lng: 78.1565, name: "Mattuthavani, Madurai" },
  "anna nagar madurai": { lat: 9.9190, lng: 78.1420, name: "Anna Nagar, Madurai" },
  "tallakulam": { lat: 9.9333, lng: 78.1333, name: "Tallakulam, Madurai" },

  // Trichy micro-markets
  "thillai nagar": { lat: 10.8286, lng: 78.6865, name: "Thillai Nagar, Trichy" },
  "cantonment": { lat: 10.8050, lng: 78.6850, name: "Cantonment, Trichy" },
  "shastri road": { lat: 10.8286, lng: 78.6865, name: "Shastri Road, Trichy" },
  "srirangam": { lat: 10.8622, lng: 78.6908, name: "Srirangam, Trichy" },

  // Salem micro-markets
  "fairlands": { lat: 11.6743, lng: 78.1460, name: "Fairlands, Salem" },
  "alagapuram": { lat: 11.6850, lng: 78.1420, name: "Alagapuram, Salem" },
  "shevapet": { lat: 11.6500, lng: 78.1333, name: "Shevapet, Salem" },

  // Other TN Cities
  "katpadi": { lat: 12.9716, lng: 79.1388, name: "Katpadi, Vellore" },
  "gandhinagar tiruppur": { lat: 11.1271, lng: 77.3411, name: "Gandhinagar, Tiruppur" },
  "vannarpettai": { lat: 8.7274, lng: 77.7281, name: "Vannarpettai, Tirunelveli" },
};

export const TN_CITY_CENTROIDS = {
  chennai: { lat: 13.0827, lng: 80.2707, name: "Chennai City Centre" },
  coimbatore: { lat: 11.0168, lng: 76.9558, name: "Coimbatore City Centre" },
  madurai: { lat: 9.9252, lng: 78.1198, name: "Madurai City Centre" },
  trichy: { lat: 10.7905, lng: 78.7047, name: "Tiruchirappalli (Trichy)" },
  salem: { lat: 11.6643, lng: 78.1460, name: "Salem City Centre" },
  tiruppur: { lat: 11.1085, lng: 77.3411, name: "Tiruppur City Centre" },
  vellore: { lat: 12.9165, lng: 79.1325, name: "Vellore City Centre" },
  tirunelveli: { lat: 8.7139, lng: 77.7567, name: "Tirunelveli City Centre" },
};

/**
 * Returns authentic geographic coordinates for a given property
 */
export function getCoordinatesForProperty(property) {
  if (!property) return { lat: 13.0827, lng: 80.2707 };

  // 1. Direct coordinates on property
  if (property.coordinates && property.coordinates.lat && property.coordinates.lng) {
    return { lat: Number(property.coordinates.lat), lng: Number(property.coordinates.lng) };
  }
  if (property.lat && property.lng) {
    return { lat: Number(property.lat), lng: Number(property.lng) };
  }
  if (property.latitude && property.longitude) {
    return { lat: Number(property.latitude), lng: Number(property.longitude) };
  }

  // 2. Lookup locality in address/location
  const textToScan = `${property.locality || ""} ${property.location || ""} ${property.address || ""} ${property.name || ""}`.toLowerCase();

  for (const [key, coords] of Object.entries(TN_LOCALITY_COORDINATES)) {
    if (textToScan.includes(key)) {
      return { lat: coords.lat, lng: coords.lng };
    }
  }

  // 3. Fallback to City Centroid
  const cityKey = (property.city || "chennai").toLowerCase().trim();
  if (TN_CITY_CENTROIDS[cityKey]) {
    return { lat: TN_CITY_CENTROIDS[cityKey].lat, lng: TN_CITY_CENTROIDS[cityKey].lng };
  }

  // 4. Default Tamil Nadu capital (Chennai)
  return { lat: 13.0827, lng: 80.2707 };
}
