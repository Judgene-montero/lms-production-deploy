from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0026_courseactivity_allow_late_submissions_and_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="quizattempt",
            name="last_activity_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="question_snapshot",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
