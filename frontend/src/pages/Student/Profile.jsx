import React, { useEffect, useMemo, useState } from "react";
import { authPost, authPut } from "../../utils/api";
import {
  getDefaultStudentAvatarDataUrl,
  loadStudentProfile,
  resolveStudentAvatar,
  writeStudentProfile,
} from "../../utils/studentProfile";

const cardClass = "rounded-xl border border-emerald-100 bg-white p-5 shadow-sm";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragging, setDragging] = useState(false);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    middle_initial: "",
    last_name: "",
    school_id: "",
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
        const data = await loadStudentProfile();
        if (!mounted || !data) return;
        setProfile(data);
        setForm({
          first_name: data.first_name || "",
          middle_initial: data.middle_initial || "",
          last_name: data.last_name || "",
          school_id: data.school_id || "",
          email: data.email || "",
          bio: data.bio || "",
          department: data.department || "",
          phone: data.phone || "",
        });
      } catch {
        if (mounted) setError("Could not load student profile.");
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
    return resolveStudentAvatar(profile) || getDefaultStudentAvatarDataUrl(profile || {});
  }, [avatarPreview, profile]);

  const handleInput = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const completion = useMemo(() => {
    const checks = [
      Boolean(form.first_name?.trim()),
      Boolean(form.middle_initial?.trim()),
      Boolean(form.last_name?.trim()),
      Boolean(form.school_id?.trim()),
      Boolean(form.email?.trim()),
      Boolean(form.phone?.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [form]);

  const prepareAvatar = (file) => {
    setAvatarFile(file);
    if (!file) {
      setAvatarPreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null;
    prepareAvatar(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      prepareAvatar(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();
      payload.append("avatar", avatarFile);
      const updated = await authPost("/api/student/profile/avatar/", payload);
      setProfile(updated);
      writeStudentProfile(updated);
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

    const firstName = form.first_name.trim();
    const middleInitial = form.middle_initial.trim().toUpperCase().slice(0, 1);
    const lastName = form.last_name.trim();
    const schoolId = form.school_id.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const isSchoolIdLocked = Boolean(profile?.school_id);

    if (!firstName || !lastName) {
      setError("First name and last name are required.");
      setSaving(false);
      return;
    }
    if (!email) {
      setError("Email is required.");
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
    if (!isSchoolIdLocked) {
      if (!schoolId) {
        setError("Student ID is required.");
        setSaving(false);
        return;
      }
      if (!/^[A-Za-z0-9-]+$/.test(schoolId)) {
        setError("Student ID must contain only letters, numbers, or hyphen.");
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        first_name: firstName,
        middle_initial: middleInitial,
        last_name: lastName,
        email,
        bio: form.bio,
        department: form.department,
        phone,
      };
      if (!isSchoolIdLocked) {
        payload.school_id = schoolId;
      }

      const updated = await authPut("/api/student/profile/", payload);
      setProfile(updated);
      writeStudentProfile(updated);
      setForm((prev) => ({
        ...prev,
        first_name: updated.first_name || prev.first_name,
        middle_initial: updated.middle_initial || prev.middle_initial,
        last_name: updated.last_name || prev.last_name,
        school_id: updated.school_id || prev.school_id,
        email: updated.email || prev.email,
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
    <div className="space-y-6 pb-24">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div>}

      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Student Profile</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your avatar, profile details, and contact information.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Full Name</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{profile?.full_name || profile?.username || "Student"}</p>
        </article>
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Program / College</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{profile?.college || "Not set"}</p>
        </article>
        <article className={cardClass}>
          <p className="text-sm text-gray-500">Account Status</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{profile?.profile_complete ? "Profile complete" : "Needs more details"}</p>
        </article>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Avatar Upload</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img src={displayedAvatar} alt="Student avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-200" />
          <div className="w-full space-y-2">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-sm transition ${
                dragging ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-gray-300 text-gray-600"
              }`}
            >
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              Drag and drop image here, or click to browse
            </label>
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
        <h2 className="text-lg font-semibold text-emerald-900">Profile Completion</h2>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-sm text-gray-600">
            <span>Completion</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Identity</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
            value={profile?.username || ""}
            readOnly
            placeholder="Username"
          />
          <input
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
            value={profile?.role || "student"}
            readOnly
            placeholder="Role"
          />
          <input
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
            value={profile?.college || ""}
            readOnly
            placeholder="College"
          />
          <div>
            <input
              className={`w-full rounded-xl border px-3 py-2 ${profile?.school_id ? "border-gray-200 bg-gray-50" : "border-gray-200"}`}
              value={form.school_id}
              readOnly={Boolean(profile?.school_id)}
              onChange={(event) => handleInput("school_id", event.target.value)}
              placeholder="Student ID"
            />
            <p className="mt-1 text-xs text-gray-500">
              {profile?.school_id
                ? "Student ID is locked after first save. Contact admin to request a change."
                : "You can set your Student ID once. It will be locked after save."}
            </p>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Basic Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <input
            className="rounded-xl border border-gray-200 px-3 py-2"
            value={form.first_name}
            onChange={(event) => handleInput("first_name", event.target.value)}
            placeholder="First Name"
          />
          <input
            className="rounded-xl border border-gray-200 px-3 py-2"
            value={form.middle_initial}
            onChange={(event) => handleInput("middle_initial", event.target.value.toUpperCase().slice(0, 1))}
            placeholder="M.I."
            maxLength={1}
          />
          <input
            className="rounded-xl border border-gray-200 px-3 py-2"
            value={form.last_name}
            onChange={(event) => handleInput("last_name", event.target.value)}
            placeholder="Last Name"
          />
          <input className="rounded-xl border border-gray-200 px-3 py-2 md:col-span-2" type="email" value={form.email} onChange={(event) => handleInput("email", event.target.value)} placeholder="Email" />
          <input className="rounded-xl border border-gray-200 px-3 py-2" value={form.department} onChange={(event) => handleInput("department", event.target.value)} placeholder="Department" />
          <textarea className="rounded-xl border border-gray-200 px-3 py-2 md:col-span-2" rows={4} value={form.bio} onChange={(event) => handleInput("bio", event.target.value)} placeholder="Bio" />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Contact Information</h2>
        <div className="mt-4">
          <input className="w-full rounded-xl border border-gray-200 px-3 py-2 md:w-1/2" value={form.phone} onChange={(event) => handleInput("phone", event.target.value)} placeholder="Phone Number" />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-900">Student Summary</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Email</p>
            <p className="mt-1 font-medium text-gray-900">{form.email || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Student ID</p>
            <p className="mt-1 font-medium text-gray-900">{form.school_id || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Department</p>
            <p className="mt-1 font-medium text-gray-900">{form.department || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Phone</p>
            <p className="mt-1 font-medium text-gray-900">{form.phone || "Not set"}</p>
          </div>
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
}
