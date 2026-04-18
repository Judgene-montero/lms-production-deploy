import pandas as pd

from analytics_ai.services.feature_builder import build_student_features
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


def build_training_dataset():
    rows = []
    courses = Course.objects.prefetch_related("students")
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
                    "fail": 1 if avg_grade < 60 else 0,
                }
            )
    if not rows:
        return pd.DataFrame(columns=DATASET_COLUMNS)
    return pd.DataFrame(rows, columns=DATASET_COLUMNS)
