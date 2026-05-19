import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Brain,
  Activity,
  Settings,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
  BookOpen,
} from "lucide-react";

const sections = [
  {
    title: "Dashboard",
    items: [{ name: "Overview", path: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Control",
    items: [
      { name: "All Users", path: "/admin/users", icon: Users },
      { name: "Courses", path: "/admin/courses", icon: BookOpen },
      { name: "Pending Instructor Approvals", path: "/admin/instructor-approvals", icon: UserCheck },
    ],
  },
  {
    title: "Analytics",
    items: [{ name: "AI Analytics", path: "/admin/analytics", icon: Brain }, { name: "System Progress", path: "/admin/analytics", icon: Activity }],
  },
  {
    title: "System",
    items: [
      { name: "Categories", path: "/admin/categories", icon: Tags },
      { name: "Settings", path: "/admin/settings", icon: Settings },
      { name: "Logs", path: "/admin/logs", icon: FileText },
    ],
  },
];

export default function AdminSidebar({ collapsed, onToggle, onCloseMobile, mobile = false }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <aside
      className={`flex h-full min-h-screen flex-col border-r border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${
        mobile ? "w-[min(86vw,20rem)]" : collapsed ? "w-20" : "w-72"
      } transition-all duration-200`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-600 p-2 text-white">A</div>
          {(!collapsed || mobile) && <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Admin Console</span>}
        </div>
        {!mobile ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.title}>
            {(!collapsed || mobile) && <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{section.title}</p>}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={`${section.title}-${item.path}-${item.name}`}
                    to={item.path}
                    end={item.path === "/admin"}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`
                    }
                    >
                      <Icon size={18} />
                    {(!collapsed || mobile) && <span>{item.name}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-gray-800">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut size={18} />
          {(!collapsed || mobile) && "Logout"}
        </button>
      </div>
    </aside>
  );
}
