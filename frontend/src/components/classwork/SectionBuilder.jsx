import React, { useEffect, useMemo, useState } from "react";
import QuestionBuilder from "./QuestionBuilder";
import { useExamBuilder } from "../../context/ExamBuilderContext";

const isQuestionCompleted = (question = {}) => {
  const type = String(question.type || "multiple_choice");
  const text = String(question.question_text || "").trim();
  if (!text) return false;
  if (type === "essay") return true;
  if (type === "coding") return String(question.language || "").trim().length > 0;
  if (type === "file_upload") return String(question.allowed_file_types || "").trim().length > 0;
  if (type === "true_false") return ["true", "false"].includes(String(question.correct_answer || "").toLowerCase());
  if (type === "multiple_choice") {
    const options = (question.options || []).filter((item) => String(item?.text || "").trim());
    const answer = String(question.correct_answer || "").trim();
    return options.length >= 2 && options.some((item) => String(item?.text || "").trim().toLowerCase() === answer.toLowerCase());
  }
  if (type === "matching") {
    const pairs = (question.matching_pairs || []).filter(
      (pair) => String(pair?.left || "").trim() && String(pair?.right || "").trim()
    );
    return pairs.length >= 2;
  }
  if (type === "enumeration") {
    const answers = Array.isArray(question.enumeration_items) && question.enumeration_items.length
      ? question.enumeration_items.filter((item) => String(item?.answer || "").trim())
      : (question.enumeration_answers || []).filter((item) => String(item || "").trim());
    return answers.length > 0;
  }
  return String(question.correct_answer || "").trim().length > 0;
};

const isSectionCompleted = (section = {}) => {
  const questions = Array.isArray(section.questions) ? section.questions : [];
  return questions.length > 0 && questions.every(isQuestionCompleted);
};

const normalizeQuestionText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const buildQuestionPreview = (value) => {
  const text = String(value || "").trim();
  if (!text) return "No question text yet.";
  return text.length > 88 ? `${text.slice(0, 88)}...` : text;
};

const buildQuestionAnchorId = (sectionId, sectionIndex, questionId, questionIndex) =>
  `question-${sectionId ?? `idx-${sectionIndex}`}-${questionId ?? `idx-${sectionIndex}-${questionIndex}`}`;

