import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../../utils/axiosInstance";

const initialForm = {
  title: "",
  description: "",
  category: "",
  level: "beginner",
  visibility: "private",
  thumbnail: null,
};

const CreateCourse = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleThumbnailChange = (event) => {
    const file = event.target.files?.[0] || null;
    handleField("thumbnail", file);

    if (!file) {
      setThumbnailPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submitCourse = async (includeExtendedFields = true) => {
    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("description", form.description);
    if (form.category.trim()) payload.append("category", form.category.trim());
    if (form.thumbnail) payload.append("thumbnail", form.thumbnail);

    if (includeExtendedFields) {
      payload.append("level", form.level);
      payload.append("visibility", form.visibility);
    }

    return axios.post("/api/courses/", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Course title is required.");
      setLoading(false);
      return;
    }

    try {
      await submitCourse(true);
      setSuccess("Course created successfully!");
      setTimeout(() => navigate("/instructor-dashboard/courses"), 900);
    } catch (err) {
      if (err.response?.status === 400) {
        try {
          await submitCourse(false);
          setSuccess("Course created successfully!");
          setTimeout(() => navigate("/instructor-dashboard/courses"), 900);
          return;
        } catch (fallbackErr) {
          console.error(fallbackErr);
        }
      }
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Failed to create course. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Create Course</h1>
          <p className="mt-2 text-sm text-gray-600">Set up course details, visibility, and cover thumbnail.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Course Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleField("title", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Introduction to Data Science"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Describe your course goals and outcomes..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleField("category", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Computer Science"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Level</label>
              <select
                value={form.level}
                onChange={(e) => handleField("level", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => handleField("visibility", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Thumbnail Upload</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              {thumbnailPreview && (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="h-28 w-full rounded-xl border border-emerald-100 object-cover"
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate("/instructor-dashboard/courses")}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
            >
              {loading ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourse;

