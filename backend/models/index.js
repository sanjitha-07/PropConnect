import mongoose from "mongoose";

const defaultOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      if (!ret.id && ret._id) {
        ret.id = ret._id.toString();
      }
      return ret;
    },
  },
  toObject: { virtuals: true },
};

// 1. User Model
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "landlord", "tenant", "provider", "service_provider"], default: "tenant" },
    name: { type: String, required: true },
    entity_id: { type: String, default: null },
    entityId: { type: String, default: null },
    location: { type: String, default: "Tamil Nadu, India" },
  },
  defaultOptions
);

// 2. Landlord Model
const landlordSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    status: { type: String, default: "Verified" },
    propertiesCount: { type: Number, default: 0 },
    properties_count: { type: Number, default: 0 },
    totalUnits: { type: Number, default: 0 },
    total_units: { type: Number, default: 0 },
  },
  defaultOptions
);

// 3. Tenant Model
const tenantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    leaseId: { type: String, default: null },
    lease_id: { type: String, default: null },
    location: { type: String, default: "" },
    company: { type: String, default: "" },
    status: { type: String, default: "Active" },
  },
  defaultOptions
);

// 4. Property Model
const propertySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    building: { type: String, default: "" },
    unit: { type: String, default: "" },
    address: { type: String, default: "" },
    location: { type: String, default: "" },
    locality: { type: String, default: "" },
    city: { type: String, default: "Chennai" },
    district: { type: String, default: "Chennai" },
    state: { type: String, default: "Tamil Nadu" },
    type: { type: String, default: "Apartment" },
    rent: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    status: { type: String, default: "Available" },
    landlordId: { type: String, default: "LDL001" },
    landlord_id: { type: String, default: "LDL001" },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    bedrooms: { type: Number, default: 1 },
    bathrooms: { type: Number, default: 1 },
    balconies: { type: Number, default: 1 },
    sqft: { type: Number, default: 500 },
    furnishing: { type: String, default: "Unfurnished" },
    floor: { type: String, default: "1st" },
    facing: { type: String, default: "East (Vastu Compliant)" },
    parking: { type: String, default: "Covered Car Parking" },
    amenities: { type: [String], default: [] },
    nearbyFacilities: { type: [String], default: [] },
    description: { type: String, default: "" },
    petFriendly: { type: Boolean, default: false },
    availableUnits: { type: Number, default: 1 },
    totalUnits: { type: Number, default: 1 },
    builder: { type: String, default: "" },
    maintenanceCharges: { type: Number, default: 0 },
    image: { type: String, default: "" },
    images: {
      type: [
        {
          id: { type: String, default: "" },
          url: { type: String, required: true },
          category: { type: String, default: "Exterior" },
          caption: { type: String, default: "" },
          order: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  defaultOptions
);

// 5. Lease Model
const leaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    landlordId: { type: String, default: "LDL001" },
    landlord_id: { type: String, default: "LDL001" },
    startDate: { type: String, default: "" },
    start_date: { type: String, default: "" },
    endDate: { type: String, default: "" },
    end_date: { type: String, default: "" },
    monthlyRent: { type: Number, default: 0 },
    monthly_rent: { type: Number, default: 0 },
    rent: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    deposit_amount: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    status: { type: String, default: "Active" },
    paymentCycle: { type: String, default: "Monthly" },
    payment_cycle: { type: String, default: "Monthly" },
    termMonths: { type: Number, default: 11 },
    term_months: { type: Number, default: 11 },
    agreementDoc: { type: String, default: "" },
    agreement_doc: { type: String, default: "" },
    dueDay: { type: Number, default: 10 },
    due_day: { type: Number, default: 10 },
    reminderDaysBefore: { type: Number, default: 5 },
    reminder_days_before: { type: Number, default: 5 },
    gracePeriodDays: { type: Number, default: 5 },
    utilityResponsibility: {
      type: {
        electricity: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Tenant" },
        water: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Tenant" },
        gas: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Tenant" },
        internet: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Tenant" },
        maintenance: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Landlord" },
        other: { type: String, enum: ["Tenant", "Landlord", "Shared"], default: "Tenant" },
      },
      default: () => ({
        electricity: "Tenant",
        water: "Tenant",
        gas: "Tenant",
        internet: "Tenant",
        maintenance: "Landlord",
        other: "Tenant",
      }),
    },
  },
  defaultOptions
);

