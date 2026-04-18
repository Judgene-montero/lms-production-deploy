import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authGet } from "../../utils/api";

export default function ExamReviewPage() {
  const navigate = useNavigate();
  const { courseId, activityId } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);

  useEffect(() => {
    const loadReview = async () => {
      setLoading(true);
      setError("");
      try {
        const attemptId = searchParams.get("attempt_id");
        const query = attemptId ? `?attempt_id=${attemptId}` : "";
        const data = await authGet(`/api/courses/${courseId}/activities/${activityId}/quiz/review/${query}`);
        setReview(data || null);
      } catch (requestError) {
        console.error(requestError);
        setError(requestError?.message || "Failed to load exam review.");
      } finally {
        setLoading(false);
      }
    };
    loadReview();
  }, [activityId, courseId, searchParams]);

  if (loading) {
    return <p className="p-4 text-sm text-emerald-700">Loading exam review...</p>;
  }

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-emerald-950">Exam Review</h1>
            <button
              type="button"
              onClick={() => navigate(`/student/dashboard/my-courses/${courseId}/exam/${activityId}`)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back To Exam
            </button>
          </div>
          {review ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Score: {Number(review.score || 0)} / {Number(review.total_points || 0)} ({Number(review.percentage || 0)}%)
            </p>
          ) : null}
        </header>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <section className="space-y-3">
          {(Array.isArray(review?.questions) ? review.questions : []).map((item, index) => (
            <article key={`${item.question_id || index}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Question {index + 1}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.is_correct ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {item.is_correct ? "Correct" : "Incorrect"}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-800">{item.question}</p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">Points:</span> {Number(item.points || 0)} / {Number(item.max_points || 0)}
              </p>
              {item.question_type === "enumeration" ? (
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div>
                    <p className="font-semibold">Your Responses:</p>
                    <ul className="mt-1 space-y-1">
                      {(Array.isArray(item.student_answer_items) ? item.student_answer_items : []).length ? (
                        item.student_answer_items.map((value, responseIndex) => (
                          <li key={`${item.question_id}-submitted-${responseIndex}`} className="rounded border border-gray-200 px-2 py-1">
                            {value}
                          </li>
                        ))
                      ) : (
                        <li className="rounded border border-dashed border-gray-200 px-2 py-1 text-gray-500">No answer</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Expected Answers:</p>
                    <ul className="mt-1 space-y-1">
                      {(Array.isArray(item.correct_answer_items) ? item.correct_answer_items : []).map((value, answerIndex) => (
                        <li key={`${item.question_id}-expected-${answerIndex}`} className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1">
                          {value}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(Array.isArray(item.answer_feedback) ? item.answer_feedback : []).length ? (
                    <div>
                      <p className="font-semibold">Answer Check:</p>
                      <ul className="mt-1 space-y-1">
                        {item.answer_feedback.map((feedback, feedbackIndex) => (
                          <li
                            key={`${item.question_id}-feedback-${feedbackIndex}`}
                            className={`rounded px-2 py-1 ${
                              feedback.is_correct ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-red-200 bg-red-50 text-red-800"
                            }`}
                          >
                            {feedback.submitted ? `Submitted: ${feedback.submitted}` : "Missing response"} {feedback.is_correct ? "✓" : "✗"}
                            {!feedback.is_correct && feedback.expected ? ` | Expected: ${feedback.expected}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold">Your Answer:</span> {item.student_answer || "No answer"}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    <span className="font-semibold">Correct Answer:</span> {item.correct_answer || "N/A"}
                  </p>
                </>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
