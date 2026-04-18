import React, { memo } from "react";

function StudentOverviewTab({
  loading,
  paginatedStudents,
  totalPages,
  page,
  setPage,
  selectedIds,
  getSelectionKey,
  isCurrentPageFullySelected,
  toggleSelectAllCurrentPage,
  toggleSelected,
  openStudentDrawer,
  handleRemoveStudent,
  handleResendInvite,
  formatRelativeDate,
  riskBadgeClass,
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        {[...Array(8)].map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded bg-emerald-50" />
        ))}
      </div>
    );
  }

  if (!paginatedStudents.length) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 p-8 text-center">
        <p className="text-sm text-gray-600">No students enrolled yet</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={isCurrentPageFullySelected} onChange={toggleSelectAllCurrentPage} />
              </th>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Course</th>
              <th className="px-3 py-2 text-left">Progress</th>
              <th className="px-3 py-2 text-left">Total Points</th>
              <th className="px-3 py-2 text-left">Risk Level</th>
              <th className="px-3 py-2 text-left">Last Active</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student) => {
              const selectionKey = getSelectionKey(student);
              return (
                <tr key={selectionKey} className="border-t border-gray-200 bg-white">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(selectionKey)} onChange={() => toggleSelected(student)} />
                  </td>
                  <td
                    className="cursor-pointer px-3 py-2 font-medium text-gray-800 hover:text-emerald-700"
                    onClick={() => openStudentDrawer(student)}
                  >
                    {student.name}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{student.email || "-"}</td>
                  <td className="px-3 py-2 text-gray-700">{student.courseName || "-"}</td>
                  <td className="px-3 py-2 text-gray-700">{student.progress}%</td>
                  <td className="px-3 py-2 text-gray-700">{student.totalPoints} pts</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskBadgeClass(student.riskLevel)}`}>
                      {String(student.riskLevel || "low").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{formatRelativeDate(student.lastActive)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openStudentDrawer(student)}
                        className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(student)}
                        className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResendInvite(student)}
                        className="rounded border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        Resend Invite
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
            .map((pageValue) => (
              <button
                key={pageValue}
                type="button"
                onClick={() => setPage(pageValue)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  pageValue === page ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pageValue}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      )}
    </section>
  );
}

export default memo(StudentOverviewTab);
