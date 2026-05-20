from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from courses.models import EnrollmentRequest
from users_app.models import Category, Course


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class StudentCourseVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Engineering")
        self.instructor = User.objects.create_user(
            username="instructor_visibility",
            email="instructor_visibility@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
        )
        self.student = User.objects.create_user(
            username="student_visibility",
            email="student_visibility@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.course = Course.objects.create(
            instructor=self.instructor,
            category=self.category,
            title="Thermodynamics",
            description="Heat and energy transfer",
            join_code="THERMO1",
            join_code_enabled=True,
        )

    def _create_pending_request(self):
        return EnrollmentRequest.objects.create(
            course=self.course,
            student=self.student,
            status=EnrollmentRequest.STATUS_PENDING,
        )

    def test_approved_request_makes_course_visible_in_student_my_courses(self):
        request_row = self._create_pending_request()

        self.client.force_authenticate(user=self.instructor)
        approve_response = self.client.post(
            f"/api/courses/enrollment-requests/{request_row.id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/dashboards/student/my-courses/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.course.id)
        self.assertEqual(response.data[0]["title"], self.course.title)
        self.assertEqual(response.data[0]["students_count"], 1)
        self.assertEqual(response.data[0]["category"]["id"], self.category.id)
        self.assertEqual(response.data[0]["category"]["name"], self.category.name)

    def test_reapproving_request_does_not_duplicate_enrollment(self):
        request_row = self._create_pending_request()

        self.client.force_authenticate(user=self.instructor)
        first_response = self.client.post(
            f"/api/courses/enrollment-requests/{request_row.id}/approve/",
            {},
            format="json",
        )
        second_response = self.client.post(
            f"/api/courses/enrollment-requests/{request_row.id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.course.students.filter(id=self.student.id).count(), 1)

    def test_rejected_request_does_not_show_course(self):
        request_row = self._create_pending_request()

        self.client.force_authenticate(user=self.instructor)
        reject_response = self.client.post(
            f"/api/courses/enrollment-requests/{request_row.id}/reject/",
            {},
            format="json",
        )

        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/dashboards/student/my-courses/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_student_dashboard_count_updates_after_approval(self):
        request_row = self._create_pending_request()

        self.client.force_authenticate(user=self.student)
        before_response = self.client.get("/api/dashboards/student/dashboard/")
        self.assertEqual(before_response.status_code, status.HTTP_200_OK)
        self.assertEqual(before_response.data["total_courses"], 0)

        self.client.force_authenticate(user=self.instructor)
        approve_response = self.client.post(
            f"/api/courses/enrollment-requests/{request_row.id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.student)
        after_response = self.client.get("/api/dashboards/student/dashboard/")

        self.assertEqual(after_response.status_code, status.HTTP_200_OK)
        self.assertEqual(after_response.data["total_courses"], 1)
