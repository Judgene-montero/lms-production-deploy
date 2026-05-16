from rest_framework import serializers

from analytics_ai.models import CourseAnalytics, StudentAnalytics
from analytics_ai.services.explainability import generate_intervention_suggestions
from analytics_ai.services.risk_engine import evaluate_at_risk, get_risk_settings, predicted_outcome


class StudentAnalyticsSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    risk_probability = serializers.FloatField(source="probability_student_fails", read_only=True)
    failure_probability = serializers.SerializerMethodField()
    predicted_outcome = serializers.SerializerMethodField()
    is_at_risk = serializers.SerializerMethodField()
    intervention_suggestions = serializers.SerializerMethodField()

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
            "failure_probability",
            "risk_probability",
            "probability_student_fails",
            "predicted_outcome",
            "is_at_risk",
            "prediction_source",
            "risk_explanation",
            "intervention_suggestions",
            "last_updated",
        ]

    def get_student_name(self, obj):
        full_name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return full_name or obj.student.username

    def _features(self, obj):
        return {
            "average_grade": obj.average_grade,
            "late_rate": obj.late_rate,
            "missing_rate": obj.missing_rate,
            "engagement_score": obj.engagement_score,
            "grade_trend": obj.grade_trend,
            "total_submissions": obj.total_submissions,
        }

    def _settings(self):
        settings = self.context.get("risk_settings")
        if settings is None:
            settings = get_risk_settings()
            self.context["risk_settings"] = settings
        return settings

    def get_failure_probability(self, obj):
        return round(float(obj.probability_student_fails if obj.probability_student_fails is not None else obj.risk_score), 4)

    def get_predicted_outcome(self, obj):
        return predicted_outcome(self._features(obj), self.get_failure_probability(obj), self._settings())

    def get_is_at_risk(self, obj):
        return evaluate_at_risk(self._features(obj), self.get_failure_probability(obj), self._settings())

    def get_intervention_suggestions(self, obj):
        return generate_intervention_suggestions(self._features(obj), self._settings())


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
