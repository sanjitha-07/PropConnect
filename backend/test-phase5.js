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
  console.log("\n=======================================================");
  console.log("🛠️ PROPCONNECT PHASE 5 DOCUMENTS, PROFILE & SETTINGS TEST SUITE");
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

  const { Property, Document, Landlord, User } = await import("./models/index.js");

  const propA = await Property.findOne({ landlordId: "LDL001" });
  const propB = await Property.findOne({ landlordId: "LDL002" });
  const propsOfA = await Property.find({ landlordId: "LDL001" }).select("id").lean();
  const propIdsA = propsOfA.map((p) => p.id);

  try {
    // ----------------------------------------------------
    // Scenario 1: Landlord sees only own documents
    // ----------------------------------------------------
    console.log("--- Scenario 1: Document Ownership Scoping ---");
    // Seed a doc for landlord B specifically
    await Document.deleteMany({ id: { $in: ["TEST_DOC_LDL_A", "TEST_DOC_LDL_B", "TEST_DOC_EXPIRED"] } });
    await Document.create({
      id: "TEST_DOC_LDL_B",
      name: "Landlord B Tax Assessment",
      category: "Tax Documents",
      landlordId: "LDL002",
      landlord_id: "LDL002",
      propertyId: propB.id,
      uploadedOn: "2026-10-01",
      status: "Verified",
      verificationStatus: "Verified",
    });

    const docListRes = await request("/api/documents", { token: tokens.landlordA });
    const hasDocB = Array.isArray(docListRes.data) && docListRes.data.some((d) => d.id === "TEST_DOC_LDL_B");
    recordResult(
      "Scenario 1",
      "Landlord sees only own documents (no leakage of Landlord B docs)",
      docListRes.status === 200 && !hasDocB,
      `Returned ${docListRes.data?.length || 0} docs, TEST_DOC_LDL_B safely excluded`
    );

    // ----------------------------------------------------
    // Scenario 2: Cross-landlord document access blocked (403)
    // ----------------------------------------------------
    console.log("--- Scenario 2: Cross-Landlord Access Control ---");
    const crossRes = await request("/api/documents/TEST_DOC_LDL_B", { token: tokens.landlordA });
    recordResult(
      "Scenario 2",
      "Cross-landlord document access blocked with 403 Forbidden",
      crossRes.status === 403,
      `Attempted to view Landlord B doc with Landlord A token. Received HTTP ${crossRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 3: Unauthorized document download blocked (403)
    // ----------------------------------------------------
    console.log("--- Scenario 3: Unauthorized Document Download Blocked ---");
    const downloadRes = await request("/api/documents/TEST_DOC_LDL_B/download", { token: tokens.landlordA });
    recordResult(
      "Scenario 3",
      "Unauthorized document download blocked with 403 Forbidden",
      downloadRes.status === 403,
      `Attempted to download Landlord B doc with Landlord A token. Received HTTP ${downloadRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 4: Valid document upload works
    // ----------------------------------------------------
    console.log("--- Scenario 4: Valid Document Upload ---");
    const uploadRes = await request("/api/documents", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        id: "TEST_DOC_LDL_A",
        name: "Property Deed Patta Copy",
        category: "Property Ownership Proof",
        documentNumber: "TN-CH-PATTA-8841",
        propertyId: propA.id,
        expiryDate: "2035-12-31",
      },
    });
    recordResult(
      "Scenario 4",
      "Valid document upload persists with Pending Verification status",
      uploadRes.status === 201 && uploadRes.data?.status === "Pending Verification" && uploadRes.data?.category === "Property Ownership Proof",
      `Created document ID ${uploadRes.data?.id} with status "${uploadRes.data?.status}"`
    );

    // ----------------------------------------------------
    // Scenario 5: Invalid file type/oversized file rejected (400)
    // ----------------------------------------------------
    console.log("--- Scenario 5: Invalid File Type & Size Validation ---");
    const exeUploadRes = await request("/api/documents", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        name: "Malicious Payload",
        fileName: "payload.exe",
        mimeType: "application/x-msdownload",
      },
    });
    const oversizeRes = await request("/api/documents", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        name: "Huge File",
        fileName: "large.pdf",
        fileSize: 25 * 1024 * 1024, // 25MB
      },
    });
    recordResult(
      "Scenario 5",
      "Invalid file extension and oversized files rejected with 400 Bad Request",
      exeUploadRes.status === 400 && oversizeRes.status === 400,
      `Exe status: ${exeUploadRes.status} (${exeUploadRes.data?.error}), Oversized status: ${oversizeRes.status} (${oversizeRes.data?.error})`
    );

    // ----------------------------------------------------
    // Scenario 6: Document verification permissions enforced (admin only)
    // ----------------------------------------------------
    console.log("--- Scenario 6: Verification Permissions Enforced ---");
    const landlordSelfVerifyRes = await request("/api/documents/TEST_DOC_LDL_A/verify", {
      method: "POST",
      token: tokens.landlordA,
      body: { status: "Verified" },
    });

    const adminVerifyRes = await request("/api/documents/TEST_DOC_LDL_A/verify", {
      method: "POST",
      token: tokens.admin,
      body: { status: "Verified" },
    });

    recordResult(
      "Scenario 6",
      "Landlord cannot self-verify documents (403), Admin can verify (200)",
      landlordSelfVerifyRes.status === 403 && adminVerifyRes.status === 200 && adminVerifyRes.data?.document?.status === "Verified",
      `Landlord self-verify HTTP ${landlordSelfVerifyRes.status}, Admin verify HTTP ${adminVerifyRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 7: Expired document status calculated correctly
    // ----------------------------------------------------
    console.log("--- Scenario 7: Expired Document Dynamic Evaluation ---");
    await Document.create({
      id: "TEST_DOC_EXPIRED",
      name: "Old Rental Agreement 2019",
      category: "Lease Agreements",
      landlordId: "LDL001",
      landlord_id: "LDL001",
      propertyId: propA.id,
      expiryDate: "2020-01-01",
      uploadedOn: "2019-01-01",
      status: "Pending Verification",
    });

    const expDocRes = await request("/api/documents/TEST_DOC_EXPIRED", { token: tokens.landlordA });
    recordResult(
      "Scenario 7",
      "Past expiry date dynamically marked isExpired=true and status=Expired",
      expDocRes.status === 200 && expDocRes.data?.isExpired === true && expDocRes.data?.status === "Expired",
      `Doc expiry ${expDocRes.data?.expiryDate} evaluated to isExpired: ${expDocRes.data?.isExpired}, status: ${expDocRes.data?.status}`
    );

    // ----------------------------------------------------
    // Scenario 8: Profile update persists after reload
    // ----------------------------------------------------
    console.log("--- Scenario 8: Profile Update Persistence ---");
    const profileUpdateRes = await request("/api/profile", {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        name: "Karthik Raja Updated",
        phone: "+91 98401 99999",
        location: "Coimbatore, Tamil Nadu",
        address: "No. 42 Avinashi Road, Peelamedu, Coimbatore - 641004",
      },
    });

    // Verify database reload
    const landlordDocAfter = await Landlord.findOne({ id: "LDL001" }).lean();
    const profileGetRes = await request("/api/profile", { token: tokens.landlordA });

    recordResult(
      "Scenario 8",
      "Profile update persists to MongoDB and reflects in GET /api/profile",
      profileUpdateRes.status === 200 &&
        landlordDocAfter?.phone === "+91 98401 99999" &&
        profileGetRes.data?.address === "No. 42 Avinashi Road, Peelamedu, Coimbatore - 641004",
      `Updated phone: ${landlordDocAfter?.phone}, Address: ${profileGetRes.data?.address}`
    );

    // ----------------------------------------------------
    // Scenario 9: Banking information masked in normal API responses
    // ----------------------------------------------------
    console.log("--- Scenario 9: Banking Information Masking ---");
    const bankUpdateRes = await request("/api/profile/banking", {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        accountHolderName: "Karthik Raja",
        bankName: "HDFC Bank",
        accountNumber: "50100234567890",
        ifscCode: "HDFC0001234",
        branch: "Anna Nagar West",
      },
    });

    const profileBankingRes = await request("/api/profile", { token: tokens.landlordA });
    const landlordsListRes = await request("/api/landlords", { token: tokens.landlordA });

    const accInProfile = profileBankingRes.data?.banking?.accountNumber || "";
    const accInList = landlordsListRes.data?.[0]?.banking?.accountNumber || "";

    const isProperlyMasked =
      accInProfile.includes("••••") &&
      accInProfile.endsWith("7890") &&
      !accInProfile.includes("501002") &&
      accInList.includes("••••");

    recordResult(
      "Scenario 9",
      "Banking account numbers masked with dots (••••7890) in GET responses",
      bankUpdateRes.status === 200 && isProperlyMasked,
      `Profile returned masked account: "${accInProfile}", Landlords list returned: "${accInList}"`
    );

    // ----------------------------------------------------
    // Scenario 10: Invalid IFSC format rejected (400)
    // ----------------------------------------------------
    console.log("--- Scenario 10: IFSC Code Validation ---");
    const badIfscRes = await request("/api/profile/banking", {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        ifscCode: "INVALID123",
      },
    });

    const goodIfscRes = await request("/api/profile/banking", {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        ifscCode: "SBIN0000800",
      },
    });

    recordResult(
      "Scenario 10",
      "Invalid IFSC format rejected with 400 Bad Request, Valid format accepted (200)",
      badIfscRes.status === 400 && goodIfscRes.status === 200 && goodIfscRes.data?.banking?.ifscCode === "SBIN0000800",
      `Invalid IFSC returned HTTP ${badIfscRes.status} (${badIfscRes.data?.error}), Valid IFSC returned HTTP ${goodIfscRes.status}`
    );

    // ----------------------------------------------------
    // Scenario 11: Password change requires valid old password
    // ----------------------------------------------------
    console.log("--- Scenario 11: Password Change Verification ---");
    const wrongPwdRes = await request("/api/auth/change-password", {
      method: "POST",
      body: {
        email: LANDLORD_A.email,
        currentPassword: "completelyWrongPassword123",
        newPassword: "newSecurePassword2026",
      },
    });

    recordResult(
      "Scenario 11",
      "Password change with invalid current password rejected with 400 Bad Request",
      wrongPwdRes.status === 400 && wrongPwdRes.data?.success === false,
      `Wrong password returned status ${wrongPwdRes.status}: ${wrongPwdRes.data?.message}`
    );

    // ----------------------------------------------------
    // Scenario 12: Notification preferences persist after reload
    // ----------------------------------------------------
    console.log("--- Scenario 12: Landlord Settings Persistence ---");
    const settingsUpdateRes = await request("/api/settings/landlord", {
      method: "PUT",
      token: tokens.landlordA,
      body: {
        notificationPreferences: {
          rentPayments: false,
          maintenanceUpdates: true,
          complaintAlerts: true,
          bookingAlerts: true,
          leaseExpiryAlerts: false,
          smsAlerts: true,
        },
        paymentPreferences: {
          autoRentReminders: true,
          reminderLeadDays: 7,
          gracePeriodDays: 10,
        },
      },
    });

    const settingsGetRes = await request("/api/settings/landlord", { token: tokens.landlordA });
    const notifs = settingsGetRes.data?.notificationPreferences || {};
    const payments = settingsGetRes.data?.paymentPreferences || {};

    const settingsPersisted =
      settingsUpdateRes.status === 200 &&
      notifs.rentPayments === false &&
      notifs.smsAlerts === true &&
      notifs.leaseExpiryAlerts === false &&
      payments.reminderLeadDays === 7 &&
      payments.gracePeriodDays === 10;

    recordResult(
      "Scenario 12",
      "Landlord notification & payment settings persist to MongoDB across calls",
      settingsPersisted,
      `rentPayments: ${notifs.rentPayments}, smsAlerts: ${notifs.smsAlerts}, leadDays: ${payments.reminderLeadDays}`
    );

    // ----------------------------------------------------
    // Scenario 13: Legacy functionality & route integrity
    // ----------------------------------------------------
    console.log("--- Scenario 13: Document Versioning & Security Boundaries ---");
    // Replace document with new version
    const replaceRes = await request("/api/documents/TEST_DOC_LDL_A/replace", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        name: "Property Deed Patta Copy (Renewed)",
        documentNumber: "TN-CH-PATTA-8841-REV2",
        expiryDate: "2040-12-31",
      },
    });

    const replacedDoc = replaceRes.data?.document;
    const versioningWorking =
      replaceRes.status === 200 &&
      replacedDoc?.version === 2 &&
      Array.isArray(replacedDoc?.versionHistory) &&
      replacedDoc?.versionHistory?.length === 1 &&
      replacedDoc?.status === "Pending Verification";

    // Direct uploads static directory access check
    const staticRes = await request("/uploads/document.pdf");
    const staticBlocked = staticRes.status === 403;

    recordResult(
      "Scenario 13",
      "Document versioning history archived cleanly and static uploads access blocked (403)",
      versioningWorking && staticBlocked,
      `Version incremented to ${replacedDoc?.version}, versionHistory count: ${replacedDoc?.versionHistory?.length}, /uploads static access status: ${staticRes.status}`
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
    console.log(`Phase 5 Scenarios Checked: ${total}`);
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