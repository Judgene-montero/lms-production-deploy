from django.urls import path

from .views import AdminLogsView, AdminSettingsView

urlpatterns = [
    path("settings/", AdminSettingsView.as_view(), name="admin-settings"),
    path("logs/", AdminLogsView.as_view(), name="admin-logs"),
]
