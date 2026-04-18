// src/components/Navbar.jsx
import React from "react";

const Navbar = ({ onLogout }) => {
  return (
    <nav className="flex justify-between items-center px-6 py-3 bg-blue-700 text-white shadow-md">
      <h1 className="text-lg font-bold">🎓 MyLMS</h1>
      <div className="flex gap-6">
        <button onClick={onLogout} className="hover:text-gray-200">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
