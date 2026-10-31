import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppProvider } from "./context/AppContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CampusStoreProvider } from "./context/CampusStore";

import { AuthLayout } from "./layouts/AuthLayout";
import { PortalLayout } from "./layouts/PortalLayout";
import { RootLayout } from "./layouts/RootLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";

import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";

import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";

import { StudentDashboard } from "./pages/student/StudentDashboard";
import { SubmitComplaintPage } from "./pages/student/SubmitComplaintPage";
import { ComplaintHistoryPage } from "./pages/student/ComplaintHistoryPage";
import { StatusTrackingPage } from "./pages/student/StatusTrackingPage";
import { ProfilePage } from "./pages/student/ProfilePage";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AllComplaintsPage } from "./pages/admin/AllComplaintsPage";
import { PriorityManagementPage } from "./pages/admin/PriorityManagementPage";
import { DuplicateGroupsPage } from "./pages/admin/DuplicateGroupsPage";
import { DepartmentManagementPage } from "./pages/admin/DepartmentManagementPage";
import { AnalyticsPage } from "./pages/admin/AnalyticsPage";
import { AuditLogsPage } from "./pages/admin/AuditLogsPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";
import { SettingsPage } from "./pages/admin/SettingsPage";

import { ComplaintDetailsPage } from "./pages/complaints/ComplaintDetailsPage";

function ComplaintDetailsRedirect() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/complaints/${id}` }} />;
  }

  const isAdminOrStaff = user.role === "admin" || user.role === "staff";
  return (
    <Navigate
      to={isAdminOrStaff ? `/admin/complaints/${id}` : `/student/complaints/${id}`}
      replace
    />
  );
}

export default function App() {
  return (
    <AppProvider>
      <CampusStoreProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />

              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Student Portal Routes */}
              <Route element={<ProtectedRoute role="student" />}>
                <Route element={<PortalLayout />}>
                  <Route path="/student" element={<StudentDashboard />} />
                  <Route path="/student/complaints" element={<ComplaintHistoryPage />} />
                  <Route path="/student/complaints/new" element={<SubmitComplaintPage />} />
                  <Route path="/student/complaints/:id" element={<ComplaintDetailsPage />} />
                  <Route path="/student/tracking" element={<StatusTrackingPage />} />
                  <Route path="/student/profile" element={<ProfilePage />} />
                </Route>
              </Route>

              {/* Admin Portal Routes */}
              <Route element={<ProtectedRoute role="admin" />}>
                <Route element={<PortalLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/complaints" element={<AllComplaintsPage />} />
                  <Route path="/admin/complaints/:id" element={<ComplaintDetailsPage />} />
                  <Route path="/admin/priority" element={<PriorityManagementPage />} />
                  <Route path="/admin/duplicates" element={<DuplicateGroupsPage />} />
                  <Route path="/admin/departments" element={<DepartmentManagementPage />} />
                  <Route path="/admin/analytics" element={<AnalyticsPage />} />
                  <Route path="/admin/audit" element={<AuditLogsPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Common Routes */}
              <Route path="/complaints/:id" element={<ComplaintDetailsRedirect />} />

              {/* Foundation / Diagnostic & Fallback */}
              <Route element={<RootLayout />}>
                <Route path="/foundation" element={<HomePage />} />
                <Route path="/health" element={<HomePage />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </CampusStoreProvider>
    </AppProvider>
  );
}
