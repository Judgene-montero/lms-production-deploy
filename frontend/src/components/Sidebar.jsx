// src/components/Sidebar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();

  return (
    <aside className="bg-white w-60 h-full shadow-md p-4">
      <ul className="space-y-4 text-gray-700 font-medium">
        <li onClick={() => navigate("/student-dashboard")} className="cursor-pointer hover:text-blue-600">🏠 Dashboard</li>
        <li className="cursor-pointer hover:text-blue-600">📘 My Courses</li>
        <li className="cursor-pointer hover:text-blue-600">📊 Analytics</li>
        <li className="cursor-pointer hover:text-blue-600">🧩 Quizzes</li>
        <li className="cursor-pointer hover:text-blue-600">🤖 Recommendations</li>
      </ul>
    </aside>
  );
};

export default Sidebar;
