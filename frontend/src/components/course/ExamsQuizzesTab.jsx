import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ExamCard from "../classwork/ExamCard";
import SettingsModal from "../classwork/SettingsModal";
import { authDelete, authGet, authPatch } from "../../utils/api";

const statusTone = {
  graded: "bg-emerald-100 text-emerald-700",
  pending_review: "bg-amber-100 text-amber-700",
};

export default function ExamsQuizzesTab({ courseId, isInstructor }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewSummary, setReviewSummary] = useState([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [overrideTotalScore, setOverrideTotalScore] = useState("");
  const [questionEdits, setQuestionEdits] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authGet(`/api/courses/${courseId}/exam-quizzes/`);
      setItems(Array.isArray(data) ? data : []);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load exams and quizzes.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadAttemptDetail = useCallback(
    async (activityId, attemptId) => {
      try {
        const data = await authGet(`/api/courses/${courseId}/exam-quizzes/${activityId}/submissions/${attemptId}/`);
        setAttemptDetail(data || null);
        setSelectedAttemptId(attemptId);
        setOverrideTotalScore(data?.override_score ?? "");
        const nextEdits = {};
        (Array.isArray(data?.answers) ? data.answers : []).forEach((row) => {
          nextEdits[row.question_id] = {
            score:
              row.override_score !== null && row.override_score !== undefined
                ? row.override_score
                : row.manual_score !== null && row.manual_score !== undefined
                ? row.manual_score
                : row.auto_score !== null && row.auto_score !== undefined
                ? row.auto_score
                : "",
            feedback: row.feedback || "",
          };
        });
        setQuestionEdits(nextEdits);
      } catch (requestError) {
        console.error(requestError);
        setError(requestError?.message || "Failed to load submission details.");
      }
    },
    [courseId]
  );

  const openReviewModal = useCallback(
    async (activity) => {
      setReviewTarget(activity);
      setReviewSummary([]);
      setSelectedAttemptId(null);
      setAttemptDetail(null);
      setQuestionEdits({});
      setOverrideTotalScore("");
      setReviewNote("");
      try {
        const data = await authGet(`/api/courses/${courseId}/exam-quizzes/${activity.id}/submissions/`);
        const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
        setReviewSummary(attempts);
        if (attempts.length > 0) {
          await loadAttemptDetail(activity.id, attempts[0].attempt_id);
        }
      } catch (requestError) {
        console.error(requestError);
        setError(requestError?.message || "Failed to load submissions.");
      }
    },
    [courseId, loadAttemptDetail]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {isInstructor ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/create?assessment=quiz`)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Create Exam / Quiz
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-gray-500">No exams or quizzes found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((activity) => (
            <ExamCard
              key={activity.id}
              activity={activity}
              onEdit={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/${activity.id}/edit`)}
              onPreview={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/${activity.id}`)}
              onEditSettings={() => setSettingsTarget(activity)}
              onReviewSubmissions={() => openReviewModal(activity)}
              onTogglePublish={async () => {
                const nextState = String(activity.publish_state || "").toLowerCase() === "published" ? "draft" : "published";
                const confirmed = window.confirm(
                  nextState === "published" ? "Publish this exam now?" : "Move this published exam back to draft?"
                );
                if (!confirmed) return;
                try {
                  await authPatch(`/api/courses/${courseId}/exam-quizzes/${activity.id}/`, { publish_state: nextState });
                  await load();
                } catch (requestError) {
                  console.error(requestError);
                  setError(requestError?.message || "Failed to update publish state.");
                }
              }}
              onDelete={() => setDeleteTarget(activity)}
            />
          ))}
        </div>
      )}

      <SettingsModal
        open={Boolean(settingsTarget)}
        exam={settingsTarget}
        saving={savingSettings}
        onClose={() => setSettingsTarget(null)}
        onSave={async (payload) => {
          if (!settingsTarget?.id) return;
          setSavingSettings(true);
          try {
            await authPatch(`/api/courses/${courseId}/exam-quizzes/${settingsTarget.id}/settings/`, payload);
            setSettingsTarget(null);
            await load();
          } catch (requestError) {
            console.error(requestError);
            setError(requestError?.message || "Failed to save exam settings.");
          } finally {
            setSavingSettings(false);
          }
        }}
      />

      {reviewTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="grid h-full max-h-[90vh] w-full max-w-6xl gap-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Review Submissions</p>
                  <h3 className="text-base font-semibold text-emerald-950">{reviewTarget.title}</h3>
                </div>
                <button type="button" onClick={() => setReviewTarget(null)} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700">
                  Close
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {reviewSummary.length === 0 ? <p className="text-sm text-gray-500">No submissions yet.</p> : null}
                {reviewSummary.map((attempt) => (
                  <button
                    key={attempt.attempt_id}
                    type="button"
                    onClick={() => loadAttemptDetail(reviewTarget.id, attempt.attempt_id)}
                    className={`w-full rounded-xl border p-3 text-left shadow-sm ${
                      Number(selectedAttemptId) === Number(attempt.attempt_id)
                        ? "border-emerald-300 bg-white"
                        : "border-gray-200 bg-white/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{attempt.student_name}</p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[attempt.status] || statusTone.graded}`}>
                        {String(attempt.status || "graded").replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Score: {Number(attempt.display_score || 0)} / {Number(attempt.total_points || 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted"}
                    </p>
                    <span className="mt-2 inline-flex rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700">
                      Recheck
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
              {!attemptDetail ? (
                <p className="text-sm text-gray-500">Select a submission to review.</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-lg font-semibold text-emerald-950">{attemptDetail.student_name}</h4>
                        <p className="text-sm text-gray-700">
                          Current total: {Number(attemptDetail.display_score || 0)} / {Number(attemptDetail.total_points || 0)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[attemptDetail.status] || statusTone.graded}`}>
                        {String(attemptDetail.status || "graded").replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {(Array.isArray(attemptDetail.answers) ? attemptDetail.answers : []).map((row) => (
                    <article key={row.question_id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{row.question_text}</p>
                          <p className="text-xs uppercase text-gray-500">{row.question_type} | Max {Number(row.max_points || 0)} pts</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[row.status] || statusTone.graded}`}>
                          {String(row.status || "graded").replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="mt-3 rounded-lg border border-white bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Student Answer</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{row.student_answer || "No answer submitted."}</p>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-gray-700">
                          <span className="mb-1 block font-medium text-gray-900">Score</span>
                          <input
                            type="number"
                            min="0"
                            max={row.max_points}
                            step="0.01"
                            value={questionEdits[row.question_id]?.score ?? ""}
                            onChange={(event) =>
                              setQuestionEdits((prev) => ({
                                ...prev,
                                [row.question_id]: {
                                  ...prev[row.question_id],
                                  score: event.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-gray-700">
                          <span className="mb-1 block font-medium text-gray-900">Feedback</span>
                          <textarea
                            value={questionEdits[row.question_id]?.feedback ?? ""}
                            onChange={(event) =>
                              setQuestionEdits((prev) => ({
                                ...prev,
                                [row.question_id]: {
                                  ...prev[row.question_id],
                                  feedback: event.target.value,
                                },
                              }))
                            }
                            className="min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2"
                          />
                        </label>
                      </div>
                    </article>
                  ))}

                  <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 md:grid-cols-2">
                    <label className="text-sm text-gray-700">
                      <span className="mb-1 block font-medium text-gray-900">Override Total Score</span>
                      <input
                        type="number"
                        min="0"
                        max={attemptDetail.total_points || 0}
                        step="0.01"
                        value={overrideTotalScore}
                        onChange={(event) => setOverrideTotalScore(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      <span className="mb-1 block font-medium text-gray-900">Audit Note</span>
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        className="min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Reason for grading changes"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-gray-900">Recent Audit Log</p>
                    <div className="mt-2 space-y-2">
                      {(Array.isArray(attemptDetail.audit_log) ? attemptDetail.audit_log : []).length === 0 ? (
                        <p className="text-sm text-gray-500">No manual adjustments recorded yet.</p>
                      ) : (
                        attemptDetail.audit_log.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            <p>
                              {entry.actor_name || "Instructor"} changed {entry.question_id ? `question ${entry.question_id}` : "total score"} from{" "}
                              {entry.previous_score ?? "N/A"} to {entry.new_score ?? "N/A"}.
                            </p>
                            <p className="text-xs text-gray-500">{entry.note || "No note"} | {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewTarget(null)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={savingReview}
                      onClick={async () => {
                        if (!reviewTarget?.id || !selectedAttemptId) return;
                        setSavingReview(true);
                        try {
                          const payload = {
                            note: reviewNote,
                            override_total_score: overrideTotalScore,
                            answers: Object.entries(questionEdits).map(([questionId, value]) => ({
                              question_id: questionId,
                              score: value.score,
                              feedback: value.feedback,
                            })),
                          };
                          await authPatch(`/api/courses/${courseId}/exam-quizzes/${reviewTarget.id}/submissions/${selectedAttemptId}/`, payload);
                          const summary = await authGet(`/api/courses/${courseId}/exam-quizzes/${reviewTarget.id}/submissions/`);
                          const attempts = Array.isArray(summary?.attempts) ? summary.attempts : [];
                          setReviewSummary(attempts);
                          await loadAttemptDetail(reviewTarget.id, selectedAttemptId);
                          await load();
                        } catch (requestError) {
                          console.error(requestError);
                          setError(requestError?.message || "Failed to update submission review.");
                        } finally {
                          setSavingReview(false);
                        }
                      }}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingReview ? "Saving..." : "Save Review"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-emerald-950">Delete Exam</h3>
            <p className="mt-2 text-sm text-gray-700">Are you sure you want to delete this exam?</p>
            <p className="mt-2 text-sm text-red-700">This permanently removes attempts, scores, and review history.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTarget?.id || deleting) return;
                  setDeleting(true);
                  setError("");
                  try {
                    await authDelete(`/api/courses/${courseId}/exam-quizzes/${deleteTarget.id}/`);
                    setDeleteTarget(null);
                    await load();
                  } catch (requestError) {
                    console.error(requestError);
                    setError(requestError?.message || "Failed to delete exam.");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
