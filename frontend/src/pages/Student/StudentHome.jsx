import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBellRing,
  LuBookOpen,
  LuCalendarClock,
  LuCalendarDays,
  LuChevronLeft,
  LuChevronRight,
  LuCircleCheck,
  LuSparkles,
} from "react-icons/lu";
import { authGet } from "../../utils/api";
import StudentProgressCard from "../../components/student/StudentProgressCard";
import useStudentNotifications from "../../hooks/useStudentNotifications";
import { getActivityStatus, normalizeType } from "../../utils/studentMetrics";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const toDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const buildCalendarDays = (monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const firstGridDay = new Date(monthStart);
  firstGridDay.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    return date;
  });
};

const shellCardClass =
  "rounded-[26px] border border-emerald-100/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(240,253,250,0.86),rgba(248,250,252,0.98))] shadow-[0_18px_42px_rgba(15,23,42,0.05)]";

export default function StudentHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { notifications, loading: notificationsLoading, markAsRead } = useStudentNotifications();
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    pendingTasks: 0,
    missedTasks: 0,
    upcomingDeadlines: [],
    missedDeadlines: [],
  });

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      try {
        const courses = (await authGet("/api/dashboards/student/my-courses/").catch(() => [])) || [];

        const activityPayloads = await Promise.all(
          courses.map(async (course) => {
            try {
              const activities = await authGet(`/api/courses/student/courses/${course.id}/activities/`);
              return { course, activities: Array.isArray(activities) ? activities : [] };
            } catch {
              return { course, activities: [] };
            }
          })
        );

        const allActivities = activityPayloads
          .flatMap(({ course, activities }) =>
            activities.map((activity) => ({
              ...activity,
              course_title: course?.title || "",
            }))
          )
          .filter((activity) => normalizeType(activity?.activity_type_name || activity?.activity_type) !== "attendance");

        const now = new Date();
        const openItems = allActivities
          .filter((item) => item?.due_date)
          .map((item) => ({
            id: item.id,
            title: item.title || "Untitled activity",
            date: item.due_date,
            course_title: item.course_title,
            course_id: item.course,
            activity_type: item.activity_type_name || item.activity_type || "Activity",
            status: getActivityStatus(item),
          }))
          .filter((item) => item.status.key !== "completed");

        const upcomingDeadlines = openItems
          .filter((item) => new Date(item.date) >= now)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((item) => ({ ...item, statusLabel: "Upcoming" }));

        const missedDeadlines = openItems
          .filter((item) => item.status.key === "missing")
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((item) => ({ ...item, statusLabel: "Missed" }));

        setStats({
          enrolledCourses: courses.length,
          pendingTasks: openItems.length,
          missedTasks: missedDeadlines.length,
          upcomingDeadlines,
          missedDeadlines,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Enrolled Courses",
        value: stats.enrolledCourses,
        icon: <LuBookOpen className="h-4 w-4" />,
        accent: "blue",
      },
      {
        title: "Open Tasks",
        value: stats.pendingTasks,
        icon: <LuCalendarClock className="h-4 w-4" />,
        accent: "orange",
      },
      {
        title: "Missed Tasks",
        value: stats.missedTasks,
        icon: <LuBellRing className="h-4 w-4" />,
        accent: "red",
      },
    ],
    [stats.enrolledCourses, stats.missedTasks, stats.pendingTasks]
  );

  const calendarItems = useMemo(
    () =>
      [...stats.missedDeadlines, ...stats.upcomingDeadlines].sort((left, right) => new Date(left.date) - new Date(right.date)),
    [stats.missedDeadlines, stats.upcomingDeadlines]
  );

  const deadlinesByDay = useMemo(
    () =>
      calendarItems.reduce((acc, item) => {
        const key = toDayKey(item.date);
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {}),
    [calendarItems]
  );

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const selectedDayItems = useMemo(() => {
    const key = toDayKey(selectedDate);
    return deadlinesByDay[key] || [];
  }, [deadlinesByDay, selectedDate]);

  const openDeadline = (deadline) => {
    if (!deadline?.course_id) return;
    navigate(`/student/dashboard/my-courses/${deadline.course_id}`, { state: { activeTab: "classwork" } });
  };

  return (
    <div className="mb-6 space-y-5 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_30%,_#f8fafc_100%)] px-3 pt-3 sm:px-4">
      <section className={`${shellCardClass} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/85 bg-white/80 px-3 py-2 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#059669,#0f766e)] text-white shadow-sm">
                <LuSparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Student Home</p>
                <p className="text-xs text-slate-500">Daily overview</p>
              </div>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">Welcome Student</h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">Stay on track with your classes, tasks, and reminders.</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/82 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Today</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? [...Array(3)].map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-emerald-50" />)
          : cards.map((card) => (
              <StudentProgressCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                accent={card.accent}
              />
            ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className={`${shellCardClass} p-4`}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-700 shadow-sm">
              <LuCalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Calendar & Reminders</h3>
              <p className="mt-1 text-sm text-slate-600">Missed work is highlighted in red and upcoming work stays green.</p>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-emerald-100/80 bg-white/85 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </p>
                <p className="text-sm text-slate-500">Click any day to see open tasks and jump to classwork.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-700 hover:bg-emerald-50"
                  aria-label="Previous month"
                >
                  <LuChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setCalendarMonth(startOfMonth(today));
                    setSelectedDate(today);
                  }}
                  className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-700 hover:bg-emerald-50"
                  aria-label="Next month"
                >
                  <LuChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {calendarDays.map((date) => {
                const inCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const key = toDayKey(date);
                const items = deadlinesByDay[key] || [];
                const missedCount = items.filter((item) => item.status?.key === "missing").length;
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(new Date(date))}
                    className={`min-h-[66px] rounded-[18px] border px-2 py-1.5 text-left transition ${
                      isSelected
                        ? missedCount > 0
                          ? "border-red-300 bg-red-50"
                          : "border-emerald-300 bg-emerald-50"
                        : missedCount > 0
                        ? "border-red-100 bg-red-50/70 hover:border-red-200 hover:bg-red-50"
                        : "border-emerald-50 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                    } ${inCurrentMonth ? "text-slate-900" : "text-slate-300"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold sm:text-sm ${
                          isToday ? (missedCount > 0 ? "text-red-700" : "text-emerald-700") : ""
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {items.length > 0 ? (
                        <span
                          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                            missedCount > 0 ? "bg-red-600" : "bg-emerald-600"
                          }`}
                        >
                          {items.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {items.slice(0, 1).map((item) => (
                        <p
                          key={`${item.id}-${item.date}`}
                          className={`truncate rounded-md px-1.5 py-0.5 text-[10px] ${
                            item.status?.key === "missing" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.title}
                        </p>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[20px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-4">
              <div className="flex items-center gap-2">
                <LuCalendarDays className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900">
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {selectedDayItems.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No deadlines scheduled for this date.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedDayItems.map((item) => (
                    <button
                      key={`${item.id}-${item.date}`}
                      type="button"
                      onClick={() => openDeadline(item)}
                      className={`block w-full rounded-xl border bg-white p-3 text-left shadow-sm transition ${
                        item.status?.key === "missing"
                          ? "border-red-100 hover:border-red-200 hover:bg-red-50/50"
                          : "border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                            item.status?.key === "missing" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{item.course_title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.date).toLocaleString()} - {item.activity_type}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`${shellCardClass} p-4`}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-700 shadow-sm">
              <LuCalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Open Tasks</h3>
              <p className="mt-1 text-sm text-slate-600">Missed items appear first so students can recover faster.</p>
            </div>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-emerald-50" />
              ))}
            </div>
          ) : stats.upcomingDeadlines.length === 0 && stats.missedDeadlines.length === 0 ? (
            <div className="mt-8 text-center text-slate-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <LuCircleCheck className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-medium">You're all caught up!</p>
              <p className="text-sm text-slate-400">No pending assignments right now.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.missedDeadlines.slice(0, 3).map((deadline) => (
                <article
                  key={`${deadline.id}-${deadline.date}`}
                  onClick={() => openDeadline(deadline)}
                  className="cursor-pointer rounded-xl border border-red-100 bg-red-50/60 p-3 shadow-sm transition hover:border-red-200 hover:bg-red-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{deadline.title}</p>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                      Missed
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{deadline.course_title}</p>
                  <p className="text-xs text-red-700">{new Date(deadline.date).toLocaleString()}</p>
                </article>
              ))}

              {stats.upcomingDeadlines.slice(0, 4).map((deadline) => (
                <article
                  key={`${deadline.id}-${deadline.date}`}
                  onClick={() => openDeadline(deadline)}
                  className="cursor-pointer rounded-xl border border-emerald-100 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{deadline.title}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Upcoming
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{deadline.course_title}</p>
                  <p className="text-xs text-slate-500">{new Date(deadline.date).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${shellCardClass} p-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-700 shadow-sm">
            <LuBellRing className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Notifications</h3>
            <p className="mt-1 text-sm text-slate-600">Stay updated with graded work, announcements, and course activity.</p>
          </div>
        </div>
        {notificationsLoading ? (
          <div className="mt-3 space-y-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-emerald-50" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-6 text-center text-slate-500">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <LuCircleCheck className="h-6 w-6 text-slate-400" />
            </div>
            <p className="font-medium">No notifications yet.</p>
            <p className="text-sm text-slate-400">Announcements and activity updates will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {notifications.slice(0, 6).map((item) => (
              <article
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`rounded-xl border p-4 shadow-sm transition ${
                  item.read ? "border-slate-100 bg-white" : "border-emerald-100 bg-emerald-50/40"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
