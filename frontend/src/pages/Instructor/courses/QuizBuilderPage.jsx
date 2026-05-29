import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { authGet, authPost, authPut } from "../../../utils/api";
import { ExamBuilderProvider, useExamBuilder } from "../../../context/ExamBuilderContext";
import ExamSettingsPanel from "../../../components/classwork/ExamSettingsPanel";
import PrePublishDiagnosticsPanel from "../../../components/classwork/PrePublishDiagnosticsPanel";
import SectionBuilder from "../../../components/classwork/SectionBuilder";
import QuestionBankSelector from "../../../components/classwork/QuestionBankSelector";

const AUTOSAVE_MS = 12000;
const EMPTY_PREFILL = Object.freeze({});

const QUESTION_STATUS_LABELS = {
  all: "All statuses",
  valid: "Valid",
  has_issue: "Has issue",
  missing_answer: "Missing answer",
  duplicate: "Duplicate warning",
};

const QUESTION_TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True/False" },
  { value: "identification", label: "Identification" },
  { value: "short_answer", label: "Short Answer" },
  { value: "essay", label: "Essay" },
  { value: "enumeration", label: "Enumeration" },
];

const buildAnchorId = (sectionId, sectionIndex, questionId, questionIndex) =>
  `question-${sectionId ?? `idx-${sectionIndex}`}-${questionId ?? `idx-${sectionIndex}-${questionIndex}`}`;

const normalizeQuestionText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeOptions = (options = []) =>
  (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (option && typeof option === "object") {
        const text = String(option.text || "").trim();
        return text ? { id: option.id || index + 1, text } : null;
      }
      const text = String(option || "").trim();
      return text ? { id: index + 1, text } : null;
    })
    .filter(Boolean);

const normalizeEnumerationItems = (question = {}) => {
  const rawItems = Array.isArray(question.enumeration_items) ? question.enumeration_items : [];
  if (rawItems.length) {
    return rawItems.map((item) => ({
      answer: String(item?.answer || item?.text || "").trim(),
      alternatives: Array.isArray(item?.alternatives || item?.synonyms)
        ? (item.alternatives || item.synonyms).map((value) => String(value || "").trim()).filter(Boolean)
        : [],
      points: Number(item?.points || 0),
    }));
  }

  const fallbackAnswers = Array.isArray(question.enumeration_answers)
    ? question.enumeration_answers.map((item) => String(item || "").trim()).filter(Boolean)
    : String(question.correct_answer || "")
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);

  return fallbackAnswers.map((answer) => ({
    answer,
    alternatives: [],
    points: 0,
  }));
};

