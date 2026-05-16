import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import {
  LuBookOpen,
  LuUsers,
  LuChartLine,
  LuActivity,
  LuPlus,
  LuUserPlus,
  LuFilePlus2,
  LuCalendarClock,
  LuTriangleAlert,
} from "react-icons/lu";
import { authGet } from "../../utils/api";
import InstructorProfileDropdown from "../../components/instructor/InstructorProfileDropdown";
import { loadInstructorProfile, readCachedInstructorProfile, subscribeInstructorProfile } from "../../utils/instructorProfile";
import { getCreatePathByType } from "./courses/classworkTypeConfig";

const cardClass =
  "rounded-xl border border-emerald-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

const SkeletonCard = () => <div className="h-32 animate-pulse rounded-xl bg-emerald-50" />;
const SkeletonPanel = ({ className = "h-48" }) => <div className={`animate-pulse rounded-xl bg-emerald-50 ${className}`} />;

const Home = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_courses: 0, pending_submissions: 0, notifications: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [aiSummary, setAiSummary] = useState({ total_students: 0, average_engagement: 0 });
  const [courseAnalytics, setCourseAnalytics] = useState([]);
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState(() => readCachedInstructorProfile());
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [atRiskPreview, setAtRiskPreview] = useState([]);
  const [loadingSections, setLoadingSections] = useState({
    summary: true,
    analytics: true,
    previews: true,
    courses: true,
  });

  const loadDashboard = useCallback(async () => {
    setLoadingSections({
      summary: true,
      analytics: true,
      previews: true,
      courses: true,
    });

    const summaryRequest = Promise.allSettled([
      authGet("/api/instructor/dashboard/?refresh=0"),
      loadInstructorProfile().catch(() => null),
    ]).then(([dashboardResult, profileResult]) => {
      if (dashboardResult.status === "fulfilled") {
        const dashboardData = dashboardResult.value || {};
        setStats({
          total_courses: dashboardData?.total_courses || 0,
          pending_submissions: dashboardData?.pending_submissions || 0,
          notifications: dashboardData?.notifications || 0,
        });
      }
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value || readCachedInstructorProfile());
      } else {
        setProfile(readCachedInstructorProfile());
      }
      setLoadingSections((current) => ({ ...current, summary: false }));
    });

    const analyticsRequest = authGet("/api/ai/course-analytics/?refresh=0&limit=6")
      .then((analyticsData) => {
        setCourseAnalytics(Array.isArray(analyticsData?.courses) ? analyticsData.courses : []);
        setAiSummary({
          total_students: analyticsData?.summary?.total_students || 0,
          average_engagement: analyticsData?.summary?.average_engagement || 0,
        });
      })
      .catch(() => {
        setCourseAnalytics([]);
        setAiSummary({ total_students: 0, average_engagement: 0 });
      })
      .finally(() => {
        setLoadingSections((current) => ({ ...current, analytics: false }));
      });

    const previewRequest = Promise.allSettled([
      authGet("/api/instructor/recent-submissions/?limit=8"),
      authGet("/api/instructor/upcoming-deadlines/"),
      authGet("/api/ai/at-risk-students/?refresh=0&limit=10"),
    ]).then(([activitiesResult, deadlinesResult, atRiskResult]) => {
      setRecentActivities(
        activitiesResult.status === "fulfilled" && Array.isArray(activitiesResult.value)
          ? activitiesResult.value
          : []
      );
      setUpcomingDeadlines(
        deadlinesResult.status === "fulfilled" && Array.isArray(deadlinesResult.value)
          ? deadlinesResult.value
          : []
      );
      setAtRiskPreview(
        atRiskResult.status === "fulfilled" && Array.isArray(atRiskResult.value)
          ? atRiskResult.value.slice(0, 10)
          : []
      );
      setLoadingSections((current) => ({ ...current, previews: false }));
    });

    const courseListRequest = authGet("/api/courses/")
      .then((courseList) => {
        setCourses(Array.isArray(courseList) ? courseList : []);
      })
      .catch(() => {
        setCourses([]);
      })
      .finally(() => {
        setLoadingSections((current) => ({ ...current, courses: false }));
      });

    await Promise.all([summaryRequest, analyticsRequest, previewRequest, courseListRequest]);
  }, []);

  useEffect(() => {
    loadDashboard();
    const unsubscribe = subscribeInstructorProfile((nextProfile) => setProfile(nextProfile));
    return unsubscribe;
  }, [loadDashboard]);

  const activeStudentsToday = useMemo(() => {
    const today = new Date();
    const todaysNames = new Set(
      recentActivities
        .filter((item) => {
          if (!item?.submitted_at) return false;
          const submittedDate = new Date(item.submitted_at);
          return submittedDate.toDateString() === today.toDateString();
        })
        .map((item) => item.student_name)
    );
    return todaysNames.size;
  }, [recentActivities]);

  const averageCompletionRate = useMemo(() => {
    if (!courseAnalytics.length) return 0;
    const rates = courseAnalytics.map((course) => Number(course.completion_rate || 0));
    const sum = rates.reduce((acc, value) => acc + value, 0);
    return Math.round(sum / rates.length);
  }, [courseAnalytics]);

  const enrollmentTrendData = useMemo(() => {
    const countByDay = recentActivities.reduce((acc, item) => {
      const label = item?.submitted_at
        ? new Date(item.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Unknown";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(countByDay)
      .slice(-7)
      .map(([date, value]) => ({ date, value }));
  }, [recentActivities]);

  const courseEngagementData = useMemo(() => {
    return courseAnalytics.slice(0, 6).map((course) => ({
      course: course.course_title?.slice(0, 16) || "Course",
      engagement: Number(course.average_engagement || 0),
    }));
  }, [courseAnalytics]);

  const goToFirstCourse = (action) => {
    if (!courses.length) {
      navigate("/instructor-dashboard/courses/create");
      return;
    }

    if (action === "students") {
      navigate(`/instructor-dashboard/courses/${courses[0].id}`);
      return;
    }

    if (action === "quiz") {
      navigate(getCreatePathByType(courses[0].id, "quiz"));
      return;
    }

    navigate("/instructor-dashboard/courses/create");
  };

  const widgetItems = [
    {
      title: "Total Courses",
      value: stats.total_courses,
      icon: LuBookOpen,
      helper: "Published and draft courses",
    },
    {
      title: "Total Students",
      value: aiSummary.total_students,
      icon: LuUsers,
      helper: "Across all assigned courses",
    },
    {
      title: "Avg Completion Rate",
      value: `${averageCompletionRate}%`,
      icon: LuChartLine,
      helper: "Mean completion across courses",
    },
    {
      title: "Active Students Today",
      value: activeStudentsToday,
      icon: LuActivity,
      helper: "Students who submitted today",
    },
  ];

  return (
    <div className="space-y-6 bg-white">
      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Instructor Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold text-emerald-950 sm:text-3xl">Welcome back, {profile?.first_name || "Instructor"}</h1>
            <p className="mt-2 text-sm text-gray-600">Track your courses, student activity, and classroom progress in one place.</p>
          </div>
          <InstructorProfileDropdown profile={profile || {}} />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loadingSections.summary || loadingSections.analytics
          ? [...Array(4)].map((_, index) => <SkeletonCard key={index} />)
          : widgetItems.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className={cardClass}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-600">{item.title}</p>
                    <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-bold text-emerald-950">{item.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
                </article>
              );
            })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-emerald-900">Mini Analytics</h3>
            <button
              onClick={() => navigate("/instructor-dashboard/analytics")}
              className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900"
            >
              View Full Analytics
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="mb-2 text-sm font-medium text-emerald-800">Submission Activity (7 days)</p>
              <div className="h-48">
                {loadingSections.previews ? (
                  <SkeletonPanel className="h-48" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={enrollmentTrendData}>
                      <defs>
                        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0B6B3A" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#0B6B3A" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                      <XAxis dataKey="date" tick={{ fill: "#14532d", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
                      <Tooltip />
                      <Area dataKey="value" stroke="#0B6B3A" fill="url(#activityFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="mb-2 text-sm font-medium text-emerald-800">Engagement by Course</p>
              <div className="h-48">
                {loadingSections.analytics ? (
                  <SkeletonPanel className="h-48" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={courseEngagementData}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                      <XAxis dataKey="course" tick={{ fill: "#14532d", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="engagement" fill="#0B6B3A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-900">Quick Actions</h3>
          <div className="mt-4 space-y-2">
            <button
              onClick={() => goToFirstCourse("course")}
              className="flex w-full items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <LuPlus className="h-4 w-4" />
              Create Course
            </button>
            <button
              onClick={() => goToFirstCourse("students")}
              disabled={loadingSections.courses}
              className="flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              <LuUserPlus className="h-4 w-4" />
              Add Students
            </button>
            <button
              onClick={() => goToFirstCourse("quiz")}
              disabled={loadingSections.courses}
              className="flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              <LuFilePlus2 className="h-4 w-4" />
              Create Quiz
            </button>
          </div>

          <div className="mt-5 rounded-xl bg-gradient-to-r from-emerald-50 to-lime-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Average Engagement</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">{Math.round(Number(aiSummary.average_engagement || 0))}%</p>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-900">
            <LuCalendarClock className="h-5 w-5" /> Upcoming Deadlines
          </h3>
          <div className="mt-3 space-y-2">
            {loadingSections.previews ? (
              [...Array(3)].map((_, index) => <SkeletonPanel key={index} className="h-20" />)
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming deadlines.</p>
            ) : (
              upcomingDeadlines.slice(0, 6).map((row) => (
                <div key={row.id} className="rounded-lg border border-emerald-100 p-3">
                  <p className="text-sm font-semibold text-emerald-900">{row.activity_name}</p>
                  <p className="text-xs text-gray-600">{row.course}</p>
                  <p className="text-xs text-gray-500">Due: {row.due_date ? new Date(row.due_date).toLocaleString() : "-"}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-900">
            <LuTriangleAlert className="h-5 w-5" /> At-Risk Students
          </h3>
          <div className="mt-3 space-y-2">
            {loadingSections.previews ? (
              [...Array(3)].map((_, index) => <SkeletonPanel key={index} className="h-20" />)
            ) : atRiskPreview.length === 0 ? (
              <p className="text-sm text-gray-500">No at-risk students detected.</p>
            ) : (
              atRiskPreview.map((row) => (
                <button
                  key={`${row.course_id}-${row.student_id}`}
                  type="button"
                  onClick={() => navigate("/instructor-dashboard/analytics")}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100"
                >
                  <p className="text-sm font-semibold text-amber-900">{row.student_name}</p>
                  <p className="text-xs text-amber-800">{row.course_title}</p>
                  <p className="text-xs font-medium uppercase">Risk: {row.risk_level}</p>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-900">Course Performance Snapshot</h3>
          <div className="mt-3 space-y-2">
            {loadingSections.analytics ? (
              [...Array(3)].map((_, index) => <SkeletonPanel key={index} className="h-20" />)
            ) : courseAnalytics.length === 0 ? (
              <p className="text-sm text-gray-500">No course performance data yet.</p>
            ) : (
              courseAnalytics.slice(0, 5).map((course) => (
                <div key={course.course_id} className="rounded-lg border border-emerald-100 p-3">
                  <p className="text-sm font-semibold text-emerald-900">{course.course_title}</p>
                  <p className="text-xs text-gray-600">Completion Rate: {Math.round(Number(course.completion_rate || 0))}%</p>
                  <p className="text-xs text-gray-600">Average Score: {Math.round(Number(course.average_grade || 0))}%</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-emerald-900">Recent Activity Feed</h3>
        <div className="mt-4 space-y-3">
          {loadingSections.previews ? (
            [...Array(4)].map((_, index) => <SkeletonPanel key={index} className="h-24" />)
          ) : recentActivities.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-gray-600">No recent activity yet.</p>
          ) : (
            recentActivities.slice(0, 8).map((activity) => (
              <article
                key={activity.id}
                className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-4 transition hover:shadow sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-emerald-900">{activity.student_name}</p>
                  <p className="text-sm text-gray-600">
                    {activity.course_title} - {activity.activity_title}
                  </p>
                  <p className={`text-xs font-semibold ${activity.is_late ? "text-red-600" : "text-emerald-700"}`}>
                    {activity.is_late ? "Late submission" : "On-time submission"}
                  </p>
                </div>
                <p className="text-xs text-gray-500">{activity.submitted_at ? new Date(activity.submitted_at).toLocaleString() : "-"}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
