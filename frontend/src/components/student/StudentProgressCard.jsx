import React from "react";

export default function StudentProgressCard({
  title,
  value,
  subtitle,
  icon,
  accent = "emerald",
}) {
  const accentClass =
    accent === "orange"
      ? "bg-orange-100 text-orange-700"
      : accent === "red"
      ? "bg-red-100 text-red-700"
      : accent === "blue"
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        {icon && <span className={`rounded-lg p-2 ${accentClass}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-emerald-950">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
    </article>
  );
}
