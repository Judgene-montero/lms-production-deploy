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

export default function SectionBuilder({ onOpenQuestionBank }) {
  const { sections, setSections, blankQuestion } = useExamBuilder();
  const [collapsedMap, setCollapsedMap] = useState({});

  useEffect(() => {
    setCollapsedMap((prev) => {
      const next = { ...prev };
      sections.forEach((section) => {
        const key = String(section.id);
        if (typeof next[key] === "undefined") {
          next[key] = false;
        }
        if (isSectionCompleted(section)) {
          next[key] = true;
        }
      });
      return next;
    });
  }, [sections]);

  const updateSection = (sectionIndex, patch) => {
    setSections((prev) => prev.map((item, index) => (index === sectionIndex ? { ...item, ...patch } : item)));
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: `Section ${prev.length + 1}`,
        instructions: "",
        questions: [blankQuestion("multiple_choice")],
      },
    ]);
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
            onClick={onOpenQuestionBank}
            className="rounded border border-emerald-300 px-3 py-1.5 text-xs text-emerald-700"
          >
            Add from Question Bank
          </button>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
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
                  [String(section.id)]: !prev[String(section.id)],
                }))
              }
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            >
              {collapsedMap[String(section.id)] ? "Expand" : "Collapse"}
            </button>
            <div className="min-w-0 flex-1">
              <input
                value={section.title || ""}
                onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={`Section ${sectionIndex + 1}`}
              />
              {collapsedMap[String(section.id)] ? (
                <p className="mt-1 text-xs text-gray-600">
                  {section.questions?.length || 0} question(s) in this section
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeSection(sectionIndex)}
              className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
            >
              Delete Section
            </button>
          </div>
          {!collapsedMap[String(section.id)] ? (
            <>
              <textarea
                rows={2}
                value={section.instructions || ""}
                onChange={(event) => updateSection(sectionIndex, { instructions: event.target.value })}
                placeholder="Section instructions"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />

              <div className="space-y-3">
                {(section.questions || []).map((question, questionIndex) => (
                  <QuestionBuilder
                    key={question.id || `${sectionIndex}-${questionIndex}`}
                    sectionId={section.id || `idx-${sectionIndex}`}
                    questionDomId={`question-${section.id || `idx-${sectionIndex}`}-${question.id || `idx-${sectionIndex}-${questionIndex}`}`}
                    question={question}
                    questionNumber={questionIndex + 1}
                    onChange={(nextQuestion) =>
                      updateSection(sectionIndex, {
                        questions: (section.questions || []).map((item, index) => (index === questionIndex ? nextQuestion : item)),
                      })
                    }
                    onDelete={() =>
                      updateSection(sectionIndex, {
                        questions: (section.questions || []).filter((_, index) => index !== questionIndex),
                      })
                    }
                    onMoveUp={() => {
                      if (questionIndex === 0) return;
                      const next = [...(section.questions || [])];
                      [next[questionIndex - 1], next[questionIndex]] = [next[questionIndex], next[questionIndex - 1]];
                      updateSection(sectionIndex, { questions: next });
                    }}
                    onMoveDown={() => {
                      const total = (section.questions || []).length;
                      if (questionIndex >= total - 1) return;
                      const next = [...(section.questions || [])];
                      [next[questionIndex], next[questionIndex + 1]] = [next[questionIndex + 1], next[questionIndex]];
                      updateSection(sectionIndex, { questions: next });
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection(sectionIndex, {
                    questions: [...(section.questions || []), blankQuestion("multiple_choice")],
                  })
                }
                className="mt-3 rounded border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700"
              >
                Add Question
              </button>
            </>
          ) : null}
        </section>
      ))}

      <button type="button" onClick={addSection} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        Add Section
      </button>
    </div>
  );
}
