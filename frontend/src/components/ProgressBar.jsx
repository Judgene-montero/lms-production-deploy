import React from "react";

export default function ProgressBar({
  progress = null,
  value = 0,
  completedLessons = 0,
  totalLessons = 0,
}) {
  const rawPercentage =
    progress?.percentage ?? progress?.progress ?? value ?? 0;
  const safeValue = Number.isFinite(Number(rawPercentage))
    ? Math.max(0, Math.min(100, Number(rawPercentage)))
    : 0;
  const completed = Number(
    progress?.completed_lessons ?? completedLessons ?? 0
  );
  const total = Number(progress?.total_lessons ?? totalLessons ?? 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-green-900">Course Progress</h3>
        <span className="text-sm font-semibold text-green-800">{Math.round(safeValue)}%</span>
      </div>
      <p className="mb-2 text-sm text-gray-700">
        {completed} / {total} lessons completed
      </p>
      <div className="w-full h-3 rounded-full bg-green-100 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
