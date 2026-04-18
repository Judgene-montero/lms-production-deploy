import React, { useCallback, useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import { RefreshCw, UserCheck } from "lucide-react";

const API_USERS = "http://127.0.0.1:8000/api/users";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

export default function AdminInstructorApprovals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const allUsersRes = await axios.get(`${API_USERS}/admin/users/`, getAuthHeaders());
      const allUsers = Array.isArray(allUsersRes.data) ? allUsersRes.data : [];
      const pending = allUsers.filter(
        (u) =>
          (u.role || "").toLowerCase() === "instructor" &&
          u.is_email_verified === true &&
          u.is_active === false
      );
      setRows(pending);
    } catch (err) {
      // Fallback for compatibility if /admin/users/ is unavailable.
      try {
        const res = await axios.get(`${API_USERS}/admin/pending-instructors/`, getAuthHeaders());
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (fallbackErr) {
        setRows([]);
        setNotice(
          fallbackErr.response?.data?.error ||
            err.response?.data?.error ||
            "Failed to load pending instructors."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approve = async (id) => {
    try {
      await axios.post(`${API_USERS}/admin/instructor-approve/${id}/`, {}, getAuthHeaders());
      setNotice("Instructor approved.");
      fetchPending();
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to approve instructor.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pending Instructor Approvals</h1>
        <button
          type="button"
          onClick={fetchPending}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</div>}

      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-3 py-3 text-left">Username</th>
              <th className="px-3 py-3 text-left">Email</th>
              <th className="px-3 py-3 text-left">Date Joined</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="px-3 py-5 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-3 py-5 text-center text-gray-500">
                  No pending instructors.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-3">{row.last_name}, {row.first_name}</td>
                  <td className="px-3 py-3">{row.username}</td>
                  <td className="px-3 py-3">{row.email}</td>
                  <td className="px-3 py-3">{new Date(row.date_joined).toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => approve(row.id)}
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white"
                    >
                      <UserCheck size={13} /> Approve Instructor
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

