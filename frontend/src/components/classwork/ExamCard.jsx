import React from "react";
import { LuEye, LuFileSearch, LuPencil, LuSettings2, LuTrash2, LuUpload } from "react-icons/lu";

const toLabel = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
const toDateTime = (value) => (value ? new Date(value).toLocaleString() : "N/A");

const badgeClass = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-emerald-100 text-emerald-700",
};

export default function ExamCard({
  activity,
  onEdit,
  onPreview,
  onEditSettings,
  onReviewSubmissions,
  onTogglePublish,
  onDelete,
}) {
  const publishState = String(activity?.publish_state || "draft").toLowerCase();
  const hasEssay = Boolean(activity?.needs_manual_review);
  const questionCount = Number(activity?.question_count || 0);
  const totalPoints = Number(activity?.total_points_value ?? activity?.points ?? 0);
  const attemptsCount = Number(activity?.attempts_count || 0);
  const pendingReviewCount = Number(activity?.pending_review_count || 0);

  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-semibold text-emerald-950">{activity?.title || "Untitled Assessment"}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase text-sky-700">
              {toLabel(activity?.assessment_type || "quiz")}
            </span>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badgeClass[publishState] || badgeClass.draft}`}>
              {publishState.toUpperCase()}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              {hasEssay ? "Needs Manual Review" : "Auto-Graded"}
            </span>
            {pendingReviewCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                {pendingReviewCount} Pending
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Questions</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{questionCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Points</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{totalPoints}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Attempts</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{attemptsCount}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-gray-700">
        <p>
          <span className="font-semibold text-gray-900">Submission deadline:</span> {toDateTime(activity?.submission_deadline)}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-gray-900">Visibility:</span>{" "}
          {activity?.show_score_immediately ? "Score released immediately" : "Score held by instructor"} /{" "}
          {activity?.allow_answer_review ? "Answer review enabled" : "Answer review disabled"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
          <LuPencil className="h-4 w-4" /> Edit Exam
        </button>
        <button type="button" onClick={onEditSettings} className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700">
          <LuSettings2 className="h-4 w-4" /> Edit Settings
        </button>
        <button type="button" onClick={onPreview} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
          <LuEye className="h-4 w-4" /> Preview
        </button>
        <button type="button" onClick={onReviewSubmissions} className="flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700">
          <LuFileSearch className="h-4 w-4" /> Review Submissions
        </button>
        <button type="button" onClick={onTogglePublish} className="flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700">
          <LuUpload className="h-4 w-4" /> {publishState === "published" ? "Unpublish" : "Publish"}
        </button>
        <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700">
          <LuTrash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </article>
  );
}
