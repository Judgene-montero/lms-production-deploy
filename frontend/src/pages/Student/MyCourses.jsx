import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuBookOpen, LuDoorOpen, LuGraduationCap, LuLayers3, LuSparkles, LuTrendingUp } from "react-icons/lu";
import { authGet } from "../../utils/api";
import axios from "../../utils/axiosInstance";
import CourseProgressBar from "../../components/student/CourseProgressBar";
import { buildCourseProgress } from "../../utils/studentMetrics";

const getProgress = (course) => Number(course?.computedProgress ?? course?.progress ?? course?.completion_rate ?? 0);

const toDateText = (value) => {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return date.toLocaleString();
};

const getProgressLabel = (progress) => {
  if (progress >= 100) return "Completed";
  if (progress >= 70) return "On track";
  if (progress > 0) return "In progress";
  return "Not started";
};

const formatCourseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const getInstructorDisplayName = (course = {}) => {
  const directName =
    course?.instructor_name ||
    course?.teacher_name ||
    course?.instructor_info?.name ||
    course?.instructor?.name ||
    course?.instructor?.username ||
    "";

  const normalized = String(directName || "").trim();
  if (!normalized) return "Instructor unavailable";
  if (/^\d+$/.test(normalized)) return "Instructor unavailable";
  return normalized;
};

const pageCardClass =
  "rounded-[28px] border border-slate-200 bg-white shadow-sm md:border-emerald-100/80 md:bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(240,253,250,0.88),rgba(248,250,252,0.98))] md:shadow-[0_20px_48px_rgba(15,23,42,0.05)]";

