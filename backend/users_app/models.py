# models.py/user models for the users_app
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.utils import timezone
from datetime import datetime
import string
import secrets


class CustomUserManager(UserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        role = extra_fields.get("role")
        if role == "admin":
            extra_fields.setdefault("is_staff", True)
            extra_fields.setdefault("is_active", True)
            extra_fields.setdefault("is_email_verified", True)
            extra_fields.setdefault("approval_status", "not_required")
        elif role == "instructor":
            extra_fields.setdefault(
                "approval_status",
                "approved" if extra_fields.get("is_active", True) else "pending",
            )
        else:
            extra_fields.setdefault("approval_status", "not_required")
        return super().create_user(username, email=email, password=password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_email_verified", True)
        extra_fields.setdefault("approval_status", "not_required")
        return super().create_superuser(username, email=email, password=password, **extra_fields)


# Custom User model
class User(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'Instructor'),
        ('admin', 'Admin'),
    ]
    APPROVAL_STATUS_CHOICES = [
        ("not_required", "Not Required"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    
    COLLEGE_CHOICES = [
        ('CAS', 'College of Arts & Sciences'),
        ('CCJE', 'College of Criminal Justice Education'),
        ('CAF', 'College of Agriculture & Forestry'),
        ('CTED', 'College of Teacher Education'),
        ('CBA', 'College of Business Administration'),
        ('CIT', 'College of INDUSTRIAL TECHNOLOGY'),    
    ]

    school_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default="not_required",
    )
    college = models.CharField(max_length=10, choices=COLLEGE_CHOICES, null=True, blank=True)
    is_verified_school_user = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    profile_complete = models.BooleanField(default=False)
    middle_initial = models.CharField(max_length=1, null=True, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    bio = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    department = models.CharField(max_length=120, blank=True, default="")
    notify_assignment_submission = models.BooleanField(default=True)
    notify_quiz_completed = models.BooleanField(default=True)
    notify_student_join_course = models.BooleanField(default=True)
    notify_instructor_announcement = models.BooleanField(default=True)
    notify_assignment_graded = models.BooleanField(default=True)
    notify_quiz_released = models.BooleanField(default=True)
    notify_due_date_approaching = models.BooleanField(default=True)

    objects = CustomUserManager()

    def full_name(self):
        mi = f"{self.middle_initial}." if self.middle_initial else ""
        return f"{self.last_name}, {self.first_name} {mi}".strip()

    def __str__(self):
        return f"{self.full_name()} ({self.role})"


# Approved School ID model
class ApprovedSchoolID(models.Model):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'Instructor'),
    ]

    COLLEGE_CHOICES = [
        ('CAS', 'College of Arts & Sciences'),
        ('CCJE', 'College of Criminal Justice Education'),
        ('CAF', 'College of Agriculture & Forestry'),
        ('CTED', 'College of Teacher Education'),
        ('CBA', 'College of Business Administration'),
        ('CIT', 'College of INDUSTRIAL TECHNOLOGY'),
    ]

    school_id = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    college = models.CharField(max_length=10, choices=COLLEGE_CHOICES, null=True, blank=True)

    first_name = models.CharField(max_length=100, null=True, blank=True)
    middle_initial = models.CharField(max_length=1, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)

    initial_password = models.CharField(max_length=255, null=True, blank=True)  # hashed or temporary text

    def full_name(self):
        mi = f"{self.middle_initial}." if self.middle_initial else ""
        return f"{self.last_name}, {self.first_name} {mi}".strip()

    def __str__(self):
        return f"{self.full_name()} ({self.school_id})"
    
def generate_join_code(length=7):
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))


def current_local_date():
    return timezone.localdate()


def current_local_time():
    return timezone.localtime().time().replace(microsecond=0)


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class Course(models.Model):
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses", null=True, blank=True)
    thumbnail = models.ImageField(upload_to="course_thumbnails/", blank=True, null=True)
    start_date = models.DateField(default=current_local_date)
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(default=current_local_time)

    students = models.ManyToManyField(
        User,
        related_name="enrolled_courses",
        blank=True,
        limit_choices_to={'role': 'student'}
    )

    assignments_count = models.PositiveIntegerField(default=0)
    is_archived = models.BooleanField(default=False)

    join_code = models.CharField(max_length=10, unique=True, blank=True)
    join_code_enabled = models.BooleanField(default=True)
    join_code_expiration = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.start_date:
            self.start_date = current_local_date()
        if not self.start_time:
            self.start_time = current_local_time()
        if not self.join_code:
            code = generate_join_code()
            while Course.objects.filter(join_code=code).exists():
                code = generate_join_code()
            self.join_code = code
        super().save(*args, **kwargs)

    def get_start_datetime(self):
        combined = datetime.combine(self.start_date, self.start_time)
        return timezone.make_aware(combined, timezone.get_current_timezone())

    def get_status(self, reference_time=None):
        if self.is_archived:
            return "archived"

        reference_time = reference_time or timezone.now()
        return "scheduled" if self.get_start_datetime() > reference_time else "active"

    def students_count(self):
        return self.students.count()

    def __str__(self):
        return self.title


class Submission(models.Model):
    
    STATUS_CHOICES = (
        ("submitted", "Submitted"),
        ("graded", "Graded"),
        ("late", "Late"),
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="submissions")
    student_name = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="submitted")
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student_name} - {self.course.title}"


class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_notifications",
    )
    course = models.ForeignKey(
        "users_app.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    activity = models.ForeignKey(
        "courses.CourseActivity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    submission = models.ForeignKey(
        "courses.ActivitySubmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    event_key = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=160, blank=True, default="")
    message = models.CharField(max_length=300)
    notification_type = models.CharField(max_length=50, default="general")
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["recipient", "event_key"], name="unique_recipient_event_key"),
        ]

    def __str__(self):
        return f"{self.message[:40]}"


class StudentNotificationRead(models.Model):
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="read_notifications",
        limit_choices_to={"role": "student"},
    )
    notification_key = models.CharField(max_length=255)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-read_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["student", "notification_key"], name="unique_student_notification_read"),
        ]

    def __str__(self):
        return f"{self.student_id}:{self.notification_key}"


class SiteSettings(models.Model):
    ROLE_CHOICES = [
        ("student", "Student"),
        ("instructor", "Instructor"),
    ]

    require_email_verification = models.BooleanField(default=False)
    allow_instructor_self_registration = models.BooleanField(default=True)
    allow_username_change = models.BooleanField(default=True)
    default_user_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
    analytics_polling_interval = models.PositiveIntegerField(default=10)
    analytics_low_risk_max = models.FloatField(default=0.30)
    analytics_medium_risk_max = models.FloatField(default=0.60)
    analytics_high_risk_min = models.FloatField(default=0.60)
    analytics_passing_grade = models.FloatField(default=75.0)
    max_login_attempts = models.PositiveIntegerField(default=5)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Site Settings"


class AdminLog(models.Model):
    action = models.CharField(max_length=120)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="performed_admin_logs"
    )
    target_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="targeted_admin_logs"
    )
    description = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} @ {self.timestamp}"
