import React, { useMemo, useState } from "react";
import axios from "../utils/axiosInstance";

export default function ModuleImportModal({
  isOpen,
  onClose,
  courseId,
  saving,
  onImported,
}) {
  const [file, setFile] = useState(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessons, setLessons] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const activeLessons = useMemo(() => lessons.filter((item) => !item.removed), [lessons]);

  if (!isOpen) return null;

  const safeClose = () => {
    if (saving || analyzing) return;
    onClose();
  };

  const analyzeFile = async () => {
    if (!file) {
      setError("Select a file first.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeProgress(0);
    setError("");
    setWarnings([]);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("module_title", moduleTitle);
      form.append("analyze_only", "true");

      const response = await axios.post(`/api/courses/${courseId}/modules/import/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setAnalyzeProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      const payload = response?.data || {};
      setModuleTitle(payload.module_title || moduleTitle);
      setLessons(
        (payload.lessons || []).map((lesson, index) => ({
          ...lesson,
          id: `${index}-${lesson.title || "lesson"}`,
          removed: false,
        }))
      );
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to analyze file.");
    } finally {
      setAnalyzing(false);
    }
  };

  const importModule = async () => {
    if (!file) {
      setError("File is required.");
      return;
    }
    if (!activeLessons.length) {
      setError("Keep at least one lesson before importing.");
      return;
    }

    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("module_title", moduleTitle);
    form.append("analyze_only", "false");
    form.append(
      "lessons",
      JSON.stringify(
        activeLessons.map((item) => ({
          title: item.title,
          content: item.content,
          type: item.type || "paragraph",
        }))
      )
    );
    await onImported(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold text-emerald-950">Import Module</h3>
            <p className="text-xs text-gray-600">Analyze a file into structured lessons before creating the module.</p>
          </div>
          <button
            type="button"
            onClick={safeClose}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Close
          </button>
        </header>

        <div className="max-h-[calc(92vh-130px)] space-y-4 overflow-y-auto p-5">
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={analyzeFile}
              disabled={analyzing || !file}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {analyzing ? "Analyzing..." : "Analyze File"}
            </button>
          </section>

          {analyzing && (
            <div className="h-2 overflow-hidden rounded bg-gray-100">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${analyzeProgress}%` }} />
            </div>
          )}

          <section className="rounded-xl border border-gray-200 p-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Module title</label>
            <input
              type="text"
              value={moduleTitle}
              onChange={(event) => setModuleTitle(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800">Lesson candidates</p>
            <div className="mt-2 max-h-[360px] space-y-3 overflow-y-auto">
              {lessons.length === 0 && (
                <p className="text-sm text-gray-500">Analyze a file to preview extracted lessons.</p>
              )}
              {lessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className={`rounded-lg border p-3 ${lesson.removed ? "border-gray-200 bg-gray-50 opacity-60" : "border-emerald-100 bg-white"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(event) =>
                        setLessons((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                      className="min-w-[280px] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      disabled={lesson.removed}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLessons((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, removed: !item.removed } : item
                          )
                        )
                      }
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        lesson.removed ? "bg-gray-200 text-gray-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {lesson.removed ? "Restore" : "Remove"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{lesson.type || "paragraph"}</p>
                  <div className="mt-2 max-h-28 overflow-y-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                    {lesson.content || "No content extracted."}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={safeClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={importModule}
            disabled={saving || analyzing || !file}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Importing..." : "Create Module"}
          </button>
        </footer>
      </section>
    </div>
  );
}
