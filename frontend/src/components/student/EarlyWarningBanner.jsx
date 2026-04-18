import React from "react";
import { normalizeRiskLevel } from "./CourseRiskIndicator";

export default function EarlyWarningBanner({ level = "low", courseName = "", message = "" }) {
  const risk = normalizeRiskLevel(level);
  if (risk !== "high") return null;

  return (
    <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Academic Warning</p>
      <p className="mt-1 text-sm text-red-700">
        Our system detected that you may be at risk{courseName ? ` in ${courseName}` : ""}.
      </p>
      {message ? <p className="mt-1 text-sm text-red-700">{message}</p> : null}
    </section>
  );
}
