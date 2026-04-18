from django.contrib import admin
from analytics_ai.models import CourseAnalytics, StudentAnalytics


@admin.register(StudentAnalytics)
class StudentAnalyticsAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "average_grade", "risk_score", "risk_level", "last_updated")
    list_filter = ("risk_level", "course")
    search_fields = ("student__username", "student__first_name", "student__last_name", "course__title")


@admin.register(CourseAnalytics)
class CourseAnalyticsAdmin(admin.ModelAdmin):
    list_display = (
        "course",
        "total_students",
        "average_grade",
        "high_risk_students",
        "medium_risk_students",
        "low_risk_students",
        "last_updated",
    )
    search_fields = ("course__title",)