// 6. Payment Model
const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    tenantName: { type: String, default: "" },
    tenant_name: { type: String, default: "" },
    propertyName: { type: String, default: "" },
    property_name: { type: String, default: "" },
    month: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "Paid" },
    date: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    due_date: { type: String, default: "" },
    paidDate: { type: String, default: "" },
    paid_date: { type: String, default: "" },
    leaseId: { type: String, default: null },
    lease_id: { type: String, default: null },
    periodStart: { type: String, default: "" },
    periodEnd: { type: String, default: "" },
    cycleNumber: { type: Number, default: 1 },
    invoiceNo: { type: String, default: "" },
    invoice_no: { type: String, default: "" },
    receiptUrl: { type: String, default: "" },
    receipt_url: { type: String, default: "" },
  },
  defaultOptions
);

// 7. Maintenance Request Model
const maintenanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    tenantId: { type: String, default: "TEN001" },
    tenant_id: { type: String, default: "TEN001" },
    title: { type: String, default: "Maintenance Ticket" },
    description: { type: String, default: "" },
    category: { type: String, default: "General" },
    priority: { type: String, default: "Medium" },
    status: { type: String, default: "Open" },
    date: { type: String, default: "" },
    assignedTo: { type: String, default: null },
    assigned_to: { type: String, default: null },
    estimatedCost: { type: Number, default: 0 },
    estimated_cost: { type: Number, default: 0 },
  },
  defaultOptions
);

// 8. Complaint Model
const complaintSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    tenantName: { type: String, default: "Tenant" },
    tenant_name: { type: String, default: "Tenant" },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    property: { type: String, default: "Apartment" },
    propertyName: { type: String, default: "Apartment" },
    unit: { type: String, default: "" },
    category: { type: String, default: "General" },
    subject: { type: String, default: "" },
    issue: { type: String, default: "Complaint" },
    language: { type: String, default: "en" },
    tamilTranscript: { type: String, default: "" },
    priority: { type: String, default: "Medium" },
    status: { type: String, default: "Open" },
    date: { type: String, default: "" },
    serviceBookingId: { type: String, default: null },
    landlordNotes: { type: String, default: "" },
  },
  defaultOptions
);

// 9. Security Deposit Model
const depositSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "Held in Escrow" },
    dateReceived: { type: String, default: "" },
    date_received: { type: String, default: "" },
    returnStatus: { type: String, default: "Not Applicable" },
    return_status: { type: String, default: "Not Applicable" },
    refundAmount: { type: Number, default: 0 },
    refund_amount: { type: Number, default: 0 },
  },
  defaultOptions
);

