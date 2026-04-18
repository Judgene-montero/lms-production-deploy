import React, { memo, useCallback, useMemo, useState } from "react";
import { Megaphone, ClipboardList } from "lucide-react";
import { authGet, authPost } from "../../utils/api";

const normalizeExternalLink = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const StreamItem = memo(function StreamItem({ item, onOpenClasswork }) {
  const isAnnouncement = item.itemType === "announcement";

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            {isAnnouncement ? <Megaphone className="text-emerald-700" size={18} /> : <ClipboardList className="text-emerald-700" size={18} />}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {isAnnouncement ? item.author_username || "Instructor" : "New Classwork"}
            </p>
            <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {isAnnouncement ? (
        <div className="space-y-2 text-sm text-gray-700">
          <p className="whitespace-pre-line">{item.text}</p>
          {item.file && (
            <a href={item.file} target="_blank" rel="noreferrer" className="block text-blue-600 underline">
              Download File
            </a>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="block text-blue-600 underline">
              Open Link
            </a>
          )}
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold text-emerald-950">{item.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {item.activity_type_name && <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{item.activity_type_name}</span>}
            {item.points !== null && item.points !== undefined && <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{item.points} pts</span>}
            {item.due_date && <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Due: {new Date(item.due_date).toLocaleString()}</span>}
          </div>
          <button
            type="button"
            onClick={() => onOpenClasswork(item)}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            View Classwork
          </button>
        </div>
      )}
    </article>
  );
});

function StreamTab({ courseId, isInstructor, onOpenClasswork }) {
  const [announcements, setAnnouncements] = useState([]);
  const [announcementData, setAnnouncementData] = useState({ text: "", file: null, link: "" });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const fetchStream = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ann, activities] = await Promise.all([
        authGet(`/api/courses/${courseId}/announcements/`),
        authGet(`/api/courses/${courseId}/activities/`),
      ]);

      const formatted = [
        ...(Array.isArray(ann) ? ann : []).map((item) => ({ ...item, itemType: "announcement" })),
        ...(Array.isArray(activities) ? activities : []).map((item) => ({ ...item, itemType: "classwork" })),
      ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setAnnouncements(formatted);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load stream feed.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  const handlePostAnnouncement = useCallback(async () => {
    if (!announcementData.text.trim()) return;

    setPosting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("text", announcementData.text.trim());
      if (announcementData.file) formData.append("file", announcementData.file);
      const normalizedLink = normalizeExternalLink(announcementData.link);
      if (normalizedLink) formData.append("link", normalizedLink);

      await authPost(`/api/courses/${courseId}/announcements/add/`, formData);
      setAnnouncementData({ text: "", file: null, link: "" });
      await fetchStream();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to post announcement.");
    } finally {
      setPosting(false);
    }
  }, [announcementData, courseId, fetchStream]);

  const streamItems = useMemo(() => announcements, [announcements]);

  return (
    <div className="space-y-4">
      {isInstructor && (
        <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-900">Post an Announcement</h3>
          <textarea
            value={announcementData.text}
            onChange={(event) => setAnnouncementData((prev) => ({ ...prev, text: event.target.value }))}
            placeholder="Share an update with your class"
            rows={3}
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={announcementData.link}
              onChange={(event) => setAnnouncementData((prev) => ({ ...prev, link: event.target.value }))}
              placeholder="Optional link"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="file"
              onChange={(event) => setAnnouncementData((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handlePostAnnouncement}
              disabled={posting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-emerald-50" />
          ))}
        </div>
      ) : streamItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-gray-500">No posts yet.</p>
      ) : (
        <div className="space-y-3">
          {streamItems.map((item) => (
            <StreamItem key={`${item.itemType}-${item.id}`} item={item} onOpenClasswork={onOpenClasswork} />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(StreamTab);
