// test-rent-cycles.cjs
// Verification suite for Move-In Date Rent Calculation & Cycle Management

const http = require("http");

function api(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `http://localhost:5000${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  MOVE-IN DATE RENT CALCULATION TEST SUITE");
  console.log("=======================================================\n");

  // -----------------------------------------------------------------
  // 1. Math Verification: Move-In Date Rent Calculation & 31st Clamping
  // -----------------------------------------------------------------
  console.log("--- 1. Pure Calculation Engine Verification ---");
  const {
    calculateTenantRentCycle,
    getNthRentCycle,
    formatYMD,
    formatDisplayDate,
  } = await import("./backend/utils/rentCycleEngine.js");

  // A. User's Example: Tenant moves in on 10 October
  const lease10th = {
    id: "LSE_TEST_10TH",
    tenantId: "TEN_10",
    tenantName: "Divya Ramesh",
    startDate: "2026-10-10",
    endDate: "2027-09-09",
    monthlyRent: 25000,
  };

  const cycle0 = getNthRentCycle(lease10th.startDate, 0);
  assert(cycle0.periodStart === "2026-10-10", `Cycle 0 start is 2026-10-10 (got ${cycle0.periodStart})`);
  assert(cycle0.periodEnd === "2026-11-09", `Cycle 0 end is 2026-11-09 (got ${cycle0.periodEnd})`);
  assert(cycle0.nextDueDate === "2026-11-10", `Cycle 0 next due date is 2026-11-10 (got ${cycle0.nextDueDate})`);
  assert(cycle0.periodLabel === "10 Oct 2026 – 09 Nov 2026", `Period label formatted correctly: ${cycle0.periodLabel}`);

  const cycle1 = getNthRentCycle(lease10th.startDate, 1);
  assert(cycle1.periodStart === "2026-11-10", `Cycle 1 start is 2026-11-10 (got ${cycle1.periodStart})`);
  assert(cycle1.periodEnd === "2026-12-09", `Cycle 1 end is 2026-12-09 (got ${cycle1.periodEnd})`);
  assert(cycle1.nextDueDate === "2026-12-10", `Cycle 1 next due date is 2026-12-10 (got ${cycle1.nextDueDate})`);

  // B. Month with Fewer Days: Lease starts on 31 January (Leap / Non-Leap Month Clamping)
  console.log("\n--- 2. Fewer Days Handling (31st Move-In Clamping) ---");
  const lease31st = {
    id: "LSE_TEST_31ST",
    startDate: "2026-01-31",
    monthlyRent: 30000,
  };

  const cJan = getNthRentCycle(lease31st.startDate, 0);
  assert(cJan.periodStart === "2026-01-31", `Jan cycle start is 2026-01-31 (got ${cJan.periodStart})`);
  assert(cJan.periodEnd === "2026-02-27", `Jan cycle end is 2026-02-27 (1 day before clamped Feb start, got ${cJan.periodEnd})`);
  assert(cJan.nextDueDate === "2026-02-28", `Feb clamped next due date is 2026-02-28 (got ${cJan.nextDueDate})`);

  const cFeb = getNthRentCycle(lease31st.startDate, 1);
  assert(cFeb.periodStart === "2026-02-28", `Feb cycle start clamped to 2026-02-28 (got ${cFeb.periodStart})`);
  assert(cFeb.periodEnd === "2026-03-30", `Feb cycle ends 2026-03-30 (1 day before Mar 31, got ${cFeb.periodEnd})`);
  assert(cFeb.nextDueDate === "2026-03-31", `March next due date restores to 2026-03-31 (got ${cFeb.nextDueDate})`);

  const cMar = getNthRentCycle(lease31st.startDate, 2);
  assert(cMar.periodStart === "2026-03-31", `March cycle starts on 2026-03-31 (got ${cMar.periodStart})`);
  assert(cMar.periodEnd === "2026-04-29", `March cycle ends 2026-04-29 (1 day before April 30, got ${cMar.periodEnd})`);
  assert(cMar.nextDueDate === "2026-04-30", `April clamped next due date is 2026-04-30 (got ${cMar.nextDueDate})`);

  const cApr = getNthRentCycle(lease31st.startDate, 3);
  assert(cApr.periodStart === "2026-04-30", `April cycle starts on 2026-04-30 (got ${cApr.periodStart})`);
  assert(cApr.periodEnd === "2026-05-30", `April cycle ends 2026-05-30 (1 day before May 31, got ${cApr.periodEnd})`);
  assert(cApr.nextDueDate === "2026-05-31", `May next due date restores to 2026-05-31 (got ${cApr.nextDueDate})`);

  // C. Test calculateTenantRentCycle statuses
  console.log("\n--- 3. Payment Status & Overdue Calculation ---");
  // Today = 2026-10-22. Lease started 2026-10-10 (unpaid) -> overdue by 12 days
  const activeUnpaid = calculateTenantRentCycle(lease10th, new Date(2026, 9, 22), []);
  assert(activeUnpaid.paymentStatus === "Overdue", `Expected Overdue status, got ${activeUnpaid.paymentStatus}`);
  assert(activeUnpaid.daysOverdue === 12, `Expected 12 days overdue, got ${activeUnpaid.daysOverdue}`);
  assert(activeUnpaid.periodLabel === "10 Oct 2026 – 09 Nov 2026", `Period label is 10 Oct 2026 – 09 Nov 2026`);

  // If paid for current cycle
  const activePaid = calculateTenantRentCycle(lease10th, new Date(2026, 9, 22), [
    { periodStart: "2026-10-10", status: "Paid" },
  ]);
  assert(activePaid.paymentStatus === "Paid", `Expected Paid status, got ${activePaid.paymentStatus}`);
  assert(activePaid.nextDueDateFormatted === "10 Nov 2026", `Next rent due date is 10 Nov 2026`);

  // If due soon (e.g. today is 2026-10-08, 2 days before 10 Oct)
  const activeDueSoon = calculateTenantRentCycle(lease10th, new Date(2026, 9, 8), []);
  assert(activeDueSoon.paymentStatus === "Due Soon", `Expected Due Soon status, got ${activeDueSoon.paymentStatus}`);
  assert(activeDueSoon.daysRemaining === 2, `Expected 2 days remaining, got ${activeDueSoon.daysRemaining}`);

  // -----------------------------------------------------------------
  // 2. Backend API Endpoint Verification
  // -----------------------------------------------------------------
  console.log("\n--- 4. Backend Rent Cycle Endpoints Verification ---");

  // A. Fetch rent schedules for all leases
  const resSched = await api("GET", "/api/leases/rent-schedules");
  assert(resSched.status === 200, `GET /api/leases/rent-schedules returns 200 (got ${resSched.status})`);
  assert(resSched.data.success === true, `rent-schedules reports success: true`);
  assert(Array.isArray(resSched.data.schedules) && resSched.data.schedules.length > 0, `Returned active rent schedules: ${resSched.data.count}`);

  const sampleSched = resSched.data.schedules[0];
  console.log(`   Sample Schedule: Lease ${sampleSched.lease.id} (${sampleSched.lease.tenantName})`);
  console.log(`   - Move-in Date: ${sampleSched.rentCycle.moveInDate}`);
  console.log(`   - Current Period: ${sampleSched.rentCycle.periodLabel}`);
  console.log(`   - Next Due Date: ${sampleSched.rentCycle.nextDueDateFormatted}`);
  console.log(`   - Status: ${sampleSched.rentCycle.paymentStatus}`);
  assert(sampleSched.rentCycle.periodLabel, "Rental period label is populated");
  assert(sampleSched.rentCycle.nextDueDateFormatted, "Next due date formatted is populated");

  // B. Single lease rent cycle
  const leaseId = sampleSched.lease.id;
  const resSingle = await api("GET", `/api/leases/${leaseId}/rent-cycle`);
  assert(resSingle.status === 200, `GET /api/leases/${leaseId}/rent-cycle returns 200`);
  assert(resSingle.data.rentCycle.leaseId === leaseId, `rentCycle leaseId matches ${leaseId}`);

  // -----------------------------------------------------------------
  // 3. Duplicate Invoice Prevention Verification
  // -----------------------------------------------------------------
  console.log("\n--- 5. Duplicate Rent Invoices Prevention Verification ---");

  // Create a dedicated test lease with move-in date on the 10th
  const testLeaseId = `LSE_DUP_${Date.now()}`;
  const createLeaseRes = await api("POST", "/api/leases", {
    id: testLeaseId,
    tenantId: "TEN001",
    propertyId: "TN101",
    landlordId: "LDL001",
    startDate: "2026-10-10",
    endDate: "2027-09-09",
    monthlyRent: 22000,
    status: "Active",
  });
  assert(createLeaseRes.status === 201, `Created test lease ${testLeaseId}`);

  // Call 1: Generate rent invoice for current cycle
  const gen1 = await api("POST", `/api/leases/${testLeaseId}/generate-rent-invoice`);
  assert(gen1.status === 201 || gen1.status === 200, `First generate-rent-invoice succeeded (status ${gen1.status})`);
  assert(gen1.data.invoice, "First call returned invoice object");
  const invoiceNo1 = gen1.data.invoice.invoiceNo;
  const paymentId1 = gen1.data.invoice.id;
  console.log(`   First Invoice Generated: ID ${paymentId1}, No: ${invoiceNo1}`);

  // Call 2: Generate rent invoice AGAIN for the same cycle
  const gen2 = await api("POST", `/api/leases/${testLeaseId}/generate-rent-invoice`);
  assert(gen2.status === 200, `Second generate-rent-invoice returned 200 (got ${gen2.status})`);
  assert(gen2.data.created === false, `Second call returned created: false (DUPLICATE PREVENTED!)`);
  assert(gen2.data.invoice.invoiceNo === invoiceNo1, `Second call returned existing invoice ${invoiceNo1}`);

  // Call 3: Direct POST /api/payments with same invoiceNo
  const directPayRes = await api("POST", "/api/payments", {
    invoiceNo: invoiceNo1,
    leaseId: testLeaseId,
    amount: 22000,
    month: gen1.data.rentCycle.periodLabel,
  });
  assert(directPayRes.status === 200, `Direct POST /api/payments returned existing invoice (status 200, no duplicate inserted)`);
  assert(directPayRes.data.id === paymentId1, `Duplicate invoice prevention preserved original payment ID`);

  // Verify total count in payments for this invoiceNo is exactly 1
  const allPayRes = await api("GET", `/api/payments?leaseId=${testLeaseId}`);
  const matching = allPayRes.data.filter((p) => p.invoiceNo === invoiceNo1 || p.id === paymentId1);
  assert(matching.length === 1, `Payment count for invoice ${invoiceNo1} is strictly 1 (got ${matching.length})`);

  // -----------------------------------------------------------------
  // 4. Payment Settlement & Move-In Cycle Update
  // -----------------------------------------------------------------
  console.log("\n--- 6. Rent Settlement & Cycle Update ---");
  const paySettle = await api("PUT", `/api/payments/${paymentId1}`, {
    status: "Paid",
    paidDate: "2026-10-22",
    method: "UPI",
  });
  assert(paySettle.status === 200, `Payment settled via PUT /api/payments/${paymentId1}`);
  assert(paySettle.data.status === "Paid", `Payment status is Paid`);

  // Re-fetch rent cycle for this lease: status should now be "Paid" and next rent due on 10 Nov 2026
  const updatedCycleRes = await api("GET", `/api/leases/${testLeaseId}/rent-cycle`);
  assert(updatedCycleRes.data.rentCycle.paymentStatus === "Paid", `Lease rent cycle updated to Paid (got ${updatedCycleRes.data.rentCycle.paymentStatus})`);
  assert(updatedCycleRes.data.rentCycle.nextDueDateFormatted === "10 Nov 2026", `Next rent due date is 10 Nov 2026`);
  console.log(`   Rent Cycle Updated: Period ${updatedCycleRes.data.rentCycle.periodLabel} Paid! Next Due: ${updatedCycleRes.data.rentCycle.nextDueDateFormatted}`);

  // -----------------------------------------------------------------
  // 5. Automated Reminders & Manual Remind Dispatch
  // -----------------------------------------------------------------
  console.log("\n--- 7. Rent Reminders & Notification System Integration ---");

  // Manual Remind Tenant
  const remindRes = await api("POST", `/api/leases/${testLeaseId}/remind-rent`, {
    message: "Custom move-in rent reminder",
  });
  assert(remindRes.status === 200, `POST /api/leases/${testLeaseId}/remind-rent returned 200`);
  assert(remindRes.data.success === true, `remind-rent returned success: true`);

  // Automated Reminders Scan
  const triggerRes = await api("POST", "/api/leases/trigger-reminders");
  assert(triggerRes.status === 200, `POST /api/leases/trigger-reminders returned 200`);
  assert(triggerRes.data.success === true, `Automated reminders scanner executed successfully`);
  console.log(`   Reminders dispatched: ${triggerRes.data.remindersDispatched}, Overdue marked: ${triggerRes.data.overdueMarked}`);

  // Clean up test lease and payment
  await api("DELETE", `/api/leases/${testLeaseId}`);
  await api("DELETE", `/api/payments/${paymentId1}`);

  console.log("\n=======================================================");
  console.log("  ALL MOVE-IN DATE RENT CALCULATION TESTS PASSED! 🎉");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
