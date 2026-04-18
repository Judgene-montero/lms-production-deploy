# courses/models.py
from django.db import models
from django.conf import settings
from users_app.models import Course  # Link to your existing Course model
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Sum

User = settings.AUTH_USER_MODEL


class GradingScheme(models.Model):
    TYPE_ZERO_BASED = "zero_based"
    TYPE_TRANSMUTED = "transmuted"
    TYPE_CUSTOM = "custom"
    GRADING_TYPE_CHOICES = [
        (TYPE_ZERO_BASED, "Zero-based"),
        (TYPE_TRANSMUTED, "Transmuted"),
        (TYPE_CUSTOM, "Custom"),
    ]

    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name="grading_scheme")
    grading_type = models.CharField(max_length=20, choices=GRADING_TYPE_CHOICES, default=TYPE_ZERO_BASED)
    passing_grade = models.FloatField(default=75)
    custom_config = models.JSONField(default=dict, blank=True)

    def validate_component_weights(self):
        if not self.pk:
            return True
        total_weight = self.components.aggregate(total=Sum("weight")).get("total") or 0.0
        if abs(float(total_weight) - 100.0) > 0.0001:
            raise ValidationError("Total grading component weight must equal 100%.")
        return True

    def __str__(self):
        return f"{self.course.title} grading scheme"


class GradingComponent(models.Model):
    scheme = models.ForeignKey(GradingScheme, on_delete=models.CASCADE, related_name="components")
    name = models.CharField(max_length=120)
    weight = models.FloatField()
    activity_ids = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        if self.weight < 0 or self.weight > 100:
            raise ValidationError({"weight": "Weight must be between 0 and 100."})
        if not isinstance(self.activity_ids, list):
            raise ValidationError({"activity_ids": "Activity IDs must be a list of integers."})
        cleaned_ids = []
        for raw_id in self.activity_ids:
            try:
                cleaned_ids.append(int(raw_id))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"activity_ids": "Activity IDs must be integers."}) from exc
        self.activity_ids = cleaned_ids

    def __str__(self):
        return f"{self.name} ({self.weight}%)"

# -----------------------------
# Lesson model
# -----------------------------
class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Lesson(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    module = models.ForeignKey("Module", null=True, blank=True, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="lessons/", blank=True, null=True)
    extracted_text = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class LessonImage(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="lesson_images/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"LessonImage(lesson={self.lesson_id}, image={self.id})"


class LessonCompletion(models.Model):
    lesson = models.ForeignKey("Lesson", on_delete=models.CASCADE, related_name="completions")
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="lesson_completions",
        limit_choices_to={"role": "student"},
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-completed_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["lesson", "student"], name="unique_lesson_completion_per_student"),
        ]

    def __str__(self):
        return f"LessonCompletion(lesson={self.lesson_id}, student={self.student_id})"

class ActivityType(models.Model):
    name = models.CharField(max_length=50)  # e.g., "Task", "Exam", "Attendance"
    weight = models.FloatField(default=0)   # contribution to final grade in percent
    requires_points = models.BooleanField(default=True)
    requires_due_date = models.BooleanField(default=False)

    def __str__(self):
        return self.name


