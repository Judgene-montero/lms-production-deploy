import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuChevronDown, LuSettings, LuUser, LuLogOut } from "react-icons/lu";
import { getDefaultAvatarDataUrl, resolveInstructorAvatar } from "../../utils/instructorProfile";

const InstructorProfileDropdown = ({ profile = {}, className = "" }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = profile?.full_name || profile?.username || "Instructor";
  const displayEmail = profile?.email || "instructor@example.com";
  const avatar = resolveInstructorAvatar(profile);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-left shadow-sm transition hover:border-emerald-300 hover:shadow"
      >
        <img src={avatar || getDefaultAvatarDataUrl(profile)} alt={displayName} className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-100" />

        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-emerald-900">{displayName}</p>
          <p className="text-xs text-gray-500">{displayEmail}</p>
        </div>

        <LuChevronDown className={`h-4 w-4 text-gray-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-xl border border-emerald-100 bg-white p-2 shadow-lg transition-all duration-200 ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
        }`}
      >
          <div className="mb-2 rounded-lg bg-gradient-to-r from-emerald-50 to-lime-50 p-3">
            <p className="text-sm font-semibold text-emerald-900">{displayName}</p>
            <p className="text-xs text-gray-600">{displayEmail}</p>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/instructor-dashboard/profile");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-emerald-50"
          >
            <LuUser className="h-4 w-4" />
            My Profile
          </button>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/instructor-dashboard/settings");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-emerald-50"
          >
            <LuSettings className="h-4 w-4" />
            Settings
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            <LuLogOut className="h-4 w-4" />
            Logout
          </button>
      </div>
    </div>
  );
};

export default InstructorProfileDropdown;
