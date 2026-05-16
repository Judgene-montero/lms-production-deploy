import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authGet, authPost } from "../utils/api";
import { getWebSocketBaseUrl } from "../utils/runtimeConfig";

const WS_PATH = "/ws/notifications/";
const MAX_NOTIFICATIONS = 100;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

const getAccessToken = () => localStorage.getItem("access") || "";
const getRole = () => String(localStorage.getItem("role") || "").trim().toLowerCase();

const buildWebSocketUrl = () => {
  const token = getAccessToken();
  const url = new URL(`${getWebSocketBaseUrl()}${WS_PATH}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

const toTimestamp = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const normalizeNotification = (item) => ({
  id: item.id,
  eventKey: item.event_key || "",
  title: item.title || "Notification",
  message: item.message || "",
  notificationType: item.notification_type || "general",
  isRead: Boolean(item.is_read),
  readAt: item.read_at || null,
  createdAt: item.created_at || null,
  time: item.time || null,
  actorName: item.actor_name || "",
  courseId: item.course_id || null,
  courseTitle: item.course_title || "",
  activityId: item.activity_id || null,
  submissionId: item.submission_id || null,
});

const sortNotifications = (items) =>
  [...items].sort((a, b) => {
    const delta = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    return delta !== 0 ? delta : Number(b.id || 0) - Number(a.id || 0);
  });

const buildTarget = (item) => {
  if (!item.courseId) return null;
  const role = getRole();

  switch (item.notificationType) {
    case "announcement_created":
      return {
        pathname: `/student/dashboard/my-courses/${item.courseId}`,
        state: { activeTab: "stream" },
      };
    case "assignment_graded":
      return {
        pathname: `/student/dashboard/my-courses/${item.courseId}`,
        state: { activeTab: "grades" },
      };
    case "assignment_submission":
    case "quiz_completed":
      return {
        pathname: `/instructor/courses/${item.courseId}`,
        state: { activeTab: "classwork" },
      };
    case "attendance_alert":
      return {
        pathname: `/student/dashboard/my-courses/${item.courseId}`,
        state: { activeTab: "attendance" },
      };
    case "course_enrollment":
      return {
        pathname:
          role === "instructor"
            ? `/instructor/courses/${item.courseId}`
            : `/student/dashboard/my-courses/${item.courseId}`,
        state: { activeTab: "stream" },
      };
    default:
      return {
        pathname: `/student/dashboard/my-courses/${item.courseId}`,
        state: { activeTab: "classwork" },
      };
  }
};

const mergeNotifications = (prev, incoming) => {
  const map = new Map(prev.map((item) => [item.id, item]));
  for (const raw of incoming) {
    const next = normalizeNotification(raw);
    const current = map.get(next.id);
    map.set(next.id, current ? { ...current, ...next } : next);
  }

  return sortNotifications(Array.from(map.values()))
    .slice(0, MAX_NOTIFICATIONS)
    .map((item) => ({
      ...item,
      target: buildTarget(item),
    }));
};

export default function useNotifications() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  const recomputeUnread = useCallback((items) => {
    setUnreadCount(items.filter((item) => !item.isRead).length);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.close();
    }
  }, []);

  const loadFromRest = useCallback(async () => {
    const [items, countPayload] = await Promise.all([
      authGet("/api/notifications/").catch(() => []),
      authGet("/api/notifications/unread-count/").catch(() => ({ unread_count: 0 })),
    ]);

    const merged = mergeNotifications([], Array.isArray(items) ? items : []);
    setNotifications(merged);
    setUnreadCount(Number(countPayload?.unread_count || 0));
    return merged;
  }, []);

  const connectWebSocket = useCallback(() => {
    clearReconnectTimer();
    closeSocket();

    const token = getAccessToken();
    if (!token) {
      setConnected(false);
      return;
    }

    const socket = new WebSocket(buildWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setNotifications((prev) => {
          const next = mergeNotifications(prev, [payload]);
          recomputeUnread(next);
          return next;
        });
      } catch (error) {
        console.error("Notification socket payload error:", error);
      }
    };

    socket.onclose = (event) => {
      setConnected(false);
      if (!shouldReconnectRef.current) return;
      if (event?.code === 4401 || event?.code === 4403) return;

      const nextAttempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = nextAttempt;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** (nextAttempt - 1), RECONNECT_MAX_MS);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connectWebSocket();
      }, delay);
    };

    socket.onerror = () => {
      setConnected(false);
    };
  }, [clearReconnectTimer, closeSocket, recomputeUnread]);

  useEffect(() => {
    let mounted = true;
    shouldReconnectRef.current = true;

    const initialize = async () => {
      setLoading(true);
      try {
        await loadFromRest();
      } finally {
        if (mounted) {
          setLoading(false);
          connectWebSocket();
        }
      }
    };

    initialize();

    const handleOnline = () => {
      loadFromRest().catch(() => null);
      connectWebSocket();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      mounted = false;
      shouldReconnectRef.current = false;
      window.removeEventListener("online", handleOnline);
      clearReconnectTimer();
      closeSocket();
    };
  }, [clearReconnectTimer, closeSocket, connectWebSocket, loadFromRest]);

  const markAsRead = useCallback(
    async (id) => {
      setNotifications((prev) => {
        const next = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                isRead: true,
                readAt: item.readAt || new Date().toISOString(),
              }
            : item
        );
        recomputeUnread(next);
        return next;
      });

      try {
        await authPost(`/api/notifications/${id}/read/`, {});
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        await loadFromRest().catch(() => null);
      }
    },
    [loadFromRest, recomputeUnread]
  );

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      const now = new Date().toISOString();
      const next = prev.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || now,
      }));
      recomputeUnread(next);
      return next;
    });

    try {
      await authPost("/api/notifications/mark-all-read/", {});
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      await loadFromRest().catch(() => null);
    }
  }, [loadFromRest, recomputeUnread]);

  const value = useMemo(
    () => ({
      loading,
      connected,
      notifications,
      unreadCount,
      refresh: loadFromRest,
      markAsRead,
      markAllAsRead,
    }),
    [connected, loadFromRest, loading, markAllAsRead, markAsRead, notifications, unreadCount]
  );

  return value;
}
