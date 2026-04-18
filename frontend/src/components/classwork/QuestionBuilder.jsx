import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "identification", label: "Identification" },
  { value: "essay", label: "Essay" },
  { value: "coding", label: "Coding" },
  { value: "file_upload", label: "File Upload" },
  { value: "matching", label: "Matching Type" },
  { value: "enumeration", label: "Enumeration" },
];

const extensionsByLanguage = {
  javascript: [javascript({ jsx: true })],
  typescript: [javascript({ typescript: true, jsx: true })],
  python: [python()],
  cpp: [cpp()],
  c: [cpp()],
  java: [java()],
};

const toOptionObjects = (rawOptions = []) =>
  (Array.isArray(rawOptions) ? rawOptions : [])
    .map((option, index) => {
      if (option && typeof option === "object") {
        return { id: option.id || index + 1, text: String(option.text || "") };
      }
      return { id: index + 1, text: String(option || "") };
    })
    .filter((option) => option.text.trim() || option.id);

const toMatchingPairs = (value) =>
  (Array.isArray(value) ? value : []).map((pair) => ({
    left: String(pair?.left || ""),
    right: String(pair?.right || ""),
  }));

const toStringArray = (value) => (Array.isArray(value) ? value.map((item) => String(item || "")) : []);

const toEnumerationItems = (question = {}) => {
  const rawItems = Array.isArray(question.enumeration_items) ? question.enumeration_items : [];
  if (rawItems.length) {
    return rawItems.map((item) => ({
      answer: String(item?.answer || item?.text || ""),
      alternatives: toStringArray(item?.alternatives || item?.synonyms || []),
      points: Number(item?.points || 0),
    }));
  }

  const fallback = toStringArray(question.enumeration_answers);
  return fallback.map((answer) => ({
    answer,
    alternatives: [],
    points: 0,
  }));
};

const buildDefaultsByType = (type) => {
  switch (type) {
    case "multiple_choice":
      return {
        options: [
          { id: 1, text: "" },
          { id: 2, text: "" },
        ],
        correct_answer: "",
        correct_answer_index: -1,
      };
    case "true_false":
      return {
        options: [
          { id: 1, text: "True" },
          { id: 2, text: "False" },
        ],
        correct_answer: "true",
        correct_answer_index: 0,
      };
    case "matching":
      return {
        matching_pairs: [
          { left: "", right: "" },
          { left: "", right: "" },
        ],
        options: [],
        correct_answer: "",
      };
    case "enumeration":
      return {
        enumeration_answers: ["", ""],
        enumeration_items: [
          { answer: "", alternatives: [], points: 0 },
          { answer: "", alternatives: [], points: 0 },
        ],
        enumeration_scoring_mode: "partial",
        enumeration_points_mode: "equal",
        options: [],
        correct_answer: "",
      };
    case "coding":
      return {
        language: "javascript",
        starter_code: "",
        expected_output: "",
        test_cases: "",
      };
    case "essay":
      return {
        instructions: "",
        max_score: 5,
        options: [],
      };
    case "file_upload":
      return {
        allowed_file_types: ".pdf,.doc,.docx",
        max_file_size: "10MB",
        options: [],
        correct_answer: "",
      };
    case "identification":
      return {
        accepted_answers: [""],
        options: [],
      };
    case "short_answer":
      return {
        options: [],
      };
    default:
      return { options: [] };
  }
};

