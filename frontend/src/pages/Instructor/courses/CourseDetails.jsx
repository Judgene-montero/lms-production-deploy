import React, { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LuBookOpen, LuUsers } from "react-icons/lu";
import { authGet, authPost, authPut } from "../../../utils/api";
import { getDefaultAvatarDataUrl } from "../../../utils/instructorProfile";
import { getWebSocketBaseUrl } from "../../../utils/runtimeConfig";

const StreamTab = lazy(() => import("../../../components/course/StreamTab"));
const LessonsTab = lazy(() => import("../../../components/course/LessonsTab"));
const ClassworkTab = lazy(() => import("../../../components/course/ClassworkTab"));
const ExamsQuizzesTab = lazy(() => import("../../../components/course/ExamsQuizzesTab"));
const MeetingsTab = lazy(() => import("../../../components/course/MeetingsTab"));
const AttendanceTab = lazy(() => import("../../../components/course/AttendanceTab"));
const CommentsTab = lazy(() => import("../../../components/course/CommentsTab"));
const GradesTab = lazy(() => import("../../../components/course/GradesTab"));
const EnrollmentRequestsTab = lazy(() => import("../../../components/course/EnrollmentRequestsTab"));
const StudentProfile = lazy(() => import("./StudentProfile"));

const BASE_TAB_ITEMS = [
  { key: "stream", label: "Stream" },
  { key: "lessons", label: "Lessons" },
  { key: "classwork", label: "Classwork" },
  { key: "exams_quizzes", label: "Exams & Quizzes" },
  { key: "meetings", label: "Meetings" },
  { key: "attendance", label: "Attendance" },
  { key: "grades", label: "Grades" },
  { key: "people", label: "People" },
  { key: "comments", label: "Comments" },
];

const statCardClass =
  "rounded-xl border border-emerald-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

const TabFallback = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, index) => (
      <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
    ))}
  </div>
);

