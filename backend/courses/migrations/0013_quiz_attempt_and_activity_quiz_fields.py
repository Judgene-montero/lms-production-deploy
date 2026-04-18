from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0012_alter_lesson_options_lesson_content_lesson_order_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="courseactivity",
            name="quiz_questions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="courseactivity",
            name="quiz_time_limit_seconds",
            field=models.PositiveIntegerField(default=600),
        ),
        migrations.CreateModel(
            name="QuizAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.FloatField(default=0)),
                ("total_points", models.FloatField(default=0)),
                ("answers", models.JSONField(blank=True, default=list)),
                ("result_breakdown", models.JSONField(blank=True, default=list)),
                ("correct_answers", models.PositiveIntegerField(default=0)),
                ("incorrect_answers", models.PositiveIntegerField(default=0)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("time_spent", models.PositiveIntegerField(default=0, help_text="Time spent in seconds")),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="quiz_attempts", to="courses.courseactivity")),
                ("student", models.ForeignKey(limit_choices_to={"role": "student"}, on_delete=django.db.models.deletion.CASCADE, related_name="quiz_attempts", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-started_at", "-id"],
            },
        ),
    ]
