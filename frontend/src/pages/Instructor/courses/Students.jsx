import React from "react";
import { useParams } from "react-router-dom";

const Students = () => {
  const { courseId } = useParams();
  return <div className="p-6">Students page for course {courseId}</div>;
};

export default Students;
