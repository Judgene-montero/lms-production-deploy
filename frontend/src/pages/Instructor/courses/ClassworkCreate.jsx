import React from "react";
import { useLocation } from "react-router-dom";
import QuizBuilderPage from "./QuizBuilderPage";

export default function ClassworkCreate() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const assessment = params.get("assessment");
  const assessmentType = assessment === "exam" ? "exam" : "quiz";

  return (
    <QuizBuilderPage
      mode="create"
      initialPrefill={{
        assessment_type: assessmentType,
      }}
    />
  );
}
