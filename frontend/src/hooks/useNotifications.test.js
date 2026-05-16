import { act, renderHook, waitFor } from "@testing-library/react";

import useNotifications from "./useNotifications";
import { authGet, authPost } from "../utils/api";

jest.mock("../utils/api", () => ({
  authGet: jest.fn(),
  authPost: jest.fn(),
}));

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  emit(payload) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(payload) });
    }
  }

  close(code = 1000) {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
  }
}

describe("useNotifications", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket;
    localStorage.clear();
    localStorage.setItem("access", "fake-jwt-token");
    localStorage.setItem("role", "student");

    authGet.mockImplementation((endpoint) => {
      if (endpoint === "/api/notifications/") {
        return Promise.resolve([
          {
            id: 1,
            event_key: "seed-1",
            title: "Seed notification",
            message: "Loaded from REST",
            notification_type: "announcement_created",
            is_read: false,
            read_at: null,
            created_at: "2026-04-25T12:00:00Z",
            course_id: 12,
            course_title: "Course A",
            activity_id: 50,
            submission_id: null,
          },
        ]);
      }
      if (endpoint === "/api/notifications/unread-count/") {
        return Promise.resolve({ unread_count: 1 });
      }
      return Promise.resolve([]);
    });
    authPost.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("loads REST notifications and receives websocket updates instantly", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => {
      MockWebSocket.instances[0].open();
    });

    act(() => {
      MockWebSocket.instances[0].emit({
        id: 2,
        event_key: "live-2",
        title: "Live notification",
        message: "Pushed over websocket",
        notification_type: "assignment_graded",
        is_read: false,
        read_at: null,
        created_at: "2026-04-25T12:05:00Z",
        course_id: 12,
        course_title: "Course A",
        activity_id: 51,
        submission_id: 101,
      });
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.notifications[0].id).toBe(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it("reconnects after websocket close and marks notifications as read through the API", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      MockWebSocket.instances[0].open();
      MockWebSocket.instances[0].close(1006);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);

    await act(async () => {
      await result.current.markAsRead(1);
    });

    expect(authPost).toHaveBeenCalledWith("/api/notifications/1/read/", {});
    expect(result.current.notifications[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });
});
