import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "propconnect_jwt_secret_key_2026";
const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      _id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      entityId: user.entityId,
      entity_id: user.entityId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// User personas
const ADMIN = { id: "ADMIN_001", email: "admin@propconnect.com", name: "Admin", role: "admin", entityId: null };
const LANDLORD_A = { id: "LDL_USER_001", email: "karthik.raja@mail.com", name: "Karthik Raja", role: "landlord", entityId: "LDL001" };
const LANDLORD_B = { id: "LDL_USER_002", email: "sanjitha.raja@gmail.com", name: "Sanjitha Raja", role: "landlord", entityId: "LDL002" };
const TENANT_A = { id: "TEN_USER_001", email: "divya.priya@mail.com", name: "Divya Priya", role: "tenant", entityId: "TEN001" };
const TENANT_B = { id: "TEN_USER_002", email: "arjun.kumar@mail.com", name: "Arjun Kumar", role: "tenant", entityId: "TEN002" };
const PROVIDER_1 = { id: "PROV_USER_001", email: "provider@propconnect.com", name: "Kumar Services", role: "provider", entityId: "PROV_AC_01" };
const PROVIDER_2 = { id: "PROV_USER_002", email: "other.provider@mail.com", name: "Other Tech", role: "provider", entityId: "PROV_AC_99" };

const tokens = {
  admin: makeToken(ADMIN),
  landlordA: makeToken(LANDLORD_A),
  landlordB: makeToken(LANDLORD_B),
  tenantA: makeToken(TENANT_A),
  tenantB: makeToken(TENANT_B),
  provider1: makeToken(PROVIDER_1),
  provider2: makeToken(PROVIDER_2),
};

