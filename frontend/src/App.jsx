import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardLayout from "./components/DashboardLayout.jsx";
import Login from "./pages/Login.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import LandlordsPage from "./pages/admin/LandlordsPage.jsx";
import TenantsPage from "./pages/admin/TenantsPage.jsx";
import LandlordOverview from "./pages/landlord/LandlordOverview.jsx";
import TenantOverview from "./pages/tenant/TenantOverview.jsx";
import MyLeasePage from "./pages/tenant/MyLeasePage.jsx";
import MyPaymentsPage from "./pages/tenant/MyPaymentsPage.jsx";
import MyMaintenancePage from "./pages/tenant/MyMaintenancePage.jsx";
import MyDocumentsPage from "./pages/tenant/MyDocumentsPage.jsx";
import MyComplaintsPage from "./pages/tenant/MyComplaintsPage.jsx";
import PropertiesPage from "./pages/shared/PropertiesPage.jsx";
import PropertyDetailsPage from "./pages/shared/PropertyDetailsPage.jsx";
import LeasesPage from "./pages/shared/LeasesPage.jsx";
import PaymentsPage from "./pages/shared/PaymentsPage.jsx";
import MaintenancePage from "./pages/shared/MaintenancePage.jsx";
import DepositsPage from "./pages/shared/DepositsPage.jsx";
import UtilityBillsPage from "./pages/shared/UtilityBillsPage.jsx";
import ExpensesPage from "./pages/shared/ExpensesPage.jsx";
import DocumentsPage from "./pages/shared/DocumentsPage.jsx";
import ComplaintsPage from "./pages/shared/ComplaintsPage.jsx";
import ProfilePage from "./pages/shared/ProfilePage.jsx";
import SettingsPage from "./pages/shared/SettingsPage.jsx";
import AnalyticsPage from "./pages/shared/AnalyticsPage.jsx";
import ServicesPage from "./pages/shared/ServicesPage.jsx";
import HomeServicesPortal from "./pages/shared/HomeServicesPortal.jsx";
import ServiceBookingsPage from "./pages/shared/ServiceBookingsPage.jsx";
import ServiceCategoriesPage from "./pages/admin/ServiceCategoriesPage.jsx";
import ServiceProvidersPage from "./pages/admin/ServiceProvidersPage.jsx";
import AvailabilityManagementPage from "./pages/admin/AvailabilityManagementPage.jsx";
import TenantEbBillsPage from "./pages/tenant/TenantEbBillsPage.jsx";
import LandlordEbBillsPage from "./pages/landlord/LandlordEbBillsPage.jsx";
import ServicesAndComplaintsHub from "./pages/shared/ServicesAndComplaintsHub.jsx";
import ProviderOverview from "./pages/provider/ProviderOverview.jsx";
import AgreementPage from "./pages/shared/AgreementPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ErrorBoundary>
          <BrowserRouter>
            {/* Suspense is required because LandlordOverview uses the
                `use` hook, which suspends until its data promise resolves. */}
            <Suspense fallback={<p className="loading">Loading…</p>}>
              <Routes>
                <Route path="/login" element={<Login />} />

                {/* ---------------- Admin ---------------- */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminOverview />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="landlords" element={<LandlordsPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="properties" element={<PropertiesPage />} />
                  <Route path="properties/:id" element={<PropertyDetailsPage />} />
                  <Route path="leases" element={<LeasesPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="maintenance" element={<MaintenancePage />} />
                  <Route path="home-services" element={<HomeServicesPortal />} />
                  <Route path="service-categories" element={<ServiceCategoriesPage />} />
                  <Route path="service-providers" element={<ServiceProvidersPage />} />
                  <Route path="service-bookings" element={<ServiceBookingsPage />} />
                  <Route path="availability-management" element={<AvailabilityManagementPage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="deposits" element={<DepositsPage />} />
                  <Route path="eb-bills" element={<LandlordEbBillsPage />} />
                  <Route path="utility-bills" element={<UtilityBillsPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="complaints" element={<ComplaintsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="agreement" element={<AgreementPage />} />
                  <Route path="services-complaints" element={<ServicesAndComplaintsHub />} />
                </Route>

                {/* ---------------- Landlord ---------------- */}
                <Route
                  path="/landlord"
                  element={
                    <ProtectedRoute allowedRoles={["landlord"]}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<LandlordOverview />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="properties" element={<PropertiesPage />} />
                  <Route path="properties/:id" element={<PropertyDetailsPage />} />
                  <Route path="leases" element={<LeasesPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="eb-bills" element={<LandlordEbBillsPage />} />
                  <Route path="maintenance" element={<MaintenancePage />} />
                  <Route path="home-services" element={<HomeServicesPortal />} />
                  <Route path="bookings" element={<ServiceBookingsPage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="deposits" element={<DepositsPage />} />
                  <Route path="utility-bills" element={<UtilityBillsPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="complaints" element={<ComplaintsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="agreement" element={<AgreementPage />} />
                  <Route path="services-complaints" element={<ServicesAndComplaintsHub />} />
                </Route>

                {/* ---------------- Tenant ---------------- */}
                <Route
                  path="/tenant"
                  element={
                    <ProtectedRoute allowedRoles={["tenant"]}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<TenantOverview />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="properties" element={<PropertiesPage />} />
                  <Route path="properties/:id" element={<PropertyDetailsPage />} />
                  <Route path="lease" element={<MyLeasePage />} />
                  <Route path="payments" element={<MyPaymentsPage />} />
                  <Route path="eb-bills" element={<TenantEbBillsPage />} />
                  <Route path="maintenance" element={<MyMaintenancePage />} />
                  <Route path="home-services" element={<HomeServicesPortal />} />
                  <Route path="my-bookings" element={<ServiceBookingsPage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="documents" element={<MyDocumentsPage />} />
                  <Route path="complaints" element={<MyComplaintsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="agreement" element={<AgreementPage />} />
                  <Route path="services-complaints" element={<ServicesAndComplaintsHub />} />
                </Route>

                {/* ---------------- Provider ---------------- */}
                <Route
                  path="/provider"
                  element={
                    <ProtectedRoute allowedRoles={["provider"]}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ProviderOverview />} />
                  <Route path="bookings" element={<ProviderOverview />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </SettingsProvider>
    </AuthProvider>
  );
}
