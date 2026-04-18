import React from "react";
import { useParams } from "react-router-dom";

const Modules = () => {
  const { courseId } = useParams(); // gets the :courseId from URL
  return <div className="p-6">Modules page for course {courseId}</div>;
};

export default Modules;
