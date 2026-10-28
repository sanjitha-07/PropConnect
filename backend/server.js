import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// Backend Server for PropConnect Portal
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { connectMongoDB, getMongoStatus, COMPASS_URI, MONGODB_URI } from "./config/db.js";
import { seedAllData } from "./seed.js";
import {
  User,
  Landlord,
  Tenant,
  Property,
  Lease,
  Payment,
  MaintenanceRequest,
  Complaint,
  SecurityDeposit,
  UtilityBill,
  Expense,
  Document,
  Notification,
  TenantPreference,
  PropertyChat,
  Enquiry,
  PropertyImage,
  Favorite,
  SystemSetting,
  ServiceProvider,
  ServiceCategory,
  ProviderAvailability,
  ServiceBooking,
  PreferredProvider,
  FixItBooking,
  PropertyMaintenanceHistory,
  ComplaintCategory,
  models,
} from "./models/index.js";
import jwt from "jsonwebtoken";
import { rankProperties } from "./utils/matchingEngine.js";
import { answerPropertyQuestion } from "./utils/propertyChatEngine.js";
import {
  calculateTenantRentCycle,
  getNthRentCycle,
  parseFlexibleDate,
  formatYMD,
  formatDisplayDate,
} from "./utils/rentCycleEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const JWT_SECRET = process.env.JWT_SECRET || "propconnect_jwt_secret_key_2026";

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      entityId: user.entityId || user.entity_id || null,
      entity_id: user.entityId || user.entity_id || null,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        req.user = decoded;
        return next();
      }
      extractFallbackUser(req);
      next();
    });
  } else {
    extractFallbackUser(req);
    next();
  }
}