const getStatusTone = (progress) => {
  if (progress >= 100) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (progress >= 70) return "bg-teal-100 text-teal-800 border-teal-200";
  if (progress > 0) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

export default function MyCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseMeta, setCourseMeta] = useState({});
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const enrichCourses = useCallback(async (list = []) => {
    if (!Array.isArray(list) || list.length === 0) {
      setCourseMeta({});
      return;
    }

    const details = await Promise.all(
      list.map(async (course) => {
        try {
          const [activities, lessons] = await Promise.all([
            authGet(`/api/courses/student/courses/${course.id}/activities/`),
            authGet(`/api/courses/student/courses/${course.id}/lessons/`),
          ]);
          const activityList = Array.isArray(activities) ? activities : [];
          const lessonList = Array.isArray(lessons) ? lessons : [];
          const computedProgress = buildCourseProgress({
            activities: activityList,
            lessons: lessonList,
            fallbackProgress: getProgress(course),
          });

          return [
            course.id,
            {
              lessonsCount: lessonList.length,
              activitiesCount: computedProgress.totalActivities,
              completionPct: computedProgress.percentage,
              completedItems: computedProgress.completedItems,
              totalItems: computedProgress.totalItems,
              lastAccessed:
                course?.last_accessed || course?.updated_at || activityList[0]?.created_at || lessonList[0]?.created_at || null,
            },
          ];
        } catch {
          return [
            course.id,
            {
              lessonsCount: Number(course?.lessons_count || 0),
              activitiesCount: 0,
              completionPct: getProgress(course),
              completedItems: 0,
              totalItems: 0,
              lastAccessed: course?.last_accessed || null,
            },
          ];
        }
      })
    );

    setCourseMeta(Object.fromEntries(details));
  }, []);

  const fetchCourses = useCallback(() => {
    setLoading(true);
      authGet("/api/dashboards/student/my-courses/")
        .then((data) => {
          const next = Array.isArray(data) ? data : [];
          setCourses(next);
          return enrichCourses(next);
        })
        .catch((err) => console.error("Courses Error:", err))
        .finally(() => setLoading(false));
    }, [enrichCourses]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleJoinCourse = async () => {
    if (!joinCode.trim()) {
      setMessage("Please enter a join code.");
      return;
    }

    setJoining(true);
    try {
      const response = await axios.post("/api/courses/join/", { code: joinCode });
      const nextMessage =
        response?.data?.message || "Enrollment request sent. Waiting for instructor approval.";
      setMessage(nextMessage);
      if (response?.status === 201) {
        setJoinCode("");
      }
      if (
        nextMessage.toLowerCase().includes("already enrolled") ||
        nextMessage.toLowerCase().includes("approved")
      ) {
        fetchCourses();
      }
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to join course."
      );
    } finally {
      setJoining(false);
    }
  };

  const normalizedMessage = message.toLowerCase();
  const messageToneClass =
    normalizedMessage.includes("request sent") ||
    normalizedMessage.includes("already enrolled") ||
    normalizedMessage.includes("pending approval") ||
    normalizedMessage.includes("pending request")
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-red-200 bg-red-50 text-red-700";

  const activeCoursesCount = courses.filter((c) => Number(c.progress ?? c.completion_rate ?? 0) > 0).length;
  const completedCoursesCount = courses.filter((c) => Number(courseMeta[c.id]?.completionPct ?? c.progress ?? c.completion_rate ?? 0) >= 100).length;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-4 sm:py-6 md:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.10),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_26%,_#f8fafc_100%)] md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className={`${pageCardClass} overflow-hidden p-6 sm:p-8`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/85 bg-white/80 px-3 py-2 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#059669,#0f766e)] text-white shadow-sm">
                  <LuBookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Student Workspace</p>
                  <p className="text-xs text-slate-500">Course overview</p>
                </div>
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">My Courses</h2>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Access your enrolled courses and continue learning.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Enrolled</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{courses.length}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Completed</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{completedCoursesCount}</p>
              </div>
            </div>
          </div>
        </header>

        <section className={`${pageCardClass} overflow-hidden p-4 sm:p-5 md:p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-700 shadow-sm">
                  <LuDoorOpen className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Join a Course</h3>
                  <p className="mt-1 text-sm text-slate-600">Use a class code to send an enrollment request to the instructor.</p>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:min-w-[420px]">
              <label htmlFor="join-code" className="sr-only">
                Enter Join Code
              </label>
              <input
                id="join-code"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter Join Code"
                className="w-full min-w-0 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                onClick={handleJoinCourse}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition md:bg-[linear-gradient(135deg,#059669,#0f766e)] md:shadow-[0_12px_26px_rgba(5,150,105,0.22)] md:hover:-translate-y-0.5 md:hover:shadow-[0_16px_30px_rgba(5,150,105,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!joinCode.trim() || joining}
              >
                {joining ? "Sending..." : "Join Course"}
              </button>
            </div>
          </div>
          {message && (
            <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${messageToneClass}`}>
              {message}
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className={`${pageCardClass} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Learning Momentum</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCoursesCount}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <LuTrendingUp className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">Courses with real progress already underway.</p>
          </article>
          <article className={`${pageCardClass} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Modules Available</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {Object.values(courseMeta).reduce((sum, item) => sum + Number(item.lessonsCount || 0), 0)}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                <LuLayers3 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">Lesson modules ready for reading, review, and completion.</p>
          </article>
          <article className={`${pageCardClass} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Assessment Load</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {Object.values(courseMeta).reduce((sum, item) => sum + Number(item.activitiesCount || 0), 0)}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-100 text-lime-700">
                <LuGraduationCap className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">Tracked activities contributing to your course progress.</p>
          </article>
        </section>

        {loading ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-[26px] bg-emerald-50" />
            ))}
          </section>
        ) : courses.length === 0 ? (
          <div className={`${pageCardClass} p-10 text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <LuSparkles className="h-6 w-6" />
            </div>
            <p className="mt-4 text-slate-500">No enrolled courses yet.</p>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const progress = getProgress(course);
              const instructorName = getInstructorDisplayName(course);
              const meta = courseMeta[course.id] || {};
              const visualProgress = Number(meta.completionPct ?? progress);

              return (
                <article
                  key={course.id}
                  className="group cursor-pointer rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(236,253,245,0.76),rgba(248,250,252,0.98))] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-[0_26px_56px_rgba(16,185,129,0.13)]"
                  onClick={() => navigate(`/student/dashboard/my-courses/${course.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(visualProgress)}`}>
                        {getProgressLabel(visualProgress)}
                      </div>
                      <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{course.title}</h3>
                      <p className="mt-1 break-words text-sm text-slate-500">Instructor: {instructorName}</p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-emerald-700 shadow-sm">
                      <LuBookOpen className="h-5 w-5" />
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-3 min-h-[72px] text-sm leading-relaxed text-slate-600">
                    {course.description || "No course description available."}
                  </p>

                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 text-xs text-slate-700">
                    <p className="font-semibold uppercase tracking-[0.18em] text-emerald-900">Schedule</p>
                    <p className="mt-1">
                      {formatCourseDate(course.start_date) || "Start date not set"} to {formatCourseDate(course.end_date) || "Open-ended"}
                    </p>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Course Progress</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{Math.max(0, Math.min(100, visualProgress)).toFixed(0)}%</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {visualProgress >= 100 ? "Review ready" : visualProgress > 0 ? "Keep going" : "Begin here"}
                      </span>
                    </div>

                    <CourseProgressBar value={visualProgress} barClassName="bg-[linear-gradient(90deg,#059669,#0f766e)]" />

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/45 p-3 text-xs text-slate-600">
                      <p>
                        Lessons: <span className="font-semibold text-slate-800">{meta.lessonsCount ?? 0}</span>
                      </p>
                      <p>
                        Activities: <span className="font-semibold text-slate-800">{meta.activitiesCount ?? 0}</span>
                      </p>
                      <p className="col-span-2">
                        Progress items:{" "}
                        <span className="font-semibold text-slate-800">
                          {meta.totalItems > 0 ? `${meta.completedItems} / ${meta.totalItems}` : "Not tracked yet"}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.96))] px-4 py-3 text-xs text-slate-700">
                      <p className="font-semibold text-emerald-900">Learning note</p>
                      <p className="mt-1">
                        {meta.totalItems > 0
                          ? `${meta.completedItems} of ${meta.totalItems} lessons and activities completed`
                          : "Open the course to start tracking progress."}
                      </p>
                    </div>

                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Last accessed: {toDateText(meta.lastAccessed)}</p>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {visualProgress >= 100 ? "Review" : visualProgress > 0 ? "Continue" : "Start"}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/dashboard/my-courses/${course.id}`);
                    }}
                    className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,#059669,#0f766e)] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(5,150,105,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(5,150,105,0.28)]"
                  >
                    Continue Learning
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
