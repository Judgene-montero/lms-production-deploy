import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const flattenSections = (sections = []) =>
  (Array.isArray(sections) ? sections : []).flatMap((section) =>
    (section.questions || []).map((question, index) => ({
      ...question,
      section_title: section.title || "Section",
      view_index: `${section.id || ""}-${question.id || index}`,
    }))
  );

const getEnumerationSlotCount = (question) => {
  const explicitCount = Number(question?.expected_count || 0);
  if (explicitCount > 0) return explicitCount;
  const answerCount = Array.isArray(question?.enumeration_answers) ? question.enumeration_answers.length : 0;
  return Math.max(answerCount, 1);
};

const getPreviewAnswerItems = (question, rawAnswer) => {
  if (question?.type !== "enumeration") {
    return [String(rawAnswer || "")];
  }
  if (Array.isArray(rawAnswer)) {
    return rawAnswer.map((value) => String(value || ""));
  }
  if (typeof rawAnswer === "string" && rawAnswer.trim()) {
    return rawAnswer.split(/[,;\n]+/).map((value) => String(value || "").trim());
  }
  return Array.from({ length: getEnumerationSlotCount(question) }, () => "");
};

const hasPreviewAnswer = (question, rawAnswer) => {
  if (question?.type === "enumeration") {
    return getPreviewAnswerItems(question, rawAnswer).some((value) => String(value || "").trim());
  }
  return String(rawAnswer || "").trim().length > 0;
};

export default function PreviewExam() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const payload = JSON.parse(localStorage.getItem(`exam_preview_payload_${courseId}`) || "{}");
  const settings = payload.settings || {};
  const questions = flattenSections(payload.sections || []);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const active = questions[current];

  const answeredCount = useMemo(
    () => questions.filter((item) => hasPreviewAnswer(item, answers[item.view_index])).length,
    [answers, questions]
  );

  if (!questions.length) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">No preview data found. Open preview from the builder page.</p>
      </div>
    );
  }

  const canMoveNext = !settings.require_answer_to_advance || hasPreviewAnswer(active, answers[active.view_index]);
  const currentAnswer = active.type !== "enumeration" ? answers[active.view_index] || "" : "";
  const currentEnumerationAnswers = active.type === "enumeration" ? getPreviewAnswerItems(active, answers[active.view_index]) : [];
  const renderOptions =
    Array.isArray(active.options) && active.options.length
      ? active.options
      : active.type === "true_false"
      ? Array.isArray(active.choices) && active.choices.length
        ? active.choices.map((choice, index) => ({ id: index + 1, text: choice }))
        : [{ id: 1, text: "True" }, { id: 2, text: "False" }]
      : [];

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="sticky top-2 z-20 rounded-xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-emerald-950">Exam Preview</h1>
            <span className="text-sm text-gray-700">
              Answered {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-emerald-500" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">{active.section_title}</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Question {current + 1} of {questions.length}
          </h2>
          <p className="mt-4 text-base text-gray-800">{active.question_text}</p>

          {active.type === "multiple_choice" || active.type === "true_false" ? (
            <div className="mt-4 space-y-2">
              {renderOptions.map((option, index) => (
                <label key={`${active.view_index}-opt-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                  <input
                    type="radio"
                    name={`preview-${active.view_index}`}
                    checked={String(currentAnswer) === String(option.text)}
                    onChange={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [active.view_index]: option.text,
                      }))
                    }
                  />
                  {option.text}
                </label>
              ))}
            </div>
          ) : active.type === "enumeration" ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: getEnumerationSlotCount(active) }, (_, index) => {
                const value = String(currentEnumerationAnswers[index] || "");
                return (
                  <div key={`${active.view_index}-enum-${index}`} className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Item {index + 1}
                    </label>
                    <input
                      value={value}
                      onChange={(event) =>
                        setAnswers((prev) => {
                          const next = getPreviewAnswerItems(active, prev[active.view_index]);
                          while (next.length < getEnumerationSlotCount(active)) {
                            next.push("");
                          }
                          next[index] = event.target.value;
                          return {
                            ...prev,
                            [active.view_index]: next,
                          };
                        })
                      }
                      placeholder={`Enter answer ${index + 1}`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                );
              })}
              <p className="text-xs text-gray-500">
                Preview matches the student exam layout for enumeration questions.
              </p>
            </div>
          ) : (
            <textarea
              rows={4}
              value={currentAnswer}
              onChange={(event) =>
                setAnswers((prev) => ({
                  ...prev,
                  [active.view_index]: event.target.value,
                }))
              }
              placeholder="Type answer here..."
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Question Navigator</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((item, index) => {
              const isAnswered = hasPreviewAnswer(item, answers[item.view_index]);
              const isCurrent = index === current;
              return (
                <button
                  key={`nav-${item.view_index}`}
                  type="button"
                  onClick={() => setCurrent(index)}
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    isCurrent ? "bg-emerald-600 text-white" : isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>

        <footer className="sticky bottom-0 z-20 flex justify-between rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setCurrent((prev) => Math.max(0, prev - 1))}
            disabled={current === 0}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/create`)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            >
              Back to Builder
            </button>
            <button
              type="button"
              onClick={() => setCurrent((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={current >= questions.length - 1 || !canMoveNext}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
