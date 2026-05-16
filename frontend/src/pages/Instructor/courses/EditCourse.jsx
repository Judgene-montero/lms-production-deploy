import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../../utils/axiosInstance";

const EditCourse = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      setFetching(true);
      setError("");

      try {
        const [courseResponse, categoriesResponse] = await Promise.all([
          axios.get(`/api/courses/${courseId}/`),
          axios.get("/api/categories/"),
        ]);

        if (!isMounted) return;

        const course = courseResponse.data;
        setTitle(course.title || "");
        setDescription(course.description || "");
        setCategoryId(course.category?.id ? String(course.category.id) : "");
        setThumbnailPreview(course.thumbnail || null);
        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      } catch (requestError) {
        console.error(requestError);
        if (isMounted) {
          setError("Failed to load course.");
        }
      } finally {
        if (isMounted) {
          setFetching(false);
        }
      }
    };

    loadPageData();
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  const handleThumbnailChange = (event) => {
    const file = event.target.files?.[0] || null;
    setThumbnail(file);

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Title is required.");
      setLoading(false);
      return;
    }

    if (!categoryId) {
      setError("Category is required.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category_id", categoryId);

      if (thumbnail) {
        formData.append("thumbnail", thumbnail);
      }

      await axios.put(`/api/courses/${courseId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Course updated successfully!");
      setTimeout(() => navigate("/instructor-dashboard/courses"), 1000);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to update course.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <p className="p-6">Loading course...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Course</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full border px-3 py-2 rounded"
            rows={4}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Thumbnail</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            className="w-full"
          />

          {thumbnailPreview && (
            <img
              src={thumbnailPreview}
              alt="Thumbnail Preview"
              className="mt-2 h-32 object-cover rounded border"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Updating..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
};

export default EditCourse;
