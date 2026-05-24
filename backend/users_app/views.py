# users_app/views.py
import logging
import secrets
from pathlib import Path
import pandas as pd
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q
from .models import ApprovedSchoolID, Course, SiteSettings, AdminLog
from .models import Notification
from .services.notifications import publish_notification, publish_notifications
from .serializers import (
    ApprovedSchoolIDSerializer as ApprovedIDSerializer,
    SiteSettingsSerializer,
    AdminLogSerializer,
    InstructorProfileSerializer,
    InstructorNotificationSettingsSerializer,
    NotificationSerializer,
    StudentProfileSerializer,
    StudentNotificationSettingsSerializer,
    ChangePasswordSerializer,
)
from rest_framework.permissions import IsAuthenticated

try:
    from cloudinary import uploader as cloudinary_uploader
except ImportError:  # pragma: no cover
    cloudinary_uploader = None

User = get_user_model()
logger = logging.getLogger(__name__)


def _build_avatar_debug_payload(user, request):
    avatar_field = getattr(user, "avatar", None)
    avatar_name = getattr(avatar_field, "name", "") if avatar_field else ""
    avatar_url = user.get_avatar_url(request=request)
    expected_file_path = ""
    file_exists = False

    if avatar_field:
        try:
            expected_file_path = str(avatar_field.path)
            file_exists = Path(expected_file_path).exists()
        except Exception:
            expected_file_path = str(Path(settings.MEDIA_ROOT) / avatar_name) if avatar_name else ""
            file_exists = Path(expected_file_path).exists() if expected_file_path else False

    return {
        "avatar": avatar_name or None,
        "avatar_remote_url": getattr(user, "avatar_remote_url", None),
        "avatar_url": avatar_url,
        "media_url": settings.MEDIA_URL,
        "media_root": str(settings.MEDIA_ROOT),
        "serve_media_files": bool(getattr(settings, "SERVE_MEDIA_FILES", False)),
        "cloudinary_avatars_enabled": bool(getattr(settings, "CLOUDINARY_AVATARS_ENABLED", False)),
        "expected_file_path": expected_file_path or None,
        "file_exists": file_exists,
    }


def create_admin_log(action, performed_by=None, target_user=None, description=""):
    try:
        AdminLog.objects.create(
            action=action,
            performed_by=performed_by if getattr(performed_by, "is_authenticated", False) else None,
            target_user=target_user,
            description=description or "",
        )
    except Exception as e:
        # Skip logging if table does not exist
        logger.warning(
            "Admin log skipped due to storage error.",
            extra={
                "action": action,
                "performed_by_id": getattr(performed_by, "id", None),
                "target_user_id": getattr(target_user, "id", None),
            },
            exc_info=True,
        )


def _is_admin(user):
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and (
            getattr(user, "role", "") == "admin"
            or getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
        )
    )


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return _is_admin(getattr(request, "user", None))


def _is_instructor_or_admin(user):
    return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "role", "") in {"instructor", "admin"})


def _user_status_label(user):
    if getattr(user, "role", "") == "instructor":
        approval_status = getattr(user, "approval_status", "pending")
        if approval_status == "pending":
            return "pending"
        if approval_status == "rejected":
            return "rejected"
        if not getattr(user, "is_active", False):
            return "inactive"
        return "active"
    if not getattr(user, "is_active", False):
        return "inactive"
    return "active"


