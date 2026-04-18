import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

export default function Grades() {
  const [grades, setGrades] = useState([]);

  useEffect(() => {
    axios
      .get("/api/student/grades/")
      .then((res) => setGrades(res.data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Grades</h1>
      {grades.map((g, index) => (
        <div key={index} className="bg-white p-4 shadow rounded mb-3">
          {g.assignment} — {g.grade}
        </div>
      ))}
    </div>
  );
}

