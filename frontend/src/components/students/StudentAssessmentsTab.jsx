import React, { memo, useEffect, useMemo, useState } from "react";
import { authGet } from "../../utils/api";
import {
  fetchCourseAssessmentsBundle,
  getSubmissionScore,
  getSubmissionStudentId,
  getSubmissionStudentTokens,
  isLateSubmission,
} from "../../services/studentAssessmentsApi";

const PAGE_SIZE = 20;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function StudentAssessmentsTab({ isActive, selectedCourse, courseId, students }) {
  const effectiveCourseId = courseId || selectedCourse;

  const [subTab, setSubTab] = useState("tasks");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [page, setPage] = useState(1);
  const [submissionModal, setSubmissionModal] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [subTab, effectiveCourseId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!isActive) return;
      if (!effectiveCourseId || effectiveCourseId === "all") return;

      setLoading(true);
      setError("");

      try {
        const bundle = await fetchCourseAssessmentsBundle(effectiveCourseId);
        if (!mounted) return;

        setAssignments(bundle.assignments);
        setQuizzes(bundle.quizzes);
        setQuestions(bundle.questions);
        setSubmissions(bundle.submissions);
      } catch (requestError) {
        console.error(requestError);
        if (mounted) setError("Data could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [effectiveCourseId, isActive]);

  const studentRows = useMemo(() => {
    if (effectiveCourseId === "all") return [];
    return students.filter((student) => String(student.courseId) === String(effectiveCourseId));
  }, [effectiveCourseId, students]);

  const studentById = useMemo(() => {
    const map = new Map();
    studentRows.forEach((student) => {
      map.set(Number(student.id), student);
    });
    return map;
  }, [studentRows]);

  const studentTokenMap = useMemo(() => {
    const map = new Map();
    const add = (token, studentId) => {
      if (token === undefined || token === null) return;
      const normalized = String(token).trim();
      if (!normalized) return;
      map.set(normalized, studentId);
      map.set(normalized.toLowerCase(), studentId);
    };

    studentRows.forEach((student) => {
      const studentId = Number(student.id);
      add(studentId, studentId);
      add(student.studentId, studentId);
      add(student.school_id, studentId);
      add(student.email, studentId);
      add(student.username, studentId);
      add(student.name, studentId);
    });

    return map;
  }, [studentRows]);

  const resolveStudentIdFromSubmission = useMemo(
    () => (submission) => {
      const numericId = getSubmissionStudentId(submission);
      if (Number.isFinite(numericId) && studentById.has(numericId)) return numericId;

      const tokens = getSubmissionStudentTokens(submission);
      for (const token of tokens) {
        if (studentTokenMap.has(token)) return Number(studentTokenMap.get(token));
      }

      return null;
    },
    [studentById, studentTokenMap]
  );

  const assignmentSubmissions = useMemo(
    () => submissions.filter((submission) => assignments.some((assignment) => Number(assignment.id) === Number(submission.activity_id))),
    [assignments, submissions]
  );

  const quizSubmissions = useMemo(
    () => submissions.filter((submission) => quizzes.some((quiz) => Number(quiz.id) === Number(submission.activity_id))),
    [quizzes, submissions]
  );

  const questionSubmissions = useMemo(
    () => submissions.filter((submission) => questions.some((question) => Number(question.id) === Number(submission.activity_id))),
    [questions, submissions]
  );

  const assignmentMatrix = useMemo(() => {
    const matrix = {};

    studentRows.forEach((student) => {
      matrix[String(student.id)] = {};
      assignments.forEach((assignment) => {
        matrix[String(student.id)][String(assignment.id)] = {
          missing: true,
          late: false,
          score: null,
          status: "missing",
          submissionId: null,
          submittedAt: null,
          feedback: "",
          attachments: [],
        };
      });
    });

    assignmentSubmissions.forEach((submission) => {
      const studentId = resolveStudentIdFromSubmission(submission);
      const assignmentId = Number(submission.activity_id ?? submission.activity);
      if (!Number.isFinite(studentId) || !Number.isFinite(assignmentId)) return;
      if (!matrix[String(studentId)] || !matrix[String(studentId)][String(assignmentId)]) return;

      const assignment = assignments.find((item) => Number(item.id) === assignmentId);
      const score = getSubmissionScore(submission);
      const late = isLateSubmission(submission, assignment?.due_date);

      matrix[String(studentId)][String(assignmentId)] = {
        missing: false,
        late,
        score,
        status: String(submission.status || "submitted").toLowerCase(),
        submissionId: submission.id ?? null,
        submittedAt: submission.submitted_at || null,
        feedback: submission.feedback || "",
        attachments: Array.isArray(submission.attachments) ? submission.attachments : [],
      };
    });

    // requested temporary debug output
    // Toggle to true only during manual debugging.
    const DEBUG_ASSESSMENTS_MATRIX = false;
    if (DEBUG_ASSESSMENTS_MATRIX) {
      console.log("Assignments:", assignments);
      console.log("Submissions:", assignmentSubmissions);
      console.log("Matrix:", matrix);
    }

    return matrix;
  }, [assignmentSubmissions, assignments, resolveStudentIdFromSubmission, studentRows]);

  const quizResultMap = useMemo(() => {
    const map = new Map();
    quizSubmissions.forEach((submission) => {
      const studentId = resolveStudentIdFromSubmission(submission);
      const quizId = Number(submission.activity_id ?? submission.activity);
      if (!Number.isFinite(studentId) || !Number.isFinite(quizId)) return;
      map.set(`${studentId}-${quizId}`, submission);
    });
    return map;
  }, [quizSubmissions, resolveStudentIdFromSubmission]);

  const questionsMap = useMemo(() => {
    const map = new Map();

    studentRows.forEach((student) => {
      map.set(String(student.id), {
        student_id: student.id,
        questions_answered: 0,
        correct_answers: 0,
        accuracy_percentage: 0,
      });
    });

    questionSubmissions.forEach((submission) => {
      const studentId = resolveStudentIdFromSubmission(submission);
      if (!Number.isFinite(studentId) || !studentById.has(studentId)) return;

      const current = map.get(String(studentId)) || {
        student_id: studentId,
        questions_answered: 0,
        correct_answers: 0,
        accuracy_percentage: 0,
      };

      const nextAnswered = current.questions_answered + 1;
      const score = getSubmissionScore(submission);
      const isCorrect = score != null ? score >= 60 : false;
      const nextCorrect = current.correct_answers + (isCorrect ? 1 : 0);
      const accuracy = nextAnswered ? (nextCorrect / nextAnswered) * 100 : 0;

      map.set(String(studentId), {
        student_id: studentId,
        questions_answered: nextAnswered,
        correct_answers: nextCorrect,
        accuracy_percentage: accuracy,
      });
    });

    return map;
  }, [questionSubmissions, resolveStudentIdFromSubmission, studentById, studentRows]);

  const summary = useMemo(() => {
    const assignmentScores = [];
    const missingStudents = new Set();

    studentRows.forEach((student) => {
      let hasMissing = false;
      assignments.forEach((assignment) => {
        const cell = assignmentMatrix[String(student.id)]?.[String(assignment.id)];
        if (!cell || cell.missing) {
          hasMissing = true;
        } else if (cell.score != null) {
          assignmentScores.push(cell.score);
        }
      });
      if (hasMissing) missingStudents.add(student.id);
    });

    const quizScores = quizSubmissions
      .map((submission) => getSubmissionScore(submission))
      .filter((score) => score != null);

    const failingQuizzes = quizScores.filter((score) => score < 60).length;

    return {
      assignmentsAvg: assignmentScores.length
        ? Math.round(assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length)
        : 0,
      quizAvg: quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0,
      missingAssignments: missingStudents.size,
      failingQuizzes,
    };
  }, [assignmentMatrix, assignments, quizSubmissions, studentRows]);

  const combinedRows = useMemo(() => {
    return studentRows.map((student) => {
      const assignmentScores = assignments
        .map((assignment) => assignmentMatrix[String(student.id)]?.[String(assignment.id)]?.score)
        .filter((score) => score != null);

      const quizScores = quizzes
        .map((quiz) => getSubmissionScore(quizResultMap.get(`${student.id}-${quiz.id}`)))
        .filter((score) => score != null);

      const question = questionsMap.get(String(student.id));
      const questionAccuracy = Number(question?.accuracy_percentage ?? 0);

      const tasksAvg = assignmentScores.length
        ? assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length
        : 0;
      const quizAvg = quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 0;
      const finalScore = Math.round(tasksAvg * 0.4 + quizAvg * 0.4 + questionAccuracy * 0.2);

      return {
        id: student.id,
        student: student.name,
        tasksAvg: Math.round(tasksAvg),
        quizAvg: Math.round(quizAvg),
        questionAccuracy: Math.round(questionAccuracy),
        finalScore,
      };
    });
  }, [assignmentMatrix, assignments, questionsMap, quizzes, quizResultMap, studentRows]);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return studentRows.slice(start, start + PAGE_SIZE);
  }, [page, studentRows]);

  const openSubmissionModal = async (submissionId, activityId) => {
    if (!submissionId || !activityId) return;

    setSubmissionLoading(true);
    setSubmissionModal(null);

    try {
      const list = await authGet(`/api/courses/${effectiveCourseId}/activities/${activityId}/submissions/`);
      const rows = Array.isArray(list?.results) ? list.results : Array.isArray(list) ? list : [];
      const found = rows.find((item) => Number(item.id) === Number(submissionId));

      setSubmissionModal(
        found || {
          grade: "-",
          submitted_at: null,
          feedback: "Submission details could not be loaded.",
          attachments: [],
        }
      );
    } catch {
      setSubmissionModal({
        grade: "-",
        submitted_at: null,
        feedback: "Submission details could not be loaded.",
        attachments: [],
      });
    } finally {
      setSubmissionLoading(false);
    }
  };

  if (effectiveCourseId === "all") {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
        Select a specific course to load Assessments data.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Average Assignment Score</p><p className="text-xl font-semibold text-emerald-900">{summary.assignmentsAvg}</p></article>
        <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Average Quiz Score</p><p className="text-xl font-semibold text-emerald-900">{summary.quizAvg}</p></article>
        <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Students Missing Assignments</p><p className="text-xl font-semibold text-emerald-900">{summary.missingAssignments}</p></article>
        <article className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs text-gray-500">Students Failing Quizzes</p><p className="text-xl font-semibold text-emerald-900">{summary.failingQuizzes}</p></article>
      </div>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { key: "tasks", label: "Assignment" },
            { key: "quizzes", label: "Quiz" },
            { key: "questions", label: "Question" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSubTab(item.key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${subTab === item.key ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-emerald-50" />)}</div>
        ) : (
          <>
            {subTab === "tasks" && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-max text-sm">
                  <thead className="bg-emerald-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      {assignments.map((assignment) => (
                        <th key={assignment.id} className="px-3 py-2 text-left">{assignment.title || `Assignment ${assignment.id}`}</th>
                      ))}
                      <th className="px-3 py-2 text-left">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const scores = [];
                      return (
                        <tr key={student.id} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-800">{student.name}</td>
                          {assignments.map((assignment) => {
                            const cell = assignmentMatrix[String(student.id)]?.[String(assignment.id)] || { missing: true };

                            let label = "Missing";
                            if (!cell.missing) {
                              if (cell.late && cell.score != null) {
                                label = `Late (${Math.round(cell.score)})`;
                              } else if (cell.late && cell.score == null) {
                                label = "Late";
                              } else if (cell.score != null) {
                                label = `${Math.round(cell.score)}`;
                                scores.push(cell.score);
                              } else {
                                label = "Submitted";
                              }
                            }

                            return (
                              <td key={`${student.id}-${assignment.id}`} className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => openSubmissionModal(cell.submissionId, assignment.id)}
                                  className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={!cell.submissionId}
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2">{scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {subTab === "quizzes" && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-max text-sm">
                  <thead className="bg-emerald-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      {quizzes.map((quiz) => (
                        <th key={quiz.id} className="px-3 py-2 text-left">{quiz.title || `Quiz ${quiz.id}`}</th>
                      ))}
                      <th className="px-3 py-2 text-left">Average Score</th>
                      <th className="px-3 py-2 text-left">Attempts</th>
                      <th className="px-3 py-2 text-left">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const scores = [];
                      let attempts = 0;

                      quizzes.forEach((quiz) => {
                        const submission = quizResultMap.get(`${student.id}-${quiz.id}`);
                        if (!submission) return;
                        const score = getSubmissionScore(submission);
                        if (score != null) scores.push(score);
                        attempts += 1;
                      });

                      return (
                        <tr key={student.id} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-800">{student.name}</td>
                          {quizzes.map((quiz) => {
                            const submission = quizResultMap.get(`${student.id}-${quiz.id}`);
                            const score = getSubmissionScore(submission);
                            return <td key={`${student.id}-${quiz.id}`} className="px-3 py-2">{score != null ? Math.round(score) : "-"}</td>;
                          })}
                          <td className="px-3 py-2">{scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "-"}</td>
                          <td className="px-3 py-2">{attempts}</td>
                          <td className="px-3 py-2">{quizzes.length ? Math.round((attempts / quizzes.length) * 100) : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {subTab === "questions" && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-emerald-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Questions Answered</th>
                      <th className="px-3 py-2 text-left">Correct Answers</th>
                      <th className="px-3 py-2 text-left">Accuracy Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const row = questionsMap.get(String(student.id));
                      const answered = Number(row?.questions_answered ?? 0);
                      const correct = Number(row?.correct_answers ?? 0);
                      const accuracy = clamp(Number(row?.accuracy_percentage ?? 0), 0, 100);

                      return (
                        <tr key={student.id} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-800">{student.name}</td>
                          <td className="px-3 py-2">{answered}</td>
                          <td className="px-3 py-2">{correct}</td>
                          <td className="px-3 py-2">{Math.round(accuracy)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {studentRows.length > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">&lt;</button>
                <span className="text-sm text-gray-600">Page {page}</span>
                <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={page * PAGE_SIZE >= studentRows.length} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">&gt;</button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-emerald-900">Combined Performance Score</h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left">Tasks Avg</th>
                <th className="px-3 py-2 text-left">Quiz Avg</th>
                <th className="px-3 py-2 text-left">Question Accuracy</th>
                <th className="px-3 py-2 text-left">Final Score</th>
              </tr>
            </thead>
            <tbody>
              {combinedRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-800">{row.student}</td>
                  <td className="px-3 py-2">{row.tasksAvg}</td>
                  <td className="px-3 py-2">{row.quizAvg}</td>
                  <td className="px-3 py-2">{row.questionAccuracy}%</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{row.finalScore}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(submissionModal || submissionLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-emerald-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">Submission Details</h3>
              <button type="button" onClick={() => setSubmissionModal(null)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Close</button>
            </div>
            {submissionLoading ? (
              <div className="mt-3 space-y-2">{[...Array(4)].map((_, index) => <div key={index} className="h-8 animate-pulse rounded bg-emerald-50" />)}</div>
            ) : submissionModal && (
              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">Score:</span> {getSubmissionScore(submissionModal) ?? "-"}</p>
                <p><span className="font-medium">Submission date:</span> {submissionModal.submitted_at ? new Date(submissionModal.submitted_at).toLocaleString() : "-"}</p>
                <p><span className="font-medium">Feedback:</span> {submissionModal.feedback || "-"}</p>
                <div>
                  <p className="font-medium">Uploaded files:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {(submissionModal.attachments || []).map((file, index) => (
                      <li key={`${file.file || file.name || "file"}-${index}`}>{file.name || file.file || "File"}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(StudentAssessmentsTab);