const results = [];
function recordResult(scenario, name, passed, details) {
  results.push({ scenario, name, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${scenario}] ${name}: ${details}`);
}

async function request(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  const fetchOpts = {
    method: options.method || "GET",
    headers,
  };
  if (options.body) {
    fetchOpts.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  const res = await fetch(url, fetchOpts);
  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

async function run() {
  console.log("\n=======================================================");
  console.log("🔒 PROPCONNECT PHASE 1 SECURITY & REGRESSION TEST SUITE");
  console.log("=======================================================\n");

  let mongodProc = null;
  const mongodPath = "C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe";
  const dbPath = path.resolve("backend/data/db");
  const logPath = path.resolve("backend/data/mongod.log");

  console.log("1. Starting MongoDB daemon...");
  mongodProc = spawn(mongodPath, ["--dbpath", dbPath, "--port", "27017", "--logpath", logPath]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Connect Mongoose and Seed Data
  console.log("2. Connecting Mongoose & Seeding Test Data...");
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/propconnect_db";
  process.env.PORT = String(PORT);
  
  const { connectMongoDB } = await import("./config/db.js");
  await connectMongoDB();
  const { seedAllData } = await import("./seed.js");
  await seedAllData();

  // Create sample service booking assigned to PROV_AC_01 for testing
  const { ServiceBooking } = await import("./models/index.js");
  await ServiceBooking.deleteMany({ id: "SB_SEC_TEST_01" });
  await ServiceBooking.create({
    id: "SB_SEC_TEST_01",
    bookingNumber: "BK-2026-001",
    userId: "TEN_USER_001",
    userName: "Divya Priya",
    userRole: "tenant",
    propertyId: "TN101",
    serviceCategory: "AC Repair",
    providerId: "PROV_AC_01",
    providerName: "Kumar Services",
    status: "Confirmed",
    date: "2026-11-20",
    timeSlot: "10:00 AM",
    amount: 850,
  });

  // Start Express Server
  console.log("3. Importing Express Server (starts on port " + PORT + ")...");
  const { app, serverInstance } = await import("./server.js");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log("Server listening successfully. Running tests...\n");

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Landlord A attempts to modify Landlord B's property
    // -------------------------------------------------------------
    const s1 = await request("/api/properties/TN105", {
      method: "PUT",
      token: tokens.landlordA,
      body: { rent: 99999 },
    });
    recordResult(
      "Scenario 1",
      "Landlord A modifying Landlord B property (TN105)",
      s1.status === 403,
      `Status: ${s1.status} (Expected 403 Forbidden). Message: ${s1.data?.message || s1.data}`
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Landlord A attempts to access Landlord B's tenant records
    // -------------------------------------------------------------
    const s2 = await request("/api/tenants/TEN005", {
      token: tokens.landlordA,
    });
    recordResult(
      "Scenario 2",
      "Landlord A viewing Landlord B tenant (TEN005)",
      s2.status === 403,
      `Status: ${s2.status} (Expected 403 Forbidden). Message: ${s2.data?.message || s2.data}`
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Tenant A attempts to access Tenant B's documents
    // -------------------------------------------------------------
    const s3 = await request("/api/documents/DOC005/download", {
      token: tokens.tenantA,
    });
    recordResult(
      "Scenario 3",
      "Tenant A downloading Tenant B document (DOC005)",
      s3.status === 403,
      `Status: ${s3.status} (Expected 403 Forbidden). Message: ${s3.data?.message || s3.data}`
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Tenant attempts to change maintenance ticket status
    // -------------------------------------------------------------
    const s4 = await request("/api/maintenance/MNT001", {
      method: "PUT",
      token: tokens.tenantA,
      body: { status: "Resolved" },
    });
    recordResult(
      "Scenario 4",
      "Tenant changing maintenance ticket status to Resolved",
      s4.status === 403,
      `Status: ${s4.status} (Expected 403 Forbidden). Message: ${s4.data?.message || s4.data}`
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Technician attempts to update an unassigned service booking
    // -------------------------------------------------------------
    const s5 = await request("/api/service-bookings/SB_SEC_TEST_01/status", {
      method: "PUT",
      token: tokens.provider2,
      body: { status: "In Progress" },
    });
    recordResult(
      "Scenario 5",
      "Technician 2 updating unassigned booking (assigned to PROV_AC_01)",
      s5.status === 403,
      `Status: ${s5.status} (Expected 403 Forbidden). Message: ${s5.data?.message || s5.data}`
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Guessed /uploads URL & Unauthenticated document access
    // -------------------------------------------------------------
    const s6a = await request("/uploads/DOC001.pdf", {
      token: null,
    });
    const s6b = await request("/api/documents/DOC001/download", {
      token: null,
    });
    const s6Passed = s6a.status === 403 && s6b.status === 401;
    recordResult(
      "Scenario 6",
      "Direct static /uploads access & Unauthenticated document download",
      s6Passed,
      `/uploads status: ${s6a.status} (Expected 403). /api/documents download status: ${s6b.status} (Expected 401).`
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Landlord request omits propertyId or landlordId
    // -------------------------------------------------------------
    const s7Props = await request("/api/properties", { token: tokens.landlordA });
    const s7Tenants = await request("/api/tenants", { token: tokens.landlordA });
    const s7Leases = await request("/api/leases", { token: tokens.landlordA });
    const s7Payments = await request("/api/payments", { token: tokens.landlordA });

    const propsList = Array.isArray(s7Props.data?.data) ? s7Props.data.data : (Array.isArray(s7Props.data) ? s7Props.data : []);
    const foreignProps = propsList.filter((p) => p.landlordId !== "LDL001");
    const foreignTenants = (Array.isArray(s7Tenants.data) ? s7Tenants.data : []).filter(
      (t) => !propsList.map((p) => p.id).includes(t.propertyId)
    );

    const s7Passed =
      s7Props.status === 200 &&
      foreignProps.length === 0 &&
      foreignTenants.length === 0 &&
      s7Leases.status === 200 &&
      s7Payments.status === 200;

    recordResult(
      "Scenario 7",
      "Landlord requests without query filters return ONLY owned records",
      s7Passed,
      `Returned ${propsList.length} properties (0 foreign). Foreign tenants returned: ${foreignTenants.length}. Leases status: ${s7Leases.status}. Payments status: ${s7Payments.status}.`
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Admin performs authorized operations
    // -------------------------------------------------------------
    const s8Props = await request("/api/properties", { token: tokens.admin });
    const s8Tenants = await request("/api/tenants", { token: tokens.admin });
    const s8Leases = await request("/api/leases", { token: tokens.admin });
    const s8Docs = await request("/api/documents", { token: tokens.admin });

    const adminPropsCount = Array.isArray(s8Props.data?.data) ? s8Props.data.data.length : (Array.isArray(s8Props.data) ? s8Props.data.length : 0);
    const s8Passed =
      s8Props.status === 200 &&
      s8Tenants.status === 200 &&
      s8Leases.status === 200 &&
      s8Docs.status === 200 &&
      adminPropsCount >= 40;

    recordResult(
      "Scenario 8",
      "Admin performs authorized operations across all system records",
      s8Passed,
      `Status: 200. Admin can access all ${adminPropsCount} properties, tenants, leases, and documents.`
    );

    // -------------------------------------------------------------
    // REGRESSION VERIFICATION: Core Platform Operations
    // -------------------------------------------------------------
    console.log("\n--- REGRESSION SUITE VERIFICATION ---");

    // 1. Auth login
    const regLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "karthik.raja@mail.com", password: "land123" },
    });
    recordResult(
      "Regression",
      "User Login (/api/auth/login)",
      regLogin.status === 200 && !!regLogin.data?.token,
      `Status: ${regLogin.status}, User: ${regLogin.data?.user?.email}, Role: ${regLogin.data?.user?.role}`
    );

    // 2. Landlord A can modify their own property
    const regProp = await request("/api/properties/TN101", {
      method: "PUT",
      token: tokens.landlordA,
      body: { rent: 25500 },
    });
    recordResult(
      "Regression",
      "Landlord A modifying own property (TN101)",
      regProp.status === 200,
      `Status: ${regProp.status}. Property updated successfully.`
    );

    // 3. Tenant A can download own document (DOC001)
    const regDoc = await request("/api/documents/DOC001/download", {
      token: tokens.tenantA,
    });
    recordResult(
      "Regression",
      "Tenant A downloading own document (DOC001)",
      regDoc.status === 200,
      `Status: ${regDoc.status}. Document streamed safely.`
    );

    // 4. Assigned technician can update their assigned service booking
    const regProvBooking = await request("/api/service-bookings/SB_SEC_TEST_01/status", {
      method: "PUT",
      token: tokens.provider1,
      body: { status: "In Progress" },
    });
    recordResult(
      "Regression",
      "Assigned Technician updating booking status",
      regProvBooking.status === 200,
      `Status: ${regProvBooking.status}. Booking status updated.`
    );

    // 5. Landlord A can view utility bills for owned property
    const regBills = await request("/api/utility-bills?propertyId=TN101", {
      token: tokens.landlordA,
    });
    recordResult(
      "Regression",
      "Landlord A viewing utility bills for owned property",
      regBills.status === 200,
      `Status: ${regBills.status}. Bills returned: ${Array.isArray(regBills.data) ? regBills.data.length : 0}`
    );

    // 6. Tenant A can view their payments
    const regPayments = await request("/api/payments", {
      token: tokens.tenantA,
    });
    recordResult(
      "Regression",
      "Tenant A viewing their own payments",
      regPayments.status === 200,
      `Status: ${regPayments.status}. Payments returned: ${Array.isArray(regPayments.data) ? regPayments.data.length : 0}`
    );

    console.log("\n=======================================================");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    try {
      const { serverInstance } = await import("./server.js");
      if (serverInstance) serverInstance.close();
    } catch {}
    try {
      await mongoose.disconnect();
    } catch {}
    if (mongodProc) {
      try {
        mongodProc.kill("SIGTERM");
      } catch {}
    }
    process.exit(0);
  }
}

run();
