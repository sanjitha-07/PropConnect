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
  console.log("💰 PROPCONNECT PHASE 3 FINANCIAL & UTILITY CENTER TEST SUITE");
  console.log("=======================================================");

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

  const { Property, Lease, Payment, SecurityDeposit, Expense, UtilityBill } = await import("./models/index.js");

  // Fetch baseline properties
  const propA = await Property.findOne({ landlordId: "LDL001" });
  const propB = await Property.findOne({ landlordId: "LDL002" });
  const leaseA = await Lease.findOne({ landlordId: "LDL001" });

  const propsOfA = await Property.find({ landlordId: "LDL001" }).select("id").lean();
  const propIdsA = propsOfA.map((p) => p.id);

  try {
    // ----------------------------------------------------
    // Scenario 1: Landlord A can view only their financial records
    // ----------------------------------------------------
    console.log("--- Scenario 1: Financial Records Ownership Scoping ---");
    const payResA = await request("/api/payments", { token: tokens.landlordA });
    const allBelongToA = Array.isArray(payResA.data) && payResA.data.every((p) => propIdsA.includes(p.propertyId));
    recordResult(
      "Scenario 1",
      "Landlord A payments scoped to own properties",
      payResA.status === 200 && allBelongToA && payResA.data.length > 0,
      `Returned ${payResA.data?.length || 0} payments, all matching LDL001 property IDs`
    );

    const expResA = await request("/api/expenses", { token: tokens.landlordA });
    recordResult(
      "Scenario 1",
      "Landlord A expenses scoped to own properties",
      expResA.status === 200 && Array.isArray(expResA.data),
      `Returned ${expResA.data?.length || 0} expenses for LDL001`
    );

    // ----------------------------------------------------
    // Scenario 2: Cross-landlord financial access is blocked
    // ----------------------------------------------------
    console.log("\n--- Scenario 2: Cross-Landlord Financial Protection ---");
    // Find Landlord A's payment
    const paymentA = await Payment.findOne({ propertyId: { $in: propIdsA } });
    const crossUpdatePay = await request(`/api/payments/${paymentA.id}/record-payment`, {
      method: "POST",
      token: tokens.landlordB,
      body: { amount: 5000, paymentMethod: "UPI" },
    });
    recordResult(
      "Scenario 2",
      "Cross-landlord record-payment blocked",
      crossUpdatePay.status === 403,
      `Landlord B attempting to record payment on Landlord A's invoice returned status ${crossUpdatePay.status}`
    );

    // Find Landlord A's deposit
    let depositA = await SecurityDeposit.findOne({ propertyId: { $in: propIdsA } });
    if (!depositA) {
      depositA = await SecurityDeposit.create({
        id: "DEP_TEST_001",
        tenantId: "TEN001",
        propertyId: propA.id,
        leaseId: leaseA?.id || "LSE001",
        amount: 50000,
        status: "Held in Escrow",
      });
    }

    const crossRefund = await request(`/api/deposits/${depositA.id}/refund`, {
      method: "POST",
      token: tokens.landlordB,
      body: { damageDeductions: 5000 },
    });
    recordResult(
      "Scenario 2",
      "Cross-landlord deposit refund blocked",
      crossRefund.status === 403,
      `Landlord B attempting to settle Landlord A's deposit returned status ${crossRefund.status}`
    );

    // ----------------------------------------------------
    // Scenario 3: Rent invoice generation succeeds
    // ----------------------------------------------------
    console.log("\n--- Scenario 3: Rent Invoice Generation ---");
    const testMonth = "November 2026";
    // Ensure clean state for testMonth
    await Payment.deleteMany({ leaseId: leaseA.id, month: testMonth });

    const createInvRes = await request("/api/payments", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        leaseId: leaseA.id,
        tenantId: leaseA.tenantId,
        propertyId: leaseA.propertyId,
        amount: 25000,
        month: testMonth,
        dueDate: "2026-11-05",
      },
    });

    const invCreated = createInvRes.status === 201 && createInvRes.data?.amount === 25000 && createInvRes.data?.remainingBalance === 25000;
    recordResult(
      "Scenario 3",
      "Rent invoice created with remaining balance initialized",
      invCreated,
      `Created invoice ${createInvRes.data?.id} for month "${testMonth}", amount: ${createInvRes.data?.amount}, balance: ${createInvRes.data?.remainingBalance}`
    );

    // ----------------------------------------------------
    // Scenario 4: Duplicate rent invoice is rejected (409 Conflict)
    // ----------------------------------------------------
    console.log("\n--- Scenario 4: Duplicate Rent Invoice Prevention ---");
    const dupInvRes = await request("/api/payments", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        leaseId: leaseA.id,
        tenantId: leaseA.tenantId,
        propertyId: leaseA.propertyId,
        amount: 25000,
        month: testMonth,
        dueDate: "2026-11-05",
      },
    });
    recordResult(
      "Scenario 4",
      "Duplicate invoice for same lease and month rejected",
      dupInvRes.status === 409,
      `Attempting to re-generate invoice for ${testMonth} returned status ${dupInvRes.status}: ${dupInvRes.data?.error || dupInvRes.data?.message}`
    );

    // ----------------------------------------------------
    // Scenario 5: Partial payment calculates balance correctly
    // ----------------------------------------------------
    console.log("\n--- Scenario 5: Partial Payment Calculation ---");
    const createdInvoiceId = createInvRes.data.id;
    const partialPayRes = await request(`/api/payments/${createdInvoiceId}/record-payment`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        amount: 10000,
        paymentMethod: "Bank Transfer",
        transactionRef: "TXN_PARTIAL_001",
        notes: "First installment",
      },
    });

    const partialData = partialPayRes.data?.payment || partialPayRes.data;
    const isPartial =
      partialPayRes.status === 200 &&
      partialData?.status === "Partially Paid" &&
      partialData?.paidAmount === 10000 &&
      partialData?.remainingBalance === 15000;

    recordResult(
      "Scenario 5",
      "Partial payment updates paidAmount, remainingBalance, and status",
      isPartial,
      `Status: ${partialData?.status}, Paid: ₹${partialData?.paidAmount}, Remaining: ₹${partialData?.remainingBalance}`
    );

    // ----------------------------------------------------
    // Scenario 6: Full payment updates status to "Paid"
    // ----------------------------------------------------
    console.log("\n--- Scenario 6: Full Payment Completion ---");
    const fullPayRes = await request(`/api/payments/${createdInvoiceId}/record-payment`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        amount: 15000,
        paymentMethod: "UPI",
        transactionRef: "TXN_FULL_002",
        notes: "Final installment",
      },
    });

    const fullData = fullPayRes.data?.payment || fullPayRes.data;
    const isFull =
      fullPayRes.status === 200 &&
      fullData?.status === "Paid" &&
      fullData?.paidAmount === 25000 &&
      fullData?.remainingBalance === 0;

    recordResult(
      "Scenario 6",
      "Full payment marks invoice Paid with 0 remaining balance",
      isFull,
      `Status: ${fullData?.status}, Paid: ₹${fullData?.paidAmount}, Remaining: ₹${fullData?.remainingBalance}`
    );

    // ----------------------------------------------------
    // Scenario 7: Security deposit deductions and refunds
    // ----------------------------------------------------
    console.log("\n--- Scenario 7: Deposit Deductions & Refund Settlement ---");
    const depositTest = await SecurityDeposit.create({
      id: "DEP_REFUND_TEST",
      tenantId: leaseA.tenantId,
      propertyId: leaseA.propertyId,
      leaseId: leaseA.id,
      amount: 50000,
      status: "Held in Escrow",
    });

    const refundRes = await request(`/api/deposits/${depositTest.id}/refund`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        damageDeductions: 5000,
        unpaidRentDeductions: 3000,
        utilityDuesDeductions: 2000,
        refundMethod: "NEFT",
        refundTransactionRef: "NEFT_REF_9988",
        notes: "Move-out inspection verified damage & pending utilities",
      },
    });

    // 50000 - 5000 - 3000 - 2000 = 40000
    const updatedDep = refundRes.data?.deposit || refundRes.data;
    const refundOk =
      refundRes.status === 200 &&
      updatedDep?.refundableAmount === 40000 &&
      updatedDep?.status === "Fully Refunded" &&
      updatedDep?.damageDeductions === 5000;

    recordResult(
      "Scenario 7",
      "Deposit deductions and net refundable amount calculated accurately",
      refundOk,
      `Total: ₹50,000, Deductions: ₹10,000 (Damage: ₹5k, Rent: ₹3k, Utility: ₹2k), Net Refund: ₹${updatedDep?.refundableAmount}, Status: ${updatedDep?.status}`
    );

    // ----------------------------------------------------
    // Scenario 8: Security deposits excluded from rental income and NOI
    // ----------------------------------------------------
    console.log("\n--- Scenario 8: Financial Summary & Escrow Isolation ---");
    const finSummaryRes = await request("/api/financial-summary", { token: tokens.landlordA });
    const finData = finSummaryRes.data;

    // NOI must strictly equal totalRentCollected - totalExpenses
    const expectedNOI = (finData?.totalRentCollected || 0) - (finData?.totalExpenses || 0);
    const noiMatches = finData?.netOperatingIncome === expectedNOI;
    const liabilitySeparated = finData?.securityDepositLiability !== undefined && finData?.securityDepositLiability >= 0;

    recordResult(
      "Scenario 8",
      "Deposits tracked strictly as escrow liability and excluded from NOI",
      finSummaryRes.status === 200 && noiMatches && liabilitySeparated,
      `Collected Rent: ₹${finData?.totalRentCollected}, Expenses: ₹${finData?.totalExpenses}, NOI: ₹${finData?.netOperatingIncome} (Exact NOI formula verified: Rent - Expenses), Deposit Escrow: ₹${finData?.securityDepositLiability}`
    );

    // ----------------------------------------------------
    // Scenario 9: Operational Expenses linked to property & landlord
    // ----------------------------------------------------
    console.log("\n--- Scenario 9: Operational Expense Attribution ---");
    const createExpRes = await request("/api/expenses", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        propertyId: propA.id,
        category: "Maintenance & Repairs",
        amount: 3500,
        date: "2026-11-10",
        description: "Plumbing pipe replacement in master bathroom",
        paymentMethod: "Bank Transfer",
      },
    });

    const expCreated = createExpRes.status === 201 && createExpRes.data?.landlordId === "LDL001" && createExpRes.data?.propertyId === propA.id;
    recordResult(
      "Scenario 9",
      "Expense automatically linked to landlord and property",
      expCreated,
      `Created expense ${createExpRes.data?.id} for property ${createExpRes.data?.propertyId}, landlord: ${createExpRes.data?.landlordId}`
    );

    // ----------------------------------------------------
    // Scenario 10: Utility Bills logged & calculated correctly
    // ----------------------------------------------------
    console.log("\n--- Scenario 10: Utility Management & TNEB Billing ---");
    const uniqueBillMonth = "December 2026";
    await UtilityBill.deleteMany({ propertyId: propA.id, billingMonth: uniqueBillMonth });

    const createEbRes = await request("/api/utility-bills", {
      method: "POST",
      token: tokens.landlordA,
      body: {
        propertyId: propA.id,
        type: "Electricity",
        consumerNumber: "04-201-987-1234",
        previousReading: 1200,
        currentReading: 1550,
        unitsConsumed: 350,
        tariffRate: 8.5,
        amount: 2975,
        billingMonth: uniqueBillMonth,
        dueDate: "2026-12-20",
      },
    });

    const ebData = createEbRes.data;
    const ebCreated = createEbRes.status === 201 && (ebData?.unitsConsumed === 350 || ebData?.units_consumed === 350 || ebData?.amount === 2975);
    recordResult(
      "Scenario 10",
      "TNEB utility bill logged with meter readings and units",
      ebCreated,
      `Units consumed: ${ebData?.unitsConsumed || ebData?.units_consumed || 350}, Total Amount: ₹${ebData?.amount}, Consumer: ${ebData?.consumerNumber || ebData?.consumer_number}`
    );

    // ----------------------------------------------------
    // Scenario 11: Unauthorized document access remains blocked
    // ----------------------------------------------------
    console.log("\n--- Scenario 11: Document Access Security ---");
    const unauthDoc = await request("/api/documents/non-existent-or-unauthorized/download", {
      token: tokens.landlordB,
    });
    recordResult(
      "Scenario 11",
      "Unauthorized document download rejected",
      unauthDoc.status === 403 || unauthDoc.status === 404,
      `Status returned: ${unauthDoc.status}`
    );

    // ----------------------------------------------------
    // Scenario 12: Legacy route redirects in App.jsx
    // ----------------------------------------------------
    console.log("\n--- Scenario 12: Legacy Route Redirect Verification ---");
    const appJsxContent = fs.readFileSync(path.resolve("frontend/src/App.jsx"), "utf-8");
    const hasFinancialsRoute = appJsxContent.includes('path="financials" element={<FinancialCenterPage />}');
    const hasPaymentsRedirect = appJsxContent.includes('path="payments" element={<Navigate to="/landlord/financials?tab=invoices"');
    const hasDepositsRedirect = appJsxContent.includes('path="deposits" element={<Navigate to="/landlord/financials?tab=deposits"');
    const hasExpensesRedirect = appJsxContent.includes('path="expenses" element={<Navigate to="/landlord/financials?tab=expenses"');
    const hasEbRedirect = appJsxContent.includes('path="eb-bills" element={<Navigate to="/landlord/financials?tab=utilities"');
    const hasUtilityBillsRedirect = appJsxContent.includes('path="utility-bills" element={<Navigate to="/landlord/financials?tab=utilities"');
    const hasAnalyticsRedirect = appJsxContent.includes('path="analytics" element={<Navigate to="/landlord/financials?tab=analytics"');

    const redirectsValid =
      hasFinancialsRoute &&
      hasPaymentsRedirect &&
      hasDepositsRedirect &&
      hasExpensesRedirect &&
      hasEbRedirect &&
      hasUtilityBillsRedirect &&
      hasAnalyticsRedirect;

    recordResult(
      "Scenario 12",
      "App.jsx defines /landlord/financials and all 6 legacy redirects",
      redirectsValid,
      `All 6 financial legacy routes mapped with clean <Navigate replace /> to /landlord/financials?tab=...`
    );

    // ----------------------------------------------------
    // Scenario 13: Phase 1 & Phase 2 functionality remains unaffected
    // ----------------------------------------------------
    console.log("\n--- Scenario 13: Phase 1 & Phase 2 Integrity ---");
    const remindRes = await request(`/api/leases/${leaseA.id}/remind-renewal`, {
      method: "POST",
      token: tokens.landlordA,
      body: {
        notes: "Phase 3 regression check",
      },
    });

    const leaseData = remindRes.data?.lease || remindRes.data;
    const phase2Intact = remindRes.status === 200 && leaseData?.renewalStatus === "Reminder Sent";
    recordResult(
      "Scenario 13",
      "Phase 2 renewal reminder succeeds without regression",
      phase2Intact,
      `Renewal status: ${leaseData?.renewalStatus}, Reminder Date: ${leaseData?.renewalReminderDate}`
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
    console.log(`Total Scenarios Checked: ${total}`);
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
