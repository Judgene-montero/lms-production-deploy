import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, getUserProfile } from "../utils/api";

const COLLEGE_NAME = "Southern Tech College Foundation Incorporated";
const SUBTITLE = "Learning Management System";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [typedCollegeName, setTypedCollegeName] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);

  useEffect(() => {
    let index = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      if (!deleting) {
        const nextIndex = index + 1;
        setTypedCollegeName(COLLEGE_NAME.slice(0, nextIndex));
        index = nextIndex;

        if (index === COLLEGE_NAME.length) {
          setIsTypingDone(true);
          deleting = true;
          timeoutId = setTimeout(tick, 1200);
          return;
        }

        setIsTypingDone(false);
        timeoutId = setTimeout(tick, 55);
        return;
      }

      const nextIndex = index - 1;
      setTypedCollegeName(COLLEGE_NAME.slice(0, Math.max(nextIndex, 0)));
      index = Math.max(nextIndex, 0);
      setIsTypingDone(false);

      if (index === 0) {
        deleting = false;
        timeoutId = setTimeout(tick, 300);
        return;
      }

      timeoutId = setTimeout(tick, 30);
    };

    timeoutId = setTimeout(tick, 280);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUser(formData);

      if (!data.access) {
        setError("Invalid username/email or password.");
        setLoading(false);
        return;
      }

      localStorage.setItem("access", data.access);
      if (data.refresh) localStorage.setItem("refresh", data.refresh);

      const user = await getUserProfile(data.access);
      const role = user.role?.toLowerCase().trim();
      localStorage.setItem("role", role);
      localStorage.setItem("profile_complete", String(Boolean(user.profile_complete)));

      switch (role) {
        case "student":
          navigate("/student/dashboard");
          break;
        case "instructor":
          navigate("/instructor-dashboard");
          break;
        case "admin":
          navigate("/admin/dashboard");
          break;
        default:
          setError("Invalid role. Cannot redirect.");
          break;
      }
    } catch (err) {
      console.error("Login error:", err);
      const message = err?.message || "Login failed.";
      if (message.toLowerCase().includes("pending")) {
        setError("Instructor account is waiting for admin approval.");
      } else if (message.toLowerCase().includes("verify")) {
        setError("Account inactive. Please verify your email first.");
      } else if (message.toLowerCase().includes("invalid")) {
        setError("Invalid username/email or password.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] items-start justify-center overflow-hidden bg-[#062b22] px-3 py-6 sm:min-h-screen sm:items-center sm:px-4 sm:py-10">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source src="/videost.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#041d16]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(62,173,131,0.35),transparent_42%),radial-gradient(circle_at_85%_88%,rgba(11,83,62,0.7),transparent_40%),linear-gradient(125deg,#0b3d30_0%,#062b22_45%,#041d16_100%)] opacity-70" />
      <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="absolute bottom-6 right-0 h-52 w-52 rounded-full bg-emerald-200/10 blur-3xl" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[calc(100svh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] border border-white/20 bg-white/10 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:p-8"
      >
        <div className="mb-7 text-center">
          <img
            src="/OIP (1).jpg"
            alt="STCFI Logo"
            className="mx-auto mb-3 h-14 w-14 rounded-full border border-emerald-200/35 bg-white/85 object-cover p-1 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
          />
          <h2 className="bg-gradient-to-r from-emerald-100 via-emerald-300 to-teal-200 bg-clip-text text-3xl font-semibold tracking-[0.08em] text-transparent [text-shadow:0_0_28px_rgba(16,185,129,0.3)] sm:text-4xl">
            STCFI LMS
          </h2>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-emerald-100/80">{SUBTITLE}</p>
          <p
            className={`mt-3 min-h-[1.25rem] text-sm transition-colors duration-700 ${
              isTypingDone ? "text-emerald-300" : "text-white"
            }`}
          >
            {typedCollegeName}
            {!isTypingDone && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-white/90 align-[-2px]" />
            )}
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-200/30 bg-red-500/20 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <label className="mb-4 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
            Username or Email
          </span>
          <input
            type="text"
            name="username"
            placeholder="Enter your username or email"
            value={formData.username}
            onChange={handleChange}
            className="w-full min-w-0 rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
            required
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
            Password
          </span>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            className="w-full min-w-0 rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.4)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-5 text-center text-sm text-emerald-50">
          No account?{" "}
          <span
            onClick={() => navigate("/register")}
            className="cursor-pointer font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Register
          </span>
        </p>
      </form>
    </div>
  );
};

export default Login;
