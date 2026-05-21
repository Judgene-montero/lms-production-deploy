from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from courses.views import remove_student_from_course, student_course_detail, student_enrolled_courses
from users_app.models import Category, Course


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class RemoveStudentFromCourseTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.category = Category.objects.create(name="Removal Testing")
        self.instructor = User.objects.create_user(
            username="instructor_remove",
            email="instructor_remove@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
        )
        self.other_instructor = User.objects.create_user(
            username="other_instructor_remove",
            email="other_instructor_remove@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
        )
        self.student = User.objects.create_user(
            username="student_remove",
            email="student_remove@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.not_enrolled_student = User.objects.create_user(
            username="student_not_enrolled_remove",
            email="student_not_enrolled_remove@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )
        self.course = Course.objects.create(
            instructor=self.instructor,
            category=self.category,
            title="Biology 101",
            description="Removal flow test course",
            join_code="REMOVE1",
            join_code_enabled=True,
        )
        self.course.students.add(self.student)

    def test_instructor_removes_enrolled_student(self):
        request = self.factory.delete(f"/api/courses/{self.course.id}/students/{self.student.id}/remove/")
        force_authenticate(request, user=self.instructor)
        response = remove_student_from_course(request, self.course.id, self.student.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Student removed successfully.")
        self.assertFalse(self.course.students.filter(id=self.student.id).exists())

    def test_removed_student_loses_course_access(self):
        remove_request = self.factory.delete(f"/api/courses/{self.course.id}/students/{self.student.id}/remove/")
        force_authenticate(remove_request, user=self.instructor)
        remove_response = remove_student_from_course(remove_request, self.course.id, self.student.id)
        self.assertEqual(remove_response.status_code, status.HTTP_200_OK)

        detail_request = self.factory.get(f"/api/courses/student/courses/{self.course.id}/")
        force_authenticate(detail_request, user=self.student)
        detail_response = student_course_detail(detail_request, self.course.id)

        list_request = self.factory.get("/api/courses/student/courses/")
        force_authenticate(list_request, user=self.student)
        my_courses_response = student_enrolled_courses(list_request)

        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(my_courses_response.status_code, status.HTTP_200_OK)
        self.assertEqual(my_courses_response.data, [])

    def test_other_instructor_cannot_remove_student(self):
        request = self.factory.delete(f"/api/courses/{self.course.id}/students/{self.student.id}/remove/")
        force_authenticate(request, user=self.other_instructor)
        response = remove_student_from_course(request, self.course.id, self.student.id)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(self.course.students.filter(id=self.student.id).exists())

    def test_removing_non_enrolled_student_returns_clear_error(self):
        request = self.factory.delete(f"/api/courses/{self.course.id}/students/{self.not_enrolled_student.id}/remove/")
        force_authenticate(request, user=self.instructor)
        response = remove_student_from_course(request, self.course.id, self.not_enrolled_student.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Student is not enrolled in this course.")

    def test_enrollment_count_updates_correctly_after_removal(self):
        self.assertEqual(self.course.students.count(), 1)

        request = self.factory.delete(f"/api/courses/{self.course.id}/students/{self.student.id}/remove/")
        force_authenticate(request, user=self.instructor)
        response = remove_student_from_course(request, self.course.id, self.student.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.students.count(), 0)
