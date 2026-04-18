# models.py/user models for the users_app
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
import string
import secrets


class CustomUserManager(UserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        role = extra_fields.get("role")
        if role == "admin":
            extra_fields.setdefault("is_staff", True)
            extra_fields.setdefault("is_active", True)
            extra_fields.setdefault("is_email_verified", True)
        return super().create_user(username, email=email, password=password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_email_verified", True)
        return super().create_superuser(username, email=email, password=password, **extra_fields)


# Custom User model
class User(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'Instructor'),
        ('admin', 'Admin'),
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

class Course(models.Model):
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    thumbnail = models.ImageField(upload_to="course_thumbnails/", blank=True, null=True)

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

    def save(self, *args, **kwargs):
        if not self.join_code:
            code = generate_join_code()
            while Course.objects.filter(join_code=code).exists():
                code = generate_join_code()
            self.join_code = code
        super().save(*args, **kwargs)

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
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

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

    require_email_verification = models.BooleanField(default=True)
    allow_instructor_self_registration = models.BooleanField(default=True)
    allow_username_change = models.BooleanField(default=True)
    default_user_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
    analytics_polling_interval = models.PositiveIntegerField(default=10)
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
