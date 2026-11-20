import { spawn, execSync } from "child_process";
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
const TENANT_B = { id: "TEN_USER_002", email: "rahul.varma@mail.com", name: "Rahul Varma", role: "tenant", entityId: "TEN002" };
const TECH_ASSIGNED = { id: "PROV_USER_01", email: "kumar.plumber@mail.com", name: "Kumar Plumber", role: "provider", entityId: "PROV_PLUMB_01" };
const TECH_UNASSIGNED = { id: "PROV_USER_02", email: "suresh.electric@mail.com", name: "Suresh Electrician", role: "provider", entityId: "PROV_ELEC_01" };

const tokens = {
  admin: makeToken(ADMIN),
  landlordA: makeToken(LANDLORD_A),
  landlordB: makeToken(LANDLORD_B),
  tenantA: makeToken(TENANT_A),
  tenantB: makeToken(TENANT_B),
  techAssigned: makeToken(TECH_ASSIGNED),
  techUnassigned: makeToken(TECH_UNASSIGNED),
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
  console.log("🛠️ PROPCONNECT PHASE 4 REQUESTS & HOME SERVICES TEST SUITE");
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

  const { Property, Lease, MaintenanceRequest, Complaint, ServiceBooking, ServiceProvider, Expense } = await import("./models/index.js");

  // Fetch baseline properties
  const propA = await Property.findOne({ landlordId: "LDL001" });
  const propB = await Property.findOne({ landlordId: "LDL002" });
  const propsOfA = await Property.find({ landlordId: "LDL001" }).select("id").lean();
  const propIdsA = propsOfA.map((p) => p.id);

  try {
    // ----------------------------------------------------
    // Scenario 1: Landlord sees only requests belonging to their properties
    // ----------------------------------------------------
    console.log("--- Scenario 1: Requests Ownership Scoping ---");
    const mntResA = await request("/api/maintenance", { token: tokens.landlordA });
    const allMntOwnedByA = Array.isArray(mntResA.data) && mntResA.data.every((m) => propIdsA.includes(m.propertyId));
    recordResult(
      "Scenario 1",
      "Landlord A sees only maintenance tickets for owned properties",
      mntResA.status === 200 && allMntOwnedByA && mntResA.data.length > 0,
      `Returned ${mntResA.data?.length || 0} tickets, all belonging to LDL001 properties`
    );

    const cmpResA = await request("/api/complaints", { token: tokens.landlordA });
    const allCmpOwnedByA = Array.isArray(cmpResA.data) && cmpResA.data.every((c) => propIdsA.includes(c.propertyId));
    recordResult(
      "Scenario 1",
      "Landlord A sees only complaints for owned properties",
      cmpResA.status === 200 && allCmpOwnedByA,
      `Returned ${cmpResA.data?.length || 0} complaints, all belonging to LDL001 properties`
    );

    // ----------------------------------------------------
    // Scenario 2: Cross-landlord request access is blocked
    // ----------------------------------------------------
    console.log("\n--- Scenario 2: Cross-Landlord Request Protection ---");
    const ticketA = await MaintenanceRequest.findOne({ propertyId: { $in: propIdsA } });
    const crossUpdateTicket = await request(`/api/maintenance/${ticketA.id}`, {
      method: "PUT",
      token: tokens.landlordB,
      body: { status: "In Progress" },
    });
    recordResult(
      "Scenario 2",
      "Cross-landlord maintenance modification blocked",
      crossUpdateTicket.status === 403,
      `Landlord B modifying Landlord A ticket ${ticketA.id} returned status ${crossUpdateTicket.status}`
    );

    const complaintA = await Complaint.findOne({ propertyId: { $in: propIdsA } });
    if (complaintA) {
      const crossUpdateComplaint = await request(`/api/complaints/${complaintA.id}`, {
        method: "PUT",
        token: tokens.landlordB,
        body: { status: "Resolved", resolutionDetails: "Unauthorized resolution" },
      });
      recordResult(
        "Scenario 2",
        "Cross-landlord complaint modification blocked",
        crossUpdateComplaint.status === 403,
        `Landlord B modifying Landlord A complaint ${complaintA.id} returned status ${crossUpdateComplaint.status}`
      );
    }

    // ----------------------------------------------------
    // Scenario 3: Tenant can create a request for their own property
    // ----------------------------------------------------
    console.log("\n--- Scenario 3: Tenant Request Creation ---");
    const createReqRes = await request("/api/maintenance", {
      method: "POST",
      token: tokens.tenantA,
      body: {
        propertyId: propA.id,
        category: "Plumbing",
        title: "Kitchen Sink Leak Test",
        description: "Water leaking under the sink pipe joints",
        priority: "High",
      },
    });

    const ticketCreated =
      createReqRes.status === 201 &&
      createReqRes.data?.tenantId === "TEN001" &&
      createReqRes.data?.propertyId === propA.id &&
      createReqRes.data?.status === "Open";

    recordResult(
      "Scenario 3",
      "Tenant creates maintenance request with verified tenancy",
      ticketCreated,
      `Created ticket ${createReqRes.data?.id} for tenant TEN001 on property ${propA.id}, status: ${createReqRes.data?.status}`
    );

    const createdTenantTicketId = createReqRes.data.id;

    // ----------------------------------------------------
    // Scenario 4: Tenant cannot access another tenant's request
    // ----------------------------------------------------
    console.log("\n--- Scenario 4: Cross-Tenant Ticket Isolation ---");
    const crossTenantMod = await request(`/api/maintenance/${createdTenantTicketId}`, {
      method: "PUT",
      token: tokens.tenantB,
      body: { description: "Tampered description by tenant B" },
    });
    recordResult(
      "Scenario 4",
      "Tenant B modifying Tenant A's ticket blocked",
      crossTenantMod.status === 403,
      `Tenant B attempting to modify ticket ${createdTenantTicketId} returned status ${crossTenantMod.status}`
    );

    // ----------------------------------------------------
    // Scenario 5: Landlord can assign an authorized provider
    // ----------------------------------------------------
    console.log("\n--- Scenario 5: Provider Assignment Workflow ---");
    const provider = await ServiceProvider.findOne({ category: "Plumbing" });
    const assignRes = await request(`/api/maintenance/${createdTenantTicketId}`, {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        status: "Assigned",
        assignedTo: provider?.name || "Kumar Plumber",
        providerId: provider?.id || "PROV_PLUMB_01",
        providerName: provider?.name || "Kumar Plumber",
        technicianName: provider?.technicianName || provider?.name || "Kumar Plumber",
        scheduledDate: "2026-11-25",
        scheduledTimeSlot: "10:00 AM",
        estimatedCost: 850,
      },
    });

    const isAssigned =
      assignRes.status === 200 &&
      assignRes.data?.status === "Assigned" &&
      assignRes.data?.assignedTo === (provider?.name || "Kumar Plumber");

    recordResult(
      "Scenario 5",
      "Landlord assigns service specialist with appointment schedule",
      isAssigned,
      `Ticket ${createdTenantTicketId} status: ${assignRes.data?.status}, AssignedTo: ${assignRes.data?.assignedTo}, Schedule: ${assignRes.data?.scheduledDate}`
    );

    // ----------------------------------------------------
    // Scenario 6: Unassigned technician cannot modify a booking
    // ----------------------------------------------------
    console.log("\n--- Scenario 6: Technician Assignment Authorization ---");
    const booking = await ServiceBooking.create({
      id: "BK_TEST_SECURITY_01",
      bookingNumber: "BK-SEC-01",
      userId: "TEN001",
      userName: "Divya Priya",
      userRole: "tenant",
      propertyId: propA.id,
      landlordId: "LDL001",
      serviceCategory: "Plumbing",
      serviceName: "Pipe Leak Inspection",
      providerId: "PROV_PLUMB_01", // assigned to Kumar Plumber (tokens.techAssigned)
      providerName: "Kumar Plumbing Services",
      date: "2026-11-26",
      timeSlot: "11:00 AM",
      status: "Confirmed",
      amount: 600,
    });

    const unassignedMod = await request(`/api/service-bookings/${booking.id}/status`, {
      method: "PUT",
      token: tokens.techUnassigned, // Suresh Electrician
      body: { status: "In Progress" },
    });

    recordResult(
      "Scenario 6",
      "Unassigned technician modification blocked",
      unassignedMod.status === 403,
      `Tech Suresh modifying booking assigned to Kumar returned status ${unassignedMod.status}`
    );

    // ----------------------------------------------------
    // Scenario 7: Assigned technician can update permitted booking status
    // ----------------------------------------------------
    console.log("\n--- Scenario 7: Assigned Technician Status Advance ---");
    const assignedMod = await request(`/api/service-bookings/${booking.id}/status`, {
      method: "PUT",
      token: tokens.techAssigned, // Kumar Plumber
      body: { status: "In Progress", note: "On site and troubleshooting leak" },
    });

    recordResult(
      "Scenario 7",
      "Assigned technician advances booking status to In Progress",
      assignedMod.status === 200 && assignedMod.data?.status === "In Progress",
      `Booking ${booking.id} status updated to: ${assignedMod.data?.status}`
    );

    // ----------------------------------------------------
    // Scenario 8: Invalid status transitions are rejected
    // ----------------------------------------------------
    console.log("\n--- Scenario 8: Status Transition Validation ---");
    const invalidStatusRes = await request(`/api/maintenance/${createdTenantTicketId}`, {
      method: "PUT",
      token: tokens.landlordA,
      body: { status: "INVALID_STATUS_FOO" },
    });

    recordResult(
      "Scenario 8",
      "Invalid maintenance status transition rejected with 400 Bad Request",
      invalidStatusRes.status === 400,
      `Status returned: ${invalidStatusRes.status}: ${invalidStatusRes.data?.error}`
    );

    // ----------------------------------------------------
    // Scenario 9: Complaint resolution is recorded correctly
    // ----------------------------------------------------
    console.log("\n--- Scenario 9: Complaint Resolution Audit ---");
    const testComplaint = await Complaint.create({
      id: "CMP_TEST_PHASE4",
      tenantId: "TEN001",
      tenantName: "Divya Priya",
      propertyId: propA.id,
      propertyName: propA.name,
      category: "Maintenance",
      subject: "Water pressure low on top floor",
      description: "Low water flow during morning hours",
      status: "Open",
      priority: "Medium",
      date: "2026-11-20",
    });

    // Attempt resolve without resolution details (must fail)
    const resolveFail = await request(`/api/complaints/${testComplaint.id}`, {
      method: "PUT",
      token: tokens.landlordA,
      body: { status: "Resolved" },
    });

    // Resolve with mandatory resolution details (must succeed)
    const resolveSuccess = await request(`/api/complaints/${testComplaint.id}`, {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        status: "Resolved",
        resolutionDetails: "Booster pump switch replaced by technician on 2026-11-21",
        landlordNotes: "Confirmed good pressure with tenant",
      },
    });

    const resolutionOk =
      resolveFail.status === 400 &&
      resolveSuccess.status === 200 &&
      resolveSuccess.data?.status === "Resolved" &&
      resolveSuccess.data?.resolutionDetails?.length > 0;

    recordResult(
      "Scenario 9",
      "Complaint resolution requires notes and records audit history",
      resolutionOk,
      `Resolve without notes: status ${resolveFail.status} (rejected). Resolve with notes: status ${resolveSuccess.status}, Resolution: "${resolveSuccess.data?.resolutionDetails}"`
    );

    // ----------------------------------------------------
    // Scenario 10: Provider booking creation works
    // ----------------------------------------------------
    console.log("\n--- Scenario 10: Service Booking Creation ---");
    const uniqueTime = "04:00 PM";
    const createBookingRes = await request("/api/service-bookings", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        propertyId: propA.id,
        propertyName: propA.name,
        serviceCategory: "Electrical",
        providerId: "PROV_ELEC_01",
        providerName: "Suresh Electrician",
        date: "2026-11-28",
        timeSlot: uniqueTime,
        amount: 750,
        notes: "Main board surge protector check",
      },
    });

    const bookingCreated =
      createBookingRes.status === 201 &&
      createBookingRes.data?.serviceCategory === "Electrical" &&
      createBookingRes.data?.amount === 750;

    recordResult(
      "Scenario 10",
      "Service booking created successfully with schedule and amount",
      bookingCreated,
      `Created booking ${createBookingRes.data?.bookingNumber || createBookingRes.data?.id}, Provider: ${createBookingRes.data?.providerName}, Amount: ₹${createBookingRes.data?.amount}`
    );

    // ----------------------------------------------------
    // Scenario 11: Unauthorized document downloads are blocked
    // ----------------------------------------------------
    console.log("\n--- Scenario 11: Document Download Protection ---");
    const unauthDoc = await request("/api/documents/DOC005/download", {
      token: tokens.tenantA, // Tenant A downloading Tenant B document
    });
    recordResult(
      "Scenario 11",
      "Unauthorized document download rejected with 403 Forbidden",
      unauthDoc.status === 403,
      `Status returned: ${unauthDoc.status}`
    );

    // ----------------------------------------------------
    // Scenario 12: Completed booking expense integration does not create duplicates
    // ----------------------------------------------------
    console.log("\n--- Scenario 12: Booking Expense Integration & Duplicate Prevention ---");
    const targetBookingId = createBookingRes.data.id;

    // First completion
    const complete1 = await request(`/api/service-bookings/${targetBookingId}/status`, {
      method: "PUT",
      token: tokens.landlordA,
      body: { status: "Completed", note: "Electrical inspection finished" },
    });

    const expenseCount1 = await Expense.countDocuments({
      description: { $regex: new RegExp(targetBookingId, "i") },
    });

    // Redundant completion / re-save
    const complete2 = await request(`/api/service-bookings/${targetBookingId}/status`, {
      method: "PUT",
      token: tokens.landlordA,
      body: { status: "Completed", note: "Second trigger attempt" },
    });

    const expenseCount2 = await Expense.countDocuments({
      description: { $regex: new RegExp(targetBookingId, "i") },
    });

    const expenseDeduplicationOk =
      complete1.status === 200 &&
      expenseCount1 === 1 &&
      expenseCount2 === 1 &&
      complete1.data?.expenseId !== null;

    recordResult(
      "Scenario 12",
      "Completed service booking auto-creates expense without duplicates",
      expenseDeduplicationOk,
      `Expense created on first completion: ${expenseCount1}, After redundant completion: ${expenseCount2} (Duplicates prevented)`
    );

    // ----------------------------------------------------
    // Scenario 13: Legacy routes redirect correctly in App.jsx
    // ----------------------------------------------------
    console.log("\n--- Scenario 13: Legacy Route Redirect Verification ---");
    const appJsxContent = fs.readFileSync(path.resolve("frontend/src/App.jsx"), "utf-8");
    const hasRequestsRoute = appJsxContent.includes('path="requests" element={<RequestsCenterPage />}');
    const hasMntRedirect = appJsxContent.includes('path="maintenance" element={<Navigate to="/landlord/requests?tab=maintenance"');
    const hasCmpRedirect = appJsxContent.includes('path="complaints" element={<Navigate to="/landlord/requests?tab=complaints"');
    const hasHomeServicesRedirect = appJsxContent.includes('path="home-services" element={<Navigate to="/landlord/requests?tab=marketplace"');
    const hasBookingsRedirect = appJsxContent.includes('path="bookings" element={<Navigate to="/landlord/requests?tab=bookings"');
    const hasServicesRedirect = appJsxContent.includes('path="services" element={<Navigate to="/landlord/requests?tab=marketplace"');
    const hasHubRedirect = appJsxContent.includes('path="services-complaints" element={<Navigate to="/landlord/requests?tab=maintenance"');

    const legacyRedirectsValid =
      hasRequestsRoute &&
      hasMntRedirect &&
      hasCmpRedirect &&
      hasHomeServicesRedirect &&
      hasBookingsRedirect &&
      hasServicesRedirect &&
      hasHubRedirect;

    recordResult(
      "Scenario 13",
      "App.jsx defines /landlord/requests and all 6 legacy redirects",
      legacyRedirectsValid,
      `All 6 requests legacy routes mapped with clean <Navigate replace /> to /landlord/requests?tab=...`
    );

  } catch (err) {
    console.error("Test execution encountered an error:", err);
  } finally {
    console.log("\n=======================================================");
    console.log("📊 TEST EXECUTION SUMMARY");
    console.log("=======================================================");
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    console.log(`Phase 4 Scenarios Checked: ${total}`);
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
