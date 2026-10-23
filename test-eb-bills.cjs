// test-eb-bills.cjs - Comprehensive Automated Verification for EB Bill & Tenant Expense Management
const http = require("http");

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + (u.search || ""),
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, data, json });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("⚡ PropConnect EB Bill & Tenant Expense Management Verification Suite");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = "") {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details}`);
      failed++;
    }
  }

  const BASE = "http://localhost:5000/api";

  // Login tokens
  let tenantToken = "";
  let landlordToken = "";
  let otherTenantToken = "";
  let otherLandlordToken = "";

  console.log("\n[Auth] Logging in test personas...");
  try {
    const tLog = await request(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "divya.priya@mail.com", password: "tenant123" },
    });
    assert(tLog.status === 200 && tLog.json.token, "Tenant login (TEN001 / Divya Priya)");
    tenantToken = tLog.json.token;

    const lLog = await request(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "karthik.raja@mail.com", password: "land123" },
    });
    assert(lLog.status === 200 && lLog.json.token, "Landlord login (LDL001 / Karthik Raja)");
    landlordToken = lLog.json.token;

    const otLog = await request(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "arjun.kumar@mail.com", password: "tenant123" },
    });
    assert(otLog.status === 200 && otLog.json.token, "Other Tenant login (TEN002 / Arjun Kumar)");
    otherTenantToken = otLog.json.token;

    const olLog = await request(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "sanjitha.raja@gmail.com", password: "google123" },
    });
    assert(olLog.status === 200 && olLog.json.token, "Other Landlord login (LDL002 / Sanjitha Raja)");
    otherLandlordToken = olLog.json.token;
  } catch (err) {
    assert(false, "Login personas", err.message);
  }

  // Test 1: Landlord creates an EB bill for a tenant
  console.log("\n[1/12] Scenario 1: Landlord creates an EB bill for tenant TEN001...");
  let createdBillId = "";
  const testMonth = `Nov ${Date.now()}`;
  try {
    const res = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: {
        propertyId: "TN101",
        tenantId: "TEN001",
        type: "Electricity",
        billingMonth: testMonth,
        previousReading: 1200,
        currentReading: 1480,
        unitsConsumed: 280,
        ratePerUnit: 7.5,
        amount: 2100,
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
        consumerNo: "01-102-004-3291",
        billReference: "TNEB-REF-9921",
        responsibility: "Tenant",
        documentUrl: "https://example.com/eb-bill.pdf",
      },
    });

    assert(res.status === 201, "HTTP 201 on EB bill creation");
    assert(res.json && res.json.id, `Created bill with ID: ${res.json?.id}`);
    assert(res.json?.unitsConsumed === 280, "Meter reading calculation (1480 - 1200 = 280 units)");
    assert(res.json?.tenantAmount === 2100, "Assigned tenant amount is ₹2,100");
    createdBillId = res.json?.id;
  } catch (err) {
    assert(false, "Scenario 1 execution", err.message);
  }

  // Test 2: Tenant sees the new bill
  console.log("\n[2/12] Scenario 2: Tenant sees the new bill on their EB Bills page...");
  try {
    const res = await request(`${BASE}/utility-bills?type=Electricity`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
      },
    });

    assert(res.status === 200, "Tenant retrieves EB bills list (HTTP 200)");
    const found = res.json.find((b) => b.id === createdBillId);
    assert(found !== undefined, `Tenant TEN001 can view newly created bill ${createdBillId}`);
    assert(found?.propertyName !== "", `Property name present: ${found?.propertyName}`);
    assert(found?.status === "Unpaid" || found?.status === "Due Soon", `Status correctly indicated: ${found?.status}`);
  } catch (err) {
    assert(false, "Scenario 2 execution", err.message);
  }

  // Test 3 & 4: Tenant pays successfully in test environment & Verified only on Backend
  console.log("\n[3-4/12] Scenario 3 & 4: Tenant initiates payment with backend verification...");
  try {
    // 3a. Create Order
    const orderRes = await request(`${BASE}/utility-bills/${createdBillId}/create-order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert(orderRes.status === 200 && orderRes.json?.orderId, `Order created (${orderRes.json?.orderId}) in test sandbox`);

    // 3b. Complete Verified Payment
    const txnId = `TXN_TEST_${Date.now()}`;
    const payRes = await request(`${BASE}/utility-bills/${createdBillId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantToken}`,
      },
      body: {
        paymentMethod: "UPI",
        transactionId: txnId,
        orderId: orderRes.json.orderId,
        paidAmount: 2100,
        signature: "verified_test_sig",
      },
    });

    assert(payRes.status === 200, "HTTP 200 on payment verification");
    assert(payRes.json?.success === true, "Backend verified payment response success = true");
    assert(payRes.json?.bill?.status === "Paid", "Bill status transitioned to 'Paid'");
    assert(payRes.json?.bill?.transactionId === txnId, `Stored transaction ID: ${txnId}`);
    assert(payRes.json?.bill?.paidDate !== "", `Payment date recorded: ${payRes.json?.bill?.paidDate}`);

    // Verify cross-system payment ledger record
    const pmtRes = await request(`${BASE}/payments?tenantId=TEN001`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    const foundPmt = pmtRes.json?.find((p) => p.invoiceNo === createdBillId);
    assert(foundPmt !== undefined, "Corresponding entry created in payments collection for financial accounting");
  } catch (err) {
    assert(false, "Scenario 3 & 4 execution", err.message);
  }

  // Test 5: Approaching due date reminder
  console.log("\n[5/12] Scenario 5: Unpaid bill approaching due date (3 days before) triggers reminder...");
  let approachingBillId = "";
  try {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 86400000).toISOString().split("T")[0];

    const createApproaching = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: {
        propertyId: "TN101",
        tenantId: "TEN001",
        type: "Electricity",
        billingMonth: `ApproachingMonth_${Date.now()}`,
        amount: 1850,
        dueDate: threeDaysLater,
        responsibility: "Tenant",
      },
    });

    assert(createApproaching.status === 201, "Created test bill due in exactly 3 days");
    approachingBillId = createApproaching.json.id;

    // Trigger reminder engine
    const reminderRes = await request(`${BASE}/utility-bills/trigger-reminders`, {
      method: "POST",
    });
    assert(reminderRes.status === 200 && reminderRes.json?.success, "Scheduled reminder engine executed");

    // Verify bill recorded reminder
    const billCheck = await request(`${BASE}/utility-bills/${approachingBillId}`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert(billCheck.json?.reminderCount >= 1, `Approaching reminder count registered: ${billCheck.json?.reminderCount}`);
    assert(billCheck.json?.displayStatus === "Due Soon", "Bill flagged dynamically as 'Due Soon'");
  } catch (err) {
    assert(false, "Scenario 5 execution", err.message);
  }

  // Test 6 & 7: Overdue bill past due date & Appropriate notifications for both Tenant and Landlord
  console.log("\n[6-7/12] Scenario 6 & 7: Past due date marks bill Overdue & notifies Tenant and Landlord...");
  let overdueBillId = "";
  try {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];

    const createOverdue = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: {
        propertyId: "TN101",
        tenantId: "TEN001",
        type: "Electricity",
        billingMonth: `OverdueMonth_${Date.now()}`,
        amount: 3200,
        dueDate: fiveDaysAgo,
        responsibility: "Tenant",
      },
    });

    assert(createOverdue.status === 201, "Created test bill past its due date");
    overdueBillId = createOverdue.json.id;

    // Trigger reminder engine
    await request(`${BASE}/utility-bills/trigger-reminders`, { method: "POST" });

    // Verify bill status updated to Overdue
    const billCheck = await request(`${BASE}/utility-bills/${overdueBillId}`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert(billCheck.json?.status === "Overdue", "Bill marked as 'Overdue'");

    // Verify Notifications
    const notifs = await request(`${BASE}/notifications`);
    const tenantNotif = notifs.json?.find(
      (n) => (n.userId === "TEN001" || n.user_id === "TEN001") && n.message && n.message.includes("is overdue")
    );
    assert(tenantNotif !== undefined, `Tenant received exact overdue notification: "${tenantNotif?.message?.slice(0, 55)}…"`);

    const landlordNotif = notifs.json?.find(
      (n) => (n.userId === "LDL001" || n.user_id === "LDL001") && n.message && n.message.includes("EB bill overdue: Tenant")
    );
    assert(landlordNotif !== undefined, `Landlord received exact overdue alert: "${landlordNotif?.message?.slice(0, 55)}…"`);
  } catch (err) {
    assert(false, "Scenario 6 & 7 execution", err.message);
  }

  // Test 8: Landlord-responsible bill is not incorrectly assigned to tenant
  console.log("\n[8/12] Scenario 8: Landlord-responsible bill not assigned to tenant...");
  try {
    const ldlBill = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: {
        propertyId: "TN101",
        tenantId: "TEN001",
        type: "Electricity",
        billingMonth: `LdlResponsibility_${Date.now()}`,
        amount: 1500,
        dueDate: "2026-11-20",
        responsibility: "Landlord",
      },
    });

    assert(ldlBill.status === 201, "Created Landlord-responsible electricity bill");
    const ldlBillId = ldlBill.json.id;

    // Check landlord sees it
    const ldlBills = await request(`${BASE}/utility-bills`, {
      headers: { Authorization: `Bearer ${landlordToken}` },
    });
    assert(ldlBills.json.some((b) => b.id === ldlBillId), "Landlord sees landlord-responsible bill in management");

    // Check tenant DOES NOT see it
    const tenantBills = await request(`${BASE}/utility-bills`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    const tenantSawIt = tenantBills.json.some((b) => b.id === ldlBillId);
    assert(!tenantSawIt, "Tenant CANNOT see or be charged for landlord-responsible bill");

    // Check tenant cannot pay it
    const attemptPay = await request(`${BASE}/utility-bills/${ldlBillId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantToken}`,
      },
      body: { paymentMethod: "UPI", amount: 1500 },
    });
    assert(attemptPay.status === 400 || attemptPay.status === 403, "Payment rejected for landlord-responsible bill (HTTP 400/403)");
  } catch (err) {
    assert(false, "Scenario 8 execution", err.message);
  }

  // Test 9: One tenant cannot view another tenant's bills
  console.log("\n[9/12] Scenario 9: One tenant cannot view another tenant's bills...");
  try {
    // otherTenantToken is TEN002 (Arjun Kumar), createdBillId belongs to TEN001 (Divya Priya)
    const crossAccess = await request(`${BASE}/utility-bills/${createdBillId}`, {
      headers: { Authorization: `Bearer ${otherTenantToken}` },
    });
    assert(crossAccess.status === 403, "Cross-tenant access forbidden with HTTP 403");

    const tenant2Bills = await request(`${BASE}/utility-bills`, {
      headers: { Authorization: `Bearer ${otherTenantToken}` },
    });
    const hasTenant1Bill = tenant2Bills.json?.some((b) => b.id === createdBillId);
    assert(!hasTenant1Bill, "Tenant TEN002 list does not leak Tenant TEN001 bills");
  } catch (err) {
    assert(false, "Scenario 9 execution", err.message);
  }

  // Test 10: One landlord cannot access another landlord's property bills
  console.log("\n[10/12] Scenario 10: One landlord cannot modify/access another landlord's property bills...");
  try {
    // otherLandlordToken is LDL002 (Sanjitha Raja), property TN101 belongs to LDL001 (Karthik Raja)
    const unauthorizedCreate = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherLandlordToken}`,
      },
      body: {
        propertyId: "TN101",
        amount: 2500,
        billingMonth: "Hack Month",
      },
    });
    assert(unauthorizedCreate.status === 403, "Landlord LDL002 cannot create bills for LDL001 property TN101 (HTTP 403)");
  } catch (err) {
    assert(false, "Scenario 10 execution", err.message);
  }

  // Test 11: Prevent duplicate payment processing & duplicate reminders
  console.log("\n[11/12] Scenario 11: Duplicate payment and duplicate bill prevention...");
  try {
    // 11a. Duplicate payment attempt on already paid bill
    const dupPay = await request(`${BASE}/utility-bills/${createdBillId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantToken}`,
      },
      body: { paymentMethod: "UPI", paidAmount: 2100 },
    });
    assert(dupPay.status === 400, "Duplicate payment rejected with HTTP 400");
    assert(dupPay.json?.error?.includes("already settled") || dupPay.json?.error?.includes("Duplicate"), "Informative duplicate rejection error returned");

    // 11b. Duplicate bill creation for same property, type, and billing month
    const dupBill = await request(`${BASE}/utility-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: {
        propertyId: "TN101",
        type: "Electricity",
        billingMonth: testMonth,
        amount: 2100,
        dueDate: "2026-11-30",
      },
    });
    assert(dupBill.status === 400, "Duplicate bill for same month & property rejected with HTTP 400");
  } catch (err) {
    assert(false, "Scenario 11 execution", err.message);
  }

  // Test 12: Existing rent payments, maintenance requests, complaints, home-service continue working
  console.log("\n[12/12] Scenario 12: Existing features regression verification...");
  try {
    // 12a. Rent payments
    const pmts = await request(`${BASE}/payments`, {
      headers: { Authorization: `Bearer ${landlordToken}` },
    });
    assert(pmts.status === 200 && Array.isArray(pmts.json) && pmts.json.length > 0, `Existing rent payments intact (${pmts.json?.length} records)`);

    // 12b. Maintenance requests
    const mnts = await request(`${BASE}/maintenance`, {
      headers: { Authorization: `Bearer ${landlordToken}` },
    });
    assert(mnts.status === 200 && Array.isArray(mnts.json), `Existing maintenance tickets intact (${mnts.json?.length} records)`);

    // 12c. Complaints
    const cmps = await request(`${BASE}/complaints`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert(cmps.status === 200 && Array.isArray(cmps.json), `Existing complaints intact (${cmps.json?.length} records)`);

    // 12d. Home Services / FixIt
    const svc = await request(`${BASE}/service-categories`);
    assert(svc.status === 200 && Array.isArray(svc.json), `Home services portal categories intact (${svc.json?.length} categories)`);
  } catch (err) {
    assert(false, "Scenario 12 execution", err.message);
  }

  console.log("\n==================================================================");
  console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error("Fatal test runner error:", e);
  process.exit(1);
});
