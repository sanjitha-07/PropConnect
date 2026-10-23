// test-reminders-and-rent-amounts.cjs
const http = require("http");

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on("error", reject);
  });
}

function post(path, bodyObj = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(bodyObj);
    const req = http.request(
      `http://localhost:5000${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("\n=======================================================");
  console.log("  VERIFYING NON-ZERO RENTS & REMINDERS CENTER API");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check all payments
  console.log("--- 1. Payments Non-Zero Verification ---");
  const paymentsRes = await get("/api/payments");
  assert(paymentsRes.status === 200, "GET /api/payments returned 200");
  const payments = paymentsRes.body;
  assert(Array.isArray(payments) && payments.length > 0, `Returned ${payments.length} payments`);

  const zeroPayments = payments.filter((p) => !p.amount || Number(p.amount) <= 0);
  assert(zeroPayments.length === 0, `Zero-amount payments count is strictly 0 (found ${zeroPayments.length})`);

  const lseP01 = payments.find((p) => p.id && p.id.includes("LSE-P01"));
  if (lseP01) {
    assert(Number(lseP01.amount) === 10000, `Parking Bay LSE-P01 rent is ₹10,000 (got ₹${lseP01.amount})`);
  }

  const lseS02 = payments.find((p) => p.id && p.id.includes("LSE-S02"));
  if (lseS02) {
    assert(Number(lseS02.amount) === 7000, `Storage Unit LSE-S02 rent is ₹7,000 (got ₹${lseS02.amount})`);
  }

  const lse001 = payments.find((p) => p.id && p.id.includes("LSE001_"));
  if (lse001) {
    assert(Number(lse001.amount) === 22000, `Sai Kala Flat 302 LSE001 rent is ₹22,000 (got ₹${lse001.amount})`);
  }

  // 2. Check rent schedules
  console.log("\n--- 2. Rent Schedules Non-Zero Verification ---");
  const schedRes = await get("/api/leases/rent-schedules");
  assert(schedRes.status === 200, "GET /api/leases/rent-schedules returned 200");
  const schedules = schedRes.body.schedules || [];
  assert(schedules.length > 0, `Returned ${schedules.length} lease schedules`);

  const zeroSchedules = schedules.filter((s) => !s.rentCycle || !s.rentCycle.rentAmount || s.rentCycle.rentAmount <= 0);
  assert(zeroSchedules.length === 0, `Zero-amount rent cycle schedules count is strictly 0 (found ${zeroSchedules.length})`);

  // 3. Tenant Reminders Summary
  console.log("\n--- 3. Tenant Reminders Summary ---");
  const tenantRemRes = await get("/api/reminders/summary?role=tenant&tenantId=TEN001");
  assert(tenantRemRes.status === 200, "GET /api/reminders/summary for tenant returned 200");
  assert(tenantRemRes.body.success === true, "Tenant reminders response success: true");
  assert(tenantRemRes.body.role === "tenant", "Response role is tenant");
  assert(tenantRemRes.body.summary.totalBillsCount > 0, `Tenant has ${tenantRemRes.body.summary.totalBillsCount} total pending bills`);
  assert(tenantRemRes.body.summary.totalPendingAmount > 0, `Tenant total pending amount is ₹${tenantRemRes.body.summary.totalPendingAmount.toLocaleString("en-IN")}`);
  assert(tenantRemRes.body.items.length > 0, `Tenant has ${tenantRemRes.body.items.length} reminder items`);

  // Verify tenant reminder item fields
  const firstTenantItem = tenantRemRes.body.items[0];
  assert(!!firstTenantItem.title, `Item title present: "${firstTenantItem.title}"`);
  assert(Number(firstTenantItem.amount) > 0, `Item amount is positive: ₹${firstTenantItem.amount}`);
  assert(!!firstTenantItem.dueDate, `Item dueDate present: ${firstTenantItem.dueDate}`);
  assert(!!firstTenantItem.actionLabel, `Action label present: "${firstTenantItem.actionLabel}"`);

  // 4. Landlord Reminders Summary
  console.log("\n--- 4. Landlord Reminders Summary ---");
  const landlordRemRes = await get("/api/reminders/summary?role=landlord&landlordId=LDL001");
  assert(landlordRemRes.status === 200, "GET /api/reminders/summary for landlord returned 200");
  assert(landlordRemRes.body.success === true, "Landlord reminders response success: true");
  assert(landlordRemRes.body.role === "landlord", "Response role is landlord");
  assert(landlordRemRes.body.summary.totalBillsCount > 0, `Landlord has ${landlordRemRes.body.summary.totalBillsCount} pending bills across tenants`);
  assert(landlordRemRes.body.summary.uniqueTenantsCount > 0, `Landlord tracks ${landlordRemRes.body.summary.uniqueTenantsCount} unique tenants`);
  assert(landlordRemRes.body.summary.totalPendingAmount > 0, `Total pending tenant balance is ₹${landlordRemRes.body.summary.totalPendingAmount.toLocaleString("en-IN")}`);

  // 5. Landlord Remind All
  console.log("\n--- 5. Remind All Dispatches ---");
  const remindAllRes = await post("/api/reminders/send-all", { landlordId: "LDL001" });
  assert(remindAllRes.status === 200, "POST /api/reminders/send-all returned 200");
  assert(remindAllRes.body.success === true, "Remind-all returned success: true");
  assert(remindAllRes.body.dispatchedCount >= 0, `Dispatched count: ${remindAllRes.body.dispatchedCount}`);

  console.log("\n=======================================================");
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