export default function QuestionBuilder({
  sectionId,
  questionDomId,
  question,
  questionNumber,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const type = question.type || "multiple_choice";
  const options = toOptionObjects(question.options);
  const normalizedTfAnswer = String(question.correct_answer || "").toLowerCase() === "false" ? "false" : "true";
  const acceptedAnswers = toStringArray(question.accepted_answers);
  const matchingPairs = toMatchingPairs(question.matching_pairs);
  const enumerationItems = toEnumerationItems(question);
  const enumerationScoringMode = String(question.enumeration_scoring_mode || "partial").toLowerCase();
  const enumerationPointsMode = String(question.enumeration_points_mode || "equal").toLowerCase();
  const editorLanguage = String(question.language || "javascript").toLowerCase();

  const emit = (patch) => onChange({ ...question, ...patch });

  const updateOption = (index, value) => {
    const nextOptions = [...options];
    const previousValue = String(nextOptions[index]?.text || "");
    nextOptions[index] = { ...(nextOptions[index] || { id: index + 1 }), text: value };
    const nextPatch = { options: nextOptions };
    if (String(question.correct_answer || "") === previousValue) {
      nextPatch.correct_answer = value;
    }
    emit(nextPatch);
  };

  const removeOption = (index) => {
    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({
      id: optionIndex + 1,
      text: option.text,
    }));
    let nextAnswer = String(question.correct_answer || "");
    let nextAnswerIndex = Number(question.correct_answer_index);
    if (nextAnswerIndex === index) {
      nextAnswer = "";
      nextAnswerIndex = -1;
    } else if (nextAnswerIndex > index) {
      nextAnswerIndex -= 1;
    }
    emit({ options: nextOptions, correct_answer: nextAnswer, correct_answer_index: nextAnswerIndex });
  };

  const updateMatchingPairs = (nextPairs) => {
    const normalized = nextPairs.map((pair) => ({
      left: String(pair.left || ""),
      right: String(pair.right || ""),
    }));
    const compact = normalized.filter((pair) => pair.left.trim() || pair.right.trim());
    emit({
      matching_pairs: normalized,
      options: compact.map((pair, index) => ({ id: index + 1, text: `${pair.left}:${pair.right}` })),
      correct_answer: compact.map((pair) => `${pair.left}:${pair.right}`).join(","),
    });
  };

  const updateEnumerationItems = (nextItems, extraPatch = {}) => {
    const cleaned = nextItems.map((item) => ({
      answer: String(item?.answer || ""),
      alternatives: toStringArray(item?.alternatives || []).map((value) => String(value || "")),
      points: Number(item?.points || 0),
    }));
    const nonEmpty = cleaned.filter((item) => item.answer.trim());
    const nextPointsMode = String(extraPatch.enumeration_points_mode || enumerationPointsMode || "equal").toLowerCase();
    const nextPatch = {
      enumeration_items: cleaned,
      enumeration_answers: cleaned.map((item) => item.answer),
      correct_answer: nonEmpty.map((item) => item.answer.trim()).join(", "),
      options: [],
      expected_count: nonEmpty.length,
    };
    if (nextPointsMode === "custom") {
      nextPatch.points = Number(
        nonEmpty.reduce((sum, item) => sum + Math.max(Number(item.points || 0), 0), 0).toFixed(2)
      );
    } else {
      nextPatch.points = Math.max(nonEmpty.length, 1);
    }
    emit({
      ...nextPatch,
      ...extraPatch,
    });
  };

  const updateAcceptedAnswers = (nextAnswers) => {
    const cleaned = nextAnswers.map((value) => String(value || ""));
    const nonEmpty = cleaned.filter((value) => value.trim());
    emit({
      accepted_answers: cleaned,
      correct_answer: nonEmpty[0] || "",
    });
  };

  const onTypeChange = (nextType) => {
    const defaults = buildDefaultsByType(nextType);
    emit({
      ...question,
      type: nextType,
      correct_answer: defaults.correct_answer ?? "",
      correct_answer_index: defaults.correct_answer_index ?? -1,
      options: defaults.options ?? [],
      accepted_answers: defaults.accepted_answers ?? [],
      matching_pairs: defaults.matching_pairs ?? [],
      enumeration_answers: defaults.enumeration_answers ?? [],
      enumeration_items: defaults.enumeration_items ?? [],
      enumeration_scoring_mode: defaults.enumeration_scoring_mode ?? "partial",
      enumeration_points_mode: defaults.enumeration_points_mode ?? "equal",
      instructions: defaults.instructions ?? "",
      max_score: defaults.max_score ?? question.max_score,
      language: defaults.language ?? question.language ?? "javascript",
      starter_code: defaults.starter_code ?? "",
      expected_output: defaults.expected_output ?? "",
      test_cases: defaults.test_cases ?? "",
      allowed_file_types: defaults.allowed_file_types ?? "",
      max_file_size: defaults.max_file_size ?? "",
    });
  };

  const formulaPreview = String(question.correct_formula || question.formula_input || "").trim();

  return (
    <div
      id={questionDomId || `question-${sectionId || "unknown"}-${question.id || questionNumber || "idx"}`}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">Question {questionNumber || ""}</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{type}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-gray-600">
          Question Type
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {QUESTION_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Points
          <input
            type="number"
            min={0}
            value={question.points || 1}
            onChange={(event) => emit({ points: Number(event.target.value || 0) })}
            className="mt-1 w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button type="button" onClick={onMoveUp} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
          Up
        </button>
        <button type="button" onClick={onMoveDown} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
          Down
        </button>
        <button type="button" onClick={onDelete} className="ml-auto rounded border border-red-300 px-2 py-1 text-xs text-red-700">
          Delete
        </button>
      </div>

      <textarea
        rows={2}
        value={question.question_text || ""}
        onChange={(event) => emit({ question_text: event.target.value })}
        placeholder="Enter the full question text..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {type === "multiple_choice" && (
        <div className="space-y-2">
          {(options.length ? options : [{ id: 1, text: "" }, { id: 2, text: "" }]).map((option, index) => (
            <div key={`${question.id || "q"}-mcq-${index}`} className="flex items-center gap-2">
              <input
                type="radio"
                name={`builder-mcq-${question.id || questionNumber}`}
                checked={String(question.correct_answer || "") === String(option.text || "") && String(option.text || "").trim().length > 0}
                onChange={() => emit({ correct_answer: option.text, correct_answer_index: index })}
              />
              <input
                value={option?.text || ""}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={options.length <= 2}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => emit({ options: [...options, { id: options.length + 1, text: "" }] })}
            className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
          >
            Add Option
          </button>
        </div>
      )}

      {type === "true_false" && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`tf-${question.id}`}
              checked={normalizedTfAnswer === "true"}
              onChange={() => emit({ correct_answer: "true", correct_answer_index: 0 })}
            />
            True
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`tf-${question.id}`}
              checked={normalizedTfAnswer === "false"}
              onChange={() => emit({ correct_answer: "false", correct_answer_index: 1 })}
            />
            False
          </label>
        </div>
      )}

      {type === "short_answer" && (
        <input
          value={question.correct_answer || ""}
          onChange={(event) => emit({ correct_answer: event.target.value })}
          placeholder="Correct answer"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      )}

      {type === "identification" && (
        <div className="space-y-2">
          {(acceptedAnswers.length ? acceptedAnswers : [""]).map((answer, index) => (
            <div key={`${question.id || "q"}-ident-${index}`} className="flex gap-2">
              <input
                value={answer}
                onChange={(event) => {
                  const next = [...(acceptedAnswers.length ? acceptedAnswers : [""])];
                  next[index] = event.target.value;
                  updateAcceptedAnswers(next);
                }}
                placeholder={`Accepted answer ${index + 1}`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const list = acceptedAnswers.length ? acceptedAnswers : [""];
                  updateAcceptedAnswers(list.filter((_, rowIndex) => rowIndex !== index));
                }}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => updateAcceptedAnswers([...(acceptedAnswers.length ? acceptedAnswers : [""]), ""])}
            className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
          >
            Add Accepted Answer
          </button>
        </div>
      )}

      {type === "essay" && (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={question.instructions || ""}
            onChange={(event) => emit({ instructions: event.target.value })}
            placeholder="Essay instructions and rubric hints"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="text-xs font-medium text-gray-600">
            Max Score
            <input
              type="number"
              min={1}
              value={Number(question.max_score || question.points || 1)}
              onChange={(event) => emit({ max_score: Number(event.target.value || 1), points: Number(event.target.value || 1) })}
              className="mt-1 w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}

      {type === "coding" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">
            Programming Language
            <select
              value={editorLanguage}
              onChange={(event) => emit({ language: event.target.value })}
              className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="typescript">TypeScript</option>
            </select>
          </label>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Starter Code</p>
            <CodeMirror
              value={question.starter_code || ""}
              height="180px"
              extensions={extensionsByLanguage[editorLanguage] || []}
              onChange={(value) => emit({ starter_code: value })}
              theme="light"
            />
          </div>

          <label className="text-xs font-medium text-gray-600">
            Expected Output
            <textarea
              rows={2}
              value={question.expected_output || ""}
              onChange={(event) => emit({ expected_output: event.target.value })}
              placeholder="Expected output"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Test Cases</p>
            <CodeMirror
              value={question.test_cases || ""}
              height="140px"
              extensions={[]}
              onChange={(value) => emit({ test_cases: value })}
              theme="light"
            />
          </div>
        </div>
      )}

      {type === "file_upload" && (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs font-medium text-gray-600">
            Allowed File Types
            <input
              value={question.allowed_file_types || ""}
              onChange={(event) => emit({ allowed_file_types: event.target.value })}
              placeholder=".pdf,.docx,.zip"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Max File Size
            <input
              value={question.max_file_size || ""}
              onChange={(event) => emit({ max_file_size: event.target.value })}
              placeholder="10MB"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {type === "matching" && (
        <div className="space-y-2">
          {(matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }]).map((pair, index) => (
            <div key={`${question.id || "q"}-match-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={pair.left || ""}
                onChange={(event) => {
                  const next = [...(matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }])];
                  next[index] = { ...next[index], left: event.target.value };
                  updateMatchingPairs(next);
                }}
                placeholder="Left side"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={pair.right || ""}
                onChange={(event) => {
                  const next = [...(matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }])];
                  next[index] = { ...next[index], right: event.target.value };
                  updateMatchingPairs(next);
                }}
                placeholder="Right side"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => updateMatchingPairs((matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }]).filter((_, rowIndex) => rowIndex !== index))}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => updateMatchingPairs([...(matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }]), { left: "", right: "" }])}
            className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
          >
            Add Pair
          </button>
        </div>
      )}

      {type === "enumeration" && (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Scoring Mode
              <select
                value={enumerationScoringMode}
                onChange={(event) => emit({ enumeration_scoring_mode: event.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="strict">Strict</option>
                <option value="partial">Partial</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Point Distribution
              <select
                value={enumerationPointsMode}
                onChange={(event) => {
                  const nextMode = event.target.value;
                  if (nextMode === "custom") {
                    const workingItems = enumerationItems.length
                      ? enumerationItems
                      : [{ answer: "", alternatives: [], points: 0 }, { answer: "", alternatives: [], points: 0 }];
                    const divisor = Math.max(workingItems.filter((item) => String(item.answer || "").trim()).length || workingItems.length, 1);
                    const equalShare = Number((Number(question.points || divisor) / divisor).toFixed(2));
                    updateEnumerationItems(
                      workingItems.map((item) => ({
                        ...item,
                        points: Number(item.points || 0) > 0 ? Number(item.points || 0) : equalShare,
                      })),
                      { enumeration_points_mode: "custom" }
                    );
                    return;
                  }
                  updateEnumerationItems(enumerationItems.length ? enumerationItems : [{ answer: "", alternatives: [], points: 0 }, { answer: "", alternatives: [], points: 0 }], {
                    enumeration_points_mode: "equal",
                  });
                }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="equal">Equal points</option>
                <option value="custom">Custom per answer</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs text-amber-900">
            {enumerationScoringMode === "strict"
              ? "Strict mode awards full points only when every expected answer is correct."
              : enumerationScoringMode === "percentage"
              ? "Percentage mode awards the question total based on the ratio of correct answers."
              : "Partial mode awards credit for each correctly matched answer."}
          </div>

          {(enumerationItems.length
            ? enumerationItems
            : [
                { answer: "", alternatives: [], points: 0 },
                { answer: "", alternatives: [], points: 0 },
              ]
          ).map((item, index) => (
            <div key={`${question.id || "q"}-enum-${index}`} className="grid gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-[1.4fr_1fr_auto_auto]">
              <input
                value={item.answer || ""}
                onChange={(event) => {
                  const next = [...(enumerationItems.length
                    ? enumerationItems
                    : [
                        { answer: "", alternatives: [], points: 0 },
                        { answer: "", alternatives: [], points: 0 },
                      ])];
                  next[index] = { ...next[index], answer: event.target.value };
                  updateEnumerationItems(next);
                }}
                placeholder={`Expected answer ${index + 1}`}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={toStringArray(item.alternatives || []).join(", ")}
                onChange={(event) => {
                  const next = [...(enumerationItems.length
                    ? enumerationItems
                    : [
                        { answer: "", alternatives: [], points: 0 },
                        { answer: "", alternatives: [], points: 0 },
                      ])];
                  next[index] = {
                    ...next[index],
                    alternatives: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                  };
                  updateEnumerationItems(next);
                }}
                placeholder="Accepted variations, comma-separated"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {enumerationPointsMode === "custom" ? (
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  value={Number(item.points || 0)}
                  onChange={(event) => {
                    const next = [...(enumerationItems.length
                      ? enumerationItems
                      : [
                          { answer: "", alternatives: [], points: 0 },
                          { answer: "", alternatives: [], points: 0 },
                        ])];
                    next[index] = { ...next[index], points: Number(event.target.value || 0) };
                    updateEnumerationItems(next, { enumeration_points_mode: "custom" });
                  }}
                  placeholder="Points"
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              ) : (
                <div className="flex items-center rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
                  Auto
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  updateEnumerationItems(
                    (enumerationItems.length
                      ? enumerationItems
                      : [
                          { answer: "", alternatives: [], points: 0 },
                          { answer: "", alternatives: [], points: 0 },
                        ]).filter((_, rowIndex) => rowIndex !== index)
                  )
                }
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                updateEnumerationItems([
                  ...(enumerationItems.length
                    ? enumerationItems
                    : [
                        { answer: "", alternatives: [], points: 0 },
                        { answer: "", alternatives: [], points: 0 },
                      ]),
                  { answer: "", alternatives: [], points: 0 },
                ])
              }
              className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
            >
              Add Answer
            </button>
            <p className="text-xs text-gray-500">
              Students may enter one answer per line or separate answers with commas.
            </p>
          </div>
        </div>
      )}

      {!["coding", "file_upload", "essay"].includes(type) && (
        <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
          <p className="text-xs font-semibold text-blue-800">Math / Formula (LaTeX)</p>
          <input
            value={question.formula_input || ""}
            onChange={(event) => emit({ formula_input: event.target.value })}
            placeholder="Optional formula prompt, e.g. Solve \frac{a}{b}"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={question.correct_formula || ""}
            onChange={(event) => emit({ correct_formula: event.target.value })}
            placeholder="Correct formula, e.g. \sqrt{x}"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {formulaPreview ? (
            <div className="rounded border border-blue-200 bg-white p-2 text-sm">
              <BlockMath math={formulaPreview} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
