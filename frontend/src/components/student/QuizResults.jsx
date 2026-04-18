import React from "react";

export default function QuizResults({ result }) {
  if (!result) return null;

  const score = Number(result?.score || 0);
  const totalPoints = Number(result?.total_points || result?.totalPoints || 0);
  const correct = Number(result?.correct_answers || 0);
  const incorrect = Number(result?.incorrect_answers || 0);
  const breakdown = Array.isArray(result?.breakdown) ? result.breakdown : [];
  const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

  const tone =
    pct >= 80
      ? "text-green-700 bg-green-50 border-green-200"
      : pct >= 60
      ? "text-orange-700 bg-orange-50 border-orange-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <section className={`space-y-3 rounded-xl border p-4 ${tone}`}>
      <h4 className="text-sm font-semibold uppercase tracking-wide">Quiz Results</h4>
      <p className="text-lg font-bold">
        Score: {score} / {totalPoints} ({pct}%)
      </p>
      <p className="text-sm">Correct: {correct} | Incorrect: {incorrect}</p>

      {breakdown.length > 0 && (
        <div className="space-y-2 rounded-lg border border-white/70 bg-white/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide">Per-question Results</p>
          {breakdown.map((item) => (
            <article key={item.question_id} className="rounded-md border border-white/80 bg-white p-2 text-xs">
              <p className="font-semibold">Q{item.question_id}: {item.question_text}</p>
              <p>
                Points: {Number(item.points_earned || 0).toFixed(2)} / {Number(item.max_points || 0).toFixed(2)}
              </p>
              <p>Status: {item.is_correct ? "Correct" : "Incorrect"}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
