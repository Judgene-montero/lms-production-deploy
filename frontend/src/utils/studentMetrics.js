const normalizeType = (value) => String(value || "").trim().toLowerCase();

export { normalizeType };

export const getSubmissionForActivity = (activity) => {
  if (activity?.submission) return activity.submission;
  if (Array.isArray(activity?.submissions) && activity.submissions.length > 0) {
    return activity.submissions[0];
  }
  return null;
};

export const getLatestSubmittedQuizAttempt = (activity) => {
  const attempts = Array.isArray(activity?.quiz_attempts) ? activity.quiz_attempts : [];
  const submitted = attempts.filter((item) => item?.submitted_at);
  if (submitted.length === 0) return null;
  return submitted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
};

export const getActivityTotalPoints = (activity) => {
  const latestAttempt = getLatestSubmittedQuizAttempt(activity);
  if (latestAttempt && latestAttempt.total_points !== null && latestAttempt.total_points !== undefined) {
    return Number(latestAttempt.total_points || 0);
  }

  const explicitPoints = Number(activity?.points);
  if (!Number.isNaN(explicitPoints) && explicitPoints > 0) {
    return explicitPoints;
  }

  const questions = Array.isArray(activity?.questions) ? activity.questions : [];
  return questions.reduce((sum, question) => sum + Number(question?.points || 0), 0);
};

export const getActivityScore = (activity) => {
  const latestAttempt = getLatestSubmittedQuizAttempt(activity);
  if (latestAttempt?.score !== null && latestAttempt?.score !== undefined) {
    return Number(latestAttempt.score);
  }

  const submission = getSubmissionForActivity(activity);
  if (submission?.grade !== null && submission?.grade !== undefined) {
    return Number(submission.grade);
  }

  return null;
};

export const getActivitySubmittedAt = (activity) => {
  const latestAttempt = getLatestSubmittedQuizAttempt(activity);
  if (latestAttempt?.submitted_at) return latestAttempt.submitted_at;

  const submission = getSubmissionForActivity(activity);
  return submission?.submitted_at || submission?.submission_time || null;
};

export const getActivityStatus = (activity) => {
  const submission = getSubmissionForActivity(activity);
  const submittedAt = getActivitySubmittedAt(activity);
  const dueDate = activity?.due_date ? new Date(activity.due_date) : null;

  if (submission || submittedAt) {
    if (submission?.grade !== null && submission?.grade !== undefined) {
      return { label: "Completed", tone: "green", key: "completed" };
    }

    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return { label: "Completed", tone: "green", key: "completed" };
    }

    const submittedDate = new Date(submittedAt);
    if (!Number.isNaN(submittedDate.getTime()) && submittedDate > dueDate) {
      return { label: "Completed Late", tone: "amber", key: "completed" };
    }

    return { label: "Completed", tone: "green", key: "completed" };
  }

  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return { label: "Pending", tone: "slate", key: "pending" };
  }

  if (dueDate.getTime() < Date.now()) {
    return { label: "Missing", tone: "red", key: "missing" };
  }

  return { label: "Pending", tone: "slate", key: "pending" };
};

export const buildPerformanceSummary = (activities = []) => {
  const relevant = activities.filter((activity) => normalizeType(activity?.activity_type_name || activity?.activity_type) !== "attendance");

  const rows = relevant.map((activity) => {
    const status = getActivityStatus(activity);
    const score = getActivityScore(activity);
    const maxScore = getActivityTotalPoints(activity);
    const percentage = score !== null && maxScore > 0 ? (Number(score) / Number(maxScore)) * 100 : null;

    return {
      id: activity.id,
      title: activity.title || "Untitled activity",
      type: activity.activity_type_name || activity.activity_type || "Activity",
      dueDate: activity?.due_date || null,
      submittedAt: getActivitySubmittedAt(activity),
      feedback: getSubmissionForActivity(activity)?.feedback || "",
      status,
      score,
      maxScore,
      percentage,
      activity,
    };
  });

  const completed = rows.filter((row) => row.status.key === "completed").length;
  const missing = rows.filter((row) => row.status.key === "missing").length;
  const pending = rows.filter((row) => row.status.key === "pending").length;
  const gradedRows = rows.filter((row) => row.score !== null && Number(row.maxScore) > 0);
  const totalScored = gradedRows.reduce((sum, row) => sum + Number(row.score || 0), 0);
  const totalPossible = gradedRows.reduce((sum, row) => sum + Number(row.maxScore || 0), 0);
  const overallPercentage = totalPossible > 0 ? (totalScored / totalPossible) * 100 : 0;

  return {
    rows,
    totals: {
      total: rows.length,
      completed,
      missing,
      pending,
      graded: gradedRows.length,
      totalScored,
      totalPossible,
      overallPercentage,
    },
  };
};

export const buildLessonProgress = (lessons = []) => {
  const total = Array.isArray(lessons) ? lessons.length : 0;
  const completed = (lessons || []).filter(
    (lesson) => lesson?.completed || lesson?.is_completed || String(lesson?.status || "").toLowerCase() === "completed"
  ).length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return { total, completed, percentage };
};

export const buildCourseProgress = ({ activities = [], lessons = [], fallbackProgress = 0 }) => {
  const performance = buildPerformanceSummary(activities);
  const lessonProgress = buildLessonProgress(lessons);

  const totalItems = performance.totals.total + lessonProgress.total;
  const completedItems = performance.totals.completed + lessonProgress.completed;
  const percentage = totalItems > 0 ? (completedItems / totalItems) * 100 : Number(fallbackProgress) || 0;

  return {
    percentage,
    totalItems,
    completedItems,
    completedActivities: performance.totals.completed,
    totalActivities: performance.totals.total,
    completedLessons: lessonProgress.completed,
    totalLessons: lessonProgress.total,
  };
};

const daysSince = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
};

export const buildEarlyWarnings = ({ activities = [], lessons = [] }) => {
  const performance = buildPerformanceSummary(activities);
  const warnings = [];
  const lowGradeRows = performance.rows.filter((row) => row.percentage !== null && row.percentage < 70);
  const recentProgressSource = [
    ...performance.rows.map((row) => row.submittedAt),
    ...(lessons || []).map((lesson) => lesson?.updated_at || lesson?.created_at),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  if (lowGradeRows.length > 0) {
    warnings.push({
      key: "low-grades",
      tone: "amber",
      title: "Low scores need attention",
      message: `You have ${lowGradeRows.length} graded ${lowGradeRows.length === 1 ? "activity" : "activities"} below 70%.`,
    });
  }

  if (performance.totals.missing > 0) {
    warnings.push({
      key: "missing-work",
      tone: "red",
      title: "Missing submissions",
      message: `${performance.totals.missing} ${performance.totals.missing === 1 ? "activity is" : "activities are"} still missing.`,
    });
  }

  if (daysSince(recentProgressSource) > 10 && (performance.totals.total > 0 || lessons.length > 0)) {
    warnings.push({
      key: "inactivity",
      tone: "slate",
      title: "Recent activity is low",
      message: "You have not made visible progress in the last 10 days.",
    });
  }

  return warnings;
};

