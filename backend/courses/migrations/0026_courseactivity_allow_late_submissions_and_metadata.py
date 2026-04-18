from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0025_classworkdraft_anti_cheat_disable_copy_paste_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="courseactivity",
            name="allow_late_submissions",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="courseactivity",
            name="classwork_metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
