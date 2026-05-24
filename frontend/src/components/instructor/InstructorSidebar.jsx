import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LuHouse,
  LuBookOpen,
  LuChartLine,
  LuSettings,
  LuLogOut,
  LuPanelLeftClose,
  LuPanelLeft,
} from "react-icons/lu";
import { getDefaultAvatarDataUrl, resolveInstructorAvatar } from "../../utils/instructorProfile";
import SafeAvatarImage from "../common/SafeAvatarImage";

const menuItems = [
  { name: "Dashboard", path: "/instructor-dashboard", icon: LuHouse },
  { name: "Courses", path: "/instructor-dashboard/courses", icon: LuBookOpen },
  { name: "Analytics", path: "/instructor-dashboard/analytics", icon: LuChartLine },
  { name: "Settings", path: "/instructor-dashboard/settings", icon: LuSettings },
];

const isActiveRoute = (pathname, path) => {
  if (path === "/instructor-dashboard") {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
};

const InstructorSidebar = ({
  profile = {},
  mobile = false,
  onCloseMobile,
  onNavigate,
  forceExpanded = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const expanded = forceExpanded || (!mobile && isOpen);
  const fallbackAvatar = getDefaultAvatarDataUrl(profile);
  const resolvedAvatar = resolveInstructorAvatar(profile) || fallbackAvatar;

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleNavClick = () => {
    onNavigate?.();
    onCloseMobile?.();
  };

  return (
    <aside
      className={`flex h-full min-h-screen flex-col justify-between border-r border-emerald-100 bg-white px-3 py-4 shadow-sm transition-all duration-300 ${
        mobile ? "w-[min(84vw,20rem)]" : expanded ? "w-64" : "w-[84px]"
      }`}
    >
      <div>
        <div className="mb-6 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 to-lime-50 p-3">
          {expanded ? (
            <div className="flex items-center gap-3">
              <SafeAvatarImage
                src={resolvedAvatar}
                fallbackSrc={fallbackAvatar}
                alt="Instructor avatar"
                className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-200"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">LMS</p>
                <h2 className="text-sm font-bold text-emerald-900">Instructor Portal</h2>
              </div>
            </div>
          ) : (
            <SafeAvatarImage
              src={resolvedAvatar}
              fallbackSrc={fallbackAvatar}
              alt="Instructor avatar"
              className="mx-auto h-8 w-8 rounded-full object-cover ring-2 ring-emerald-200"
            />
          )}

          {expanded && !mobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-emerald-700 transition hover:bg-emerald-100"
              aria-label="Collapse sidebar"
            >
              <LuPanelLeftClose className="h-5 w-5" />
            </button>
          )}
        </div>

        {!expanded && !mobile && (
          <button
            onClick={() => setIsOpen(true)}
            className="mx-auto mb-6 flex rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-100"
            aria-label="Expand sidebar"
          >
            <LuPanelLeft className="h-5 w-5" />
          </button>
        )}

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(location.pathname, item.path);

            return (
              <Link
                to={item.path}
                key={item.path}
                onClick={handleNavClick}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-900 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {expanded && <span>{item.name}</span>}
                </span>

              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <LuLogOut className="h-5 w-5" />
        {expanded && <span>Logout</span>}
      </button>
    </aside>
  );
};

export default InstructorSidebar;
