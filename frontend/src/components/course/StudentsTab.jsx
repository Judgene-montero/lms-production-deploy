import React, { memo, useCallback, useMemo, useState } from "react";
import { authGet, authPost } from "../../utils/api";

const PAGE_SIZE = 20;

function StudentsTab({ courseId, isInstructor }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [studentIdToAdd, setStudentIdToAdd] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authGet(`/api/courses/${courseId}/students/`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const value = `${student.username || ""} ${student.email || ""} ${student.id || ""}`.toLowerCase();
      return value.includes(query);
    });
  }, [search, students]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const handleAddStudent = useCallback(async () => {
    if (!studentIdToAdd.trim()) return;

    setAdding(true);
    setError("");

    try {
      await authPost(`/api/courses/${courseId}/add-student/`, { student_id: studentIdToAdd.trim() });
      setStudentIdToAdd("");
      await fetchStudents();
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to add student. Verify the student ID.");
    } finally {
      setAdding(false);
    }
  }, [courseId, fetchStudents, studentIdToAdd]);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or ID"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none md:col-span-2"
          />
          {isInstructor && (
            <div className="flex gap-2">
              <input
                value={studentIdToAdd}
                onChange={(event) => setStudentIdToAdd(event.target.value)}
                placeholder="Student ID"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddStudent}
                disabled={adding}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-emerald-50" />
            ))}
          </div>
        ) : paginatedStudents.length === 0 ? (
          <p className="text-sm text-gray-500">No people enrolled.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-emerald-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((student) => (
                    <tr key={student.id} className="border-t border-gray-200 bg-white">
                      <td className="px-4 py-2 font-medium text-gray-800">{student.username || "Unknown"}</td>
                      <td className="px-4 py-2 text-gray-600">{student.email || "-"}</td>
                      <td className="px-4 py-2 text-gray-700">{student.role || "student"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default memo(StudentsTab);
