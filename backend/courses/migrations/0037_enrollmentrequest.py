from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0036_meeting_meetingattendance"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EnrollmentRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="enrollment_requests", to="users_app.course")),
                (
                    "reviewed_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_enrollment_requests", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "student",
                    models.ForeignKey(limit_choices_to={"role": "student"}, on_delete=django.db.models.deletion.CASCADE, related_name="enrollment_requests", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="enrollmentrequest",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "pending")),
                fields=("course", "student"),
                name="unique_pending_enrollment_request_per_course_student",
            ),
        ),
    ]
