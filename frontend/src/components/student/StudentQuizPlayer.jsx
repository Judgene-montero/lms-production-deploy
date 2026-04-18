import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authGet, authPost } from "../../utils/api";
import PreExamConsentModal from "./PreExamConsentModal";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const normalizeQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : []).map((question, index) => ({
    id: question?.id ?? index + 1,
    question_text: question?.question_text || question?.text || `Question ${index + 1}`,
    type: String(question?.type || "short_answer").toLowerCase(),
    options: Array.isArray(question?.options) ? question.options : [],
    points: Number(question?.points || 1),
    language: String(question?.language || "javascript").toLowerCase(),
    starter_code: String(question?.starter_code || ""),
    formula_input: String(question?.formula_input || ""),
    correct_formula: String(question?.correct_formula || ""),
    enumeration_answers: Array.isArray(question?.enumeration_answers) ? question.enumeration_answers : [],
    expected_count: Number(question?.expected_count || 0),
  }));

const getEnumerationSlotCount = (question) => {
  const explicitCount = Number(question?.expected_count || 0);
  if (explicitCount > 0) return explicitCount;
  const answerCount = Array.isArray(question?.enumeration_answers) ? question.enumeration_answers.length : 0;
  return Math.max(answerCount, 1);
};

const getAnswerItems = (question, rawAnswer) => {
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

const hasQuestionAnswer = (question, rawAnswer) => {
  if (question?.type === "enumeration") {
    return getAnswerItems(question, rawAnswer).some((value) => String(value || "").trim());
  }
  return String(rawAnswer || "").trim().length > 0;
};

const editorExtensionsByLanguage = {
  javascript: [javascript({ jsx: true })],
  typescript: [javascript({ typescript: true, jsx: true })],
  python: [python()],
  cpp: [cpp()],
  c: [cpp()],
  java: [java()],
};

export default function StudentQuizPlayer({ courseId, activity, onSubmitted, onAttemptsLoaded }) {
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [forceSubmitTick, setForceSubmitTick] = useState(0);
  const [violationInfo, setViolationInfo] = useState(null);
  const [missingQuestions, setMissingQuestions] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const timerIntervalRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  const submitLockRef = useRef(false);
  const forceSubmitTriggeredRef = useRef(false);
  const tabIdRef = useRef(`quiz-tab-${Date.now()}-${Math.random()}`);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const runTimer = useCallback(
    (endAt) => {
      stopTimer();
      const tick = () => {
        const remaining = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
        setTimeRemaining(remaining);
      };
      tick();
      timerIntervalRef.current = setInterval(tick, 1000);
    },
    [stopTimer]
  );

  const hydrateTimerFromAttempt = useCallback(
    (timeLimitSeconds, startedAtValue) => {
      const safeLimit = Math.max(1, Number(timeLimitSeconds || 600));
      const startedAtMs = startedAtValue ? new Date(startedAtValue).getTime() : NaN;
      const endAt = Number.isFinite(startedAtMs) ? startedAtMs + safeLimit * 1000 : Date.now() + safeLimit * 1000;
      runTimer(endAt);
    },
    [runTimer]
  );

  const reportSecurityEvent = useCallback(
    async (eventType, details = {}) => {
      if (!quiz?.anti_cheat_enabled || !attemptId) return;
      try {
        const eventPayload = await authPost(`/api/courses/${courseId}/exam-quizzes/${activity.id}/security-events/`, {
          event_type: eventType,
          attempt_id: attemptId,
          details,
        });
        if (eventPayload?.violation_count !== undefined && eventPayload?.force_submit_threshold) {
          setViolationInfo({
            count: Number(eventPayload.violation_count || 0),
            threshold: Number(eventPayload.force_submit_threshold || 0),
          });
          const remaining = Math.max(
            Number(eventPayload.force_submit_threshold || 0) - Number(eventPayload.violation_count || 0),
            0
          );
          setWarning(`Warning: ${eventType.replace(/_/g, " ")} detected (${eventPayload.violation_count}/${eventPayload.force_submit_threshold}). Remaining: ${remaining}`);
        }
        if (eventPayload?.attempt_locked) {
          stopTimer();
          setQuizActive(false);
          setSubmitting(false);
          submitLockRef.current = false;
          setWarning("Exam locked due to security violations. Your attempt has been force-submitted.");
          return;
        }
        if (eventPayload?.force_submit) {
          if (!forceSubmitTriggeredRef.current) {
            forceSubmitTriggeredRef.current = true;
            setWarning(
              `Security threshold reached (${eventPayload.violation_count}/${eventPayload.force_submit_threshold}). Auto-submitting.`
            );
            setForceSubmitTick((prev) => prev + 1);
          }
        }
      } catch (requestError) {
        console.error("Failed to report security event", requestError);
      }
    },
    [activity?.id, attemptId, courseId, quiz?.anti_cheat_enabled, stopTimer]
  );

  const loadQuizDetails = useCallback(
    async ({ activeAttemptId = null, activateSession = false, fallbackStartedAt = null, fallbackTimeLimit = null } = {}) => {
      const query = activeAttemptId ? `?attempt_id=${activeAttemptId}` : "";
      const data = await authGet(`/api/courses/${courseId}/activities/${activity.id}/quiz/${query}`);

      const nextAttempts = Array.isArray(data?.attempts) ? data.attempts : [];
      const payloadCurrentAttemptId =
        typeof data?.current_attempt === "object"
          ? data?.current_attempt?.id
          : data?.current_attempt;
      const derivedCurrentAttempt =
        nextAttempts.find((item) => item && Number(item.id) === Number(payloadCurrentAttemptId)) ||
        nextAttempts.find((item) => item && !item.submitted_at) ||
        null;
      const resolvedAttemptId =
        activeAttemptId || payloadCurrentAttemptId || data?.attempt_id || derivedCurrentAttempt?.id || null;
      const resolvedMaxAttempts = Math.max(1, Number(data?.max_attempts || activity?.max_attempts || 1));

      setQuiz(data);
      setAttempts(nextAttempts);
      setCurrentAttempt(derivedCurrentAttempt);
      setAttemptId(resolvedAttemptId);
      setMaxAttempts(resolvedMaxAttempts);

      if (typeof onAttemptsLoaded === "function") {
        onAttemptsLoaded(nextAttempts);
      }

      if (activateSession && resolvedAttemptId) {
        const nextQuestions = normalizeQuestions(data?.questions || []);
        const answersKey = `quiz_answers_${courseId}_${activity?.id}_${resolvedAttemptId}`;
        let restoredAnswers = {};
        try {
          const raw = localStorage.getItem(answersKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") restoredAnswers = parsed;
          }
        } catch {
          restoredAnswers = {};
        }
        setQuestions(nextQuestions);
        setAnswers(restoredAnswers);
        setCurrentIndex(0);
        setQuizActive(true);
        const startedAt = derivedCurrentAttempt?.started_at || fallbackStartedAt || null;
        const timeLimit = Number(data?.time_limit || fallbackTimeLimit || activity?.quiz_time_limit_seconds || 600);
        hydrateTimerFromAttempt(timeLimit, startedAt);
      } else {
        setQuestions([]);
        setAnswers({});
        setCurrentIndex(0);
        setQuizActive(false);
        setTimeRemaining(0);
        stopTimer();
      }
    },
    [activity?.id, activity?.max_attempts, activity?.quiz_time_limit_seconds, courseId, hydrateTimerFromAttempt, onAttemptsLoaded, stopTimer]
  );

  const fetchQuizStatus = useCallback(async () => {
    if (!courseId || !activity?.id) return;

    setLoading(true);
    setError("");
    setWarning("");
    autoSubmittedRef.current = false;

    try {
      await loadQuizDetails({ activateSession: false });
    } catch (requestError) {
      console.error(requestError);
      setError(requestError?.message || "Failed to load quiz details.");
    } finally {
      setLoading(false);
    }
  }, [activity?.id, courseId, loadQuizDetails]);

  useEffect(() => {
    fetchQuizStatus();
    return () => {
      stopTimer();
    };
  }, [fetchQuizStatus, stopTimer]);

  useEffect(() => {
    if (!quizActive || !quiz?.anti_cheat_enabled) return;

    const onVisibility = () => {
      if (document.hidden && quiz.anti_cheat_tab_switch) {
        setWarning("Tab switching detected. This action is logged.");
        reportSecurityEvent("tab_switch", { hidden: true, at: new Date().toISOString() });
      }
    };

    const lockKey = `quiz-lock-${attemptId}`;
    localStorage.setItem(lockKey, tabIdRef.current);

    const onStorage = (event) => {
      if (event.key !== lockKey) return;
      if (event.newValue && event.newValue !== tabIdRef.current && quiz.anti_cheat_multi_tab) {
        setWarning("Multiple-tab activity detected. This action is logged.");
        reportSecurityEvent("multiple_tab", { at: new Date().toISOString() });
      }
    };

    const onCopy = (event) => {
      if (!quiz.anti_cheat_disable_copy_paste) return;
      event.preventDefault();
      reportSecurityEvent("copy_attempt", { at: new Date().toISOString() });
    };

    const onPaste = (event) => {
      if (!quiz.anti_cheat_disable_copy_paste) return;
      event.preventDefault();
      reportSecurityEvent("paste_attempt", { at: new Date().toISOString() });
    };

    const onFullscreen = () => {
      if (!quiz.anti_cheat_fullscreen_required) return;
      if (!document.fullscreenElement) {
        setWarning("Fullscreen exited. This action is logged.");
        reportSecurityEvent("fullscreen_exit", { at: new Date().toISOString() });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      document.removeEventListener("fullscreenchange", onFullscreen);
      localStorage.removeItem(lockKey);
    };
  }, [attemptId, quiz, quizActive, reportSecurityEvent]);

  const confirmStartQuiz = useCallback(async () => {
    if (!courseId || !activity?.id || starting) return;
    if (quiz?.requires_consent && !consentChecked) {
      setWarning("Please acknowledge exam policies before starting.");
      return;
    }

    setStarting(true);
    setError("");
    setWarning("");
    setMissingQuestions([]);
    setAnswers({});
    setConfirmed(false);
    autoSubmittedRef.current = false;
    forceSubmitTriggeredRef.current = false;
    submitLockRef.current = false;
    setViolationInfo(null);

    try {
      const startPayload = await authPost(`/api/courses/${courseId}/activities/${activity.id}/quiz/start/`, {
        acknowledged: true,
        ack_message: quiz?.pre_exam_message || "",
      });
      const startedAttemptId = startPayload?.attempt_id || startPayload?.id || startPayload?.attempt?.id || null;
      if (!startedAttemptId) {
        setError(startPayload?.error || "Unable to start quiz. Please try again.");
        return;
      }
      setShowConsentModal(false);
      setConsentChecked(false);
      await loadQuizDetails({
        activeAttemptId: startedAttemptId,
        activateSession: true,
        fallbackStartedAt: startPayload?.started_at || null,
        fallbackTimeLimit: startPayload?.time_limit || null,
      });
      if (quiz?.anti_cheat_enabled && quiz?.anti_cheat_fullscreen_required) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          setWarning("Fullscreen could not be enabled automatically.");
        }
      }
    } catch (requestError) {
      console.error(requestError);
      setError(requestError?.message || "Unable to start quiz. Please try again.");
    } finally {
      setStarting(false);
    }
  }, [activity?.id, consentChecked, courseId, loadQuizDetails, quiz?.anti_cheat_enabled, quiz?.anti_cheat_fullscreen_required, quiz?.pre_exam_message, quiz?.requires_consent, starting]);

  const handleStartQuiz = useCallback(() => {
    setWarning("");
    setShowConsentModal(true);
  }, []);

  const handleResumeQuiz = useCallback(async () => {
    if (!currentAttempt?.id) return;
    setLoading(true);
    setError("");
    setWarning("");
    setMissingQuestions([]);
    autoSubmittedRef.current = false;
    forceSubmitTriggeredRef.current = false;
    try {
      await loadQuizDetails({
        activeAttemptId: currentAttempt.id,
        activateSession: true,
        fallbackStartedAt: currentAttempt?.started_at || null,
        fallbackTimeLimit: quiz?.time_limit || null,
      });
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load quiz details.");
    } finally {
      setLoading(false);
    }
  }, [currentAttempt?.id, currentAttempt?.started_at, loadQuizDetails, quiz?.time_limit]);

  const answeredCount = useMemo(
    () =>
      questions.reduce((acc, question) => {
        return acc + (hasQuestionAnswer(question, answers[question.id]) ? 1 : 0);
      }, 0),
    [answers, questions]
  );

  const submitQuiz = useCallback(
    async ({ auto = false } = {}) => {
      if (submitLockRef.current) return;
      if (!quiz?.id || !attemptId) {
        setWarning("Quiz attempt is not ready yet. Please wait a moment.");
        return;
      }

      const missing = questions
        .filter((question) => !hasQuestionAnswer(question, answers[question.id]))
        .map((question) => question.id);

      if (missing.length > 0) {
        setMissingQuestions(missing);
        setWarning("Please answer all questions before submitting.");
        if (!auto) return;
        if (Object.keys(answers).length === 0) return;
      }

      if (!auto && !confirmed) {
        setWarning("Please confirm submission first.");
        return;
      }

      const payload = {
        quiz_id: quiz.id,
        attempt_id: attemptId,
        answers: questions
          .filter((question) => hasQuestionAnswer(question, answers[question.id]))
          .map((question) => ({
            question_id: question.id,
            answer:
              question.type === "enumeration"
                ? getAnswerItems(question, answers[question.id])
                    .map((item) => String(item || "").trim())
                    .filter(Boolean)
                    .slice(0, getEnumerationSlotCount(question))
                : String(answers[question.id]).trim(),
          })),
      };

      if (!payload.answers.length) {
        setWarning("At least one answer is required.");
        return;
      }

      setSubmitting(true);
      submitLockRef.current = true;
      setWarning("");
      setError("");

      try {
        const result = await authPost(`/api/courses/${courseId}/activities/${activity.id}/quiz/submit/`, payload);
        stopTimer();
        setQuizActive(false);
        if (attemptId) {
          localStorage.removeItem(`quiz_answers_${courseId}_${activity.id}_${attemptId}`);
        }
        setAnswers({});
        setConfirmed(false);
        setMissingQuestions([]);
        await loadQuizDetails({ activateSession: false });
        if (typeof onSubmitted === "function") {
          await onSubmitted(result);
        }
      } catch (requestError) {
        console.error(requestError);
        const message = requestError?.message || "Quiz submission failed.";
        if (String(message).toLowerCase().includes("force-submitted") || String(message).toLowerCase().includes("locked")) {
          stopTimer();
          setQuizActive(false);
          setWarning("Exam locked due to security violations.");
          await loadQuizDetails({ activateSession: false });
        } else {
          setError(message);
        }
      } finally {
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [activity?.id, answers, attemptId, confirmed, courseId, loadQuizDetails, onSubmitted, questions, quiz?.id, stopTimer]
  );

  useEffect(() => {
    if (!quizActive || !attemptId) return;
    const answersKey = `quiz_answers_${courseId}_${activity?.id}_${attemptId}`;
    try {
      localStorage.setItem(answersKey, JSON.stringify(answers || {}));
    } catch {
      // ignore quota/storage failures
    }
  }, [answers, attemptId, activity?.id, courseId, quizActive]);

  useEffect(() => {
    if (!quizActive || !quiz?.id || timeRemaining > 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    submitQuiz({ auto: true });
  }, [quiz?.id, quizActive, submitQuiz, timeRemaining]);

  useEffect(() => {
    if (!forceSubmitTick || !quizActive || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    submitQuiz({ auto: true });
  }, [forceSubmitTick, quizActive, submitQuiz]);

  const formatTime = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const activeQuestion = questions[currentIndex] || null;
  const activeAnswer = activeQuestion && activeQuestion.type !== "enumeration" ? String(answers[activeQuestion.id] || "") : "";
  const activeEnumerationAnswers = activeQuestion?.type === "enumeration" ? getAnswerItems(activeQuestion, answers[activeQuestion.id]) : [];
  const canProceed =
    !quiz?.require_answer_to_advance ||
    (activeQuestion ? hasQuestionAnswer(activeQuestion, answers[activeQuestion.id]) : true);

  if (loading) {
    return <p className="text-sm text-emerald-700">Loading quiz...</p>;
  }

  const totalAttempts = Array.isArray(attempts) ? attempts.length : 0;
  const canStartNewAttempt = !currentAttempt && totalAttempts < maxAttempts;
  const maxAttemptsReached = !currentAttempt && totalAttempts >= maxAttempts;

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {warning ? (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 shadow-lg">
          {warning}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quiz Player</h4>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
          Total Attempts: {totalAttempts} / {maxAttempts}
        </span>
      </div>
      {violationInfo ? (
        <p className="text-xs text-orange-700">
          Violations: {violationInfo.count}/{violationInfo.threshold}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!quizActive ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
          {currentAttempt ? <p>You have an active quiz attempt ready to resume.</p> : null}
          {canStartNewAttempt ? <p>You can start a new quiz attempt.</p> : null}
          {maxAttemptsReached ? <p className="text-red-600">Maximum attempts reached</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {currentAttempt ? (
              <button
                type="button"
                onClick={handleResumeQuiz}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                Resume Quiz
              </button>
            ) : null}
            {canStartNewAttempt ? (
              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={starting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {starting ? "Starting..." : "Start Quiz"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-10 rounded-xl border border-emerald-100 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>
                Question {currentIndex + 1} of {questions.length}
              </p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${timeRemaining <= 60 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                Time Left: {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-emerald-500" style={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }} />
            </div>
          </header>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {activeQuestion ? (
              <>
                <p className="text-base font-semibold text-gray-900">{activeQuestion.question_text}</p>
                <p className="mt-1 text-xs uppercase text-gray-500">{activeQuestion.type} | {activeQuestion.points} pts</p>
                {String(activeQuestion.formula_input || "").trim() ? (
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Formula</p>
                    <BlockMath math={String(activeQuestion.formula_input || "")} />
                  </div>
                ) : null}

                {activeQuestion.type === "multiple_choice" || activeQuestion.type === "true_false" ? (
                  <div className="mt-3 space-y-2">
                    {activeQuestion.options.map((option, index) => (
                      <label key={`${activeQuestion.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                        <input
                          type="radio"
                          name={`quiz-${activeQuestion.id}`}
                          value={option.text}
                          checked={activeAnswer === String(option.text)}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [activeQuestion.id]: event.target.value,
                            }))
                          }
                        />
                        {option.text}
                      </label>
                    ))}
                  </div>
                ) : activeQuestion.type === "coding" ? (
                  <div className="mt-3">
                    <CodeMirror
                      value={activeAnswer || activeQuestion.starter_code || ""}
                      height="220px"
                      extensions={editorExtensionsByLanguage[String(activeQuestion.language || "javascript").toLowerCase()] || []}
                      onChange={(value) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [activeQuestion.id]: value,
                        }))
                      }
                      theme="light"
                    />
                  </div>
                ) : activeQuestion.type === "enumeration" ? (
                  <div className="mt-3 space-y-3">
                    {Array.from({ length: getEnumerationSlotCount(activeQuestion) }, (_, index) => {
                      const value = String(activeEnumerationAnswers[index] || "");
                      return (
                        <div key={`${activeQuestion.id}-enum-slot-${index}`} className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Item {index + 1}
                          </label>
                          <input
                            value={value}
                            onChange={(event) =>
                              setAnswers((prev) => {
                                const next = getAnswerItems(activeQuestion, prev[activeQuestion.id]);
                                while (next.length < getEnumerationSlotCount(activeQuestion)) {
                                  next.push("");
                                }
                                next[index] = event.target.value;
                                return {
                                  ...prev,
                                  [activeQuestion.id]: next,
                                };
                              })
                            }
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                            placeholder={`Enter answer ${index + 1}`}
                          />
                        </div>
                      );
                    })}
                    <p className="text-xs text-gray-500">
                      Enter one response per box. Only the first {getEnumerationSlotCount(activeQuestion)} responses are evaluated.
                    </p>
                  </div>
                ) : (
                  <textarea
                    value={activeAnswer}
                    onChange={(event) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [activeQuestion.id]: event.target.value,
                      }))
                    }
                    className="mt-3 min-h-[88px] w-full rounded-lg border border-gray-300 p-2 text-sm"
                    placeholder={activeQuestion.type === "enumeration" ? "Enter one answer per line or separate answers with commas..." : "Write your answer..."}
                  />
                )}
              </>
            ) : null}
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Question Navigator</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((question, index) => {
                const isCurrent = index === currentIndex;
                const isAnswered = hasQuestionAnswer(question, answers[question.id]);
                const isMissing = missingQuestions.includes(question.id);
                return (
                  <button
                    key={`nav-${question.id}`}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      isCurrent
                        ? "bg-emerald-600 text-white"
                        : isMissing
                        ? "bg-red-100 text-red-700"
                        : isAnswered
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </section>

          {warning ? <p className="text-sm text-red-600">{warning}</p> : null}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            I confirm that my quiz answers are final.
          </label>

          <footer className="sticky bottom-0 z-10 flex justify-between rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex >= questions.length - 1 || !canProceed}
                className="rounded border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 disabled:opacity-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => submitQuiz({ auto: false })}
                disabled={submitting || questions.length === 0}
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Quiz"}
              </button>
            </div>
          </footer>
        </>
      )}
      <PreExamConsentModal
        open={showConsentModal}
        quiz={quiz}
        checked={consentChecked}
        onCheckedChange={setConsentChecked}
        onCancel={() => {
          setShowConsentModal(false);
          setConsentChecked(false);
        }}
        onConfirm={confirmStartQuiz}
        loading={starting}
      />
    </section>
  );
}
