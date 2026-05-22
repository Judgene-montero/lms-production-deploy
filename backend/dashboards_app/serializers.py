# dashboards_app/serializers.py
from rest_framework import serializers
from users_app.models import Course, Submission, Notification


# --------------------------
# Sidebar Links
# --------------------------
class SidebarLinkSerializer(serializers.Serializer):
    name = serializers.CharField()
    icon = serializers.CharField()
    notification = serializers.IntegerField()
    path = serializers.CharField()   # ← ADD THIS


# --------------------------
# Courses
# --------------------------
class CourseSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    instructor_info = serializers.SerializerMethodField()
    # Add join code fields
    join_code = serializers.CharField(read_only=True)
    join_code_enabled = serializers.BooleanField(read_only=True)
    join_code_expiration = serializers.DateTimeField(read_only=True)
    

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "category",
            "thumbnail",
            "start_date",
            "end_date",
            "start_time",
            "students_count",
            "instructor_name",
            "instructor_info",
            "join_code",              # ✅ ADD THIS
            "join_code_enabled",      # ✅ ADD THIS
            "join_code_expiration",
        ]

    def get_students_count(self, obj):
        return obj.students.count()

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


class CourseCreateSerializer(serializers.ModelSerializer):
    student_ids = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = Course
        fields = ["id", "title", "description", "category", "thumbnail", "start_date", "end_date", "start_time", "student_ids"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than the start date."})
        return attrs

    def create(self, validated_data):
        student_ids = validated_data.pop("student_ids", [])
        course = Course.objects.create(**validated_data)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        students = User.objects.filter(role="student", school_id__in=student_ids)
        course.students.set(students)
        return course


# --------------------------
# Submissions
# --------------------------
class SubmissionSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Submission
        fields = ("id", "student_name", "course_title", "status", "submitted_at")


# --------------------------
# Notifications
# --------------------------
class NotificationSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()
    course_id = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()
    activity_id = serializers.SerializerMethodField()
    submission_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "event_key",
            "title",
            "message",
            "notification_type",
            "is_read",
            "read_at",
            "time",
            "created_at",
            "actor_name",
            "course_id",
            "course_title",
            "activity_id",
            "submission_id",
        )

    def get_time(self, obj):
        return obj.created_at.strftime("%b %d, %Y %I:%M %p")

    def get_actor_name(self, obj):
        actor = getattr(obj, "actor", None)
        if not actor:
            return ""
        full_name = getattr(actor, "full_name", None)
        if callable(full_name):
            value = str(full_name() or "").strip()
            if value:
                return value
        return f"{actor.first_name} {actor.last_name}".strip() or actor.username

    def get_course_id(self, obj):
        return getattr(obj, "course_id", None)

    def get_course_title(self, obj):
        course = getattr(obj, "course", None)
        return getattr(course, "title", "") if course else ""

    def get_activity_id(self, obj):
        return getattr(obj, "activity_id", None)

    def get_submission_id(self, obj):
        return getattr(obj, "submission_id", None)
