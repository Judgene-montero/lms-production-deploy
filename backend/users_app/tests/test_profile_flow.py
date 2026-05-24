from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch


User = get_user_model()


TINY_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00"
    b"\x00\x00\x00\xff\xff\xff!\xf9\x04\x01"
    b"\x00\x00\x00\x00,\x00\x00\x00\x00\x01"
    b"\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


@override_settings(SECURE_SSL_REDIRECT=False, DEBUG=True)
class ProfileFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            username="studentprofile",
            email="studentprofile@example.com",
            password="StrongPass123!",
            role="student",
            is_active=True,
            is_email_verified=True,
            first_name="Student",
            last_name="Profile",
            middle_initial="P",
        )
        self.instructor = User.objects.create_user(
            username="instructorprofile",
            email="instructorprofile@example.com",
            password="StrongPass123!",
            role="instructor",
            is_active=True,
            is_email_verified=True,
            approval_status="approved",
            first_name="Instructor",
            last_name="Profile",
            middle_initial="I",
        )

    def test_student_can_update_college_and_profile_becomes_complete(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.put(
            "/api/student/profile/",
            {
                "first_name": "Student",
                "middle_initial": "P",
                "last_name": "Profile",
                "email": "studentprofile@example.com",
                "school_id": "2026-0001",
                "college": "CAS",
                "department": "Science",
                "bio": "Testing profile updates",
                "phone": "0917-555-0101",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["college"], "CAS")
        self.student.refresh_from_db()
        self.assertEqual(self.student.college, "CAS")
        self.assertTrue(self.student.profile_complete)

    def test_instructor_can_update_college(self):
        self.client.force_authenticate(user=self.instructor)

        response = self.client.put(
            "/api/instructor/profile/",
            {
                "name": "Instructor Profile",
                "email": "instructorprofile@example.com",
                "college": "CIT",
                "department": "Engineering",
                "bio": "Updated bio",
                "phone": "+63 917 555 0102",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["college"], "CIT")
        self.instructor.refresh_from_db()
        self.assertEqual(self.instructor.college, "CIT")

    @patch(
        "users_app.views._upload_avatar_to_cloudinary",
        return_value={
            "secure_url": "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/student/user-1.png",
            "public_id": "enhance-lms/avatars/student/user-1",
        },
    )
    def test_student_avatar_upload_returns_cloudinary_avatar_url(self, mocked_upload):
        self.client.force_authenticate(user=self.student)
        avatar = SimpleUploadedFile("avatar.gif", TINY_GIF, content_type="image/gif")

        response = self.client.post(
            "/api/student/profile/avatar/",
            {"avatar": avatar},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Avatar updated.")
        self.assertIn("avatar_updated_at", response.data)
        self.assertIn("profile", response.data)
        self.assertEqual(
            response.data["avatar_url"],
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/student/user-1.png",
        )
        self.assertEqual(
            response.data["profile"]["avatar_url"],
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/student/user-1.png",
        )
        self.student.refresh_from_db()
        self.assertEqual(
            self.student.avatar_remote_url,
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/student/user-1.png",
        )
        mocked_upload.assert_called_once()

    @patch(
        "users_app.views._upload_avatar_to_cloudinary",
        return_value={
            "secure_url": "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/instructor/user-2.png",
            "public_id": "enhance-lms/avatars/instructor/user-2",
        },
    )
    def test_instructor_avatar_upload_returns_cloudinary_avatar_url(self, mocked_upload):
        self.client.force_authenticate(user=self.instructor)
        avatar = SimpleUploadedFile("avatar.gif", TINY_GIF, content_type="image/gif")

        response = self.client.post(
            "/api/instructor/profile/avatar/",
            {"avatar": avatar},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Avatar updated.")
        self.assertIn("avatar_updated_at", response.data)
        self.assertIn("profile", response.data)
        self.assertEqual(
            response.data["avatar_url"],
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/instructor/user-2.png",
        )
        self.assertEqual(
            response.data["profile"]["avatar_url"],
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/instructor/user-2.png",
        )
        self.instructor.refresh_from_db()
        self.assertEqual(
            self.instructor.avatar_remote_url,
            "https://res.cloudinary.com/demo/image/upload/v1/enhance-lms/avatars/instructor/user-2.png",
        )
        mocked_upload.assert_called_once()
