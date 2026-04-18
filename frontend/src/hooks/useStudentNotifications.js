import { useEffect, useMemo, useState } from "react";
import { authGet, authPost } from "../utils/api";
import {
  buildPerformanceSummary,
  getActivityScore,
  getSubmissionForActivity,
  normalizeType,
} from "../utils/studentMetrics";

const READ_EVENT = "student-notifications-read-updated";

const getReadStorageKey = () => {
  const userId = localStorage.getItem("user_id") || localStorage.getItem("username") || "student";
  return `student_notifications_read:${userId}`;
};

const readReadIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(getReadStorageKey()) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writeReadIds = (ids) => {
  localStorage.setItem(getReadStorageKey(), JSON.stringify(Array.from(ids)));
  window.dispatchEvent(new CustomEvent(READ_EVENT, { detail: Array.from(ids) }));
};

const buildTarget = (courseId, activity, fallbackTab = "classwork") => {
  const activityType = normalizeType(activity?.activity_type_name || activity?.activity_type);
  const tab = activityType === "quiz" || activityType === "exam" || activityType === "exams_quizzes" ? "exams_quizzes" : fallbackTab;

  return {
    pathname: `/student/dashboard/my-courses/${courseId}`,
    state: { activeTab: tab },
  };
};

export default function useStudentNotifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => readReadIds());

  useEffect(() => {
    const syncReadIds = (event) => {
      const next = Array.isArray(event?.detail) ? new Set(event.detail) : readReadIds();
      setReadIds(next);
    };

    window.addEventListener(READ_EVENT, syncReadIds);
    window.addEventListener("storage", syncReadIds);
    return () => {
      window.removeEventListener(READ_EVENT, syncReadIds);
      window.removeEventListener("storage", syncReadIds);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const courses = (await authGet("/api/dashboards/student/my-courses/").catch(() => [])) || [];
        const settings = (await authGet("/api/student/notification-settings/").catch(() => ({}))) || {};
        const readResponse = (await authGet("/api/student/notification-reads/").catch(() => null)) || null;
        const serverReadIds = Array.isArray(readResponse?.notification_keys) ? new Set(readResponse.notification_keys) : null;
        if (serverReadIds) {
          writeReadIds(serverReadIds);
          if (mounted) setReadIds(serverReadIds);
        }

        const payloads = await Promise.all(
          courses.map(async (course) => {
            const [activities, announcements] = await Promise.all([
              authGet(`/api/courses/student/courses/${course.id}/activities/`).catch(() => []),
              authGet(`/api/courses/${course.id}/announcements/`).catch(() => []),
            ]);

            return {
              course,
              activities: Array.isArray(activities) ? activities : [],
              announcements: Array.isArray(announcements) ? announcements : [],
            };
          })
        );

        const now = Date.now();
        const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;

        const nextNotifications = payloads.flatMap(({ course, activities, announcements }) => {
          const performance = buildPerformanceSummary(activities);

          const announcementItems = settings.notify_instructor_announcement !== false
            ? announcements
                .filter((item) => item?.created_at && now - new Date(item.created_at).getTime() <= sevenDaysMs)
                .map((item) => ({
                  id: `announcement-${course.id}-${item.id}`,
                  courseId: course.id,
                  title: "New announcement",
                  message: `${course.title}: ${item.title || item.text || "Your instructor posted an update."}`,
                  createdAt: item.created_at,
                  target: {
                    pathname: `/student/dashboard/my-courses/${course.id}`,
                    state: { activeTab: "stream" },
                  },
                  type: "announcement",
                }))
            : [];

          const dueSoonItems = settings.notify_due_date_approaching !== false
            ? performance.rows
                .filter((row) => row.status.key !== "completed" && row.dueDate)
                .filter((row) => {
                  const dueDate = new Date(row.dueDate).getTime();
                  return dueDate >= now && dueDate - now <= sevenDaysMs;
                })
                .map((row) => ({
                  id: `due-${course.id}-${row.id}`,
                  courseId: course.id,
                  title: "Upcoming deadline",
                  message: `${row.title} is due soon in ${course.title}.`,
                  createdAt: row.dueDate,
                  target: buildTarget(course.id, row.activity),
                  type: "deadline",
                }))
            : [];

          const gradedItems = settings.notify_assignment_graded !== false
            ? activities
                .filter((activity) => getActivityScore(activity) !== null)
                .map((activity) => {
                  const submission = getSubmissionForActivity(activity);
                  const score = getActivityScore(activity);
                  return {
                    id: `graded-${course.id}-${activity.id}`,
                    courseId: course.id,
                    title: "Submission graded",
                    message: `${activity.title} has been graded: ${score}.`,
                    createdAt: submission?.submitted_at || activity?.updated_at || activity?.created_at,
                    target: buildTarget(course.id, activity, "grades"),
                    type: "graded",
                  };
                })
            : [];

          const newQuizItems = settings.notify_quiz_released !== false
            ? activities
                .filter((activity) => {
                  const type = normalizeType(activity?.activity_type_name || activity?.activity_type);
                  return (type === "quiz" || type === "exam" || type === "exams_quizzes") &&
                    activity?.created_at &&
                    now - new Date(activity.created_at).getTime() <= sevenDaysMs;
                })
                .map((activity) => ({
                  id: `quiz-${course.id}-${activity.id}`,
                  courseId: course.id,
                  title: "New assessment available",
                  message: `${activity.title} is now available in ${course.title}.`,
                  createdAt: activity.created_at,
                  target: buildTarget(course.id, activity, "exams_quizzes"),
                  type: "quiz",
                }))
            : [];

          return [...announcementItems, ...dueSoonItems, ...gradedItems, ...newQuizItems];
        });

        nextNotifications.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        if (mounted) setNotifications(nextNotifications);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const notificationsWithReadState = useMemo(
    () =>
      notifications.map((item) => ({
        ...item,
        read: readIds.has(item.id),
      })),
    [notifications, readIds]
  );

  const unreadCount = notificationsWithReadState.filter((item) => !item.read).length;

  const markAsRead = (id) => {
    const next = readReadIds();
    next.add(id);
    writeReadIds(next);
    setReadIds(next);
    setNotifications((prev) => [...prev]);
    authPost("/api/student/notification-reads/", { notification_keys: [id] }).catch(() => null);
  };

  const markAllAsRead = () => {
    const next = new Set(notifications.map((item) => item.id));
    writeReadIds(next);
    setReadIds(next);
    setNotifications((prev) => [...prev]);
    authPost("/api/student/notification-reads/", { notification_keys: Array.from(next) }).catch(() => null);
  };

  return {
    loading,
    notifications: notificationsWithReadState,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
