//src/pages/AdminUploadIDs.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosInstance";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { useTheme } from "../context/ThemeContext";
import { Upload, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

const USERS_URL = "http://127.0.0.1:8000/api/users";
const API_BASE = `${USERS_URL}`;
const PAGE_SIZE = 8;

export default function AdminUploadIDs() {
  const { dark } = useTheme();
  const [file, setFile] = useState(null);
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState({
    duplicateRows: [],
    missingColumns: [],
  });

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("id_desc");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState({ open: false, id: null });

  const getAuthHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access")}`,
    },
  });

  const setTimedNotice = (type, text, timeout = 4500) => {
    setNotice({ type, text });
    if (timeout > 0) {
      setTimeout(() => setNotice({ type: "", text: "" }), timeout);
    }
  };

  const fetch = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/approved-ids/`, getAuthHeaders());
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      setItems([]);
      setTimedNotice("error", "Failed to load approved IDs list.");
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const formatName = (i) =>
    `${i.last_name || ""}, ${i.first_name || ""} ${i.middle_initial ? `${i.middle_initial}.` : ""}`.trim();

  const filtered = useMemo(() => {
    let list = [...items];

    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (i) =>
          formatName(i).toLowerCase().includes(s) ||
          (i.school_id || "").toLowerCase().includes(s) ||
          (i.college || "").toLowerCase().includes(s)
      );
    }

    if (roleFilter) list = list.filter((i) => i.role === roleFilter);

    if (sortBy === "name") list.sort((a, b) => formatName(a).localeCompare(formatName(b)));
    if (sortBy === "id_asc") list.sort((a, b) => (a.school_id || "").localeCompare(b.school_id || ""));
    if (sortBy === "id_desc") list.sort((a, b) => (b.school_id || "").localeCompare(a.school_id || ""));
    if (sortBy === "newest") list.sort((a, b) => b.id - a.id);

    return list;
  }, [items, q, roleFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const parseCsvMeta = async (selectedFile) => {
    const text = await selectedFile.text();
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) {
      return { duplicateRows: [], missingColumns: ["File is empty"] };
    }

    const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const required = ["first_name", "last_name", "school_id", "role", "initial_password"];
    const missingColumns = required.filter((col) => !headers.includes(col));

    const schoolIdIndex = headers.indexOf("school_id");
    const duplicates = [];

    if (schoolIdIndex >= 0) {
      const seen = new Set();
      for (let i = 1; i < rows.length; i += 1) {
        const cols = rows[i].split(",");
        const schoolId = (cols[schoolIdIndex] || "").trim();
        if (!schoolId) continue;

        if (seen.has(schoolId)) {
          duplicates.push(schoolId);
        } else {
          seen.add(schoolId);
        }
      }
    }

    return { duplicateRows: [...new Set(duplicates)], missingColumns };
  };

  const validateAndSetFile = async (selectedFile) => {
    setUploadMeta({ duplicateRows: [], missingColumns: [] });

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const allowed = [".csv", ".xlsx"];
    const lower = selectedFile.name.toLowerCase();
    const ext = allowed.find((x) => lower.endsWith(x));

    if (!ext) {
      setFile(null);
      setTimedNotice("error", "Invalid file format. Use .csv or .xlsx only.");
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setTimedNotice("error", "Selected file is empty.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setTimedNotice("error", "File is too large. Maximum size is 10MB.");
      return;
    }

    setFile(selectedFile);

    if (ext === ".csv") {
      try {
        const meta = await parseCsvMeta(selectedFile);
        setUploadMeta(meta);

        if (meta.missingColumns.length > 0) {
          setTimedNotice("error", `Missing required CSV columns: ${meta.missingColumns.join(", ")}`);
          return;
        }

        if (meta.duplicateRows.length > 0) {
          setTimedNotice(
            "warning",
            `Duplicate school_id rows detected: ${meta.duplicateRows.slice(0, 5).join(", ")}${
              meta.duplicateRows.length > 5 ? "..." : ""
            }`
          );
        }
      } catch (err) {
        setTimedNotice("error", "Could not parse CSV file. Check file format and try again.");
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setTimedNotice("error", "Please select a file before uploading.");
      return;
    }

    if (uploadMeta.missingColumns.length > 0) {
      setTimedNotice("error", "Cannot upload because required columns are missing.");
      return;
    }

    setLoading(true);
    setNotice({ type: "", text: "" });

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/upload-ids/`, fd, getAuthHeaders());
      const created = res.data?.new_records ?? 0;
      const existing = res.data?.already_existing ?? 0;
      setTimedNotice("success", `Upload complete. Added: ${created}. Already existing: ${existing}.`);

      setFile(null);
      setUploadMeta({ duplicateRows: [], missingColumns: [] });
      const input = document.getElementById("fileInput");
      if (input) input.value = "";

      fetch();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Unknown upload error.";
      setTimedNotice("error", `Upload failed. ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id) => setConfirm({ open: true, id });
  const cancelDelete = () => setConfirm({ open: false, id: null });

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE}/delete-id/${confirm.id}/`, getAuthHeaders());
      setTimedNotice("success", "Deleted successfully.", 3000);
      fetch();
    } catch {
      setTimedNotice("error", "Delete failed.", 3000);
    }
    cancelDelete();
  };

  const badgeCls = (role) => {
    if (role === "instructor") return "bg-green-100 text-green-800";
    if (role === "admin") return "bg-red-100 text-red-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className={`transition-colors duration-300 ${dark ? "text-gray-100" : "text-gray-800"}`}>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <Upload className="h-6 w-6 text-blue-500" /> Approved School IDs
      </h1>

      <div className={`mb-4 rounded-lg p-4 shadow ${dark ? "border border-gray-700 bg-gray-900" : "bg-white"}`}>
        <form onSubmit={handleUpload} className="flex flex-col items-center gap-3 sm:flex-row">
          <input
            id="fileInput"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => validateAndSetFile(e.target.files[0])}
            className={`w-full rounded border p-2 ${dark ? "border-gray-700 bg-gray-800 text-gray-100" : ""}`}
          />
          <button
            disabled={loading}
            className={`flex items-center gap-2 rounded px-4 py-2 text-white ${
              loading ? "cursor-not-allowed bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>
        </form>

        {notice.text && (
          <p
            className={`mt-2 rounded px-3 py-2 text-sm font-medium ${
              notice.type === "success"
                ? "bg-green-100 text-green-700"
                : notice.type === "warning"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {notice.text}
          </p>
        )}

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Required columns: first_name, last_name, school_id, role, initial_password. Roles accepted: student, instructor.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, ID or college"
            className={`w-64 rounded border p-2 pl-8 ${dark ? "border-gray-700 bg-gray-800 text-gray-100" : ""}`}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className={`rounded border p-2 ${dark ? "border-gray-700 bg-gray-800 text-gray-100" : ""}`}
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={`rounded border p-2 ${dark ? "border-gray-700 bg-gray-800 text-gray-100" : ""}`}
        >
          <option value="id_desc">Sort: ID (desc)</option>
          <option value="id_asc">Sort: ID (asc)</option>
          <option value="name">Sort: Name</option>
          <option value="newest">Sort: Newest</option>
        </select>
      </div>

      <div className={`overflow-auto rounded-lg shadow ${dark ? "border border-gray-700 bg-gray-900" : "bg-white"}`}>
        <table className="w-full text-sm">
          <thead className={`${dark ? "bg-gray-800" : "bg-gray-100"} font-semibold`}>
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">School ID</th>
              <th className="p-2 text-left">College</th>
              <th className="p-2 text-center">Role</th>
              <th className="p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((i) => (
              <tr key={i.id} className={`border-b ${dark ? "border-gray-700 hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                <td className="p-2">{formatName(i)}</td>
                <td className="p-2">{i.school_id}</td>
                <td className="p-2">{i.college || "N/A"}</td>
                <td className="p-2 text-center">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${badgeCls(i.role)}`}>{i.role}</span>
                </td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => requestDelete(i.id)}
                    className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </td>
              </tr>
            ))}

            {pageData.length === 0 && (
              <tr>
                <td colSpan="5" className="p-3 text-center text-gray-500 dark:text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded border px-3 py-1 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 rounded border px-3 py-1 disabled:opacity-50"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirm.open}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        text="This will permanently delete the approved ID."
      />
    </div>
  );
}

