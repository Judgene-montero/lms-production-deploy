import React, { memo, useEffect, useMemo, useState } from "react";
import { authGet } from "../../utils/api";

const PAGE_SIZE = 20;

function StudentActivityTab({ isActive, selectedCourse, students }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [selectedCourse]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!isActive) return;
      setLoading(true);
      setError("");

      try {
        let apiRows = [];
        try {
          const query = selectedCourse && selectedCourse !== "all" ? `?course_id=${selectedCourse}` : "";
          const response = await authGet(`/api/student_activity/${query}`);
          apiRows = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
        } catch {
          apiRows = [];
        }

        const fallbackRows = students.map((student) => ({
          student_id: student.id,
          student_name: student.name,
          lessons_viewed: Math.round(student.progress * 0.6),
          quizzes_taken: Math.max(0, Math.round(student.progress / 20)),
          assignments_submitted: Math.max(0, 10 - student.assignmentsMissed),
          late_submissions: student.lateSubmissions,
          missed_assignments: student.assignmentsMissed,
          last_activity: student.lastActive,
          engagement_score: student.progress,
        }));

        const normalized = (apiRows.length ? apiRows : fallbackRows).map((item) => {
          const lessonsViewed = Number(item.lessons_viewed ?? item.lesson_views ?? 0);
          const quizzesTaken = Number(item.quizzes_taken ?? item.quiz_count ?? 0);
          const assignmentsSubmitted = Number(item.assignments_submitted ?? item.submitted_assignments ?? 0);
          const lateSubmissions = Number(item.late_submissions ?? 0);
          const missedAssignments = Number(item.missed_assignments ?? 0);

          const computedEngagement = Math.max(
            0,
            Math.min(
              100,
              Math.round(
                lessonsViewed * 1.5 + quizzesTaken * 8 + assignmentsSubmitted * 5 - lateSubmissions * 3 - missedAssignments * 5
              )
            )
          );

          return {
            id: item.student_id || item.id,
            student: item.student_name || item.name || "Unknown Student",
            lessonsViewed,
            quizzesTaken,
            assignmentsSubmitted,
            lateSubmissions,
            missedAssignments,
            lastActivity: item.last_activity || item.last_active || null,
            engagementScore: Number(item.engagement_score ?? computedEngagement),
          };
        });

        if (mounted) setRows(normalized);
      } catch (requestError) {
        console.error(requestError);
        if (mounted) setError("Data could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [isActive, selectedCourse, students]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-emerald-50" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">Lessons Viewed</th>
                  <th className="px-3 py-2 text-left">Quizzes Taken</th>
                  <th className="px-3 py-2 text-left">Assignments Submitted</th>
                  <th className="px-3 py-2 text-left">Late Submissions</th>
                  <th className="px-3 py-2 text-left">Missed Assignments</th>
                  <th className="px-3 py-2 text-left">Last Activity</th>
                  <th className="px-3 py-2 text-left">Engagement Score</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200">
                    <td className="px-3 py-2 text-gray-800">{row.student}</td>
                    <td className="px-3 py-2">{row.lessonsViewed}</td>
                    <td className="px-3 py-2">{row.quizzesTaken}</td>
                    <td className="px-3 py-2">{row.assignmentsSubmitted}</td>
                    <td className="px-3 py-2">{row.lateSubmissions}</td>
                    <td className="px-3 py-2">{row.missedAssignments}</td>
                    <td className="px-3 py-2 text-gray-600">{row.lastActivity ? new Date(row.lastActivity).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{row.engagementScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">&lt;</button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">&gt;</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default memo(StudentActivityTab);
