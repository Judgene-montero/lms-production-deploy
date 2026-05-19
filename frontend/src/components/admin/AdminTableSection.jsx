import React from "react";

export default function AdminTableSection({ columns, rows, emptyText = "No records found.", renderRow }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="responsive-scroll">
        <table className="w-full min-w-[720px] text-sm sm:min-w-[820px]">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
