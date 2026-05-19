import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosInstance";
import { Eye, KeyRound, RefreshCw, Trash2, UserCheck, UserCog } from "lucide-react";
import AdminPanel from "../components/admin/AdminPanel";
import AdminTableSection from "../components/admin/AdminTableSection";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const PAGE_SIZE = 8;

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, user: null, loading: false });
  const [activityModal, setActivityModal] = useState({
    open: false,
    user: null,
    data: null,
    loading: false,
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await axios.get("/api/users/admin/users/");
      const rows = Array.isArray(response.data) ? response.data : [];
      setUsers(rows);
      setSelectedUserIds((prev) => prev.filter((id) => rows.some((user) => user.id === id)));
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to load users.");
      setUsers([]);
      setSelectedUserIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatches = roleFilter === "all" || user.role === roleFilter;
      if (!roleMatches) return false;
      if (!normalizedQuery) return true;
      return [
        user.username,
        user.email,
        user.first_name,
        user.last_name,
        user.school_id,
        user.college,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [users, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredUsers, page]
  );
  const allVisibleSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((user) => selectedUserIds.includes(user.id));

  const updateUser = async (userId, payload, successMessage) => {
    try {
      await axios.patch(`/api/users/admin/users/${userId}/`, payload);
      setNotice(successMessage);
      await loadUsers();
      if (activityModal.open && activityModal.user?.id === userId) {
        await openActivityModal(activityModal.user);
      }
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to update user.");
    }
  };

  const approveInstructor = async (userId) => {
    try {
      await axios.post(`/api/users/admin/instructor-approve/${userId}/`);
      setNotice("Instructor approved.");
      await loadUsers();
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to approve instructor.");
    }
  };

  const resetPassword = async (userId) => {
    try {
      const response = await axios.post(`/api/users/admin/users/${userId}/reset-password/`, {});
      setTemporaryPassword(response.data?.temporary_password || "");
      setNotice("Password reset complete.");
      if (activityModal.open && activityModal.user?.id === userId) {
        await openActivityModal(activityModal.user);
      }
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to reset password.");
    }
  };

  const toggleSelectedUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !paginatedUsers.some((user) => user.id === id)));
      return;
    }

    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      paginatedUsers.forEach((user) => next.add(user.id));
      return [...next];
    });
  };

  const bulkUpdateStatus = async (statusValue) => {
    if (!selectedUserIds.length) {
      setNotice("Select at least one user first.");
      return;
    }

    setBulkSaving(true);
    setNotice("");
    try {
      const response = await axios.put("/api/users/admin/bulk-status/", {
        user_ids: selectedUserIds,
        status: statusValue,
      });
      setNotice(`${response.data?.updated || 0} user(s) set to ${statusValue}.`);
      setSelectedUserIds([]);
      await loadUsers();
    } catch (error) {
      setNotice(error.response?.data?.error || `Failed to set users ${statusValue}.`);
    } finally {
      setBulkSaving(false);
    }
  };

  const requestDeleteUser = (user) => {
    setDeleteState({ open: true, user, loading: false });
  };

  const confirmDeleteUser = async () => {
    if (!deleteState.user) return;

    setDeleteState((prev) => ({ ...prev, loading: true }));
    try {
      await axios.delete(`/api/users/admin/users/${deleteState.user.id}/`);
      setNotice(`User ${deleteState.user.username} deleted.`);
      setSelectedUserIds((prev) => prev.filter((id) => id !== deleteState.user.id));
      if (activityModal.user?.id === deleteState.user.id) {
        setActivityModal({ open: false, user: null, data: null, loading: false });
      }
      setDeleteState({ open: false, user: null, loading: false });
      await loadUsers();
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to delete user.");
      setDeleteState((prev) => ({ ...prev, loading: false }));
    }
  };

  const openActivityModal = async (user) => {
    setActivityModal({
      open: true,
      user,
      data: null,
      loading: true,
    });

    try {
      const response = await axios.get(`/api/users/admin/users/${user.id}/activity/`);
      setActivityModal({
        open: true,
        user,
        data: response.data || null,
        loading: false,
      });
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to load user activity.");
      setActivityModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_42%),linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Admin Authority</p>
            <h1 className="mt-2 text-3xl font-bold">Enhanced User Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Promote or demote instructors, activate and suspend users, reset passwords, and inspect recent user activity.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {notice ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {temporaryPassword ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Temporary password: <span className="font-semibold">{temporaryPassword}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,420px)]">
        <AdminPanel
          title="System Users"
          eyebrow="Accounts"
          description="Search and control students, instructors, and admins."
          actions={
            <>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              />
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All roles</option>
                <option value="student">Students</option>
                <option value="instructor">Instructors</option>
                <option value="admin">Admins</option>
              </select>
              <button
                type="button"
                onClick={() => bulkUpdateStatus("active")}
                disabled={bulkSaving || selectedUserIds.length === 0}
                className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
              >
                {bulkSaving ? "Saving..." : "Bulk Activate"}
              </button>
              <button
                type="button"
                onClick={() => bulkUpdateStatus("inactive")}
                disabled={bulkSaving || selectedUserIds.length === 0}
                className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
              >
                {bulkSaving ? "Saving..." : "Bulk Deactivate"}
              </button>
            </>
          }
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading users...</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>{selectedUserIds.length} user(s) selected.</p>
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700"
                  >
                    {allVisibleSelected ? "Clear Page Selection" : "Select Visible Page"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    disabled={selectedUserIds.length === 0}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <AdminTableSection
                columns={[
                  { key: "select", label: "Select" },
                  { key: "name", label: "User" },
                  { key: "role", label: "Role" },
                  { key: "status", label: "Status" },
                  { key: "courses", label: "Courses" },
                  { key: "last_login", label: "Last Login" },
                  { key: "actions", label: "Actions" },
                ]}
                rows={paginatedUsers}
                renderRow={(user) => (
                  <tr key={user.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleSelectedUser(user.id)}
                        aria-label={`Select ${user.username}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-slate-500">
                        {user.username}
                        {user.email ? ` • ${user.email}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">{user.role}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : user.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : user.status === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-rose-100 text-rose-700"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{user.course_count || 0}</p>
                      {Array.isArray(user.course_titles) && user.course_titles.length > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">{user.course_titles.join(", ")}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{user.last_login ? new Date(user.last_login).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.role === "instructor" && user.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => approveInstructor(user.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => updateUser(user.id, { is_active: !user.is_active }, `User ${user.is_active ? "deactivated" : "activated"}.`)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateUser(user.id, { role: user.role === "student" ? "instructor" : "student" }, "User role updated.")}
                          disabled={user.role === "admin"}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                        >
                          <UserCog className="h-3.5 w-3.5" />
                          Switch Role
                        </button>
                        <button
                          type="button"
                          onClick={() => resetPassword(user.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => openActivityModal(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Activity
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteUser(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              />

              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {paginatedUsers.length} of {filteredUsers.length} users
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </AdminPanel>

        <AdminPanel
          title="Bulk Controls"
          eyebrow="Operations"
          description="Use the backend bulk-status endpoint to activate or deactivate multiple accounts safely."
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Selection</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{selectedUserIds.length}</p>
              <p className="mt-1 text-sm text-slate-500">account(s) currently selected for bulk actions</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => bulkUpdateStatus("active")}
                disabled={bulkSaving || selectedUserIds.length === 0}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {bulkSaving ? "Updating..." : "Activate Selected Users"}
              </button>
              <button
                type="button"
                onClick={() => bulkUpdateStatus("inactive")}
                disabled={bulkSaving || selectedUserIds.length === 0}
                className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {bulkSaving ? "Updating..." : "Deactivate Selected Users"}
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Notes</p>
              <p className="mt-2">Bulk role update is not exposed here because the current backend endpoint only supports status changes.</p>
              <p className="mt-2">User activity opens in a modal backed by `GET /api/users/admin/users/&lt;id&gt;/activity/`.</p>
              <p className="mt-2">Delete actions always require confirmation before the API call is sent.</p>
            </div>
          </div>
        </AdminPanel>
      </div>

      {activityModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">User Activity</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                  {activityModal.user?.first_name} {activityModal.user?.last_name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activityModal.user?.username} • {activityModal.user?.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityModal({ open: false, user: null, data: null, loading: false })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            {activityModal.loading ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                Loading activity...
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {Object.entries(activityModal.data?.summary || {}).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{key.replaceAll("_", " ")}</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {value && String(value).includes("T") ? new Date(value).toLocaleString() : String(value ?? "-")}
                      </p>
                    </div>
                  ))}
                </div>

                {Array.isArray(activityModal.data?.courses) && activityModal.data.courses.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Related Courses</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activityModal.data.courses.map((course) => (
                        <span key={course.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {course.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(activityModal.data?.recent_events) && activityModal.data.recent_events.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Recent Course Activity</p>
                    <div className="mt-3 space-y-3">
                      {activityModal.data.recent_events.map((entry, index) => (
                        <div key={`${entry.type}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3">
                          <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry.course} • {entry.status || entry.type}</p>
                          <p className="mt-1 text-xs text-slate-400">{entry.at ? new Date(entry.at).toLocaleString() : "-"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {(activityModal.data?.recent_activity || []).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <p className="font-medium text-slate-900">{entry.action}</p>
                      <p className="mt-1 text-sm text-slate-500">{entry.description || "No description"}</p>
                      <p className="mt-2 text-xs text-slate-400">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"}</p>
                    </div>
                  ))}
                  {!activityModal.data?.recent_activity?.length ? (
                    <p className="rounded-2xl border border-slate-200 px-4 py-5 text-sm text-slate-500">No recent admin log activity.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={deleteState.open}
        onCancel={() => setDeleteState({ open: false, user: null, loading: false })}
        onConfirm={confirmDeleteUser}
        loading={deleteState.loading}
        title="Delete User"
        confirmLabel="Delete User"
        text={
          deleteState.user
            ? `Delete ${deleteState.user.first_name} ${deleteState.user.last_name} (${deleteState.user.username})? This action cannot be undone.`
            : "Delete this user?"
        }
      />
    </div>
  );
}
