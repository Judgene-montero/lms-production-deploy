import React, { useEffect, useMemo, useState } from "react";
import {
  LuBadgeCheck,
  LuBookOpen,
  LuCalendarClock,
  LuClipboardList,
  LuPencil,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import { getApiBaseUrl } from "../../../utils/runtimeConfig";

// Read-only details modal for existing classwork items.

const mapActivityToComponent = (activityTypeName = "") => {
  const normalized = String(activityTypeName || "").toLowerCase();
  if (normalized.includes("quiz")) return "Quiz";
  if (normalized.includes("attendance")) return "Attendance";
  if (normalized.includes("project")) return "Project";
  if (normalized.includes("exam")) return "Exam";
  if (normalized.includes("material") || normalized.includes("announcement")) return "Ungraded";
  if (
    normalized.includes("assignment") ||
    normalized.includes("task") ||
    normalized.includes("question") ||
    normalized.includes("homework")
  ) {
    return "Assignment";
  }
  return "Assignment";
};

const isQuizType = (activity) => String(activity?.activity_type_name || activity?.activity_type || "").toLowerCase() === "quiz";
const formatDateTime = (value) => {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not scheduled" : parsed.toLocaleString();
};

const formatPoints = (value) =>
  value === null || value === undefined || value === "" ? "Ungraded" : `${value} pts`;

const getSubmissionSummary = (submissions = []) => {
  const rows = Array.isArray(submissions) ? submissions : [];
  return {
    total: rows.length,
    graded: rows.filter((item) => item?.grade !== null && item?.grade !== undefined).length,
    late: rows.filter((item) => Boolean(item?.is_late)).length,
  };
};

const parseStructuredTextAnswer = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
};

const actionButtonClass =
  "inline-flex min-w-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-50";
const solidActionButtonClass =
  "inline-flex min-w-0 items-center justify-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700";
const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const pdfExtensions = new Set(["pdf"]);
const officeExtensions = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const urlPattern = /\bhttps?:\/\/[^\s<>()]+/gi;
const unsafeTrailingCharacters = /[),.;!?]+$/;

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
    if (url.hostname.includes("youtu.be")) return url.pathname.replace(/^\/+/, "").split("/")[0] || "";
    if (url.pathname.includes("/embed/")) return url.pathname.split("/embed/")[1]?.split(/[?/]/)[0] || "";
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
  };
};

