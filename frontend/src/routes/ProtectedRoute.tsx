import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/domain";

export function ProtectedRoute({
  role,
  allowedRoles,
}: {
  role?: UserRole;
  allowedRoles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Verifying session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const effectiveAllowed: UserRole[] = allowedRoles ?? (
    role === "admin"
      ? ["admin", "staff"]
      : role === "student"
      ? ["student", "faculty"]
      : role
      ? [role]
      : ["student", "faculty", "staff", "admin"]
  );

  if (!effectiveAllowed.includes(user.role)) {
    const fallbackPath =
      user.role === "admin" || user.role === "staff" ? "/admin" : "/student";
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