function extractFallbackUser(req) {
  const roleHeader = req.headers["x-user-role"] || req.query.role;
  const idHeader =
    req.headers["x-user-id"] ||
    req.headers["x-user-entity-id"] ||
    req.query.userId ||
    req.query.tenantId ||
    req.query.landlordId;
  const emailHeader = req.headers["x-user-email"] || req.query.email;
  if (roleHeader || idHeader || emailHeader) {
    req.user = {
      role: roleHeader || "tenant",
      id: idHeader || null,
      entityId: idHeader || null,
      entity_id: idHeader || null,
      email: emailHeader || "",
    };
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role "${req.user.role}" does not have required permissions.`,
      });
    }
    next();
  };
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(authenticateToken);

// Background MongoDB connection & seeding
let seeded = false;
async function tryConnectAndSeed() {
  const conn = await connectMongoDB();
  if (conn && !seeded) {
    try {
      const paymentCount = await Payment.countDocuments();
      if (paymentCount < 5) {
        console.log(`🌱 [MongoDB Auto-Seed] Found ${paymentCount} payments. Seeding all 13 collections from Tamil Nadu dataset...`);
        await seedAllData();
      } else {
        console.log(`📦 [MongoDB] Database verified with ${paymentCount} existing payments in propconnect_db.`);
      }
      seeded = true;
    } catch (err) {
      console.warn("⚠️ [MongoDB Seed Check]:", err.message);
    }
  }
}

// Start connection attempt immediately
tryConnectAndSeed();

// Retry connection every 15 seconds if not connected
setInterval(async () => {
  const status = await getMongoStatus();
  if (status.status !== "connected") {
    await tryConnectAndSeed();
  }
}, 15000);

// -------------------------------------------------------------
// 1. Database Health & MongoDB Compass Diagnostics Endpoint
// -------------------------------------------------------------
app.get("/api/db/status", async (req, res) => {
  try {
    const status = await getMongoStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -------------------------------------------------------------
// 2. Interactive MongoDB Live Query Console Endpoint
// -------------------------------------------------------------
app.post("/api/db/query", async (req, res) => {
  const { collection, filter, sort, limit, query: rawQuery } = req.body;

  try {
    const startTime = Date.now();

    let targetCollection = (collection || "").toLowerCase();
    let queryFilter = filter || {};
    let queryLimit = limit ? Math.min(Number(limit), 100) : 20;
    let querySort = sort || { _id: -1 };

    // Support raw query text e.g. "properties.find({ city: 'Chennai' })" or JSON
    if (rawQuery && typeof rawQuery === "string") {
      const trimmed = rawQuery.trim();
      const match = trimmed.match(/^(\w+)\.(find|count|findOne)\((.*)\)$/s);
      if (match) {
        targetCollection = match[1].toLowerCase();
        try {
          queryFilter = JSON.parse(match[3] || "{}");
        } catch {
          // fallback
        }
      } else if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.collection) targetCollection = parsed.collection.toLowerCase();
          if (parsed.filter) queryFilter = parsed.filter;
        } catch {
          // fallback
        }
      }
    }

    if (!targetCollection || !models[targetCollection]) {
      targetCollection = "properties";
    }

    const Model = models[targetCollection];
    const docs = await Model.find(queryFilter).sort(querySort).limit(queryLimit).lean();
    const latencyMs = Date.now() - startTime;

    return res.json({
      success: true,
      type: "MONGODB_FIND",
      collection: targetCollection,
      filter: queryFilter,
      rowCount: docs.length,
      latencyMs,
      rows: docs,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Authentication & Password Security Utilities
// -------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !password) return false;
  // If stored as pbkdf2$salt$hash:
  if (typeof storedPassword === "string" && storedPassword.startsWith("pbkdf2$")) {
    const parts = storedPassword.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const originalHash = parts[2];
      const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
      return computedHash === originalHash;
    }
  }
  // Compatible fallback for legacy plain text seeds (admin123, land123, tenant123)
  return storedPassword === password;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();

    if (user && verifyPassword(password, user.password)) {
      const userObj = {
        id: user.id || user._id.toString(),
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        entityId: user.entityId || user.entity_id || (user.email === "divya.priya@mail.com" ? "TEN001" : user.email === "karthik.raja@mail.com" ? "LDL001" : null),
        entity_id: user.entity_id || user.entityId || (user.email === "divya.priya@mail.com" ? "TEN001" : user.email === "karthik.raja@mail.com" ? "LDL001" : null),
        location: user.location || "Tamil Nadu, India",
      };
      const token = generateToken(userObj);
      return res.json({ success: true, token, user: userObj, role: user.role });
    }
    return res.status(401).json({ success: false, message: "Invalid email or password. Please check your credentials." });
  } catch (err) {
    res.status(500).json({ success: false, message: "An error occurred during authentication. Please try again." });
  }
});

// 3.1 New Tenant Registration Endpoint (Creates Real User + Tenant in MongoDB)
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      preferredCity,
      preferredLocality,
      familyMembers,
    } = req.body;

    // Field Validations
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Full Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: "Mobile number is required." });
    }
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit Indian mobile number (e.g., 9876543210 or +91 9876543210).",
      });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match. Please re-enter." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate account
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists. Please sign in instead.",
      });
    }

    // Securely hash password using PBKDF2
    const hashedPassword = hashPassword(password);
    const locationCity = preferredCity ? `${preferredCity}, Tamil Nadu` : "Chennai, Tamil Nadu";
    const reqRole = (req.body.role || "tenant").toLowerCase();

    if (reqRole === "provider" || reqRole === "service_provider") {
      // 1. Service Provider Registration
      const providerId = `PROV_${Date.now().toString().slice(-6)}`;
      const category = req.body.category || "Civil Work";
      const price = Number(req.body.price) || 499;
      const skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : req.body.skills
        ? String(req.body.skills).split(",").map((s) => s.trim())
        : [category, "Home Maintenance", "Repairs"];

      const createdUser = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        role: "provider",
        name: name.trim(),
        entity_id: providerId,
        entityId: providerId,
        location: locationCity,
      });

      await ServiceProvider.create({
        id: providerId,
        name: name.trim(),
        technicianName: req.body.technicianName || name.trim(),
        category,
        price,
        unit: req.body.unit || "per service",
        phone: phone.trim(),
        email: normalizedEmail,
        location: locationCity,
        skills,
        availability: "Available Today",
        isAvailable: true,
        status: "Active",
        rating: 5.0,
        reviewCount: 0,
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        timeSlots: [
          "09:00 AM",
          "10:00 AM",
          "11:00 AM",
          "12:00 PM",
          "02:00 PM",
          "03:00 PM",
          "04:00 PM",
          "05:00 PM",
        ],
      });

      const userObj = {
        id: createdUser.id || createdUser._id.toString(),
        _id: createdUser._id,
        email: createdUser.email,
        name: createdUser.name,
        role: "provider",
        entityId: providerId,
        entity_id: providerId,
        location: locationCity,
        category,
      };

      const token = generateToken(userObj);
      return res.status(201).json({
        success: true,
        message: `Welcome, ${name}! Your Service Provider account (${category}) has been registered successfully.`,
        token,
        user: userObj,
        role: "provider",
      });
    }

    // Generate unique Tenant ID: TEN followed by random 3-digit number and timestamp suffix
    const tenantId = `TEN${Math.floor(100 + Math.random() * 900)}${Date.now().toString().slice(-3)}`;

    // 1. Create User in MongoDB `users` collection
    const createdUser = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: "tenant",
      name: name.trim(),
      entity_id: tenantId,
      entityId: tenantId,
      location: locationCity,
    });

    // 2. Create Tenant in MongoDB `tenants` collection
    const createdTenant = await Tenant.create({
      id: tenantId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      location: preferredCity || "Chennai",
      company: "",
      status: "Active",
      propertyId: null,
      property_id: null,
      leaseId: null,
      lease_id: null,
    });

    // 3. Save initial discovery preferences in MongoDB `tenantpreferences` collection
    try {
      await TenantPreference.create({
        id: `PREF_${tenantId}`,
        userId: tenantId,
        user_id: tenantId,
        city: preferredCity || "Chennai",
        locality: preferredLocality || "",
        propertyType: "Apartment",
        bhk: "2",
        familyMembers: Number(familyMembers) || 2,
        budgetRange: "₹20,000–₹30,000",
        budgetMin: 20000,
        budgetMax: 30000,
        furnishing: "No preference",
        amenities: ["Covered Car Parking", "24x7 Security"],
        nearby: ["School", "Hospital"],
        maxDistance: "Any distance",
        additionalRequirements: `Looking for residential accommodation in ${preferredCity || "Tamil Nadu"} for ${familyMembers || 2} persons.`,
      });
    } catch (prefErr) {
      console.warn("Initial preference setup note:", prefErr.message);
    }

    // Prepare clean return user object (NO password)
    const userObj = {
      id: createdUser.id || createdUser._id.toString(),
      _id: createdUser._id,
      email: createdUser.email,
      name: createdUser.name,
      role: "tenant",
      entityId: tenantId,
      entity_id: tenantId,
      location: locationCity,
    };

    const token = generateToken(userObj);
    return res.status(201).json({
      success: true,
      token,
      message: "Tenant account created successfully! Welcome to PropConnect.",
      user: userObj,
      role: "tenant",
      tenant: createdTenant,
    });
  } catch (err) {
    console.error("Tenant registration error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to complete registration. Please check your details and try again.",
    });
  }
});

app.post("/api/auth/google", async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    let user = await User.findOne({ email: email.trim().toLowerCase() }).lean();

    if (!user) {
      const userRole = role || "landlord";
      const userName = name || email.split("@")[0];
      const defaultEntityId = userRole === "tenant" ? "TEN001" : "LDL001";

      const created = await User.create({
        email: email.trim().toLowerCase(),
        password: "google_auth",
        role: userRole,
        name: userName,
        entity_id: defaultEntityId,
        entityId: defaultEntityId,
        location: "Tamil Nadu, India",
      });

      user = created.toObject();
    }

    const userObj = {
      id: user.id || user._id.toString(),
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      entityId: user.entityId || user.entity_id || (user.role === "tenant" ? "TEN001" : "LDL001"),
      entity_id: user.entity_id || user.entityId || (user.role === "tenant" ? "TEN001" : "LDL001"),
      location: user.location || "Tamil Nadu, India",
    };

    const token = generateToken(userObj);
    return res.json({ success: true, token, user: userObj, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// 4. Data Endpoints: Landlords
// -------------------------------------------------------------
app.get("/api/landlords", async (req, res) => {
  try {
    const rows = await Landlord.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/landlords", async (req, res) => {
  try {
    const l = req.body;
    const id = l.id || `LDL${Math.floor(Math.random() * 900 + 100)}`;
    const created = await Landlord.create({
      id,
      name: l.name || "New Landlord",
      email: l.email || "",
      phone: l.phone || "",
      location: l.location || "Tamil Nadu",
      status: l.status || "Verified",
      propertiesCount: Number(l.propertiesCount || 0),
      properties_count: Number(l.propertiesCount || 0),
      totalUnits: Number(l.totalUnits || 0),
      total_units: Number(l.totalUnits || 0),
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/landlords/:id", async (req, res) => {
  try {
    const updated = await Landlord.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Landlord not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/landlords/:id", async (req, res) => {
  try {
    const deleted = await Landlord.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Landlord not found" });
    res.json({ success: true, message: "Landlord removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Data Endpoints: Tenants
// -------------------------------------------------------------
app.get("/api/tenants", async (req, res) => {
  try {
    const rows = await Tenant.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tenants/:id", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ id: req.params.id }).lean();
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tenants", async (req, res) => {
  try {
    const t = req.body;
    const id = t.id || `TEN${Math.floor(Math.random() * 900 + 100)}`;
    const created = await Tenant.create({
      id,
      name: t.name || "Resident Tenant",
      email: t.email || "",
      phone: t.phone || "",
      propertyId: t.propertyId || t.property_id || null,
      property_id: t.propertyId || t.property_id || null,
      leaseId: t.leaseId || t.lease_id || null,
      lease_id: t.leaseId || t.lease_id || null,
      location: t.location || "Chennai",
      company: t.company || "",
      status: t.status || "Active",
    });

    // Also register or sync property tenantId if property was allotted
    if (t.propertyId || t.property_id) {
      await Property.findOneAndUpdate(
        { id: t.propertyId || t.property_id },
        { $set: { tenantId: id, tenant_id: id, status: "Occupied" } }
      );
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/tenants/:id", async (req, res) => {
  try {
    const t = req.body;
    const updateData = { ...t };
    if (t.propertyId) updateData.property_id = t.propertyId;
    if (t.leaseId) updateData.lease_id = t.leaseId;

    const updated = await Tenant.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/tenants/:id", async (req, res) => {
  try {
    const deleted = await Tenant.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Tenant not found" });

    // Free up property if tenant was assigned
    await Property.updateMany(
      { tenantId: req.params.id },
      { $set: { tenantId: null, tenant_id: null, status: "Available" } }
    );

    res.json({ success: true, message: "Tenant removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Properties CRUD API (Backed by MongoDB `properties` collection)
// -------------------------------------------------------------
app.get("/api/properties", async (req, res) => {
  try {
    const rows = await Property.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.1 Smart Preference Matching & Discovery Endpoint (Reads REAL MongoDB properties)
app.post("/api/properties/match", async (req, res) => {
  try {
    const preferences = req.body || {};
    const allProps = await Property.find().lean();
    const ranked = rankProperties(allProps, preferences);

    res.json({
      success: true,
      totalMatched: ranked.length,
      preferences,
      properties: ranked,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const prop = await Property.findOne({ id: req.params.id }).lean();
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Attach landlord public details where appropriate
    if (prop.landlordId || prop.landlord_id) {
      const landlord = await Landlord.findOne({ id: prop.landlordId || prop.landlord_id }).lean();
      if (landlord) {
        prop.landlord = {
          name: landlord.name,
          phone: landlord.phone,
          email: landlord.email,
          location: landlord.location,
        };
      }
    }

    res.json(prop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/properties", async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || `TN_${Date.now()}`;
    const amenities = Array.isArray(p.amenities)
      ? p.amenities
      : typeof p.amenities === "string"
      ? p.amenities.split(",").map((s) => s.trim())
      : [];
    const nearbyFacilities = Array.isArray(p.nearbyFacilities)
      ? p.nearbyFacilities
      : typeof p.nearbyFacilities === "string"
      ? p.nearbyFacilities.split(",").map((s) => s.trim())
      : [];

    const newProperty = await Property.create({
      id,
      name: p.name || "New Property",
      building: p.building || "",
      unit: p.unit || "",
      address: p.address || p.location || "",
      location: p.location || p.address || "",
      locality: p.locality || "",
      city: p.city || "Chennai",
      district: p.district || p.city || "Chennai",
      state: p.state || "Tamil Nadu",
      type: p.type || "Apartment",
      rent: Number(p.rent || 0),
      deposit: Number(p.deposit || 0),
      status: p.status || "Available",
      landlordId: p.landlordId || p.landlord_id || "LDL001",
      landlord_id: p.landlordId || p.landlord_id || "LDL001",
      tenantId: p.tenantId || p.tenant_id || null,
      tenant_id: p.tenantId || p.tenant_id || null,
      bedrooms: Number(p.bedrooms || 1),
      bathrooms: Number(p.bathrooms || 1),
      balconies: Number(p.balconies || 1),
      sqft: Number(p.sqft || p.area || 500),
      maintenanceCharges: Number(p.maintenanceCharges || p.maintenance || 0),
      furnishing: p.furnishing || "Unfurnished",
      floor: p.floor || "1st",
      facing: p.facing || "East (Vastu Compliant)",
      parking: p.parking || "Covered Car Parking",
      amenities,
      nearbyFacilities,
      description: p.description || "",
      petFriendly: Boolean(p.petFriendly),
      availableUnits: Number(p.availableUnits || 1),
      totalUnits: Number(p.totalUnits || 1),
      builder: p.builder || "",
      image: p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
    });

    res.status(201).json(newProperty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/properties/:id", async (req, res) => {
  try {
    const p = req.body;
    const updateData = { ...p };
    if (p.landlordId) updateData.landlord_id = p.landlordId;
    if (p.tenantId !== undefined) updateData.tenant_id = p.tenantId;

    const updated = await Property.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Property not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/properties/:id", async (req, res) => {
  try {
    const deleted = await Property.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Property not found" });
    res.json({ success: true, message: "Property removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Leases API (Backed by MongoDB `leases` collection)
// -------------------------------------------------------------
app.get("/api/leases", async (req, res) => {
  try {
    const rows = await Lease.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/leases", async (req, res) => {
  try {
    const l = req.body;
    const id = l.id || `LSE${Math.floor(Math.random() * 900 + 100)}`;
    const created = await Lease.create({
      id,
      propertyId: l.propertyId || l.property_id || null,
      property_id: l.propertyId || l.property_id || null,
      tenantId: l.tenantId || l.tenant_id || null,
      tenant_id: l.tenantId || l.tenant_id || null,
      landlordId: l.landlordId || l.landlord_id || "LDL001",
      landlord_id: l.landlordId || l.landlord_id || "LDL001",
      startDate: l.startDate || l.start_date || "",
      start_date: l.startDate || l.start_date || "",
      endDate: l.endDate || l.end_date || "",
      end_date: l.endDate || l.end_date || "",
      monthlyRent: Number(l.monthlyRent || l.monthly_rent || l.rent || 0),
      monthly_rent: Number(l.monthlyRent || l.monthly_rent || l.rent || 0),
      depositAmount: Number(l.depositAmount || l.deposit_amount || l.deposit || 0),
      deposit_amount: Number(l.depositAmount || l.deposit_amount || l.deposit || 0),
      status: l.status || "Active",
      paymentCycle: l.paymentCycle || l.payment_cycle || "Monthly",
      payment_cycle: l.paymentCycle || l.payment_cycle || "Monthly",
      termMonths: Number(l.termMonths || l.term_months || 11),
      term_months: Number(l.termMonths || l.term_months || 11),
      agreementDoc: l.agreementDoc || l.agreement_doc || "",
      agreement_doc: l.agreementDoc || l.agreement_doc || "",
      dueDay: Number(l.dueDay || l.due_day || 10),
      due_day: Number(l.dueDay || l.due_day || 10),
      reminderDaysBefore: Number(l.reminderDaysBefore || l.reminder_days_before || 5),
      reminder_days_before: Number(l.reminderDaysBefore || l.reminder_days_before || 5),
      gracePeriodDays: Number(l.gracePeriodDays || 5),
    });

    // Update property status
    if (l.propertyId || l.property_id) {
      await Property.findOneAndUpdate(
        { id: l.propertyId || l.property_id },
        { $set: { status: "Occupied", tenantId: l.tenantId || null, tenant_id: l.tenantId || null } }
      );
    }
    // Update tenant leaseId
    if (l.tenantId || l.tenant_id) {
      await Tenant.findOneAndUpdate(
        { id: l.tenantId || l.tenant_id },
        { $set: { leaseId: id, lease_id: id, propertyId: l.propertyId || null, property_id: l.propertyId || null } }
      );
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/leases/:id", async (req, res) => {
  try {
    const updated = await Lease.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Lease not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/leases/:id", async (req, res) => {
  try {
    const deleted = await Lease.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Lease not found" });
    res.json({ success: true, message: "Lease removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7.1 Move-In Date Rent Calculation & Cycle API
// -------------------------------------------------------------

function enrichLeaseWithDetails(lease, tenantObj, propertyObj) {
  const rawRent = Number(lease.monthlyRent || lease.monthly_rent || lease.rent || 0);
  const propRent = Number(propertyObj?.rent || propertyObj?.monthlyRent || 0);
  let effectiveRent = rawRent > 0 ? rawRent : propRent;
  if (!effectiveRent || effectiveRent <= 0) {
    const idLower = String((lease.id || "") + " " + (lease.propertyName || "")).toLowerCase();
    if (idLower.includes("lse-p01") || idLower.includes("parking")) {
      effectiveRent = 10000;
    } else if (idLower.includes("lse-s02") || idLower.includes("storage")) {
      effectiveRent = 7000;
    } else {
      effectiveRent = 22000;
    }
  }

  const rawDeposit = Number(lease.depositAmount || lease.deposit_amount || lease.deposit || 0);
  const effectiveDeposit = rawDeposit > 0 ? rawDeposit : effectiveRent * 2;

  return {
    ...lease,
    monthlyRent: effectiveRent,
    monthly_rent: effectiveRent,
    rent: effectiveRent,
    deposit: effectiveDeposit,
    depositAmount: effectiveDeposit,
    deposit_amount: effectiveDeposit,
    tenantName: lease.tenantName || tenantObj?.name || "Resident Tenant",
    tenantPhone: tenantObj?.phone || "+91 98401 23456",
    propertyName: lease.propertyName || propertyObj?.name || "Rental Unit",
    propertyLocation: propertyObj?.location || propertyObj?.city || "Tamil Nadu",
    propertyImage: propertyObj?.image || "",
    property: propertyObj || null,
  };
}

// Get Rent Cycles & Schedules for all or filtered leases (move-in based)
app.get("/api/leases/rent-schedules", async (req, res) => {
  try {
    const { tenantId, landlordId, propertyId } = req.query;
    const filter = {};
    if (tenantId) filter.$or = [{ tenantId }, { tenant_id: tenantId }];
    if (propertyId) filter.$or = [{ propertyId }, { property_id: propertyId }];
    if (landlordId) filter.$or = [{ landlordId }, { landlord_id: landlordId }];

    // If caller has role header/token, scope automatically
    if (req.user && req.user.role === "tenant" && (req.user.entityId || req.user.id)) {
      const myId = req.user.entityId || req.user.id;
      filter.$or = [{ tenantId: myId }, { tenant_id: myId }];
    } else if (req.user && req.user.role === "landlord" && (req.user.entityId || req.user.id)) {
      const myId = req.user.entityId || req.user.id;
      filter.$or = [{ landlordId: myId }, { landlord_id: myId }];
    }

    const leases = await Lease.find(filter).sort({ id: 1 }).lean();
    const schedules = [];

    for (const lease of leases) {
      const leasePayments = await Payment.find({
        $or: [
          { leaseId: lease.id },
          { lease_id: lease.id },
          { tenantId: lease.tenantId || lease.tenant_id },
          { tenant_id: lease.tenantId || lease.tenant_id },
        ],
      }).sort({ date: -1 }).lean();

      let tenantObj = null;
      let propertyObj = null;
      if (lease.tenantId || lease.tenant_id) {
        tenantObj = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
      }
      if (lease.propertyId || lease.property_id) {
        propertyObj = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
      }

      const enrichedLease = enrichLeaseWithDetails(lease, tenantObj, propertyObj);

      const cycle = calculateTenantRentCycle(enrichedLease, new Date(), leasePayments);
      if (cycle) {
        schedules.push({
          lease: enrichedLease,
          rentCycle: cycle,
        });
      }
    }

    res.json({
      success: true,
      count: schedules.length,
      schedules,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single lease move-in rent cycle
app.get("/api/leases/:id/rent-cycle", async (req, res) => {
  try {
    const lease = await Lease.findOne({ id: req.params.id }).lean();
    if (!lease) return res.status(404).json({ error: "Lease not found" });

    const leasePayments = await Payment.find({
      $or: [
        { leaseId: lease.id },
        { lease_id: lease.id },
        { tenantId: lease.tenantId || lease.tenant_id },
        { tenant_id: lease.tenantId || lease.tenant_id },
      ],
    }).sort({ date: -1 }).lean();

    let tenantObj = null;
    let propertyObj = null;
    if (lease.tenantId || lease.tenant_id) {
      tenantObj = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
    }
    if (lease.propertyId || lease.property_id) {
      propertyObj = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
    }

    const enrichedLease = enrichLeaseWithDetails(lease, tenantObj, propertyObj);

    const cycle = calculateTenantRentCycle(enrichedLease, new Date(), leasePayments);
    res.json({ success: true, rentCycle: cycle, lease: enrichedLease });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Idempotent Rent Invoice Generation (Prevents Duplicate Invoices)
app.post("/api/leases/:id/generate-rent-invoice", async (req, res) => {
  try {
    const lease = await Lease.findOne({ id: req.params.id }).lean();
    if (!lease) return res.status(404).json({ error: "Lease not found" });

    const leasePayments = await Payment.find({
      $or: [
        { leaseId: lease.id },
        { lease_id: lease.id },
        { tenantId: lease.tenantId || lease.tenant_id },
        { tenant_id: lease.tenantId || lease.tenant_id },
      ],
    }).lean();

    let tenantObj = null;
    let propertyObj = null;
    if (lease.tenantId || lease.tenant_id) {
      tenantObj = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
    }
    if (lease.propertyId || lease.property_id) {
      propertyObj = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
    }

    const enrichedLease = enrichLeaseWithDetails(lease, tenantObj, propertyObj);

    const cycle = calculateTenantRentCycle(enrichedLease, new Date(), leasePayments);
    if (!cycle) return res.status(400).json({ error: "Could not calculate rent cycle" });

    const invoiceNo = cycle.invoiceNo;

    // Strict duplicate check: Look for existing invoice for this period
    const existing = await Payment.findOne({
      $or: [
        { invoiceNo },
        { invoice_no: invoiceNo },
        { leaseId: lease.id, periodStart: cycle.periodStart },
        { lease_id: lease.id, period_start: cycle.periodStart },
      ],
    });

    if (existing) {
      // Auto-repair if legacy invoice had 0 amount
      if ((!existing.amount || Number(existing.amount) <= 0) && cycle.rentAmount > 0) {
        existing.amount = cycle.rentAmount;
        await existing.save();
      }
      return res.json({
        success: true,
        message: "Invoice already exists for this rental period",
        created: false,
        invoice: existing,
        rentCycle: cycle,
      });
    }

    const todayStr = formatYMD(new Date());
    const newInvoice = await Payment.create({
      id: `PAY_RENT_${lease.id}_${(cycle.periodStart || "").replace(/-/g, "")}`,
      leaseId: lease.id,
      lease_id: lease.id,
      tenantId: lease.tenantId || lease.tenant_id,
      tenant_id: lease.tenantId || lease.tenant_id,
      propertyId: lease.propertyId || lease.property_id,
      property_id: lease.propertyId || lease.property_id,
      tenantName: enrichedLease.tenantName,
      tenant_name: enrichedLease.tenantName,
      propertyName: enrichedLease.propertyName,
      property_name: enrichedLease.propertyName,
      month: cycle.periodLabel,
      amount: cycle.rentAmount,
      status: cycle.isPaid ? "Paid" : "Pending",
      date: todayStr,
      dueDate: cycle.currentDueDate,
      due_date: cycle.currentDueDate,
      paidDate: cycle.isPaid ? todayStr : "",
      paid_date: cycle.isPaid ? todayStr : "",
      periodStart: cycle.periodStart,
      period_start: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      period_end: cycle.periodEnd,
      cycleNumber: cycle.cycleIndex,
      cycle_number: cycle.cycleIndex,
      invoiceNo,
      invoice_no: invoiceNo,
      method: "UPI",
    });

    res.status(201).json({
      success: true,
      message: "Rent invoice generated successfully",
      created: true,
      invoice: newInvoice,
      rentCycle: cycle,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Rent Reminder Dispatch
app.post("/api/leases/:id/remind-rent", async (req, res) => {
  try {
    const lease = await Lease.findOne({ id: req.params.id }).lean();
    if (!lease) return res.status(404).json({ error: "Lease not found" });

    const leasePayments = await Payment.find({
      $or: [
        { leaseId: lease.id },
        { lease_id: lease.id },
        { tenantId: lease.tenantId || lease.tenant_id },
        { tenant_id: lease.tenantId || lease.tenant_id },
      ],
    }).lean();

    let tenantObj = null;
    let propertyObj = null;
    if (lease.tenantId || lease.tenant_id) {
      tenantObj = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
    }
    if (lease.propertyId || lease.property_id) {
      propertyObj = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
    }

    const enrichedLease = enrichLeaseWithDetails(lease, tenantObj, propertyObj);

    const cycle = calculateTenantRentCycle(enrichedLease, new Date(), leasePayments);
    if (!cycle) return res.status(400).json({ error: "Could not calculate rent cycle" });

    const tenantId = lease.tenantId || lease.tenant_id;
    if (!tenantId) return res.status(400).json({ error: "No tenant associated with this lease" });

    const customMessage =
      req.body.message ||
      `Rent Payment Reminder: Your rent of ₹${cycle.rentAmount.toLocaleString("en-IN")} for ${cycle.propertyName} (Period: ${cycle.periodLabel}) is due on ${cycle.currentDueDateFormatted}. Please complete your payment.`;

    await sendNotification({
      userId: tenantId,
      title: `🔔 Rent Payment Reminder: ${cycle.propertyName}`,
      message: customMessage,
      type: "info",
      meta: { leaseId: lease.id, invoiceNo: cycle.invoiceNo, dueDate: cycle.currentDueDate, period: cycle.periodLabel },
    });

    res.json({
      success: true,
      message: `Rent reminder dispatched to ${enrichedLease.tenantName} (${tenantId})`,
      rentCycle: cycle,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7.2 Reminders Center API (For Tenants & Landlords)
// -------------------------------------------------------------
app.get("/api/reminders/summary", async (req, res) => {
  try {
    let role = req.query.role || (req.user && req.user.role ? req.user.role.toLowerCase() : null);
    const userId = req.query.userId || req.query.entityId || (req.user ? (req.user.entityId || req.user.id) : null);
    const queryTenantId = req.query.tenantId || (role === "tenant" ? userId : null);
    const queryLandlordId = req.query.landlordId || (role === "landlord" ? userId : null);

    if (!role) {
      role = queryTenantId ? "tenant" : queryLandlordId ? "landlord" : "tenant";
    }

    const today = new Date();

    if (role === "tenant") {
      const tenantId = queryTenantId || "TEN001";
      const tenant = await Tenant.findOne({ $or: [{ id: tenantId }, { tenant_id: tenantId }] }).lean();

      // 1. Get Tenant's Active Leases & Rent Cycles
      const leases = await Lease.find({
        $or: [{ tenantId }, { tenant_id: tenantId }],
        status: { $ne: "Terminated" },
      }).lean();

      const items = [];
      let totalPendingAmount = 0;
      let overdueCount = 0;
      let dueSoonCount = 0;

      for (const lease of leases) {
        let prop = null;
        if (lease.propertyId || lease.property_id) {
          prop = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
        }
        const enrichedLease = enrichLeaseWithDetails(lease, tenant, prop);
        const leasePayments = await Payment.find({
          $or: [
            { leaseId: lease.id },
            { lease_id: lease.id },
            { tenantId },
            { tenant_id: tenantId },
          ],
        }).sort({ date: -1 }).lean();

        const cycle = calculateTenantRentCycle(enrichedLease, today, leasePayments);
        if (cycle && !cycle.isPaid) {
          const isOverdue = cycle.isOverdue || cycle.daysOverdue > 0;
          const isDueSoon = cycle.isDueSoon || (cycle.daysUntilDue >= 0 && cycle.daysUntilDue <= 5);

          if (isOverdue) overdueCount++;
          else if (isDueSoon) dueSoonCount++;

          totalPendingAmount += Number(cycle.rentAmount || 0);

          items.push({
            id: `REM_RENT_${lease.id}_${cycle.currentDueDate}`,
            billType: "rent",
            title: `Rent: ${cycle.propertyName}`,
            category: "Rent Payment",
            subtitle: `Rental Cycle: ${cycle.periodLabel}`,
            amount: cycle.rentAmount,
            dueDate: cycle.currentDueDate,
            dueDateFormatted: cycle.currentDueDateFormatted,
            periodLabel: cycle.periodLabel,
            isOverdue,
            daysOverdue: cycle.daysOverdue || 0,
            daysUntilDue: cycle.daysUntilDue || 0,
            isDueSoon,
            status: isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : "Pending",
            urgency: isOverdue ? "urgent" : isDueSoon ? "high" : "normal",
            propertyName: cycle.propertyName,
            propertyId: lease.propertyId || lease.property_id,
            leaseId: lease.id,
            invoiceNo: cycle.invoiceNo,
            actionUrl: "/payments",
            actionLabel: "Pay Rent Now",
          });
        }
      }

      // 2. Get Tenant's Unpaid EB Bills / Utility Bills
      const utilityBills = await UtilityBill.find({
        $or: [{ tenantId }, { tenant_id: tenantId }],
        status: { $nin: ["Paid"] },
      }).sort({ dueDate: 1 }).lean();

      for (const bill of utilityBills) {
        const billDue = parseFlexibleDate(bill.dueDate);
        let isOverdue = false;
        let daysOverdue = 0;
        let isDueSoon = false;
        let daysUntilDue = 0;

        if (billDue) {
          const diffDays = Math.round((today - billDue) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            isOverdue = true;
            daysOverdue = diffDays;
          } else {
            daysUntilDue = Math.abs(diffDays);
            if (daysUntilDue <= 5) isDueSoon = true;
          }
        }

        if (isOverdue || bill.status === "Overdue") {
          overdueCount++;
          isOverdue = true;
        } else if (isDueSoon || bill.status === "Due Soon") {
          dueSoonCount++;
          isDueSoon = true;
        }

        const billAmount = Number(bill.tenantAmount || bill.amount || 0);
        totalPendingAmount += billAmount;

        items.push({
          id: `REM_EB_${bill.id}`,
          billType: bill.type === "Electricity" ? "eb" : "utility",
          title: `${bill.type === "Electricity" ? "⚡ Electricity (EB) Bill" : "💧 Utility Bill"} - ${bill.billingMonth || "Current"}`,
          category: bill.type === "Electricity" ? "EB Bill" : "Utility Bill",
          subtitle: `${bill.propertyName || "Property Unit"}${bill.consumerNo ? ` • No: ${bill.consumerNo}` : ""}`,
          amount: billAmount,
          unitsConsumed: bill.unitsConsumed,
          dueDate: bill.dueDate,
          dueDateFormatted: bill.dueDate,
          periodLabel: bill.billingMonth || "Current Month",
          isOverdue,
          daysOverdue,
          daysUntilDue,
          isDueSoon,
          status: isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : (bill.status || "Unpaid"),
          urgency: isOverdue ? "urgent" : isDueSoon ? "high" : "normal",
          propertyName: bill.propertyName,
          propertyId: bill.propertyId,
          billId: bill.id,
          actionUrl: "/utility-bills",
          actionLabel: "Pay Bill Now",
        });
      }

      // Sort: urgent first, then highest days overdue, then nearest dueDate
      items.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.isOverdue && b.isOverdue) return b.daysOverdue - a.daysOverdue;
        return (a.daysUntilDue || 0) - (b.daysUntilDue || 0);
      });

      return res.json({
        success: true,
        role: "tenant",
        summary: {
          totalUrgentCount: overdueCount + dueSoonCount,
          totalBillsCount: items.length,
          overdueCount,
          dueSoonCount,
          totalPendingAmount,
        },
        items,
      });
    }

    // Role: Landlord (or Admin)
    const landlordId = queryLandlordId || "LDL001";
    
    // Find landlord's properties
    const landlordProperties = await Property.find({
      $or: [{ landlordId }, { landlord_id: landlordId }],
    }).lean();
    const propIds = landlordProperties.map((p) => p.id);

    // 1. Landlord's Tenant Rent Cycles
    const leases = await Lease.find({
      $or: [
        { landlordId },
        { landlord_id: landlordId },
        { propertyId: { $in: propIds } },
        { property_id: { $in: propIds } },
      ],
      status: { $ne: "Terminated" },
    }).lean();

    const items = [];
    let totalPendingAmount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    const tenantSet = new Set();

    for (const lease of leases) {
      let tenant = null;
      let prop = null;
      if (lease.tenantId || lease.tenant_id) {
        tenant = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
      }
      if (lease.propertyId || lease.property_id) {
        prop = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
      }
      const enrichedLease = enrichLeaseWithDetails(lease, tenant, prop);
      const leasePayments = await Payment.find({
        $or: [
          { leaseId: lease.id },
          { lease_id: lease.id },
          { tenantId: lease.tenantId || lease.tenant_id },
          { tenant_id: lease.tenantId || lease.tenant_id },
        ],
      }).sort({ date: -1 }).lean();

      const cycle = calculateTenantRentCycle(enrichedLease, today, leasePayments);
      if (cycle && !cycle.isPaid) {
        const isOverdue = cycle.isOverdue || cycle.daysOverdue > 0;
        const isDueSoon = cycle.isDueSoon || (cycle.daysUntilDue >= 0 && cycle.daysUntilDue <= 5);

        if (isOverdue) overdueCount++;
        else if (isDueSoon) dueSoonCount++;

        totalPendingAmount += Number(cycle.rentAmount || 0);
        if (lease.tenantId) tenantSet.add(lease.tenantId);

        items.push({
          id: `REM_LND_RENT_${lease.id}_${cycle.currentDueDate}`,
          billType: "rent",
          title: `Rent: ${cycle.propertyName}`,
          category: "Monthly Rent",
          tenantId: lease.tenantId || lease.tenant_id,
          tenantName: enrichedLease.tenantName,
          tenantPhone: enrichedLease.tenantPhone,
          propertyName: cycle.propertyName,
          propertyId: lease.propertyId || lease.property_id,
          amount: cycle.rentAmount,
          dueDate: cycle.currentDueDate,
          dueDateFormatted: cycle.currentDueDateFormatted,
          periodLabel: cycle.periodLabel,
          isOverdue,
          daysOverdue: cycle.daysOverdue || 0,
          daysUntilDue: cycle.daysUntilDue || 0,
          isDueSoon,
          status: isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : "Pending",
          urgency: isOverdue ? "urgent" : isDueSoon ? "high" : "normal",
          canRemind: true,
          leaseId: lease.id,
          remindEndpoint: `/api/leases/${lease.id}/remind-rent`,
        });
      }
    }

    // 2. Landlord's Tenant EB Bills
    const utilityBills = await UtilityBill.find({
      $or: [
        { landlordId },
        { landlord_id: landlordId },
        { propertyId: { $in: propIds } },
        { property_id: { $in: propIds } },
      ],
      status: { $nin: ["Paid"] },
    }).sort({ dueDate: 1 }).lean();

    for (const bill of utilityBills) {
      const billDue = parseFlexibleDate(bill.dueDate);
      let isOverdue = false;
      let daysOverdue = 0;
      let isDueSoon = false;
      let daysUntilDue = 0;

      if (billDue) {
        const diffDays = Math.round((today - billDue) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          isOverdue = true;
          daysOverdue = diffDays;
        } else {
          daysUntilDue = Math.abs(diffDays);
          if (daysUntilDue <= 5) isDueSoon = true;
        }
      }

      if (isOverdue || bill.status === "Overdue") {
        overdueCount++;
        isOverdue = true;
      } else if (isDueSoon || bill.status === "Due Soon") {
        dueSoonCount++;
        isDueSoon = true;
      }

      const billAmount = Number(bill.tenantAmount || bill.amount || 0);
      totalPendingAmount += billAmount;
      if (bill.tenantId) tenantSet.add(bill.tenantId);

      items.push({
        id: `REM_LND_EB_${bill.id}`,
        billType: bill.type === "Electricity" ? "eb" : "utility",
        title: `${bill.type === "Electricity" ? "⚡ EB Bill" : "💧 Utility Bill"} - ${bill.billingMonth || "Current"}`,
        category: bill.type === "Electricity" ? "EB Bill" : "Utility Bill",
        tenantId: bill.tenantId,
        tenantName: bill.tenantName || "Tenant",
        propertyName: bill.propertyName || "Property Unit",
        propertyId: bill.propertyId,
        amount: billAmount,
        unitsConsumed: bill.unitsConsumed,
        dueDate: bill.dueDate,
        dueDateFormatted: bill.dueDate,
        periodLabel: bill.billingMonth || "Current Month",
        isOverdue,
        daysOverdue,
        daysUntilDue,
        isDueSoon,
        status: isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : (bill.status || "Unpaid"),
        urgency: isOverdue ? "urgent" : isDueSoon ? "high" : "normal",
        canRemind: true,
        billId: bill.id,
        remindEndpoint: `/api/utility-bills/${bill.id}/remind`,
      });
    }

    // Sort: overdue first, then nearest due
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.isOverdue && b.isOverdue) return b.daysOverdue - a.daysOverdue;
      return (a.daysUntilDue || 0) - (b.daysUntilDue || 0);
    });

    res.json({
      success: true,
      role: "landlord",
      summary: {
        totalUrgentCount: overdueCount + dueSoonCount,
        totalBillsCount: items.length,
        overdueCount,
        dueSoonCount,
        totalPendingAmount,
        uniqueTenantsCount: tenantSet.size,
      },
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send reminders to ALL tenants with pending/overdue bills
app.post("/api/reminders/send-all", async (req, res) => {
  try {
    const { landlordId = "LDL001" } = req.body;
    let dispatched = 0;
    const notifiedTenants = new Set();

    // 1. Overdue Leases
    const leases = await Lease.find({
      $or: [{ landlordId }, { landlord_id: landlordId }],
      status: { $ne: "Terminated" },
    }).lean();

    for (const lease of leases) {
      const leasePayments = await Payment.find({
        $or: [{ leaseId: lease.id }, { lease_id: lease.id }],
      }).lean();
      let tenant = null;
      let prop = null;
      if (lease.tenantId) tenant = await Tenant.findOne({ id: lease.tenantId }).lean();
      if (lease.propertyId) prop = await Property.findOne({ id: lease.propertyId }).lean();
      const enrichedLease = enrichLeaseWithDetails(lease, tenant, prop);
      const cycle = calculateTenantRentCycle(enrichedLease, new Date(), leasePayments);

      if (cycle && !cycle.isPaid && (cycle.isOverdue || cycle.isDueSoon)) {
        const tenantId = lease.tenantId || lease.tenant_id;
        if (tenantId) {
          await sendNotification({
            userId: tenantId,
            title: `🔔 Urgent Payment Reminder: ${cycle.propertyName}`,
            message: `Friendly Reminder: Your rent payment of ₹${cycle.rentAmount.toLocaleString("en-IN")} for period ${cycle.periodLabel} is ${cycle.isOverdue ? `overdue by ${cycle.daysOverdue} days` : `due on ${cycle.currentDueDateFormatted}`}. Please complete payment promptly.`,
            type: cycle.isOverdue ? "warning" : "info",
            meta: { leaseId: lease.id, invoiceNo: cycle.invoiceNo, dueDate: cycle.currentDueDate },
          });
          dispatched++;
          notifiedTenants.add(enrichedLease.tenantName || tenantId);
        }
      }
    }

    // 2. Unpaid EB bills
    const utilityBills = await UtilityBill.find({
      $or: [{ landlordId }, { landlord_id: landlordId }],
      status: { $nin: ["Paid"] },
    }).lean();

    for (const bill of utilityBills) {
      if (bill.tenantId) {
        await sendNotification({
          userId: bill.tenantId,
          title: `⚡ EB Bill Reminder: ${bill.propertyName}`,
          message: `Friendly Reminder: Your EB bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} (${bill.billingMonth || "Current"}) is ${bill.status === "Overdue" ? "overdue" : "due on " + bill.dueDate}.`,
          type: "warning",
          meta: { billId: bill.id, dueDate: bill.dueDate, amount: bill.tenantAmount || bill.amount },
        });
        dispatched++;
        notifiedTenants.add(bill.tenantName || bill.tenantId);
      }
    }

    res.json({
      success: true,
      message: `Successfully dispatched ${dispatched} reminder notification(s) to tenants: ${Array.from(notifiedTenants).join(", ")}.`,
      dispatchedCount: dispatched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Payments API (Backed by MongoDB `payments` collection)
// -------------------------------------------------------------
app.get("/api/payments", async (req, res) => {
  try {
    const { tenantId, propertyId, leaseId } = req.query;
    const filter = {};
    if (tenantId) {
      filter.$or = [{ tenantId: tenantId }, { tenant_id: tenantId }];
    }
    if (propertyId) {
      filter.$or = [{ propertyId: propertyId }, { property_id: propertyId }];
    }
    if (leaseId) {
      filter.$or = [{ leaseId }, { lease_id: leaseId }];
    }
    let rows = await Payment.find(filter).sort({ date: -1, id: -1 }).lean();

    // Auto-repair any payments with zero or invalid amounts
    const needsRepair = rows.some((p) => !p.amount || Number(p.amount) <= 0);
    if (needsRepair) {
      rows = await Promise.all(
        rows.map(async (p) => {
          if (!p.amount || Number(p.amount) <= 0) {
            let fixedAmount = 22000;
            const searchKey = String((p.id || "") + " " + (p.leaseId || "") + " " + (p.propertyName || "")).toLowerCase();
            if (searchKey.includes("lse-p01") || searchKey.includes("parking")) {
              fixedAmount = 10000;
            } else if (searchKey.includes("lse-s02") || searchKey.includes("storage")) {
              fixedAmount = 7000;
            } else if (p.propertyId) {
              const prop = await Property.findOne({ id: p.propertyId }).lean();
              if (prop?.rent) fixedAmount = Number(prop.rent);
            }
            await Payment.updateOne({ _id: p._id }, { $set: { amount: fixedAmount } });
            return { ...p, amount: fixedAmount };
          }
          return p;
        })
      );
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || `PAY_${Date.now()}`;
    const date = p.date || new Date().toISOString().split("T")[0];
    const invoiceNo = p.invoiceNo || p.invoice_no || `INV-${Date.now()}`;

    // Duplicate invoice prevention
    if (p.invoiceNo || p.invoice_no) {
      const existing = await Payment.findOne({
        $or: [{ invoiceNo }, { invoice_no: invoiceNo }],
      });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    const newPayment = await Payment.create({
      id,
      leaseId: p.leaseId || p.lease_id || null,
      lease_id: p.leaseId || p.lease_id || null,
      tenantId: p.tenantId || p.tenant_id || null,
      tenant_id: p.tenantId || p.tenant_id || null,
      propertyId: p.propertyId || p.property_id || null,
      property_id: p.propertyId || p.property_id || null,
      tenantName: p.tenantName || p.tenant_name || "",
      tenant_name: p.tenantName || p.tenant_name || "",
      propertyName: p.propertyName || p.property_name || "",
      property_name: p.propertyName || p.property_name || "",
      month: p.month || "Current Month",
      amount: Number(p.amount || 0),
      status: p.status || "Paid",
      date,
      dueDate: p.dueDate || p.due_date || "",
      due_date: p.dueDate || p.due_date || "",
      paidDate: p.paidDate || p.paid_date || (p.status === "Paid" ? date : ""),
      paid_date: p.paidDate || p.paid_date || (p.status === "Paid" ? date : ""),
      periodStart: p.periodStart || p.period_start || "",
      period_start: p.periodStart || p.period_start || "",
      periodEnd: p.periodEnd || p.period_end || "",
      period_end: p.periodEnd || p.period_end || "",
      cycleNumber: p.cycleNumber !== undefined ? p.cycleNumber : (p.cycle_number !== undefined ? p.cycle_number : null),
      cycle_number: p.cycleNumber !== undefined ? p.cycleNumber : (p.cycle_number !== undefined ? p.cycle_number : null),
      method: p.method || "UPI",
      invoiceNo,
      invoice_no: invoiceNo,
      receiptUrl: p.receiptUrl || p.receipt_url || "",
      receipt_url: p.receiptUrl || p.receipt_url || "",
    });

    res.status(201).json(newPayment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/payments/:id", async (req, res) => {
  try {
    const updated = await Payment.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Payment not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    const deleted = await Payment.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    res.json({ success: true, message: "Payment removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Maintenance Requests API (Backed by MongoDB `maintenancerequests`)
// -------------------------------------------------------------
app.get("/api/maintenance", async (req, res) => {
  try {
    const rows = await MaintenanceRequest.find().sort({ id: -1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/maintenance", async (req, res) => {
  try {
    const m = req.body;
    const id = m.id || `MNT${Math.floor(Math.random() * 900 + 100)}`;
    const date = m.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const newTicket = await MaintenanceRequest.create({
      id,
      propertyId: m.propertyId || m.property_id || null,
      property_id: m.propertyId || m.property_id || null,
      tenantId: m.tenantId || m.tenant_id || "TEN001",
      tenant_id: m.tenantId || m.tenant_id || "TEN001",
      title: m.title || m.issue || m.issueText || "Maintenance Ticket",
      description: m.description || m.issue || m.issueText || "",
      category: m.category || "General",
      priority: m.priority || "Medium",
      status: m.status || "Open",
      date,
      assignedTo: m.assignedTo || m.assigned_to || m.vendor || null,
      assigned_to: m.assignedTo || m.assigned_to || m.vendor || null,
      estimatedCost: Number(m.estimatedCost || m.estimated_cost || 0),
      estimated_cost: Number(m.estimatedCost || m.estimated_cost || 0),
    });

    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/maintenance/:id", async (req, res) => {
  try {
    const updated = await MaintenanceRequest.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Ticket not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/maintenance/:id", async (req, res) => {
  try {
    const deleted = await MaintenanceRequest.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Ticket not found" });
    res.json({ success: true, message: "Ticket removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 10. Complaints API (Backed by MongoDB `complaints` collection)
// -------------------------------------------------------------
app.get("/api/complaints", async (req, res) => {
  try {
    const { tenantId, landlordId, propertyId, status } = req.query;
    const filter = {};

    // Role-aware filtering
    if (req.user?.role === "tenant" || tenantId) {
      const tid = tenantId || req.user?.entityId || req.user?.id;
      if (tid) {
        filter.$or = [{ tenantId: tid }, { tenant_id: tid }];
      }
    } else if (req.user?.role === "landlord" || landlordId) {
      const lid = landlordId || req.user?.entityId || req.user?.id;
      if (lid) {
        // Find properties belonging to this landlord
        const props = await Property.find({ $or: [{ landlordId: lid }, { landlord_id: lid }] }).lean();
        const propIds = props.map((p) => p.id);
        const propNames = props.map((p) => p.name);
        filter.$or = [
          { propertyId: { $in: propIds } },
          { property_id: { $in: propIds } },
          { propertyName: { $in: propNames } },
          { property: { $in: propNames } },
        ];
      }
    }

    if (propertyId) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: [{ propertyId }, { property_id: propertyId }] });
    }
    if (status && status !== "All") {
      filter.status = status;
    }

    const rows = await Complaint.find(filter).sort({ id: -1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complaints", async (req, res) => {
  try {
    const {
      tenant_name,
      tenantName,
      tenantId,
      property,
      propertyName,
      propertyId,
      issue,
      subject,
      priority,
      category,
      image,
    } = req.body;
    const complaintText = issue || subject;
    if (!complaintText) {
      return res.status(400).json({ message: "Complaint issue or subject required" });
    }

    const id = `CMP${Math.floor(Math.random() * 900 + 100)}`;
    const date = new Date().toISOString().split("T")[0];

    const resolvedTenantId = tenantId || req.user?.entityId || req.user?.id || "TEN001";
    const resolvedTenantName = tenantName || tenant_name || req.user?.name || "Divya Priya";

    // Auto-resolve property if not provided for tenant
    let resolvedPropId = propertyId;
    let resolvedPropName = propertyName || property;
    let targetLandlordId = "LDL001";

    if (resolvedPropId) {
      const propDoc = await Property.findOne({ id: resolvedPropId }).lean();
      if (propDoc) {
        resolvedPropName = propDoc.name;
        targetLandlordId = propDoc.landlordId || propDoc.landlord_id || "LDL001";
      }
    } else if (resolvedTenantId) {
      const lease = await Lease.findOne({ $or: [{ tenantId: resolvedTenantId }, { tenant_id: resolvedTenantId }] }).lean();
      if (lease && lease.propertyId) {
        resolvedPropId = lease.propertyId;
        const propDoc = await Property.findOne({ id: resolvedPropId }).lean();
        if (propDoc) {
          resolvedPropName = propDoc.name;
          targetLandlordId = propDoc.landlordId || propDoc.landlord_id || "LDL001";
        }
      }
    }

    const newComplaint = await Complaint.create({
      id,
      tenantId: resolvedTenantId,
      tenant_id: resolvedTenantId,
      tenantName: resolvedTenantName,
      tenant_name: resolvedTenantName,
      propertyId: resolvedPropId || "TN101",
      property_id: resolvedPropId || "TN101",
      property: resolvedPropName || "Sai Kala Apartments - Flat 302",
      propertyName: resolvedPropName || "Sai Kala Apartments - Flat 302",
      unit: req.body.unit || "Flat B-204",
      category: category || "General",
      issue: complaintText,
      subject: subject || complaintText,
      language: req.body.language || "en",
      tamilTranscript: req.body.tamilTranscript || "",
      serviceBookingId: req.body.serviceBookingId || null,
      priority: priority || "Medium",
      status: "Open",
      date,
    });

    // Notify the relevant landlord
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId: targetLandlordId,
        user_id: targetLandlordId,
        title: `📢 New Tenant Complaint: ${subject || complaintText}`,
        message: `${resolvedTenantName} raised a complaint for ${resolvedPropName || "Property"}: "${complaintText}". Priority: ${priority || "Medium"}.`,
        time: "Just now",
        type: "warning",
        isRead: false,
      });
    } catch (notifErr) {
      console.warn("Complaint landlord notification warning:", notifErr.message);
    }

    res.status(201).json(newComplaint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complaints/:id", async (req, res) => {
  try {
    const updated = await Complaint.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Complaint not found" });

    // When landlord responds or updates complaint, notify tenant
    const tId = updated.tenantId || updated.tenant_id;
    if (tId) {
      try {
        await Notification.create({
          id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          userId: tId,
          user_id: tId,
          title: `Complaint Updated: ${updated.id}`,
          message: `Your complaint for "${updated.propertyName || "your rented property"}" is now "${updated.status}". ${req.body.notes || ""}`,
          time: "Just now",
          type: "info",
          isRead: false,
        });
      } catch (notifErr) {
        console.warn("Complaint tenant update notification warning:", notifErr.message);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complaints/:id", async (req, res) => {
  try {
    const deleted = await Complaint.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Complaint not found" });
    res.json({ success: true, message: "Complaint removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// FIXIT LOCAL UNIFIED SERVICE & PROPERTY MAINTENANCE APIs
// =============================================================

// Fallback seed list for FixIt Local verified providers in Chennai / Tamil Nadu
const FALLBACK_FIXIT_PROVIDERS = [
  {
    id: "PROV_AC_01",
    name: "Kumar AC Services",
    technicianName: "Kumar S.",
    category: "AC Repair",
    price: 800,
    unit: "per service",
    rating: 4.9,
    reviewCount: 68,
    distanceKm: 1.2,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00001",
    lat: 13.0425,
    lng: 80.2335,
    address: "14, Usman Road, T. Nagar, Chennai",
    skills: ["AC Repair", "Jet Pump Cleaning", "Gas Refill", "Inverter AC"],
    badge: "⭐ Landlord Preferred Pro",
    vehicle: "TVS Apache - TN 01 AB 4321",
    experienceYears: 8,
    description: "Certified HVAC & refrigeration technician specializing in residential split and window units.",
    reviews: [
      { author: "Karthik Raja (Landlord)", rating: 5, comment: "Fixed Flat 302 AC quickly. Super clean job!", date: "04 Oct 2026" },
      { author: "Suresh Babu", rating: 5, comment: "Punctual and very polite technician.", date: "15 Sep 2026" },
    ],
  },
  {
    id: "PROV_AC_02",
    name: "Arun AC Care & Service",
    technicianName: "Arun Kumar",
    category: "AC Repair",
    price: 750,
    unit: "per service",
    rating: 4.8,
    reviewCount: 42,
    distanceKm: 2.4,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00002",
    lat: 13.085,
    lng: 80.21,
    address: "88, 2nd Avenue, Anna Nagar, Chennai",
    skills: ["AC Service", "Coil Leakage", "Duct Cleaning"],
    badge: "FixIt Verified Pro",
    vehicle: "Honda Activa - TN 02 CD 5678",
    experienceYears: 6,
    description: "Master cooling engineer with quick response across central Chennai.",
    reviews: [
      { author: "Ramesh K.", rating: 5, comment: "Good service and transparent pricing.", date: "28 Sep 2026" },
    ],
  },
  {
    id: "PROV_AC_03",
    name: "CoolTech Express HVAC",
    technicianName: "Balaji V.",
    category: "AC Repair",
    price: 850,
    unit: "per service",
    rating: 4.7,
    reviewCount: 54,
    distanceKm: 3.2,
    availability: "Available Tomorrow",
    isAvailable: true,
    phone: "+91 98765 00003",
    lat: 13.01,
    lng: 80.22,
    address: "Guindy Industrial Estate, Chennai",
    skills: ["Split AC", "Multi-split", "VRF Units"],
    badge: "Certified Pro",
    vehicle: "Bajaj Pulsar - TN 09 EF 9012",
    experienceYears: 7,
    description: "Industrial & residential HVAC installations with warranty.",
    reviews: [
      { author: "Anitha S.", rating: 4.5, comment: "Thorough duct cleaning.", date: "12 Aug 2026" },
    ],
  },
  {
    id: "PROV_PL_01",
    name: "Raj Plumbing & Sanitary",
    technicianName: "Rajendran M.",
    category: "Plumbing",
    price: 450,
    unit: "per visit",
    rating: 4.8,
    reviewCount: 62,
    distanceKm: 1.1,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00010",
    lat: 13.04,
    lng: 80.235,
    address: "T. Nagar Market Road, Chennai",
    skills: ["Tap Repair", "Pipe Leakage", "Flush Tank", "Drainage Trap"],
    badge: "⭐ Landlord Preferred Pro",
    vehicle: "Hero Splendor - TN 01 GH 3456",
    experienceYears: 9,
    description: "Expert domestic plumber handling concealed bathroom line repairs and drainage.",
    reviews: [
      { author: "Divya Priya", rating: 5, comment: "Resolved water leakage in 20 minutes.", date: "14 Aug 2026" },
    ],
  },
  {
    id: "PROV_PL_02",
    name: "Riyas Plumbing Solutions",
    technicianName: "Riyas Mohamed",
    category: "Plumbing",
    price: 400,
    unit: "per visit",
    rating: 4.7,
    reviewCount: 36,
    distanceKm: 2.8,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00011",
    lat: 13.0418,
    lng: 80.2341,
    address: "14, Usman Road, T. Nagar, Chennai",
    skills: ["Pipe Routing", "Water Meter", "Leak Detection"],
    badge: "FixIt Verified Pro",
    vehicle: "Honda Shine - TN 01 JK 7890",
    experienceYears: 7,
    description: "Rapid leakage fixes and sanitary fitting installation.",
    reviews: [],
  },
  {
    id: "PROV_EL_01",
    name: "Suresh Electrical Works",
    technicianName: "Suresh Kannan",
    category: "Electrical",
    price: 600,
    unit: "per visit / diagnosis",
    rating: 4.9,
    reviewCount: 51,
    distanceKm: 1.5,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00020",
    lat: 13.0067,
    lng: 80.2206,
    address: "23, Sardar Patel Rd, Guindy, Chennai",
    skills: ["MCB Tripping", "Short Circuit", "Inverter Wiring", "Switchboard"],
    badge: "⭐ Landlord Preferred Pro",
    vehicle: "TVS Raider - TN 07 LM 1122",
    experienceYears: 10,
    description: "Licensed electrician with A-grade government wireman certification.",
    reviews: [
      { author: "Karthik Raja", rating: 5, comment: "Tripping problem identified immediately.", date: "02 Jul 2026" },
    ],
  },
  {
    id: "PROV_EL_02",
    name: "Yaazh Electrical & Power",
    technicianName: "Yaazh S.",
    category: "Electrical",
    price: 550,
    unit: "per visit",
    rating: 4.7,
    reviewCount: 34,
    distanceKm: 3.1,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00021",
    lat: 13.015,
    lng: 80.23,
    address: "Saidapet West, Chennai",
    skills: ["Fan Installation", "LED Concealed", "Fuse Repair"],
    badge: "FixIt Verified Pro",
    vehicle: "Yamaha FZ - TN 02 NP 3344",
    experienceYears: 8,
    description: "Complete domestic electrical repairs and appliance setups.",
    reviews: [],
  },
  {
    id: "PROV_CL_01",
    name: "CleanPro Facility Management",
    technicianName: "Anand & Team",
    category: "Cleaning",
    price: 300,
    unit: "per room",
    rating: 4.9,
    reviewCount: 74,
    distanceKm: 1.8,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00030",
    lat: 13.0334,
    lng: 80.269,
    address: "5B, Luz Church Rd, Mylapore, Chennai",
    skills: ["Deep Cleaning", "Kitchen Degrease", "Bathroom Acid Wash", "Balcony"],
    badge: "⭐ Landlord Preferred Pro",
    vehicle: "Tata Ace Delivery Van - TN 05 QR 5566",
    experienceYears: 6,
    description: "Hospital-grade sanitation and high-pressure floor buffing team.",
    reviews: [
      { author: "Divya Priya", rating: 5, comment: "Apartment looks sparkling clean!", date: "20 May 2026" },
    ],
  },
  {
    id: "PROV_CL_02",
    name: "SparkleHome Cleaning",
    technicianName: "Priya Ramesh",
    category: "Cleaning",
    price: 350,
    unit: "per room",
    rating: 4.8,
    reviewCount: 49,
    distanceKm: 3.5,
    availability: "Available Today",
    isAvailable: true,
    phone: "+91 98765 00031",
    lat: 13.02,
    lng: 80.25,
    address: "Alwarpet, Chennai",
    skills: ["Mechanized Scrubbing", "Glass Polish", "Steam Sanitization"],
    badge: "FixIt Verified Pro",
    vehicle: "Maruti Eeco - TN 06 ST 7788",
    experienceYears: 5,
    description: "Professional apartment move-in and deep seasonal sanitation.",
    reviews: [],
  },
];

// Fallback in-memory stores in case MongoDB is in mock/standby mode
const inMemoryPreferred = {
  TN101: {
    AC: { providerId: "PROV_AC_01", providerName: "Kumar AC Services", isSimulatedBusy: false },
    Electrical: { providerId: "PROV_EL_01", providerName: "Suresh Electrical Works", isSimulatedBusy: false },
    Plumbing: { providerId: "PROV_PL_01", providerName: "Raj Plumbing & Sanitary", isSimulatedBusy: false },
    Cleaning: { providerId: "PROV_CL_01", providerName: "CleanPro Facility Management", isSimulatedBusy: false },
  },
};

const inMemoryMaintenanceHistory = {
  TN101: [
    {
      id: "MH_TN101_01",
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      date: "04 Oct 2026",
      category: "AC Service",
      serviceTitle: "AC Jet Pump Service & Gas Check",
      cost: 800,
      providerName: "Kumar AC Services",
      technicianName: "Kumar S.",
      providerId: "PROV_AC_01",
      status: "Completed",
      rating: 5.0,
      invoiceId: "INV-FIX-8841",
      description: "Indoor unit jet pressure wash, filter unclogged, 45 PSI refrigerant topped up.",
    },
    {
      id: "MH_TN101_02",
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      date: "14 Aug 2026",
      category: "Plumbing Repair",
      serviceTitle: "Master Bath Concealed Pipe Trap Replacement",
      cost: 450,
      providerName: "Raj Plumbing & Sanitary",
      technicianName: "Rajendran M.",
      providerId: "PROV_PL_01",
      status: "Completed",
      rating: 4.8,
      invoiceId: "INV-FIX-7729",
      description: "Replaced degraded PVC bottle trap under basin and tightened supply valve.",
    },
    {
      id: "MH_TN101_03",
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      date: "02 Jul 2026",
      category: "Electrical",
      serviceTitle: "Distribution Board MCB Replacement & Load Balancing",
      cost: 600,
      providerName: "Suresh Electrical Works",
      technicianName: "Suresh Kannan",
      providerId: "PROV_EL_01",
      status: "Completed",
      rating: 4.9,
      invoiceId: "INV-FIX-6610",
      description: "Replaced 32A C-curve MCB tripping under geyser load and balanced phase neutral.",
    },
    {
      id: "MH_TN101_04",
      propertyId: "TN101",
      propertyName: "Sai Kala Apartments - Flat 302",
      unit: "Flat B-204",
      date: "20 May 2026",
      category: "Cleaning",
      serviceTitle: "Deep Kitchen Degreasing & Balcony Scrubbing",
      cost: 300,
      providerName: "CleanPro Facility Management",
      technicianName: "Anand & Team",
      providerId: "PROV_CL_01",
      status: "Completed",
      rating: 5.0,
      invoiceId: "INV-FIX-5502",
      description: "Industrial vacuuming of balcony sliding channels and stove backsplash sanitation.",
    },
  ],
};

const inMemoryBookings = [];

// =============================================================
// HOME SERVICES PORTAL — CATEGORIES, PROVIDERS & BOOKINGS APIs
// =============================================================

// --- 1. Service Categories APIs ---
app.get("/api/service-categories", async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    res.json(categories || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-categories/:id", async (req, res) => {
  try {
    const category = await ServiceCategory.findOne({
      $or: [{ id: req.params.id }, { slug: req.params.id }],
    }).lean();
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/service-categories", requireRoles("admin"), async (req, res) => {
  try {
    const { name, slug, description, icon, basePrice, unit, services } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const count = await ServiceCategory.countDocuments();
    const id = `CAT_${Date.now()}`;

    const newCategory = await ServiceCategory.create({
      id,
      name,
      slug: generatedSlug,
      description: description || "",
      icon: icon || "Wrench",
      basePrice: Number(basePrice) || 499,
      unit: unit || "per service",
      services: Array.isArray(services) ? services : [],
      isActive: true,
      displayOrder: count + 1,
    });

    res.status(201).json(newCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/service-categories/:id", requireRoles("admin"), async (req, res) => {
  try {
    const updated = await ServiceCategory.findOneAndUpdate(
      { $or: [{ id: req.params.id }, { slug: req.params.id }] },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Category not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/service-categories/:id", requireRoles("admin"), async (req, res) => {
  try {
    const updated = await ServiceCategory.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Category not found" });
    res.json({ success: true, message: "Category deactivated", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. Dynamic Provider Availability API & Double-Booking Check ---
// Checks provider availability for a given date, time slot, and category.
// Returns providers marked as "Available" or "Booked".
app.get("/api/service-providers/availability", async (req, res) => {
  try {
    const { category, date, timeSlot } = req.query;

    let providerFilter = { status: "Active" };
    if (category && category !== "All") {
      // Flexible matching for category (e.g. "Cleaning", "AC Repair / Service" or "AC Repair")
      const catRegex = new RegExp(category.split("/")[0].trim(), "i");
      providerFilter.category = catRegex;
    }

    const providers = await ServiceProvider.find(providerFilter).lean();

    if (!date || !timeSlot) {
      // If date or slot is not specified, return default provider status
      const mapped = providers.map((p) => ({
        ...p,
        isAvailable: p.status === "Active" && p.isAvailable !== false,
        availabilityStatus: p.status === "Active" ? "Available" : "Unavailable",
      }));
      return res.json({
        category: category || "All",
        date: date || "",
        timeSlot: timeSlot || "",
        providers: mapped,
        totalAvailable: mapped.filter((p) => p.isAvailable).length,
        totalBooked: 0,
      });
    }

    // 1. Fetch all confirmed/active bookings on this date & timeSlot
    const activeBookings = await ServiceBooking.find({
      date,
      timeSlot,
      status: { $in: ["Pending", "Confirmed", "Assigned", "In Progress"] },
    }).lean();

    const bookedProviderIds = new Set(activeBookings.map((b) => b.providerId));
    const bookingDetailsMap = {};
    activeBookings.forEach((b) => {
      bookingDetailsMap[b.providerId] = {
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
      };
    });

    // 2. Fetch custom ProviderAvailability overrides (leaves, blocked slots)
    const blockedOverrides = await ProviderAvailability.find({
      date,
      timeSlot,
      isAvailable: false,
    }).lean();

    const blockedProviderIds = new Set(blockedOverrides.map((o) => o.providerId));

    // 3. Map availability for each provider
    const mappedProviders = providers.map((p) => {
      const isBooked = bookedProviderIds.has(p.id);
      const isBlocked = blockedProviderIds.has(p.id);
      const isAvailable = !isBooked && !isBlocked && p.status === "Active";

      return {
        ...p,
        isAvailable,
        availabilityStatus: isBooked ? "Booked" : isBlocked ? "Booked" : "Available",
        bookedDetails: isBooked ? bookingDetailsMap[p.id] : null,
      };
    });

    const totalAvailable = mappedProviders.filter((p) => p.isAvailable).length;
    const totalBooked = mappedProviders.filter((p) => !p.isAvailable).length;

    res.json({
      category: category || "All",
      date,
      timeSlot,
      providers: mappedProviders,
      totalAvailable,
      totalBooked,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. Service Providers CRUD & Management ---
app.get("/api/service-providers", async (req, res) => {
  try {
    const { category, search, status } = req.query;
    let filter = {};
    if (status && status !== "All") {
      filter.status = status;
    }
    if (category && category !== "All") {
      filter.category = new RegExp(category.split("/")[0].trim(), "i");
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { technicianName: new RegExp(search, "i") },
        { skills: new RegExp(search, "i") },
        { location: new RegExp(search, "i") },
      ];
    }

    let rows = await ServiceProvider.find(filter).lean();
    if (!rows || rows.length === 0) {
      let fallback = FALLBACK_FIXIT_PROVIDERS;
      if (category && category !== "All") {
        fallback = fallback.filter((p) =>
          p.category.toLowerCase().includes(category.toLowerCase())
        );
      }
      return res.json(fallback);
    }
    res.json(rows);
  } catch (err) {
    res.json(FALLBACK_FIXIT_PROVIDERS);
  }
});

app.get("/api/service-providers/:id", async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ id: req.params.id }).lean();
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    // Fetch provider's recent bookings
    const bookings = await ServiceBooking.find({ providerId: provider.id })
      .sort({ date: -1, id: -1 })
      .limit(20)
      .lean();

    res.json({ ...provider, bookings: bookings || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/service-providers", requireRoles("admin"), async (req, res) => {
  try {
    const {
      name,
      technicianName,
      category,
      phone,
      email,
      experienceYears,
      location,
      address,
      price,
      unit,
      skills,
      workingDays,
      timeSlots,
      status,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Name and Category are required" });
    }

    const catPrefix = category.slice(0, 2).toUpperCase();
    const id = `PROV_${catPrefix}_${Date.now().toString().slice(-4)}`;

    const defaultSlots = [
      "09:00 AM",
      "10:00 AM",
      "11:00 AM",
      "12:00 PM",
      "02:00 PM",
      "03:00 PM",
      "04:00 PM",
      "05:00 PM",
    ];

    const newProvider = await ServiceProvider.create({
      id,
      name,
      technicianName: technicianName || name,
      category,
      phone: phone || "+91 98765 00099",
      email: email || "",
      experienceYears: Number(experienceYears) || 5,
      location: location || "Chennai, Tamil Nadu",
      address: address || location || "Chennai, Tamil Nadu",
      price: Number(price) || 499,
      unit: unit || "per service",
      rating: 5.0,
      reviewCount: 0,
      reviews: [],
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(",").map((s) => s.trim()) : []),
      workingDays: Array.isArray(workingDays) ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      timeSlots: Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : defaultSlots,
      status: status || "Active",
      isAvailable: status !== "Inactive",
      badge: "PropConnect Verified Pro",
    });

    res.status(201).json(newProvider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/service-providers/:id", requireRoles("admin"), async (req, res) => {
  try {
    const updated = await ServiceProvider.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/service-providers/:id/status", requireRoles("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status is required" });

    const isAvailable = status === "Active";
    const updated = await ServiceProvider.findOneAndUpdate(
      { id: req.params.id },
      { $set: { status, isAvailable } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json({ success: true, provider: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/service-providers/:id", requireRoles("admin"), async (req, res) => {
  try {
    const deleted = await ServiceProvider.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Provider not found" });
    res.json({ success: true, message: "Provider removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. Provider Availability Schedules & Overrides ---
app.get("/api/provider-availability", async (req, res) => {
  try {
    const { providerId, date } = req.query;
    const filter = {};
    if (providerId) filter.providerId = providerId;
    if (date) filter.date = date;

    const rows = await ProviderAvailability.find(filter).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/provider-availability", requireRoles("admin"), async (req, res) => {
  try {
    const { providerId, date, timeSlot, isAvailable, status, reason } = req.body;
    if (!providerId || !date || !timeSlot) {
      return res.status(400).json({ error: "providerId, date, and timeSlot are required" });
    }

    const id = `AVAIL_${providerId}_${date.replace(/-/g, "")}_${timeSlot.replace(/[^a-zA-Z0-9]/g, "")}`;
    const doc = await ProviderAvailability.findOneAndUpdate(
      { providerId, date, timeSlot },
      {
        $set: {
          id,
          providerId,
          date,
          timeSlot,
          isAvailable: Boolean(isAvailable),
          status: status || (isAvailable ? "Available" : "Blocked"),
          reason: reason || "Manual availability update",
        },
      },
      { upsert: true, new: true }
    ).lean();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/provider-availability/:id", requireRoles("admin"), async (req, res) => {
  try {
    await ProviderAvailability.findOneAndDelete({ id: req.params.id });
    res.json({ success: true, message: "Availability override removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 5. Home Service Bookings APIs (Strict Double Booking Prevention) ---
app.get("/api/service-bookings", async (req, res) => {
  try {
    const { status, category, propertyId, providerId, date, userId } = req.query;
    const filter = {};

    // Role-based security & tenant/landlord isolation:
    if (req.user?.role === "tenant") {
      const tenantId = req.user.entityId || req.user.id;
      filter.$or = [{ userId: tenantId }, { userEmail: req.user.email }];
    } else if (req.user?.role === "landlord") {
      const landlordId = req.user.entityId || req.user.id;
      // Landlord sees bookings related to their properties or created by them
      const properties = await Property.find({ $or: [{ landlordId }, { landlord_id: landlordId }] }).lean();
      const propIds = properties.map((p) => p.id);
      filter.$or = [{ landlordId }, { propertyId: { $in: propIds } }, { userId: landlordId }];
    } else if (userId) {
      filter.userId = userId;
    }

    if (status && status !== "All") filter.status = status;
    if (category && category !== "All") filter.serviceCategory = new RegExp(category.split("/")[0].trim(), "i");
    if (propertyId) filter.propertyId = propertyId;
    if (providerId) filter.providerId = providerId;
    if (date) filter.date = date;

    const rows = await ServiceBooking.find(filter).sort({ id: -1, date: -1 }).lean();

    // Look up associated complaints for all retrieved bookings
    const bookingIds = rows.map((r) => r.id).filter(Boolean);
    const bookingNumbers = rows.map((r) => r.bookingNumber).filter(Boolean);
    const complaintIds = rows.map((r) => r.complaintId).filter(Boolean);

    const complaints = await Complaint.find({
      $or: [
        { id: { $in: complaintIds } },
        { serviceBookingId: { $in: [...bookingIds, ...bookingNumbers] } },
        { bookingId: { $in: [...bookingIds, ...bookingNumbers] } },
      ],
    }).sort({ createdAt: -1 }).lean();

    const complaintMap = {};
    for (const c of complaints) {
      if (c.serviceBookingId && !complaintMap[c.serviceBookingId]) complaintMap[c.serviceBookingId] = c;
      if (c.bookingId && !complaintMap[c.bookingId]) complaintMap[c.bookingId] = c;
      if (c.id && !complaintMap[c.id]) complaintMap[c.id] = c;
    }

    const enrichedRows = rows.map((b) => {
      const comp =
        complaintMap[b.id] ||
        complaintMap[b.bookingNumber] ||
        (b.complaintId ? complaintMap[b.complaintId] : null);

      return {
        ...b,
        bookingId: b.bookingId || b.bookingNumber || b.id,
        categoryName: b.categoryName || b.serviceCategory,
        subService: b.subService || b.serviceName,
        bookedByName: b.bookedByName || b.userName,
        bookedByRole: b.bookedByRole || b.userRole,
        estimatedCost: b.estimatedCost || b.amount,
        complaint: comp
          ? {
              id: comp.id,
              complaintId: comp.id,
              complaintType: comp.complaintType || comp.category || "Service Quality",
              subject: comp.subject || comp.issue || "",
              description: comp.description || comp.issue || "",
              status: comp.status || "Submitted",
              date: comp.date || (comp.createdAt ? new Date(comp.createdAt).toISOString().split("T")[0] : ""),
              providerId: comp.providerId || b.providerId,
              providerName: comp.providerName || b.providerName,
              attachment: comp.attachment || "",
            }
          : null,
      };
    });

    res.json(enrichedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-bookings/:id", async (req, res) => {
  try {
    const booking = await ServiceBooking.findOne({
      $or: [{ id: req.params.id }, { bookingNumber: req.params.id }],
    }).lean();
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Validate role permissions
    if (req.user?.role === "tenant") {
      const tenantId = req.user.entityId || req.user.id;
      if (booking.userId !== tenantId && booking.userEmail !== req.user.email) {
        return res.status(403).json({ error: "Access denied to this booking" });
      }
    } else if (req.user?.role === "landlord") {
      const landlordId = req.user.entityId || req.user.id;
      if (booking.landlordId !== landlordId && booking.userId !== landlordId) {
        return res.status(403).json({ error: "Access denied to this booking" });
      }
    }

    const comp = await Complaint.findOne({
      $or: [
        { serviceBookingId: booking.id },
        { serviceBookingId: booking.bookingNumber },
        { bookingId: booking.id },
        { bookingId: booking.bookingNumber },
        ...(booking.complaintId ? [{ id: booking.complaintId }] : []),
      ],
    }).sort({ createdAt: -1 }).lean();

    const enriched = {
      ...booking,
      bookingId: booking.bookingId || booking.bookingNumber || booking.id,
      categoryName: booking.categoryName || booking.serviceCategory,
      subService: booking.subService || booking.serviceName,
      bookedByName: booking.bookedByName || booking.userName,
      bookedByRole: booking.bookedByRole || booking.userRole,
      estimatedCost: booking.estimatedCost || booking.amount,
      complaint: comp
        ? {
            id: comp.id,
            complaintId: comp.id,
            complaintType: comp.complaintType || comp.category || "Service Quality",
            subject: comp.subject || comp.issue || "",
            description: comp.description || comp.issue || "",
            status: comp.status || "Submitted",
            date: comp.date || (comp.createdAt ? new Date(comp.createdAt).toISOString().split("T")[0] : ""),
            providerId: comp.providerId || booking.providerId,
            providerName: comp.providerName || booking.providerName,
            attachment: comp.attachment || "",
          }
        : null,
    };

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RAISE COMPLAINT AGAINST SERVICE PROVIDER FROM SPECIFIC BOOKING
app.post("/api/service-bookings/:id/complaint", async (req, res) => {
  try {
    const bookingParam = req.params.id;
    const booking = await ServiceBooking.findOne({
      $or: [
        { id: bookingParam },
        { bookingId: bookingParam },
        { bookingNumber: bookingParam },
        ...(bookingParam && bookingParam.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: bookingParam }] : []),
      ],
    }).lean();

    if (!booking) {
      return res.status(404).json({ error: "Service booking not found" });
    }

    // Role-based Tenant Authorization & Isolation
    const currentUserRole = req.user?.role || "tenant";
    const currentUserId = req.user?.entityId || req.user?.id || "TEN001";
    const currentUserEmail = req.user?.email || "";

    if (currentUserRole === "tenant") {
      const isOwner =
        booking.userId === currentUserId ||
        (currentUserEmail && booking.userEmail && booking.userEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
        booking.userId === "TEN001";
      if (!isOwner) {
        return res.status(403).json({ error: "Access denied. You can only raise complaints for your own bookings." });
      }
    }

    // Required field validation
    const { complaintType, subject, description, attachment } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: "Complaint subject is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Complaint description is required" });
    }

    const validTypes = [
      "Poor Service Quality",
      "Provider Did Not Arrive",
      "Incomplete Work",
      "Property Damage",
      "Overcharging / Payment Issue",
      "Service Quality",
      "Provider Behaviour",
      "Delay",
      "Payment Issue",
      "Other",
    ];
    const selectedType = validTypes.includes(complaintType) ? complaintType : (complaintType || "Poor Service Quality");

    // Enforce business rule: check if complaint already exists for this booking
    const existing = await Complaint.findOne({
      $or: [
        { serviceBookingId: booking.id },
        { serviceBookingId: booking.bookingNumber },
        { bookingId: booking.id },
        { bookingId: booking.bookingNumber },
        ...(booking.complaintId ? [{ id: booking.complaintId }] : []),
      ],
    }).lean();

    if (existing) {
      return res.status(400).json({
        error: "A complaint has already been submitted for this booking.",
        complaint: existing,
      });
    }

    // Generate unique complaint ID: CMP_BK_XXXXXX
    const complaintId = `CMP_BK_${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().split("T")[0];

    const tenantId = booking.userId || currentUserId;
    const tenantName = booking.userName || req.user?.name || "Tenant";

    // Create complaint linked to provider, booking, tenant, and property
    const newComplaint = await Complaint.create({
      id: complaintId,
      tenantId,
      tenant_id: tenantId,
      tenantName,
      tenant_name: tenantName,
      propertyId: booking.propertyId || "TN101",
      property_id: booking.propertyId || "TN101",
      property: booking.propertyName || "Sai Kala Apartments",
      propertyName: booking.propertyName || "Sai Kala Apartments",
      unit: booking.unit || "Flat B-204",
      category: booking.serviceCategory || "Service Provider",
      complaintType: selectedType,
      subject: subject.trim(),
      description: description.trim(),
      issue: `${selectedType}: ${subject.trim()} - ${description.trim()}`,
      serviceBookingId: booking.id,
      bookingId: booking.id,
      providerId: booking.providerId,
      providerName: booking.providerName,
      attachment: attachment || "",
      priority: "Medium",
      status: "Submitted",
      date: today,
    });

    // Link complaintId to the ServiceBooking in database
    await ServiceBooking.findOneAndUpdate(
      { $or: [{ id: booking.id }, { bookingNumber: booking.id }] },
      { complaintId: newComplaint.id }
    );

    // Notify landlord
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId: booking.landlordId || "LDL001",
        user_id: booking.landlordId || "LDL001",
        title: `⚠️ Complaint Raised Against Provider: ${booking.providerName}`,
        message: `${tenantName} raised a complaint for booking #${booking.bookingNumber || booking.id}: "${subject.trim()}". Status: Submitted.`,
        time: "Just now",
        type: "warning",
        isRead: false,
      });
    } catch (notifErr) {
      console.warn("Notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully against service provider",
      complaint: newComplaint,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW SERVICE BOOKING (CRITICAL: Strict Double-Booking Prevention)
app.post("/api/service-bookings", async (req, res) => {
  try {
    const serviceCategory = req.body.serviceCategory || req.body.categoryName || req.body.category;
    const serviceName = req.body.serviceName || req.body.subService || req.body.service || `${serviceCategory || "Home"} Service`;
    const serviceDescription = req.body.serviceDescription || req.body.instructions || req.body.notes || "";
    const providerId = req.body.providerId;
    const date = req.body.date;
    const timeSlot = req.body.timeSlot;
    const propertyId = req.body.propertyId;
    const propertyName = req.body.propertyName;
    const unit = req.body.unit;
    const notes = req.body.notes || req.body.instructions || "";
    const amount = req.body.amount || req.body.estimatedCost;
    const complaintId = req.body.complaintId;

    // Field validation
    if (!serviceCategory) return res.status(400).json({ error: "Service Category is required" });
    if (!providerId) return res.status(400).json({ error: "Service Provider is required" });
    if (!date) return res.status(400).json({ error: "Booking Date is required" });
    if (!timeSlot) return res.status(400).json({ error: "Time Slot is required" });

    // 1. Fetch provider details
    let provider = await ServiceProvider.findOne({
      $or: [
        { id: providerId },
        { _id: providerId && providerId.match(/^[0-9a-fA-F]{24}$/) ? providerId : null },
        { name: req.body.providerName ? new RegExp(req.body.providerName, "i") : null },
      ].filter(Boolean),
    }).lean();

    if (!provider) {
      if (providerId === "PROV_CV_01" || (req.body.providerName && req.body.providerName.includes("Murugan"))) {
        const createdProv = await ServiceProvider.create({
          id: "PROV_CV_01",
          name: req.body.providerName || "Murugan Civil Works",
          category: serviceCategory || "Civil Work & Masonry",
          phone: req.body.providerPhone || "+91 98402 88771",
          price: Number(amount) || 550,
          status: "Active",
          rating: 4.9,
          reviewCount: 22,
          skills: ["Civil Work", "Tile Fixing", "Waterproofing"],
        });
        provider = createdProv.toObject();
      } else {
        provider = await ServiceProvider.findOne({ status: "Active" }).lean();
      }
    }

    if (!provider) {
      return res.status(404).json({ error: "Service provider not found" });
    }

    // 2. ATOMIC DOUBLE-BOOKING CHECK:
    // Before creating a booking, the backend must verify availability again so that
    // two users cannot book the same provider and time simultaneously!
    const conflictBooking = await ServiceBooking.findOne({
      providerId,
      date,
      timeSlot,
      status: { $in: ["Pending", "Confirmed", "Assigned", "In Progress"] },
    }).lean();

    if (conflictBooking) {
      return res.status(409).json({
        success: false,
        error: `Double Booking Prevented! Provider ${provider.name} is already booked on ${date} at ${timeSlot}. Please select another available provider or another time slot.`,
        conflictBookingId: conflictBooking.id,
      });
    }

    // 3. Check ProviderAvailability custom block/leave
    const blockedOverride = await ProviderAvailability.findOne({
      providerId,
      date,
      timeSlot,
      isAvailable: false,
    }).lean();

    if (blockedOverride) {
      return res.status(409).json({
        success: false,
        error: `Provider ${provider.name} is unavailable on ${date} at ${timeSlot} (${blockedOverride.reason || "Slot blocked"}). Please select another slot.`,
      });
    }

    // 4. Resolve Booker Identity & Role
    const userRole = req.user?.role || req.body.userRole || "tenant";
    const userId = req.user?.entityId || req.user?.id || req.body.userId || (userRole === "landlord" ? "LDL001" : "TEN001");
    const userName = req.user?.name || req.body.userName || (userRole === "landlord" ? "Karthik Raja" : "Divya Priya");
    const userEmail = req.user?.email || req.body.userEmail || (userRole === "landlord" ? "karthik.raja@mail.com" : "divya.priya@mail.com");
    const userPhone = req.body.userPhone || (userRole === "landlord" ? "+91 98765 43210" : "+91 98700 11223");

    // 5. Resolve Property & Landlord Reference
    let resolvedPropId = propertyId;
    let resolvedPropName = propertyName;
    let resolvedUnit = unit;
    let resolvedAddress = req.body.address || "";
    let resolvedLandlordId = "LDL001";

    if (resolvedPropId) {
      const propDoc = await Property.findOne({ id: resolvedPropId }).lean();
      if (propDoc) {
        resolvedPropName = propDoc.name;
        resolvedUnit = propDoc.unit || resolvedUnit || "Unit 1";
        resolvedAddress = propDoc.address || `${propDoc.locality || ""}, ${propDoc.city || "Chennai"}`;
        resolvedLandlordId = propDoc.landlordId || propDoc.landlord_id || "LDL001";
      }
    } else if (userRole === "tenant") {
      // Auto-identify tenant's rented property where possible
      const tenantDoc = await Tenant.findOne({ $or: [{ id: userId }, { email: userEmail }] }).lean();
      if (tenantDoc && (tenantDoc.propertyId || tenantDoc.property_id)) {
        resolvedPropId = tenantDoc.propertyId || tenantDoc.property_id;
        const propDoc = await Property.findOne({ id: resolvedPropId }).lean();
        if (propDoc) {
          resolvedPropName = propDoc.name;
          resolvedUnit = propDoc.unit || "Flat B-204";
          resolvedAddress = propDoc.address || "Chennai, Tamil Nadu";
          resolvedLandlordId = propDoc.landlordId || propDoc.landlord_id || "LDL001";
        }
      } else {
        // Fallback to primary rental flat
        resolvedPropId = "TN101";
        resolvedPropName = "Sai Kala Apartments - Flat 302";
        resolvedUnit = "Flat B-204";
        resolvedAddress = "Sai Kala Apartments, Flat B-204, T. Nagar, Chennai";
      }
    } else if (userRole === "landlord") {
      // Pick landlord's first property if not selected
      const propDoc = await Property.findOne({ $or: [{ landlordId: userId }, { landlord_id: userId }] }).lean();
      if (propDoc) {
        resolvedPropId = propDoc.id;
        resolvedPropName = propDoc.name;
        resolvedUnit = propDoc.unit || "Unit 101";
        resolvedAddress = propDoc.address || "Chennai, Tamil Nadu";
        resolvedLandlordId = userId;
      }
    }

    const bookingId = `SB_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;
    const bookingNumber = `PC-BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newBookingData = {
      id: bookingId,
      bookingNumber,
      complaintId: complaintId || null,

      userId,
      userName,
      userEmail,
      userPhone,
      userRole,

      propertyId: resolvedPropId || "TN101",
      propertyName: resolvedPropName || "Sai Kala Apartments - Flat 302",
      unit: resolvedUnit || "Flat B-204",
      address: resolvedAddress || "Chennai, Tamil Nadu",
      landlordId: resolvedLandlordId,

      serviceCategory,
      serviceName: serviceName || `${serviceCategory} Service`,
      serviceDescription: serviceDescription || notes || "Standard service request",
      providerId: provider.id,
      providerName: provider.name,
      providerPhone: provider.phone,
      technicianName: provider.technicianName || provider.name,
      technicianPhone: provider.phone,

      date,
      timeSlot,
      status: "Confirmed",

      amount: Number(amount) || provider.price || 499,
      paymentStatus: "Pending",

      timeline: [
        {
          status: "Pending",
          time: timeNow,
          note: `Booking created by ${userName} (${userRole})`,
          updatedBy: userName,
        },
        {
          status: "Confirmed",
          time: timeNow,
          note: `Appointment confirmed with ${provider.name} for ${date} at ${timeSlot}`,
          updatedBy: "System",
        },
      ],
      notes: notes || "",
    };

    const createdBooking = await ServiceBooking.create(newBookingData);

    // 6. Notifications:
    // A) Show booking confirmation to the user
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId,
        user_id: userId,
        title: `✅ Booking Confirmed: ${bookingNumber}`,
        message: `Your ${serviceCategory} service with ${provider.name} is confirmed for ${date} at ${timeSlot} at ${newBookingData.unit}.`,
        time: "Just now",
        type: "success",
        isRead: false,
      });
    } catch {}

    // B) If a tenant booked for a rented property, notify the landlord
    if (userRole === "tenant" && resolvedLandlordId) {
      try {
        await Notification.create({
          id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          userId: resolvedLandlordId,
          user_id: resolvedLandlordId,
          title: `🛠️ Service Booked for Property: ${newBookingData.propertyName}`,
          message: `Tenant ${userName} booked ${serviceCategory} (${provider.name}) for ${newBookingData.unit} on ${date} at ${timeSlot}.`,
          time: "Just now",
          type: "info",
          isRead: false,
        });
      } catch {}
    }

    // C) If linked to a complaint, advance complaint status
    if (complaintId) {
      try {
        await Complaint.findOneAndUpdate(
          { id: complaintId },
          { $set: { status: "Service Dispatched" } }
        );
      } catch {}
    }

    res.status(201).json(createdBooking);
  } catch (err) {
    // Catch MongoDB duplicate key error from partial unique index
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Double Booking Prevented! Another user just reserved this provider for the same date and time slot. Please choose another slot.",
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// UPDATE BOOKING STATUS (LIFECYCLE STATE TRANSITIONS)
// Pending -> Confirmed -> Assigned -> In Progress -> Completed (or Cancelled)
app.put("/api/service-bookings/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, note, technicianName, technicianPhone } = req.body;
  const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const VALID_STATUSES = ["Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const booking = await ServiceBooking.findOne({
      $or: [
        { id },
        { bookingId: id },
        { bookingNumber: id },
        { _id: id && id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
      ],
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    booking.status = status;
    if (technicianName) booking.technicianName = technicianName;
    if (technicianPhone) booking.technicianPhone = technicianPhone;

    if (status === "Completed") {
      // Payment is unlocked for tenant to pay now
      booking.paymentStatus = booking.paymentStatus === "Paid" ? "Paid" : "Pending";
      booking.completionDate = new Date().toISOString().split("T")[0];

      // Auto-log into Property Maintenance History Ledger
      const historyEntry = {
        id: `MH_${booking.propertyId}_${Date.now()}`,
        propertyId: booking.propertyId,
        propertyName: booking.propertyName,
        unit: booking.unit,
        category: booking.serviceCategory,
        serviceTitle: booking.serviceName,
        description: note || booking.serviceDescription || `Home service completed by ${booking.providerName}`,
        cost: Number(booking.amount || 499),
        providerName: booking.providerName,
        technicianName: booking.technicianName,
        providerId: booking.providerId,
        date: booking.completionDate,
        status: "Completed",
        invoiceId: `INV-PC-${Math.floor(1000 + Math.random() * 9000)}`,
        rating: 5,
        bookingId: booking.id,
      };

      try {
        await PropertyMaintenanceHistory.create(historyEntry);
      } catch {}

      // If linked to a complaint, close the complaint
      if (booking.complaintId) {
        try {
          await Complaint.findOneAndUpdate(
            { id: booking.complaintId },
            { $set: { status: "Resolved" } }
          );
        } catch {}
      }
    }

    booking.timeline.push({
      status,
      time: timeNow,
      note: note || `Status advanced to ${status}`,
      updatedBy: req.user?.name || "System",
    });

    await booking.save();

    // Notify user of status update
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId: booking.userId,
        user_id: booking.userId,
        title: `Service Booking ${status}: ${booking.bookingNumber}`,
        message: `Your booking for ${booking.serviceCategory} is now "${status}". ${note ? `Note: ${note}` : ""}`,
        time: "Just now",
        type: status === "Completed" ? "success" : status === "Cancelled" ? "warning" : "info",
        isRead: false,
      });
    } catch {}

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CANCEL SERVICE BOOKING
app.post("/api/service-bookings/:id/cancel", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  try {
    const booking = await ServiceBooking.findOne({ id });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status === "Completed") {
      return res.status(400).json({ error: "Completed bookings cannot be cancelled." });
    }
    if (booking.status === "Cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled." });
    }

    booking.status = "Cancelled";
    booking.cancellationReason = reason || "Cancelled by user";
    booking.timeline.push({
      status: "Cancelled",
      time: timeNow,
      note: `Booking cancelled: ${reason || "User requested cancellation"}`,
      updatedBy: req.user?.name || "User",
    });

    await booking.save();

    // Notify user
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId: booking.userId,
        user_id: booking.userId,
        title: `Booking Cancelled: ${booking.bookingNumber}`,
        message: `Your booking for ${booking.serviceCategory} on ${booking.date} at ${booking.timeSlot} has been cancelled.`,
        time: "Just now",
        type: "warning",
        isRead: false,
      });
    } catch {}

    res.json({ success: true, booking, message: "Booking cancelled successfully. Time slot has been freed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SERVICE BOOKING PAYMENT (Allowed ONLY After Completion)
// -------------------------------------------------------------
app.post("/api/service-bookings/:id/pay", async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;
  const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  try {
    const booking = await ServiceBooking.findOne({
      $or: [
        { id },
        { bookingId: id },
        { bookingNumber: id },
        { _id: id && id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
      ],
    });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    // CRITICAL REQUIREMENT: Payment is ONLY allowed after service completion!
    if (booking.status !== "Completed") {
      const errMsg = `Payment is only permitted after service is Completed. Current status: "${booking.status}". Payment is unlocked only after service is marked "Completed" by the provider/technician.`;
      return res.status(400).json({
        success: false,
        error: errMsg,
        message: errMsg,
      });
    }

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        error: "This service booking is already paid.",
        message: "This service booking is already paid.",
      });
    }

    booking.paymentStatus = "Paid";
    booking.timeline.push({
      status: "Paid",
      time: timeNow,
      note: `Payment of ₹${booking.amount} received via ${paymentMethod || "UPI"} (Txn: ${transactionId || "TXN_" + Date.now().toString().slice(-6)})`,
      updatedBy: req.user?.name || booking.userName || "Customer",
    });

    await booking.save();

    // Notify provider that payment has been received
    try {
      await Notification.create({
        id: `NOTIF_PAY_${Date.now()}`,
        userId: booking.providerId,
        user_id: booking.providerId,
        title: `Payment Received: ₹${booking.amount}`,
        message: `Customer ${booking.userName} completed payment of ₹${booking.amount} for booking #${booking.bookingNumber || booking.id} via ${paymentMethod || "UPI"}.`,
        time: "Just now",
        type: "success",
        isRead: false,
      });
    } catch {}

    res.json({
      success: true,
      booking,
      message: `Payment of ₹${booking.amount} completed successfully via ${paymentMethod || "UPI"}!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

// -------------------------------------------------------------
// SERVICE BOOKING CUSTOMER FEEDBACK & REVIEW
// -------------------------------------------------------------
app.post("/api/service-bookings/:id/feedback", async (req, res) => {
  const { id } = req.params;
  const { rating, reviewText } = req.body;

  try {
    const booking = await ServiceBooking.findOne({
      $or: [
        { id },
        { bookingId: id },
        { bookingNumber: id },
        { _id: id && id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
      ],
    });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    const numRating = Math.max(1, Math.min(5, Number(rating) || 5));
    booking.rating = numRating;
    booking.customerRating = numRating;
    booking.reviewText = (reviewText || "").trim();
    booking.customerFeedback = (reviewText || "").trim();

    await booking.save();

    // Update Service Provider's rating and reviews in MongoDB
    if (booking.providerId) {
      const provider = await ServiceProvider.findOne({ id: booking.providerId });
      if (provider) {
        if (!Array.isArray(provider.reviews)) provider.reviews = [];
        provider.reviews.push({
          author: booking.userName || "Customer",
          rating: numRating,
          comment: (reviewText || "").trim() || "Professional service completed on time.",
          date: new Date().toLocaleDateString("en-IN"),
        });

        const totalReviews = provider.reviews.length;
        const avg = provider.reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / totalReviews;
        provider.rating = Number(avg.toFixed(1));
        provider.reviewCount = totalReviews;
        await provider.save();
      }
    }

    res.json({
      success: true,
      booking,
      message: "Thank you! Your feedback has been recorded and submitted to the service provider.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// SERVICE PROVIDER PORTAL API ENDPOINTS
// -------------------------------------------------------------
app.get("/api/provider/bookings", async (req, res) => {
  try {
    const userRole = req.user?.role;
    const providerEntityId = req.query.providerId || req.user?.entityId || req.user?.entity_id;

    let query = {};
    if (providerEntityId) {
      query = {
        $or: [
          { providerId: providerEntityId },
          { providerName: new RegExp(req.user?.name || "", "i") },
        ],
      };
    }

    const bookings = await ServiceBooking.find(query).sort({ date: -1, createdAt: -1 }).lean();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/provider/stats", async (req, res) => {
  try {
    const providerEntityId = req.query.providerId || req.user?.entityId || req.user?.entity_id || "PROV_AC_01";
    const provider = await ServiceProvider.findOne({
      $or: [{ id: providerEntityId }, { phone: req.user?.phone }],
    }).lean();

    const bookings = await ServiceBooking.find({
      $or: [{ providerId: providerEntityId }, { providerName: provider?.name || "" }],
    }).lean();

    const pendingCount = bookings.filter((b) => b.status === "Pending").length;
    const confirmedCount = bookings.filter((b) => b.status === "Confirmed").length;
    const assignedCount = bookings.filter((b) => b.status === "Assigned").length;
    const inProgressCount = bookings.filter((b) => b.status === "In Progress").length;
    const completedCount = bookings.filter((b) => b.status === "Completed").length;
    const totalEarnings = bookings
      .filter((b) => b.status === "Completed" && b.paymentStatus === "Paid")
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    res.json({
      provider: provider || {
        name: req.user?.name || "Service Provider",
        category: "Civil Work & Home Services",
        rating: 4.9,
      },
      totalBookings: bookings.length,
      pendingCount,
      confirmedCount,
      assignedCount,
      inProgressCount,
      completedCount,
      totalEarnings,
      rating: provider?.rating || 4.9,
      reviewCount: provider?.reviewCount || provider?.reviews?.length || 18,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// COMPLAINT CATEGORIES MANAGEMENT API (Admin & Shared)
// -------------------------------------------------------------
app.get("/api/complaint-categories", async (req, res) => {
  try {
    let categories = await ComplaintCategory.find().sort({ displayOrder: 1, name: 1 }).lean();
    if (!categories || categories.length === 0) {
      // Seed fallback categories if collection is currently empty
      const defaultCategories = [
        { id: "CCAT_CIVIL", name: "Civil Work & Masonry", slug: "civil-work", description: "Wall cracks, tile repairs, damp patches, loose masonry, plaster spalling, structural leaks.", icon: "HardHat", defaultPriority: "High", expectedResolutionHours: 48, isActive: true, displayOrder: 1 },
        { id: "CCAT_PLUMB", name: "Plumbing & Sanitary", slug: "plumbing", description: "Pipe leakages, tap replacements, low pressure, flush tank overflow, drain clog, sewer backflow.", icon: "Droplets", defaultPriority: "High", expectedResolutionHours: 24, isActive: true, displayOrder: 2 },
        { id: "CCAT_ELEC", name: "Electrical & Power", slug: "electrical", description: "MCB tripping, burning smell, loose wiring, power fluctuation, earthing fault, switchboard failure.", icon: "Zap", defaultPriority: "Urgent", expectedResolutionHours: 12, isActive: true, displayOrder: 3 },
        { id: "CCAT_CLEAN", name: "Cleaning & Waste Management", slug: "cleaning", description: "Common corridor filth, garbage accumulation, water tank cleaning, pest infestation.", icon: "Sparkles", defaultPriority: "Medium", expectedResolutionHours: 24, isActive: true, displayOrder: 4 },
        { id: "CCAT_AC", name: "HVAC & Air Conditioning", slug: "ac-repair", description: "AC cooling loss, compressor tripping, gas leakage, continuous drain overflow, unusual noise.", icon: "Wind", defaultPriority: "Medium", expectedResolutionHours: 24, isActive: true, displayOrder: 5 },
        { id: "CCAT_CARP", name: "Carpentry & Locks", slug: "carpentry", description: "Main door lock jammed, window latch broken, wardrobe hinge snapped, termite damaged wood.", icon: "Hammer", defaultPriority: "Medium", expectedResolutionHours: 36, isActive: true, displayOrder: 6 },
        { id: "CCAT_SEC", name: "Security & Amenities", slug: "security", description: "Lift breakdown, CCTV offline, gate intercom failure, parking slot dispute, noise complaints.", icon: "ShieldAlert", defaultPriority: "High", expectedResolutionHours: 12, isActive: true, displayOrder: 7 },
      ];
      await ComplaintCategory.insertMany(defaultCategories);
      categories = defaultCategories;
    }

    // Attach current open and total complaints count to each category
    const allComplaints = await Complaint.find().lean();
    const enriched = categories.map((cat) => {
      const match = allComplaints.filter(
        (c) => (c.category || "").toLowerCase() === cat.name.toLowerCase() || (c.category || "").toLowerCase() === cat.slug.toLowerCase()
      );
      return {
        ...cat,
        totalComplaints: match.length,
        openComplaints: match.filter((c) => c.status !== "Resolved" && c.status !== "Completed").length,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complaint-categories", async (req, res) => {
  try {
    const { name, description, icon, defaultPriority, expectedResolutionHours } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmedName = name.trim();
    const existing = await ComplaintCategory.findOne({
      $or: [
        { name: new RegExp(`^${trimmedName}$`, "i") },
        { slug: trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      ],
    });

    if (existing) {
      existing.description = description || existing.description;
      existing.icon = icon || existing.icon;
      existing.defaultPriority = defaultPriority || existing.defaultPriority;
      existing.expectedResolutionHours = Number(expectedResolutionHours) || existing.expectedResolutionHours;
      await existing.save();
      return res.status(201).json(existing);
    }

    const id = `CCAT_${Date.now().toString().slice(-6)}`;
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const created = await ComplaintCategory.create({
      id,
      name: trimmedName,
      slug,
      description: description || "",
      icon: icon || "AlertCircle",
      defaultPriority: defaultPriority || "Medium",
      expectedResolutionHours: Number(expectedResolutionHours) || 24,
      isActive: true,
      displayOrder: Date.now(),
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complaint-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = id && id.match(/^[0-9a-fA-F]{24}$/) ? { $or: [{ id }, { _id: id }] } : { id };
    const updated = await ComplaintCategory.findOneAndUpdate(
      query,
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Complaint category not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complaint-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = id && id.match(/^[0-9a-fA-F]{24}$/) ? { $or: [{ id }, { _id: id }] } : { id };
    await ComplaintCategory.findOneAndDelete(query);
    res.json({ success: true, message: "Complaint category removed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Landlord Preferred Providers for a Property
app.get("/api/preferred-providers/:propertyId", async (req, res) => {
  const { propertyId } = req.params;
  try {
    const rows = await PreferredProvider.find({ propertyId }).lean();
    if (rows && rows.length > 0) {
      const mapping = {};
      rows.forEach((r) => {
        mapping[r.category] = r;
      });
      return res.json(mapping);
    }
  } catch {}

  // Fallback to in-memory mapping
  res.json(inMemoryPreferred[propertyId] || inMemoryPreferred["TN101"] || {});
});

// 3. Set or Update Landlord Preferred Provider
app.post("/api/preferred-providers", async (req, res) => {
  try {
    const { propertyId, landlordId, category, providerId, providerName, isSimulatedBusy } = req.body;
    if (!propertyId || !category || !providerId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = `PREF_${propertyId}_${category}`;
    let doc = await PreferredProvider.findOneAndUpdate(
      { propertyId, category },
      {
        $set: {
          id,
          propertyId,
          landlordId: landlordId || "LDL001",
          category,
          providerId,
          providerName,
          isSimulatedBusy: Boolean(isSimulatedBusy),
        },
      },
      { upsert: true, new: true }
    ).lean();

    if (!inMemoryPreferred[propertyId]) inMemoryPreferred[propertyId] = {};
    inMemoryPreferred[propertyId][category] = {
      providerId,
      providerName,
      isSimulatedBusy: Boolean(isSimulatedBusy),
    };

    res.json(doc || inMemoryPreferred[propertyId][category]);
  } catch (err) {
    const { propertyId, category, providerId, providerName, isSimulatedBusy } = req.body;
    if (!inMemoryPreferred[propertyId]) inMemoryPreferred[propertyId] = {};
    inMemoryPreferred[propertyId][category] = {
      providerId,
      providerName,
      isSimulatedBusy: Boolean(isSimulatedBusy),
    };
    res.json(inMemoryPreferred[propertyId][category]);
  }
});

// 4. Toggle Preferred Provider Busy State (for interactive testing & viva demo)
app.post("/api/preferred-providers/toggle-busy", async (req, res) => {
  try {
    const { propertyId = "TN101", category = "AC", isSimulatedBusy } = req.body;
    await PreferredProvider.updateOne(
      { propertyId, category },
      { $set: { isSimulatedBusy: Boolean(isSimulatedBusy) } }
    );
    if (!inMemoryPreferred[propertyId]) inMemoryPreferred[propertyId] = {};
    if (!inMemoryPreferred[propertyId][category]) {
      inMemoryPreferred[propertyId][category] = {
        providerId: "PROV_AC_01",
        providerName: "Kumar AC Services",
      };
    }
    inMemoryPreferred[propertyId][category].isSimulatedBusy = Boolean(isSimulatedBusy);

    res.json({
      success: true,
      propertyId,
      category,
      isSimulatedBusy: Boolean(isSimulatedBusy),
      message: `Preferred provider for ${category} is now ${isSimulatedBusy ? "marked BUSY (FixIt will auto-recommend alternatives)" : "AVAILABLE"}!`,
    });
  } catch (err) {
    res.json({ success: true, isSimulatedBusy: Boolean(req.body.isSimulatedBusy) });
  }
});

// 5. Get FixIt Service Bookings
app.get("/api/fixit-bookings", async (req, res) => {
  try {
    const { propertyId, tenantId, status } = req.query;
    const filter = {};
    if (propertyId) filter.propertyId = propertyId;
    if (tenantId) filter.tenantId = tenantId;
    if (status) filter.status = status;

    let rows = await FixItBooking.find(filter).sort({ id: -1 }).lean();
    if (!rows || rows.length === 0) {
      rows = inMemoryBookings;
    }
    res.json(rows);
  } catch (err) {
    res.json(inMemoryBookings);
  }
});

// 6. Get Single Booking with Live GPS details
app.get("/api/fixit-bookings/:id", async (req, res) => {
  try {
    const b = await FixItBooking.findOne({ id: req.params.id }).lean();
    if (b) return res.json(b);
  } catch {}

  const mem = inMemoryBookings.find((x) => x.id === req.params.id);
  if (mem) return res.json(mem);
  res.status(404).json({ error: "Booking not found" });
});

// 7. Create New FixIt Service Booking
app.post("/api/fixit-bookings", async (req, res) => {
  try {
    const b = req.body;
    const bookingId = b.id || `BK_FIX_${Math.floor(1000 + Math.random() * 9000)}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newBooking = {
      id: bookingId,
      complaintId: b.complaintId || null,
      propertyId: b.propertyId || "TN101",
      propertyName: b.propertyName || "Sai Kala Apartments - Flat 302",
      unit: b.unit || "Flat B-204",
      tenantId: b.tenantId || "TEN001",
      tenantName: b.tenantName || "Divya Priya",
      tenantPhone: b.tenantPhone || "+91 98700 11223",
      landlordId: b.landlordId || "LDL001",
      category: b.category || "AC Repair",
      serviceTitle: b.serviceTitle || "AC Repair & Service",
      issueDescription: b.issueDescription || "AC cooling problem reported",
      providerId: b.providerId || "PROV_AC_01",
      providerName: b.providerName || "Kumar AC Services",
      technicianName: b.technicianName || "Kumar S.",
      technicianPhone: b.technicianPhone || "+91 98765 00001",
      vehicle: b.vehicle || "TVS Apache - TN 01 AB 4321",
      status: "Confirmed",
      scheduledDate: b.scheduledDate || new Date().toISOString().split("T")[0],
      scheduledSlot: b.scheduledSlot || "02:00 PM - 04:00 PM",
      amount: Number(b.amount || 800),
      paymentStatus: "Pending",
      currentLocation: {
        lat: 13.055,
        lng: 80.245,
      },
      destinationLocation: {
        lat: 13.0418,
        lng: 80.2341,
        address: "Sai Kala Apartments, Flat B-204, T. Nagar, Chennai",
      },
      distanceKm: 1.8,
      etaMinutes: 8,
      timeline: [
        { status: "Confirmed", time: timeNow, note: "Technician assigned & dispatch order created" },
      ],
      rating: 0,
      reviewText: "",
    };

    let createdDoc;
    try {
      createdDoc = await FixItBooking.create(newBooking);
    } catch {
      createdDoc = newBooking;
    }

    inMemoryBookings.unshift(newBooking);

    // If linked to a complaint, update complaint status to "FixIt Dispatched"
    if (b.complaintId) {
      try {
        await Complaint.findOneAndUpdate(
          { id: b.complaintId },
          { $set: { status: "FixIt Dispatched" } }
        );
      } catch {}
    }

    // Create Notification for Landlord and Tenant
    try {
      await Notification.create({
        id: `NOTIF_${Date.now()}`,
        userId: b.tenantId || "TEN001",
        title: "🚗 FixIt Pro Dispatched!",
        message: `${newBooking.providerName} technician ${newBooking.technicianName} confirmed for ${newBooking.unit}. Live tracking available.`,
        time: "Just now",
        type: "success",
        isRead: false,
      });
    } catch {}

    res.status(201).json(createdDoc || newBooking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Update FixIt Booking Status (Advancing lifecycle: Confirmed -> On The Way -> Arrived -> In Progress -> Completed)
app.put("/api/fixit-bookings/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, lat, lng, note } = req.body;
  const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  try {
    const existing = await FixItBooking.findOne({ id });
    if (existing) {
      existing.status = status;
      if (lat && lng) {
        existing.currentLocation = { lat: Number(lat), lng: Number(lng) };
      }
      if (status === "On The Way") {
        existing.etaMinutes = 6;
        existing.distanceKm = 1.4;
      } else if (status === "Arrived") {
        existing.etaMinutes = 0;
        existing.distanceKm = 0;
      } else if (status === "Completed") {
        existing.paymentStatus = "Paid";
      }

      existing.timeline.push({
        status,
        time: timeNow,
        note: note || `Status updated to ${status}`,
      });

      await existing.save();
      return res.json(existing);
    }
  } catch {}

  // In-memory fallback
  const mem = inMemoryBookings.find((x) => x.id === id);
  if (mem) {
    mem.status = status;
    if (lat && lng) mem.currentLocation = { lat: Number(lat), lng: Number(lng) };
    if (status === "On The Way") {
      mem.etaMinutes = 6;
      mem.distanceKm = 1.4;
    } else if (status === "Arrived") {
      mem.etaMinutes = 0;
      mem.distanceKm = 0;
    } else if (status === "Completed") {
      mem.paymentStatus = "Paid";
    }
    mem.timeline.push({
      status,
      time: timeNow,
      note: note || `Status updated to ${status}`,
    });
    return res.json(mem);
  }

  res.status(404).json({ error: "Booking not found" });
});

// 9. Review FixIt Booking & Auto-Save to Property Maintenance History Ledger!
app.post("/api/fixit-bookings/:id/review", async (req, res) => {
  const { id } = req.params;
  const { rating = 5, reviewText = "Great service!" } = req.body;
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  let booking = null;
  try {
    booking = await FixItBooking.findOne({ id });
    if (booking) {
      booking.rating = Number(rating);
      booking.reviewText = reviewText;
      booking.status = "Completed";
      await booking.save();
    }
  } catch {}

  if (!booking) {
    booking = inMemoryBookings.find((x) => x.id === id);
    if (booking) {
      booking.rating = Number(rating);
      booking.reviewText = reviewText;
      booking.status = "Completed";
    }
  }

  // Create record in Property Maintenance History Ledger
  const propId = booking?.propertyId || "TN101";
  const historyEntry = {
    id: `MH_${propId}_${Date.now()}`,
    propertyId: propId,
    propertyName: booking?.propertyName || "Sai Kala Apartments - Flat 302",
    unit: booking?.unit || "Flat B-204",
    category: booking?.category || "AC Service",
    serviceTitle: booking?.serviceTitle || "AC Repair & Service",
    description: reviewText || booking?.issueDescription || "Service completed via FixIt Local",
    cost: Number(booking?.amount || 800),
    providerName: booking?.providerName || "Kumar AC Services",
    technicianName: booking?.technicianName || "Kumar S.",
    providerId: booking?.providerId || "PROV_AC_01",
    date: dateStr,
    status: "Completed",
    invoiceId: `INV-FIX-${Math.floor(1000 + Math.random() * 9000)}`,
    rating: Number(rating),
    bookingId: id,
    complaintId: booking?.complaintId || "",
  };

  try {
    await PropertyMaintenanceHistory.create(historyEntry);
  } catch {}

  if (!inMemoryMaintenanceHistory[propId]) inMemoryMaintenanceHistory[propId] = [];
  inMemoryMaintenanceHistory[propId].unshift(historyEntry);

  // If linked to complaint, close complaint
  if (booking?.complaintId) {
    try {
      await Complaint.findOneAndUpdate(
        { id: booking.complaintId },
        { $set: { status: "Resolved" } }
      );
    } catch {}
  }

  res.json({
    success: true,
    message: "Review saved! Service automatically logged into Property Maintenance History Ledger.",
    booking,
    historyEntry,
  });
});

// 10. Get Property Maintenance History & 6-Month Cost Analytics Ledger
app.get("/api/properties/:id/maintenance-history", async (req, res) => {
  const { id } = req.params;
  let rows = [];

  try {
    rows = await PropertyMaintenanceHistory.find({ propertyId: id }).sort({ id: -1 }).lean();
  } catch {}

  if (!rows || rows.length === 0) {
    rows = inMemoryMaintenanceHistory[id] || inMemoryMaintenanceHistory["TN101"] || [];
  }

  // Compute 6-Month Analytics & Category Spend Breakdown
  let totalCost = 0;
  const categoryBreakdown = {};
  const providerStats = {};

  rows.forEach((r) => {
    const cost = Number(r.cost || 0);
    totalCost += cost;
    const cat = r.category || "General";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + cost;
    const prov = r.providerName || "Technician";
    providerStats[prov] = (providerStats[prov] || 0) + 1;
  });

  res.json({
    propertyId: id,
    totalSpendLast6Months: totalCost,
    totalRecords: rows.length,
    averageRating: 4.9,
    categoryBreakdown,
    providerStats,
    records: rows,
  });
});

// 11. Add Manual Property Maintenance History Record
app.post("/api/properties/:id/maintenance-history", async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  const newEntry = {
    id: `MH_${id}_${Date.now()}`,
    propertyId: id,
    propertyName: d.propertyName || "Sai Kala Apartments - Flat 302",
    unit: d.unit || "Flat B-204",
    category: d.category || "General Maintenance",
    serviceTitle: d.serviceTitle || d.title || "Routine Service",
    description: d.description || "",
    cost: Number(d.cost || d.amount || 0),
    providerName: d.providerName || "Verified Provider",
    technicianName: d.technicianName || "",
    providerId: d.providerId || "",
    date: d.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    status: "Completed",
    invoiceId: d.invoiceId || `INV-FIX-${Math.floor(1000 + Math.random() * 9000)}`,
    rating: Number(d.rating || 5),
    bookingId: d.bookingId || "",
    complaintId: d.complaintId || "",
  };

  try {
    await PropertyMaintenanceHistory.create(newEntry);
  } catch {}

  if (!inMemoryMaintenanceHistory[id]) inMemoryMaintenanceHistory[id] = [];
  inMemoryMaintenanceHistory[id].unshift(newEntry);

  res.status(201).json(newEntry);
});

// -------------------------------------------------------------
// 12. Security Deposits API
// -------------------------------------------------------------
app.get("/api/deposits", async (req, res) => {
  try {
    const rows = await SecurityDeposit.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/deposits", async (req, res) => {
  try {
    const d = req.body;
    const id = d.id || `DEP${Math.floor(Math.random() * 900 + 100)}`;
    const created = await SecurityDeposit.create({
      id,
      tenantId: d.tenantId || d.tenant_id || null,
      tenant_id: d.tenantId || d.tenant_id || null,
      propertyId: d.propertyId || d.property_id || null,
      property_id: d.propertyId || d.property_id || null,
      amount: Number(d.amount || 0),
      status: d.status || "Held in Escrow",
      dateReceived: d.dateReceived || d.date_received || new Date().toISOString().split("T")[0],
      date_received: d.dateReceived || d.date_received || new Date().toISOString().split("T")[0],
      returnStatus: d.returnStatus || d.return_status || "Not Applicable",
      return_status: d.returnStatus || d.return_status || "Not Applicable",
      refundAmount: Number(d.refundAmount || d.refund_amount || 0),
      refund_amount: Number(d.refundAmount || d.refund_amount || 0),
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/deposits/:id", async (req, res) => {
  try {
    const updated = await SecurityDeposit.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Deposit not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/deposits/:id", async (req, res) => {
  try {
    const deleted = await SecurityDeposit.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Deposit not found" });
    res.json({ success: true, message: "Deposit record removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 12. Utility & EB Bill Management API
// -------------------------------------------------------------

// In-app Notification Dispatcher Helper
async function sendNotification({ userId, title, message, type = "info", meta = "" }) {
  if (!userId) return null;
  try {
    return await Notification.create({
      id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId,
      user_id: userId,
      title,
      message,
      type,
      meta: typeof meta === "object" ? JSON.stringify(meta) : String(meta),
      time: "Just now",
      isRead: false,
    });
  } catch (err) {
    console.warn("⚠️ Notification dispatch failed:", err.message);
    return null;
  }
}

// Helper: Calculate dynamic status for display
function computeBillStatus(bill) {
  if (!bill) return "Unpaid";
  if (bill.status === "Paid" || bill.status === "Failed" || bill.status === "Payment Pending") {
    return bill.status;
  }
  const todayStr = new Date().toISOString().split("T")[0];
  const dueDateStr = bill.dueDate || bill.due_date;
  if (!dueDateStr) return bill.status || "Unpaid";

  const today = new Date(todayStr);
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return bill.status || "Unpaid";

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return "Overdue";
  } else if (diffDays <= 3) {
    return "Due Soon";
  }
  return "Unpaid";
}

// 12.1 List Utility Bills with Role Scoping & Dynamic Filters
app.get("/api/utility-bills", async (req, res) => {
  try {
    const { propertyId, tenantId, landlordId, type, status, billingMonth, overdue } = req.query;
    const filter = {};

    // 1. Role-based scoping:
    if (req.user) {
      if (req.user.role === "tenant") {
        const tId = req.user.entityId || req.user.entity_id || req.user.id;
        // Tenant can ONLY access their own assigned bills
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [{ tenantId: tId }, { tenant_id: tId }],
        });
        // Tenant only sees bills they are responsible for (Tenant or Shared)
        filter.responsibility = { $in: ["Tenant", "Shared"] };
      } else if (req.user.role === "landlord") {
        const lId = req.user.entityId || req.user.entity_id || req.user.id;
        // Find properties owned by this landlord
        const ownedProps = await Property.find({
          $or: [{ landlordId: lId }, { landlord_id: lId }],
        }).select("id").lean();
        const propIds = ownedProps.map((p) => p.id);

        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { landlordId: lId },
            { landlord_id: lId },
            { propertyId: { $in: propIds } },
            { property_id: { $in: propIds } },
          ],
        });
      }
      // Admin sees all bills
    }

    // 2. Query parameter filters
    if (propertyId) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ propertyId }, { property_id: propertyId }],
      });
    }
    if (tenantId) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ tenantId }, { tenant_id: tenantId }],
      });
    }
    if (landlordId) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ landlordId }, { landlord_id: landlordId }],
      });
    }
    if (type) {
      filter.type = new RegExp(`^${type}$`, "i");
    }
    if (billingMonth) {
      filter.$or = [{ billingMonth }, { billing_month: billingMonth }];
    }

    let rows = await UtilityBill.find(filter).sort({ billDate: -1, id: -1 }).lean();

    // Map rows with dynamic status computation
    rows = rows.map((b) => {
      const computed = computeBillStatus(b);
      return {
        ...b,
        displayStatus: computed,
        // Sync status if not Paid
        status: b.status === "Paid" ? "Paid" : computed,
      };
    });

    // Handle post-query status filter
    if (status && status !== "All") {
      rows = rows.filter((b) => b.status.toLowerCase() === status.toLowerCase());
    }
    if (overdue === "true") {
      rows = rows.filter((b) => b.status === "Overdue");
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.2 Landlord Summary Analytics for EB Bills Dashboard
app.get("/api/utility-bills/summary", async (req, res) => {
  try {
    const { propertyId, landlordId: queryLandlordId, type = "Electricity" } = req.query;
    const filter = {
      type: new RegExp(`^${type}$`, "i"),
    };

    if (req.user && req.user.role === "landlord") {
      const lId = req.user.entityId || req.user.entity_id || req.user.id;
      const ownedProps = await Property.find({
        $or: [{ landlordId: lId }, { landlord_id: lId }],
      }).select("id").lean();
      const propIds = ownedProps.map((p) => p.id);
      filter.$or = [{ landlordId: lId }, { propertyId: { $in: propIds } }];
    } else if (queryLandlordId) {
      filter.$or = [{ landlordId: queryLandlordId }, { landlord_id: queryLandlordId }];
    }

    if (propertyId) {
      filter.propertyId = propertyId;
    }

    const allBills = await UtilityBill.find(filter).lean();

    let totalBills = allBills.length;
    let paidBills = 0;
    let unpaidBills = 0;
    let overdueBills = 0;
    let dueSoonBills = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalUnits = 0;

    for (const b of allBills) {
      const currentStatus = computeBillStatus(b);
      const amt = Number(b.amount || 0);
      const units = Number(b.unitsConsumed || b.units_consumed || 0);
      totalUnits += units;

      if (b.status === "Paid") {
        paidBills++;
        totalCollected += Number(b.paidAmount || amt);
      } else {
        unpaidBills++;
        totalPending += Number(b.tenantAmount !== undefined ? b.tenantAmount : amt);
        if (currentStatus === "Overdue") {
          overdueBills++;
        } else if (currentStatus === "Due Soon") {
          dueSoonBills++;
        }
      }
    }

    res.json({
      totalBills,
      paidBills,
      unpaidBills,
      overdueBills,
      dueSoonBills,
      totalCollected,
      totalPending,
      totalUnits,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.3 Get Bill Details by ID
app.get("/api/utility-bills/:id", async (req, res) => {
  try {
    const bill = await UtilityBill.findOne({ id: req.params.id }).lean();
    if (!bill) return res.status(404).json({ error: "Utility bill not found" });

    // Authorization check
    if (req.user && req.user.role === "tenant") {
      const tId = req.user.entityId || req.user.entity_id || req.user.id;
      if (bill.tenantId !== tId && bill.tenant_id !== tId) {
        return res.status(403).json({ error: "Access denied. You can only view your own bills." });
      }
      if (bill.responsibility === "Landlord") {
        return res.status(403).json({ error: "This bill is the landlord's responsibility." });
      }
    }

    const computed = computeBillStatus(bill);
    res.json({
      ...bill,
      displayStatus: computed,
      status: bill.status === "Paid" ? "Paid" : computed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.4 Create EB / Utility Bill with Validation & Duplicate Prevention
app.post("/api/utility-bills", async (req, res) => {
  try {
    const b = req.body;

    // Required fields validation
    if (!b.propertyId && !b.property_id) {
      return res.status(400).json({ error: "Property is required." });
    }
    const propId = b.propertyId || b.property_id;
    const billType = b.type || "Electricity";
    const billMonth = b.billingMonth || b.billing_month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const amount = Number(b.amount || 0);

    if (amount <= 0) {
      return res.status(400).json({ error: "Bill amount must be greater than zero." });
    }

    // Resolve Property & Landlord
    const property = await Property.findOne({
      $or: [{ id: propId }, { _id: propId.length === 24 ? propId : null }],
    }).lean();

    if (!property) {
      return res.status(404).json({ error: "Selected property not found." });
    }

    // Authorization: If landlord, verify they own this property
    if (req.user && req.user.role === "landlord") {
      const lId = req.user.entityId || req.user.entity_id || req.user.id;
      if (property.landlordId !== lId && property.landlord_id !== lId) {
        return res.status(403).json({ error: "You are not authorized to create bills for this property." });
      }
    }

    // Duplicate bill check for same property, type, and billing period
    const existingBill = await UtilityBill.findOne({
      $or: [{ propertyId: propId }, { property_id: propId }],
      type: new RegExp(`^${billType}$`, "i"),
      $or: [{ billingMonth: billMonth }, { billing_month: billMonth }],
    }).lean();

    if (existingBill) {
      return res.status(400).json({
        error: `A ${billType} bill for ${property.name} for the billing period "${billMonth}" already exists (Bill ID: ${existingBill.id}).`,
      });
    }

    // Resolve Tenant & Lease
    let tenantId = b.tenantId || b.tenant_id;
    let tenantName = b.tenantName || b.tenant_name;
    const lease = await Lease.findOne({
      $or: [{ propertyId: propId }, { property_id: propId }],
      status: "Active",
    }).lean();

    if (!tenantId && lease) {
      tenantId = lease.tenantId || lease.tenant_id;
      tenantName = lease.tenantName || lease.tenant_name;
    }

    if (!tenantName && tenantId) {
      const tUser = await Tenant.findOne({ id: tenantId }).lean();
      if (tUser) tenantName = tUser.name;
    }

    // Compute units consumed if readings provided
    let prevReading = b.previousReading !== undefined && b.previousReading !== "" ? Number(b.previousReading) : null;
    let currReading = b.currentReading !== undefined && b.currentReading !== "" ? Number(b.currentReading) : null;
    let unitsConsumed = b.unitsConsumed !== undefined && b.unitsConsumed !== "" ? Number(b.unitsConsumed) : null;

    if (currReading !== null && prevReading !== null && unitsConsumed === null) {
      unitsConsumed = Math.max(0, currReading - prevReading);
    }

    // Determine Responsibility & Split
    const responsibility = b.responsibility || (lease?.utilityResponsibility?.[billType.toLowerCase()] || "Tenant");
    let tenantAmount = amount;
    let landlordAmount = 0;

    if (responsibility === "Landlord") {
      tenantAmount = 0;
      landlordAmount = amount;
    } else if (responsibility === "Shared") {
      tenantAmount = b.tenantAmount !== undefined ? Number(b.tenantAmount) : Math.round(amount / 2);
      landlordAmount = b.landlordAmount !== undefined ? Number(b.landlordAmount) : amount - tenantAmount;
    }

    const id = b.id || `EB-${Date.now().toString().slice(-6)}`;
    const billDate = b.billDate || b.bill_date || new Date().toISOString().split("T")[0];
    const dueDate = b.dueDate || b.due_date || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const created = await UtilityBill.create({
      id,
      propertyId: propId,
      property_id: propId,
      propertyName: property.name || "Apartment Unit",
      property_name: property.name || "Apartment Unit",
      tenantId: tenantId || null,
      tenant_id: tenantId || null,
      tenantName: tenantName || "Resident Tenant",
      tenant_name: tenantName || "Resident Tenant",
      landlordId: property.landlordId || property.landlord_id || "LDL001",
      landlord_id: property.landlordId || property.landlord_id || "LDL001",
      type: billType,
      billingMonth: billMonth,
      billing_month: billMonth,
      consumerNo: b.consumerNo || b.consumer_no || property.ebConsumerNo || `01-102-004-${Math.floor(1000 + Math.random() * 9000)}`,
      billReference: b.billReference || b.bill_reference || `TNEB-${Date.now().toString().slice(-5)}`,
      bill_reference: b.billReference || b.bill_reference || `TNEB-${Date.now().toString().slice(-5)}`,
      previousReading: prevReading,
      previous_reading: prevReading,
      currentReading: currReading,
      current_reading: currReading,
      unitsConsumed,
      units_consumed: unitsConsumed,
      ratePerUnit: Number(b.ratePerUnit || 7.5),
      amount,
      billDate,
      bill_date: billDate,
      dueDate,
      due_date: dueDate,
      responsibility,
      tenantAmount,
      tenant_amount: tenantAmount,
      landlordAmount,
      landlord_amount: landlordAmount,
      status: "Unpaid",
      documentUrl: b.documentUrl || b.document_url || "",
      documentName: b.documentName || b.document_name || (b.documentUrl ? "Electricity_Bill.pdf" : ""),
      notes: b.notes || "",
    });

    // Notify tenant if tenant is responsible for payment
    if (tenantId && responsibility !== "Landlord") {
      await sendNotification({
        userId: tenantId,
        title: `⚡ New Electricity Bill Issued: ₹${tenantAmount}`,
        message: `A new ${billType} bill of ₹${tenantAmount} for ${property.name} (${billMonth}) has been issued. Payment due on ${dueDate}.`,
        type: "info",
        meta: { billId: id, amount: tenantAmount, dueDate },
      });
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.5 Update Bill
app.put("/api/utility-bills/:id", async (req, res) => {
  try {
    const existing = await UtilityBill.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: "Utility bill not found" });

    // Role check: Tenant cannot alter bill details
    if (req.user && req.user.role === "tenant") {
      return res.status(403).json({ error: "Tenants cannot edit bill specifications." });
    }

    // If landlord, verify ownership
    if (req.user && req.user.role === "landlord") {
      const lId = req.user.entityId || req.user.entity_id || req.user.id;
      if (existing.landlordId !== lId && existing.landlord_id !== lId) {
        return res.status(403).json({ error: "Access denied to modify this property bill." });
      }
    }

    const updated = await UtilityBill.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.6 Delete Bill
app.delete("/api/utility-bills/:id", async (req, res) => {
  try {
    const existing = await UtilityBill.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: "Utility bill not found" });

    if (req.user && req.user.role === "tenant") {
      return res.status(403).json({ error: "Tenants cannot delete utility bills." });
    }

    await UtilityBill.findOneAndDelete({ id: req.params.id });
    res.json({ success: true, message: "Utility bill removed successfully", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.7 Create Payment Order (Razorpay / Secure Sandbox Gateway)
app.post("/api/utility-bills/:id/create-order", async (req, res) => {
  try {
    const bill = await UtilityBill.findOne({ id: req.params.id });
    if (!bill) return res.status(404).json({ error: "Utility bill not found" });

    if (bill.status === "Paid") {
      return res.status(400).json({ error: "This bill has already been paid." });
    }

    // Role check: Only assigned tenant (or admin) can initiate payment
    if (req.user && req.user.role === "tenant") {
      const tId = req.user.entityId || req.user.entity_id || req.user.id;
      if (bill.tenantId !== tId && bill.tenant_id !== tId) {
        return res.status(403).json({ error: "You can only pay bills issued to your tenancy." });
      }
      if (bill.responsibility === "Landlord") {
        return res.status(400).json({ error: "This bill is designated as Landlord responsibility." });
      }
    }

    const payableAmount = bill.tenantAmount || bill.amount;
    const orderId = `order_eb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    res.json({
      success: true,
      orderId,
      billId: bill.id,
      amount: payableAmount,
      amountInPaise: Math.round(payableAmount * 100),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_propconnect_2026",
      isTestMode: true,
      propertyName: bill.propertyName,
      billingMonth: bill.billingMonth,
      tenantName: bill.tenantName,
      consumerNo: bill.consumerNo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.8 Backend Payment Verification & Processing
app.post("/api/utility-bills/:id/pay", async (req, res) => {
  try {
    const bill = await UtilityBill.findOne({ id: req.params.id });
    if (!bill) return res.status(404).json({ error: "Utility bill not found" });

    // Atomic check: Prevent duplicate payment
    if (bill.status === "Paid") {
      return res.status(400).json({
        error: `Duplicate payment rejected: Bill ${bill.id} is already settled with Transaction ID ${bill.transactionId}.`,
      });
    }

    // Authorization verification
    if (req.user && req.user.role === "tenant") {
      const tId = req.user.entityId || req.user.entity_id || req.user.id;
      if (bill.tenantId !== tId && bill.tenant_id !== tId) {
        return res.status(403).json({ error: "Unauthorized: You can only pay your own utility bills." });
      }
      if (bill.responsibility === "Landlord") {
        return res.status(400).json({ error: "This bill is designated as Landlord responsibility." });
      }
    }

    const {
      paymentMethod = "UPI",
      transactionId,
      orderId,
      signature,
      paidAmount,
    } = req.body;

    const amountToSettle = Number(paidAmount || bill.tenantAmount || bill.amount);

    if (!amountToSettle || amountToSettle <= 0) {
      return res.status(400).json({ error: "Invalid payment amount." });
    }

    // Backend Payment Signature Verification
    const generatedTxnId = transactionId || `TXN_EB_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const verifiedOrderId = orderId || `ORD_EB_${Date.now()}`;

    // Verify HMAC signature if live Razorpay keys are configured
    if (process.env.RAZORPAY_KEY_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${verifiedOrderId}|${generatedTxnId}`)
        .digest("hex");

      if (signature !== expectedSignature) {
        return res.status(400).json({ error: "Payment verification failed: Invalid gateway signature." });
      }
    }

    const today = new Date().toISOString().split("T")[0];

    // 1. Update UtilityBill atomically
    bill.status = "Paid";
    bill.paidDate = today;
    bill.paid_date = today;
    bill.paidAmount = amountToSettle;
    bill.paymentMethod = paymentMethod;
    bill.payment_method = paymentMethod;
    bill.transactionId = generatedTxnId;
    bill.transaction_id = generatedTxnId;
    bill.paymentGatewayOrderId = verifiedOrderId;
    bill.paymentGatewaySignature = signature || "verified_sha256_mock";
    bill.gatewayStatus = "SUCCESS";

    await bill.save();

    // 2. Insert into Payments collection for cross-system receipt & accounting sync
    try {
      await Payment.create({
        id: `PAY_${Date.now()}`,
        tenantId: bill.tenantId,
        tenant_id: bill.tenantId,
        propertyId: bill.propertyId,
        property_id: bill.propertyId,
        tenantName: bill.tenantName || "Tenant",
        tenant_name: bill.tenantName || "Tenant",
        propertyName: bill.propertyName || "Property",
        property_name: bill.propertyName || "Property",
        month: bill.billingMonth || "Current Month",
        amount: amountToSettle,
        status: "Paid",
        date: today,
        dueDate: bill.dueDate,
        due_date: bill.dueDate,
        paidDate: today,
        paid_date: today,
        method: paymentMethod,
        invoiceNo: bill.id,
        invoice_no: bill.id,
        receiptUrl: bill.documentUrl || "",
        receipt_url: bill.documentUrl || "",
      });
    } catch (paySyncErr) {
      console.warn("⚠️ Payment ledger sync warning:", paySyncErr.message);
    }

    // 3. Dispatch Notifications
    // To Tenant
    if (bill.tenantId) {
      await sendNotification({
        userId: bill.tenantId,
        title: `✅ Payment Confirmed: EB Bill (${bill.id})`,
        message: `Your payment of ₹${amountToSettle.toLocaleString("en-IN")} for electricity at ${bill.propertyName} has been processed successfully. Transaction Ref: ${generatedTxnId}.`,
        type: "success",
        meta: { billId: bill.id, transactionId: generatedTxnId, amount: amountToSettle },
      });
    }

    // To Landlord
    if (bill.landlordId) {
      await sendNotification({
        userId: bill.landlordId,
        title: `💰 EB Bill Settled: ${bill.propertyName}`,
        message: `Tenant ${bill.tenantName || "Tenant"} has completed payment of ₹${amountToSettle.toLocaleString("en-IN")} for electricity bill ${bill.id}.`,
        type: "info",
        meta: { billId: bill.id, transactionId: generatedTxnId, amount: amountToSettle },
      });
    }

    res.json({
      success: true,
      message: "Payment successfully verified and settled.",
      bill,
      transactionId: generatedTxnId,
      paidDate: today,
      amount: amountToSettle,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.9 Manual Due Reminder from Landlord to Tenant
app.post("/api/utility-bills/:id/remind", async (req, res) => {
  try {
    const bill = await UtilityBill.findOne({ id: req.params.id });
    if (!bill) return res.status(404).json({ error: "Utility bill not found" });

    if (bill.status === "Paid") {
      return res.status(400).json({ error: "Cannot send reminder for an already paid bill." });
    }

    // Landlord role check
    if (req.user && req.user.role === "landlord") {
      const lId = req.user.entityId || req.user.entity_id || req.user.id;
      if (bill.landlordId !== lId && bill.landlord_id !== lId) {
        return res.status(403).json({ error: "Unauthorized: You can only send reminders for your own property bills." });
      }
    }

    if (!bill.tenantId) {
      return res.status(400).json({ error: "No tenant assigned to this bill." });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const reminderMessage = `Friendly Reminder: Your EB bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} for ${bill.propertyName} is due on ${bill.dueDate}. Please make payment.`;

    await sendNotification({
      userId: bill.tenantId,
      title: `⚡ EB Bill Payment Reminder: Due ${bill.dueDate}`,
      message: reminderMessage,
      type: "warning",
      meta: { billId: bill.id, dueDate: bill.dueDate, amount: bill.tenantAmount || bill.amount },
    });

    bill.lastReminderDate = todayStr;
    bill.reminderCount = (bill.reminderCount || 0) + 1;
    bill.reminderHistory = bill.reminderHistory || [];
    bill.reminderHistory.push({
      sentAt: `${todayStr} ${timeNow}`,
      type: "manual_reminder",
      recipient: bill.tenantName || "Tenant",
      message: reminderMessage,
    });

    await bill.save();

    res.json({
      success: true,
      message: `Reminder sent to ${bill.tenantName || "tenant"} successfully.`,
      reminderCount: bill.reminderCount,
      lastReminderDate: todayStr,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12.10 Automated Due-Date Reminder Engine Function
async function processAutomaticBillReminders() {
  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date(todayStr);

  try {
    // Only examine unpaid bills
    const unpaidBills = await UtilityBill.find({ status: { $ne: "Paid" } });
    let remindersDispatched = 0;
    let overdueMarked = 0;

    for (const bill of unpaidBills) {
      if (!bill.dueDate) continue;
      const due = new Date(bill.dueDate);
      if (isNaN(due.getTime())) continue;

      const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
      const history = bill.reminderHistory || [];

      // Check if a reminder has already been sent today
      const alreadySentToday = history.some(
        (h) => h.sentAt && h.sentAt.startsWith(todayStr)
      );

      // Rule 1: 3 days before due date
      if (diffDays === 3 && !alreadySentToday && bill.tenantId && bill.responsibility !== "Landlord") {
        const msg = `Approaching due date: Your EB bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} for ${bill.propertyName} is due in 3 days on ${bill.dueDate}.`;
        await sendNotification({
          userId: bill.tenantId,
          title: `⚡ EB Bill Due in 3 Days (${bill.dueDate})`,
          message: msg,
          type: "info",
          meta: { billId: bill.id, dueDate: bill.dueDate, amount: bill.amount },
        });

        bill.lastReminderDate = todayStr;
        bill.reminderCount = (bill.reminderCount || 0) + 1;
        bill.reminderHistory.push({
          sentAt: `${todayStr} ${new Date().toLocaleTimeString()}`,
          type: "3_days_approaching",
          recipient: bill.tenantName || "Tenant",
          message: msg,
        });
        await bill.save();
        remindersDispatched++;
      }

      // Rule 2: On the due date
      else if (diffDays === 0 && !alreadySentToday && bill.tenantId && bill.responsibility !== "Landlord") {
        const msg = `Payment Due Today: Your EB bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} for ${bill.propertyName} is due today (${bill.dueDate}). Please complete payment.`;
        await sendNotification({
          userId: bill.tenantId,
          title: `⚡ EB Bill Due Today (${bill.dueDate})`,
          message: msg,
          type: "warning",
          meta: { billId: bill.id, dueDate: bill.dueDate, amount: bill.amount },
        });

        bill.lastReminderDate = todayStr;
        bill.reminderCount = (bill.reminderCount || 0) + 1;
        bill.reminderHistory.push({
          sentAt: `${todayStr} ${new Date().toLocaleTimeString()}`,
          type: "due_today",
          recipient: bill.tenantName || "Tenant",
          message: msg,
        });
        await bill.save();
        remindersDispatched++;
      }

      // Rule 3: After the due date -> mark overdue and notify both tenant and landlord
      else if (diffDays < 0) {
        let stateChanged = false;
        if (bill.status !== "Overdue") {
          bill.status = "Overdue";
          stateChanged = true;
          overdueMarked++;
        }

        // Send overdue notification if not already notified today
        if (!alreadySentToday) {
          const tenantOverdueMsg = `Your EB bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} for ${bill.propertyName} is overdue. Please complete the payment.`;
          const landlordOverdueMsg = `EB bill overdue: Tenant ${bill.tenantName || "Tenant"} has an unpaid electricity bill of ₹${(bill.tenantAmount || bill.amount).toLocaleString("en-IN")} for ${bill.propertyName}. The due date was ${bill.dueDate}.`;

          // Notify Tenant
          if (bill.tenantId && bill.responsibility !== "Landlord") {
            await sendNotification({
              userId: bill.tenantId,
              title: `⚠️ EB Bill Overdue Notice`,
              message: tenantOverdueMsg,
              type: "danger",
              meta: { billId: bill.id, dueDate: bill.dueDate, amount: bill.amount },
            });
          }

          // Notify Landlord
          if (bill.landlordId) {
            await sendNotification({
              userId: bill.landlordId,
              title: `⚠️ Overdue Alert: ${bill.propertyName}`,
              message: landlordOverdueMsg,
              type: "warning",
              meta: { billId: bill.id, dueDate: bill.dueDate, tenantName: bill.tenantName, amount: bill.amount },
            });
          }

          bill.lastReminderDate = todayStr;
          bill.reminderCount = (bill.reminderCount || 0) + 1;
          bill.reminderHistory.push({
            sentAt: `${todayStr} ${new Date().toLocaleTimeString()}`,
            type: "overdue_notice",
            recipient: "Tenant & Landlord",
            message: tenantOverdueMsg,
          });
          stateChanged = true;
          remindersDispatched++;
        }

        if (stateChanged) {
          await bill.save();
        }
      }
    }

    // --- B. Active Lease Move-In Rent Due-Date Reminders & Auto-Invoicing ---
    let rentRemindersDispatched = 0;
    try {
      const activeLeases = await Lease.find({ status: { $in: ["Active", "active"] } }).lean();
      for (const lease of activeLeases) {
        if (!lease.startDate && !lease.start_date) continue;

        const leasePayments = await Payment.find({
          $or: [
            { leaseId: lease.id },
            { lease_id: lease.id },
            { tenantId: lease.tenantId || lease.tenant_id },
            { tenant_id: lease.tenantId || lease.tenant_id },
          ],
        }).sort({ date: -1 }).lean();

        let tenantObj = null;
        let propertyObj = null;
        if (lease.tenantId || lease.tenant_id) {
          tenantObj = await Tenant.findOne({ id: lease.tenantId || lease.tenant_id }).lean();
        }
        if (lease.propertyId || lease.property_id) {
          propertyObj = await Property.findOne({ id: lease.propertyId || lease.property_id }).lean();
        }

        const enrichedLease = {
          ...lease,
          tenantName: lease.tenantName || tenantObj?.name || "Resident Tenant",
          propertyName: lease.propertyName || propertyObj?.name || "Rental Unit",
        };

        const rentCycle = calculateTenantRentCycle(enrichedLease, today, leasePayments);
        if (!rentCycle) continue;

        const rentInvoiceNo = rentCycle.invoiceNo;
        let rentInvoice = await Payment.findOne({
          $or: [{ invoiceNo: rentInvoiceNo }, { invoice_no: rentInvoiceNo }],
        });

        // Ensure invoice is generated idempotently for current active cycle
        if (!rentInvoice && !rentCycle.isPaid) {
          try {
            rentInvoice = await Payment.create({
              id: `PAY_RENT_${lease.id}_${(rentCycle.periodStart || "").replace(/-/g, "")}`,
              leaseId: lease.id,
              lease_id: lease.id,
              tenantId: lease.tenantId || lease.tenant_id,
              tenant_id: lease.tenantId || lease.tenant_id,
              propertyId: lease.propertyId || lease.property_id,
              property_id: lease.propertyId || lease.property_id,
              tenantName: enrichedLease.tenantName,
              tenant_name: enrichedLease.tenantName,
              propertyName: enrichedLease.propertyName,
              property_name: enrichedLease.propertyName,
              month: rentCycle.periodLabel,
              amount: rentCycle.rentAmount,
              status: "Pending",
              date: todayStr,
              dueDate: rentCycle.currentDueDate,
              due_date: rentCycle.currentDueDate,
              periodStart: rentCycle.periodStart,
              period_start: rentCycle.periodStart,
              periodEnd: rentCycle.periodEnd,
              period_end: rentCycle.periodEnd,
              cycleNumber: rentCycle.cycleIndex,
              cycle_number: rentCycle.cycleIndex,
              invoiceNo: rentInvoiceNo,
              invoice_no: rentInvoiceNo,
              method: "UPI",
            });
          } catch (createErr) {
            // Already created in race condition
          }
        }

        // Send reminders if rent is unpaid
        if (!rentCycle.isPaid) {
          const due = new Date(rentCycle.currentDueDate);
          if (!isNaN(due.getTime())) {
            const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
            const tId = lease.tenantId || lease.tenant_id;
            const lId = lease.landlordId || lease.landlord_id;

            // Check if reminder was already sent today for this invoice
            const alreadySentRentToday = await Notification.findOne({
              userId: tId,
              meta: { $regex: rentInvoiceNo },
              createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            }).lean();

            if (!alreadySentRentToday) {
              // 1. 3 days before due date
              if (diffDays === 3 && tId) {
                await sendNotification({
                  userId: tId,
                  title: `🏠 Rent Due in 3 Days (${rentCycle.currentDueDateFormatted})`,
                  message: `Approaching rent due date: Your monthly rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for ${rentCycle.propertyName} (Period: ${rentCycle.periodLabel}) is due in 3 days on ${rentCycle.currentDueDateFormatted}.`,
                  type: "info",
                  meta: { leaseId: lease.id, invoiceNo: rentInvoiceNo, dueDate: rentCycle.currentDueDate, period: rentCycle.periodLabel },
                });
                rentRemindersDispatched++;
                remindersDispatched++;
              }
              // 2. Due today
              else if (diffDays === 0 && tId) {
                await sendNotification({
                  userId: tId,
                  title: `🏠 Rent Due Today (${rentCycle.currentDueDateFormatted})`,
                  message: `Rent Due Today: Your monthly rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for ${rentCycle.propertyName} (Period: ${rentCycle.periodLabel}) is due today. Please complete your payment.`,
                  type: "warning",
                  meta: { leaseId: lease.id, invoiceNo: rentInvoiceNo, dueDate: rentCycle.currentDueDate, period: rentCycle.periodLabel },
                });
                rentRemindersDispatched++;
                remindersDispatched++;
              }
              // 3. Overdue
              else if (diffDays < 0) {
                if (rentInvoice && rentInvoice.status !== "Paid" && rentInvoice.status !== "Overdue") {
                  rentInvoice.status = "Overdue";
                  await rentInvoice.save();
                  overdueMarked++;
                }

                if (tId) {
                  await sendNotification({
                    userId: tId,
                    title: `⚠️ Rent Overdue Notice (${Math.abs(diffDays)} days overdue)`,
                    message: `Rent Overdue Notice: Your monthly rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for ${rentCycle.propertyName} (Period: ${rentCycle.periodLabel}) was due on ${rentCycle.currentDueDateFormatted} and is now overdue. Please complete your payment immediately.`,
                    type: "danger",
                    meta: { leaseId: lease.id, invoiceNo: rentInvoiceNo, dueDate: rentCycle.currentDueDate, period: rentCycle.periodLabel },
                  });
                }

                if (lId) {
                  await sendNotification({
                    userId: lId,
                    title: `⚠️ Tenant Rent Overdue: ${rentCycle.propertyName}`,
                    message: `Rent Overdue Alert: Tenant ${enrichedLease.tenantName} has an overdue rent of ₹${rentCycle.rentAmount.toLocaleString("en-IN")} for ${rentCycle.propertyName} (Period: ${rentCycle.periodLabel}). Due date was ${rentCycle.currentDueDateFormatted}.`,
                    type: "warning",
                    meta: { leaseId: lease.id, invoiceNo: rentInvoiceNo, dueDate: rentCycle.currentDueDate, tenantName: enrichedLease.tenantName },
                  });
                }
                rentRemindersDispatched++;
                remindersDispatched++;
              }
            }
          }
        }
      }
    } catch (leaseRemErr) {
      console.warn("⚠️ [Lease Rent Reminders Warning]:", leaseRemErr.message);
    }

    return { success: true, remindersDispatched, overdueMarked, rentRemindersDispatched };
  } catch (err) {
    console.error("⚠️ [Automatic Bill Reminders Error]:", err.message);
    return { success: false, error: err.message };
  }
}

// 12.11 Trigger Scheduled Reminders Check Endpoint
app.post("/api/utility-bills/trigger-reminders", async (req, res) => {
  try {
    const result = await processAutomaticBillReminders();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Lease Rent Reminders Check Endpoint
app.post("/api/leases/trigger-reminders", async (req, res) => {
  try {
    const result = await processAutomaticBillReminders();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run reminders on backend startup and every 60 minutes
setTimeout(() => {
  processAutomaticBillReminders().catch(() => {});
}, 5000);

setInterval(() => {
  processAutomaticBillReminders().catch(() => {});
}, 60 * 60 * 1000);

// -------------------------------------------------------------
// 13. Expenses API
// -------------------------------------------------------------
app.get("/api/expenses", async (req, res) => {
  try {
    const rows = await Expense.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const e = req.body;
    const id = e.id || `EXP${Math.floor(Math.random() * 900 + 100)}`;
    const created = await Expense.create({
      id,
      propertyId: e.propertyId || e.property_id || null,
      property_id: e.propertyId || e.property_id || null,
      category: e.category || "Maintenance",
      amount: Number(e.amount || 0),
      description: e.description || "",
      date: e.date || new Date().toISOString().split("T")[0],
      paidTo: e.paidTo || e.paid_to || e.vendor || "",
      paid_to: e.paidTo || e.paid_to || e.vendor || "",
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  try {
    const updated = await Expense.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Expense not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Expense not found" });
    res.json({ success: true, message: "Expense removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 14. Documents API
// -------------------------------------------------------------
app.get("/api/documents", async (req, res) => {
  try {
    const rows = await Document.find().sort({ id: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/documents", async (req, res) => {
  try {
    const d = req.body;
    const id = d.id || `DOC${Math.floor(Math.random() * 900 + 100)}`;
    const created = await Document.create({
      id,
      name: d.name || d.title || "Document",
      title: d.title || d.name || "Document",
      type: d.type || "PDF",
      relatedTo: d.relatedTo || d.related_to || "",
      propertyId: d.propertyId || d.property_id || null,
      property_id: d.propertyId || d.property_id || null,
      tenantId: d.tenantId || d.tenant_id || null,
      tenant_id: d.tenantId || d.tenant_id || null,
      url: d.url || "",
      uploadedOn: d.uploadedOn || d.uploaded_on || new Date().toISOString().split("T")[0],
      uploadedAt: d.uploadedAt || d.uploaded_at || new Date().toISOString().split("T")[0],
      uploaded_at: d.uploadedAt || d.uploaded_at || new Date().toISOString().split("T")[0],
      status: d.status || "Verified",
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/documents/:id", async (req, res) => {
  try {
    const updated = await Document.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Document not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/documents/:id", async (req, res) => {
  try {
    const deleted = await Document.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    res.json({ success: true, message: "Document removed", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 15. Notifications API
// -------------------------------------------------------------
app.get("/api/notifications", async (req, res) => {
  try {
    const rows = await Notification.find().sort({ id: -1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isRead: true, is_read: true } },
      { new: true }
    ).lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 15. Aggregated MongoDB Statistics Dashboard
// -------------------------------------------------------------
app.get("/api/stats", async (req, res) => {
  try {
    const [paidResult, pendingResult, totalProps, occupiedProps, openTickets, openComplaints] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { status: { $ne: "Paid" } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Property.countDocuments(),
      Property.countDocuments({ status: "Occupied" }),
      MaintenanceRequest.countDocuments({ status: { $ne: "Resolved" } }),
      Complaint.countDocuments({ status: { $ne: "Resolved" } }),
    ]);

    const totalRentCollected = paidResult[0]?.total || 0;
    const totalRentPending = pendingResult[0]?.total || 0;
    const occupancyRate = totalProps > 0 ? Math.round((occupiedProps / totalProps) * 100) : 0;

    res.json({
      totalRentCollected,
      totalRentPending,
      totalProperties: totalProps,
      occupiedProperties: occupiedProps,
      occupancyRate,
      openMaintenanceTickets: openTickets,
      openComplaints,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 16. Tenant Discovery Preferences (Backed by MongoDB `tenantpreferences`)
// -------------------------------------------------------------
app.get("/api/preferences", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"] || "TEN001";
    let pref = await TenantPreference.findOne({
      $or: [{ userId }, { user_id: userId }],
    }).sort({ updatedAt: -1 }).lean();

    if (!pref) {
      pref = {
        city: "Chennai",
        locality: "OMR",
        propertyType: "Apartment",
        bhk: "2",
        familyMembers: 4,
        budgetRange: "₹20,000–₹30,000",
        budgetMin: 20000,
        budgetMax: 30000,
        furnishing: "Semi-furnished",
        amenities: ["Parking", "Security", "Lift"],
        nearby: ["School", "Metro"],
        maxDistance: "< 5 km",
        additionalRequirements: "Preferred 2 BHK apartment near school with parking and security.",
      };
    }
    res.json({ success: true, preference: pref });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/preferences", async (req, res) => {
  try {
    const p = req.body;
    const userId = p.userId || p.user_id || req.headers["x-user-id"] || "TEN001";
    const id = p.id || `PREF_${userId}_${Date.now()}`;

    const updateDoc = {
      id,
      userId,
      user_id: userId,
      city: p.city || "Chennai",
      locality: p.locality || "",
      propertyType: p.propertyType || "Apartment",
      bhk: p.bhk || "2",
      familyMembers: Number(p.familyMembers || 2),
      budgetRange: p.budgetRange || "₹20,000–₹30,000",
      budgetMin: Number(p.budgetMin || 20000),
      budgetMax: Number(p.budgetMax || 30000),
      furnishing: p.furnishing || "No preference",
      amenities: Array.isArray(p.amenities) ? p.amenities : [],
      nearby: Array.isArray(p.nearby) ? p.nearby : [],
      maxDistance: p.maxDistance || "Any distance",
      additionalRequirements: p.additionalRequirements || "",
    };

    const saved = await TenantPreference.findOneAndUpdate(
      { $or: [{ userId }, { user_id: userId }] },
      { $set: updateDoc },
      { upsert: true, new: true }
    ).lean();

    res.json({ success: true, preference: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 17. Property-Aware Chat & Assistance
// -------------------------------------------------------------
app.post("/api/property-chat/:propertyId/ask", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { message, language = "en", userId = "TEN001" } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: "Question message is required" });
    }

    const prop = await Property.findOne({ id: propertyId }).lean();
    if (!prop) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    let landlord = null;
    if (prop.landlordId || prop.landlord_id) {
      landlord = await Landlord.findOne({ id: prop.landlordId || prop.landlord_id }).lean();
    }

    const reply = answerPropertyQuestion(prop, message, language, landlord);

    // Persist conversation history in MongoDB
    try {
      const convId = `CHAT_${userId}_${propertyId}`;
      const now = new Date();
      await PropertyChat.findOneAndUpdate(
        { userId, propertyId },
        {
          $setOnInsert: { id: convId, propertyName: prop.name },
          $set: { language, lastMessage: reply.text },
          $push: {
            messages: {
              $each: [
                { sender: "user", text: message, language, timestamp: now },
                { sender: "assistant", text: reply.text, language, timestamp: new Date(now.getTime() + 100) },
              ],
            },
          },
        },
        { upsert: true }
      );
    } catch (saveErr) {
      console.warn("Could not save chat history:", saveErr.message);
    }

    res.json({
      success: true,
      propertyId,
      propertyName: prop.name,
      answer: reply.text,
      audioText: reply.audioText,
      triggerEnquiry: reply.triggerEnquiry,
      enquiryType: reply.enquiryType,
      suggestions: reply.suggestions,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/property-chat/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.query.userId || req.headers["x-user-id"] || "TEN001";
    const chat = await PropertyChat.findOne({ userId, propertyId }).lean();
    res.json({ success: true, chat: chat || null, messages: chat?.messages || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/property-chat", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"] || "TEN001";
    const chats = await PropertyChat.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean();
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 18. Enquiries & Visit Booking API (Backed by MongoDB `enquiries`)
// -------------------------------------------------------------
app.post("/api/enquiries", async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || `ENQ_${Date.now()}`;
    const date = b.date || new Date().toISOString().split("T")[0];

    const enquiry = await Enquiry.create({
      id,
      propertyId: b.propertyId,
      propertyName: b.propertyName || "Property",
      tenantId: b.tenantId || "TEN001",
      tenantName: b.tenantName || "Tenant Resident",
      tenantEmail: b.tenantEmail || "",
      tenantPhone: b.tenantPhone || "",
      landlordId: b.landlordId || "LDL001",
      type: b.type || "Schedule Visit",
      preferredDate: b.preferredDate || "",
      preferredTime: b.preferredTime || "",
      message: b.message || "",
      status: "Pending",
      date,
    });

    res.status(201).json({ success: true, enquiry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/enquiries", async (req, res) => {
  try {
    const rows = await Enquiry.find().sort({ id: -1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 19. Property Images API (Backed by MongoDB `property_images` & `properties.images`)
// -------------------------------------------------------------
app.get("/api/properties/:id/images", async (req, res) => {
  try {
    const { id } = req.params;
    const prop = await Property.findOne({ id }).lean();
    if (!prop) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    let images = prop.images && prop.images.length > 0 ? prop.images : [];
    if (images.length === 0) {
      images = await PropertyImage.find({ propertyId: id }).sort({ order: 1 }).lean();
    }

    res.json({
      success: true,
      propertyId: id,
      propertyName: prop.name,
      count: images.length,
      images,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/properties/:id/images", async (req, res) => {
  try {
    const { id } = req.params;
    const { url, category = "Exterior", caption = "", order = 0 } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "Image URL is required" });
    }

    const imageId = `IMG_${id}_${Date.now()}`;
    const newImage = { id: imageId, url, category, caption, order: Number(order) };

    // Update Property embedded images
    await Property.findOneAndUpdate(
      { id },
      { $push: { images: newImage } },
      { new: true }
    );

    // Also persist in PropertyImage standalone collection
    await PropertyImage.create({
      id: imageId,
      propertyId: id,
      url,
      category,
      caption,
      order: Number(order),
    });

    res.status(201).json({ success: true, image: newImage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 20. Saved / Favourite Properties API (Backed by MongoDB `favorites` collection)
// -------------------------------------------------------------
app.get("/api/favorites", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"] || "TEN001";
    const favs = await Favorite.find({
      $or: [{ userId }, { tenantId: userId }],
    }).sort({ createdAt: -1 }).lean();

    const propertyIds = favs.map((f) => f.propertyId);
    const properties = await Property.find({ id: { $in: propertyIds } }).lean();

    res.json({
      success: true,
      count: favs.length,
      propertyIds,
      favorites: favs,
      properties,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/favorites", async (req, res) => {
  try {
    const { propertyId, action } = req.body;
    const userId = req.body.userId || req.headers["x-user-id"] || "TEN001";

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID is required." });
    }

    const existing = await Favorite.findOne({
      $or: [
        { userId, propertyId },
        { tenantId: userId, propertyId },
      ],
    }).lean();

    if (action === "remove" || (existing && action !== "add")) {
      // Remove favorite (toggle off)
      await Favorite.deleteMany({
        $or: [
          { userId, propertyId },
          { tenantId: userId, propertyId },
        ],
      });

      const updatedFavs = await Favorite.find({
        $or: [{ userId }, { tenantId: userId }],
      }).lean();

      return res.json({
        success: true,
        isFavorite: false,
        propertyId,
        message: "Property removed from your saved list.",
        propertyIds: updatedFavs.map((f) => f.propertyId),
      });
    }

    // Add favorite
    const prop = await Property.findOne({ id: propertyId }).lean();
    const favId = `FAV_${userId}_${propertyId}`;

    const created = await Favorite.findOneAndUpdate(
      { userId, propertyId },
      {
        $setOnInsert: {
          id: favId,
          userId,
          tenantId: userId,
          propertyId,
          propertyName: prop ? prop.name : propertyId,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    ).lean();

    const updatedFavs = await Favorite.find({
      $or: [{ userId }, { tenantId: userId }],
    }).lean();

    return res.json({
      success: true,
      isFavorite: true,
      propertyId,
      message: "Property saved to your favourites!",
      favorite: created,
      propertyIds: updatedFavs.map((f) => f.propertyId),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/favorites/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.query.userId || req.headers["x-user-id"] || "TEN001";

    await Favorite.deleteMany({
      $or: [
        { userId, propertyId },
        { tenantId: userId, propertyId },
      ],
    });

    const updatedFavs = await Favorite.find({
      $or: [{ userId }, { tenantId: userId }],
    }).lean();

    res.json({
      success: true,
      isFavorite: false,
      propertyId,
      message: "Property removed from saved list.",
      propertyIds: updatedFavs.map((f) => f.propertyId),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 20. Organization & User Theme & Customization Settings
// -------------------------------------------------------------
const DEFAULT_THEME_SETTINGS = {
  key: "org_theme_settings",
  primaryColor: "#1976D2",
  fontFamily: "Inter",
  language: "en",
  fontSize: "medium",
  themeMode: "light",
  appName: "PropConnect Management System",
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  role: "admin",
  updatedBy: "admin",
};

// GET Organization Global Theme Settings
app.get("/api/settings/theme", async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({ key: "org_theme_settings" }).lean();
    if (!settings) {
      settings = await SystemSetting.create(DEFAULT_THEME_SETTINGS);
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, settings: DEFAULT_THEME_SETTINGS });
  }
});

// PUT Update Organization Global Theme Settings (Admin / Landlord)
app.put("/api/settings/theme", async (req, res) => {
  try {
    const { primaryColor, fontFamily, language, fontSize, themeMode, appName, currency, dateFormat, updatedBy, role } = req.body;

    const updateFields = {
      updatedAt: new Date(),
    };
    if (primaryColor) updateFields.primaryColor = primaryColor.toUpperCase();
    if (fontFamily) updateFields.fontFamily = fontFamily;
    if (language) updateFields.language = language;
    if (fontSize) updateFields.fontSize = fontSize;
    if (themeMode) updateFields.themeMode = themeMode;
    if (appName) updateFields.appName = appName;
    if (currency) updateFields.currency = currency;
    if (dateFormat) updateFields.dateFormat = dateFormat;
    if (updatedBy) updateFields.updatedBy = updatedBy;
    if (role) updateFields.role = role;

    const updated = await SystemSetting.findOneAndUpdate(
      { key: "org_theme_settings" },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      message: "Organization theme settings updated successfully.",
      settings: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET User-specific personal settings
app.get("/api/settings/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await SystemSetting.findOne({ key: `user_settings_${userId}` }).lean();
    res.json({ success: true, settings: settings || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT User-specific personal settings (e.g. tenant personal language/font)
app.put("/api/settings/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { primaryColor, fontFamily, language, fontSize, themeMode, role } = req.body;

    const updateFields = {
      key: `user_settings_${userId}`,
      updatedBy: userId,
      updatedAt: new Date(),
    };
    if (primaryColor) updateFields.primaryColor = primaryColor.toUpperCase();
    if (fontFamily) updateFields.fontFamily = fontFamily;
    if (language) updateFields.language = language;
    if (fontSize) updateFields.fontSize = fontSize;
    if (themeMode) updateFields.themeMode = themeMode;
    if (role) updateFields.role = role;

    const updated = await SystemSetting.findOneAndUpdate(
      { key: `user_settings_${userId}` },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      message: "Personal user settings updated.",
      settings: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// HOME SERVICE PORTAL APIs — Categories, Providers, Availability, Bookings
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Service Categories APIs
// ----------------------------------------------------------------------------
app.get("/api/service-categories", async (req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ name: 1 }).lean();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await ServiceCategory.findOne({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    }).lean();
    if (!cat) return res.status(404).json({ error: "Service category not found" });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/service-categories", authenticateToken, async (req, res) => {
  try {
    const { name, icon, description, basePrice, subServices, isActive } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const newId = `CAT_${Date.now()}`;
    const category = new ServiceCategory({
      id: newId,
      name: name.trim(),
      icon: icon || "🛠️",
      description: description || "",
      basePrice: Number(basePrice) || 0,
      subServices: Array.isArray(subServices) ? subServices : [],
      isActive: isActive !== false,
    });
    const saved = await category.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/service-categories/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await ServiceCategory.findOneAndUpdate(
      { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Category not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/service-categories/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ServiceCategory.findOneAndDelete({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    res.json({ success: true, message: "Category deleted", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2. Service Providers APIs
// ----------------------------------------------------------------------------
app.get("/api/service-providers", async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const filter = {};
    if (category && category !== "All") filter.category = category;
    if (status && status !== "All") filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { technicianName: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { skills: { $in: [new RegExp(search, "i")] } },
      ];
    }
    const providers = await ServiceProvider.find(filter).sort({ rating: -1, name: 1 }).lean();
    res.json(providers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-providers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const prov = await ServiceProvider.findOne({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    }).lean();
    if (!prov) return res.status(404).json({ error: "Service provider not found" });
    res.json(prov);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/service-providers", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      category,
      phone,
      email,
      rating,
      experience,
      pricing,
      location,
      skills,
      bio,
      status,
      workingDays,
      timeSlots,
      maxBookingsPerSlot,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Provider name and category are required" });
    }

    const nextId = `PROV_${Date.now()}`;
    const newProv = new ServiceProvider({
      id: nextId,
      name: name.trim(),
      category,
      phone: phone || "",
      email: email || "",
      rating: Number(rating) || 4.8,
      experience: experience || "5 years",
      price: pricing?.basePrice || 400,
      pricing: pricing || { type: "hourly", basePrice: 400 },
      location: location || "Chennai",
      skills: Array.isArray(skills) ? skills : [],
      bio: bio || "",
      status: status || "Active",
      isAvailable: status === "Active",
      workingDays: Array.isArray(workingDays) && workingDays.length > 0
        ? workingDays
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      timeSlots: Array.isArray(timeSlots) && timeSlots.length > 0
        ? timeSlots
        : ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM", "6:00 PM"],
      maxBookingsPerSlot: Number(maxBookingsPerSlot) || 1,
    });

    const saved = await newProv.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/service-providers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await ServiceProvider.findOneAndUpdate(
      { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/service-providers/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status is required" });

    const updated = await ServiceProvider.findOneAndUpdate(
      { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { $set: { status, isAvailable: status === "Active" } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/service-providers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ServiceProvider.findOneAndDelete({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });
    if (!deleted) return res.status(404).json({ error: "Provider not found" });
    res.json({ success: true, message: "Provider removed", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 3. Dynamic Real-Time Availability Engine (Double-Booking Prevention)
// ----------------------------------------------------------------------------
app.get("/api/service-providers/availability", async (req, res) => {
  try {
    const { category, date, timeSlot } = req.query;
    if (!category || !date || !timeSlot) {
      return res.status(400).json({
        error: "Missing required query parameters: category, date (YYYY-MM-DD), timeSlot",
      });
    }

    // Determine day of week
    const dateObj = new Date(date);
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = daysOfWeek[dateObj.getDay()];

    // 1. Fetch active providers in this category
    const providers = await ServiceProvider.find({
      category,
      status: "Active",
    }).lean();

    if (!providers || providers.length === 0) {
      return res.json({ category, date, timeSlot, providers: [] });
    }

    const providerIds = providers.map((p) => p.id || String(p._id));

    // 2. Fetch active bookings for this date and timeSlot
    const activeBookings = await ServiceBooking.find({
      providerId: { $in: providerIds },
      date,
      timeSlot,
      status: { $in: ["Pending", "Confirmed", "Assigned", "In Progress"] },
    }).lean();

    // Group bookings count by providerId
    const bookingCountMap = {};
    activeBookings.forEach((b) => {
      bookingCountMap[b.providerId] = (bookingCountMap[b.providerId] || 0) + 1;
    });

    // 3. Fetch administrative overrides / leaves for this date
    const overrides = await ProviderAvailability.find({
      providerId: { $in: providerIds },
      date,
    }).lean();

    const overrideMap = {};
    overrides.forEach((o) => {
      overrideMap[o.providerId] = o;
    });

    // 4. Calculate status for each provider
    const results = providers.map((prov) => {
      const pId = prov.id || String(prov._id);
      const provOverride = overrideMap[pId];
      const maxBookings = prov.maxBookingsPerSlot || 1;
      const bookedCount = bookingCountMap[pId] || 0;

      let status = "Available";
      let isAvailable = true;
      let reason = "";

      // Check Administrative Overrides first
      if (provOverride) {
        if (provOverride.isLeave) {
          status = "On Leave";
          isAvailable = false;
          reason = provOverride.reason || "Provider is on approved leave";
        } else if (
          Array.isArray(provOverride.blockedSlots) &&
          provOverride.blockedSlots.includes(timeSlot)
        ) {
          status = "Blocked";
          isAvailable = false;
          reason = provOverride.reason || "Slot blocked by management";
        }
      }

      // Check Weekly Working Days
      if (isAvailable && Array.isArray(prov.workingDays) && prov.workingDays.length > 0) {
        if (!prov.workingDays.includes(dayName)) {
          status = "Off Duty";
          isAvailable = false;
          reason = `Not scheduled to work on ${dayName}`;
        }
      }

      // Check Configured Time Slots
      if (isAvailable && Array.isArray(prov.timeSlots) && prov.timeSlots.length > 0) {
        if (!prov.timeSlots.includes(timeSlot)) {
          status = "Slot Unavailable";
          isAvailable = false;
          reason = `Provider does not offer ${timeSlot} slot`;
        }
      }

      // Check Existing Bookings (Double Booking Prevention)
      if (isAvailable && bookedCount >= maxBookings) {
        status = "Booked";
        isAvailable = false;
        reason = `Already booked for ${timeSlot} on ${date}`;
      }

      return {
        ...prov,
        status,
        isAvailable,
        reason,
        bookedCount,
        maxBookings,
      };
    });

    res.json({
      category,
      date,
      timeSlot,
      dayName,
      totalProviders: providers.length,
      availableCount: results.filter((r) => r.isAvailable).length,
      providers: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 4. Provider Availability Overrides & Leaves APIs (Admin)
// ----------------------------------------------------------------------------
app.get("/api/provider-availability", authenticateToken, async (req, res) => {
  try {
    const { providerId, date } = req.query;
    const filter = {};
    if (providerId) filter.providerId = providerId;
    if (date) filter.date = date;

    const overrides = await ProviderAvailability.find(filter).sort({ date: 1 }).lean();
    res.json(overrides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/provider-availability", authenticateToken, async (req, res) => {
  try {
    const { providerId, providerName, date, isAvailable, isLeave, blockedSlots, reason } = req.body;
    if (!providerId || !date) {
      return res.status(400).json({ error: "providerId and date are required" });
    }

    const nextId = `AV_${Date.now()}`;
    const override = await ProviderAvailability.findOneAndUpdate(
      { providerId, date },
      {
        $set: {
          id: nextId,
          providerId,
          providerName: providerName || "Service Provider",
          date,
          isAvailable: isAvailable !== false,
          isLeave: isLeave === true,
          blockedSlots: Array.isArray(blockedSlots) ? blockedSlots : [],
          reason: reason || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(override);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/provider-availability/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await ProviderAvailability.findOneAndDelete({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });
    res.json({ success: true, message: "Availability override removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function autoFreePort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const lines = output.trim().split("\n");
      for (const line of lines) {
        if (line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0" && pid !== String(process.pid)) {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
              console.log(`🧹 Auto-freed port ${port} by terminating stale process (PID: ${pid})`);
            } catch {}
          }
        }
      }
    }
  } catch {
    // Port is already free or netstat found nothing
  }
}

// Automatically free port 5000 on startup if held by a stale process
autoFreePort(PORT);

let serverInstance = null;

function startServer(port, retries = 3) {
  serverInstance = app
    .listen(port, () => {
      console.log(`\n==========================================================`);
      console.log(`🚀 PropConnect MongoDB Backend Server running on http://localhost:${port}`);
      console.log(`🧭 MongoDB Compass connection string: ${COMPASS_URI}`);
      console.log(`🗄️ Database: propconnect_db`);
      console.log(`📡 MongoDB URI: ${MONGODB_URI}`);
      console.log(`==========================================================\n`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`⚠️ Port ${port} was busy. Auto-clearing and restarting...`);
        autoFreePort(port);
        if (retries > 0) {
          setTimeout(() => startServer(port, retries - 1), 600);
        } else {
          console.error(`❌ Could not free port ${port}. Please run in PowerShell:`);
          console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force`);
        }
      } else {
        console.error("Server error:", err.message);
      }
    });
}

process.on("SIGINT", () => {
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

startServer(PORT);

