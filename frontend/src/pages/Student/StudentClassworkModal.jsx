import React, { useEffect, useMemo, useState } from "react";
import StudentQuizPlayer from "../../components/student/StudentQuizPlayer";
import QuizAttemptView from "../../components/student/QuizAttemptView";
import QuizResults from "../../components/student/QuizResults";
import { getApiBaseUrl } from "../../utils/runtimeConfig";

const attendanceStatusClasses = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-orange-100 text-orange-700",
  excused: "bg-blue-100 text-blue-700",
};

const chipClassName =
  "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs";

const sectionCardClass =
  "rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95),rgba(236,253,245,0.52))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-5";

const miniCardClass = "rounded-xl border border-gray-100 bg-gray-50 p-3";
const actionButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700";
const solidActionButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700";

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const pdfExtensions = new Set(["pdf"]);
const officeExtensions = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const unsafeTrailingCharacters = /[),.;!?]+$/;
const urlPattern = /\bhttps?:\/\/[^\s<>()]+/gi;

const extractFileName = (value, fallback = "Attachment") => {
  if (!value) return fallback;
  try {
    return decodeURIComponent(String(value).split("/").pop().split("?")[0]) || fallback;
  } catch {
    return fallback;
  }
};

const resolveAssetUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(String(value))) return value;
  const baseUrl = getApiBaseUrl();
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedPath = String(value).startsWith("/") ? String(value) : `/${value}`;
  return `${normalizedBase}${normalizedPath}`;
};

const formatDateTime = (value, fallback = "No date") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString();
};

const formatFileSize = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
};

const getFileExtension = (value = "") => {
  const source = String(value || "").split("?")[0];
  const lastDot = source.lastIndexOf(".");
  if (lastDot === -1) return "";
  return source.slice(lastDot + 1).trim().toLowerCase();
};

const humanizeFileType = (attachment) => {
  const mimeType = String(attachment?.mimeType || attachment?.mime_type || "").trim();
  if (mimeType) {
    return mimeType
      .replace("application/vnd.openxmlformats-officedocument.", "office ")
      .replace("application/vnd.ms-", "ms-")
      .replace("application/", "")
      .replace("image/", "")
      .replace(/[-_.]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  const extension = getFileExtension(attachment?.name || attachment?.url || "");
  return extension ? extension.toUpperCase() : "File";
};

const mergeFiles = (currentFiles, nextFiles) => {
  const list = Array.isArray(currentFiles) ? [...currentFiles] : [];
  (Array.isArray(nextFiles) ? nextFiles : []).forEach((file) => {
    const exists = list.some(
      (item) =>
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified &&
        item.type === file.type
    );
    if (!exists) list.push(file);
  });
  return list;
};

const getInstructionsContent = (activity) => {
  const metadata = activity?.classwork_metadata || {};
  return activity?.description || metadata.instructions || metadata.requirements || "";
};

const getAllowedFileTypes = (activity) => {
  const metadata = activity?.classwork_metadata || {};
  return String(activity?.allowed_file_types || metadata.allowed_file_types || "").trim();
};

const isSafeExternalUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const cleanExtractedUrl = (value) => String(value || "").trim().replace(unsafeTrailingCharacters, "");

const extractLinksFromText = (text) => {
  const matches = String(text || "").match(urlPattern) || [];
  const seen = new Set();
  return matches
    .map(cleanExtractedUrl)
    .filter((item) => isSafeExternalUrl(item) && !seen.has(item) && seen.add(item));
};

const getYouTubeVideoId = (value) => {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\/+/, "").split("/")[0] || "";
    }
    if (url.pathname.includes("/embed/")) {
      return url.pathname.split("/embed/")[1]?.split(/[?/]/)[0] || "";
    }
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
};

const getLinkProvider = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("drive.google.com")) return "drive";
    if (host.includes("docs.google.com")) return "docs";
    if (host.includes("tinkercad.com")) return "tinkercad";
    return "website";
  } catch {
    return "website";
  }
};

