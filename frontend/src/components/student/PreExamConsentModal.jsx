import React from "react";

export default function PreExamConsentModal({
  open,
  quiz,
  checked,
  onCheckedChange,
  onCancel,
  onConfirm,
  loading = false,
}) {
  if (!open) return null;

  const rules = [
    quiz?.anti_cheat_tab_switch ? "Tab switching is monitored." : null,
    quiz?.anti_cheat_multi_tab ? "Multiple tabs are not allowed." : null,
    quiz?.anti_cheat_disable_copy_paste ? "Copy and paste are disabled." : null,
    quiz?.anti_cheat_fullscreen_required ? "Fullscreen mode is required." : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Before You Start</h3>
        <p className="mt-1 text-sm text-gray-600">{quiz?.title || "Quiz"} requires policy acknowledgment.</p>

        <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm md:grid-cols-2">
          <p><span className="font-semibold">Total Points:</span> {Number(quiz?.total_points || 0)}</p>
          <p><span className="font-semibold">Duration:</span> {Math.round(Number(quiz?.time_limit || 0) / 60)} mins</p>
          <p><span className="font-semibold">Max Attempts:</span> {Number(quiz?.max_attempts || 1)}</p>
          <p><span className="font-semibold">Assessment:</span> {quiz?.assessment_type || "quiz"}</p>
        </div>

        {quiz?.pre_exam_message ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {quiz.pre_exam_message}
          </div>
        ) : null}

        {rules.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-800">Anti-cheat Rules</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
          />
          <span>I understand and agree to the exam rules, anti-cheat policy, and submission terms.</span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!checked || loading}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Starting..." : "Agree And Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
