import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authPost } from "../../../utils/api";

const WORKFLOW_STEPS = ["draft", "analyzing", "needs_review", "ready_for_approval", "approved"];

function confidenceColor(score) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

function riskFromScore(score) {
  if (score < 50) return "high";
  if (score < 80) return "medium";
  return "low";
}

function classifyIssue(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("ocr")) return { type: "ocr", severity: "MEDIUM", autoFixable: false };
  if (text.includes("mcq") || text.includes("does not match any option")) return { type: "mcq_mapping", severity: "HIGH", autoFixable: true };
  if (text.includes("duplicate") || text.includes("renumbered")) return { type: "numbering", severity: "HIGH", autoFixable: true };
  if (text.includes("missing answer")) return { type: "missing_answer", severity: "HIGH", autoFixable: false };
  if (text.includes("empty question") || text.includes("invalid or empty")) return { type: "empty_question", severity: "HIGH", autoFixable: true };
  if (text.includes("incomplete enumeration")) return { type: "enumeration", severity: "MEDIUM", autoFixable: false };
  return { type: "general", severity: "LOW", autoFixable: false };
}

function issueSuggestion(type) {
  switch (type) {
    case "ocr":
      return "Review line ordering and merged columns, then adjust affected question text manually.";
    case "mcq_mapping":
      return "Re-align answer key letters to valid options A-D and regenerate correct_answer_text.";
    case "numbering":
      return "Renumber questions sequentially within section and preserve original_number for traceability.";
    case "missing_answer":
      return "Add missing correct answers in answer key or set temporary placeholder for manual review.";
    case "empty_question":
      return "Merge broken OCR lines into previous question or remove empty artifacts.";
    case "enumeration":
      return "Expand enumeration answer list to satisfy required item count.";
    default:
      return "Review this issue before approval.";
  }
}