# -----------------------------
# Activity model (attendance, tasks, events)
# -----------------------------
class CourseActivity(models.Model):
    ASSESSMENT_QUIZ = "quiz"
    ASSESSMENT_EXAM = "exam"
    ASSESSMENT_CHOICES = [
        (ASSESSMENT_QUIZ, "Quiz"),
        (ASSESSMENT_EXAM, "Exam"),
    ]
    PUBLISH_STATE_DRAFT = "draft"
    PUBLISH_STATE_PUBLISHED = "published"
    PUBLISH_STATE_CHOICES = [
        (PUBLISH_STATE_DRAFT, "Draft"),
        (PUBLISH_STATE_PUBLISHED, "Published"),
    ]
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="activities"
    )
    assigned_courses = models.ManyToManyField(
        Course,
        related_name="assigned_activities",
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    activity_type = models.ForeignKey(
    ActivityType,
    on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='activities/', blank=True, null=True)
    link = models.URLField(blank=True, null=True)

    # Only for TASK
    due_date = models.DateTimeField(blank=True, null=True)
    allow_late_submissions = models.BooleanField(default=False)

    # For TASK and ATTENDANCE
    points = models.IntegerField(default=100)

    # ADD BELOW THIS
    GRADING_CHOICES = [
        ("points", "Points"),
        ("percent", "Percentage"),
        ("passfail", "Pass/Fail"),
        ("none", "Ungraded"),
    ]

    grading_type = models.CharField(
        max_length=20,
        choices=GRADING_CHOICES,
        default="points"
    )

    # already existing
    topic = models.CharField(max_length=100, blank=True, null=True)
    question_type = models.CharField(max_length=20, blank=True, null=True)
    quiz_time_limit_seconds = models.PositiveIntegerField(default=600)
    max_attempts = models.PositiveIntegerField(default=3)
    randomize_questions = models.BooleanField(default=False)
    randomize_choices = models.BooleanField(default=False)
    random_subset_size = models.PositiveIntegerField(default=0)
    require_answer_to_advance = models.BooleanField(default=False)
    anti_cheat_enabled = models.BooleanField(default=False)
    anti_cheat_tab_switch = models.BooleanField(default=False)
    anti_cheat_multi_tab = models.BooleanField(default=False)
    anti_cheat_disable_copy_paste = models.BooleanField(default=False)
    anti_cheat_fullscreen_required = models.BooleanField(default=False)
    show_score_immediately = models.BooleanField(default=False)
    allow_answer_review = models.BooleanField(default=False)
    availability_start = models.DateTimeField(blank=True, null=True)
    availability_end = models.DateTimeField(blank=True, null=True)
    assessment_type = models.CharField(max_length=10, choices=ASSESSMENT_CHOICES, default=ASSESSMENT_QUIZ)
    publish_state = models.CharField(max_length=12, choices=PUBLISH_STATE_CHOICES, default=PUBLISH_STATE_DRAFT)
    project_group_enabled = models.BooleanField(default=False)
    classwork_metadata = models.JSONField(default=dict, blank=True)
    quiz_questions = models.JSONField(default=list, blank=True)
    quiz_sections = models.JSONField(default=list, blank=True)

    def save(self, *args, **kwargs):
        if self.activity_type:
            activity_type_name = str(getattr(self.activity_type, "name", "") or "").lower()

            # Keep due dates for assignment/project/material; clear only for attendance.
            if activity_type_name == "attendance" and not self.activity_type.requires_due_date:
                self.due_date = None

            if not self.activity_type.requires_points:
                self.points = 0

            if self.grading_type == "none":
                self.points = 0

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class ClassworkDraft(models.Model):
    instructor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="classwork_drafts",
        limit_choices_to={"role": "instructor"},
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="classwork_drafts")
    title = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    assessment_type = models.CharField(max_length=10, choices=CourseActivity.ASSESSMENT_CHOICES, default=CourseActivity.ASSESSMENT_QUIZ)
    due_date = models.DateTimeField(blank=True, null=True)
    availability_start = models.DateTimeField(blank=True, null=True)
    availability_end = models.DateTimeField(blank=True, null=True)
    points = models.IntegerField(default=100)
    quiz_time_limit_seconds = models.PositiveIntegerField(default=1800)
    max_attempts = models.PositiveIntegerField(default=1)
    randomize_questions = models.BooleanField(default=False)
    randomize_choices = models.BooleanField(default=False)
    random_subset_size = models.PositiveIntegerField(default=0)
    require_answer_to_advance = models.BooleanField(default=False)
    anti_cheat_enabled = models.BooleanField(default=False)
    anti_cheat_tab_switch = models.BooleanField(default=False)
    anti_cheat_multi_tab = models.BooleanField(default=False)
    anti_cheat_disable_copy_paste = models.BooleanField(default=False)
    anti_cheat_fullscreen_required = models.BooleanField(default=False)
    pre_exam_message = models.TextField(blank=True, default="")
    topic = models.CharField(max_length=100, blank=True, default="")
    sections = models.JSONField(default=list, blank=True)
    course_ids = models.JSONField(default=list, blank=True)
    imported_source_name = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Draft(course={self.course_id}, instructor={self.instructor_id})"
    

