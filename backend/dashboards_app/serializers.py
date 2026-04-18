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
            "students_count",
            "join_code",              # ✅ ADD THIS
            "join_code_enabled",      # ✅ ADD THIS
            "join_code_expiration",
        ]

    def get_students_count(self, obj):
        return obj.students.count()


class CourseCreateSerializer(serializers.ModelSerializer):
    student_ids = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = Course
        fields = ["id", "title","description","category","thumbnail", "student_ids"]

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

    class Meta:
        model = Notification
        fields = ("id", "message", "time", "created_at")

    def get_time(self, obj):
        return obj.created_at.strftime("%b %d, %Y %I:%M %p")
