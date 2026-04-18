from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from django.test import TestCase

from .views_auth import EmailOrUsernameTokenObtainPairSerializer


User = get_user_model()


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

    def test_unverified_student_is_still_blocked(self):
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

        with self.assertRaises(AuthenticationFailed):
            serializer.is_valid(raise_exception=True)
