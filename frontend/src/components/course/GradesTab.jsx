import React, { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { authGet, authPut, authPost } from "../../utils/api";

const EMPTY_SCHEME = {
  grading_type: "zero_based",
  passing_grade: 75,
  custom_config: {
    auto_detect_activities: true,
    treat_missing_as_zero: true,
    passfail_threshold: 60,
    component_rules: [],
    formula_expression: "",
  },
  components: [],
};

const GRADING_TYPE_COPY = {
  zero_based: {
    title: "Zero-Based",
    tip: "Standard weighted percentages across all mapped activities.",
    formula: "Final Grade = weighted total",
  },
  transmuted: {
    title: "Base-50",
    tip: "Applies the base-50 floor: 50 + (weighted total x 0.5).",
    formula: "Final Grade = 50 + (Weighted Total x 0.5)",
  },
  custom: {
    title: "Custom",
    tip: "Supports category rules, drop-lowest settings, and optional formula overrides.",
    formula: "Final Grade = custom formula or custom transmutation",
  },
};

const defaultComponent = (seed = {}) => ({
  name: seed.name || "",
  weight: seed.weight ?? "",
  category_key: seed.category_key || "",
  drop_lowest_count: seed.drop_lowest_count ?? 0,
  activity_ids: Array.isArray(seed.activity_ids) ? seed.activity_ids : [],
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeActivityIds = (activityIds, validIds) => {
  if (!Array.isArray(activityIds)) return [];
  return activityIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && (!validIds || validIds.has(value)));
};

const extractApiErrorMessage = (payload) => {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return payload.map((item) => extractApiErrorMessage(item)).filter(Boolean).join(" ");
  if (typeof payload === "object") {
    const messages = Object.entries(payload)
      .map(([key, value]) => {
        const text = extractApiErrorMessage(value);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean);
    return messages.join(" | ");
  }
  return "";
};

const uniqueName = (baseLabel, components) => {
  const trimmed = String(baseLabel || "Component").trim() || "Component";
  const existing = new Set(components.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean));
  if (!existing.has(trimmed.toLowerCase())) return trimmed;
  let index = 2;
  while (existing.has(`${trimmed} ${index}`.toLowerCase())) index += 1;
  return `${trimmed} ${index}`;
};

const summarizeCategories = (activities = []) => {
  const map = new Map();
  activities.forEach((activity) => {
    const key = String(activity.category_key || "other");
    map.set(key, {
      key,
      label: activity.category_label || key,
      count: (map.get(key)?.count || 0) + 1,
    });
  });
  return Array.from(map.values());
};

const previewGrade = (row, gradingType) => {
  const weightedTotal = toNumber(row?.weighted_total, 0);
  if (gradingType === "transmuted") return Math.min(100, 50 + weightedTotal * 0.5);
  if (gradingType === "zero_based") return weightedTotal;
  return toNumber(row?.final_grade, weightedTotal);
};

export default function GradesTab({ courseId, isInstructor }) {
  const [scheme, setScheme] = useState(EMPTY_SCHEME);
  const [schemeMeta, setSchemeMeta] = useState({
    detected_activities: [],
    available_categories: [],
    suggested_components: [],
  });
  const [gradeSheet, setGradeSheet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const totalWeight = useMemo(
    () => scheme.components.reduce((sum, item) => sum + toNumber(item.weight), 0),
    [scheme.components]
  );

  const componentColumns = useMemo(() => {
    if (scheme.components.length) return scheme.components.map((item) => item.name || "Unnamed");
    const fromSheet = new Set();
    gradeSheet.forEach((row) => {
      Object.keys(row.components || {}).forEach((name) => fromSheet.add(name));
    });
    return Array.from(fromSheet);
  }, [gradeSheet, scheme.components]);

  const detectedCategories = useMemo(() => {
    if (Array.isArray(schemeMeta.available_categories) && schemeMeta.available_categories.length) {
      return schemeMeta.available_categories;
    }
    return summarizeCategories(schemeMeta.detected_activities);
  }, [schemeMeta]);

  const activeTypeCopy = GRADING_TYPE_COPY[scheme.grading_type] || GRADING_TYPE_COPY.zero_based;

  const loadScheme = useCallback(async () => {
    try {
      const data = await authGet(`/api/courses/${courseId}/grading-scheme/`);
      const customConfig = data?.custom_config && typeof data.custom_config === "object" ? data.custom_config : {};
      const componentRules = Array.isArray(customConfig.component_rules) ? customConfig.component_rules : [];
      const rulesByName = new Map(
        componentRules.map((item) => [String(item.component_name || item.name || "").trim().toLowerCase(), item])
      );
      const components = Array.isArray(data?.components) ? data.components : [];
      const suggested = Array.isArray(data?.suggested_components) ? data.suggested_components : [];
      const validActivityIds = new Set(
        (Array.isArray(data?.detected_activities) ? data.detected_activities : [])
          .map((item) => Number(item?.id))
          .filter((value) => Number.isInteger(value) && value > 0)
      );
      setScheme({
        grading_type: data?.grading_type || "zero_based",
        passing_grade: Number(data?.passing_grade ?? 75),
        custom_config: {
          auto_detect_activities: customConfig.auto_detect_activities ?? true,
          treat_missing_as_zero: customConfig.treat_missing_as_zero ?? true,
          passfail_threshold: Number(customConfig.passfail_threshold ?? 60),
          component_rules: componentRules,
          formula_expression: String(customConfig.formula_expression || ""),
          transmutation_table: Array.isArray(customConfig.transmutation_table) ? customConfig.transmutation_table : [],
        },
        components: (components.length ? components : suggested).map((item) => {
          const rule = rulesByName.get(String(item.name || "").trim().toLowerCase()) || {};
          return defaultComponent({
            ...item,
            category_key: item.category_key || rule.category_key || "",
            drop_lowest_count: rule.drop_lowest_count ?? item.drop_lowest_count ?? 0,
            activity_ids: sanitizeActivityIds(item.activity_ids, validActivityIds),
          });
        }),
      });
      setSchemeMeta({
        detected_activities: Array.isArray(data?.detected_activities) ? data.detected_activities : [],
        available_categories: Array.isArray(data?.available_categories) ? data.available_categories : [],
        suggested_components: suggested,
      });
    } catch {
      setError("Failed to load grading scheme.");
    }
  }, [courseId]);

  const loadGradeSheet = useCallback(async () => {
    setSheetLoading(true);
    try {
      const data = await authGet(`/api/courses/${courseId}/gradesheet/`);
      setGradeSheet(Array.isArray(data) ? data : []);
    } catch {
      setGradeSheet([]);
      setStatus("Grade sheet is unavailable until grading scheme is configured.");
    } finally {
      setSheetLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");
      setStatus("");
      await loadScheme();
      await loadGradeSheet();
      setLoading(false);
    };
    init();
  }, [loadGradeSheet, loadScheme]);

  const updateComponent = useCallback((index, patch) => {
    setScheme((prev) => ({
      ...prev,
      components: prev.components.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }, []);

  const addSuggestedComponents = useCallback(() => {
    setScheme((prev) => {
      const source =
        schemeMeta.suggested_components?.length
          ? schemeMeta.suggested_components
          : detectedCategories.map((item) => ({
              name: item.label,
              category_key: item.key,
              weight: 0,
              drop_lowest_count: 0,
            }));
      const nextComponents = [...prev.components];
      source.forEach((item) => {
        nextComponents.push(defaultComponent({ ...item, name: uniqueName(item.name || item.label, nextComponents) }));
      });
      return { ...prev, components: nextComponents };
    });
  }, [detectedCategories, schemeMeta.suggested_components]);

  const saveScheme = async () => {
    if (!isInstructor) return;
    if (!scheme.components.length) {
      setError("Add at least one grading category.");
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.0001) {
      setError("Total component weight must equal 100%.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");
    try {
      const validActivityIds = new Set(
        (Array.isArray(schemeMeta.detected_activities) ? schemeMeta.detected_activities : [])
          .map((item) => Number(item?.id))
          .filter((value) => Number.isInteger(value) && value > 0)
      );
      const componentsPayload = scheme.components.map((item) => ({
        name: String(item.name || "").trim(),
        weight: toNumber(item.weight),
        activity_ids: sanitizeActivityIds(item.activity_ids, validActivityIds),
      }));
      const customConfigPayload =
        scheme.custom_config && typeof scheme.custom_config === "object" ? { ...scheme.custom_config } : {};
      customConfigPayload.passfail_threshold = toNumber(customConfigPayload.passfail_threshold, 60);
      customConfigPayload.auto_detect_activities = Boolean(customConfigPayload.auto_detect_activities);
      customConfigPayload.treat_missing_as_zero = Boolean(customConfigPayload.treat_missing_as_zero);
      if (!Array.isArray(customConfigPayload.transmutation_table) || !customConfigPayload.transmutation_table.length) {
        delete customConfigPayload.transmutation_table;
      }
      customConfigPayload.component_rules = scheme.components.map((item) => ({
        component_name: String(item.name || "").trim(),
        category_key: item.category_key || "",
        drop_lowest_count: Math.max(0, parseInt(item.drop_lowest_count || 0, 10) || 0),
        auto_include_matches: true,
      }));

      await authPut(`/api/courses/${courseId}/grading-scheme/`, {
        grading_type: scheme.grading_type,
        passing_grade: toNumber(scheme.passing_grade),
        custom_config: customConfigPayload,
        components: componentsPayload,
      });
      setStatus("Grading scheme saved and grade previews refreshed.");
      await loadScheme();
      await loadGradeSheet();
    } catch (requestError) {
      const apiMessage = extractApiErrorMessage(requestError?.cause) || requestError?.message || "";
      setError(apiMessage ? `Failed to save grading scheme: ${apiMessage}` : "Failed to save grading scheme.");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    if (!gradeSheet.length) return;
    setError("");
    setStatus("");
    try {
      const response = await axiosInstance.get(`/api/courses/${courseId}/gradesheet/export/`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `course-${courseId}-gradesheet.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setStatus("Excel grade sheet exported.");
    } catch {
      setError("Failed to export Excel grade sheet.");
    }
  };

  const uploadCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setSaving(true);
    setError("");
    setStatus("");
    try {
      await authPost(`/api/courses/${courseId}/upload-grades/`, formData);
      setStatus("CSV grades uploaded.");
      await loadGradeSheet();
    } catch (requestError) {
      const apiMessage = extractApiErrorMessage(requestError?.cause) || requestError?.message || "";
      setError(apiMessage ? `Failed to upload grade CSV: ${apiMessage}` : "Failed to upload grade CSV.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading grades...</p>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {status && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}

      {isInstructor && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Grading Scheme</h3>
              <p className="mt-1 text-sm text-gray-600">{activeTypeCopy.tip}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="font-semibold">{activeTypeCopy.title}</p>
              <p>{activeTypeCopy.formula}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm text-gray-700">
              Grading Type
              <select
                value={scheme.grading_type}
                onChange={(event) => setScheme((prev) => ({ ...prev, grading_type: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="zero_based">Zero-Based</option>
                <option value="transmuted">Base-50</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="text-sm text-gray-700">
              Passing Grade
              <input
                type="number"
                min="0"
                max="100"
                value={scheme.passing_grade}
                onChange={(event) => setScheme((prev) => ({ ...prev, passing_grade: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(scheme.custom_config.auto_detect_activities)}
                onChange={(event) =>
                  setScheme((prev) => ({
                    ...prev,
                    custom_config: { ...prev.custom_config, auto_detect_activities: event.target.checked },
                  }))
                }
              />
              Auto-detect activities
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(scheme.custom_config.treat_missing_as_zero)}
                onChange={(event) =>
                  setScheme((prev) => ({
                    ...prev,
                    custom_config: { ...prev.custom_config, treat_missing_as_zero: event.target.checked },
                  }))
                }
              />
              Missing work counts as zero
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Category Weights</h4>
                  <p className="text-xs text-gray-600">Map activities by category and optionally drop low scores.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addSuggestedComponents}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
                  >
                    Use Suggested
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheme((prev) => ({ ...prev, components: [...prev.components, defaultComponent()] }))}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
                  >
                    Add Category
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {scheme.components.map((component, index) => (
                  <div key={`component-${index}`} className="grid gap-2 rounded-xl border border-gray-200 p-3 md:grid-cols-[1.3fr_120px_170px_120px_100px]">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={component.name}
                      onChange={(event) => updateComponent(index, { name: event.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Weight %"
                      value={component.weight}
                      onChange={(event) => updateComponent(index, { weight: event.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={component.category_key || ""}
                      onChange={(event) => updateComponent(index, { category_key: event.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Manual/legacy match</option>
                      {detectedCategories.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label} ({item.count})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      placeholder="Drop lowest"
                      value={component.drop_lowest_count}
                      onChange={(event) => updateComponent(index, { drop_lowest_count: event.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setScheme((prev) => ({
                          ...prev,
                          components: prev.components.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className={`text-sm font-medium ${Math.abs(totalWeight - 100) < 0.0001 ? "text-emerald-700" : "text-amber-700"}`}>
                  Total Weight: {totalWeight.toFixed(2)}%
                </p>
                <button
                  type="button"
                  onClick={saveScheme}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save Scheme"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900">Detected Activities</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detectedCategories.map((item) => (
                    <span key={item.key} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {item.label}: {item.count}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Existing and newly created classwork is auto-detected, so grading no longer depends on creation order.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900">Custom Rules</h4>
                <div className="mt-3 space-y-3">
                  <label className="text-sm text-gray-700">
                    Pass/Fail Threshold
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scheme.custom_config.passfail_threshold}
                      onChange={(event) =>
                        setScheme((prev) => ({
                          ...prev,
                          custom_config: { ...prev.custom_config, passfail_threshold: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>

                  {scheme.grading_type === "custom" && (
                    <label className="text-sm text-gray-700">
                      Custom Final Formula
                      <textarea
                        rows={4}
                        value={scheme.custom_config.formula_expression || ""}
                        onChange={(event) =>
                          setScheme((prev) => ({
                            ...prev,
                            custom_config: { ...prev.custom_config, formula_expression: event.target.value },
                          }))
                        }
                        placeholder="weighted_total or quiz_weighted + assignment_weighted + exam_weighted"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Grade Sheet</h3>
            <p className="text-sm text-gray-600">Review weighted totals, preview the active grading type, and export an audit-ready Excel file.</p>
          </div>
          <div className="flex items-center gap-2">
            {isInstructor && (
              <label className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700">
                Upload CSV
                <input type="file" accept=".csv" className="hidden" onChange={uploadCsv} />
              </label>
            )}
            <button
              type="button"
              onClick={exportExcel}
              disabled={!gradeSheet.length}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:opacity-60"
            >
              Export Excel
            </button>
          </div>
        </div>

        {sheetLoading ? (
          <p className="text-sm text-gray-500">Loading grade sheet...</p>
        ) : !gradeSheet.length ? (
          <p className="text-sm text-gray-500">No grade rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Student Name</th>
                  {componentColumns.map((name) => (
                    <th key={name} className="px-3 py-2 text-left font-semibold text-gray-700">
                      {name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Weighted Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Preview Grade</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Final Grade</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {gradeSheet.map((row) => (
                  <tr key={row.student_id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{row.student_name}</td>
                    {componentColumns.map((name) => (
                      <td key={`${row.student_id}-${name}`} className="px-3 py-2 text-gray-700">
                        {Number(row?.components?.[name]?.raw || 0).toFixed(2)}
                        <span className="text-xs text-gray-500"> / {Number(row?.components?.[name]?.weighted || 0).toFixed(2)}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2 font-medium text-gray-800">{Number(row.weighted_total || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 font-medium text-emerald-700">{previewGrade(row, scheme.grading_type).toFixed(2)}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{Number(row.final_grade || 0).toFixed(2)}</td>
                    <td className={`px-3 py-2 font-medium ${row.status === "Passed" ? "text-emerald-700" : "text-red-700"}`}>
                      {row.status}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(row)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      >
                        View Breakdown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedStudent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedStudent(null)}>
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <h4 className="text-lg font-semibold text-gray-900">{selectedStudent.student_name} - Breakdown</h4>
            <p className="mt-1 text-sm text-gray-600">{selectedStudent.formula_text || selectedStudent.formula}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {Object.entries(selectedStudent.components || {}).map(([name, details]) => (
                <div key={name} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="mt-1">Raw: {Number(details.raw || 0).toFixed(2)}</p>
                  <p>Weight: {Number(details.weight || 0).toFixed(2)}%</p>
                  <p>Weighted: {Number(details.weighted || 0).toFixed(2)}</p>
                  <p className="mt-1 text-xs text-gray-500">{details.formula}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 p-3">
              <h5 className="text-sm font-semibold text-gray-900">Activity Breakdown</h5>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left">Activity</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Score</th>
                      <th className="px-3 py-2 text-left">Max</th>
                      <th className="px-3 py-2 text-left">Normalized</th>
                      <th className="px-3 py-2 text-left">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedStudent.activities || []).map((activity) => (
                      <tr key={activity.activity_id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{activity.title}</td>
                        <td className="px-3 py-2">{activity.category_label}</td>
                        <td className="px-3 py-2">{activity.score ?? "-"}</td>
                        <td className="px-3 py-2">{activity.max_score ?? "-"}</td>
                        <td className="px-3 py-2">{activity.normalized_score ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {[activity.missing ? "Missing" : "", activity.dropped ? "Dropped" : "", activity.excluded ? "Excluded" : ""]
                            .filter(Boolean)
                            .join(", ") || "Included"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedStudent.uncovered_activities?.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Unmapped activities detected: {selectedStudent.uncovered_activities.map((item) => item.title).join(", ")}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setSelectedStudent(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
