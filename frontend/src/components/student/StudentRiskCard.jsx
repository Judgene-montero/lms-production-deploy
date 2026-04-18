import React from "react";
import CourseRiskIndicator, { normalizeRiskLevel } from "./CourseRiskIndicator";

const DEFAULT_ACTIONS = [
  "Review your latest lesson materials.",
  "Complete pending classwork this week.",
  "Reach out to your instructor for support.",
];

export default function StudentRiskCard({
  title = "Academic Health Status",
  riskLevel = "low",
  confidenceScore = 0,
  insight = "",
  actions = [],
}) {
  const normalized = normalizeRiskLevel(riskLevel);
  const safeConfidence = Math.max(0, Math.min(100, Number(confidenceScore) || 0));
  const recommendations = Array.isArray(actions) && actions.length > 0 ? actions : DEFAULT_ACTIONS;

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <CourseRiskIndicator level={normalized} />
        <p className="text-sm font-medium text-gray-700">Confidence Score: {safeConfidence.toFixed(0)}%</p>
      </div>
      {insight ? <p className="mt-3 text-sm text-gray-700">{insight}</p> : null}
      <div className="mt-3 space-y-1">
        {recommendations.map((action, index) => (
          <p key={`${action}-${index}`} className="text-sm text-gray-700">
            - {action}
          </p>
        ))}
      </div>
    </section>
  );
}