def _serialize_user_activity(user):
    from courses.models import (
        ActivitySubmission,
        AttendanceRecord,
        MeetingAttendance,
        QuizAttempt,
    )

    recent_logs = (
        AdminLog.objects.filter(Q(target_user=user) | Q(performed_by=user))
        .select_related("performed_by", "target_user")
        .order_by("-timestamp")[:12]
    )
    notification_stats = Notification.objects.filter(recipient=user).aggregate(
        total=Count("id"),
        unread=Count("id", filter=Q(is_read=False)),
    )

    activity_summary = {
        "status": _user_status_label(user),
        "date_joined": user.date_joined,
        "last_login": user.last_login,
        "notifications_total": notification_stats.get("total", 0) or 0,
        "notifications_unread": notification_stats.get("unread", 0) or 0,
    }
    related_courses = []
    recent_events = []

    if getattr(user, "role", "") == "student":
        related_courses = list(
            user.enrolled_courses.order_by("title").values("id", "title")[:20]
        )
        recent_submissions = (
            ActivitySubmission.objects.filter(student=user)
            .select_related("activity__course")
            .order_by("-submitted_at")[:8]
        )
        recent_events.extend(
            [
                {
                    "type": "submission",
                    "label": submission.activity.title,
                    "course": submission.activity.course.title,
                    "at": submission.submitted_at,
                    "status": submission.status,
                }
                for submission in recent_submissions
            ]
        )
        activity_summary.update(
            {
                "course_count": len(related_courses),
                "submissions_count": ActivitySubmission.objects.filter(student=user).count(),
                "quiz_attempts_count": QuizAttempt.objects.filter(student=user).count(),
                "attendance_records_count": AttendanceRecord.objects.filter(student=user).count(),
                "meeting_attendance_count": MeetingAttendance.objects.filter(student=user).count(),
            }
        )
    elif getattr(user, "role", "") == "instructor":
        related_courses = list(
            user.courses.order_by("title").values("id", "title")[:20]
        )
        recent_submissions = (
            ActivitySubmission.objects.filter(activity__course__instructor=user)
            .select_related("activity__course", "student")
            .order_by("-submitted_at")[:8]
        )
        recent_events.extend(
            [
                {
                    "type": "student_submission",
                    "label": f"{submission.student.username} submitted {submission.activity.title}",
                    "course": submission.activity.course.title,
                    "at": submission.submitted_at,
                    "status": submission.status,
                }
                for submission in recent_submissions
            ]
        )
        activity_summary.update(
            {
                "course_count": len(related_courses),
                "student_count": User.objects.filter(enrolled_courses__instructor=user, role="student").distinct().count(),
                "submissions_to_review": ActivitySubmission.objects.filter(
                    activity__course__instructor=user,
                    status="submitted",
                    grade__isnull=True,
                ).count(),
            }
        )
    else:
        related_courses = list(
            user.courses.order_by("title").values("id", "title")[:20]
        )
        activity_summary.update(
            {
                "course_count": len(related_courses),
                "admin_actions_count": AdminLog.objects.filter(performed_by=user).count(),
            }
        )

    return {
        "summary": activity_summary,
        "courses": related_courses,
        "recent_activity": [
            {
                "id": log.id,
                "action": log.action,
                "description": log.description,
                "timestamp": log.timestamp,
                "performed_by": getattr(log.performed_by, "username", None),
                "target_user": getattr(log.target_user, "username", None),
            }
            for log in recent_logs
        ],
        "recent_events": sorted(
            recent_events,
            key=lambda item: item.get("at") or timezone.now(),
            reverse=True,
        )[:8],
    }

# --------------------------
# USER PROFILE VIEW
# --------------------------
class UserProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Determine user role safely
        if user.is_superuser:
            role = "admin"
        else:
            role = getattr(user, "role", "student")  # default to "student" if not set

        avatar_url = user.get_avatar_url(request=request)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": getattr(user, "first_name", ""),
            "middle_initial": getattr(user, "middle_initial", ""),
            "last_name": getattr(user, "last_name", ""),
            "role": role,  # now supports "student", "instructor", or "admin"
            "approval_status": getattr(user, "approval_status", "not_required"),
            "school_id": getattr(user, "school_id", ""),
            "college": getattr(user, "college", ""),
            "is_verified_school_user": getattr(user, "is_verified_school_user", False),
            "is_email_verified": getattr(user, "is_email_verified", False),
            "profile_complete": getattr(user, "profile_complete", False),
            "is_active": user.is_active,
            "bio": getattr(user, "bio", ""),
            "phone": getattr(user, "phone", ""),
            "department": getattr(user, "department", ""),
            "avatar": avatar_url,
            "avatar_url": avatar_url,
            "notify_assignment_submission": getattr(user, "notify_assignment_submission", True),
            "notify_quiz_completed": getattr(user, "notify_quiz_completed", True),
            "notify_student_join_course": getattr(user, "notify_student_join_course", True),
        })

    def patch(self, request):
        user = request.user
        data = request.data or {}

        if "first_name" in data:
            user.first_name = str(data.get("first_name", "")).strip()
        if "last_name" in data:
            user.last_name = str(data.get("last_name", "")).strip()
        if "middle_initial" in data:
            mi = str(data.get("middle_initial", "")).strip().upper()
            user.middle_initial = mi[:1] if mi else ""
        if "college" in data:
            user.college = str(data.get("college", "")).strip() or None
        if "student_id" in data:
            user.school_id = str(data.get("student_id", "")).strip() or None
        if "school_id" in data:
            user.school_id = str(data.get("school_id", "")).strip() or None

        required_for_all = [user.first_name, user.last_name, user.email, user.middle_initial, user.college]
        student_ok = bool(user.school_id) if user.role == "student" else True
        user.profile_complete = all(bool(v) for v in required_for_all) and student_ok
        user.save()

        return Response(
            {
                "message": "Profile updated successfully.",
                "profile_complete": user.profile_complete,
            },
            status=status.HTTP_200_OK,
        )


class ProfileAvatarDebugAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_build_avatar_debug_payload(request.user, request), status=status.HTTP_200_OK)


def _ensure_instructor(user):
    return _is_instructor_or_admin(user)


def _ensure_student(user):
    return getattr(user, "role", "") == "student"


def _normalize_college_value(value):
    if value in (None, ""):
        return None
    cleaned = str(value).strip().upper()
    valid_codes = {choice[0] for choice in User.COLLEGE_CHOICES}
    return cleaned if cleaned in valid_codes else None


def _compute_profile_complete(user):
    required_for_all = [user.first_name, user.last_name, user.email, user.middle_initial, user.college]
    student_ok = bool(user.school_id) if getattr(user, "role", "") == "student" else True
    return all(bool(value) for value in required_for_all) and student_ok


def _upload_avatar_to_cloudinary(user, avatar_file):
    if not getattr(settings, "CLOUDINARY_AVATARS_ENABLED", False) or cloudinary_uploader is None:
        return None

    folder = f"enhance-lms/avatars/{getattr(user, 'role', 'users')}"
    public_id = f"user-{user.id}-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
    upload_result = cloudinary_uploader.upload(
        avatar_file,
        folder=folder,
        public_id=public_id,
        overwrite=True,
        resource_type="image",
        secure=True,
    )
    secure_url = upload_result.get("secure_url")
    if not secure_url:
        raise ValueError("Cloudinary upload did not return a secure_url.")

    return {
        "secure_url": secure_url,
        "public_id": upload_result.get("public_id"),
    }


def _save_avatar(user, avatar_file):
    upload_timestamp = timezone.now().isoformat()
    cloudinary_result = _upload_avatar_to_cloudinary(user, avatar_file)

    if cloudinary_result:
        user.avatar_remote_url = cloudinary_result["secure_url"]
        user.save(update_fields=["avatar_remote_url"])
        logger.info(
            "Avatar uploaded to Cloudinary.",
            extra={
                "user_id": user.id,
                "role": getattr(user, "role", ""),
                "cloudinary_public_id": cloudinary_result.get("public_id"),
            },
        )
        return upload_timestamp

    user.avatar = avatar_file
    user.avatar_remote_url = None
    user.save(update_fields=["avatar", "avatar_remote_url"])
    user.refresh_from_db(fields=["avatar", "avatar_remote_url"])
    logger.info(
        "Avatar saved locally.",
        extra={
            "user_id": user.id,
            "role": getattr(user, "role", ""),
            "avatar_name": getattr(user.avatar, "name", ""),
            "avatar_path": getattr(user.avatar, "path", ""),
            "file_exists": Path(getattr(user.avatar, "path", "")).exists() if getattr(user.avatar, "path", "") else False,
        },
    )
    return upload_timestamp


class InstructorProfileAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not _ensure_instructor(request.user):
            return Response({"error": "Only instructors can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = InstructorProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if not _ensure_instructor(request.user):
            return Response({"error": "Only instructors can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        data = request.data or {}
        name = str(data.get("name", "")).strip()

        if name:
            parts = [part for part in name.split(" ") if part]
            if len(parts) == 1:
                user.first_name = parts[0]
            else:
                user.first_name = parts[0]
                user.last_name = " ".join(parts[1:])

        if "email" in data:
            user.email = str(data.get("email", "")).strip()
        if "bio" in data:
            user.bio = str(data.get("bio", "")).strip()
        if "phone" in data:
            user.phone = str(data.get("phone", "")).strip()
        if "department" in data:
            user.department = str(data.get("department", "")).strip()
        if "college" in data:
            normalized_college = _normalize_college_value(data.get("college"))
            if data.get("college") not in (None, "") and not normalized_college:
                return Response({"error": "Invalid program / college selection."}, status=status.HTTP_400_BAD_REQUEST)
            user.college = normalized_college

        user.profile_complete = _compute_profile_complete(user)
        user.save()
        serializer = InstructorProfileSerializer(user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class InstructorProfileAvatarUploadAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not _ensure_instructor(request.user):
            return Response({"error": "Only instructors can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        avatar = request.FILES.get("avatar") or request.FILES.get("profile_picture")
        if not avatar:
            return Response({"error": "avatar file is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        try:
            upload_timestamp = _save_avatar(user, avatar)
        except Exception:
            logger.exception(
                "Instructor avatar upload failed.",
                extra={"user_id": user.id, "role": getattr(user, "role", "")},
            )
            return Response(
                {"error": "Unable to upload avatar right now. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        serializer = InstructorProfileSerializer(user, context={"request": request})
        avatar_payload = serializer.data
        return Response(
            {
                "message": "Avatar updated.",
                "avatar_updated_at": upload_timestamp,
                "profile": avatar_payload,
                **avatar_payload,
            },
            status=status.HTTP_200_OK,
        )


class InstructorNotificationSettingsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _ensure_instructor(request.user):
            return Response({"error": "Only instructors can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = InstructorNotificationSettingsSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if not _ensure_instructor(request.user):
            return Response({"error": "Only instructors can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = InstructorNotificationSettingsSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentProfileAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not _ensure_student(request.user):
            return Response({"error": "Only students can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = StudentProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if not _ensure_student(request.user):
            return Response({"error": "Only students can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        data = request.data or {}
        name = str(data.get("name", "")).strip()

        if name:
            parts = [part for part in name.split(" ") if part]
            if len(parts) == 1:
                user.first_name = parts[0]
            else:
                user.first_name = parts[0]
                user.last_name = " ".join(parts[1:])

        if "first_name" in data:
            user.first_name = str(data.get("first_name", "")).strip()
        if "last_name" in data:
            user.last_name = str(data.get("last_name", "")).strip()
        if "middle_initial" in data:
            mi = str(data.get("middle_initial", "")).strip().upper()
            user.middle_initial = mi[:1] if mi else ""

        if "email" in data:
            email = str(data.get("email", "")).strip().lower()
            if not email:
                return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            duplicate_email = User.objects.filter(email__iexact=email).exclude(id=user.id).exists()
            if duplicate_email:
                return Response({"error": "Email is already in use."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
        if "bio" in data:
            user.bio = str(data.get("bio", "")).strip()
        if "phone" in data:
            phone = str(data.get("phone", "")).strip()
            allowed_chars = set("0123456789+-() ")
            if any(ch not in allowed_chars for ch in phone):
                return Response({"error": "Phone number contains invalid characters."}, status=status.HTTP_400_BAD_REQUEST)
            if len(phone) > 20:
                return Response({"error": "Phone number must be 20 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)
            user.phone = phone
        if "department" in data:
            user.department = str(data.get("department", "")).strip()
        if "college" in data:
            normalized_college = _normalize_college_value(data.get("college"))
            if data.get("college") not in (None, "") and not normalized_college:
                return Response({"error": "Invalid program / college selection."}, status=status.HTTP_400_BAD_REQUEST)
            user.college = normalized_college

        if "school_id" in data:
            incoming_school_id = str(data.get("school_id", "")).strip()
            if not incoming_school_id:
                return Response({"error": "Student ID cannot be blank."}, status=status.HTTP_400_BAD_REQUEST)

            if user.school_id and incoming_school_id != user.school_id:
                return Response(
                    {"error": "Student ID is already locked. Contact admin to request a change."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            duplicate_school_id = User.objects.filter(school_id__iexact=incoming_school_id).exclude(id=user.id).exists()
            if duplicate_school_id:
                return Response({"error": "Student ID is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.school_id = incoming_school_id

        if not user.first_name or not user.last_name:
            return Response({"error": "First name and last name are required."}, status=status.HTTP_400_BAD_REQUEST)

        user.profile_complete = _compute_profile_complete(user)
        user.save()
        serializer = StudentProfileSerializer(user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentProfileAvatarUploadAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not _ensure_student(request.user):
            return Response({"error": "Only students can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        avatar = request.FILES.get("avatar") or request.FILES.get("profile_picture")
        if not avatar:
            return Response({"error": "avatar file is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        try:
            upload_timestamp = _save_avatar(user, avatar)
        except Exception:
            logger.exception(
                "Student avatar upload failed.",
                extra={"user_id": user.id, "role": getattr(user, "role", "")},
            )
            return Response(
                {"error": "Unable to upload avatar right now. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        serializer = StudentProfileSerializer(user, context={"request": request})
        avatar_payload = serializer.data
        return Response(
            {
                "message": "Avatar updated.",
                "avatar_updated_at": upload_timestamp,
                "profile": avatar_payload,
                **avatar_payload,
            },
            status=status.HTTP_200_OK,
        )


class StudentNotificationSettingsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _ensure_student(request.user):
            return Response({"error": "Only students can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = StudentNotificationSettingsSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if not _ensure_student(request.user):
            return Response({"error": "Only students can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
        serializer = StudentNotificationSettingsSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class ChangePasswordAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        current_password = serializer.validated_data["current_password"]
        new_password = serializer.validated_data["new_password"]
        if not user.check_password(current_password):
            return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)


class NotificationListAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = (
            Notification.objects.filter(recipient=request.user)
            .select_related("recipient", "actor", "course", "activity", "submission")
            .order_by("-created_at", "-id")
        )
        serializer = NotificationSerializer(queryset[:100], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationUnreadCountAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": unread_count}, status=status.HTTP_200_OK)


class NotificationMarkReadAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        notification = (
            Notification.objects.filter(id=notification_id, recipient=request.user)
            .select_related("recipient", "actor", "course", "activity", "submission")
            .first()
        )
        if not notification:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
            publish_notification(notification)

        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkAllReadAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        pending = list(
            Notification.objects.filter(recipient=request.user, is_read=False)
            .select_related("recipient", "actor", "course", "activity", "submission")
            .order_by("-created_at", "-id")
        )
        updated = 0
        if pending:
            ids = [item.id for item in pending]
            updated = Notification.objects.filter(id__in=ids).update(is_read=True, read_at=now)
            for item in pending:
                item.is_read = True
                item.read_at = now
            publish_notifications(pending)
        return Response({"updated": updated}, status=status.HTTP_200_OK)
# --------------------------
# CHECK APPROVED ID (GET)
# --------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def check_approved_id(request, school_id):
    """
    Returns: { exists: bool, first_name, middle_initial, last_name, role, college }
    """
    try:
        record = ApprovedSchoolID.objects.get(school_id=school_id)
        return Response({
            "exists": True,
            "first_name": record.first_name,
            "middle_initial": record.middle_initial,
            "last_name": record.last_name,
            "role": record.role,
            "college": record.college,
        })
    except ApprovedSchoolID.DoesNotExist:
        return Response({"exists": False})


# --------------------------
# REGISTER / ACTIVATE USER (POST)
# --------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    data = request.data
    username = str(data.get("username", "")).strip()
    first_name = str(data.get("first_name", "")).strip()
    last_name = str(data.get("last_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password")
    confirm_password = data.get("confirm_password")
    role = str(data.get("role", "student")).strip().lower()

    if role not in ["student", "instructor"]:
        role = "student"

    if not first_name:
        return Response({"error": "First name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not last_name:
        return Response({"error": "Last name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not username:
        return Response({"error": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not email:
        return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not password or len(str(password)) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
    if password != confirm_password:
        return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({"error": "Username already taken"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "Email already registered"}, status=status.HTTP_400_BAD_REQUEST)

    is_student = role == "student"
    settings_obj, _ = SiteSettings.objects.get_or_create(id=1)

    if role == "instructor" and not settings_obj.allow_instructor_self_registration:
        return Response(
            {"error": "Instructor self-registration is currently disabled."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if is_student:
        is_active = True
        is_email_verified = True
        approval_status = "not_required"
    else:
        is_active = False
        is_email_verified = True
        approval_status = "pending"

    user = User.objects.create(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
        approval_status=approval_status,
        is_active=is_active,
        is_email_verified=is_email_verified,
        profile_complete=False,
        password=make_password(password),
    )

    response = {
        "role": role,
        "approval_status": approval_status,
    }
    if is_student:
        response["message"] = "Registration successful. You can log in now."
    else:
        response["message"] = "Your instructor account is pending admin approval."

    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email(request, token):
    return Response(
        {
            "message": "Email verification is currently disabled. Students can log in immediately. Instructors must wait for admin approval."
        },
        status=status.HTTP_200_OK,
    )


# --------------------------
# ADMIN - INSTRUCTOR APPROVAL
# --------------------------
class PendingInstructorApprovalsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        pending = User.objects.filter(
            role="instructor",
            approval_status="pending",
            is_active=False,
        ).order_by("-date_joined")

        rows = [
            {
                "id": u.id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "date_joined": u.date_joined,
                "approval_status": u.approval_status,
            }
            for u in pending
        ]
        return Response(rows, status=status.HTTP_200_OK)


class ApproveInstructorView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role="instructor")
        except User.DoesNotExist:
            return Response({"error": "Instructor not found."}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = True
        user.is_email_verified = True
        user.approval_status = "approved"
        user.save(update_fields=["is_active", "is_email_verified", "approval_status"])
        create_admin_log(
            action="Instructor approved",
            performed_by=request.user,
            target_user=user,
            description=f"Approved instructor account for {user.username}.",
        )
        return Response({"message": "Instructor account approved."}, status=status.HTTP_200_OK)


class RejectInstructorView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role="instructor")
        except User.DoesNotExist:
            return Response({"error": "Instructor not found."}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = False
        user.is_email_verified = True
        user.approval_status = "rejected"
        user.save(update_fields=["is_active", "is_email_verified", "approval_status"])
        create_admin_log(
            action="Instructor rejected",
            performed_by=request.user,
            target_user=user,
            description=f"Rejected instructor account for {user.username}.",
        )
        return Response({"message": "Instructor account rejected."}, status=status.HTTP_200_OK)


class AdminUserListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        queryset = User.objects.prefetch_related("courses", "enrolled_courses").order_by("-date_joined")

        role = (request.query_params.get("role") or "").strip().lower()
        search = (request.query_params.get("search") or "").strip().lower()
        if role in {"student", "instructor", "admin"}:
            queryset = queryset.filter(role=role)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        rows = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "first_name": u.first_name,
                "middle_initial": u.middle_initial,
                "last_name": u.last_name,
                "role": u.role,
                "approval_status": getattr(u, "approval_status", "not_required"),
                "school_id": u.school_id,
                "college": u.college,
                "is_email_verified": bool(getattr(u, "is_email_verified", False)),
                "is_active": u.is_active,
                "status": _user_status_label(u),
                "last_login": u.last_login,
                "course_count": (u.courses.count() if u.role in {"instructor", "admin"} else u.enrolled_courses.count()) or 0,
                "course_titles": (
                    list(u.courses.order_by("title").values_list("title", flat=True)[:5])
                    if u.role in {"instructor", "admin"}
                    else list(u.enrolled_courses.order_by("title").values_list("title", flat=True)[:5])
                ),
                "notification_count": u.notifications.count(),
                "date_joined": u.date_joined,
            }
            for u in queryset
        ]
        return Response(rows, status=status.HTTP_200_OK)


class AdminUserDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get_user(self, user_id):
        return User.objects.filter(id=user_id).first()

    def get(self, request, user_id):
        user = self.get_user(user_id)
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        activity = _serialize_user_activity(user)
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "middle_initial": user.middle_initial,
                "role": user.role,
                "approval_status": getattr(user, "approval_status", "not_required"),
                "school_id": user.school_id,
                "college": user.college,
                "is_email_verified": bool(getattr(user, "is_email_verified", False)),
                "is_active": user.is_active,
                "status": _user_status_label(user),
                "last_login": user.last_login,
                "date_joined": user.date_joined,
                "activity": activity,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, user_id):
        user = self.get_user(user_id)
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        action_notes = []
        data = request.data or {}
        settings_obj, _ = SiteSettings.objects.get_or_create(id=1)

        with transaction.atomic():
            if "is_active" in data:
                user.is_active = bool(data.get("is_active"))
                action_notes.append("active status updated")
            if "status" in data:
                next_status = str(data.get("status")).strip().lower()
                if next_status in {"active", "inactive", "pending", "rejected"}:
                    if user.role == "instructor":
                        if next_status == "active":
                            user.approval_status = "approved"
                            user.is_active = True
                        elif next_status == "pending":
                            user.approval_status = "pending"
                            user.is_active = False
                        elif next_status == "rejected":
                            user.approval_status = "rejected"
                            user.is_active = False
                        else:
                            user.approval_status = "approved"
                            user.is_active = False
                        user.is_email_verified = True
                    else:
                        user.is_active = next_status == "active"
                    action_notes.append(f"status set to {next_status}")
            if "college" in data:
                user.college = str(data.get("college", "")).strip() or None
                action_notes.append("college updated")
            if "role" in data:
                next_role = str(data.get("role", "")).strip().lower()
                if next_role in {"student", "instructor"} and next_role != user.role:
                    user.role = next_role
                    if next_role == "instructor":
                        user.approval_status = "approved"
                        user.is_active = True
                        user.is_email_verified = True
                    else:
                        user.approval_status = "not_required"
                        user.is_email_verified = True
                    action_notes.append(f"role changed to {next_role}")
            if "is_email_verified" in data:
                user.is_email_verified = bool(data.get("is_email_verified"))
                action_notes.append("email verification updated")
            user.save()
        if action_notes:
            create_admin_log(
                action="User updated",
                performed_by=request.user,
                target_user=user,
                description=f"{user.username}: {', '.join(action_notes)}.",
            )
        return Response({"message": "User updated successfully."}, status=status.HTTP_200_OK)

    def put(self, request, user_id):
        return self.patch(request, user_id)

    def delete(self, request, user_id):
        user = self.get_user(user_id)
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response({"error": "You cannot delete your own admin account."}, status=status.HTTP_400_BAD_REQUEST)
        username = user.username
        user.delete()
        create_admin_log(
            action="User deleted",
            performed_by=request.user,
            target_user=None,
            description=f"Deleted user account {username}.",
        )
        return Response({"message": "User deleted."}, status=status.HTTP_200_OK)


class AdminBulkStatusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def put(self, request):
        user_ids = request.data.get("user_ids") or []
        status_value = str(request.data.get("status", "")).strip().lower()
        if status_value not in {"active", "inactive"}:
            return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        updated = User.objects.filter(id__in=user_ids).exclude(id=request.user.id).update(
            is_active=(status_value == "active")
        )
        create_admin_log(
            action=f"Users set {status_value}",
            performed_by=request.user,
            target_user=None,
            description=f"Bulk updated {updated} user(s) to {status_value}.",
        )
        return Response({"updated": updated, "status": status_value}, status=status.HTTP_200_OK)


class AdminUserActivityView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_user_activity(user), status=status.HTTP_200_OK)


class AdminUserResetPasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        temporary_password = request.data.get("temporary_password")
        temporary_password = str(temporary_password or "").strip() or secrets.token_urlsafe(9)
        user.set_password(temporary_password)
        user.save(update_fields=["password"])
        create_admin_log(
            action="Password reset",
            performed_by=request.user,
            target_user=user,
            description=f"Temporary password issued for {user.username}.",
        )
        return Response(
            {
                "message": "Password reset successfully.",
                "temporary_password": temporary_password,
            },
            status=status.HTTP_200_OK,
        )


class AdminSettingsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get_object(self):
        obj, _ = SiteSettings.objects.get_or_create(id=1)
        return obj

    def get(self, request):
        serializer = SiteSettingsSerializer(self.get_object())
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        settings_obj = self.get_object()
        serializer = SiteSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        create_admin_log(
            action="Settings updated",
            performed_by=request.user,
            target_user=None,
            description="Updated admin site settings.",
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminLogsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        queryset = AdminLog.objects.select_related("performed_by", "target_user").all()
        action = (request.query_params.get("action") or "").strip()
        search = (request.query_params.get("search") or "").strip()
        ordering = (request.query_params.get("ordering") or "-timestamp").strip()

        if action:
            queryset = queryset.filter(action__icontains=action)
        if search:
            queryset = queryset.filter(
                Q(description__icontains=search)
                | Q(action__icontains=search)
                | Q(performed_by__username__icontains=search)
                | Q(target_user__username__icontains=search)
            )
        if ordering not in {"timestamp", "-timestamp"}:
            ordering = "-timestamp"
        queryset = queryset.order_by(ordering)[:500]

        serializer = AdminLogSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        action = str(request.data.get("action", "")).strip()
        description = str(request.data.get("description", "")).strip()
        target_user_id = request.data.get("target_user")
        target_user = User.objects.filter(id=target_user_id).first() if target_user_id else None

        if not action:
            return Response({"error": "action is required."}, status=status.HTTP_400_BAD_REQUEST)

        log = AdminLog.objects.create(
            action=action,
            performed_by=request.user,
            target_user=target_user,
            description=description,
        )
        serializer = AdminLogSerializer(log)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# --------------------------
# LIST APPROVED IDs (admin)
# --------------------------
class ApprovedIDListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        queryset = ApprovedSchoolID.objects.all().order_by("-id")
        serializer = ApprovedIDSerializer(queryset, many=True)
        return Response(serializer.data)


# --------------------------
# DELETE APPROVED ID (admin)
# --------------------------
class DeleteApprovedIDView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]

    def delete(self, request, pk):
        try:
            record = ApprovedSchoolID.objects.get(pk=pk)
            record.delete()
            return Response({"message": "Deleted successfully"}, status=status.HTTP_200_OK)
        except ApprovedSchoolID.DoesNotExist:
            return Response({"error": "Record not found"}, status=status.HTTP_404_NOT_FOUND)


# --------------------------
# UPLOAD APPROVED IDs (admin) - supports initial_password column
# --------------------------
class UploadApprovedIDsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsSystemAdmin]
    DEFAULT_COLLEGE = "CAS"

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        if not (file.name.endswith(".csv") or file.name.endswith(".xlsx")):
            return Response({"error": "File must be .csv or .xlsx"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file) if file.name.endswith(".xlsx") else pd.read_csv(file)
            required_columns = {"first_name", "last_name", "school_id", "role", "initial_password"}
            if not required_columns.issubset(df.columns):
                return Response({
                    "error": "Missing required columns in file.",
                    "required": list(required_columns),
                    "provided": list(df.columns)
                }, status=status.HTTP_400_BAD_REQUEST)

            created = 0
            existing = 0
            valid_colleges = [c[0] for c in ApprovedSchoolID.COLLEGE_CHOICES]

            for _, row in df.iterrows():
                first_name = str(row.get("first_name", "")).strip() or ""
                middle_initial = str(row.get("middle_initial", "")).strip() or None
                last_name = str(row.get("last_name", "")).strip() or ""
                school_id = str(row["school_id"]).strip()
                role = str(row["role"]).strip().lower()
                college = str(row.get("college", "")).strip() or self.DEFAULT_COLLEGE
                initial_password = str(row.get("initial_password", "Temp1234")).strip()

                if role not in ["student", "instructor"]:
                    return Response(
                        {"error": f"Invalid role '{role}'. Must be student or instructor."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if college not in valid_colleges:
                    college = self.DEFAULT_COLLEGE

                _, is_created = ApprovedSchoolID.objects.get_or_create(
                    school_id=school_id,
                    defaults={
                        "first_name": first_name,
                        "middle_initial": middle_initial,
                        "last_name": last_name,
                        "role": role,
                        "college": college,
                        "initial_password": initial_password,
                    }
                )

                created += 1 if is_created else 0
                existing += 0 if is_created else 1

            return Response({
                "message": "Upload complete",
                "new_records": created,
                "already_existing": existing
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
