import React from "react";

const formatDate = (value) => {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString();
};

export default function QuizAttemptCard({ attempt, index }) {
  const score = Number(attempt?.score || 0);
  const totalPoints = Number(attempt?.total_points || attempt?.totalPoints || 0);
  const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const tone =
    pct >= 80
      ? "text-green-700 bg-green-50 border-green-200"
      : pct >= 60
      ? "text-orange-700 bg-orange-50 border-orange-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Attempt {index + 1}</p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{pct}%</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">
        Score: {score} / {totalPoints}
      </p>
      <p className="mt-1 text-xs text-gray-500">Started: {formatDate(attempt?.started_at || attempt?.startedAt)}</p>
      <p className="mt-1 text-xs text-gray-500">Submitted: {formatDate(attempt?.submitted_at || attempt?.submittedAt)}</p>
      <p className="mt-1 text-xs text-gray-500">Time Spent: {Number(attempt?.time_spent || attempt?.timeSpent || 0)}s</p>
    </article>
  );
}
