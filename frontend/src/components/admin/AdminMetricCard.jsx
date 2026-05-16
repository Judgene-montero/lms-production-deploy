import React from "react";

export default function AdminMetricCard({ title, value, subtitle, accent = "blue", children }) {
  const accentClasses = {
    blue: "from-blue-600 to-cyan-500",
    emerald: "from-emerald-600 to-lime-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-600 to-pink-500",
    slate: "from-slate-700 to-slate-500",
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1.5 bg-gradient-to-r ${accentClasses[accent] || accentClasses.blue}`} />
      <div className="space-y-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
