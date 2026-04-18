import React, { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClassworkModal from "../../pages/Instructor/courses/ClassworkModal";
import {
  getCreatePathByType,
  getEditPathByType,
  normalizeActivityTypeKey,
} from "../../pages/Instructor/courses/classworkTypeConfig";
import { authDelete, authGet } from "../../utils/api";

const PAGE_SIZE = 12;

const toToken = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
};

const getStudentTokens = (item = {}) => {
  const tokens = [
    toToken(item.student_id),
    toToken(item.student),
    toToken(item.user_id),
    toToken(item.user),
    toToken(item.student?.id),
    toToken(item.student?.school_id),
    toToken(item.student?.username),
    toToken(item.student?.email),
    toToken(item.student_username),
    toToken(item.email),
  ].filter(Boolean);
  return Array.from(new Set(tokens));
};

const getSubmittedAt = (item = {}) =>
  item.submitted_at ?? item.submission_time ?? item.force_submitted_at ?? null;

const buildStudentTokenLookup = (people = []) => {
  const lookup = new Map();
  people.forEach((person) => {
    if (String(person?.role || "").toLowerCase() !== "student") return;
    const canonicalId = toToken(person?.id);
    if (!canonicalId) return;
    lookup.set(canonicalId, canonicalId);

    const aliases = [
      toToken(person?.school_id),
      toToken(person?.student_id),
      toToken(person?.user_id),
      toToken(person?.username),
      toToken(person?.email),
    ].filter(Boolean);
    aliases.forEach((token) => lookup.set(token, canonicalId));
  });
  return lookup;
};

const pickLatestByStudent = (records = [], studentTokenLookup = new Map()) => {
  const byStudent = new Map();
  records.forEach((record) => {
    const tokens = getStudentTokens(record);
    if (!tokens.length) return;

    const canonicalToken =
      tokens.map((token) => studentTokenLookup.get(token)).find(Boolean) || "";
    if (!canonicalToken) return;

    const submittedAt = getSubmittedAt(record);
    if (!submittedAt) return;

    const current = byStudent.get(canonicalToken);
    if (!current) {
      byStudent.set(canonicalToken, record);
      return;
    }

    const currentTime = new Date(getSubmittedAt(current) || 0).getTime();
    const nextTime = new Date(submittedAt).getTime();
    if (Number.isNaN(currentTime) || nextTime > currentTime) {
      byStudent.set(canonicalToken, record);
    }
  });
  return Array.from(byStudent.values());
};

function ClassworkTab({ courseId, isInstructor, openActivity }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [acts, students] = await Promise.all([
        authGet(`/api/courses/${courseId}/activities/`),
        authGet(`/api/courses/${courseId}/students/`),
      ]);

      setActivities(Array.isArray(acts) ? acts : []);
      setPeople(Array.isArray(students) ? students : []);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load classwork.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!openActivity?.id) return;
    const typeKey = normalizeActivityTypeKey(openActivity.activity_type_name || openActivity.activity_type);
    const route =
      typeKey === "quiz"
        ? `/instructor-dashboard/courses/${courseId}/classwork/${openActivity.id}`
        : `/instructor-dashboard/courses/${courseId}/classwork/${openActivity.id}/activity`;
    navigate(route);
  }, [courseId, navigate, openActivity]);

  const studentsCount = useMemo(
    () => people.filter((person) => String(person.role || "").toLowerCase() === "student").length,
    [people]
  );
  const studentTokenLookup = useMemo(() => buildStudentTokenLookup(people), [people]);

  const paginatedActivities = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return activities.slice(startIndex, startIndex + PAGE_SIZE);
  }, [activities, page]);

  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));

  const handleDeleteActivity = useCallback(
    async (activityId) => {
      if (!window.confirm("Are you sure you want to delete this classwork item?")) return;
      try {
        await authDelete(`/api/courses/${courseId}/activities/${activityId}/`);
        await fetchData();
      } catch (requestError) {
        console.error(requestError);
        setError("Failed to delete classwork item.");
      }
    },
    [courseId, fetchData]
  );

  const handleEditActivity = useCallback(
    (activity) => {
      const typeKey = normalizeActivityTypeKey(activity.activity_type_name || activity.activity_type);
      const route = getEditPathByType(courseId, typeKey, activity.id);
      navigate(route);
    },
    [courseId, navigate]
  );

  const handleTypeSelected = useCallback(
    (typeKey) => {
      setShowTypeSelector(false);
      const route = getCreatePathByType(courseId, typeKey);
      navigate(route);
    },
    [courseId, navigate]
  );

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isInstructor && (
        <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">Classwork</h3>
              <p className="text-xs text-gray-600">Create classwork from dedicated pages for each type.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTypeSelector(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Create Classwork
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-emerald-50" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-gray-500">No classwork yet.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {paginatedActivities.map((activity) => {
              const submissions = Array.isArray(activity.submissions) ? activity.submissions : [];
              const quizAttempts = Array.isArray(activity.quiz_attempts) ? activity.quiz_attempts : [];
              const latestSubmittedRows = pickLatestByStudent([...submissions, ...quizAttempts], studentTokenLookup);
              const dueDate = activity.due_date ? new Date(activity.due_date) : null;
              const hasValidDueDate = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));

              let onTime = 0;
              let late = 0;

              latestSubmittedRows.forEach((item) => {
                const submittedAtRaw = getSubmittedAt(item);
                if (!submittedAtRaw) return;

                if (item.is_late === true) {
                  late += 1;
                  return;
                }

                if (!hasValidDueDate) {
                  onTime += 1;
                  return;
                }

                const submittedAt = new Date(submittedAtRaw);
                if (Number.isNaN(submittedAt.getTime()) || submittedAt <= dueDate) {
                  onTime += 1;
                } else {
                  late += 1;
                }
              });

              const onTimeSafe = Math.min(onTime, studentsCount);
              const lateSafe = Math.min(late, Math.max(0, studentsCount - onTimeSafe));
              const missing = Math.max(0, studentsCount - onTimeSafe - lateSafe);
              const typeKey = normalizeActivityTypeKey(activity.activity_type_name || activity.activity_type);
              const assessmentSuffix =
                typeKey === "quiz" && activity.assessment_type
                  ? ` (${String(activity.assessment_type).toUpperCase()})`
                  : "";

              return (
                <article key={activity.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-950">{activity.title}</h3>
                      <p className="text-xs text-gray-500">
                        {activity.activity_type_name || "Classwork"}
                        {assessmentSuffix}
                        {activity.due_date ? ` | Due: ${new Date(activity.due_date).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const route =
                            typeKey === "quiz"
                              ? `/instructor-dashboard/courses/${courseId}/classwork/${activity.id}`
                              : `/instructor-dashboard/courses/${courseId}/classwork/${activity.id}/activity`;
                          navigate(route);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Open
                      </button>
                      {isInstructor && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditActivity(activity)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">On Time: {onTimeSafe}</span>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">Late: {lateSafe}</span>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Missing: {missing}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {isInstructor && (
        <ClassworkModal
          open={showTypeSelector}
          onClose={() => setShowTypeSelector(false)}
          onSelectType={handleTypeSelected}
        />
      )}
    </div>
  );
}

export default memo(ClassworkTab);
