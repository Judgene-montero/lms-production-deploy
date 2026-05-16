from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient
from io import StringIO
from unittest.mock import patch

from analytics_ai.services.model_metrics import _calculate_binary_metrics, load_latest_training_metrics
from analytics_ai.services.feature_builder import build_student_features
from analytics_ai.services.risk_engine import classify_risk, evaluate_at_risk, predicted_outcome
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


class AnalyticsModelMetricsTests(TestCase):
    def test_calculate_binary_metrics(self):
        metrics = _calculate_binary_metrics(
            actual_values=[1, 1, 0, 0],
            predicted_values=[1, 0, 1, 0],
        )

        self.assertEqual(metrics["accuracy"], 0.5)
        self.assertEqual(metrics["precision"], 0.5)
        self.assertEqual(metrics["recall"], 0.5)
        self.assertEqual(metrics["f1_score"], 0.5)
        self.assertEqual(metrics["total_samples"], 4)
        self.assertEqual(metrics["samples"], 4)

    @patch("analytics_ai.views.get_at_risk_model_metrics")
    def test_model_metrics_endpoint_returns_saved_training_scores(self, mocked_get_metrics):
        user_model = get_user_model()
        instructor = user_model.objects.create_user(
            username="metrics_instr",
            password="x",
            role="instructor",
        )
        student = user_model.objects.create_user(
            username="metrics_student",
            password="x",
            role="student",
        )
        course = Course.objects.create(instructor=instructor, title="Metrics QA", description="", category="")
        course.students.add(student)
        mocked_get_metrics.return_value = {
            "accuracy": 0.9,
            "precision": 0.88,
            "recall": 0.92,
            "f1_score": 0.9,
            "total_samples": 150,
            "samples": 150,
            "train_samples": 120,
            "test_samples": 30,
            "TP": 12,
            "TN": 14,
            "FP": 2,
            "FN": 2,
            "true_positive": 12,
            "true_negative": 14,
            "false_positive": 2,
            "false_negative": 2,
            "evaluation_scope": "held_out_test_set",
            "model_type": "RandomForestClassifier",
        }

        client = APIClient()
        client.force_authenticate(user=instructor)

        response = client.get("/api/ai/model-metrics/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("accuracy", response.data)
        self.assertIn("precision", response.data)
        self.assertIn("recall", response.data)
        self.assertIn("f1_score", response.data)
        self.assertEqual(response.data["total_samples"], 150)
        self.assertEqual(response.data["train_samples"], 120)
        self.assertEqual(response.data["test_samples"], 30)
        self.assertEqual(response.data["TP"] + response.data["TN"] + response.data["FP"] + response.data["FN"], 30)

    @patch("analytics_ai.services.model_metrics.METRICS_PATH.exists", return_value=False)
    @patch("analytics_ai.services.model_metrics.MODEL_PATH.exists", return_value=False)
    def test_load_latest_training_metrics_returns_none_without_saved_artifacts(self, mocked_model_exists, mocked_metrics_exists):
        self.assertIsNone(load_latest_training_metrics())

    @patch("analytics_ai.management.commands.generate_analytics_ml.run_full_analysis")
    @patch("analytics_ai.management.commands.generate_analytics_ml.train_model")
    def test_generate_analytics_ml_retrains_only_selected_courses(self, mocked_train_model, mocked_run_full_analysis):
        user_model = get_user_model()
        instructor = user_model.objects.create_user(
            username="metrics_command_instr",
            password="x",
            role="instructor",
        )
        students = [
            user_model.objects.create_user(username=f"metrics_student_{index}", password="x", role="student")
            for index in range(3)
        ]
        course_one = Course.objects.create(instructor=instructor, title="Course One", description="", category="")
        course_two = Course.objects.create(instructor=instructor, title="Course Two", description="", category="")
        course_one.students.add(students[0])
        course_two.students.add(students[1], students[2])
        mocked_train_model.return_value = {"status": "model trained", "accuracy": 0.8}

        stdout = StringIO()
        call_command("generate_analytics_ml", "--course", str(course_one.id), "--course", str(course_two.id), stdout=stdout)

        self.assertEqual(mocked_run_full_analysis.call_count, 3)
        mocked_train_model.assert_called_once()
        selected_courses = mocked_train_model.call_args.kwargs["courses"]
        self.assertEqual(
            list(selected_courses.order_by("id").values_list("id", flat=True)),
            [course_one.id, course_two.id],
        )


class AnalyticsRiskEngineTests(TestCase):
    def test_classify_risk_uses_configured_thresholds(self):
        settings = {
            "low_risk_max": 0.25,
            "medium_risk_max": 0.55,
            "high_risk_min": 0.70,
            "passing_grade": 75,
        }

        self.assertEqual(classify_risk(0.20, settings), "low")
        self.assertEqual(classify_risk(0.50, settings), "medium")
        self.assertEqual(classify_risk(0.75, settings), "high")

    def test_binary_at_risk_is_separate_from_dashboard_label(self):
        settings = {
            "low_risk_max": 0.30,
            "medium_risk_max": 0.60,
            "high_risk_min": 0.60,
            "passing_grade": 75,
        }
        features = {"average_grade": 70}

        self.assertEqual(classify_risk(0.20, settings), "low")
        self.assertTrue(evaluate_at_risk(features, 0.20, settings))
        self.assertEqual(predicted_outcome(features, 0.20, settings), "At Risk of Failure")
