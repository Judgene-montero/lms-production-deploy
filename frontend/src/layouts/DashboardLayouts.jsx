import React, { cloneElement, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";

const DashboardLayouts = ({ sidebar, right }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", mobileSidebarOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [mobileSidebarOpen]);

  const desktopSidebar = React.isValidElement(sidebar)
    ? cloneElement(sidebar, {
        mobile: false,
        onNavigate: () => setMobileSidebarOpen(false),
      })
    : sidebar;

  const mobileSidebar = React.isValidElement(sidebar)
    ? cloneElement(sidebar, {
        mobile: true,
        onCloseMobile: () => setMobileSidebarOpen(false),
        onNavigate: () => setMobileSidebarOpen(false),
        forceExpanded: true,
      })
    : sidebar;

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-61px)] bg-white md:min-h-screen">
        <div className="hidden shrink-0 md:block">{desktopSidebar}</div>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="h-full max-w-[85vw]">{mobileSidebar}</div>
            <button
              type="button"
              className="flex-1 bg-slate-950/45"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation"
            />
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-3 rounded-full bg-white p-2 text-slate-700 shadow"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <main className="min-w-0 flex-1 overflow-x-hidden bg-gradient-to-b from-white to-emerald-50/40 p-3 transition-all duration-300 sm:p-4 md:p-6">
            <Outlet />
          </main>

          {right ? (
            <>
              <div className="border-t border-emerald-100 bg-white/90 p-3 shadow-sm backdrop-blur-md lg:hidden">
                {right}
              </div>
              <div className="hidden w-72 shrink-0 border-l border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur-md lg:flex lg:flex-col">
                {right}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayouts;
