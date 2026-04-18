from rest_framework import serializers

from analytics_ai.models import CourseAnalytics, StudentAnalytics


class StudentAnalyticsSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    risk_probability = serializers.FloatField(source="probability_student_fails", read_only=True)

    class Meta:
        model = StudentAnalytics
        fields = [
            "id",
            "student_id",
            "student_name",
            "course_id",
            "course_title",
            "average_grade",
            "late_rate",
            "missing_rate",
            "engagement_score",
            "grade_trend",
            "risk_score",
            "risk_level",
            "risk_probability",
            "probability_student_fails",
            "prediction_source",
            "risk_explanation",
            "last_updated",
        ]

    def get_student_name(self, obj):
        full_name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return full_name or obj.student.username


class CourseAnalyticsSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CourseAnalytics
        fields = [
            "id",
            "course_id",
            "course_title",
            "total_students",
            "average_grade",
            "average_engagement",
            "high_risk_students",
            "medium_risk_students",
            "low_risk_students",
            "last_updated",
        ]
