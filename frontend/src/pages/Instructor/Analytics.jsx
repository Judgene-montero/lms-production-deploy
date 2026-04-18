import React, { Suspense, lazy, memo, useCallback, useMemo, useState } from "react";
import { LuBookOpen, LuCheck, LuGauge, LuTrendingUp, LuUsers } from "react-icons/lu";
import { authGet } from "../../utils/api";

const EnrollmentChart = lazy(() => import("./charts/EnrollmentChart"));
const CompletionChart = lazy(() => import("./charts/CompletionChart"));
const EngagementChart = lazy(() => import("./charts/EngagementChart"));
const PerformanceChart = lazy(() => import("./charts/PerformanceChart"));

const PREDICTION_PAGE_SIZE = 10;

const ChartShell = ({ title }) => (
  <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
    <p className="text-sm font-semibold text-emerald-900">{title}</p>
    <div className="mt-3 h-56 animate-pulse rounded-lg bg-emerald-50" />
  </div>
);

const MemoEnrollmentChart = memo(function MemoEnrollmentChart({ data }) {
  return <EnrollmentChart data={data} />;
});

const MemoCompletionChart = memo(function MemoCompletionChart({ data }) {
  return <CompletionChart data={data} />;
});

const MemoEngagementChart = memo(function MemoEngagementChart({ data }) {
  return <EngagementChart data={data} />;
});

const MemoPerformanceChart = memo(function MemoPerformanceChart({ data }) {
  return <PerformanceChart data={data} />;
});

