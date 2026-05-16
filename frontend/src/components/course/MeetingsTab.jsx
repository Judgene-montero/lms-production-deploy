import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/runtimeConfig";

const API_BASE_URL = getApiBaseUrl();
const AUTO_REFRESH_MS = 15000;
const LIVE_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 2 * 60 * 60 * 1000;

const getAccessToken = () => localStorage.getItem("access_token") || localStorage.getItem("access") || "";
const getRole = () => String(localStorage.getItem("role") || "").trim().toLowerCase();

const buildAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeExternalLink = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatDateTime = (value) => {
  if (!value) return "No schedule set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getMeetingStatus = (meeting) => {
  const scheduledAt = new Date(meeting?.scheduled_time || 0).getTime();
  const now = Date.now();

  if (scheduledAt >= now - LIVE_WINDOW_BEFORE_MS && scheduledAt <= now + LIVE_WINDOW_AFTER_MS) {
    return "live";
  }
  if (scheduledAt > now) {
    return "upcoming";
  }
  return "past";
};

const statusBadgeClass = (status) => {
  switch (status) {
    case "live":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "past":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-sky-200 bg-sky-100 text-sky-800";
  }
};

const sectionConfig = {
  live: {
    title: "Live Meetings",
    description: "Sessions that are happening now or close to starting time.",
    empty: "No live meetings right now.",
  },
  upcoming: {
    title: "Upcoming Meetings",
    description: "Scheduled sessions that students can prepare for ahead of time.",
    empty: "No upcoming meetings scheduled.",
  },
  past: {
    title: "Past Meetings",
    description: "Completed or elapsed sessions kept here for reference.",
    empty: "No past meetings yet.",
  },
};

const introCardClass =
  "rounded-[26px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.82),rgba(248,250,252,0.98))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]";

