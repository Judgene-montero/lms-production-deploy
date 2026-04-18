from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Avg, Count

from courses.models import CourseActivity, QuizAttempt
from users_app.models import Course


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def classwork_analytics(request, activity_id):
    activity = get_object_or_404(CourseActivity, id=activity_id, activity_type__name__iexact="quiz")

    if request.user.role == "instructor":
        if activity.course.instructor_id != request.user.id:
            return Response({"error": "Access denied."}, status=403)
    elif request.user.role == "student":
        course_ids = [activity.course_id] + list(activity.assigned_courses.values_list("id", flat=True))
        if not Course.objects.filter(id__in=course_ids, students=request.user).exists():
            return Response({"error": "Access denied."}, status=403)
    else:
        return Response({"error": "Access denied."}, status=403)

    attempts_qs = QuizAttempt.objects.filter(quiz=activity)
    total_attempts = attempts_qs.count()
    average_score = attempts_qs.aggregate(value=Avg("score")).get("value") or 0
    submitted_attempts = attempts_qs.filter(submitted_at__isnull=False).count()

    assigned_course_ids = [activity.course_id] + list(activity.assigned_courses.values_list("id", flat=True))
    enrolled_count = (
        Course.objects.filter(id__in=assigned_course_ids)
        .distinct()
        .aggregate(total=Count("students", distinct=True))
        .get("total")
        or 0
    )
    student_attempted = attempts_qs.values("student_id").distinct().count()
    completion_rate = (student_attempted / enrolled_count * 100) if enrolled_count > 0 else 0

    return Response(
        {
            "activity_id": activity.id,
            "title": activity.title,
            "assessment_type": activity.assessment_type,
            "attempts": total_attempts,
            "submitted_attempts": submitted_attempts,
            "average_score": round(float(average_score), 2),
            "completion_rate": round(float(completion_rate), 2),
            "students_attempted": student_attempted,
            "students_enrolled": enrolled_count,
        }
    )
