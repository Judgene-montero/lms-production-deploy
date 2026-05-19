import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LuBookOpen,
  LuCalendarCheck2,
  LuClipboardCheck,
  LuFileSpreadsheet,
  LuGalleryVerticalEnd,
  LuGraduationCap,
  LuLayoutDashboard,
  LuMegaphone,
  LuMessageSquareText,
  LuSparkles,
  LuUsers,
  LuVideo,
} from "react-icons/lu";
import { authDelete, authGet, authPost } from "../../utils/api";
import MeetingsTab from "../../components/course/MeetingsTab";
import StudentClassworkModal from "./StudentClassworkModal";
import StudentInsightsPanel from "../../components/student/StudentInsightsPanel";
import CourseProgressBar from "../../components/student/CourseProgressBar";
import { getDefaultStudentAvatarDataUrl, resolveStudentAvatar } from "../../utils/studentProfile";
import {
  buildCourseProgress,
  buildEarlyWarnings,
  buildPerformanceSummary,
  getActivityScore,
  getActivityStatus as getStudentMetricStatus,
  getActivityTotalPoints,
  getLatestSubmittedQuizAttempt,
  getSubmissionForActivity,
  normalizeType,
} from "../../utils/studentMetrics";

const TAB_ITEMS = [
  { key: "stream", label: "Stream", icon: LuLayoutDashboard, accent: "from-emerald-600 to-teal-600" },
  { key: "lessons", label: "Lessons", icon: LuBookOpen, accent: "from-emerald-600 to-lime-600" },
  { key: "classwork", label: "Classwork", icon: LuClipboardCheck, accent: "from-emerald-700 to-green-600" },
  { key: "exams_quizzes", label: "Exams & Quizzes", icon: LuGalleryVerticalEnd, accent: "from-emerald-700 to-cyan-600" },
  { key: "meetings", label: "Meetings", icon: LuVideo, accent: "from-emerald-700 to-teal-500" },
  { key: "attendance", label: "Attendance", icon: LuCalendarCheck2, accent: "from-emerald-700 to-sky-600" },
  { key: "grades", label: "Grades", icon: LuFileSpreadsheet, accent: "from-emerald-700 to-teal-700" },
  { key: "people", label: "People", icon: LuUsers, accent: "from-emerald-700 to-green-700" },
  { key: "comments", label: "Comments", icon: LuMessageSquareText, accent: "from-emerald-700 to-slate-700" },
];

const CLASSWORK_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "missing", label: "Missing" },
  { key: "completed", label: "Completed" },
  { key: "graded", label: "Graded" },
];

const statCardClass =
  "rounded-[26px] border border-emerald-100/80 bg-[linear-gradient(145deg,rgba(255,255,255,1),rgba(240,253,250,0.96),rgba(248,250,252,0.98))] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] ring-1 ring-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_48px_rgba(16,185,129,0.10)]";

const tabClass = (isActive) =>
  `group flex min-w-[138px] items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-all duration-200 sm:min-w-[148px] sm:px-4 ${
    isActive
      ? "border-emerald-500/60 bg-[linear-gradient(135deg,rgba(5,150,105,0.98),rgba(13,148,136,0.98))] text-white shadow-[0_16px_36px_rgba(5,150,105,0.22)]"
      : "border-transparent bg-white/88 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(236,253,245,0.9))] hover:text-emerald-900 hover:shadow-md"
  }`;

const softPanelClass =
  "rounded-[26px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.82),rgba(248,250,252,0.98))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]";
const glassCardClass =
  "rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]";

const TabIntro = ({ icon: Icon, eyebrow, title, description }) => (
  <div className={softPanelClass}>
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-emerald-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">{eyebrow}</p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
    </div>
  </div>
);

const EmptyStateCard = ({ message }) => (
  <p className="rounded-[22px] border border-dashed border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60 p-5 text-sm text-slate-500">
    {message}
  </p>
);

const TabFallback = () => (
  <div className="space-y-3">
    {[...Array(4)].map((_, index) => (
      <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
    ))}
  </div>
);

const canReviewLatestQuizAttempt = (activity) => {
  const latestAttempt = getLatestSubmittedQuizAttempt(activity);
  return Boolean(latestAttempt?.allow_answer_review && latestAttempt?.status === "graded" && latestAttempt?.id);
};

const getDisplayTotalPoints = (activity) => {
  return getActivityTotalPoints(activity);
};

const getPointsBadgeValue = (activity) => {
  const type = normalizeType(activity?.activity_type_name || activity?.activity_type);
  if (type === "quiz" || type === "exam" || type === "exams_quizzes") {
    return getDisplayTotalPoints(activity);
  }
  return Number(activity?.points || 0);
};

