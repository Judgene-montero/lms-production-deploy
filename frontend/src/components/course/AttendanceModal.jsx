import React, { memo, useEffect, useMemo, useState } from "react";
import { ATTENDANCE_OPTIONS, statusButtonClass } from "./attendanceConfig";

function AttendanceModal({
  isOpen,
  mode,
  students,
  sessions,
  selectedSessionId,
  setSelectedSessionId,
  selectedSessionActivity,
  sessionDraft,
  setSessionDraft,
  attendanceForSession,
  statusPoints,
  isInstructor,
  saving,
  onClose,
  onCreateSession,
  onSaveSession,
  onDeleteSession,
  onStatusChange,
  onPointsChange,
  onBulkStatus,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setStatusFilter("all");
    setCurrentPage(1);
    setSelectedStudentIds([]);
  }, [isOpen, mode, selectedSessionId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, rowsPerPage]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byQuery = students.filter((student) => {
      const name = String(student.username || "").toLowerCase();
      const schoolId = String(student.school_id || "").toLowerCase();
      return !query || name.includes(query) || schoolId.includes(query);
    });
    if (statusFilter === "all") return byQuery;
    return byQuery.filter((student) => {
      const current = attendanceForSession[String(student.id)]?.status;
      return current === statusFilter;
    });
  }, [students, search, statusFilter, attendanceForSession]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredStudents.length / Math.max(1, rowsPerPage))),
    [filteredStudents.length, rowsPerPage]
  );

  const paginatedStudents = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * rowsPerPage;
    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, currentPage, rowsPerPage, totalPages]);

  const selectedIdSet = useMemo(() => new Set(selectedStudentIds.map((id) => String(id))), [selectedStudentIds]);

  const toggleStudentSelection = (studentId) => {
    const key = String(studentId);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev.map((id) => String(id)));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return Array.from(next);
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((student) => String(student.id));
    if (!filteredIds.length) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev.map((id) => String(id)));
      const allSelected = filteredIds.every((id) => next.has(id));
      if (allSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
  };

  if (!isOpen || !isInstructor) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-2 sm:p-3">
      <section className="mx-auto my-3 flex min-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl sm:my-6 sm:min-h-0 sm:max-h-[90vh]">
        <header className="flex flex-col gap-2 border-b border-emerald-100 bg-emerald-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h4 className="text-lg font-semibold text-emerald-950">
              {mode === "create" ? "Create Attendance Session" : "Mark Attendance"}
            </h4>
            <p className="text-xs text-gray-600">
              {mode === "create"
                ? "Set date and topic, create the session, then mark student attendance."
                : "Use bulk actions first, then fine-tune per student."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 sm:w-auto"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {mode === "create" && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Date
                  <input
                    type="date"
                    value={sessionDraft.date}
                    onChange={(event) => setSessionDraft((prev) => ({ ...prev, date: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Topic
                  <input
                    value={sessionDraft.topic}
                    onChange={(event) => setSessionDraft((prev) => ({ ...prev, topic: event.target.value }))}
                    placeholder="Attendance"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </section>
          )}

          {mode === "edit" && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              {selectedSessionActivity && (
                <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Editing: <span className="font-semibold">{selectedSessionActivity.date} - {selectedSessionActivity.topic}</span>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={(event) => setSelectedSessionId(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select attendance session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.date} - {session.topic}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Find student</label>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or school id"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Filter status</label>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All</option>
                    {ATTENDANCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                >
                  Toggle all filtered ({filteredStudents.length})
                </button>
                <span className="w-full text-xs text-gray-500 sm:w-auto">
                  Showing {Math.min(filteredStudents.length, (currentPage - 1) * rowsPerPage + 1)}-
                  {Math.min(filteredStudents.length, currentPage * rowsPerPage)} of {filteredStudents.length}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                <span className="w-full text-xs font-semibold uppercase tracking-wide text-emerald-800 sm:w-auto">
                  Bulk mark ({selectedStudentIds.length})
                </span>
                {ATTENDANCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onBulkStatus(selectedStudentIds, option.value)}
                    disabled={!selectedStudentIds.length}
                    className={statusButtonClass(option.value, false)}
                  >
                    {option.short}
                  </button>
                ))}
              </div>

              {!selectedSessionActivity ? (
                <p className="mt-4 text-sm text-gray-500">Select a session to mark attendance.</p>
              ) : (
                <div className="mt-4 grid max-h-[52vh] gap-3 overflow-y-auto pr-0 sm:pr-1">
                  {paginatedStudents.map((student) => {
                    const state = attendanceForSession[String(student.id)] || {};
                    const statusValue = state.status || "";
                    const defaultPoints = Number(statusPoints[statusValue] ?? 0);
                    const pointsValue = state.points_earned === "" || state.points_earned === undefined
                      ? defaultPoints
                      : Number(state.points_earned);

                    return (
                      <article
                        key={student.id}
                        className="rounded-xl border border-gray-200 px-3 py-3 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3 sm:rounded-lg sm:py-2"
                      >
                        <div className="flex items-start gap-3 sm:contents">
                          <input
                            type="checkbox"
                            checked={selectedIdSet.has(String(student.id))}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 sm:mt-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium text-gray-800">{student.username}</p>
                            <p className="mt-1 break-words text-xs text-gray-500">
                              {student.school_id || "No school id"} | Points: {Number.isFinite(pointsValue) ? pointsValue.toFixed(2) : "0.00"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white p-1 sm:mt-0">
                          {ATTENDANCE_OPTIONS.map((option) => (
                            <button
                              key={`${student.id}-${option.value}`}
                              type="button"
                              onClick={() => onStatusChange(student.id, option.value)}
                              className={statusButtonClass(option.value, statusValue === option.value)}
                            >
                              {option.short}
                            </button>
                          ))}
                        </div>
                        <label className="mt-3 block text-xs text-gray-600 sm:mt-0">
                          Points
                          <input
                            type="number"
                            step="0.01"
                            value={state.points_earned ?? ""}
                            onChange={(event) => onPointsChange(student.id, event.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm sm:w-24"
                          />
                        </label>
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-xs text-gray-600">
                  Rows per page
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                    className="ml-0 mt-1 block rounded border border-gray-300 px-2 py-1 text-xs sm:ml-2 sm:mt-0 sm:inline-block"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                    <option value={40}>40</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-gray-600">Page {Math.min(currentPage, totalPages)} / {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-emerald-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            {mode === "edit" && selectedSessionActivity && (
              <button
                type="button"
                onClick={onDeleteSession}
                disabled={saving}
                className="w-full rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 sm:w-auto"
              >
                Delete Session
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={mode === "create" ? onCreateSession : onSaveSession}
              disabled={saving || (mode === "edit" && !selectedSessionActivity)}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving..." : mode === "create" ? "Create Session" : "Save Attendance"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default memo(AttendanceModal);
