import React from "react";
import { getDefaultStudentAvatarDataUrl } from "../../utils/studentProfile";

const formatWhen = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
};

export default function StudentActivityFeed({ items = [], title = "Recent Instructor Activity", profile = null }) {
  const avatarSrc = profile?.avatar || profile?.avatar_url || getDefaultStudentAvatarDataUrl(profile || {});

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No recent activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id || `${item.title}-${item.created_at}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start gap-3">
                <img src={avatarSrc} alt="Student avatar" className="h-8 w-8 rounded-full object-cover ring-1 ring-emerald-100" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title || "Activity update"}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.course_title || item.course || "Course update"}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatWhen(item.created_at || item.date)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
