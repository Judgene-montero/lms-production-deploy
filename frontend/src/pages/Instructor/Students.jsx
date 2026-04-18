
import React, { Suspense, lazy, memo, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { authGet, authPost } from "../../utils/api";
import { getDefaultAvatarDataUrl } from "../../utils/instructorProfile";

const StudentOverviewTab = lazy(() => import("../../components/students/StudentOverviewTab"));
const StudentActivityTab = lazy(() => import("../../components/students/StudentActivityTab"));
const StudentAssessmentsTab = lazy(() => import("../../components/students/StudentAssessmentsTab"));
const StudentAttendanceTab = lazy(() => import("../../components/students/StudentAttendanceTab"));
const StudentRiskTab = lazy(() => import("../../components/students/StudentRiskTab"));
const StudentManagementTab = lazy(() => import("../../components/students/StudentManagementTab"));

const PAGE_SIZE = 20;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const statusFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "at_risk", label: "At Risk" },
  { key: "inactive", label: "Inactive" },
];

const bulkActions = [
  { key: "send_reminder", label: "Send Reminder" },
  { key: "send_invite", label: "Send Invite" },
  { key: "remove_from_course", label: "Remove from Course" },
  { key: "export_selected", label: "Export Selected" },
];

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" },
  { key: "assessments", label: "Assessments" },
  { key: "attendance", label: "Attendance" },
  { key: "risk", label: "Risk Insights" },
  { key: "management", label: "Management" },
];

const parseCsvLine = (line) => {
  const output = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      output.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }

  output.push(value.trim());
  return output;
};

