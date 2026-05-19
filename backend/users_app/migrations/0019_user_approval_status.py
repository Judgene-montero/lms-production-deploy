from django.db import migrations, models


def backfill_user_approval_status(apps, schema_editor):
    User = apps.get_model("users_app", "User")
    SiteSettings = apps.get_model("users_app", "SiteSettings")

    for user in User.objects.all().iterator():
        if user.role == "instructor":
            approval_status = "approved" if user.is_active else "pending"
        else:
            approval_status = "not_required"

        User.objects.filter(pk=user.pk).update(
            approval_status=approval_status,
            is_email_verified=True,
        )

    SiteSettings.objects.all().update(require_email_verification=False)


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("users_app", "0018_category_course_schedule_and_thumbnail_updates"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("not_required", "Not Required"),
                    ("pending", "Pending"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                default="not_required",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_user_approval_status, noop_reverse),
    ]
