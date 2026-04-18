from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0033_gradingcomponent_activity_ids_and_custom_config"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="quizattempt",
            name="graded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="graded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="graded_quiz_attempts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="is_overridden",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="override_score",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="status",
            field=models.CharField(
                choices=[("pending_review", "Pending review"), ("graded", "Graded")],
                default="graded",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="visibility_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name="QuizAttemptScoreAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_id", models.CharField(blank=True, default="", max_length=100)),
                ("previous_score", models.FloatField(blank=True, null=True)),
                ("new_score", models.FloatField(blank=True, null=True)),
                ("note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="quiz_attempt_score_audits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "attempt",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="score_audits",
                        to="courses.quizattempt",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="QuizAttemptAnswer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_id", models.CharField(max_length=100)),
                ("question_text", models.TextField(blank=True, default="")),
                ("question_type", models.CharField(blank=True, default="", max_length=40)),
                ("student_answer", models.TextField(blank=True, default="")),
                ("max_points", models.FloatField(default=0)),
                ("auto_score", models.FloatField(blank=True, null=True)),
                ("manual_score", models.FloatField(blank=True, null=True)),
                ("override_score", models.FloatField(blank=True, null=True)),
                ("feedback", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[("pending_review", "Pending review"), ("graded", "Graded")],
                        default="graded",
                        max_length=20,
                    ),
                ),
                (
                    "attempt",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answer_records",
                        to="courses.quizattempt",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
                "unique_together": {("attempt", "question_id")},
            },
        ),
    ]
