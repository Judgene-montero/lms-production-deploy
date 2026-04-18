import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

export default function CourseView() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);

  useEffect(() => {
    axios
      .get(`/api/student/course/${id}/`)
      .then((res) => setCourse(res.data))
      .catch(console.error);
  }, [id]);

  if (!course) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{course.title}</h1>
      <p className="mt-2">{course.description}</p>
    </div>
  );
}

