from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0035_lessoncompletion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Meeting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("scheduled_time", models.DateTimeField()),
                ("meeting_link", models.URLField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("course", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="meetings", to="users_app.course")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="created_meetings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["scheduled_time", "id"],
            },
        ),
        migrations.CreateModel(
            name="MeetingAttendance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("meeting", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="attendances", to="courses.meeting")),
                (
                    "student",
                    models.ForeignKey(
                        limit_choices_to={"role": "student"},
                        on_delete=models.deletion.CASCADE,
                        related_name="meeting_attendances",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-joined_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="meetingattendance",
            constraint=models.UniqueConstraint(fields=("meeting", "student"), name="unique_meeting_attendance_per_student"),
        ),
    ]
