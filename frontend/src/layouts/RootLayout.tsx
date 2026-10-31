import { Activity } from "lucide-react";
import { Outlet } from "react-router-dom";

import { useAppContext } from "../context/AppContext";

export function RootLayout() {
  const { appName } = useAppContext();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Activity className="h-5 w-5 text-slate-800" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold tracking-tight">{appName}</p>
            <p className="text-xs text-slate-500">Foundation workspace</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
