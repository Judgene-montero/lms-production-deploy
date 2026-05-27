# courses_app/serializers.py
from rest_framework import serializers
import json
import math
import mimetypes
import re
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from datetime import datetime
from .models import (
    ActivityComment,
    ActivityType,
    Lesson,
    LessonCompletion,
    LessonImage,
    Module,
    GradingScheme,
    GradingComponent,
    CourseActivity,
    CourseComment,
    InstructorFeedback,
    ActivitySubmission,
    SubmissionAttachment,
    AttendanceSession,
    AttendanceRecord,
    Meeting,
    QuizAttempt,
    QuizAttemptAnswer,
    QuizAttemptScoreAudit,
    ClassworkDraft,
    QuestionBankItem,
    QuizSecurityEvent,
    EnrollmentRequest,
)
from .services.grading import ACTIVITY_CATEGORY_LABELS, evaluate_custom_formula, validate_custom_transmutation_table
from users_app.models import Category, Course

# -----------------------------
# Course Serializer
# -----------------------------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]
        read_only_fields = ["id"]


class CourseSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source="category",
        write_only=True,
        required=False,
    )
    thumbnail = serializers.ImageField(required=False, allow_null=True, use_url=True)
    is_instructor = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    lessons_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    code = serializers.SerializerMethodField()
    scheduled_start_at = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    instructor_info = serializers.SerializerMethodField()
    join_code = serializers.CharField(read_only=True)
    join_code_enabled = serializers.BooleanField(read_only=True)
    join_code_expiration = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'description',
            'category',
            'category_id',
            'thumbnail',
            'start_date',
            'end_date',
            'start_time',
            'scheduled_start_at',
            'instructor',
            'instructor_name',
            'instructor_info',
            'is_instructor',
            'students_count',
            'lessons_count',
            'is_archived',
            'status',
            'state',
            'code',
            'join_code',
            'join_code_enabled',
            'join_code_expiration',
        ]
        read_only_fields = ['id', 'instructor']

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        if mutable_data.get("category_id") in (None, "") and mutable_data.get("category") not in (None, ""):
            raw_category = mutable_data.get("category")
            if str(raw_category).isdigit():
                mutable_data["category_id"] = raw_category
        return super().to_internal_value(mutable_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if instance.thumbnail:
            try:
                thumbnail_url = instance.thumbnail.url
            except (AttributeError, ValueError):
                thumbnail_url = None
            if thumbnail_url:
                data["thumbnail"] = request.build_absolute_uri(thumbnail_url) if request else thumbnail_url
        else:
            data["thumbnail"] = None
        return data

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        category = attrs.get("category", getattr(instance, "category", None))
        if instance is None and category is None:
            raise serializers.ValidationError({"category_id": "Category is required."})

        has_start_date = "start_date" in attrs
        has_start_time = "start_time" in attrs
        if has_start_date != has_start_time:
            raise serializers.ValidationError("start_date and start_time must be provided together.")

        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than the start date."})
        return attrs

    def get_is_instructor(self, obj):
        request = self.context.get("request")
        if request and request.user:
            return obj.instructor == request.user
        return False

    def get_students_count(self, obj):
        annotated = getattr(obj, "students_count", None)
        if annotated is not None:
            if callable(annotated):
                annotated = annotated()
            return int(annotated)
        return obj.students.count()

    def get_lessons_count(self, obj):
        annotated = getattr(obj, "lessons_count", None)
        if annotated is not None:
            if callable(annotated):
                annotated = annotated()
            return int(annotated)
        return obj.lessons.count()

    def get_status(self, obj):
        return obj.get_status()

    def get_state(self, obj):
        return self.get_status(obj)

    def get_code(self, obj):
        return obj.join_code

    def get_scheduled_start_at(self, obj):
        return obj.get_start_datetime()

    def _build_instructor_name(self, instructor):
        if not instructor:
            return "Instructor unavailable"
        full_name_method = getattr(instructor, "full_name", None)
        if callable(full_name_method):
            full_name = str(full_name_method() or "").strip()
            if full_name:
                return full_name
        first_name = str(getattr(instructor, "first_name", "") or "").strip()
        last_name = str(getattr(instructor, "last_name", "") or "").strip()
        combined = " ".join(part for part in [first_name, last_name] if part).strip()
        if combined:
            return combined
        username = str(getattr(instructor, "username", "") or "").strip()
        if username:
            return username
        email = str(getattr(instructor, "email", "") or "").strip()
        if email:
            return email
        return "Instructor unavailable"

    def get_instructor_name(self, obj):
        return self._build_instructor_name(getattr(obj, "instructor", None))

    def get_instructor_info(self, obj):
        instructor = getattr(obj, "instructor", None)
        if not instructor:
            return None
        return {
            "id": instructor.id,
            "name": self._build_instructor_name(instructor),
            "email": str(getattr(instructor, "email", "") or "").strip(),
        }
# -----------------------------
# Lesson Serializer
# -----------------------------
class LessonSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    module_id = serializers.IntegerField(source="module.id", read_only=True)
    is_completed = serializers.SerializerMethodField()
    completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "course",
            "module",
            "module_id",
            "title",
            "content",
            "description",
            "file",
            "file_url",
            "extracted_text",
            "uploaded_at",
            "images",
            "is_completed",
            "completed",
            "order",
            "created_at",
        ]
        read_only_fields = ["id", "module_id", "created_at", "uploaded_at", "file_url", "images"]

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        try:
            url = obj.file.url
        except (ValueError, AttributeError):
            return None
        return request.build_absolute_uri(url) if request else url

    def get_images(self, obj):
        request = self.context.get("request")
        payload = []
        for image in obj.images.all():
            if not image.image:
                continue
            try:
                url = image.image.url
            except (ValueError, AttributeError):
                continue
            payload.append(
                {
                    "id": image.id,
                    "url": request.build_absolute_uri(url) if request else url,
                }
            )
        return payload

    def get_is_completed(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False) or getattr(user, "role", "") != "student":
            return False

        completed_map = self.context.get("lesson_completion_map")
        if isinstance(completed_map, dict):
            return bool(completed_map.get(obj.id, False))

        return LessonCompletion.objects.filter(lesson=obj, student=user).exists()

    def get_completed(self, obj):
        return self.get_is_completed(obj)


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["id", "course", "title", "description", "order", "created_at", "lessons"]
        read_only_fields = ["id", "course", "created_at", "lessons"]

class SubmissionAttachmentSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    mime_type = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionAttachment
        fields = ['id', 'file', 'file_url', 'name', 'file_size', 'mime_type', 'uploaded_at']

    def get_file(self, obj):
        if not obj.file:
            return None

        request = self.context.get("request")

        try:
            url = obj.file.url
        except (AttributeError, ValueError):
            return None

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_name(self, obj):
        if not obj.file:
            return ""
        try:
            return obj.file.name.split("/")[-1]
        except Exception:
            return ""

    def get_file_url(self, obj):
        return self.get_file(obj)

    def get_file_size(self, obj):
        if not obj.file:
            return None
        try:
            return int(obj.file.size)
        except Exception:
            return None

    def get_mime_type(self, obj):
        file_name = self.get_name(obj)
        if not file_name:
            return ""
        return mimetypes.guess_type(file_name)[0] or ""


class ActivitySubmissionSerializer(serializers.ModelSerializer):
    student = serializers.HiddenField(default=serializers.CurrentUserDefault())
    attachments = SubmissionAttachmentSerializer(many=True, read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    text_answer = serializers.CharField(allow_blank=True, required=False)
    # REMOVE files field — we will handle in create
    # files = serializers.ListField(...)  # ❌ remove

    class Meta:
        model = ActivitySubmission
        fields = [
            'id', 'activity', 'student', 'student_username',
            'text_answer', 'attachments', 'link', 'status',
            'submitted_at', 'grade', 'feedback', 'is_late'
        ]
        read_only_fields = ['id', 'student_username', 'attachments', 'submitted_at', 'is_late']

    def create(self, validated_data, files=None):
        submission = ActivitySubmission.objects.create(**validated_data)

        # Save files if provided
        files = files or []
        for f in files:
            SubmissionAttachment.objects.create(submission=submission, file=f)

        return submission


class QuizOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    text = serializers.CharField()


class QuizQuestionSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    question_text = serializers.CharField()
    type = serializers.ChoiceField(
        choices=[
            "multiple_choice",
            "true_false",
            "short_answer",
            "identification",
            "essay",
            "coding",
            "file_upload",
            "matching",
            "enumeration",
        ]
    )
    options = QuizOptionSerializer(many=True, required=False)
    points = serializers.FloatField(required=False, default=1)


class QuizAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.username", read_only=True)
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    acknowledged_at = serializers.SerializerMethodField()
    graded_by_name = serializers.CharField(source="graded_by.username", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "student",
            "student_name",
            "quiz",
            "quiz_title",
            "score",
            "total_points",
            "status",
            "override_score",
            "is_overridden",
            "answers",
            "result_breakdown",
            "correct_answers",
            "incorrect_answers",
            "started_at",
            "submitted_at",
            "graded_at",
            "graded_by",
            "graded_by_name",
            "time_spent",
            "suspicious_events",
            "is_locked",
            "lock_reason",
            "force_submitted_at",
            "visibility_snapshot",
            "acknowledged_at",
        ]
        read_only_fields = [
            "id",
            "student_name",
            "quiz_title",
            "score",
            "total_points",
            "status",
            "override_score",
            "is_overridden",
            "result_breakdown",
            "correct_answers",
            "incorrect_answers",
            "submitted_at",
            "graded_at",
            "graded_by",
            "graded_by_name",
            "time_spent",
            "suspicious_events",
            "is_locked",
            "lock_reason",
            "force_submitted_at",
            "visibility_snapshot",
            "acknowledged_at",
        ]

    def get_acknowledged_at(self, obj):
        ack = obj.acknowledgements.order_by("-ack_timestamp").first()
        return ack.ack_timestamp if ack else None
# -----------------------------
# Activity Serializer
# -----------------------------
class CourseActivitySerializer(serializers.ModelSerializer):
    POINTS_VALIDATION_MESSAGE = "Points must be a finite number between 0 and 1000."
    # Writable for uploads, represented as URL
    file = serializers.FileField(required=False, allow_null=True, use_url=True)
    link = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    attachments = serializers.SerializerMethodField()

    # Activity type name
    activity_type_name = serializers.CharField(source='activity_type.name', read_only=True)

    # Student's own submission
    submission = serializers.SerializerMethodField()

    # Instructor sees all submissions
    submissions = serializers.SerializerMethodField()
    quiz_attempts = serializers.SerializerMethodField()
    questions = serializers.JSONField(write_only=True, required=False)
    sections = serializers.JSONField(write_only=True, required=False)
    course_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    assigned_courses = serializers.SerializerMethodField()
    course_title = serializers.CharField(source="course.title", read_only=True)
    classwork_metadata = serializers.JSONField(required=False)
    question_count = serializers.SerializerMethodField()
    total_points_value = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()
    needs_manual_review = serializers.SerializerMethodField()
    pending_review_count = serializers.SerializerMethodField()
    submission_deadline = serializers.SerializerMethodField()
    allow_late_submission = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    can_submit = serializers.SerializerMethodField()
    submission_locked_reason = serializers.SerializerMethodField()

    # Join code fields
    join_code = serializers.CharField(read_only=True)
    join_code_enabled = serializers.BooleanField(read_only=True)
    join_code_expiration = serializers.DateTimeField(read_only=True)

    class Meta:
        model = CourseActivity
        fields = [
            'id',
            'course',
            "course_title",
            'title',
            'description',
            'activity_type',
            'activity_type_name',
            'created_at',
            'due_date',
            'allow_late_submissions',
            'allow_late_submission',
            'points',
            'file',               # instructor file
            'link',
            'attachments',   # ADD THIS
            'submission',         # student's own submission
            'submissions',        # all student submissions
            "quiz_attempts",
            "topic",
            "question_type",
            "quiz_time_limit_seconds",
            "max_attempts",
            "randomize_questions",
            "randomize_choices",
            "random_subset_size",
            "require_answer_to_advance",
            "anti_cheat_enabled",
            "anti_cheat_tab_switch",
            "anti_cheat_multi_tab",
            "anti_cheat_disable_copy_paste",
            "anti_cheat_fullscreen_required",
            "show_score_immediately",
            "allow_answer_review",
            "availability_start",
            "availability_end",
            "assessment_type",
            "publish_state",
            "project_group_enabled",
            "classwork_metadata",
            "question_count",
            "total_points_value",
            "attempts_count",
            "needs_manual_review",
            "pending_review_count",
            "submission_deadline",
            "is_overdue",
            "can_submit",
            "submission_locked_reason",
            "questions",
            "sections",
            "course_ids",
            "assigned_courses",
            "grading_type",
            "join_code",
            "join_code_enabled",
            "join_code_expiration",
        ]
        read_only_fields = ['id', 'created_at']

    # ------------------- Methods -------------------
    def _absolute_url(self, url):
        request = self.context.get("request")
        if request and url:
            return request.build_absolute_uri(url)
        return url

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Normalize to absolute URL for frontend consistency.
        if instance.file:
            try:
                data["file"] = self._absolute_url(instance.file.url)
            except (ValueError, AttributeError):
                data["file"] = None

        data["questions"] = self._public_questions(instance.quiz_questions)
        data["sections"] = self._public_sections(instance.quiz_sections)
        data["course_ids"] = [instance.course_id, *list(instance.assigned_courses.values_list("id", flat=True))]

        return data

    def _normalize_single_question(self, item, index_label):
        if not isinstance(item, dict):
            raise serializers.ValidationError(f"Question {index_label} must be an object.")

        question_type = str(item.get("type") or item.get("question_type") or "multiple_choice").strip().lower()
        question_type_aliases = {
            "mcq": "multiple_choice",
            "multiple choice": "multiple_choice",
            "truefalse": "true_false",
            "tf": "true_false",
            "short": "short_answer",
            "short answer": "short_answer",
            "identification": "identification",
            "matching_type": "matching",
        }
        question_type = question_type_aliases.get(question_type, question_type)
        allowed_types = {
            "multiple_choice",
            "true_false",
            "short_answer",
            "identification",
            "essay",
            "coding",
            "file_upload",
            "matching",
            "enumeration",
        }
        if question_type not in allowed_types:
            raise serializers.ValidationError(f"Question {index_label} has invalid type.")

        question_text = (item.get("question_text") or item.get("text") or "").strip()
        if not question_text:
            raise serializers.ValidationError(f"Question {index_label} text is required.")

        points = self._coerce_points_or_raise(item.get("points", 1))

        raw_choices = item.get("options", item.get("choices", [])) or []
        normalized_options = []
        for option_index, option in enumerate(raw_choices):
            if isinstance(option, str):
                option_text = option.strip()
                option_id = option_index + 1
                is_correct = False
            elif isinstance(option, dict):
                option_text = str(option.get("text", "")).strip()
                option_id = option.get("id", option_index + 1)
                is_correct = bool(option.get("is_correct", False))
            else:
                raise serializers.ValidationError(f"Question {index_label} option format is invalid.")
            if not option_text:
                continue
            normalized_options.append({"id": option_id, "text": option_text, "is_correct": is_correct})

        correct_answer = str(item.get("correct_answer", item.get("answer", "")) or "").strip()
        correct_answer_index = item.get("correct_answer_index", -1)
        try:
            correct_answer_index = int(correct_answer_index)
        except (TypeError, ValueError):
            correct_answer_index = -1
        if question_type == "multiple_choice":
            if len(normalized_options) < 2:
                raise serializers.ValidationError(f"Question {index_label} requires at least two options.")
            if not correct_answer:
                marked = next((opt for opt in normalized_options if opt.get("is_correct")), None)
                correct_answer = marked["text"] if marked else ""
            if not correct_answer and 0 <= correct_answer_index < len(normalized_options):
                correct_answer = normalized_options[correct_answer_index]["text"]
            letter_match = re.match(r"^([A-Ha-h])(?:[\)\.\-:]|$)", correct_answer)
            if letter_match:
                idx = ord(letter_match.group(1).upper()) - ord("A")
                if 0 <= idx < len(normalized_options):
                    correct_answer_index = idx
                    correct_answer = normalized_options[idx]["text"]
            else:
                idx = next(
                    (i for i, option in enumerate(normalized_options) if str(option.get("text", "")).strip().lower() == correct_answer.strip().lower()),
                    -1,
                )
                if idx >= 0:
                    correct_answer_index = idx
            if not correct_answer:
                raise serializers.ValidationError(f"Question {index_label} requires a correct_answer.")
        elif question_type == "true_false":
            normalized_options = [{"id": 1, "text": "True"}, {"id": 2, "text": "False"}]
            if correct_answer.lower() not in {"true", "false"}:
                raise serializers.ValidationError(f"Question {index_label} requires True or False answer.")
            correct_answer = "true" if correct_answer.lower() == "true" else "false"
            correct_answer_index = 0 if correct_answer == "true" else 1
        elif question_type in {"short_answer", "identification", "enumeration"}:
            if question_type == "identification" and not correct_answer:
                accepted = item.get("accepted_answers")
                if isinstance(accepted, list):
                    accepted_values = [str(value).strip() for value in accepted if str(value).strip()]
                    if accepted_values:
                        correct_answer = accepted_values[0]
            if question_type == "enumeration" and not correct_answer:
                enum_items = item.get("enumeration_items")
                if isinstance(enum_items, list) and enum_items:
                    enum_values = [str((value or {}).get("answer") or (value or {}).get("text") or "").strip() for value in enum_items if isinstance(value, dict)]
                    enum_values = [value for value in enum_values if value]
                    if enum_values:
                        correct_answer = ", ".join(enum_values)
                if not correct_answer:
                    enum_answers = item.get("enumeration_answers")
                    if isinstance(enum_answers, list):
                        enum_values = [str(value).strip() for value in enum_answers if str(value).strip()]
                        if enum_values:
                            correct_answer = ", ".join(enum_values)
            if not correct_answer:
                if question_type in {"short_answer", "identification"}:
                    raise serializers.ValidationError(f"Question {index_label} requires a correct_answer.")
            normalized_options = []
        elif question_type == "matching":
            if len(normalized_options) < 2 and isinstance(item.get("matching_pairs"), list):
                pair_options = []
                for pair_index, pair in enumerate(item.get("matching_pairs") or []):
                    if not isinstance(pair, dict):
                        continue
                    left = str(pair.get("left", "")).strip()
                    right = str(pair.get("right", "")).strip()
                    if left and right:
                        pair_options.append({"id": pair_index + 1, "text": f"{left}:{right}", "is_correct": False})
                if pair_options:
                    normalized_options = pair_options
                if not correct_answer and pair_options:
                    correct_answer = ",".join(option["text"] for option in pair_options)
            if len(normalized_options) < 2:
                raise serializers.ValidationError(f"Question {index_label} requires at least two matching pairs/options.")
        else:
            normalized_options = []

        return {
            "id": item.get("id"),
            "question_text": question_text,
            "type": question_type,
            "options": normalized_options,
            "correct_answer": correct_answer,
            "correct_answer_index": correct_answer_index,
            "points": points,
            "instructions": str(item.get("instructions", "") or "").strip(),
            "starter_code": str(item.get("starter_code", "") or "").strip(),
            "language": str(item.get("language", "") or "").strip(),
            "expected_output": str(item.get("expected_output", "") or "").strip(),
            "test_cases": str(item.get("test_cases", "") or "").strip(),
            "allowed_file_types": str(item.get("allowed_file_types", "") or "").strip(),
            "max_file_size": str(item.get("max_file_size", "") or "").strip(),
            "matching_pairs": item.get("matching_pairs", []),
            "enumeration_answers": item.get("enumeration_answers", []),
            "enumeration_items": item.get("enumeration_items", []),
            "enumeration_scoring_mode": item.get("enumeration_scoring_mode", "partial"),
            "enumeration_points_mode": item.get("enumeration_points_mode", "equal"),
            "expected_count": item.get("expected_count", 0),
            "accepted_answers": item.get("accepted_answers", []),
            "formula_input": str(item.get("formula_input", "") or "").strip(),
            "correct_formula": str(item.get("correct_formula", "") or "").strip(),
        }

    def _coerce_points_or_raise(self, raw_points):
        try:
            points = float(raw_points)
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError(self.POINTS_VALIDATION_MESSAGE) from exc
        if not math.isfinite(points) or points < 0 or points > 1000:
            raise serializers.ValidationError(self.POINTS_VALIDATION_MESSAGE)
        return points

    def _normalize_questions(self, value):
        if value in (None, ""):
            return []
        raw_value = value
        if isinstance(raw_value, str):
            try:
                raw_value = json.loads(raw_value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("questions must be valid JSON.") from exc
        if not isinstance(raw_value, list):
            raise serializers.ValidationError("questions must be a list.")
        normalized = []
        for index, item in enumerate(raw_value):
            question = self._normalize_single_question(item, index + 1)
            question["id"] = question.get("id") or index + 1
            normalized.append(question)
        return normalized

    def _normalize_sections(self, value):
        if value in (None, ""):
            return []
        raw_value = value
        if isinstance(raw_value, str):
            try:
                raw_value = json.loads(raw_value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("sections must be valid JSON.") from exc
        if not isinstance(raw_value, list):
            raise serializers.ValidationError("sections must be a list.")
        normalized_sections = []
        for section_index, section in enumerate(raw_value):
            if not isinstance(section, dict):
                raise serializers.ValidationError(f"Section {section_index + 1} must be an object.")
            title = str(section.get("title") or "").strip() or f"Section {section_index + 1}"
            instructions = str(section.get("instructions") or "").strip()
            questions = section.get("questions") or []
            if not isinstance(questions, list):
                raise serializers.ValidationError(f"Section {section_index + 1} questions must be a list.")
            normalized_questions = []
            for question_index, question in enumerate(questions):
                normalized_question = self._normalize_single_question(
                    question,
                    f"{section_index + 1}.{question_index + 1}",
                )
                normalized_question["id"] = normalized_question.get("id") or len(normalized_questions) + 1
                normalized_questions.append(normalized_question)
            normalized_sections.append(
                {
                    "id": section.get("id") or section_index + 1,
                    "title": title,
                    "instructions": instructions,
                    "questions": normalized_questions,
                }
            )
        return normalized_sections

    def _flatten_sections(self, sections):
        flattened = []
        question_id = 1
        for section in sections:
            for question in section.get("questions", []):
                next_question = dict(question)
                # Preserve provided IDs so backend duplicate-id validation can enforce uniqueness.
                next_question["id"] = next_question.get("id") or question_id
                next_question["section_id"] = section.get("id")
                next_question["section_title"] = section.get("title")
                flattened.append(next_question)
                question_id += 1
        return flattened

    def _public_questions(self, questions):
        if not isinstance(questions, list):
            return []
        output = []
        for item in questions:
            if not isinstance(item, dict):
                continue
            question = {
                "id": item.get("id"),
                "question_text": item.get("question_text", ""),
                "type": item.get("type", "multiple_choice"),
                "options": [
                    {"id": option.get("id"), "text": option.get("text", "")}
                    for option in (item.get("options") or [])
                    if isinstance(option, dict)
                ],
                "points": item.get("points", 1),
                "instructions": item.get("instructions", ""),
                "starter_code": item.get("starter_code", ""),
                "language": item.get("language", ""),
                "expected_output": item.get("expected_output", ""),
                "test_cases": item.get("test_cases", ""),
                "allowed_file_types": item.get("allowed_file_types", ""),
                "max_file_size": item.get("max_file_size", ""),
                "matching_pairs": item.get("matching_pairs", []),
                "enumeration_answers": item.get("enumeration_answers", []),
                "enumeration_items": item.get("enumeration_items", []),
                "enumeration_scoring_mode": item.get("enumeration_scoring_mode", "partial"),
                "enumeration_points_mode": item.get("enumeration_points_mode", "equal"),
                "expected_count": item.get("expected_count", 0),
                "accepted_answers": item.get("accepted_answers", []),
                "formula_input": item.get("formula_input", ""),
                "correct_formula": item.get("correct_formula", ""),
                "section_id": item.get("section_id"),
                "section_title": item.get("section_title"),
            }
            if question["type"] == "true_false" and not question["options"]:
                question["options"] = [{"id": 1, "text": "True"}, {"id": 2, "text": "False"}]
            output.append(question)
        return output

    def _public_sections(self, sections):
        if not isinstance(sections, list):
            return []
        output = []
        for section in sections:
            if not isinstance(section, dict):
                continue
            output.append(
                {
                    "id": section.get("id"),
                    "title": section.get("title", ""),
                    "instructions": section.get("instructions", ""),
                    "questions": self._public_questions(section.get("questions") or []),
                }
            )
        return output

    def get_attachments(self, obj):
        """
        Returns all attachments for this activity (instructor files),
        serialized in the same format as SubmissionAttachmentSerializer.
        """
        attachments = []

        # Include the main instructor file if it exists
        if obj.file:
            try:
                file_name = obj.file.name.split("/")[-1]
                url = self._absolute_url(obj.file.url)
                attachments.append({
                    "id": obj.id,  # can use activity id if no separate attachment model
                    "file": url,
                    "file_url": url,
                    "name": file_name,
                    "file_size": int(obj.file.size) if getattr(obj.file, "size", None) is not None else None,
                    "mime_type": mimetypes.guess_type(file_name)[0] or "",
                })
            except (ValueError, AttributeError):
                pass

        # Include extra activity attachments saved in SubmissionAttachment(announcement=...)
        for attachment in obj.attachments.all():
            if not attachment.file:
                continue
            try:
                file_name = attachment.file.name.split("/")[-1]
                url = self._absolute_url(attachment.file.url)
                attachments.append({
                    "id": attachment.id,
                    "file": url,
                    "file_url": url,
                    "name": file_name,
                    "file_size": int(attachment.file.size) if getattr(attachment.file, "size", None) is not None else None,
                    "mime_type": mimetypes.guess_type(file_name)[0] or "",
                })
            except (ValueError, AttributeError):
                continue

        return attachments

    def get_assigned_courses(self, obj):
        assigned = obj.assigned_courses.values("id", "title")
        return list(assigned)

    def get_question_count(self, obj):
        return len(self._public_questions(obj.quiz_questions))

    def get_total_points_value(self, obj):
        questions = obj.quiz_questions if isinstance(obj.quiz_questions, list) and obj.quiz_questions else self._flatten_sections(obj.quiz_sections or [])
        total = 0.0
        for question in questions:
            try:
                total += float(question.get("points", 1) or 1)
            except (TypeError, ValueError, AttributeError):
                continue
        return round(total, 2)

    def get_attempts_count(self, obj):
        return obj.quiz_attempts.count()

    def get_needs_manual_review(self, obj):
        for question in obj.quiz_questions or []:
            if str(question.get("type") or "").lower() == "essay":
                return True
        return False

    def get_pending_review_count(self, obj):
        return obj.quiz_attempts.filter(status=QuizAttempt.STATUS_PENDING_REVIEW).count()

    def get_submission_deadline(self, obj):
        return obj.get_submission_deadline() or obj.availability_end

    def get_allow_late_submission(self, obj):
        return bool(obj.allow_late_submissions)

    def get_is_overdue(self, obj):
        return obj.is_submission_overdue()

    def get_can_submit(self, obj):
        return obj.can_accept_submission()

    def get_submission_locked_reason(self, obj):
        return obj.get_submission_locked_reason()

    # Get the student's own submission
    def get_submission(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return None

        submission = obj.submissions.filter(student=request.user).first()
        if submission:
            data = ActivitySubmissionSerializer(
                submission,
                context=self.context
            ).data
            is_quiz_activity = str(getattr(obj.activity_type, "name", "") or "").lower() == "quiz"
            is_student = request.user != obj.course.instructor
            if is_quiz_activity and is_student:
                if not bool(getattr(obj, "show_score_immediately", False)):
                    data["grade"] = None
                    data["feedback"] = ""
                if not bool(getattr(obj, "allow_answer_review", False)):
                    data["text_answer"] = ""
            return data
        return None
    # Get all submissions for instructors
    def get_submissions(self, obj):
        request = self.context.get("request")

        # Only instructor can see all submissions
        if request and request.user == obj.course.instructor:
            return ActivitySubmissionSerializer(
                obj.submissions.all(),
                many=True,
                context=self.context
            ).data

        return None

    def get_quiz_attempts(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return []

        queryset = obj.quiz_attempts.all().order_by("-started_at")
        if request.user == obj.course.instructor:
            return QuizAttemptSerializer(queryset[:50], many=True).data
        attempts_data = QuizAttemptSerializer(queryset.filter(student=request.user)[:20], many=True).data
        return [self._sanitize_student_attempt(item, obj) for item in attempts_data]

    def _sanitize_student_attempt(self, attempt, obj):
        cleaned = dict(attempt or {})
        visibility_snapshot = cleaned.get("visibility_snapshot") if isinstance(cleaned.get("visibility_snapshot"), dict) else {}
        can_show_score = bool(visibility_snapshot.get("show_score_immediately", getattr(obj, "show_score_immediately", False)))
        can_review = bool(visibility_snapshot.get("allow_answer_review", getattr(obj, "allow_answer_review", False)))
        if cleaned.get("status") == QuizAttempt.STATUS_PENDING_REVIEW:
            can_show_score = False
            can_review = False
        cleaned["show_score_immediately"] = can_show_score
        cleaned["allow_answer_review"] = can_review
        if not can_show_score:
            cleaned["score"] = None
            cleaned["total_points"] = None
            cleaned["correct_answers"] = None
            cleaned["incorrect_answers"] = None
        if not can_review:
            cleaned["answers"] = []
            cleaned["result_breakdown"] = []
        elif cleaned.get("id"):
            cleaned["review_url"] = f"/api/courses/{obj.course_id}/activities/{obj.id}/quiz/review/?attempt_id={cleaned['id']}"
        return cleaned

    # Validation
    def validate(self, data):
        data.setdefault('link', None)
        metadata = data.get("classwork_metadata", None)
        if isinstance(metadata, str):
            try:
                data["classwork_metadata"] = json.loads(metadata)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError({"classwork_metadata": "Must be valid JSON."}) from exc
        elif metadata is not None and not isinstance(metadata, dict):
            raise serializers.ValidationError({"classwork_metadata": "Must be a JSON object."})

        activity_type_ref = data.get("activity_type", getattr(self.instance, "activity_type", None))
        activity_type_name = ""
        if hasattr(activity_type_ref, "name"):
            activity_type_name = str(getattr(activity_type_ref, "name", "") or "").strip().lower()
        elif activity_type_ref not in (None, ""):
            try:
                activity_type_id = int(activity_type_ref)
            except (TypeError, ValueError):
                activity_type_id = None
            if activity_type_id:
                activity_type_name = (
                    ActivityType.objects.filter(id=activity_type_id).values_list("name", flat=True).first() or ""
                ).strip().lower()

        is_quiz_activity = activity_type_name == "quiz"
        incoming_assessment_type = str(
            data.get("assessment_type", getattr(self.instance, "assessment_type", CourseActivity.ASSESSMENT_QUIZ))
            or CourseActivity.ASSESSMENT_QUIZ
        ).strip().lower()

        if not is_quiz_activity:
            # Keep non-quiz activities on a neutral default to avoid mismatched labels/semantics.
            data["assessment_type"] = CourseActivity.ASSESSMENT_QUIZ
        elif incoming_assessment_type in {CourseActivity.ASSESSMENT_QUIZ, CourseActivity.ASSESSMENT_EXAM}:
            data["assessment_type"] = incoming_assessment_type
        else:
            data["assessment_type"] = CourseActivity.ASSESSMENT_QUIZ

        normalized_questions = self._normalize_questions(data.get("questions"))
        normalized_sections = self._normalize_sections(data.get("sections"))
        if "sections" in data:
            data["quiz_sections"] = normalized_sections
            data["quiz_questions"] = self._flatten_sections(normalized_sections)
        elif "questions" in data:
            data["quiz_questions"] = normalized_questions
            if normalized_questions:
                data["quiz_sections"] = [
                    {
                        "id": 1,
                        "title": "Section 1",
                        "instructions": "",
                        "questions": normalized_questions,
                    }
                ]
        data.pop("questions", None)
        data.pop("sections", None)

        # Validate question integrity at backend level (authoritative checks).
        question_items = data.get("quiz_questions") or []
        seen_question_ids = set()
        seen_question_texts = set()
        for index, question in enumerate(question_items, start=1):
            if not isinstance(question, dict):
                raise serializers.ValidationError({"sections": f"Question {index} must be an object."})

            question_id = question.get("id")
            if question_id in (None, ""):
                raise serializers.ValidationError({"sections": f"Question {index} requires an id."})
            if question_id in seen_question_ids:
                raise serializers.ValidationError({"sections": f"Duplicate question ID detected: {question_id}."})
            seen_question_ids.add(question_id)

            normalized_text = re.sub(r"\s+", " ", str(question.get("question_text") or "").strip().lower())
            if normalized_text:
                if normalized_text in seen_question_texts:
                    raise serializers.ValidationError({"sections": f"Duplicate question text detected at question {index}."})
                seen_question_texts.add(normalized_text)

            raw_points = question.get("points", 1)
            try:
                self._coerce_points_or_raise(raw_points)
            except serializers.ValidationError:
                raise serializers.ValidationError({"sections": f"Question {index}: {self.POINTS_VALIDATION_MESSAGE}"})

        # Validate activity-level points with the same finite numeric guard.
        try:
            points = self._coerce_points_or_raise(data.get("points", 0))
        except serializers.ValidationError:
            raise serializers.ValidationError({"points": self.POINTS_VALIDATION_MESSAGE})
        data["points"] = points

        availability_start = data.get("availability_start")
        availability_end = data.get("availability_end")
        if availability_start and availability_end and availability_end <= availability_start:
            raise serializers.ValidationError(
                {"availability_end": "Exam lock time must be later than availability start."}
            )

        total_questions = len(data.get("quiz_questions") or [])
        random_subset_size = int(data.get("random_subset_size") or 0)
        if random_subset_size < 0:
            raise serializers.ValidationError({"random_subset_size": "Random subset cannot be negative."})
        if random_subset_size > 0 and total_questions > 0 and random_subset_size > total_questions:
            raise serializers.ValidationError(
                {"random_subset_size": "Random subset cannot exceed total available questions."}
            )

        anti_cheat_subflags = [
            bool(data.get("anti_cheat_tab_switch")),
            bool(data.get("anti_cheat_multi_tab")),
            bool(data.get("anti_cheat_disable_copy_paste")),
            bool(data.get("anti_cheat_fullscreen_required")),
        ]
        if any(anti_cheat_subflags) and not bool(data.get("anti_cheat_enabled")):
            raise serializers.ValidationError(
                {"anti_cheat_enabled": "Enable anti-cheat before using anti-cheat options."}
            )

        if str(data.get("publish_state") or "").lower() == CourseActivity.PUBLISH_STATE_PUBLISHED:
            sections_data = data.get("quiz_sections") or []
            if not sections_data:
                raise serializers.ValidationError({"sections": "Published assessments require at least one section."})
            for index, section in enumerate(sections_data, start=1):
                section_questions = section.get("questions") or []
                if not section_questions:
                    raise serializers.ValidationError(
                        {"sections": f"Section {index} must contain at least one question before publishing."}
                    )
                for question in section_questions:
                    if not str(question.get("question_text") or "").strip():
                        raise serializers.ValidationError(
                            {"sections": f"Section {index} has a question with empty text."}
                        )

        if data.get("assessment_type") == "exam":
            data["grading_type"] = "points"
            data["anti_cheat_enabled"] = data.get("anti_cheat_enabled", True)

        return data

    def create(self, validated_data):
        course_ids = validated_data.pop("course_ids", None)
        activity = super().create(validated_data)
        self._assign_courses(activity, course_ids)
        return activity

    def update(self, instance, validated_data):
        course_ids = validated_data.pop("course_ids", None)
        activity = super().update(instance, validated_data)
        self._assign_courses(activity, course_ids)
        return activity

    def _assign_courses(self, activity, course_ids):
        if course_ids is None:
            return
        cleaned_ids = []
        for raw_id in course_ids:
            try:
                cleaned_ids.append(int(raw_id))
            except (TypeError, ValueError):
                continue

        available_courses = Course.objects.filter(
            instructor=activity.course.instructor,
            id__in=cleaned_ids,
        )
        activity.assigned_courses.set(available_courses.exclude(id=activity.course_id))

    def validate_link(self, value):
        if value in (None, ""):
            return None

        normalized = value.strip()
        if not normalized:
            return None

        if "://" not in normalized:
            normalized = f"https://{normalized}"

        validator = URLValidator()
        try:
            validator(normalized)
        except ValidationError:
            raise serializers.ValidationError("Enter a valid URL.")

        return normalized


class ClassworkDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassworkDraft
        fields = [
            "id",
            "instructor",
            "course",
            "title",
            "description",
            "assessment_type",
            "due_date",
            "availability_start",
            "availability_end",
            "points",
            "quiz_time_limit_seconds",
            "max_attempts",
            "randomize_questions",
            "randomize_choices",
            "random_subset_size",
            "require_answer_to_advance",
            "anti_cheat_enabled",
            "anti_cheat_tab_switch",
            "anti_cheat_multi_tab",
            "anti_cheat_disable_copy_paste",
            "anti_cheat_fullscreen_required",
            "pre_exam_message",
            "topic",
            "sections",
            "course_ids",
            "imported_source_name",
            "updated_at",
            "created_at",
        ]
        read_only_fields = ["id", "instructor", "updated_at", "created_at"]


class QuestionBankItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionBankItem
        fields = [
            "id",
            "instructor",
            "course",
            "topic",
            "difficulty",
            "question_data",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "instructor", "created_at", "updated_at"]


class QuizSecurityEventSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = QuizSecurityEvent
        fields = [
            "id",
            "quiz",
            "attempt",
            "student",
            "student_username",
            "event_type",
            "details",
            "created_at",
        ]
        read_only_fields = ["id", "student_username", "created_at"]
# -----------------------------
# Comment Serializer
# -----------------------------
class CourseCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseComment
        fields = "__all__"


# -----------------------------
# Instructor Feedback Serializer
# -----------------------------
class InstructorFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstructorFeedback
        fields = "__all__"


class ActivityCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = ActivityComment
        fields = ['id', 'activity', 'user', 'user_name', 'message', 'attachment', 'created_at']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    marked_by_username = serializers.CharField(source="marked_by.username", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "session",
            "student_id",
            "student_username",
            "status",
            "points_earned",
            "marked_by_username",
            "marked_at",
        ]
        read_only_fields = [
            "id",
            "session",
            "student_id",
            "student_username",
            "marked_by_username",
            "marked_at",
        ]


class AttendanceSessionSerializer(serializers.ModelSerializer):
    # Keep read-only custom formatting because legacy rows may store datetime values.
    date = serializers.SerializerMethodField()
    records = serializers.SerializerMethodField()
    my_record = serializers.SerializerMethodField()
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "course",
            "date",
            "topic",
            "created_by_id",
            "created_by_username",
            "created_at",
            "records",
            "my_record",
        ]
        read_only_fields = ["id", "course", "created_at", "records", "my_record"]

    def get_date(self, obj):
        value = obj.date
        if isinstance(value, datetime):
            return value.date().isoformat()
        return value.isoformat() if value else None

    def get_records(self, obj):
        request = self.context.get("request")
        if request and obj.course.instructor_id == request.user.id:
            return AttendanceRecordSerializer(obj.records.select_related("student", "marked_by").all(), many=True).data
        return []

    def get_my_record(self, obj):
        request = self.context.get("request")
        if not request or not request.user or request.user.role != "student":
            return None
        record = obj.records.select_related("student", "marked_by").filter(student=request.user).first()
        if not record:
            return None
        return AttendanceRecordSerializer(record).data


class MeetingSerializer(serializers.ModelSerializer):
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Meeting
        fields = [
            "id",
            "course",
            "title",
            "scheduled_time",
            "meeting_link",
            "created_by_id",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "course", "created_by_id", "created_by_username", "created_at"]


class EnrollmentRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_school_id = serializers.CharField(source="student.school_id", read_only=True)
    course_name = serializers.CharField(source="course.title", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.username", read_only=True)

    class Meta:
        model = EnrollmentRequest
        fields = [
            "id",
            "course",
            "course_name",
            "student",
            "student_name",
            "student_email",
            "student_school_id",
            "status",
            "created_at",
            "updated_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        full_name = obj.student.full_name()
        return full_name or obj.student.username


class GradingComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradingComponent
        fields = ["id", "name", "weight", "activity_ids"]
        read_only_fields = ["id"]


class GradingSchemeSerializer(serializers.ModelSerializer):
    components = GradingComponentSerializer(many=True)

    class Meta:
        model = GradingScheme
        fields = ["id", "course", "grading_type", "passing_grade", "custom_config", "components"]
        read_only_fields = ["id", "course"]

    @staticmethod
    def _normalize_text(value):
        return str(value or "").strip().lower()

    @staticmethod
    def _as_bool(value, default=False):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "on"}:
                return True
            if lowered in {"0", "false", "no", "off"}:
                return False
        return bool(default)

    @classmethod
    def _infer_activity_ids_for_component(cls, component_name, activities):
        name = cls._normalize_text(component_name)
        if not name:
            return []

        normalized_name = name[:-1] if name.endswith("s") else name
        activity_ids = []
        for activity in activities:
            activity_type_name = cls._normalize_text(getattr(activity.activity_type, "name", ""))
            normalized_activity_type = activity_type_name[:-1] if activity_type_name.endswith("s") else activity_type_name
            assessment_type = cls._normalize_text(getattr(activity, "assessment_type", ""))

            # Keep inference aligned with grading service legacy mapping to avoid overlaps.
            if "attendance" in normalized_name and normalized_activity_type == "attendance":
                activity_ids.append(int(activity.id))
                continue
            if "quiz" in normalized_name and normalized_activity_type == "quiz" and assessment_type == CourseActivity.ASSESSMENT_QUIZ:
                activity_ids.append(int(activity.id))
                continue
            if "exam" in normalized_name and normalized_activity_type == "quiz" and assessment_type == CourseActivity.ASSESSMENT_EXAM:
                activity_ids.append(int(activity.id))
                continue
            if "project" in normalized_name and normalized_activity_type == "project":
                activity_ids.append(int(activity.id))
                continue
            if any(token in normalized_name for token in ["assignment", "task", "homework"]) and normalized_activity_type in {
                "assignment",
                "task",
                "homework",
            }:
                activity_ids.append(int(activity.id))
        return activity_ids

    def validate_components(self, value):
        course = self.context.get("course")
        allow_overlap = False
        allow_legacy_mapping = True
        custom_config = self.initial_data.get("custom_config", None)
        if custom_config is None:
            custom_config = getattr(self.instance, "custom_config", {}) if self.instance else {}
        if custom_config is None:
            custom_config = {}
        if not isinstance(custom_config, dict):
            custom_config = {}
        allow_overlap = self._as_bool(custom_config.get("allow_component_overlap", False), default=False)
        allow_legacy_mapping = self._as_bool(custom_config.get("allow_legacy_component_mapping", True), default=True)
        auto_detect_activities = self._as_bool(custom_config.get("auto_detect_activities", True), default=True)
        component_rules = custom_config.get("component_rules") if isinstance(custom_config.get("component_rules"), list) else []
        rule_names = {
            str(item.get("component_name") or item.get("name") or "").strip().lower()
            for item in component_rules
            if isinstance(item, dict)
        }

        course_activities = []
        course_activity_ids = set()
        if course is not None:
            course_activities = list(
                CourseActivity.objects.filter(course=course).select_related("activity_type")
            )
            course_activity_ids = {int(activity.id) for activity in course_activities}

        total_weight = sum(float(item.get("weight", 0) or 0) for item in value)
        if abs(total_weight - 100.0) > 0.0001:
            raise serializers.ValidationError("Total component weights must equal 100%.")
        normalized_names = [str(item.get("name", "")).strip().lower() for item in value]
        if any(not name for name in normalized_names):
            raise serializers.ValidationError("Each component must have a name.")
        if len(normalized_names) != len(set(normalized_names)):
            raise serializers.ValidationError("Component names must be unique.")

        seen_activity_to_component = {}
        for item in value:
            try:
                weight = float(item.get("weight", 0) or 0)
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError("Component weight must be numeric.") from exc
            if weight < 0 or weight > 100:
                raise serializers.ValidationError("Each component weight must be between 0 and 100.")

            raw_ids = item.get("activity_ids")
            if (not isinstance(raw_ids, list) or not raw_ids) and allow_legacy_mapping:
                raw_ids = self._infer_activity_ids_for_component(item.get("name"), course_activities)
            cleaned_ids = []
            for raw_id in raw_ids:
                try:
                    cleaned_ids.append(int(raw_id))
                except (TypeError, ValueError) as exc:
                    raise serializers.ValidationError("Component activity_ids must contain integers.") from exc
            unique_ids = sorted(set(cleaned_ids))
            if course_activity_ids:
                unknown_ids = [activity_id for activity_id in unique_ids if activity_id not in course_activity_ids]
                if unknown_ids:
                    has_rule = str(item.get("name", "")).strip().lower() in rule_names
                    if auto_detect_activities or has_rule:
                        unique_ids = [activity_id for activity_id in unique_ids if activity_id in course_activity_ids]
                    else:
                        raise serializers.ValidationError(
                            f'Component "{item.get("name", "")}" references unknown activities.'
                        )
            if not unique_ids:
                if not allow_legacy_mapping:
                    raise serializers.ValidationError(
                        f'Component "{item.get("name", "")}" must map to at least one activity.'
                    )
                item["activity_ids"] = []
                continue
            if not allow_overlap:
                for activity_id in unique_ids:
                    previous_component = seen_activity_to_component.get(activity_id)
                    if previous_component:
                        raise serializers.ValidationError(
                            f'Activity ID {activity_id} is assigned to multiple components: "{previous_component}" and "{item.get("name", "")}".'
                        )
                    seen_activity_to_component[activity_id] = item.get("name", "")
            item["activity_ids"] = unique_ids
        return value

    def validate(self, attrs):
        grading_type = attrs.get("grading_type", getattr(self.instance, "grading_type", GradingScheme.TYPE_ZERO_BASED))
        custom_config = attrs.get("custom_config", getattr(self.instance, "custom_config", {}))
        if custom_config is None:
            custom_config = {}
        if not isinstance(custom_config, dict):
            raise serializers.ValidationError({"custom_config": "Custom config must be a JSON object."})

        if "passfail_threshold" in custom_config:
            try:
                threshold = float(custom_config["passfail_threshold"])
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError({"custom_config": "passfail_threshold must be numeric."}) from exc
            if threshold < 0 or threshold > 100:
                raise serializers.ValidationError({"custom_config": "passfail_threshold must be between 0 and 100."})

        if "treat_missing_as_zero" in custom_config and not isinstance(custom_config["treat_missing_as_zero"], (bool, int, str)):
            raise serializers.ValidationError({"custom_config": "treat_missing_as_zero must be boolean-like."})

        if "auto_detect_activities" in custom_config and not isinstance(custom_config["auto_detect_activities"], (bool, int, str)):
            raise serializers.ValidationError({"custom_config": "auto_detect_activities must be boolean-like."})

        component_rules = custom_config.get("component_rules")
        if component_rules is not None:
            if not isinstance(component_rules, list):
                raise serializers.ValidationError({"custom_config": "component_rules must be a list."})
            component_rule_names = set()
            for item in component_rules:
                if not isinstance(item, dict):
                    raise serializers.ValidationError({"custom_config": "Each component rule must be an object."})
                component_name = str(item.get("component_name") or item.get("name") or "").strip()
                if not component_name:
                    raise serializers.ValidationError({"custom_config": "Each component rule must include component_name."})
                normalized_name = component_name.lower()
                if normalized_name in component_rule_names:
                    raise serializers.ValidationError({"custom_config": "component_rules must use unique component_name values."})
                component_rule_names.add(normalized_name)
                category_key = str(item.get("category_key") or item.get("category") or "").strip().lower()
                if category_key and category_key not in ACTIVITY_CATEGORY_LABELS:
                    raise serializers.ValidationError({"custom_config": f"Unknown category_key '{category_key}' in component_rules."})
                if "drop_lowest_count" in item:
                    try:
                        drop_lowest_count = int(item.get("drop_lowest_count") or 0)
                    except (TypeError, ValueError) as exc:
                        raise serializers.ValidationError({"custom_config": "drop_lowest_count must be an integer."}) from exc
                    if drop_lowest_count < 0:
                        raise serializers.ValidationError({"custom_config": "drop_lowest_count must be zero or greater."})

        formula_expression = str(custom_config.get("formula_expression") or "").strip()
        if formula_expression:
            try:
                formula_tokens = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", formula_expression))
                formula_variables = {
                    token: 100.0
                    for token in formula_tokens
                    if token not in {"min", "max", "abs", "round"}
                }
                evaluate_custom_formula(formula_expression, formula_variables)
            except ValidationError as exc:
                raise serializers.ValidationError({"custom_config": str(exc)})

        if grading_type == GradingScheme.TYPE_CUSTOM:
            table = custom_config.get("transmutation_table")
            if table is not None:
                try:
                    validate_custom_transmutation_table(table, require_full_coverage=True)
                except ValidationError as exc:
                    raise serializers.ValidationError({"custom_config": str(exc)})
        elif custom_config.get("transmutation_table") is not None:
            table = custom_config.get("transmutation_table")
            if table == []:
                custom_config.pop("transmutation_table", None)
                attrs["custom_config"] = custom_config
                return attrs
            if not isinstance(table, list):
                raise serializers.ValidationError(
                    {"custom_config": "custom_config.transmutation_table must be a list when provided."}
                )
            try:
                validate_custom_transmutation_table(table, require_full_coverage=True)
            except ValidationError as exc:
                raise serializers.ValidationError({"custom_config": str(exc)})

        attrs["custom_config"] = custom_config
        return attrs

    def create(self, validated_data):
        components_data = validated_data.pop("components", [])
        scheme = GradingScheme.objects.create(**validated_data)
        for component in components_data:
            GradingComponent.objects.create(scheme=scheme, **component)
        scheme.validate_component_weights()
        return scheme

    def update(self, instance, validated_data):
        components_data = validated_data.pop("components", None)
        instance.grading_type = validated_data.get("grading_type", instance.grading_type)
        instance.passing_grade = validated_data.get("passing_grade", instance.passing_grade)
        instance.custom_config = validated_data.get("custom_config", instance.custom_config)
        instance.save()

        if components_data is not None:
            instance.components.all().delete()
            for component in components_data:
                GradingComponent.objects.create(scheme=instance, **component)
            instance.validate_component_weights()
        return instance


class GradeSheetSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    components = serializers.DictField()
    activities = serializers.ListField(required=False)
    uncovered_activities = serializers.ListField(required=False)
    weighted_total = serializers.FloatField(required=False)
    final_grade = serializers.FloatField()
    status = serializers.CharField()
    remarks = serializers.CharField()
    formula = serializers.CharField()
    formula_text = serializers.CharField(required=False)
