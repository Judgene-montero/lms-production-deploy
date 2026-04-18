import React, { memo, useCallback, useState } from "react";
import { authGet, authPost } from "../../utils/api";

function CommentsTab({ courseId, isInstructor }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authGet(`/api/courses/${courseId}/comments/`);
      setComments(Array.isArray(data) ? data : []);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = useCallback(async () => {
    if (!newComment.trim()) return;
    setSaving(true);
    setError("");

    try {
      await authPost(`/api/courses/${courseId}/comments/add/`, { comment: newComment.trim() });
      setNewComment("");
      await fetchComments();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to submit comment. Please verify backend comments/add endpoint.");
    } finally {
      setSaving(false);
    }
  }, [courseId, fetchComments, newComment]);

  return (
    <div className="space-y-4">
      {isInstructor && (
        <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-900">Add Comment</h3>
          <textarea
            rows={3}
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Write a class comment"
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handlePostComment}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-emerald-900">Course Comments</h3>
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-emerald-50" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500">No comments yet.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 text-sm text-gray-700">
                {comment.comment || comment.text || "(empty)"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default memo(CommentsTab);
