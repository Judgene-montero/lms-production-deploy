import React, { memo, useCallback, useState } from "react";
import axios from "../../../utils/axiosInstance";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseCsvLine = (line) => {
  const output = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      output.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  output.push(value.trim());
  return output;
};

const AddStudentsModal = ({ courseId, onClose }) => {
  const [email, setEmail] = useState("");
  const [inviteByEmail, setInviteByEmail] = useState(true);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const submitSingleEmail = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Single email address is invalid.");
    }

    await axios.post("/api/enrollments/", {
      course: courseId,
      student_email: normalizedEmail,
      send_invite: inviteByEmail,
    });
  }, [courseId, email, inviteByEmail]);

  const parseCsvFile = useCallback(async (file) => {
    if (!file) {
      setBulkRows([]);
      setBulkErrors([]);
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (lines.length < 2) {
      setBulkRows([]);
      setBulkErrors(["CSV must include a header and at least one row."]);
      return;
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const nameIndex = headers.findIndex((header) => ["name", "student_name", "full_name"].includes(header));
    const emailIndex = headers.findIndex((header) => ["email", "student_email"].includes(header));

    if (emailIndex < 0) {
      setBulkRows([]);
      setBulkErrors(["CSV requires an email column."]);
      return;
    }

    const rows = [];
    const errors = [];

    lines.slice(1).forEach((line, index) => {
      const values = parseCsvLine(line);
      const rowName = String(values[nameIndex] || "").trim();
      const rowEmail = String(values[emailIndex] || "").trim().toLowerCase();

      if (!emailRegex.test(rowEmail)) {
        errors.push(`Row ${index + 2}: invalid email \"${rowEmail || "(empty)"}\".`);
      }

      rows.push({ name: rowName, email: rowEmail });
    });

    setBulkRows(rows);
    setBulkErrors(errors);
  }, []);

  const submitBulkRows = useCallback(async () => {
    if (!bulkRows.length) return;
    if (bulkErrors.length) {
      throw new Error("Resolve CSV validation errors before submission.");
    }

    await Promise.all(
      bulkRows.map((row) =>
        axios.post("/api/enrollments/", {
          course: courseId,
          student_email: row.email,
          send_invite: inviteByEmail,
        })
      )
    );
  }, [bulkErrors.length, bulkRows, courseId, inviteByEmail]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setLoading(true);

      try {
        await submitSingleEmail();
        await submitBulkRows();
        onClose();
      } catch (requestError) {
        console.error("Failed to add students", requestError);
        alert(requestError.message || "Unable to add students. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onClose, submitBulkRows, submitSingleEmail]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-emerald-100 bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-emerald-900">Add Students</h2>
        <p className="mt-1 text-sm text-gray-600">Invite one student or upload CSV for bulk enrollment.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Single Student Enrollment</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="email"
                placeholder="student@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={inviteByEmail}
                  onChange={(event) => setInviteByEmail(event.target.checked)}
                />
                Send email invitation
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-white p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Bulk Student Upload (CSV)</h3>
            <p className="mt-1 text-xs text-gray-500">Headers supported: `name`, `email`.</p>
            <input
              type="file"
              accept=".csv"
              onChange={async (event) => {
                const file = event.target.files?.[0] || null;
                setBulkFile(file);
                await parseCsvFile(file);
              }}
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            {bulkFile && <p className="mt-2 text-xs text-emerald-700">Selected: {bulkFile.name}</p>}

            {bulkErrors.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-600">
                {bulkErrors.slice(0, 8).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}

            {bulkRows.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-emerald-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 20).map((row, index) => (
                      <tr key={`${row.email}-${index}`} className="border-t border-gray-200">
                        <td className="px-3 py-2">{row.name || "-"}</td>
                        <td className="px-3 py-2">{row.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
            >
              {loading ? "Saving..." : "Add Students"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default memo(AddStudentsModal);

