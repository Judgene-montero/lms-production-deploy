import { Outlet, Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function LmsLayout() {
  const user = useAuth();

  if (user === null) {
    return <div className="p-4">Checking authentication...</div>;
  }

  if (!localStorage.getItem("access") || user.role === "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-100 p-4 border-r">
        <h2 className="font-bold mb-6 text-lg">LMS Panel</h2>

        <nav className="flex flex-col gap-2">
          <a href="/lms/dashboard">📊 Dashboard</a>
          <a href="/lms/courses">📚 My Courses</a>
          <a href="/lms/grades">🎓 Grades</a>
          <a href="/lms/profile">👤 Profile</a>
        </nav>
      </aside>

      {/* Page Content */}
      <main className="flex-1 p-6 bg-white">
        <Outlet />
      </main>
    </div>
  );
}
