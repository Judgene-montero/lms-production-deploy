import React, { useCallback, useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import { Activity, Brain, RefreshCw } from "lucide-react";
import AdminMetricCard from "../components/admin/AdminMetricCard";
import AdminPanel from "../components/admin/AdminPanel";

export default function AdminAnalytics() {
  const [progress, setProgress] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [training, setTraining] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [progressRes, metricsRes] = await Promise.all([
        axios.post("/api/ai/admin/progress/", {}),
        axios.get("/api/ai/model-metrics/"),
      ]);
      setProgress(progressRes.data?.data || null);
      setMetrics(metricsRes.data || null);
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to load AI analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  const trainModel = useCallback(async () => {
    setTraining(true);
    setNotice("");
    try {
      const response = await axios.post("/api/ai/train-model/", {});
      const statusText = response.data?.status || "training completed";
      setNotice(`Model training finished: ${statusText}.`);
      await loadAnalytics();
    } catch (error) {
      const payload = error.response?.data;
      setNotice(payload?.error || payload?.status || "Model training failed.");
    } finally {
      setTraining(false);
    }
  }, [loadAnalytics]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_40%),linear-gradient(135deg,#451a03,#92400e,#0f172a)] px-6 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">AI Operations</p>
            <h1 className="mt-2 text-3xl font-bold">Analytics Monitoring</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Track model status, task throughput, and recent AI service health from an admin perspective.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading || training}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={trainModel}
            disabled={training || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            <Brain className="h-4 w-4" />
            {training ? "Training..." : "Train Model"}
          </button>
        </div>
      </header>

      {notice ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">Loading analytics...</div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminMetricCard title="Tasks In Progress" value={progress?.tasks_in_progress || 0} accent="amber" />
            <AdminMetricCard title="Tasks Completed" value={progress?.tasks_completed || 0} accent="emerald" />
            <AdminMetricCard title="Errors" value={progress?.errors || 0} accent="rose" />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminPanel title="AI Service Progress" eyebrow="Execution">
              <div className="rounded-2xl bg-slate-50 p-5">
                <div className="flex items-center gap-3 text-slate-900">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Background analytics tasks</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Last updated: {progress?.last_updated ? new Date(progress.last_updated).toLocaleString() : "-"}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Use the train button to call the existing `POST /api/ai/train-model/` endpoint from the admin UI.
                </p>
              </div>
            </AdminPanel>

            <AdminPanel title="Model Metrics" eyebrow="Prediction Quality">
              <div className="space-y-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
                <div className="flex items-center gap-3 text-slate-900">
                  <Brain className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold">Current at-risk model</span>
                </div>
                {metrics ? (
                  Object.entries(metrics).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between border-b border-slate-200 py-2 last:border-b-0">
                      <span className="capitalize text-slate-500">{key.replaceAll("_", " ")}</span>
                      <span className="font-medium text-slate-900">{String(value)}</span>
                    </div>
                  ))
                ) : (
                  <p>No model metrics available.</p>
                )}
              </div>
            </AdminPanel>
          </section>
        </>
      )}
    </div>
  );
}
