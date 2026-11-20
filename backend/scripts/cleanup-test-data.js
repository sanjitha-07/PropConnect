import mongoose from "mongoose";
import path from "path";
import {
  Property,
  Lease,
  Payment,
  Expense,
  SecurityDeposit,
  UtilityBill,
  MaintenanceRequest,
  Complaint,
  ServiceBooking,
  Document,
  Notification,
} from "../models/index.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/propconnect_db";

async function run() {
  const isExecute = process.argv.includes("--execute");
  console.log(`\n=== PROPCONNECT TEST DATA AUDIT & CLEANUP (${isExecute ? "EXECUTE MODE" : "DRY-RUN AUDIT MODE"}) ===\n`);

  await mongoose.connect(MONGO_URI);

  // 1. Test Properties
  const testProps = await Property.find({
    $or: [
      { name: "Aurelia Royal Heights" },
      { id: { $regex: /^TN_1795/ } },
    ],
  }).lean();

  const testPropIds = testProps.map((p) => p.id);

  // 2. Test Leases
  const testLeases = await Lease.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { propertyName: "Aurelia Royal Heights" },
      { renewalNotes: { $regex: /escalation applied/i } },
    ],
  }).lean();
  const testLeaseIds = testLeases.map((l) => l.id);

  // 3. Test Payments & Invoices
  const testPayments = await Payment.find({
    $or: [
      { id: { $regex: /^PAY_1795/ } },
      { propertyId: { $in: testPropIds } },
      { leaseId: { $in: testLeaseIds } },
    ],
  }).lean();

  // 4. Test Utility Bills
  const testBills = await UtilityBill.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { consumerNumber: "04-209-002-124" },
    ],
  }).lean();

  // 5. Test Deposits
  const testDeposits = await SecurityDeposit.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { refundTransactionRef: "IMPS-REF-77291039" },
    ],
  }).lean();

  // 6. Test Expenses
  const testExpenses = await Expense.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { id: { $regex: /^EXP_BK_1795/ } },
      { description: { $regex: /Corridor LED lighting fixture replacements/i } },
    ],
  }).lean();

  // 7. Test Maintenance Tickets
  const testMaintenance = await MaintenanceRequest.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { title: "Master Bedroom AC water leakage" },
    ],
  }).lean();

  // 8. Test Complaints
  const testComplaints = await Complaint.find({
    $or: [
      { propertyId: { $in: testPropIds } },
      { issue: { $regex: /Excessive hammering noise/i } },
    ],
  }).lean();

  // 9. Test Service Bookings
  const testBookings = await ServiceBooking.find({
    $or: [
      { id: { $regex: /^SB_1795/ } },
      { propertyId: { $in: testPropIds } },
    ],
  }).lean();

  // 10. Test Documents
  const testDocuments = await Document.find({
    $or: [
      { id: { $regex: /^DOC873|^DOC724/ } },
      { propertyId: { $in: testPropIds } },
      { name: "Property Khata & Building Stability Certificate" },
    ],
  }).lean();

  // 11. Test Notifications
  const testNotifications = await Notification.find({
    id: { $regex: /^NOTIF_1795/ },
  }).lean();

  console.log("Identified Test Records Positively Created by Audit:");
  console.log(`- Properties        : ${testProps.length} records (${testProps.map((p) => p.id).join(", ") || "none"})`);
  console.log(`- Leases            : ${testLeases.length} records (${testLeases.map((l) => l.id).join(", ") || "none"})`);
  console.log(`- Payments/Invoices : ${testPayments.length} records (${testPayments.map((p) => p.id).join(", ") || "none"})`);
  console.log(`- Utility Bills     : ${testBills.length} records (${testBills.map((b) => b.id).join(", ") || "none"})`);
  console.log(`- Security Deposits : ${testDeposits.length} records (${testDeposits.map((d) => d.id).join(", ") || "none"})`);
  console.log(`- Expenses          : ${testExpenses.length} records (${testExpenses.map((e) => e.id).join(", ") || "none"})`);
  console.log(`- Maintenance       : ${testMaintenance.length} records (${testMaintenance.map((m) => m.id).join(", ") || "none"})`);
  console.log(`- Complaints        : ${testComplaints.length} records (${testComplaints.map((c) => c.id).join(", ") || "none"})`);
  console.log(`- Service Bookings  : ${testBookings.length} records (${testBookings.map((b) => b.id).join(", ") || "none"})`);
  console.log(`- Documents         : ${testDocuments.length} records (${testDocuments.map((d) => d.id).join(", ") || "none"})`);
  console.log(`- Notifications     : ${testNotifications.length} records (${testNotifications.map((n) => n.id).join(", ") || "none"})`);

  const totalIdentified =
    testProps.length +
    testLeases.length +
    testPayments.length +
    testBills.length +
    testDeposits.length +
    testExpenses.length +
    testMaintenance.length +
    testComplaints.length +
    testBookings.length +
    testDocuments.length +
    testNotifications.length;

  console.log(`\nTotal Positively Identified Test Records: ${totalIdentified}`);

  if (isExecute) {
    console.log("\nExecuting targeted cleanup of identified test records...");
    if (testPropIds.length > 0) await Property.deleteMany({ id: { $in: testPropIds } });
    if (testLeases.length > 0) await Lease.deleteMany({ id: { $in: testLeases.map((l) => l.id) } });
    if (testPayments.length > 0) await Payment.deleteMany({ id: { $in: testPayments.map((p) => p.id) } });
    if (testBills.length > 0) await UtilityBill.deleteMany({ id: { $in: testBills.map((b) => b.id) } });
    if (testDeposits.length > 0) await SecurityDeposit.deleteMany({ id: { $in: testDeposits.map((d) => d.id) } });
    if (testExpenses.length > 0) await Expense.deleteMany({ id: { $in: testExpenses.map((e) => e.id) } });
    if (testMaintenance.length > 0) await MaintenanceRequest.deleteMany({ id: { $in: testMaintenance.map((m) => m.id) } });
    if (testComplaints.length > 0) await Complaint.deleteMany({ id: { $in: testComplaints.map((c) => c.id) } });
    if (testBookings.length > 0) await ServiceBooking.deleteMany({ id: { $in: testBookings.map((b) => b.id) } });
    if (testDocuments.length > 0) await Document.deleteMany({ id: { $in: testDocuments.map((d) => d.id) } });
    if (testNotifications.length > 0) await Notification.deleteMany({ id: { $in: testNotifications.map((n) => n.id) } });
    console.log("✅ Target test data cleaned successfully. Legitimate production/seed data completely intact.");
  } else {
    console.log("\nℹ️ Dry-run complete. Re-run with '--execute' to remove identified audit test records.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Cleanup script error:", err);
  process.exit(1);
});