// 10. Utility Bill Model (EB Bills and Tenant Expense Management)
const utilityBillSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    propertyName: { type: String, default: "" },
    property_name: { type: String, default: "" },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    tenantName: { type: String, default: "" },
    tenant_name: { type: String, default: "" },
    landlordId: { type: String, default: "LDL001" },
    landlord_id: { type: String, default: "LDL001" },
    type: { type: String, default: "Electricity" }, // Electricity (EB), Water, Gas, Internet, Maintenance, Other
    billingMonth: { type: String, default: "" }, // e.g. "October 2026", "2026-10"
    billing_month: { type: String, default: "" },
    consumerNo: { type: String, default: "" }, // TNEB Consumer Number or Utility Account ID
    billReference: { type: String, default: "" },
    bill_reference: { type: String, default: "" },
    previousReading: { type: Number, default: null }, // Optional meter readings
    previous_reading: { type: Number, default: null },
    currentReading: { type: Number, default: null },
    current_reading: { type: Number, default: null },
    unitsConsumed: { type: Number, default: null }, // kWh / Units
    units_consumed: { type: Number, default: null },
    ratePerUnit: { type: Number, default: 0 },
    amount: { type: Number, required: true, default: 0 }, // Total bill amount
    billDate: { type: String, default: "" }, // Issue Date
    bill_date: { type: String, default: "" },
    dueDate: { type: String, default: "" }, // Payment Due Date
    due_date: { type: String, default: "" },
    responsibility: {
      type: String,
      enum: ["Tenant", "Landlord", "Shared"],
      default: "Tenant",
    },
    tenantAmount: { type: Number, default: 0 }, // Assigned to tenant
    tenant_amount: { type: Number, default: 0 },
    landlordAmount: { type: Number, default: 0 }, // Assigned to landlord
    landlord_amount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Unpaid", "Due Soon", "Overdue", "Payment Pending", "Paid", "Failed"],
      default: "Unpaid",
    },
    documentUrl: { type: String, default: "" }, // Bill document / meter photo URL
    document_url: { type: String, default: "" },
    documentName: { type: String, default: "" },
    document_name: { type: String, default: "" },
    paidDate: { type: String, default: "" },
    paid_date: { type: String, default: "" },
    paidAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "" }, // "UPI", "Razorpay", "Card", "NetBanking"
    payment_method: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    transaction_id: { type: String, default: "" },
    paymentGatewayOrderId: { type: String, default: "" },
    paymentGatewaySignature: { type: String, default: "" },
    gatewayStatus: { type: String, default: "" },
    lastReminderDate: { type: String, default: "" },
    reminderCount: { type: Number, default: 0 },
    reminderHistory: {
      type: [
        {
          sentAt: { type: String, default: "" },
          type: { type: String, default: "reminder" },
          recipient: { type: String, default: "" },
          message: { type: String, default: "" },
        },
      ],
      default: [],
    },
    notes: { type: String, default: "" },
  },
  defaultOptions
);

// 11. Expense Model
const expenseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    category: { type: String, default: "Maintenance" },
    amount: { type: Number, default: 0 },
    description: { type: String, default: "" },
    date: { type: String, default: "" },
    paidTo: { type: String, default: "" },
    paid_to: { type: String, default: "" },
  },
  defaultOptions
);

// 12. Document Model
const documentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, default: "Document" },
    title: { type: String, default: "Document" },
    type: { type: String, default: "PDF" },
    relatedTo: { type: String, default: "" },
    propertyId: { type: String, default: null },
    property_id: { type: String, default: null },
    tenantId: { type: String, default: null },
    tenant_id: { type: String, default: null },
    url: { type: String, default: "" },
    uploadedOn: { type: String, default: "" },
    uploadedAt: { type: String, default: "" },
    uploaded_at: { type: String, default: "" },
    status: { type: String, default: "Verified" },
  },
  defaultOptions
);

// 13. Notification Model
const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, default: null },
    user_id: { type: String, default: null },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    textKey: { type: String, default: "" },
    meta: { type: String, default: "" },
    time: { type: String, default: "" },
    type: { type: String, default: "info" },
    isRead: { type: Boolean, default: false },
    is_read: { type: Boolean, default: false },
  },
  defaultOptions
);

// 14. Tenant Preference Model (Find Your Home / Discovery Flow)
const tenantPreferenceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    user_id: { type: String, default: null },
    city: { type: String, default: "Chennai" },
    locality: { type: String, default: "" },
    propertyType: { type: String, default: "Apartment" },
    bhk: { type: String, default: "2" },
    familyMembers: { type: Number, default: 2 },
    budgetRange: { type: String, default: "₹20,000–₹30,000" },
    budgetMin: { type: Number, default: 20000 },
    budgetMax: { type: Number, default: 30000 },
    furnishing: { type: String, default: "No preference" },
    amenities: { type: [String], default: [] },
    nearby: { type: [String], default: [] },
    maxDistance: { type: String, default: "Any distance" },
    additionalRequirements: { type: String, default: "" },
  },
  defaultOptions
);

// 15. Property-Aware Chat Conversation Model
const propertyChatSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    propertyId: { type: String, required: true, index: true },
    propertyName: { type: String, default: "" },
    language: { type: String, default: "en" },
    messages: [
      {
        sender: { type: String, enum: ["user", "assistant"], required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        language: { type: String, default: "en" },
      },
    ],
    lastMessage: { type: String, default: "" },
  },
  defaultOptions
);

