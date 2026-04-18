import React, { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuBookOpen, LuLibraryBig, LuPlus, LuUsers } from "react-icons/lu";
import { authDelete, authGet, authPut } from "../../../utils/api";

const PAGE_SIZE = 12;

const summaryCardClass =
  "rounded-xl border border-emerald-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

const statusConfig = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
];

const sortConfig = [
  { key: "newest", label: "Newest" },
  { key: "students", label: "Number of Students" },
  { key: "activity", label: "Activity Level" },
];

const isCourseArchived = (course) =>
  Boolean(course?.is_archived) ||
  String(course?.status || "").toLowerCase() === "archived" ||
  String(course?.state || "").toLowerCase() === "archived";

function InstructorCourses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authGet("/api/courses/");
      const baseCourses = Array.isArray(data) ? data : [];
      const requiresCountBackfill = baseCourses.some(
        (course) => course?.students_count == null || course?.lessons_count == null
      );

      if (!requiresCountBackfill) {
        setCourses(baseCourses);
        return;
      }

      const detailResults = await Promise.allSettled(
        baseCourses.map((course) => authGet(`/api/courses/${course.id}/`))
      );

      const detailsById = new Map();
      detailResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.id != null) {
          detailsById.set(Number(result.value.id), result.value);
        }
      });

      const hydratedCourses = baseCourses.map((course) => {
        const detail = detailsById.get(Number(course.id));
        if (!detail) return course;
        return {
          ...course,
          students_count: Number(
            course?.students_count ?? detail?.students_count ?? 0
          ),
          lessons_count: Number(
            course?.lessons_count ?? detail?.lessons_count ?? 0
          ),
          is_archived: Boolean(course?.is_archived ?? detail?.is_archived ?? false),
          status: course?.status || detail?.status || "active",
          state: course?.state || detail?.state || "active",
          code: course?.code || detail?.code || detail?.join_code || course?.join_code,
        };
      });

      setCourses(hydratedCourses);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const summary = useMemo(() => {
    const totalStudents = courses.reduce((sum, course) => sum + Number(course.students_count || 0), 0);
    const totalLessons = courses.reduce((sum, course) => sum + Number(course.lessons_count || 0), 0);

    return {
      totalCourses: courses.length,
      totalStudents,
      totalLessons,
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const title = String(course.title || "").toLowerCase();
      const code = String(course.code || course.join_code || "").toLowerCase();

      const matchesSearch = !query || title.includes(query) || code.includes(query);

      const isArchived = isCourseArchived(course);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "archived" ? isArchived : !isArchived);

      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  const sortedCourses = useMemo(() => {
    const copy = [...filteredCourses];

    copy.sort((a, b) => {
      if (sortBy === "students") {
        return Number(b.students_count || 0) - Number(a.students_count || 0);
      }

      if (sortBy === "activity") {
        const aActivity = Number(a.activity_level || a.recent_activity_score || a.activity_score || 0);
        const bActivity = Number(b.activity_level || b.recent_activity_score || b.activity_score || 0);

        if (aActivity !== bActivity) return bActivity - aActivity;

        const aUpdated = new Date(a.updated_at || a.last_activity_at || a.created_at || 0).getTime();
        const bUpdated = new Date(b.updated_at || b.last_activity_at || b.created_at || 0).getTime();
        return bUpdated - aUpdated;
      }

      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return copy;
  }, [filteredCourses, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedCourses.length / PAGE_SIZE));

  const paginatedCourses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedCourses.slice(start, start + PAGE_SIZE);
  }, [page, sortedCourses]);

  React.useEffect(() => {
    setPage(1);
  }, [search, sortBy, statusFilter]);

  const handleDelete = useCallback(async (courseId) => {
    setDeleting(true);
    setDeleteError("");

    try {
      await authDelete(`/api/courses/${courseId}/`);
      setCourses((prev) => prev.filter((course) => Number(course.id) !== Number(courseId)));
      setDeleteTarget(null);
    } catch (requestError) {
      console.error(requestError);
      setDeleteError("Unable to delete course.");
    } finally {
      setDeleting(false);
    }
  }, []);

  const handleToggleArchive = useCallback(async (course) => {
    const currentlyArchived = isCourseArchived(course);
    setArchiveTargetId(course.id);
    setDeleteError("");

    try {
      const response = await authPut(
        `/api/courses/courses/${course.id}/toggle-archive/`,
        { archived: !currentlyArchived }
      );
      const nextArchived = Boolean(
        response?.is_archived ?? !currentlyArchived
      );
      const nextStatus = response?.status || (nextArchived ? "archived" : "active");

      setCourses((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(course.id)
            ? {
                ...item,
                is_archived: nextArchived,
                status: nextStatus,
                state: response?.state || nextStatus,
              }
            : item
        )
      );
    } catch (requestError) {
      console.error(requestError);
      setDeleteError("Unable to update course status.");
    } finally {
      setArchiveTargetId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-emerald-50" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-emerald-50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-center rounded-2xl border border-red-200 bg-white p-10 shadow-sm">
          <p className="text-lg font-semibold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Instructor Workspace</p>
              <h1 className="mt-1 text-3xl font-bold text-emerald-950 sm:text-4xl">Course Management</h1>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">
                Search, filter, and manage all your courses with scalable controls.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/instructor-dashboard/courses/create")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow"
            >
              <LuPlus className="h-4 w-4" />
              Create Course
            </button>
          </div>
        </header>

        {deleteError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {deleteError}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className={summaryCardClass}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <LuBookOpen className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-950">{summary.totalCourses}</p>
          </article>

          <article className={summaryCardClass}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <LuUsers className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-950">{summary.totalStudents}</p>
          </article>

          <article className={summaryCardClass}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">Total Lessons</p>
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <LuLibraryBig className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-950">{summary.totalLessons}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by course title or code"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none md:col-span-2"
            />

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {statusConfig.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStatusFilter(option.key)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm ${
                    statusFilter === option.key
                      ? "bg-emerald-600 text-white"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {sortConfig.map((option) => (
                <option key={option.key} value={option.key}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {sortedCourses.length === 0 ? (
          <section className="rounded-2xl border border-emerald-100 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-medium text-gray-700">No courses match your current filters.</p>
            <button
              type="button"
              onClick={() => navigate("/instructor-dashboard/courses/create")}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Create Course
            </button>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {paginatedCourses.map((course) => (
                <article
                  key={course.id}
                  className="flex h-full flex-col justify-between rounded-xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-emerald-950">{course.title}</h2>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Course Code</p>
                        <p className="mt-1 font-semibold text-gray-700">{course.code || course.join_code || course.id}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Students</p>
                        <p className="mt-1 font-semibold text-gray-700">{course.students_count || 0}</p>
                      </div>
                      <div className="col-span-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Lessons</p>
                        <p className="mt-1 font-semibold text-gray-700">{course.lessons_count || 0}</p>
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-gray-600">
                      {course.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      disabled={archiveTargetId === course.id}
                      onClick={() => handleToggleArchive(course)}
                      className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition-all duration-200 hover:bg-amber-50 disabled:opacity-60"
                    >
                      {archiveTargetId === course.id
                        ? "Saving..."
                        : isCourseArchived(course)
                        ? "Restore"
                        : "Archive"}
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/instructor-dashboard/courses/${course.id}`)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/instructor-dashboard/courses/${course.id}/edit`)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(course);
                      }}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </section>

            {totalPages > 1 && (
              <section className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </section>
            )}
          </>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-emerald-950">Confirm Delete</h4>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this course? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget.id)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-800 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(InstructorCourses);
