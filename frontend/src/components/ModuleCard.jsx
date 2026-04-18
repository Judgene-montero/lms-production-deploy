import React from "react";

export default function ModuleCard({
  moduleItem,
  completedLessonIds,
  onSelectLesson,
  onOpenLessonPage,
  selectedLessonId,
  isExpanded,
  onToggle,
  isInstructor = false,
  onEditLesson,
  onDeleteLesson,
  onDeleteModule,
}) {
  const sortedLessons = [...(moduleItem.lessons || [])].sort(
    (a, b) => (a.order ?? a.lesson_order ?? 0) - (b.order ?? b.lesson_order ?? 0)
  );

  return (
    <div className="bg-white rounded-2xl shadow-md border p-4">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <h4 className="font-bold text-green-900">{moduleItem.title || "Untitled Module"}</h4>
          <span className="text-xs font-semibold text-green-700">
            {isExpanded ? "Hide" : "Show"} ({sortedLessons.length})
          </span>
        </button>
        {isInstructor && (
          <button
            type="button"
            onClick={() => onDeleteModule?.(moduleItem)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-all duration-200 hover:bg-red-50"
          >
            Delete Module
          </button>
        )}
      </div>

      {!isExpanded ? null : sortedLessons.length === 0 ? (
        <p className="text-sm text-gray-500">No lessons in this module yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedLessons.map((lesson, index) => {
            const isCompleted = completedLessonIds.has(lesson.id);
            const isActive = Number(selectedLessonId) === Number(lesson.id);
            return (
              <div
                key={lesson.id}
                className={`w-full text-left p-2 rounded-lg border transition ${
                  isActive
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectLesson(lesson, moduleItem)}
                  className="w-full text-left"
                >
                  {!isInstructor && (
                    <span className={`mr-2 ${isCompleted ? "text-green-600" : "text-gray-400"}`}>
                      {isCompleted ? "[x]" : "[ ]"}
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    Lesson {index + 1}: {lesson.title}
                  </span>
                </button>

                {isInstructor && (
                  <div className="mt-2 flex gap-2">
                    {onOpenLessonPage && (
                      <button
                        type="button"
                        onClick={() => onOpenLessonPage?.(lesson, moduleItem)}
                        className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditLesson?.(lesson)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLesson?.(lesson)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
