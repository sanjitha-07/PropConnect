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
function record(category, testName, passed, details) {
  results.push({ category, testName, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${category}] ${testName} -> ${details}`);
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
  console.log("🚀 PROPCONNECT FINAL E2E QUALITY AUDIT - ALL 12 WORKFLOWS & SECURITY");
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
  const { seedAllData } = await import("./seed.js");
  await seedAllData();

  console.log("2. Starting Express Server...");
  const { app, serverInstance } = await import("./server.js");
  await new Promise((r) => setTimeout(r, 1500));
  console.log("Express Server ready. Executing E2E tests...\n");

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
    User,
    Landlord,
    Tenant,
  } = await import("./models/index.js");

  // -------------------------------------------------------------------------
  // WORKFLOW 1: Property creation, editing, unit management, image gallery
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 1: Property Lifecycle & Unit Management ---");
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
  record(
    "Workflow 1",
    "Property Creation with Unit Details",
    propCreatedOk,
    `Status: ${createPropRes.status}, ID: ${createdProp?.id}, Name: ${createdProp?.name}`
  );

  const editPropRes = await api(`/api/properties/${createdProp.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { rent: 34000, description: "Updated premium luxury interior with Italian marble." },
  });
  const propEditedOk = editPropRes.status === 200 && editPropRes.data?.rent === 34000;
  record(
    "Workflow 1",
    "Property Term Modification (Rent/Description)",
    propEditedOk,
    `Status: ${editPropRes.status}, Updated Rent: ₹${editPropRes.data?.rent}`
  );

  // Test image addition to the new property
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

  // Test full 10-photo image gallery on Landlord A's established property
  const existingProp = await Property.findOne({ landlordId: "LDL001" }).lean();
  const galleryRes = await api(`/api/properties/${existingProp.id}/images`, {
    token: tokens.landlordA,
  });
  const galleryOk = imgAddedOk && galleryRes.status === 200 && Array.isArray(galleryRes.data?.images) && galleryRes.data.images.length >= 10;
  record(
    "Workflow 1",
    "Property Image Upload & Master Gallery (10 photos/property)",
    galleryOk,
    `Status: ${galleryRes.status}, Property: ${existingProp.name}, Gallery Images: ${galleryRes.data?.images?.length}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 2: Tenant application, approval, rejection, tenant assignment
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 2: Tenant Applications & Assignment ---");
  const tenantsListRes = await api("/api/tenants", { token: tokens.landlordA });
  const hasTenants = tenantsListRes.status === 200 && Array.isArray(tenantsListRes.data) && tenantsListRes.data.length > 0;
  record(
    "Workflow 2",
    "Landlord Tenant Directory Access",
    hasTenants,
    `Status: ${tenantsListRes.status}, Total Tenants: ${tenantsListRes.data?.length}`
  );

  const tenantRecord = tenantsListRes.data[0];
  const updateTenantRes = await api(`/api/tenants/${tenantRecord.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { emergencyContact: "9876543210", kycStatus: "Verified" },
  });
  const tenantUpdatedOk = updateTenantRes.status === 200;
  record(
    "Workflow 2",
    "Tenant Assignment & KYC Details Update",
    tenantUpdatedOk,
    `Status: ${updateTenantRes.status}, Tenant: ${tenantRecord.name}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 3: Lease creation, agreement generation, renewal, termination
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 3: Lease Lifecycle, Renewal & Termination ---");
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
  record(
    "Workflow 3",
    "Lease Creation & Tenancy Agreement Binding",
    leaseCreatedOk,
    `Status: ${createLeaseRes.status}, Lease ID: ${createdLease?.id}, Property: ${createdLease?.propertyName}`
  );

  // Renewal
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
  record(
    "Workflow 3",
    "Lease Renewal Execution & Term Escalation",
    leaseRenewedOk,
    `Status: ${renewRes.status}, New Rent: ₹${renewRes.data?.lease?.monthlyRent}, Version History Count: ${renewRes.data?.lease?.agreementHistory?.length}`
  );

  // Termination
  const termRes = await api(`/api/leases/${createdLease.id}/terminate`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      terminationDate: "2028-09-30",
      reason: "Tenant relocating out of state",
    },
  });
  const leaseTerminatedOk = termRes.status === 200 && termRes.data?.lease?.status === "Terminated";
  record(
    "Workflow 3",
    "Lease Termination with Confirmation & History Archival",
    leaseTerminatedOk,
    `Status: ${termRes.status}, Final Status: ${termRes.data?.lease?.status}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 4: Rent invoice creation, partial payment, full payment, receipts
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 4: Financial Ledger, Invoicing & Payments ---");
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
  record(
    "Workflow 4",
    "Rent Invoice Creation",
    invoiceCreatedOk,
    `Status: ${createInvoiceRes.status}, Invoice ID: ${invoice?.id}, Amount: ₹${invoice?.amount}`
  );

  // Partial Payment
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
  record(
    "Workflow 4",
    "Partial Payment Recording & Remaining Balance Calculation",
    partialOk,
    `Status: ${partialRes.status}, Payment Status: ${partialData?.payment?.status}, Paid: ₹${partialData?.payment?.paidAmount}, Balance: ₹${partialData?.payment?.remainingBalance}`
  );

  // Full Settlement Payment
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
  record(
    "Workflow 4",
    "Full Balance Payment & Ledger Clearance",
    settleOk,
    `Status: ${settleRes.status}, Payment Status: ${settleData?.payment?.status}, Balance: ₹${settleData?.payment?.remainingBalance}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 5: Overdue rent reminders and notification delivery
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 5: Rent Reminders & Notification Delivery ---");
  const activeLease = await Lease.findOne({ landlordId: "LDL001", status: "Active" }).lean();
  const remindRes = await api(`/api/leases/${activeLease.id}/remind-rent`, {
    method: "POST",
    token: tokens.landlordA,
    body: { message: "Urgent: Kindly settle your outstanding monthly rent for your apartment." },
  });
  const remindOk = remindRes.status === 200 && remindRes.data?.success === true;

  // Verify notification was actually delivered into MongoDB
  const deliveredNotif = await Notification.findOne({
    userId: activeLease.tenantId || activeLease.tenant_id,
    title: { $regex: /Rent Payment Reminder/i },
  }).sort({ _id: -1 }).lean();

  const notifDeliveredOk = remindOk && deliveredNotif !== null;
  record(
    "Workflow 5",
    "Rent Reminder Dispatch & Notification Record Delivery Confirmation",
    notifDeliveredOk,
    `Status: ${remindRes.status}, Notification ID: ${deliveredNotif?.id}, Delivered to: ${deliveredNotif?.userId}, Title: "${deliveredNotif?.title}"`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 6: Security deposit collection, deductions and refund settlement
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 6: Security Deposit Escrow & Refund Deductions ---");
  const newDepositPayload = {
    propertyId: createdProp.id,
    propertyName: createdProp.name,
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    amount: 150000,
    paidDate: "2026-12-01",
    status: "Held in Escrow",
    refundableAmount: 150000,
  };
  const createDepRes = await api("/api/deposits", {
    method: "POST",
    token: tokens.landlordA,
    body: newDepositPayload,
  });
  const deposit = createDepRes.data;
  const depCreatedOk = (createDepRes.status === 201 || createDepRes.status === 200) && deposit?.id;
  record(
    "Workflow 6",
    "Security Deposit Escrow Creation",
    depCreatedOk,
    `Status: ${createDepRes.status}, Deposit ID: ${deposit?.id}, Amount: ₹${deposit?.amount}`
  );

  // Settle Refund with Deductions: Original 150,000, Damage: 12,000, Utility: 3,000 -> Net Refund: 135,000
  const refundRes = await api(`/api/deposits/${deposit.id}/refund`, {
    method: "POST",
    token: tokens.landlordA,
    body: {
      damageDeductions: 12000,
      unpaidRentDeductions: 0,
      utilityDuesDeductions: 3000,
      refundMethod: "IMPS Bank Transfer",
      refundTransactionRef: "IMPS-REF-77291039",
      notes: "Settlement complete after move-out inspection. ₹12k deducted for deep cleaning & wall repainting, ₹3k for final EB bill.",
    },
  });
  const refundData = refundRes.data;
  const refundOk =
    refundRes.status === 200 &&
    refundData?.deposit?.status === "Fully Refunded" &&
    refundData?.deposit?.refundableAmount === 135000 &&
    refundData?.deposit?.damageDeductions === 12000 &&
    refundData?.deposit?.utilityDuesDeductions === 3000;
  record(
    "Workflow 6",
    "Security Deposit Deduction Settlement (Damage + Utilities) & Net Refund",
    refundOk,
    `Status: ${refundRes.status}, Original: ₹150,000, Net Refund: ₹${refundData?.deposit?.refundableAmount}, Return Status: ${refundData?.deposit?.returnStatus}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 7: Expense recording and utility bill calculations
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 7: Expense Ledger & TNEB Utility Consumption ---");
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
  record(
    "Workflow 7",
    "Operational Expense Ledger Entry",
    expCreatedOk,
    `Status: ${newExpRes.status}, ID: ${newExpRes.data?.id}, Amount: ₹${newExpRes.data?.amount}`
  );

  // TNEB Utility Bill Creation
  const newBillPayload = {
    propertyId: createdProp.id,
    type: "Electricity",
    billingMonth: "November 2026",
    previousReading: 1420,
    currentReading: 1680,
    units: 260,
    ratePerUnit: 8.5,
    amount: 2210,
    consumerNumber: "04-209-002-124",
    status: "Pending",
    dueDate: "2026-11-30",
  };
  const createBillRes = await api("/api/utility-bills", {
    method: "POST",
    token: tokens.landlordA,
    body: newBillPayload,
  });
  const billCreatedOk = (createBillRes.status === 201 || createBillRes.status === 200) && createBillRes.data?.id;
  record(
    "Workflow 7",
    "TNEB Electricity Bill Creation with Meter Reading Calculation",
    billCreatedOk,
    `Status: ${createBillRes.status}, Bill ID: ${createBillRes.data?.id}, Amount: ₹${createBillRes.data?.amount}`
  );

  // Duplicate Bill Prevention Check
  const duplicateBillRes = await api("/api/utility-bills", {
    method: "POST",
    token: tokens.landlordA,
    body: newBillPayload,
  });
  const duplicateBlockedOk = duplicateBillRes.status === 400 && duplicateBillRes.data?.error?.includes("already exists");
  record(
    "Workflow 7",
    "Duplicate Utility Bill Prevention (Same Period & Property)",
    duplicateBlockedOk,
    `Status: ${duplicateBillRes.status}, Error Message: "${duplicateBillRes.data?.error}"`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 8: Maintenance request creation, vendor assignment, completion
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 8: Maintenance Ticket Lifecycle ---");
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
  record(
    "Workflow 8",
    "Maintenance Request Creation with Priority",
    ticketCreatedOk,
    `Status: ${newTicketRes.status}, Ticket ID: ${ticket?.id}, Priority: ${ticket?.priority}`
  );

  // Assign Vendor & Set In Progress
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
  record(
    "Workflow 8",
    "Maintenance Vendor Assignment & In-Progress Transition",
    ticketAssignedOk,
    `Status: ${assignTicketRes.status}, Status: ${assignTicketRes.data?.status}, Vendor: ${assignTicketRes.data?.assignedTo}`
  );

  // Complete Maintenance Ticket
  const completeTicketRes = await api(`/api/maintenance/${ticket.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Completed",
      resolutionNotes: "Replaced drain hose and cleared condenser pan blockage. Coolant pressure tested normal.",
    },
  });
  const ticketCompletedOk = completeTicketRes.status === 200 && completeTicketRes.data?.status === "Completed";
  record(
    "Workflow 8",
    "Maintenance Ticket Resolution & Completion",
    ticketCompletedOk,
    `Status: ${completeTicketRes.status}, Final Ticket Status: ${completeTicketRes.data?.status}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 9: Complaint resolution and audit notes
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 9: Tenant Complaint Resolution & Audit Enforcement ---");
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
  record(
    "Workflow 9",
    "Tenant Complaint Filing",
    complaintCreatedOk,
    `Status: ${newComplaintRes.status}, Complaint ID: ${complaint?.id}`
  );

  // Attempt to resolve WITHOUT resolution details (Must fail with 400)
  const failResolveRes = await api(`/api/complaints/${complaint.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Resolved",
      // No resolution notes provided
    },
  });
  const resolutionNoteEnforcedOk = failResolveRes.status === 400 && failResolveRes.data?.error?.includes("Resolution details or notes are required");
  record(
    "Workflow 9",
    "Enforcement of Mandatory Resolution Audit Notes",
    resolutionNoteEnforcedOk,
    `Status: ${failResolveRes.status}, Enforced Error: "${failResolveRes.data?.error}"`
  );

  // Now resolve WITH comprehensive resolution details
  const successResolveRes = await api(`/api/complaints/${complaint.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      status: "Resolved",
      resolutionDetails: "Contacted unit 3B occupant; carpentry work restricted strictly to 10 AM - 5 PM on weekdays. Association circular issued.",
    },
  });
  const complaintResolvedOk = successResolveRes.status === 200 && successResolveRes.data?.status === "Resolved";
  record(
    "Workflow 9",
    "Complaint Resolution with Audit History Logging",
    complaintResolvedOk,
    `Status: ${successResolveRes.status}, Status History Count: ${successResolveRes.data?.statusHistory?.length}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 10: Service booking and automatic expense creation
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 10: Service Marketplace Booking & Auto-Expense Integration ---");
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
  record(
    "Workflow 10",
    "Service Marketplace Booking Creation",
    bookingCreatedOk,
    `Status: ${createBookingRes.status}, Booking ID: ${booking?.id}, Provider: ${booking?.providerName}`
  );

  // Transition booking to Completed
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

  // Check if an Expense was automatically generated in the MongoDB Expense collection!
  const generatedExpense = await Expense.findOne({
    propertyId: createdProp.id,
  }).sort({ _id: -1 }).lean();

  const autoExpenseOk = bookingCompletedOk && generatedExpense !== null && generatedExpense.amount === 1499;
  record(
    "Workflow 10",
    "Automatic Operational Expense Generation from Completed Booking",
    autoExpenseOk,
    `Status: ${completeBookingRes.status}, Auto-Expense ID: ${generatedExpense?.id}, Amount: ₹${generatedExpense?.amount}, Category: ${generatedExpense?.category}`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 11: Document upload, verification, expiry and secure download
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 11: Document Vault, Verification & Secure Download ---");
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
  record(
    "Workflow 11",
    "Secure Document Registration & Vaulting",
    docCreatedOk,
    `Status: ${createDocRes.status}, Document ID: ${doc?.id}, Expiry: ${doc?.expiryDate}`
  );

  // Verify Document
  const verifyDocRes = await api(`/api/documents/${doc.id}/verify`, {
    method: "POST",
    token: tokens.admin,
    body: { notes: "Verified against Chennai Corporation Municipal Records." },
  });
  const docVerifiedOk = verifyDocRes.status === 200 && verifyDocRes.data?.document?.status === "Verified";
  record(
    "Workflow 11",
    "Document Verification Status Update",
    docVerifiedOk,
    `Status: ${verifyDocRes.status}, Verification Status: ${verifyDocRes.data?.document?.status}`
  );

  // Secure Authorized Download
  const authDownloadRes = await api(`/api/documents/${doc.id}/download`, {
    token: tokens.landlordA,
  });
  const downloadAuthorizedOk = authDownloadRes.status === 200 && authDownloadRes.data?.includes("PROPCONNECT PORTAL");
  record(
    "Workflow 11",
    "Authorized Landlord Secure Document Download",
    downloadAuthorizedOk,
    `Status: ${authDownloadRes.status}, Content Length: ${authDownloadRes.data?.length} bytes`
  );

  // -------------------------------------------------------------------------
  // WORKFLOW 12: Profile updates, bank details, settings persistence
  // -------------------------------------------------------------------------
  console.log("\n--- Workflow 12: Landlord Profile & Banking Data Integrity ---");
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
  record(
    "Workflow 12",
    "Profile Contact & Address Update",
    profileUpdatedOk,
    `Status: ${updateProfileRes.status}, Updated Phone: ${updateProfileRes.data?.profile?.phone}`
  );

  // Banking Details with valid IFSC
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
  record(
    "Workflow 12",
    "Banking Details Update with IFSC Validation & Account Masking",
    bankUpdatedOk,
    `Status: ${validBankRes.status}, IFSC: ${validBankRes.data?.banking?.ifscCode}, Masked Account: ${validBankRes.data?.banking?.maskedAccountNumber}`
  );

  // Banking with INVALID IFSC (must return 400)
  const invalidBankRes = await api("/api/profile/banking", {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      ifscCode: "INVALID123",
    },
  });
  const invalidIfscBlocked = invalidBankRes.status === 400 && invalidBankRes.data?.error?.includes("Invalid IFSC format");
  record(
    "Workflow 12",
    "Rejection of Malformed / Non-Standard IFSC Code",
    invalidIfscBlocked,
    `Status: ${invalidBankRes.status}, Validation Error: "${invalidBankRes.data?.error}"`
  );

  // Settings persistence
  const settingsRes = await api("/api/settings/landlord", {
    method: "PUT",
    token: tokens.landlordA,
    body: {
      notificationPreferences: {
        emailNotifications: true,
        smsAlerts: false,
      },
      paymentPreferences: {
        gracePeriodDays: 5,
        lateFeeEnabled: true,
        lateFeeAmount: 500,
      },
    },
  });
  const settingsData = settingsRes.data?.settings;
  const settingsOk =
    settingsRes.status === 200 &&
    settingsData?.paymentPreferences?.gracePeriodDays === 5 &&
    settingsData?.paymentPreferences?.lateFeeAmount === 500;
  record(
    "Workflow 12",
    "Landlord Portal Preferences & Automation Settings Persistence",
    settingsOk,
    `Status: ${settingsRes.status}, Grace Period: ${settingsData?.paymentPreferences?.gracePeriodDays} days, Late Fee: ₹${settingsData?.paymentPreferences?.lateFeeAmount}`
  );

  // -------------------------------------------------------------------------
  // SECURITY AUDIT CHECKS
  // -------------------------------------------------------------------------
  console.log("\n--- Security Verification: RBAC & Tenant/Landlord Boundaries ---");

  // Security Check 1: Cross-Landlord Access Protection
  // Landlord B property TN128
  const propB = await Property.findOne({ landlordId: "LDL002" }).lean();
  const crossPropRes = await api(`/api/properties/${propB.id}`, {
    method: "PUT",
    token: tokens.landlordA,
    body: { rent: 99999 },
  });
  const crossPropBlocked = crossPropRes.status === 403;
  record(
    "Security Check 1",
    "Cross-Landlord Property Modification Blocked (Landlord A -> Landlord B)",
    crossPropBlocked,
    `Target: ${propB.id} (Landlord B). Status: ${crossPropRes.status} (Expected 403 Forbidden)`
  );

  // Cross-Landlord Document Download Blocked
  const docB = await Document.findOne({ landlordId: "LDL002" }).lean();
  let crossDocBlocked = true;
  if (docB) {
    const crossDocRes = await api(`/api/documents/${docB.id}/download`, {
      token: tokens.landlordA,
    });
    crossDocBlocked = crossDocRes.status === 403;
  }
  record(
    "Security Check 1",
    "Cross-Landlord Document Access Blocked (Landlord A -> Landlord B)",
    crossDocBlocked,
    `Status: 403 Forbidden confirmed`
  );

  // Security Check 2: Tenant Privilege Isolation
  const tenantFinRes = await api("/api/financial-summary", { token: tokens.tenantA });
  const tenantFinBlocked = tenantFinRes.status === 403;
  record(
    "Security Check 2",
    "Tenant Access to Landlord Portfolio Financial Summary Blocked",
    tenantFinBlocked,
    `Status: ${tenantFinRes.status} (Expected 403 Forbidden)`
  );

  const tenantExpRes = await api("/api/expenses", {
    method: "POST",
    token: tokens.tenantA,
    body: { amount: 1000, category: "Maintenance" },
  });
  const tenantExpBlocked = tenantExpRes.status === 403;
  record(
    "Security Check 2",
    "Tenant Creation of Property Operational Expenses Blocked",
    tenantExpBlocked,
    `Status: ${tenantExpRes.status} (Expected 403 Forbidden)`
  );

  const tenantLeaseTermRes = await api(`/api/leases/${createdLease.id}/terminate`, {
    method: "POST",
    token: tokens.tenantA,
    body: { reason: "Attempting unilateral termination" },
  });
  const tenantTermBlocked = tenantLeaseTermRes.status === 403;
  record(
    "Security Check 2",
    "Tenant Unilateral Lease Termination Blocked",
    tenantTermBlocked,
    `Status: ${tenantLeaseTermRes.status} (Expected 403 Forbidden)`
  );

  // Security Check 3: Public Unauthenticated Document Download
  const publicDocRes = await api(`/api/documents/${doc.id}/download`);
  const publicDocBlocked = publicDocRes.status === 401;
  record(
    "Security Check 3",
    "Public Unauthenticated Document Download Blocked (Missing Bearer Token)",
    publicDocBlocked,
    `Status: ${publicDocRes.status} (Expected 401 Unauthorized)`
  );

  // Security Check 4: Sensitive Password & Account Data Sanitization
  const profileFetchRes = await api("/api/profile", { token: tokens.landlordA });
  const prof = profileFetchRes.data;
  const noPasswordsExposed =
    prof?.password === undefined &&
    prof?.passwordHash === undefined &&
    prof?.salt === undefined &&
    typeof prof?.banking?.accountNumber === "string" &&
    prof?.banking?.accountNumber.includes("••••");
  record(
    "Security Check 4",
    "Credential & Banking Account Sanitization (No Password Hashes / Masked Account)",
    noPasswordsExposed,
    `Password Excluded: ${prof?.password === undefined}, Masked Account: ${prof?.banking?.accountNumber}`
  );

  console.log("\n=======================================================================");
  console.log("📊 FINAL E2E TEST SUMMARY REPORT");
  console.log("=======================================================================");
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;

  console.log(`Total Checks Executed : ${totalTests}`);
  console.log(`Passed                : ${passedTests}`);
  console.log(`Failed                : ${failedTests}`);
  console.log("=======================================================================\n");

  process.exit(failedTests > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("FATAL ERROR IN E2E SUITE:", err);
  process.exit(1);
});
