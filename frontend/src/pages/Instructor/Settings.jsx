import React, { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authGet, authPost, authPut } from "../../utils/api";

const cardClass = "rounded-xl border border-emerald-100 bg-white p-5 shadow-sm";

const themeOptions = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];

const accentOptions = [
  { key: "green", label: "Dark Green", value: "#065f46" },
  { key: "blue", label: "Blue", value: "#1d4ed8" },
  { key: "purple", label: "Purple", value: "#6d28d9" },
];

const resolveSystemDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyThemeChoice = (theme) => {
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && resolveSystemDark());
  if (isDark) root.classList.add("dark");
  else root.classList.remove("dark");
};

const applyAccentChoice = (accentKey) => {
  const root = document.documentElement;
  const selected = accentOptions.find((option) => option.key === accentKey) || accentOptions[0];
  root.style.setProperty("--instructor-accent", selected.value);
};

function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const [notifications, setNotifications] = useState({
    notify_assignment_submission: true,
    notify_quiz_completed: true,
    notify_student_join_course: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [appearance, setAppearance] = useState(() => ({
    theme: localStorage.getItem("instructor_theme") || "system",
    accent: localStorage.getItem("instructor_accent") || "green",
  }));

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await authGet("/api/instructor/notification-settings/");
        if (!mounted || !data) return;
        setNotifications({
          notify_assignment_submission: Boolean(data.notify_assignment_submission),
          notify_quiz_completed: Boolean(data.notify_quiz_completed),
          notify_student_join_course: Boolean(data.notify_student_join_course),
        });
      } catch {
        if (mounted) setError("Could not load notification settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("instructor_theme", appearance.theme);
    localStorage.setItem("instructor_accent", appearance.accent);
    localStorage.setItem("theme", appearance.theme);
    applyThemeChoice(appearance.theme);
    applyAccentChoice(appearance.accent);
  }, [appearance]);

  const notificationRows = useMemo(
    () => [
      {
        key: "notify_assignment_submission",
        label: "Notify when student submits assignment",
      },
      {
        key: "notify_quiz_completed",
        label: "Notify when quiz is completed",
      },
      {
        key: "notify_student_join_course",
        label: "Notify when student joins course",
      },
    ],
    []
  );

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleNotificationSave = async () => {
    setSavingNotifications(true);
    setError("");
    try {
      const updated = await authPut("/api/instructor/notification-settings/", notifications);
      setNotifications(updated);
      showToast("Notification settings saved.");
    } catch {
      setError("Failed to save notification settings.");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setError("Current and new password are required.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSavingPassword(true);
    setError("");

    try {
      await authPost("/api/auth/change-password/", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      showToast("Password changed successfully.");
    } catch (requestError) {
      setError(requestError?.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-emerald-50" />;
  }

  return (
    <div className="space-y-6 pb-12">
      {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{toast}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Instructor Settings</h1>
        <p className="mt-2 text-sm text-gray-600">Manage profile access, notifications, security, and appearance.</p>
      </header>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Profile Settings</h2>
        <p className="mt-2 text-sm text-gray-600">Manage your avatar, department, bio, and contact details in the profile page.</p>
        <button
          type="button"
          onClick={() => navigate("/instructor-dashboard/profile")}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Go To Profile
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Notification Settings</h2>
        <div className="mt-4 space-y-3">
          {notificationRows.map((row) => (
            <label key={row.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              {row.label}
              <input
                type="checkbox"
                checked={Boolean(notifications[row.key])}
                onChange={(event) =>
                  setNotifications((prev) => ({
                    ...prev,
                    [row.key]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleNotificationSave}
          disabled={savingNotifications}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {savingNotifications ? "Saving..." : "Save Notifications"}
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Security</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="password"
            className="rounded-xl border border-gray-200 px-3 py-2"
            placeholder="Current Password"
            value={passwordForm.current_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))}
          />
          <input
            type="password"
            className="rounded-xl border border-gray-200 px-3 py-2"
            placeholder="New Password"
            value={passwordForm.new_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
          />
          <input
            type="password"
            className="rounded-xl border border-gray-200 px-3 py-2"
            placeholder="Confirm Password"
            value={passwordForm.confirm_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={handleChangePassword}
          disabled={savingPassword}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {savingPassword ? "Updating..." : "Change Password"}
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Appearance</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Theme</p>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAppearance((prev) => ({ ...prev, theme: option.key }))}
                  className={`rounded-lg px-3 py-2 text-sm ${appearance.theme === option.key ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Accent Color</p>
            <div className="flex flex-wrap gap-2">
              {accentOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAppearance((prev) => ({ ...prev, accent: option.key }))}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${appearance.accent === option.key ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.value }} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(Settings);
