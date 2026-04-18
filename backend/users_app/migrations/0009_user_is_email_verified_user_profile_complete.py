from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0008_course_join_code_course_join_code_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="profile_complete",
            field=models.BooleanField(default=False),
        ),
    ]
