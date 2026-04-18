import React from "react";
import { Link, Outlet, useParams } from "react-router-dom";

const CourseDashboardLayout = () => {
  const { courseId } = useParams();

  return (
    <div>
      {/* Top Bar */}
      <div className="bg-gray-100 p-4 flex gap-4 border-b">
        <Link
          to={`/instructor-dashboard/courses/${courseId}`}
          className="px-3 py-1 rounded hover:bg-gray-200"
        >
          Dashboard
        </Link>
        <Link
          to={`/instructor-dashboard/courses/${courseId}/modules`}
          className="px-3 py-1 rounded hover:bg-gray-200"
        >
          Modules
        </Link>
        <Link
          to={`/instructor-dashboard/courses/${courseId}/students`}
          className="px-3 py-1 rounded hover:bg-gray-200"
        >
          Students
        </Link>
        <Link
          to={`/instructor-dashboard/courses/${courseId}/assignments`}
          className="px-3 py-1 rounded hover:bg-gray-200"
        >
          Assignments
        </Link>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
};

export default CourseDashboardLayout;
