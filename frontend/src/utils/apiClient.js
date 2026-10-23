// src/utils/apiClient.js
// Client interface to the Tenant & Landlord Management System REST API / MongoDB Backend

import { FIXIT_PROVIDERS, DEFAULT_PREFERRED_PROVIDERS, INITIAL_MAINTENANCE_HISTORY } from "../data/db.js";

const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem("pc-token");
  let user = null;
  try {
    const raw = localStorage.getItem("pc-user");
    if (raw) user = JSON.parse(raw);
  } catch {}

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(user?.role ? { "x-user-role": user.role } : {}),
      ...(user?.entityId || user?.entity_id || user?.id
        ? { "x-user-id": user.entityId || user.entity_id || user.id }
        : {}),
      ...(user?.email ? { "x-user-email": user.email } : {}),
      ...options.headers,
    },
    ...options,
  };
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.message || errJson.error) errorMsg = errJson.message || errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }
  return await res.json();
}

// -------------------------------------------------------------
// Database Health & Live Status
// -------------------------------------------------------------
export async function fetchDbStatus() {
  try {
    return await request("/db/status");
  } catch (err) {
    return {
      status: "offline",
      readyState: "offline",
      engine: "MongoDB Compass",
      compassUri: "mongodb://127.0.0.1:27017",
      database: "propconnect_db",
      error: err.message,
    };
  }
}

export async function fetchStats() {
  try {
    return await request("/stats");
  } catch (err) {
    return null;
  }
}

export async function executeMongoQuery(payload) {
  try {
    const body = typeof payload === "string" ? { query: payload } : payload;
    return await request("/db/query", { method: "POST", body });
  } catch (err) {
    return { success: false, error: err.message };
  }
}
export const executeSqlQuery = executeMongoQuery;

// -------------------------------------------------------------
// Properties CRUD
// -------------------------------------------------------------
export async function fetchProperties() {
  try {
    return await request("/properties");
  } catch (err) {
    console.warn("fetchProperties fallback to local:", err.message);
    return null;
  }
}

export async function fetchPropertyById(id) {
  try {
    return await request(`/properties/${id}`);
  } catch (err) {
    return null;
  }
}

export async function createProperty(propertyData) {
  try {
    return await request("/properties", { method: "POST", body: propertyData });
  } catch (err) {
    console.warn("createProperty offline fallback:", err.message);
    return { ...propertyData, id: propertyData.id || `TN_${Date.now()}` };
  }
}

export async function updateProperty(id, propertyData) {
  try {
    return await request(`/properties/${id}`, { method: "PUT", body: propertyData });
  } catch (err) {
    console.warn("updateProperty offline fallback:", err.message);
    return { ...propertyData, id };
  }
}

