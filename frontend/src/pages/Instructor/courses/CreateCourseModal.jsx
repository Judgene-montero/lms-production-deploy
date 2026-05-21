import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../../utils/axiosInstance";

const initialForm = {
  title: "",
  description: "",
  categoryId: "",
  scheduleManually: false,
  startDate: "",
  endDate: "",
  startTime: "",
  thumbnail: null,
};

const CreateCourse = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState([]);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await axios.get("/api/categories/");
        if (!isMounted) return;
        setCategories(Array.isArray(response.data) ? response.data : []);
      } catch (requestError) {
        console.error(requestError);
        if (!isMounted) return;
        setError("Failed to load categories.");
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleManualScheduleToggle = (checked) => {
    setForm((prev) => ({
      ...prev,
      scheduleManually: checked,
      startDate: checked ? prev.startDate : "",
      startTime: checked ? prev.startTime : "",
    }));
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

    if (!form.categoryId) {
      setError("Category is required.");
      setLoading(false);
      return;
    }

    if (form.scheduleManually && (!form.startDate || !form.startTime)) {
      setError("Start date and start time are required when manual scheduling is enabled.");
      setLoading(false);
      return;
    }

    if (form.scheduleManually && form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("End date cannot be earlier than the start date.");
      setLoading(false);
      return;
    }

    try {
      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("description", form.description.trim());
      payload.append("category_id", form.categoryId);

      if (form.scheduleManually) {
        payload.append("start_date", form.startDate);
        payload.append("start_time", form.startTime);
      }

      if (form.endDate) {
        payload.append("end_date", form.endDate);
      }

      if (form.thumbnail) {
        payload.append("thumbnail", form.thumbnail);
      }

      await axios.post("/api/courses/", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("Course created successfully!");
      setTimeout(() => navigate("/instructor-dashboard/courses"), 900);
    } catch (requestError) {
      console.error(requestError);
      const responseData = requestError.response?.data;
      const apiError =
        responseData?.category_id?.[0] ||
        responseData?.end_date?.[0] ||
        responseData?.non_field_errors?.[0] ||
        responseData?.detail ||
        responseData?.error;

      setError(apiError || "Failed to create course. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">Create Course</h1>
          <p className="mt-2 text-sm text-gray-600">Set up category, scheduling, and a course thumbnail before publishing.</p>
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
                onChange={(event) => handleField("title", event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Introduction to Data Science"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => handleField("description", event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Describe your course goals and outcomes..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">Category</label>
              <select
                value={form.categoryId}
                onChange={(event) => handleField("categoryId", event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={categoriesLoading}
                required
              >
                <option value="">{categoriesLoading ? "Loading categories..." : "Select a category"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-950">
                <input
                  type="checkbox"
                  checked={form.scheduleManually}
                  onChange={(event) => handleManualScheduleToggle(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Schedule course manually
              </label>
            </div>

            {form.scheduleManually && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-emerald-900">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => handleField("startDate", event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-emerald-900">Start Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => handleField("startTime", event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-900">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => handleField("endDate", event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1 text-xs text-gray-500">Optional. Leave blank if the course has no fixed end date.</p>
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
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="h-28 w-full rounded-xl border border-emerald-100 object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-emerald-100 bg-emerald-50/40 text-sm text-gray-500">
                  Preview appears here
                </div>
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
              disabled={loading || categoriesLoading}
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
