import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../../utils/axiosInstance";

const DeleteCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.delete(`/api/courses/${courseId}/`);

      if (res.status === 204) {
        navigate("/instructor-dashboard/courses");
      } else {
        setError("Unexpected response from server.");
      }
    } catch (err) {
      console.error(err);

      if (err.response) {
        if (err.response.status === 403) {
          setError("You are not allowed to delete this course.");
        } else if (err.response.status === 404) {
          setError("Course not found or already deleted.");
        } else {
          setError("Failed to delete course. Server error.");
        }
      } else {
        setError("Network error. Please try again.");
      }

      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-600">Delete Course</h1>

      <p className="mb-6">
        Are you sure you want to <b>permanently delete</b> this course? This
        action cannot be undone.
      </p>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="flex gap-4">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          {loading ? "Deleting..." : "Yes, Delete"}
        </button>

        <button
          onClick={() => navigate("/instructor-dashboard/courses")}
          className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DeleteCourse;