// 16. Landlord Enquiry & Visit Booking Model
const enquirySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true, index: true },
    propertyName: { type: String, default: "" },
    tenantId: { type: String, default: "" },
    tenantName: { type: String, default: "" },
    tenantEmail: { type: String, default: "" },
    tenantPhone: { type: String, default: "" },
    landlordId: { type: String, default: "LDL001" },
    type: { type: String, default: "Schedule Visit" },
    preferredDate: { type: String, default: "" },
    preferredTime: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, default: "Pending" },
    date: { type: String, default: "" },
  },
  defaultOptions
);

// 17. Property Image Media Model
const propertyImageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    category: { type: String, default: "Exterior" },
    caption: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  defaultOptions
);

// 18. Saved / Favorite Property Model
const favoriteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: "" },
    propertyId: { type: String, required: true, index: true },
    propertyName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  defaultOptions
);

export const User = mongoose.model("User", userSchema);
export const Landlord = mongoose.model("Landlord", landlordSchema);
export const Tenant = mongoose.model("Tenant", tenantSchema);
export const Property = mongoose.model("Property", propertySchema);
export const Lease = mongoose.model("Lease", leaseSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
export const MaintenanceRequest = mongoose.model("MaintenanceRequest", maintenanceSchema);
export const Complaint = mongoose.model("Complaint", complaintSchema);
export const SecurityDeposit = mongoose.model("SecurityDeposit", depositSchema);
export const UtilityBill = mongoose.model("UtilityBill", utilityBillSchema);
// 19. System Settings (Global Organization Theme & Customization)
const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    primaryColor: { type: String, default: "#1976D2" },
    fontFamily: { type: String, default: "Inter" },
    language: { type: String, default: "en" },
    fontSize: { type: String, default: "medium" },
    themeMode: { type: String, default: "light" },
    appName: { type: String, default: "PropConnect Management System" },
    currency: { type: String, default: "INR" },
    dateFormat: { type: String, default: "DD/MM/YYYY" },
    role: { type: String, default: "admin" },
    updatedBy: { type: String, default: "admin" },
    updatedAt: { type: Date, default: Date.now },
  },
  defaultOptions
);

export const Expense = mongoose.model("Expense", expenseSchema);
export const Document = mongoose.model("Document", documentSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const TenantPreference = mongoose.model("TenantPreference", tenantPreferenceSchema);
export const PropertyChat = mongoose.model("PropertyChat", propertyChatSchema);
export const Enquiry = mongoose.model("Enquiry", enquirySchema);
export const PropertyImage = mongoose.model("PropertyImage", propertyImageSchema);
export const Favorite = mongoose.model("Favorite", favoriteSchema);
export const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

// 21. FixIt & Home Services Service Provider Model
const serviceProviderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    technicianName: { type: String, default: "" },
    category: { type: String, required: true },
    price: { type: Number, default: 499 },
    unit: { type: String, default: "per service" },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 },
    reviews: {
      type: [
        {
          author: { type: String, default: "Customer" },
          rating: { type: Number, default: 5 },
          comment: { type: String, default: "" },
          date: { type: String, default: "" },
        },
      ],
      default: [],
    },
    distanceKm: { type: Number, default: 1.5 },
    availability: { type: String, default: "Available Today" },
    isAvailable: { type: Boolean, default: true },
    status: { type: String, enum: ["Active", "Inactive", "Suspended"], default: "Active" },
    phone: { type: String, default: "+91 98765 00001" },
    email: { type: String, default: "" },
    location: { type: String, default: "Chennai, Tamil Nadu" },
    lat: { type: Number, default: 13.0827 },
    lng: { type: Number, default: 80.2707 },
    address: { type: String, default: "Chennai, Tamil Nadu" },
    skills: { type: [String], default: [] },
    badge: { type: String, default: "PropConnect Verified Pro" },
    vehicle: { type: String, default: "TVS Apache - TN 01 AB 4321" },
    experienceYears: { type: Number, default: 5 },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    workingDays: {
      type: [String],
      default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },
    timeSlots: {
      type: [String],
      default: [
        "09:00 AM",
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "02:00 PM",
        "03:00 PM",
        "04:00 PM",
        "05:00 PM",
      ],
    },
    maxBookingsPerSlot: { type: Number, default: 1 },
  },
  defaultOptions
);

