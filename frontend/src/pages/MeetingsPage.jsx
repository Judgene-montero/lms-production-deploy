import React from "react";
import { useParams } from "react-router-dom";

import MeetingsTab from "../components/course/MeetingsTab";

export default function MeetingsPage() {
  const { courseId } = useParams();
  const role = String(localStorage.getItem("role") || "").trim().toLowerCase();

  return <MeetingsTab courseId={courseId} isInstructor={role === "instructor"} standalone />;
}
