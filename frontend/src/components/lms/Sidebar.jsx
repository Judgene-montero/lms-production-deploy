import { Book, BarChart, User, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();

  const menu = [
    { label: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/lms/dashboard" },
    { label: "My Courses", icon: <Book size={18} />, path: "/lms/courses" },
    { label: "Grades", icon: <BarChart size={18} />, path: "/lms/grades" },
    { label: "Profile", icon: <User size={18} />, path: "/lms/profile" },
  ];

  return (
    <aside className="h-screen w-64 bg-gray-900 text-white px-4 py-6">
      <h2 className="text-xl font-bold mb-8">LMS Portal</h2>

      <nav className="flex flex-col gap-2">
        {menu.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className={`flex items-center gap-3 p-3 rounded-lg transition 
              ${location.pathname === m.path ? "bg-blue-600" : "hover:bg-gray-700"}`}
          >
            {m.icon}
            {m.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
