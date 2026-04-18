import React, { useEffect, useState } from "react";
import axios from "../utils/axiosInstance";

const API_ADMIN = "http://127.0.0.1:8000/api/admin";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
});

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    require_email_verification: true,
    allow_instructor_self_registration: true,
    allow_username_change: true,
    default_user_role: "student",
    analytics_polling_interval: 10,
    max_login_attempts: 5,
  });

  const loadSettings = async () => {
    setLoading(true);
    setNotice("");
    try {
      const res = await axios.get(`${API_ADMIN}/settings/`, getAuthHeaders());
      setForm((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      setNotice(err.response?.data?.detail || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        ...form,
        analytics_polling_interval: Number(form.analytics_polling_interval || 10),
        max_login_attempts: Number(form.max_login_attempts || 5),
      };
      const res = await axios.patch(`${API_ADMIN}/settings/`, payload, getAuthHeaders());
      setForm((prev) => ({ ...prev, ...res.data }));
      setNotice("Settings saved.");
    } catch (err) {
      setNotice(err.response?.data?.detail || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Settings</h1>

      {notice && <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</div>}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">Loading settings...</div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Authentication Settings</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.require_email_verification)}
                onChange={(e) => setForm({ ...form, require_email_verification: e.target.checked })}
              />
              Require email verification
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.allow_instructor_self_registration)}
                onChange={(e) => setForm({ ...form, allow_instructor_self_registration: e.target.checked })}
              />
              Allow instructor self-registration
            </label>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">User Management Settings</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.allow_username_change)}
                onChange={(e) => setForm({ ...form, allow_username_change: e.target.checked })}
              />
              Allow username change
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block">Default user role</span>
              <select
                value={form.default_user_role || "student"}
                onChange={(e) => setForm({ ...form, default_user_role: e.target.value })}
                className="rounded border border-gray-300 px-3 py-2"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </label>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">System Settings</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block">Analytics polling interval (seconds)</span>
                <input
                  type="number"
                  min="5"
                  value={form.analytics_polling_interval}
                  onChange={(e) => setForm({ ...form, analytics_polling_interval: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block">Maximum login attempts</span>
                <input
                  type="number"
                  min="1"
                  value={form.max_login_attempts}
                  onChange={(e) => setForm({ ...form, max_login_attempts: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}

