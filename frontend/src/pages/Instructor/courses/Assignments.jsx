import React from "react";
import { useParams } from "react-router-dom";

const Assignments = () => {
  const { courseId } = useParams();
  return <div className="p-6">Assignments page for course {courseId}</div>;
};

export default Assignments;
