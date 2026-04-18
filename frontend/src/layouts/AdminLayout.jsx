import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
        >
          <Menu size={18} /> Menu
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-57px)] lg:min-h-screen">
        <div className="hidden lg:block">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} onCloseMobile={() => {}} />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="h-full">
              <AdminSidebar
                collapsed={false}
                onToggle={() => {}}
                onCloseMobile={() => setMobileOpen(false)}
              />
            </div>
            <button
              type="button"
              className="flex-1 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            />
          </div>
        )}

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
