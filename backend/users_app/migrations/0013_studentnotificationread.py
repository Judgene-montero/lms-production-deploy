from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0012_course_is_archived"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentNotificationRead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_key", models.CharField(max_length=255)),
                ("read_at", models.DateTimeField(auto_now_add=True)),
                (
                    "student",
                    models.ForeignKey(
                        limit_choices_to={"role": "student"},
                        on_delete=models.deletion.CASCADE,
                        related_name="read_notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-read_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="studentnotificationread",
            constraint=models.UniqueConstraint(fields=("student", "notification_key"), name="unique_student_notification_read"),
        ),
    ]
