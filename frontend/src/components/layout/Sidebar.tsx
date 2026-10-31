import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Layers3,
  LogOut,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const studentNav: NavItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/complaints/new", label: "Submit complaint", icon: FileText },
  { to: "/student/complaints", label: "Complaint history", icon: ClipboardList },
  { to: "/student/tracking", label: "Status tracking", icon: History },
  { to: "/student/profile", label: "Profile", icon: UserRound },
];

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/complaints", label: "All complaints", icon: ClipboardList },
  { to: "/admin/priority", label: "Priority management", icon: AlertTriangle },
  { to: "/admin/duplicates", label: "Duplicate groups", icon: Layers3 },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/departments", label: "Departments", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit", label: "Audit logs", icon: Shield },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const isAdminOrStaff = user?.role === "admin" || user?.role === "staff";
  const items = isAdminOrStaff
    ? user?.role === "staff"
      ? adminNav.filter((item) => item.to !== "/admin/users" && item.to !== "/admin/audit")
      : adminNav
    : studentNav;

  const roleLabel =
    user?.role === "admin"
      ? "Admin portal"
      : user?.role === "staff"
      ? "Staff Operations"
      : user?.role === "faculty"
      ? "Faculty portal"
      : "Student portal";

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy-900 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Campus Signal</p>
              <p className="text-xs text-blue-200">{roleLabel}</p>
            </div>
          </div>
          <button type="button" className="lg:hidden p-2 rounded-lg text-blue-200 hover:text-white" onClick={onClose} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/student" || item.to === "/admin"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-blue-100 hover:bg-white/5"
                }`
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-blue-200">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-3 w-full justify-start text-blue-100 hover:bg-white/10 hover:text-white min-h-[44px]"
            icon={<LogOut className="h-4 w-4" />}
            onClick={logout}
          >
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
