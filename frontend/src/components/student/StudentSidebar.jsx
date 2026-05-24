import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LuHouse,
  LuBookOpen,
  LuUser,
  LuSettings,
  LuLogOut,
  LuPanelLeftClose,
  LuPanelLeft,
} from "react-icons/lu";
import {
  getDefaultStudentAvatarDataUrl,
  loadStudentProfile,
  readCachedStudentProfile,
  resolveStudentAvatar,
  subscribeStudentProfile,
} from "../../utils/studentProfile";
import SafeAvatarImage from "../common/SafeAvatarImage";

export default function StudentSidebar({
  mobile = false,
  onCloseMobile,
  onNavigate,
  forceExpanded = false,
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [profile, setProfile] = useState(() => readCachedStudentProfile());

  useEffect(() => {
    loadStudentProfile().then(setProfile).catch(() => null);
    const unsubscribe = subscribeStudentProfile((nextProfile) => setProfile(nextProfile));
    return unsubscribe;
  }, []);

  const links = useMemo(
    () => [
      {
        name: "Dashboard",
        path: "/student/dashboard/home",
        icon: <LuHouse className="h-5 w-5" />,
      },
      {
        name: "My Courses",
        path: "/student/dashboard/my-courses",
        icon: <LuBookOpen className="h-5 w-5" />,
      },
      {
        name: "Profile",
        path: "/student/dashboard/profile",
        icon: <LuUser className="h-5 w-5" />,
      },
      {
        name: "Settings",
        path: "/student/dashboard/settings",
        icon: <LuSettings className="h-5 w-5" />,
      },
    ],
    []
  );

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const displayName = profile?.name || profile?.full_name || profile?.username || "Student";
  const expanded = forceExpanded || (!mobile && isOpen);
  const fallbackAvatar = getDefaultStudentAvatarDataUrl(profile || {});
  const resolvedAvatar = resolveStudentAvatar(profile) || fallbackAvatar;

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
        <div className="mb-5 rounded-xl bg-gradient-to-r from-emerald-50 to-lime-50 p-3">
          <div className="flex items-center justify-between gap-2">
            {expanded ? (
              <div className="flex items-center gap-3">
                <SafeAvatarImage
                  src={resolvedAvatar}
                  fallbackSrc={fallbackAvatar}
                  alt="Student avatar"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-200"
                />
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-700">Student</p>
                  <p className="text-sm font-semibold text-emerald-900">{displayName}</p>
                </div>
              </div>
            ) : (
              <SafeAvatarImage
                src={resolvedAvatar}
                fallbackSrc={fallbackAvatar}
                alt="Student avatar"
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
        </div>

        {!expanded && !mobile && (
          <button
            onClick={() => setIsOpen(true)}
            className="mx-auto mb-5 flex rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-100"
            aria-label="Expand sidebar"
          >
            <LuPanelLeft className="h-5 w-5" />
          </button>
        )}

        <nav className="space-y-2">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-900 hover:bg-emerald-50 hover:text-emerald-700"
                }`
              }
            >
              {link.icon}
              {expanded && <span>{link.name}</span>}
            </NavLink>
          ))}
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
}