const getScoreText = (activity) => {
  const latestAttempt = getLatestSubmittedQuizAttempt(activity);
  if (latestAttempt && latestAttempt.score !== null && latestAttempt.score !== undefined) {
    return `${latestAttempt.score} / ${latestAttempt.total_points ?? 0}`;
  }
  if (latestAttempt?.status === "pending_review") {
    return "Not graded yet";
  }
  if (canReviewLatestQuizAttempt(activity) && latestAttempt?.score === null) {
    return "Review available";
  }
  const submission = getSubmissionForActivity(activity);
  if (submission?.grade !== null && submission?.grade !== undefined) {
    return `${submission.grade} / ${getDisplayTotalPoints(activity)}`;
  }
  return "Not graded yet";
};

const getActivityStatus = (activity) => {
  const status = getStudentMetricStatus(activity);
  if (status.tone === "green") return status;
  if (status.tone === "amber") return { ...status, tone: "orange" };
  if (status.tone === "slate") return { ...status, tone: "gray" };
  return status;
};

const formatDateTime = (value, fallback = "No date") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString();
};

const formatDueText = (value) => formatDateTime(value, "No due date");

export default function StudentCourseDetails() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [activities, setActivities] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [people, setPeople] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");

  const [activeTab, setActiveTab] = useState("stream");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedClassworkFromStream, setSelectedClassworkFromStream] = useState(null);
  const [classworkFilter, setClassworkFilter] = useState("all");
  const [classworkSort, setClassworkSort] = useState("due_soon");

  const [loadingCourse, setLoadingCourse] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState("");

  const openStudentActivity = useCallback(
    (activity) => {
      const type = normalizeType(activity?.activity_type_name || activity?.activity_type);
      if (type === "quiz" || type === "exam" || type === "exams_quizzes") {
        navigate(`/student/dashboard/my-courses/${courseId}/exam/${activity.id}`);
        return;
      }
      setSelectedActivity(activity);
    },
    [courseId, navigate]
  );

  const fetchFirstSuccessful = useCallback(async (endpoints) => {
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await authGet(endpoint);
      } catch (requestError) {
        lastError = requestError;
      }
    }
    throw lastError || new Error("Request failed");
  }, []);

  const fetchCourse = useCallback(async () => {
    setLoadingCourse(true);
    setError("");
    try {
      const data = await fetchFirstSuccessful([
        `/api/courses/student/courses/${courseId}/`,
        `/api/courses/${courseId}/`,
      ]);
      setCourse(data || null);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load course.");
    } finally {
      setLoadingCourse(false);
    }
  }, [courseId, fetchFirstSuccessful]);

  const fetchActivities = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/student/courses/${courseId}/activities/`,
      `/api/courses/${courseId}/activities/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setActivities(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchAnnouncements = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/${courseId}/announcements/`,
      `/api/courses/student/courses/${courseId}/announcements/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setAnnouncements(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchLessons = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/student/courses/${courseId}/lessons/`,
      `/api/courses/${courseId}/lessons/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setLessons(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchAttendanceSessions = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/${courseId}/attendance/sessions/`,
      `/api/courses/student/courses/${courseId}/attendance/sessions/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setAttendanceSessions(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchPeople = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/${courseId}/students/`,
      `/api/courses/student/courses/${courseId}/students/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setPeople(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchComments = useCallback(async () => {
    const data = await fetchFirstSuccessful([
      `/api/courses/${courseId}/comments/`,
      `/api/courses/student/courses/${courseId}/comments/`,
    ]);
    const normalized = Array.isArray(data) ? data : [];
    setComments(normalized);
    return normalized;
  }, [courseId, fetchFirstSuccessful]);

  const fetchTabData = useCallback(async () => {
    setTabLoading(true);
    setError("");

    try {
      switch (activeTab) {
        case "stream":
          await Promise.all([fetchAnnouncements(), fetchActivities(), fetchLessons()]);
          break;
        case "lessons":
          await fetchLessons();
          break;
        case "classwork":
        case "exams_quizzes":
        case "grades":
          await fetchActivities();
          break;
        case "attendance":
          await fetchAttendanceSessions();
          break;
        case "people":
          await fetchPeople();
          break;
        case "comments":
          await fetchComments();
          break;
        default:
          break;
      }
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load tab data.");
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, fetchActivities, fetchAnnouncements, fetchAttendanceSessions, fetchComments, fetchLessons, fetchPeople]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  useEffect(() => {
    const requestedTab = location.state?.activeTab;
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [activeTab, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (activeTab !== "classwork" || !selectedClassworkFromStream) return;
    openStudentActivity(selectedClassworkFromStream);
    setSelectedClassworkFromStream(null);
  }, [activeTab, openStudentActivity, selectedClassworkFromStream]);

  const classworkActivities = useMemo(
    () => activities.filter((activity) => normalizeType(activity?.activity_type_name || activity?.activity_type) !== "announcement"),
    [activities]
  );

  const nonAttendanceActivities = useMemo(
    () => classworkActivities.filter((activity) => normalizeType(activity?.activity_type_name || activity?.activity_type) !== "attendance"),
    [classworkActivities]
  );

  const performanceSummary = useMemo(
    () => buildPerformanceSummary(nonAttendanceActivities),
    [nonAttendanceActivities]
  );

  const quizActivities = useMemo(
    () => classworkActivities.filter((activity) => {
      const type = normalizeType(activity?.activity_type_name || activity?.activity_type);
      return type === "quiz" || type === "exam" || type === "exams_quizzes";
    }),
    [classworkActivities]
  );

  const classworkProgress = useMemo(() => {
    const total = performanceSummary.totals.total;
    if (!total) return { total: 0, completed: 0, pending: 0, missing: 0, completedPct: 0, pendingPct: 0, missingPct: 0 };

    const counts = performanceSummary.rows.reduce((acc, row) => {
      if (row.status.key === "completed") acc.completed += 1;
      else if (row.status.key === "missing") acc.missing += 1;
      else acc.pending += 1;
      return acc;
    }, { completed: 0, pending: 0, missing: 0 });

    return {
      total,
      ...counts,
      completedPct: (counts.completed / total) * 100,
      pendingPct: (counts.pending / total) * 100,
      missingPct: (counts.missing / total) * 100,
    };
  }, [performanceSummary]);

  const computedCourseProgress = useMemo(
    () =>
      buildCourseProgress({
        activities: nonAttendanceActivities,
        lessons,
        fallbackProgress: Number(course?.progress ?? course?.completion_rate ?? 0),
      }),
    [course?.completion_rate, course?.progress, lessons, nonAttendanceActivities]
  );

  const courseProgress = useMemo(() => Number(computedCourseProgress.percentage || 0), [computedCourseProgress.percentage]);

  const quizAverage = useMemo(() => {
    const graded = quizActivities
      .map((activity) => {
        const score = getActivityScore(activity);
        const points = Number(getDisplayTotalPoints(activity) || 0);
        if (score === null || Number.isNaN(Number(score)) || points <= 0) return null;
        return (Number(score) / points) * 100;
      })
      .filter((value) => value !== null);

    if (!graded.length) return 0;
    return graded.reduce((sum, value) => sum + value, 0) / graded.length;
  }, [quizActivities]);

  const assignmentActivities = useMemo(
    () => nonAttendanceActivities.filter((activity) => {
      const type = normalizeType(activity?.activity_type_name || activity?.activity_type);
      return type !== "quiz" && type !== "exam";
    }),
    [nonAttendanceActivities]
  );

  const assignmentCompletion = useMemo(() => {
    if (!assignmentActivities.length) return 0;
    const submitted = assignmentActivities.filter((activity) => getActivityStatus(activity).key === "completed").length;
    return (submitted / assignmentActivities.length) * 100;
  }, [assignmentActivities]);

  const missingSubmissions = useMemo(
    () => performanceSummary.totals.missing,
    [performanceSummary.totals.missing]
  );

  const engagementScore = useMemo(
    () => Math.max(0, Math.min(100, Math.round(courseProgress * 0.6 + assignmentCompletion * 0.4))),
    [assignmentCompletion, courseProgress]
  );

  const earlyWarnings = useMemo(
    () => buildEarlyWarnings({ activities: nonAttendanceActivities, lessons }),
    [lessons, nonAttendanceActivities]
  );

  const statCards = useMemo(() => [
    { label: "Lessons", value: course?.lessons_count || 0, icon: LuBookOpen },
    { label: "Classwork", value: nonAttendanceActivities.length, icon: LuClipboardCheck },
    { label: "Quizzes", value: quizActivities.length, icon: LuGraduationCap },
    { label: "Progress", value: `${courseProgress.toFixed(0)}%`, icon: LuUsers },
  ], [course?.lessons_count, courseProgress, nonAttendanceActivities.length, quizActivities.length]);

  const lessonGroups = useMemo(() => {
    const grouped = lessons.reduce((acc, lesson) => {
      const key = lesson?.module_id || lesson?.module || "general";
      if (!acc[key]) {
        acc[key] = {
          key,
          title: lesson?.module_title || (key === "general" ? "General Lessons" : `Module ${key}`),
          lessons: [],
        };
      }
      acc[key].lessons.push(lesson);
      return acc;
    }, {});

    return Object.values(grouped).map((group) => ({
      ...group,
      lessons: [...group.lessons].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)),
    }));
  }, [lessons]);

  const streamItems = useMemo(() => {
    const formattedAnnouncements = announcements.map((item) => ({ ...item, itemType: "announcement", created_at: item.created_at }));
    const formattedClasswork = classworkActivities.map((item) => ({ ...item, itemType: "classwork", created_at: item.created_at }));
    return [...formattedAnnouncements, ...formattedClasswork].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [announcements, classworkActivities]);

  const visibleClassworkActivities = useMemo(() => {
    const filtered = classworkActivities.filter((activity) => {
      const status = getActivityStatus(activity);
      const score = getActivityScore(activity);

      switch (classworkFilter) {
        case "pending":
          return status.key === "pending";
        case "missing":
          return status.key === "missing";
        case "completed":
          return status.key === "completed";
        case "graded":
          return score !== null;
        default:
          return true;
      }
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftDue = left?.due_date ? new Date(left.due_date).getTime() : Number.POSITIVE_INFINITY;
      const rightDue = right?.due_date ? new Date(right.due_date).getTime() : Number.POSITIVE_INFINITY;
      const leftCreated = left?.created_at ? new Date(left.created_at).getTime() : 0;
      const rightCreated = right?.created_at ? new Date(right.created_at).getTime() : 0;
      const leftSubmitted = getSubmissionForActivity(left)?.submitted_at ? new Date(getSubmissionForActivity(left).submitted_at).getTime() : 0;
      const rightSubmitted = getSubmissionForActivity(right)?.submitted_at ? new Date(getSubmissionForActivity(right).submitted_at).getTime() : 0;

      switch (classworkSort) {
        case "recently_added":
          return rightCreated - leftCreated;
        case "recently_submitted":
          return rightSubmitted - leftSubmitted;
        case "title":
          return String(left?.title || "").localeCompare(String(right?.title || ""));
        case "due_soon":
        default:
          return leftDue - rightDue;
      }
    });

    return sorted;
  }, [classworkActivities, classworkFilter, classworkSort]);

  const refreshActivitiesAndSelection = useCallback(async (activityId) => {
    const refreshed = await fetchActivities();
    if (!activityId) return;
    const matched = refreshed.find((item) => Number(item.id) === Number(activityId)) || null;
    setSelectedActivity(matched);
  }, [fetchActivities]);

  const handleSubmitTask = useCallback(async (activityId, textAnswer = "", files = []) => {
    if (!activityId) return;
    try {
      const formData = new FormData();
      if (textAnswer) formData.append("text_answer", textAnswer);
      files.forEach((file) => formData.append("files", file));
      await authPost(`/api/courses/${courseId}/activities/${activityId}/submit/`, formData);
      await refreshActivitiesAndSelection(activityId);
    } catch (requestError) {
      console.error(requestError);
      alert("Submission failed.");
    }
  }, [courseId, refreshActivitiesAndSelection]);

  const handleSubmitQuiz = useCallback(async (activityId) => {
    if (!activityId) return;
    try {
      await refreshActivitiesAndSelection(activityId);
    } catch (requestError) {
      console.error(requestError);
      alert("Quiz submission failed.");
    }
  }, [refreshActivitiesAndSelection]);

  const handleUnsubmitTask = useCallback(async (submissionId) => {
    if (!submissionId || !selectedActivity?.id) return;
    try {
      await authDelete(`/api/courses/submissions/${submissionId}/delete/`);
      await refreshActivitiesAndSelection(selectedActivity.id);
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to unsubmit.");
    }
  }, [refreshActivitiesAndSelection, selectedActivity?.id]);

  const handleAttendance = useCallback(async (activityId) => {
    if (!activityId) return;
    try {
      await authPost(`/api/courses/${courseId}/activities/${activityId}/attendance/`);
      await fetchAttendanceSessions();
      await refreshActivitiesAndSelection(activityId);
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to mark attendance.");
    }
  }, [courseId, fetchAttendanceSessions, refreshActivitiesAndSelection]);

  const handleMarkAttendanceSession = useCallback(async (activityId, sessionId, status = "present") => {
    if (!activityId || !sessionId) return;
    try {
      await authPost(`/api/courses/${courseId}/activities/${activityId}/attendance/`, { session_id: sessionId, status });
      await fetchAttendanceSessions();
      await refreshActivitiesAndSelection(activityId);
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to mark attendance session.");
    }
  }, [courseId, fetchAttendanceSessions, refreshActivitiesAndSelection]);

  const handleCommentSubmit = useCallback(async () => {
    const message = commentDraft.trim();
    if (!message) return;
    try {
      await authPost(`/api/courses/${courseId}/comments/add/`, { message, comment: message });
      setCommentDraft("");
      await fetchComments();
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to post comment.");
    }
  }, [commentDraft, courseId, fetchComments]);

  const renderTabContent = () => {
    if (tabLoading && activeTab !== "lessons") return <TabFallback />;

    if (activeTab === "stream") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuSparkles}
            eyebrow="Course Feed"
            title="Learning Snapshot"
            description="Stay oriented with your latest updates, classwork, and the key signals that matter this week."
          />
          <div className={glassCardClass}>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed Work</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{performanceSummary.totals.completed}</p>
              </article>
              <article className="rounded-2xl border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Grade</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{quizAverage.toFixed(1)}%</p>
              </article>
              <article className="rounded-2xl border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Needs Attention</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{earlyWarnings.length}</p>
              </article>
            </div>
          </div>

          <StudentInsightsPanel
            quizAverage={performanceSummary.totals.graded > 0 ? performanceSummary.totals.overallPercentage : quizAverage}
            assignmentCompletion={assignmentCompletion}
            engagementScore={engagementScore}
            missingSubmissions={missingSubmissions}
            warnings={earlyWarnings}
          />

          {streamItems.length === 0 ? (
            <EmptyStateCard message="No posts yet." />
          ) : (
            streamItems.map((item) => (
              <article
                key={`${item.itemType}-${item.id}`}
                className="rounded-[24px] border border-emerald-100/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95),rgba(236,253,245,0.62))] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-700 shadow-sm">
                      {item.itemType === "announcement" ? <LuMegaphone className="h-5 w-5" /> : <LuClipboardCheck className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{item.itemType === "announcement" ? item.author_username || "Announcement" : "New Classwork"}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                    </div>
                  </div>
                </div>

                {item.itemType === "announcement" ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="whitespace-pre-line">{item.text || "No announcement text."}</p>
                    {item.file && <a href={item.file} target="_blank" rel="noreferrer" className="block text-blue-600 underline">Open File</a>}
                    {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="block text-blue-600 underline">Open Link</a>}
                  </div>
                ) : (
                  <div>
                    <h4 className="text-base font-semibold text-emerald-950">{item.title}</h4>
                    <p className="mt-1 text-sm text-gray-600">{item.description || "No description."}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{item.activity_type_name || item.activity_type || "Classwork"}</span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{getPointsBadgeValue(item)} pts</span>
                      {item.due_date && <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Due: {formatDateTime(item.due_date)}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const type = normalizeType(item?.activity_type_name || item?.activity_type);
                        if (type === "quiz" || type === "exam" || type === "exams_quizzes") {
                          openStudentActivity(item);
                          return;
                        }
                        setSelectedClassworkFromStream(item);
                        setActiveTab("classwork");
                      }}
                      className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                      Open Classwork
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      );
    }

    if (activeTab === "lessons") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuBookOpen}
            eyebrow="Learning Modules"
            title="Lessons"
            description="Each module is grouped into one clean card, so you can jump into the right lesson flow without extra clutter."
          />

          {lessonGroups.length === 0 ? (
            <EmptyStateCard message="No lessons available yet." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {lessonGroups.map((group) => {
                const firstLesson = group.lessons[0];
                const lessonCount = group.lessons.length;

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/student/dashboard/my-courses/${courseId}/lessons?lessonId=${firstLesson?.id || ""}&moduleId=${group.key}`
                      )
                    }
                    className="rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.98),rgba(236,253,245,0.74),rgba(248,250,252,0.98))] p-5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_20px_44px_rgba(16,185,129,0.12)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{group.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-500 line-clamp-2">
                          {firstLesson?.description || firstLesson?.content || "Open this module to start learning."}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                        Module
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "classwork") {
      const recentlySubmitted = performanceSummary.rows
        .filter((row) => row.submittedAt)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

      const nextDeadline = performanceSummary.rows
        .filter((row) => row.status.key !== "completed" && row.dueDate)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

      return (
        <section className="space-y-6">
          <TabIntro
            icon={LuClipboardCheck}
            eyebrow="Work Tracker"
            title="Classwork"
            description="Focus on what is submitted, what still needs attention, and the next best action without getting buried in a long list."
          />
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <article className={glassCardClass}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Submission Overview</h3>
                  <p className="mt-1 text-sm text-gray-600">Track completed work, unfinished tasks, and where to focus next.</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Completion Rate</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{classworkProgress.completedPct.toFixed(0)}%</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Completed</p>
                  <p className="mt-2 text-2xl font-bold text-green-900">{classworkProgress.completed}</p>
                  <p className="mt-1 text-sm text-green-800">Submitted or graded activities.</p>
                </article>
                <article className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pending</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{classworkProgress.pending}</p>
                  <p className="mt-1 text-sm text-gray-700">Activities still waiting for submission.</p>
                </article>
                <article className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Missing</p>
                  <p className="mt-2 text-2xl font-bold text-red-900">{classworkProgress.missing}</p>
                  <p className="mt-1 text-sm text-red-800">Past-due items that need attention.</p>
                </article>
              </div>
            </article>

            <article className={glassCardClass}>
              <h3 className="text-lg font-semibold text-gray-900">Next Actions</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next Deadline</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{nextDeadline?.title || "No pending deadlines"}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {nextDeadline?.dueDate ? formatDueText(nextDeadline.dueDate) : "Everything currently due is already completed."}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest Submission</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{recentlySubmitted?.title || "No submissions yet"}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {recentlySubmitted?.submittedAt ? formatDateTime(recentlySubmitted.submittedAt) : "Submit your first classwork to start tracking progress."}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Suggested Focus</p>
                  <p className="mt-2 text-sm text-amber-900">
                    {classworkProgress.missing > 0
                      ? "Start with missing activities first, then clear pending work with the nearest deadline."
                      : classworkProgress.pending > 0
                      ? "You are on track. Finish the pending items with the nearest due dates next."
                      : "Classwork is fully up to date. Review feedback and graded work when available."}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className={glassCardClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Classwork List</h3>
                <p className="mt-1 text-sm text-gray-600">Filter and sort your activities without losing the overview at the top.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {CLASSWORK_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setClassworkFilter(filter.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        classworkFilter === filter.key
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <select
                  value={classworkSort}
                  onChange={(event) => setClassworkSort(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="due_soon">Sort: Nearest due date</option>
                  <option value="recently_added">Sort: Recently added</option>
                  <option value="recently_submitted">Sort: Recently submitted</option>
                  <option value="title">Sort: Title</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <p>
                Showing <span className="font-semibold text-slate-900">{visibleClassworkActivities.length}</span> of{" "}
                <span className="font-semibold text-slate-900">{classworkActivities.length}</span> activities
              </p>
              <p className="hidden sm:block">The list below scrolls independently when there are many items.</p>
            </div>
          </section>

          <section className="max-h-[72vh] overflow-y-auto rounded-[24px] border border-emerald-100/70 bg-gradient-to-br from-white/70 to-emerald-50/40 p-2 pr-1">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleClassworkActivities.length === 0 ? (
              <p className="rounded-[22px] border border-dashed border-emerald-200 bg-white p-5 text-sm text-slate-500 lg:col-span-2">
                No classwork matches the current filter.
              </p>
            ) : (
              visibleClassworkActivities.map((activity) => {
                const submission = getSubmissionForActivity(activity);
                const status = getActivityStatus(activity);
                const statusToneClass =
                  status.tone === "green"
                    ? "bg-green-100 text-green-700"
                    : status.tone === "orange"
                    ? "bg-orange-100 text-orange-700"
                    : status.tone === "gray"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-red-100 text-red-700";

                return (
                  <article key={activity.id} className="rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95),rgba(236,253,245,0.56))] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-emerald-200 hover:shadow-[0_20px_44px_rgba(16,185,129,0.10)]">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-gray-900">{activity.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{activity.activity_type_name || activity.activity_type || "Classwork"}</p>
                      </div>
                      <button type="button" onClick={() => openStudentActivity(activity)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700">Open</button>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{activity.activity_type_name || activity.activity_type || "Classwork"}</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{getPointsBadgeValue(activity)} pts</span>
                      <span className={`rounded-full px-2.5 py-1 ${statusToneClass}`}>{status.label}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Posted</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{formatDateTime(activity.created_at, "Not available")}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{formatDueText(activity.due_date)}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submission</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{submission?.submitted_at ? formatDateTime(submission.submitted_at) : "Not submitted"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Grade</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{getScoreText(activity)}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Feedback</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{submission?.feedback || "No feedback yet"}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
            </div>
          </section>
        </section>
      );
    }

    if (activeTab === "exams_quizzes") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuGalleryVerticalEnd}
            eyebrow="Assessments"
            title="Exams & Quizzes"
            description="Open assessments, revisit graded attempts, and see availability in a cleaner, more focused layout."
          />
          {quizActivities.length === 0 ? (
            <EmptyStateCard message="No quizzes available yet." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {quizActivities.map((quiz) => {
                const submission = getSubmissionForActivity(quiz);
                const latestAttempt = getLatestSubmittedQuizAttempt(quiz);
                const reviewEnabled = canReviewLatestQuizAttempt(quiz);
                return (
                  <article key={quiz.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-emerald-50/30 p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                    <h4 className="text-base font-semibold text-gray-900">{quiz.title}</h4>
                    <p className="mt-1 text-sm text-gray-500">Due: {formatDueText(quiz.due_date)}</p>
                    <p className="mt-2 text-sm text-gray-700">
                      Status: {latestAttempt?.status === "pending_review" ? "Submitted" : submission ? "Submitted" : "Pending"} | Points: {getDisplayTotalPoints(quiz)}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">Score: {getScoreText(quiz)}</p>
                    {reviewEnabled ? (
                      <p className="mt-2 text-sm text-emerald-700">
                        Detailed review is available for this graded attempt.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openStudentActivity(quiz)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        {submission ? "View Quiz" : "Start Quiz"}
                      </button>
                      {reviewEnabled ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/student/dashboard/my-courses/${courseId}/exam/${quiz.id}/review?attempt_id=${latestAttempt.id}`)}
                          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Review Answers
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "meetings") {
      return <MeetingsTab courseId={courseId} isInstructor={false} />;
    }

    if (activeTab === "attendance") {
      const statusCount = attendanceSessions.reduce(
        (acc, session) => {
          const status = String(session?.my_record?.status || "").toLowerCase();
          if (status === "present") acc.present += 1;
          else if (status === "late") acc.late += 1;
          else if (status === "absent") acc.absent += 1;
          else if (status === "excused") acc.excused += 1;
          else acc.unmarked += 1;
          return acc;
        },
        { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 }
      );

      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuCalendarCheck2}
            eyebrow="Participation"
            title="Attendance Sessions"
            description="Review your attendance record and understand your session status with a layout that is easier to skim."
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <article className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Present</p>
              <p className="text-xl font-bold text-emerald-700">{statusCount.present}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-orange-50/50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Late</p>
              <p className="text-xl font-bold text-orange-600">{statusCount.late}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-red-50/50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Absent</p>
              <p className="text-xl font-bold text-red-600">{statusCount.absent}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-blue-50/50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Excused</p>
              <p className="text-xl font-bold text-blue-600">{statusCount.excused}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unmarked</p>
              <p className="text-xl font-bold text-gray-700">{statusCount.unmarked}</p>
            </article>
          </div>
          {attendanceSessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">No attendance sessions available.</p>
          ) : (
            <div className="space-y-3">
              {attendanceSessions.map((session) => {
                const status = String(session?.my_record?.status || "").toLowerCase();
                const statusClass = status === "present" ? "bg-green-100 text-green-700" : status === "late" ? "bg-orange-100 text-orange-700" : status === "absent" ? "bg-red-100 text-red-700" : status === "excused" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700";
                return (
                  <article key={session.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{session.topic || "Attendance"}</p>
                        <p className="text-sm text-gray-500">{formatDateTime(session.date, "No date")}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{status ? status.toUpperCase() : "NOT MARKED"}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">Points Earned: {session?.my_record?.points_earned ?? 0}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "grades") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuFileSpreadsheet}
            eyebrow="Performance"
            title="Performance Summary"
            description="See grades, completion, and scored points in one modern summary that is easier to read at a glance."
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm">
              <p className="text-sm text-gray-500">Overall Grade</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{performanceSummary.totals.overallPercentage.toFixed(0)}%</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{performanceSummary.totals.completed}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{performanceSummary.totals.pending}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-red-50/40 p-4 shadow-sm">
              <p className="text-sm text-gray-500">Missing</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{performanceSummary.totals.missing}</p>
            </article>
          </section>

          {performanceSummary.rows.length === 0 ? (
            <EmptyStateCard message="No activities available yet." />
          ) : (
            <div className="overflow-x-auto rounded-[24px] border border-emerald-100/80 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(248,250,252,0.9))] text-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Activity</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Due</th>
                    <th className="px-4 py-2 text-left">Score</th>
                    <th className="px-4 py-2 text-left">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceSummary.rows.map((row) => {
                    const pct = row.percentage !== null ? `${row.percentage.toFixed(1)}%` : "-";
                    return (
                      <tr key={row.id} className="border-t border-emerald-50 bg-white transition hover:bg-emerald-50/35">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.title}</td>
                        <td className="px-4 py-3 text-slate-600">{row.type}</td>
                        <td className="px-4 py-3 text-slate-600">{row.status.label}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDueText(row.dueDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{row.score !== null ? `${row.score} / ${row.maxScore || 0} (${pct})` : "Not graded"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.feedback || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Course Completion</h4>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{courseProgress.toFixed(0)}%</p>
              <CourseProgressBar value={courseProgress} className="mt-3" />
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Scored Points</h4>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {performanceSummary.totals.totalScored.toFixed(0)} / {performanceSummary.totals.totalPossible.toFixed(0)}
              </p>
              <p className="mt-2 text-sm text-gray-600">This updates as more activities receive grades.</p>
            </article>
          </section>
        </section>
      );
    }

    if (activeTab === "people") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuUsers}
            eyebrow="Class Roster"
            title="People"
            description="See who is in the course with a friendlier roster layout that still keeps the same academic theme."
          />
          {people.length === 0 ? (
            <EmptyStateCard message="No roster data yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {people.map((person) => (
                <article key={person.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-emerald-50/25 p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveStudentAvatar(person) || getDefaultStudentAvatarDataUrl({ name: person.username || person.name })}
                      alt={person.username || person.name || "User"}
                      className="h-10 w-10 rounded-full object-cover ring-1 ring-emerald-100"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{person.username || person.name || "Unknown"}</p>
                      <p className="text-sm text-gray-500">{String(person.role || "student").toUpperCase()}</p>
                      <p className="text-xs text-gray-500">ID: {person.school_id || "N/A"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "comments") {
      return (
        <section className="space-y-4">
          <TabIntro
            icon={LuMessageSquareText}
            eyebrow="Discussion"
            title="Comments"
            description="Ask questions and share updates in a conversation space that feels more intentional and easier to follow."
          />
          <div className={glassCardClass}>
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              className="min-h-[96px] w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              placeholder="Share a question or course comment..."
            />
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={handleCommentSubmit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">Post Comment</button>
            </div>
          </div>

          {comments.length === 0 ? (
            <EmptyStateCard message="No comments yet." />
          ) : (
            comments.map((comment) => (
              <article key={comment.id} className="rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(236,253,245,0.52),rgba(248,250,252,0.98))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-start gap-3">
                  <img
                    src={resolveStudentAvatar(comment) || getDefaultStudentAvatarDataUrl({ name: comment.user || comment.username || "User" })}
                    alt={comment.user || comment.username || "User"}
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-emerald-100"
                  />
                  <div>
                    <p className="text-sm text-gray-700">{comment.message || comment.comment || comment.text || "(empty)"}</p>
                    <p className="mt-1 text-xs text-gray-500">{comment.user || comment.username || "User"} | {formatDateTime(comment.created_at)}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      );
    }

    return null;
  };

  if (loadingCourse) {
    return (
      <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-emerald-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !course) return <p className="p-4 text-red-600">{error}</p>;
  if (!course) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.10),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_26%,_#f8fafc_100%)] px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-6 rounded-[32px] border border-emerald-100/80 bg-white/84 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-6 md:p-8">
        <header className="overflow-hidden rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.90),rgba(240,253,250,0.82),rgba(248,250,252,0.98))] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/85 bg-white/82 px-3 py-2 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#059669,#0f766e)] text-white shadow-sm">
                  <LuBookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Course Workspace</p>
                  <p className="text-xs text-slate-500">Student learning view</p>
                </div>
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{course.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{course.description || "No description provided."}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <p className="inline-flex rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                Instructor: <span className="ml-1 font-semibold text-slate-800">{course?.instructor_name || course?.instructor?.username || "Instructor"}</span>
                </p>
                <p className="inline-flex rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1.5 text-sm text-emerald-800 shadow-sm">
                  Progress: <span className="ml-1 font-semibold">{courseProgress.toFixed(0)}%</span>
                </p>
                <Link
                  to={`/courses/${courseId}/meetings`}
                  className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Meetings
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:min-w-[240px]">
              <div className="rounded-2xl border border-white/80 bg-white/78 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{courseProgress.toFixed(0)}%</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/78 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activities</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{nonAttendanceActivities.length}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className={statCardClass}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                  <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-950">{card.value}</p>
              </article>
            );
          })}
        </section>

        <nav className="sticky top-3 z-20 rounded-[26px] border border-emerald-100/80 bg-white/92 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="responsive-scroll">
            <div className="flex gap-2 pb-1">
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              return (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={tabClass(activeTab === tab.key)}>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    activeTab === tab.key
                      ? "bg-white/18 text-white"
                      : "bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,250,0.95))] text-emerald-700 group-hover:text-emerald-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{tab.label}</span>
                  <span className={`block text-xs ${activeTab === tab.key ? "text-emerald-50/90" : "text-slate-500"}`}>
                    {tab.key === "stream"
                      ? "Updates"
                      : tab.key === "lessons"
                      ? "Modules"
                      : tab.key === "classwork"
                      ? "Tasks"
                      : tab.key === "exams_quizzes"
                      ? "Assessments"
                      : tab.key === "meetings"
                      ? "Sessions"
                      : tab.key === "attendance"
                      ? "Sessions"
                      : tab.key === "grades"
                      ? "Scores"
                      : tab.key === "people"
                      ? "Roster"
                      : "Discussion"}
                  </span>
                </span>
              </button>
            );
            })}
            </div>
          </div>
        </nav>

        <section className="rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(240,253,250,0.68))] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {["Clean layout", "Focused learning", "Modern academic theme"].map((chip) => (
              <span key={chip} className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {chip}
              </span>
            ))}
          </div>
          {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {renderTabContent()}
        </section>
      </div>

      {selectedActivity && (
        <StudentClassworkModal
          courseId={courseId}
          activity={selectedActivity}
          submission={getSubmissionForActivity(selectedActivity)}
          attendanceSessions={attendanceSessions}
          onClose={() => setSelectedActivity(null)}
          onSubmitTask={handleSubmitTask}
          onSubmitQuiz={handleSubmitQuiz}
          onMarkAttendance={handleAttendance}
          onMarkAttendanceSession={handleMarkAttendanceSession}
          onUnsubmit={handleUnsubmitTask}
        />
      )}
    </div>
  );
}