const getQuestionStatus = (question = {}, duplicateMetadata = null) => {
  const type = String(question.type || "multiple_choice");
  const text = String(question.question_text || "").trim();
  if (!text) return { tone: "border-rose-200 bg-rose-50 text-rose-700", label: "Missing text", key: "error" };
  if (type === "multiple_choice") {
    const options = (question.options || []).map((item) => String(item?.text || "").trim()).filter(Boolean);
    const answer = String(question.correct_answer || "").trim();
    if (options.length < 2) return { tone: "border-rose-200 bg-rose-50 text-rose-700", label: "Missing choices", key: "missing_answer" };
    if (!answer) return { tone: "border-rose-200 bg-rose-50 text-rose-700", label: "Missing answer", key: "missing_answer" };
    if (!options.some((item) => item.toLowerCase() === answer.toLowerCase())) {
      return { tone: "border-amber-200 bg-amber-50 text-amber-700", label: "Check answer", key: "warning" };
    }
  }
  if (type === "true_false") {
    const normalized = String(question.correct_answer || "").trim().toLowerCase();
    if (!["true", "false"].includes(normalized)) {
      return { tone: "border-rose-200 bg-rose-50 text-rose-700", label: "Missing answer", key: "missing_answer" };
    }
  }
  if (["short_answer", "identification"].includes(type) && !String(question.correct_answer || "").trim()) {
    return { tone: "border-rose-200 bg-rose-50 text-rose-700", label: "Missing answer", key: "missing_answer" };
  }
  if (duplicateMetadata?.sameTypeAndSection) {
    return { tone: "border-amber-200 bg-amber-50 text-amber-700", label: "Duplicate warning", key: "duplicate" };
  }
  if (duplicateMetadata) {
    return { tone: "border-sky-200 bg-sky-50 text-sky-700", label: "Similar text", key: "duplicate" };
  }
  return { tone: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Valid", key: "valid" };
};

export default function SectionBuilder({
  onOpenQuestionBank,
  searchQuery = "",
  typeFilter = "all",
  statusFilter = "all",
  focusAnchorId = "",
  focusNonce = 0,
}) {
  const { sections, setSections, blankQuestion } = useExamBuilder();
  const [collapsedMap, setCollapsedMap] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const questionRecords = useMemo(() => {
    let displayNumber = 0;
    return sections.flatMap((section, sectionIndex) => {
      const sectionId = section.id || `idx-${sectionIndex}`;
      return (section.questions || []).map((question, questionIndex) => {
        displayNumber += 1;
        return {
          key: `${sectionId}-${question.id || `${sectionIndex}-${questionIndex}`}`,
          anchorId: buildQuestionAnchorId(sectionId, sectionIndex, question.id, questionIndex),
          sectionId: String(sectionId),
          sectionIndex,
          questionIndex,
          displayNumber,
          sectionTitle: section.title || `Section ${sectionIndex + 1}`,
          question,
        };
      });
    });
  }, [sections]);

  const duplicateMetadataByAnchorId = useMemo(() => {
    const seen = new Map();
    const metadata = {};
    questionRecords.forEach((record) => {
      const normalizedText = normalizeQuestionText(record.question.question_text);
      if (!normalizedText) return;
      const currentType = String(record.question.type || "");
      const currentSectionKey = `${record.sectionId}-${currentType}`;
      const previous = seen.get(normalizedText);
      if (previous) {
        const sameTypeAndSection = previous.sectionKey === currentSectionKey;
        metadata[record.anchorId] = { sameTypeAndSection };
        metadata[previous.anchorId] = metadata[previous.anchorId] || { sameTypeAndSection };
      } else {
        seen.set(normalizedText, {
          anchorId: record.anchorId,
          sectionKey: currentSectionKey,
        });
      }
    });
    return metadata;
  }, [questionRecords]);

  useEffect(() => {
    setCollapsedMap((prev) => {
      const activeKeys = new Set(sections.map((section) => String(section.id)));
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => activeKeys.has(key))
      );
      sections.forEach((section) => {
        const key = String(section.id);
        if (typeof next[key] === "undefined") {
          next[key] = false;
        }
      });
      return next;
    });
  }, [sections]);

  useEffect(() => {
    const totalQuestions = questionRecords.length;
    setExpandedQuestions((prev) => {
      const validKeys = new Set(questionRecords.map((record) => record.key));
      const next = Object.fromEntries(Object.entries(prev).filter(([key]) => validKeys.has(key)));
      const knownKeys = new Set(Object.keys(next));
      questionRecords.forEach((record) => {
        if (!knownKeys.has(record.key) && totalQuestions <= 3) {
          next[record.key] = true;
        }
      });
      return next;
    });
  }, [questionRecords]);

  useEffect(() => {
    if (!focusAnchorId) return;
    const target = questionRecords.find((record) => record.anchorId === focusAnchorId);
    if (!target) return;
    setCollapsedMap((prev) => ({ ...prev, [target.sectionId]: false }));
    setExpandedQuestions((prev) => ({ ...prev, [target.key]: true }));
  }, [focusAnchorId, focusNonce, questionRecords]);

  const updateSection = (sectionIndex, patch) => {
    setSections((prev) => prev.map((item, index) => (index === sectionIndex ? { ...item, ...patch } : item)));
  };

  const addSection = () => {
    const newId = Date.now();
    setSections((prev) => [
      ...prev,
      {
        id: newId,
        title: `Section ${prev.length + 1}`,
        instructions: "",
        questions: [blankQuestion("multiple_choice")],
      },
    ]);
    setCollapsedMap((prev) => ({ ...prev, [String(newId)]: false }));
  };

  const removeSection = (sectionIndex) => {
    setSections((prev) => prev.filter((_, index) => index !== sectionIndex));
  };

  const allExpanded = useMemo(
    () => sections.length > 0 && sections.every((section) => !collapsedMap[String(section.id)]),
    [collapsedMap, sections]
  );

  const setAllCollapsed = (collapse) => {
    const next = {};
    sections.forEach((section) => {
      next[String(section.id)] = collapse;
    });
    setCollapsedMap(next);
  };

  const allQuestionsExpanded = questionRecords.length > 0 && questionRecords.every((record) => expandedQuestions[record.key]);

  const setAllQuestionsExpanded = (expand) => {
    const next = {};
    questionRecords.forEach((record) => {
      next[record.key] = expand;
    });
    setExpandedQuestions(next);
  };

  const normalizedSearch = String(searchQuery || "").trim().toLowerCase();
  const hasVisibleQuestions = questionRecords.some((record) => {
    const questionType = String(record.question.type || "multiple_choice");
    const status = getQuestionStatus(record.question, duplicateMetadataByAnchorId[record.anchorId]);
    const matchesSearch =
      !normalizedSearch ||
      String(record.question.question_text || "").toLowerCase().includes(normalizedSearch) ||
      `q${record.displayNumber}`.includes(normalizedSearch);
    const matchesType = typeFilter === "all" || questionType === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "valid" && status.key === "valid") ||
      (statusFilter === "has_issue" && status.key !== "valid") ||
      (statusFilter === "missing_answer" && status.key === "missing_answer") ||
      (statusFilter === "duplicate" && status.key === "duplicate");
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-emerald-900">Sections</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (allExpanded ? setAllCollapsed(true) : setAllCollapsed(false))}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
          <button
            type="button"
            onClick={() => setAllQuestionsExpanded(!allQuestionsExpanded)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
          >
            {allQuestionsExpanded ? "Collapse Questions" : "Expand Questions"}
          </button>
          <button
            type="button"
            onClick={onOpenQuestionBank}
            className="rounded border border-emerald-300 px-3 py-1.5 text-xs text-emerald-700"
          >
            Add from Question Bank
          </button>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        (() => {
          const sectionId = section.id || `idx-${sectionIndex}`;
          const visibleRecords = questionRecords.filter((record) => {
            if (record.sectionIndex !== sectionIndex) return false;
            const questionType = String(record.question.type || "multiple_choice");
            const status = getQuestionStatus(record.question, duplicateMetadataByAnchorId[record.anchorId]);
            const matchesSearch =
              !normalizedSearch ||
              String(record.question.question_text || "").toLowerCase().includes(normalizedSearch) ||
              `q${record.displayNumber}`.includes(normalizedSearch);
            const matchesType = typeFilter === "all" || questionType === typeFilter;
            const matchesStatus =
              statusFilter === "all" ||
              (statusFilter === "valid" && status.key === "valid") ||
              (statusFilter === "has_issue" && status.key !== "valid") ||
              (statusFilter === "missing_answer" && status.key === "missing_answer") ||
              (statusFilter === "duplicate" && status.key === "duplicate");
            return matchesSearch && matchesType && matchesStatus;
          });

          if (!visibleRecords.length) {
            return null;
          }

          return (
        <section
          key={section.id || sectionIndex}
          id={`section-${section.id || `idx-${sectionIndex}`}`}
          className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCollapsedMap((prev) => ({
                  ...prev,
                  [String(sectionId)]: !prev[String(sectionId)],
                }))
              }
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            >
              {collapsedMap[String(sectionId)] ? "Expand" : "Collapse"}
            </button>
            <div className="min-w-0 flex-1">
              <input
                value={section.title || ""}
                onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={`Section ${sectionIndex + 1}`}
              />
              <p className="mt-1 text-xs text-gray-600">
                {visibleRecords.length} of {section.questions?.length || 0} question(s) shown
                {isSectionCompleted(section) ? " - Completed" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeSection(sectionIndex)}
              className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
            >
              Delete Section
            </button>
          </div>
          {!collapsedMap[String(sectionId)] ? (
            <>
              <textarea
                rows={2}
                value={section.instructions || ""}
                onChange={(event) => updateSection(sectionIndex, { instructions: event.target.value })}
                placeholder="Section instructions"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />

              <div className="space-y-3">
                {visibleRecords.map((record) => {
                  const question = record.question;
                  const questionStatus = getQuestionStatus(question, duplicateMetadataByAnchorId[record.anchorId]);
                  const isExpanded = Boolean(expandedQuestions[record.key]);
                  return (
                    <div
                      key={question.id || `${sectionIndex}-${record.questionIndex}`}
                      id={record.anchorId}
                      className="rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-gray-900">Q{record.displayNumber}</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              {String(question.type || "multiple_choice").replaceAll("_", " ")}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${questionStatus.tone}`}>
                              {questionStatus.label}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-800">{buildQuestionPreview(question.question_text)}</p>
                          <p className="mt-1 text-xs text-gray-500">{Number(question.points || 0)} pt</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedQuestions((prev) => ({
                              ...prev,
                              [record.key]: !prev[record.key],
                            }))
                          }
                          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700"
                        >
                          {isExpanded ? "Collapse" : "Edit"}
                        </button>
                      </div>
                      {isExpanded ? (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <QuestionBuilder
                            sectionId={sectionId}
                            questionDomId={record.anchorId}
                            question={question}
                            questionNumber={record.displayNumber}
                            onChange={(nextQuestion) =>
                              updateSection(sectionIndex, {
                                questions: (section.questions || []).map((item, index) => (index === record.questionIndex ? nextQuestion : item)),
                              })
                            }
                            onDelete={() =>
                              updateSection(sectionIndex, {
                                questions: (section.questions || []).filter((_, index) => index !== record.questionIndex),
                              })
                            }
                            onMoveUp={() => {
                              if (record.questionIndex === 0) return;
                              const next = [...(section.questions || [])];
                              [next[record.questionIndex - 1], next[record.questionIndex]] = [next[record.questionIndex], next[record.questionIndex - 1]];
                              updateSection(sectionIndex, { questions: next });
                            }}
                            onMoveDown={() => {
                              const total = (section.questions || []).length;
                              if (record.questionIndex >= total - 1) return;
                              const next = [...(section.questions || [])];
                              [next[record.questionIndex], next[record.questionIndex + 1]] = [next[record.questionIndex + 1], next[record.questionIndex]];
                              updateSection(sectionIndex, { questions: next });
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextQuestion = blankQuestion("multiple_choice");
                  updateSection(sectionIndex, {
                    questions: [...(section.questions || []), nextQuestion],
                  });
                  setExpandedQuestions((prev) => ({
                    ...prev,
                    [`${sectionId}-${nextQuestion.id}`]: true,
                  }));
                }}
                className="mt-3 rounded border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700"
              >
                Add Question
              </button>
            </>
          ) : null}
        </section>
          );
        })()
      ))}

      {!hasVisibleQuestions ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
          No questions match the current search or filters.
        </div>
      ) : null}

      <button type="button" onClick={addSection} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        Add Section
      </button>
    </div>
  );
}
