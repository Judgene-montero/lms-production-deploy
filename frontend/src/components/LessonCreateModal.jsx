import React, { useMemo, useState } from "react";
import axios from "../utils/axiosInstance";

const SUPPORTED_LABEL = "PDF, DOC/DOCX, PPT/PPTX, TXT";

const getFileTypeLabel = (name = "") => {
  const lowered = String(name).toLowerCase();
  if (lowered.endsWith(".pdf")) return "PDF";
  if (lowered.endsWith(".doc") || lowered.endsWith(".docx")) return "DOC";
  if (lowered.endsWith(".ppt") || lowered.endsWith(".pptx")) return "PPT";
  if (lowered.endsWith(".txt")) return "TXT";
  return "FILE";
};

export default function LessonCreateModal({
  isOpen,
  onClose,
  modules,
  courseId,
  saving,
  onSubmitLesson,
}) {
  const [mode, setMode] = useState("manual");
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("");
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractWarning, setExtractWarning] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");

  const keptImageIndexes = useMemo(
    () => images.filter((item) => !item.removed).map((item) => item.index),
    [images]
  );

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (saving || extracting) return;
    setError("");
    setExtractWarning("");
    setExtractProgress(0);
    onClose();
  };

  const handlePickFile = (picked) => {
    if (!picked) return;
    setFile(picked);
    setExtractWarning("");
    setError("");
    if (!title.trim()) {
      const fallback = picked.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
      setTitle(fallback || "Imported Lesson");
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    setError("");
    setExtractWarning("");
    setExtractProgress(0);
    setExtracting(true);
    try {
      // Upload to lesson extraction endpoint to preview text/images before creating the final lesson.
      const body = new FormData();
      body.append("file", file);
      const response = await axios.post(`/api/courses/${courseId}/lessons/extract/`, body, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setExtractProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      const payload = response?.data || {};
      if (payload.title_suggestion && !title.trim()) {
        setTitle(payload.title_suggestion);
      }
      setExtractedText(String(payload.extracted_text || ""));
      setImages(
        (payload.images || []).map((item) => ({
          ...item,
          removed: false,
        }))
      );
      if (Array.isArray(payload.warnings) && payload.warnings.length) {
        setExtractWarning(payload.warnings.join(" "));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to extract file content.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!moduleId || !title.trim()) {
      setError("Module and title are required.");
      return;
    }
    setError("");

    if (mode === "upload") {
      if (!file) {
        setError("Upload mode requires a file.");
        return;
      }

      const formData = new FormData();
      formData.append("course", String(courseId));
      formData.append("module", String(moduleId));
      formData.append("title", title.trim());
      formData.append("description", description);
      formData.append("content", description);
      if (order) formData.append("order", String(order));
      formData.append("file", file);
      formData.append("kept_image_indexes", JSON.stringify(keptImageIndexes));
      await onSubmitLesson({ type: "upload", payload: formData });
    } else {
      await onSubmitLesson({
        type: "manual",
        payload: {
          moduleId,
          title: title.trim(),
          content: description,
          order,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold text-emerald-950">Add Lesson</h3>
            <p className="text-xs text-gray-600">Choose manual entry or upload a file for auto-extraction.</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Close
          </button>
        </header>

        <div className="max-h-[calc(92vh-140px)] space-y-4 overflow-y-auto p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "manual" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Manual Input
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "upload" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Upload File
            </button>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {extractWarning && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{extractWarning}</p>
          )}

          <section className="grid gap-3 md:grid-cols-4">
            <select
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select module</option>
              {modules.map((moduleItem) => (
                <option key={moduleItem.id} value={moduleItem.id}>
                  {moduleItem.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Lesson title"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              type="number"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              placeholder="Order"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </section>

          {mode === "upload" && (
            <>
              <section className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-800">File Upload</p>
                <p className="text-xs text-gray-500">Supported: {SUPPORTED_LABEL}</p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-7 text-center">
                  <span className="text-sm font-medium text-emerald-800">Drag and drop file or click to browse</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                    className="hidden"
                    onChange={(event) => handlePickFile(event.target.files?.[0] || null)}
                  />
                </label>

                {file && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-gray-800">
                      [{getFileTypeLabel(file.name)}] {file.name}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={handleExtract}
                        disabled={extracting}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {extracting ? "Extracting..." : "Extract Content"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setExtractedText("");
                          setImages([]);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Remove File
                      </button>
                    </div>
                    {extracting && (
                      <div className="mt-2 h-2 overflow-hidden rounded bg-gray-100">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${extractProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800">Extracted Text Preview</p>
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                    {extractedText || "No extracted text yet."}
                  </div>
                </article>
                <article className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800">Extracted Images</p>
                  <div className="mt-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-lg bg-gray-50 p-2">
                    {images.length === 0 && <p className="col-span-2 text-xs text-gray-500">No extracted images.</p>}
                    {images.map((item) => (
                      <div key={item.index} className="rounded-lg border border-gray-200 bg-white p-2">
                        <img src={item.data_url} alt={item.name} className="h-20 w-full rounded object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setImages((prev) =>
                              prev.map((entry) =>
                                entry.index === item.index ? { ...entry, removed: !entry.removed } : entry
                              )
                            )
                          }
                          className={`mt-1 w-full rounded-md px-2 py-1 text-[11px] font-semibold ${
                            item.removed ? "bg-gray-200 text-gray-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.removed ? "Removed from lesson" : "Remove image"}
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </>
          )}

          <section className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800">Final Lesson Description</p>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context or summary for this lesson"
              className="mt-2 min-h-[120px] w-full rounded-lg border border-gray-300 p-3 text-sm"
            />
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || extracting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Lesson"}
          </button>
        </footer>
      </section>
    </div>
  );
}
