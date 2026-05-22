import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentQuizPlayer from "../../components/student/StudentQuizPlayer";

export default function StudentExamTakePage() {
  const navigate = useNavigate();
  const { courseId, activityId } = useParams();
  const [submissionResult, setSubmissionResult] = useState(null);

  const activity = useMemo(
    () => ({ id: Number(activityId), quiz_time_limit_seconds: 600, max_attempts: 1 }),
    [activityId]
  );

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-emerald-950">Exam Attempt</h1>
            <button
              type="button"
              onClick={() => navigate(`/student/dashboard/my-courses/${courseId}`, { state: { activeTab: "exams_quizzes" } })}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back To Course
            </button>
          </div>
          {submissionResult ? (
            <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {submissionResult.pending_manual_review ? (
                <p>Your exam was submitted successfully and is waiting for instructor review.</p>
              ) : submissionResult.show_score_immediately ? (
                <p>
                  Score: {Number(submissionResult.score || 0)} / {Number(submissionResult.total_points || 0)}
                </p>
              ) : (
                <p>Your exam has been submitted. Results will be released by your instructor.</p>
              )}

              {submissionResult.allow_answer_review ? (
                <button
                  type="button"
                  onClick={() => navigate(`/student/dashboard/my-courses/${courseId}/exam/${activityId}/review?attempt_id=${submissionResult.attempt_id}`)}
                  className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Review Exam
                </button>
              ) : null}

              {!submissionResult.allow_answer_review && submissionResult.show_score_immediately ? (
                <p>Detailed review is not available.</p>
              ) : null}
            </div>
          ) : null}
        </header>

        <StudentQuizPlayer
          courseId={courseId}
          activity={activity}
          onSubmitted={(result) => {
            setSubmissionResult(result || null);
          }}
          onReviewAttempt={(attempt) => {
            if (!attempt?.id) return;
            navigate(`/student/dashboard/my-courses/${courseId}/exam/${activityId}/review?attempt_id=${attempt.id}`);
          }}
        />
      </div>
    </div>
  );
}
