from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from courses.models import ActivityType, CourseActivity, QuizAttempt, QuizAttemptAcknowledgement
from courses.views import quiz_detail, quiz_start, quiz_submit
from users_app.models import Category, Course


User = get_user_model()

urlpatterns = [
    path("api/courses/", include("courses.urls")),
]


@override_settings(
    SECURE_SSL_REDIRECT=False,
    DEBUG=True,
    ROOT_URLCONF="courses.tests_quiz_attempt_flow",
)
class QuizAttemptAvailabilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.category = Category.objects.create(name="Quizzes")
        self.instructor = User.objects.create_user(
            username="quiz_instructor",
            email="quiz_instructor@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
        )
        self.student = User.objects.create_user(
            username="quiz_student",
            email="quiz_student@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.quiz_type = ActivityType.objects.create(name="quiz", requires_points=True)
        self.course = Course.objects.create(
            instructor=self.instructor,
            category=self.category,
            title="Timed Quiz Course",
            description="",
        )
        self.course.students.add(self.student)

    def _quiz_questions(self):
        return [
            {
                "id": "q1",
                "question_text": "What is 2 + 2?",
                "type": "short_answer",
                "points": 5,
                "correct_answer": "4",
            }
        ]

    def _create_quiz(self, **overrides):
        defaults = {
            "course": self.course,
            "title": "Midterm Quiz",
            "description": "",
            "activity_type": self.quiz_type,
            "points": 5,
            "publish_state": CourseActivity.PUBLISH_STATE_PUBLISHED,
            "quiz_questions": self._quiz_questions(),
            "max_attempts": 1,
            "due_date": timezone.now() + timedelta(hours=1),
        }
        defaults.update(overrides)
        return CourseActivity.objects.create(**defaults)

    def _create_attempt(self, quiz, **overrides):
        defaults = {
            "student": self.student,
            "quiz": quiz,
            "question_snapshot": self._quiz_questions(),
            "started_at": timezone.now() - timedelta(minutes=10),
            "last_activity_at": timezone.now() - timedelta(minutes=1),
            "total_points": 5,
            "answers": [],
            "result_breakdown": [],
            "status": QuizAttempt.STATUS_GRADED,
        }
        defaults.update(overrides)
        return QuizAttempt.objects.create(**defaults)

    def test_student_cannot_start_quiz_after_due_date(self):
        quiz = self._create_quiz(due_date=timezone.now() - timedelta(minutes=5))
        request = self.factory.post(
            f"/api/courses/{self.course.id}/activities/{quiz.id}/quiz/start/",
            {"acknowledged": True},
            format="json",
        )
        force_authenticate(request, user=self.student)

        response = quiz_start(request, self.course.id, quiz.id)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"], "This quiz is already closed.")
        self.assertIn("closed_at", response.data)

    def test_student_cannot_update_answers_after_due_date(self):
        quiz = self._create_quiz(due_date=timezone.now() - timedelta(minutes=5))
        attempt = self._create_attempt(quiz)
        QuizAttemptAcknowledgement.objects.create(
            attempt=attempt,
            quiz=quiz,
            student=self.student,
            ack_message="Acknowledged",
        )
        request = self.factory.post(
            f"/api/courses/{self.course.id}/activities/{quiz.id}/quiz/submit/",
            {
                "attempt_id": attempt.id,
                "answers": [{"question_id": "q1", "answer": "4"}],
            },
            format="json",
        )
        force_authenticate(request, user=self.student)

        response = quiz_submit(request, self.course.id, quiz.id)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"], "This quiz is already closed.")
        attempt.refresh_from_db()
        self.assertIsNone(attempt.submitted_at)

    def test_student_cannot_submit_same_attempt_twice(self):
        quiz = self._create_quiz()
        attempt = self._create_attempt(
            quiz,
            answers=[{"question_id": "q1", "answer": "4"}],
            score=5,
            result_breakdown=[{"question_id": "q1", "question_text": "What is 2 + 2?", "points_earned": 5, "max_points": 5, "is_correct": True, "status": QuizAttempt.STATUS_GRADED}],
            submitted_at=timezone.now() - timedelta(minutes=1),
        )
        request = self.factory.post(
            f"/api/courses/{self.course.id}/activities/{quiz.id}/quiz/submit/",
            {
                "attempt_id": attempt.id,
                "answers": [{"question_id": "q1", "answer": "4"}],
            },
            format="json",
        )
        force_authenticate(request, user=self.student)

        response = quiz_submit(request, self.course.id, quiz.id)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "This attempt was already submitted.")

    def test_submitted_attempt_loads_without_editable_current_attempt(self):
        quiz = self._create_quiz(due_date=timezone.now() - timedelta(minutes=5))
        self._create_attempt(
            quiz,
            answers=[{"question_id": "q1", "answer": "4"}],
            score=5,
            result_breakdown=[{"question_id": "q1", "question_text": "What is 2 + 2?", "points_earned": 5, "max_points": 5, "is_correct": True, "status": QuizAttempt.STATUS_GRADED}],
            submitted_at=timezone.now() - timedelta(minutes=2),
        )
        request = self.factory.get(f"/api/courses/{self.course.id}/activities/{quiz.id}/quiz/")
        force_authenticate(request, user=self.student)

        response = quiz_detail(request, self.course.id, quiz.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_closed"])
        self.assertIsNone(response.data["current_attempt"])
        self.assertIsNone(response.data["attempt_id"])
        self.assertTrue(response.data["has_submitted_attempt"])
        self.assertEqual(len(response.data["attempts"]), 1)
        self.assertIsNotNone(response.data["latest_submitted_attempt_id"])

    def test_closed_quiz_hides_open_attempt_in_detail_payload(self):
        quiz = self._create_quiz(due_date=timezone.now() - timedelta(minutes=5))
        attempt = self._create_attempt(quiz)
        QuizAttemptAcknowledgement.objects.create(
            attempt=attempt,
            quiz=quiz,
            student=self.student,
            ack_message="Acknowledged",
        )
        request = self.factory.get(f"/api/courses/{self.course.id}/activities/{quiz.id}/quiz/")
        force_authenticate(request, user=self.student)

        response = quiz_detail(request, self.course.id, quiz.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_closed"])
        self.assertEqual(response.data["closed_message"], "This quiz is already closed.")
        self.assertIsNone(response.data["current_attempt"])
        self.assertIsNone(response.data["attempt_id"])
        self.assertEqual(len(response.data["attempts"]), 1)