const normalizeQuestionForBuilder = (question = {}, fallbackIndex = 0) => {
  const type = String(question.type || "multiple_choice");
  const questionText = String(question.question_text || question.question || "").trim();
  const normalizedOptions = normalizeOptions(question.options);
  const normalizedChoices = Array.isArray(question.choices)
    ? question.choices.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (type === "true_false") {
    const tfOptions = normalizedOptions.length >= 2 ? normalizedOptions : [{ id: 1, text: "True" }, { id: 2, text: "False" }];
    const rawAnswer = String(question.correct_answer || "").trim().toLowerCase();
    const normalizedAnswer = rawAnswer ? (rawAnswer.startsWith("t") ? "true" : "false") : "true";
    return {
      ...question,
      id: question.id || Date.now() + fallbackIndex,
      type: "true_false",
      question_text: questionText,
      choices: ["True", "False"],
      options: tfOptions,
      correct_answer: normalizedAnswer,
      correct_answer_index: normalizedAnswer === "false" ? 1 : 0,
    };
  }

  if (type === "multiple_choice") {
    const mcqOptions = normalizedOptions.length ? normalizedOptions : normalizedChoices.map((text, index) => ({ id: index + 1, text }));
    const answerToken = String(question.correct_answer || "").trim();
    let resolvedIndex = Number(question.correct_answer_index);
    if (!Number.isFinite(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= mcqOptions.length) {
      resolvedIndex = -1;
      const letterMatch = answerToken.match(/^([A-Z])$/i);
      if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < mcqOptions.length) resolvedIndex = idx;
      } else if (answerToken) {
        resolvedIndex = mcqOptions.findIndex((option) => String(option.text || "").trim().toLowerCase() === answerToken.toLowerCase());
      }
    }
    const resolvedAnswer =
      resolvedIndex >= 0 && resolvedIndex < mcqOptions.length
        ? String(mcqOptions[resolvedIndex].text || "").trim()
        : String(question.correct_answer_text || answerToken || "").trim();
    return {
      ...question,
      id: question.id || Date.now() + fallbackIndex,
      type: "multiple_choice",
      question_text: questionText,
      options: mcqOptions,
      correct_answer: resolvedAnswer,
      correct_answer_index: resolvedIndex,
    };
  }

  if (type === "matching") {
    const rawPairs = Array.isArray(question.matching_pairs) ? question.matching_pairs : [];
    const matchingPairs = rawPairs.map((pair) => ({
      left: String(pair?.left || "").trim(),
      right: String(pair?.right || "").trim(),
    }));
    return {
      ...question,
      id: question.id || Date.now() + fallbackIndex,
      question_text: questionText,
      matching_pairs: matchingPairs.length ? matchingPairs : [{ left: "", right: "" }, { left: "", right: "" }],
    };
  }

  if (type === "enumeration") {
    const enumerationItems = normalizeEnumerationItems(question);
    const safeItems = enumerationItems.length
      ? enumerationItems
      : [
          { answer: "", alternatives: [], points: 0 },
          { answer: "", alternatives: [], points: 0 },
        ];
    return {
      ...question,
      id: question.id || Date.now() + fallbackIndex,
      question_text: questionText,
      enumeration_items: safeItems,
      enumeration_answers: safeItems.map((item) => item.answer),
      enumeration_scoring_mode: String(question.enumeration_scoring_mode || "partial").toLowerCase(),
      enumeration_points_mode: String(question.enumeration_points_mode || "equal").toLowerCase(),
      expected_count: safeItems.filter((item) => item.answer).length,
      correct_answer: safeItems.map((item) => item.answer).filter(Boolean).join(", "),
      points:
        String(question.enumeration_points_mode || "equal").toLowerCase() === "custom"
          ? Number(question.points || 0)
          : Math.max(safeItems.filter((item) => item.answer).length || safeItems.length || 1, 1),
      options: [],
      choices: [],
    };
  }

  if (type === "identification") {
    const acceptedAnswers = Array.isArray(question.accepted_answers)
      ? question.accepted_answers.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const fallbackAccepted = String(question.correct_answer || "")
      .split(/[|,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      ...question,
      id: question.id || Date.now() + fallbackIndex,
      question_text: questionText,
      options: [],
      accepted_answers: acceptedAnswers.length ? acceptedAnswers : fallbackAccepted,
    };
  }

  return {
    ...question,
    id: question.id || Date.now() + fallbackIndex,
    question_text: questionText,
    options: type === "short_answer" ? [] : normalizedOptions,
  };
};

const normalizeSectionsForBuilder = (sections = []) =>
  (Array.isArray(sections) ? sections : []).map((section, sectionIndex) => ({
    ...section,
    id: section.id || Date.now() + sectionIndex,
    questions: (Array.isArray(section.questions) ? section.questions : []).map((question, questionIndex) =>
      normalizeQuestionForBuilder(question, sectionIndex * 1000 + questionIndex)
    ),
  }));

