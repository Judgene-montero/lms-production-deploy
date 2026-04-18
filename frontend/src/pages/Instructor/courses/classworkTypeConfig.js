export const CLASSWORK_TYPE_OPTIONS = [
  {
    key: "assignment",
    label: "Assignment",
    description: "Create graded tasks with instructions and due dates.",
  },
  {
    key: "project",
    label: "Project",
    description: "Create project-based activities with requirements and files.",
  },
  {
    key: "material",
    label: "Materials",
    description: "Share references, guides, and optional deadlines.",
  },
  {
    key: "quiz",
    label: "Quiz",
    description: "Open the quiz builder with quiz defaults.",
  },
  {
    key: "exam",
    label: "Exam",
    description: "Open the quiz builder with exam defaults.",
  },
];

export const TYPE_NAME_TO_KEY = {
  assignment: "assignment",
  project: "project",
  projects: "project",
  material: "material",
  materials: "material",
  quiz: "quiz",
  exam: "quiz",
};

export const normalizeActivityTypeKey = (value) => {
  const normalized = String(value || "").toLowerCase().trim();
  return TYPE_NAME_TO_KEY[normalized] || normalized;
};

export const getCreatePathByType = (courseId, typeKey) => {
  const base = `/instructor-dashboard/courses/${courseId}/classwork`;
  if (typeKey === "assignment") return `${base}/assignment/create`;
  if (typeKey === "project") return `${base}/project/create`;
  if (typeKey === "material") return `${base}/material/create`;
  if (typeKey === "quiz") return `${base}/create?assessment=quiz`;
  if (typeKey === "exam") return `${base}/create?assessment=exam`;
  return base;
};

export const getEditPathByType = (courseId, typeKey, activityId) => {
  const base = `/instructor-dashboard/courses/${courseId}/classwork`;
  if (typeKey === "assignment") return `${base}/assignment/${activityId}/edit`;
  if (typeKey === "project") return `${base}/project/${activityId}/edit`;
  if (typeKey === "material") return `${base}/material/${activityId}/edit`;
  if (typeKey === "quiz") return `${base}/${activityId}/edit`;
  return `${base}/${activityId}/edit`;
};