const buildLinkMeta = (value) => {
  if (!isSafeExternalUrl(value)) return null;
  const url = cleanExtractedUrl(value);
  const provider = getLinkProvider(url);
  let hostname = "Link";
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    hostname = "Link";
  }
  const youtubeId = provider === "youtube" ? getYouTubeVideoId(url) : "";
  const providerMap = {
    youtube: { label: "YouTube", badge: "YT", title: "YouTube Video" },
    drive: { label: "Google Drive", badge: "DRIVE", title: "Google Drive Resource" },
    docs: { label: "Google Docs", badge: "DOCS", title: "Google Docs Resource" },
    tinkercad: { label: "Tinkercad", badge: "3D", title: "Tinkercad Resource" },
    website: { label: "Website", badge: "WEB", title: hostname },
  };
  const config = providerMap[provider] || providerMap.website;
  return {
    id: `link-${url}`,
    url,
    provider,
    hostname,
    label: config.label,
    badge: config.badge,
    title: config.title,
    previewUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "",
    youtubeId,
  };
};

const buildAttachmentMeta = (value, fallbackName = "Attachment") => {
  if (!value) return null;

  if (value instanceof File) {
    const extension = getFileExtension(value.name);
    return {
      id: `${value.name}-${value.lastModified}-${value.size}`,
      name: value.name || fallbackName,
      url: "",
      downloadUrl: "",
      size: value.size || null,
      mimeType: value.type || "",
      extension,
      isImage: imageExtensions.has(extension) || String(value.type || "").startsWith("image/"),
      isPdf: pdfExtensions.has(extension) || String(value.type || "").includes("pdf"),
      isOffice: officeExtensions.has(extension),
      rawFile: value,
      sourceLabel: "Selected file",
    };
  }

  const rawUrl = resolveAssetUrl(value.file_url || value.file || value.url || "");
  const name = value.name || extractFileName(rawUrl, fallbackName);
  const extension = getFileExtension(name || rawUrl);
  const mimeType = String(value.mime_type || value.mimeType || "").trim();

  return {
    id: value.id || rawUrl || name,
    name,
    url: rawUrl,
    downloadUrl: rawUrl,
    size: value.file_size ?? value.size ?? null,
    mimeType,
    extension,
    isImage: imageExtensions.has(extension) || mimeType.startsWith("image/"),
    isPdf: pdfExtensions.has(extension) || mimeType.includes("pdf"),
    isOffice: officeExtensions.has(extension),
    rawFile: null,
    sourceLabel: "Attachment",
  };
};

