import React, { useEffect, useMemo, useState } from "react";

const looksLikeHtml = (content = "") => /<\/?[a-z][\s\S]*>/i.test(content);

const escapeHtml = (unsafe = "") =>
  unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const markdownToHtml = (markdown = "") => {
  const escaped = escapeHtml(markdown);
  const linked = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 underline">$1</a>');
  const bold = linked.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  const italic = bold.replace(/\*(.*?)\*/g, "<em>$1</em>");
  const headings = italic
    .replace(/^### (.*)$/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="text-xl font-semibold mt-3 mb-2">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-2xl font-bold mt-3 mb-2">$1</h1>');

  return headings
    .split("\n\n")
    .map((block) => {
      if (/^[-*] /m.test(block)) {
        const items = block
          .split("\n")
          .filter((line) => /^[-*] /.test(line))
          .map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`)
          .join("");
        return `<ul class="list-disc list-inside my-2">${items}</ul>`;
      }
      return `<p class="mb-3">${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
};

const sanitizeHtml = (unsafeHtml = "") => {
  if (!unsafeHtml) return "";
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return escapeHtml(String(unsafeHtml));
  }
  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(String(unsafeHtml), "text/html");

    doc.querySelectorAll("script, style, iframe, object, embed, meta, link").forEach((node) => node.remove());

    doc.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = String(attr.name || "").toLowerCase();
        const value = String(attr.value || "").trim();

        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }

        if ((name === "href" || name === "src") && /^javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });

    doc.querySelectorAll("a").forEach((link) => {
      link.setAttribute("rel", "noreferrer");
      link.setAttribute("target", "_blank");
    });

    return doc.body.innerHTML;
  } catch {
    return escapeHtml(String(unsafeHtml));
  }
};

export default function LessonViewer({
  lesson,
  isCompleted,
  onMarkCompleted,
  canMarkComplete = true,
  prevLesson,
  nextLesson,
  onPrev,
  onNext,
  isInstructor = false,
  onSaveLesson,
  onDeleteLesson,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ title: "", content: "", order: "" });

  useEffect(() => {
    if (!lesson) return;
    setFormData({
      title: lesson.title || "",
      content: lesson.content || lesson.description || "",
      order: lesson.order ?? lesson.lesson_order ?? "",
    });
    setIsEditing(false);
  }, [lesson]);

  const content = lesson?.content || lesson?.description || "No lesson content yet.";
  const renderedContent = useMemo(() => {
    const html = looksLikeHtml(content) ? content : markdownToHtml(content);
    return sanitizeHtml(html);
  }, [content]);

  if (!lesson) {
    return (
      <div className="bg-white rounded-2xl shadow-md border p-5">
        <p className="text-gray-500">Select a lesson to view its content.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-green-900">{lesson.title}</h3>
          {!isInstructor && isCompleted && (
            <span className="mt-2 inline-block rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
              Completed
            </span>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mb-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <input
            type="text"
            value={formData.title}
            onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded border p-2"
            placeholder="Lesson title"
          />
          <input
            type="number"
            value={formData.order}
            onChange={(event) => setFormData((prev) => ({ ...prev, order: event.target.value }))}
            className="w-full rounded border p-2"
            placeholder="Order"
          />
          <textarea
            value={formData.content}
            onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
            className="min-h-[220px] w-full rounded border p-2"
            placeholder="Lesson content (Markdown, HTML, or plain text)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await onSaveLesson?.(lesson, {
                  title: formData.title.trim(),
                  content: formData.content,
                  order: formData.order === "" ? undefined : Number(formData.order),
                });
                setIsEditing(false);
              }}
              className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save Lesson
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mb-5 leading-relaxed text-gray-800"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!prevLesson}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!nextLesson}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>

        {canMarkComplete && (
          <button
            type="button"
            onClick={() => onMarkCompleted?.(lesson)}
            disabled={isCompleted}
            className={`rounded px-4 py-2 text-sm font-semibold text-white ${
              isCompleted ? "cursor-not-allowed bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isCompleted ? "Completed" : "Mark Complete"}
          </button>
        )}

        {isInstructor && !isEditing && (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Edit Lesson
            </button>
            <button
              type="button"
              onClick={() => onDeleteLesson?.(lesson)}
              className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Delete Lesson
            </button>
          </>
        )}
      </div>
    </div>
  );
}
