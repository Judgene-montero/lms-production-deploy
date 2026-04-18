import React from "react";
import QuizAttemptCard from "./QuizAttemptCard";

export default function QuizAttemptView({ attempts = [] }) {
  return (
    <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Attempt Tracking</h4>
      <p className="text-xs text-gray-500">Total Attempts: {attempts.length}</p>
      {attempts.length === 0 ? (
        <p className="text-sm text-gray-500">No attempts yet.</p>
      ) : (
        attempts.map((attempt, index) => (
          <QuizAttemptCard key={`${attempt.id || "attempt"}-${index}`} attempt={attempt} index={index} />
        ))
      )}
    </section>
  );
}