function extractQuestionNumber(message) {
  const match = String(message || "").match(/question\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function asDisplayText(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function severityTone(severity) {
  if (severity === "HIGH") return "border-rose-300 bg-rose-50 text-rose-700";
  if (severity === "MEDIUM") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-sky-300 bg-sky-50 text-sky-700";
}

function issueHeadline(issue) {
  switch (issue.type) {
    case "missing_answer":
      return "Missing answer key";
    case "mcq_mapping":
      return "Answer does not match the detected choices";
    case "numbering":
      return "Question numbering needs review";
    case "empty_question":
      return "Empty or broken question detected";
    case "ocr":
      return "Scanned text may need cleanup";
    case "enumeration":
      return "Enumeration answer looks incomplete";
    default:
      return "Review imported content";
  }
}

function issuePlainLanguage(issue) {
  if (issue.questionNumber) {
    return `Question ${issue.questionNumber} needs attention. ${issue.suggestion}`;
  }
  return issue.suggestion;
}

function normalizeSectionsShape(parsed) {
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  return sections.map((section, sectionIndex) => ({
    id: section.id ?? sectionIndex + 1,
    title: asDisplayText(section.title, `Section ${sectionIndex + 1}`),
    type: asDisplayText(section.type, "identification"),
    instructions: asDisplayText(section.instructions, ""),
    questions: Array.isArray(section.questions)
      ? section.questions.map((question, qIndex) => ({
          ...question,
          id: question.id ?? qIndex + 1,
          number: Number(question.number) || qIndex + 1,
          question_text: asDisplayText(question.question_text ?? question.question, ""),
          question: asDisplayText(question.question ?? question.question_text, ""),
          type: asDisplayText(question.type || section.type, "identification"),
          options: Array.isArray(question.options)
            ? question.options.map((option) =>
                typeof option === "object" && option !== null
                  ? { ...option, text: asDisplayText(option.text, "") }
                  : { text: asDisplayText(option, "") }
              )
            : [],
          choices: Array.isArray(question.choices) ? question.choices.map((choice) => asDisplayText(choice, "")) : [],
          correct_answer: asDisplayText(question.correct_answer, ""),
          points: Number(question.points ?? 1),
          starter_code: asDisplayText(question.starter_code, ""),
          expected_output: asDisplayText(question.expected_output, ""),
          test_cases: asDisplayText(question.test_cases, ""),
        }))
      : [],
  }));
}

function typeRuleText(type) {
  const key = String(type || "").toLowerCase();
  if (key === "multiple_choice") return "Rule: must map to one valid option (A-D).";
  if (key === "true_false") return "Rule: accepts TRUE/FALSE normalization.";
  if (key === "short_answer") return "Rule: free text; multiple valid matches can be accepted.";
  if (key === "identification") return "Rule: keyword-based matching; strict exact answer not required.";
  if (key === "enumeration") return "Rule: validates expected item count (comma/bullet/newline).";
  if (key === "essay") return "Rule: manual grading only.";
  if (key === "coding") return "Rule: problem statement stored; test-case grading can be applied later.";
  if (key === "matching") return "Rule: validates left-right pair mapping structure.";
  if (key === "file_upload") return "Rule: attachment requirement only; no text answer parsing.";
  return "Rule: general validation.";
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [jsonDraft, setJsonDraft] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [workflowState, setWorkflowState] = useState("draft");
  const [lastFile, setLastFile] = useState(null);
  const [ignoredIssues, setIgnoredIssues] = useState(new Set());
  const [appliedFixes, setAppliedFixes] = useState([]);
  const [expandedIssues, setExpandedIssues] = useState(new Set());
  const [showForceModal, setShowForceModal] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceConfirm, setForceConfirm] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  const parsedDraft = useMemo(() => {
    try {
      return JSON.parse(jsonDraft || "{}");
    } catch {
      return null;
    }
  }, [jsonDraft]);

  const normalizedSections = useMemo(() => normalizeSectionsShape(parsedDraft), [parsedDraft]);

  const summary = useMemo(() => {
    const totalQuestions = normalizedSections.reduce((sum, section) => sum + section.questions.length, 0);
    const counts = { multiple_choice: 0, true_false: 0, essay: 0, identification: 0, enumeration: 0, coding: 0 };
    let validCount = 0;
    let invalidCount = 0;
    normalizedSections.forEach((section) => {
      section.questions.forEach((question) => {
        counts[question.type] = (counts[question.type] || 0) + 1;
        if ((question.question_text || "").trim().length >= 3) validCount += 1;
        else invalidCount += 1;
      });
    });
    return { totalQuestions, counts, validCount, invalidCount };
  }, [normalizedSections]);

  const issues = useMemo(() => {
    const baseWarnings = Array.isArray(importResult?.warnings) ? importResult.warnings : warnings;
    const warningIssues = baseWarnings.map((message, index) => {
      const classification = classifyIssue(message);
      const qn = extractQuestionNumber(message);
      return {
        id: `w-${index}`,
        source: "warning",
        message: asDisplayText(message, "Unknown import warning"),
        questionNumber: qn,
        ...classification,
        suggestion: issueSuggestion(classification.type),
      };
    });

    const debug = importResult?.debug || {};
    const extraIssues = [];
    (debug.unmatched_questions || []).forEach((number) => {
      extraIssues.push({
        id: `dq-${number}`,
        source: "debug",
        message: `Unmatched question ${number}`,
        questionNumber: Number(number),
        type: "missing_answer",
        severity: "HIGH",
        autoFixable: false,
        suggestion: issueSuggestion("missing_answer"),
      });
    });
    (debug.unmatched_answers || []).forEach((number) => {
      extraIssues.push({
        id: `da-${number}`,
        source: "debug",
        message: `Unmatched answer ${number}`,
        questionNumber: null,
        type: "general",
        severity: "MEDIUM",
        autoFixable: false,
        suggestion: "Verify answer key numbering alignment.",
      });
    });
    (debug.duplicate_numbers || []).forEach((number) => {
      extraIssues.push({
        id: `dd-${number}`,
        source: "debug",
        message: `Duplicate question number ${number}`,
        questionNumber: Number(number),
        type: "numbering",
        severity: "HIGH",
        autoFixable: true,
        suggestion: issueSuggestion("numbering"),
      });
    });

    const seen = new Set();
    return [...warningIssues, ...extraIssues].filter((issue) => {
      const key = `${issue.message}|${issue.questionNumber}|${issue.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return !ignoredIssues.has(issue.id);
    });
  }, [importResult, warnings, ignoredIssues]);

  const unresolvedIssues = issues.length;
  const autoFixableIssues = issues.filter((issue) => issue.autoFixable).length;
  const manualReviewIssues = issues.filter((issue) => !issue.autoFixable).length;
  const criticalIssues = issues.filter((issue) => issue.severity === "HIGH").length;
  const resolvedIssues = appliedFixes.length + ignoredIssues.size;
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) || issues[0] || null;
  const selectedIssueIndex = selectedIssue ? issues.findIndex((issue) => issue.id === selectedIssue.id) : -1;
  const selectedQuestion = selectedIssue?.questionNumber
    ? normalizedSections.flatMap((section) => section.questions).find((question) => question.number === selectedIssue.questionNumber) || null
    : null;
  const selectedSection = selectedQuestion
    ? normalizedSections.find((section) => section.questions.some((question) => question.number === selectedQuestion.number)) || null
    : null;

  const confidenceScore = Number(importResult?.confidence_score ?? 0);
  const riskLevel = String(importResult?.risk_level || riskFromScore(confidenceScore)).toLowerCase();
  const requiresReview = Boolean(importResult?.requires_review ?? unresolvedIssues > 0);
  const importBlocked = confidenceScore < 50 || requiresReview || riskLevel === "high";

  const workflowStepIndex = useMemo(() => {
    if (workflowState === "analyzing") return 1;
    if (workflowState === "approved") return 4;
    if (!importResult) return 0;
    if (importBlocked) return 2;
    return 3;
  }, [workflowState, importResult, importBlocked]);

  const updateDraftSections = (transformer) => {
    try {
      const parsed = JSON.parse(jsonDraft || "{}");
      const sections = normalizeSectionsShape(parsed);
      const nextSections = transformer(sections);
      const structured = { sections: nextSections };
      setJsonDraft(JSON.stringify(structured, null, 2));
      refreshLocalValidation(nextSections);
    } catch {
      setError("Invalid JSON. Fix the advanced draft before continuing.");
    }
  };

  const runImport = async (file) => {
    if (!file) return;
    setWorkflowState("analyzing");
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "balanced");
      const result = await authPost(`/api/courses/${courseId}/exam-quizzes/import/`, formData);
      const structured = { sections: result.sections || [] };
      const normalizedWarnings = Array.isArray(result.warnings) ? result.warnings : [];
      setWarnings(normalizedWarnings);
      setImportResult(result);
      setJsonDraft(JSON.stringify(structured, null, 2));
      setWorkflowState(
        normalizedWarnings.length || Number(result.confidence_score ?? 0) < 80 ? "needs_review" : "ready_for_approval"
      );
      setIgnoredIssues(new Set());
      setAppliedFixes([]);
      setSelectedIssueId(null);
    } catch (requestError) {
      console.error(requestError);
      setError("Import failed. Please check the file format.");
      setWorkflowState("draft");
    } finally {
      setLoading(false);
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLastFile(file);
    await runImport(file);
    event.target.value = "";
  };

  const refreshLocalValidation = (sections) => {
    const unresolved = issues.filter((issue) => !ignoredIssues.has(issue.id));
    const nextResult = {
      ...(importResult || {}),
      sections,
      data: { sections },
      warnings: unresolved.map((issue) => issue.message),
      confidence_score: importResult?.confidence_score ?? 0,
      debug: importResult?.debug || {},
      risk_level: importResult?.risk_level || riskFromScore(importResult?.confidence_score ?? 0),
      requires_review: unresolved.length > 0,
    };
    setImportResult(nextResult);
    setWarnings(nextResult.warnings || []);
  };

  const applyIssueFix = (issue) => {
    if (!issue.autoFixable) return;
    try {
      const parsed = JSON.parse(jsonDraft || "{}");
      const sections = normalizeSectionsShape(parsed);
      if (issue.type === "numbering") {
        sections.forEach((section) => {
          section.questions.forEach((question, index) => {
            question.number = index + 1;
            question.id = index + 1;
          });
        });
      } else if (issue.type === "mcq_mapping") {
        sections.forEach((section) => {
          section.questions.forEach((question) => {
            if (question.type !== "multiple_choice") return;
            const token = String(question.correct_answer || "").trim().toUpperCase();
            if (/^[A-D]$/.test(token)) return;
            const optionTexts = question.options.map((opt) => String(opt.text || "").trim());
            const directIndex = optionTexts.findIndex((text) => text.toLowerCase() === token.toLowerCase());
            if (directIndex >= 0) question.correct_answer = String.fromCharCode(65 + directIndex);
          });
        });
      } else if (issue.type === "empty_question") {
        sections.forEach((section) => {
          section.questions = section.questions.filter((question) => (question.question_text || "").trim().length >= 3);
        });
      }
      const structured = { sections };
      setJsonDraft(JSON.stringify(structured, null, 2));
      setAppliedFixes((prev) => [...prev, issue.id]);
      setSelectedIssueId(issue.id);
      refreshLocalValidation(sections);
    } catch {
      setError("Failed to apply fix. Please review JSON manually.");
    }
  };

  const applyAllFixes = () => {
    issues.filter((issue) => issue.autoFixable).forEach((issue) => applyIssueFix(issue));
  };

  const rerunValidation = async () => {
    if (lastFile) {
      await runImport(lastFile);
      return;
    }
    if (!parsedDraft) {
      setError("Invalid JSON draft. Fix syntax before re-running validation.");
      return;
    }
    refreshLocalValidation(normalizeSectionsShape(parsedDraft));
    setWorkflowState(importBlocked ? "needs_review" : "ready_for_approval");
  };

  const downloadErrorReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      workflow_state: workflowState,
      confidence_score: confidenceScore,
      risk_level: riskLevel,
      requires_review: requiresReview,
      warnings,
      issues,
      debug: importResult?.debug || {},
      applied_fixes: appliedFixes,
      ignored_issues: Array.from(ignoredIssues),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `import-report-${courseId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const toggleIssueExpand = (id) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markIgnoreIssue = (id) => {
    setIgnoredIssues((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (selectedIssueId === id) {
      setSelectedIssueId(null);
    }
  };

  const goToQuestion = (questionNumber) => {
    if (!questionNumber) return;
    const element = document.getElementById(`import-question-${questionNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-indigo-400");
      setTimeout(() => element.classList.remove("ring-2", "ring-indigo-400"), 1200);
    }
  };

  const updateQuestionField = (questionNumber, field, value) => {
    updateDraftSections((sections) =>
      sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if (question.number !== questionNumber) return question;
          const nextQuestion = { ...question, [field]: value };
          if (field === "question_text") {
            nextQuestion.question = value;
          }
          if (field === "question") {
            nextQuestion.question_text = value;
          }
          return nextQuestion;
        }),
      }))
    );
  };

  const updateQuestionOption = (questionNumber, optionIndex, value) => {
    updateDraftSections((sections) =>
      sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if (question.number !== questionNumber) return question;
          const nextOptions = Array.isArray(question.options) ? [...question.options] : [];
          const currentOption = nextOptions[optionIndex] || {};
          nextOptions[optionIndex] = { ...currentOption, text: value };
          return { ...question, options: nextOptions };
        }),
      }))
    );
  };

  const addQuestionOption = (questionNumber) => {
    updateDraftSections((sections) =>
      sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if (question.number !== questionNumber) return question;
          const nextOptions = Array.isArray(question.options) ? [...question.options] : [];
          nextOptions.push({ text: "" });
          return { ...question, options: nextOptions };
        }),
      }))
    );
  };

  const removeQuestionOption = (questionNumber, optionIndex) => {
    updateDraftSections((sections) =>
      sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if (question.number !== questionNumber) return question;
          const nextOptions = (Array.isArray(question.options) ? question.options : []).filter((_, index) => index !== optionIndex);
          return { ...question, options: nextOptions };
        }),
      }))
    );
  };

  const updateSectionField = (sectionId, field, value) => {
    updateDraftSections((sections) =>
      sections.map((section) => (section.id === sectionId ? { ...section, [field]: value } : section))
    );
  };

  const resolveIssueFromReview = (issue) => {
    if (!issue) return;
    setAppliedFixes((prev) => (prev.includes(issue.id) ? prev : [...prev, issue.id]));
    markIgnoreIssue(issue.id);
  };

  const reviewNextIssue = () => {
    if (!issues.length) {
      setSelectedIssueId(null);
      return;
    }
    if (!selectedIssue) {
      setSelectedIssueId(issues[0].id);
      return;
    }
    const nextIssue = issues[selectedIssueIndex + 1] || issues[0];
    setSelectedIssueId(nextIssue.id);
  };

  const applyToBuilder = (force = false) => {
    if (!force && importBlocked) {
      setShowForceModal(true);
      return;
    }
    try {
      const parsed = JSON.parse(jsonDraft || "{}");
      const importedSections = Array.isArray(parsed.sections) ? parsed.sections : [];
      localStorage.setItem(`exam_import_sections_${courseId}`, JSON.stringify(importedSections));

      const draftKey = `exam_builder_draft_${courseId}`;
      const existingDraft = JSON.parse(localStorage.getItem(draftKey) || "{}");
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          settings: {
            ...(existingDraft.settings || {}),
            course_ids: Array.isArray(existingDraft.settings?.course_ids) ? existingDraft.settings.course_ids : [Number(courseId)],
          },
          sections: importedSections,
          savedAt: Date.now(),
        })
      );

      navigate(`/instructor-dashboard/courses/${courseId}/classwork/create`, {
        state: { fromImport: true },
      });
      setWorkflowState("approved");
    } catch {
      setError("Invalid JSON. Fix the manual corrections first.");
    }
  };

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-emerald-950">Import Exam Questions</h1>
          <p className="text-sm text-gray-600">Analyze -> Recommend -> Fix -> Approve -> Publish</p>
          <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step} className={`rounded border px-2 py-1 text-center ${index <= workflowStepIndex ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-500"}`}>
                {step.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
              </div>
            ))}
          </div>
        </header>

        <div className="sticky top-2 z-10 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16">
                  <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <path
                    d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
                    fill="none"
                    stroke={confidenceScore >= 80 ? "#16a34a" : confidenceScore >= 50 ? "#d97706" : "#dc2626"}
                    strokeWidth="3"
                    strokeDasharray={`${Math.max(0, Math.min(100, confidenceScore))}, 100`}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${confidenceColor(confidenceScore)}`}>
                  {confidenceScore}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">Import Health</p>
                <p className="text-gray-600">
                  {summary.totalQuestions || 0} questions found, {unresolvedIssues} issue{unresolvedIssues === 1 ? "" : "s"} to review, {criticalIssues} critical.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={applyAllFixes} disabled={!autoFixableIssues} className="rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                Fix All Auto-Correctable Issues
              </button>
              <button type="button" onClick={rerunValidation} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
                Re-run Validation
              </button>
              <button type="button" onClick={downloadErrorReport} disabled={!issues.length} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                Download Error Report
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
                {loading ? "Analyzing..." : "Choose Word/PDF File"}
                <input type="file" accept=".docx,.pdf" onChange={importFile} className="hidden" disabled={loading} />
              </label>
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
              {importBlocked ? (
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">
                  Import Blocked: Critical Issues Detected
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-700">Ready for approval.</div>
              )}
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Summary Intelligence</h2>
              <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <p>Total Questions: <span className="font-semibold">{summary.totalQuestions}</span></p>
                <p>MCQ: <span className="font-semibold">{summary.counts.multiple_choice || 0}</span></p>
                <p>True/False: <span className="font-semibold">{summary.counts.true_false || 0}</span></p>
                <p>Essay: <span className="font-semibold">{summary.counts.essay || 0}</span></p>
                <p>Identification: <span className="font-semibold">{summary.counts.identification || 0}</span></p>
                <p>Enumeration: <span className="font-semibold">{summary.counts.enumeration || 0}</span></p>
                <p>Coding: <span className="font-semibold">{summary.counts.coding || 0}</span></p>
                <p>Valid: <span className="font-semibold">{summary.validCount}</span></p>
                <p>Invalid: <span className="font-semibold">{summary.invalidCount}</span></p>
                <p>Auto-fixable Issues: <span className="font-semibold">{autoFixableIssues}</span></p>
                <p>Manual Review: <span className="font-semibold">{manualReviewIssues}</span></p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Review Detected Issues</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Resolved {resolvedIssues} issue{resolvedIssues === 1 ? "" : "s"} so far. Finish critical items before approving the import.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <p>Critical: {criticalIssues}</p>
                  <p>Needs review: {manualReviewIssues}</p>
                  <p>Auto-fix suggestions: {autoFixableIssues}</p>
                </div>
              </div>
              {!issues.length ? <p className="text-sm text-gray-500">No issues detected.</p> : null}
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div key={issue.id} className={`rounded-lg border p-3 ${severityTone(issue.severity)} ${selectedIssue?.id === issue.id ? "ring-2 ring-indigo-200" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{issueHeadline(issue)}</p>
                        <p className="text-sm text-gray-700">{issue.message}</p>
                        <p className="text-xs text-gray-600">
                          {issue.questionNumber ? `Question ${issue.questionNumber}` : "Import-wide review"} | Severity: {issue.severity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedIssueId(issue.id)} className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700">
                          Review
                        </button>
                        <button type="button" onClick={() => applyIssueFix(issue)} disabled={!issue.autoFixable} className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                          Accept Suggestion
                        </button>
                        <button type="button" onClick={() => markIgnoreIssue(issue.id)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
                          Skip
                        </button>
                        <button type="button" onClick={() => toggleIssueExpand(issue.id)} className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700">
                          View Details
                        </button>
                      </div>
                    </div>
                    {expandedIssues.has(issue.id) ? (
                      <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">
                        <p>{issuePlainLanguage(issue)}</p>
                        {issue.questionNumber ? (
                          <button type="button" onClick={() => goToQuestion(issue.questionNumber)} className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
                            Jump to Question {issue.questionNumber}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Question Preview</h2>
              <div className="space-y-3">
                {normalizedSections.map((section) => (
                  <div key={`section-${section.id}`} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                    <p className="mb-2 text-xs text-gray-500">Type: {section.type}</p>
                    <div className="space-y-2">
                      {section.questions.map((question) => {
                        const relatedIssues = issues.filter((issue) => issue.questionNumber === question.number);
                        const level = relatedIssues.some((issue) => issue.severity === "HIGH")
                          ? "critical"
                          : relatedIssues.some((issue) => issue.severity === "MEDIUM")
                            ? "warning"
                            : "info";
                        return (
                          <div
                            key={`q-${section.id}-${question.number}`}
                            id={`import-question-${question.number}`}
                            className={`rounded border p-2 ${level === "critical" ? "border-rose-300 bg-rose-50" : level === "warning" ? "border-amber-300 bg-amber-50" : "border-sky-200 bg-sky-50"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900">
                                Q{question.number}. {question.question_text}
                              </p>
                              <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700">
                                {level === "critical" ? "Critical" : level === "warning" ? "Warning" : "Info"}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-600">{typeRuleText(question.type)}</p>
                            {relatedIssues.length ? (
                              <details className="mt-2 text-xs text-gray-700">
                                <summary className="cursor-pointer">Show Issue Details / Suggested Fix</summary>
                                <ul className="mt-1 space-y-1">
                                  {relatedIssues.map((issue) => (
                                    <li key={`rq-${issue.id}`}>{issue.message} -> {issue.suggestion}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Import Findings</h2>
              <div className="space-y-1 text-sm text-gray-700">
                <p>Questions needing review: <span className="font-semibold">{manualReviewIssues}</span></p>
                <p>Critical blockers: <span className="font-semibold">{criticalIssues}</span></p>
                <p>Auto-fix suggestions: <span className="font-semibold">{autoFixableIssues}</span></p>
                <p>Detected sections: <span className="font-semibold">{(importResult?.debug?.detected_sections || []).length}</span></p>
                <p>OCR concerns: <span className="font-semibold">{issues.some((issue) => issue.type === "ocr") ? "Detected" : "None"}</span></p>
              </div>
              <button type="button" onClick={() => setShowRawJson((prev) => !prev)} className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
                {showRawJson ? "Hide Advanced Data" : "Advanced: View Raw JSON"}
              </button>
              {showRawJson ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-700">
                  {JSON.stringify(importResult || {}, null, 2)}
                </pre>
              ) : null}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Guided Review</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Review one issue at a time. Changes here update the same import draft already used by your current workflow.
                </p>
              </div>
              {selectedIssue ? (
                <div className="space-y-4">
                  <div className={`rounded-lg border p-3 ${severityTone(selectedIssue.severity)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{issueHeadline(selectedIssue)}</p>
                        <p className="text-xs text-gray-600">
                          Issue {selectedIssueIndex + 1} of {issues.length}
                        </p>
                      </div>
                      <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold">
                        {selectedIssue.severity === "HIGH" ? "Critical" : selectedIssue.severity === "MEDIUM" ? "Needs Review" : "Info"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{selectedIssue.message}</p>
                    <p className="mt-1 text-xs text-gray-600">{issuePlainLanguage(selectedIssue)}</p>
                  </div>

                  {selectedQuestion ? (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="grid gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Section title</label>
                          <input
                            type="text"
                            value={selectedSection?.title || ""}
                            onChange={(event) => selectedSection && updateSectionField(selectedSection.id, "title", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Question text</label>
                          <textarea
                            rows={4}
                            value={selectedQuestion.question_text || ""}
                            onChange={(event) => updateQuestionField(selectedQuestion.number, "question_text", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Question type</label>
                            <select
                              value={selectedQuestion.type || "identification"}
                              onChange={(event) => updateQuestionField(selectedQuestion.number, "type", event.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="true_false">True or False</option>
                              <option value="identification">Identification</option>
                              <option value="enumeration">Enumeration</option>
                              <option value="essay">Essay</option>
                              <option value="coding">Coding</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Correct answer</label>
                            <input
                              type="text"
                              value={selectedQuestion.correct_answer || ""}
                              onChange={(event) => updateQuestionField(selectedQuestion.number, "correct_answer", event.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        {selectedQuestion.type === "multiple_choice" ? (
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Choices</label>
                              <button type="button" onClick={() => addQuestionOption(selectedQuestion.number)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">
                                Add Choice
                              </button>
                            </div>
                            <div className="space-y-2">
                              {(selectedQuestion.options || []).map((option, optionIndex) => (
                                <div key={`selected-option-${optionIndex}`} className="flex items-center gap-2">
                                  <span className="w-6 text-sm font-semibold text-gray-500">{String.fromCharCode(65 + optionIndex)}.</span>
                                  <input
                                    type="text"
                                    value={option?.text || ""}
                                    onChange={(event) => updateQuestionOption(selectedQuestion.number, optionIndex, event.target.value)}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                  />
                                  <button type="button" onClick={() => removeQuestionOption(selectedQuestion.number, optionIndex)} className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-lg border border-indigo-100 bg-white p-3 text-xs text-gray-700">
                          <p className="font-semibold text-gray-900">Suggested action</p>
                          <p className="mt-1">{selectedIssue.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                      This issue is import-wide. Review the issue details, use the suggested fix if available, or continue after checking the preview below.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyIssueFix(selectedIssue)}
                      disabled={!selectedIssue.autoFixable}
                      className="rounded border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Accept Suggestion
                    </button>
                    <button type="button" onClick={() => resolveIssueFromReview(selectedIssue)} className="rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700">
                      Mark Resolved
                    </button>
                    <button type="button" onClick={reviewNextIssue} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
                      Save and Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  No review items are selected. Upload a file or choose an issue from the list to start guided correction.
                </div>
              )}

              <details className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">Advanced manual JSON editor</summary>
                <textarea
                  rows={12}
                  value={jsonDraft}
                  onChange={(event) => setJsonDraft(event.target.value)}
                  placeholder='{"sections":[{"title":"Section 1","questions":[...]}]}'
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                />
              </details>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/instructor-dashboard/courses/${courseId}/classwork/create`)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
                >
                  Back to Builder
                </button>
                <button
                  type="button"
                  onClick={() => applyToBuilder(false)}
                  disabled={importBlocked}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Approve & Use in Builder
                </button>
                {importBlocked ? (
                  <button
                    type="button"
                    onClick={() => setShowForceModal(true)}
                    className="rounded border border-rose-400 px-3 py-1.5 text-sm font-medium text-rose-700"
                  >
                    Force Import
                  </button>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        {showForceModal ? (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Force Import Override</h3>
              <p className="mt-1 text-sm text-gray-600">Provide reason and confirm risk acknowledgment to continue.</p>
              <textarea
                rows={4}
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Reason for override..."
              />
              <label className="mt-2 flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={forceConfirm} onChange={(event) => setForceConfirm(event.target.checked)} />
                <span>I understand risks of importing invalid questions.</span>
              </label>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForceModal(false)} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!forceReason.trim() || !forceConfirm}
                  onClick={() => {
                    setShowForceModal(false);
                    applyToBuilder(true);
                  }}
                  className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Confirm Force Import
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