const buildAttachmentMeta = (value, fallbackName = "Attachment", sourceLabel = "Attachment") => {
  if (!value) return null;
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
    sourceLabel,
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
  const openUrl = item.openUrl || item.url || item.downloadUrl || "";
  const downloadUrl = item.downloadUrl || item.url || "";
  const officePreviewUrl = item.isOffice ? getOfficeViewerUrl(item.url) : "";
  const canPreviewImage = item.isImage && item.url;
  const canPreviewPdf = item.isPdf && item.url;
  const canPreviewOffice = item.isOffice && officePreviewUrl;
  const canPreviewYoutube = item.provider === "youtube" && item.previewUrl;
  const previewUnavailableMessage = isFile
    ? "Preview is not available for this file. Please download it instead."
    : "Preview is not available for this link. Please open it in a new tab.";

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
    <article className="overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 p-4 2xl:flex-row 2xl:items-start">
        <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(248,250,252,1))] 2xl:h-24 2xl:w-28">
          {attachment.isImage && attachment.url ? (
            <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
          ) : (
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {badgeText}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
                {attachment.name}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {humanizeFileType(attachment)}{attachment.size ? ` | ${formatFileSize(attachment.size)}` : ""}
              </p>
            </div>
            <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {attachment.sourceLabel}
            </span>
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
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

function AttachmentSection({ title, items, onPreview, onCopy, emptyText = "No files available." }) {
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</h3>
      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <AttachmentCard key={item.id || item.url || item.name} attachment={item} onPreview={onPreview} onCopy={onCopy} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-4 text-sm text-gray-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function LinkCard({ item, onPreview, onCopy, copiedKey }) {
  if (!item) return null;
  return (
    <article className="overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-sm">
      {item.provider === "youtube" && item.previewUrl ? (
        <div className="aspect-video overflow-hidden border-b border-emerald-100 bg-slate-950">
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
          </div>
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

function LinkSection({ title, items, onPreview, onCopy, copiedKey }) {
  if (!items.length) return null;
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <LinkCard key={item.id} item={item} onPreview={onPreview} onCopy={onCopy} copiedKey={copiedKey} />
        ))}
      </div>
    </section>
  );
}

export default function ActivityDetailsModal({
  activity,
  onClose,
  onEdit,
  onDelete,
  onGrade,
  mode = "modal",
}) {
  const [activeTab, setActiveTab] = useState("instructions");
  const [showMenu, setShowMenu] = useState(false);
  const [gradingTargetId, setGradingTargetId] = useState(null);
  const [gradeInput, setGradeInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const isPageMode = mode === "page";

  useEffect(() => {
    if (isPageMode) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPageMode, onClose]);

  const mappedComponent = mapActivityToComponent(activity?.activity_type_name || activity?.activity_type);
  const submissionSummary = getSubmissionSummary(activity?.submissions);

  const instructorAttachments = useMemo(() => {
    const rawItems = Array.isArray(activity?.attachments) && activity.attachments.length > 0
      ? activity.attachments
      : activity?.file
      ? [{ id: activity.id || "activity-file", file: activity.file, file_url: activity.file, name: extractFileName(activity.file, "Instructor file") }]
      : [];
    const seen = new Set();
    return rawItems
      .map((item, index) => buildAttachmentMeta(item, `Attachment ${index + 1}`, index === 0 ? "Main instructor file" : "Resource file"))
      .filter((item) => item?.url && !seen.has(item.url) && seen.add(item.url));
  }, [activity]);
  const mainInstructorAttachment = instructorAttachments[0] || null;
  const extraAttachments = instructorAttachments.slice(1);
  const overviewLinks = useMemo(() => {
    const textLinks = extractLinksFromText(activity?.description || "");
    const fieldLinks = [activity?.link].filter(Boolean).map(cleanExtractedUrl);
    const seen = new Set();
    return [...textLinks, ...fieldLinks]
      .filter((item) => isSafeExternalUrl(item) && !seen.has(item) && seen.add(item))
      .map(buildLinkMeta)
      .filter(Boolean);
  }, [activity]);
  if (!activity) return null;

  const summaryCards = [
      {
        label: "Activity Type",
        value: activity.activity_type_name || activity.activity_type || "Classwork",
        icon: LuClipboardList,
      },
      {
        label: "Points",
        value: formatPoints(activity.points),
        icon: LuBadgeCheck,
      },
      {
        label: "Due",
        value: formatDateTime(activity.due_date),
        icon: LuCalendarClock,
      },
      {
        label: "Submissions",
        value: `${submissionSummary.total} total`,
        subtext: `${submissionSummary.graded} graded${submissionSummary.late ? ` - ${submissionSummary.late} late` : ""}`,
        icon: LuUsers,
      },
    ];

  const startGrading = (submission) => {
    setGradingTargetId(submission.id);
    setGradeInput(
      submission?.grade === null || submission?.grade === undefined ? "" : String(submission.grade)
    );
    setFeedbackInput(submission?.feedback || "");
    setGradeError("");
  };

  const cancelGrading = () => {
    setGradingTargetId(null);
    setGradeInput("");
    setFeedbackInput("");
    setGradeError("");
  };

  const submitGrade = async (submission) => {
    if (!onGrade) return;
    const trimmed = String(gradeInput || "").trim();
    let nextGrade = null;
    if (trimmed !== "") {
      nextGrade = Number(trimmed);
      if (Number.isNaN(nextGrade)) {
        setGradeError("Grade must be numeric.");
        return;
      }
    }

    setSavingGrade(true);
    setGradeError("");
    try {
      await onGrade(submission, activity.id, {
        grade: nextGrade,
        feedback: String(feedbackInput || ""),
      });
      cancelGrading();
    } catch (_error) {
      setGradeError("Failed to save grade.");
    } finally {
      setSavingGrade(false);
    }
  };

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

  return (
    <>
    <div
      className={
        isPageMode
          ? "min-h-screen bg-[linear-gradient(180deg,_#f8fcfa_0%,_#ffffff_24%,_#f7fbf9_100%)] px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      }
      onClick={isPageMode ? undefined : onClose}
      role={isPageMode ? undefined : "presentation"}
    >
      <div
        className={
          isPageMode
            ? "mx-auto flex w-full max-w-full flex-col overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(16,24,40,0.08)] sm:max-w-6xl sm:rounded-[32px]"
            : "flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-3xl"
        }
        onClick={isPageMode ? undefined : (e) => e.stopPropagation()}
        role={isPageMode ? "region" : "dialog"}
        aria-modal={isPageMode ? undefined : "true"}
        aria-label={activity.title || "Classwork details"}
      >
        <div className="sticky top-0 z-10 border-b border-emerald-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="rounded-[22px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_38%),linear-gradient(135deg,_#fcfffd_0%,_#f2fbf6_48%,_#eefcf5_100%)] p-4 sm:rounded-[24px] sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  {mappedComponent}
                </span>
                {isQuizType(activity) ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {String(activity.assessment_type || "quiz")}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">
                {activity.title}
              </h2>
              <p className="mt-2 max-w-full break-words text-sm leading-6 text-emerald-900/75 sm:max-w-3xl sm:text-base">
                {activity.description || "Review the instructions, attached materials, and student submissions from one cleaner workspace."}
              </p>
            </div>

            <div className="relative flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
              {onEdit && onDelete && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50 sm:w-auto"
                    aria-label="Open activity menu"
                  >
                    Manage
                  </button>

                  {showMenu && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 w-full min-w-[12rem] rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-xl sm:left-auto sm:right-0 sm:w-40">
                      <button
                        onClick={() => {
                          onEdit(activity);
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-all duration-200 hover:bg-emerald-50"
                      >
                        <LuPencil className="h-4 w-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => {
                          onDelete(activity.id);
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition-all duration-200 hover:bg-red-50"
                      >
                        <LuTrash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 sm:w-auto"
                aria-label={isPageMode ? "Back to classwork" : "Close modal"}
              >
                {isPageMode ? "Back to Classwork" : "Close"}
              </button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.label}
                  className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_10px_28px_rgba(16,24,40,0.06)] backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{card.label}</p>
                    <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-emerald-950">{card.value}</p>
                  {card.subtext ? <p className="mt-1 text-xs text-gray-500">{card.subtext}</p> : null}
                </article>
              );
            })}
          </div>
          </div>
        </div>

        <div className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/60 px-3 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveTab("instructions")}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "instructions"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              Overview & Instructions
            </button>

            {activity.submissions && (
              <button
                onClick={() => setActiveTab("studentWork")}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  activeTab === "studentWork"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                Student Work
              </button>
            )}
          </div>
        </div>

        <div className={isPageMode ? "w-full max-w-full overflow-hidden bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fcfa_100%)] px-3 py-4 sm:px-6 sm:py-5" : "max-h-[70vh] overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"}>
          {activeTab === "instructions" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
              <div className="min-w-0 space-y-4 sm:space-y-5">
                <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <LuBookOpen className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Description
                    </h3>
                  </div>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-800 sm:text-base">
                    {renderInlineLinkedText(activity.description || "No additional instructions were provided for this activity.")}
                  </p>
                </section>

                {isQuizType(activity) && (
                  <section className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,_#f8fdff_0%,_#eef8ff_100%)] p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                      Assessment Settings
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white bg-white/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Duration</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {Math.round(Number(activity.quiz_time_limit_seconds || 0) / 60)} mins
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Attempts</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{activity.max_attempts || 1}</p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Shuffle</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {activity.randomize_questions ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Availability</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(activity.availability_start)}</p>
                        <p className="mt-1 text-xs text-gray-500">Ends {formatDateTime(activity.availability_end)}</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Quick Details
                  </h3>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-emerald-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Grade Component</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-950">{mappedComponent}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Submission Snapshot</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-950">
                        {submissionSummary.total} total - {submissionSummary.graded} graded - {submissionSummary.late} late
                      </p>
                    </div>
                  </div>
                </section>

              {mainInstructorAttachment ? (
                <AttachmentSection
                  title="Main Instructor File"
                  items={[mainInstructorAttachment]}
                  onPreview={(item) => setPreviewItem({ ...item, kind: "file", openUrl: item.url })}
                  onCopy={handleCopy}
                />
              ) : null}

              {extraAttachments.length > 0 ? (
                <AttachmentSection
                  title="Attachments"
                  items={extraAttachments}
                  onPreview={(item) => setPreviewItem({ ...item, kind: "file", openUrl: item.url })}
                  onCopy={handleCopy}
                />
              ) : null}

              <LinkSection
                title="Resource Links"
                items={overviewLinks}
                onPreview={(item) => setPreviewItem({ ...item, kind: "link", openUrl: item.url })}
                onCopy={handleCopy}
                copiedKey={copiedKey}
              />
              </div>
            </div>
          )}

          {activeTab === "studentWork" && (
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Total Submissions</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{submissionSummary.total}</p>
                </article>
                <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Graded</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{submissionSummary.graded}</p>
                </article>
                <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Late</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{submissionSummary.late}</p>
                </article>
              </section>

              {!activity.submissions || activity.submissions.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
                  No submissions yet.
                </p>
              ) : (
                <div className="space-y-4">
                {activity.submissions.map((sub) => {
                  const submittedFiles = (Array.isArray(sub.attachments) ? sub.attachments : [])
                    .map((attachment, index) => buildAttachmentMeta(attachment, `File ${index + 1}`, "Submitted file"))
                    .filter(Boolean);
                  const studentLinks = extractLinksFromText(sub.text_answer || "")
                    .map(buildLinkMeta)
                    .filter(Boolean);

                  return (
                    <article
                      key={sub.id}
                      className={`overflow-hidden rounded-3xl border shadow-sm ${
                        sub.is_late
                          ? "border-rose-200 bg-[linear-gradient(135deg,_#fffaf9_0%,_#fff1ee_100%)]"
                          : "border-emerald-100 bg-white"
                      }`}
                    >
                    <div className="border-b border-black/5 px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-gray-900">{sub.student_username}</p>
                            {sub.grade !== null && sub.grade !== undefined && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Graded
                              </span>
                            )}
                            {sub.is_late && (
                              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                Late
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            Submitted {formatDateTime(sub.submitted_at)}
                          </p>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[290px]">
                          <div className="rounded-2xl bg-emerald-50/70 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Score</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-950">
                              {sub.grade !== null && sub.grade !== undefined ? `${sub.grade} pts` : "Not graded"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-emerald-50/70 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Feedback</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-950">
                              {sub.feedback ? "Available" : "No feedback yet"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.95fr)]">
                      <div className="min-w-0 space-y-4">
                        {sub.feedback ? (
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Instructor Feedback
                            </p>
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-800">{sub.feedback}</p>
                          </div>
                        ) : null}

                        {sub.text_answer && (
                          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Student Answer
                          </p>
                          {parseStructuredTextAnswer(sub.text_answer)?.answers ? (
                            <p className="mt-2 text-sm text-gray-700">
                              Structured response submitted. Open the submission review workflow if you need the raw payload.
                            </p>
                          ) : (
                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-800">
                              {renderInlineLinkedText(sub.text_answer)}
                            </p>
                          )}
                          </div>
                        )}

                        {studentLinks.length > 0 ? (
                          <LinkSection
                            title="Links In Response"
                            items={studentLinks}
                            onPreview={(item) => setPreviewItem({ ...item, kind: "link", openUrl: item.url })}
                            onCopy={handleCopy}
                            copiedKey={copiedKey}
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 space-y-4">
                      {sub.link ? (
                        <LinkSection
                          title="Student Link"
                          items={[buildLinkMeta(sub.link)].filter(Boolean)}
                          onPreview={(item) => setPreviewItem({ ...item, kind: "link", openUrl: item.url })}
                          onCopy={handleCopy}
                          copiedKey={copiedKey}
                        />
                      ) : null}

                      {submittedFiles.length > 0 ? (
                        <AttachmentSection
                          title="Submitted Files"
                          items={submittedFiles}
                          onPreview={(item) => setPreviewItem({ ...item, kind: "file", openUrl: item.url })}
                          onCopy={handleCopy}
                        />
                      ) : null}
                    </div>
                    </div>

                    {onGrade && (
                      <div className="border-t border-black/5 px-5 py-4">
                        {gradingTargetId !== sub.id ? (
                          <button
                            type="button"
                            onClick={() => startGrading(sub)}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-100"
                          >
                            View & Grade
                          </button>
                        ) : (
                          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                            <p className="text-sm font-semibold text-emerald-900">Grade Submission</p>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span>Score</span>
                                <input
                                  type="number"
                                  value={gradeInput}
                                  onChange={(event) => setGradeInput(event.target.value)}
                                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="e.g. 95"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                                <span>Feedback</span>
                                <textarea
                                  value={feedbackInput}
                                  onChange={(event) => setFeedbackInput(event.target.value)}
                                  rows={3}
                                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="Optional feedback"
                                />
                              </label>
                            </div>
                            {gradeError && <p className="text-sm text-red-600">{gradeError}</p>}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => submitGrade(sub)}
                                disabled={savingGrade}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                              >
                                {savingGrade ? "Saving..." : "Save Grade"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelGrading}
                                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
                })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onCopy={handleCopy} copiedKey={copiedKey} />
    </>
  );
}

