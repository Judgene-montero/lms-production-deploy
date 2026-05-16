import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AddStudentsModal from "./AddStudentsModal";
import axios from "../../../utils/axiosInstance";

const CourseDashboard = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState({});
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await axios.get(`/api/courses/${courseId}/`);
        setCourse(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCourse();
  }, [courseId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {course.title} Dashboard
      </h1>

      <button
        onClick={() => setShowAddStudent(true)}
        className="px-4 py-2 bg-green-600 text-white rounded mb-4"
      >
        Add Students
      </button>

      {showAddStudent && (
        <AddStudentsModal
          courseId={courseId}
          onClose={() => setShowAddStudent(false)}
        />
      )}

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h2 className="font-bold">Modules</h2>
          <p>List of modules…</p>
        </div>

        <div>
          <h2 className="font-bold">Students</h2>
          <p>List of students…</p>
        </div>

        <div>
          <h2 className="font-bold">Assignments</h2>
          <p>List of assignments…</p>
        </div>
      </div>
    </div>
  );
};

export default CourseDashboard;
