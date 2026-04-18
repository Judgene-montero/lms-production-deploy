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

const flattenLessons = (modules = []) =>
  modules.flatMap((moduleItem) => (moduleItem.lessons || []).map((lesson) => ({ module: moduleItem, lesson })));

export default function LessonDetail() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sequence = useMemo(() => flattenLessons(modules), [modules]);
  const currentIndex = useMemo(
    () => sequence.findIndex((item) => Number(item.lesson.id) === Number(lessonId)),
    [sequence, lessonId]
  );
  const prevLesson = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const moduleResponse = await authGet(`/api/courses/${courseId}/modules/`);
      const normalizedModules = sortByOrder(
        (moduleResponse || []).map((moduleItem) => ({
          ...moduleItem,
          lessons: sortByOrder((moduleItem.lessons || []).map(normalizeLesson)),
        }))
      );
      setModules(normalizedModules);

      const flat = flattenLessons(normalizedModules);
      const found = flat.find((item) => Number(item.lesson.id) === Number(lessonId));
      if (found) {
        setLesson(found.lesson);
      } else {
        setLesson(null);
        setError("Lesson not found.");
      }
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load lesson.");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveLesson = async (targetLesson, updates) => {
    setSaving(true);
    try {
      const payload = { ...targetLesson, ...updates };
      const response = await axios.patch(`/api/courses/${courseId}/lessons/${targetLesson.id}/`, payload);
      setLesson(normalizeLesson(response.data || payload));
      await loadData();
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to save lesson.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (targetLesson) => {
    const confirmed = window.confirm("Delete this lesson?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await axios.delete(`/api/courses/${courseId}/lessons/${targetLesson.id}/`);
      navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "lessons" } });
    } catch (requestError) {
      console.error(requestError);
      alert("Failed to delete lesson.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-4 text-sm text-gray-600">Loading lesson...</p>;
  }
  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <button
          type="button"
          onClick={() => navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "lessons" } })}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Lessons
        </button>

        <LessonViewer
          lesson={lesson}
          isCompleted={false}
          onMarkCompleted={() => {}}
          canMarkComplete={false}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          onPrev={() => prevLesson && navigate(`/instructor-dashboard/courses/${courseId}/lessons/${prevLesson.lesson.id}`)}
          onNext={() => nextLesson && navigate(`/instructor-dashboard/courses/${courseId}/lessons/${nextLesson.lesson.id}`)}
          isInstructor
          onSaveLesson={saveLesson}
          onDeleteLesson={deleteLesson}
        />

        {saving && <p className="text-xs text-gray-500">Saving changes...</p>}
      </div>
    </div>
  );
}