// 22. Service Category Model
const serviceCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "Wrench" },
    basePrice: { type: Number, default: 499 },
    unit: { type: String, default: "per service" },
    services: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  defaultOptions
);

// 23. Provider Availability Override / Custom Schedule Model
const providerAvailabilitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    providerId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    timeSlot: { type: String, required: true }, // "10:00 AM"
    isAvailable: { type: Boolean, default: false }, // false indicates blocked/leave
    status: { type: String, enum: ["Available", "Booked", "Blocked", "Leave"], default: "Blocked" },
    reason: { type: String, default: "" },
    bookingId: { type: String, default: null },
  },
  defaultOptions
);

// 24. Home Service Booking Model
const serviceBookingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    bookingNumber: { type: String, default: "" },
    complaintId: { type: String, default: null },

    // User / Booker
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, default: "" },
    userPhone: { type: String, default: "" },
    userRole: { type: String, enum: ["tenant", "landlord", "admin"], required: true },

    // Property Reference
    propertyId: { type: String, required: true, index: true },
    propertyName: { type: String, default: "" },
    unit: { type: String, default: "" },
    address: { type: String, default: "" },
    landlordId: { type: String, default: "LDL001", index: true },

    // Service & Provider
    serviceCategory: { type: String, required: true, index: true },
    serviceName: { type: String, default: "" },
    serviceDescription: { type: String, default: "" },
    providerId: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    providerPhone: { type: String, default: "" },
    technicianName: { type: String, default: "" },
    technicianPhone: { type: String, default: "" },

    // Schedule
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    timeSlot: { type: String, required: true }, // "10:00 AM"

    // Lifecycle Status
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"],
      default: "Confirmed",
      index: true,
    },

    amount: { type: Number, default: 499 },
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Refunded"], default: "Pending" },

    timeline: [
      {
        status: { type: String, required: true },
        time: { type: String, required: true },
        note: { type: String, default: "" },
        updatedBy: { type: String, default: "" },
      },
    ],

    notes: { type: String, default: "" },
    cancellationReason: { type: String, default: "" },
    completionDate: { type: String, default: "" },
    completionNotes: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    customerRating: { type: Number, default: 0 },
    reviewText: { type: String, default: "" },
    customerFeedback: { type: String, default: "" },
  },
  defaultOptions
);

// Prevent concurrent double bookings at the database index level
serviceBookingSchema.index(
  { providerId: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Pending", "Confirmed", "Assigned", "In Progress"] },
    },
  }
);

// 25. Landlord Preferred Provider Model (Per Property & Category)
const preferredProviderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true },
    landlordId: { type: String, default: "LDL001" },
    category: { type: String, required: true }, // "AC", "Electrical", "Plumbing", "Cleaning"
    providerId: { type: String, required: true },
    providerName: { type: String, required: true },
    isSimulatedBusy: { type: Boolean, default: false },
    backupPolicy: { type: String, default: "auto_recommend_fixit" },
    customNotes: { type: String, default: "" },
  },
  defaultOptions
);

