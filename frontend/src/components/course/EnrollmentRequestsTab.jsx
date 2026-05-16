import React, { useMemo, useState } from "react";

const formatRequestedAt = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

export default function EnrollmentRequestsTab({
  isInstructor,
  requests = [],
  loading = false,
  error = "",
  onApprove,
  onReject,
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [actingId, setActingId] = useState(null);

  const summaryText = useMemo(() => {
    if (requests.length === 1) return "1 pending request";
    return `${requests.length} pending requests`;
  }, [requests.length]);

  const handleAction = async (requestId, action) => {
    const handler = action === "approve" ? onApprove : onReject;
    if (typeof handler !== "function") return;

    setActingId(requestId);
    setStatusMessage("");
    try {
      await handler(requestId);
      setStatusMessage(action === "approve" ? "Enrollment request approved." : "Enrollment request rejected.");
    } catch (requestError) {
      console.error(requestError);
      setStatusMessage(requestError.message || "Unable to update enrollment request.");
    } finally {
      setActingId(null);
    }
  };

  if (!isInstructor) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-emerald-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-emerald-950">Enrollment Requests</h3>
          <p className="text-sm text-gray-600">Review course-code requests before students become officially enrolled.</p>
        </div>
        <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
          {summaryText}
        </span>
      </div>

      {statusMessage && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${statusMessage.toLowerCase().includes("approved") ? "border-green-200 bg-green-50 text-green-700" : statusMessage.toLowerCase().includes("rejected") ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {statusMessage}
        </p>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!requests.length ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-gray-700">No pending enrollment requests.</p>
          <p className="mt-1 text-sm text-gray-500">New course-code requests will appear here for approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isActing = actingId === request.id;
            return (
              <article key={request.id} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-base font-semibold text-emerald-950">{request.student_name || "Student"}</p>
                      <p className="text-sm text-gray-600">{request.student_email || request.student_school_id || "No contact details"}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-3">
                      <p>Course: <span className="font-medium text-gray-800">{request.course_name || "-"}</span></p>
                      <p>Student ID: <span className="font-medium text-gray-800">{request.student_school_id || "-"}</span></p>
                      <p>Requested: <span className="font-medium text-gray-800">{formatRequestedAt(request.created_at)}</span></p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleAction(request.id, "approve")}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActing ? "Working..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleAction(request.id, "reject")}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
