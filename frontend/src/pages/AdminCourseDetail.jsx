import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, Clock3, FileText, GraduationCap, Layers3, ShieldAlert, Trash2, UserRound } from "lucide-react";
import AdminPanel from "../components/admin/AdminPanel";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "modules", label: "Modules" },
  { key: "lessons", label: "Lessons" },
  { key: "activities", label: "Classwork / Activities" },
  { key: "quizzes", label: "Quizzes" },
  { key: "attendance", label: "Attendance" },
  { key: "submissions", label: "Submissions / Grades" },
];

const fmtDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const toDisplayText = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [activities, setActivities] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [gradeSheet, setGradeSheet] = useState([]);
  const [gradeSheetError, setGradeSheetError] = useState("");
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [attendanceUnavailable, setAttendanceUnavailable] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsNotice, setSubmissionsNotice] = useState("");
  const [submissionsRows, setSubmissionsRows] = useState([]);
  const [deleteState, setDeleteState] = useState({
    open: false,
    type: "",
    id: null,
    label: "",
    loading: false,
  });

  const loadCourseData = useCallback(async () => {
    setLoading(true);
    setNotice("");
    setGradeSheetError("");
    setAttendanceUnavailable("");

    try {
      const [courseRes, modulesRes, activitiesRes, quizzesRes, gradeSheetRes, attendanceRes] = await Promise.allSettled([
        axios.get(`/api/courses/${courseId}/`),
        axios.get(`/api/courses/${courseId}/modules/`),
        axios.get(`/api/courses/${courseId}/activities/`),
        axios.get(`/api/courses/${courseId}/exam-quizzes/`),
        axios.get(`/api/courses/${courseId}/gradesheet/`),
        axios.get(`/api/courses/${courseId}/attendance/sessions/`),
      ]);

      if (courseRes.status === "fulfilled") {
        setCourse(courseRes.value.data || null);
      } else {
        throw new Error(courseRes.reason?.response?.data?.error || "Failed to load course details.");
      }

      if (modulesRes.status === "fulfilled") {
        const nextModules = Array.isArray(modulesRes.value.data) ? modulesRes.value.data : [];
        setModules(nextModules);
        setSelectedModuleId((prev) => prev || nextModules[0]?.id || null);
      } else {
        setModules([]);
      }

      if (activitiesRes.status === "fulfilled") {
        const nextActivities = Array.isArray(activitiesRes.value.data) ? activitiesRes.value.data : [];
        setActivities(nextActivities);
        setSelectedActivityId((prev) => prev || String(nextActivities[0]?.id || ""));
      } else {
        setActivities([]);
      }

      if (quizzesRes.status === "fulfilled") {
        setQuizzes(Array.isArray(quizzesRes.value.data) ? quizzesRes.value.data : []);
      } else {
        setQuizzes([]);
      }

      if (gradeSheetRes.status === "fulfilled") {
        setGradeSheet(Array.isArray(gradeSheetRes.value.data) ? gradeSheetRes.value.data : []);
      } else {
        setGradeSheet([]);
        setGradeSheetError(gradeSheetRes.reason?.response?.data?.error || "Grade sheet is not available for this course.");
      }

      if (attendanceRes.status === "fulfilled") {
        const sessions = Array.isArray(attendanceRes.value.data) ? attendanceRes.value.data : [];
        setAttendanceSessions(sessions);
        const hasAdminVisibleRecords = sessions.some((session) => Array.isArray(session.records) && session.records.length > 0);
        if (!hasAdminVisibleRecords) {
          setAttendanceUnavailable("Attendance sessions exist, but detailed attendance records are not currently exposed to admins by the backend serializer.");
        }
      } else {
        setAttendanceSessions([]);
        setAttendanceUnavailable(attendanceRes.reason?.response?.data?.error || "Attendance data is not available yet.");
      }
    } catch (error) {
      setNotice(error.message || "Failed to load admin course detail page.");
      setCourse(null);
      setModules([]);
      setActivities([]);
      setQuizzes([]);
      setGradeSheet([]);
      setAttendanceSessions([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourseData();
  }, [loadCourseData]);

  useEffect(() => {
    setSubmissionsRows([]);
    setSubmissionsNotice("");
  }, [selectedActivityId]);

  const allLessons = useMemo(
    () =>
      modules.flatMap((module) =>
        (module.lessons || []).map((lesson) => ({
          ...lesson,
          moduleTitle: module.title,
          moduleId: module.id,
        }))
      ),
    [modules]
  );

  const selectedModule = useMemo(
    () => modules.find((module) => Number(module.id) === Number(selectedModuleId)) || null,
    [modules, selectedModuleId]
  );

  const selectedActivity = useMemo(
    () => activities.find((activity) => String(activity.id) === String(selectedActivityId)) || null,
    [activities, selectedActivityId]
  );

  const deleteContent = async () => {
    if (!deleteState.type || !deleteState.id) return;

    setDeleteState((prev) => ({ ...prev, loading: true }));
    try {
      await axios.delete(`/api/courses/admin/content/${deleteState.type}/${deleteState.id}/`);
      setNotice(`${deleteState.label} deleted successfully.`);
      setDeleteState({ open: false, type: "", id: null, label: "", loading: false });

      if (deleteState.type === "lesson") {
        setModules((prev) =>
          prev.map((module) => ({
            ...module,
            lessons: (module.lessons || []).filter((lesson) => lesson.id !== deleteState.id),
          }))
        );
        setSelectedLesson((prev) => (prev?.id === deleteState.id ? null : prev));
      }

      if (deleteState.type === "activity") {
        setActivities((prev) => prev.filter((activity) => activity.id !== deleteState.id));
        setQuizzes((prev) => prev.filter((quiz) => quiz.id !== deleteState.id));
        setSubmissionsRows([]);
        setSelectedActivityId((prev) => (String(deleteState.id) === String(prev) ? "" : prev));
      }
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to delete content.");
      setDeleteState((prev) => ({ ...prev, loading: false }));
    }
  };

  const requestDelete = (type, id, label) => {
    setDeleteState({
      open: true,
      type,
      id,
      label,
      loading: false,
    });
  };

  const loadSubmissions = async (activityId) => {
    if (!activityId) {
      setSubmissionsNotice("Choose an activity first.");
      return;
    }

    setSubmissionsLoading(true);
    setSubmissionsNotice("");
    try {
      const response = await axios.get(`/api/courses/${courseId}/activities/${activityId}/submissions/`);
      setSubmissionsRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setSubmissionsRows([]);
      setSubmissionsNotice(error.response?.data?.error || "Submissions are not available for this activity.");
    } finally {
      setSubmissionsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/courses" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Admin Course Detail</h1>
          <p className="mt-2 text-sm text-slate-500">Centralized academic content review for admins using existing LMS APIs.</p>
        </div>
        <button
          type="button"
          onClick={loadCourseData}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Refresh
        </button>
      </div>

      {notice ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
          Loading course detail...
        </div>
      ) : !course ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
          Course data is not available.
        </div>
      ) : (
        <>
          {activeTab === "overview" ? (
            <AdminPanel title="Course Overview" eyebrow="Overview" description="High-level course metadata available to admin through the existing course detail endpoint.">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                <div>
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="h-56 w-full rounded-3xl object-cover" />
                  ) : (
                    <div className="flex h-56 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                      No thumbnail
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Title</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{course.title}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Layers3 className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Category</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{course.category?.name || "Uncategorized"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Description</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{course.description || "No description provided."}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <UserRound className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Instructor</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{course.instructor?.username || "Unknown instructor"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <ShieldAlert className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Status</p>
                    </div>
                    <p className="mt-2 text-sm capitalize text-slate-600">{course.status || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Start Date</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{fmtDate(course.start_date)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">End Date</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{fmtDate(course.end_date)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Clock3 className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Start Time</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{toDisplayText(course.start_time)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Student Count</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{toDisplayText(course.students_count, "0")}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Academic Totals</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Modules: {toDisplayText(course.modules_count, "0")} | Lessons: {toDisplayText(course.lessons_count, "0")}
                    </p>
                  </div>
                </div>
              </div>
            </AdminPanel>
          ) : null}

          {activeTab === "modules" ? (
            <AdminPanel title="Modules" eyebrow="Course Structure" description="Modules and nested lessons from the existing course modules endpoint.">
              {modules.length === 0 ? (
                <p className="text-sm text-slate-500">No modules found for this course.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                  <div className="space-y-3">
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => setSelectedModuleId(module.id)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          Number(selectedModuleId) === Number(module.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{module.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{(module.lessons || []).length} lesson(s)</p>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-5">
                    {!selectedModule ? (
                      <p className="text-sm text-slate-500">Select a module to inspect its lessons.</p>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">{selectedModule.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{selectedModule.description || "No module description."}</p>
                        </div>
                        {(selectedModule.lessons || []).length === 0 ? (
                          <p className="text-sm text-slate-500">No lessons inside this module.</p>
                        ) : (
                          (selectedModule.lessons || []).map((lesson) => (
                            <div key={lesson.id} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-900">{lesson.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{lesson.file_url ? "File-backed lesson" : "Text lesson"}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedLesson(lesson)}
                                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDelete("lesson", lesson.id, `Lesson "${lesson.title}"`)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {selectedLesson?.id === lesson.id ? (
                                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                                  <p><span className="font-medium text-slate-900">Description:</span> {lesson.description || "No description."}</p>
                                  <p className="mt-2"><span className="font-medium text-slate-900">Content:</span> {lesson.content || "No text content available."}</p>
                                  <p className="mt-2"><span className="font-medium text-slate-900">File URL:</span> {lesson.file_url || "No file attached."}</p>
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeTab === "lessons" ? (
            <AdminPanel title="Lessons" eyebrow="All Lessons" description="Flattened lesson view across the entire course.">
              {allLessons.length === 0 ? (
                <p className="text-sm text-slate-500">No lessons found for this course.</p>
              ) : (
                <div className="space-y-3">
                  {allLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Module: {lesson.moduleTitle} • Type: {lesson.file_url ? "File" : "Text"}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{lesson.description || lesson.content || "No lesson summary available."}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestDelete("lesson", lesson.id, `Lesson "${lesson.title}"`)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeTab === "activities" ? (
            <AdminPanel title="Classwork / Activities" eyebrow="Course Activities" description="Activities from the existing course activities endpoint.">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500">No activities found for this course.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{activity.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {activity.activity_type_name || "Activity"} • Due: {fmtDateTime(activity.due_date)} • Points: {toDisplayText(activity.points, "Ungraded")}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{activity.description || "No activity description."}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestDelete("activity", activity.id, `Activity "${activity.title}"`)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeTab === "quizzes" ? (
            <AdminPanel title="Quizzes" eyebrow="Quiz Activities" description="Quiz list from the existing exam-quizzes endpoint.">
              {quizzes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No quizzes returned by `/api/courses/{courseId}/exam-quizzes/`.
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <p className="font-semibold text-slate-900">{quiz.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Assessment: {quiz.assessment_type || "quiz"} • Publish State: {quiz.publish_state || "-"} • Time Limit: {toDisplayText(quiz.quiz_time_limit_seconds, "N/A")}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{quiz.description || "No quiz description."}</p>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeTab === "attendance" ? (
            <AdminPanel title="Attendance" eyebrow="Session View" description="Attendance session list exists, but detailed attendance records are not currently exposed to admin users.">
              {attendanceUnavailable ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  {attendanceUnavailable}
                  <p className="mt-2">Backend endpoint needed for full admin support: a read-safe admin attendance records endpoint or serializer support for admin access to session records.</p>
                </div>
              ) : null}
              {attendanceSessions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No attendance sessions found for this course.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {attendanceSessions.map((session) => (
                    <div key={session.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <p className="font-semibold text-slate-900">{session.topic}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Date: {fmtDate(session.date)} • Created By: {session.created_by_username || "-"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Admin-visible records in current response: {Array.isArray(session.records) ? session.records.length : 0}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeTab === "submissions" ? (
            <AdminPanel title="Submissions / Grades" eyebrow="Academic Review" description="Uses the existing grade sheet endpoint plus per-activity submission lists.">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Grade Sheet</h3>
                  {gradeSheetError ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {gradeSheetError}
                    </div>
                  ) : gradeSheet.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No grade rows available.</p>
                  ) : (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Final Grade</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gradeSheet.map((row) => (
                              <tr key={row.student_id} className="border-t border-slate-200">
                                <td className="px-4 py-3 text-slate-700">{row.student_name}</td>
                                <td className="px-4 py-3 text-slate-700">{toDisplayText(row.final_grade, "0")}</td>
                                <td className="px-4 py-3 text-slate-700">{row.status}</td>
                                <td className="px-4 py-3 text-slate-700">{row.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">Activity Submissions</h3>
                    <select
                      value={selectedActivityId}
                      onChange={(event) => setSelectedActivityId(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <option value="">Select activity</option>
                      {activities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => loadSubmissions(selectedActivityId)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Load Submissions
                    </button>
                  </div>

                  {selectedActivity ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Showing submissions for: <span className="font-medium text-slate-700">{selectedActivity.title}</span>
                    </p>
                  ) : null}

                  {submissionsNotice ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {submissionsNotice}
                    </div>
                  ) : null}

                  {submissionsLoading ? (
                    <p className="mt-3 text-sm text-slate-500">Loading submissions...</p>
                  ) : submissionsRows.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No submissions loaded yet.</p>
                  ) : (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Grade</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {submissionsRows.map((row) => (
                              <tr key={row.id} className="border-t border-slate-200">
                                <td className="px-4 py-3 text-slate-700">{row.student_username || "-"}</td>
                                <td className="px-4 py-3 text-slate-700">{fmtDateTime(row.submitted_at)}</td>
                                <td className="px-4 py-3 text-slate-700">{toDisplayText(row.grade, "Not graded")}</td>
                                <td className="px-4 py-3 text-slate-700">{row.is_late ? "Late" : "On time"}</td>
                                <td className="px-4 py-3 text-slate-700">{row.link || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AdminPanel>
          ) : null}
        </>
      )}

      <ConfirmDeleteModal
        open={deleteState.open}
        onCancel={() => setDeleteState({ open: false, type: "", id: null, label: "", loading: false })}
        onConfirm={deleteContent}
        loading={deleteState.loading}
        title="Delete Course Content"
        confirmLabel="Delete"
        text={deleteState.label ? `Delete ${deleteState.label}? This action cannot be undone.` : "Delete this content item?"}
      />
    </div>
  );
}
