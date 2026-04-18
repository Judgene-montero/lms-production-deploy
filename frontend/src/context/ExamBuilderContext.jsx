import React, { createContext, useContext, useMemo, useState } from "react";

const ExamBuilderContext = createContext(null);

const createDefaultQuestionFields = (type) => {
  const base = {
    options: [],
    correct_answer: "",
    correct_answer_index: -1,
    accepted_answers: [],
    matching_pairs: [],
    enumeration_answers: [],
    enumeration_items: [],
    enumeration_scoring_mode: "partial",
    enumeration_points_mode: "equal",
    instructions: "",
    max_score: 1,
    language: "javascript",
    starter_code: "",
    expected_output: "",
    test_cases: "",
    allowed_file_types: "",
    max_file_size: "",
    formula_input: "",
    correct_formula: "",
  };

  if (type === "multiple_choice") {
    return {
      ...base,
      options: [
        { id: 1, text: "" },
        { id: 2, text: "" },
      ],
    };
  }
  if (type === "true_false") {
    return {
      ...base,
      options: [
        { id: 1, text: "True" },
        { id: 2, text: "False" },
      ],
      correct_answer: "true",
    };
  }
  if (type === "matching") {
    return {
      ...base,
      matching_pairs: [
        { left: "", right: "" },
        { left: "", right: "" },
      ],
    };
  }
  if (type === "enumeration") {
    return {
      ...base,
      enumeration_answers: ["", ""],
      enumeration_items: [
        { answer: "", alternatives: [], points: 0 },
        { answer: "", alternatives: [], points: 0 },
      ],
    };
  }
  if (type === "essay") {
    return {
      ...base,
      instructions: "",
      max_score: 5,
    };
  }
  return base;
};

const blankQuestion = (type = "multiple_choice") => ({
  id: Date.now(),
  question_text: "",
  type,
  points: 1,
  ...createDefaultQuestionFields(type),
});

const blankSection = () => ({
  id: Date.now(),
  title: "Section 1",
  instructions: "",
  questions: [blankQuestion("multiple_choice")],
});

export function ExamBuilderProvider({ initialState = {}, children }) {
  const [settings, setSettings] = useState({
    title: "",
    description: "",
    assessment_type: "quiz",
    due_date: "",
    availability_start: "",
    availability_end: "",
    points: 100,
    quiz_time_limit_seconds: 1800,
    max_attempts: 1,
    randomize_questions: false,
    randomize_choices: false,
    random_subset_size: 0,
    require_answer_to_advance: false,
    anti_cheat_enabled: false,
    anti_cheat_tab_switch: false,
    anti_cheat_multi_tab: false,
    anti_cheat_disable_copy_paste: false,
    anti_cheat_fullscreen_required: false,
    show_score_immediately: false,
    allow_answer_review: false,
    publish_state: "draft",
    topic: "",
    course_ids: [],
    ...initialState.settings,
  });

  const [sections, setSections] = useState(
    Array.isArray(initialState.sections) && initialState.sections.length ? initialState.sections : [blankSection()]
  );

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      sections,
      setSections,
      blankQuestion,
      blankSection,
    }),
    [sections, settings]
  );

  return <ExamBuilderContext.Provider value={value}>{children}</ExamBuilderContext.Provider>;
}

export function useExamBuilder() {
  const context = useContext(ExamBuilderContext);
  if (!context) {
    throw new Error("useExamBuilder must be used inside ExamBuilderProvider");
  }
  return context;
}