class ActivitySubmission(models.Model):

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("graded", "Graded"),
    ]

    activity = models.ForeignKey(
        CourseActivity,
        on_delete=models.CASCADE,
        related_name="submissions"
    )

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )

    text_answer = models.TextField(blank=True)

    link = models.URLField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft"
    )

    submitted_at = models.DateTimeField(auto_now_add=True)

    grade = models.FloatField(blank=True, null=True)
    feedback = models.TextField(blank=True)

    is_late = models.BooleanField(default=False)

    class Meta:
        unique_together = ('activity', 'student')

    def save(self, *args, **kwargs):


        # Check for late submission
        if self.status == "submitted" and self.activity.due_date:
            if timezone.now() > self.activity.due_date:
                self.is_late = True

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} → {self.activity.title}"
# -----------------------------
# Quiz Attempts
# -----------------------------
class QuizAttempt(models.Model):
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_GRADED = "graded"
    STATUS_CHOICES = [
        (STATUS_PENDING_REVIEW, "Pending review"),
        (STATUS_GRADED, "Graded"),
    ]

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
        limit_choices_to={"role": "student"},
    )
    quiz = models.ForeignKey(
        CourseActivity,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
    )
    score = models.FloatField(default=0)
    total_points = models.FloatField(default=0)
    question_snapshot = models.JSONField(default=list, blank=True)
    answers = models.JSONField(default=list, blank=True)
    result_breakdown = models.JSONField(default=list, blank=True)
    correct_answers = models.PositiveIntegerField(default=0)
    incorrect_answers = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    last_activity_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(blank=True, null=True)
    time_spent = models.PositiveIntegerField(default=0, help_text="Time spent in seconds")
    suspicious_events = models.PositiveIntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    lock_reason = models.CharField(max_length=80, blank=True, default="")
    force_submitted_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_GRADED)
    override_score = models.FloatField(blank=True, null=True)
    is_overridden = models.BooleanField(default=False)
    graded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_quiz_attempts",
    )
    graded_at = models.DateTimeField(blank=True, null=True)
    visibility_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-started_at", "-id"]

    def clean(self):
        super().clean()
        if self.is_locked and self.submitted_at is None:
            raise ValidationError({"submitted_at": "Locked attempt must have submitted_at."})

    def __str__(self):
        return f"QuizAttempt(student={self.student_id}, quiz={self.quiz_id}, score={self.score})"


class QuizAttemptAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answer_records")
    question_id = models.CharField(max_length=100)
    question_text = models.TextField(blank=True, default="")
    question_type = models.CharField(max_length=40, blank=True, default="")
    student_answer = models.TextField(blank=True, default="")
    max_points = models.FloatField(default=0)
    auto_score = models.FloatField(blank=True, null=True)
    manual_score = models.FloatField(blank=True, null=True)
    override_score = models.FloatField(blank=True, null=True)
    feedback = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=QuizAttempt.STATUS_CHOICES, default=QuizAttempt.STATUS_GRADED)

    class Meta:
        ordering = ["id"]
        unique_together = ("attempt", "question_id")

    def __str__(self):
        return f"QuizAttemptAnswer(attempt={self.attempt_id}, question={self.question_id})"


class QuizAttemptScoreAudit(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="score_audits")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quiz_attempt_score_audits",
    )
    question_id = models.CharField(max_length=100, blank=True, default="")
    previous_score = models.FloatField(blank=True, null=True)
    new_score = models.FloatField(blank=True, null=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"QuizAttemptScoreAudit(attempt={self.attempt_id}, question={self.question_id or 'total'})"


class QuestionBankItem(models.Model):
    DIFFICULTY_EASY = "easy"
    DIFFICULTY_MEDIUM = "medium"
    DIFFICULTY_HARD = "hard"
    DIFFICULTY_CHOICES = [
        (DIFFICULTY_EASY, "Easy"),
        (DIFFICULTY_MEDIUM, "Medium"),
        (DIFFICULTY_HARD, "Hard"),
    ]

    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="question_bank_items", limit_choices_to={"role": "instructor"})
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="question_bank_items", null=True, blank=True)
    topic = models.CharField(max_length=120, blank=True, default="")
    difficulty = models.CharField(max_length=12, choices=DIFFICULTY_CHOICES, default=DIFFICULTY_MEDIUM)
    question_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"QuestionBankItem({self.instructor_id}, {self.topic or 'untagged'})"


