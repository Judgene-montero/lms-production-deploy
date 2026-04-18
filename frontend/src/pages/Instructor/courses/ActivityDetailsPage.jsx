import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ActivityDetailsModal from "./ActivityDetailsModal";
import { getEditPathByType, normalizeActivityTypeKey } from "./classworkTypeConfig";
import { authDelete, authGet, authPut } from "../../../utils/api";

export default function ActivityDetailsPage() {
  const navigate = useNavigate();
  const { courseId, id } = useParams();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const goBackToClasswork = useCallback(() => {
    navigate(`/instructor-dashboard/courses/${courseId}`, { state: { activeTab: "classwork" } });
  }, [courseId, navigate]);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authGet(`/api/courses/${courseId}/activities/${id}/`);
      setActivity(data || null);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to load classwork.");
    } finally {
      setLoading(false);
    }
  }, [courseId, id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleEditActivity = useCallback(
    (targetActivity) => {
      const typeKey = normalizeActivityTypeKey(targetActivity.activity_type_name || targetActivity.activity_type);
      const route = getEditPathByType(courseId, typeKey, targetActivity.id);
      navigate(route);
    },
    [courseId, navigate]
  );

  const handleDeleteActivity = useCallback(
    async (activityId) => {
      if (!window.confirm("Are you sure you want to delete this classwork item?")) return;
      try {
        await authDelete(`/api/courses/${courseId}/activities/${activityId}/`);
        goBackToClasswork();
      } catch (requestError) {
        console.error(requestError);
        setError("Failed to delete classwork item.");
      }
    },
    [courseId, goBackToClasswork]
  );

  const handleGradeSubmission = useCallback(
    async (submission, activityId, payload = {}) => {
      if (!submission?.id || !activityId) return;

      try {
        await authPut(
          `/api/courses/${courseId}/activities/${activityId}/submissions/${submission.id}/`,
          {
            grade: payload?.grade ?? null,
            feedback: String(payload?.feedback || ""),
          }
        );

        const refreshedActivity = await authGet(`/api/courses/${courseId}/activities/${activityId}/`);
        setActivity(refreshedActivity || null);
      } catch (requestError) {
        console.error(requestError);
        setError("Failed to grade submission.");
        throw requestError;
      }
    },
    [courseId]
  );

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-red-600">{error}</p>;
  }

  if (!activity) return null;

  return (
    <ActivityDetailsModal
      mode="page"
      activity={activity}
      onClose={goBackToClasswork}
      onEdit={handleEditActivity}
      onDelete={handleDeleteActivity}
      onGrade={handleGradeSubmission}
    />
  );
}
