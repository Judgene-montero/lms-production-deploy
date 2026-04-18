import React from "react";

export default function CourseProgressBar({
  value = 0,
  showLabel = true,
  className = "",
  barClassName = "bg-emerald-600",
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
          <span>Progress</span>
          <span>{safeValue.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClassName}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
