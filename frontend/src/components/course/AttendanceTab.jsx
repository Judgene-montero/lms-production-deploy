
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost } from "../../utils/api";
import AttendanceModal from "./AttendanceModal";
import { ATTENDANCE_OPTIONS, ATTENDANCE_SET, DEFAULT_STATUS_POINTS, getLocalDateISO, toMessage } from "./attendanceConfig";

const statusChipClass = {
  present: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  absent: "bg-rose-100 text-rose-800",
  excused: "bg-sky-100 text-sky-800",
  unmarked: "bg-gray-100 text-gray-700",
};

const statusShort = {
  present: "P",
  late: "L",
  absent: "A",
  excused: "E",
  unmarked: "-",
};

const monthKey = (isoDate) => String(isoDate || "").slice(0, 7);

const hydrateSessionMap = ({ students, records, statusPoints, existingMap }) => {
  const next = { ...(existingMap || {}) };
  const recordList = Array.isArray(records) ? records : [];

  recordList.forEach((record) => {
    const studentKey = String(record.student_id);
    const statusValue = String(record.status || "").toLowerCase();
    if (!ATTENDANCE_SET.has(statusValue)) return;
    next[studentKey] = {
      status: statusValue,
      points_earned:
        record.points_earned === null || record.points_earned === undefined
          ? String(Number(statusPoints[statusValue] ?? 0))
          : String(record.points_earned),
    };
  });

  students.forEach((student) => {
    const key = String(student.id);
    if (!next[key]) {
      next[key] = {
        status: "present",
        points_earned: String(Number(statusPoints.present ?? 0)),
      };
      return;
    }
    if (!ATTENDANCE_SET.has(next[key].status)) {
      next[key].status = "present";
    }
    if (next[key].points_earned === undefined || next[key].points_earned === null || next[key].points_earned === "") {
      next[key].points_earned = String(Number(statusPoints[next[key].status] ?? 0));
    }
  });

  return next;
};

