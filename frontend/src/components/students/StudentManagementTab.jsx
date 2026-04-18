import React, { memo, useState } from "react";

function StudentManagementTab({
  bulkAction,
  setBulkAction,
  bulkActions,
  bulkLoading,
  selectedCount,
  handleBulkAction,
  handleQuickAction,
  note,
  setNote,
  saveNote,
  csvRows,
  csvErrors,
  importing,
  handleCsvImportFile,
  handleSubmitImport,
  exportAll,
  exportFiltered,
  exportSelected,
}) {
  const [noteSaving, setNoteSaving] = useState(false);

  const onSaveNote = async () => {
    setNoteSaving(true);
    await saveNote();
    setNoteSaving(false);
  };

  return (
    <section className="space-y-4">
      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-emerald-900">Bulk Actions</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {bulkActions.map((action) => (
              <option key={action.key} value={action.key}>{action.label}</option>
            ))}
          </select>
          <button type="button" onClick={handleBulkAction} disabled={bulkLoading} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {bulkLoading ? "Processing..." : `Apply to ${selectedCount} selected`}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-emerald-900">Instructor Quick Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => handleQuickAction("send_reminder")} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">Send Reminder</button>
          <button type="button" onClick={() => handleQuickAction("send_message")} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Send Message</button>
          <button type="button" onClick={() => handleQuickAction("schedule_meeting")} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Schedule Meeting</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional instructor note for selected students" className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-4" />
          <button type="button" onClick={onSaveNote} disabled={noteSaving} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">{noteSaving ? "Saving..." : "Save Note"}</button>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-emerald-900">CSV Tools</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={exportAll} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Export All Students</button>
          <button type="button" onClick={exportFiltered} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Export Filtered Students</button>
          <button type="button" onClick={exportSelected} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Export Selected Students</button>
        </div>

        <h4 className="mt-5 text-sm font-semibold text-emerald-900">Import Students (CSV)</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="file" accept=".csv" onChange={handleCsvImportFile} className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
          <button type="button" onClick={handleSubmitImport} disabled={importing || !csvRows.length} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">{importing ? "Importing..." : "Submit Import"}</button>
        </div>

        {csvErrors.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-600">
            {csvErrors.slice(0, 8).map((item) => (<li key={item}>{item}</li>))}
          </ul>
        )}

        {csvRows.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50 text-gray-700"><tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Student ID</th></tr></thead>
              <tbody>
                {csvRows.slice(0, 20).map((row, index) => (
                  <tr key={`${row.email}-${index}`} className="border-t border-gray-200"><td className="px-3 py-2">{row.name || "-"}</td><td className="px-3 py-2">{row.email || "-"}</td><td className="px-3 py-2">{row.student_id || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default memo(StudentManagementTab);
