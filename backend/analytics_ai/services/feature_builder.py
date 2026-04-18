from django.utils import timezone
from django.core.exceptions import ValidationError

from courses.models import ActivitySubmission, AttendanceRecord
from courses.services.grading import compute_component_scores, compute_final_grade


SUBMISSION_REQUIRED_TYPES = {
    "assignment",
    "quiz",
    "project",
}


def _safe_ratio(numerator, denominator):
    if denominator <= 0:
        return 0.0
    return float(numerator) / float(denominator)


def build_student_features(student, course):
    activities = course.activities.select_related("activity_type").all()
    all_target_activities = [
        activity
        for activity in activities
        if (
            activity.due_date is not None
            or activity.activity_type.name.lower() in SUBMISSION_REQUIRED_TYPES
        )
    ]

    submissions = ActivitySubmission.objects.filter(
        activity__course=course,
        student=student,
        status__in=["submitted", "graded"],
    ).select_related("activity")

    total_expected = len(all_target_activities)
    total_submitted = submissions.count()

    try:
        component_breakdown = compute_component_scores(student, course)
        average_grade = float(compute_final_grade(student, course))
    except ValidationError:
        # Keep analytics resilient even when grading mappings reference
        # stale/missing activity IDs.
        component_breakdown = {}
        average_grade = 0.0

    component_scores = list(component_breakdown.values())
    component_map = {str(k).lower(): float(v) for k, v in component_breakdown.items()}
    attendance_score = component_map.get("attendance", 0.0)
    quiz_score = component_map.get("quiz", 0.0)
    exam_score = component_map.get("exam", 0.0)
    if exam_score > 0:
        average_grade = round((0.65 * average_grade) + (0.2 * exam_score) + (0.15 * quiz_score), 2)
    late_count = submissions.filter(is_late=True).count()
    late_rate = _safe_ratio(late_count, total_submitted)

    now = timezone.now()
    due_activity_ids = [activity.id for activity in all_target_activities if activity.due_date and activity.due_date <= now]
    due_target_count = len(due_activity_ids)
    submitted_activity_ids = set(submissions.values_list("activity_id", flat=True))
    due_submitted_count = len(submitted_activity_ids.intersection(due_activity_ids))
    missing_count = max(due_target_count - due_submitted_count, 0)
    missing_rate = _safe_ratio(missing_count, due_target_count)

    completion_rate = _safe_ratio(total_submitted, total_expected)
    on_time_rate = 1.0 - late_rate if total_submitted > 0 else 0.0
    attendance_records = AttendanceRecord.objects.filter(session__course=course, student=student).count()
    present_or_late = AttendanceRecord.objects.filter(
        session__course=course,
        student=student,
        status__in=[AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_LATE],
    ).count()
    attendance_rate = _safe_ratio(present_or_late, attendance_records) if attendance_records else 0.0

    engagement_score = max(
        min((0.45 * completion_rate) + (0.3 * on_time_rate) + (0.25 * attendance_rate), 1.0),
        0.0,
    )

    if len(component_scores) < 2:
        grade_trend = 0.0
    else:
        midpoint = len(component_scores) // 2
        first_half = component_scores[:midpoint] or component_scores[:1]
        second_half = component_scores[midpoint:] or component_scores[-1:]
        grade_trend = (sum(second_half) / len(second_half)) - (sum(first_half) / len(first_half))

    return {
        "average_grade": round(average_grade, 2),
        "late_rate": round(late_rate, 4),
        "missing_rate": round(missing_rate, 4),
        "engagement_score": round(engagement_score, 4),
        "grade_trend": round(grade_trend, 2),
        "total_submissions": int(total_submitted),
    }
