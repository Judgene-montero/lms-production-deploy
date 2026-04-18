import React from "react";
import { LuCalendarClock, LuClock3, LuEye, LuPencil, LuTrash2, LuTrendingUp } from "react-icons/lu";

const toDateTime = (value) => (value ? new Date(value).toLocaleString() : "N/A");
const toLabel = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const getStatusClass = (status) => {
  const normalized = String(status || "draft").toLowerCase();
  if (normalized === "published") return "bg-emerald-100 text-emerald-700";
  if (normalized === "closed") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

export default function ExamQuizCard({ activity, onEdit, onView, onAnalytics, onDelete }) {
  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-semibold text-emerald-950">{activity.title || "Untitled Assessment"}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase text-sky-700">
              {toLabel(activity.assessment_type || "quiz")}
            </span>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClass(activity.publish_state)}`}>
              {String(activity.publish_state || "draft").toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-1 text-sm text-gray-700">
        <p className="flex items-center gap-2"><LuCalendarClock className="h-4 w-4 text-gray-500" /> Open: {toDateTime(activity.availability_start)}</p>
        <p className="flex items-center gap-2"><LuClock3 className="h-4 w-4 text-gray-500" /> Due: {toDateTime(activity.due_date)}</p>
        <p className="flex items-center gap-2"><LuClock3 className="h-4 w-4 text-gray-500" /> Close: {toDateTime(activity.availability_end)}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onView} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
          <LuEye className="h-4 w-4" /> View
        </button>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
          <LuPencil className="h-4 w-4" /> Edit
        </button>
        <button type="button" onClick={onAnalytics} className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700">
          <LuTrendingUp className="h-4 w-4" /> Analytics
        </button>
        {typeof onDelete === "function" ? (
          <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700">
            <LuTrash2 className="h-4 w-4" /> Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
