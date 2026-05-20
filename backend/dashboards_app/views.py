# dashboards_app/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate

from users_app.models import AdminLog, User, Course, Submission, Notification
from users_app.serializers import SidebarLinkSerializer, CourseSerializer, SubmissionSerializer, NotificationSerializer
from courses.models import CourseActivity, ActivitySubmission, InstructorFeedback, QuizAttempt
from courses.serializers import CourseSerializer as EnrolledCourseSerializer
from analytics_ai.models import StudentAnalytics
from analytics_ai.services.risk_engine import get_risk_settings


def _safe_course_analytics(course):
    try:
        return course.course_analytics
    except Exception:
        return None


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

        qs = Notification.objects.filter(recipient=user).order_by("-created_at")
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
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "student":
            return Response({"error": "Unauthorized"}, status=403)

        courses = (
            request.user.enrolled_courses.select_related("category")
            .distinct()
            .order_by("title")
        )
        serializer = EnrolledCourseSerializer(courses, many=True, context={"request": request})
        return Response(serializer.data)


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


class AdminDashboardOverviewAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", "") != "admin" and not getattr(request.user, "is_staff", False):
            return Response({"error": "Unauthorized"}, status=403)

        payload = {
            "summary": {
                "users": {
                    "total": 0,
                    "students": 0,
                    "instructors": 0,
                    "admins": 0,
                    "active": 0,
                    "inactive": 0,
                    "pending_instructors": 0,
                },
                "courses": {
                    "total": 0,
                    "active": 0,
                    "archived": 0,
                },
                "ai_settings": get_risk_settings(),
            },
            "at_risk_overview": {"high": 0, "medium": 0, "low": 0},
            "course_performance": [],
            "instructor_performance": [],
            "engagement_trends": [],
            "recent_logs": [],
            "at_risk_students": [],
        }

        try:
            payload["summary"]["users"] = {
                "total": User.objects.count(),
                "students": User.objects.filter(role="student").count(),
                "instructors": User.objects.filter(role="instructor").count(),
                "admins": User.objects.filter(role="admin").count(),
                "active": User.objects.filter(is_active=True).count(),
                "inactive": User.objects.filter(is_active=False).count(),
                "pending_instructors": User.objects.filter(role="instructor", is_email_verified=True, is_active=False).count(),
            }
            course_rows = Course.objects.select_related("instructor", "category").order_by("-id")
            payload["summary"]["courses"] = {
                "total": course_rows.count(),
                "active": Course.objects.filter(is_archived=False).count(),
                "archived": Course.objects.filter(is_archived=True).count(),
            }
        except Exception:
            logger.exception("Admin overview summary failed.")
            course_rows = Course.objects.none()

        try:
            risk_rows = StudentAnalytics.objects.select_related("student", "course").order_by("-risk_score", "student__last_name")
            payload["at_risk_overview"] = {
                "high": risk_rows.filter(risk_level="high").count(),
                "medium": risk_rows.filter(risk_level="medium").count(),
                "low": risk_rows.filter(risk_level="low").count(),
            }
            payload["at_risk_students"] = [
                {
                    "id": row.id,
                    "student_name": f"{row.student.first_name} {row.student.last_name}".strip() or row.student.username,
                    "course_title": row.course.title,
                    "risk_level": row.risk_level,
                    "risk_score": round(float(row.risk_score or 0.0), 4),
                    "average_grade": round(float(row.average_grade or 0.0), 2),
                    "engagement_score": round(float(row.engagement_score or 0.0), 2),
                }
                for row in risk_rows[:10]
            ]
        except Exception:
            logger.exception("Admin overview risk section failed.")
            risk_rows = StudentAnalytics.objects.none()

        try:
            for course in course_rows[:12]:
                analytics = _safe_course_analytics(course)
                payload["course_performance"].append(
                    {
                        "course_id": course.id,
                        "course_title": course.title,
                        "instructor_name": f"{course.instructor.first_name} {course.instructor.last_name}".strip() or course.instructor.username,
                        "category": getattr(course.category, "name", None),
                        "students_count": course.students.count(),
                        "average_grade": round(float(getattr(analytics, "average_grade", 0.0) or 0.0), 2),
                        "average_engagement": round(float(getattr(analytics, "average_engagement", 0.0) or 0.0), 2),
                        "high_risk_students": int(getattr(analytics, "high_risk_students", 0) or 0),
                        "status": course.get_status(),
                    }
                )
        except Exception:
            logger.exception("Admin overview course performance failed.")

        try:
            instructor_performance = []
            instructors = User.objects.filter(role="instructor").order_by("last_name", "first_name")[:30]
            for instructor in instructors:
                instructor_courses = list(Course.objects.filter(instructor=instructor).prefetch_related("students"))
                course_analytics_rows = [_safe_course_analytics(course) for course in instructor_courses]
                course_analytics_rows = [row for row in course_analytics_rows if row is not None]
                feedback_qs = InstructorFeedback.objects.filter(course__instructor=instructor)

                average_grade = 0.0
                average_engagement = 0.0
                if course_analytics_rows:
                    average_grade = sum(float(row.average_grade or 0.0) for row in course_analytics_rows) / len(course_analytics_rows)
                    average_engagement = sum(float(row.average_engagement or 0.0) for row in course_analytics_rows) / len(course_analytics_rows)

                instructor_performance.append(
                    {
                        "instructor_id": instructor.id,
                        "name": f"{instructor.first_name} {instructor.last_name}".strip() or instructor.username,
                        "courses_total": len(instructor_courses),
                        "students_total": User.objects.filter(enrolled_courses__instructor=instructor, role="student").distinct().count(),
                        "average_grade": round(float(average_grade), 2),
                        "average_engagement": round(float(average_engagement), 2),
                        "high_risk_total": StudentAnalytics.objects.filter(course__instructor=instructor, risk_level="high").count(),
                        "feedback_average": round(float(feedback_qs.aggregate(avg=Avg("rating")).get("avg") or 0.0), 2),
                    }
                )

            instructor_performance.sort(key=lambda row: (-int(row["courses_total"]), row["name"].lower()))
            payload["instructor_performance"] = instructor_performance[:12]
        except Exception:
            logger.exception("Admin overview instructor performance failed.")

        try:
            engagement_trends_qs = (
                ActivitySubmission.objects.filter(submitted_at__isnull=False)
                .annotate(day=TruncDate("submitted_at"))
                .values("day")
                .annotate(submissions=Count("id"))
                .order_by("day")
            )
            login_trends_qs = (
                AdminLog.objects.filter(action="User login")
                .annotate(day=TruncDate("timestamp"))
                .values("day")
                .annotate(logins=Count("id"))
                .order_by("day")
            )
            engagement_map = {item["day"]: {"date": item["day"], "submissions": item["submissions"], "logins": 0} for item in engagement_trends_qs}
            for item in login_trends_qs:
                row = engagement_map.setdefault(item["day"], {"date": item["day"], "submissions": 0, "logins": 0})
                row["logins"] = item["logins"]
            payload["engagement_trends"] = [engagement_map[key] for key in sorted(engagement_map.keys())][-14:]
        except Exception:
            logger.exception("Admin overview engagement trends failed.")

        try:
            recent_logs = AdminLog.objects.select_related("performed_by", "target_user").order_by("-timestamp")[:15]
            payload["recent_logs"] = [
                {
                    "id": log.id,
                    "action": log.action,
                    "description": log.description,
                    "timestamp": log.timestamp,
                    "performed_by": getattr(log.performed_by, "username", None),
                    "target_user": getattr(log.target_user, "username", None),
                }
                for log in recent_logs
            ]
        except Exception:
            logger.exception("Admin overview logs failed.")

        return Response(payload)
