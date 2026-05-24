from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views_auth import MyTokenObtainPairView
from .views import (
    UploadApprovedIDsView,
    ApprovedIDListView,
    DeleteApprovedIDView,
    ProfileAvatarDebugAPIView,
    UserProfileView,
    check_approved_id,
    register_user,
    verify_email,
    PendingInstructorApprovalsView,
    ApproveInstructorView,
    RejectInstructorView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserActivityView,
    AdminUserResetPasswordView,
    AdminBulkStatusView,
    AdminSettingsView,
    AdminLogsView,

)

urlpatterns = [
    # JWT Auth
    path("token/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # User Profile
    path("me/", UserProfileView.as_view(), name="user-profile"),
    path("profile/", UserProfileView.as_view(), name="user-profile-update"),
    path("profile/avatar-debug/", ProfileAvatarDebugAPIView.as_view(), name="profile-avatar-debug"),

    # Approved IDs (Admin)
    path("upload-ids/", UploadApprovedIDsView.as_view(), name="upload-ids"),
    path("approved-ids/", ApprovedIDListView.as_view(), name="approved-ids"),
    path("delete-id/<int:pk>/", DeleteApprovedIDView.as_view(), name="delete-id"),

    # School ID Validation
    path("check-approved-id/<str:school_id>/", check_approved_id),
    path("register/", register_user, name="register-user"),
    path("verify-email/<str:token>/", verify_email, name="verify-email"),

    # Admin instructor approval
    path("admin/instructor-pending/", PendingInstructorApprovalsView.as_view(), name="pending-instructors-legacy"),
    path("admin/pending-instructors/", PendingInstructorApprovalsView.as_view(), name="pending-instructors"),
    path("admin/instructor-approve/<int:user_id>/", ApproveInstructorView.as_view(), name="approve-instructor"),
    path("admin/instructor-reject/<int:user_id>/", RejectInstructorView.as_view(), name="reject-instructor"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<int:user_id>/activity/", AdminUserActivityView.as_view(), name="admin-user-activity"),
    path("admin/users/<int:user_id>/reset-password/", AdminUserResetPasswordView.as_view(), name="admin-user-reset-password"),
    path("admin/bulk-status/", AdminBulkStatusView.as_view(), name="admin-bulk-status"),

    # Admin settings and logs (also exposed under /api/admin/* in core urls)
    path("admin/settings/", AdminSettingsView.as_view(), name="admin-settings-users-prefix"),
    path("admin/logs/", AdminLogsView.as_view(), name="admin-logs-users-prefix"),
]
