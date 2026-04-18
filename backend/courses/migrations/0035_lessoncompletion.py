from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0034_quizattempt_graded_at_quizattempt_graded_by_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonCompletion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("completed_at", models.DateTimeField(auto_now_add=True)),
                ("lesson", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="completions", to="courses.lesson")),
                (
                    "student",
                    models.ForeignKey(
                        limit_choices_to={"role": "student"},
                        on_delete=models.deletion.CASCADE,
                        related_name="lesson_completions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-completed_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="lessoncompletion",
            constraint=models.UniqueConstraint(fields=("lesson", "student"), name="unique_lesson_completion_per_student"),
        ),
    ]
