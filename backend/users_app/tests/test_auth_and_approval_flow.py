from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient

from users_app.views_auth import EmailOrUsernameTokenObtainPairSerializer


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class AdminAuthTests(TestCase):
    def test_create_superuser_defaults_to_verified_admin(self):
        user = User.objects.create_superuser(
            username="root",
            email="root@example.com",
            password="StrongPass123!",
        )

        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_email_verified)
        self.assertEqual(user.role, "admin")

    def test_legacy_superuser_can_obtain_token_without_email_verification(self):
        user = User.objects.create_user(
            username="legacyadmin",
            email="legacy@example.com",
            password="StrongPass123!",
            is_staff=True,
            is_superuser=True,
            is_active=True,
            role="student",
            is_email_verified=False,
        )

        serializer = EmailOrUsernameTokenObtainPairSerializer(
            data={"username": "legacyadmin", "password": "StrongPass123!"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user.refresh_from_db()
        self.assertEqual(user.role, "admin")
        self.assertTrue(user.is_email_verified)

    def test_unverified_student_can_still_obtain_token(self):
        User.objects.create_user(
            username="student1",
            email="student1@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=False,
        )

        serializer = EmailOrUsernameTokenObtainPairSerializer(
            data={"username": "student1", "password": "StrongPass123!"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class InstructorApprovalFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="admin1",
            email="admin1@example.com",
            password="StrongPass123!",
            role="admin",
            is_staff=True,
            is_active=True,
            is_email_verified=True,
            approval_status="not_required",
        )

    def test_student_registration_can_login_immediately(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "first_name": "Student",
                "last_name": "User",
                "username": "studentlogin",
                "email": "studentlogin@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "role": "student",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        serializer = EmailOrUsernameTokenObtainPairSerializer(
            data={"username": "studentlogin", "password": "StrongPass123!"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_instructor_registration_is_pending_and_listed_for_admin(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "first_name": "Inst",
                "last_name": "Pending",
                "username": "pendinginst",
                "email": "pendinginst@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "role": "instructor",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["approval_status"], "pending")

        user = User.objects.get(username="pendinginst")
        self.assertFalse(user.is_active)
        self.assertEqual(user.approval_status, "pending")
        self.assertTrue(user.is_email_verified)

        serializer = EmailOrUsernameTokenObtainPairSerializer(
            data={"username": "pendinginst", "password": "StrongPass123!"}
        )
        with self.assertRaises(AuthenticationFailed):
            serializer.is_valid(raise_exception=True)

        self.client.force_authenticate(user=self.admin)
        pending_response = self.client.get("/api/users/admin/pending-instructors/")
        self.assertEqual(pending_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(pending_response.data), 1)
        self.assertEqual(pending_response.data[0]["username"], "pendinginst")

    def test_admin_can_approve_and_instructor_can_login(self):
        instructor = User.objects.create_user(
            username="approveinst",
            email="approveinst@example.com",
            password="StrongPass123!",
            first_name="Approve",
            last_name="Me",
            role="instructor",
            is_active=False,
            is_email_verified=True,
            approval_status="pending",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f"/api/users/admin/instructor-approve/{instructor.id}/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        instructor.refresh_from_db()
        self.assertTrue(instructor.is_active)
        self.assertEqual(instructor.approval_status, "approved")

        serializer = EmailOrUsernameTokenObtainPairSerializer(
            data={"username": "approveinst", "password": "StrongPass123!"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_admin_can_reject_instructor(self):
        instructor = User.objects.create_user(
            username="rejectinst",
            email="rejectinst@example.com",
            password="StrongPass123!",
            first_name="Reject",
            last_name="Me",
            role="instructor",
            is_active=False,
            is_email_verified=True,
            approval_status="pending",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f"/api/users/admin/instructor-reject/{instructor.id}/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        instructor.refresh_from_db()
        self.assertFalse(instructor.is_active)
        self.assertEqual(instructor.approval_status, "rejected")
