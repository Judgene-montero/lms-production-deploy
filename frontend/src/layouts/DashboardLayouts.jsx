import React from "react";
import { Outlet } from "react-router-dom";

const DashboardLayouts = ({ sidebar, right }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* LEFT SIDEBAR */}
      <div className="shrink-0 transition-all duration-300">
        {sidebar}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto bg-gradient-to-b from-white to-emerald-50/40 p-4 transition-all duration-300 md:p-6">
        <Outlet />
      </div>

      {/* RIGHT SIDEBAR */}
      {right && (
        <div className="
          hidden lg:flex
          w-72 border-l border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur-md
          flex-col
        ">
          {right}
        </div>
      )}

    </div>
  );
};

export default DashboardLayouts;
