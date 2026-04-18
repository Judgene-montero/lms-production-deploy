import { authGet } from "../utils/api";

const normalizeTypeName = (value) => String(value || "").trim().toLowerCase();

const getActivityTypeName = (activity) =>
  normalizeTypeName(activity?.activity_type_name || activity?.activity_type?.name || activity?.type || "");

const isAssignmentType = (activity) => {
  const typeName = getActivityTypeName(activity);
  return typeName === "assignment" || typeName === "task";
};

const isQuizType = (activity) => getActivityTypeName(activity) === "quiz";

const isQuestionType = (activity) => getActivityTypeName(activity) === "question";

const toList = (value) => (Array.isArray(value?.results) ? value.results : Array.isArray(value) ? value : []);

const toSubmissionWithActivityId = (submission, activityId) => ({
  ...submission,
  activity_id: submission.activity_id ?? submission.activity ?? activityId,
});

export async function fetchCourseAssessmentsBundle(courseId) {
  const activitiesRaw = await authGet(`/api/courses/${courseId}/activities/`);
  const activities = toList(activitiesRaw);

  const assignments = activities.filter(isAssignmentType);
  const quizzes = activities.filter(isQuizType);
  const questions = activities.filter(isQuestionType);

  const embeddedSubmissions = activities.flatMap((activity) =>
    toList(activity?.submissions).map((submission) => toSubmissionWithActivityId(submission, activity.id))
  );

  const assessmentActivities = [...assignments, ...quizzes, ...questions];

  const explicitSubmissionsNested = await Promise.all(
    assessmentActivities.map(async (activity) => {
      try {
        const response = await authGet(`/api/courses/${courseId}/activities/${activity.id}/submissions/`);
        return toList(response).map((submission) => toSubmissionWithActivityId(submission, activity.id));
      } catch {
        return [];
      }
    })
  );

  const explicitSubmissions = explicitSubmissionsNested.flat();

  const mergedMap = new Map();
  [...embeddedSubmissions, ...explicitSubmissions].forEach((submission) => {
    if (submission?.id == null) return;
    mergedMap.set(String(submission.id), submission);
  });

  const submissions = Array.from(mergedMap.values());

  return { activities, assignments, quizzes, questions, submissions };
}

export function getSubmissionStudentId(submission) {
  return Number(
    submission?.student_id ??
      submission?.student ??
      submission?.user_id ??
      submission?.user ??
      submission?.student?.id ??
      NaN
  );
}

export function getSubmissionStudentTokens(submission) {
  const tokens = new Set();

  const push = (value) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    tokens.add(normalized);
    tokens.add(normalized.toLowerCase());
  };

  push(submission?.student_id);
  push(submission?.student);
  push(submission?.user_id);
  push(submission?.user);
  push(submission?.student?.id);
  push(submission?.student?.school_id);
  push(submission?.student?.username);
  push(submission?.student?.email);
  push(submission?.student_username);

  return Array.from(tokens);
}

export function getSubmissionScore(submission) {
  const raw = submission?.grade ?? submission?.score ?? null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isLateSubmission(submission, dueDate) {
  if (submission?.is_late === true) return true;
  const submittedAt = submission?.submitted_at ? new Date(submission.submitted_at) : null;
  const dueAt = dueDate ? new Date(dueDate) : null;
  if (!submittedAt || !dueAt || Number.isNaN(submittedAt.getTime()) || Number.isNaN(dueAt.getTime())) return false;
  return submittedAt > dueAt;
}
