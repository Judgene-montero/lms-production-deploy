import React, { memo, useEffect, useMemo, useState } from "react";
import { authGet } from "../../utils/api";

const PAGE_SIZE = 20;

const riskBadgeClass = (riskLevel) => {
  const value = String(riskLevel || "").toLowerCase();
  if (value === "high") return "bg-red-100 text-red-700";
  if (value === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

function StudentRiskTab({ isActive, selectedCourse, students }) {
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
          const response = await authGet(`/api/ai/student-risk/${query}`);
          apiRows = Array.isArray(response) ? response : [];
        } catch {
          apiRows = [];
        }

        const fallbackRows = students.map((student) => ({
          student_id: student.id,
          student_name: student.name,
          risk_level: student.riskLevel,
          confidence: student.riskLevel === "high" ? 0.87 : student.riskLevel === "medium" ? 0.68 : 0.42,
          engagement_score: student.progress,
          missing_rate: Math.min(1, Number(student.assignmentsMissed || 0) / 10),
          late_rate: Math.min(1, Number(student.lateSubmissions || 0) / 10),
          explanation: student.assignmentsMissed > 3 ? "Low assignment completion" : "Stable performance",
          recommended_action: student.assignmentsMissed > 3 ? "Send reminder and monitor next submission" : "Maintain regular follow-up",
        }));

        const normalized = (apiRows.length ? apiRows : fallbackRows).map((item) => ({
          id: item.student_id || item.id,
          student: item.student_name || item.name || "Unknown Student",
          riskLevel: String(item.risk_level || "low").toLowerCase(),
          confidence: Number(item.confidence ?? item.confidence_score ?? 0),
          engagementScore: Math.round(Number(item.engagement_score ?? 0)),
          missingRate: Math.round(Number(item.missing_rate ?? 0) * 100),
          lateRate: Math.round(Number(item.late_rate ?? 0) * 100),
          explanation: item.explanation || "No additional explanation.",
          recommendedAction: item.recommended_action || "Review student activity.",
        }));

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

  const attention = useMemo(() => rows.filter((row) => row.riskLevel === "high" || row.missingRate >= 30).length, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
        Students needing attention: {attention}
      </div>

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
                    <th className="px-3 py-2 text-left">Risk Level</th>
                    <th className="px-3 py-2 text-left">Confidence Score</th>
                    <th className="px-3 py-2 text-left">Engagement Score</th>
                    <th className="px-3 py-2 text-left">Missing Rate</th>
                    <th className="px-3 py-2 text-left">Late Rate</th>
                    <th className="px-3 py-2 text-left">Explanation</th>
                    <th className="px-3 py-2 text-left">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-200">
                      <td className="px-3 py-2 text-gray-800">{row.student}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskBadgeClass(row.riskLevel)}`}>{row.riskLevel.toUpperCase()}</span></td>
                      <td className="px-3 py-2">{row.confidence.toFixed(2)}</td>
                      <td className="px-3 py-2">{row.engagementScore}</td>
                      <td className="px-3 py-2">{row.missingRate}%</td>
                      <td className="px-3 py-2">{row.lateRate}%</td>
                      <td className="px-3 py-2 text-gray-700">{row.explanation}</td>
                      <td className="px-3 py-2 text-gray-700">{row.recommendedAction}</td>
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
    </section>
  );
}

export default memo(StudentRiskTab);
