import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../../utils/axiosInstance";
import { authGet } from "../../../utils/api";
import LessonViewer from "../../../components/LessonViewer";

const sortByOrder = (items = []) =>
  [...items].sort((a, b) => (a.order ?? a.lesson_order ?? 0) - (b.order ?? b.lesson_order ?? 0));

const normalizeLesson = (lesson = {}) => ({
  ...lesson,
  content: lesson.content ?? lesson.description ?? "",
  order: lesson.order ?? lesson.lesson_order ?? 0,
});

export default function ModuleLessonsPage() {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  const [moduleItem, setModuleItem] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => Number(lesson.id) === Number(selectedLessonId)) || null,
    [lessons, selectedLessonId]
  );

  const currentIndex = useMemo(
    () => lessons.findIndex((lesson) => Number(lesson.id) === Number(selectedLessonId)),
    [lessons, selectedLessonId]
  );
  const prevLesson = currentIndex > 0 ? { lesson: lessons[currentIndex - 1] } : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? { lesson: lessons[currentIndex + 1] } : null;

  const loadModuleData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const modules = await authGet(`/api/courses/${courseId}/modules/`);
      const found = (modules || []).find((item) => Number(item.id) === Number(moduleId));
      if (!found) {
        setModuleItem(null);
        setLessons([]);
        setError("Module not found.");
        return;
      }
      setModuleItem(found);

      const lessonRows = await authGet(`/api/modules/${moduleId}/lessons/`);
      const normalized = sortByOrder((lessonRows || []).map(normalizeLesson));
      setLessons(normalized);
      setSelectedLessonId((previous) => previous || normalized[0]?.id || null);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load module lessons.");
    } finally {
      setLoading(false);
    }
  }, [courseId, moduleId]);

  useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  const onSaveLesson = async (lesson, updates) => {
    setSaving(true);
    try {
      const payload = { ...lesson, ...updates };
      const response = await axios.patch(`/api/courses/${courseId}/lessons/${lesson.id}/`, payload);
      const merged = normalizeLesson(response.data || payload);
      setLessons((prev) =>
        sortByOrder(prev.map((item) => (Number(item.id) === Number(lesson.id) ? merged : item)))
      );
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to save lesson.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteLesson = async (lesson) => {
    const confirmed = window.confirm("Delete this lesson?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await axios.delete(`/api/courses/${courseId}/lessons/${lesson.id}/`);
      setLessons((prev) => {
        const next = prev.filter((item) => Number(item.id) !== Number(lesson.id));
        setSelectedLessonId(next[0]?.id || null);
        return next;
      });
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to delete lesson.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-4 text-sm text-gray-600">Loading module lessons...</p>;
  }
  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "lessons" } })}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Lesson Modules
          </button>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Module</p>
              <h2 className="text-2xl font-bold text-emerald-950">{moduleItem?.title || "Untitled Module"}</h2>
            </div>
            <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {lessons.length} lessons
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <aside className="space-y-2 lg:col-span-4 xl:col-span-3">
            {lessons.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500">
                No lessons in this module yet.
              </div>
            ) : (
              lessons.map((lesson, index) => {
                const active = Number(lesson.id) === Number(selectedLessonId);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      active ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500">Lesson {index + 1}</p>
                    <p className="text-sm font-semibold text-gray-800">{lesson.title}</p>
                  </button>
                );
              })
            )}
          </aside>

          <section className="lg:col-span-8 xl:col-span-9">
            <LessonViewer
              lesson={selectedLesson}
              isCompleted={false}
              onMarkCompleted={() => {}}
              canMarkComplete={false}
              prevLesson={prevLesson}
              nextLesson={nextLesson}
              onPrev={() => prevLesson && setSelectedLessonId(prevLesson.lesson.id)}
              onNext={() => nextLesson && setSelectedLessonId(nextLesson.lesson.id)}
              isInstructor
              onSaveLesson={onSaveLesson}
              onDeleteLesson={onDeleteLesson}
            />
            {saving && <p className="mt-2 text-xs text-gray-500">Saving changes...</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