const tabClass = (isActive) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-emerald-600 text-white shadow-sm"
      : "bg-white text-emerald-800 hover:bg-emerald-50"
  }`;

const buildCourseSocketUrl = () => {
  const token = localStorage.getItem("access") || "";
  const url = new URL(`${getWebSocketBaseUrl()}/ws/notifications/`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value) => {
  const parsed = toNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const pickFirstString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || "";

const mapStudentForDisplay = (student = {}) => {
  const fullName = pickFirstString(student.full_name, student.name, student.username, "Student");
  const assignmentsCompleted = Math.max(
    0,
    toNumber(student.assignments_completed ?? student.assignmentsCompleted ?? student.analytics?.assignments_submitted, 0)
  );
  const progressPercent = clampPercent(
    student.progress_percentage ??
      student.progressPercent ??
      student.course_progress ??
      student.progress ??
      student.analytics?.progress_percentage
  );
  const recentActivity = pickFirstString(
    student.recent_activity,
    student.recent_submission,
    student.recentSubmission,
    student.latest_activity,
    student.last_submission,
    student.lastActivity
  );
  const submissions = Math.max(
    0,
    toNumber(student.recent_submissions_count ?? student.submissions_count ?? student.submissionsCount, 0)
  );
  const avatar =
    student.avatar_url ||
    student.avatar ||
    student.profile_picture ||
    student.profile_image ||
    student.image_url ||
    getDefaultAvatarDataUrl({ name: fullName });

  return {
    ...student,
    id: student.id,
    fullName,
    email: pickFirstString(student.email),
    avatar,
    activity: {
      assignmentsCompleted,
      progressPercent,
      submissions,
      recentActivity: recentActivity || "No recent activity yet.",
    },
  };
};

function PeopleTab({ people, loading, error, onOpenProfile }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!people.length) {
    return <p className="text-sm text-gray-500">No students enrolled yet.</p>;
  }

  return (
    <div className="space-y-4">
      {people.map((student) => (
        <button
          key={student.id}
          type="button"
          onClick={() => onOpenProfile(student)}
          className="w-full rounded-xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <img
                src={student.avatar}
                alt={student.fullName}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-100"
              />
              <div>
                <p className="text-base font-semibold text-emerald-950">{student.fullName}</p>
                <p className="text-sm text-gray-600">{student.email || "Email not available"}</p>
              </div>
            </div>

            <div className="w-full rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 sm:w-[360px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Student Activity Summary
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-3">
                <p>Assignments: {student.activity.assignmentsCompleted}</p>
                <p>Progress: {student.activity.progressPercent}%</p>
                <p>Submissions: {student.activity.submissions}</p>
              </div>
              <p className="mt-2 text-xs text-gray-600">{student.activity.recentActivity}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

const renderTabComponent = ({
  activeTab,
  courseId,
  isInstructor,
  people,
  peopleLoading,
  peopleError,
  selectedStudentId,
  onOpenProfile,
  onBackToPeople,
  enrollmentRequests,
  enrollmentRequestsLoading,
  enrollmentRequestsError,
  onApproveRequest,
  onRejectRequest,
  selectedClassworkFromStream,
  setSelectedClassworkFromStream,
  setActiveTab,
}) => {
  switch (activeTab) {
    case "stream":
      return (
        <StreamTab
          courseId={courseId}
          isInstructor={isInstructor}
          onOpenClasswork={(activity) => {
            setSelectedClassworkFromStream(activity);
            setActiveTab("classwork");
          }}
        />
      );
    case "lessons":
      return <LessonsTab courseId={courseId} isInstructor={isInstructor} />;
    case "classwork":
      return (
        <ClassworkTab
          courseId={courseId}
          isInstructor={isInstructor}
          openActivity={selectedClassworkFromStream}
        />
      );
    case "exams_quizzes":
      return <ExamsQuizzesTab courseId={courseId} isInstructor={isInstructor} />;
    case "meetings":
      return <MeetingsTab courseId={courseId} isInstructor={isInstructor} />;
    case "attendance":
      return <AttendanceTab courseId={courseId} isInstructor={isInstructor} />;
    case "grades":
      return <GradesTab courseId={courseId} isInstructor={isInstructor} />;
    case "people":
      if (selectedStudentId) {
        return (
          <StudentProfile
            courseId={courseId}
            studentId={selectedStudentId}
            fallbackStudent={people.find((person) => String(person.id) === String(selectedStudentId))}
            onBack={onBackToPeople}
          />
        );
      }
      return <PeopleTab people={people} loading={peopleLoading} error={peopleError} onOpenProfile={onOpenProfile} />;
    case "enrollment_requests":
      return (
        <EnrollmentRequestsTab
          isInstructor={isInstructor}
          requests={enrollmentRequests}
          loading={enrollmentRequestsLoading}
          error={enrollmentRequestsError}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
        />
      );
    case "comments":
      return <CommentsTab courseId={courseId} isInstructor={isInstructor} />;
    default:
      return null;
  }
};

export default function CourseDetails({ currentUser = {} }) {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [activeTab, setActiveTab] = useState("stream");
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [moduleCount, setModuleCount] = useState(null);
  const [enrollmentRequests, setEnrollmentRequests] = useState([]);
  const [enrollmentRequestsLoading, setEnrollmentRequestsLoading] = useState(false);
  const [enrollmentRequestsError, setEnrollmentRequestsError] = useState("");
  const [selectedClassworkFromStream, setSelectedClassworkFromStream] = useState(null);

  const role = (currentUser?.role || localStorage.getItem("role") || "").toLowerCase();
  const isInstructorRoute = location.pathname.startsWith("/instructor-dashboard");
  const isInstructor = role === "instructor" || isInstructorRoute;
  const query = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedStudentId = query.get("student");
  const requestedTabFromQuery = query.get("tab");

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authGet(`/api/courses/${courseId}/`);
      setCourse(data || null);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const fetchEnrollmentRequests = useCallback(
    async (options = {}) => {
      if (!isInstructor) return [];

      const silent = Boolean(options.silent);
      if (!silent) {
        setEnrollmentRequestsLoading(true);
      }
      setEnrollmentRequestsError("");

      try {
        const data = await authGet(`/api/courses/enrollment-requests/?course_id=${courseId}`);
        const rows = Array.isArray(data) ? data : [];
        setEnrollmentRequests(rows);
        setCourse((current) =>
          current
            ? {
                ...current,
                pending_enrollment_requests_count: rows.length,
              }
            : current
        );
        return rows;
      } catch (requestError) {
        console.error(requestError);
        setEnrollmentRequestsError("Failed to load enrollment requests.");
        return [];
      } finally {
        if (!silent) {
          setEnrollmentRequestsLoading(false);
        }
      }
    },
    [courseId, isInstructor]
  );

  React.useEffect(() => {
    if (!isInstructor) return undefined;

    fetchEnrollmentRequests();
    const intervalId = window.setInterval(() => {
      fetchEnrollmentRequests({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [fetchEnrollmentRequests, isInstructor]);

  React.useEffect(() => {
    if (!isInstructor) return undefined;

    let socket = null;
    let reconnectTimer = null;
    let isActive = true;

    const connect = () => {
      const token = localStorage.getItem("access") || "";
      if (!token || !isActive) return;

      socket = new WebSocket(buildCourseSocketUrl());

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const payloadCourseId = String(payload?.course_id || "");
          const payloadType = String(payload?.notification_type || "");
          if (payloadCourseId !== String(courseId)) return;

          if (payloadType === "course_enrollment_request" || payloadType === "course_enrollment") {
            fetchEnrollmentRequests({ silent: true });
            if (payloadType === "course_enrollment") {
              fetchCourse();
            }
          }
        } catch (error) {
          console.error("Enrollment request socket payload error:", error);
        }
      };

      socket.onclose = () => {
        if (!isActive) return;
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        if (socket) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      isActive = false;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [courseId, fetchCourse, fetchEnrollmentRequests, isInstructor]);

  React.useEffect(() => {
    let isActive = true;

    const fetchDashboardCounts = async () => {
      try {
        const [modulesResponse] = await Promise.allSettled([authGet(`/api/courses/${courseId}/modules/`)]);

        if (!isActive) return;

        if (modulesResponse.status === "fulfilled") {
          setModuleCount(Array.isArray(modulesResponse.value) ? modulesResponse.value.length : 0);
        } else {
          setModuleCount(null);
        }
      } catch {
        if (!isActive) return;
        setModuleCount(null);
      }
    };

    fetchDashboardCounts();

    return () => {
      isActive = false;
    };
  }, [courseId]);

  React.useEffect(() => {
    if (activeTab === "classwork") {
      setSelectedClassworkFromStream(null);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const requestedTab = location.state?.activeTab;
    const normalizedRequestedTab = requestedTab === "students" ? "people" : requestedTab;
    if (normalizedRequestedTab && normalizedRequestedTab !== activeTab) {
      setActiveTab(normalizedRequestedTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [activeTab, location.pathname, location.state, navigate]);

  React.useEffect(() => {
    const normalizedRequestedTab = requestedTabFromQuery === "students" ? "people" : requestedTabFromQuery;
    const validTabs = isInstructor ? [...BASE_TAB_ITEMS, { key: "enrollment_requests" }] : BASE_TAB_ITEMS;
    if (normalizedRequestedTab && validTabs.some((tab) => tab.key === normalizedRequestedTab) && normalizedRequestedTab !== activeTab) {
      setActiveTab(normalizedRequestedTab);
    }
  }, [activeTab, isInstructor, requestedTabFromQuery]);

  const fetchPeople = useCallback(async () => {
    setPeopleLoading(true);
    setPeopleError("");
    try {
      const data = await authGet(`/api/courses/${courseId}/students/`);
      const rows = Array.isArray(data) ? data : [];
      const studentsOnly = rows.filter((person) => String(person.role || "").toLowerCase() !== "instructor");
      setPeople(studentsOnly.map(mapStudentForDisplay));
    } catch (requestError) {
      console.error(requestError);
      setPeopleError("Failed to load people.");
    } finally {
      setPeopleLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    if (activeTab !== "people" && !selectedStudentId) return;
    fetchPeople();
  }, [activeTab, fetchPeople, selectedStudentId]);

  const handleOpenProfile = useCallback(
    (student) => {
      const nextQuery = new URLSearchParams(location.search);
      nextQuery.set("tab", "people");
      nextQuery.set("student", String(student.id));
      navigate(`${location.pathname}?${nextQuery.toString()}`, { state: { student } });
    },
    [location.pathname, location.search, navigate]
  );

  const handleBackToPeople = useCallback(() => {
    const nextQuery = new URLSearchParams(location.search);
    nextQuery.set("tab", "people");
    nextQuery.delete("student");
    navigate(`${location.pathname}?${nextQuery.toString()}`);
  }, [location.pathname, location.search, navigate]);

  const handleApproveEnrollmentRequest = useCallback(
    async (requestId) => {
      await authPost(`/api/courses/enrollment-requests/${requestId}/approve/`, {});
      setEnrollmentRequests((current) => current.filter((item) => item.id !== requestId));
      setCourse((current) => {
        if (!current) return current;
        return {
          ...current,
          pending_enrollment_requests_count: Math.max(0, Number(current.pending_enrollment_requests_count || 0) - 1),
          students_count: Number(current.students_count || 0) + 1,
        };
      });
    },
    []
  );

  const handleRejectEnrollmentRequest = useCallback(
    async (requestId) => {
      await authPost(`/api/courses/enrollment-requests/${requestId}/reject/`, {});
      setEnrollmentRequests((current) => current.filter((item) => item.id !== requestId));
      setCourse((current) => {
        if (!current) return current;
        return {
          ...current,
          pending_enrollment_requests_count: Math.max(0, Number(current.pending_enrollment_requests_count || 0) - 1),
        };
      });
    },
    []
  );

  const statCards = useMemo(() => {
    const cards = [
      { label: "Modules", value: moduleCount ?? course?.modules_count ?? 0, icon: LuBookOpen },
      { label: "Students", value: course?.students_count || 0, icon: LuUsers },
    ];
    if (isInstructor) {
      cards.push({
        label: "Pending Requests",
        value: course?.pending_enrollment_requests_count || 0,
        icon: LuUsers,
      });
    }
    return cards;
  }, [course, isInstructor, moduleCount]);

  const tabItems = useMemo(
    () => (isInstructor ? [...BASE_TAB_ITEMS, { key: "enrollment_requests", label: "Enrollment Requests" }] : BASE_TAB_ITEMS),
    [isInstructor]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-emerald-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-red-600">{error}</p>;
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-6 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6 md:p-8">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Course Workspace</p>
              <h1 className="text-2xl font-semibold text-emerald-950 sm:text-3xl">{course.title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-gray-600 sm:text-base">{course.description || "No description provided."}</p>
            </div>
          </div>

          {isInstructor && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Join Code: <span className="text-emerald-700">{course.join_code || "Not generated"}</span>
                  </p>
                  <Link
                    to={`/courses/${courseId}/meetings`}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    Meetings
                  </Link>
                </div>
                <div className="flex gap-2">
                  {course.join_code && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(course.join_code);
                        setCopyMessage("Copied");
                        setTimeout(() => setCopyMessage(""), 1500);
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Copy
                    </button>
                  )}

                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(course.join_code_enabled)}
                  disabled={!course.join_code}
                  onChange={async (event) => {
                    const enabled = event.target.checked;
                    try {
                      await authPut(`/api/courses/courses/${courseId}/toggle-join-code/`, { enabled });
                      setCourse((prev) => ({ ...prev, join_code_enabled: enabled }));
                      setStatusMessage(enabled ? "Join code enabled." : "Join code disabled.");
                    } catch (requestError) {
                      console.error(requestError);
                      setStatusMessage("Failed to update join code setting.");
                    }
                    setTimeout(() => setStatusMessage(""), 2000);
                  }}
                />
                Enable join code
              </label>

              {(statusMessage || copyMessage) && (
                <p className="mt-2 text-xs font-medium text-emerald-700">{statusMessage || copyMessage}</p>
              )}
            </div>
          )}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className={statCardClass}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                  <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-950">{card.value}</p>
              </article>
            );
          })}
        </section>

        <nav className="sticky top-3 z-20 rounded-xl border border-emerald-100 bg-white/95 p-2 shadow-sm backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== "people" && selectedStudentId) {
                    const nextQuery = new URLSearchParams(location.search);
                    nextQuery.delete("student");
                    nextQuery.delete("tab");
                    navigate(
                      nextQuery.toString() ? `${location.pathname}?${nextQuery.toString()}` : location.pathname,
                      { replace: true }
                    );
                  }
                }}
                className={tabClass(activeTab === tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <Suspense fallback={<TabFallback />}>
            {renderTabComponent({
              activeTab,
              courseId,
              isInstructor,
              people,
              peopleLoading,
              peopleError,
              selectedStudentId,
              onOpenProfile: handleOpenProfile,
              onBackToPeople: handleBackToPeople,
              enrollmentRequests,
              enrollmentRequestsLoading,
              enrollmentRequestsError,
              onApproveRequest: handleApproveEnrollmentRequest,
              onRejectRequest: handleRejectEnrollmentRequest,
              selectedClassworkFromStream,
              setSelectedClassworkFromStream,
              setActiveTab,
            })}
          </Suspense>
        </section>
      </div>
    </div>
  );
}