// 26. FixIt Local Service Booking & Live GPS Dispatch Model
const fixItBookingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    complaintId: { type: String, default: null },
    propertyId: { type: String, required: true },
    propertyName: { type: String, default: "" },
    unit: { type: String, default: "Flat B-204" },
    tenantId: { type: String, default: "TEN001" },
    tenantName: { type: String, default: "Tenant" },
    tenantPhone: { type: String, default: "+91 98700 11223" },
    landlordId: { type: String, default: "LDL001" },
    category: { type: String, default: "AC Repair" },
    serviceTitle: { type: String, default: "AC Repair & Service" },
    issueDescription: { type: String, default: "" },
    providerId: { type: String, required: true },
    providerName: { type: String, required: true },
    technicianName: { type: String, default: "Technician" },
    technicianPhone: { type: String, default: "+91 98765 00001" },
    vehicle: { type: String, default: "TN 01 AB 4321" },
    status: {
      type: String,
      enum: ["Confirmed", "On The Way", "Arrived", "In Progress", "Completed", "Cancelled"],
      default: "Confirmed",
    },
    scheduledDate: { type: String, default: "" },
    scheduledSlot: { type: String, default: "02:00 PM - 04:00 PM" },
    amount: { type: Number, default: 800 },
    paymentStatus: { type: String, default: "Pending" },
    currentLocation: {
      lat: { type: Number, default: 13.055 },
      lng: { type: Number, default: 80.245 },
    },
    destinationLocation: {
      lat: { type: Number, default: 13.0418 },
      lng: { type: Number, default: 80.2341 },
      address: { type: String, default: "Sai Kala Apartments, Flat B-204, T. Nagar, Chennai" },
    },
    distanceKm: { type: Number, default: 1.8 },
    etaMinutes: { type: Number, default: 8 },
    timeline: {
      type: [
        {
          status: { type: String },
          time: { type: String },
          note: { type: String },
        },
      ],
      default: [],
    },
    rating: { type: Number, default: 0 },
    reviewText: { type: String, default: "" },
  },
  defaultOptions
);

// 27. Property Maintenance History & Cost Ledger Model
const propertyMaintenanceHistorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true },
    propertyName: { type: String, default: "" },
    unit: { type: String, default: "Flat B-204" },
    category: { type: String, required: true }, // "AC Service", "Plumbing Repair", "Electrical", "Cleaning"
    serviceTitle: { type: String, required: true },
    description: { type: String, default: "" },
    cost: { type: Number, required: true },
    providerName: { type: String, required: true },
    technicianName: { type: String, default: "" },
    providerId: { type: String, default: "" },
    date: { type: String, required: true },
    status: { type: String, default: "Completed" },
    invoiceId: { type: String, default: "" },
    rating: { type: Number, default: 5 },
    bookingId: { type: String, default: "" },
    complaintId: { type: String, default: "" },
  },
  defaultOptions
);

// 28. Complaint Category Model
const complaintCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "AlertCircle" },
    defaultPriority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], default: "Medium" },
    expectedResolutionHours: { type: Number, default: 24 },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  defaultOptions
);

export const ServiceProvider = mongoose.model("ServiceProvider", serviceProviderSchema);
export const ServiceCategory = mongoose.model("ServiceCategory", serviceCategorySchema);
export const ProviderAvailability = mongoose.model("ProviderAvailability", providerAvailabilitySchema);
export const ServiceBooking = mongoose.model("ServiceBooking", serviceBookingSchema);
export const PreferredProvider = mongoose.model("PreferredProvider", preferredProviderSchema);
export const FixItBooking = mongoose.model("FixItBooking", fixItBookingSchema);
export const PropertyMaintenanceHistory = mongoose.model(
  "PropertyMaintenanceHistory",
  propertyMaintenanceHistorySchema
);
export const ComplaintCategory = mongoose.model("ComplaintCategory", complaintCategorySchema);

export const models = {
  users: User,
  landlords: Landlord,
  tenants: Tenant,
  properties: Property,
  leases: Lease,
  payments: Payment,
  maintenance_requests: MaintenanceRequest,
  complaints: Complaint,
  complaint_categories: ComplaintCategory,
  security_deposits: SecurityDeposit,
  utility_bills: UtilityBill,
  expenses: Expense,
  documents: Document,
  notifications: Notification,
  preferences: TenantPreference,
  property_chats: PropertyChat,
  enquiries: Enquiry,
  property_images: PropertyImage,
  favorites: Favorite,
  saved_properties: Favorite,
  system_settings: SystemSetting,
  service_providers: ServiceProvider,
  service_categories: ServiceCategory,
  provider_availabilities: ProviderAvailability,
  service_bookings: ServiceBooking,
  preferred_providers: PreferredProvider,
  fixit_bookings: FixItBooking,
  maintenance_history: PropertyMaintenanceHistory,
};