export async function deleteProperty(id) {
  try {
    return await request(`/properties/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteProperty offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Tenants CRUD
// -------------------------------------------------------------
export async function fetchTenants() {
  try {
    return await request("/tenants");
  } catch (err) {
    console.warn("fetchTenants fallback to local:", err.message);
    return null;
  }
}

export async function createTenant(tenantData) {
  try {
    return await request("/tenants", { method: "POST", body: tenantData });
  } catch (err) {
    console.warn("createTenant offline fallback:", err.message);
    return { ...tenantData, id: tenantData.id || `TEN_${Date.now()}` };
  }
}

export async function updateTenant(id, tenantData) {
  try {
    return await request(`/tenants/${id}`, { method: "PUT", body: tenantData });
  } catch (err) {
    console.warn("updateTenant offline fallback:", err.message);
    return { ...tenantData, id };
  }
}

export async function deleteTenant(id) {
  try {
    return await request(`/tenants/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteTenant offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Landlords CRUD
// -------------------------------------------------------------
export async function fetchLandlords() {
  try {
    return await request("/landlords");
  } catch (err) {
    console.warn("fetchLandlords fallback to local:", err.message);
    return null;
  }
}

export async function createLandlord(landlordData) {
  try {
    return await request("/landlords", { method: "POST", body: landlordData });
  } catch (err) {
    console.warn("createLandlord offline fallback:", err.message);
    return { ...landlordData, id: landlordData.id || `LDL_${Date.now()}` };
  }
}

export async function updateLandlord(id, landlordData) {
  try {
    return await request(`/landlords/${id}`, { method: "PUT", body: landlordData });
  } catch (err) {
    console.warn("updateLandlord offline fallback:", err.message);
    return { ...landlordData, id };
  }
}

export async function deleteLandlord(id) {
  try {
    return await request(`/landlords/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteLandlord offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Leases CRUD
// -------------------------------------------------------------
export async function fetchLeases() {
  try {
    return await request("/leases");
  } catch (err) {
    console.warn("fetchLeases fallback to local:", err.message);
    return null;
  }
}

export async function createLease(leaseData) {
  try {
    return await request("/leases", { method: "POST", body: leaseData });
  } catch (err) {
    console.warn("createLease offline fallback:", err.message);
    return { ...leaseData, id: leaseData.id || `LSE_${Date.now()}` };
  }
}

export async function updateLease(id, leaseData) {
  try {
    return await request(`/leases/${id}`, { method: "PUT", body: leaseData });
  } catch (err) {
    console.warn("updateLease offline fallback:", err.message);
    return { ...leaseData, id };
  }
}

export async function deleteLease(id) {
  try {
    return await request(`/leases/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteLease offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Move-In Date Rent Cycle API
// -------------------------------------------------------------
export async function fetchRentSchedules(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString();
    const query = qs ? `?${qs}` : "";
    return await request(`/leases/rent-schedules${query}`);
  } catch (err) {
    console.warn("fetchRentSchedules fallback:", err.message);
    return null;
  }
}

export async function fetchLeaseRentCycle(leaseId) {
  try {
    return await request(`/leases/${leaseId}/rent-cycle`);
  } catch (err) {
    console.warn("fetchLeaseRentCycle fallback:", err.message);
    return null;
  }
}

export async function generateRentInvoice(leaseId) {
  try {
    return await request(`/leases/${leaseId}/generate-rent-invoice`, { method: "POST" });
  } catch (err) {
    console.warn("generateRentInvoice fallback:", err.message);
    return null;
  }
}

export async function remindRent(leaseId, message = "") {
  try {
    return await request(`/leases/${leaseId}/remind-rent`, {
      method: "POST",
      body: { message },
    });
  } catch (err) {
    console.warn("remindRent fallback:", err.message);
    return null;
  }
}

export async function triggerRentReminders() {
  try {
    return await request("/leases/trigger-reminders", { method: "POST" });
  } catch (err) {
    console.warn("triggerRentReminders fallback:", err.message);
    return null;
  }
}

// -------------------------------------------------------------
// Payments CRUD
// -------------------------------------------------------------
export async function fetchPayments(tenantId) {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    return await request(`/payments${query}`);
  } catch (err) {
    console.warn("fetchPayments fallback to local:", err.message);
    return null;
  }
}

export async function createPayment(paymentData) {
  try {
    return await request("/payments", { method: "POST", body: paymentData });
  } catch (err) {
    console.warn("createPayment offline fallback:", err.message);
    return { ...paymentData, id: paymentData.id || `PAY_${Date.now()}` };
  }
}

export async function updatePayment(id, paymentData) {
  try {
    return await request(`/payments/${id}`, { method: "PUT", body: paymentData });
  } catch (err) {
    console.warn("updatePayment offline fallback:", err.message);
    return { ...paymentData, id };
  }
}

export async function deletePayment(id) {
  try {
    return await request(`/payments/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deletePayment offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Maintenance Requests CRUD
// -------------------------------------------------------------
export async function fetchMaintenance() {
  try {
    return await request("/maintenance");
  } catch (err) {
    console.warn("fetchMaintenance fallback to local:", err.message);
    return null;
  }
}

export async function createMaintenanceRequest(ticketData) {
  try {
    return await request("/maintenance", { method: "POST", body: ticketData });
  } catch (err) {
    console.warn("createMaintenanceRequest offline fallback:", err.message);
    return { ...ticketData, id: ticketData.id || `MNT_${Date.now()}` };
  }
}

export async function updateMaintenanceRequest(id, ticketData) {
  try {
    return await request(`/maintenance/${id}`, { method: "PUT", body: ticketData });
  } catch (err) {
    console.warn("updateMaintenanceRequest offline fallback:", err.message);
    return { ...ticketData, id };
  }
}

export async function deleteMaintenanceRequest(id) {
  try {
    return await request(`/maintenance/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteMaintenanceRequest offline fallback:", err.message);
    return { success: true, id };
  }
}
export const createMaintenance = createMaintenanceRequest;
export const updateMaintenance = updateMaintenanceRequest;
export const deleteMaintenance = deleteMaintenanceRequest;

// -------------------------------------------------------------
// Complaints CRUD
// -------------------------------------------------------------
export async function fetchComplaints() {
  try {
    return await request("/complaints");
  } catch (err) {
    console.warn("fetchComplaints fallback to local:", err.message);
    return null;
  }
}

export async function createComplaint(complaintData) {
  try {
    return await request("/complaints", { method: "POST", body: complaintData });
  } catch (err) {
    console.warn("createComplaint offline fallback:", err.message);
    return { ...complaintData, id: complaintData.id || `CMP_${Date.now()}` };
  }
}

export async function updateComplaint(id, complaintData) {
  try {
    return await request(`/complaints/${id}`, { method: "PUT", body: complaintData });
  } catch (err) {
    console.warn("updateComplaint offline fallback:", err.message);
    return { ...complaintData, id };
  }
}

export async function deleteComplaint(id) {
  try {
    return await request(`/complaints/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteComplaint offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Security Deposits CRUD
// -------------------------------------------------------------
export async function fetchDeposits() {
  try {
    return await request("/deposits");
  } catch (err) {
    console.warn("fetchDeposits fallback to local:", err.message);
    return null;
  }
}

export async function createDeposit(depositData) {
  try {
    return await request("/deposits", { method: "POST", body: depositData });
  } catch (err) {
    console.warn("createDeposit offline fallback:", err.message);
    return { ...depositData, id: depositData.id || `DEP_${Date.now()}` };
  }
}

export async function updateDeposit(id, depositData) {
  try {
    return await request(`/deposits/${id}`, { method: "PUT", body: depositData });
  } catch (err) {
    console.warn("updateDeposit offline fallback:", err.message);
    return { ...depositData, id };
  }
}

export async function deleteDeposit(id) {
  try {
    return await request(`/deposits/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteDeposit offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Utility Bills & EB Bill Management CRUD
// -------------------------------------------------------------
export async function fetchUtilityBills(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "" && val !== "All") {
        query.append(key, val);
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : "";
    return await request(`/utility-bills${qs}`);
  } catch (err) {
    console.warn("fetchUtilityBills fallback to local:", err.message);
    return null;
  }
}

export async function fetchUtilityBillSummary(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : "";
    return await request(`/utility-bills/summary${qs}`);
  } catch (err) {
    console.warn("fetchUtilityBillSummary fallback:", err.message);
    return null;
  }
}

export async function fetchUtilityBillById(id) {
  try {
    return await request(`/utility-bills/${id}`);
  } catch (err) {
    return null;
  }
}

export async function createUtilityBill(billData) {
  try {
    return await request("/utility-bills", { method: "POST", body: billData });
  } catch (err) {
    console.warn("createUtilityBill offline fallback:", err.message);
    throw err;
  }
}

export async function updateUtilityBill(id, billData) {
  try {
    return await request(`/utility-bills/${id}`, { method: "PUT", body: billData });
  } catch (err) {
    console.warn("updateUtilityBill offline fallback:", err.message);
    return { ...billData, id };
  }
}

export async function deleteUtilityBill(id) {
  try {
    return await request(`/utility-bills/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteUtilityBill offline fallback:", err.message);
    return { success: true, id };
  }
}

export async function createEbBillOrder(id) {
  try {
    return await request(`/utility-bills/${id}/create-order`, { method: "POST" });
  } catch (err) {
    throw err;
  }
}

export async function payUtilityBill(id, paymentData) {
  try {
    return await request(`/utility-bills/${id}/pay`, {
      method: "POST",
      body: paymentData,
    });
  } catch (err) {
    throw err;
  }
}

export async function sendUtilityBillReminder(id) {
  try {
    return await request(`/utility-bills/${id}/remind`, { method: "POST" });
  } catch (err) {
    throw err;
  }
}

export async function triggerAutomaticReminders() {
  try {
    return await request("/utility-bills/trigger-reminders", { method: "POST" });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// Expenses CRUD
// -------------------------------------------------------------
export async function fetchExpenses() {
  try {
    return await request("/expenses");
  } catch (err) {
    console.warn("fetchExpenses fallback to local:", err.message);
    return null;
  }
}

export async function createExpense(expenseData) {
  try {
    return await request("/expenses", { method: "POST", body: expenseData });
  } catch (err) {
    console.warn("createExpense offline fallback:", err.message);
    return { ...expenseData, id: expenseData.id || `EXP_${Date.now()}` };
  }
}

export async function updateExpense(id, expenseData) {
  try {
    return await request(`/expenses/${id}`, { method: "PUT", body: expenseData });
  } catch (err) {
    console.warn("updateExpense offline fallback:", err.message);
    return { ...expenseData, id };
  }
}

export async function deleteExpense(id) {
  try {
    return await request(`/expenses/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteExpense offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Documents CRUD
// -------------------------------------------------------------
export async function fetchDocuments() {
  try {
    return await request("/documents");
  } catch (err) {
    console.warn("fetchDocuments fallback to local:", err.message);
    return null;
  }
}

export async function createDocument(docData) {
  try {
    return await request("/documents", { method: "POST", body: docData });
  } catch (err) {
    console.warn("createDocument offline fallback:", err.message);
    return { ...docData, id: docData.id || `DOC_${Date.now()}` };
  }
}

export async function updateDocument(id, docData) {
  try {
    return await request(`/documents/${id}`, { method: "PUT", body: docData });
  } catch (err) {
    console.warn("updateDocument offline fallback:", err.message);
    return { ...docData, id };
  }
}

export async function deleteDocument(id) {
  try {
    return await request(`/documents/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("deleteDocument offline fallback:", err.message);
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Notifications
// -------------------------------------------------------------
export async function fetchNotifications() {
  try {
    return await request("/notifications");
  } catch (err) {
    return null;
  }
}

export async function markNotificationAsRead(id) {
  try {
    return await request(`/notifications/${id}/read`, { method: "PUT" });
  } catch (err) {
    return { success: true, id };
  }
}

// -------------------------------------------------------------
// Tenant Preference Discovery & Smart Matching API
// -------------------------------------------------------------
export async function matchProperties(preferences) {
  try {
    const res = await request("/properties/match", { method: "POST", body: preferences });
    return res.properties || [];
  } catch (err) {
    console.warn("matchProperties API error, fallback to client matching:", err.message);
    return null;
  }
}

export async function fetchTenantPreferences(userId) {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await request(`/preferences${query}`);
    return res.preference || null;
  } catch (err) {
    // Check localStorage
    try {
      const saved = localStorage.getItem(`propconnect_pref_${userId || "current"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }
}

export async function saveTenantPreferences(preferences) {
  try {
    const res = await request("/preferences", { method: "POST", body: preferences });
    if (preferences.userId) {
      localStorage.setItem(`propconnect_pref_${preferences.userId}`, JSON.stringify(res.preference || preferences));
    }
    return res.preference;
  } catch (err) {
    if (preferences.userId) {
      localStorage.setItem(`propconnect_pref_${preferences.userId}`, JSON.stringify(preferences));
    }
    return preferences;
  }
}

// -------------------------------------------------------------
// Property-Aware Chat & Inquiry Assistance
// -------------------------------------------------------------
export async function askPropertyQuestion(propertyId, payload) {
  try {
    return await request(`/property-chat/${propertyId}/ask`, {
      method: "POST",
      body: payload,
    });
  } catch (err) {
    console.warn("askPropertyQuestion offline fallback:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function fetchPropertyChatHistory(propertyId, userId) {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await request(`/property-chat/${propertyId}${query}`);
    return res.messages || [];
  } catch (err) {
    try {
      const cached = localStorage.getItem(`propconnect_chat_${propertyId}_${userId || "current"}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
}

export async function fetchRecentPropertyChats(userId) {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await request(`/property-chat${query}`);
    return res.chats || [];
  } catch (err) {
    return [];
  }
}

// -------------------------------------------------------------
// Enquiries & Visit Bookings
// -------------------------------------------------------------
export async function createEnquiry(enquiryData) {
  try {
    return await request("/enquiries", { method: "POST", body: enquiryData });
  } catch (err) {
    console.warn("createEnquiry offline fallback:", err.message);
    return {
      success: true,
      enquiry: { ...enquiryData, id: `ENQ_${Date.now()}` },
    };
  }
}

export async function fetchEnquiries() {
  try {
    return await request("/enquiries");
  } catch (err) {
    return [];
  }
}

// -------------------------------------------------------------
// Authentication & Tenant Registration
// -------------------------------------------------------------
export async function registerTenant(tenantData) {
  try {
    return await request("/auth/register", {
      method: "POST",
      body: tenantData,
    });
  } catch (err) {
    return {
      success: false,
      message: err.message || "Failed to register tenant account",
    };
  }
}

// -------------------------------------------------------------
// Property Media & Gallery API
// -------------------------------------------------------------
export async function fetchPropertyImages(propertyId) {
  try {
    const res = await request(`/properties/${propertyId}/images`);
    return res.images || [];
  } catch (err) {
    console.warn("fetchPropertyImages fallback:", err.message);
    return [];
  }
}

// -------------------------------------------------------------
// Favorites / Saved Properties (Database-backed)
// -------------------------------------------------------------
export async function fetchFavorites(userId) {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await request(`/favorites${query}`);
    return {
      propertyIds: res.propertyIds || [],
      favorites: res.favorites || [],
      properties: res.properties || [],
    };
  } catch (err) {
    console.warn("fetchFavorites fallback:", err.message);
    try {
      const stored = localStorage.getItem("propconnect_saved_favorites");
      const ids = stored ? JSON.parse(stored) : [];
      return { propertyIds: ids, favorites: [], properties: [] };
    } catch {
      return { propertyIds: [], favorites: [], properties: [] };
    }
  }
}

export async function toggleFavoriteApi(userId, propertyId, action) {
  try {
    const res = await request("/favorites", {
      method: "POST",
      body: { userId, propertyId, action },
    });
    return res;
  } catch (err) {
    console.warn("toggleFavoriteApi offline fallback:", err.message);
    return { success: false, error: err.message };
  }
}

export async function removeFavoriteApi(userId, propertyId) {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return await request(`/favorites/${propertyId}${query}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("removeFavoriteApi offline fallback:", err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// System & User Theme & Customization Settings API
// -------------------------------------------------------------
export async function fetchThemeSettings() {
  try {
    const res = await request("/settings/theme");
    return res.settings || null;
  } catch (err) {
    console.warn("fetchThemeSettings offline fallback:", err.message);
    return null;
  }
}

export async function saveThemeSettings(settingsData) {
  try {
    const res = await request("/settings/theme", {
      method: "PUT",
      body: settingsData,
    });
    return res;
  } catch (err) {
    console.warn("saveThemeSettings offline fallback:", err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchUserSettings(userId) {
  try {
    const res = await request(`/settings/user/${encodeURIComponent(userId)}`);
    return res.settings || null;
  } catch (err) {
    console.warn("fetchUserSettings offline fallback:", err.message);
    return null;
  }
}

export async function saveUserSettings(userId, settingsData) {
  try {
    const res = await request(`/settings/user/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: settingsData,
    });
    return res;
  } catch (err) {
    console.warn("saveUserSettings offline fallback:", err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// FixIt Local Unified Service Providers & Dispatches
// -------------------------------------------------------------
export async function fetchFixItProviders(category) {
  try {
    const query = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
    return await request(`/service-providers${query}`);
  } catch (err) {
    console.warn("fetchFixItProviders fallback to local dataset:", err.message);
    if (category && category !== "All") {
      return FIXIT_PROVIDERS.filter((p) => p.category.toLowerCase().includes(category.toLowerCase()));
    }
    return FIXIT_PROVIDERS;
  }
}

export async function fetchPreferredProviders(propertyId = "TN101") {
  try {
    return await request(`/preferred-providers/${encodeURIComponent(propertyId)}`);
  } catch (err) {
    console.warn("fetchPreferredProviders fallback to local dataset:", err.message);
    const local = localStorage.getItem(`tlms_pref_providers_${propertyId}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }
    return DEFAULT_PREFERRED_PROVIDERS[propertyId] || DEFAULT_PREFERRED_PROVIDERS["TN101"] || {};
  }
}

export async function savePreferredProviders(payload) {
  const { propertyId = "TN101" } = payload;
  try {
    const res = await request("/preferred-providers", {
      method: "POST",
      body: payload,
    });
    return res;
  } catch (err) {
    console.warn("savePreferredProviders offline fallback:", err.message);
    // Update local storage
    const current = await fetchPreferredProviders(propertyId);
    current[payload.category] = {
      providerId: payload.providerId,
      providerName: payload.providerName,
      isSimulatedBusy: Boolean(payload.isSimulatedBusy),
    };
    try {
      localStorage.setItem(`tlms_pref_providers_${propertyId}`, JSON.stringify(current));
    } catch {}
    return current[payload.category];
  }
}

export async function togglePreferredProviderBusy(propertyId = "TN101", category = "AC", isSimulatedBusy) {
  try {
    return await request("/preferred-providers/toggle-busy", {
      method: "POST",
      body: { propertyId, category, isSimulatedBusy },
    });
  } catch (err) {
    const current = await fetchPreferredProviders(propertyId);
    if (current[category]) {
      current[category].isSimulatedBusy = Boolean(isSimulatedBusy);
    }
    try {
      localStorage.setItem(`tlms_pref_providers_${propertyId}`, JSON.stringify(current));
    } catch {}
    return { success: true, isSimulatedBusy: Boolean(isSimulatedBusy) };
  }
}

export async function fetchFixItBookings(filter = {}) {
  try {
    const params = new URLSearchParams(filter).toString();
    return await request(`/fixit-bookings${params ? `?${params}` : ""}`);
  } catch (err) {
    console.warn("fetchFixItBookings offline fallback:", err.message);
    const local = localStorage.getItem("tlms_fixit_bookings");
    return local ? JSON.parse(local) : [];
  }
}

export async function fetchFixItBookingById(id) {
  try {
    return await request(`/fixit-bookings/${encodeURIComponent(id)}`);
  } catch (err) {
    const bookings = await fetchFixItBookings();
    return bookings.find((b) => b.id === id) || null;
  }
}

export async function createFixItBooking(bookingData) {
  try {
    const res = await request("/fixit-bookings", {
      method: "POST",
      body: bookingData,
    });
    return res;
  } catch (err) {
    console.warn("createFixItBooking offline fallback:", err.message);
    const id = `BK_FIX_${Math.floor(1000 + Math.random() * 9000)}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localBooking = {
      id,
      ...bookingData,
      status: "Confirmed",
      amount: Number(bookingData.amount || 800),
      distanceKm: 1.8,
      etaMinutes: 8,
      currentLocation: { lat: 13.055, lng: 80.245 },
      destinationLocation: { lat: 13.0418, lng: 80.2341, address: "Sai Kala Apartments, Flat B-204, T. Nagar, Chennai" },
      timeline: [{ status: "Confirmed", time: timeNow, note: "Technician assigned & dispatched" }],
    };
    const current = await fetchFixItBookings();
    current.unshift(localBooking);
    try {
      localStorage.setItem("tlms_fixit_bookings", JSON.stringify(current));
    } catch {}
    return localBooking;
  }
}

export async function updateFixItBookingStatus(id, { status, lat, lng, note }) {
  try {
    return await request(`/fixit-bookings/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: { status, lat, lng, note },
    });
  } catch (err) {
    console.warn("updateFixItBookingStatus offline fallback:", err.message);
    const bookings = await fetchFixItBookings();
    const found = bookings.find((b) => b.id === id);
    if (found) {
      found.status = status;
      if (lat && lng) found.currentLocation = { lat: Number(lat), lng: Number(lng) };
      if (status === "On The Way") {
        found.etaMinutes = 6;
        found.distanceKm = 1.4;
      } else if (status === "Arrived") {
        found.etaMinutes = 0;
        found.distanceKm = 0;
      } else if (status === "Completed") {
        found.paymentStatus = "Paid";
      }
      const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      found.timeline.push({ status, time: timeNow, note: note || `Status updated to ${status}` });
      try {
        localStorage.setItem("tlms_fixit_bookings", JSON.stringify(bookings));
      } catch {}
      return found;
    }
    return { id, status };
  }
}

export async function submitFixItReview(id, { rating = 5, reviewText = "" }) {
  try {
    return await request(`/fixit-bookings/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: { rating, reviewText },
    });
  } catch (err) {
    console.warn("submitFixItReview offline fallback:", err.message);
    const booking = await fetchFixItBookingById(id);
    const propId = booking?.propertyId || "TN101";
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const historyEntry = {
      id: `MH_${propId}_${Date.now()}`,
      propertyId: propId,
      propertyName: booking?.propertyName || "Sai Kala Apartments - Flat 302",
      unit: booking?.unit || "Flat B-204",
      category: booking?.category || "AC Service",
      serviceTitle: booking?.serviceTitle || "AC Repair & Service",
      description: reviewText || booking?.issueDescription || "Service completed via FixIt Local",
      cost: Number(booking?.amount || 800),
      providerName: booking?.providerName || "Kumar AC Services",
      technicianName: booking?.technicianName || "Kumar S.",
      providerId: booking?.providerId || "PROV_AC_01",
      date: dateStr,
      status: "Completed",
      invoiceId: `INV-FIX-${Math.floor(1000 + Math.random() * 9000)}`,
      rating: Number(rating),
      bookingId: id,
    };
    await addPropertyMaintenanceHistory(propId, historyEntry);
    return { success: true, booking, historyEntry };
  }
}

// -------------------------------------------------------------
// Property Maintenance History Ledger (Exact Flat B-204 Ledger)
// -------------------------------------------------------------
export async function fetchPropertyMaintenanceHistory(propertyId = "TN101") {
  try {
    return await request(`/properties/${encodeURIComponent(propertyId)}/maintenance-history`);
  } catch (err) {
    console.warn("fetchPropertyMaintenanceHistory offline fallback:", err.message);
    const stored = localStorage.getItem(`tlms_maintenance_history_${propertyId}`);
    const records = stored ? JSON.parse(stored) : (INITIAL_MAINTENANCE_HISTORY.filter(m => m.propertyId === propertyId || propertyId === "TN101") || []);
    let totalSpend = 0;
    const categoryBreakdown = {};
    const providerStats = {};
    records.forEach(r => {
      const c = Number(r.cost || 0);
      totalSpend += c;
      const cat = r.category || "General";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + c;
      const prov = r.providerName || "Technician";
      providerStats[prov] = (providerStats[prov] || 0) + 1;
    });
    return {
      propertyId,
      totalSpendLast6Months: totalSpend,
      totalRecords: records.length,
      averageRating: 4.9,
      categoryBreakdown,
      providerStats,
      records,
    };
  }
}

export async function addPropertyMaintenanceHistory(propertyId = "TN101", entry) {
  try {
    return await request(`/properties/${encodeURIComponent(propertyId)}/maintenance-history`, {
      method: "POST",
      body: entry,
    });
  } catch (err) {
    console.warn("addPropertyMaintenanceHistory offline fallback:", err.message);
    const currentData = await fetchPropertyMaintenanceHistory(propertyId);
    const records = [entry, ...(currentData.records || [])];
    try {
      localStorage.setItem(`tlms_maintenance_history_${propertyId}`, JSON.stringify(records));
    } catch {}
    return entry;
  }
}

// =============================================================
// HOME SERVICES PORTAL CLIENT APIS
// =============================================================

// --- Service Categories ---
export async function fetchServiceCategories() {
  try {
    return await request("/service-categories");
  } catch (err) {
    console.warn("fetchServiceCategories fallback:", err.message);
    return [
      { id: "CAT_CLEAN", name: "Cleaning", slug: "cleaning", icon: "Sparkles", basePrice: 399, unit: "per room", services: ["Full Home Deep Cleaning", "Bathroom Deep Scrub & Sanitize", "Kitchen Degreasing & Chimney", "Sofa & Carpet Shampooing", "Balcony & Window Wash"], isActive: true },
      { id: "CAT_PLUMB", name: "Plumbing", slug: "plumbing", icon: "Droplets", basePrice: 350, unit: "per visit", services: ["Tap / Mixer Leakage Repair", "Concealed Pipe Inspection", "Flush Tank & Commode Fix", "Water Meter & Pump Setup", "Drain Unclogging & Trap Fix"], isActive: true },
      { id: "CAT_ELEC", name: "Electrical", slug: "electrical", icon: "Zap", basePrice: 399, unit: "per visit", services: ["MCB & Trip Diagnosis", "Switchboard & Socket Fix", "Ceiling Fan & Exhaust Setup", "Inverter & Battery Wiring", "LED Light Concealed Fitting"], isActive: true },
      { id: "CAT_CARP", name: "Carpentry", slug: "carpentry", icon: "Hammer", basePrice: 449, unit: "per service", services: ["Door Lock & Latch Replacement", "Hinges & Wardrobe Repair", "Furniture Assembly / Disassembly", "Wooden Window Latch & Mesh", "Custom Shelf & Bracket Fit"], isActive: true },
      { id: "CAT_AC", name: "AC Repair / Service", slug: "ac-repair", icon: "Wind", basePrice: 699, unit: "per unit", services: ["AC Jet Pump Wet Service", "Refrigerant Gas Top-Up", "PCB & Capacitor Diagnosis", "AC Installation / Uninstallation", "Drain Pipe Water Leakage Fix"], isActive: true },
      { id: "CAT_PAINT", name: "Painting", slug: "painting", icon: "Paintbrush", basePrice: 899, unit: "per room", services: ["Full Flat Repainting", "Single Wall Touch-up & Putty", "Waterproofing & Seepage Seal", "Texture & Accent Wall", "Door & Grill Enamel Paint"], isActive: true },
      { id: "CAT_PEST", name: "Pest Control", slug: "pest-control", icon: "Bug", basePrice: 599, unit: "per treatment", services: ["Cockroach Herbal Gel Treatment", "Termite Wood Drill & Chemical", "Bedbug Heat & Spray Treatment", "Mosquito & Drain Fumigation", "Rodent Baiting & Trapping"], isActive: true },
      { id: "CAT_APPL", name: "Appliance Repair", slug: "appliance-repair", icon: "Wrench", basePrice: 499, unit: "per diagnosis", services: ["Washing Machine Drum & Motor", "Refrigerator Cooling & Gas", "Microwave Magnetron Fix", "Water Purifier RO Candle & Membrane", "Geyser Element & Thermostat"], isActive: true },
    ];
  }
}

export async function createServiceCategory(categoryData) {
  return await request("/service-categories", {
    method: "POST",
    body: categoryData,
  });
}

export async function updateServiceCategory(id, categoryData) {
  return await request(`/service-categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: categoryData,
  });
}

export async function deleteServiceCategory(id) {
  return await request(`/service-categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// --- Service Providers & Dynamic Availability ---
export async function fetchServiceProviders(category = "All", search = "", status = "All") {
  try {
    const params = new URLSearchParams();
    if (category && category !== "All") params.append("category", category);
    if (search) params.append("search", search);
    if (status && status !== "All") params.append("status", status);

    const query = params.toString() ? `?${params.toString()}` : "";
    return await request(`/service-providers${query}`);
  } catch (err) {
    console.warn("fetchServiceProviders fallback:", err.message);
    return [];
  }
}

export async function fetchProviderAvailability(category, date, timeSlot) {
  try {
    const params = new URLSearchParams();
    if (category && category !== "All") params.append("category", category);
    if (date) params.append("date", date);
    if (timeSlot) params.append("timeSlot", timeSlot);

    return await request(`/service-providers/availability?${params.toString()}`);
  } catch (err) {
    console.warn("fetchProviderAvailability error:", err.message);
    return {
      category: category || "All",
      date: date || "",
      timeSlot: timeSlot || "",
      providers: [],
      totalAvailable: 0,
      totalBooked: 0,
    };
  }
}

export async function fetchServiceProviderById(id) {
  return await request(`/service-providers/${encodeURIComponent(id)}`);
}

export async function createServiceProvider(providerData) {
  return await request("/service-providers", {
    method: "POST",
    body: providerData,
  });
}

export async function updateServiceProvider(id, providerData) {
  return await request(`/service-providers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: providerData,
  });
}

export async function updateServiceProviderStatus(id, status) {
  return await request(`/service-providers/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function deleteServiceProvider(id) {
  return await request(`/service-providers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// --- Provider Availability Overrides & Leave Schedules ---
export async function fetchProviderAvailabilityOverrides(providerId, date) {
  try {
    const params = new URLSearchParams();
    if (providerId) params.append("providerId", providerId);
    if (date) params.append("date", date);
    return await request(`/provider-availability${params.toString() ? `?${params.toString()}` : ""}`);
  } catch (err) {
    return [];
  }
}

export async function setProviderAvailabilityOverride(payload) {
  return await request("/provider-availability", {
    method: "POST",
    body: payload,
  });
}

export async function removeProviderAvailabilityOverride(id) {
  return await request(`/provider-availability/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// --- Home Service Bookings (Double Booking Prevention & Lifecycle) ---
export async function fetchServiceBookings(filter = {}) {
  try {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, val);
      }
    });
    const query = params.toString() ? `?${params.toString()}` : "";
    return await request(`/service-bookings${query}`);
  } catch (err) {
    console.warn("fetchServiceBookings error:", err.message);
    return [];
  }
}

export async function fetchServiceBookingById(id) {
  return await request(`/service-bookings/${encodeURIComponent(id)}`);
}

export async function createServiceBooking(bookingData) {
  return await request("/service-bookings", {
    method: "POST",
    body: bookingData,
  });
}

export async function updateServiceBookingStatus(id, { status, note, technicianName, technicianPhone }) {
  return await request(`/service-bookings/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: { status, note, technicianName, technicianPhone },
  });
}

export async function cancelServiceBooking(id, reason) {
  return await request(`/service-bookings/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

// -------------------------------------------------------------
// Reminders Center API
// -------------------------------------------------------------
export async function fetchRemindersSummary(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString();
    const query = qs ? `?${qs}` : "";
    return await request(`/reminders/summary${query}`);
  } catch (err) {
    console.warn("fetchRemindersSummary error:", err.message);
    return null;
  }
}

export async function sendAllReminders(landlordId = "LDL001") {
  try {
    return await request("/reminders/send-all", {
      method: "POST",
      body: { landlordId },
    });
  } catch (err) {
    console.warn("sendAllReminders error:", err.message);
    return null;
  }
}



