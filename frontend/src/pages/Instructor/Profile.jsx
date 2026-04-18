import React, { useEffect, useMemo, useState } from "react";
import { authPost, authPut } from "../../utils/api";
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
    bio: "",
    department: "",
    phone: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

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
    if (avatarPreview) return avatarPreview;
    return resolveInstructorAvatar(profile) || getDefaultAvatarDataUrl(profile || {});
  }, [avatarPreview, profile]);

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
      setProfile(updated);
      writeInstructorProfile(updated);
      setAvatarFile(null);
      setAvatarPreview("");
      setSuccess("Avatar updated.");
    } catch {
      setError("Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await authPut("/api/instructor/profile/", {
        name: form.name,
        email: form.email,
        bio: form.bio,
        department: form.department,
        phone: form.phone,
      });
      setProfile(updated);
      writeInstructorProfile(updated);
      setSuccess("Profile saved successfully.");
    } catch {
      setError("Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-emerald-50" />;
  }

  return (
    <div className="space-y-6 pb-24">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div>}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Instructor Profile</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your avatar, profile details, and contact information.</p>
      </header>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Avatar Upload</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img src={displayedAvatar} alt="Instructor avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-200" />
          <div className="space-y-2">
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button
              type="button"
              disabled={!avatarFile || uploadingAvatar}
              onClick={handleUploadAvatar}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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

      <div className="fixed bottom-4 right-4 z-30">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default Profile;
