# core/urls.py
from django.contrib import admin
from django.urls import path, include

# ADD THESE IMPORTS (they are missing)
from django.conf import settings
from django.conf.urls.static import static
from courses import views as course_views
from users_app.views import (
    ChangePasswordAPIView,
    InstructorNotificationSettingsAPIView,
    InstructorProfileAPIView,
    InstructorProfileAvatarUploadAPIView,
    NotificationListAPIView,
    NotificationMarkAllReadAPIView,
    NotificationMarkReadAPIView,
    NotificationUnreadCountAPIView,
    StudentNotificationSettingsAPIView,
    StudentProfileAPIView,
    StudentProfileAvatarUploadAPIView,
)
from dashboards_app.views import (
    InstructorUpcomingDeadlinesAPIView,
    InstructorStudentInsightsAPIView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Users App - Auth & Registration
    path('api/users/', include('users_app.urls')),
    path('api/admin/', include('users_app.admin_urls')),

    # Dashboards App
    path('api/', include('dashboards_app.urls')),

    path("api/categories/", course_views.category_list_create, name="category-list-create"),
    path("api/categories/<int:category_id>/", course_views.category_detail, name="category-detail"),

    # Courses App
    path('api/courses/', include('courses.urls')),
    path('api/modules/<int:module_id>/lessons/', course_views.module_lessons, name='api-module-lessons'),
    path('api/modules/<int:module_id>/', course_views.module_detail, name='api-module-detail'),
    path('api/lessons/<int:lesson_id>/', course_views.lesson_detail, name='api-lesson-detail'),

    # AI Service App
    path("api/", include("analytics_ai.urls")),
    path("api/analytics/", include("analytics_app.urls")),

    path("api/instructor/profile/", InstructorProfileAPIView.as_view()),
    path("api/instructor/profile/avatar/", InstructorProfileAvatarUploadAPIView.as_view()),
    path("api/instructor/notification-settings/", InstructorNotificationSettingsAPIView.as_view()),
    path("api/student/profile/", StudentProfileAPIView.as_view()),
    path("api/student/profile/avatar/", StudentProfileAvatarUploadAPIView.as_view()),
    path("api/student/notification-settings/", StudentNotificationSettingsAPIView.as_view()),
    path("api/notifications/", NotificationListAPIView.as_view()),
    path("api/notifications/unread-count/", NotificationUnreadCountAPIView.as_view()),
    path("api/notifications/<int:notification_id>/read/", NotificationMarkReadAPIView.as_view()),
    path("api/notifications/mark-all-read/", NotificationMarkAllReadAPIView.as_view()),
    path("api/instructor/upcoming-deadlines/", InstructorUpcomingDeadlinesAPIView.as_view()),
    path("api/instructor/students/<int:student_id>/insights/", InstructorStudentInsightsAPIView.as_view()),
    path("api/auth/change-password/", ChangePasswordAPIView.as_view()),
]

# VERY IMPORTANT — SERVE MEDIA FILES IN DEVELOPMENT
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
