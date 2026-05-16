import React, { useCallback, useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import { Pencil, Plus, RefreshCw, Tag, Trash2, X } from "lucide-react";

const initialForm = {
  id: null,
  name: "",
};

const extractErrorMessage = (error) => {
  const payload = error?.response?.data;
  if (!payload) return "Something went wrong.";
  if (typeof payload === "string") return payload;
  if (payload.error) return payload.error;
  if (Array.isArray(payload.name) && payload.name[0]) return payload.name[0];
  if (Array.isArray(payload.detail) && payload.detail[0]) return payload.detail[0];
  if (typeof payload.detail === "string") return payload.detail;
  return "Something went wrong.";
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEditing = form.id !== null;

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get("/api/categories/");
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const resetForm = () => {
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Category name is required.");
      setSaving(false);
      return;
    }

    try {
      if (isEditing) {
        const response = await axios.put(`/api/categories/${form.id}/`, {
          name: form.name.trim(),
        });
        setCategories((prev) =>
          prev.map((category) => (category.id === form.id ? response.data : category))
        );
        setSuccess("Category updated successfully.");
      } else {
        const response = await axios.post("/api/categories/", {
          name: form.name.trim(),
        });
        setCategories((prev) => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess("Category created successfully.");
      }

      resetForm();
    } catch (requestError) {
      console.error(requestError);
      setError(extractErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setForm({
      id: category.id,
      name: category.name,
    });
    setSuccess("");
    setError("");
  };

  const handleDelete = async (categoryId) => {
    setDeleteId(categoryId);
    setError("");
    setSuccess("");

    try {
      await axios.delete(`/api/categories/${categoryId}/`);
      setCategories((prev) => prev.filter((category) => category.id !== categoryId));
      if (form.id === categoryId) {
        resetForm();
      }
      setSuccess("Category deleted successfully.");
    } catch (requestError) {
      console.error(requestError);
      setError(extractErrorMessage(requestError));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Admin Control</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Course Categories</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Add and manage the categories instructors can choose from when creating courses.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCategories}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Category" : "Add Category"}
              </h2>
              <p className="text-sm text-gray-500">
                {isEditing ? "Update an existing category name." : "Create a new category for instructors."}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-gray-800">Category Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Computer Science"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : isEditing ? "Update Category" : "Add Category"}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Categories</h2>
              <p className="text-sm text-gray-500">{categories.length} total categories</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Loading categories...
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        No categories yet.
                      </td>
                    </tr>
                  ) : (
                    categories.map((category) => (
                      <tr key={category.id} className="border-t border-gray-200">
                        <td className="px-4 py-3 text-gray-600">{category.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{category.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(category)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(category.id)}
                              disabled={deleteId === category.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deleteId === category.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
