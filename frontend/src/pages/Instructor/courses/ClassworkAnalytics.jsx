import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authGet } from "../../../utils/api";

const toPercent = (value) => `${Number(value ?? 0).toFixed(0)}%`;

export default function ClassworkAnalytics() {
  const navigate = useNavigate();
  const { courseId, id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState(null);
  const [analytics, setAnalytics] = useState(null);

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
      setError("Failed to load exam analytics.");
    } finally {
      setLoading(false);
    }
  }, [courseId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const students = useMemo(() => {
    if (Array.isArray(analytics?.student_results)) return analytics.student_results;
    if (Array.isArray(analytics?.students)) return analytics.students;
    return [];
  }, [analytics]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-emerald-950">{activity?.title || "Exam Analytics"}</h1>
              <p className="text-sm text-gray-600">Detailed attempts and student score visibility</p>
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
                onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/${id}`)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                View Exam
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Attempts</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{analytics?.attempts ?? 0}</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Average Score</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{toPercent(analytics?.average_score)}</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Completion Rate</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{toPercent(analytics?.completion_rate)}</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Highest Score</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{toPercent(analytics?.highest_score)}</p>
          </article>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Student Performance</h2>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-gray-500">No student score records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Score</th>
                    <th className="px-2 py-2">Attempts</th>
                    <th className="px-2 py-2">Submitted</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id || index} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-2 text-gray-800">{student.name || student.student_name || student.student_id || "Unknown"}</td>
                      <td className="px-2 py-2 text-gray-800">{student.score ?? student.total_score ?? "-"}</td>
                      <td className="px-2 py-2 text-gray-800">{student.attempt_count ?? student.attempts ?? 1}</td>
                      <td className="px-2 py-2 text-gray-800">{student.submitted_at || student.submission_time || "-"}</td>
                      <td className="px-2 py-2 text-gray-800">{student.status || "Completed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
