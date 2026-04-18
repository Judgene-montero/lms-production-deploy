import React from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const token = localStorage.getItem("access");

  if (!token) return <Navigate to="/login" />;

  try {
    const decoded = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp && decoded.exp < now) {
      localStorage.removeItem("access");
      return <Navigate to="/login" />;
    }

    const roleFromToken = String(decoded?.role || "").trim().toLowerCase();
    const roleFromStorage = String(localStorage.getItem("role") || "").trim().toLowerCase();
    const currentRole = roleFromToken || roleFromStorage;

    if (allowedRoles.length > 0 && !allowedRoles.map((role) => String(role).toLowerCase()).includes(currentRole)) {
      return <Navigate to="/login" />;
    }

    return children;
  } catch {
    return <Navigate to="/login" />;
  }
}
