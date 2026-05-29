import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const POINTS_CAP = 1000;

const normalizeQuestionText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const parseDateValue = (value) => {
  if (!value) return { date: null, invalid: false };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, invalid: true };
  return { date, invalid: false };
};

const buildAnchorId = (sectionId, sectionIndex, questionId, questionIndex) =>
  `question-${sectionId ?? `idx-${sectionIndex}`}-${questionId ?? `idx-${sectionIndex}-${questionIndex}`}`;

const createIssue = ({ severity, message, sectionId = null, questionId = null, anchorId = null }) => ({
  id: `${severity}-${sectionId ?? "global"}-${questionId ?? "none"}-${message}`,
  severity,
  message,
  sectionId,
  questionId,
  anchorId,
});

function DiagnosticList({ title, issues, emptyText, className, onIssueClick }) {
  return (
    <article className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide">{title} ({issues.length})</p>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {issues.map((issue) => (
            <li key={issue.id}>
              <div className="flex items-start justify-between gap-2 rounded px-1 py-0.5 hover:bg-black/5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onIssueClick?.(issue)}
                >
                  {issue.message}
                </button>
                {issue.anchorId ? (
                  <button
                    type="button"
                    onClick={() => onIssueClick?.(issue)}
                    className="shrink-0 rounded border border-current/30 px-2 py-0.5 text-[11px] font-medium"
                  >
                    Go to question
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function PrePublishDiagnosticsPanel({ payload, computedTotalPoints = 0, onIssueClick }) {
  const diagnostics = useMemo(() => {
    const blockingIssues = [];
    const highIssues = [];
    const advisoryIssues = [];
    const infos = [];

    const sections = Array.isArray(payload?.sections) ? payload.sections : [];
    const sectionCount = sections.length;

    let questionCount = 0;
    let globalQuestionNumber = 0;
    const questionIdSeen = new Set();
    const questionTextSeen = new Map();

    if (sectionCount === 0) {
      blockingIssues.push(createIssue({ severity: "blocking", message: "Add at least one section before publishing." }));
    }

    sections.forEach((section, sectionIndex) => {
      const sectionId = section?.id ?? null;
      const sectionQuestions = Array.isArray(section?.questions) ? section.questions : [];
      questionCount += sectionQuestions.length;

      if (sectionQuestions.length === 0) {
        blockingIssues.push(
          createIssue({
            severity: "blocking",
            message: `Section ${sectionIndex + 1} has no questions.`,
            sectionId,
            anchorId: `section-${sectionId ?? `idx-${sectionIndex}`}`,
          })
        );
      }

      sectionQuestions.forEach((question, questionIndex) => {
        globalQuestionNumber += 1;
        const questionId = question?.id ?? null;
        const questionType = String(question?.type || "multiple_choice");
        const anchorId = buildAnchorId(sectionId, sectionIndex, questionId, questionIndex);
        const questionText = String(question?.question_text || "").trim();

        if (!questionText) {
          blockingIssues.push(
            createIssue({
              severity: "blocking",
              message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} has empty question text.`,
              sectionId,
              questionId,
              anchorId,
            })
          );
        }

        if (questionId !== null && questionId !== undefined && questionId !== "") {
          const idKey = String(questionId);
          if (questionIdSeen.has(idKey)) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Duplicate question id detected: ${idKey}.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          } else {
            questionIdSeen.add(idKey);
          }
        }

        const normalizedText = normalizeQuestionText(questionText);
        if (normalizedText) {
          const firstSeen = questionTextSeen.get(normalizedText);
          if (firstSeen) {
            const currentTypeLabel = questionType.replaceAll("_", " ");
            const sameType = firstSeen.questionType === questionType;
            const sameSection = firstSeen.sectionId === sectionId;
            const issuePayload = {
              sectionId,
              questionId,
              anchorId,
              message: sameType && sameSection
                ? `Possible duplicate question text: Q${firstSeen.displayNumber} ${firstSeen.typeLabel} and Q${globalQuestionNumber} ${currentTypeLabel}.`
                : `Similar question text detected: Q${firstSeen.displayNumber} ${firstSeen.typeLabel} and Q${globalQuestionNumber} ${currentTypeLabel}. This may be intentional.`,
            };
            if (sameType && sameSection) {
              highIssues.push(createIssue({ severity: "high", ...issuePayload }));
            } else {
              advisoryIssues.push(createIssue({ severity: "advisory", ...issuePayload }));
            }
          } else {
            questionTextSeen.set(normalizedText, {
              sectionId,
              questionType,
              typeLabel: questionType.replaceAll("_", " "),
              displayNumber: globalQuestionNumber,
            });
          }
        }

        const rawPoints = question?.points;
        const numericPoints = Number(rawPoints);
        if (!Number.isFinite(numericPoints) || numericPoints < 0) {
          blockingIssues.push(
            createIssue({
              severity: "blocking",
              message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} must have a finite points value >= 0.`,
              sectionId,
              questionId,
              anchorId,
            })
          );
        } else if (numericPoints > POINTS_CAP) {
          highIssues.push(
            createIssue({
              severity: "high",
              message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} has unusually high points (${numericPoints}).`,
              sectionId,
              questionId,
              anchorId,
            })
          );
        }

        if (questionType === "multiple_choice") {
          const optionTexts = Array.isArray(question?.options)
            ? question.options.map((option) => String(option?.text || "").trim()).filter(Boolean)
            : [];
          const optionCount = optionTexts.length;
          const answerValue = String(question?.correct_answer || "").trim();
          if (optionCount < 2) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (Multiple Choice) needs at least two options.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
          if (!String(question?.correct_answer || "").trim()) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (Multiple Choice) is missing correct_answer.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          } else if (!optionTexts.some((text) => text.toLowerCase() === answerValue.toLowerCase())) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (Multiple Choice) correct answer must match one option value.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
        }

        if (questionType === "true_false") {
          const normalizedAnswer = String(question?.correct_answer || "").trim().toLowerCase();
          if (!normalizedAnswer || (normalizedAnswer !== "true" && normalizedAnswer !== "false")) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (True/False) must set correct_answer to true or false.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
        }

        if (["short_answer", "identification"].includes(questionType)) {
          if (!String(question?.correct_answer || "").trim()) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (${questionType.replace("_", " ")}) is missing correct_answer.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
        }

        if (questionType === "enumeration") {
          const enumAnswers = Array.isArray(question?.enumeration_answers)
            ? question.enumeration_answers.filter((item) => String(item || "").trim())
            : [];
          if (enumAnswers.length < 1 && !String(question?.correct_answer || "").trim()) {
            advisoryIssues.push(
              createIssue({
                severity: "advisory",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (enumeration) has no answer key; manual review recommended.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
        }

        if (questionType === "matching") {
          const matchingPairs = Array.isArray(question?.matching_pairs)
            ? question.matching_pairs.filter(
                (pair) => String(pair?.left || "").trim() && String(pair?.right || "").trim()
              )
            : [];
          if (matchingPairs.length < 2) {
            blockingIssues.push(
              createIssue({
                severity: "blocking",
                message: `Section ${sectionIndex + 1}, Question ${questionIndex + 1} (Matching) needs at least two complete pairs.`,
                sectionId,
                questionId,
                anchorId,
              })
            );
          }
        }
      });
    });

    const subsetSize = Number(payload?.random_subset_size || 0);
    if (!Number.isFinite(subsetSize) || subsetSize < 0) {
      blockingIssues.push(
        createIssue({
          severity: "blocking",
          message: "Random question subset must be a finite number greater than or equal to 0.",
        })
      );
    } else if (subsetSize > 0 && subsetSize > questionCount) {
      blockingIssues.push(
        createIssue({
          severity: "blocking",
          message: "Random question subset cannot exceed the total number of questions.",
        })
      );
    }

    const startParsed = parseDateValue(payload?.availability_start);
    const endParsed = parseDateValue(payload?.availability_end);
    if (startParsed.invalid) {
      blockingIssues.push(createIssue({ severity: "blocking", message: "Availability start has an invalid datetime value." }));
    }
    if (endParsed.invalid) {
      blockingIssues.push(createIssue({ severity: "blocking", message: "Exam lock time has an invalid datetime value." }));
    }
    if (startParsed.date && endParsed.date && endParsed.date <= startParsed.date) {
      blockingIssues.push(createIssue({ severity: "blocking", message: "Exam lock time must be later than availability start." }));
    }

    const antiCheatEnabled = Boolean(payload?.anti_cheat_enabled);
    const antiCheatSubflags = [
      Boolean(payload?.anti_cheat_tab_switch),
      Boolean(payload?.anti_cheat_multi_tab),
      Boolean(payload?.anti_cheat_disable_copy_paste),
      Boolean(payload?.anti_cheat_fullscreen_required),
    ];
    if (!antiCheatEnabled && antiCheatSubflags.some(Boolean)) {
      blockingIssues.push(createIssue({ severity: "blocking", message: "Enable anti-cheat before turning on anti-cheat sub-options." }));
    }

    if (!String(payload?.pre_exam_message || "").trim()) {
      advisoryIssues.push(createIssue({ severity: "advisory", message: "Consider adding a pre-exam acknowledgment message for students." }));
    }

    if (questionCount > 0 && Number(computedTotalPoints || 0) <= 0) {
      highIssues.push(createIssue({ severity: "high", message: "All question points are currently 0. Students may receive 0 / 0 scoring." }));
    }

    infos.push(`Sections: ${sectionCount}`);
    infos.push(`Questions: ${questionCount}`);
    infos.push(`Computed Total Points: ${Number(computedTotalPoints || 0)}`);

    return { blockingIssues, highIssues, advisoryIssues, infos };
  }, [computedTotalPoints, payload]);

  const { blockingIssues, highIssues, advisoryIssues, infos } = diagnostics;
  const hasBlocking = blockingIssues.length > 0;
  const hasReview = highIssues.length > 0 || advisoryIssues.length > 0;

  const readiness = hasBlocking
    ? { label: "Fix Required", classes: "bg-red-100 text-red-800", icon: AlertTriangle }
    : hasReview
    ? { label: "Needs Review", classes: "bg-amber-100 text-amber-800", icon: AlertTriangle }
    : { label: "Ready to Publish", classes: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 };

  const ReadinessIcon = readiness.icon;

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900">Pre-Publish Diagnostics</h2>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${readiness.classes}`}>
          <ReadinessIcon className="h-3.5 w-3.5" /> {readiness.label}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DiagnosticList
          title="Blocking"
          issues={blockingIssues}
          emptyText="No blocking issues found."
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
          onIssueClick={onIssueClick}
        />
        <DiagnosticList
          title="High"
          issues={highIssues}
          emptyText="No high-priority warnings."
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"
          onIssueClick={onIssueClick}
        />
        <DiagnosticList
          title="Advisory"
          issues={advisoryIssues}
          emptyText="No advisories."
          className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800"
          onIssueClick={onIssueClick}
        />
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide" title="Live summary of current draft state.">
            <Info className="h-3.5 w-3.5" /> Summary
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {infos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
