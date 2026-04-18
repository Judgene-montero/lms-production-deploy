import React, { useMemo, useState } from "react";
import { LuEye, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";

// Deprecated for instructor quiz/exam workflows. Kept for backward compatibility only.

const createQuestion = () => ({
  question_text: "",
  question_type: "multiple_choice",
  options: ["", "", "", ""],
  correct_answer: "",
  points: 1,
});

const normalizeQuestion = (question = {}) => {
  const normalizedType = ["multiple_choice", "true_false", "short_answer"].includes(question.question_type)
    ? question.question_type
    : "multiple_choice";

  if (normalizedType === "true_false") {
    const answer = String(question.correct_answer || "true").toLowerCase();
    return {
      question_text: question.question_text || "",
      question_type: "true_false",
      options: ["True", "False"],
      correct_answer: answer === "false" ? "false" : "true",
      points: Number(question.points || 1),
    };
  }

  if (normalizedType === "short_answer") {
    return {
      question_text: question.question_text || "",
      question_type: "short_answer",
      options: [],
      correct_answer: question.correct_answer || "",
      points: Number(question.points || 1),
    };
  }

  const incomingOptions = Array.isArray(question.options) ? question.options : ["", "", "", ""];
  const padded = [...incomingOptions];
  while (padded.length < 4) padded.push("");

  return {
    question_text: question.question_text || "",
    question_type: "multiple_choice",
    options: padded,
    correct_answer: question.correct_answer || "",
    points: Number(question.points || 1),
  };
};

const toBackendQuestion = (question, index) => {
  const questionType = question.question_type;
  if (questionType === "short_answer") {
    return {
      id: index + 1,
      question_text: question.question_text,
      type: "short_answer",
      options: [],
      correct_answer: question.correct_answer,
      points: Number(question.points || 1),
    };
  }

  if (questionType === "true_false") {
    return {
      id: index + 1,
      question_text: question.question_text,
      type: "true_false",
      options: [
        { id: 1, text: "True" },
        { id: 2, text: "False" },
      ],
      correct_answer: String(question.correct_answer || "true").toLowerCase() === "false" ? "false" : "true",
      points: Number(question.points || 1),
    };
  }

  const cleanedOptions = (question.options || []).map((value) => String(value || "").trim()).filter(Boolean);
  return {
    id: index + 1,
    question_text: question.question_text,
    type: "multiple_choice",
    options: cleanedOptions.map((text, optionIndex) => ({ id: optionIndex + 1, text })),
    correct_answer: question.correct_answer,
    points: Number(question.points || 1),
  };
};

export default function QuizBuilderModal({ open, onClose, onSave, quizData, setQuizData }) {
  const [questions, setQuestions] = useState(() => {
    const existing = Array.isArray(quizData?.questions) ? quizData.questions : [];
    return existing.length ? existing.map(normalizeQuestion) : [createQuestion()];
  });
  const [editingIndex, setEditingIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [error, setError] = useState("");

  const activeQuestion = questions[editingIndex] || createQuestion();

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + Number(question.points || 0), 0),
    [questions]
  );

  if (!open) return null;

  const updateQuestion = (index, patch) => {
    setQuestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const onTypeChange = (nextType) => {
    if (nextType === "multiple_choice") {
      updateQuestion(editingIndex, {
        question_type: "multiple_choice",
        options: ["", "", "", ""],
        correct_answer: "",
      });
      return;
    }

    if (nextType === "true_false") {
      updateQuestion(editingIndex, {
        question_type: "true_false",
        options: ["True", "False"],
        correct_answer: "true",
      });
      return;
    }

    updateQuestion(editingIndex, {
      question_type: "short_answer",
      options: [],
      correct_answer: "",
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createQuestion()]);
    setEditingIndex(questions.length);
  };

  const removeQuestion = (index) => {
    const next = questions.filter((_, itemIndex) => itemIndex !== index);
    setQuestions(next.length ? next : [createQuestion()]);
    setEditingIndex(0);
  };

  const validateQuestions = () => {
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      if (!String(question.question_text || "").trim()) {
        return `Question ${index + 1}: question text is required.`;
      }
      if (Number(question.points || 0) <= 0) {
        return `Question ${index + 1}: points must be greater than 0.`;
      }

      if (question.question_type === "multiple_choice") {
        const options = (question.options || []).map((value) => String(value || "").trim()).filter(Boolean);
        if (options.length < 2) {
          return `Question ${index + 1}: at least two options are required.`;
        }
        if (!String(question.correct_answer || "").trim()) {
          return `Question ${index + 1}: select one correct option.`;
        }
        if (!options.includes(String(question.correct_answer || "").trim())) {
          return `Question ${index + 1}: correct option must match one listed option.`;
        }
      }

      if (question.question_type === "true_false") {
        if (!["true", "false"].includes(String(question.correct_answer || "").toLowerCase())) {
          return `Question ${index + 1}: choose True or False.`;
        }
      }

      if (question.question_type === "short_answer" && !String(question.correct_answer || "").trim()) {
        return `Question ${index + 1}: correct answer is required.`;
      }
    }
    return "";
  };

  const saveQuiz = () => {
    const validationError = validateQuestions();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      questions: questions.map((question, index) => toBackendQuestion(question, index)),
    };

    if (typeof setQuizData === "function") {
      setQuizData((prev) => ({ ...(prev || {}), ...payload }));
    }

    setError("");
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assessment Builder</h2>
            <p className="text-sm text-gray-600">Question types: multiple choice, true/false, short answer.</p>
          </div>
          <p className="text-sm font-semibold text-emerald-700">Total Points: {totalPoints}</p>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-2">
          {questions.map((question, index) => (
            <button
              key={`q-nav-${index}`}
              type="button"
              onClick={() => setEditingIndex(index)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                editingIndex === index ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700"
              }`}
            >
              Q{index + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700"
          >
            <LuPlus className="h-4 w-4" /> Add Question
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            <LuEye className="h-4 w-4" /> {previewMode ? "Edit Mode" : "Preview Mode"}
          </button>
        </div>

        {!previewMode ? (
          <section className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Question {editingIndex + 1}</h3>
              <button
                type="button"
                onClick={() => removeQuestion(editingIndex)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
              >
                <LuTrash2 className="h-4 w-4" /> Delete
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                value={activeQuestion.question_text}
                onChange={(event) => updateQuestion(editingIndex, { question_text: event.target.value })}
                placeholder="Question text"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                value={activeQuestion.question_type}
                onChange={(event) => onTypeChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
              </select>
              <input
                type="number"
                min={1}
                value={activeQuestion.points}
                onChange={(event) => updateQuestion(editingIndex, { points: Number(event.target.value || 1) })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Points"
              />
            </div>

            {activeQuestion.question_type === "multiple_choice" && (
              <div className="mt-4 space-y-2">
                {(activeQuestion.options || []).map((option, optionIndex) => (
                  <div key={`option-${optionIndex}`} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${editingIndex}`}
                      checked={String(activeQuestion.correct_answer || "") === String(option || "") && String(option || "").trim().length > 0}
                      onChange={() => updateQuestion(editingIndex, { correct_answer: option })}
                    />
                    <input
                      value={option}
                      onChange={(event) => {
                        const nextOptions = [...(activeQuestion.options || [])];
                        const previousValue = nextOptions[optionIndex];
                        nextOptions[optionIndex] = event.target.value;
                        const patch = { options: nextOptions };
                        if (String(activeQuestion.correct_answer || "") === String(previousValue || "")) {
                          patch.correct_answer = event.target.value;
                        }
                        updateQuestion(editingIndex, patch);
                      }}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500">Select exactly one correct answer using the radio button.</p>
              </div>
            )}

            {activeQuestion.question_type === "true_false" && (
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={`tf-${editingIndex}`}
                    checked={String(activeQuestion.correct_answer || "true") === "true"}
                    onChange={() => updateQuestion(editingIndex, { correct_answer: "true" })}
                  />
                  True
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={`tf-${editingIndex}`}
                    checked={String(activeQuestion.correct_answer || "true") === "false"}
                    onChange={() => updateQuestion(editingIndex, { correct_answer: "false" })}
                  />
                  False
                </label>
              </div>
            )}

            {activeQuestion.question_type === "short_answer" && (
              <div className="mt-4">
                <input
                  value={activeQuestion.correct_answer}
                  onChange={(event) => updateQuestion(editingIndex, { correct_answer: event.target.value })}
                  placeholder="Correct answer (case-insensitive during checking)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border border-gray-200 p-4">
            {questions.map((question, index) => (
              <article key={`preview-${index}`} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-gray-900">{index + 1}. {question.question_text || "Untitled"}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewMode(false);
                      setEditingIndex(index);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
                  >
                    <LuPencil className="h-3 w-3" /> Edit
                  </button>
                </div>
                <p className="text-xs uppercase text-gray-500">{question.question_type} | {question.points} pts</p>
              </article>
            ))}
          </section>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">
            Cancel
          </button>
          <button type="button" onClick={saveQuiz} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Save Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
