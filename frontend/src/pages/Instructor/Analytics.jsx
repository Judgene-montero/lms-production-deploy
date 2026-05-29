import React, { Suspense, lazy, memo, useCallback, useMemo, useState } from "react";
import { LuBookOpen, LuCheck, LuGauge, LuTrendingUp, LuUsers } from "react-icons/lu";
import { authGet } from "../../utils/api";

const EnrollmentChart = lazy(() => import("./charts/EnrollmentChart"));
const CompletionChart = lazy(() => import("./charts/CompletionChart"));
const EngagementChart = lazy(() => import("./charts/EngagementChart"));
const PerformanceChart = lazy(() => import("./charts/PerformanceChart"));

const PREDICTION_PAGE_SIZE = 10;

const formatMetricPercent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const ChartShell = ({ title }) => (
  <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
    <p className="text-sm font-semibold text-emerald-900">{title}</p>
    <div className="mt-3 h-56 animate-pulse rounded-lg bg-emerald-50" />
  </div>
);

const SectionShell = ({ className = "h-48" }) => <div className={`animate-pulse rounded-xl bg-emerald-50 ${className}`} />;

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
              <th className="px-4 py-2 text-left">Failure Probability</th>
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
                <td className="px-4 py-2 text-gray-700">{row.failureProbability}%</td>
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

