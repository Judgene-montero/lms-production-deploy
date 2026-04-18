import React from "react";

const RISK_META = {
  low: { label: "Low Risk", dot: "bg-green-500", tone: "text-green-700 bg-green-50 border-green-200" },
  medium: { label: "Medium Risk", dot: "bg-orange-500", tone: "text-orange-700 bg-orange-50 border-orange-200" },
  high: { label: "High Risk", dot: "bg-red-500", tone: "text-red-700 bg-red-50 border-red-200" },
};

export const normalizeRiskLevel = (value) => {
  const key = String(value || "low").toLowerCase();
  return RISK_META[key] ? key : "low";
};

export default function CourseRiskIndicator({ level = "low", compact = false }) {
  const riskKey = normalizeRiskLevel(level);
  const meta = RISK_META[riskKey];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${meta.tone}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </div>
  );
}
