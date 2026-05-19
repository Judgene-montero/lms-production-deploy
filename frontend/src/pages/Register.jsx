import React, { useState } from "react";
import axios from "../utils/axiosInstance";
import { Loader2, Eye, EyeOff } from "lucide-react";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "student",
  });

  const validate = () => {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (!form.username.trim()) return "Username is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!isValidEmail(form.email.trim())) return "Enter a valid email address.";
    if (!form.password || form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirm_password) return "Passwords do not match.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirm_password: form.confirm_password,
        role: form.role === "instructor" ? "instructor" : "student",
      };

      const res = await axios.post("/api/users/register/", payload);
      setSuccess(res.data?.message || "Registration successful. Please verify your email.");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] items-start justify-center overflow-hidden bg-[#062b22] p-3 sm:min-h-screen sm:items-center sm:p-4">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#041d16]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(62,173,131,0.35),transparent_42%),radial-gradient(circle_at_85%_88%,rgba(11,83,62,0.7),transparent_40%),linear-gradient(125deg,#0b3d30_0%,#062b22_45%,#041d16_100%)] opacity-70" />
      <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="absolute bottom-6 right-0 h-52 w-52 rounded-full bg-emerald-200/10 blur-3xl" />

      <div className="relative z-10 max-h-[calc(100svh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-[24px] border border-white/20 bg-white/10 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Create Account</h2>
          <p className="mt-2 text-sm text-emerald-100/85">Register to access your learning dashboard</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200/30 bg-red-500/20 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-emerald-200/30 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
                First Name
              </label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                autoComplete="given-name"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
                Last Name
              </label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
              Username
            </label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
              autoComplete="new-username"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
              autoComplete="new-email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
              Role
            </label>
            <div className="flex flex-col items-start gap-3 rounded-xl border border-white/25 bg-white/90 px-4 py-3 sm:flex-row sm:items-center sm:gap-5">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={form.role === "student"}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="accent-emerald-600"
                />
                Student
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value="instructor"
                  checked={form.role === "instructor"}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="accent-emerald-600"
                />
                Instructor
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 pr-10 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className="w-full rounded-xl border border-white/25 bg-white/90 px-4 py-3 pr-10 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.4)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Register"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/login")}
            className="w-full rounded-xl border border-white/40 bg-white/10 py-3 text-sm font-medium text-emerald-50 transition hover:bg-white/20"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
