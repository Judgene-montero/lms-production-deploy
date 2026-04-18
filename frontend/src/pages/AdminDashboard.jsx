
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  ArrowUpDown,
  Eye,
  Bell,
  ShieldCheck,
  UserCog,
  RefreshCw,
  UploadCloud,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTheme } from "../context/ThemeContext";

const API_USERS = "http://127.0.0.1:8000/api/users";
const API_DASHBOARDS = "http://127.0.0.1:8000/api/dashboards";
const API_AI = "http://127.0.0.1:8000/api/ai";
const PAGE_SIZE = 10;

const ROLE_COLORS = ["#3B82F6", "#22C55E", "#A855F7"];
const PERF_COLORS = ["#22C55E", "#F59E0B", "#EF4444"];

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

// Normalizes mixed payloads from users_app, dashboards_app, and analytics_ai
// into one UI-friendly shape so table/profile rendering stays consistent.
const normalizeUser = (raw, roleFallback = "student") => {
  const role = (raw?.role || roleFallback || "student").toLowerCase();
  const firstName = raw?.first_name || raw?.firstName || "";
  const lastName = raw?.last_name || raw?.lastName || "";
  const middleInitial = raw?.middle_initial || raw?.middleInitial || "";
  const fullName =
    raw?.full_name ||
    raw?.name ||
    `${lastName ? `${lastName}, ` : ""}${firstName}${middleInitial ? ` ${middleInitial}.` : ""}`.trim();

  const courses = Array.isArray(raw?.courses)
    ? raw.courses
    : Array.isArray(raw?.enrollments)
    ? raw.enrollments.map((item) => item?.course_title || item?.title).filter(Boolean)
    : raw?.course
    ? [raw.course]
    : [];

  return {
    id: Number(raw?.id || raw?.user_id || 0),
    school_id: raw?.school_id || raw?.student_id || "",
    role,
    full_name: fullName || `User ${raw?.id || ""}`,
    first_name: firstName,
    last_name: lastName,
    college: raw?.college || "N/A",
    is_email_verified: Boolean(raw?.is_email_verified ?? false),
    is_active:
      raw?.is_active !== undefined
        ? Boolean(raw?.is_active)
        : String(raw?.status || raw?.account_status || "active").toLowerCase() === "active",
    status:
      (raw?.status || raw?.account_status
        ? String(raw?.status || raw?.account_status).toLowerCase()
        : raw?.is_active === false
        ? "inactive"
        : "active"),
    courses,
    progress: Number(raw?.progress ?? raw?.completion_rate ?? 0),
    submitted_count: Number(raw?.assignments_submitted ?? raw?.submitted_count ?? 0),
    total_assignments: Number(raw?.total_assignments ?? 0),
    score_avg: Number(raw?.avg_score ?? raw?.average_score ?? 0),
    average_completion_time: Number(raw?.average_completion_time ?? raw?.avg_completion_time ?? 0),
    engagement: Number(raw?.engagement ?? raw?.engagement_score ?? 0),
    low_performing: Boolean(raw?.low_performing ?? false),
    last_active: raw?.last_active || raw?.updated_at || raw?.created_at || null,
  };
};

const statusBadgeClass = (status) => {
  if (status === "inactive") return "bg-red-100 text-red-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
};

const progressTone = (value) => {
  if (value >= 75) return "bg-green-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
};

