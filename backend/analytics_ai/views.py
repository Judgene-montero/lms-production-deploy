from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.models import ActivitySubmission
from users_app.models import Course

from analytics_ai.models import CourseAnalytics, StudentAnalytics
from analytics_ai.serializers import CourseAnalyticsSerializer, StudentAnalyticsSerializer
from analytics_ai.services import refresh_instructor_analytics
from analytics_ai.services.model_metrics import get_at_risk_model_metrics
from analytics_ai.services.risk_engine import evaluate_at_risk, get_risk_settings


def _student_placeholder_payload():
    return {
        "risk": "unknown",
        "engagement": 0,
        "predictions": [],
    }


def _require_instructor(request):
    if getattr(request.user, "role", "") != "instructor":
        return Response({"error": "Only instructors can access this endpoint."}, status=403)
    return None


def _require_trainer_role(request):
    if getattr(request.user, "role", "") not in {"instructor", "admin"}:
        return Response({"error": "Only instructors or admins can train the model."}, status=403)
    return None


def _require_analytics_role(request):
    if getattr(request.user, "role", "") not in {"instructor", "admin"}:
        return Response({"error": "Only instructors or admins can access analytics metrics."}, status=403)
    return None


def _parse_course_id(request):
    course_id = request.query_params.get("course_id")
    if not course_id:
        return None
    try:
        return int(course_id)
    except (TypeError, ValueError):
        return None


def _parse_positive_int(request, key, default=None, maximum=None):
    raw_value = request.query_params.get(key)
    if raw_value in (None, ""):
        return default
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return default
    if parsed < 0:
        return default
    if maximum is not None:
        return min(parsed, maximum)
    return parsed


def _should_refresh(request):
    return request.query_params.get("refresh", "1").lower() not in {"0", "false", "no"}


def _active_instructor_courses(instructor):
    return Course.objects.filter(instructor=instructor, is_archived=False)


