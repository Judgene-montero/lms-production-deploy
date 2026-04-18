# analytics_ai/services.py
from courses.models import ActivitySubmission
from analytics_ai.models import StudentPerformanceProfile, StudentRiskPrediction
from django.db.models import Q
from django.utils import timezone


def update_student_performance(student, course):

    submissions = ActivitySubmission.objects.filter(
        activity__course=course,
        student=student,
        status__in=["submitted", "graded"]
    ).select_related("activity")

    submission_required_filter = (
        Q(activity_type__name__iexact="assignment") |
        Q(activity_type__name__iexact="question") |
        Q(activity_type__name__iexact="quiz")
    )
    all_target_activities = course.activities.filter(submission_required_filter)

    total_expected = all_target_activities.count()
    total_submitted = submissions.count()

    graded = submissions.filter(grade__isnull=False)

    # Use percent score when points are available so mixed-point activities are comparable.
    graded_percentages = []
    for s in graded:
        points = getattr(s.activity, "points", 0) or 0
        if points > 0:
            graded_percentages.append((float(s.grade) / float(points)) * 100.0)
        else:
            graded_percentages.append(float(s.grade))

    average_score = sum(graded_percentages) / len(graded_percentages) if graded_percentages else 0.0

    late_count = submissions.filter(is_late=True).count()
    late_rate = (late_count / total_submitted) if total_submitted > 0 else 0.0

    now = timezone.now()
    due_target_activities_count = all_target_activities.filter(due_date__lte=now).count()
    submitted_activity_ids = submissions.values_list("activity_id", flat=True)
    due_submitted_count = all_target_activities.filter(
        due_date__lte=now,
        id__in=submitted_activity_ids
    ).count()
    missing_count = max(due_target_activities_count - due_submitted_count, 0)
    missing_rate = (missing_count / due_target_activities_count) if due_target_activities_count > 0 else 0.0

    profile, _ = StudentPerformanceProfile.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "average_score": average_score,
            "late_submission_rate": late_rate,
            "missing_submission_rate": missing_rate
        }
    )

    return profile


def calculate_risk(student, course):

    profile = StudentPerformanceProfile.objects.filter(
        student=student,
        course=course
    ).first()

    if not profile:
        return None

    avg = profile.average_score
    late = profile.late_submission_rate
    missing = profile.missing_submission_rate

    risk_score = 0

    if avg < 60:
        risk_score += 0.4

    if late > 0.4:
        risk_score += 0.3

    if missing > 0.3:
        risk_score += 0.3

    if risk_score >= 0.7:
        risk_level = "high"
    elif risk_score >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"

    StudentRiskPrediction.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "risk_score": risk_score,
            "risk_level": risk_level
        }
    )

    return risk_score, risk_level


def run_full_analysis(student, course):

    update_student_performance(student, course)
    calculate_risk(student, course)