const ConfirmActionModal = ({ open, title, text, loading, onCancel, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{text}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-4">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</h2>
      </div>
    </div>
  </div>
);

export default function AdminDashboardHome() {
  const navigate = useNavigate();
  const { dark } = useTheme();

  const [activeTab, setActiveTab] = useState("students");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);

  const [liveUpdates, setLiveUpdates] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [notice, setNotice] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [editableProfile, setEditableProfile] = useState({ status: "active", college: "" });

  const [confirmAction, setConfirmAction] = useState({
    open: false,
    type: "",
    title: "",
    text: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [systemProgress, setSystemProgress] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError("");

    try {
      const res = await axios.get(`${API_USERS}/admin/users/`, getAuthHeaders());
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setUsers(list.map((item) => normalizeUser(item, item?.role || "student")));
    } catch (err) {
      console.error("Failed to fetch admin users", err);
      setUsers([]);
      setError("Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchSystemProgress = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const res = await axios.post(`${API_AI}/admin/progress/`, {}, getAuthHeaders());
      setSystemProgress(res.data?.data || null);
    } catch {
      setSystemProgress(null);
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!liveUpdates) return undefined;

    const timer = setInterval(() => {
      fetchUsers();
    }, 10000);

    return () => clearInterval(timer);
  }, [liveUpdates, fetchUsers]);

  useEffect(() => {
    fetchSystemProgress();
    const timer = setInterval(fetchSystemProgress, 10000);
    return () => clearInterval(timer);
  }, [fetchSystemProgress]);

  const allCourses = useMemo(() => {
    const set = new Set();
    users
      .filter((u) => (activeTab === "students" ? u.role === "student" : u.role === "instructor"))
      .forEach((u) => (u.courses || []).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [users, activeTab]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const roleScoped = users.filter((u) =>
      activeTab === "students" ? u.role === "student" : u.role === "instructor"
    );
    let list = [...roleScoped];

    if (q) {
      list = list.filter((u) => {
        const courseText = (u.courses || []).join(" ").toLowerCase();
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          courseText.includes(q)
        );
      });
    }

    if (courseFilter) {
      list = list.filter((u) => (u.courses || []).includes(courseFilter));
    }

    if (sortBy === "name") list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (sortBy === "course") {
      list.sort((a, b) => (a.courses[0] || "").localeCompare(b.courses[0] || ""));
    }
    if (sortBy === "progress") list.sort((a, b) => (b.progress || 0) - (a.progress || 0));

    return list;
  }, [users, activeTab, search, courseFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summaryStats = useMemo(() => {
    const students = users.filter((u) => u.role === "student").length;
    const instructors = users.filter((u) => u.role === "instructor").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const pendingInstructors = users.filter(
      (u) => u.role === "instructor" && u.is_email_verified === true && u.is_active === false
    ).length;
    const avgCompletionTime =
      users.length > 0
        ? (users.reduce((sum, u) => sum + (u.average_completion_time || 0), 0) / users.length).toFixed(1)
        : 0;
    const avgEngagement =
      users.length > 0 ? (users.reduce((sum, u) => sum + (u.engagement || 0), 0) / users.length).toFixed(1) : 0;
    const lowPerforming = users.filter((u) => u.low_performing || u.progress < 40 || u.score_avg < 60).length;

    return {
      total: users.length,
      students,
      instructors,
      admins,
      pendingInstructors,
      avgCompletionTime,
      avgEngagement,
      lowPerforming,
    };
  }, [users]);

  const rolePieData = useMemo(
    () => [
      { name: "Students", value: summaryStats.students },
      { name: "Instructors", value: summaryStats.instructors },
    ],
    [summaryStats.students, summaryStats.instructors]
  );

  const analyticsBarData = useMemo(
    () => [
      { metric: "Engagement", value: Number(summaryStats.avgEngagement) || 0 },
      { metric: "Avg Score", value: users.length ? users.reduce((s, u) => s + (u.score_avg || 0), 0) / users.length : 0 },
      { metric: "Low Perf", value: summaryStats.lowPerforming },
    ],
    [summaryStats.avgEngagement, summaryStats.lowPerforming, users]
  );

  const toggleSelectAll = () => {
    const ids = pageUsers.map((u) => u.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleUserSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openProfile = async (user) => {
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileData(user);
    setEditableProfile({ status: user.status || "active", college: user.college || "" });

    try {
      // dashboards_app: profile details (enrollment/progress context)
      const res = await axios.get(`${API_DASHBOARDS}/admin/users/${user.id}/`, getAuthHeaders());
      const normalized = normalizeUser(res.data, user.role);
      setProfileData(normalized);
      setEditableProfile({ status: normalized.status, college: normalized.college });
    } catch (primaryErr) {
      try {
        // analytics_ai fallback: metrics enrichment when profile endpoint is unavailable
        const metrics = await axios.get(`${API_AI}/admin/users/${user.id}/metrics/`, getAuthHeaders());
        setProfileData((prev) => ({
          ...prev,
          ...normalizeUser(metrics.data, user.role),
        }));
      } catch {
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profileData?.id) return;

    try {
      await axios.put(
        `${API_USERS}/admin/users/${profileData.id}/`,
        {
          status: editableProfile.status,
          college: editableProfile.college,
        },
        getAuthHeaders()
      );
      setNotice("Profile updated successfully.");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === profileData.id
            ? { ...u, status: editableProfile.status, college: editableProfile.college }
            : u
        )
      );
      setProfileData((prev) =>
        prev
          ? { ...prev, status: editableProfile.status, college: editableProfile.college }
          : prev
      );
    } catch (err) {
      setNotice(err.response?.data?.detail || "Failed to update profile.");
    }
  };

  const runBulkAction = async () => {
    if (selectedIds.length === 0 || !confirmAction.type) {
      setConfirmAction({ open: false, type: "", title: "", text: "" });
      return;
    }

    setActionLoading(true);
    try {
      if (confirmAction.type === "verify") {
        await axios.post(
          `${API_USERS}/admin/verify-ids/`,
          { user_ids: selectedIds },
          getAuthHeaders()
        );
        setNotice(`Verified ${selectedIds.length} user(s).`);
      }

      if (confirmAction.type === "notify") {
        await axios.post(
          `${API_DASHBOARDS}/admin/notifications/bulk/`,
          {
            user_ids: selectedIds,
            message: `Admin update: your status and progress were reviewed on ${new Date().toLocaleString()}.`,
          },
          getAuthHeaders()
        );
        setNotice(`Notification sent to ${selectedIds.length} user(s).`);
      }

      if (confirmAction.type === "inactive" || confirmAction.type === "active") {
        const nextStatus = confirmAction.type === "inactive" ? "inactive" : "active";

        await axios.put(
          `${API_USERS}/admin/bulk-status/`,
          { user_ids: selectedIds, status: nextStatus },
          getAuthHeaders()
        );

        setUsers((prev) =>
          prev.map((u) => (selectedIds.includes(u.id) ? { ...u, status: nextStatus } : u))
        );
        setNotice(`Updated ${selectedIds.length} user(s) to ${nextStatus}.`);
      }

      setSelectedIds([]);
      setConfirmAction({ open: false, type: "", title: "", text: "" });
    } catch (err) {
      setNotice(err.response?.data?.detail || "Bulk action failed.");
      setConfirmAction({ open: false, type: "", title: "", text: "" });
    } finally {
      setActionLoading(false);
    }
  };

  const themeCard = dark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-100";
  const themeText = dark ? "text-gray-100" : "text-gray-800";
  const themeSubtle = dark ? "text-gray-400" : "text-gray-500";
  const overviewStudents = summaryStats.students;
  const overviewInstructors = summaryStats.instructors;
  const overviewTotal = summaryStats.total;
  const pendingInstructors = users.filter(
    (u) => u.role === "instructor" && u.is_email_verified === true && u.is_active === false
  );

  return (
    <div className={`space-y-6 ${themeText}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6 text-blue-500" /> Admin Dashboard
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              fetchUsers();
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>

          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">
            <input
              type="checkbox"
              checked={liveUpdates}
              onChange={(e) => setLiveUpdates(e.target.checked)}
            />
            Live updates (10s)
          </label>
        </div>
      </header>

      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Users In View" value={summaryStats.total} icon={Users} color="bg-blue-100 text-blue-700" />
        <StatCard title="Low Performing" value={summaryStats.lowPerforming} icon={UserCheck} color="bg-red-100 text-red-700" />
        <StatCard title="Avg Completion Time (hrs)" value={summaryStats.avgCompletionTime} icon={UserPlus} color="bg-green-100 text-green-700" />
      </section>

      <section className={`${themeCard} rounded-2xl p-5 shadow-sm`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pending Instructor Approvals</h2>
          <span className={`text-sm ${themeSubtle}`}>{pendingInstructors.length} pending</span>
        </div>

        {loadingUsers ? (
          <p className={themeSubtle}>Loading pending instructors...</p>
        ) : pendingInstructors.length === 0 ? (
          <p className={themeSubtle}>No pending instructor approvals.</p>
        ) : (
          <div className="space-y-2">
            {pendingInstructors.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${
                  dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {item.last_name}, {item.first_name}
                  </p>
                  <p className={`text-xs ${themeSubtle}`}>{item.username} | {item.email}</p>
                </div>
                <button
                  type="button"
                  disabled={approvingId === item.id}
                  onClick={async () => {
                    setApprovingId(item.id);
                    try {
                      await axios.post(
                        `${API_USERS}/admin/instructor-approve/${item.id}/`,
                        {},
                        getAuthHeaders()
                      );
                      setNotice("Instructor account approved.");
                      setUsers((prev) =>
                        prev.map((u) =>
                          u.id === item.id ? { ...u, is_active: true, status: "active" } : u
                        )
                      );
                    } catch (err) {
                      setNotice(err.response?.data?.error || "Failed to approve instructor.");
                    } finally {
                      setApprovingId(null);
                    }
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {approvingId === item.id ? "Approving..." : "Approve Instructor"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`${themeCard} rounded-2xl p-4 text-left shadow-sm transition hover:shadow-md`}
        >
          <p className={`text-xs uppercase ${themeSubtle}`}>Total Students</p>
          <p className="mt-2 text-2xl font-bold">{overviewStudents}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("instructors")}
          className={`${themeCard} rounded-2xl p-4 text-left shadow-sm transition hover:shadow-md`}
        >
          <p className={`text-xs uppercase ${themeSubtle}`}>Total Instructors</p>
          <p className="mt-2 text-2xl font-bold">{overviewInstructors}</p>
        </button>

        <div className={`${themeCard} rounded-2xl p-4 shadow-sm`}>
          <p className={`text-xs uppercase ${themeSubtle}`}>Total Users</p>
          <p className="mt-2 text-2xl font-bold">{overviewTotal}</p>
        </div>

        <div className={`${themeCard} rounded-2xl p-4 shadow-sm`}>
          <p className={`text-xs uppercase ${themeSubtle}`}>Admins</p>
          <p className="mt-2 text-2xl font-bold">{summaryStats.admins || 0}</p>
        </div>

        <div className={`${themeCard} rounded-2xl p-4 shadow-sm`}>
          <p className={`text-xs uppercase ${themeSubtle}`}>Pending Instructor Approvals</p>
          <p className="mt-2 text-2xl font-bold">{summaryStats.pendingInstructors || 0}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/admin/upload-ids")}
          className={`${themeCard} rounded-2xl p-4 text-left shadow-sm transition hover:shadow-md`}
        >
          <p className={`text-xs uppercase ${themeSubtle}`}>Upload Users</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
            <UploadCloud className="h-4 w-4" /> Open Upload Page
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("students");
            document.getElementById("user-management")?.scrollIntoView({ behavior: "smooth" });
          }}
          className={`${themeCard} rounded-2xl p-4 text-left shadow-sm transition hover:shadow-md`}
        >
          <p className={`text-xs uppercase ${themeSubtle}`}>Manage Students</p>
          <p className="mt-2 text-sm font-semibold">Open user management table</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("instructors");
            document.getElementById("user-management")?.scrollIntoView({ behavior: "smooth" });
          }}
          className={`${themeCard} rounded-2xl p-4 text-left shadow-sm transition hover:shadow-md`}
        >
          <p className={`text-xs uppercase ${themeSubtle}`}>Manage Instructors</p>
          <p className="mt-2 text-sm font-semibold">Open user management table</p>
        </button>

        <div className={`${themeCard} rounded-2xl p-4 shadow-sm lg:col-span-2`}>
          <p className={`text-xs uppercase ${themeSubtle}`}>System Overview</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-emerald-500" />
            Avg Engagement: {summaryStats.avgEngagement} | Low Performing: {summaryStats.lowPerforming}
          </p>
          {systemProgress && (
            <p className={`mt-2 text-xs ${themeSubtle}`}>
              Tasks In Progress: {systemProgress.tasks_in_progress} | Completed: {systemProgress.tasks_completed} | Errors: {systemProgress.errors}
            </p>
          )}
          {!systemProgress && loadingProgress && (
            <p className={`mt-2 text-xs ${themeSubtle}`}>Syncing system progress...</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={`${themeCard} rounded-2xl p-5 shadow-sm`}>
          <h2 className="mb-3 text-lg font-semibold">Role Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={rolePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label>
                {rolePieData.map((item, idx) => (
                  <Cell key={`${item.name}-${idx}`} fill={ROLE_COLORS[idx % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${themeCard} rounded-2xl p-5 shadow-sm`}>
          <h2 className="mb-3 text-lg font-semibold">Summary Analytics</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analyticsBarData}>
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {analyticsBarData.map((row, idx) => (
                  <Cell key={`${row.metric}-${idx}`} fill={PERF_COLORS[idx % PERF_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section id="user-management" className={`${themeCard} rounded-2xl p-5 shadow-sm`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("students")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === "students"
                ? "bg-blue-600 text-white"
                : dark
                ? "bg-gray-800 text-gray-200"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab("instructors")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === "instructors"
                ? "bg-blue-600 text-white"
                : dark
                ? "bg-gray-800 text-gray-200"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Instructors
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, role, or course"
              className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${
                dark ? "border-gray-700 bg-gray-800 text-gray-100" : "border-gray-300"
              }`}
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${
              dark ? "border-gray-700 bg-gray-800 text-gray-100" : "border-gray-300"
            }`}
          >
            <option value="">All courses</option>
            {allCourses.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              dark ? "border-gray-700 bg-gray-800 text-gray-100" : "border-gray-300"
            }`}
          >
            <option value="name">Sort: Name</option>
            <option value="course">Sort: Course</option>
            <option value="progress">Sort: Progress</option>
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            disabled={selectedIds.length === 0}
            onClick={() =>
              setConfirmAction({
                open: true,
                type: "verify",
                title: "Verify Selected IDs",
                text: `Verify ${selectedIds.length} selected user record(s)?`,
              })
            }
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" /> Verify IDs
          </button>

          <button
            disabled={selectedIds.length === 0}
            onClick={() =>
              setConfirmAction({
                open: true,
                type: "notify",
                title: "Send Notification",
                text: `Send update notification to ${selectedIds.length} user(s)?`,
              })
            }
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Bell className="h-4 w-4" /> Notify
          </button>

          <button
            disabled={selectedIds.length === 0}
            onClick={() =>
              setConfirmAction({
                open: true,
                type: "active",
                title: "Set Active",
                text: `Mark ${selectedIds.length} selected user(s) as active?`,
              })
            }
            className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Set Active
          </button>

          <button
            disabled={selectedIds.length === 0}
            onClick={() =>
              setConfirmAction({
                open: true,
                type: "inactive",
                title: "Set Inactive",
                text: `Mark ${selectedIds.length} selected user(s) as inactive?`,
              })
            }
            className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Set Inactive
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className={dark ? "bg-gray-800" : "bg-gray-50"}>
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        pageUsers.length > 0 &&
                        pageUsers.every((u) => selectedIds.includes(u.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-left">Course(s)</th>
                  <th className="px-3 py-3 text-left">Role</th>
                  <th className="px-3 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Progress <ArrowUpDown className="h-3.5 w-3.5" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left">Assignments</th>
                  <th className="px-3 py-3 text-left">Score Avg</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan="9" className="px-3 py-6 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : pageUsers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-3 py-6 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  pageUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-t ${dark ? "border-gray-700 hover:bg-gray-800" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-medium">{user.full_name}</td>
                      <td className="px-3 py-3">
                        {user.courses.length > 0 ? user.courses.join(", ") : "-"}
                      </td>
                      <td className="px-3 py-3 capitalize">{user.role}</td>
                      <td className="px-3 py-3">
                        <div className="w-40">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span>{Math.round(user.progress || 0)}%</span>
                            {loadingProgress && <span className={themeSubtle}>Syncing...</span>}
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-full ${progressTone(user.progress || 0)}`}
                              style={{ width: `${Math.max(0, Math.min(100, user.progress || 0))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {user.submitted_count}
                        {user.total_assignments > 0 ? ` / ${user.total_assignments}` : ""}
                      </td>
                      <td className="px-3 py-3">{user.score_avg ? user.score_avg.toFixed(1) : "0.0"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => openProfile(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs dark:border-gray-600"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className={`text-sm ${themeSubtle}`}>
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {profileOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/30">
          <div className={`h-full w-full max-w-lg overflow-y-auto p-5 shadow-2xl ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">User Profile</h3>
              <button
                onClick={() => setProfileOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
              >
                Close
              </button>
            </div>

            {profileLoading || !profileData ? (
              <p className={themeSubtle}>Loading profile...</p>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 ${dark ? "bg-gray-800" : "bg-gray-50"}`}>
                  <p className="text-xl font-semibold">{profileData.full_name}</p>
                  <p className={`text-sm ${themeSubtle}`}>School ID: {profileData.school_id || "N/A"}</p>
                  <p className={`text-sm capitalize ${themeSubtle}`}>Role: {profileData.role}</p>
                </div>

                <div className={`grid grid-cols-1 gap-3 rounded-xl p-4 md:grid-cols-2 ${dark ? "bg-gray-800" : "bg-gray-50"}`}>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Enrollment</p>
                    <p className="text-sm">{profileData.courses.length || 0} course(s)</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Progress</p>
                    <p className="text-sm">{Math.round(profileData.progress || 0)}%</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Assignments Submitted</p>
                    <p className="text-sm">
                      {profileData.submitted_count}
                      {profileData.total_assignments ? ` / ${profileData.total_assignments}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Average Score</p>
                    <p className="text-sm">{profileData.score_avg ? profileData.score_avg.toFixed(1) : "0.0"}</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Avg Completion Time</p>
                    <p className="text-sm">{profileData.average_completion_time || 0} hrs</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase ${themeSubtle}`}>Engagement</p>
                    <p className="text-sm">{profileData.engagement || 0}</p>
                  </div>
                </div>

                <div className={`space-y-3 rounded-xl p-4 ${dark ? "bg-gray-800" : "bg-gray-50"}`}>
                  <h4 className="text-sm font-semibold">Admin Editable Fields</h4>
                  <label className="block text-sm">
                    <span className={`mb-1 block text-xs uppercase ${themeSubtle}`}>Status</span>
                    <select
                      value={editableProfile.status}
                      onChange={(e) =>
                        setEditableProfile((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        dark ? "border-gray-700 bg-gray-900 text-gray-100" : "border-gray-300"
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className={`mb-1 block text-xs uppercase ${themeSubtle}`}>College</span>
                    <input
                      value={editableProfile.college}
                      onChange={(e) =>
                        setEditableProfile((prev) => ({ ...prev, college: e.target.value }))
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        dark ? "border-gray-700 bg-gray-900 text-gray-100" : "border-gray-300"
                      }`}
                    />
                  </label>

                  <button
                    onClick={saveProfile}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                  >
                    <UserCog className="h-4 w-4" /> Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={confirmAction.open}
        title={confirmAction.title}
        text={confirmAction.text}
        loading={actionLoading}
        onCancel={() => setConfirmAction({ open: false, type: "", title: "", text: "" })}
        onConfirm={runBulkAction}
      />
    </div>
  );
}

