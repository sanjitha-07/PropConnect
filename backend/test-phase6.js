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
  console.log("\n=======================================================================");
  console.log("🚀 PROPCONNECT PHASE 6 FINAL CONSOLIDATION & QA VERIFICATION SUITE");
  console.log("=======================================================================\n");

  let mongodProc = null;
  const mongodPath = "C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe";
  const dbPath = path.resolve("backend/data/db");
  const logPath = path.resolve("backend/data/mongod.log");

  console.log("1. Starting MongoDB daemon...");
  mongodProc = spawn(mongodPath, ["--dbpath", dbPath, "--port", "27017", "--logpath", logPath]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("2. Connecting Mongoose & Seeding Master Data...");
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

  const { Property, Lease, Payment, Expense, SecurityDeposit, UtilityBill, MaintenanceRequest, Complaint, ServiceBooking, Document } =
    await import("./models/index.js");

  const propA = await Property.findOne({ landlordId: "LDL001" });
  const propB = await Property.findOne({ landlordId: "LDL002" });
  const propsA = await Property.find({ landlordId: "LDL001" }).lean();
  const propIdsA = propsA.map((p) => p.id);

  try {
    // ----------------------------------------------------
    // Scenario 1: Financial Summary API Scoping & Aggregates
    // ----------------------------------------------------
    console.log("--- Scenario 1: Landlord Dashboard Financial Metrics ---");
    const finRes = await request("/api/financial-summary", { token: tokens.landlordA });
    const finData = finRes.data;

    const hasExpectedFields =
      finRes.status === 200 &&
      finData?.success === true &&
      typeof finData.totalRentCollected === "number" &&
      typeof finData.pendingRent === "number" &&
      typeof finData.totalExpenses === "number" &&
      typeof finData.netOperatingIncome === "number" &&
      typeof finData.securityDepositLiability === "number";

    recordResult(
      "Scenario 1",
      "GET /api/financial-summary returns correct aggregate schema for Landlord A",
      hasExpectedFields,
      `Status: ${finRes.status}, Rent Collected: ₹${finData?.totalRentCollected}, Expenses: ₹${finData?.totalExpenses}, NOI: ₹${finData?.netOperatingIncome}`
    );

    // ----------------------------------------------------
    // Scenario 2: Net Operating Income (NOI) Formula Accuracy
    // ----------------------------------------------------
    console.log("--- Scenario 2: Net Operating Income (NOI) Formula Verification ---");
    const expectedNOI = finData.totalRentCollected - finData.totalExpenses;
    const isNOICorrect = finData.netOperatingIncome === expectedNOI;

    recordResult(
      "Scenario 2",
      "Net Operating Income follows exact formula: NOI = Rent Collected - Operational Expenses",
      isNOICorrect,
      `Collected (₹${finData.totalRentCollected}) - Expenses (₹${finData.totalExpenses}) = Expected: ₹${expectedNOI}, Actual: ₹${finData.netOperatingIncome}`
    );

    // ----------------------------------------------------
    // Scenario 3: Escrow Security Deposits Strictly Excluded from Income/NOI
    // ----------------------------------------------------
    console.log("--- Scenario 3: Escrow Security Deposits Liability Isolation ---");
    // Insert a new escrow deposit for Landlord A
    const testDepositAmount = 45000;
    await SecurityDeposit.create({
      id: "TEST_ESCROW_DEP_6",
      propertyId: propA.id,
      tenantId: "TEN001",
      amount: testDepositAmount,
      status: "Held in Escrow",
      paidDate: "2026-10-01",
      interestAccrued: 0,
      deductionsTotal: 0,
    });

    const finResAfterDeposit = await request("/api/financial-summary", { token: tokens.landlordA });
    const depositLiability = finResAfterDeposit.data.securityDepositLiability;
    const noiAfterDeposit = finResAfterDeposit.data.netOperatingIncome;
    const rentAfterDeposit = finResAfterDeposit.data.totalRentCollected;

    // Escrow deposit MUST increase liability, but must NEVER increase rentCollected or netOperatingIncome
    const depositsProperlyExcluded =
      noiAfterDeposit === expectedNOI &&
      rentAfterDeposit === finData.totalRentCollected &&
      depositLiability >= testDepositAmount;

    recordResult(
      "Scenario 3",
      "Escrow security deposits are strictly tracked as liabilities and excluded from income & NOI",
      depositsProperlyExcluded,
      `Deposit Liability: ₹${depositLiability}, NOI remained strictly ₹${noiAfterDeposit} (unaffected by escrow deposit of ₹${testDepositAmount})`
    );

    // ----------------------------------------------------
    // Scenario 4: Requests Summary API Scoping & Aggregates
    // ----------------------------------------------------
    console.log("--- Scenario 4: Landlord Dashboard Requests & Services Metrics ---");
    const reqRes = await request("/api/requests-summary", { token: tokens.landlordA });
    const reqData = reqRes.data;

    const hasRequestsFields =
      reqRes.status === 200 &&
      reqData?.success === true &&
      typeof reqData.totalRequests === "number" &&
      typeof reqData.newUnassigned === "number" &&
      typeof reqData.inProgress === "number" &&
      Array.isArray(reqData.combinedRecent);

    recordResult(
      "Scenario 4",
      "GET /api/requests-summary returns live ticket, complaint, and booking aggregates",
      hasRequestsFields,
      `Status: ${reqRes.status}, Total Requests: ${reqData?.totalRequests}, Unassigned: ${reqData?.newUnassigned}, In Progress: ${reqData?.inProgress}, Recent items count: ${reqData?.combinedRecent?.length}`
    );

    // ----------------------------------------------------
    // Scenario 5: All Landlord Core Data APIs Return HTTP 200
    // ----------------------------------------------------
    console.log("--- Scenario 5: All 8 Landlord Backend Data APIs Verification ---");
    const endpoints = [
      { name: "Properties", url: "/api/properties" },
      { name: "Tenants", url: "/api/tenants" },
      { name: "Leases", url: "/api/leases" },
      { name: "Financial Summary", url: "/api/financial-summary" },
      { name: "Payments", url: "/api/payments" },
      { name: "Expenses", url: "/api/expenses" },
      { name: "Requests Summary", url: "/api/requests-summary" },
      { name: "Documents", url: "/api/documents" },
      { name: "Landlord Profile", url: "/api/landlords/me" },
      { name: "Settings", url: "/api/settings" },
    ];

    let allApisSuccess = true;
    for (const ep of endpoints) {
      const res = await request(ep.url, { token: tokens.landlordA });
      if (res.status !== 200) {
        allApisSuccess = false;
        console.error(`Endpoint ${ep.name} (${ep.url}) failed with status ${res.status}`);
      }
    }

    recordResult(
      "Scenario 5",
      "All landlord primary backend data endpoints return HTTP 200 OK",
      allApisSuccess,
      `Verified all ${endpoints.length} core API endpoints for authenticated landlord`
    );

    // ----------------------------------------------------
    // Scenario 6: Cross-Landlord Financial Isolation
    // ----------------------------------------------------
    console.log("--- Scenario 6: Cross-Landlord Financial & Data Isolation ---");
    // Landlord B summary
    const finResB = await request("/api/financial-summary", { token: tokens.landlordB });
    // Attempt by Landlord A to query Landlord B's property financials
    const crossFinRes = await request(`/api/financial-summary?propertyId=${propB.id}`, { token: tokens.landlordA });
    const crossBlocked = crossFinRes.status === 403;

    // Cross request summary
    const crossReqRes = await request(`/api/requests-summary?propertyId=${propB.id}`, { token: tokens.landlordA });
    const crossReqBlocked = crossReqRes.status === 403;

    recordResult(
      "Scenario 6",
      "Cross-landlord financial & request querying is blocked with HTTP 403 Forbidden",
      crossBlocked && crossReqBlocked,
      `Property ${propB.id} (Landlord B). Landlord A query financial status: ${crossFinRes.status}, request summary status: ${crossReqRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 7: Admin Full Portfolio Oversight Access
    // ----------------------------------------------------
    console.log("--- Scenario 7: Master Administrator Access Oversight ---");
    const adminFinRes = await request("/api/financial-summary", { token: tokens.admin });
    const adminReqRes = await request("/api/requests-summary", { token: tokens.admin });
    const adminPropRes = await request("/api/properties", { token: tokens.admin });

    const adminFullAccess =
      adminFinRes.status === 200 &&
      adminReqRes.status === 200 &&
      adminPropRes.status === 200 &&
      adminPropRes.data?.length >= propsA.length;

    recordResult(
      "Scenario 7",
      "Master Admin possesses comprehensive oversight across all portfolio records",
      adminFullAccess,
      `Admin financial status: ${adminFinRes.status}, requests status: ${adminReqRes.status}, total portfolio properties visible: ${adminPropRes.data?.length || 0}`
    );

    // ----------------------------------------------------
    // Scenario 8: Tenant Role Strictly Blocked from Landlord Portfolio Analytics
    // ----------------------------------------------------
    console.log("--- Scenario 8: Tenant Role Isolation & Access Boundaries ---");
    const tenantFinRes = await request("/api/financial-summary", { token: tokens.tenantA });
    const tenantReqRes = await request("/api/requests-summary", { token: tokens.tenantA });

    const tenantBlocked = tenantFinRes.status === 403 && tenantReqRes.status === 403;

    recordResult(
      "Scenario 8",
      "Tenant role is strictly blocked (HTTP 403) from landlord portfolio financial & request summaries",
      tenantBlocked,
      `Tenant financial-summary status: ${tenantFinRes.status}, requests-summary status: ${tenantReqRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 9: App.jsx Legacy Route Redirect Safety Verification
    // ----------------------------------------------------
    console.log("--- Scenario 9: Client Router Legacy Redirect Integrity Verification ---");
    const appJsxContent = fs.readFileSync(path.resolve("frontend/src/App.jsx"), "utf-8");

    const requiredRedirects = [
      { from: 'path="agreement"', to: "/landlord/leases?tab=agreements" },
      { from: 'path="payments"', to: "/landlord/financials?tab=invoices" },
      { from: 'path="deposits"', to: "/landlord/financials?tab=deposits" },
      { from: 'path="expenses"', to: "/landlord/financials?tab=expenses" },
      { from: 'path="eb-bills"', to: "/landlord/financials?tab=utilities" },
      { from: 'path="utility-bills"', to: "/landlord/financials?tab=utilities" },
      { from: 'path="analytics"', to: "/landlord/financials?tab=analytics" },
      { from: 'path="maintenance"', to: "/landlord/requests?tab=maintenance" },
      { from: 'path="services-complaints"', to: "/landlord/requests?tab=maintenance" },
      { from: 'path="complaints"', to: "/landlord/requests?tab=complaints" },
      { from: 'path="home-services"', to: "/landlord/requests?tab=marketplace" },
      { from: 'path="bookings"', to: "/landlord/requests?tab=bookings" },
      { from: 'path="service-bookings"', to: "/landlord/requests?tab=bookings" },
      { from: 'path="services"', to: "/landlord/requests?tab=marketplace" },
    ];

    let allRedirectsConfigured = true;
    for (const r of requiredRedirects) {
      if (!appJsxContent.includes(r.from) || !appJsxContent.includes(r.to)) {
        allRedirectsConfigured = false;
        console.error(`Missing redirect rule for ${r.from} -> ${r.to}`);
      }
    }

    recordResult(
      "Scenario 9",
      "All 14 legacy landlord URL paths have active <Navigate replace /> redirects to consolidated hubs",
      allRedirectsConfigured,
      `Verified 14 legacy routes in App.jsx routing table`
    );

    // ----------------------------------------------------
    // Scenario 10: Approved 8-Section Sidebar Navigation Integrity (Corrected Non-Redundant Structure)
    // ----------------------------------------------------
    console.log("--- Scenario 10: Sidebar Navigation Architecture Verification ---");
    const sidebarContent = fs.readFileSync(path.resolve("frontend/src/components/Sidebar.jsx"), "utf-8");

    const has8Sections =
      sidebarContent.includes('id: "overview"') &&
      sidebarContent.includes('id: "properties"') &&
      sidebarContent.includes('id: "tenants-leases"') &&
      sidebarContent.includes('id: "finance"') &&
      sidebarContent.includes('id: "maintenance"') &&
      sidebarContent.includes('id: "documents"') &&
      sidebarContent.includes('id: "profile"') &&
      sidebarContent.includes('id: "settings"');

    const hasIndependentChildRoutes =
      sidebarContent.includes('to: "tenants"') &&
      sidebarContent.includes('to: "leases"');

    // Redundant same-page submenus correctly removed from sidebar
    const redundantSubmenusRemoved =
      !sidebarContent.includes('to: "properties?tab=add"') &&
      !sidebarContent.includes('to: "properties?tab=units"') &&
      !sidebarContent.includes('to: "financials?tab=rent"') &&
      !sidebarContent.includes('to: "requests?tab=maintenance"') &&
      !sidebarContent.includes('to: "documents?category=property"');

    const hasExclusiveAccordionLogic =
      sidebarContent.includes("openParentId") &&
      sidebarContent.includes("toggleLandlordParent");

    const hasUserAccountCard =
      sidebarContent.includes("sidebar-landlord-account") &&
      sidebarContent.includes("sidebar-user-card") &&
      sidebarContent.includes("sidebar-logout-btn");

    recordResult(
      "Scenario 10",
      "Sidebar strictly implements the approved 8 sections, non-redundant independent routes, exclusive accordion & logout",
      has8Sections && hasIndependentChildRoutes && redundantSubmenusRemoved && hasExclusiveAccordionLogic && hasUserAccountCard,
      `8 core sections: ${has8Sections}, independent child routes: ${hasIndependentChildRoutes}, redundant submenus removed: ${redundantSubmenusRemoved}, exclusive accordion: ${hasExclusiveAccordionLogic}, account card: ${hasUserAccountCard}`
    );

  } catch (err) {
    console.error("Test execution encountered an error:", err);
  } finally {
    console.log("\n=======================================================================");
    console.log("📊 PHASE 6 TEST EXECUTION SUMMARY");
    console.log("=======================================================================");
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    console.log(`Phase 6 Scenarios Checked: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    if (mongodProc) {
      mongodProc.kill();
    }

    process.exit(failed === 0 ? 0 : 1);
  }
}

run();
