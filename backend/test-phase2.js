import { spawn } from "child_process";
import path from "path";
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

const ADMIN = { id: "ADMIN_001", email: "admin@propconnect.com", name: "Admin", role: "admin", entityId: null };
const LANDLORD_A = { id: "LDL_USER_001", email: "karthik.raja@mail.com", name: "Karthik Raja", role: "landlord", entityId: "LDL001" };
const LANDLORD_B = { id: "LDL_USER_002", email: "sanjitha.raja@gmail.com", name: "Sanjitha Raja", role: "landlord", entityId: "LDL002" };
const TENANT_A = { id: "TEN_USER_001", email: "divya.priya@mail.com", name: "Divya Priya", role: "tenant", entityId: "TEN001" };

const tokens = {
  admin: makeToken(ADMIN),
  landlordA: makeToken(LANDLORD_A),
  landlordB: makeToken(LANDLORD_B),
  tenantA: makeToken(TENANT_A),
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
  console.log("📑 PROPCONNECT PHASE 2 LEASE & AGREEMENT TEST SUITE");
  console.log("=======================================================\n");

  let mongodProc = null;
  const mongodPath = "C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe";
  const dbPath = path.resolve("backend/data/db");
  const logPath = path.resolve("backend/data/mongod.log");

  console.log("1. Starting MongoDB daemon...");
  mongodProc = spawn(mongodPath, ["--dbpath", dbPath, "--port", "27017", "--logpath", logPath]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("2. Connecting Mongoose & Seeding Test Data...");
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/propconnect_db";
  process.env.PORT = String(PORT);

  const { connectMongoDB } = await import("./config/db.js");
  await connectMongoDB();
  const { seedAllData } = await import("./seed.js");
  await seedAllData();

  console.log("3. Importing Express Server on port", PORT, "...");
  const { app, serverInstance } = await import("./server.js");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log("Server listening successfully. Running tests...\n");

  try {
    // -------------------------------------------------------------
    // Test 1: Landlord A lists leases (scoped to owned properties)
    // -------------------------------------------------------------
    const t1 = await request("/api/leases", { token: tokens.landlordA });
    const leasesList = Array.isArray(t1.data) ? t1.data : [];
    const t1Passed = t1.status === 200 && leasesList.length > 0 && leasesList.every((l) => l.landlordId === "LDL001");
    recordResult(
      "Test 1",
      "Landlord A listing scoped leases",
      t1Passed,
      `Status: ${t1.status}, Leases count: ${leasesList.length}. All owned by LDL001.`
    );

    // Pick a test lease owned by LDL001
    const testLease = leasesList[0];
    const leaseId = testLease ? testLease.id : "LSE001";

    // -------------------------------------------------------------
    // Test 2: Landlord A sends renewal reminder
    // -------------------------------------------------------------
    const t2 = await request(`/api/leases/${leaseId}/remind-renewal`, {
      method: "POST",
      token: tokens.landlordA,
      body: { notes: "Please confirm your intention to renew for the upcoming year." },
    });
    const t2Passed = t2.status === 200 && t2.data?.lease?.renewalStatus === "Reminder Sent";
    recordResult(
      "Test 2",
      "Landlord A sending renewal reminder",
      t2Passed,
      `Status: ${t2.status}, RenewalStatus: ${t2.data?.lease?.renewalStatus}`
    );

    // -------------------------------------------------------------
    // Test 3: Landlord A initiates renewal (updates term & logs agreementHistory)
    // -------------------------------------------------------------
    const t3 = await request(`/api/leases/${leaseId}/renew`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        newStartDate: "2027-01-01",
        newEndDate: "2027-12-01",
        newMonthlyRent: 26000,
        termMonths: 11,
        notes: "Renewed with standard 5% escalation",
      },
    });
    const t3Passed =
      t3.status === 200 &&
      t3.data?.lease?.monthlyRent === 26000 &&
      t3.data?.lease?.renewalStatus === "Renewed" &&
      Array.isArray(t3.data?.lease?.agreementHistory) &&
      t3.data?.lease?.agreementHistory.length > 0;
    recordResult(
      "Test 3",
      "Landlord A executing lease renewal with version logging",
      t3Passed,
      `Status: ${t3.status}, New Rent: ₹${t3.data?.lease?.monthlyRent}, History entries: ${t3.data?.lease?.agreementHistory?.length}`
    );

    // -------------------------------------------------------------
    // Test 4: Landlord A records Move-In Inspection
    // -------------------------------------------------------------
    const t4 = await request(`/api/leases/${leaseId}/inspection`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        type: "moveIn",
        inspectionData: {
          condition: "Excellent",
          notes: "Brand new paint, zero pre-existing scratches.",
          checklist: [
            { room: "Living Room", item: "Flooring & switches", status: "Pass" },
            { room: "Master Bedroom", item: "Wardrobes & AC point", status: "Pass" },
          ],
        },
      },
    });
    const t4Passed = t4.status === 200 && t4.data?.lease?.moveInInspection?.status === "Completed";
    recordResult(
      "Test 4",
      "Landlord A recording official Move-In Inspection",
      t4Passed,
      `Status: ${t4.status}, Condition: ${t4.data?.lease?.moveInInspection?.condition}`
    );

    // -------------------------------------------------------------
    // Test 5: Landlord A records Move-Out Inspection & Deposit Settlement
    // -------------------------------------------------------------
    const t5 = await request(`/api/leases/${leaseId}/inspection`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        type: "moveOut",
        inspectionData: {
          condition: "Good",
          damageNotes: "Minor hairline mark on balcony tile.",
          pendingDues: 2500,
          estimatedDamageCost: 1500,
          depositSettlementRef: `DEP-SETTLE-${leaseId}`,
          settleDeposit: true,
        },
      },
    });
    const t5Passed =
      t5.status === 200 &&
      t5.data?.lease?.moveOutInspection?.settlementStatus === "Settled" &&
      t5.data?.lease?.moveOutInspection?.pendingDues === 2500;
    recordResult(
      "Test 5",
      "Landlord A recording Move-Out Inspection & authorized settlement",
      t5Passed,
      `Status: ${t5.status}, SettlementStatus: ${t5.data?.lease?.moveOutInspection?.settlementStatus}, Dues: ₹${t5.data?.lease?.moveOutInspection?.pendingDues}`
    );

    // -------------------------------------------------------------
    // Test 6: Security RBAC - Landlord B attempting to modify Landlord A's lease
    // -------------------------------------------------------------
    const t6 = await request(`/api/leases/${leaseId}/renew`, {
      method: "POST",
      token: tokens.landlordB,
      body: { newMonthlyRent: 99999 },
    });
    recordResult(
      "Test 6",
      "Landlord B cross-lease modification attempt (IDOR Defense)",
      t6.status === 403,
      `Status: ${t6.status} (Expected 403 Forbidden). Message: ${t6.data?.error || t6.data}`
    );

    // -------------------------------------------------------------
    // Test 7: Security RBAC - Tenant attempting to renew lease
    // -------------------------------------------------------------
    const t7 = await request(`/api/leases/${leaseId}/renew`, {
      method: "POST",
      token: tokens.tenantA,
      body: { newMonthlyRent: 100 },
    });
    recordResult(
      "Test 7",
      "Tenant unilateral renewal escalation attempt",
      t7.status === 403,
      `Status: ${t7.status} (Expected 403 Forbidden). Message: ${t7.data?.error || t7.data}`
    );

    // -------------------------------------------------------------
    // Test 8: Landlord A terminates lease with confirmation
    // -------------------------------------------------------------
    const t8 = await request(`/api/leases/${leaseId}/terminate`, {
      method: "POST",
      token: tokens.landlordA,
      body: { reason: "Tenant Relocation to Bangalore", terminationDate: "2026-11-19" },
    });
    const t8Passed = t8.status === 200 && t8.data?.lease?.status === "Terminated";
    recordResult(
      "Test 8",
      "Landlord A executing confirmed lease termination",
      t8Passed,
      `Status: ${t8.status}, New Status: ${t8.data?.lease?.status}`
    );

    console.log("\n=======================================================");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`PHASE 2 TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
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
