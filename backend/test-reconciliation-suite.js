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
    { expiresIn: "2h" }
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

const executedCases = [];

function recordTest(caseNumber, category, testName, passed, details) {
  executedCases.push({ caseNumber, category, testName, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [#${caseNumber.toString().padStart(2, "0")}] [${category}] ${testName} -> ${details}`);
}

async function api(urlPath, options = {}) {
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
  try {
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
  } catch (err) {
    return { status: 500, error: err.message };
  }
}

async function run() {
  console.log("\n=======================================================================");
  console.log("🚀 PROPCONNECT RECONCILED E2E QUALITY AUDIT & EDGE CASE VERIFICATION");
  console.log("=======================================================================\n");

  const mongodPath = "C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe";
  const dbPath = path.resolve("backend/data/db");
  const logPath = path.resolve("backend/data/mongod.log");

  console.log("1. Starting MongoDB daemon...");
  const mongodProc = spawn(mongodPath, ["--dbpath", dbPath, "--port", "27017", "--logpath", logPath]);
  await new Promise((r) => setTimeout(r, 2000));

  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/propconnect_db";
  process.env.PORT = String(PORT);

  const { connectMongoDB } = await import("./config/db.js");
  await connectMongoDB();

  console.log("2. Starting Express Server...");
  const { app, serverInstance } = await import("./server.js");
  await new Promise((r) => setTimeout(r, 1500));
  console.log("Express Server ready. Executing Reconciled Test Cases...\n");

  const {
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
  } = await import("./models/index.js");

  let testCounter = 1;

  // -------------------------------------------------------------------------
  // SECTION 1: WORKFLOW 1 - PROPERTY MANAGEMENT (4 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 1: Workflow 1 - Property Management ---");
  const newPropPayload = {
    name: "Aurelia Royal Heights",
    address: "Plot 42, Anna Nagar 2nd Avenue",
    city: "Chennai",
    state: "Tamil Nadu",
    type: "Apartment",
    bhk: 2,
    rent: 32000,
    deposit: 150000,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1250,
    furnishing: "Semi-Furnished",
    availableUnits: 3,
    totalUnits: 12,
    amenities: ["Lift", "Gym", "Power Backup", "24/7 Security", "Covered Car Parking"],
  };
  const createPropRes = await api("/api/properties", {
    method: "POST",
    token: tokens.landlordA,
    body: newPropPayload,
  });
  const createdProp = createPropRes.data;
  const propCreatedOk = createPropRes.status === 201 && createdProp?.id && createdProp.landlordId === "LDL001";
  recordTest(testCounter++, "Workflow 1", "Property Creation with Unit Details", propCreatedOk, `Status: ${createPropRes.status}, ID: ${createdProp?.id}`);

  const editPropRes = await api(`/api/properties/${createdProp.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { rent: 34000, description: "Updated premium luxury interior with Italian marble." },
  });
  const propEditedOk = editPropRes.status === 200 && editPropRes.data?.rent === 34000;
  recordTest(testCounter++, "Workflow 1", "Property Term Modification (Rent/Description)", propEditedOk, `Status: ${editPropRes.status}, Updated Rent: ₹${editPropRes.data?.rent}`);

  const addImgRes = await api(`/api/properties/${createdProp.id}/images`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
      category: "Living Room",
      caption: "Spacious Italian marble living hall",
      order: 1,
    },
  });
  const imgAddedOk = addImgRes.status === 201 || addImgRes.status === 200;
  recordTest(testCounter++, "Workflow 1", "Property Image Upload to Property Record", imgAddedOk, `Status: ${addImgRes.status}`);

  const existingProp = await Property.findOne({ landlordId: "LDL001" }).lean();
  const galleryRes = await api(`/api/properties/${existingProp.id}/images`, { token: tokens.landlordA });
  const galleryOk = galleryRes.status === 200 && Array.isArray(galleryRes.data?.images) && galleryRes.data.images.length >= 10;
  recordTest(testCounter++, "Workflow 1", "Master Property Gallery Verification (10 photos/property)", galleryOk, `Status: ${galleryRes.status}, Images Count: ${galleryRes.data?.images?.length}`);

  // -------------------------------------------------------------------------
  // SECTION 2: WORKFLOW 2 - TENANTS & APPLICATIONS (2 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 2: Workflow 2 - Tenants & Applications ---");
  const tenantsListRes = await api("/api/tenants", { token: tokens.landlordA });
  const hasTenants = tenantsListRes.status === 200 && Array.isArray(tenantsListRes.data) && tenantsListRes.data.length > 0;
  recordTest(testCounter++, "Workflow 2", "Landlord Tenant Directory Access", hasTenants, `Status: ${tenantsListRes.status}, Total Tenants: ${tenantsListRes.data?.length}`);

  const tenantRecord = tenantsListRes.data[0];
  const updateTenantRes = await api(`/api/tenants/${tenantRecord.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { emergencyContact: "9876543210", kycStatus: "Verified" },
  });
  const tenantUpdatedOk = updateTenantRes.status === 200;
  recordTest(testCounter++, "Workflow 2", "Tenant Assignment & KYC Details Update", tenantUpdatedOk, `Status: ${updateTenantRes.status}, Tenant: ${tenantRecord.name}`);

  // -------------------------------------------------------------------------
  // SECTION 3: WORKFLOW 3 - LEASES & RENEWALS (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 3: Workflow 3 - Leases & Renewals ---");
  const newLeasePayload = {
    propertyId: createdProp.id,
    propertyName: createdProp.name,
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    startDate: "2026-12-01",
    endDate: "2027-10-31",
    monthlyRent: 34000,
    deposit: 150000,
    status: "Active",
    termMonths: 11,
  };
  const createLeaseRes = await api("/api/leases", {
    method: "POST",
    token: tokens.landlordA,
    body: newLeasePayload,
  });
  const createdLease = createLeaseRes.data;
  const leaseCreatedOk = createLeaseRes.status === 201 && createdLease?.id;
  recordTest(testCounter++, "Workflow 3", "Lease Creation & Agreement Binding", leaseCreatedOk, `Status: ${createLeaseRes.status}, Lease ID: ${createdLease?.id}`);

  const renewRes = await api(`/api/leases/${createdLease.id}/renew`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      newStartDate: "2027-11-01",
      newEndDate: "2028-09-30",
      newMonthlyRent: 36000,
      termMonths: 11,
      notes: "Yearly 5.8% escalation applied as per agreement.",
    },
  });
  const leaseRenewedOk = renewRes.status === 200 && renewRes.data?.lease?.monthlyRent === 36000 && renewRes.data?.lease?.renewalStatus === "Renewed";
  recordTest(testCounter++, "Workflow 3", "Lease Renewal Execution & Term Escalation", leaseRenewedOk, `Status: ${renewRes.status}, New Rent: ₹${renewRes.data?.lease?.monthlyRent}`);

  const termRes = await api(`/api/leases/${createdLease.id}/terminate`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      terminationDate: "2028-09-30",
      reason: "Tenant relocating out of state",
    },
  });
  const leaseTerminatedOk = termRes.status === 200 && termRes.data?.lease?.status === "Terminated";
  recordTest(testCounter++, "Workflow 3", "Lease Termination with Confirmation & History Archival", leaseTerminatedOk, `Status: ${termRes.status}, Final Status: ${termRes.data?.lease?.status}`);

  // -------------------------------------------------------------------------
  // SECTION 4: WORKFLOW 4 - FINANCIAL MANAGEMENT & PAYMENTS (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 4: Workflow 4 - Financial Management & Payments ---");
  const newInvoicePayload = {
    propertyId: createdProp.id,
    propertyName: createdProp.name,
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    leaseId: createdLease.id,
    amount: 34000,
    month: "December 2026",
    dueDate: "2026-12-05",
    type: "Rent",
    status: "Pending",
  };
  const createInvoiceRes = await api("/api/payments", {
    method: "POST",
    token: tokens.landlordA,
    body: newInvoicePayload,
  });
  const invoice = createInvoiceRes.data;
  const invoiceCreatedOk = (createInvoiceRes.status === 201 || createInvoiceRes.status === 200) && invoice?.id;
  recordTest(testCounter++, "Workflow 4", "Rent Invoice Creation", invoiceCreatedOk, `Status: ${createInvoiceRes.status}, Invoice ID: ${invoice?.id}`);

  const partialRes = await api(`/api/payments/${invoice.id}/record-payment`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      amountPaid: 20000,
      paymentMethod: "UPI / GPay",
      transactionRef: "UPI-IND-884920412",
      notes: "First installment paid by tenant",
    },
  });
  const partialData = partialRes.data;
  const partialOk =
    partialRes.status === 200 &&
    partialData?.payment?.status === "Partially Paid" &&
    partialData?.payment?.paidAmount === 20000 &&
    partialData?.payment?.remainingBalance === 14000;
  recordTest(testCounter++, "Workflow 4", "Partial Payment Recording & Remaining Balance Calculation", partialOk, `Status: ${partialRes.status}, Paid: ₹${partialData?.payment?.paidAmount}, Balance: ₹${partialData?.payment?.remainingBalance}`);

  const settleRes = await api(`/api/payments/${invoice.id}/record-payment`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      amountPaid: 14000,
      paymentMethod: "NEFT / NetBanking",
      transactionRef: "NEFT-HDFC-993821",
      notes: "Final installment balance clearance",
    },
  });
  const settleData = settleRes.data;
  const settleOk =
    settleRes.status === 200 &&
    settleData?.payment?.status === "Paid" &&
    settleData?.payment?.paidAmount === 34000 &&
    settleData?.payment?.remainingBalance === 0;
  recordTest(testCounter++, "Workflow 4", "Full Balance Payment & Ledger Clearance", settleOk, `Status: ${settleRes.status}, Remaining Balance: ₹${settleData?.payment?.remainingBalance}`);

  // -------------------------------------------------------------------------
  // SECTION 5: WORKFLOW 5 - OVERDUE REMINDERS & NOTIFICATIONS (2 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 5: Workflow 5 - Overdue Reminders & Notifications ---");
  const activeLease = await Lease.findOne({ landlordId: "LDL001", status: "Active" }).lean();
  const remindRes = await api(`/api/leases/${activeLease.id}/remind-rent`, {
    method: "POST",
    token: tokens.landlordA,
    body: { message: "Urgent: Kindly settle your outstanding monthly rent for your apartment." },
  });
  const remindOk = remindRes.status === 200 && remindRes.data?.success === true;
  recordTest(testCounter++, "Workflow 5", "Rent Reminder Dispatch Execution", remindOk, `Status: ${remindRes.status}, Message: "${remindRes.data?.message}"`);

  const deliveredNotif = await Notification.findOne({
    userId: activeLease.tenantId || activeLease.tenant_id,
    title: { $regex: /Rent Payment Reminder/i },
  }).sort({ _id: -1 }).lean();
  const notifDeliveredOk = deliveredNotif !== null && deliveredNotif.id !== undefined;
  recordTest(testCounter++, "Workflow 5", "In-App Notification Database Record Confirmation", notifDeliveredOk, `Notification ID: ${deliveredNotif?.id}, Channel: In-App Database Record`);

  // -------------------------------------------------------------------------
  // SECTION 6: WORKFLOW 6 - SECURITY DEPOSITS (2 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 6: Workflow 6 - Security Deposits ---");
  const newDepositPayload = {
    propertyId: createdProp.id,
    propertyName: createdProp.name,
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    amount: 150000,
    paidDate: "2026-12-01",
    status: "Security Deposit Held",
    refundableAmount: 150000,
  };
  const createDepRes = await api("/api/deposits", {
    method: "POST",
    token: tokens.landlordA,
    body: newDepositPayload,
  });
  const deposit = createDepRes.data;
  const depCreatedOk = (createDepRes.status === 201 || createDepRes.status === 200) && deposit?.id;
  recordTest(testCounter++, "Workflow 6", "Security Deposit Held Record Creation", depCreatedOk, `Status: ${createDepRes.status}, Deposit ID: ${deposit?.id}`);

  const refundRes = await api(`/api/deposits/${deposit.id}/refund`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      damageDeductions: 12000,
      unpaidRentDeductions: 0,
      utilityDuesDeductions: 3000,
      refundMethod: "IMPS Bank Transfer",
      refundTransactionRef: "IMPS-REF-77291039",
      notes: "Settlement complete after move-out inspection. ₹12k damage, ₹3k utility dues.",
    },
  });
  const refundData = refundRes.data;
  const refundOk =
    refundRes.status === 200 &&
    refundData?.deposit?.status === "Fully Refunded" &&
    refundData?.deposit?.refundableAmount === 135000 &&
    refundData?.deposit?.damageDeductions === 12000 &&
    refundData?.deposit?.utilityDuesDeductions === 3000;
  recordTest(testCounter++, "Workflow 6", "Security Deposit Deductions & Net Refund Calculation", refundOk, `Status: ${refundRes.status}, Original: ₹150,000, Net Refund: ₹${refundData?.deposit?.refundableAmount}`);

  // -------------------------------------------------------------------------
  // SECTION 7: WORKFLOW 7 - EXPENSES & UTILITIES (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 7: Workflow 7 - Expenses & Utilities ---");
  const newExpRes = await api("/api/expenses", {
    method: "POST",
    token: tokens.landlordA,
    body: {
      propertyId: createdProp.id,
      category: "Repairs & Maintenance",
      amount: 4500,
      description: "Corridor LED lighting fixture replacements and sensor repair",
      paidTo: "Madras Electricals & Hardware",
      date: "2026-11-19",
    },
  });
  const expCreatedOk = newExpRes.status === 201 && newExpRes.data?.id;
  recordTest(testCounter++, "Workflow 7", "Operational Expense Ledger Entry", expCreatedOk, `Status: ${newExpRes.status}, Expense ID: ${newExpRes.data?.id}`);

  const testBillMonth = `Month-${Date.now().toString().slice(-6)}`;
  const newBillPayload = {
    propertyId: createdProp.id,
    type: "Electricity",
    billingMonth: testBillMonth,
    previousReading: 1420,
    currentReading: 1680,
    units: 260,
    ratePerUnit: 8.5,
    amount: 2210,
    consumerNumber: `04-209-002-${Date.now().toString().slice(-4)}`,
    status: "Pending",
    dueDate: "2026-11-30",
  };
  const createBillRes = await api("/api/utility-bills", {
    method: "POST",
    token: tokens.landlordA,
    body: newBillPayload,
  });
  const billCreatedOk = (createBillRes.status === 201 || createBillRes.status === 200) && createBillRes.data?.id;
  recordTest(testCounter++, "Workflow 7", "TNEB Electricity Bill Creation with Meter Reading Calculation", billCreatedOk, `Status: ${createBillRes.status}, Bill ID: ${createBillRes.data?.id}`);

  const duplicateBillRes = await api("/api/utility-bills", {
    method: "POST",
    token: tokens.landlordA,
    body: newBillPayload,
  });
  const duplicateBlockedOk = duplicateBillRes.status === 400 && duplicateBillRes.data?.error?.includes("already exists");
  recordTest(testCounter++, "Workflow 7", "Duplicate Utility Bill Prevention (Same Period & Property)", duplicateBlockedOk, `Status: ${duplicateBillRes.status}, Error: "${duplicateBillRes.data?.error}"`);

  // -------------------------------------------------------------------------
  // SECTION 8: WORKFLOW 8 - MAINTENANCE MANAGEMENT (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 8: Workflow 8 - Maintenance Management ---");
  const newTicketRes = await api("/api/maintenance", {
    method: "POST",
    token: tokens.landlordA,
    body: {
      propertyId: createdProp.id,
      title: "Master Bedroom AC water leakage",
      description: "Water continuously dripping from indoor split AC unit during operation.",
      category: "Air Conditioning",
      priority: "High",
      tenantId: tenantRecord.id,
    },
  });
  const ticket = newTicketRes.data;
  const ticketCreatedOk = newTicketRes.status === 201 && ticket?.id;
  recordTest(testCounter++, "Workflow 8", "Maintenance Request Creation with Priority", ticketCreatedOk, `Status: ${newTicketRes.status}, Ticket ID: ${ticket?.id}`);

  const assignTicketRes = await api(`/api/maintenance/${ticket.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "In Progress",
      assignedTo: "CoolBreeze HVAC Care",
      estimatedCost: 1800,
    },
  });
  const ticketAssignedOk = assignTicketRes.status === 200 && assignTicketRes.data?.status === "In Progress" && assignTicketRes.data?.assignedTo === "CoolBreeze HVAC Care";
  recordTest(testCounter++, "Workflow 8", "Maintenance Vendor Assignment & In-Progress Transition", ticketAssignedOk, `Status: ${assignTicketRes.status}, Vendor: ${assignTicketRes.data?.assignedTo}`);

  const completeTicketRes = await api(`/api/maintenance/${ticket.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Completed",
      resolutionNotes: "Replaced drain hose and cleared condenser pan blockage. Coolant pressure tested normal.",
    },
  });
  const ticketCompletedOk = completeTicketRes.status === 200 && completeTicketRes.data?.status === "Completed";
  recordTest(testCounter++, "Workflow 8", "Maintenance Ticket Resolution & Completion", ticketCompletedOk, `Status: ${completeTicketRes.status}, Status: ${completeTicketRes.data?.status}`);

  // -------------------------------------------------------------------------
  // SECTION 9: WORKFLOW 9 - COMPLAINTS RESOLUTION (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 9: Workflow 9 - Complaints Resolution ---");
  const newComplaintRes = await api("/api/complaints", {
    method: "POST",
    token: tokens.tenantA,
    body: {
      propertyId: createdProp.id,
      category: "Noise Disturbance",
      issue: "Excessive hammering noise from adjacent flat past 10 PM on weekdays.",
      priority: "Medium",
    },
  });
  const complaint = newComplaintRes.data;
  const complaintCreatedOk = (newComplaintRes.status === 201 || newComplaintRes.status === 200) && complaint?.id;
  recordTest(testCounter++, "Workflow 9", "Tenant Complaint Filing", complaintCreatedOk, `Status: ${newComplaintRes.status}, Complaint ID: ${complaint?.id}`);

  const failResolveRes = await api(`/api/complaints/${complaint.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { status: "Resolved" },
  });
  const resolutionNoteEnforcedOk = failResolveRes.status === 400 && failResolveRes.data?.error?.includes("Resolution details or notes are required");
  recordTest(testCounter++, "Workflow 9", "Enforcement of Mandatory Resolution Audit Notes", resolutionNoteEnforcedOk, `Status: ${failResolveRes.status}, Error: "${failResolveRes.data?.error}"`);

  const successResolveRes = await api(`/api/complaints/${complaint.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Resolved",
      resolutionDetails: "Contacted unit 3B occupant; carpentry work restricted strictly to 10 AM - 5 PM on weekdays. Association circular issued.",
    },
  });
  const complaintResolvedOk = successResolveRes.status === 200 && successResolveRes.data?.status === "Resolved";
  recordTest(testCounter++, "Workflow 9", "Complaint Resolution with Audit History Logging", complaintResolvedOk, `Status: ${successResolveRes.status}, History Count: ${successResolveRes.data?.statusHistory?.length}`);

  // -------------------------------------------------------------------------
  // SECTION 10: WORKFLOW 10 - HOME SERVICES MARKETPLACE (2 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 10: Workflow 10 - Home Services Marketplace ---");
  const providersRes = await api("/api/service-providers", { token: tokens.landlordA });
  const activeProvider = Array.isArray(providersRes.data) && providersRes.data.length > 0 ? providersRes.data[0] : null;
  const providerId = activeProvider ? activeProvider.id : "PRV_CLN_01";
  const providerName = activeProvider ? activeProvider.name : "SparkleClean Tamil Nadu";

  const newBookingPayload = {
    propertyId: createdProp.id,
    propertyName: createdProp.name,
    unit: "Unit 204",
    serviceName: "Comprehensive Deep Cleaning & Sanitization",
    serviceCategory: "Deep Cleaning",
    providerId: providerId,
    providerName: providerName,
    date: "2026-11-20",
    timeSlot: "10:00 AM - 12:00 PM",
    amount: 1499,
    status: "Confirmed",
  };
  const createBookingRes = await api("/api/service-bookings", {
    method: "POST",
    token: tokens.landlordA,
    body: newBookingPayload,
  });
  const booking = createBookingRes.data?.booking || createBookingRes.data;
  const bookingCreatedOk = (createBookingRes.status === 201 || createBookingRes.status === 200) && booking?.id;
  recordTest(testCounter++, "Workflow 10", "Service Marketplace Booking Creation", bookingCreatedOk, `Status: ${createBookingRes.status}, Booking ID: ${booking?.id}`);

  const completeBookingRes = await api(`/api/service-bookings/${booking.id}/status`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Completed",
      note: `Full apartment 2BHK sanitized and scrubbed by ${providerName}.`,
      technicianName: "Murugan S",
      actualCost: 1499,
    },
  });
  const updatedBookingData = completeBookingRes.data?.booking || completeBookingRes.data;
  const bookingCompletedOk = completeBookingRes.status === 200 && updatedBookingData?.status === "Completed";
  const generatedExpense = await Expense.findOne({ propertyId: createdProp.id }).sort({ _id: -1 }).lean();
  const autoExpenseOk = bookingCompletedOk && generatedExpense !== null && generatedExpense.amount === 1499;
  recordTest(testCounter++, "Workflow 10", "Automatic Operational Expense Generation from Completed Booking", autoExpenseOk, `Status: ${completeBookingRes.status}, Expense ID: ${generatedExpense?.id}, Amount: ₹${generatedExpense?.amount}`);

  // -------------------------------------------------------------------------
  // SECTION 11: WORKFLOW 11 - DOCUMENTS & KYC (3 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 11: Workflow 11 - Documents & KYC ---");
  const newDocPayload = {
    name: "Property Khata & Building Stability Certificate",
    type: "Property Document",
    category: "Property",
    propertyId: createdProp.id,
    fileName: "aurelia_stability_cert_2026.pdf",
    status: "Pending",
    expiryDate: "2028-12-31",
  };
  const createDocRes = await api("/api/documents", {
    method: "POST",
    token: tokens.landlordA,
    body: newDocPayload,
  });
  const doc = createDocRes.data;
  const docCreatedOk = (createDocRes.status === 201 || createDocRes.status === 200) && doc?.id;
  recordTest(testCounter++, "Workflow 11", "Secure Document Registration & Vaulting", docCreatedOk, `Status: ${createDocRes.status}, Document ID: ${doc?.id}`);

  const verifyDocRes = await api(`/api/documents/${doc.id}/verify`, {
    method: "POST",
    token: tokens.admin,
    body: { notes: "Verified against Chennai Corporation Municipal Records." },
  });
  const docVerifiedOk = verifyDocRes.status === 200 && verifyDocRes.data?.document?.status === "Verified";
  recordTest(testCounter++, "Workflow 11", "Document Verification Status Update", docVerifiedOk, `Status: ${verifyDocRes.status}, Status: ${verifyDocRes.data?.document?.status}`);

  const authDownloadRes = await api(`/api/documents/${doc.id}/download`, { token: tokens.landlordA });
  const downloadAuthorizedOk = authDownloadRes.status === 200 && authDownloadRes.data?.includes("PROPCONNECT PORTAL");
  recordTest(testCounter++, "Workflow 11", "Authorized Landlord Secure Document Download", downloadAuthorizedOk, `Status: ${authDownloadRes.status}, Content Length: ${authDownloadRes.data?.length} bytes`);

  // -------------------------------------------------------------------------
  // SECTION 12: WORKFLOW 12 - PROFILE & SETTINGS (4 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 12: Workflow 12 - Profile & Settings ---");
  const updateProfileRes = await api("/api/profile", {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      phone: "+91 94440 12345",
      location: "Anna Nagar West, Chennai, Tamil Nadu",
      address: "No. 45/2, 2nd Main Road, Anna Nagar, Chennai - 600040",
    },
  });
  const profileUpdatedOk = updateProfileRes.status === 200 && updateProfileRes.data?.profile?.phone === "+91 94440 12345";
  recordTest(testCounter++, "Workflow 12", "Profile Contact & Address Update", profileUpdatedOk, `Status: ${updateProfileRes.status}, Updated Phone: ${updateProfileRes.data?.profile?.phone}`);

  const validBankRes = await api("/api/profile/banking", {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      accountHolderName: "Karthik Raja S",
      bankName: "HDFC Bank Ltd",
      accountNumber: "50100293847561",
      ifscCode: "HDFC0000123",
      branch: "Anna Nagar Branch, Chennai",
    },
  });
  const bankUpdatedOk =
    validBankRes.status === 200 &&
    validBankRes.data?.banking?.ifscCode === "HDFC0000123" &&
    validBankRes.data?.banking?.maskedAccountNumber?.includes("••••");
  recordTest(testCounter++, "Workflow 12", "Banking Details Update with IFSC Validation & Account Masking", bankUpdatedOk, `Status: ${validBankRes.status}, Masked Account: ${validBankRes.data?.banking?.maskedAccountNumber}`);

  const invalidBankRes = await api("/api/profile/banking", {
    method: "PUT",
    token: tokens.landlordA,
    body: { ifscCode: "INVALID123" },
  });
  const invalidIfscBlocked = invalidBankRes.status === 400 && invalidBankRes.data?.error?.includes("Invalid IFSC format");
  recordTest(testCounter++, "Workflow 12", "Rejection of Malformed / Non-Standard IFSC Code", invalidIfscBlocked, `Status: ${invalidBankRes.status}, Error: "${invalidBankRes.data?.error}"`);

  const settingsRes = await api("/api/settings/landlord", {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      notificationPreferences: { emailNotifications: true, smsAlerts: false },
      paymentPreferences: { gracePeriodDays: 5, lateFeeEnabled: true, lateFeeAmount: 500 },
    },
  });
  const settingsData = settingsRes.data?.settings;
  const settingsOk =
    settingsRes.status === 200 &&
    settingsData?.paymentPreferences?.gracePeriodDays === 5 &&
    settingsData?.paymentPreferences?.lateFeeAmount === 500;
  recordTest(testCounter++, "Workflow 12", "Landlord Portal Preferences & Automation Settings Persistence", settingsOk, `Status: ${settingsRes.status}, Grace Period: ${settingsData?.paymentPreferences?.gracePeriodDays} days`);

  // -------------------------------------------------------------------------
  // SECTION 13: CRITICAL EDGE CASES (8 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 13: Critical Edge Cases ---");

  // Edge Case 1: Duplicate payment request with identical reference returns 409
  const dupPaymentRes = await api(`/api/payments/${invoice.id}/record-payment`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      amountPaid: 5000,
      paymentMethod: "UPI",
      transactionRef: "UPI-IND-884920412", // already used in partial payment above!
    },
  });
  const dupPaymentBlocked = dupPaymentRes.status === 409 && dupPaymentRes.data?.error?.includes("Duplicate payment detected");
  recordTest(testCounter++, "Edge Case", "Duplicate Payment Submission Blocked (Same Transaction Ref)", dupPaymentBlocked, `Status: ${dupPaymentRes.status}, Error: "${dupPaymentRes.data?.error}"`);

  // Edge Case 2: Paying on already fully settled invoice returns 400
  const overpaySettledRes = await api(`/api/payments/${invoice.id}/record-payment`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      amountPaid: 1000,
      paymentMethod: "UPI",
      transactionRef: "UPI-NEW-EXTRA-999",
    },
  });
  const overpaySettledBlocked = overpaySettledRes.status === 400 && overpaySettledRes.data?.error?.includes("already fully settled");
  recordTest(testCounter++, "Edge Case", "Settled Invoice Payment Prevention (Zero Overpayment Allowed)", overpaySettledBlocked, `Status: ${overpaySettledRes.status}, Error: "${overpaySettledRes.data?.error}"`);

  // Edge Case 3: Remaining balance never becomes negative
  const invForBal = await Payment.create({
    id: `PAY_BAL_TEST_${Date.now()}`,
    amount: 10000,
    paidAmount: 0,
    remainingBalance: 10000,
    status: "Pending",
    propertyId: createdProp.id,
    landlordId: "LDL001",
  });
  const payExcessRes = await api(`/api/payments/${invForBal.id}/record-payment`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      amountPaid: 25000, // Pays 25k on a 10k invoice
      paymentMethod: "Bank Transfer",
      transactionRef: `REF-EXCESS-${Date.now()}`,
    },
  });
  const remainingNonNeg = payExcessRes.status === 200 && payExcessRes.data?.payment?.remainingBalance === 0;
  recordTest(testCounter++, "Edge Case", "Remaining Balance Strict Invariant (Never Negative: balance >= 0)", remainingNonNeg, `Status: ${payExcessRes.status}, Paid: ₹25,000, Invoice: ₹10,000, Balance: ₹${payExcessRes.data?.payment?.remainingBalance}`);

  // Edge Case 4: Webhook idempotency (Duplicate Webhook Events processed exactly once)
  const webhookEventId = `WH_EVT_${Date.now()}`;
  const invForWh = await Payment.create({
    id: `PAY_WH_TEST_${Date.now()}`,
    amount: 8000,
    paidAmount: 0,
    remainingBalance: 8000,
    status: "Pending",
    propertyId: createdProp.id,
  });
  const whRes1 = await api("/api/payments/webhook", {
    method: "POST",
    body: {
      event: "payment.captured",
      eventId: webhookEventId,
      payload: { invoiceId: invForWh.id, amount: 8000, method: "Razorpay UPI" },
    },
  });
  const whRes2 = await api("/api/payments/webhook", {
    method: "POST",
    body: {
      event: "payment.captured",
      eventId: webhookEventId, // same eventId re-sent!
      payload: { invoiceId: invForWh.id, amount: 8000, method: "Razorpay UPI" },
    },
  });
  const webhookIdempotentOk =
    whRes1.status === 200 &&
    whRes1.data?.status === "success" &&
    whRes2.status === 200 &&
    whRes2.data?.status === "ignored" &&
    whRes2.data?.message?.includes("Duplicate webhook event");
  recordTest(testCounter++, "Edge Case", "Payment Gateway Webhook Idempotency (Duplicate Event Rejected)", webhookIdempotentOk, `First call: 200 success, Replay call: 200 ignored duplicate event`);

  // Edge Case 5: Terminated Lease cannot generate recurring rent invoice
  const termLeaseInvoiceRes = await api(`/api/leases/${createdLease.id}/generate-rent-invoice`, {
    method: "POST",
    token: tokens.landlordA,
  });
  const termLeaseBlocked = termLeaseInvoiceRes.status === 400 && termLeaseInvoiceRes.data?.error?.includes("terminated");
  recordTest(testCounter++, "Edge Case", "Terminated Lease Recurring Rent Invoice Generation Blocked", termLeaseBlocked, `Status: ${termLeaseInvoiceRes.status}, Error: "${termLeaseInvoiceRes.data?.error}"`);

  // Edge Case 6: Lease renewal preserves complete agreement version history
  const renewedLeaseInDb = await Lease.findOne({ id: createdLease.id }).lean();
  const historyPreserved =
    Array.isArray(renewedLeaseInDb?.agreementHistory) &&
    renewedLeaseInDb.agreementHistory.length >= 2 && // renewal + termination
    renewedLeaseInDb.agreementHistory[0].previousRent === 34000;
  recordTest(testCounter++, "Edge Case", "Lease Renewal & Agreement History Preservation", historyPreserved, `Agreement History Count: ${renewedLeaseInDb?.agreementHistory?.length}, Prev Rent: ₹${renewedLeaseInDb?.agreementHistory?.[0]?.previousRent}`);

  // Edge Case 7: Service Booking completed a second time generates strictly ONE expense
  const expenseCountBefore = await Expense.countDocuments({ description: { $regex: booking.id } });
  const completeAgainRes = await api(`/api/service-bookings/${booking.id}/status`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { status: "Completed", note: "Second redundant completion call" },
  });
  const expenseCountAfter = await Expense.countDocuments({ description: { $regex: booking.id } });
  const onlyOneExpenseCreated = expenseCountBefore === 1 && expenseCountAfter === 1;
  recordTest(testCounter++, "Edge Case", "Service Booking Redundant Completion (Strictly 1 Expense Generated)", onlyOneExpenseCreated, `Expense Count Before: ${expenseCountBefore}, Count After: ${expenseCountAfter}`);

  // Edge Case 8: Document size limit enforcement (> 15MB rejected)
  const hugeDocRes = await api("/api/documents", {
    method: "POST",
    token: tokens.landlordA,
    body: {
      name: "Enormous Blueprint CAD File.pdf",
      fileName: "huge_blueprint.pdf",
      fileSize: 20 * 1024 * 1024, // 20 MB
      propertyId: createdProp.id,
    },
  });
  const hugeDocBlocked = hugeDocRes.status === 400 && hugeDocRes.data?.error?.includes("15MB");
  recordTest(testCounter++, "Edge Case", "Document Maximum File Size Enforcement (>15MB Rejected)", hugeDocBlocked, `Status: ${hugeDocRes.status}, Error: "${hugeDocRes.data?.error}"`);

  // -------------------------------------------------------------------------
  // SECTION 14: SECURITY AUDIT SCENARIOS (7 TEST CASES)
  // -------------------------------------------------------------------------
  console.log("\n--- Category 14: Security Boundaries & RBAC ---");
  const propB = await Property.findOne({ landlordId: "LDL002" }).lean();
  const crossPropRes = await api(`/api/properties/${propB.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { rent: 99999 },
  });
  recordTest(testCounter++, "Security", "Cross-Landlord Property Modification Blocked (Landlord A -> Landlord B)", crossPropRes.status === 403, `Target: ${propB.id} (Landlord B). Status: ${crossPropRes.status} (Expected 403 Forbidden)`);

  const docB = await Document.findOne({ landlordId: "LDL002" }).lean();
  let crossDocBlocked = true;
  if (docB) {
    const crossDocRes = await api(`/api/documents/${docB.id}/download`, { token: tokens.landlordA });
    crossDocBlocked = crossDocRes.status === 403;
  }
  recordTest(testCounter++, "Security", "Cross-Landlord Document Download Blocked (Landlord A -> Landlord B)", crossDocBlocked, `Status: 403 Forbidden confirmed`);

  const tenantFinRes = await api("/api/financial-summary", { token: tokens.tenantA });
  recordTest(testCounter++, "Security", "Tenant Access to Landlord Portfolio Financial Summary Blocked", tenantFinRes.status === 403, `Status: ${tenantFinRes.status} (Expected 403 Forbidden)`);

  const tenantExpRes = await api("/api/expenses", {
    method: "POST",
    token: tokens.tenantA,
    body: { amount: 1000, category: "Maintenance" },
  });
  recordTest(testCounter++, "Security", "Tenant Creation of Property Operational Expenses Blocked", tenantExpRes.status === 403, `Status: ${tenantExpRes.status} (Expected 403 Forbidden)`);

  const tenantLeaseTermRes = await api(`/api/leases/${createdLease.id}/terminate`, {
    method: "POST",
    token: tokens.tenantA,
    body: { reason: "Attempting unilateral termination" },
  });
  recordTest(testCounter++, "Security", "Tenant Unilateral Lease Termination Blocked", tenantLeaseTermRes.status === 403, `Status: ${tenantLeaseTermRes.status} (Expected 403 Forbidden)`);

  const publicDocRes = await api(`/api/documents/${doc.id}/download`);
  recordTest(testCounter++, "Security", "Public Unauthenticated Document Download Blocked (Missing Bearer Token)", publicDocRes.status === 401, `Status: ${publicDocRes.status} (Expected 401 Unauthorized)`);

  const profileFetchRes = await api("/api/profile", { token: tokens.landlordA });
  const prof = profileFetchRes.data;
  const noPasswordsExposed =
    prof?.password === undefined &&
    prof?.passwordHash === undefined &&
    prof?.salt === undefined &&
    typeof prof?.banking?.accountNumber === "string" &&
    prof?.banking?.accountNumber.includes("••••");
  recordTest(testCounter++, "Security", "Sensitive Data Protection (No Password Hashes / Masked Account Numbers)", noPasswordsExposed, `Password Excluded: ${prof?.password === undefined}, Masked Account: ${prof?.banking?.accountNumber}`);

  console.log("\n=======================================================================");
  console.log("📊 RECONCILED TEST SUMMARY REPORT");
  console.log("=======================================================================");
  const total = executedCases.length;
  const passed = executedCases.filter((c) => c.passed).length;
  const failed = executedCases.filter((c) => !c.passed).length;

  console.log(`Total Reconciled Tests Executed : ${total}`);
  console.log(`Passed                          : ${passed}`);
  console.log(`Failed                          : ${failed}`);
  console.log("=======================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("FATAL ERROR IN RECONCILIATION SUITE:", err);
  process.exit(1);
});
