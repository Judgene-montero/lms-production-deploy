from django.urls import path

from .views import AdminLogsView, AdminSettingsView
from dashboards_app.views import AdminDashboardOverviewAPIView

urlpatterns = [
    path("dashboard/overview/", AdminDashboardOverviewAPIView.as_view(), name="admin-dashboard-overview"),
    path("settings/", AdminSettingsView.as_view(), name="admin-settings"),
    path("logs/", AdminLogsView.as_view(), name="admin-logs"),
]
