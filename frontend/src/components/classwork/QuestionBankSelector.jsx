import React, { useEffect, useMemo, useState } from "react";
import { authGet } from "../../utils/api";

export default function QuestionBankSelector({ courseId, open, onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (difficulty) params.set("difficulty", difficulty);
        const payload = await authGet(`/api/courses/${courseId}/question-bank/?${params.toString()}`);
        setItems(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        console.error(requestError);
        setError("Failed to load question bank.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, difficulty, open, query]);

  const filtered = useMemo(() => items, [items]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-emerald-950">Question Bank</h3>
          <button type="button" onClick={onClose} className="rounded border border-gray-300 px-2 py-1 text-sm">
            Close
          </button>
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by topic or question..."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">No question bank items found.</p>
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{item.question_data?.question_text || "Untitled question"}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.topic || "No topic"} | {item.difficulty || "medium"}
                </p>
                <button
                  type="button"
                  onClick={() => onSelect?.(item.question_data)}
                  className="mt-2 rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
                >
                  Add Question
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