const daysSince = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const formatRelativeDate = (dateValue) => {
  if (!dateValue) return "-";
  const days = daysSince(dateValue);
  if (days === null) return "-";
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const riskBadgeClass = (riskLevel) => {
  const value = String(riskLevel || "").toLowerCase();
  if (value === "high") return "bg-red-100 text-red-700";
  if (value === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

const computeEngagementStatus = (row) => {
  const progress = Number(row.progress || 0);
  const missedAssignments = Number(row.assignmentsMissed || 0);
  const inactiveDays = daysSince(row.lastActive);
  if (inactiveDays !== null && inactiveDays >= 7) return "inactive";
  if (missedAssignments > 3 || progress < 40) return "at_risk";
  return "active";
};

const toCsv = (rows) => {
  const headers = [
    "Student Name",
    "Email",
    "Course",
    "Attendance Status",
    "Assignments Missed",
    "Late Submissions",
    "Total Points",
    "Progress (%)",
    "Last Active",
    "Risk Level",
    "Engagement Status",
  ];

  const escape = (value) => {
    const normalized = String(value ?? "");
    if (!normalized.includes(",") && !normalized.includes('"') && !normalized.includes("\n")) return normalized;
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.email,
        row.courseName,
        row.attendanceStatus,
        row.assignmentsMissed,
        row.lateSubmissions,
        row.totalPoints,
        row.progress,
        row.lastActive ? new Date(row.lastActive).toISOString() : "",
        row.riskLevel,
        row.engagementStatus,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");
};

const downloadCsv = (filename, content) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function Students() {
  const { courseId: routeCourseId } = useParams();

  const [activeTab, setActiveTab] = useState("overview");

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [riskRows, setRiskRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(routeCourseId || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("send_reminder");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [csvRows, setCsvRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const [drawerStudent, setDrawerStudent] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerDetails, setDrawerDetails] = useState(null);

  const [note, setNote] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const getSelectionKey = useCallback((student) => `${student.courseId || "global"}-${student.id}`, []);

  const loadCourses = useCallback(async () => {
    const data = await authGet("/api/courses/");
    const normalized = Array.isArray(data)
      ? data.map((course) => ({ id: String(course.id), title: course.title || `Course ${course.id}` }))
      : [];
    setCourses(normalized);

    if (routeCourseId && normalized.some((course) => String(course.id) === String(routeCourseId))) {
      setSelectedCourse(String(routeCourseId));
    }
  }, [routeCourseId]);

  const tryLoadFromDashboardEndpoint = useCallback(async (courseIdValue) => {
    const params = new URLSearchParams();
    if (courseIdValue && courseIdValue !== "all") params.set("course_id", courseIdValue);

    const response = await authGet(`/api/dashboards/instructor/students/?${params.toString()}`);
    const list = Array.isArray(response?.students) ? response.students : [];

    return list.map((item) => ({
      id: Number(item.id),
      studentId: item.student_id || item.school_id || item.id,
      name: item.name || item.student_name || item.username || "Unknown Student",
      email: item.email || "",
      courseId: String(item.course_id || courseIdValue || ""),
      courseName: item.course_title || item.course_name || "Unknown Course",
      attendanceStatus: item.attendance_status || "-",
      assignmentsMissed: Number(item.missed_assignments || 0),
      lateSubmissions: Number(item.late_submissions || 0),
      totalPoints: Number(item.total_points || 0),
      progress: Number(item.progress_percent ?? item.progress ?? 0),
      lastActive: item.last_active || item.last_active_at || null,
      riskLevel: String(item.risk_level || "low").toLowerCase(),
      timeline: Array.isArray(item.activity_logs) ? item.activity_logs : [],
    }));
  }, []);

  const loadCourseStudentsFallback = useCallback(
    async (courseIdValue) => {
      const targetCourses =
        courseIdValue === "all"
          ? courses
          : courses.filter((course) => String(course.id) === String(courseIdValue));

      const collected = [];

      await Promise.all(
        targetCourses.map(async (course) => {
          try {
            const people = await authGet(`/api/courses/${course.id}/students/`);
            (Array.isArray(people) ? people : [])
              .filter((person) => String(person.role || "").toLowerCase() === "student")
              .forEach((person) => {
                collected.push({
                  id: Number(person.id),
                  studentId: person.school_id || person.id,
                  name: person.username || person.name || "Unknown Student",
                  email: person.email || "",
                  courseId: String(course.id),
                  courseName: course.title,
                  attendanceStatus: "-",
                  assignmentsMissed: 0,
                  lateSubmissions: 0,
                  totalPoints: 0,
                  progress: 0,
                  lastActive: null,
                  riskLevel: "low",
                  timeline: [],
                });
              });
          } catch {
            // Continue loading other courses.
          }
        })
      );

      return collected;
    },
    [courses]
  );

  const loadRiskRows = useCallback(async (courseIdValue) => {
    const params = new URLSearchParams();
    if (courseIdValue && courseIdValue !== "all") params.set("course_id", courseIdValue);

    try {
      const response = await authGet(`/api/ai/student-risk/?${params.toString()}`);
      setRiskRows(Array.isArray(response) ? response : []);
    } catch {
      setRiskRows([]);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!courses.length) await loadCourses();

      let list = [];
      try {
        list = await tryLoadFromDashboardEndpoint(selectedCourse);
      } catch {
        list = await loadCourseStudentsFallback(selectedCourse);
      }

      await loadRiskRows(selectedCourse);
      setStudents(list);
      setSelectedIds(new Set());
    } catch (requestError) {
      console.error(requestError);
      setError("Data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [courses.length, loadCourseStudentsFallback, loadCourses, loadRiskRows, selectedCourse, tryLoadFromDashboardEndpoint]);

  React.useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  React.useEffect(() => {
    if (!courses.length && selectedCourse !== "all") return;
    loadStudents();
  }, [courses.length, loadStudents, selectedCourse]);

  const riskMap = useMemo(() => {
    const map = new Map();
    riskRows.forEach((item) => {
      map.set(`${item.course_id}-${item.student_id}`, item);
    });
    return map;
  }, [riskRows]);

  const enrichedStudents = useMemo(() => {
    return students.map((student) => {
      const risk = riskMap.get(`${student.courseId}-${student.id}`) || null;

      const assignmentsMissed = Number(student.assignmentsMissed || (risk?.missing_rate != null ? Math.round(Number(risk.missing_rate) * 10) : 0));
      const lateSubmissions = Number(student.lateSubmissions || (risk?.late_rate != null ? Math.round(Number(risk.late_rate) * 10) : 0));
      const totalPoints = Number(student.totalPoints || risk?.average_grade || 0);
      const progress = Number(student.progress || (risk?.engagement_score != null ? Number(risk.engagement_score) * 100 : 0));
      const attendanceStatus = student.attendanceStatus !== "-" ? student.attendanceStatus : progress >= 70 ? "Present" : progress >= 40 ? "Partial" : "Absent";
      const lastActive = student.lastActive || risk?.last_updated || null;
      const riskLevel = String(student.riskLevel || risk?.risk_level || "low").toLowerCase();

      const merged = {
        ...student,
        assignmentsMissed,
        lateSubmissions,
        totalPoints: Math.round(totalPoints),
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        attendanceStatus,
        lastActive,
        riskLevel,
        quizAverage: Math.round(Number(risk?.average_grade || totalPoints || 0)),
        attendanceRate: Math.max(0, Math.min(100, Math.round(progress))),
        timeline: student.timeline.length > 0 ? student.timeline : [{ label: "Last model refresh", at: risk?.last_updated || null }],
      };

      return {
        ...merged,
        engagementStatus: computeEngagementStatus(merged),
      };
    });
  }, [riskMap, students]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedStudents.filter((student) => {
      const matchesCourse = selectedCourse === "all" || String(student.courseId) === String(selectedCourse);
      if (!matchesCourse) return false;

      const haystack = `${student.name} ${student.email} ${student.studentId}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      if (!matchesSearch) return false;

      return statusFilter === "all" || student.engagementStatus === statusFilter;
    });
  }, [enrichedStudents, search, selectedCourse, statusFilter]);

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const riskPriority = { high: 3, medium: 2, low: 1 };
      const riskDiff = (riskPriority[b.riskLevel] || 0) - (riskPriority[a.riskLevel] || 0);
      if (riskDiff !== 0) return riskDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredStudents]);

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / PAGE_SIZE));

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedStudents.slice(start, start + PAGE_SIZE);
  }, [page, sortedStudents]);

  React.useEffect(() => {
    setPage(1);
  }, [search, selectedCourse, statusFilter]);

  const headerStats = useMemo(() => {
    const total = filteredStudents.length;
    const active = filteredStudents.filter((student) => student.engagementStatus === "active").length;
    const atRisk = filteredStudents.filter((student) => student.engagementStatus === "at_risk").length;
    const inactive = filteredStudents.filter((student) => student.engagementStatus === "inactive").length;

    return { total, active, atRisk, inactive };
  }, [filteredStudents]);

  const selectedStudents = useMemo(
    () => sortedStudents.filter((student) => selectedIds.has(getSelectionKey(student))),
    [getSelectionKey, selectedIds, sortedStudents]
  );

  const toggleSelected = useCallback(
    (student) => {
      const key = getSelectionKey(student);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [getSelectionKey]
  );

  const toggleSelectAllCurrentPage = useCallback(() => {
    const currentIds = paginatedStudents.map((student) => getSelectionKey(student));
    const allSelected = currentIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) currentIds.forEach((id) => next.delete(id));
      else currentIds.forEach((id) => next.add(id));
      return next;
    });
  }, [getSelectionKey, paginatedStudents, selectedIds]);

  const exportRows = useCallback(
    (filename, rows) => {
      downloadCsv(filename, toCsv(rows));
      showToast(`${filename} exported.`);
    },
    [showToast]
  );

  const handleBulkAction = useCallback(async () => {
    if (!selectedIds.size) {
      showToast("Select students first.");
      return;
    }

    setBulkLoading(true);

    try {
      const selected = selectedStudents;

      if (bulkAction === "export_selected") {
        exportRows("selected_students.csv", selected);
        return;
      }

      if (["send_reminder", "send_invite"].includes(bulkAction)) {
        await Promise.all(
          selected.map((student) =>
            authPost(`/api/dashboards/instructor/students/${student.id}/status/`, {
              action: bulkAction,
              status: bulkAction === "send_invite" ? "pending_invite" : undefined,
            }).catch(() => null)
          )
        );
        showToast(bulkAction === "send_reminder" ? "Reminders sent." : "Invites sent.");
      }

      if (bulkAction === "remove_from_course") {
        if (selectedCourse === "all") {
          showToast("Select a specific course to remove students.");
          return;
        }

        await Promise.all(
          selected.map((student) =>
            authPost(`/api/dashboards/instructor/students/${student.id}/remove/`, {
              course_id: selectedCourse,
            }).catch(() => null)
          )
        );
        showToast("Selected students removed from course.");
      }

      await loadStudents();
    } catch (requestError) {
      console.error(requestError);
      showToast("Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  }, [bulkAction, exportRows, loadStudents, selectedCourse, selectedIds.size, selectedStudents, showToast]);

  const handleQuickAction = useCallback(
    async (action) => {
      if (!selectedStudents.length) {
        showToast("Select students first.");
        return;
      }

      try {
        await Promise.all(
          selectedStudents.map((student) =>
            authPost(`/api/dashboards/instructor/students/${student.id}/status/`, {
              action,
            }).catch(() => null)
          )
        );
        showToast(action === "send_message" ? "Messages queued." : action === "schedule_meeting" ? "Meetings queued." : "Reminders sent.");
      } catch {
        showToast("Quick action endpoint is not available on current backend.");
      }
    },
    [selectedStudents, showToast]
  );

  const saveNote = useCallback(async () => {
    if (!note.trim()) {
      showToast("Write a note first.");
      return;
    }

    if (!selectedStudents.length) {
      showToast("Select students first.");
      return;
    }

    try {
      await Promise.all(
        selectedStudents.map((student) =>
          authPost("/api/instructor/student-note/", {
            student_id: student.id,
            course_id: student.courseId,
            note: note.trim(),
          }).catch(() => null)
        )
      );
      setNote("");
      showToast("Notes saved.");
    } catch {
      showToast("Notes endpoint is not available on current backend.");
    }
  }, [note, selectedStudents, showToast]);

  const handleCsvImportFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setCsvRows([]);
      setCsvErrors(["CSV must include a header and at least one row."]);
      return;
    }

    const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
    const emailIndex = headers.findIndex((header) => ["email", "student_email"].includes(header));
    const nameIndex = headers.findIndex((header) => ["name", "student_name", "full_name"].includes(header));
    const idIndex = headers.findIndex((header) => ["student_id", "school_id", "id"].includes(header));

    if (emailIndex < 0 && idIndex < 0) {
      setCsvRows([]);
      setCsvErrors(["CSV requires email or student_id column."]);
      return;
    }

    const nextRows = [];
    const nextErrors = [];

    lines.slice(1).forEach((line, rowIndex) => {
      const values = parseCsvLine(line);
      const email = String(values[emailIndex] || "").trim();
      const name = String(values[nameIndex] || "").trim();
      const studentId = String(values[idIndex] || "").trim();

      if (email && !emailRegex.test(email)) {
        nextErrors.push(`Row ${rowIndex + 2}: invalid email "${email}".`);
      }
      if (!email && !studentId) {
        nextErrors.push(`Row ${rowIndex + 2}: missing both email and student_id.`);
      }

      nextRows.push({ name: name || "", email, student_id: studentId });
    });

    setCsvRows(nextRows);
    setCsvErrors(nextErrors);
  }, []);

  const handleSubmitImport = useCallback(async () => {
    if (!csvRows.length) {
      showToast("Upload a CSV first.");
      return;
    }

    if (csvErrors.length) {
      showToast("Resolve CSV errors before importing.");
      return;
    }

    setImporting(true);

    try {
      await authPost("/api/dashboards/instructor/students/import/", {
        students: csvRows,
        course_id: selectedCourse === "all" ? null : selectedCourse,
      });
      showToast("Students imported successfully.");
      setCsvRows([]);
      await loadStudents();
    } catch {
      if (selectedCourse !== "all") {
        const withIds = csvRows.filter((row) => row.student_id);
        await Promise.all(
          withIds.map((row) =>
            authPost(`/api/courses/${selectedCourse}/add-student/`, {
              student_id: row.student_id,
            }).catch(() => null)
          )
        );
        showToast("Imported with fallback add-student endpoint.");
        await loadStudents();
      } else {
        showToast("Import endpoint unavailable. Select a course for fallback import.");
      }
    } finally {
      setImporting(false);
    }
  }, [csvErrors.length, csvRows, loadStudents, selectedCourse, showToast]);

  const handleRemoveStudent = useCallback(
    async (student) => {
      if (selectedCourse === "all") {
        showToast("Select a specific course to remove student.");
        return;
      }

      try {
        await authPost(`/api/dashboards/instructor/students/${student.id}/remove/`, {
          course_id: selectedCourse,
        });
        showToast("Student removed from course.");
        await loadStudents();
      } catch {
        showToast("Remove endpoint is not available on current backend.");
      }
    },
    [loadStudents, selectedCourse, showToast]
  );

  const handleResendInvite = useCallback(
    async (student) => {
      try {
        await authPost(`/api/dashboards/instructor/students/${student.id}/status/`, {
          action: "resend_invite",
          status: "pending_invite",
        });
        showToast("Invite sent.");
      } catch {
        showToast("Invite endpoint is not available on current backend.");
      }
    },
    [showToast]
  );

  const openStudentDrawer = useCallback(async (student) => {
    setDrawerStudent(student);
    setDrawerLoading(true);
    setDrawerDetails(null);

    try {
      const detail = await authGet(`/api/instructor/students/${student.id}/insights/`);
      setDrawerDetails(detail || null);
    } catch {
      setDrawerDetails(null);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const isCurrentPageFullySelected = useMemo(
    () => paginatedStudents.length > 0 && paginatedStudents.every((student) => selectedIds.has(getSelectionKey(student))),
    [getSelectionKey, paginatedStudents, selectedIds]
  );

  return (
    <div className="space-y-6">
      {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{toast}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950">Student Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Scalable management, activity insights, assessments, attendance, and risk analytics.</p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-semibold text-emerald-900">{headerStats.total}</p></article>
          <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Active</p><p className="text-xl font-semibold text-emerald-900">{headerStats.active}</p></article>
          <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">At Risk</p><p className="text-xl font-semibold text-emerald-900">{headerStats.atRisk}</p></article>
          <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Inactive</p><p className="text-xl font-semibold text-emerald-900">{headerStats.inactive}</p></article>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or student ID"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none md:col-span-2"
          />

          <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === filter.key ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <nav className="sticky top-3 z-20 rounded-xl border border-emerald-100 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${activeTab === tab.key ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 hover:bg-emerald-50"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-emerald-50" />}>
        {activeTab === "overview" && (
          <StudentOverviewTab
            loading={loading}
            paginatedStudents={paginatedStudents}
            totalPages={totalPages}
            page={page}
            setPage={setPage}
            selectedIds={selectedIds}
            getSelectionKey={getSelectionKey}
            isCurrentPageFullySelected={isCurrentPageFullySelected}
            toggleSelectAllCurrentPage={toggleSelectAllCurrentPage}
            toggleSelected={toggleSelected}
            openStudentDrawer={openStudentDrawer}
            handleRemoveStudent={handleRemoveStudent}
            handleResendInvite={handleResendInvite}
            formatRelativeDate={formatRelativeDate}
            riskBadgeClass={riskBadgeClass}
          />
        )}

        {activeTab === "activity" && (
          <StudentActivityTab isActive={activeTab === "activity"} selectedCourse={selectedCourse} students={sortedStudents} />
        )}

        {activeTab === "assessments" && (
          <StudentAssessmentsTab
            isActive={activeTab === "assessments"}
            selectedCourse={selectedCourse}
            courseId={selectedCourse}
            students={sortedStudents}
          />
        )}

        {activeTab === "attendance" && (
          <StudentAttendanceTab isActive={activeTab === "attendance"} selectedCourse={selectedCourse} students={sortedStudents} />
        )}

        {activeTab === "risk" && (
          <StudentRiskTab isActive={activeTab === "risk"} selectedCourse={selectedCourse} students={sortedStudents} />
        )}

        {activeTab === "management" && (
          <StudentManagementTab
            bulkAction={bulkAction}
            setBulkAction={setBulkAction}
            bulkActions={bulkActions}
            bulkLoading={bulkLoading}
            selectedCount={selectedIds.size}
            handleBulkAction={handleBulkAction}
            handleQuickAction={handleQuickAction}
            note={note}
            setNote={setNote}
            saveNote={saveNote}
            csvRows={csvRows}
            csvErrors={csvErrors}
            importing={importing}
            handleCsvImportFile={handleCsvImportFile}
            handleSubmitImport={handleSubmitImport}
            exportAll={() => exportRows("all_students.csv", enrichedStudents)}
            exportFiltered={() => exportRows("filtered_students.csv", sortedStudents)}
            exportSelected={() => exportRows("selected_students.csv", selectedStudents)}
          />
        )}
      </Suspense>

      {drawerStudent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-emerald-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">Student Profile</h3>
              <button type="button" onClick={() => setDrawerStudent(null)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Close</button>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <img
                src={drawerDetails?.student?.avatar || getDefaultAvatarDataUrl({ name: drawerStudent.name })}
                alt={drawerStudent.name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-100"
              />
              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="font-semibold">Name:</span> {drawerDetails?.student?.name || drawerStudent.name}</p>
                <p><span className="font-semibold">Email:</span> {drawerDetails?.student?.email || drawerStudent.email || "-"}</p>
                <p><span className="font-semibold">Course:</span> {drawerStudent.courseName}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4">
              <h4 className="text-sm font-semibold text-emerald-900">Enrolled Courses</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {(drawerDetails?.student?.enrolled_courses || []).length === 0 ? (
                  <span className="text-xs text-gray-500">No course data.</span>
                ) : (
                  (drawerDetails?.student?.enrolled_courses || []).map((course) => (
                    <span key={course.id} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                      {course.title}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <h4 className="text-sm font-semibold text-emerald-900">Analytics</h4>
              {drawerLoading ? (
                <div className="mt-2 space-y-2">{[...Array(5)].map((_, index) => <div key={index} className="h-6 animate-pulse rounded bg-emerald-100" />)}</div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p><span className="font-medium">Average Score:</span> {drawerDetails?.analytics?.average_score ?? drawerStudent.quizAverage}%</p>
                  <p><span className="font-medium">Assignments Submitted:</span> {drawerDetails?.analytics?.assignments_submitted ?? Math.max(0, 10 - drawerStudent.assignmentsMissed)}</p>
                  <p><span className="font-medium">Missing Assignments:</span> {drawerDetails?.analytics?.missing_assignments ?? drawerStudent.assignmentsMissed}</p>
                  <p><span className="font-medium">Risk Prediction:</span> {(drawerDetails?.analytics?.risk_prediction || drawerStudent.riskLevel || "low").toUpperCase()}</p>
                  <p><span className="font-medium">Risk Score:</span> {drawerDetails?.analytics?.risk_score ?? "-"}</p>
                </div>
              )}
            </div>
            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-emerald-900">Activity Timeline</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {(drawerDetails?.timeline || drawerStudent.timeline || []).map((log, index) => (
                  <li key={`${log.label || log.message || "log"}-${index}`} className="rounded-lg border border-gray-200 p-2">
                    <p className="font-medium">{log.label || log.message || "Activity"}</p>
                    {log.course && <p className="text-xs text-gray-600">{log.course}{log.activity ? ` - ${log.activity}` : ""}</p>}
                    <p className="text-xs text-gray-500">{log.at ? new Date(log.at).toLocaleString() : "No timestamp"}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default memo(Students);
