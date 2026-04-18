import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosInstance";
import { Eye, RefreshCw, Trash2, UserCheck } from "lucide-react";

const API_USERS = "http://127.0.0.1:8000/api/users";

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const res = await axios.get(`${API_USERS}/admin/users/`, getAuthHeaders());
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setUsers([]);
      setNotice(err.response?.data?.error || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const roleFiltered =
      activeTab === "all" ? users : users.filter((u) => (u.role || "").toLowerCase() === activeTab);

    if (!q) return roleFiltered;
    return roleFiltered.filter((u) =>
      [u.username, u.email, u.first_name, u.last_name, u.role, u.school_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, query, activeTab]);

  const approveInstructor = async (userId) => {
    try {
      await axios.post(`${API_USERS}/admin/instructor-approve/${userId}/`, {}, getAuthHeaders());
      setNotice("Instructor approved.");
      fetchUsers();
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to approve instructor.");
    }
  };

  const toggleActive = async (user) => {
    try {
      await axios.patch(
        `${API_USERS}/admin/users/${user.id}/`,
        { is_active: !user.is_active },
        getAuthHeaders()
      );
      setNotice(`User ${!user.is_active ? "activated" : "deactivated"}.`);
      fetchUsers();
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to update active status.");
    }
  };

  const deleteUser = async (userId) => {
    const ok = window.confirm("Delete this user account?");
    if (!ok) return;

    try {
      await axios.delete(`${API_USERS}/admin/users/${userId}/`, getAuthHeaders());
      setNotice("User deleted.");
      fetchUsers();
      if (selectedUser?.id === userId) setSelectedUser(null);
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to delete user.");
    }
  };

  const viewDetails = async (userId) => {
    try {
      const res = await axios.get(`${API_USERS}/admin/users/${userId}/`, getAuthHeaders());
      setSelectedUser(res.data || null);
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to load user details.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Admin User Management</h1>
        <button
          type="button"
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</div>}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search username, email, name, role, school ID"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Users" },
          { key: "student", label: "Students" },
          { key: "instructor", label: "Instructors" },
          { key: "admin", label: "Admins" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-sm ${
              activeTab === tab.key ? "bg-blue-600 text-white" : "border border-gray-300 bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">Username</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">First Name</th>
                <th className="px-3 py-3 text-left">Last Name</th>
                <th className="px-3 py-3 text-left">Role</th>
                <th className="px-3 py-3 text-left">School ID</th>
                <th className="px-3 py-3 text-left">Email Verified</th>
                <th className="px-3 py-3 text-left">Active</th>
                <th className="px-3 py-3 text-left">Date Joined</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-3 py-5 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-3 py-5 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-gray-100">
                    <td className="px-3 py-3">{user.username}</td>
                    <td className="px-3 py-3">{user.email || "-"}</td>
                    <td className="px-3 py-3">{user.first_name || "-"}</td>
                    <td className="px-3 py-3">{user.last_name || "-"}</td>
                    <td className="px-3 py-3 capitalize">{user.role}</td>
                    <td className="px-3 py-3">{user.school_id || "-"}</td>
                    <td className="px-3 py-3">{user.is_email_verified ? "Yes" : "No"}</td>
                    <td className="px-3 py-3">{user.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-3 py-3">{formatDate(user.date_joined)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.role === "instructor" && user.is_email_verified && !user.is_active && (
                          <button
                            type="button"
                            onClick={() => approveInstructor(user.id)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                          >
                            <UserCheck size={13} /> Approve
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleActive(user)}
                          className="rounded bg-amber-600 px-2 py-1 text-xs text-white"
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => viewDetails(user.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white"
                        >
                          <Eye size={13} /> View
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteUser(user.id)}
                          className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Details</h2>
            <button type="button" onClick={() => setSelectedUser(null)} className="text-sm text-gray-500">
              Close
            </button>
          </div>
          <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs">
            {JSON.stringify(selectedUser, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

