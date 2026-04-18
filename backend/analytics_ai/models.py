# analytics_ai/models.py
from django.db import models
from django.conf import settings


class StudentPerformanceProfile(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    course = models.ForeignKey(
        'users_app.Course',
        on_delete=models.CASCADE
    )

    average_score = models.FloatField(default=0)
    late_submission_rate = models.FloatField(default=0)
    missing_submission_rate = models.FloatField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "course"], name="uq_perf_student_course")
        ]
        indexes = [
            models.Index(fields=["course", "student"], name="idx_perf_course_student"),
            models.Index(fields=["updated_at"], name="idx_perf_updated_at"),
        ]

    def __str__(self):
        return f"Performance({self.student_id}, {self.course_id})"


class StudentRiskPrediction(models.Model):
    RISK_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    course = models.ForeignKey(
        'users_app.Course',
        on_delete=models.CASCADE
    )

    risk_score = models.FloatField()
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "course"], name="uq_risk_student_course")
        ]
        indexes = [
            models.Index(fields=["course", "risk_level"], name="idx_risk_course_level"),
            models.Index(fields=["course", "risk_score"], name="idx_risk_course_score"),
            models.Index(fields=["updated_at"], name="idx_risk_updated_at"),
        ]

    def __str__(self):
        return f"Risk({self.student_id}, {self.course_id})={self.risk_level}:{self.risk_score:.2f}"


class StudentAnalytics(models.Model):
    RISK_LEVELS = [
        ("low", "Low Risk"),
        ("medium", "Medium Risk"),
        ("high", "High Risk"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_analytics",
    )
    course = models.ForeignKey(
        "users_app.Course",
        on_delete=models.CASCADE,
        related_name="student_analytics",
    )
    average_grade = models.FloatField(default=0.0)
    late_rate = models.FloatField(default=0.0)
    missing_rate = models.FloatField(default=0.0)
    engagement_score = models.FloatField(default=0.0)
    total_submissions = models.IntegerField(default=0)
    grade_trend = models.FloatField(default=0.0)
    risk_score = models.FloatField(default=0.0)
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, default="low")
    probability_student_fails = models.FloatField(null=True, blank=True)
    prediction_source = models.CharField(max_length=20, default="rule")
    risk_explanation = models.TextField(blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "course"], name="uq_student_analytics"),
        ]
        indexes = [
            models.Index(fields=["course", "risk_level"], name="idx_stu_an_course_level"),
            models.Index(fields=["course", "risk_score"], name="idx_stu_an_course_score"),
            models.Index(fields=["last_updated"], name="idx_stu_an_updated"),
        ]

    def __str__(self):
        return f"StudentAnalytics({self.student_id}, {self.course_id})={self.risk_level}:{self.risk_score:.2f}"


class CourseAnalytics(models.Model):
    course = models.OneToOneField(
        "users_app.Course",
        on_delete=models.CASCADE,
        related_name="course_analytics",
    )
    total_students = models.PositiveIntegerField(default=0)
    average_grade = models.FloatField(default=0.0)
    average_engagement = models.FloatField(default=0.0)
    high_risk_students = models.PositiveIntegerField(default=0)
    medium_risk_students = models.PositiveIntegerField(default=0)
    low_risk_students = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["last_updated"], name="idx_course_an_updated"),
            models.Index(fields=["high_risk_students"], name="idx_course_an_high"),
        ]

    def __str__(self):
        return f"CourseAnalytics({self.course_id})"
