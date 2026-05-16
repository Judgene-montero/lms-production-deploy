import React, { useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import AdminPanel from "../components/admin/AdminPanel";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    require_email_verification: true,
    allow_instructor_self_registration: true,
    allow_username_change: true,
    default_user_role: "student",
    analytics_polling_interval: 10,
    analytics_low_risk_max: 0.3,
    analytics_medium_risk_max: 0.6,
    analytics_high_risk_min: 0.6,
    analytics_passing_grade: 75,
    max_login_attempts: 5,
  });

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get("/api/admin/settings/");
        setForm((prev) => ({ ...prev, ...(response.data || {}) }));
      } catch (error) {
        setNotice(error.response?.data?.error || "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        ...form,
        analytics_polling_interval: Number(form.analytics_polling_interval || 10),
        analytics_low_risk_max: Number(form.analytics_low_risk_max || 0.3),
        analytics_medium_risk_max: Number(form.analytics_medium_risk_max || 0.6),
        analytics_high_risk_min: Number(form.analytics_high_risk_min || 0.6),
        analytics_passing_grade: Number(form.analytics_passing_grade || 75),
        max_login_attempts: Number(form.max_login_attempts || 5),
      };
      const response = await axios.patch("/api/admin/settings/", payload);
      setForm((prev) => ({ ...prev, ...(response.data || {}) }));
      setNotice("Settings saved.");
    } catch (error) {
      const payload = error.response?.data;
      if (typeof payload === "object") {
        const firstError = Object.values(payload)[0];
        setNotice(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else {
        setNotice("Failed to save settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClassName = "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm";

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_40%),linear-gradient(135deg,#052e16,#0f766e,#0f172a)] px-6 py-8 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Policy Control</p>
        <h1 className="mt-2 text-3xl font-bold">Admin Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Configure authentication rules, user defaults, AI risk thresholds, and passing-grade logic used by analytics.
        </p>
      </header>

      {notice ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">Loading settings...</div>
      ) : (
        <div className="space-y-6">
          <AdminPanel title="Authentication and Registration" eyebrow="Access Rules">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.require_email_verification)}
                  onChange={(event) => setForm((prev) => ({ ...prev, require_email_verification: event.target.checked }))}
                />
                Require email verification
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.allow_instructor_self_registration)}
                  onChange={(event) => setForm((prev) => ({ ...prev, allow_instructor_self_registration: event.target.checked }))}
                />
                Allow instructor self-registration
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.allow_username_change)}
                  onChange={(event) => setForm((prev) => ({ ...prev, allow_username_change: event.target.checked }))}
                />
                Allow username change
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Default user role</span>
                <select
                  value={form.default_user_role}
                  onChange={(event) => setForm((prev) => ({ ...prev, default_user_role: event.target.value }))}
                  className={inputClassName}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                </select>
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="AI Analytics Control" eyebrow="Prediction Logic" description="These values are persisted in the backend and applied by the risk engine.">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Low risk max</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.analytics_low_risk_max}
                  onChange={(event) => setForm((prev) => ({ ...prev, analytics_low_risk_max: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Medium risk max</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.analytics_medium_risk_max}
                  onChange={(event) => setForm((prev) => ({ ...prev, analytics_medium_risk_max: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">High risk min</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.analytics_high_risk_min}
                  onChange={(event) => setForm((prev) => ({ ...prev, analytics_high_risk_min: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Passing grade</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.analytics_passing_grade}
                  onChange={(event) => setForm((prev) => ({ ...prev, analytics_passing_grade: event.target.value }))}
                  className={inputClassName}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="System Limits" eyebrow="Runtime">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Analytics polling interval (seconds)</span>
                <input
                  type="number"
                  min="5"
                  value={form.analytics_polling_interval}
                  onChange={(event) => setForm((prev) => ({ ...prev, analytics_polling_interval: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-slate-700">Maximum login attempts</span>
                <input
                  type="number"
                  min="1"
                  value={form.max_login_attempts}
                  onChange={(event) => setForm((prev) => ({ ...prev, max_login_attempts: event.target.value }))}
                  className={inputClassName}
                />
              </label>
            </div>
          </AdminPanel>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
