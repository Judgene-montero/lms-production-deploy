import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authGet, authPost, authPut } from "../../utils/api";
import { useTheme } from "../../context/ThemeContext";

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

const textSizeOptions = [
  { key: "normal", label: "Normal" },
  { key: "large", label: "Large" },
];

const applyAccentChoice = (accentKey) => {
  const root = document.documentElement;
  const selected = accentOptions.find((option) => option.key === accentKey) || accentOptions[0];
  root.style.setProperty("--student-accent", selected.value);
};

export default function StudentSettings() {
  const navigate = useNavigate();
  const { themeMode, setThemeMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [notifications, setNotifications] = useState({
    notify_instructor_announcement: true,
    notify_assignment_graded: true,
    notify_quiz_released: true,
    notify_due_date_approaching: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [appearance, setAppearance] = useState(() => ({
    theme: localStorage.getItem("student_theme") || localStorage.getItem("theme") || "system",
    accent: localStorage.getItem("student_accent") || "green",
    textSize: localStorage.getItem("student_text_size") || "normal",
    reducedMotion: localStorage.getItem("student_reduced_motion") === "true",
  }));

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await authGet("/api/student/notification-settings/");
        if (!mounted) return;
        setNotifications({
          notify_instructor_announcement: Boolean(data.notify_instructor_announcement),
          notify_assignment_graded: Boolean(data.notify_assignment_graded),
          notify_quiz_released: Boolean(data.notify_quiz_released),
          notify_due_date_approaching: Boolean(data.notify_due_date_approaching),
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
    localStorage.setItem("student_theme", appearance.theme);
    localStorage.setItem("student_accent", appearance.accent);
    localStorage.setItem("student_text_size", appearance.textSize);
    localStorage.setItem("student_reduced_motion", String(appearance.reducedMotion));
    if (setThemeMode) setThemeMode(appearance.theme);
    applyAccentChoice(appearance.accent);

    const root = document.documentElement;
    root.style.setProperty("--student-text-scale", appearance.textSize === "large" ? "1.05" : "1");
    root.style.fontSize = appearance.textSize === "large" ? "17px" : "";
    if (appearance.reducedMotion) root.classList.add("reduce-motion");
    else root.classList.remove("reduce-motion");
  }, [appearance, setThemeMode]);

  useEffect(() => {
    if (!themeMode) return;
    setAppearance((prev) => ({ ...prev, theme: themeMode }));
  }, [themeMode]);

  const notificationRows = useMemo(
    () => [
      {
        key: "notify_instructor_announcement",
        label: "Notify when instructor posts announcement",
      },
      {
        key: "notify_assignment_graded",
        label: "Notify when assignment graded",
      },
      {
        key: "notify_quiz_released",
        label: "Notify when quiz released",
      },
      {
        key: "notify_due_date_approaching",
        label: "Notify when due date approaching",
      },
    ],
    []
  );

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const saveNotifications = async () => {
    setError("");
    try {
      const updated = await authPut("/api/student/notification-settings/", notifications);
      setNotifications(updated);
      showToast("Notification settings saved.");
    } catch {
      setError("Failed to save notification settings.");
    }
  };

  const changePassword = async () => {
    setError("");
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setError("Current and new password are required.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      await authPost("/api/auth/change-password/", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      showToast("Password changed successfully.");
    } catch (requestError) {
      setError(requestError?.message || "Failed to change password.");
    }
  };

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-emerald-50" />;

  return (
    <div className="space-y-6 pb-12">
      {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{toast}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Student Settings</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your profile access, notifications, security, and appearance.</p>
      </header>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Profile Settings</h2>
        <p className="mt-2 text-sm text-gray-600">Manage avatar, profile details, and contact info in your profile page.</p>
        <button
          type="button"
          onClick={() => navigate("/student/dashboard/profile")}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Go To Profile
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Notification Settings</h2>
        <p className="mt-2 text-sm text-gray-600">Choose which student alerts should appear in your bell menu and reminders list.</p>
        <div className="mt-4 space-y-3">
          {notificationRows.map((row) => (
            <label key={row.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700">
              <span className="pr-4">{row.label}</span>
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
          onClick={saveNotifications}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Save Notifications
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
          onClick={changePassword}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Change Password
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
            <p className="mb-2 text-sm font-medium text-gray-700">Text Size</p>
            <div className="flex flex-wrap gap-2">
              {textSizeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAppearance((prev) => ({ ...prev, textSize: option.key }))}
                  className={`rounded-lg px-3 py-2 text-sm ${appearance.textSize === option.key ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
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
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Motion</p>
            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              Reduce motion and transitions
              <input
                type="checkbox"
                checked={appearance.reducedMotion}
                onChange={(event) => setAppearance((prev) => ({ ...prev, reducedMotion: event.target.checked }))}
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
