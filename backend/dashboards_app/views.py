# dashboards_app/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Avg

from users_app.models import User, Course, Submission, Notification
from users_app.serializers import SidebarLinkSerializer, CourseSerializer, SubmissionSerializer, NotificationSerializer
from courses.models import CourseActivity, ActivitySubmission, QuizAttempt
from analytics_ai.models import StudentAnalytics


# --------------------------
# Instructor Sidebar
# --------------------------
class InstructorSidebarAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        links = [
            {"name": "Home", "path": "/instructor-dashboard", "icon": "🏠", "notification": 0},
            {"name": "Courses", "path": "/instructor-dashboard/courses", "icon": "📚", "notification": user.courses.count()},
            {"name": "Submissions", "path": "/instructor-dashboard/submissions", "icon": "📥", "notification": Submission.objects.filter(course__instructor=user).count()},
            {"name": "Notifications", "path": "/instructor-dashboard/notifications", "icon": "🔔", "notification": user.notifications.count()},
        ]

        serializer = SidebarLinkSerializer(links, many=True)
        return Response(serializer.data)


# --------------------------
# List Courses
# --------------------------
class InstructorCoursesAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        qs = Course.objects.filter(instructor=user)
        serializer = CourseSerializer(qs, many=True)
        return Response(serializer.data)


# --------------------------
# Create Course
# --------------------------
class InstructorCourseCreateAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        data = request.data.copy()
        data["instructor"] = user.id
        serializer = CourseSerializer(data=data)
        if serializer.is_valid():
            course = serializer.save()
            return Response({
                "id": course.id,
                "title": course.title,
                "students_count": course.students_count(),
                "message": "Course created successfully"
            }, status=201)
        return Response(serializer.errors, status=400)


# --------------------------
# List Submissions
# --------------------------
class InstructorSubmissionsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        qs = Submission.objects.filter(course__instructor=user).order_by("-submitted_at")
        serializer = SubmissionSerializer(qs, many=True)
        return Response(serializer.data)


# --------------------------
# List Notifications
# --------------------------
class InstructorNotificationsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        qs = Notification.objects.filter(instructor=user).order_by("-created_at")
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data)


# --------------------------
# Course Detail (GET, PUT, DELETE)
# --------------------------

class InstructorCourseDetailAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]  # Needed for file upload

    def get(self, request, pk):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        try:
            course = Course.objects.get(id=pk, instructor=user)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)

        serializer = CourseSerializer(course)
        return Response(serializer.data)

    def put(self, request, pk):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        try:
            course = Course.objects.get(id=pk, instructor=user)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)

        data = request.data.copy()
        serializer = CourseSerializer(course, data=data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Course updated successfully", "course": serializer.data})

        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        user = request.user
        if user.role != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        try:
            course = Course.objects.get(id=pk, instructor=user)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)

        course.delete()
        return Response({"message": "Course deleted successfully"}, status=200)
    


# --------------------------
# Student Dashboard
# --------------------------
class StudentDashboardAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "student":
            return Response({"error": "Unauthorized"}, status=403)

        data = {
            "total_courses": user.enrolled_courses.count(),
            "total_assignments": Submission.objects.filter(student=user).count(),
            "unread_notifications": user.notifications.filter(is_read=False).count(),
        }

        return Response(data)

# =========================================
# ✅ STUDENT MY COURSES
# =========================================
class StudentCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = Course.objects.filter(students=request.user)

        return Response([
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "category": c.category,
                "students": c.students.count(),
            }
            for c in courses
        ])


# =========================================
# ✅ STUDENT ASSIGNMENTS / TASKS
# =========================================
class StudentAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = Course.objects.filter(students=request.user)

        tasks = CourseActivity.objects.filter(
            course__in=courses, 
            activity_type="task"
        ).order_by("-created_at")

        return Response([
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "course": t.course.title,
                "date": t.date,
                "file": t.file.url if t.file else None,
                "link": t.link,
            }
            for t in tasks
        ])

# --------------------------
# Student Grades
# --------------------------
class StudentGradesAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "student":
            return Response({"error": "Unauthorized"}, status=403)

        submissions = Submission.objects.filter(student=user).exclude(grade__isnull=True)

        grades_data = [
            {
                "course": submission.course.title,
                "assignment": submission.assignment_title,
                "grade": submission.grade,
            }
            for submission in submissions
        ]

        return Response(grades_data)