const sanitizeSectionsForSubmit = (sections = []) => {
  const safeSections = Array.isArray(sections) ? sections : [];
  const usedQuestionIds = new Set();
  let nextQuestionId = 1;

  return safeSections.map((section, sectionIndex) => {
    const sectionQuestions = Array.isArray(section?.questions) ? section.questions : [];
    const normalizedQuestions = sectionQuestions.map((question) => {
      const parsedId = Number(question?.id);
      let resolvedId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

      if (resolvedId == null || usedQuestionIds.has(resolvedId)) {
        while (usedQuestionIds.has(nextQuestionId)) {
          nextQuestionId += 1;
        }
        resolvedId = nextQuestionId;
        nextQuestionId += 1;
      }

      usedQuestionIds.add(resolvedId);
      const nextQuestion = { ...question, id: resolvedId };
      const type = String(nextQuestion.type || "multiple_choice");
      if (type === "multiple_choice") {
        const optionTexts = (Array.isArray(nextQuestion.options) ? nextQuestion.options : [])
          .map((option) => String(option?.text || "").trim())
          .filter(Boolean);
        if (!optionTexts.some((text) => text.toLowerCase() === String(nextQuestion.correct_answer || "").trim().toLowerCase())) {
          nextQuestion.correct_answer = "";
        }
      }
      if (type === "identification") {
        const accepted = Array.isArray(nextQuestion.accepted_answers)
          ? nextQuestion.accepted_answers.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        nextQuestion.choices = [];
        nextQuestion.options = [];
        if (accepted.length > 0) {
          nextQuestion.correct_answer = accepted[0];
        }
      }
      if (type === "essay" || type === "coding" || type === "file_upload" || type === "short_answer") {
        nextQuestion.choices = [];
        nextQuestion.options = [];
      }
      if (type === "enumeration") {
        const rawItems = normalizeEnumerationItems(nextQuestion)
          .map((item) => ({
            answer: String(item.answer || "").trim(),
            alternatives: Array.isArray(item.alternatives)
              ? item.alternatives.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
            points: Number(item.points || 0),
          }))
          .filter((item) => item.answer);
        const scoringMode = ["strict", "partial", "percentage"].includes(String(nextQuestion.enumeration_scoring_mode || "").toLowerCase())
          ? String(nextQuestion.enumeration_scoring_mode || "").toLowerCase()
          : "partial";
        let pointsMode = String(nextQuestion.enumeration_points_mode || "equal").toLowerCase();
        if (!["equal", "custom"].includes(pointsMode)) {
          pointsMode = "equal";
        }
        const totalPoints = Math.max(Number(nextQuestion.points || 0), 0);
        const itemCount = rawItems.length;
        const computedItems =
          pointsMode === "custom"
            ? rawItems.map((item) => ({ ...item, points: Math.max(Number(item.points || 0), 0) }))
            : rawItems.map((item) => ({
                ...item,
                points: itemCount ? Number((totalPoints / itemCount).toFixed(2)) : 0,
              }));
        const customTotal = Number(
          computedItems.reduce((sum, item) => sum + Math.max(Number(item.points || 0), 0), 0).toFixed(2)
        );
        const resolvedPoints = pointsMode === "custom" ? customTotal : totalPoints;
        nextQuestion.enumeration_items = computedItems;
        nextQuestion.enumeration_answers = computedItems.map((item) => item.answer);
        nextQuestion.enumeration_scoring_mode = scoringMode;
        nextQuestion.enumeration_points_mode = pointsMode;
        nextQuestion.expected_count = computedItems.length;
        nextQuestion.correct_answer = computedItems.map((item) => item.answer).join(", ");
        nextQuestion.options = [];
        nextQuestion.choices = [];
        nextQuestion.points = pointsMode === "custom" ? resolvedPoints : totalPoints;
      }
      if (type === "matching") {
        const pairs = Array.isArray(nextQuestion.matching_pairs)
          ? nextQuestion.matching_pairs
              .map((pair) => ({ left: String(pair?.left || "").trim(), right: String(pair?.right || "").trim() }))
              .filter((pair) => pair.left && pair.right)
          : [];
        if (pairs.length > 0) {
          nextQuestion.options = pairs.map((pair, index) => ({ id: index + 1, text: `${pair.left}:${pair.right}` }));
          nextQuestion.correct_answer = pairs.map((pair) => `${pair.left}:${pair.right}`).join(",");
        }
      }
      return nextQuestion;
    });

    return {
      ...section,
      id: section?.id || Date.now() + sectionIndex,
      questions: normalizedQuestions,
    };
  });
};

