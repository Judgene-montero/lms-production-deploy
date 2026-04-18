from analytics_ai.models import (
    CourseAnalytics,
    StudentAnalytics,
    StudentPerformanceProfile,
    StudentRiskPrediction,
)
from analytics_ai.services.feature_builder import build_student_features
from analytics_ai.services.explainability import generate_student_risk_explanation
from analytics_ai.services.ml_predictor import get_failure_predictor
from analytics_ai.services.risk_engine import calculate_risk_score
from users_app.models import Course


def compute_student_analytics(student, course):
    features = build_student_features(student, course)
    risk_score, risk_level = calculate_risk_score(
        average_grade=features["average_grade"],
        late_rate=features["late_rate"],
        missing_rate=features["missing_rate"],
    )
    prediction_source = "rule"
    probability_student_fails = risk_score

    predictor = get_failure_predictor(prefer_trained=True)
    try:
        prediction = predictor.predict(features)
        probability_student_fails = float(prediction["risk_probability"])
        risk_level = prediction["risk_level"]
        risk_score = probability_student_fails
        prediction_source = prediction.get("prediction_source", "ml")
    except Exception:
        # Keep the existing rule output as fallback if ML model is unavailable.
        prediction_source = "rule"

    prediction_context = {
        "risk_probability": probability_student_fails,
        "risk_level": risk_level,
        "prediction_source": prediction_source,
    }
    risk_explanation = generate_student_risk_explanation(features, prediction_context)

    analytics, _ = StudentAnalytics.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            **features,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "probability_student_fails": probability_student_fails,
            "prediction_source": prediction_source,
            "risk_explanation": risk_explanation,
        },
    )

    # Backward compatibility for existing screens/services.
    StudentPerformanceProfile.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "average_score": analytics.average_grade,
            "late_submission_rate": analytics.late_rate,
            "missing_submission_rate": analytics.missing_rate,
        },
    )
    StudentRiskPrediction.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "risk_score": analytics.risk_score,
            "risk_level": analytics.risk_level,
        },
    )

    return analytics


def update_course_analytics(course):
    records = StudentAnalytics.objects.filter(course=course)
    total_students = records.count()

    if total_students == 0:
        course_analytics, _ = CourseAnalytics.objects.update_or_create(
            course=course,
            defaults={
                "total_students": 0,
                "average_grade": 0.0,
                "average_engagement": 0.0,
                "high_risk_students": 0,
                "medium_risk_students": 0,
                "low_risk_students": 0,
            },
        )
        return course_analytics

    avg_grade = sum(record.average_grade for record in records) / total_students
    avg_engagement = sum(record.engagement_score for record in records) / total_students
    high_count = records.filter(risk_level="high").count()
    medium_count = records.filter(risk_level="medium").count()
    low_count = records.filter(risk_level="low").count()

    course_analytics, _ = CourseAnalytics.objects.update_or_create(
        course=course,
        defaults={
            "total_students": total_students,
            "average_grade": round(avg_grade, 2),
            "average_engagement": round(avg_engagement, 4),
            "high_risk_students": high_count,
            "medium_risk_students": medium_count,
            "low_risk_students": low_count,
        },
    )
    return course_analytics


def run_full_analysis(student, course):
    analytics = compute_student_analytics(student, course)
    update_course_analytics(course)
    return analytics


def refresh_course_analytics(course):
    students = course.students.filter(role="student")
    for student in students:
        compute_student_analytics(student, course)
    return update_course_analytics(course)


def refresh_instructor_analytics(instructor, course_id=None):
    courses = Course.objects.filter(instructor=instructor).prefetch_related("students")
    if course_id:
        courses = courses.filter(id=course_id)
    refreshed_courses = []
    for course in courses:
        refreshed_courses.append(refresh_course_analytics(course))
    return refreshed_courses
