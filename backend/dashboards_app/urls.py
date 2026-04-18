from django.urls import path
from .views import (
    InstructorSidebarAPIView,
    InstructorCoursesAPIView,
    InstructorCourseCreateAPIView,
    InstructorCourseDetailAPIView,
    InstructorSubmissionsAPIView,
    InstructorNotificationsAPIView,
    StudentDashboardAPIView,
    StudentCoursesAPIView,
    StudentAssignmentsAPIView,
    StudentGradesAPIView,
    StudentProfileAPIView,
)

urlpatterns = [

    # ✅ STUDENT ROUTES (REMOVE api/)
    path("dashboards/student/dashboard/", StudentDashboardAPIView.as_view()),
    path("dashboards/student/my-courses/", StudentCoursesAPIView.as_view()),
    path("dashboards/student/assignments/", StudentAssignmentsAPIView.as_view()),
    path("dashboards/student/grades/", StudentGradesAPIView.as_view()),
    path("dashboards/student/profile/", StudentProfileAPIView.as_view()),

    # ✅ INSTRUCTOR ROUTES
    path("dashboards/instructor/sidebar/", InstructorSidebarAPIView.as_view()),
    path("dashboards/instructor/courses/", InstructorCoursesAPIView.as_view()),
    path("instructor/courses/create/", InstructorCourseCreateAPIView.as_view()),

    # Course detail
    path("courses/<int:pk>/", InstructorCourseDetailAPIView.as_view()),

    # Other routes
    path("dashboards/instructor/submissions/", InstructorSubmissionsAPIView.as_view()),
    path("dashboards/instructor/notifications/", InstructorNotificationsAPIView.as_view()),
]
