import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authGet } from "../utils/api";
import axios from "../utils/axiosInstance";
import ProgressBar from "./ProgressBar";
import ModuleCard from "./ModuleCard";
import LessonViewer from "./LessonViewer";
import LessonCreateModal from "./LessonCreateModal";
import ModuleImportModal from "./ModuleImportModal";

const sortByOrder = (items = []) =>
  [...items].sort((a, b) => (a.order ?? a.lesson_order ?? 0) - (b.order ?? b.lesson_order ?? 0));

const normalizeLesson = (lesson = {}) => ({
  ...lesson,
  content: lesson.content ?? lesson.description ?? "",
  order: lesson.order ?? lesson.lesson_order ?? 0,
});

const normalizeModule = (moduleItem = {}) => ({
  ...moduleItem,
  title: moduleItem.title || "Untitled Module",
  order: moduleItem.order ?? 0,
  lessons: sortByOrder((moduleItem.lessons || []).map(normalizeLesson)),
});

const authJsonRequest = async (method, endpoint, body) => {
  const response = await axios.request({
    method,
    url: endpoint,
    data: body,
  });
  return response.status === 204 ? null : response.data;
};

const tryEndpoints = async (method, endpoints, body) => {
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      return await authJsonRequest(method, endpoint, body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${method} request failed`);
};

export const flattenLessons = (modules = []) =>
  modules.flatMap((moduleItem) =>
    (moduleItem.lessons || []).map((lesson) => ({ module: moduleItem, lesson }))
  );

export const getLessonNeighbors = (modules = [], lessonId) => {
  const sequence = flattenLessons(modules);
  const index = sequence.findIndex((item) => Number(item.lesson.id) === Number(lessonId));

  if (index < 0) {
    return {
      prevLesson: null,
      nextLesson: sequence[0] || null,
    };
  }

  return {
    prevLesson: sequence[index - 1] || null,
    nextLesson: sequence[index + 1] || null,
  };
};

const buildComputedProgress = (completedLessonIds, totalLessons) => {
  const completed = completedLessonIds.size;
  const safeTotal = Number(totalLessons) || 0;
  const percentage = safeTotal > 0 ? Math.round((completed / safeTotal) * 100) : 0;
  return {
    completed_lessons: completed,
    total_lessons: safeTotal,
    percentage,
  };
};

const getLessonProgressStorageKey = (courseId) => {
  const userId = localStorage.getItem("user_id") || localStorage.getItem("username") || "student";
  return `student_lesson_progress:${userId}:${courseId}`;
};

const readStoredCompletedLessonIds = (courseId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(getLessonProgressStorageKey(courseId)) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((value) => Number(value)) : []);
  } catch {
    return new Set();
  }
};

const writeStoredCompletedLessonIds = (courseId, ids) => {
  localStorage.setItem(getLessonProgressStorageKey(courseId), JSON.stringify(Array.from(ids)));
};

export default function LessonsTab({ courseId, isInstructor = false, initialLessonId = null, initialModuleId = null }) {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [courseProgress, setCourseProgress] = useState({
    completed_lessons: 0,
    total_lessons: 0,
    percentage: 0,
  });
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  const [expandedModules, setExpandedModules] = useState({});

  const [moduleForm, setModuleForm] = useState({ title: "", order: "" });
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showModuleForm, setShowModuleForm] = useState(false);

  const isMountedRef = useRef(false);
  const modulesLoadedRef = useRef(false);
  const progressLoadedRef = useRef(false);
  const progressEndpointUnavailableRef = useRef(false);
  const modulesRef = useRef([]);
  const completedLessonIdsRef = useRef(new Set());

  const totalLessons = useMemo(() => flattenLessons(modules).length, [modules]);
  const visibleCompletedLessonIds = useMemo(
    () => (isInstructor ? new Set() : completedLessonIds),
    [completedLessonIds, isInstructor]
  );

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    completedLessonIdsRef.current = completedLessonIds;
  }, [completedLessonIds]);

  const updateLessonInState = useCallback((lessonId, patch) => {
    setModules((prev) =>
      prev.map((moduleItem) => ({
        ...moduleItem,
        lessons: sortByOrder(
          (moduleItem.lessons || []).map((lesson) =>
            Number(lesson.id) === Number(lessonId) ? normalizeLesson({ ...lesson, ...patch }) : lesson
          )
        ),
      }))
    );
  }, []);

  const removeLessonFromState = useCallback((lessonId) => {
    setModules((prev) =>
      prev.map((moduleItem) => ({
        ...moduleItem,
        lessons: (moduleItem.lessons || []).filter(
          (lesson) => Number(lesson.id) !== Number(lessonId)
        ),
      }))
    );
  }, []);

  const refreshProgress = useCallback(async (completedSetOverride, moduleOverride) => {
    const completedSet = completedSetOverride || completedLessonIdsRef.current;
    const moduleItems = moduleOverride || modulesRef.current;
    const computed = buildComputedProgress(completedSet, flattenLessons(moduleItems).length);

    if (progressEndpointUnavailableRef.current) {
      setCourseProgress(computed);
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        setProgressLoaded(true);
        console.log("Progress loaded");
      }
      return;
    }

    try {
      const data = await authGet(`/api/courses/${courseId}/progress/`);
      const serverCompletedIds = Array.isArray(data?.completed_lesson_ids)
        ? new Set(data.completed_lesson_ids.map((value) => Number(value)))
        : completedSet;
      writeStoredCompletedLessonIds(courseId, serverCompletedIds);
      setCompletedLessonIds(serverCompletedIds);
      setCourseProgress({
        completed_lessons: Number(data?.completed_lessons) || serverCompletedIds.size || computed.completed_lessons,
        total_lessons: Number(data?.total_lessons) || computed.total_lessons,
        percentage: Number(data?.percentage ?? data?.progress) || computed.percentage,
      });
    } catch {
      progressEndpointUnavailableRef.current = true;
      setCourseProgress(computed);
    } finally {
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        setProgressLoaded(true);
        console.log("Progress loaded");
      }
    }
  }, [courseId]);

  const loadModulesAndLessons = useCallback(async ({ force = false } = {}) => {
    if (modulesLoadedRef.current && !force) return;

    setLoading(true);
    setError("");

    try {
      let moduleItems = [];

      try {
        const moduleResponse = await authGet(`/api/courses/${courseId}/modules/`);
        moduleItems = await Promise.all(
          (moduleResponse || []).map(async (moduleItem) => {
            if (Array.isArray(moduleItem.lessons)) return normalizeModule(moduleItem);

            try {
              const lessons = await authGet(`/api/modules/${moduleItem.id}/lessons/`);
              return normalizeModule({ ...moduleItem, lessons });
            } catch {
              return normalizeModule({ ...moduleItem, lessons: [] });
            }
          })
        );
      } catch {
        const lessons = await authGet(`/api/courses/${courseId}/lessons/`);
        const grouped = new Map();

        (lessons || []).forEach((lesson) => {
          const moduleId = lesson.module ?? lesson.module_id ?? "general";
          if (!grouped.has(moduleId)) {
            grouped.set(moduleId, {
              id: moduleId,
              title: lesson.module_title || "General",
              order: 0,
              lessons: [],
            });
          }
          grouped.get(moduleId).lessons.push(normalizeLesson(lesson));
        });

        moduleItems = Array.from(grouped.values()).map(normalizeModule);
      }

      const normalizedModules = sortByOrder(moduleItems.map(normalizeModule));
      setModules(normalizedModules);

      setExpandedModules((prev) => {
        const next = { ...prev };
        normalizedModules.forEach((moduleItem, index) => {
          if (typeof next[moduleItem.id] !== "boolean") {
            next[moduleItem.id] = index === 0;
          }
        });
        return next;
      });

      const completedSet = readStoredCompletedLessonIds(courseId);
      flattenLessons(normalizedModules).forEach(({ lesson }) => {
        if (lesson.completed || lesson.is_completed || lesson.status === "completed") {
          completedSet.add(lesson.id);
        }
      });
      writeStoredCompletedLessonIds(courseId, completedSet);
      setCompletedLessonIds(completedSet);

      const fallbackFirst = flattenLessons(normalizedModules)[0] || null;
      setSelectedLesson((previous) => {
        if (!previous?.id && fallbackFirst) {
          return fallbackFirst.lesson;
        }

        const found = flattenLessons(normalizedModules).find(
          ({ lesson }) => Number(lesson.id) === Number(previous?.id)
        );
        return found?.lesson || fallbackFirst?.lesson || null;
      });

      setSelectedModule((previous) => {
        const sourceId = previous?.id;
        if (sourceId) {
          const found = normalizedModules.find(
            (moduleItem) => Number(moduleItem.id) === Number(sourceId)
          );
          if (found) return found;
        }

        return fallbackFirst?.module || normalizedModules[0] || null;
      });

      modulesLoadedRef.current = true;
      setModulesLoaded(true);
      console.log("Modules loaded");

      await refreshProgress(completedSet, normalizedModules);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load lessons and modules.");
      modulesLoadedRef.current = true;
      setModulesLoaded(true);
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        setProgressLoaded(true);
        console.log("Progress loaded");
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, refreshProgress]);

  useEffect(() => {
    if (!isMountedRef.current) {
      console.log("LessonsTab mounted");
      isMountedRef.current = true;
    }

    modulesLoadedRef.current = false;
    progressLoadedRef.current = false;
    progressEndpointUnavailableRef.current = false;

    setModulesLoaded(false);
    setProgressLoaded(false);

    loadModulesAndLessons({ force: true });
  }, [courseId, loadModulesAndLessons]);

  useEffect(() => {
    if (!initialLessonId || modules.length === 0) return;
    const selected = flattenLessons(modules).find(({ lesson, module }) => {
      const lessonMatch = Number(lesson.id) === Number(initialLessonId);
      if (!lessonMatch) return false;
      if (!initialModuleId) return true;
      return Number(module.id) === Number(initialModuleId);
    });

    if (selected) {
      setSelectedModule(selected.module);
      setSelectedLesson(selected.lesson);
    }
  }, [initialLessonId, initialModuleId, modules]);

  const handleSelectLesson = useCallback(
    async (lesson, moduleItem) => {
      setSelectedLesson(lesson);
      setSelectedModule(moduleItem);

      try {
        const detailedLesson = await tryEndpoints("GET", [
          `/api/lessons/${lesson.id}/`,
          `/api/courses/${courseId}/lessons/${lesson.id}/`,
        ]);

        if (detailedLesson) {
          const normalizedDetail = normalizeLesson({ ...lesson, ...detailedLesson });
          updateLessonInState(lesson.id, normalizedDetail);
          setSelectedLesson(normalizedDetail);
        }
      } catch {
        // Keep the selected lesson from sidebar payload.
      }
    },
    [courseId, updateLessonInState]
  );

  const { prevLesson, nextLesson } = useMemo(
    () => getLessonNeighbors(modules, selectedLesson?.id),
    [modules, selectedLesson?.id]
  );

  const handlePrev = () => {
    if (!prevLesson) return;
    handleSelectLesson(prevLesson.lesson, prevLesson.module);
  };

  const handleNext = () => {
    if (!nextLesson) return;
    handleSelectLesson(nextLesson.lesson, nextLesson.module);
  };

  const handleMarkCompleted = async (lesson) => {
    if (isInstructor) return;
    if (!lesson?.id) return;

    const nextSet = new Set(completedLessonIdsRef.current);
    nextSet.add(lesson.id);

    writeStoredCompletedLessonIds(courseId, nextSet);
    setCompletedLessonIds(nextSet);
    setCourseProgress(buildComputedProgress(nextSet, totalLessons));

    try {
      await tryEndpoints("POST", [
        `/api/lessons/${lesson.id}/complete/`,
        `/api/courses/${courseId}/lessons/${lesson.id}/complete/`,
      ]);
    } catch {
      // Keep optimistic UI for legacy backends without completion endpoint.
    }

    await refreshProgress(nextSet, modules);
  };

  const handleCreateModule = async () => {
    if (!moduleForm.title.trim()) return;
    setSaving(true);

    try {
      await tryEndpoints("POST", [`/api/modules/`, `/api/courses/${courseId}/modules/`], {
        course: Number(courseId),
        title: moduleForm.title.trim(),
        order: moduleForm.order ? Number(moduleForm.order) : 0,
      });

      setModuleForm({ title: "", order: "" });
      modulesLoadedRef.current = false;
      setModulesLoaded(false);
      progressLoadedRef.current = false;
      setProgressLoaded(false);
      await loadModulesAndLessons({ force: true });
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to create module.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLesson = async ({ type, payload }) => {
    setSaving(true);

    try {
      if (type === "upload") {
        // Upload flow: submit multipart data so backend can store file and extracted outputs.
        let created = null;
        try {
          const response = await axios.post(`/api/courses/${courseId}/lessons/add/`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          created = response.data;
        } catch (firstError) {
          const moduleId = payload.get("module");
          const response = await axios.post(`/api/modules/${moduleId}/lessons/`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          created = response.data;
        }
        const warning =
          created?.warning ||
          (Array.isArray(created?.warnings) ? created.warnings.join(" ") : "");
        if (warning) {
          alert(`Lesson created with warning: ${warning}`);
        }
      } else {
        // Manual flow: keep legacy JSON lesson creation behavior.
        await tryEndpoints(
          "POST",
          [
            `/api/lessons/`,
            `/api/modules/${payload.moduleId}/lessons/`,
            `/api/courses/${courseId}/lessons/add/`,
          ],
          {
            course: Number(courseId),
            module: Number(payload.moduleId),
            title: payload.title.trim(),
            content: payload.content || "",
            order: payload.order ? Number(payload.order) : 0,
          }
        );
      }

      modulesLoadedRef.current = false;
      setModulesLoaded(false);
      progressLoadedRef.current = false;
      setProgressLoaded(false);
      await loadModulesAndLessons({ force: true });
      setIsLessonModalOpen(false);
    } catch (requestError) {
      console.error(requestError);
      alert(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to add lesson."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleImportModule = async (formData) => {
    setSaving(true);
    try {
      const response = await axios.post(`/api/courses/${courseId}/modules/import/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const warningList = response?.data?.warnings || [];
      if (warningList.length) {
        alert(`Module imported with warnings: ${warningList.join(" ")}`);
      }
      modulesLoadedRef.current = false;
      setModulesLoaded(false);
      progressLoadedRef.current = false;
      setProgressLoaded(false);
      await loadModulesAndLessons({ force: true });
      setIsImportModalOpen(false);
    } catch (requestError) {
      console.error(requestError);
      alert(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to import module."
      );
      throw requestError;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenModulePage = (moduleItem) => {
    navigate(`/instructor-dashboard/courses/${courseId}/modules/${moduleItem.id}/lessons`);
  };

  const handleSaveLesson = async (lesson, updates) => {
    setSaving(true);

    try {
      const payload = {
        ...lesson,
        ...updates,
      };

      const data = await tryEndpoints(
        "PATCH",
        [`/api/lessons/${lesson.id}/`, `/api/courses/${courseId}/lessons/${lesson.id}/`],
        payload
      );

      const merged = normalizeLesson({ ...lesson, ...(data || updates) });
      updateLessonInState(lesson.id, merged);
      setSelectedLesson(merged);
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to edit lesson. Add lesson update endpoints in backend first.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDeleteLesson = (lesson) => {
    setDeleteError("");
    setConfirmDelete({ type: "lesson", item: lesson });
  };

  const handleRequestDeleteModule = (moduleItem) => {
    setDeleteError("");
    setConfirmDelete({ type: "module", item: moduleItem });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete?.item?.id) return;
    setSaving(true);
    setDeleteError("");

    try {
      if (confirmDelete.type === "lesson") {
        const lesson = confirmDelete.item;
        await tryEndpoints("DELETE", [
          `/api/lessons/${lesson.id}/`,
          `/api/courses/${courseId}/lessons/${lesson.id}/`,
        ]);

        removeLessonFromState(lesson.id);

        const nextSet = new Set(completedLessonIdsRef.current);
        nextSet.delete(lesson.id);
        setCompletedLessonIds(nextSet);

        const nextModules = modulesRef.current.map((moduleItem) => ({
          ...moduleItem,
          lessons: (moduleItem.lessons || []).filter((item) => Number(item.id) !== Number(lesson.id)),
        }));
        const nextSequence = flattenLessons(nextModules);
        setSelectedLesson((previous) => {
          if (Number(previous?.id) !== Number(lesson.id)) return previous;
          return nextSequence[0]?.lesson || null;
        });
        setSelectedModule((previous) => {
          const existing = nextModules.find((m) => Number(m.id) === Number(previous?.id));
          return existing || nextSequence[0]?.module || null;
        });
        await refreshProgress(nextSet, nextModules);
      }

      if (confirmDelete.type === "module") {
        const moduleItem = confirmDelete.item;
        await tryEndpoints("DELETE", [
          `/api/modules/${moduleItem.id}/`,
          `/api/courses/${courseId}/modules/${moduleItem.id}/`,
        ]);

        const removedLessonIds = new Set((moduleItem.lessons || []).map((lesson) => Number(lesson.id)));
        const nextModules = modulesRef.current.filter(
          (item) => Number(item.id) !== Number(moduleItem.id)
        );
        setModules(nextModules);
        setExpandedModules((prev) => {
          const next = { ...prev };
          delete next[moduleItem.id];
          return next;
        });

        const nextSet = new Set(completedLessonIdsRef.current);
        removedLessonIds.forEach((id) => nextSet.delete(id));
        setCompletedLessonIds(nextSet);

        const nextSequence = flattenLessons(nextModules);
        setSelectedLesson((previous) => {
          if (!previous) return nextSequence[0]?.lesson || null;
          if (!removedLessonIds.has(Number(previous.id))) return previous;
          return nextSequence[0]?.lesson || null;
        });
        setSelectedModule((previous) => {
          if (Number(previous?.id) !== Number(moduleItem.id)) return previous;
          return nextSequence[0]?.module || nextModules[0] || null;
        });

        await refreshProgress(nextSet, nextModules);
      }

      setConfirmDelete(null);
    } catch (requestError) {
      console.error(requestError);
      setDeleteError(
        confirmDelete.type === "module"
          ? "Unable to delete module."
          : "Unable to delete lesson."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && (!modulesLoaded || (!isInstructor && !progressLoaded))) return <p className="text-green-700">Loading lessons...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      {!isInstructor && (
        <ProgressBar
          progress={courseProgress}
          completedLessons={completedLessonIds.size}
          totalLessons={totalLessons}
        />
      )}
      {deleteError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {deleteError}
        </div>
      )}

      {isInstructor && (
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-emerald-900">Lesson Management</h4>
              <p className="text-xs text-gray-600">Create modules, add lessons, and import structured content.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowModuleForm((prev) => !prev)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {showModuleForm ? "Hide Module Form" : "New Module"}
              </button>
              <button
                type="button"
                onClick={() => setIsLessonModalOpen(true)}
                disabled={saving}
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                Add Lesson
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                disabled={saving}
                className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              >
                Import Module
              </button>
            </div>
          </div>
          {showModuleForm && (
            <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_auto]">
              <input
                type="text"
                placeholder="Module title"
                value={moduleForm.title}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="w-full rounded border p-2 text-sm"
              />
              <input
                type="number"
                placeholder="Order (optional)"
                value={moduleForm.order}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, order: event.target.value }))
                }
                className="w-full rounded border p-2 text-sm"
              />
              <button
                type="button"
                onClick={handleCreateModule}
                disabled={saving}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                Save Module
              </button>
            </div>
          )}
        </div>
      )}

      {!isInstructor && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          Tip: Use "Mark Complete" as you finish each lesson to track your progress.
        </div>
      )}

      {isInstructor ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.length === 0 ? (
            <article className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
              No modules yet. Create your first module to get started.
            </article>
          ) : (
            modules.map((moduleItem) => {
              const lessonCount = (moduleItem.lessons || []).length;
              const firstLesson = moduleItem.lessons?.[0]?.title || "No lesson yet";
              return (
                <article
                  key={moduleItem.id}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Module</p>
                      <h5 className="text-lg font-semibold text-emerald-950">{moduleItem.title || "Untitled Module"}</h5>
                    </div>
                    <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                      {lessonCount} lessons
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                    First lesson: <span className="font-medium text-gray-800">{firstLesson}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenModulePage(moduleItem)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Open Module
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestDeleteModule(moduleItem)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <aside className="space-y-3 lg:col-span-4 xl:col-span-3">
            <div className="rounded-xl border bg-white p-3 text-sm text-gray-600">
              Active Module: <span className="font-semibold text-green-900">{selectedModule?.title || "None"}</span>
            </div>

            {modules.length === 0 ? (
              <p className="text-gray-500">No modules yet.</p>
            ) : (
              modules.map((moduleItem) => (
                <ModuleCard
                  key={moduleItem.id}
                  moduleItem={moduleItem}
                  completedLessonIds={visibleCompletedLessonIds}
                  selectedLessonId={selectedLesson?.id}
                  onSelectLesson={handleSelectLesson}
                  isExpanded={Boolean(expandedModules[moduleItem.id])}
                  onToggle={() =>
                    setExpandedModules((prev) => ({
                      ...prev,
                      [moduleItem.id]: !prev[moduleItem.id],
                    }))
                  }
                  isInstructor={isInstructor}
                  onEditLesson={(lesson) => handleSelectLesson(lesson, moduleItem)}
                  onDeleteLesson={handleRequestDeleteLesson}
                  onDeleteModule={handleRequestDeleteModule}
                />
              ))
            )}
          </aside>

          <section className="lg:col-span-8 xl:col-span-9">
            <LessonViewer
              lesson={selectedLesson}
              isCompleted={!isInstructor && completedLessonIds.has(selectedLesson?.id)}
              onMarkCompleted={handleMarkCompleted}
              canMarkComplete={!isInstructor && Boolean(selectedLesson)}
              prevLesson={prevLesson}
              nextLesson={nextLesson}
              onPrev={handlePrev}
              onNext={handleNext}
              isInstructor={isInstructor}
              onSaveLesson={handleSaveLesson}
              onDeleteLesson={handleRequestDeleteLesson}
            />
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-emerald-950">Confirm Delete</h4>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-800 disabled:opacity-50"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <LessonCreateModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        modules={modules}
        courseId={courseId}
        saving={saving}
        onSubmitLesson={handleCreateLesson}
      />

      <ModuleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        courseId={courseId}
        saving={saving}
        onImported={handleImportModule}
      />
    </div>
  );
}
