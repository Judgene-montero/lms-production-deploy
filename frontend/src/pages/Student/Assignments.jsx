import React, { useEffect, useState } from "react";
import { authGet } from "../../utils/api";

export default function Assignments() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    authGet("/api/dashboards/student/assignments/")
      .then((data) => setTasks(data))
      .catch((err) => console.error("Assignments Error:", err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Assignments</h2>

      {tasks.length === 0 ? (
        <p className="text-gray-500">No assignments found.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border rounded-lg bg-white shadow"
            >
              <h3 className="font-semibold">{task.title}</h3>
              <p className="text-gray-600">{task.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