def _unique_active_students_count(instructor):
    return (
        _active_instructor_courses(instructor)
        .filter(students__role="student", students__isnull=False)
        .values("students__id")
        .distinct()
        .count()
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def instructor_dashboard_stats(request):
    forbidden = _require_instructor(request)
    if forbidden:
        return forbidden

    instructor = request.user
    if _should_refresh(request):
        refresh_instructor_analytics(instructor)

    total_courses = Course.objects.filter(instructor=instructor).count()
    total_students = _unique_active_students_count(instructor)
    pending_submissions = ActivitySubmission.objects.filter(
        activity__course__instructor=instructor,
        status="submitted",
        grade__isnull=True,
    ).count()
    student_analytics = StudentAnalytics.objects.filter(course__instructor=instructor)
    risk_distribution = student_analytics.aggregate(
        high=Count("id", filter=Q(risk_level="high")),
        medium=Count("id", filter=Q(risk_level="medium")),
        low=Count("id", filter=Q(risk_level="low")),
    )

    return Response(
        {
            "total_courses": total_courses,
            "total_students": total_students,
            "pending_submissions": pending_submissions,
            "notifications": 0,
            "risk_distribution": {
                "high": risk_distribution["high"] or 0,
                "medium": risk_distribution["medium"] or 0,
                "low": risk_distribution["low"] or 0,
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_submissions(request):
    forbidden = _require_instructor(request)
    if forbidden:
        return forbidden

    limit = _parse_positive_int(request, "limit", default=10, maximum=50)
    submissions = (
        ActivitySubmission.objects.filter(
            activity__course__instructor=request.user,
            status__in=["submitted", "graded"],
        )
        .select_related("student", "activity__course")
        .order_by("-submitted_at")[:limit]
    )

    data = [
        {
            "id": sub.id,
            "student_name": (f"{sub.student.first_name} {sub.student.last_name}").strip() or sub.student.username,
            "course_title": sub.activity.course.title,
            "activity_title": sub.activity.title,
            "submitted_at": sub.submitted_at,
            "grade": sub.grade,
            "is_late": sub.is_late,
        }
        for sub in submissions
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_risk(request):
    if getattr(request.user, "role", "") == "student":
        return Response(_student_placeholder_payload())

    forbidden = _require_instructor(request)
    if forbidden:
        return forbidden

    course_id = _parse_course_id(request)
    limit = _parse_positive_int(request, "limit", default=None, maximum=500)
    offset = _parse_positive_int(request, "offset", default=0, maximum=5000) or 0
    if _should_refresh(request):
        refresh_instructor_analytics(request.user, course_id=course_id)

    queryset = StudentAnalytics.objects.filter(course__instructor=request.user).select_related("student", "course")
    if course_id:
        queryset = queryset.filter(course_id=course_id)
    queryset = queryset.order_by("-risk_score", "student__last_name")
    if limit is not None:
        queryset = queryset[offset:offset + limit]

    risk_settings = get_risk_settings()
    serializer = StudentAnalyticsSerializer(queryset, many=True, context={"risk_settings": risk_settings})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_risk_fallback(request):
    return Response(_student_placeholder_payload())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def predictions_fallback(request):
    return Response(
        {
            "risk": "unknown",
            "engagement": 0,
            "predictions": [],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_performance_fallback(request):
    return Response(
        {
            "risk": "unknown",
            "engagement": 0,
            "predictions": [],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_analytics(request):
    forbidden = _require_instructor(request)
    if forbidden:
        return forbidden

    course_id = _parse_course_id(request)
    limit = _parse_positive_int(request, "limit", default=None, maximum=100)
    if _should_refresh(request):
        refresh_instructor_analytics(request.user, course_id=course_id)

    queryset = CourseAnalytics.objects.filter(course__instructor=request.user).select_related("course")
    if course_id:
        queryset = queryset.filter(course_id=course_id)
    queryset = queryset.order_by("course__title")
    if limit is not None:
        queryset = queryset[:limit]

    serializer = CourseAnalyticsSerializer(queryset, many=True)
    overall = StudentAnalytics.objects.filter(course__instructor=request.user)
    if course_id:
        overall = overall.filter(course_id=course_id)
    summary = overall.aggregate(
        total_students=Count("id"),
        average_grade=Avg("average_grade"),
        average_engagement=Avg("engagement_score"),
        high_risk=Count("id", filter=Q(risk_level="high")),
        medium_risk=Count("id", filter=Q(risk_level="medium")),
        low_risk=Count("id", filter=Q(risk_level="low")),
    )

    return Response(
        {
            "courses": serializer.data,
            "summary": {
                "total_students": summary["total_students"] or 0,
                "average_grade": round(summary["average_grade"] or 0.0, 2),
                "average_engagement": round(summary["average_engagement"] or 0.0, 4),
                "high_risk": summary["high_risk"] or 0,
                "medium_risk": summary["medium_risk"] or 0,
                "low_risk": summary["low_risk"] or 0,
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def at_risk_students(request):
    forbidden = _require_instructor(request)
    if forbidden:
        return forbidden

    course_id = _parse_course_id(request)
    limit = _parse_positive_int(request, "limit", default=None, maximum=100)
    if _should_refresh(request):
        refresh_instructor_analytics(request.user, course_id=course_id)

    queryset = StudentAnalytics.objects.filter(course__instructor=request.user).select_related("student", "course")
    if course_id:
        queryset = queryset.filter(course_id=course_id)
    queryset = queryset.order_by("-risk_score", "student__last_name")
    risk_settings = get_risk_settings()
    at_risk_rows = []
    for row in queryset.iterator():
        if evaluate_at_risk(
            {
                "average_grade": row.average_grade,
                "late_rate": row.late_rate,
                "missing_rate": row.missing_rate,
                "engagement_score": row.engagement_score,
                "grade_trend": row.grade_trend,
                "total_submissions": row.total_submissions,
            },
            row.probability_student_fails if row.probability_student_fails is not None else row.risk_score,
            risk_settings,
        ):
            at_risk_rows.append(row)
            if limit is not None and len(at_risk_rows) >= limit:
                break

    serializer = StudentAnalyticsSerializer(at_risk_rows, many=True, context={"risk_settings": risk_settings})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def model_metrics(request):
    forbidden = _require_analytics_role(request)
    if forbidden:
        return forbidden

    course_id = _parse_course_id(request)
    instructor = request.user if getattr(request.user, "role", "") == "instructor" else None
    metrics = get_at_risk_model_metrics(instructor=instructor, course_id=course_id)
    return Response(metrics)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def train_model_endpoint(request):
    forbidden = _require_trainer_role(request)
    if forbidden:
        return forbidden

    try:
        from analytics_ai.ml.train_model import train_student_risk_model

        result = train_student_risk_model()
        return Response(result, status=200)
    except Exception as exc:
        return Response(
            {
                "status": "training failed",
                "error": str(exc),
            },
            status=400,
        )


def get_ai_progress_data():
    """
    Fetch AI task progress metrics for admin monitoring.
    Replace these example values with real task queue/job metrics when available.
    """
    return {
        "tasks_in_progress": 2,
        "tasks_completed": 48,
        "last_updated": timezone.now().isoformat(),
        "errors": 1,
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_progress(request):
    if getattr(request.user, "role", "") != "admin" and not getattr(request.user, "is_staff", False):
        return Response({"error": "Unauthorized"}, status=403)
    data = get_ai_progress_data()
    return Response({"status": "ok", "data": data}, status=200)