const PredictionTable = memo(function PredictionTable({
  rows,
  page,
  totalPages,
  onPageChange,
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No prediction records available yet.</p>;
  }

  const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1)
    .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-50 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Student Name</th>
              <th className="px-4 py-2 text-left">Course Name</th>
              <th className="px-4 py-2 text-left">Predicted Outcome</th>
              <th className="px-4 py-2 text-left">Risk Level</th>
              <th className="px-4 py-2 text-left">Confidence Score</th>
              <th className="px-4 py-2 text-left">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id}-${row.studentName}`} className="border-t border-gray-200 bg-white">
                <td className="px-4 py-2 font-medium text-gray-800">{row.studentName}</td>
                <td className="px-4 py-2 text-gray-700">{row.courseName}</td>
                <td className="px-4 py-2 text-gray-700">{row.predictedOutcome}</td>
                <td
                  className={`px-4 py-2 font-semibold ${
                    row.riskLevel === "high"
                      ? "text-red-600"
                      : row.riskLevel === "medium"
                      ? "text-yellow-600"
                      : "text-emerald-700"
                  }`}
                >
                  {String(row.riskLevel).toUpperCase()}
                </td>
                <td className="px-4 py-2 text-gray-700">{row.confidence}%</td>
                <td className="min-w-80 px-4 py-2 text-gray-600">{row.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            &lt;
          </button>

          {pageButtons.map((buttonPage) => (
            <button
              key={buttonPage}
              type="button"
              onClick={() => onPageChange(buttonPage)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                buttonPage === page
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {buttonPage}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      )}
    </>
  );
});

function Analytics() {
  const [stats, setStats] = useState({ total_courses: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [studentRiskList, setStudentRiskList] = useState([]);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [courseAnalytics, setCourseAnalytics] = useState([]);
  const [aiSummary, setAiSummary] = useState({
    total_students: 0,
    average_engagement: 0,
    average_grade: 0,
    high_risk: 0,
    medium_risk: 0,
    low_risk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState("all");
  const [predictionPage, setPredictionPage] = useState(1);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardData, activityData, riskData, atRiskData, courseData] = await Promise.all([
        authGet("/api/instructor/dashboard/").catch(() => ({})),
        authGet("/api/instructor/recent-submissions/").catch(() => []),
        authGet("/api/ai/student-risk/").catch(() => []),
        authGet("/api/ai/at-risk-students/").catch(() => []),
        authGet("/api/ai/course-analytics/").catch(() => ({ courses: [], summary: {} })),
      ]);

      setStats({ total_courses: dashboardData?.total_courses || 0 });
      setRecentActivities(Array.isArray(activityData) ? activityData : []);
      setStudentRiskList(Array.isArray(riskData) ? riskData : []);
      setAtRiskStudents(Array.isArray(atRiskData) ? atRiskData : []);
      setCourseAnalytics(Array.isArray(courseData?.courses) ? courseData.courses : []);
      setAiSummary({
        total_students: courseData?.summary?.total_students || 0,
        average_engagement: Number(courseData?.summary?.average_engagement || 0),
        average_grade: Number(courseData?.summary?.average_grade || 0),
        high_risk: courseData?.summary?.high_risk || 0,
        medium_risk: courseData?.summary?.medium_risk || 0,
        low_risk: courseData?.summary?.low_risk || 0,
      });
    } catch (requestError) {
      console.error(requestError);
      setError("Analytics data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const normalizeCourseName = useCallback((value) => String(value || "").trim(), []);

  const courseOptions = useMemo(() => {
    const names = new Set();

    courseAnalytics.forEach((item) => {
      const name = normalizeCourseName(item.course_title || item.course_name);
      if (name) names.add(name);
    });

    studentRiskList.forEach((item) => {
      const name = normalizeCourseName(item.course_title || item.course_name);
      if (name) names.add(name);
    });

    recentActivities.forEach((item) => {
      const name = normalizeCourseName(item.course_title || item.course_name);
      if (name) names.add(name);
    });

    return ["all", ...Array.from(names)];
  }, [courseAnalytics, normalizeCourseName, recentActivities, studentRiskList]);

  const filteredRecentActivities = useMemo(() => {
    if (selectedCourse === "all") return recentActivities;

    return recentActivities.filter(
      (item) => normalizeCourseName(item.course_title || item.course_name) === selectedCourse
    );
  }, [normalizeCourseName, recentActivities, selectedCourse]);

  const filteredCourseAnalytics = useMemo(() => {
    if (selectedCourse === "all") return courseAnalytics;

    return courseAnalytics.filter(
      (item) => normalizeCourseName(item.course_title || item.course_name) === selectedCourse
    );
  }, [courseAnalytics, normalizeCourseName, selectedCourse]);

  const filteredStudentRiskList = useMemo(() => {
    if (selectedCourse === "all") return studentRiskList;

    return studentRiskList.filter(
      (item) => normalizeCourseName(item.course_title || item.course_name) === selectedCourse
    );
  }, [normalizeCourseName, selectedCourse, studentRiskList]);

  const filteredAtRiskStudents = useMemo(() => {
    if (selectedCourse === "all") return atRiskStudents;

    return atRiskStudents.filter(
      (item) => normalizeCourseName(item.course_title || item.course_name) === selectedCourse
    );
  }, [atRiskStudents, normalizeCourseName, selectedCourse]);

  const enrollmentData = useMemo(() => {
    const grouped = filteredRecentActivities.reduce((acc, row) => {
      if (!row?.submitted_at) return acc;

      const date = new Date(row.submitted_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .slice(-10)
      .map(([date, value]) => ({ date, value }));
  }, [filteredRecentActivities]);

  const completionData = useMemo(
    () =>
      filteredCourseAnalytics.slice(0, 8).map((item) => ({
        course: (item.course_title || "Course").slice(0, 14),
        rate: Number(item.average_grade || 0),
      })),
    [filteredCourseAnalytics]
  );

  const engagementData = useMemo(
    () =>
      filteredCourseAnalytics.slice(0, 8).map((item) => ({
        course: (item.course_title || "Course").slice(0, 14),
        hours: Number(item.average_engagement || 0),
      })),
    [filteredCourseAnalytics]
  );

  const performanceData = useMemo(
    () =>
      filteredStudentRiskList.slice(0, 10).map((item, index) => ({
        label: item.student_name?.split(" ")[0] || `S${index + 1}`,
        score: Number(item.average_grade || 0),
        target: 75,
      })),
    [filteredStudentRiskList]
  );

  const completionRate = useMemo(() => {
    if (!completionData.length) return 0;
    return Math.round(
      completionData.reduce((sum, item) => sum + Number(item.rate || 0), 0) /
        completionData.length
    );
  }, [completionData]);

  const predictionRows = useMemo(
    () =>
      filteredStudentRiskList.map((row) => {
        const failProbability = Number(
          row.risk_probability ?? row.probability_student_fails ?? row.risk_score ?? 0
        );
        const predictedOutcome =
          failProbability >= 0.5 ? "At Risk of Failure" : "Likely to Pass";
        const confidence = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (predictedOutcome === "At Risk of Failure"
                ? failProbability
                : 1 - failProbability) * 100
            )
          )
        );

        return {
          id: row.id,
          studentName: row.student_name || "Unknown Student",
          courseName: row.course_title || "Unknown Course",
          predictedOutcome,
          riskLevel: row.risk_level || "low",
          confidence,
          explanation: row.risk_explanation || "No explanation generated yet.",
        };
      }),
    [filteredStudentRiskList]
  );

  const totalPredictionPages = Math.max(
    1,
    Math.ceil(predictionRows.length / PREDICTION_PAGE_SIZE)
  );

  const pagedPredictionRows = useMemo(() => {
    const start = (predictionPage - 1) * PREDICTION_PAGE_SIZE;
    return predictionRows.slice(start, start + PREDICTION_PAGE_SIZE);
  }, [predictionPage, predictionRows]);

  React.useEffect(() => {
    setPredictionPage(1);
  }, [predictionRows.length, selectedCourse]);

  const handleCourseChange = useCallback((event) => {
    setSelectedCourse(event.target.value);
  }, []);

  const handlePredictionPageChange = useCallback((nextPage) => {
    setPredictionPage(nextPage);
  }, []);

  const filteredHighRiskCount = useMemo(
    () => filteredStudentRiskList.filter((item) => String(item.risk_level || "").toLowerCase() === "high").length,
    [filteredStudentRiskList]
  );

  const filteredAverageGrade = useMemo(() => {
    if (!filteredStudentRiskList.length) return 0;
    return filteredStudentRiskList.reduce((sum, item) => sum + Number(item.average_grade || 0), 0) / filteredStudentRiskList.length;
  }, [filteredStudentRiskList]);

  const insightCards = [
    {
      title: "Total Students",
      value: selectedCourse === "all" ? aiSummary.total_students : filteredStudentRiskList.length,
      icon: LuUsers,
    },
    {
      title: "Total Courses",
      value: selectedCourse === "all" ? stats.total_courses : filteredCourseAnalytics.length || (predictionRows.length ? 1 : 0),
      icon: LuBookOpen,
    },
    {
      title: "Course Engagement",
      value: `${Math.round(
        selectedCourse === "all"
          ? aiSummary.average_engagement
          : filteredCourseAnalytics.reduce((sum, item) => sum + Number(item.average_engagement || 0), 0) /
              Math.max(filteredCourseAnalytics.length, 1)
      )}%`,
      icon: LuGauge,
    },
    { title: "Completion Rate", value: `${completionRate}%`, icon: LuCheck },
    {
      title: "High Risk Students",
      value: selectedCourse === "all" ? aiSummary.high_risk : filteredHighRiskCount,
      icon: LuTrendingUp,
      accent: "text-red-600",
    },
    {
      title: "Average Grade",
      value: `${Math.round(selectedCourse === "all" ? aiSummary.average_grade : filteredAverageGrade)}%`,
      icon: LuTrendingUp,
    },
  ];

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-emerald-50" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">AI Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          Student analytics, course engagement, completion, and machine-learning predictions.
        </p>

        <div className="mt-4 max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Analytics Overview
          </label>
          <select
            value={selectedCourse}
            onChange={handleCourseChange}
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
          >
            {courseOptions.map((course) => (
              <option key={course} value={course}>
                {course === "all" ? "All Courses" : course}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {insightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <Icon className={`h-4 w-4 ${card.accent || ""}`} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold text-emerald-950">{card.value}</p>
            </article>
          );
        })}
      </section>

      <Suspense
        fallback={
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartShell title="Enrollment Trend" />
            <ChartShell title="Completion Trend" />
            <ChartShell title="Engagement" />
            <ChartShell title="Performance" />
          </section>
        }
      >
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <MemoEnrollmentChart data={enrollmentData} />
          <MemoCompletionChart data={completionData} />
          <MemoEngagementChart data={engagementData} />
          <MemoPerformanceChart data={performanceData} />
        </section>
      </Suspense>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-emerald-900">At-Risk Students</h3>
          {filteredAtRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-500">No at-risk students currently detected.</p>
          ) : (
            <ul className="space-y-2">
              {filteredAtRiskStudents.slice(0, 8).map((risk) => (
                <li
                  key={risk.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="font-medium text-gray-800">{risk.student_name}</span>
                  <span className="text-sm text-gray-600">
                    {Math.round(Number(risk.risk_probability || risk.risk_score || 0) * 100)}% {risk.risk_level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-emerald-900">Course Analytics Summary</h3>
          {filteredCourseAnalytics.length === 0 ? (
            <p className="text-sm text-gray-500">No course analytics available yet.</p>
          ) : (
            <ul className="space-y-2">
              {filteredCourseAnalytics.map((course) => (
                <li key={course.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="font-medium text-gray-800">{course.course_title}</p>
                  <p className="text-sm text-gray-600">
                    Avg Grade: {Number(course.average_grade || 0).toFixed(1)} | Avg Engagement: {Math.round(Number(course.average_engagement || 0))}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-emerald-900">
          Machine Learning Prediction Table
        </h3>
        <PredictionTable
          rows={pagedPredictionRows}
          page={predictionPage}
          totalPages={totalPredictionPages}
          onPageChange={handlePredictionPageChange}
        />
      </section>
    </div>
  );
}

export default memo(Analytics);
