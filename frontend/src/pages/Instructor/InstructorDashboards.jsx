import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import DashboardLayouts from "../../layouts/DashboardLayouts";
import InstructorSidebar from "../../components/instructor/InstructorSidebar";
import InstructorProfileDropdown from "../../components/instructor/InstructorProfileDropdown";
import { LuPanelTop, LuSparkles, LuCalendarClock } from "react-icons/lu";
import {
  loadInstructorProfile,
  readCachedInstructorProfile,
  subscribeInstructorProfile,
} from "../../utils/instructorProfile";

const InstructorDashboard = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const cached = readCachedInstructorProfile();
    if (cached) setProfile(cached);

    const fetchData = async () => {
      try {
        const userData = await loadInstructorProfile().catch(() => null);
        setProfile(userData);
      } catch (err) {
        console.error("Instructor layout fetch error:", err);
      }
    };

    fetchData();
    const unsubscribe = subscribeInstructorProfile((nextProfile) => setProfile(nextProfile));
    return unsubscribe;
  }, []);

  const rightSidebar = (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-lime-50 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Account</p>
        <div className="mt-3">
          <InstructorProfileDropdown profile={profile || {}} className="w-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-emerald-900">Instructor Shortcuts</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <LuPanelTop className="h-4 w-4 text-emerald-700" />
            Review dashboard KPIs
          </li>
          <li className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <LuSparkles className="h-4 w-4 text-emerald-700" />
            Open AI analytics insights
          </li>
          <li className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <LuCalendarClock className="h-4 w-4 text-emerald-700" />
            Check today&apos;s activity
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <DashboardLayouts sidebar={<InstructorSidebar profile={profile || {}} />} right={rightSidebar}>
      <Outlet />
    </DashboardLayouts>
  );
};

export default InstructorDashboard;
