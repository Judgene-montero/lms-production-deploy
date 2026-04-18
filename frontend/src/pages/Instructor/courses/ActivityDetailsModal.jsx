import React, { useEffect, useState } from "react";
import {
  LuBadgeCheck,
  LuBookOpen,
  LuCalendarClock,
  LuClipboardList,
  LuExternalLink,
  LuFileText,
  LuFolderOpen,
  LuPencil,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";

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

  const isPageMode = mode === "page";

  useEffect(() => {
    if (isPageMode) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPageMode, onClose]);

  if (!activity) return null;
  const mappedComponent = mapActivityToComponent(activity.activity_type_name || activity.activity_type);
  const submissionSummary = getSubmissionSummary(activity.submissions);

  const mainFileUrl = activity.file || activity.attachments?.[0]?.file || null;
  const mainFileName = mainFileUrl
    ? decodeURIComponent(mainFileUrl.split("/").pop().split("?")[0])
    : "";
  const extraAttachments = (activity.attachments || []).filter(
    (item) => item?.file && item.file !== mainFileUrl
  );
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

  return (
    <div
      className={
        isPageMode
          ? "min-h-screen bg-[linear-gradient(180deg,_#f8fcfa_0%,_#ffffff_24%,_#f7fbf9_100%)] px-3 py-4 sm:px-5 md:px-6 md:py-6"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      }
      onClick={isPageMode ? undefined : onClose}
      role={isPageMode ? undefined : "presentation"}
    >
      <div
        className={
          isPageMode
            ? "mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(16,24,40,0.08)] sm:rounded-[32px]"
            : "flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-3xl"
        }
        onClick={isPageMode ? undefined : (e) => e.stopPropagation()}
        role={isPageMode ? "region" : "dialog"}
        aria-modal={isPageMode ? undefined : "true"}
        aria-label={activity.title || "Classwork details"}
      >
        <div className="sticky top-0 z-10 border-b border-emerald-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="rounded-[24px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_38%),linear-gradient(135deg,_#fcfffd_0%,_#f2fbf6_48%,_#eefcf5_100%)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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
              <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">
                {activity.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900/75 sm:text-base">
                {activity.description || "Review the instructions, attached materials, and student submissions from one cleaner workspace."}
              </p>
            </div>

            <div className="relative flex items-center gap-2">
              {onEdit && onDelete && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50"
                    aria-label="Open activity menu"
                  >
                    Manage
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-xl">
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
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700"
                aria-label={isPageMode ? "Back to classwork" : "Close modal"}
              >
                {isPageMode ? "Back to Classwork" : "Close"}
              </button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("instructions")}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
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
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
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

        <div className={isPageMode ? "bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fcfa_100%)] px-4 py-5 sm:px-6" : "max-h-[70vh] overflow-y-auto px-4 py-5 sm:px-6"}>
          {activeTab === "instructions" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
              <div className="space-y-5">
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
                    {activity.description || "No additional instructions were provided for this activity."}
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

              <div className="space-y-5">
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

              {mainFileUrl && (
                <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <LuFileText className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Main Instructor File
                    </h3>
                  </div>
                  <a
                    href={mainFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm font-medium text-emerald-800 transition-all duration-200 hover:bg-emerald-100/70"
                  >
                    <span className="break-all">{mainFileName}</span>
                    <LuExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                </section>
              )}

              {extraAttachments.length > 0 && (
                <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <LuFolderOpen className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Attachments
                    </h3>
                  </div>
                  <div className="mt-4 space-y-2">
                    {extraAttachments.map((file, i) => (
                      <a
                        key={file.id || i}
                        href={file.file}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-emerald-50"
                      >
                        <span>{file.name || `Attachment ${i + 1}`}</span>
                        <LuExternalLink className="h-4 w-4 shrink-0 text-emerald-700" />
                      </a>
                    ))}
                  </div>
                </section>
              )}
              </div>
            </div>
          )}

          {activeTab === "studentWork" && (
            <div className="space-y-5">
              <section className="grid gap-3 md:grid-cols-3">
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
                {activity.submissions.map((sub) => (
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

                    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)]">
                      <div className="space-y-4">
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
                              {sub.text_answer}
                            </p>
                          )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                      {sub.link && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Student Link
                          </p>
                          <a
                            href={sub.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
                          >
                            <span className="break-all">{sub.link}</span>
                            <LuExternalLink className="h-4 w-4 shrink-0" />
                          </a>
                        </div>
                      )}

                      {Array.isArray(sub.attachments) && sub.attachments.length > 0 && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Submitted Files
                          </p>
                          <div className="mt-3 space-y-2">
                            {sub.attachments.map((attachment, index) => (
                              <a
                                key={attachment.id || index}
                                href={attachment.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-emerald-50"
                              >
                                <span className="break-all">
                                  {attachment.file ? decodeURIComponent(String(attachment.file).split("/").pop().split("?")[0]) : `File ${index + 1}`}
                                </span>
                                <LuExternalLink className="h-4 w-4 shrink-0 text-emerald-700" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
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
                ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

