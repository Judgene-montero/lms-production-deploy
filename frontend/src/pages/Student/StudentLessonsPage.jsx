import React, { Suspense, lazy } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const LessonsTab = lazy(() => import("../../components/course/LessonsTab"));

export default function StudentLessonsPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const lessonId = searchParams.get("lessonId");
  const moduleId = searchParams.get("moduleId");

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Lesson Workspace</p>
              <h1 className="text-xl font-semibold text-emerald-950 sm:text-2xl">Course Lessons</h1>
              <p className="mt-1 text-sm text-gray-600">Focused learning view with module navigator and lesson reader.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/student/dashboard/my-courses/${courseId}`, { state: { activeTab: "lessons" } })}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back To Course
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <Suspense fallback={<p className="text-sm text-emerald-700">Loading lessons...</p>}>
            <LessonsTab
              courseId={courseId}
              isInstructor={false}
              initialLessonId={lessonId}
              initialModuleId={moduleId}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