class QuizSecurityEvent(models.Model):
    EVENT_TAB_SWITCH = "tab_switch"
    EVENT_MULTI_TAB = "multiple_tab"
    EVENT_COPY = "copy_attempt"
    EVENT_PASTE = "paste_attempt"
    EVENT_FULLSCREEN_EXIT = "fullscreen_exit"
    EVENT_CHOICES = [
        (EVENT_TAB_SWITCH, "Tab Switch"),
        (EVENT_MULTI_TAB, "Multiple Tab"),
        (EVENT_COPY, "Copy Attempt"),
        (EVENT_PASTE, "Paste Attempt"),
        (EVENT_FULLSCREEN_EXIT, "Fullscreen Exit"),
    ]

    quiz = models.ForeignKey(CourseActivity, on_delete=models.CASCADE, related_name="security_events")
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="security_events", null=True, blank=True)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quiz_security_events", limit_choices_to={"role": "student"})
    event_type = models.CharField(max_length=40, choices=EVENT_CHOICES)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"QuizSecurityEvent(quiz={self.quiz_id}, student={self.student_id}, event={self.event_type})"


class QuizAttemptAcknowledgement(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="acknowledgements")
    quiz = models.ForeignKey(CourseActivity, on_delete=models.CASCADE, related_name="attempt_acknowledgements")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quiz_acknowledgements", limit_choices_to={"role": "student"})
    ack_timestamp = models.DateTimeField(default=timezone.now)
    ack_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-ack_timestamp", "-id"]
        unique_together = ("attempt", "student")

    def __str__(self):
        return f"QuizAttemptAcknowledgement(attempt={self.attempt_id}, student={self.student_id})"


# -----------------------------
# Comments / Home Feed inside a course
# -----------------------------
class CourseComment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} on {self.course.title}"


# -----------------------------
# Instructor Feedback (student evaluates instructor)
# -----------------------------
class InstructorFeedback(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="feedbacks")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'student'})
    rating = models.IntegerField(default=0)  # 1-5 stars
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} → {self.course.instructor} ({self.rating}/5)"


class ActivityComment(models.Model):
    activity = models.ForeignKey(CourseActivity, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    attachment = models.FileField(upload_to='activity_comments/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} → {self.activity.title}"
class SubmissionAttachment(models.Model):
    submission = models.ForeignKey(ActivitySubmission, on_delete=models.CASCADE, null=True, blank=True, related_name="attachments")
    announcement = models.ForeignKey(CourseActivity, on_delete=models.CASCADE, null=True, blank=True, related_name="attachments")
    file = models.FileField(upload_to="attachments/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class AttendanceSession(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="attendance_sessions")
    date = models.DateField()
    topic = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_attendance_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.course.title} - {self.date} - {self.topic}"


class AttendanceRecord(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_LATE = "late"
    STATUS_EXCUSED = "excused"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_ABSENT, "Absent"),
        (STATUS_LATE, "Late"),
        (STATUS_EXCUSED, "Excused"),
    ]

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="records")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"})
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    marked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendance_records",
    )
    marked_at = models.DateTimeField(auto_now=True)
    points_earned = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        unique_together = ("session", "student")
        ordering = ["student__username"]

    def __str__(self):
        return f"{self.session_id} - {self.student_id} - {self.status}"


class GradingComponentScore(models.Model):
    component = models.ForeignKey(GradingComponent, on_delete=models.CASCADE, related_name="student_scores")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"})
    raw_score = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("component", "student")
        ordering = ["component_id", "student_id"]

    def __str__(self):
        return f"ComponentScore(component={self.component_id}, student={self.student_id}, score={self.raw_score})"