function MonthlyAttendanceSummary({ students, summaryActivities, attendanceMap }) {
  const monthKeys = useMemo(() => {
    const keys = Array.from(new Set(summaryActivities.map((activity) => monthKey(activity.date)).filter(Boolean)));
    return keys.sort((a, b) => (a > b ? -1 : 1));
  }, [summaryActivities]);

  const [activeYear, setActiveYear] = useState("");
  const [activeMonthNumber, setActiveMonthNumber] = useState("");

  useEffect(() => {
    if (!monthKeys.length) {
      setActiveYear("");
      setActiveMonthNumber("");
      return;
    }
    const [defaultYear, defaultMonth] = monthKeys[0].split("-");
    if (!activeYear || !activeMonthNumber) {
      setActiveYear(defaultYear);
      setActiveMonthNumber(defaultMonth);
    }
  }, [monthKeys, activeYear, activeMonthNumber]);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(monthKeys.map((key) => key.split("-")[0])));
    return years.sort((a, b) => (a > b ? -1 : 1));
  }, [monthKeys]);

  const monthOptions = useMemo(() => {
    if (!activeYear) return [];
    const months = monthKeys
      .filter((key) => key.startsWith(`${activeYear}-`))
      .map((key) => key.split("-")[1]);
    return Array.from(new Set(months)).sort((a, b) => (a > b ? -1 : 1));
  }, [monthKeys, activeYear]);

  useEffect(() => {
    if (!monthOptions.length) return;
    if (!monthOptions.includes(activeMonthNumber)) {
      setActiveMonthNumber(monthOptions[0]);
    }
  }, [monthOptions, activeMonthNumber]);

  const activeMonthKey = activeYear && activeMonthNumber ? `${activeYear}-${activeMonthNumber}` : "";

  const monthSessions = useMemo(() => {
    return summaryActivities
      .filter((activity) => monthKey(activity.date) === activeMonthKey)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [summaryActivities, activeMonthKey]);

  const visibleStudents = useMemo(() => students.slice(0, 16), [students]);
  const monthLabel = useMemo(() => {
    if (!activeMonthKey) return "";
    const dt = new Date(`${activeMonthKey}-01T00:00:00`);
    return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [activeMonthKey]);

  const monthlyStatusTotals = useMemo(() => {
    const totals = { present: 0, late: 0, absent: 0, excused: 0 };
    monthSessions.forEach((session) => {
      students.forEach((student) => {
        const value = attendanceMap[String(session.date)]?.[String(student.id)]?.status;
        if (totals[value] !== undefined) totals[value] += 1;
      });
    });
    return totals;
  }, [monthSessions, students, attendanceMap]);

  const sessionDatesLabel = useMemo(() => {
    if (!monthSessions.length) return "No recorded session dates.";
    return monthSessions
      .map((session) => {
        const dt = new Date(`${session.date}T00:00:00`);
        return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
      })
      .join(", ");
  }, [monthSessions]);

  if (!summaryActivities.length) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Monthly summary will appear after sessions are created.</p>
      </section>
    );
  }

  const parseMonthLabel = (monthNum) =>
    new Date(`2000-${monthNum}-01T00:00:00`).toLocaleDateString(undefined, { month: "long" });

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Attendance Summary</p>
      <h4 className="mt-2 text-2xl font-semibold text-blue-900">Monthly Attendance Matrix for {monthLabel || "Selected Month"}</h4>
      <p className="mt-1 text-sm text-slate-600">
        Review saved attendance by day, keep the current session in sync, and track each student&apos;s monthly totals.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">Recorded Days This Month: {monthSessions.length}</span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Present: {monthlyStatusTotals.present}</span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">Late: {monthlyStatusTotals.late}</span>
        <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-700">Absent: {monthlyStatusTotals.absent}</span>
        <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">Excused: {monthlyStatusTotals.excused}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">Recorded session dates: {sessionDatesLabel}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="rounded-lg border border-blue-200 bg-white p-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Month</span>
          <select
            value={activeMonthNumber}
            onChange={(event) => setActiveMonthNumber(event.target.value)}
            className="w-full rounded-md border border-blue-200 bg-blue-600 px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            {monthOptions.map((value) => (
              <option key={value} value={value}>
                {parseMonthLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-lg border border-blue-200 bg-white p-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Year</span>
          <select
            value={activeYear}
            onChange={(event) => setActiveYear(event.target.value)}
            className="w-full rounded-md border border-blue-200 bg-blue-600 px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            {yearOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!monthSessions.length ? (
        <p className="mt-4 text-sm text-gray-500">No sessions in the selected month.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] text-sm">
            <thead className="text-white">
              <tr>
                <th className="sticky left-0 z-10 bg-blue-700 px-5 py-3 text-left font-semibold uppercase tracking-wide">Student Name</th>
                {monthSessions.map((session) => (
                  <th key={session.id} className="bg-blue-700 px-2 py-3 text-center" title={session.topic || "Attendance"}>
                    <span className="inline-block origin-center -rotate-90 whitespace-nowrap text-[11px] font-semibold tracking-wide">
                      {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                    </span>
                  </th>
                ))}
                <th className="bg-emerald-600 px-4 py-3 text-center font-semibold uppercase tracking-wide">Present Count</th>
                <th className="bg-amber-500 px-4 py-3 text-center font-semibold uppercase tracking-wide">Late Count</th>
                <th className="bg-rose-500 px-4 py-3 text-center font-semibold uppercase tracking-wide">Absent Count</th>
                <th className="bg-sky-600 px-4 py-3 text-center font-semibold uppercase tracking-wide">Excused Count</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => {
                const studentTotals = { present: 0, late: 0, absent: 0, excused: 0 };
                monthSessions.forEach((session) => {
                  const value = attendanceMap[String(session.date)]?.[String(student.id)]?.status;
                  if (studentTotals[value] !== undefined) studentTotals[value] += 1;
                });

                return (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-[1] bg-white px-5 py-3 font-medium text-slate-900">{student.username}</td>
                    {monthSessions.map((session) => {
                      const statusValue = attendanceMap[String(session.date)]?.[String(student.id)]?.status || "unmarked";
                      const short = statusShort[statusValue] || "-";
                      const chipClass = statusChipClass[statusValue] || statusChipClass.unmarked;
                      return (
                        <td key={`${student.id}-${session.id}`} className="px-2 py-2 text-center">
                          <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${chipClass}`}>
                            {short}
                          </span>
                        </td>
                      );
                    })}
                    <td className="bg-emerald-50 px-4 py-2 text-center font-semibold text-emerald-700">{studentTotals.present}</td>
                    <td className="bg-amber-50 px-4 py-2 text-center font-semibold text-amber-700">{studentTotals.late}</td>
                    <td className="bg-rose-50 px-4 py-2 text-center font-semibold text-rose-700">{studentTotals.absent}</td>
                    <td className="bg-sky-50 px-4 py-2 text-center font-semibold text-sky-700">{studentTotals.excused}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {students.length > visibleStudents.length && (
        <p className="mt-2 text-xs text-gray-500">
          Showing first {visibleStudents.length} students in matrix for readability. Use session modal for full class edits.
        </p>
      )}
    </section>
  );
}

function AttendanceTab({ courseId, isInstructor }) {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [sessionTouched, setSessionTouched] = useState({});

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionDateFilter, setSessionDateFilter] = useState("");
  const [sessionDraft, setSessionDraft] = useState({ date: getLocalDateISO(), topic: "Attendance" });

  const [showSettings, setShowSettings] = useState(false);
  const [autoApplyStatusPoints, setAutoApplyStatusPoints] = useState(true);
  const [statusPoints, setStatusPoints] = useState(DEFAULT_STATUS_POINTS);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("edit");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedSessionActivity = useMemo(
    () => sessions.find((item) => String(item.id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId]
  );

  const selectedSessionDate = String(selectedSessionActivity?.date || "");

  const filteredSessions = useMemo(() => {
    if (!sessionDateFilter) return sessions;
    return sessions.filter((session) => String(session.date || "") === sessionDateFilter);
  }, [sessions, sessionDateFilter]);

  const summaryActivities = useMemo(() => {
    return sessions.map((session) => {
      const key = String(session.date || "");
      if (!sessionTouched[key]) return session;
      const overlayRecords = Object.entries(attendanceMap[key] || {}).map(([studentId, state]) => ({
        student_id: Number(studentId),
        status: state.status,
        points_earned: Number(state.points_earned),
      }));
      return { ...session, records: overlayRecords, overlay: true };
    });
  }, [sessions, attendanceMap, sessionTouched]);

  const attendanceForSelectedSession = useMemo(() => {
    if (!selectedSessionDate) return {};
    return attendanceMap[selectedSessionDate] || {};
  }, [attendanceMap, selectedSessionDate]);

  const attendanceSummary = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    students.forEach((student) => {
      const value = attendanceForSelectedSession[String(student.id)]?.status;
      if (!ATTENDANCE_SET.has(value)) {
        counts.unmarked += 1;
        return;
      }
      counts[value] += 1;
    });
    return counts;
  }, [students, attendanceForSelectedSession]);

  useEffect(() => {
    const key = `attendance_status_points_${courseId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      setStatusPoints({
        present: Number(parsed.present ?? DEFAULT_STATUS_POINTS.present),
        late: Number(parsed.late ?? DEFAULT_STATUS_POINTS.late),
        absent: Number(parsed.absent ?? DEFAULT_STATUS_POINTS.absent),
        excused: Number(parsed.excused ?? DEFAULT_STATUS_POINTS.excused),
      });
      setAutoApplyStatusPoints(Boolean(parsed.auto_apply_status_points ?? true));
    } catch {
      // Ignore invalid local storage payload.
    }
  }, [courseId]);

  useEffect(() => {
    const key = `attendance_status_points_${courseId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        ...statusPoints,
        auto_apply_status_points: autoApplyStatusPoints,
      })
    );
  }, [courseId, statusPoints, autoApplyStatusPoints]);

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      setStatusMessage("");

      const [studentsResult, sessionsResult] = await Promise.allSettled([
        authGet(`/api/courses/${courseId}/students/`),
        authGet(`/api/courses/${courseId}/attendance/sessions/`),
      ]);

      let failed = false;
      let nextStudents = [];
      let nextSessions = [];

      if (studentsResult.status === "fulfilled") {
        const people = Array.isArray(studentsResult.value) ? studentsResult.value : [];
        nextStudents = people.filter((person) => String(person.role || "").toLowerCase() === "student");
        setStudents(nextStudents);
      } else {
        failed = true;
        setStudents([]);
        nextStudents = [];
      }

      if (sessionsResult.status === "fulfilled") {
        nextSessions = Array.isArray(sessionsResult.value) ? sessionsResult.value : [];
        setSessions(nextSessions);
        if (nextSessions.length && !selectedSessionId) {
          setSelectedSessionId(String(nextSessions[0].id));
        }
      } else {
        failed = true;
        setSessions([]);
        nextSessions = [];
      }

      if (nextSessions.length) {
        const serverMap = {};
        nextSessions.forEach((session) => {
          const dateKey = String(session.date || "");
          serverMap[dateKey] = hydrateSessionMap({
            students: nextStudents,
            records: session.records,
            statusPoints,
            existingMap: {},
          });
        });

        setAttendanceMap((prev) => {
          const next = { ...serverMap };
          Object.entries(sessionTouched).forEach(([dateKey, touched]) => {
            if (touched && prev[dateKey]) {
              next[dateKey] = prev[dateKey];
            }
          });
          return next;
        });
      }

      if (failed) {
        const studentError =
          studentsResult.status === "rejected" ? toMessage(studentsResult.reason, "Failed to load students.") : "";
        const sessionError =
          sessionsResult.status === "rejected"
            ? toMessage(sessionsResult.reason, "Failed to load attendance sessions.")
            : "";
        setError([studentError, sessionError].filter(Boolean).join(" "));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [courseId, selectedSessionId, sessionTouched, statusPoints]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedSessionActivity || !selectedSessionDate) return;
    setAttendanceMap((prev) => {
      const hydrated = hydrateSessionMap({
        students,
        records: selectedSessionActivity.records,
        statusPoints,
        existingMap: prev[selectedSessionDate],
      });
      const before = JSON.stringify(prev[selectedSessionDate] || {});
      const after = JSON.stringify(hydrated);
      if (before === after) return prev;
      return { ...prev, [selectedSessionDate]: hydrated };
    });
  }, [selectedSessionActivity, selectedSessionDate, students, statusPoints]);

  const createSessionRequest = async ({ sessionDate, sessionTopic }) => {
    try {
      return await authPost(`/api/courses/${courseId}/attendance/sessions/`, {
        date: sessionDate,
        topic: sessionTopic,
      });
    } catch {
      return authPost("/api/courses/attendance/session/", {
        course_id: courseId,
        date: sessionDate,
        topic: sessionTopic,
      });
    }
  };

  const openCreateModal = () => {
    setError("");
    setSessionDraft({ date: getLocalDateISO(), topic: "Attendance" });
    setModalMode("create");
    setIsModalOpen(true);
  };

  const openEditorForSelected = () => {
    if (!selectedSessionId) {
      setError("Select a session first, then click Edit Session.");
      return;
    }
    setError("");
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const quickStartTodaySession = async () => {
    if (!isInstructor) return;
    const today = getLocalDateISO();
    const existing = sessions.find((session) => String(session.date || "") === today);

    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      let targetSessionId = existing?.id || null;
      if (!targetSessionId) {
        const created = await createSessionRequest({
          sessionDate: today,
          sessionTopic: "Attendance",
        });
        targetSessionId = created?.id || null;
      }

      await fetchData({ silent: true });
      if (targetSessionId) {
        setSelectedSessionId(String(targetSessionId));
      }
      setModalMode("edit");
      setIsModalOpen(true);
      setStatusMessage("Today session is ready. Mark students now and click Save Attendance.");
    } catch (requestError) {
      setError(toMessage(requestError, "Failed to quick start today's attendance session."));
    } finally {
      setSaving(false);
    }
  };

  const createSession = async () => {
    if (!isInstructor) return;
    const normalizedTopic = String(sessionDraft.topic || "").trim();
    const sessionDate = String(sessionDraft.date || "");

    if (!sessionDate) {
      setError("Session date is required.");
      return;
    }
    if (!normalizedTopic) {
      setError("Session topic is required.");
      return;
    }

    setSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const created = await createSessionRequest({ sessionDate, sessionTopic: normalizedTopic });
      const createdId = created?.id ? String(created.id) : "";
      await fetchData({ silent: true });
      if (createdId) {
        setSelectedSessionId(createdId);
      }
      setModalMode("edit");
      setStatusMessage("Session created. Continue directly to attendance marking.");
    } catch (requestError) {
      setError(toMessage(requestError, "Failed to create attendance session."));
    } finally {
      setSaving(false);
    }
  };

  const updateStudentStatus = (studentId, statusValue) => {
    if (!selectedSessionDate || !ATTENDANCE_SET.has(statusValue)) return;
    const key = String(studentId);
    setAttendanceMap((prev) => {
      const session = { ...(prev[selectedSessionDate] || {}) };
      const existing = session[key] || {};
      session[key] = {
        status: statusValue,
        points_earned: autoApplyStatusPoints
          ? String(Number(statusPoints[statusValue] ?? 0))
          : existing.points_earned ?? String(Number(statusPoints[statusValue] ?? 0)),
      };
      return { ...prev, [selectedSessionDate]: session };
    });
    setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: true }));
  };

  const updateStudentPoints = (studentId, value) => {
    if (!selectedSessionDate) return;
    const key = String(studentId);
    setAttendanceMap((prev) => {
      const session = { ...(prev[selectedSessionDate] || {}) };
      const existing = session[key] || { status: "present" };
      session[key] = { ...existing, points_earned: value };
      return { ...prev, [selectedSessionDate]: session };
    });
    setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: true }));
  };

  const applyBulkStatus = (studentIds, statusValue) => {
    if (!isInstructor || !selectedSessionDate || !studentIds.length || !ATTENDANCE_SET.has(statusValue)) return;
    setAttendanceMap((prev) => {
      const session = { ...(prev[selectedSessionDate] || {}) };
      studentIds.forEach((studentId) => {
        const key = String(studentId);
        const existing = session[key] || {};
        session[key] = {
          status: statusValue,
          points_earned: autoApplyStatusPoints
            ? String(Number(statusPoints[statusValue] ?? 0))
            : existing.points_earned ?? String(Number(statusPoints[statusValue] ?? 0)),
        };
      });
      return { ...prev, [selectedSessionDate]: session };
    });
    setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: true }));
  };

  const applyStatusPointsToAll = () => {
    if (!selectedSessionDate) return;
    setAttendanceMap((prev) => {
      const session = { ...(prev[selectedSessionDate] || {}) };
      students.forEach((student) => {
        const key = String(student.id);
        const currentStatus = session[key]?.status || "present";
        session[key] = {
          ...(session[key] || { status: currentStatus }),
          points_earned: String(Number(statusPoints[currentStatus] ?? 0)),
        };
      });
      return { ...prev, [selectedSessionDate]: session };
    });
    setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: true }));
  };

  const saveRecords = async () => {
    if (!isInstructor || !selectedSessionActivity || !selectedSessionDate) return;
    const sessionData = attendanceMap[selectedSessionDate] || {};
    const missing = students.filter((student) => !ATTENDANCE_SET.has(sessionData[String(student.id)]?.status));
    if (missing.length) {
      setError(`Please mark all students before saving. Missing: ${missing.length}`);
      return;
    }

    const payloadRecords = students.map((student) => {
      const studentState = sessionData[String(student.id)] || {};
      const statusValue = studentState.status;
      const rawPoints = studentState.points_earned;
      const pointsValue = rawPoints === "" || rawPoints === undefined ? Number(statusPoints[statusValue] ?? 0) : Number(rawPoints);

      return {
        student_id: student.id,
        status: statusValue,
        points_earned: Number.isFinite(pointsValue) ? pointsValue : Number(statusPoints[statusValue] ?? 0),
      };
    });

    setSaving(true);
    setError("");
    setStatusMessage("");

    try {
      await authPost(`/api/courses/${courseId}/attendance/sessions/${selectedSessionActivity.id}/records/`, {
        records: payloadRecords,
      });
      setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: false }));
      setStatusMessage("Attendance records saved.");
      await fetchData({ silent: true });
      setIsModalOpen(false);
    } catch {
      try {
        for (const row of payloadRecords) {
          await authPost(`/api/courses/attendance/${selectedSessionActivity.id}/record/`, row);
        }
        setSessionTouched((prev) => ({ ...prev, [selectedSessionDate]: false }));
        setStatusMessage("Attendance records saved.");
        await fetchData({ silent: true });
        setIsModalOpen(false);
      } catch (fallbackError) {
        setError(toMessage(fallbackError, "Failed to save attendance records."));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedSession = async () => {
    if (!isInstructor || !selectedSessionActivity) return;
    const confirmed = window.confirm(
      `Delete session "${selectedSessionActivity.topic}" on ${selectedSessionActivity.date}? This will also delete its attendance records.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await authDelete(`/api/courses/${courseId}/attendance/sessions/${selectedSessionActivity.id}/`);
      const nextSessions = sessions.filter((row) => String(row.id) !== String(selectedSessionActivity.id));
      setSessions(nextSessions);
      setSelectedSessionId(nextSessions.length ? String(nextSessions[0].id) : "");
      setAttendanceMap((prev) => {
        const next = { ...prev };
        delete next[selectedSessionDate];
        return next;
      });
      setSessionTouched((prev) => {
        const next = { ...prev };
        delete next[selectedSessionDate];
        return next;
      });
      setIsModalOpen(false);
      setStatusMessage("Session deleted.");
    } catch (requestError) {
      setError(toMessage(requestError, "Failed to delete attendance session."));
    } finally {
      setSaving(false);
    }
  };

  const exportPointsSheet = () => {
    if (!selectedSessionActivity || !selectedSessionDate) {
      setError("Select a session before exporting points sheet.");
      return;
    }
    const sessionData = attendanceMap[selectedSessionDate] || {};
    const statusLabel = Object.fromEntries(ATTENDANCE_OPTIONS.map((item) => [item.value, item.label]));
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Session Date", selectedSessionActivity.date],
      ["Session Topic", selectedSessionActivity.topic],
      [],
      ["Student", "School ID", "Status", "Points"],
    ];

    students.forEach((student) => {
      const state = sessionData[String(student.id)] || {};
      const statusValue = state.status || "present";
      const numericPoints = Number(
        state.points_earned === "" || state.points_earned === undefined
          ? Number(statusPoints[statusValue] ?? 0)
          : state.points_earned
      );

      rows.push([
        student.username || "",
        student.school_id || "",
        statusLabel[statusValue] || statusValue,
        Number.isFinite(numericPoints) ? numericPoints.toFixed(2) : "0.00",
      ]);
    });

    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance_points_${selectedSessionActivity.date || "session"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading attendance...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {statusMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusMessage}</p>
      )}

      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-lime-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-emerald-950">Attendance</h3>
            <p className="text-sm text-gray-600">Session-based attendance with overlay preview and grading points.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={sessionDateFilter}
              onChange={(event) => setSessionDateFilter(event.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700"
              title="Filter sessions by date"
            />
            <button
              type="button"
              onClick={() => fetchData({ silent: true })}
              disabled={refreshing}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {isInstructor && (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Create Session
              </button>
            )}
            {isInstructor && (
              <button
                type="button"
                onClick={quickStartTodaySession}
                disabled={saving}
                className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                {saving ? "Preparing..." : "Quick Start Today"}
              </button>
            )}
            {isInstructor && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                title="Attendance points settings"
              >
                Points Settings
              </button>
            )}
            {isInstructor && (
              <button
                type="button"
                onClick={openEditorForSelected}
                disabled={!selectedSessionActivity}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Edit Session
              </button>
            )}
            {isInstructor && (
              <button
                type="button"
                onClick={exportPointsSheet}
                disabled={!selectedSessionActivity}
                className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                Export Points CSV
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <article className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Present</p><p className="text-xl font-bold text-emerald-800">{attendanceSummary.present}</p></article>
        <article className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Late</p><p className="text-xl font-bold text-amber-700">{attendanceSummary.late}</p></article>
        <article className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Absent</p><p className="text-xl font-bold text-rose-700">{attendanceSummary.absent}</p></article>
        <article className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Excused</p><p className="text-xl font-bold text-sky-700">{attendanceSummary.excused}</p></article>
        <article className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unmarked</p><p className="text-xl font-bold text-gray-700">{attendanceSummary.unmarked}</p></article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Session</label>
          <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} className="min-w-[260px] rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select attendance session</option>
            {filteredSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.date} - {session.topic}{sessionTouched[String(session.date)] ? " (Unsaved edits)" : ""}
              </option>
            ))}
          </select>
        </div>

        {!selectedSessionActivity ? (
          <p className="text-sm text-gray-500">No attendance session selected.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {students.slice(0, 9).map((student) => {
              const statusValue = attendanceForSelectedSession[String(student.id)]?.status || "unmarked";
              return (
                <article key={student.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">{student.username}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusChipClass[statusValue] || statusChipClass.unmarked}`}>{statusShort[statusValue] || "-"}</span>
                </article>
              );
            })}
            {students.length > 9 && (
              <article className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500">
                +{students.length - 9} more students. Open "Edit Session" for full list with pagination and bulk marking.
              </article>
            )}
          </div>
        )}
      </section>

      <MonthlyAttendanceSummary students={students} summaryActivities={summaryActivities} attendanceMap={attendanceMap} />

      <AttendanceModal
        isOpen={isModalOpen}
        mode={modalMode}
        students={students}
        sessions={filteredSessions}
        selectedSessionId={selectedSessionId}
        setSelectedSessionId={setSelectedSessionId}
        selectedSessionActivity={selectedSessionActivity}
        sessionDraft={sessionDraft}
        setSessionDraft={setSessionDraft}
        attendanceForSession={attendanceForSelectedSession}
        statusPoints={statusPoints}
        isInstructor={isInstructor}
        saving={saving}
        onClose={() => setIsModalOpen(false)}
        onCreateSession={createSession}
        onSaveSession={saveRecords}
        onDeleteSession={deleteSelectedSession}
        onStatusChange={updateStudentStatus}
        onPointsChange={updateStudentPoints}
        onBulkStatus={applyBulkStatus}
      />

      {showSettings && isInstructor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-3">
          <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-base font-semibold text-amber-900">Attendance Points Settings</h5>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Close</button>
            </div>
            <p className="mt-1 text-xs text-gray-600">Instructor-defined base points are applied per status and exported in CSV sheets.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              {ATTENDANCE_OPTIONS.map((option) => (
                <label key={`settings-${option.value}`} className="text-xs font-medium text-gray-700">{option.label}
                  <input type="number" step="0.01" value={statusPoints[option.value]} onChange={(event) => setStatusPoints((prev) => ({ ...prev, [option.value]: Number(event.target.value || 0) }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={autoApplyStatusPoints} onChange={(event) => setAutoApplyStatusPoints(event.target.checked)} />
              Auto-apply base points when status changes
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={applyStatusPointsToAll} className="rounded border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50">Apply Base Points To Current Session</button>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">Done</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default memo(AttendanceTab);
