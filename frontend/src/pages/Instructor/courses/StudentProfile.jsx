import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { authGet } from "../../../utils/api";
import SafeAvatarImage from "../../../components/common/SafeAvatarImage";
import { getDefaultStudentAvatarDataUrl, resolveStudentAvatar } from "../../../utils/studentProfile";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || "";

export default function StudentProfile({ courseId, studentId, fallbackStudent = null, onBack }) {
  const location = useLocation();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await authGet(`/api/instructor/students/${studentId}/insights/`);
        if (active) setDetails(response || null);
      } catch (requestError) {
        console.error(requestError);
        if (active) {
          setDetails(null);
          setError("Unable to load full student insights right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (studentId) loadDetails();
    return () => {
      active = false;
    };
  }, [studentId]);

  const stateStudent = location.state?.student || null;
  const student = useMemo(() => {
    const base = details?.student || fallbackStudent || stateStudent || {};
    const fullName = pickString(base.name, base.full_name, base.username, fallbackStudent?.fullName, "Student");
    const email = pickString(base.email, fallbackStudent?.email);
    const avatar =
      resolveStudentAvatar(base) ||
      fallbackStudent?.avatar ||
      getDefaultStudentAvatarDataUrl({ name: fullName });

    const assignmentsCompleted = Math.max(
      0,
      safeNumber(
        details?.analytics?.assignments_submitted ??
          fallbackStudent?.activity?.assignmentsCompleted ??
          base.assignments_completed,
        0
      )
    );
    const courseProgress = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          safeNumber(
            details?.analytics?.progress_percentage ??
              fallbackStudent?.activity?.progressPercent ??
              base.progress_percentage,
            0
          )
        )
      )
    );
    const recentActivity = pickString(
      details?.timeline?.[0]?.label,
      details?.timeline?.[0]?.message,
      fallbackStudent?.activity?.recentActivity,
      base.recent_activity,
      "No recent activity yet."
    );
    const submissions = Math.max(
      0,
      safeNumber(
        details?.analytics?.submissions_count ??
          fallbackStudent?.activity?.submissions ??
          base.submissions_count,
        0
      )
    );

    return {
      fullName,
      email,
      avatar,
      assignmentsCompleted,
      courseProgress,
      recentActivity,
      submissions,
    };
  }, [details, fallbackStudent, stateStudent]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
      >
        Back to People
      </button>

      <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <SafeAvatarImage
            src={student.avatar}
            fallbackSrc={getDefaultStudentAvatarDataUrl({ name: student.fullName })}
            alt={student.fullName}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-100"
          />
          <div>
            <h2 className="text-xl font-semibold text-emerald-950">{student.fullName}</h2>
            <p className="text-sm text-gray-600">{student.email || "Email not available"}</p>
            <p className="mt-1 text-xs text-gray-500">Course ID: {courseId}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
          Student Activity Details Summary
        </h3>

        {loading ? (
          <div className="mt-3 space-y-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-emerald-100" />
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>Assignments Completed: {student.assignmentsCompleted}</p>
            <p>Course Progress: {student.courseProgress}%</p>
            <p>Recent Activity: {student.recentActivity}</p>
            <p>Submissions: {student.submissions}</p>
            {error && <p className="text-xs text-amber-700">{error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
