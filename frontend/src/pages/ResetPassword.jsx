import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicGet, publicPost } from "../utils/api";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { uid, token } = useParams();
  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    const verifyLink = async () => {
      setChecking(true);
      setError("");
      try {
        await publicGet(`/api/users/password-reset/verify/${uid}/${token}/`);
        if (mounted) setValidLink(true);
      } catch (requestError) {
        if (mounted) {
          setValidLink(false);
          setError(requestError?.message || "This reset link is invalid or has expired.");
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    verifyLink();
    return () => {
      mounted = false;
    };
  }, [token, uid]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await publicPost("/api/users/password-reset/confirm/", {
        uid,
        token,
        new_password: form.new_password,
        confirm_password: form.confirm_password,
      });
      setSuccess(response?.message || "Password reset successful. You can now log in.");
      setForm({ new_password: "", confirm_password: "" });
      setValidLink(false);
    } catch (requestError) {
      setError(requestError?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] items-start justify-center overflow-hidden bg-[#062b22] px-3 py-6 sm:min-h-screen sm:items-center sm:px-4 sm:py-10">
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline preload="metadata">
        <source src="/videost.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#041d16]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(62,173,131,0.35),transparent_42%),radial-gradient(circle_at_85%_88%,rgba(11,83,62,0.7),transparent_40%),linear-gradient(125deg,#0b3d30_0%,#062b22_45%,#041d16_100%)] opacity-70" />

      <div className="relative z-10 w-full max-w-md rounded-[24px] border border-white/20 bg-white/10 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-[28px] sm:p-8">
        <div className="mb-7 text-center">
          <img
            src="/OIP (1).jpg"
            alt="STCFI Logo"
            className="mx-auto mb-3 h-14 w-14 rounded-full border border-emerald-200/35 bg-white/85 object-cover p-1 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
          />
          <h1 className="bg-gradient-to-r from-emerald-100 via-emerald-300 to-teal-200 bg-clip-text text-3xl font-semibold tracking-[0.08em] text-transparent sm:text-4xl">
            Set New Password
          </h1>
          <p className="mt-3 text-sm text-emerald-50/90">
            Choose a new password for your LMS account.
          </p>
        </div>

        {checking ? (
          <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-emerald-50">
            Verifying reset link...
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200/30 bg-red-500/20 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mb-4 rounded-xl border border-emerald-200/30 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-50">
            {success}
          </p>
        ) : null}

        {!checking && validLink ? (
          <form onSubmit={handleSubmit}>
            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
                New Password
              </span>
              <input
                type="password"
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                placeholder="Enter new password"
                className="w-full min-w-0 rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                required
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-emerald-100/80">
                Confirm Password
              </span>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Confirm new password"
                className="w-full min-w-0 rounded-xl border border-white/25 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200/70"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.4)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>
        ) : null}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-white/15"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