const ModelEvaluationPanel = memo(function ModelEvaluationPanel({ metrics }) {
  const metricCards = [
    { label: "Total Samples", value: metrics?.total_samples ?? metrics?.samples ?? 0 },
    { label: "Train Samples", value: metrics?.train_samples ?? 0 },
    { label: "Test Samples", value: metrics?.test_samples ?? 0 },
    { label: "TP", value: metrics?.TP ?? metrics?.true_positive ?? 0 },
    { label: "TN", value: metrics?.TN ?? metrics?.true_negative ?? 0 },
    { label: "FP", value: metrics?.FP ?? metrics?.false_positive ?? 0 },
    { label: "FN", value: metrics?.FN ?? metrics?.false_negative ?? 0 },
    { label: "Accuracy", value: formatMetricPercent(metrics?.accuracy) },
    { label: "Precision", value: formatMetricPercent(metrics?.precision) },
    { label: "Recall", value: formatMetricPercent(metrics?.recall) },
    { label: "F1 Score", value: formatMetricPercent(metrics?.f1_score) },
  ];
  const confusionValues = [
    { label: "TP", value: metrics?.TP ?? metrics?.true_positive ?? 0, tone: "text-emerald-700" },
    { label: "FN", value: metrics?.FN ?? metrics?.false_negative ?? 0, tone: "text-red-600" },
    { label: "FP", value: metrics?.FP ?? metrics?.false_positive ?? 0, tone: "text-amber-600" },
    { label: "TN", value: metrics?.TN ?? metrics?.true_negative ?? 0, tone: "text-emerald-700" },
  ];

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-emerald-900">Model Evaluation</h3>
          <p className="mt-1 text-sm text-gray-600">
            Held-out RandomForest test-set evaluation saved from the latest training run.
          </p>
        </div>
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
          Test Set Only
        </span>
      </div>

      {metrics?.message ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {metrics.message}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {metricCards.map((item) => (
          <article key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase text-gray-500">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-gray-200">
          <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <div className="px-3 py-2">Actual / Predicted</div>
            <div className="px-3 py-2 text-center">At Risk</div>
            <div className="px-3 py-2 text-center">Not At Risk</div>
          </div>
          <div className="grid grid-cols-3 border-b border-gray-200 text-sm">
            <div className="px-3 py-3 font-semibold text-gray-700">At Risk</div>
            <div className="px-3 py-3 text-center font-bold text-emerald-700">{metrics?.TP ?? metrics?.true_positive ?? 0}</div>
            <div className="px-3 py-3 text-center font-bold text-red-600">{metrics?.FN ?? metrics?.false_negative ?? 0}</div>
          </div>
          <div className="grid grid-cols-3 text-sm">
            <div className="px-3 py-3 font-semibold text-gray-700">Not At Risk</div>
            <div className="px-3 py-3 text-center font-bold text-amber-600">{metrics?.FP ?? metrics?.false_positive ?? 0}</div>
            <div className="px-3 py-3 text-center font-bold text-emerald-700">{metrics?.TN ?? metrics?.true_negative ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {confusionValues.map((item) => (
            <article key={item.label} className="rounded-lg border border-gray-200 bg-white p-3 text-center">
              <p className="text-xs font-semibold uppercase text-gray-500">{item.label}</p>
              <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});

function Analytics() {
  const [stats, setStats] = useState({ total_courses: 0, total_students: 0 });
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
  const [modelMetrics, setModelMetrics] = useState({});
  const [error, setError] = useState("");
  const [loadingState, setLoadingState] = useState({
    summary: true,
    predictions: true,
    atRisk: true,
    metrics: true,
    activity: true,
  });

  const [selectedCourse, setSelectedCourse] = useState("all");
  const [predictionPage, setPredictionPage] = useState(1);

  const normalizeCourseName = useCallback((value) => String(value || "").trim(), []);

  const courseOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Courses", courseId: null, courseName: "all" }];
    const seenIds = new Set();
    const seenNames = new Set();

    const pushCourse = (courseId, courseName) => {
      const normalizedName = normalizeCourseName(courseName);
      if (!normalizedName) return;
      if (courseId != null) {
        if (seenIds.has(String(courseId))) return;
        seenIds.add(String(courseId));
        options.push({
          value: String(courseId),
          label: normalizedName,
          courseId: Number(courseId),
          courseName: normalizedName,
        });
        return;
      }
      if (seenNames.has(normalizedName)) return;
      seenNames.add(normalizedName);
      options.push({
        value: `name:${normalizedName}`,
        label: normalizedName,
        courseId: null,
        courseName: normalizedName,
      });
    };

    courseAnalytics.forEach((item) => pushCourse(item.course_id, item.course_title || item.course_name));
    studentRiskList.forEach((item) => pushCourse(item.course_id, item.course_title || item.course_name));
    recentActivities.forEach((item) => pushCourse(null, item.course_title || item.course_name));

    return options;
  }, [courseAnalytics, normalizeCourseName, recentActivities, studentRiskList]);

  const selectedCourseOption = useMemo(
    () => courseOptions.find((option) => option.value === selectedCourse) || courseOptions[0],
    [courseOptions, selectedCourse]
  );

  const selectedCourseId = selectedCourseOption?.courseId ?? null;
  const selectedCourseName = normalizeCourseName(selectedCourseOption?.courseName || "");

  const loadAnalytics = useCallback(async () => {
    setError("");
    setLoadingState({
      summary: true,
      predictions: true,
      atRisk: true,
      metrics: true,
      activity: true,
    });

    const withParams = (basePath, extraParams = {}) => {
      const params = new URLSearchParams();
      if (selectedCourseId) params.set("course_id", String(selectedCourseId));
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          params.set(key, String(value));
        }
      });
      const query = params.toString();
      return query ? `${basePath}?${query}` : basePath;
    };

    const summaryRequest = Promise.allSettled([
      authGet(withParams("/api/instructor/dashboard/", { refresh: 0 })),
      authGet(withParams("/api/ai/course-analytics/", { refresh: 0 })),
    ]).then(([dashboardResult, courseResult]) => {
      if (dashboardResult.status === "fulfilled") {
        setStats({
          total_courses: dashboardResult.value?.total_courses || 0,
          total_students: dashboardResult.value?.total_students || 0,
        });
      }
      if (courseResult.status === "fulfilled") {
        const courseData = courseResult.value || {};
        setCourseAnalytics(Array.isArray(courseData?.courses) ? courseData.courses : []);
        setAiSummary({
          total_students: courseData?.summary?.total_students || 0,
          average_engagement: Number(courseData?.summary?.average_engagement || 0),
          average_grade: Number(courseData?.summary?.average_grade || 0),
          high_risk: courseData?.summary?.high_risk || 0,
          medium_risk: courseData?.summary?.medium_risk || 0,
          low_risk: courseData?.summary?.low_risk || 0,
        });
      }
      if (dashboardResult.status !== "fulfilled" && courseResult.status !== "fulfilled") {
        setError("Analytics data could not be loaded.");
      }
      setLoadingState((current) => ({ ...current, summary: false }));
    });

    const activityRequest = authGet(withParams("/api/instructor/recent-submissions/", { limit: 20 }))
      .then((activityData) => {
        setRecentActivities(Array.isArray(activityData) ? activityData : []);
      })
      .catch(() => {
        setRecentActivities([]);
      })
      .finally(() => {
        setLoadingState((current) => ({ ...current, activity: false }));
      });

    const predictionRequest = authGet(withParams("/api/ai/student-risk/", { refresh: 0, limit: 60 }))
      .then((riskData) => {
        setStudentRiskList(Array.isArray(riskData) ? riskData : []);
      })
      .catch(() => {
        setStudentRiskList([]);
      })
      .finally(() => {
        setLoadingState((current) => ({ ...current, predictions: false }));
      });

    const atRiskRequest = authGet(withParams("/api/ai/at-risk-students/", { refresh: 0, limit: 10 }))
      .then((atRiskData) => {
        setAtRiskStudents(Array.isArray(atRiskData) ? atRiskData : []);
      })
      .catch(() => {
        setAtRiskStudents([]);
      })
      .finally(() => {
        setLoadingState((current) => ({ ...current, atRisk: false }));
      });

    const metricsRequest = authGet("/api/ai/model-metrics/")
      .then((metricsData) => {
        setModelMetrics(metricsData && typeof metricsData === "object" ? metricsData : {});
      })
      .catch(() => {
        setModelMetrics({});
      })
      .finally(() => {
        setLoadingState((current) => ({ ...current, metrics: false }));
      });

    await Promise.all([summaryRequest, activityRequest, predictionRequest, atRiskRequest, metricsRequest]);
  }, [selectedCourseId]);

  React.useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const filteredRecentActivities = useMemo(() => {
    if (selectedCourse === "all") return recentActivities;

    return recentActivities.filter(
      (item) => normalizeCourseName(item.course_title || item.course_name) === selectedCourseName
    );
  }, [normalizeCourseName, recentActivities, selectedCourse, selectedCourseName]);

  const filteredCourseAnalytics = useMemo(() => {
    if (selectedCourse === "all") return courseAnalytics;

    return courseAnalytics.filter((item) => {
      if (selectedCourseId != null) return Number(item.course_id) === Number(selectedCourseId);
      return normalizeCourseName(item.course_title || item.course_name) === selectedCourseName;
    });
  }, [courseAnalytics, normalizeCourseName, selectedCourse, selectedCourseId, selectedCourseName]);

  const filteredStudentRiskList = useMemo(() => {
    if (selectedCourse === "all") return studentRiskList;

    return studentRiskList.filter((item) => {
      if (selectedCourseId != null) return Number(item.course_id) === Number(selectedCourseId);
      return normalizeCourseName(item.course_title || item.course_name) === selectedCourseName;
    });
  }, [normalizeCourseName, selectedCourse, selectedCourseId, selectedCourseName, studentRiskList]);

  const filteredAtRiskStudents = useMemo(() => {
    if (selectedCourse === "all") return atRiskStudents;

    return atRiskStudents.filter((item) => {
      if (selectedCourseId != null) return Number(item.course_id) === Number(selectedCourseId);
      return normalizeCourseName(item.course_title || item.course_name) === selectedCourseName;
    });
  }, [atRiskStudents, normalizeCourseName, selectedCourse, selectedCourseId, selectedCourseName]);

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
          row.failure_probability ?? row.risk_probability ?? row.probability_student_fails ?? row.risk_score ?? 0
        );
        const predictedOutcome = row.predicted_outcome || "Likely to Pass";
        const failureProbability = Math.max(0, Math.min(100, Math.round(failProbability * 100)));

        return {
          id: row.id,
          studentName: row.student_name || "Unknown Student",
          courseName: row.course_title || "Unknown Course",
          predictedOutcome,
          riskLevel: row.risk_level || "low",
          failureProbability,
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
      value: selectedCourse === "all" ? stats.total_students : filteredStudentRiskList.length,
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
              <option key={course.value} value={course.value}>
                {course.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(loadingState.summary ? [...Array(6)] : insightCards).map((card, index) => {
          if (loadingState.summary) {
            return <SectionShell key={index} className="h-32 rounded-xl" />;
          }
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

      {/* {loadingState.metrics ? <SectionShell className="h-72" /> : <ModelEvaluationPanel metrics={modelMetrics} />} */}

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
          {loadingState.activity ? <ChartShell title="Enrollment Trend" /> : <MemoEnrollmentChart data={enrollmentData} />}
          {loadingState.summary ? <ChartShell title="Completion Trend" /> : <MemoCompletionChart data={completionData} />}
          {loadingState.summary ? <ChartShell title="Engagement" /> : <MemoEngagementChart data={engagementData} />}
          {loadingState.predictions ? <ChartShell title="Performance" /> : <MemoPerformanceChart data={performanceData} />}
        </section>
      </Suspense>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-emerald-900">At-Risk Students</h3>
          {loadingState.atRisk ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, index) => (
                <SectionShell key={index} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : filteredAtRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-500">No at-risk students currently detected.</p>
          ) : (
            <ul className="space-y-2">
              {filteredAtRiskStudents.slice(0, 10).map((risk) => (
                <li
                  key={risk.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="font-medium text-gray-800">{risk.student_name}</span>
                  <span className="text-sm text-gray-600">
                    {Math.round(Number(risk.failure_probability || risk.risk_probability || risk.risk_score || 0) * 100)}% {risk.risk_level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-emerald-900">Course Analytics Summary</h3>
          {loadingState.summary ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <SectionShell key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : filteredCourseAnalytics.length === 0 ? (
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
          AI Prediction Table
        </h3>
        {loadingState.predictions ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <SectionShell key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {predictionRows.length >= 60 && (
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Showing the first 60 prediction rows for faster initial loading.
              </p>
            )}
            <PredictionTable
              rows={pagedPredictionRows}
              page={predictionPage}
              totalPages={totalPredictionPages}
              onPageChange={handlePredictionPageChange}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default memo(Analytics);
