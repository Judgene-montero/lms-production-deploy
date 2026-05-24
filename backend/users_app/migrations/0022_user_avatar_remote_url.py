from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0021_course_end_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_remote_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
