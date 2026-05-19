from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from courses.models import EnrollmentRequest
from users_app.models import Category, Course


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class EnrollmentRequestFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Testing")
        self.instructor = User.objects.create_user(
            username="instructor1",
            email="instructor1@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
        )
        self.student = User.objects.create_user(
            username="student1",
            email="student1@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.other_student = User.objects.create_user(
            username="student2",
            email="student2@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.course = Course.objects.create(
            instructor=self.instructor,
            category=self.category,
            title="Physics 101",
            description="Test course",
            join_code="JOIN101",
            join_code_enabled=True,
        )

    def test_new_student_join_creates_pending_request(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post("/api/courses/join/", {"code": "join101"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Enrollment request sent. Please wait for instructor approval.")
        self.assertEqual(EnrollmentRequest.objects.filter(course=self.course, student=self.student).count(), 1)
        request_row = EnrollmentRequest.objects.get(course=self.course, student=self.student)
        self.assertEqual(request_row.status, EnrollmentRequest.STATUS_PENDING)
        self.assertFalse(self.course.students.filter(id=self.student.id).exists())

    def test_duplicate_pending_request_is_not_created(self):
        EnrollmentRequest.objects.create(course=self.course, student=self.student, status=EnrollmentRequest.STATUS_PENDING)

        self.client.force_authenticate(user=self.student)
        response = self.client.post("/api/courses/join/", {"code": "JOIN101"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "You already have a pending request for this course.")
        self.assertEqual(
            EnrollmentRequest.objects.filter(course=self.course, student=self.student, status=EnrollmentRequest.STATUS_PENDING).count(),
            1,
        )

    def test_already_enrolled_student_cannot_request_again(self):
        self.course.students.add(self.student)

        self.client.force_authenticate(user=self.student)
        response = self.client.post("/api/courses/join/", {"code": "JOIN101"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "You are already enrolled in this course.")
        self.assertFalse(EnrollmentRequest.objects.filter(course=self.course, student=self.student).exists())

    def test_instructor_pending_requests_filter_by_course(self):
        same_instructor_course = Course.objects.create(
            instructor=self.instructor,
            category=self.category,
            title="Chemistry 101",
            description="Second course",
            join_code="JOIN102",
            join_code_enabled=True,
        )
        EnrollmentRequest.objects.create(course=self.course, student=self.student, status=EnrollmentRequest.STATUS_PENDING)
        EnrollmentRequest.objects.create(course=same_instructor_course, student=self.other_student, status=EnrollmentRequest.STATUS_PENDING)

        self.client.force_authenticate(user=self.instructor)
        response = self.client.get(f"/api/courses/enrollment-requests/?course_id={self.course.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["student"], self.student.id)
        self.assertEqual(response.data[0]["course"], self.course.id)

    def test_approve_enrollment_request_enrolls_student(self):
        request_row = EnrollmentRequest.objects.create(
            course=self.course,
            student=self.student,
            status=EnrollmentRequest.STATUS_PENDING,
        )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.post(f"/api/courses/enrollment-requests/{request_row.id}/approve/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_row.refresh_from_db()
        self.assertEqual(request_row.status, EnrollmentRequest.STATUS_APPROVED)
        self.assertTrue(self.course.students.filter(id=self.student.id).exists())

    def test_reject_enrollment_request_does_not_enroll_student(self):
        request_row = EnrollmentRequest.objects.create(
            course=self.course,
            student=self.student,
            status=EnrollmentRequest.STATUS_PENDING,
        )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.post(f"/api/courses/enrollment-requests/{request_row.id}/reject/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_row.refresh_from_db()
        self.assertEqual(request_row.status, EnrollmentRequest.STATUS_REJECTED)
        self.assertFalse(self.course.students.filter(id=self.student.id).exists())
