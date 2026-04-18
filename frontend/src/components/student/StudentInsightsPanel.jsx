import React from "react";
import CourseProgressBar from "./CourseProgressBar";

const toneClasses = {
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function StudentInsightsPanel({
  quizAverage = 0,
  assignmentCompletion = 0,
  engagementScore = 0,
  missingSubmissions = 0,
  warnings = [],
}) {
  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-emerald-950">Performance Snapshot</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Assessment Average</p>
          <p className="text-lg font-semibold text-gray-900">{Number(quizAverage).toFixed(0)}%</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Completed Activities</p>
          <p className="text-lg font-semibold text-gray-900">{Number(assignmentCompletion).toFixed(0)}%</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
          <p className="text-xs text-gray-500">Learning Progress</p>
          <CourseProgressBar value={engagementScore} showLabel={false} className="mt-2" barClassName="bg-emerald-500" />
        </div>
      </div>

      {missingSubmissions > 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          Missing submissions: <span className="font-semibold text-gray-900">{missingSubmissions}</span>
        </p>
      ) : null}
      {warnings.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          {warnings.map((warning) => (
            <article
              key={warning.key}
              className={`rounded-lg border p-3 ${toneClasses[warning.tone] || toneClasses.slate}`}
            >
              <p className="text-sm font-semibold">{warning.title}</p>
              <p className="mt-1 text-sm">{warning.message}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
