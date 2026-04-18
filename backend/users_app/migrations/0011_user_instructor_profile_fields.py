from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0010_adminlog_sitesettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/"),
        ),
        migrations.AddField(
            model_name="user",
            name="bio",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="user",
            name="department",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_assignment_submission",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_quiz_completed",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_student_join_course",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_instructor_announcement",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_assignment_graded",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_quiz_released",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_due_date_approaching",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]
