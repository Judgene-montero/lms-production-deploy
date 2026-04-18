import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authGet } from "../../../utils/api";

const toDateTime = (value) => (value ? new Date(value).toLocaleString() : "N/A");

export default function ClassworkDetail() {
  const navigate = useNavigate();
  const { courseId, id } = useParams();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [activityData, analyticsData] = await Promise.all([
        authGet(`/api/courses/${courseId}/exam-quizzes/${id}/`),
        authGet(`/api/analytics/classwork/${id}/`),
      ]);
      setActivity(activityData || null);
      setAnalytics(analyticsData || null);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load classwork detail.");
    } finally {
      setLoading(false);
    }
  }, [courseId, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!activity) return null;

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-emerald-950">{activity.title}</h1>
              <p className="text-sm text-gray-600">{String(activity.assessment_type || "quiz").toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "exams_quizzes" } })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Back to Exams & Quizzes
              </button>
              <button
                type="button"
                onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/${id}/analytics`)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
              >
                Analytics
              </button>
              <button
                type="button"
                onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/${id}/edit`)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                Edit
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Schedule</h2>
            <p className="text-sm text-gray-700">Due Date: {toDateTime(activity.due_date)}</p>
            <p className="text-sm text-gray-700">Open Time: {toDateTime(activity.availability_start)}</p>
            <p className="text-sm text-gray-700">Close Time: {toDateTime(activity.availability_end)}</p>
            <p className="text-sm text-gray-700">Status: {String(activity.publish_state || "draft").toUpperCase()}</p>
          </article>
          <article id="analytics" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Analytics</h2>
            <p className="text-sm text-gray-700">Attempts: {analytics?.attempts ?? 0}</p>
            <p className="text-sm text-gray-700">Average Score: {analytics?.average_score ?? 0}</p>
            <p className="text-sm text-gray-700">Completion Rate: {analytics?.completion_rate ?? 0}%</p>
          </article>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Sections</h2>
          {(activity.sections || []).map((section) => (
            <article key={section.id} className="mb-3 rounded-lg border border-emerald-100 p-3 last:mb-0">
              <h3 className="font-semibold text-emerald-900">{section.title}</h3>
              {section.instructions ? <p className="mt-1 text-sm text-gray-600">{section.instructions}</p> : null}
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {(section.questions || []).map((question) => (
                  <li key={question.id}>• {question.question_text}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
