import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authGet, authPost, authPut } from "../../../utils/api";

const TYPE_LABELS = {
  assignment: "Assignment",
  project: "Project",
  material: "Materials",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  due_date: "",
  allow_late_submissions: false,
  points: 100,
  topic: "",
  link: "",
  file: null,
  assignment_instructions: "",
  project_requirements: "",
  material_notes: "",
  project_group_enabled: false,
};

const toDateTimeLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const parseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const buildMetadataByType = (typeKey, form) => {
  if (typeKey === "assignment") {
    return {
      instructions: form.assignment_instructions || "",
    };
  }
  if (typeKey === "project") {
    return {
      requirements: form.project_requirements || "",
    };
  }
  if (typeKey === "material") {
    return {
      notes: form.material_notes || "",
    };
  }
  return {};
};

export default function ClassworkBuilderPage({ typeKey = "assignment", mode = "create" }) {
  const navigate = useNavigate();
  const { courseId, id } = useParams();
  const [activityTypes, setActivityTypes] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");

  const pageTitle = useMemo(() => `${mode === "edit" ? "Edit" : "Create"} ${TYPE_LABELS[typeKey] || "Classwork"}`, [mode, typeKey]);

  const selectedTypeId = useMemo(() => {
    const typeItem = activityTypes.find((item) => String(item.name || "").toLowerCase() === String(typeKey || "").toLowerCase());
    return typeItem?.id || null;
  }, [activityTypes, typeKey]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const types = await authGet("/api/courses/activity-types/");
      setActivityTypes(Array.isArray(types) ? types : []);

      if (mode === "edit" && id) {
        const activity = await authGet(`/api/courses/${courseId}/activities/${id}/`);
        const metadata = parseMetadata(activity?.classwork_metadata);
        setFormData({
          title: activity?.title || "",
          description: activity?.description || "",
          due_date: toDateTimeLocalInput(activity?.due_date),
          allow_late_submissions: Boolean(activity?.allow_late_submissions),
          points: Number(activity?.points ?? 100),
          topic: activity?.topic || "",
          link: activity?.link || "",
          file: null,
          assignment_instructions: String(metadata?.instructions || ""),
          project_requirements: String(metadata?.requirements || ""),
          material_notes: String(metadata?.notes || ""),
          project_group_enabled: Boolean(activity?.project_group_enabled),
        });
      } else {
        setFormData(EMPTY_FORM);
      }
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load classwork form.");
    } finally {
      setLoading(false);
    }
  }, [courseId, id, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const saveActivity = async () => {
    if (!String(formData.title || "").trim()) {
      setError("Title is required.");
      return;
    }
    if (!selectedTypeId) {
      setError("Classwork type is not available. Please refresh and try again.");
      return;
    }

    setSaving(true);
    setError("");
    setStatusText("");

    const payload = new FormData();
    payload.append("activity_type", String(selectedTypeId));
    payload.append("title", String(formData.title || "").trim());
    payload.append("description", String(formData.description || "").trim());
    if (formData.due_date) payload.append("due_date", formData.due_date);
    payload.append("allow_late_submissions", String(Boolean(formData.allow_late_submissions)));
    payload.append("topic", String(formData.topic || "").trim());
    payload.append("link", String(formData.link || "").trim());
    payload.append("project_group_enabled", String(Boolean(formData.project_group_enabled)));
    payload.append("classwork_metadata", JSON.stringify(buildMetadataByType(typeKey, formData)));
    if (typeKey !== "material") {
      payload.append("points", String(Number(formData.points || 0)));
    } else {
      payload.append("points", "0");
      payload.append("grading_type", "none");
    }
    if (formData.file instanceof File) {
      payload.append("file", formData.file);
    }

    try {
      if (mode === "edit" && id) {
        await authPut(`/api/courses/${courseId}/activities/${id}/`, payload);
        setStatusText("Classwork updated successfully.");
      } else {
        await authPost(`/api/courses/${courseId}/activities/add/`, payload);
        setStatusText("Classwork created successfully.");
      }
      navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "classwork" } });
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to save classwork.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-emerald-950">{pageTitle}</h1>
          <p className="text-sm text-gray-600">Dedicated builder for {TYPE_LABELS[typeKey] || "classwork"} with due date and submission settings.</p>
        </header>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {statusText && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusText}</p>}

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Title</span>
              <input
                value={formData.title}
                onChange={(event) => onFieldChange("title", event.target.value)}
                placeholder={`${TYPE_LABELS[typeKey] || "Classwork"} title`}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Topic</span>
              <input
                value={formData.topic}
                onChange={(event) => onFieldChange("topic", event.target.value)}
                placeholder="Optional topic"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Description (Optional)</span>
            <textarea
              value={formData.description}
              onChange={(event) => onFieldChange("description", event.target.value)}
              rows={4}
              placeholder="Describe this classwork."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Due Date</span>
              <input
                type="datetime-local"
                value={formData.due_date}
                onChange={(event) => onFieldChange("due_date", event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            {typeKey !== "material" && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Points</span>
                <input
                  type="number"
                  min={0}
                  value={formData.points}
                  onChange={(event) => onFieldChange("points", Number(event.target.value || 0))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(formData.allow_late_submissions)}
              onChange={(event) => onFieldChange("allow_late_submissions", event.target.checked)}
            />
            Allow late submissions
          </label>

          {typeKey === "project" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(formData.project_group_enabled)}
                onChange={(event) => onFieldChange("project_group_enabled", event.target.checked)}
              />
              Enable group project
            </label>
          )}

          {typeKey === "assignment" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Assignment Instructions</span>
              <textarea
                value={formData.assignment_instructions}
                onChange={(event) => onFieldChange("assignment_instructions", event.target.value)}
                rows={4}
                placeholder="Detailed assignment instructions."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          {typeKey === "project" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Project Requirements</span>
              <textarea
                value={formData.project_requirements}
                onChange={(event) => onFieldChange("project_requirements", event.target.value)}
                rows={4}
                placeholder="Milestones, deliverables, and rubric details."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          {typeKey === "material" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Material Notes</span>
              <textarea
                value={formData.material_notes}
                onChange={(event) => onFieldChange("material_notes", event.target.value)}
                rows={3}
                placeholder="Optional context for learners."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">External Link</span>
              <input
                value={formData.link}
                onChange={(event) => onFieldChange("link", event.target.value)}
                placeholder="https://..."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Upload File</span>
              <input
                type="file"
                onChange={(event) => onFieldChange("file", event.target.files?.[0] || null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "classwork" } })}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={saveActivity}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : mode === "edit" ? "Update Classwork" : "Create Classwork"}
          </button>
        </div>
      </div>
    </div>
  );
}
