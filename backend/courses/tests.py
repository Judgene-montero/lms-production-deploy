from django.contrib.auth import get_user_model
from django.test import TestCase

from courses.models import GradingScheme
from courses.serializers import GradingSchemeSerializer
from users_app.models import Course


class GradingSchemeSerializerTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="instructor_serializer_test",
            password="testpass123",
            role="instructor",
        )
        self.course = Course.objects.create(
            instructor=self.user,
            title="Serializer Course",
            description="",
            category="",
        )
        self.scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            passing_grade=75,
            custom_config={},
        )

    def test_update_allows_empty_transmutation_table_for_non_custom_scheme(self):
        serializer = GradingSchemeSerializer(
            instance=self.scheme,
            data={
                "grading_type": GradingScheme.TYPE_TRANSMUTED,
                "passing_grade": 75,
                "custom_config": {
                    "auto_detect_activities": True,
                    "treat_missing_as_zero": True,
                    "passfail_threshold": 60,
                    "transmutation_table": [],
                },
                "components": [
                    {
                        "name": "Assignments",
                        "weight": 100,
                        "activity_ids": [],
                    }
                ],
            },
            context={"course": self.course},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
