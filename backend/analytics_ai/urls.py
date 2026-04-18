# analytics_ai/urls.py
from django.urls import path
from .views import (
    admin_progress,
    at_risk_students,
    course_analytics,
    instructor_dashboard_stats,
    predictions_fallback,
    recent_submissions,
    student_performance_fallback,
    student_risk,
    student_risk_fallback,
    train_model_endpoint,
)

urlpatterns = [
    # New AI analytics endpoints
    path("ai/student-risk/", student_risk),
    path("ai/course-analytics/", course_analytics),
    path("ai/at-risk-students/", at_risk_students),
    path("ai/train-model/", train_model_endpoint),
    path("ai/admin/progress/", admin_progress),
    path("analytics_ai/student-risk/", student_risk_fallback),
    path("analytics_ai/predictions/", predictions_fallback),
    path("analytics_ai/student-performance/", student_performance_fallback),

    # Existing dashboard endpoints (kept for compatibility)
    path("instructor/dashboard/", instructor_dashboard_stats),
    path("instructor/recent-submissions/", recent_submissions),
    path("instructor/at-risk/", at_risk_students),
]
