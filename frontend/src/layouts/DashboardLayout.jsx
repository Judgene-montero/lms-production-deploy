import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, UploadCloud, LayoutDashboard, SunMoon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { dark, setDark } = useTheme();
  const [open, setOpen] = useState(true); // small-screen toggle

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const menu = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/upload-ids", label: "Upload Approved IDs", icon: UploadCloud },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 border-r dark:border-gray-700 ${open ? "w-64" : "w-16"} transition-all`}>
        <div className="px-4 py-5 flex items-center justify-between border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">{open ? "Admin Panel" : "AP"}</span>
          </div>
          <button onClick={() => setOpen((s)=>!s)} className="text-gray-500 dark:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {menu.map((m) => {
            const Icon = m.icon;
            return (
              <NavLink key={m.to} to={m.to} className={({isActive}) => `flex items-center gap-3 p-2 rounded-lg ${isActive? "bg-gray-100 dark:bg-gray-700 font-semibold" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                <Icon className="w-5 h-5 text-gray-600 dark:text-gray-200" />
                {open && <span className="text-sm text-gray-800 dark:text-gray-100">{m.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto p-3 border-t dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
              <SunMoon className="w-4 h-4" />
              {open && <span className="text-sm">Toggle Theme</span>}
            </button>
          </div>
          <button onClick={handleLogout} className="mt-3 w-full text-left p-2 text-red-600 hover:bg-red-50 rounded">
            <LogOut className="inline w-4 h-4 mr-2" /> {open && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
