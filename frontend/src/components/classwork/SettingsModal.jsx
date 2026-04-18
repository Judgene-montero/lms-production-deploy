import React, { useEffect, useState } from "react";

export default function SettingsModal({ open, exam, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    show_score_immediately: false,
    allow_answer_review: false,
    apply_to_past_attempts: false,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      show_score_immediately: Boolean(exam?.show_score_immediately),
      allow_answer_review: Boolean(exam?.allow_answer_review),
      apply_to_past_attempts: false,
    });
  }, [exam, open]);

  if (!open || !exam) return null;

  const toggle = (key) =>
    setForm((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Edit Settings</p>
            <h3 className="text-lg font-semibold text-emerald-950">{exam.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.show_score_immediately}
              onChange={() => toggle("show_score_immediately")}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold text-gray-900">Show score immediately</span>
              <span className="block text-xs text-gray-600">Students see released scores as soon as the submission is fully graded.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.allow_answer_review}
              onChange={() => toggle("allow_answer_review")}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold text-gray-900">Allow answer review</span>
              <span className="block text-xs text-gray-600">Students can open the detailed question-by-question review after grading.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.apply_to_past_attempts}
              onChange={() => toggle("apply_to_past_attempts")}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold text-gray-900">Apply changes to past attempts</span>
              <span className="block text-xs text-gray-600">Leave this off to keep existing attempts on their current visibility rules.</span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
