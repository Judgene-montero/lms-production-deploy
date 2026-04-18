from django.contrib.auth import get_user_model
from django.test import TestCase

from analytics_ai.services.feature_builder import build_student_features
from courses.models import GradingComponent, GradingScheme
from users_app.models import Course


class AnalyticsFeatureBuilderResilienceTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.instructor = user_model.objects.create_user(username="analytics_instr", password="x", role="instructor")
        self.student = user_model.objects.create_user(username="analytics_student", password="x", role="student")
        self.course = Course.objects.create(instructor=self.instructor, title="Analytics QA", description="", category="")
        self.course.students.add(self.student)

    def test_build_student_features_handles_invalid_grading_mapping(self):
        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(
            scheme=scheme,
            name="Assignment",
            weight=100,
            activity_ids=[40],  # stale/missing activity ID
        )

        features = build_student_features(self.student, self.course)

        self.assertEqual(features["average_grade"], 0.0)
        self.assertEqual(features["late_rate"], 0.0)
        self.assertEqual(features["missing_rate"], 0.0)
        self.assertEqual(features["total_submissions"], 0)
