import pandas as pd

from analytics_ai.models import StudentAnalytics
from analytics_ai.services.feature_builder import build_student_features
from analytics_ai.services.risk_engine import get_risk_settings
from users_app.models import Course


DATASET_COLUMNS = [
    "student_id",
    "course_id",
    "avg_grade",
    "late_rate",
    "missing_rate",
    "engagement_score",
    "grade_trend",
    "total_submissions",
    "fail",
]


def build_training_dataset(courses=None):
    rows = []
    passing_grade = float(get_risk_settings()["passing_grade"])
    courses = courses if courses is not None else Course.objects.all()
    courses = courses.prefetch_related("students")
    course_ids = list(courses.values_list("id", flat=True))
    for course in courses:
        students = course.students.filter(role="student")
        for student in students:
            features = build_student_features(student, course)
            avg_grade = float(features.get("average_grade", 0))
            rows.append(
                {
                    "student_id": student.id,
                    "course_id": course.id,
                    "avg_grade": avg_grade,
                    "late_rate": float(features.get("late_rate", 0)),
                    "missing_rate": float(features.get("missing_rate", 0)),
                    "engagement_score": float(features.get("engagement_score", 0)),
                    "grade_trend": float(features.get("grade_trend", 0)),
                    "total_submissions": int(features.get("total_submissions", 0)),
                    "fail": 1 if avg_grade < passing_grade else 0,
                }
            )
    if not rows and course_ids:
        analytics_rows = StudentAnalytics.objects.filter(course_id__in=course_ids).select_related("student", "course")
        for analytics in analytics_rows:
            avg_grade = float(analytics.average_grade)
            rows.append(
                {
                    "student_id": analytics.student_id,
                    "course_id": analytics.course_id,
                    "avg_grade": avg_grade,
                    "late_rate": float(analytics.late_rate),
                    "missing_rate": float(analytics.missing_rate),
                    "engagement_score": float(analytics.engagement_score),
                    "grade_trend": float(analytics.grade_trend),
                    "total_submissions": int(analytics.total_submissions),
                    "fail": 1 if avg_grade < passing_grade else 0,
                }
            )
    if not rows:
        return pd.DataFrame(columns=DATASET_COLUMNS)
    return pd.DataFrame(rows, columns=DATASET_COLUMNS)
