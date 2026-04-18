import React, { useEffect, useMemo, useState } from "react";
import StudentQuizPlayer from "../../components/student/StudentQuizPlayer";
import QuizAttemptView from "../../components/student/QuizAttemptView";
import QuizResults from "../../components/student/QuizResults";

const attendanceStatusClasses = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-orange-100 text-orange-700",
  excused: "bg-blue-100 text-blue-700",
};

const formatDateTime = (value, fallback = "No date") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString();
};

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
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const grade = submission?.grade ?? null;
  const points = Number(activity?.points || 0);
  const percentage = grade !== null && points > 0 ? ((Number(grade) / points) * 100).toFixed(1) : null;
  const isGraded = grade !== null;

  const mainFileUrl = activity?.file || activity?.attachments?.[0]?.file || null;
  const mainFileName = mainFileUrl
    ? decodeURIComponent(String(mainFileUrl).split("/").pop().split("?")[0])
    : "";

  const extraAttachments = (activity?.attachments || []).filter(
    (item) => item?.file && item.file !== mainFileUrl
  );

  const submissionStatus = (() => {
    if (submission?.grade !== null && submission?.grade !== undefined) return "Graded";
    if (submission) return "Submitted";
    if (activityData.text_answer?.trim() || activityData.files.length > 0) return "In Progress";
    return "Not Started";
  })();

  const statusClass =
    submissionStatus === "Graded"
      ? "bg-blue-100 text-blue-700"
      : submissionStatus === "Submitted"
      ? "bg-emerald-100 text-emerald-700"
      : submissionStatus === "In Progress"
      ? "bg-orange-100 text-orange-700"
      : "bg-gray-100 text-gray-700";

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

  const canUnsubmit = Boolean(submission && !isGraded && typeof onUnsubmit === "function");

  const handleTaskSubmission = async () => {
    if (typeof onSubmitTask !== "function") return;
    if (!window.confirm("Submit this classwork now?")) return;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={activity?.title || "Classwork details"}
      >
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl">{activity?.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                <span className={`rounded-full px-2.5 py-1 ${statusClass}`}>Status: {submissionStatus}</span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{activity?.activity_type_name || activity?.activity_type || "Classwork"}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{points} pts</span>
                {activity?.topic && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">Topic: {activity.topic}</span>}
                {activity?.due_date && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">Due: {formatDateTime(activity.due_date)}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close modal"
            >
              Close
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-gray-50/70 px-2 sm:px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveTab("instructions")}
              className={`px-4 py-3 text-sm font-medium transition ${activeTab === "instructions" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-gray-600 hover:bg-white"}`}
            >
              Instructions
            </button>
            {isTaskType && (
              <button
                type="button"
                onClick={() => setActiveTab("your_work")}
                className={`px-4 py-3 text-sm font-medium transition ${activeTab === "your_work" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-gray-600 hover:bg-white"}`}
              >
                Your Work
              </button>
            )}
            {isAttendance && (
              <button
                type="button"
                onClick={() => setActiveTab("attendance")}
                className={`px-4 py-3 text-sm font-medium transition ${activeTab === "attendance" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-gray-600 hover:bg-white"}`}
              >
                Attendance
              </button>
            )}
            {isQuiz && (
              <button
                type="button"
                onClick={() => setActiveTab("quiz")}
                className={`px-4 py-3 text-sm font-medium transition ${activeTab === "quiz" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-gray-600 hover:bg-white"}`}
              >
                Quiz
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {activeTab === "instructions" && (
            <div className="space-y-4">
              {activity?.description && (
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Instructions</h4>
                  <p className="whitespace-pre-line text-sm text-gray-700 sm:text-base">{activity.description}</p>
                </section>
              )}

              {mainFileUrl && (
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Instructor File</p>
                  <a href={mainFileUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700">
                    {mainFileName || "Open Instructor File"}
                  </a>
                </section>
              )}

              {extraAttachments.length > 0 && (
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Attachments</p>
                  <div className="space-y-2">
                    {extraAttachments.map((file, index) => (
                      <a key={file.id || index} href={file.file} target="_blank" rel="noreferrer" className="block text-sm font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700">
                        {file.name || `Attachment ${index + 1}`}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "your_work" && isTaskType && (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              {submission ? (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  {submission?.text_answer && <p className="whitespace-pre-line text-sm text-gray-700">{submission.text_answer}</p>}

                  {submission?.attachments?.length > 0 && (
                    <div className="space-y-2">
                      {submission.attachments.map((file, index) => (
                        <a key={index} href={file.file} target="_blank" rel="noreferrer" className="block text-sm font-medium text-blue-600 underline decoration-blue-300 underline-offset-2">
                          View File {index + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                    <p>Submitted: {formatDateTime(submission?.submitted_at, "Not available")}</p>
                    <p>Score: {isGraded ? `${grade} / ${points}` : "Not graded yet"}</p>
                    {percentage && <p>{percentage}%</p>}
                    {submission?.feedback && <p>Feedback: {submission.feedback}</p>}
                  </div>

                  {canUnsubmit && (
                    <button
                      type="button"
                      onClick={() => onUnsubmit(submission.id)}
                      className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-red-600 sm:w-auto"
                    >
                      Unsubmit
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="student-answer" className="mb-1 block text-sm font-medium text-gray-700">Your answer</label>
                    <textarea
                      id="student-answer"
                      placeholder="Write your answer"
                      className="min-h-[120px] w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={activityData.text_answer}
                      onChange={(event) => setActivityData((prev) => ({ ...prev, text_answer: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label htmlFor="student-files" className="mb-1 block text-sm font-medium text-gray-700">Upload files</label>
                    <input
                      id="student-files"
                      type="file"
                      multiple
                      onChange={(event) => setActivityData((prev) => ({ ...prev, files: Array.from(event.target.files || []) }))}
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-emerald-700"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTaskSubmission}
                    disabled={taskSubmitting || typeof onSubmitTask !== "function"}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                  >
                    {taskSubmitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === "attendance" && isAttendance && (
            <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              {relatedAttendanceSessions.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onMarkAttendance?.(activity?.id)}
                  disabled={typeof onMarkAttendance !== "function"}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                >
                  Mark Present
                </button>
              ) : (
                relatedAttendanceSessions.map((session) => {
                  const myRecord = session?.my_record || null;
                  const toneClass = attendanceStatusClasses[myRecord?.status] || "bg-gray-100 text-gray-700";

                  return (
                    <article key={session.id} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{session.topic}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(session.date, "No date")}</p>
                        </div>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
                          {myRecord?.status ? String(myRecord.status).toUpperCase() : "NOT MARKED"}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700">Points Earned: {myRecord?.points_earned ?? 0}</p>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => onMarkAttendanceSession?.(activity?.id, session.id, "present")}
                          disabled={typeof onMarkAttendanceSession !== "function"}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkAttendanceSession?.(activity?.id, session.id, "late")}
                          disabled={typeof onMarkAttendanceSession !== "function"}
                          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-orange-600 disabled:opacity-60"
                        >
                          Late
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          )}

          {activeTab === "quiz" && isQuiz && (
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
          )}
        </div>
      </div>
    </div>
  );
}
