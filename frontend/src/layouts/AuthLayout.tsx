import { Activity } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-900 p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-5 w-5 text-blue-300" aria-hidden="true" />
          Campus Signal Intelligence
        </Link>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">Campus operations, clearly routed.</h1>
          <p className="text-sm leading-6 text-blue-100">
            Students submit and track issues. Administrators triage priority, duplicates, and
            department workload from one workspace.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
