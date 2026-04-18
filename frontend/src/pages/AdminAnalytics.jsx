import React, { useCallback, useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import { Activity, Brain, RefreshCw } from "lucide-react";

const API_AI = "http://127.0.0.1:8000/api/ai";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

export default function AdminAnalytics() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_AI}/admin/progress/`, {}, getAuthHeaders());
      setProgress(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load system progress.");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
    const timer = setInterval(fetchProgress, 10000);
    return () => clearInterval(timer);
  }, [fetchProgress]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Analytics</h1>
        <button
          type="button"
          onClick={fetchProgress}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold">
            <Brain size={18} /> AI Analytics
          </h2>
          <p className="text-sm text-gray-600">Live admin-facing metrics for AI service health and task throughput.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold">
            <Activity size={18} /> System Progress
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading progress...</p>
          ) : progress ? (
            <div className="space-y-1 text-sm">
              <p>Tasks In Progress: <strong>{progress.tasks_in_progress}</strong></p>
              <p>Tasks Completed: <strong>{progress.tasks_completed}</strong></p>
              <p>Errors: <strong>{progress.errors}</strong></p>
              <p>Last Updated: <strong>{new Date(progress.last_updated).toLocaleString()}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

