from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0009_user_is_email_verified_user_profile_complete"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("require_email_verification", models.BooleanField(default=True)),
                ("allow_instructor_self_registration", models.BooleanField(default=True)),
                ("allow_username_change", models.BooleanField(default=True)),
                (
                    "default_user_role",
                    models.CharField(
                        choices=[("student", "Student"), ("instructor", "Instructor")],
                        default="student",
                        max_length=20,
                    ),
                ),
                ("analytics_polling_interval", models.PositiveIntegerField(default=10)),
                ("max_login_attempts", models.PositiveIntegerField(default=5)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="AdminLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True, default="")),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "performed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="performed_admin_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="targeted_admin_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-timestamp"]},
        ),
    ]
