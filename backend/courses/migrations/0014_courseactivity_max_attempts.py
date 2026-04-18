from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0013_quiz_attempt_and_activity_quiz_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="courseactivity",
            name="max_attempts",
            field=models.PositiveIntegerField(default=3),
        ),
    ]