const MeetingCard = ({ meeting }) => {
  const status = getMeetingStatus(meeting);
  const normalizedLink = normalizeExternalLink(meeting?.meeting_link);

  return (
    <article className="rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(236,253,245,0.56),rgba(248,250,252,0.98))] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_48px_rgba(16,185,129,0.10)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-lg font-semibold tracking-tight text-slate-900">{meeting.title || "Untitled Meeting"}</h4>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(status)}`}>
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{formatDateTime(meeting.scheduled_time)}</p>
          <p className="mt-3 text-sm text-slate-500">
            Created by <span className="font-medium text-slate-700">{meeting.created_by_username || "Unknown"}</span>
          </p>
        </div>

        <div className="flex items-center">
          <a
            href={normalizedLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#059669,#0f766e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,150,105,0.22)] transition hover:brightness-105"
          >
            Join Meeting
          </a>
        </div>
      </div>
    </article>
  );
};

const MeetingSection = ({ sectionKey, meetings, loading }) => {
  const config = sectionConfig[sectionKey];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{config.title}</p>
          <p className="mt-1 text-sm text-slate-600">{config.description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
          {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[22px] bg-emerald-50" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-emerald-200 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(236,253,245,0.74))] p-5 text-sm text-slate-500">
          {config.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </section>
  );
};

export default function MeetingsTab({ courseId, isInstructor = false, standalone = false }) {
  const role = useMemo(() => getRole(), []);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    scheduled_time: "",
    meeting_link: "",
  });

  const fetchMeetings = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        setError("");
        const response = await axios.get(`${API_BASE_URL}/api/courses/${courseId}/meetings/`, {
          headers: buildAuthHeaders(),
        });
        const rows = Array.isArray(response.data) ? response.data : [];
        const sorted = [...rows].sort(
          (left, right) => new Date(left?.scheduled_time || 0).getTime() - new Date(right?.scheduled_time || 0).getTime()
        );
        setMeetings(sorted);
      } catch (requestError) {
        const detail =
          requestError?.response?.data?.error ||
          requestError?.response?.data?.detail ||
          "Failed to load meetings.";
        setError(detail);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [courseId]
  );

  useEffect(() => {
    fetchMeetings(true);
  }, [fetchMeetings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchMeetings(false);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchMeetings]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timerId = window.setTimeout(() => setSuccessMessage(""), 2500);
    return () => window.clearTimeout(timerId);
  }, [successMessage]);

  const groupedMeetings = useMemo(() => {
    const groups = {
      live: [],
      upcoming: [],
      past: [],
    };

    meetings.forEach((meeting) => {
      groups[getMeetingStatus(meeting)].push(meeting);
    });

    groups.live.sort((left, right) => new Date(left?.scheduled_time || 0).getTime() - new Date(right?.scheduled_time || 0).getTime());
    groups.upcoming.sort((left, right) => new Date(left?.scheduled_time || 0).getTime() - new Date(right?.scheduled_time || 0).getTime());
    groups.past.sort((left, right) => new Date(right?.scheduled_time || 0).getTime() - new Date(left?.scheduled_time || 0).getTime());

    return groups;
  }, [meetings]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await axios.post(
        `${API_BASE_URL}/api/courses/${courseId}/meetings/`,
        {
          title: form.title.trim(),
          scheduled_time: new Date(form.scheduled_time).toISOString(),
          meeting_link: normalizeExternalLink(form.meeting_link),
        },
        {
          headers: {
            ...buildAuthHeaders(),
            "Content-Type": "application/json",
          },
        }
      );

      setForm({
        title: "",
        scheduled_time: "",
        meeting_link: "",
      });
      setSuccessMessage("Meeting created successfully.");
      await fetchMeetings(false);
    } catch (requestError) {
      const data = requestError?.response?.data;
      const detail =
        data?.error ||
        data?.scheduled_time?.[0] ||
        data?.meeting_link?.[0] ||
        data?.title?.[0] ||
        data?.detail ||
        "Failed to create meeting.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const embeddedTitle = (
    <div className={introCardClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Course Meetings</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Meetings Workspace</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Track live sessions, upcoming consultations, and completed meetings in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchMeetings(true)}
          className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  const standaloneHeader = standalone ? (
    <header className="rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.85),rgba(248,250,252,0.98))] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Meeting Testing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Course Meetings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manual testing page for meeting creation and listing on course <span className="font-semibold">{courseId}</span>.
          </p>
        </div>
        <Link
          to={role === "student" ? `/student/dashboard/my-courses/${courseId}` : `/instructor-dashboard/courses/${courseId}`}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          Back to Course
        </Link>
      </div>
    </header>
  ) : null;

  const listPanel = (
    <div className="space-y-6">
      {embeddedTitle}

      {loading && meetings.length === 0 ? (
        <div className="space-y-6">
          {["live", "upcoming", "past"].map((sectionKey) => (
            <MeetingSection key={sectionKey} sectionKey={sectionKey} meetings={[]} loading />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-emerald-200 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(236,253,245,0.74))] px-5 py-10 text-center text-sm text-slate-500">
          No meetings scheduled.
        </div>
      ) : (
        <div className="space-y-6">
          <MeetingSection sectionKey="live" meetings={groupedMeetings.live} loading={loading} />
          <MeetingSection sectionKey="upcoming" meetings={groupedMeetings.upcoming} loading={loading} />
          <MeetingSection sectionKey="past" meetings={groupedMeetings.past} loading={loading} />
        </div>
      )}
    </div>
  );

  return (
    <div className={standalone ? "min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_35%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8" : ""}>
      <div className={standalone ? "mx-auto max-w-6xl space-y-6" : "space-y-6"}>
        {standaloneHeader}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
        ) : null}

        <section className={`grid gap-6 ${isInstructor ? "xl:grid-cols-[360px_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {isInstructor ? (
            <aside className="rounded-[28px] border border-emerald-100/80 bg-white p-6 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Instructor Tools</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Create Meeting</h2>
                <p className="mt-2 text-sm text-slate-600">Schedule a session directly inside the course workspace.</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Consultation Session"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Scheduled Time</span>
                  <input
                    type="datetime-local"
                    name="scheduled_time"
                    value={form.scheduled_time}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Meeting Link</span>
                  <input
                    type="url"
                    name="meeting_link"
                    value={form.meeting_link}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="https://meet.google.com/..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#059669,#0f766e)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,150,105,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Create Meeting"}
                </button>
              </form>
            </aside>
          ) : null}

          {listPanel}
        </section>
      </div>
    </div>
  );
}