const getOfficeViewerUrl = (value) => {
  if (!isSafeExternalUrl(value)) return "";
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(value)}`;
};

const renderInlineLinkedText = (text) => {
  const lines = String(text || "").split("\n");
  return lines.map((line, lineIndex) => {
    const parts = line.split(urlPattern);
    const matches = line.match(urlPattern) || [];

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          const url = matches[partIndex] ? cleanExtractedUrl(matches[partIndex]) : null;
          return (
            <React.Fragment key={`part-${lineIndex}-${partIndex}`}>
              {part}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-800"
                >
                  {url}
                </a>
              ) : null}
            </React.Fragment>
          );
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
};

const copyText = async (value) => {
  if (!value) return false;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const succeeded = document.execCommand("copy");
  document.body.removeChild(textArea);
  return succeeded;
};

function PreviewModal({ item, onClose, onCopy, copiedKey }) {
  if (!item) return null;

  const isFile = item.kind === "file";
  const previewUnavailableMessage = isFile
    ? "Preview is not available for this file. Please download it instead."
    : "Preview is not available for this link. Please open it in a new tab.";

  const openUrl = item.openUrl || item.url || item.downloadUrl || "";
  const downloadUrl = item.downloadUrl || item.url || "";
  const officePreviewUrl = item.isOffice ? getOfficeViewerUrl(item.url) : "";
  const canPreviewImage = item.isImage && item.url;
  const canPreviewPdf = item.isPdf && item.url;
  const canPreviewOffice = item.isOffice && officePreviewUrl;
  const canPreviewYoutube = item.provider === "youtube" && item.previewUrl;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 p-3 sm:p-6" onClick={onClose} role="presentation">
      <div
        className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_26px_70px_rgba(15,23,42,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,1))] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {isFile ? humanizeFileType(item) : item.label}
            </p>
            <h4 className="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl" title={item.name || item.title}>
              {item.name || item.title}
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {openUrl ? (
              <button type="button" onClick={() => onCopy(openUrl)} className={actionButtonClass}>
                {copiedKey === openUrl ? "Copied" : "Copy Link"}
              </button>
            ) : null}
            {openUrl ? (
              <a href={openUrl} target="_blank" rel="noopener noreferrer" className={actionButtonClass}>
                Open in New Tab
              </a>
            ) : null}
            {downloadUrl ? (
              <a href={downloadUrl} download className={solidActionButtonClass}>
                Download
              </a>
            ) : null}
            <button type="button" onClick={onClose} className={actionButtonClass}>
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
          {canPreviewImage ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-slate-200 bg-white p-3">
              <img src={item.url} alt={item.name} className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain" />
            </div>
          ) : null}

          {canPreviewPdf ? (
            <div className="h-[72vh] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <iframe title={item.name} src={item.url} className="h-full w-full" />
            </div>
          ) : null}

          {!canPreviewImage && !canPreviewPdf && canPreviewOffice ? (
            <div className="h-[72vh] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <iframe title={item.name} src={officePreviewUrl} className="h-full w-full" />
            </div>
          ) : null}

          {!canPreviewImage && !canPreviewPdf && !canPreviewOffice && canPreviewYoutube ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3">
              <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950">
                <iframe
                  title={item.title}
                  src={item.previewUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}

          {!canPreviewImage && !canPreviewPdf && !canPreviewOffice && !canPreviewYoutube ? (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center">
              <div>
                <p className="text-base font-semibold text-slate-800">Preview unavailable</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{previewUnavailableMessage}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, onPreview, onCopy }) {
  if (!attachment) return null;

  const badgeText = attachment.isImage
    ? "IMG"
    : attachment.isPdf
    ? "PDF"
    : attachment.isOffice
    ? (attachment.extension || "OFFICE").toUpperCase()
    : (attachment.extension || "FILE").toUpperCase();

  const previewLabel = attachment.isImage || attachment.isPdf || attachment.isOffice ? "Preview" : "Open";
  const previewAvailable = Boolean(attachment.url && (attachment.isImage || attachment.isPdf || attachment.isOffice));

  return (
    <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(248,250,252,1))] sm:h-24 sm:w-28">
          {attachment.isImage && attachment.url ? (
            <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-center">
              <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {badgeText}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
                {attachment.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {humanizeFileType(attachment)}{attachment.size ? ` | ${formatFileSize(attachment.size)}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {attachment.sourceLabel}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (previewAvailable ? onPreview(attachment) : window.open(attachment.url, "_blank", "noopener,noreferrer"))}
              className={solidActionButtonClass}
              disabled={!attachment.url}
            >
              {previewLabel}
            </button>
            {attachment.url ? (
              <a href={attachment.url} target="_blank" rel="noopener noreferrer" className={actionButtonClass}>
                Open
              </a>
            ) : null}
            {attachment.downloadUrl ? (
              <a href={attachment.downloadUrl} download className={actionButtonClass}>
                Download
              </a>
            ) : null}
            {attachment.url ? (
              <button type="button" onClick={() => onCopy(attachment.url)} className={actionButtonClass}>
                Copy Link
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function LinkCard({ item, onPreview, onCopy, copiedKey }) {
  if (!item) return null;

  return (
    <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      {item.provider === "youtube" && item.previewUrl ? (
        <div className="aspect-video overflow-hidden border-b border-slate-200 bg-slate-950">
          <iframe
            title={item.title}
            src={item.previewUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {item.badge}
            </span>
            <p className="mt-3 truncate text-sm font-semibold text-slate-900" title={item.title}>
              {item.title}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{item.hostname}</p>
            {item.provider === "website" ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Preview is not available for this link. Please open it in a new tab.
              </p>
            ) : null}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Link
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.provider === "youtube" ? (
            <button type="button" onClick={() => onPreview(item)} className={solidActionButtonClass}>
              Preview
            </button>
          ) : null}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={actionButtonClass}>
            Open
          </a>
          <button type="button" onClick={() => onCopy(item.url)} className={actionButtonClass}>
            {copiedKey === item.url ? "Copied" : "Copy Link"}
          </button>
        </div>
      </div>
    </article>
  );
}

function AttachmentSection({ title, items, onPreview, onCopy, emptyText = "No attachments available." }) {
  return (
    <section className={sectionCardClass}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <AttachmentCard key={item.id || item.url || item.name} attachment={item} onPreview={onPreview} onCopy={onCopy} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function LinkSection({ title, items, onPreview, onCopy, copiedKey, emptyText = "No links available." }) {
  return (
    <section className={sectionCardClass}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <LinkCard key={item.id} item={item} onPreview={onPreview} onCopy={onCopy} copiedKey={copiedKey} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function SubmissionPane({
  submission,
  comments,
  activityData,
  setActivityData,
  handleTaskSubmission,
  taskSubmitting,
  isGraded,
  grade,
  points,
  percentage,
  canUnsubmit,
  onUnsubmit,
  onClose,
  allowedFileTypes,
  submissionStatus,
  canSubmit,
  lockedMessage,
  lateWarning,
  onPreview,
  onCopy,
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  const wordCount = useMemo(() => {
    const text = String(activityData.text_answer || "").trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [activityData.text_answer]);

  const submittedFiles = useMemo(
    () =>
      (submission?.attachments || [])
        .map((item, index) => buildAttachmentMeta(item, `File ${index + 1}`))
        .filter(Boolean)
        .map((item) => ({ ...item, sourceLabel: "Submitted file" })),
    [submission]
  );

  const addFiles = (incomingFiles) => {
    setActivityData((prev) => ({
      ...prev,
      files: mergeFiles(prev.files, incomingFiles),
    }));
  };

  const removeFile = (indexToRemove) => {
    setActivityData((prev) => ({
      ...prev,
      files: prev.files.filter((_, index) => index !== indexToRemove),
    }));
  };

  const submittedMessage =
    submissionStatus === "Graded"
      ? "Your work has been graded."
      : "Submitted successfully. Waiting for grade.";

  if (submission) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,1))] p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">{submittedMessage}</p>
              <p className="mt-1 text-xs text-emerald-700">
                Submitted {formatDateTime(submission?.submitted_at, "Not available")}
              </p>
            </div>
            <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {submissionStatus}
            </span>
          </div>
        </section>

        <section className={sectionCardClass}>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Score: {isGraded ? `${grade} / ${points}` : "Not graded yet"}
            </span>
            {percentage ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                {percentage}%
              </span>
            ) : null}
            {submission?.is_late ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Submitted late
              </span>
            ) : null}
          </div>

          {submission?.text_answer ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your Answer
              </p>
              <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                {submission.text_answer}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No text answer was included in this submission.
            </div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <AttachmentSection
              title="Submitted Files"
              items={submittedFiles}
              onPreview={(item) => onPreview({ ...item, kind: "file", openUrl: item.url })}
              onCopy={onCopy}
              emptyText="No files were attached."
            />

            <div className="space-y-4">
              <section className={sectionCardClass}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Feedback</p>
                <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                  {submission?.feedback || "No feedback yet."}
                </p>
              </section>

              {comments.length > 0 ? (
                <section className={sectionCardClass}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comments</p>
                  <div className="space-y-3">
                    {comments.map((comment, index) => (
                      <article
                        key={comment.id || `${comment.created_at || "comment"}-${index}`}
                        className="rounded-2xl border border-emerald-100/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.98),rgba(236,253,245,0.44),rgba(248,250,252,0.98))] p-3"
                      >
                        <p className="text-sm leading-6 text-slate-700">
                          {comment.message || comment.comment || comment.text || "(empty)"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {comment.user || comment.username || "User"} | {formatDateTime(comment.created_at, "No date")}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {canUnsubmit ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Need to revise this work? Unsubmit first, then submit an updated version.
              </p>
              <button
                type="button"
                onClick={() => onUnsubmit(submission.id)}
                className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 sm:w-auto"
              >
                Unsubmit
              </button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!submission && lockedMessage ? (
        <section className="rounded-3xl border border-red-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,1))] p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700">Submission closed. Due date has passed.</p>
          <p className="mt-1 text-sm text-red-600">{lockedMessage}</p>
        </section>
      ) : null}

      {!submission && !lockedMessage && lateWarning ? (
        <section className="rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,1))] p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-700">Late submission</p>
          <p className="mt-1 text-sm text-amber-700">{lateWarning}</p>
        </section>
      ) : null}

      <section className={sectionCardClass}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label htmlFor="student-answer" className="text-sm font-semibold text-slate-900">
            Your answer
          </label>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {wordCount} words
          </span>
        </div>
        <textarea
          id="student-answer"
          placeholder="Write your answer here"
          className="min-h-[150px] w-full resize-y rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 sm:min-h-[220px]"
          readOnly={!canSubmit}
          value={activityData.text_answer}
          onChange={(event) => setActivityData((prev) => ({ ...prev, text_answer: event.target.value }))}
        />
      </section>

      <section className={sectionCardClass}>
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">Upload files</p>
          <p className="mt-1 text-xs text-slate-500">
            Drag and drop files here or click to browse.
            {allowedFileTypes ? ` Allowed: ${allowedFileTypes}` : ""}
          </p>
        </div>

        <label
          htmlFor="student-files"
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            setIsDragActive(false);
            addFiles(Array.from(event.dataTransfer.files || []));
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-4 py-8 text-center transition sm:px-6 ${
            isDragActive
              ? "border-emerald-400 bg-emerald-50"
              : !canSubmit
              ? "border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] hover:border-emerald-300 hover:bg-emerald-50/60"
          }`}
        >
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
            Upload files
          </span>
          <p className="mt-3 text-sm font-medium text-slate-700">Drag and drop files here or click to browse</p>
          <p className="mt-1 text-xs text-slate-500">Selected files stay here until you submit or remove them.</p>
        </label>

        <input
          id="student-files"
          type="file"
          multiple
          accept={allowedFileTypes || undefined}
          disabled={!canSubmit}
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []));
            event.target.value = "";
          }}
          className="hidden"
        />

        <div className="mt-4 space-y-2">
          {activityData.files.length > 0 ? (
            activityData.files.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {humanizeFileType({ name: file.name, mimeType: file.type })} | {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={!canSubmit}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600 sm:w-auto"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No files selected yet.
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleTaskSubmission}
            disabled={taskSubmitting || !canSubmit}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {taskSubmitting ? "Submitting..." : canSubmit ? "Submit" : "Submission Closed"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentClassworkModal({
  courseId,
  activity,
  submission,
  attendanceSessions = [],
  onClose,
  onSubmitTask,
  onSubmitQuiz,
  onMarkAttendance,
  onMarkAttendanceSession,
  onUnsubmit,
}) {
  const [activeTab, setActiveTab] = useState("instructions");
  const [activityData, setActivityData] = useState({
    text_answer: submission?.text_answer || "",
    files: [],
    activityId: activity?.id || null,
  });
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [latestQuizResult, setLatestQuizResult] = useState(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const typeName = String(activity?.activity_type_name || activity?.activity_type || "").toLowerCase();
  const isQuiz = typeName === "quiz" || typeName === "exam";
  const isAttendance = typeName === "attendance";
  const isTaskType = ["assignment", "question", "project", "task", "homework", "material"].includes(typeName);

  useEffect(() => {
    setActivityData({
      text_answer: submission?.text_answer || "",
      files: [],
      activityId: activity?.id || null,
    });
  }, [activity, submission]);

  useEffect(() => {
    setQuizAttempts([]);
    setLatestQuizResult(null);
  }, [activity?.id]);

  useEffect(() => {
    if (isQuiz) setActiveTab("quiz");
    else if (isAttendance) setActiveTab("attendance");
    else if (submission) setActiveTab("your_work");
    else setActiveTab("instructions");
  }, [isAttendance, isQuiz, submission, activity?.id]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (previewItem) setPreviewItem(null);
        else onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, previewItem]);

  const grade = submission?.grade ?? null;
  const points = Number(activity?.points || 0);
  const percentage = grade !== null && points > 0 ? ((Number(grade) / points) * 100).toFixed(1) : null;
  const isGraded = grade !== null;

  const instructionsContent = getInstructionsContent(activity);
  const allowedFileTypes = getAllowedFileTypes(activity);
  const activityComments = Array.isArray(activity?.comments) ? activity.comments : [];
  const allowLateSubmission = Boolean(activity?.allow_late_submission ?? activity?.allow_late_submissions);
  const isOverdue = Boolean(activity?.is_overdue);
  const canSubmit = Boolean(activity?.can_submit ?? (!isOverdue || allowLateSubmission));
  const submissionLockedReason = String(activity?.submission_locked_reason || "").trim();
  const lateWarning = isOverdue && allowLateSubmission ? "Late submission - this work is past due." : "";

  const submissionStatus = (() => {
    if (submission?.grade !== null && submission?.grade !== undefined) return "Graded";
    if (submission?.feedback && !submission?.grade) return "Returned";
    if (submission?.is_late) return "Late Submission";
    if (submission) return "Submitted";
    if (isOverdue && !canSubmit) return "Past Due";
    if (activityData.text_answer?.trim() || activityData.files.length > 0) return "In Progress";
    return "Not Started";
  })();

  const statusClass =
    submissionStatus === "Graded"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : submissionStatus === "Returned"
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : submissionStatus === "Late Submission"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : submissionStatus === "Past Due"
      ? "border-red-200 bg-red-50 text-red-700"
      : submissionStatus === "Submitted"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : submissionStatus === "In Progress"
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : "border-slate-200 bg-slate-100 text-slate-600";

  const activityTypeLabel = activity?.activity_type_name || activity?.activity_type || "Classwork";
  const activityTopic = String(activity?.topic || activity?.title || "").toLowerCase();
  const relatedAttendanceSessions = useMemo(
    () =>
      attendanceSessions.filter((session) => {
        const sessionTopic = String(session?.topic || "").toLowerCase();
        return (
          !activityTopic ||
          sessionTopic === activityTopic ||
          sessionTopic.includes(activityTopic) ||
          activityTopic.includes(sessionTopic)
        );
      }),
    [activityTopic, attendanceSessions]
  );

  const overviewItems = [
    { label: "Posted", value: formatDateTime(activity?.created_at, "Not available") },
    { label: "Due Date", value: formatDateTime(activity?.due_date, "No due date") },
    { label: "Submission", value: submission?.submitted_at ? formatDateTime(submission.submitted_at) : "Not submitted" },
    { label: "Current Grade", value: isGraded ? `${grade} / ${points}` : "Not graded yet" },
  ];

  const instructorAttachments = useMemo(() => {
    const rawItems = Array.isArray(activity?.attachments) && activity.attachments.length > 0
      ? activity.attachments
      : activity?.file
      ? [{ id: activity.id || "activity-file", file: activity.file, file_url: activity.file, name: extractFileName(activity.file, "Instructor file") }]
      : [];
    const seen = new Set();
    return rawItems
      .map((item, index) => buildAttachmentMeta(item, `Attachment ${index + 1}`))
      .filter((item) => item?.url && !seen.has(item.url) && seen.add(item.url))
      .map((item) => ({ ...item, sourceLabel: "Resource file" }));
  }, [activity]);

  const instructionLinks = useMemo(() => extractLinksFromText(instructionsContent).map(buildLinkMeta).filter(Boolean), [instructionsContent]);

  const resourceLinks = useMemo(() => {
    const rawLinks = [activity?.link, ...(Array.isArray(activity?.classwork_metadata?.resource_links) ? activity.classwork_metadata.resource_links : [])]
      .filter(Boolean)
      .map(cleanExtractedUrl);
    const seen = new Set();
    return rawLinks
      .filter((item) => isSafeExternalUrl(item) && !seen.has(item) && seen.add(item))
      .map(buildLinkMeta)
      .filter(Boolean);
  }, [activity]);

  const canUnsubmit = Boolean(submission && !isGraded && typeof onUnsubmit === "function");

  const handleCopy = async (value) => {
    try {
      const didCopy = await copyText(value);
      if (!didCopy) return;
      setCopiedKey(value);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === value ? "" : current));
      }, 1800);
    } catch {
      // Keep failures quiet for normal users.
    }
  };

  const handleTaskSubmission = async () => {
    if (typeof onSubmitTask !== "function") return;
    if (!window.confirm("Are you sure you want to submit this work?")) return;

    setTaskSubmitting(true);
    try {
      await onSubmitTask(activityData.activityId, activityData.text_answer, activityData.files);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleQuizSubmit = async (resultPayload) => {
    setLatestQuizResult(resultPayload || null);
    if (Array.isArray(resultPayload?.attempts)) setQuizAttempts(resultPayload.attempts);

    if (typeof onSubmitQuiz === "function") {
      await onSubmitQuiz(activity?.id, resultPayload || {});
    }
  };

  if (!activity) return null;

  const showInstructionsPane =
    !isTaskType || activeTab === "instructions" || activeTab === "quiz" || activeTab === "attendance";
  const showWorkPane = !isTaskType || activeTab === "your_work";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/60 p-0 sm:p-4" onClick={onClose} role="presentation">
        <div
          className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] sm:h-auto sm:max-h-[94vh] sm:rounded-[32px] sm:border sm:border-white/70 sm:shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={activity?.title || "Classwork details"}
        >
          <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,1))] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Student submission workspace
                </p>
                <h3 className="mt-2 break-words text-xl font-semibold text-slate-900 sm:text-2xl">{activity?.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`${chipClassName} ${statusClass}`}>Status: {submissionStatus}</span>
                  <span className={`${chipClassName} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                    {activityTypeLabel}
                  </span>
                  <span className={`${chipClassName} border-slate-200 bg-white text-slate-600`}>{points} points</span>
                  {activity?.topic ? (
                    <span className={`${chipClassName} border-slate-200 bg-white text-slate-600`}>
                      Topic: {activity.topic}
                    </span>
                  ) : null}
                  {activity?.due_date ? (
                    <span className={`${chipClassName} border-rose-200 bg-rose-50 text-rose-700`}>
                      Due: {formatDateTime(activity.due_date)}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                aria-label="Close modal"
              >
                Close
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("instructions")}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "instructions"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                Instructions
              </button>
              {isTaskType ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("your_work")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "your_work"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  Your Work
                </button>
              ) : null}
              {isAttendance ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "attendance"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  Attendance
                </button>
              ) : null}
              {isQuiz ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("quiz")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "quiz"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  Quiz
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {isTaskType ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className={`space-y-4 ${showInstructionsPane ? "block" : "hidden"} lg:block`}>
                  <div
                    className={`rounded-[28px] border bg-white p-4 shadow-sm transition sm:p-5 ${
                      activeTab === "instructions"
                        ? "border-emerald-300 shadow-[0_18px_34px_rgba(16,185,129,0.12)]"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                          Classwork Overview
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Review the task details, schedule, and instructor resources before submitting.
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        Overview
                      </span>
                    </div>

                    <section className={sectionCardClass}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {overviewItems.map((item) => (
                          <div key={item.label} className={miniCardClass}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                            <p className="mt-1 break-words text-sm font-medium text-gray-900">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={sectionCardClass}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Instructions</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          Read first
                        </span>
                      </div>
                      {instructionsContent ? (
                        <div className="space-y-4">
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700 sm:text-[15px]">
                              {renderInlineLinkedText(instructionsContent)}
                            </p>
                          </div>
                          {instructionLinks.length > 0 ? (
                            <LinkSection
                              title="Detected Links"
                              items={instructionLinks}
                              onPreview={(item) => setPreviewItem({ ...item, kind: "link", openUrl: item.url })}
                              onCopy={handleCopy}
                              copiedKey={copiedKey}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          No written instructions were provided for this classwork.
                        </div>
                      )}
                    </section>

                    <AttachmentSection
                      title="Resources"
                      items={instructorAttachments}
                      onPreview={(item) => setPreviewItem({ ...item, kind: "file", openUrl: item.url })}
                      onCopy={handleCopy}
                      emptyText="No instructor files were attached."
                    />

                    {resourceLinks.length > 0 ? (
                      <LinkSection
                        title="Resource Links"
                        items={resourceLinks}
                        onPreview={(item) => setPreviewItem({ ...item, kind: "link", openUrl: item.url })}
                        onCopy={handleCopy}
                        copiedKey={copiedKey}
                      />
                    ) : null}
                  </div>
                </section>

                <section className={`${showWorkPane ? "block" : "hidden"} lg:block`}>
                  <div
                    className={`rounded-[28px] border bg-white p-4 shadow-sm transition sm:p-5 ${
                      activeTab === "your_work"
                        ? "border-emerald-300 shadow-[0_18px_34px_rgba(16,185,129,0.12)]"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Your Work</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Add your response, attach files, and review your submission status in one place.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Submission
                      </span>
                    </div>

                    <SubmissionPane
                      submission={submission}
                      comments={activityComments}
                      activityData={activityData}
                      setActivityData={setActivityData}
                      handleTaskSubmission={handleTaskSubmission}
                      taskSubmitting={taskSubmitting}
                      isGraded={isGraded}
                      grade={grade}
                      points={points}
                      percentage={percentage}
                      canUnsubmit={canUnsubmit}
                      onUnsubmit={onUnsubmit}
                      onClose={onClose}
                      allowedFileTypes={allowedFileTypes}
                      submissionStatus={submissionStatus}
                      canSubmit={canSubmit}
                      lockedMessage={submissionLockedReason}
                      lateWarning={lateWarning}
                      onPreview={setPreviewItem}
                      onCopy={handleCopy}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === "attendance" && isAttendance ? (
              <section className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                {relatedAttendanceSessions.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onMarkAttendance?.(activity?.id)}
                    disabled={typeof onMarkAttendance !== "function"}
                    className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                  >
                    Mark Present
                  </button>
                ) : (
                  relatedAttendanceSessions.map((session) => {
                    const myRecord = session?.my_record || null;
                    const toneClass = attendanceStatusClasses[myRecord?.status] || "bg-gray-100 text-gray-700";

                    return (
                      <article key={session.id} className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{session.topic}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(session.date, "No date")}</p>
                          </div>
                          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
                            {myRecord?.status ? String(myRecord.status).toUpperCase() : "NOT MARKED"}
                          </span>
                        </div>

                        <p className="text-sm text-slate-700">Points Earned: {myRecord?.points_earned ?? 0}</p>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => onMarkAttendanceSession?.(activity?.id, session.id, "present")}
                            disabled={typeof onMarkAttendanceSession !== "function"}
                            className="rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => onMarkAttendanceSession?.(activity?.id, session.id, "late")}
                            disabled={typeof onMarkAttendanceSession !== "function"}
                            className="rounded-2xl bg-orange-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                          >
                            Late
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            ) : null}

            {activeTab === "quiz" && isQuiz ? (
              <section className="space-y-4">
                <StudentQuizPlayer
                  courseId={courseId}
                  activity={activity}
                  onSubmitted={handleQuizSubmit}
                  onAttemptsLoaded={setQuizAttempts}
                />
                <QuizResults result={latestQuizResult} />
                <QuizAttemptView attempts={quizAttempts} />
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onCopy={handleCopy} copiedKey={copiedKey} />
    </>
  );
}
