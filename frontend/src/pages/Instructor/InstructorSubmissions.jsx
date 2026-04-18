import React, { useEffect, useState } from "react";
import { authGet } from "../../utils/api";

const InstructorSubmissions = () => {
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    authGet("/api/dashboards/instructor/submissions/")
      .then(setSubs)
      .catch((err) => console.log("Submission error:", err));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Student Submissions</h1>

      {subs.length === 0 && <p>No submissions yet.</p>}

      {subs.map((s) => (
        <div key={s.id} className="p-4 mb-3 border rounded bg-white shadow-sm">
          <p><b>Student:</b> {s.student_name}</p>
          <p><b>Course:</b> {s.course_title}</p>
          <p><b>Submitted at:</b> {s.submitted_at}</p>
        </div>
      ))}
    </div>
  );
};

export default InstructorSubmissions;
