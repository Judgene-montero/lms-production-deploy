import React, { useMemo } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import StudentDashboard from "./pages/Student/Dashboard";
import StudentHome from "./pages/Student/StudentHome";
import MyStudentCourses from "./pages/Student/MyCourses";
import StudentGrades from "./pages/Student/Grades";
import StudentProfile from "./pages/Student/Profile";
import StudentSettings from "./pages/Student/Settings";
import StudentAssignments from "./pages/Student/Assignments";
import StudentCourseDetails from "./pages/Student/StudentCourseDetails";
import StudentExamTakePage from "./pages/Student/StudentExamTakePage";
import ExamReviewPage from "./pages/Student/ExamReviewPage";
import StudentLessonsPage from "./pages/Student/StudentLessonsPage";
import MeetingsPage from "./pages/MeetingsPage";

import InstructorDashboard from "./pages/Instructor/InstructorDashboards";
import InstructorCourses from "./pages/Instructor/courses/InstructorCourses";
import CreateCourse from "./pages/Instructor/courses/CreateCourseModal";
import CourseDetails from "./pages/Instructor/courses/CourseDetails";
import LessonDetail from "./pages/Instructor/courses/LessonDetail";
import ModuleLessonsPage from "./pages/Instructor/courses/ModuleLessonsPage";
import EditCourse from "./pages/Instructor/courses/EditCourse";
import ClassworkCreate from "./pages/Instructor/courses/ClassworkCreate";
import ClassworkEdit from "./pages/Instructor/courses/ClassworkEdit";
import ClassworkDetail from "./pages/Instructor/courses/ClassworkDetail";
import ClassworkAnalytics from "./pages/Instructor/courses/ClassworkAnalytics";
import ActivityDetailsPage from "./pages/Instructor/courses/ActivityDetailsPage";
import AssignmentCreate from "./pages/Instructor/courses/AssignmentCreate";
import AssignmentEdit from "./pages/Instructor/courses/AssignmentEdit";
import ProjectCreate from "./pages/Instructor/courses/ProjectCreate";
import ProjectEdit from "./pages/Instructor/courses/ProjectEdit";
import MaterialCreate from "./pages/Instructor/courses/MaterialCreate";
import MaterialEdit from "./pages/Instructor/courses/MaterialEdit";
import ImportPage from "./pages/Instructor/courses/ImportPage";
import PreviewExam from "./pages/Instructor/courses/PreviewExam";
import Submissions from "./pages/Instructor/InstructorSubmissions";
import Notifications from "./pages/Instructor/InstructorNotifications";
import Home from "./pages/Instructor/Home";
import Analytics from "./pages/Instructor/Analytics";
import Settings from "./pages/Instructor/Settings";
import Students from "./pages/Instructor/Students";
import InstructorProfile from "./pages/Instructor/Profile";

import AdminDashboard from "./pages/AdminDashboard";
import AdminCourses from "./pages/AdminCourses";
import AdminUploadIDs from "./pages/AdminUploadIDs";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminInstructorApprovals from "./pages/AdminInstructorApprovals";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminCategories from "./pages/AdminCategories";
import AdminSettings from "./pages/AdminSettings";
import AdminLogs from "./pages/AdminLogs";
import AdminCourseDetail from "./pages/AdminCourseDetail";

import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

