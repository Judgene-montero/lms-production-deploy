import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosInstance";
import { RefreshCw } from "lucide-react";

const API_ADMIN = "http://127.0.0.1:8000/api/admin";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

const fmt = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("-timestamp");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      params.set("ordering", sortOrder);

      const res = await axios.get(`${API_ADMIN}/logs/?${params.toString()}`, getAuthHeaders());
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setLogs([]);
      setNotice(err.response?.data?.detail || "Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, search, sortOrder]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Logs</h1>
        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</div>}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description/user/action"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="-timestamp">Newest first</option>
          <option value="timestamp">Oldest first</option>
        </select>

        <button
          type="button"
          onClick={fetchLogs}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
        >
          Apply Filters
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">Action</th>
                <th className="px-3 py-3 text-left">Performed By</th>
                <th className="px-3 py-3 text-left">Target User</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-3 py-6 text-center text-gray-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-3 py-6 text-center text-gray-500">No logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100">
                    <td className="px-3 py-3">{log.action}</td>
                    <td className="px-3 py-3">{log.performed_by_username || "-"}</td>
                    <td className="px-3 py-3">{log.target_user_username || "-"}</td>
                    <td className="px-3 py-3">{log.description || "-"}</td>
                    <td className="px-3 py-3">{fmt(log.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

