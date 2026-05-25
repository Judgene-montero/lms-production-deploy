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
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  const wordCount = useMemo(() => {
    const text = String(activityData.text_answer || "").trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [activityData.text_answer]);

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

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Submitted Files
              </p>
              {submission?.attachments?.length > 0 ? (
                <div className="space-y-2">
                  {submission.attachments.map((file, index) => (
                    <a
                      key={file.id || file.file || index}
                      href={resolveAssetUrl(file.file)}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-words rounded-2xl border border-slate-200 px-3 py-3 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      {file.name || extractFileName(file.file, `File ${index + 1}`)}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No files were attached.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Feedback
              </p>
              <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                {submission?.feedback || "No feedback yet."}
              </p>
            </div>
          </div>

          {comments.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Comments
              </p>
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
            </div>
          ) : null}

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
          <p className="mt-3 text-sm font-medium text-slate-700">
            Drag and drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Selected files stay here until you submit or remove them.
          </p>
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
                  <p className="break-words text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {file.type || "Unknown type"} | {(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 2 : 1)} MB
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
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const grade = submission?.grade ?? null;
  const points = Number(activity?.points || 0);
  const percentage = grade !== null && points > 0 ? ((Number(grade) / points) * 100).toFixed(1) : null;
  const isGraded = grade !== null;

  const mainFileUrl = activity?.file || activity?.attachments?.[0]?.file || null;
  const mainFileName = extractFileName(mainFileUrl, "Instructor file");
  const extraAttachments = (activity?.attachments || []).filter((item) => item?.file && item.file !== mainFileUrl);
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

  const canUnsubmit = Boolean(submission && !isGraded && typeof onUnsubmit === "function");

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
              <h3 className="mt-2 break-words text-xl font-semibold text-slate-900 sm:text-2xl">
                {activity?.title}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`${chipClassName} ${statusClass}`}>Status: {submissionStatus}</span>
                <span className={`${chipClassName} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                  {activityTypeLabel}
                </span>
                <span className={`${chipClassName} border-slate-200 bg-white text-slate-600`}>
                  {points} points
                </span>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Instructions
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        Read first
                      </span>
                    </div>
                    {instructionsContent ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700 sm:text-[15px]">
                          {instructionsContent}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No written instructions were provided for this classwork.
                      </div>
                    )}
                  </section>

                  {mainFileUrl ? (
                    <section className={sectionCardClass}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Resources
                      </p>
                      <a
                        href={resolveAssetUrl(mainFileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all rounded-2xl border border-slate-200 px-3 py-3 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        {mainFileName}
                      </a>
                    </section>
                  ) : null}

                  {extraAttachments.length > 0 ? (
                    <section className={sectionCardClass}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Attachments
                      </p>
                      <div className="space-y-2">
                        {extraAttachments.map((file, index) => (
                          <a
                            key={file.id || index}
                            href={resolveAssetUrl(file.file)}
                            target="_blank"
                            rel="noreferrer"
                            className="block break-words rounded-2xl border border-slate-200 px-3 py-3 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            {file.name || extractFileName(file.file, `Attachment ${index + 1}`)}
                          </a>
                        ))}
                      </div>
                    </section>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                        Your Work
                      </p>
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
  );
}
