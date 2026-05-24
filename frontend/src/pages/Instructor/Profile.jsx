import React, { useEffect, useMemo, useState } from "react";
import { authPost, authPut } from "../../utils/api";
import { COLLEGE_OPTIONS, getCollegeLabel } from "../../utils/collegeOptions";
import {
  getDefaultAvatarDataUrl,
  loadInstructorProfile,
  resolveInstructorAvatar,
  writeInstructorProfile,
} from "../../utils/instructorProfile";

const cardClass = "rounded-xl border border-emerald-100 bg-white p-5 shadow-sm";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    college: "",
    bio: "",
    department: "",
    phone: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await loadInstructorProfile();
        if (!mounted || !data) return;
        setProfile(data);
        setForm({
          name: data.name || data.full_name || data.username || "",
          email: data.email || "",
          college: data.college || "",
          bio: data.bio || "",
          department: data.department || "",
          phone: data.phone || "",
        });
      } catch {
        if (mounted) setError("Could not load instructor profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const displayedAvatar = useMemo(() => {
    if (avatarLoadError) return getDefaultAvatarDataUrl(profile || {});
    if (avatarPreview) return avatarPreview;
    return resolveInstructorAvatar(profile) || getDefaultAvatarDataUrl(profile || {});
  }, [avatarLoadError, avatarPreview, profile]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarPreview, profile?.avatar, profile?.avatar_url]);

  const handleInput = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
    if (!file) {
      setAvatarPreview("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();
      payload.append("avatar", avatarFile);
      const updated = await authPost("/api/instructor/profile/avatar/", payload);
      const updatedProfile = {
        ...(updated?.profile || updated || {}),
        avatar_updated_at: updated?.avatar_updated_at || new Date().toISOString(),
      };
      setAvatarLoadError(false);
      setProfile(updatedProfile);
      writeInstructorProfile(updatedProfile);
      setAvatarFile(null);
      setAvatarPreview("");
      setSuccess(updated?.message || "Avatar updated.");
    } catch (requestError) {
      setError(requestError?.message || "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim();
    const college = form.college.trim();
    const phone = form.phone.trim();

    if (!name) {
      setError("Name is required.");
      setSaving(false);
      return;
    }
    if (!email) {
      setError("Email is required.");
      setSaving(false);
      return;
    }
    if (!college) {
      setError("Program / College is required.");
      setSaving(false);
      return;
    }
    if (phone && !/^[0-9+\-() ]+$/.test(phone)) {
      setError("Phone number contains invalid characters.");
      setSaving(false);
      return;
    }
    if (phone.length > 20) {
      setError("Phone number must be 20 characters or fewer.");
      setSaving(false);
      return;
    }

    try {
      const updated = await authPut("/api/instructor/profile/", {
        name,
        email,
        college,
        bio: form.bio,
        department: form.department,
        phone,
      });
      setProfile(updated);
      writeInstructorProfile(updated);
      setForm((prev) => ({
        ...prev,
        name: updated.name || updated.full_name || updated.username || prev.name,
        email: updated.email || prev.email,
        college: updated.college || prev.college,
        bio: updated.bio ?? prev.bio,
        department: updated.department ?? prev.department,
        phone: updated.phone ?? prev.phone,
      }));
      setSuccess("Profile saved successfully.");
    } catch (requestError) {
      setError(requestError?.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-emerald-50" />;
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div>}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Instructor Profile</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your avatar, profile details, and contact information.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Full Name</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{profile?.full_name || profile?.username || "Instructor"}</p>
        </article>
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Program / College</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{getCollegeLabel(profile?.college) || "Not set"}</p>
        </article>
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Account Status</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{profile?.profile_complete ? "Profile complete" : "Needs more details"}</p>
        </article>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Avatar Upload</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img
            src={displayedAvatar}
            alt="Instructor avatar"
            onError={() => setAvatarLoadError(true)}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-200"
          />
          <div className="w-full space-y-2">
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button
              type="button"
              disabled={!avatarFile || uploadingAvatar}
              onClick={handleUploadAvatar}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
            </button>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Basic Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input className="rounded-xl border border-gray-200 px-3 py-2" value={form.name} onChange={(event) => handleInput("name", event.target.value)} placeholder="Name" />
          <input className="rounded-xl border border-gray-200 px-3 py-2" type="email" value={form.email} onChange={(event) => handleInput("email", event.target.value)} placeholder="Email" />
          <select
            className="rounded-xl border border-gray-200 px-3 py-2"
            value={form.college}
            onChange={(event) => handleInput("college", event.target.value)}
          >
            <option value="">Select Program / College</option>
            {COLLEGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input className="rounded-xl border border-gray-200 px-3 py-2" value={form.department} onChange={(event) => handleInput("department", event.target.value)} placeholder="Department" />
          <textarea className="rounded-xl border border-gray-200 px-3 py-2 md:col-span-2" rows={4} value={form.bio} onChange={(event) => handleInput("bio", event.target.value)} placeholder="Bio" />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Contact Information</h2>
        <div className="mt-4">
          <input className="w-full rounded-xl border border-gray-200 px-3 py-2 md:w-1/2" value={form.phone} onChange={(event) => handleInput("phone", event.target.value)} placeholder="Phone" />
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Ready to save?</p>
            <p className="text-sm text-gray-600">Your profile updates apply only to your own account.</p>
          </div>
          <div className="flex w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