const App = () => {
  const currentUser = useMemo(
    () => ({
      role: localStorage.getItem("role"),
      id: localStorage.getItem("user_id"),
    }),
    []
  );

  const instructorRoutes = useMemo(
    () => [
      { index: true, element: <Home /> },
      { path: "students", element: <Students /> },
      { path: "analytics", element: <Analytics /> },
      { path: "profile", element: <InstructorProfile /> },
      { path: "settings", element: <Settings /> },
      { path: "submissions", element: <Submissions /> },
      { path: "notifications", element: <Notifications /> },
    ],
    []
  );

  const instructorCourseRoutes = useMemo(
    () => [
      { index: true, element: <InstructorCourses /> },
      { path: "create", element: <CreateCourse /> },
      {
        path: ":courseId",
        element: <CourseDetails currentUser={currentUser} />,
      },
      { path: ":courseId/lessons/:lessonId", element: <LessonDetail /> },
      { path: ":courseId/modules/:moduleId/lessons", element: <ModuleLessonsPage /> },
      { path: ":courseId/edit", element: <EditCourse /> },
      { path: ":courseId/classwork/create", element: <ClassworkCreate /> },
      { path: ":courseId/classwork/assignment/create", element: <AssignmentCreate /> },
      { path: ":courseId/classwork/assignment/:id/edit", element: <AssignmentEdit /> },
      { path: ":courseId/classwork/project/create", element: <ProjectCreate /> },
      { path: ":courseId/classwork/project/:id/edit", element: <ProjectEdit /> },
      { path: ":courseId/classwork/material/create", element: <MaterialCreate /> },
      { path: ":courseId/classwork/material/:id/edit", element: <MaterialEdit /> },
      { path: ":courseId/classwork/import", element: <ImportPage /> },
      { path: ":courseId/classwork/preview", element: <PreviewExam /> },
      { path: ":courseId/classwork/:id/edit", element: <ClassworkEdit /> },
      { path: ":courseId/classwork/:id/analytics", element: <ClassworkAnalytics /> },
      { path: ":courseId/classwork/:id/activity", element: <ActivityDetailsPage /> },
      { path: ":courseId/classwork/:id", element: <ClassworkDetail /> },
    ],
    [currentUser]
  );

  const adminRoutes = useMemo(
    () => [
      { index: true, element: <AdminDashboard /> },
      { path: "dashboard", element: <AdminDashboard /> },
      { path: "users", element: <AdminUserManagement /> },
      { path: "courses", element: <AdminCourses /> },
      { path: "courses/:courseId", element: <AdminCourseDetail /> },
      { path: "instructor-approvals", element: <AdminInstructorApprovals /> },
      { path: "analytics", element: <AdminAnalytics /> },
      { path: "categories", element: <AdminCategories /> },
      { path: "settings", element: <AdminSettings /> },
      { path: "logs", element: <AdminLogs /> },
      { path: "upload-ids", element: <AdminUploadIDs /> },
    ],
    []
  );

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                localStorage.getItem("role") === "admin"
                  ? "/admin"
                  : localStorage.getItem("role") === "instructor"
                  ? "/instructor-dashboard"
                  : "/student/dashboard"
              }
              replace
            />
          }
        />

        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

        <Route
          path="/courses/:courseId/meetings"
          element={
            <ProtectedRoute allowedRoles={["student", "instructor"]}>
              <MeetingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<StudentHome />} />
          <Route path="my-courses" element={<MyStudentCourses />} />
          <Route path="my-courses/:courseId" element={<StudentCourseDetails />} />
          <Route path="my-courses/:courseId/lessons" element={<StudentLessonsPage />} />
          <Route path="my-courses/:courseId/exam/:activityId" element={<StudentExamTakePage />} />
          <Route path="my-courses/:courseId/exam/:activityId/review" element={<ExamReviewPage />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="grades" element={<StudentGrades />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>

        <Route
          path="/instructor-dashboard"
          element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <InstructorDashboard />
            </ProtectedRoute>
          }
        >
          {instructorRoutes.map((route) => (
            <Route
              key={route.path || "instructor-index"}
              index={route.index}
              path={route.path}
              element={route.element}
            />
          ))}

          <Route path="courses">
            {instructorCourseRoutes.map((route) => (
              <Route
                key={route.path || "courses-index"}
                index={route.index}
                path={route.path}
                element={route.element}
              />
            ))}
          </Route>
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {adminRoutes.map((route) => (
            <Route
              key={route.path || "admin-index"}
              index={route.index}
              path={route.path}
              element={route.element}
            />
          ))}
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