# --------------------------
# Student Profile
# --------------------------
class StudentProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student = request.user
        if getattr(student, "role", "") != "student":
            return Response({"error": "Unauthorized"}, status=403)
        try:
            avatar_url = request.build_absolute_uri(student.avatar.url) if getattr(student, "avatar", None) else None
            profile = {
                "id": student.id,
                "username": student.username,
                "email": student.email or "",
                "first_name": student.first_name or "",
                "middle_initial": getattr(student, "middle_initial", ""),
                "last_name": student.last_name or "",
                "avatar": avatar_url,
                "avatar_url": avatar_url,
                "name": f"{student.first_name} {student.last_name}".strip() or student.username,
                "bio": getattr(student, "bio", ""),
                "phone": getattr(student, "phone", ""),
                "department": getattr(student, "department", ""),
                "student_id": getattr(student, "student_id", ""),
                "year_level": getattr(student, "year_level", ""),
            }
            return Response(profile)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def put(self, request):
        student = request.user
        if getattr(student, "role", "") != "student":
            return Response({"error": "Unauthorized"}, status=403)

        data = request.data or {}
        name = str(data.get("name", "")).strip() or str(data.get("full_name", "")).strip()
        if name:
            parts = [part for part in name.split(" ") if part]
            if len(parts) == 1:
                student.first_name = parts[0]
            else:
                student.first_name = parts[0]
                student.last_name = " ".join(parts[1:])
        if "email" in data:
            student.email = str(data.get("email", "")).strip()
        if "bio" in data:
            student.bio = str(data.get("bio", "")).strip()
        if "department" in data:
            student.department = str(data.get("department", "")).strip()
        if "phone" in data:
            student.phone = str(data.get("phone", "")).strip()

        student.save()
        return self.get(request)


class InstructorUpcomingDeadlinesAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, "role", "") != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        activities = (
            CourseActivity.objects.filter(
                course__instructor=user,
                due_date__isnull=False,
                due_date__gte=timezone.now(),
            )
            .select_related("course")
            .order_by("due_date")[:15]
        )

        rows = [
            {
                "id": activity.id,
                "activity_name": activity.title,
                "course": activity.course.title,
                "due_date": activity.due_date,
                "activity_type": getattr(activity.activity_type, "name", "activity"),
            }
            for activity in activities
        ]
        return Response(rows)


class InstructorStudentInsightsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        user = request.user
        if getattr(user, "role", "") != "instructor":
            return Response({"error": "Unauthorized"}, status=403)

        student = User.objects.filter(id=student_id, role="student").first()
        if not student:
            return Response({"error": "Student not found."}, status=404)

        enrolled_courses = Course.objects.filter(instructor=user, students=student).distinct().order_by("title")
        if not enrolled_courses.exists():
            return Response({"error": "Student is not enrolled in your courses."}, status=404)

        submissions = ActivitySubmission.objects.filter(
            student=student,
            activity__course__instructor=user,
            status__in=["submitted", "graded"],
        ).select_related("activity__course")
        quizzes = QuizAttempt.objects.filter(
            student=student,
            quiz__course__instructor=user,
            submitted_at__isnull=False,
        ).select_related("quiz__course")

        due_activities_count = CourseActivity.objects.filter(
            course__instructor=user,
            course__in=enrolled_courses,
            due_date__isnull=False,
            due_date__lte=timezone.now(),
        ).count()
        submitted_activity_ids = submissions.values_list("activity_id", flat=True).distinct().count()

        analytics_rows = StudentAnalytics.objects.filter(
            student=student,
            course__in=enrolled_courses,
        )
        analytics_summary = analytics_rows.aggregate(
            average_score=Avg("average_grade"),
            risk_score=Avg("risk_score"),
        )
        risk_level = "low"
        if analytics_rows.filter(risk_level="high").exists():
            risk_level = "high"
        elif analytics_rows.filter(risk_level="medium").exists():
            risk_level = "medium"

        timeline = []
        for row in submissions.order_by("-submitted_at")[:8]:
            label = "Submitted assignment"
            if row.activity.activity_type and "quiz" in row.activity.activity_type.name.lower():
                label = "Submitted quiz"
            timeline.append(
                {
                    "type": "submission",
                    "label": label,
                    "course": row.activity.course.title,
                    "activity": row.activity.title,
                    "at": row.submitted_at,
                }
            )
        for row in quizzes.order_by("-submitted_at")[:8]:
            timeline.append(
                {
                    "type": "quiz",
                    "label": "Completed quiz",
                    "course": row.quiz.course.title,
                    "activity": row.quiz.title,
                    "at": row.submitted_at,
                }
            )
        timeline = sorted(timeline, key=lambda item: item.get("at") or timezone.now(), reverse=True)[:12]

        avatar_url = request.build_absolute_uri(student.avatar.url) if getattr(student, "avatar", None) else None

        return Response(
            {
                "student": {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}".strip() or student.username,
                    "email": student.email or "",
                    "avatar": avatar_url,
                    "enrolled_courses": [
                        {"id": course.id, "title": course.title}
                        for course in enrolled_courses
                    ],
                },
                "analytics": {
                    "average_score": round(float(analytics_summary.get("average_score") or 0), 2),
                    "assignments_submitted": submissions.count(),
                    "missing_assignments": max(0, due_activities_count - submitted_activity_ids),
                    "risk_prediction": risk_level,
                    "risk_score": round(float(analytics_summary.get("risk_score") or 0), 2),
                },
                "timeline": timeline,
            }
        )