function BuilderContent({ mode = "create", initialActivityId = null }) {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { settings, setSettings, sections, setSections } = useExamBuilder();
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [instructorCourses, setInstructorCourses] = useState([]);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [focusTarget, setFocusTarget] = useState({ anchorId: "", nonce: 0 });
  const isDirtyRef = useRef(false);
  const sectionsWatchInitialized = useRef(false);

  const draftKey = `exam_builder_draft_${courseId}`;

  const computedTotalPoints = useMemo(
    () =>
      (Array.isArray(sections) ? sections : []).reduce((sectionAcc, section) => {
        const questions = Array.isArray(section?.questions) ? section.questions : [];
        return (
          sectionAcc +
          questions.reduce((questionAcc, question) => questionAcc + Number(question?.points || 0), 0)
        );
      }, 0),
    [sections]
  );

  const onSettingsChange = (field, value) => {
    isDirtyRef.current = true;
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const payload = useMemo(
    () => {
      const normalizedSections = sanitizeSectionsForSubmit(sections);
      return {
      title: settings.title || "",
      description: settings.description || "",
      assessment_type: settings.assessment_type || "quiz",
      due_date: settings.due_date || null,
      availability_start: settings.availability_start || null,
      availability_end: settings.availability_end || null,
      points: Number(computedTotalPoints || settings.points || 100),
      quiz_time_limit_seconds: Number(settings.quiz_time_limit_seconds || 1800),
      max_attempts: Number(settings.max_attempts || 1),
      randomize_questions: Boolean(settings.randomize_questions),
      randomize_choices: Boolean(settings.randomize_choices),
      random_subset_size: Number(settings.random_subset_size || 0),
      require_answer_to_advance: Boolean(settings.require_answer_to_advance),
      anti_cheat_enabled: Boolean(settings.anti_cheat_enabled),
      anti_cheat_tab_switch: Boolean(settings.anti_cheat_tab_switch),
      anti_cheat_multi_tab: Boolean(settings.anti_cheat_multi_tab),
      anti_cheat_disable_copy_paste: Boolean(settings.anti_cheat_disable_copy_paste),
      anti_cheat_fullscreen_required: Boolean(settings.anti_cheat_fullscreen_required),
      show_score_immediately: Boolean(settings.show_score_immediately),
      allow_answer_review: Boolean(settings.allow_answer_review),
      pre_exam_message: settings.pre_exam_message || "",
      publish_state: settings.publish_state || "draft",
      topic: settings.topic || "",
      sections: normalizedSections,
      course_ids: settings.course_ids || [],
      classwork_metadata: {
        pre_exam_message: settings.pre_exam_message || "",
      },
    };
    },
    [computedTotalPoints, sections, settings]
  );

  const questionNavigator = useMemo(() => {
    const seenTexts = new Map();
    let displayNumber = 0;
    return (Array.isArray(sections) ? sections : []).flatMap((section, sectionIndex) => {
      const sectionId = section?.id ?? `idx-${sectionIndex}`;
      const sectionTitle = section?.title || `Section ${sectionIndex + 1}`;
      return (Array.isArray(section?.questions) ? section.questions : []).map((question, questionIndex) => {
        displayNumber += 1;
        const questionType = String(question?.type || "multiple_choice");
        const normalizedText = normalizeQuestionText(question?.question_text);
        const anchorId = buildAnchorId(sectionId, sectionIndex, question?.id, questionIndex);
        const options = Array.isArray(question?.options)
          ? question.options.map((option) => String(option?.text || "").trim()).filter(Boolean)
          : [];
        let statusKey = "valid";
        let statusLabel = "Valid";
        if (!String(question?.question_text || "").trim()) {
          statusKey = "has_issue";
          statusLabel = "Missing text";
        } else if (questionType === "multiple_choice") {
          const answer = String(question?.correct_answer || "").trim();
          if (options.length < 2 || !answer || !options.some((option) => option.toLowerCase() === answer.toLowerCase())) {
            statusKey = "missing_answer";
            statusLabel = "Missing answer";
          }
        } else if (["short_answer", "identification"].includes(questionType) && !String(question?.correct_answer || "").trim()) {
          statusKey = "missing_answer";
          statusLabel = "Missing answer";
        }
        if (normalizedText) {
          const previous = seenTexts.get(normalizedText);
          if (previous) {
            const sameType = previous.questionType === questionType;
            const sameSection = previous.sectionId === sectionId;
            statusKey = "duplicate";
            statusLabel = sameType && sameSection ? "Duplicate warning" : "Similar text";
          } else {
            seenTexts.set(normalizedText, { questionType, sectionId });
          }
        }
        return {
          anchorId,
          displayNumber,
          sectionId,
          sectionIndex,
          sectionTitle,
          questionType,
          statusKey,
          statusLabel,
          questionText: String(question?.question_text || ""),
        };
      });
    });
  }, [sections]);

  const sectionNavigator = useMemo(
    () =>
      (Array.isArray(sections) ? sections : []).map((section, index) => ({
        id: section?.id ?? `idx-${index}`,
        title: section?.title || `Section ${index + 1}`,
        count: Array.isArray(section?.questions) ? section.questions.length : 0,
      })),
    [sections]
  );

  const firstIssueQuestion = useMemo(
    () => questionNavigator.find((item) => item.statusKey !== "valid") || null,
    [questionNavigator]
  );

  const hasBlockingIssues = useMemo(() => {
    if (!Array.isArray(sections) || sections.length === 0) return true;
    return questionNavigator.some((item) => item.statusKey === "missing_answer" || item.statusKey === "has_issue");
  }, [questionNavigator, sections]);

  const saveDraft = useCallback(
    async (manual = false) => {
      localStorage.setItem(draftKey, JSON.stringify({ settings, sections, savedAt: Date.now() }));
      try {
        await authPost(`/api/courses/${courseId}/exam-quizzes/draft/`, payload);
        isDirtyRef.current = false;
        if (manual) setStatusText("Draft saved.");
      } catch (requestError) {
        console.error(requestError);
        if (manual) setError("Failed to save draft.");
      }
    },
    [courseId, draftKey, payload, sections, settings]
  );

  const saveAssessment = useCallback(
    async (publishState = "draft") => {
      if (!String(payload.title || "").trim()) {
        setError("Exam title is required.");
        return;
      }
      if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
        setError("At least one section is required.");
        return;
      }
      const hasInvalidQuestion = payload.sections.some(
        (section) =>
          !Array.isArray(section.questions) ||
          section.questions.length === 0 ||
          section.questions.some((question) => !String(question.question_text || "").trim())
      );
      if (hasInvalidQuestion && publishState === "published") {
        setError("Cannot publish: complete all section questions first.");
        return;
      }
      if (payload.availability_start && payload.availability_end && new Date(payload.availability_end) <= new Date(payload.availability_start)) {
        setError("Cannot publish: lock time must be later than availability start.");
        return;
      }
      const questionCount = (payload.sections || []).reduce(
        (acc, section) => acc + (Array.isArray(section.questions) ? section.questions.length : 0),
        0
      );
      if (publishState === "published" && questionCount < 1) {
        setError("Cannot publish: at least one question is required.");
        return;
      }
      if (Number(payload.random_subset_size || 0) > 0 && Number(payload.random_subset_size || 0) > questionCount) {
        setError("Random subset cannot exceed total question count.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        const finalPayload = { ...payload, publish_state: publishState };
        if (mode === "edit" && initialActivityId) {
          await authPut(`/api/courses/${courseId}/exam-quizzes/${initialActivityId}/`, finalPayload);
        } else {
          await authPost(`/api/courses/${courseId}/exam-quizzes/`, finalPayload);
        }
        isDirtyRef.current = false;
        localStorage.removeItem(draftKey);
        setStatusText(publishState === "published" ? "Assessment published." : "Saved as draft.");
        navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "exams_quizzes" } });
      } catch (requestError) {
        console.error(requestError);
        const responseData = requestError?.cause || requestError?.response?.data;
        const sectionsMessage = Array.isArray(responseData?.sections)
          ? responseData.sections.join(", ")
          : typeof responseData?.sections === "string"
          ? responseData.sections
          : null;
        const backendMessage =
          (typeof responseData === "string" && responseData) ||
          sectionsMessage ||
          responseData?.detail ||
          responseData?.error ||
          responseData?.title ||
          requestError?.message ||
          null;
        setError(backendMessage ? `Failed to save assessment: ${backendMessage}` : "Failed to save assessment.");
      } finally {
        setSaving(false);
      }
    },
    [courseId, draftKey, initialActivityId, mode, navigate, payload]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      saveDraft(false);
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [saveDraft]);

  useEffect(() => {
    if (!sectionsWatchInitialized.current) {
      sectionsWatchInitialized.current = true;
      return;
    }
    isDirtyRef.current = true;
  }, [sections]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await authGet("/api/courses/");
        const courses = Array.isArray(data) ? data : [];
        setInstructorCourses(courses);
        setSettings((prev) =>
          Array.isArray(prev.course_ids) && prev.course_ids.length
            ? prev
            : { ...prev, course_ids: [Number(courseId)] }
        );
      } catch (requestError) {
        console.error(requestError);
      }
    };
    loadCourses();
  }, [courseId, setSettings]);

  const addFromQuestionBank = (questionData) => {
    if (!questionData || typeof questionData !== "object") return;
    setSections((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const targetSection = { ...next[0] };
      const clonedQuestions = [...(targetSection.questions || [])];
      clonedQuestions.push(normalizeQuestionForBuilder({ ...questionData, id: Date.now() }, clonedQuestions.length + 1));
      targetSection.questions = clonedQuestions;
      next[0] = targetSection;
      return next;
    });
    isDirtyRef.current = true;
    setShowQuestionBank(false);
  };

  const saveQuestionsToBank = async () => {
    setError("");
    try {
      const flattened = (sections || []).flatMap((section) =>
        (section.questions || []).map((question) => ({
          topic: settings.topic || section.title || "",
          difficulty: "medium",
          question_data: question,
        }))
      );
      for (const item of flattened) {
        await authPost(`/api/courses/${courseId}/question-bank/`, item);
      }
      setStatusText("Questions saved to question bank.");
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to save questions to question bank.");
    }
  };

  const handleIssueClick = useCallback((issue) => {
    const anchorId = issue?.anchorId;
    if (!anchorId) return;
    setFocusTarget({ anchorId, nonce: Date.now() });
    const target = document.getElementById(anchorId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-rose-300");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-rose-300");
    }, 1400);
  }, []);

  const jumpToQuestion = useCallback((anchorId) => {
    if (!anchorId) return;
    setFocusTarget({ anchorId, nonce: Date.now() });
    const target = document.getElementById(anchorId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-emerald-300");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-emerald-300");
    }, 1400);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-24">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            {firstIssueQuestion ? (
              <button
                type="button"
                onClick={() => jumpToQuestion(firstIssueQuestion.anchorId)}
                className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
              >
                Go to issue
              </button>
            ) : null}
          </div>
        </div>
      )}
      {statusText && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusText}</p>}

      <section className="sticky top-2 z-10 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900">Question Navigator</h2>
            <p className="mt-1 text-sm text-gray-600">
              {questionNavigator.length} question{questionNavigator.length === 1 ? "" : "s"} loaded. Jump, filter, and review without opening every editor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search question text"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {QUESTION_TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {sectionNavigator.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                const target = document.getElementById(`section-${section.id}`);
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
            >
              {section.title} ({section.count})
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {questionNavigator.map((item) => {
            const tone =
              item.statusKey === "valid"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : item.statusKey === "duplicate"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-amber-200 bg-amber-50 text-amber-700";
            return (
              <button
                key={item.anchorId}
                type="button"
                onClick={() => jumpToQuestion(item.anchorId)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
                title={`Q${item.displayNumber} ${item.questionType.replaceAll("_", " ")} - ${item.statusLabel}`}
              >
                Q{item.displayNumber}
              </button>
            );
          })}
        </div>
      </section>

      <PrePublishDiagnosticsPanel
        payload={payload}
        computedTotalPoints={computedTotalPoints}
        onIssueClick={handleIssueClick}
      />

      <ExamSettingsPanel
        settings={settings}
        onChange={onSettingsChange}
        instructorCourses={instructorCourses}
        computedTotalPoints={computedTotalPoints}
      />
      <SectionBuilder
        onOpenQuestionBank={() => setShowQuestionBank(true)}
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        focusAnchorId={focusTarget.anchorId}
        focusNonce={focusTarget.nonce}
      />

      <QuestionBankSelector
        courseId={courseId}
        open={showQuestionBank}
        onClose={() => setShowQuestionBank(false)}
        onSelect={addFromQuestionBank}
      />

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isDirtyRef.current && !window.confirm("Leave this page with unsaved changes?")) return;
              navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "exams_quizzes" } });
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/import`)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            Import Word/PDF
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(
                `exam_preview_payload_${courseId}`,
                JSON.stringify({ settings, sections })
              );
              navigate(`/instructor-dashboard/courses/${courseId}/classwork/preview`);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            Preview Exam
          </button>
          <button
            type="button"
            onClick={saveQuestionsToBank}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700"
          >
            Save Questions to Bank
          </button>
          <button type="button" onClick={() => saveDraft(true)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
            Save Draft
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveAssessment("draft")}
            disabled={saving}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => saveAssessment("published")}
            disabled={saving || hasBlockingIssues}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuizBuilderPage({ mode = "create", initialPrefill = EMPTY_PREFILL }) {
  const { courseId, id } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [initialState, setInitialState] = useState({ settings: {}, sections: [] });
  const [restoreNotice, setRestoreNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const draftKey = `exam_builder_draft_${courseId}`;
      let baseState = { settings: { course_ids: [Number(courseId)] }, sections: [] };

      try {
        if (mode === "edit" && id) {
          const data = await authGet(`/api/courses/${courseId}/exam-quizzes/${id}/`);
          baseState = {
            settings: {
              title: data.title || "",
              description: data.description || "",
              assessment_type: data.assessment_type || "quiz",
              due_date: data.due_date || "",
              availability_start: data.availability_start || "",
              availability_end: data.availability_end || "",
              points: data.points || 100,
              quiz_time_limit_seconds: data.quiz_time_limit_seconds || 1800,
              max_attempts: data.max_attempts || 1,
              randomize_questions: Boolean(data.randomize_questions),
              randomize_choices: Boolean(data.randomize_choices),
              random_subset_size: Number(data.random_subset_size || 0),
              require_answer_to_advance: Boolean(data.require_answer_to_advance),
              anti_cheat_enabled: Boolean(data.anti_cheat_enabled),
              anti_cheat_tab_switch: Boolean(data.anti_cheat_tab_switch),
              anti_cheat_multi_tab: Boolean(data.anti_cheat_multi_tab),
              anti_cheat_disable_copy_paste: Boolean(data.anti_cheat_disable_copy_paste),
              anti_cheat_fullscreen_required: Boolean(data.anti_cheat_fullscreen_required),
              show_score_immediately: Boolean(data.show_score_immediately),
              allow_answer_review: Boolean(data.allow_answer_review),
              publish_state: data.publish_state || "draft",
              topic: data.topic || "",
              pre_exam_message: data?.classwork_metadata?.pre_exam_message || "",
              course_ids: Array.isArray(data.course_ids) && data.course_ids.length ? data.course_ids : [Number(courseId)],
            },
            sections: Array.isArray(data.sections) ? data.sections : [],
          };
          baseState.sections = normalizeSectionsForBuilder(baseState.sections);
        } else {
          try {
            const draft = await authGet(`/api/courses/${courseId}/exam-quizzes/draft/`);
            baseState = {
              settings: {
                title: draft.title || "",
                description: draft.description || "",
                assessment_type: draft.assessment_type || "quiz",
                due_date: draft.due_date || "",
                availability_start: draft.availability_start || "",
                availability_end: draft.availability_end || "",
                points: draft.points || 100,
                quiz_time_limit_seconds: draft.quiz_time_limit_seconds || 1800,
                max_attempts: draft.max_attempts || 1,
                randomize_questions: Boolean(draft.randomize_questions),
                randomize_choices: Boolean(draft.randomize_choices),
                random_subset_size: Number(draft.random_subset_size || 0),
                require_answer_to_advance: Boolean(draft.require_answer_to_advance),
                anti_cheat_enabled: Boolean(draft.anti_cheat_enabled),
                anti_cheat_tab_switch: Boolean(draft.anti_cheat_tab_switch),
                anti_cheat_multi_tab: Boolean(draft.anti_cheat_multi_tab),
                anti_cheat_disable_copy_paste: Boolean(draft.anti_cheat_disable_copy_paste),
                anti_cheat_fullscreen_required: Boolean(draft.anti_cheat_fullscreen_required),
                show_score_immediately: Boolean(draft.show_score_immediately),
                allow_answer_review: Boolean(draft.allow_answer_review),
                publish_state: "draft",
                topic: draft.topic || "",
                pre_exam_message: draft.pre_exam_message || "",
                course_ids: Array.isArray(draft.course_ids) && draft.course_ids.length ? draft.course_ids : [Number(courseId)],
              },
              sections: Array.isArray(draft.sections) ? draft.sections : [],
            };
            baseState.sections = normalizeSectionsForBuilder(baseState.sections);
          } catch (_error) {
            baseState = { settings: { course_ids: [Number(courseId)] }, sections: [] };
          }

          const routePrefill = location.state?.prefill;
          const mergedPrefill = {
            ...(initialPrefill && typeof initialPrefill === "object" ? initialPrefill : {}),
            ...(routePrefill && typeof routePrefill === "object" ? routePrefill : {}),
          };
          if (Object.keys(mergedPrefill).length > 0) {
            baseState = {
              ...baseState,
              settings: {
                ...(baseState.settings || {}),
                ...mergedPrefill,
                course_ids: (baseState.settings?.course_ids || [Number(courseId)]),
              },
            };
          }
        }

        let notice = "";
        const localDraft = localStorage.getItem(draftKey);
        if (localDraft) {
          try {
            const parsed = JSON.parse(localDraft);
            baseState = {
              settings: { ...(baseState.settings || {}), ...(parsed.settings || {}) },
              sections: Array.isArray(parsed.sections) ? parsed.sections : baseState.sections,
            };
            baseState.sections = normalizeSectionsForBuilder(baseState.sections);
            notice = "Local draft restored automatically.";
          } catch {
            // ignore malformed local drafts
          }
        }

        const importedSections = localStorage.getItem(`exam_import_sections_${courseId}`);
        if (importedSections) {
          try {
            const parsedSections = JSON.parse(importedSections);
            if (Array.isArray(parsedSections) && parsedSections.length > 0) {
              baseState = {
                ...baseState,
                sections: normalizeSectionsForBuilder(parsedSections),
              };
              localStorage.removeItem(`exam_import_sections_${courseId}`);
              notice = "Imported questions loaded into builder.";
            }
          } catch {
            // ignore malformed imported sections
          }
        }
        if (location.state?.fromImport) {
          notice = "Imported questions loaded into builder.";
        }
        setRestoreNotice(notice);
      } catch (requestError) {
        console.error(requestError);
      } finally {
        setInitialState(baseState);
        setLoading(false);
      }
    };
    load();
  }, [courseId, id, initialPrefill, location.state, mode]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-emerald-950">{mode === "edit" ? "Edit Exam / Quiz" : "Create Exam / Quiz"}</h1>
          <p className="text-sm text-gray-600">Section-based builder with drafts, auto-save, and import support.</p>
          {restoreNotice ? <p className="mt-2 text-xs text-emerald-700">{restoreNotice}</p> : null}
        </header>
        <ExamBuilderProvider initialState={initialState}>
          <BuilderContent mode={mode} initialActivityId={id} />
        </ExamBuilderProvider>
      </div>
    </div>
  );
}
