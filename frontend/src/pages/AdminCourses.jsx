import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import AdminPanel from "../components/admin/AdminPanel";
import AdminTableSection from "../components/admin/AdminTableSection";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const initialForm = {
  title: "",
  description: "",
  category_id: "",
  instructor_id: "",
  start_date: "",
  start_time: "",
  archived: false,
  thumbnail: null,
  thumbnailPreview: "",
  removeThumbnail: false,
};

const courseColumns = [
  { key: "title", label: "Course" },
  { key: "instructor", label: "Instructor" },
  { key: "category", label: "Category" },
  { key: "students", label: "Students" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentNotice, setContentNotice] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [contentState, setContentState] = useState({ modules: [], activities: [] });
  const [contentDeleteState, setContentDeleteState] = useState({
    open: false,
    type: "",
    id: null,
    label: "",
    loading: false,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadingOptions(true);
    setNotice("");
    const [coursesRes, categoriesRes, usersRes] = await Promise.allSettled([
      axios.get("/api/courses/admin/manage/"),
      axios.get("/api/categories/"),
      axios.get("/api/users/admin/users/?role=instructor"),
    ]);

    const errors = [];

    if (coursesRes.status === "fulfilled") {
      setCourses(Array.isArray(coursesRes.value.data) ? coursesRes.value.data : []);
    } else {
      setCourses([]);
      errors.push(coursesRes.reason?.response?.data?.error || "courses");
    }

    if (categoriesRes.status === "fulfilled") {
      setCategories(Array.isArray(categoriesRes.value.data) ? categoriesRes.value.data : []);
    } else {
      setCategories([]);
      errors.push(categoriesRes.reason?.response?.data?.error || "categories");
    }

    if (usersRes.status === "fulfilled") {
      setInstructors(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
    } else {
      setInstructors([]);
      errors.push(usersRes.reason?.response?.data?.error || "instructors");
    }

    if (errors.length > 0) {
      setNotice(`Some admin data could not be loaded: ${errors.join(", ")}`);
    }

    setLoading(false);
    setLoadingOptions(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        instructor_id: Number(form.instructor_id),
        is_archived: Boolean(form.archived),
      };
      if (!payload.start_date) delete payload.start_date;
      if (!payload.start_time) delete payload.start_time;
      const hasThumbnailFile = payload.thumbnail instanceof File;
      const shouldSendMultipart = hasThumbnailFile;
      const shouldRemoveThumbnail = Boolean(payload.removeThumbnail);
      const basePayload = {
        title: payload.title,
        description: payload.description,
        category_id: payload.category_id,
        instructor_id: payload.instructor_id,
        is_archived: payload.is_archived,
      };
      if (payload.start_date) basePayload.start_date = payload.start_date;
      if (payload.start_time) basePayload.start_time = payload.start_time;
      if (shouldRemoveThumbnail && !hasThumbnailFile) {
        basePayload.thumbnail = null;
      }

      let requestPayload = basePayload;
      let requestConfig = {};
      if (shouldSendMultipart) {
        const formData = new FormData();
        Object.entries(basePayload).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== "") {
            formData.append(key, String(value));
          }
        });
        formData.append("thumbnail", payload.thumbnail);
        requestPayload = formData;
        requestConfig = {
          headers: { "Content-Type": "multipart/form-data" },
        };
      }

      if (editingId) {
        const response = await axios.patch(`/api/courses/admin/manage/${editingId}/`, requestPayload, requestConfig);
        setCourses((prev) => prev.map((course) => (course.id === editingId ? response.data : course)));
        setNotice("Course updated successfully.");
      } else {
        const response = await axios.post("/api/courses/admin/manage/", requestPayload, requestConfig);
        setCourses((prev) => [response.data, ...prev]);
        setNotice("Course created successfully.");
      }
      resetForm();
    } catch (error) {
      const payload = error.response?.data;
      if (payload?.thumbnail?.[0]) {
        setNotice(payload.thumbnail[0]);
      } else if (payload?.error) {
        setNotice(payload.error);
      } else {
        setNotice("Failed to save course.");
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (course) => {
    setEditingId(course.id);
    setForm({
      title: course.title || "",
      description: course.description || "",
      category_id: course.category?.id || "",
      instructor_id: course.instructor_id || "",
      start_date: course.start_date || "",
      start_time: course.start_time || "",
      archived: Boolean(course.is_archived),
      thumbnail: null,
      thumbnailPreview: course.thumbnail || "",
      removeThumbnail: false,
    });
  };

  const removeCourse = async (courseId) => {
    const confirmed = window.confirm("Delete this course?");
    if (!confirmed) return;
    try {
      await axios.delete(`/api/courses/admin/manage/${courseId}/`);
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
      if (editingId === courseId) resetForm();
      setNotice("Course deleted successfully.");
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to delete course.");
    }
  };

  const summary = useMemo(
    () => ({
      total: courses.length,
      archived: courses.filter((course) => course.is_archived).length,
      active: courses.filter((course) => !course.is_archived).length,
    }),
    [courses]
  );

  const openContentManager = async (course) => {
    setSelectedCourse(course);
    setContentLoading(true);
    setContentNotice("");

    try {
      const [modulesRes, activitiesRes] = await Promise.all([
        axios.get(`/api/courses/${course.id}/modules/`),
        axios.get(`/api/courses/${course.id}/activities/`),
      ]);
      setContentState({
        modules: Array.isArray(modulesRes.data) ? modulesRes.data : [],
        activities: Array.isArray(activitiesRes.data) ? activitiesRes.data : [],
      });
    } catch (error) {
      setContentState({ modules: [], activities: [] });
      setContentNotice(error.response?.data?.error || "Failed to load course content.");
    } finally {
      setContentLoading(false);
    }
  };

  const requestDeleteContent = (type, id, label) => {
    setContentDeleteState({
      open: true,
      type,
      id,
      label,
      loading: false,
    });
  };

  const confirmDeleteContent = async () => {
    if (!contentDeleteState.type || !contentDeleteState.id) return;

    setContentDeleteState((prev) => ({ ...prev, loading: true }));
    try {
      await axios.delete(`/api/courses/admin/content/${contentDeleteState.type}/${contentDeleteState.id}/`);
      setContentNotice(`${contentDeleteState.label} deleted successfully.`);
      setContentState((prev) => ({
        modules: prev.modules.map((module) => ({
          ...module,
          lessons: (module.lessons || []).filter((lesson) => lesson.id !== contentDeleteState.id),
        })),
        activities: prev.activities.filter((activity) => activity.id !== contentDeleteState.id),
      }));
      setContentDeleteState({
        open: false,
        type: "",
        id: null,
        label: "",
        loading: false,
      });
    } catch (error) {
      setContentNotice(error.response?.data?.error || "Failed to delete course content.");
      setContentDeleteState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(135deg,#0f172a,#1e3a8a)] px-6 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Admin Control</p>
            <h1 className="mt-2 text-3xl font-bold">Course Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Create, reassign, archive, and remove any course in the LMS from one control surface.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Total Courses</p>
            <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Active</p>
            <p className="mt-2 text-2xl font-semibold">{summary.active}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Archived</p>
            <p className="mt-2 text-2xl font-semibold">{summary.archived}</p>
          </div>
        </div>
      </header>

      {notice ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_1fr]">
        <AdminPanel
          title={editingId ? "Edit Course" : "Create Course"}
          eyebrow="Course Editor"
          description="Admins can assign instructors, archive courses, and override normal ownership rules."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Course title"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              required
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Course description"
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <select
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              disabled={loadingOptions}
            >
              <option value="">{loadingOptions ? "Loading categories..." : "Select category"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={form.instructor_id}
              onChange={(event) => setForm((prev) => ({ ...prev, instructor_id: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              required
              disabled={loadingOptions}
            >
              <option value="">{loadingOptions ? "Loading instructors..." : "Assign instructor"}</option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.first_name} {instructor.last_name} ({instructor.username})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">Course Thumbnail</p>
              {form.thumbnailPreview && !form.removeThumbnail ? (
                <img
                  src={form.thumbnailPreview}
                  alt="Course thumbnail preview"
                  className="mt-3 h-40 w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="mt-3 flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  No thumbnail selected
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setForm((prev) => ({
                    ...prev,
                    thumbnail: file,
                    thumbnailPreview: file ? URL.createObjectURL(file) : prev.thumbnailPreview,
                    removeThumbnail: false,
                  }));
                }}
                className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      thumbnail: null,
                      thumbnailPreview: "",
                      removeThumbnail: true,
                    }))
                  }
                  className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700"
                >
                  Remove Thumbnail
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      thumbnail: null,
                      thumbnailPreview: editingId ? courses.find((course) => course.id === editingId)?.thumbnail || "" : "",
                      removeThumbnail: false,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Reset Preview
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.archived}
                onChange={(event) => setForm((prev) => ({ ...prev, archived: event.target.checked }))}
              />
              Archive this course after save
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Saving..." : editingId ? "Update Course" : "Create Course"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </AdminPanel>

        <AdminPanel
          title="All Courses"
          eyebrow="System Inventory"
          description="Every course across instructors, with admin-level edit and archive control."
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading courses...</p>
          ) : (
            <AdminTableSection
              columns={courseColumns}
              rows={courses}
              renderRow={(course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={`${course.title} thumbnail`}
                        className="mb-2 h-16 w-24 rounded-xl object-cover"
                      />
                    ) : null}
                    <p className="font-semibold text-slate-900">{course.title}</p>
                    <p className="text-xs text-slate-500">{course.description || "No description"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{course.instructor_name || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{course.category?.name || "Uncategorized"}</td>
                  <td className="px-4 py-3 text-slate-700">{course.students_count || 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        course.is_archived ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {course.is_archived ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(course)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <Link
                        to={`/admin/courses/${course.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => openContentManager(course)}
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Content
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCourse(course.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            />
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title="Course Content Controls"
        eyebrow="Admin Content Delete"
        description="Expose the existing admin content-delete endpoint for lessons and activities inside a selected course."
      >
        {!selectedCourse ? (
          <p className="text-sm text-slate-500">Choose a course from the table above, then open its content manager.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Course</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{selectedCourse.title}</p>
                <p className="text-sm text-slate-500">{selectedCourse.instructor_name || "Unknown instructor"}</p>
              </div>
              <button
                type="button"
                onClick={() => openContentManager(selectedCourse)}
                disabled={contentLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                {contentLoading ? "Refreshing..." : "Refresh Content"}
              </button>
            </div>

            {contentNotice ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {contentNotice}
              </div>
            ) : null}

            {contentLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
                Loading course content...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Lessons by Module</p>
                      <p className="text-xs text-slate-500">Delete lesson records through `DELETE /api/courses/admin/content/lesson/&lt;id&gt;/`.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {contentState.modules.length === 0 ? (
                      <p className="text-sm text-slate-500">No modules found for this course.</p>
                    ) : (
                      contentState.modules.map((module) => (
                        <div key={module.id} className="rounded-2xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">{module.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Modules are shown as containers. The current admin content-delete endpoint removes lessons and activities, not modules.
                          </p>
                          <div className="mt-3 space-y-2">
                            {(module.lessons || []).length === 0 ? (
                              <p className="text-sm text-slate-500">No lessons inside this module.</p>
                            ) : (
                              (module.lessons || []).map((lesson) => (
                                <div key={lesson.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{lesson.title}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {lesson.description || lesson.content?.slice(0, 80) || "No lesson description."}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteContent("lesson", lesson.id, `Lesson "${lesson.title}"`)}
                                    className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                                  >
                                    Delete Lesson
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-900">Activities</p>
                  <p className="mt-1 text-xs text-slate-500">Delete activities through `DELETE /api/courses/admin/content/activity/&lt;id&gt;/`.</p>
                  <div className="mt-4 space-y-3">
                    {contentState.activities.length === 0 ? (
                      <p className="text-sm text-slate-500">No activities found for this course.</p>
                    ) : (
                      contentState.activities.map((activity) => (
                        <div key={activity.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{activity.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {activity.activity_type_name || "Activity"} • {activity.description || "No description"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => requestDeleteContent("activity", activity.id, `Activity "${activity.title}"`)}
                            className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                          >
                            Delete Activity
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminPanel>

      <ConfirmDeleteModal
        open={contentDeleteState.open}
        onCancel={() =>
          setContentDeleteState({ open: false, type: "", id: null, label: "", loading: false })
        }
        onConfirm={confirmDeleteContent}
        loading={contentDeleteState.loading}
        title="Delete Course Content"
        confirmLabel="Delete Content"
        text={
          contentDeleteState.label
            ? `Delete ${contentDeleteState.label}? This action is permanent.`
            : "Delete this content item?"
        }
      />
    </div>
  );
}
